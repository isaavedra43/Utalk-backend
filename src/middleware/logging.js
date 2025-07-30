/**
 * 📊 MIDDLEWARE DE LOGGING AVANZADO
 * 
 * Integra el sistema de logs con Express y proporciona
 * funcionalidades adicionales de monitoreo
 */

const logger = require('../utils/logger');

/**
 * Middleware principal de logging para requests HTTP
 */
function loggingMiddleware(req, res, next) {
  // Crear contexto de request
  const context = logger.createRequestContext(req);
  req.logContext = context;
  
  // Hacer logger disponible en el request con contexto
  req.logger = {
    auth: (action, data = {}) => logger.auth(action, data, context),
    socket: (action, data = {}) => logger.socket(action, data, context),
    message: (action, data = {}) => logger.message(action, data, context),
    webhook: (action, data = {}) => logger.webhook(action, data, context),
    database: (action, data = {}) => logger.database(action, data, context),
    media: (action, data = {}) => logger.media(action, data, context),
    twilio: (action, data = {}) => logger.twilio(action, data, context),
    firebase: (action, data = {}) => logger.firebase(action, data, context),
    security: (action, data = {}) => logger.security(action, data, context),
    performance: (action, data = {}) => logger.performance(action, data, context),
    info: (message, data = {}) => logger.info(message, data, context),
    warn: (message, data = {}) => logger.warn(message, data, context),
    error: (message, data = {}) => logger.error(message, data, context),
    debug: (message, data = {}) => logger.debug(message, data, context),
    success: (message, data = {}) => logger.success(message, data, context)
  };

  // Llamar al método de request del logger
  logger.request(req, res);
  
  next();
}

/**
 * Middleware para capturar errores no manejados
 */
function errorLoggingMiddleware(error, req, res, next) {
  const context = req.logContext || {};
  
  logger.error('Error no manejado en request', {
    error: error.message,
    stack: error.stack?.split('\n').slice(0, 5),
    statusCode: error.statusCode || 500,
    url: req.url,
    method: req.method
  }, context);

  next(error);
}

/**
 * Middleware para logs de seguridad
 */
function securityLoggingMiddleware(req, res, next) {
  const suspicious = [];
  
  // Detectar actividad sospechosa
  if (req.headers['user-agent'] && req.headers['user-agent'].includes('bot')) {
    suspicious.push('bot_detected');
  }
  
  if (req.query && Object.keys(req.query).length > 20) {
    suspicious.push('excessive_query_params');
  }
  
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 10 * 1024 * 1024) {
    suspicious.push('large_payload');
  }
  
  if (suspicious.length > 0) {
    logger.security('suspicious_activity', {
      indicators: suspicious,
      ip: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 100)
    }, req.logContext);
  }
  
  next();
}

/**
 * Middleware para monitorear performance
 */
function performanceLoggingMiddleware(req, res, next) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    if (duration > 5000) { // Más de 5 segundos
      logger.performance('request_slow', {
        duration: `${duration}ms`,
        path: req.path,
        method: req.method,
        statusCode: res.statusCode
      }, req.logContext);
    }
    
    if (duration > 1000) { // Más de 1 segundo
      logger.performance('request_slow', {
        duration: `${duration}ms`,
        path: req.path,
        method: req.method,
        level: 'moderate'
      }, req.logContext);
    }
  });
  
  next();
}

/**
 * Función para logging manual en cualquier parte del código
 */
function createLogger(module = 'GENERAL') {
  return {
    auth: (action, data = {}) => logger.auth(action, { module, ...data }),
    socket: (action, data = {}) => logger.socket(action, { module, ...data }),
    message: (action, data = {}) => logger.message(action, { module, ...data }),
    webhook: (action, data = {}) => logger.webhook(action, { module, ...data }),
    database: (action, data = {}) => logger.database(action, { module, ...data }),
    media: (action, data = {}) => logger.media(action, { module, ...data }),
    twilio: (action, data = {}) => logger.twilio(action, { module, ...data }),
    firebase: (action, data = {}) => logger.firebase(action, { module, ...data }),
    security: (action, data = {}) => logger.security(action, { module, ...data }),
    performance: (action, data = {}) => logger.performance(action, { module, ...data }),
    info: (message, data = {}) => logger.info(message, { module, ...data }),
    warn: (message, data = {}) => logger.warn(message, { module, ...data }),
    error: (message, data = {}) => logger.error(message, { module, ...data }),
    debug: (message, data = {}) => logger.debug(message, { module, ...data }),
    success: (message, data = {}) => logger.success(message, { module, ...data }),
    timing: (label, startTime, data = {}) => logger.timing(label, startTime, { module, ...data })
  };
}

module.exports = {
  loggingMiddleware,
  errorLoggingMiddleware,
  securityLoggingMiddleware,
  performanceLoggingMiddleware,
  createLogger
}; 