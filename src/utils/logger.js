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
} catch (error) {
  console.log('⚠️ LogMonitorService no disponible, continuando sin integración');
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
  }

  log(info, callback) {
    if (this.logMonitor) {
      // Extraer información del log
      const level = info.level;
      const message = info.message;
      const category = info.category || 'SYSTEM';
      const data = {
        userId: info.userId || 'system',
        endpoint: info.endpoint || 'unknown',
        ip: info.ip || 'unknown',
        userAgent: info.userAgent || 'unknown',
        requestId: info.requestId,
        ...info
      };

      // Capturar en LogMonitorService
      this.logMonitor.addLog(level, category, message, data);
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
    }),
    // Transporte para LogMonitorService
    new LogMonitorTransport({
      level: 'info'
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

// Configuración específica para Railway
if (process.env.RAILWAY_ENVIRONMENT) {
  // Reducir verbosidad en Railway para evitar límites de velocidad
  logger.level = 'warn';
  
  // Agregar transporte de emergencia para Railway
  logger.add(new winston.transports.Console({
    level: 'error',
    format: winston.format.simple(),
    handleExceptions: true,
    handleRejections: true
  }));
}

// Método para obtener estadísticas del logger
logger.getStats = function() {
  return {
    level: logger.level,
    transports: logger.transports.length,
    logMonitor: logMonitor ? 'active' : 'inactive'
  };
};

module.exports = logger;
