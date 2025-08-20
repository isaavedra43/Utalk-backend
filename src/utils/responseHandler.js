/**
 * 📡 MANEJADOR ESTÁNDAR DE RESPUESTAS API
 * 
 * Implementa las mejores prácticas según ReadMe para estructuras
 * de respuesta consistentes y manejo de errores descriptivo.
 * 
 * @see https://blog.readme.com/how-to-write-good-api-errors/
 */

const logger = require('./logger');

/**
 * ResponseHandler - Centraliza formatos de respuesta
 * Elimina duplicaciones en error responses y success responses
 */

class ResponseHandler {
  /**
   * Respuesta de éxito estándar
   */
  static success(res, data = null, message = 'Operación exitosa', statusCode = 200) {
    const response = {
      success: true,
      message,
      timestamp: new Date().toISOString()
    };

    if (data !== null) {
      response.data = data;
    }

    logger.debug('ResponseHandler.success', {
      category: 'RESPONSE_SUCCESS',
      statusCode,
      hasData: data !== null
    });

    return res.status(statusCode).json(response);
  }

  /**
   * Respuesta de error estándar
   */
  static error(res, error, statusCode = 500) {
    // 🔧 CORRECCIÓN CRÍTICA: Validar que error no sea undefined
    if (!error) {
      logger.error('ResponseHandler.error recibió error undefined', {
        category: 'RESPONSE_ERROR_UNDEFINED',
        statusCode
      });
      
      return res.status(statusCode).json({
        success: false,
        error: {
          type: 'INTERNAL_SERVER_ERROR',
          code: 'UNDEFINED_ERROR',
          message: 'Error interno del servidor',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 🔧 CORRECCIÓN: Usar statusCode del error si está disponible
    const finalStatusCode = error.statusCode || statusCode;

    const errorResponse = {
      success: false,
      error: {
        type: error.type || 'INTERNAL_SERVER_ERROR',
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'Error interno del servidor',
        timestamp: new Date().toISOString()
      }
    };

    // Agregar detalles si están disponibles
    if (error.details) {
      errorResponse.error.details = error.details;
    }

    // Agregar requestId si está disponible
    if (error.requestId) {
      errorResponse.requestId = error.requestId;
    }

    logger.warn('ResponseHandler.error', {
      category: 'RESPONSE_ERROR',
      statusCode: finalStatusCode,
      errorType: error.type || 'UNKNOWN',
      errorCode: error.code || 'UNKNOWN',
      message: error.message || 'No message'
    });

    return res.status(finalStatusCode).json(errorResponse);
  }

  /**
   * Error de validación
   */
  static validationError(res, message = 'Datos de entrada inválidos', details = null) {
    return this.error(res, {
      type: 'VALIDATION_ERROR',
      code: 'INVALID_INPUT',
      message,
      details
    }, 400);
  }

  /**
   * Error de autenticación
   */
  static authenticationError(res, message = 'No autorizado') {
    return this.error(res, {
      type: 'AUTHENTICATION_ERROR',
      code: 'UNAUTHORIZED',
      message
    }, 401);
  }

  /**
   * Error de autorización
   */
  static authorizationError(res, message = 'Acceso denegado') {
    return this.error(res, {
      type: 'AUTHORIZATION_ERROR',
      code: 'FORBIDDEN',
      message
    }, 403);
  }

  /**
   * Error de recurso no encontrado
   */
  static notFoundError(res, message = 'Recurso no encontrado') {
    return this.error(res, {
      type: 'NOT_FOUND_ERROR',
      code: 'RESOURCE_NOT_FOUND',
      message
    }, 404);
  }

  /**
   * Error de conflicto
   */
  static conflictError(res, message = 'Conflicto de datos') {
    return this.error(res, {
      type: 'CONFLICT_ERROR',
      code: 'DATA_CONFLICT',
      message
    }, 409);
  }

  /**
   * Error de configuración
   */
  static configurationError(res, message = 'Error de configuración del servidor') {
    return this.error(res, {
      type: 'CONFIGURATION_ERROR',
      code: 'SERVER_CONFIG_ERROR',
      message
    }, 500);
  }

  /**
   * Error de servicio no disponible
   */
  static serviceUnavailableError(res, message = 'Servicio temporalmente no disponible') {
    return this.error(res, {
      type: 'SERVICE_UNAVAILABLE_ERROR',
      code: 'SERVICE_DOWN',
      message
    }, 503);
  }

  /**
   * Respuesta de logout exitoso
   */
  static logoutSuccess(res, message = 'Logout exitoso') {
    return this.success(res, null, message, 200);
  }

  /**
   * Respuesta de creación exitosa
   */
  static created(res, data, message = 'Recurso creado exitosamente') {
    return this.success(res, data, message, 201);
  }

  /**
   * Respuesta de actualización exitosa
   */
  static updated(res, data, message = 'Recurso actualizado exitosamente') {
    return this.success(res, data, message, 200);
  }

  /**
   * Respuesta de eliminación exitosa
   */
  static deleted(res, message = 'Recurso eliminado exitosamente') {
    return this.success(res, null, message, 200);
  }

  /**
   * Respuesta de operación exitosa sin datos
   */
  static ok(res, message = 'Operación completada exitosamente') {
    return this.success(res, null, message, 200);
  }

  /**
   * Respuesta con datos y paginación
   */
  static paginated(res, data, pagination, message = 'Datos obtenidos exitosamente') {
    const response = {
      success: true,
      message,
      data,
      pagination,
      timestamp: new Date().toISOString()
    };

    logger.debug('ResponseHandler.paginated', {
      category: 'RESPONSE_PAGINATED',
      totalItems: pagination?.total || 0,
      currentPage: pagination?.page || 1
    });

    return res.status(200).json(response);
  }
}

/**
 * 🚨 CLASE DE ERROR PERSONALIZADO
 * Para crear errores estructurados con metadatos
 */
class ApiError extends Error {
  constructor(type, code, message, statusCode = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  static validationError(message, details = null) {
    return new ApiError('VALIDATION_ERROR', 'INVALID_INPUT', message, 400, details);
  }

  static authenticationError(message = 'No autorizado') {
    return new ApiError('AUTHENTICATION_ERROR', 'UNAUTHORIZED', message, 401);
  }

  static authorizationError(message = 'Acceso denegado') {
    return new ApiError('AUTHORIZATION_ERROR', 'FORBIDDEN', message, 403);
  }

  static notFoundError(message = 'Recurso no encontrado') {
    return new ApiError('NOT_FOUND_ERROR', 'RESOURCE_NOT_FOUND', message, 404);
  }

  static conflictError(message = 'Conflicto de datos') {
    return new ApiError('CONFLICT_ERROR', 'DATA_CONFLICT', message, 409);
  }

  static internalServerError(message = 'Error interno del servidor') {
    return new ApiError('INTERNAL_SERVER_ERROR', 'SERVER_ERROR', message, 500);
  }
}

/**
 * 🚨 ERRORES COMUNES PREDEFINIDOS
 * Centraliza errores comunes para consistencia en toda la aplicación
 */
class CommonErrors {
  /**
   * Error de conversación no encontrada
   */
  static CONVERSATION_NOT_FOUND(conversationId) {
    return {
      type: 'NOT_FOUND_ERROR',
      code: 'CONVERSATION_NOT_FOUND',
      message: `Conversación no encontrada: ${conversationId}`,
      statusCode: 404
    };
  }

  /**
   * Error de usuario no autorizado
   */
  static USER_NOT_AUTHORIZED(action, resource) {
    return {
      type: 'AUTHORIZATION_ERROR',
      code: 'USER_NOT_AUTHORIZED',
      message: `No tienes permisos para ${action} ${resource}`,
      statusCode: 403
    };
  }

  /**
   * Error de conversación ya asignada
   */
  static CONVERSATION_ALREADY_ASSIGNED(conversationId, assignedTo) {
    return {
      type: 'CONFLICT_ERROR',
      code: 'CONVERSATION_ALREADY_ASSIGNED',
      message: `La conversación ${conversationId} ya está asignada a ${assignedTo}`,
      statusCode: 409
    };
  }

  /**
   * Error interno del servidor
   */
  static INTERNAL_SERVER_ERROR(message = 'Error interno del servidor') {
    return {
      type: 'INTERNAL_SERVER_ERROR',
      code: 'SERVER_ERROR',
      message,
      statusCode: 500
    };
  }

  /**
   * Error de validación
   */
  static VALIDATION_ERROR(message = 'Datos de entrada inválidos', details = null) {
    return {
      type: 'VALIDATION_ERROR',
      code: 'INVALID_INPUT',
      message,
      details,
      statusCode: 400
    };
  }

  /**
   * Error de autenticación
   */
  static AUTHENTICATION_ERROR(message = 'No autorizado') {
    return {
      type: 'AUTHENTICATION_ERROR',
      code: 'UNAUTHORIZED',
      message,
      statusCode: 401
    };
  }
}

module.exports = { ResponseHandler, CommonErrors, ApiError }; 