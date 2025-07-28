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
 * Estructura estándar de respuesta exitosa
 */
class ApiResponse {
  constructor(data, message = null, metadata = {}) {
    this.success = true;
    this.data = data;
    if (message) this.message = message;
    if (Object.keys(metadata).length > 0) this.metadata = metadata;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Estructura estándar de respuesta con paginación
 */
class PaginatedResponse extends ApiResponse {
  constructor(data, pagination, message = null, metadata = {}) {
    super(data, message, metadata);
    this.pagination = {
      hasMore: pagination.hasMore || false,
      nextCursor: pagination.nextCursor || null,
      totalResults: pagination.totalResults || data.length,
      limit: pagination.limit || 20,
      ...pagination
    };
  }
}

/**
 * Estructura estándar de error según ReadMe
 */
class ApiError extends Error {
  constructor(errorCode, message, suggestion = null, statusCode = 400, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.error = errorCode; // Código único para identificar el error
    this.message = message; // Descripción detallada del problema
    this.suggestion = suggestion; // Cómo solucionarlo
    this.statusCode = statusCode;
    this.details = details;
    this.docs = `${process.env.API_DOCS_URL || 'https://api.utalk.com/docs'}/${this.getDocsPath()}`;
    this.help = `Si necesitas ayuda, contacta soporte@utalk.com y menciona el código de error '${errorCode}'`;
    this.timestamp = new Date().toISOString();
  }

  getDocsPath() {
    const errorToDocs = {
      'CONVERSATION_NOT_FOUND': 'conversations/get',
      'MESSAGE_NOT_FOUND': 'messages/get',
      'USER_NOT_AUTHORIZED': 'authentication',
      'VALIDATION_FAILED': 'validation',
      'CONVERSATION_ALREADY_ASSIGNED': 'conversations/assign',
      'MESSAGE_SEND_FAILED': 'messages/send',
      'CONVERSATION_CREATE_FAILED': 'conversations/create',
      'INVALID_PAGINATION_CURSOR': 'pagination',
      'RATE_LIMIT_EXCEEDED': 'rate-limits',
      'WEBHOOK_VALIDATION_FAILED': 'webhooks/twilio'
    };
    return errorToDocs[this.error] || 'general/errors';
  }

  toJSON() {
    return {
      success: false,
      error: this.error,
      message: this.message,
      suggestion: this.suggestion,
      docs: this.docs,
      help: this.help,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

/**
 * Errores predefinidos comunes
 */
const CommonErrors = {
  CONVERSATION_NOT_FOUND: (conversationId) => new ApiError(
    'CONVERSATION_NOT_FOUND',
    `No se pudo encontrar la conversación con ID: ${conversationId}`,
    'Verifica que el ID sea correcto y que tengas permisos para acceder a esta conversación',
    404,
    { conversationId }
  ),

  MESSAGE_NOT_FOUND: (messageId, conversationId) => new ApiError(
    'MESSAGE_NOT_FOUND',
    `No se pudo encontrar el mensaje ${messageId} en la conversación ${conversationId}`,
    'Verifica que tanto el ID del mensaje como el de la conversación sean correctos',
    404,
    { messageId, conversationId }
  ),

  USER_NOT_AUTHORIZED: (action, resource) => new ApiError(
    'USER_NOT_AUTHORIZED',
    `No tienes permisos para ${action} en ${resource}`,
    'Contacta a tu administrador para obtener los permisos necesarios',
    403,
    { action, resource }
  ),

  VALIDATION_FAILED: (validationErrors) => new ApiError(
    'VALIDATION_FAILED',
    'Los datos enviados no cumplen con el formato requerido',
    'Revisa los campos marcados como inválidos y corrige el formato',
    400,
    { validationErrors }
  ),

  CONVERSATION_ALREADY_ASSIGNED: (conversationId, currentAssignee) => new ApiError(
    'CONVERSATION_ALREADY_ASSIGNED',
    `La conversación ${conversationId} ya está asignada a ${currentAssignee}`,
    'Desasigna la conversación primero o transfiere directamente al nuevo agente',
    409,
    { conversationId, currentAssignee }
  ),

  MESSAGE_SEND_FAILED: (reason) => new ApiError(
    'MESSAGE_SEND_FAILED',
    `No se pudo enviar el mensaje: ${reason}`,
    'Verifica la conexión con el proveedor de mensajería y reintenta',
    500,
    { reason }
  ),

  RATE_LIMIT_EXCEEDED: (limit, window) => new ApiError(
    'RATE_LIMIT_EXCEEDED',
    `Has excedido el límite de ${limit} solicitudes por ${window}`,
    `Espera ${window} antes de hacer más solicitudes`,
    429,
    { limit, window }
  )
};

/**
 * Manejadores de respuesta
 */
const ResponseHandler = {
  /**
   * Respuesta exitosa simple
   */
  success(res, data, message = null, statusCode = 200) {
    const response = new ApiResponse(data, message);
    return res.status(statusCode).json(response);
  },

  /**
   * Respuesta exitosa con paginación
   */
  successPaginated(res, data, pagination, message = null, statusCode = 200) {
    const response = new PaginatedResponse(data, pagination, message);
    return res.status(statusCode).json(response);
  },

  /**
   * Respuesta creada exitosamente
   */
  created(res, data, message = 'Recurso creado exitosamente') {
    return this.success(res, data, message, 201);
  },

  /**
   * Respuesta sin contenido
   */
  noContent(res) {
    return res.status(204).send();
  },

  /**
   * Manejo de errores
   */
  error(res, error) {
    // Si es un ApiError personalizado
    if (error instanceof ApiError) {
      logger.warn('Error API controlado', {
        error: error.error,
        message: error.message,
        statusCode: error.statusCode,
        details: error.details
      });
      return res.status(error.statusCode).json(error.toJSON());
    }

    // Si es un error de validación Joi
    if (error.isJoi) {
      const validationError = CommonErrors.VALIDATION_FAILED(
        error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }))
      );
      return res.status(validationError.statusCode).json(validationError.toJSON());
    }

    // Error genérico no controlado
    logger.error('Error no controlado en API', {
      error: error.message,
      stack: error.stack
    });

    const genericError = new ApiError(
      'INTERNAL_SERVER_ERROR',
      'Ocurrió un error interno del servidor',
      'Si el problema persiste, contacta al soporte técnico',
      500,
      { originalError: process.env.NODE_ENV === 'development' ? error.message : undefined }
    );

    return res.status(500).json(genericError.toJSON());
  }
};

module.exports = {
  ResponseHandler,
  ApiResponse,
  PaginatedResponse,
  ApiError,
  CommonErrors
}; 