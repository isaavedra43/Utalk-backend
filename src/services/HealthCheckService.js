/**
 * 🏥 SERVICIO DE HEALTH CHECK ENTERPRISE
 * 
 * Características:
 * - Verificación de todos los servicios críticos
 * - Health checks detallados con métricas
 * - Monitoreo en tiempo real
 * - Alertas automáticas por fallos
 * 
 * @version 2.0.0
 */

const logger = require('../utils/logger');
const { firestore, storage } = require('../config/firebase');
const { CacheService } = require('./CacheService');
const os = require('os');

class HealthCheckService {
  constructor() {
    this.services = {
      firestore: { status: 'unknown', lastCheck: null, responseTime: null },
      storage: { status: 'unknown', lastCheck: null, responseTime: null },
      redis: { status: 'unknown', lastCheck: null, responseTime: null },
      system: { status: 'unknown', lastCheck: null, responseTime: null }
    };
    
    this.isInitialized = false;
    this.checkInterval = null;
    
    // Configuración
    this.config = {
      checkIntervalMs: 60000, // 1 minuto
      timeoutMs: 5000, // 5 segundos timeout
      retryAttempts: 3,
      alertThreshold: 3 // 3 fallos consecutivos para alertar
    };
    
    this.consecutiveFailures = {
      firestore: 0,
      storage: 0,
      redis: 0,
      system: 0
    };
  }

  /**
   * 🚀 INICIALIZAR SERVICIO
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      logger.info('🏥 Inicializando Health Check Service...', {
        category: 'HEALTH_INIT'
      });

      // Realizar check inicial
      await this.performFullHealthCheck();

      // Configurar monitoreo automático
      this.startPeriodicChecks();

      this.isInitialized = true;

      logger.info('✅ Health Check Service inicializado', {
        category: 'HEALTH_SUCCESS',
        services: Object.keys(this.services),
        checkInterval: this.config.checkIntervalMs
      });

    } catch (error) {
      logger.error('Error inicializando Health Check Service', {
        category: 'HEALTH_INIT_ERROR',
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 📊 REALIZAR HEALTH CHECK COMPLETO
   */
  async performFullHealthCheck() {
    const startTime = Date.now();
    
    try {
      logger.debug('🔍 Iniciando health check completo', {
        category: 'HEALTH_CHECK_START'
      });

      // Ejecutar checks en paralelo para mejor performance
      const checks = await Promise.allSettled([
        this.checkFirestore(),
        this.checkFirebaseStorage(),
        this.checkRedis(),
        this.checkSystem()
      ]);

      // Procesar resultados
      const [firestoreResult, storageResult, redisResult, systemResult] = checks;

      this.updateServiceStatus('firestore', firestoreResult);
      this.updateServiceStatus('storage', storageResult);
      this.updateServiceStatus('redis', redisResult);
      this.updateServiceStatus('system', systemResult);

      const totalTime = Date.now() - startTime;

      logger.info('✅ Health check completado', {
        category: 'HEALTH_CHECK_COMPLETED',
        duration: totalTime + 'ms',
        services: this.getHealthSummary()
      });

      return this.getHealthSummary();

    } catch (error) {
      logger.error('Error en health check completo', {
        category: 'HEALTH_CHECK_ERROR',
        error: error.message,
        duration: Date.now() - startTime + 'ms'
      });
      throw error;
    }
  }

