/**
 * 📤 MIDDLEWARE DE RESPUESTAS HTTP CENTRALIZADO
 * 
 * Centraliza toda la lógica de formateo y manejo de respuestas HTTP
 * para evitar duplicación en controladores y servicios.
 * 
 * @version 2.0.0
 * @author Backend Team
 */

const logger = require('../utils/logger');

/**
 * Middleware para formatear respuestas exitosas
 */
function formatSuccessResponse(data = null, message = 'Operación exitosa', statusCode = 200) {
  return (req, res, next) => {
    const response = {
      success: true,
      message,
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'unknown'
    };

    if (data !== null) {
      response.data = data;
    }

    // Agregar información de paginación si existe
    if (data && data.pagination) {
      response.pagination = data.pagination;
      delete response.data.pagination;
    }

    // Agregar metadata si existe
    if (data && data.metadata) {
      response.metadata = data.metadata;
      delete response.data.metadata;
    }

    logger.info('Respuesta exitosa enviada', {
      endpoint: req.originalUrl,
      statusCode,
      message,
      hasData: !!data,
      requestId: req.requestId
    });

    res.status(statusCode).json(response);
  };
}

/**
 * Middleware para formatear respuestas de error
 */
function formatErrorResponse(error, statusCode = 500) {
  return (req, res, next) => {
    const errorResponse = {
      success: false,
      error: {
        type: error.type || 'INTERNAL_ERROR',
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'Error interno del servidor',
        timestamp: new Date().toISOString(),
        requestId: req.requestId || 'unknown'
      }
    };

    // Agregar detalles si están disponibles
    if (error.details) {
      errorResponse.error.details = error.details;
    }

    // Agregar stack trace en desarrollo
    if (process.env.NODE_ENV === 'development' && error.stack) {
      errorResponse.error.stack = error.stack.split('\n').slice(0, 5);
    }

    logger.error('Respuesta de error enviada', {
      endpoint: req.originalUrl,
      statusCode,
      errorType: error.type,
      errorCode: error.code,
      message: error.message,
      requestId: req.requestId
    });

    res.status(statusCode).json(errorResponse);
  };
}

/**
 * Middleware para respuestas paginadas
 */
function formatPaginatedResponse(data, pagination, message = 'Datos obtenidos exitosamente') {
  return (req, res, next) => {
    const response = {
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 20,
        total: pagination.total || 0,
        totalPages: pagination.totalPages || 0,
        hasNextPage: pagination.hasNextPage || false,
        hasPrevPage: pagination.hasPrevPage || false,
        nextPage: pagination.nextPage || null,
        prevPage: pagination.prevPage || null
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'unknown'
    };

    logger.info('Respuesta paginada enviada', {
      endpoint: req.originalUrl,
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
      requestId: req.requestId
    });

    res.status(200).json(response);
  };
}

/**
 * Middleware para respuestas de creación
 */
function formatCreatedResponse(data, message = 'Recurso creado exitosamente') {
  return (req, res, next) => {
    const response = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'unknown'
    };

    logger.info('Respuesta de creación enviada', {
      endpoint: req.originalUrl,
      message,
      requestId: req.requestId
    });

    res.status(201).json(response);
  };
}

/**
 * Middleware para respuestas de actualización
 */
function formatUpdatedResponse(data, message = 'Recurso actualizado exitosamente') {
  return (req, res, next) => {
    const response = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'unknown'
    };

    logger.info('Respuesta de actualización enviada', {
      endpoint: req.originalUrl,
      message,
      requestId: req.requestId
    });

    res.status(200).json(response);
  };
}

/**
 * Middleware para respuestas de eliminación
 */
function formatDeletedResponse(message = 'Recurso eliminado exitosamente') {
  return (req, res, next) => {
    const response = {
      success: true,
      message,
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'unknown'
    };

    logger.info('Respuesta de eliminación enviada', {
      endpoint: req.originalUrl,
      message,
      requestId: req.requestId
    });

    res.status(200).json(response);
  };
}

/**
 * Middleware para respuestas de validación
 */
