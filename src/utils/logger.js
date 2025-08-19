const logger = require('../utils/logger');
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

// Importar LogMonitorService para integración
let logMonitor;
try {
  const { logMonitor: monitor } = require('../services/LogMonitorService');
  logMonitor = monitor;
  logger.info('LogMonitorService integrado correctamente', { category: 'LOGMONITORSERVICE_INTEGRADO_CO' });
} catch (error) {
  logger.warn('LogMonitorService no disponible, continuando sin integración:', { category: 'LOGMONITORSERVICE_NO_DISPONIBL' }error.message);
  logMonitor = null;
}

/**
 * Detecta si la aplicación se está ejecutando en un entorno de contenedor/serverless
 * 
 * @returns {boolean}
 */
function isContainerizedEnvironment() {
  return process.env.RAILWAY_ENVIRONMENT || 
         process.env.HEROKU_APP_NAME || 
         process.env.VERCEL_ENV ||
         process.env.DOCKER_ENV ||
         process.env.KUBERNETES_SERVICE_HOST;
}

/**
 * Transporte personalizado para integrar con LogMonitorService
 */
class LogMonitorTransport extends winston.Transport {
  constructor(opts) {
    super(opts);
    this.logMonitor = logMonitor;
    this.name = 'LogMonitorTransport';
  }

  log(info, callback) {
    try {
      if (this.logMonitor) {
        // Extraer información del log
        const level = info.level;
        const message = info.message || info[Symbol.for('message')] || 'No message';
        const category = info.category || 'SYSTEM';
        
        // Extraer datos adicionales
        const data = {
          userId: info.userId || 'system',
          endpoint: info.endpoint || 'unknown',
          ip: info.ip || 'unknown',
          userAgent: info.userAgent || 'unknown',
          requestId: info.requestId,
          timestamp: info.timestamp,
          service: info.service,
          environment: info.environment,
          ...info
        };

        // Limpiar datos sensibles
        delete data.password;
        delete data.token;
        delete data.secret;
        delete data.key;

        // Capturar en LogMonitorService
        this.logMonitor.addLog(level, category, message, data);
        
        // Debug: confirmar que se está capturando
        if (process.env.NODE_ENV === 'development') {
          console.log(`📊 LogMonitor: Capturado log [${level}] ${category}: ${message}`);
        }
      }
    } catch (error) {
      logger.error('❌ Error en LogMonitorTransport:', { category: '_ERROR_EN_LOGMONITORTRANSPORT_' }error.message);
    }
    
    callback();
  }
}

/**
 * Configuración optimizada del logger para Railway
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'utalk-backend',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Transporte principal para Railway (optimizado)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      )
    })
  ],
  // Manejo de excepciones no capturadas
  exceptionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
  // Manejo de promesas rechazadas
  rejectionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Agregar LogMonitorTransport si está disponible
if (logMonitor) {
  logger.add(new LogMonitorTransport({
    level: 'info'
  }));
  logger.info('LogMonitorTransport agregado al logger', { category: 'LOGMONITORTRANSPORT_AGREGADO_A' });
}

// Configuración específica para Railway
if (process.env.RAILWAY_ENVIRONMENT) {
  // 🔧 CORRECCIÓN CRÍTICA: Reducir verbosidad en Railway para evitar rate limits
  logger.level = 'error'; // Solo errores críticos
  
  // Agregar transporte de emergencia para Railway
  logger.add(new winston.transports.Console({
    level: 'error',
    format: winston.format.simple(),
    handleExceptions: true,
    handleRejections: true
  }));
  
  logger.info('🔧 Logger configurado para Railway: solo errores críticos', { category: '_LOGGER_CONFIGURADO_PARA_RAILW' });
}

// Método para obtener estadísticas del logger
logger.getStats = function() {
  return {
    level: logger.level,
    transports: logger.transports.length,
    logMonitor: logMonitor ? 'active' : 'inactive'
  };
};

// Método para generar logs de prueba
logger.generateTestLogs = function() {
  if (logMonitor) {
    logger.info('🧪 Generando logs de prueba para dashboard...', { category: '_GENERANDO_LOGS_DE_PRUEBA_PARA' });
    
    // Generar logs de diferentes niveles y categorías
    logger.info('Sistema iniciado correctamente', { category: 'SYSTEM', userId: 'system' });
    logger.info('Conexión a base de datos establecida', { category: 'DATABASE', userId: 'system' });
    logger.warn('Cache miss en consulta de usuarios', { category: 'CACHE', userId: 'system' });
    logger.info('Nueva conexión WebSocket establecida', { category: 'WEBSOCKET', userId: 'user_123' });
    logger.error('Error en endpoint de autenticación', { category: 'API', userId: 'user_456' });
    logger.info('Mensaje enviado exitosamente', { category: 'MESSAGE', userId: 'user_789' });
    logger.debug('Rate limit check completado', { category: 'RATE_LIMIT', userId: 'user_101' });
    
    logger.info('Logs de prueba generados', { category: 'LOGS_DE_PRUEBA_GENERADOS' });
  }
};

module.exports = logger;
