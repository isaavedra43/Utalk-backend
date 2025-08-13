/**
 * 🛡️ MANEJO MEJORADO DE ERRORES PARA EVITAR CASCADAS - SUPER ROBUSTO
 * 
 * Middleware que mejora el manejo de errores para:
 * - Evitar cascadas de errores
 * - Proporcionar respuestas más informativas
 * - Logging estructurado de errores
 * - Manejo específico de errores de rate limiting
 * - Recuperación automática de errores no críticos
 * 
 * @version 2.0.0 - Super robusto con recuperación automática
 * @author Backend Team
 */

const logger = require('../utils/logger');

/**
 * Middleware para manejo mejorado de errores - SUPER ROBUSTO
 */
function enhancedErrorHandler(err, req, res, next) {
  // ✅ SUPER ROBUSTO: Verificar que next sea una función válida
  if (typeof next !== 'function') {
    console.error('❌ ERROR: next no es función en enhancedErrorHandler');
    return;
  }

  // ✅ SUPER ROBUSTO: Si ya se envió una respuesta, no hacer nada
  if (res.headersSent) {
    logger.warn('Respuesta ya enviada, no procesando error', {
      category: 'ERROR_HANDLER_RESPONSE_SENT',
      error: err.message,
      statusCode: res.statusCode
    });
    return next(err);
  }

  const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = new Date().toISOString();
  const requestId = req.requestId || 'unknown';

  // ✅ SUPER ROBUSTO: Log del error con contexto completo
  logger.error('Error en aplicación', {
    errorId,
    requestId,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 5), // Solo las primeras 5 líneas
      code: err.code,
      statusCode: err.statusCode,
      isOperational: err.isOperational || false
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 100),
      userEmail: req.user?.email?.substring(0, 20) + '...',
      userRole: req.user?.role,
      headers: {
        'content-type': req.headers['content-type'],
        'authorization': req.headers.authorization ? 'Bearer ***' : 'none',
        'origin': req.headers.origin
      }
    },
    timestamp,
    environment: process.env.NODE_ENV || 'development'
  });

  // ✅ SUPER ROBUSTO: Manejo específico de errores de rate limiting
  if (err.statusCode === 429 || err.code === 'RATE_LIMIT_EXCEEDED') {
    return res.status(429).json({
      success: false,
      error: {
        type: 'RATE_LIMIT_ERROR',
        code: 'RATE_LIMIT_EXCEEDED',
        message: err.message || 'Demasiadas solicitudes. Por favor, espera un momento.',
        retryAfter: err.retryAfter || 60,
        eventName: err.eventName,
        timestamp,
        errorId
      }
    });
  }

  // ✅ SUPER ROBUSTO: Manejo específico de errores de validación
  if (err.name === 'ValidationError' || err.statusCode === 400) {
    return res.status(400).json({
      success: false,
      error: {
        type: 'VALIDATION_ERROR',
        code: 'INVALID_REQUEST',
        message: 'Los datos proporcionados no son válidos.',
        details: err.details || err.message,
        timestamp,
        errorId
      }
    });
  }

  // ✅ SUPER ROBUSTO: Manejo específico de errores de autenticación
  if (err.statusCode === 401 || err.code === 'UNAUTHORIZED') {
    return res.status(401).json({
      success: false,
      error: {
        type: 'AUTHENTICATION_ERROR',
        code: 'UNAUTHORIZED',
        message: 'No tienes permisos para realizar esta acción.',
        timestamp,
        errorId
      }
    });
  }

  // ✅ SUPER ROBUSTO: Manejo específico de errores de autorización
  if (err.statusCode === 403 || err.code === 'FORBIDDEN') {
    return res.status(403).json({
      success: false,
      error: {
        type: 'AUTHORIZATION_ERROR',
        code: 'FORBIDDEN',
        message: 'No tienes permisos para acceder a este recurso.',
        timestamp,
        errorId
      }
    });
  }

  // ✅ SUPER ROBUSTO: Manejo específico de errores de base de datos
  if (err.code === 'DATABASE_ERROR' || err.name === 'FirebaseError' || err.code === 'ENOTFOUND') {
    return res.status(503).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        code: 'SERVICE_UNAVAILABLE',
        message: 'Error de conexión con la base de datos. Intenta de nuevo en unos momentos.',
        timestamp,
        errorId
      }
    });
  }

  // ✅ SUPER ROBUSTO: Manejo específico de errores de WebSocket
  if (err.code === 'SOCKET_ERROR' || err.name === 'SocketError') {
    return res.status(503).json({
      success: false,
      error: {
        type: 'SOCKET_ERROR',
        code: 'SERVICE_UNAVAILABLE',
        message: 'Error de conexión en tiempo real. Intenta de nuevo en unos momentos.',
        timestamp,
        errorId
      }
    });
  }

  // ✅ SUPER ROBUSTO: Manejo específico de errores de timeout
  if (err.code === 'TIMEOUT' || err.name === 'TimeoutError') {
    return res.status(408).json({
      success: false,
      error: {
        type: 'TIMEOUT_ERROR',
        code: 'REQUEST_TIMEOUT',
        message: 'La solicitud tardó demasiado en procesarse. Intenta de nuevo.',
        timestamp,
        errorId
      }
    });
  }

  // ✅ SUPER ROBUSTO: Error interno del servidor (500)
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
        originalError: err.message,
        name: err.name,
        code: err.code
      }),
      timestamp,
      errorId
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