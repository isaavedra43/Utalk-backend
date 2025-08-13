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
    const statusCode = res.statusCode;
    const statusMessage = res.statusMessage;
    
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