  /**
   * 🔥 VERIFICAR FIRESTORE
   */
  async checkFirestore() {
    const startTime = Date.now();
    
    try {
      // Test de lectura básico
      const testCollection = firestore.collection('_health_check');
      await testCollection.limit(1).get();
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime,
        message: 'Firestore conectado correctamente',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'unhealthy',
        responseTime,
        error: error.message,
        message: 'Error conectando a Firestore',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 🗄️ VERIFICAR FIREBASE STORAGE
   */
  async checkFirebaseStorage() {
    const startTime = Date.now();
    
    try {
      // Test de acceso al bucket
      const bucket = storage.bucket();
      await bucket.getMetadata();
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime,
        message: 'Firebase Storage accesible',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'unhealthy',
        responseTime,
        error: error.message,
        message: 'Error accediendo a Firebase Storage',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 🔴 VERIFICAR REDIS
   */
  async checkRedis() {
    const startTime = Date.now();
    
    try {
      // Usar el CacheService para verificar Redis
      const cacheService = CacheService;
      await cacheService.ping();
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime,
        message: 'Redis conectado correctamente',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        status: error.message.includes('Redis no configurado') ? 'disabled' : 'unhealthy',
        responseTime,
        error: error.message,
        message: 'Redis no disponible (usando fallback local)',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * ⚙️ VERIFICAR SISTEMA
   */
  async checkSystem() {
    const startTime = Date.now();
    
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const loadAverage = os.loadavg();
      
      // Verificar memoria (alerta si heap usado > 80% del total)
      const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      const memoryStatus = heapUsedPercent > 80 ? 'warning' : 'healthy';
      
      // Verificar carga del CPU (alerta si promedio > 2.0)
      const cpuStatus = loadAverage[0] > 2.0 ? 'warning' : 'healthy';
      
      const overallStatus = (memoryStatus === 'warning' || cpuStatus === 'warning') ? 'warning' : 'healthy';
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: overallStatus,
        responseTime,
        metrics: {
          memory: {
            status: memoryStatus,
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
            heapUsedPercent: Math.round(heapUsedPercent) + '%'
          },
          cpu: {
            status: cpuStatus,
            loadAverage: loadAverage.map(load => Math.round(load * 100) / 100),
            usage: {
              user: cpuUsage.user,
              system: cpuUsage.system
            }
          },
          uptime: process.uptime(),
          platform: os.platform(),
          nodeVersion: process.version
        },
        message: 'Sistema operativo funcionando',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'unhealthy',
        responseTime,
        error: error.message,
        message: 'Error verificando sistema',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 📝 ACTUALIZAR STATUS DE SERVICIO
   */
  updateServiceStatus(serviceName, result) {
    const isHealthy = result.status === 'fulfilled' && 
                     result.value.status === 'healthy';
    
    if (isHealthy) {
      this.consecutiveFailures[serviceName] = 0;
      this.services[serviceName] = {
        ...result.value,
        lastCheck: new Date().toISOString()
      };
    } else {
      this.consecutiveFailures[serviceName]++;
      this.services[serviceName] = {
        status: result.status === 'rejected' ? 'error' : result.value.status,
        error: result.status === 'rejected' ? result.reason.message : result.value.error,
        lastCheck: new Date().toISOString(),
        responseTime: result.status === 'rejected' ? null : result.value.responseTime
      };
      
      // Verificar si necesitamos enviar alerta
      if (this.consecutiveFailures[serviceName] >= this.config.alertThreshold) {
        this.sendAlert(serviceName, this.services[serviceName]);
      }
    }
  }

  /**
   * 🚨 ENVIAR ALERTA
   */
  sendAlert(serviceName, serviceStatus) {
    logger.error('🚨 ALERTA: Servicio crítico falló múltiples veces', {
      category: 'HEALTH_ALERT',
      service: serviceName,
      consecutiveFailures: this.consecutiveFailures[serviceName],
      serviceStatus,
      severity: 'CRITICAL',
      requiresAttention: true
    });
  }

  /**
   * 📊 OBTENER RESUMEN DE SALUD
   */
  getHealthSummary() {
    const summary = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: { ...this.services },
      overall: {
        healthy: 0,
        unhealthy: 0,
        warning: 0,
        disabled: 0,
        error: 0
      }
    };

    // Contar estados
    for (const service of Object.values(this.services)) {
      summary.overall[service.status] = (summary.overall[service.status] || 0) + 1;
    }

    // Determinar estado general
    if (summary.overall.error > 0 || summary.overall.unhealthy > 0) {
      summary.status = 'unhealthy';
    } else if (summary.overall.warning > 0) {
      summary.status = 'warning';
    }

    return summary;
  }

  /**
   * 🔄 INICIAR CHECKS PERIÓDICOS
   */
  startPeriodicChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      try {
        await this.performFullHealthCheck();
      } catch (error) {
        logger.error('Error en check periódico', {
          category: 'HEALTH_PERIODIC_ERROR',
          error: error.message
        });
      }
    }, this.config.checkIntervalMs);

    logger.info('🔄 Checks periódicos iniciados', {
      category: 'HEALTH_PERIODIC_START',
      interval: this.config.checkIntervalMs
    });
  }

  /**
   * 🛑 DETENER SERVICIO
   */
  async stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isInitialized = false;

    logger.info('🛑 Health Check Service detenido', {
      category: 'HEALTH_STOPPED'
    });
  }

  /**
   * 📈 OBTENER MÉTRICAS DETALLADAS
   */
  getDetailedMetrics() {
    return {
      services: this.services,
      consecutiveFailures: this.consecutiveFailures,
      configuration: this.config,
      isInitialized: this.isInitialized,
      lastFullCheck: Math.max(
        ...Object.values(this.services)
          .filter(s => s.lastCheck)
          .map(s => new Date(s.lastCheck).getTime())
      ),
      systemInfo: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        pid: process.pid,
        uptime: process.uptime()
      }
    };
  }
}

// Singleton instance
let healthCheckService = null;

const getHealthCheckService = () => {
  if (!healthCheckService) {
    healthCheckService = new HealthCheckService();
  }
  return healthCheckService;
};

module.exports = {
  HealthCheckService,
  getHealthCheckService
}; 