/**
 * 🛡️ MANEJO MEJORADO DE ERRORES PARA EVITAR CASCADAS
 * 
 * Middleware que mejora el manejo de errores para:
 * - Evitar cascadas de errores
 * - Proporcionar respuestas más informativas
 * - Logging estructurado de errores
 * - Manejo específico de errores de rate limiting
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const logger = require('../utils/logger');

/**
 * Middleware para manejo mejorado de errores
 */
function enhancedErrorHandler(err, req, res, next) {
  // ✅ CRÍTICO: Verificar que next sea una función válida
  if (typeof next !== 'function') {
    console.error('❌ ERROR: next no es función en enhancedErrorHandler');
    return;
  }

  // Si ya se envió una respuesta, no hacer nada
  if (res.headersSent) {
    return next(err);
  }

  const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = new Date().toISOString();

  // Log del error con contexto
  logger.error('Error en aplicación', {
    errorId,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 5), // Solo las primeras 5 líneas
      code: err.code,
      statusCode: err.statusCode
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 100),
      userEmail: req.user?.email?.substring(0, 20) + '...',
      userRole: req.user?.role
    },
    timestamp
  });

  // Manejo específico de errores de rate limiting
  if (err.statusCode === 429 || err.code === 'RATE_LIMIT_EXCEEDED') {
    return res.status(429).json({
      success: false,
      error: {
        type: 'RATE_LIMIT_ERROR',
        code: 'RATE_LIMIT_EXCEEDED',
        message: err.message || 'Demasiadas solicitudes. Por favor, espera un momento.',
        retryAfter: err.retryAfter || 60,
        eventName: err.eventName,
        timestamp
      }
    });
  }

  // Manejo específico de errores de validación
  if (err.name === 'ValidationError' || err.statusCode === 400) {
    return res.status(400).json({
      success: false,
      error: {
        type: 'VALIDATION_ERROR',
        code: 'INVALID_REQUEST',
        message: 'Los datos proporcionados no son válidos.',
        details: err.details || err.message,
        timestamp
      }
    });
  }

  // Manejo específico de errores de autenticación
  if (err.statusCode === 401 || err.code === 'UNAUTHORIZED') {
    return res.status(401).json({
      success: false,
      error: {
        type: 'AUTHENTICATION_ERROR',
        code: 'UNAUTHORIZED',
        message: 'No tienes permisos para realizar esta acción.',
        timestamp
      }
    });
  }

  // Manejo específico de errores de base de datos
  if (err.code === 'DATABASE_ERROR' || err.name === 'FirebaseError') {
    return res.status(503).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'SERVICE_UNAVAILABLE',
        message: 'Error de conexión con la base de datos. Intenta de nuevo en unos momentos.',
        timestamp
      }
    });
  }

  // Manejo específico de errores de WebSocket
  if (err.code === 'SOCKET_ERROR' || err.name === 'SocketError') {
    return res.status(503).json({
      success: false,
      error: {
        type: 'SOCKET_ERROR',
        code: 'SERVICE_UNAVAILABLE',
        message: 'Error de conexión en tiempo real. Intenta de nuevo en unos momentos.',
        timestamp
      }
    });
  }

  // Error interno del servidor (500)
  const statusCode = err.statusCode || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';

  return res.status(statusCode).json({
    success: false,
    error: {
      type: 'INTERNAL_SERVER_ERROR',
      code: 'SERVER_ERROR',
      message: isDevelopment ? err.message : 'Error interno del servidor.',
      ...(isDevelopment && { 
        stack: err.stack?.split('\n').slice(0, 3),
        originalError: err.message 
      }),
      timestamp
    }
  });
}

/**
 * Middleware para capturar errores no manejados
 */
function unhandledErrorHandler(err, req, res, next) {
  // ✅ CRÍTICO: Verificar que next sea una función válida
  if (typeof next !== 'function') {
    console.error('❌ ERROR: next no es función en unhandledErrorHandler');
    return;
  }

  // Log del error no manejado
  logger.error('Error no manejado detectado', {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip
    },
    timestamp: new Date().toISOString()
  });

  // Si ya se envió una respuesta, no hacer nada
  if (res.headersSent) {
    return next(err);
  }

  // Enviar respuesta de error genérica
  return res.status(500).json({
    success: false,
    error: {
      type: 'UNHANDLED_ERROR',
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor.',
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Middleware para manejo de promesas rechazadas
 */
function promiseRejectionHandler(reason, promise) {
  logger.error('Promesa rechazada no manejada', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  enhancedErrorHandler,
  unhandledErrorHandler,
  promiseRejectionHandler
}; 