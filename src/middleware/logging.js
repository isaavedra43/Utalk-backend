/**
 * 📊 MIDDLEWARE DE LOGGING ESTRUCTURADO - SUPER ROBUSTO
 * 
 * Middleware para logging estructurado de todas las peticiones HTTP
 * con información detallada para debugging y monitoreo.
 * 
 * @version 2.0.0 - Super robusto con métricas avanzadas
 * @author Backend Team
 */

const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Middleware de logging estructurado - SUPER ROBUSTO
 */
function loggingMiddleware(req, res, next) {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || uuidv4();
  
  // ✅ SUPER ROBUSTO: Asignar requestId a la petición
  req.requestId = requestId;
  
  // ✅ SUPER ROBUSTO: Configurar req.logger con métodos específicos
  req.logger = {
    // Métodos básicos de logging
    info: (message, data) => logger.info(message, { ...data, requestId }),
    warn: (message, data) => logger.warn(message, { ...data, requestId }),
    error: (message, data) => logger.error(message, { ...data, requestId }),
    debug: (message, data) => logger.debug(message, { ...data, requestId }),
    
    // Métodos específicos por dominio
    auth: (operation, data) => logger.info(`[AUTH] ${operation}`, { 
      category: 'AUTH_OPERATION',
      operation,
      ...data,
      requestId,
      timestamp: new Date().toISOString()
    }),
    
    database: (operation, data) => logger.info(`[DATABASE] ${operation}`, {
      category: 'DATABASE_OPERATION', 
      operation,
      ...data,
      requestId,
      timestamp: new Date().toISOString()
    }),
    
    message: (operation, data) => logger.info(`[MESSAGE] ${operation}`, {
      category: 'MESSAGE_OPERATION',
      operation,
      ...data,
      requestId,
      timestamp: new Date().toISOString()
    }),
    
    media: (operation, data) => logger.info(`[MEDIA] ${operation}`, {
      category: 'MEDIA_OPERATION',
      operation,
      ...data,
      requestId,
      timestamp: new Date().toISOString()
    }),
    
    twilio: (operation, data) => logger.info(`[TWILIO] ${operation}`, {
      category: 'TWILIO_OPERATION',
      operation,
      ...data,
      requestId,
      timestamp: new Date().toISOString()
    }),
    
    socket: (operation, data) => logger.info(`[SOCKET] ${operation}`, {
      category: 'SOCKET_OPERATION',
      operation,
      ...data,
      requestId,
      timestamp: new Date().toISOString()
    }),
    
    security: (operation, data) => logger.info(`[SECURITY] ${operation}`, {
      category: 'SECURITY_OPERATION',
      operation,
      ...data,
      requestId,
      timestamp: new Date().toISOString()
    }),
    
    success: (operation, data) => logger.info(`[SUCCESS] ${operation}`, {
      category: 'SUCCESS_OPERATION',
      operation,
      ...data,
      requestId,
      timestamp: new Date().toISOString()
    })
  };
  
  // ✅ SUPER ROBUSTO: Logging de inicio de petición
  logger.info('📥 Petición HTTP iniciada', {
    category: 'HTTP_REQUEST_START',
    requestId,
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent']?.substring(0, 100),
    origin: req.headers.origin,
    referer: req.headers.referer,
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
    authorization: req.headers.authorization ? 'Bearer ***' : 'none',
    timestamp: new Date().toISOString()
  });

  // ✅ SUPER ROBUSTO: Interceptar respuesta para logging
  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;

  // ✅ SUPER ROBUSTO: Métricas de respuesta
  let responseBody = null;
  let responseSize = 0;

  res.send = function(data) {
    responseBody = data;
    responseSize = Buffer.byteLength(data, 'utf8');
    return originalSend.call(this, data);
  };

  res.json = function(data) {
    responseBody = JSON.stringify(data);
    responseSize = Buffer.byteLength(responseBody, 'utf8');
    return originalJson.call(this, data);
  };

  res.end = function(data) {
    if (data) {
      responseSize = Buffer.byteLength(data, 'utf8');
    }
    return originalEnd.call(this, data);
  };

  // ✅ SUPER ROBUSTO: Logging de fin de petición
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res?.statusCode || 0;
    const statusMessage = res?.statusMessage || 'Unknown';
    
    // ✅ SUPER ROBUSTO: Categorizar petición por tipo
    let category = 'HTTP_REQUEST_COMPLETE';
    let level = 'info';
    
    if (statusCode >= 500) {
      category = 'HTTP_SERVER_ERROR';
      level = 'error';
    } else if (statusCode >= 400) {
      category = 'HTTP_CLIENT_ERROR';
      level = 'warn';
    } else if (statusCode >= 300) {
      category = 'HTTP_REDIRECT';
      level = 'info';
    } else if (statusCode >= 200) {
      category = 'HTTP_SUCCESS';
      level = 'info';
    }

    // ✅ SUPER ROBUSTO: Logging estructurado con métricas
    const logData = {
      category,
      requestId,
      method: req.method,
      url: req.originalUrl,
      path: req.path,
      statusCode,
      statusMessage,
      duration: `${duration}ms`,
      responseSize: `${responseSize} bytes`,
      ip: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 100),
      origin: req.headers.origin,
      userEmail: req.user?.email?.substring(0, 20) + '...',
      userRole: req.user?.role,
      headers: {
        'content-type': res.getHeader('content-type'),
        'content-length': res.getHeader('content-length'),
        'x-request-id': requestId
      },
      timestamp: new Date().toISOString(),
      performance: {
        duration,
        responseSize,
        isSlow: duration > 1000, // Lento si > 1 segundo
        isLarge: responseSize > 1000000 // Grande si > 1MB
      }
    };

    // ✅ SUPER ROBUSTO: Logging condicional por nivel
    if (level === 'error') {
      logger.error('❌ Petición HTTP con error', logData);
    } else if (level === 'warn') {
      logger.warn('⚠️ Petición HTTP con advertencia', logData);
    } else {
      logger.info('✅ Petición HTTP completada', logData);
    }

    // ✅ SUPER ROBUSTO: Logging de peticiones lentas
    if (duration > 5000) { // Muy lento si > 5 segundos
      logger.warn('🐌 Petición HTTP muy lenta detectada', {
        ...logData,
        category: 'HTTP_SLOW_REQUEST',
        duration: `${duration}ms`,
        threshold: '5000ms'
      });
    }

    // ✅ SUPER ROBUSTO: Logging de respuestas grandes
    if (responseSize > 5000000) { // Muy grande si > 5MB
      logger.warn('📦 Respuesta HTTP muy grande detectada', {
        ...logData,
        category: 'HTTP_LARGE_RESPONSE',
        responseSize: `${responseSize} bytes`,
        threshold: '5MB'
      });
    }
  });

  // ✅ SUPER ROBUSTO: Manejo de errores en el middleware
  res.on('error', (error) => {
    const duration = Date.now() - startTime;
    logger.error('💥 Error en petición HTTP', {
      category: 'HTTP_REQUEST_ERROR',
      requestId,
      method: req.method,
      url: req.originalUrl,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3),
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  });

  next();
}

module.exports = loggingMiddleware; 