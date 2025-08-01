/**
 * 🔍 SISTEMA DE LOGGING PROFESIONAL Y ESTRUCTURADO
 * 
 * Características mejoradas para manejo de errores:
 * - RequestId tracking automático
 * - Contexto enriquecido por defecto
 * - Filtrado de datos sensibles
 * - Formato JSON estructurado
 * - Rotación automática de logs
 * - Métricas de logging integradas
 * - Alertas automáticas por severidad
 * 
 * Basado en mejores prácticas según:
 * - https://medium.com/@mohantaankit2002/optimizing-memory-usage-in-node-js-applications-for-high-traffic-scenarios-1a6d4658aa9d
 * - https://nodejs.org/en/learn/diagnostics/memory/understanding-and-tuning-memory
 * 
 * @version 2.0.0
 * @author Logging Team
 */

const winston = require('winston');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

class AdvancedLogger {
  constructor() {
    this.asyncLocalStorage = new AsyncLocalStorage();
    this.logMetrics = {
      total: 0,
      byLevel: new Map(),
      byCategory: new Map(),
      errors: 0,
      warnings: 0,
      lastReset: Date.now()
    };
    
    this.sensitiveFields = [
      'password', 'token', 'authorization', 'secret', 'key',
      'auth', 'credential', 'pass', 'pwd', 'jwt', 'session',
      'cookie', 'x-api-key', 'api-key', 'bearer'
    ];
    
    this.initializeWinston();
    this.setupMetricsReset();
    this.setupMemoryMonitoring();
  }

