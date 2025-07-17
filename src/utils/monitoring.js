const os = require('os');
const fs = require('fs').promises;
const logger = require('./logger');
const { firestore } = require('../config/firebase');

/**
 * Sistema de monitoreo y métricas avanzado
 * Proporciona health checks, métricas de rendimiento y alertas
 */
class MonitoringService {
  constructor () {
    this.startTime = Date.now();
    this.metrics = {
      requests: new Map(),
      errors: new Map(),
      performance: new Map(),
      system: new Map(),
    };

    this.healthChecks = new Map();
    this.alerts = new Map();
    this.thresholds = {
      memoryUsage: 85, // % de uso de memoria
      diskSpace: 90, // % de uso de disco
      responseTime: 5000, // ms
      errorRate: 5, // % de errores
      cpuUsage: 80, // % de uso de CPU
    };

    // Inicializar monitoreo
    this.startSystemMonitoring();
    this.registerHealthChecks();
  }

  /**
   * Middleware para métricas de requests
   */
  requestMetrics () {
    return (req, res, next) => {
      const startTime = Date.now();
      const originalSend = res.send;

      // Incrementar contador de requests
      this.incrementCounter('requests.total');
      this.incrementCounter(`requests.method.${req.method.toLowerCase()}`);
      this.incrementCounter(`requests.endpoint.${this.normalizeEndpoint(req.route?.path || req.path)}`);

      // Override de res.send para capturar métricas
      res.send = function (data) {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;

        // Métricas de respuesta
        monitoring.recordResponseTime(req.route?.path || req.path, duration);
        monitoring.incrementCounter(`responses.status.${Math.floor(statusCode / 100)}xx`);

        if (statusCode >= 400) {
          monitoring.incrementCounter('responses.errors');
          monitoring.recordError(req, statusCode, duration);
        }

        // Métricas por usuario (sin datos sensibles)
        if (req.user?.role) {
          monitoring.incrementCounter(`requests.role.${req.user.role}`);
        }

        // Restaurar función original y ejecutar
        originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Normalizar endpoint para métricas
   */
  normalizeEndpoint (endpoint) {
    if (!endpoint) return 'unknown';

    // Reemplazar IDs con placeholder
    return endpoint
      .replace(/\/[a-f0-9-]{20,}/g, '/:id')
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[+]\d+/g, '/:phone')
      .substring(0, 50); // Limitar longitud
  }

  /**
   * Incrementar contador de métricas
   */
  incrementCounter (key, value = 1) {
    const current = this.metrics.requests.get(key) || 0;
    this.metrics.requests.set(key, current + value);
  }

  /**
   * Registrar tiempo de respuesta
   */
  recordResponseTime (endpoint, duration) {
    const key = `response_time.${this.normalizeEndpoint(endpoint)}`;

    if (!this.metrics.performance.has(key)) {
      this.metrics.performance.set(key, []);
    }

    const times = this.metrics.performance.get(key);
    times.push(duration);

    // Mantener solo los últimos 100 registros
    if (times.length > 100) {
      times.splice(0, 50);
    }

    // Verificar threshold de alerta
    if (duration > this.thresholds.responseTime) {
      this.triggerAlert('slow_response', {
        endpoint: this.normalizeEndpoint(endpoint),
        duration,
        threshold: this.thresholds.responseTime,
      });
    }
  }

  /**
   * Registrar error sin información sensible
   */
  recordError (req, statusCode, duration) {
    const errorKey = `error.${statusCode}`;
    this.incrementCounter(errorKey);

    // Log estructurado sin datos sensibles
    logger.warn('Request error recorded', {
      method: req.method,
      endpoint: this.normalizeEndpoint(req.route?.path || req.path),
      statusCode,
      duration,
      userRole: req.user?.role || 'anonymous',
      userAgent: this.sanitizeUserAgent(req.get('User-Agent')),
      // NO incluir: IP, tokens, query params, body
    });

    // Verificar threshold de tasa de errores
    this.checkErrorRate();
  }

  /**
   * Sanitizar User-Agent para logs
   */
  sanitizeUserAgent (userAgent) {
    if (!userAgent) return 'unknown';

    // Extraer solo información básica del navegador
    const patterns = [
      /Chrome\/[\d.]+/,
      /Firefox\/[\d.]+/,
      /Safari\/[\d.]+/,
      /Edge\/[\d.]+/,
      /Opera\/[\d.]+/,
      /Mobile/,
      /Android/,
      /iPhone/,
      /iPad/,
    ];

    const matches = patterns
      .map(pattern => userAgent.match(pattern)?.[0])
      .filter(Boolean);

    return matches.length > 0 ? matches.join(' ') : 'other';
  }

  /**
   * Verificar tasa de errores
   */
  checkErrorRate () {
    const totalRequests = this.metrics.requests.get('requests.total') || 0;
    const totalErrors = this.metrics.requests.get('responses.errors') || 0;

    if (totalRequests > 100) { // Solo verificar con suficientes datos
      const errorRate = (totalErrors / totalRequests) * 100;

      if (errorRate > this.thresholds.errorRate) {
        this.triggerAlert('high_error_rate', {
          errorRate: errorRate.toFixed(2),
          threshold: this.thresholds.errorRate,
          totalRequests,
          totalErrors,
        });
      }
    }
  }

  /**
   * Monitoreo del sistema
   */
  startSystemMonitoring () {
    // Métricas cada 30 segundos
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Health checks cada 60 segundos
    setInterval(() => {
      this.runHealthChecks();
    }, 60000);

    // Limpieza de métricas cada 10 minutos
    setInterval(() => {
      this.cleanupMetrics();
    }, 600000);
  }

  /**
   * Recopilar métricas del sistema
   */
  async collectSystemMetrics () {
    try {
      // Métricas de memoria
      const memUsage = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const memoryUsagePercent = ((totalMem - freeMem) / totalMem) * 100;

      this.metrics.system.set('memory.heap_used', memUsage.heapUsed);
      this.metrics.system.set('memory.heap_total', memUsage.heapTotal);
      this.metrics.system.set('memory.external', memUsage.external);
      this.metrics.system.set('memory.usage_percent', memoryUsagePercent);

      // Métricas de CPU
      const cpuUsage = await this.getCPUUsage();
      this.metrics.system.set('cpu.usage_percent', cpuUsage);

      // Métricas de disco
      const diskUsage = await this.getDiskUsage();
      this.metrics.system.set('disk.usage_percent', diskUsage.usagePercent);
      this.metrics.system.set('disk.free_space', diskUsage.freeSpace);

      // Uptime
      this.metrics.system.set('uptime', Date.now() - this.startTime);

      // Verificar alertas
      this.checkSystemAlerts(memoryUsagePercent, cpuUsage, diskUsage.usagePercent);

      // Log periódico de métricas (cada 5 minutos)
      if (Date.now() % 300000 < 30000) {
        logger.info('System metrics collected', {
          memory: `${memoryUsagePercent.toFixed(1)}%`,
          cpu: `${cpuUsage.toFixed(1)}%`,
          disk: `${diskUsage.usagePercent.toFixed(1)}%`,
          uptime: this.formatUptime(Date.now() - this.startTime),
        });
      }
    } catch (error) {
      logger.error('Error collecting system metrics:', error);
    }
  }

  /**
   * Obtener uso de CPU
   */
  async getCPUUsage () {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = process.hrtime(startTime);

        const userUsage = endUsage.user / 1000; // microsegundos a milisegundos
        const systemUsage = endUsage.system / 1000;
        const totalTime = endTime[0] * 1000 + endTime[1] / 1000000; // a milisegundos

        const cpuPercent = ((userUsage + systemUsage) / totalTime) * 100;
        resolve(Math.min(cpuPercent, 100)); // Cap a 100%
      }, 100);
    });
  }

  /**
   * Obtener uso de disco
   */
  async getDiskUsage () {
    try {
      const stats = await fs.statfs(process.cwd());
      const total = stats.blocks * stats.blksize;
      const free = stats.bavail * stats.blksize;
      const used = total - free;
      const usagePercent = (used / total) * 100;

      return {
        total,
        free,
        used,
        usagePercent,
        freeSpace: free,
      };
    } catch (error) {
      // Fallback si statfs no está disponible
      return {
        total: 0,
        free: 0,
        used: 0,
        usagePercent: 0,
        freeSpace: 0,
      };
    }
  }

  /**
   * Verificar alertas del sistema
   */
  checkSystemAlerts (memoryUsage, cpuUsage, diskUsage) {
    if (memoryUsage > this.thresholds.memoryUsage) {
      this.triggerAlert('high_memory_usage', {
        current: memoryUsage.toFixed(1),
        threshold: this.thresholds.memoryUsage,
      });
    }

    if (cpuUsage > this.thresholds.cpuUsage) {
      this.triggerAlert('high_cpu_usage', {
        current: cpuUsage.toFixed(1),
        threshold: this.thresholds.cpuUsage,
      });
    }

    if (diskUsage > this.thresholds.diskSpace) {
      this.triggerAlert('high_disk_usage', {
        current: diskUsage.toFixed(1),
        threshold: this.thresholds.diskSpace,
      });
    }
  }

  /**
   * Registrar health checks
   */
  registerHealthChecks () {
    // Health check de Firebase
    this.healthChecks.set('firebase', async () => {
      try {
        await firestore.collection('_health').doc('test').set({
          timestamp: new Date(),
        });
        return { status: 'healthy', latency: Date.now() };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: 'Firebase connection failed',
          details: error.message.substring(0, 100),
        };
      }
    });

    // Health check de memoria
    this.healthChecks.set('memory', async () => {
      const memUsage = process.memoryUsage();
      const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      return {
        status: usagePercent < 90 ? 'healthy' : 'unhealthy',
        usage: `${usagePercent.toFixed(1)}%`,
        heapUsed: this.formatBytes(memUsage.heapUsed),
        heapTotal: this.formatBytes(memUsage.heapTotal),
      };
    });

    // Health check de uptime
    this.healthChecks.set('uptime', async () => {
      const uptime = Date.now() - this.startTime;
      return {
        status: 'healthy',
        uptime: this.formatUptime(uptime),
        startTime: new Date(this.startTime).toISOString(),
      };
    });
  }

  /**
   * Ejecutar health checks
   */
  async runHealthChecks () {
    const results = {};
    let overallHealth = 'healthy';

    for (const [name, check] of this.healthChecks.entries()) {
      try {
        const result = await check();
        results[name] = result;

        if (result.status !== 'healthy') {
          overallHealth = 'unhealthy';
        }
      } catch (error) {
        results[name] = {
          status: 'error',
          error: error.message.substring(0, 100),
        };
        overallHealth = 'unhealthy';
      }
    }

    // Almacenar último health check
    this.lastHealthCheck = {
      timestamp: new Date().toISOString(),
      status: overallHealth,
      checks: results,
    };

    // Log si hay problemas
    if (overallHealth !== 'healthy') {
      logger.warn('Health check failed', {
        status: overallHealth,
        failedChecks: Object.entries(results)
          .filter(([, result]) => result.status !== 'healthy')
          .map(([name]) => name),
      });
    }

    return this.lastHealthCheck;
  }

  /**
   * Disparar alerta
   */
  triggerAlert (type, data) {
    const alertKey = `${type}_${Date.now()}`;
    const alert = {
      type,
      data,
      timestamp: new Date().toISOString(),
      resolved: false,
    };

    this.alerts.set(alertKey, alert);

    // Log de alerta
    logger.warn(`Alert triggered: ${type}`, {
      type,
      ...data,
      alertId: alertKey,
    });

    // Limpiar alertas antiguas (más de 1 hora)
    setTimeout(() => {
      this.alerts.delete(alertKey);
    }, 3600000);
  }

  /**
   * Limpiar métricas antiguas
   */
  cleanupMetrics () {
    // Limpiar contadores de requests (mantener solo últimos datos)
    const requestKeys = Array.from(this.metrics.requests.keys());
    if (requestKeys.length > 1000) {
      // Mantener solo las métricas más importantes
      const importantKeys = requestKeys.filter(key =>
        key.includes('total') ||
        key.includes('errors') ||
        key.includes('status'),
      );

      this.metrics.requests.clear();
      importantKeys.forEach(key => {
        this.metrics.requests.set(key, 0);
      });
    }

    // Limpiar métricas de rendimiento antiguas
    for (const values of this.metrics.performance.values()) {
      if (values.length > 50) {
        values.splice(0, values.length - 50);
      }
    }

    logger.info('Metrics cleanup completed', {
      requestMetrics: this.metrics.requests.size,
      performanceMetrics: this.metrics.performance.size,
      systemMetrics: this.metrics.system.size,
    });
  }

  /**
   * Obtener resumen de métricas
   */
  getMetricsSummary () {
    const summary = {
      timestamp: new Date().toISOString(),
      uptime: this.formatUptime(Date.now() - this.startTime),
      requests: {
        total: this.metrics.requests.get('requests.total') || 0,
        errors: this.metrics.requests.get('responses.errors') || 0,
        errorRate: this.calculateErrorRate(),
      },
      system: {
        memory: {
          usage: this.metrics.system.get('memory.usage_percent')?.toFixed(1) + '%',
          heapUsed: this.formatBytes(this.metrics.system.get('memory.heap_used')),
        },
        cpu: {
          usage: this.metrics.system.get('cpu.usage_percent')?.toFixed(1) + '%',
        },
        disk: {
          usage: this.metrics.system.get('disk.usage_percent')?.toFixed(1) + '%',
          freeSpace: this.formatBytes(this.metrics.system.get('disk.free_space')),
        },
      },
      health: this.lastHealthCheck?.status || 'unknown',
      activeAlerts: this.getActiveAlerts().length,
    };

    return summary;
  }

  /**
   * Calcular tasa de errores
   */
  calculateErrorRate () {
    const total = this.metrics.requests.get('requests.total') || 0;
    const errors = this.metrics.requests.get('responses.errors') || 0;

    if (total === 0) return 0;
    return ((errors / total) * 100).toFixed(2);
  }

  /**
   * Obtener alertas activas
   */
  getActiveAlerts () {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Endpoint de health check para load balancers
   */
  healthEndpoint () {
    return async (req, res) => {
      try {
        const health = await this.runHealthChecks();
        const status = health.status === 'healthy' ? 200 : 503;

        res.status(status).json({
          status: health.status,
          timestamp: health.timestamp,
          uptime: this.formatUptime(Date.now() - this.startTime),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          checks: health.checks,
        });
      } catch (error) {
        res.status(503).json({
          status: 'error',
          error: 'Health check failed',
          timestamp: new Date().toISOString(),
        });
      }
    };
  }

  /**
   * Endpoint de métricas
   */
  metricsEndpoint () {
    return (req, res) => {
      try {
        const metrics = this.getMetricsSummary();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to collect metrics',
          timestamp: new Date().toISOString(),
        });
      }
    };
  }

  /**
   * Formatear bytes a formato legible
   */
  formatBytes (bytes) {
    if (!bytes) return '0 B';

    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * Formatear uptime a formato legible
   */
  formatUptime (ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Configurar thresholds de alertas
   */
  setThresholds (thresholds) {
    this.thresholds = { ...this.thresholds, ...thresholds };
    logger.info('Alert thresholds updated', this.thresholds);
  }

  /**
   * Obtener estadísticas de rendimiento por endpoint
   */
  getPerformanceStats () {
    const stats = {};

    for (const [key, times] of this.metrics.performance.entries()) {
      if (times.length > 0) {
        const sorted = [...times].sort((a, b) => a - b);
        const len = sorted.length;

        stats[key] = {
          count: len,
          avg: Math.round(times.reduce((a, b) => a + b, 0) / len),
          min: sorted[0],
          max: sorted[len - 1],
          p50: sorted[Math.floor(len * 0.5)],
          p95: sorted[Math.floor(len * 0.95)],
          p99: sorted[Math.floor(len * 0.99)],
        };
      }
    }

    return stats;
  }
}

// Crear instancia única
const monitoring = new MonitoringService();

module.exports = {
  MonitoringService,
  monitoring,

  // Middlewares
  requestMetrics: monitoring.requestMetrics(),

  // Endpoints
  healthEndpoint: monitoring.healthEndpoint(),
  metricsEndpoint: monitoring.metricsEndpoint(),

  // Utilidades
  getMetrics: () => monitoring.getMetricsSummary(),
  getHealth: () => monitoring.lastHealthCheck,
  getAlerts: () => monitoring.getActiveAlerts(),
  getPerformance: () => monitoring.getPerformanceStats(),
  setThresholds: (thresholds) => monitoring.setThresholds(thresholds),
};
