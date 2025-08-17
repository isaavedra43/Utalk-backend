/**
 * 🛡️ MIDDLEWARE MEJORADO DE MANEJO DE ERRORES
 * 
 * Proporciona manejo robusto de errores con respuestas estructuradas
 * y logging detallado para debugging.
 * 
 * @version 2.0.0
 * @author Backend Team
 */

const logger = require('../utils/logger');

class EnhancedErrorHandler {
  /**
   * 🎯 MANEJAR ERRORES DE VALIDACIÓN
   */
  static handleValidationError(error, req, res, next) {
    const errorDetails = {
      type: 'VALIDATION_ERROR',
      message: 'Error de validación en los datos de entrada',
      details: error.details || error.message,
      field: error.field || 'unknown',
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent']?.substring(0, 100),
      ip: req.ip
    };

    logger.warn('⚠️ Error de validación detectado', {
      category: 'VALIDATION_ERROR',
      ...errorDetails,
      userEmail: req.user?.email
    });

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: errorDetails.message,
        details: errorDetails.details,
        field: errorDetails.field
      },
      timestamp: errorDetails.timestamp,
      requestId: req.requestId || 'unknown'
    });
  }

  /**
   * 🔐 MANEJAR ERRORES DE AUTENTICACIÓN
   */
  static handleAuthError(error, req, res, next) {
    const errorDetails = {
      type: 'AUTHENTICATION_ERROR',
      message: 'Error de autenticación',
      details: error.message || 'Token inválido o expirado',
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      ip: req.ip
    };

    logger.warn('🔐 Error de autenticación detectado', {
      category: 'AUTH_ERROR',
      ...errorDetails
    });

    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: errorDetails.message,
        details: errorDetails.details
      },
      timestamp: errorDetails.timestamp,
      requestId: req.requestId || 'unknown'
    });
  }

  /**
   * 🚫 MANEJAR ERRORES DE AUTORIZACIÓN
   */
  static handleAuthorizationError(error, req, res, next) {
    const errorDetails = {
      type: 'AUTHORIZATION_ERROR',
      message: 'Error de autorización',
      details: error.message || 'No tienes permisos para realizar esta acción',
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      userEmail: req.user?.email,
      ip: req.ip
    };

    logger.warn('🚫 Error de autorización detectado', {
      category: 'AUTHORIZATION_ERROR',
      ...errorDetails
    });

    return res.status(403).json({
      success: false,
      error: {
        code: 'AUTHORIZATION_ERROR',
        message: errorDetails.message,
        details: errorDetails.details
      },
      timestamp: errorDetails.timestamp,
      requestId: req.requestId || 'unknown'
    });
  }

  /**
   * 🔍 MANEJAR ERRORES DE RECURSO NO ENCONTRADO
   */
  static handleNotFoundError(error, req, res, next) {
    const errorDetails = {
      type: 'NOT_FOUND_ERROR',
      message: 'Recurso no encontrado',
      details: error.message || 'El recurso solicitado no existe',
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      userEmail: req.user?.email,
      ip: req.ip
    };

    logger.info('🔍 Recurso no encontrado', {
      category: 'NOT_FOUND',
      ...errorDetails
    });

    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND_ERROR',
        message: errorDetails.message,
        details: errorDetails.details
      },
      timestamp: errorDetails.timestamp,
      requestId: req.requestId || 'unknown'
    });
  }

  /**
   * 🗄️ MANEJAR ERRORES DE BASE DE DATOS
   */
  static handleDatabaseError(error, req, res, next) {
    const errorDetails = {
      type: 'DATABASE_ERROR',
      message: 'Error de base de datos',
      details: error.message || 'Error interno de base de datos',
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      userEmail: req.user?.email,
      ip: req.ip,
      stack: error.stack?.split('\n').slice(0, 5)
    };

    logger.error('🗄️ Error de base de datos detectado', {
      category: 'DATABASE_ERROR',
      ...errorDetails
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Error interno de base de datos',
        details: process.env.NODE_ENV === 'production' 
          ? 'Error interno del servidor' 
          : errorDetails.details
      },
      timestamp: errorDetails.timestamp,
      requestId: req.requestId || 'unknown'
    });
  }

  /**
   * 🌐 MANEJAR ERRORES DE RED/SERVICIOS EXTERNOS
   */
  static handleNetworkError(error, req, res, next) {
    const errorDetails = {
      type: 'NETWORK_ERROR',
      message: 'Error de red o servicio externo',
      details: error.message || 'Error de conectividad',
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      userEmail: req.user?.email,
      ip: req.ip
    };

    logger.error('🌐 Error de red detectado', {
      category: 'NETWORK_ERROR',
      ...errorDetails
    });

    return res.status(503).json({
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Servicio temporalmente no disponible',
        details: process.env.NODE_ENV === 'production' 
          ? 'Error de conectividad temporal' 
          : errorDetails.details
      },
      timestamp: errorDetails.timestamp,
      requestId: req.requestId || 'unknown'
    });
  }

  /**
   * 💾 MANEJAR ERRORES DE ARCHIVOS/MEDIA
   */
  static handleFileError(error, req, res, next) {
    const errorDetails = {
      type: 'FILE_ERROR',
      message: 'Error de procesamiento de archivo',
      details: error.message || 'Error al procesar archivo',
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      userEmail: req.user?.email,
      ip: req.ip
    };

    logger.error('💾 Error de archivo detectado', {
      category: 'FILE_ERROR',
      ...errorDetails
    });

    return res.status(422).json({
      success: false,
      error: {
        code: 'FILE_ERROR',
        message: 'Error al procesar archivo',
        details: process.env.NODE_ENV === 'production' 
          ? 'Error en el procesamiento del archivo' 
          : errorDetails.details
      },
      timestamp: errorDetails.timestamp,
      requestId: req.requestId || 'unknown'
    });
  }

  /**
   * 🎯 MANEJADOR PRINCIPAL DE ERRORES
   */
  static handleError(error, req, res, next) {
    // Generar ID de request si no existe
    if (!req.requestId) {
      req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    const errorDetails = {
      type: 'UNKNOWN_ERROR',
      message: 'Error interno del servidor',
      details: error.message || 'Error desconocido',
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      userEmail: req.user?.email,
      ip: req.ip,
      stack: error.stack?.split('\n').slice(0, 10),
      requestId: req.requestId
    };

    // Log del error completo
    logger.error('💥 Error no manejado detectado', {
      category: 'UNHANDLED_ERROR',
      ...errorDetails
    });

    // Determinar tipo de error y manejarlo apropiadamente
    if (error.name === 'ValidationError' || error.type === 'VALIDATION_ERROR') {
      return this.handleValidationError(error, req, res, next);
    }

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return this.handleAuthError(error, req, res, next);
    }

    if (error.code === 'PERMISSION_DENIED' || error.type === 'AUTHORIZATION_ERROR') {
      return this.handleAuthorizationError(error, req, res, next);
    }

    if (error.code === 'NOT_FOUND' || error.status === 404) {
      return this.handleNotFoundError(error, req, res, next);
    }

    if (error.code === 'UNAVAILABLE' || error.code === 'DEADLINE_EXCEEDED') {
      return this.handleDatabaseError(error, req, res, next);
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return this.handleNetworkError(error, req, res, next);
    }

    if (error.code === 'FILE_PROCESSING_ERROR' || error.type === 'FILE_ERROR') {
      return this.handleFileError(error, req, res, next);
    }

    // Error genérico para casos no manejados
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'production' 
          ? 'Ha ocurrido un error interno' 
          : errorDetails.details
      },
      timestamp: errorDetails.timestamp,
      requestId: req.requestId
    });
  }

  /**
   * 🛡️ MIDDLEWARE PARA MANEJAR RUTAS NO ENCONTRADAS
   */
  static handleNotFound(req, res, next) {
    const error = new Error('Ruta no encontrada');
    error.status = 404;
    error.code = 'NOT_FOUND';
    return this.handleNotFoundError(error, req, res, next);
  }

  /**
   * 🔧 MIDDLEWARE PARA AGREGAR ID DE REQUEST
   */
  static addRequestId(req, res, next) {
    req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    res.setHeader('X-Request-ID', req.requestId);
    next();
  }

  /**
   * 📊 MIDDLEWARE PARA LOGGING DE REQUESTS
   */
  static logRequest(req, res, next) {
    const startTime = Date.now();
    
    // Log del request
    logger.info('📥 Request recibido', {
      category: 'REQUEST_LOG',
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent']?.substring(0, 100),
      ip: req.ip,
      userEmail: req.user?.email,
      timestamp: new Date().toISOString()
    });

    // Interceptar el final de la respuesta
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      logger.info('📤 Response enviado', {
        category: 'RESPONSE_LOG',
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userEmail: req.user?.email,
        timestamp: new Date().toISOString()
      });
    });

    next();
  }
}

module.exports = EnhancedErrorHandler; 