  /**
   * 🚀 INICIALIZAR WINSTON CON CONFIGURACIÓN AVANZADA
   */
  initializeWinston() {
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Formato para desarrollo (colorido y legible)
    const developmentFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, category, requestId, ...meta }) => {
        const reqId = requestId ? `[${requestId}]` : '';
        const cat = category ? `[${category}]` : '';
        const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
        return `${timestamp} ${level} ${cat}${reqId}: ${message}${metaStr}`;
      })
    );

    // Formato para producción (JSON estructurado)
    const productionFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf((info) => {
        return JSON.stringify({
          timestamp: info.timestamp,
          level: info.level,
          message: info.message,
          category: info.category || 'GENERAL',
          requestId: info.requestId || this.getCurrentRequestId(),
          processId: process.pid,
          nodeEnv: process.env.NODE_ENV,
          ...this.sanitizeLogData(info)
        });
      })
    );

    // Configurar transports
    const transports = [
      // Console transport con configuración específica por entorno
      new winston.transports.Console({
        level: this.getLogLevel(),
        format: isDevelopment ? developmentFormat : productionFormat,
        handleExceptions: true,
        handleRejections: true,
        silent: process.env.NODE_ENV === 'test'
      })
    ];

    // File transports para producción (con manejo de errores de permisos)
    if ((isProduction || process.env.ENABLE_FILE_LOGGING === 'true') && process.env.DISABLE_FILE_LOGGING !== 'true') {
      try {
        const logDir = process.env.LOG_DIR || './logs';
        
        // Verificar si podemos escribir en el directorio
        const fs = require('fs');
        const testFile = path.join(logDir, '.test-write');
        
        // Intentar crear el directorio si no existe
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
        
        // Probar escritura
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        
        // Si llegamos aquí, podemos escribir archivos
        transports.push(
          // Archivo para todos los logs
          new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            level: 'info',
            format: productionFormat,
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true
          }),
          
          // Archivo solo para errores
          new winston.transports.File({
            filename: path.join(logDir, 'errors.log'),
            level: 'error',
            format: productionFormat,
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 10,
            tailable: true
          })
        );
        
        // File logging habilitado exitosamente
        console.log('✅ File logging habilitado en:', logDir);
        
      } catch (error) {
        // Si no podemos escribir archivos, solo usar console
        console.warn('⚠️ No se pudo habilitar file logging (permisos insuficientes):', error.message);
        console.log('ℹ️ Continuando solo con console logging...');
      }
    }

    // Crear logger principal
    this.winston = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: productionFormat,
      transports: transports,
      exitOnError: false,
      silent: process.env.NODE_ENV === 'test'
    });

    // Manejar errores del logger
    this.winston.on('error', (error) => {
      // Fallback seguro: solo en desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.error('Error en Winston logger:', error);
      }
    });
  }

  /**
   * 🏷️ OBTENER REQUEST ID ACTUAL
   */
  getCurrentRequestId() {
    const store = this.asyncLocalStorage.getStore();
    return store?.requestId || 'no-request-context';
  }

  /**
   * 📊 OBTENER NIVEL DE LOG SEGÚN ENTORNO
   */
  getLogLevel() {
    const env = process.env.NODE_ENV || 'development';
    
    switch (env) {
      case 'production':
        return process.env.LOG_LEVEL || 'info';
      case 'development':
        return process.env.LOG_LEVEL || 'debug';
      case 'test':
        return process.env.LOG_LEVEL || 'error';
      default:
        return process.env.LOG_LEVEL || 'info';
    }
  }

  /**
   * 🧹 SANITIZAR DATOS DE LOG
   */
  sanitizeLogData(data) {
    if (!data || typeof data !== 'object') return data;

    const sanitized = {};
    
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      // Filtrar campos sensibles
      if (this.sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[FILTERED]';
        continue;
      }
      
      // Recursividad para objetos anidados
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeLogData(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'object' ? this.sanitizeLogData(item) : item
        );
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * 📊 INCREMENTAR MÉTRICAS
   */
  incrementMetrics(level, category) {
    this.logMetrics.total++;
    
    // Por nivel
    this.logMetrics.byLevel.set(level, 
      (this.logMetrics.byLevel.get(level) || 0) + 1
    );
    
    // Por categoría
    if (category) {
      this.logMetrics.byCategory.set(category, 
        (this.logMetrics.byCategory.get(category) || 0) + 1
      );
    }
    
    // Contadores específicos
    if (level === 'error') this.logMetrics.errors++;
    if (level === 'warn') this.logMetrics.warnings++;
  }

  /**
   * 🔄 CONFIGURAR RESET DE MÉTRICAS
   */
  setupMetricsReset() {
    setInterval(() => {
      this.winston.info('Métricas de logging (última hora)', {
        category: 'METRICS',
        metrics: {
          total: this.logMetrics.total,
          errors: this.logMetrics.errors,
          warnings: this.logMetrics.warnings,
          byLevel: Object.fromEntries(this.logMetrics.byLevel),
          byCategory: Object.fromEntries(this.logMetrics.byCategory)
        },
        period: 'last_hour',
        nodeMemory: process.memoryUsage()
      });

      // Reset metrics
      this.logMetrics = {
        total: 0,
        byLevel: new Map(),
        byCategory: new Map(),
        errors: 0,
        warnings: 0,
        lastReset: Date.now()
      };
    }, 60 * 60 * 1000); // Cada hora
  }

  /**
   * 📈 CONFIGURAR MONITOREO DE MEMORIA
   */
  setupMemoryMonitoring() {
    // Monitor memory every 10 minutes
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
      const heapUsagePercent = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);
      
      // Log normal memory stats
      this.winston.info('Estadísticas de memoria Node.js', {
        category: 'MEMORY',
        memory: {
          heapUsed: `${heapUsedMB}MB`,
          heapTotal: `${heapTotalMB}MB`,
          heapUsagePercent: `${heapUsagePercent}%`,
          rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
          external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB'
        },
        uptime: process.uptime(),
        pid: process.pid
      });
      
      // Alertas por alto uso de memoria
      if (heapUsagePercent > 85) {
        this.winston.error('ALERTA: Alto uso de memoria heap', {
          category: 'MEMORY_ALERT',
          severity: 'CRITICAL',
          heapUsagePercent,
          heapUsed: `${heapUsedMB}MB`,
          heapTotal: `${heapTotalMB}MB`,
          recommendedAction: 'Revisar posibles memory leaks'
        });
      } else if (heapUsagePercent > 70) {
        this.winston.warn('Advertencia: Uso moderado de memoria heap', {
          category: 'MEMORY_WARNING',
          severity: 'HIGH',
          heapUsagePercent,
          heapUsed: `${heapUsedMB}MB`,
          recommendedAction: 'Monitorear tendencia de memoria'
        });
      }
      
    }, 10 * 60 * 1000); // Cada 10 minutos
  }

  /**
   * 🔧 CREAR CONTEXTO DE LOG
   */
  createLogContext(category, additionalData = {}) {
    const baseContext = {
      category: category || 'GENERAL',
      requestId: this.getCurrentRequestId(),
      timestamp: new Date().toISOString(),
      processId: process.pid,
      nodeEnv: process.env.NODE_ENV
    };
    
    return {
      ...baseContext,
      ...this.sanitizeLogData(additionalData)
    };
  }

  /**
   * 📝 MÉTODOS DE LOGGING PRINCIPALES
   */
  error(message, data = {}, category = 'ERROR') {
    const context = this.createLogContext(category, data);
    this.incrementMetrics('error', category);
    
    this.winston.error(message, context);
    
    // Trigger alerta para errores críticos
    if (context.severity === 'CRITICAL' || context.requiresAttention) {
      this.triggerCriticalAlert(message, context);
    }
  }

  warn(message, data = {}, category = 'WARNING') {
    const context = this.createLogContext(category, data);
    this.incrementMetrics('warn', category);
    
    this.winston.warn(message, context);
  }

  info(message, data = {}, category = 'INFO') {
    const context = this.createLogContext(category, data);
    this.incrementMetrics('info', category);
    
    this.winston.info(message, context);
  }

  debug(message, data = {}, category = 'DEBUG') {
    const env = process.env.NODE_ENV || 'development';
    
    // En producción, solo mostrar debug si LOG_LEVEL está configurado explícitamente
    if (env === 'production' && process.env.LOG_LEVEL !== 'debug') {
      return;
    }
    
    const context = this.createLogContext(category, data);
    this.incrementMetrics('debug', category);
    
    this.winston.debug(message, context);
  }

  /**
   * 🏷️ MÉTODOS DE LOGGING POR CATEGORÍA
   */
  auth(action, data = {}) {
    this.info(`Auth: ${action}`, data, 'AUTH');
  }

  security(action, data = {}) {
    const level = data.severity === 'CRITICAL' ? 'error' : 
                  data.severity === 'HIGH' ? 'warn' : 'info';
    
    this[level](`Security: ${action}`, data, 'SECURITY');
  }

  database(action, data = {}) {
    this.info(`Database: ${action}`, data, 'DATABASE');
  }

  socket(action, data = {}) {
    this.info(`Socket: ${action}`, data, 'SOCKET');
  }

  webhook(action, data = {}) {
    this.info(`Webhook: ${action}`, data, 'WEBHOOK');
  }

  message(action, data = {}) {
    this.info(`Message: ${action}`, data, 'MESSAGE');
  }

  performance(action, data = {}) {
    this.info(`Performance: ${action}`, data, 'PERFORMANCE');
  }

  api(action, data = {}) {
    this.info(`API: ${action}`, data, 'API');
  }

  /**
   * ⏱️ TIMING LOGGER CON CONTEXTO MEJORADO
   */
  timing(operation, duration, data = {}) {
    const durationMs = typeof duration === 'number' ? duration : 
                      Date.now() - duration;
    
    const level = durationMs > 5000 ? 'warn' : 
                  durationMs > 1000 ? 'info' : 'debug';
    
    this[level](`Timing: ${operation}`, {
      duration: `${durationMs}ms`,
      performance: {
      operation,
        duration: durationMs,
        slow: durationMs > 1000
      },
      ...data
    }, 'TIMING');
  }

  /**
   * 🚨 TRIGGER ALERTA CRÍTICA
   */
  triggerCriticalAlert(message, context) {
    const env = process.env.NODE_ENV || 'development';
    
    // En un sistema real, aquí se enviarían notificaciones
    // a Slack, email, PagerDuty, etc.
    
    // Fallback seguro: solo en desarrollo o si está habilitado
    if (env === 'development' || process.env.ENABLE_CRITICAL_ALERTS === 'true') {
      console.error('🚨 ALERTA CRÍTICA:', {
        message,
        context,
        timestamp: new Date().toISOString()
      });
    }
    
    // Guardar alerta en archivo especial
    if (process.env.ENABLE_ALERT_FILE === 'true') {
      const alertData = {
        type: 'CRITICAL_ALERT',
        message,
        context,
        timestamp: new Date().toISOString()
      };
      
      // Escribir a archivo de alertas críticas
      // En producción esto debería ser un sistema más robusto
      require('fs').appendFileSync(
        './logs/critical-alerts.log',
        JSON.stringify(alertData) + '\n'
      );
    }
  }

  /**
   * 🔄 MIDDLEWARE PARA REQUEST TRACKING
   */
  createRequestTrackingMiddleware() {
    return (req, res, next) => {
      const requestId = req.headers['x-request-id'] || 
                       `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      req.requestId = requestId;
      
      // Establecer contexto para async local storage
      this.asyncLocalStorage.run({ requestId }, () => {
        const startTime = Date.now();
        
        // Log de inicio de request
        this.api('request_start', {
          method: req.method,
          url: req.originalUrl,
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          requestId
        });
        
        // Hook para cuando la respuesta termine
        const originalEnd = res.end;
        res.end = function(...args) {
          const duration = Date.now() - startTime;
          const contentLength = res.get('content-length') || 0;
          
          // Log de fin de request
          const logLevel = res.statusCode >= 500 ? 'error' :
                          res.statusCode >= 400 ? 'warn' : 'info';
          
          this[logLevel]('request_completed', {
      method: req.method,
            url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
            contentLength,
            successful: res.statusCode < 400,
            requestId
          }, 'API');
          
          originalEnd.apply(this, args);
        }.bind(this);
        
        next();
      });
    };
  }

  /**
   * 📊 OBTENER ESTADÍSTICAS DE LOGGING
   */
  getStats() {
    return {
      metrics: {
        total: this.logMetrics.total,
        errors: this.logMetrics.errors,
        warnings: this.logMetrics.warnings,
        byLevel: Object.fromEntries(this.logMetrics.byLevel),
        byCategory: Object.fromEntries(this.logMetrics.byCategory)
      },
      period: {
        start: this.logMetrics.lastReset,
        duration: Date.now() - this.logMetrics.lastReset
      },
      config: {
        level: this.winston.level,
        transports: this.winston.transports.length,
        environment: process.env.NODE_ENV
      }
    };
  }

  /**
   * 🔧 CONFIGURAR NIVEL DE LOG DINÁMICAMENTE
   */
  setLevel(level) {
    this.winston.level = level;
    this.winston.transports.forEach(transport => {
      transport.level = level;
    });
    
    this.info('Nivel de log cambiado', { 
      newLevel: level,
      changedAt: new Date().toISOString()
    }, 'CONFIG');
  }

  /**
   * 🧪 MODO DEBUG TEMPORAL
   */
  enableDebugMode(durationMs = 300000) { // 5 minutos por defecto
    const originalLevel = this.winston.level;
    
    this.setLevel('debug');
    this.info('Modo debug activado temporalmente', {
      duration: `${durationMs}ms`,
      originalLevel
    }, 'DEBUG');
    
    setTimeout(() => {
      this.setLevel(originalLevel);
      this.info('Modo debug desactivado', { 
        restoredLevel: originalLevel 
      }, 'DEBUG');
    }, durationMs);
  }
}

// Singleton instance
const logger = new AdvancedLogger();

module.exports = logger;