function formatValidationResponse(errors, message = 'Datos de entrada inválidos') {
  return (req, res, next) => {
    const response = {
      success: false,
      error: {
        type: 'VALIDATION_ERROR',
        code: 'INVALID_INPUT',
        message,
        details: errors,
        timestamp: new Date().toISOString(),
        requestId: req.requestId || 'unknown'
      }
    };

    logger.warn('Respuesta de validación enviada', {
      endpoint: req.originalUrl,
      errors: errors.length,
      requestId: req.requestId
    });

    res.status(400).json(response);
  };
}

/**
 * Middleware para respuestas de autenticación
 */
function formatAuthResponse(error, message = 'Error de autenticación') {
  return (req, res, next) => {
    const response = {
      success: false,
      error: {
        type: 'AUTHENTICATION_ERROR',
        code: error.code || 'UNAUTHORIZED',
        message,
        timestamp: new Date().toISOString(),
        requestId: req.requestId || 'unknown'
      }
    };

    logger.warn('Respuesta de autenticación enviada', {
      endpoint: req.originalUrl,
      errorCode: error.code,
      requestId: req.requestId
    });

    res.status(401).json(response);
  };
}

/**
 * Middleware para respuestas de autorización
 */
function formatAuthorizationResponse(error, message = 'No tienes permisos para realizar esta acción') {
  return (req, res, next) => {
    const response = {
      success: false,
      error: {
        type: 'AUTHORIZATION_ERROR',
        code: error.code || 'FORBIDDEN',
        message,
        timestamp: new Date().toISOString(),
        requestId: req.requestId || 'unknown'
      }
    };

    logger.warn('Respuesta de autorización enviada', {
      endpoint: req.originalUrl,
      errorCode: error.code,
      requestId: req.requestId
    });

    res.status(403).json(response);
  };
}

/**
 * Middleware para respuestas de no encontrado
 */
function formatNotFoundResponse(resource = 'Recurso', message = null) {
  return (req, res, next) => {
    const response = {
      success: false,
      error: {
        type: 'NOT_FOUND_ERROR',
        code: 'RESOURCE_NOT_FOUND',
        message: message || `${resource} no encontrado`,
        timestamp: new Date().toISOString(),
        requestId: req.requestId || 'unknown'
      }
    };

    logger.warn('Respuesta de no encontrado enviada', {
      endpoint: req.originalUrl,
      resource,
      requestId: req.requestId
    });

    res.status(404).json(response);
  };
}

/**
 * Middleware para respuestas de conflicto
 */
function formatConflictResponse(message = 'Conflicto con el estado actual del recurso') {
  return (req, res, next) => {
    const response = {
      success: false,
      error: {
        type: 'CONFLICT_ERROR',
        code: 'RESOURCE_CONFLICT',
        message,
        timestamp: new Date().toISOString(),
        requestId: req.requestId || 'unknown'
      }
    };

    logger.warn('Respuesta de conflicto enviada', {
      endpoint: req.originalUrl,
      message,
      requestId: req.requestId
    });

    res.status(409).json(response);
  };
}

/**
 * Middleware para respuestas de rate limit
 */
function formatRateLimitResponse(retryAfter = 60) {
  return (req, res, next) => {
    const response = {
      success: false,
      error: {
        type: 'RATE_LIMIT_ERROR',
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Demasiadas solicitudes. Intenta más tarde.',
        retryAfter,
        timestamp: new Date().toISOString(),
        requestId: req.requestId || 'unknown'
      }
    };

    logger.warn('Respuesta de rate limit enviada', {
      endpoint: req.originalUrl,
      retryAfter,
      requestId: req.requestId
    });

    res.set('Retry-After', retryAfter.toString());
    res.status(429).json(response);
  };
}

module.exports = {
  formatSuccessResponse,
  formatErrorResponse,
  formatPaginatedResponse,
  formatCreatedResponse,
  formatUpdatedResponse,
  formatDeletedResponse,
  formatValidationResponse,
  formatAuthResponse,
  formatAuthorizationResponse,
  formatNotFoundResponse,
  formatConflictResponse,
  formatRateLimitResponse
}; 