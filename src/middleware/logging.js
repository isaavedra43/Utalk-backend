/**
 * 📝 MIDDLEWARE DE LOGGING CENTRALIZADO
 * 
 * Centraliza toda la lógica de logging y tracking de requests
 * para evitar duplicación en controladores y servicios.
 * 
 * @version 2.0.0
 * @author Backend Team
 */

const logger = require('../utils/logger');

/**
 * Middleware de logging de requests HTTP
 */
function requestLoggingMiddleware(req, res, next) {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Agregar requestId al request para tracking
  req.requestId = requestId;
  
  // Log del request entrante
  logger.info('📥 Request entrante', {
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    requestId,
    timestamp: new Date().toISOString()
  });

  // Interceptar el final de la respuesta
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Log del response saliente
    logger.info('📤 Response enviado', {
      method: req.method,
      url: req.originalUrl,
      statusCode,
      duration: `${duration}ms`,
      requestId,
      timestamp: new Date().toISOString()
    });

    // Log de errores si el status code indica error
    if (statusCode >= 400) {
      logger.warn('⚠️ Request con error', {
        method: req.method,
        url: req.originalUrl,
        statusCode,
        duration: `${duration}ms`,
        requestId,
        timestamp: new Date().toISOString()
      });
    }
  });

  next();
}

/**
 * Middleware de logging de errores
 */
function errorLoggingMiddleware(error, req, res, next) {
  logger.error('💥 Error en request', {
    method: req.method,
    url: req.originalUrl,
    error: error.message,
    stack: error.stack,
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });

  next(error);
}

/**
 * Middleware de logging de seguridad
 */
function securityLoggingMiddleware(req, res, next) {
  // Log de intentos de acceso sospechosos
  const suspiciousPatterns = [
    /\.\.\//, // Path traversal
    /<script/i, // XSS attempts
    /union\s+select/i, // SQL injection
    /eval\s*\(/i, // Code injection
  ];

  const userInput = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
    headers: req.headers
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(userInput)) {
      logger.warn('🚨 Patrón sospechoso detectado', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        pattern: pattern.toString(),
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
      break;
    }
  }

  next();
}

/**
 * Middleware de logging de performance
 */
function performanceLoggingMiddleware(req, res, next) {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convertir a milisegundos
    
    // Log de requests lentos (> 1 segundo)
    if (duration > 1000) {
      logger.warn('🐌 Request lento detectado', {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration.toFixed(2)}ms`,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    }
  });

  next();
}

/**
 * Middleware de logging de autenticación
 */
function authLoggingMiddleware(req, res, next) {
  // Log de intentos de login
  if (req.path.includes('/auth/login') && req.method === 'POST') {
    logger.info('🔐 Intento de login', {
      email: req.body.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  }

  // Log de logout
  if (req.path.includes('/auth/logout') && req.method === 'POST') {
    logger.info('🚪 Logout de usuario', {
      userId: req.user?.email,
      ip: req.ip,
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  }

  next();
}

/**
 * Middleware de logging de operaciones críticas
 */
function criticalOperationsLoggingMiddleware(req, res, next) {
  const criticalPaths = [
    '/api/messages/send',
    '/api/conversations/create',
    '/api/contacts/create',
    '/api/files/upload',
    '/api/twilio/webhook'
  ];

  const isCriticalPath = criticalPaths.some(path => req.path.includes(path));
  
  if (isCriticalPath) {
    logger.info('🎯 Operación crítica iniciada', {
      method: req.method,
      url: req.originalUrl,
      userId: req.user?.email,
      ip: req.ip,
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  }

  next();
}

/**
 * Middleware de logging de base de datos
 */
function databaseLoggingMiddleware(req, res, next) {
  // Interceptar operaciones de base de datos
  const originalQuery = req.query;
  
  const base = req.logger || logger;
  if (typeof base.database !== 'function') {
    base.database = (operation, data) => {
      base.info('🗄️ Operación de base de datos', {
        operation,
        data,
        method: req.method,
        url: req.originalUrl,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    };
  }
  if (typeof base.auth !== 'function') {
    base.auth = (operation, data) => {
      base.info('🔐 Operación de autenticación', {
        operation,
        data,
        method: req.method,
        url: req.originalUrl,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    };
  }
  if (typeof base.message !== 'function') {
    base.message = (operation, data) => {
      base.info('💬 Operación de mensajes', {
        operation,
        data,
        method: req.method,
        url: req.originalUrl,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    };
  }
  if (typeof base.media !== 'function') {
    base.media = (operation, data) => {
      base.info('📁 Operación de media', {
        operation,
        data,
        method: req.method,
        url: req.originalUrl,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    };
  }
  if (typeof base.twilio !== 'function') {
    base.twilio = (operation, data) => {
      base.info('📞 Operación de Twilio', {
        operation,
        data,
        method: req.method,
        url: req.originalUrl,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    };
  }
  if (typeof base.socket !== 'function') {
    base.socket = (operation, data) => {
      base.info('🔌 Operación de Socket.IO', {
        operation,
        data,
        method: req.method,
        url: req.originalUrl,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    };
  }
  if (typeof base.security !== 'function') {
    base.security = (operation, data) => {
      base.warn('🛡️ Operación de seguridad', {
        operation,
        data,
        method: req.method,
        url: req.originalUrl,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    };
  }
  if (typeof base.error !== 'function') {
    base.error = (message, data) => {
      base.info('❌ Error en operación', {
        message,
        data,
        method: req.method,
        url: req.originalUrl,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    };
  }
  if (typeof base.success !== 'function') {
    base.success = (operation, data) => {
      base.info('✅ Operación exitosa', {
        operation,
        data,
        method: req.method,
        url: req.originalUrl,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    };
  }
  if (typeof base.debug !== 'function') {
    base.debug = (operation, data) => {
      // opcional
    };
  }
  req.logger = base;

  next();
}

module.exports = {
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  securityLoggingMiddleware,
  performanceLoggingMiddleware,
  authLoggingMiddleware,
  criticalOperationsLoggingMiddleware,
  databaseLoggingMiddleware
}; 