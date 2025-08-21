/**
 * 🛡️ MIDDLEWARE DE VALIDACIÓN CENTRALIZADA
 * 
 * Sistema de validación robusto para todas las rutas del backend
 * Usa Joi para validación de esquemas y sanitización de datos
 * Incluye validaciones de permisos estandarizadas
 * 
 * @author Backend Team
 * @version 2.1.0
 */

const Joi = require('joi');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/responseHandler');

/**
 * Middleware de validación principal
 * Valida body, query, params y headers según el esquema proporcionado
 */
function validateRequest(schema = {}, options = {}) {
  return (req, res, next) => {
    try {
      const {
        body = {},
        query = {},
        params = {},
        headers = {}
      } = schema;

      const validationErrors = [];
      const sanitizedData = {};

      // Validar body
      if (Object.keys(body).length > 0) {
        const bodyValidation = validateSchema(req.body, body, 'body');
        if (bodyValidation.error) {
          validationErrors.push(bodyValidation.error);
        } else {
          sanitizedData.body = bodyValidation.value;
        }
      }

      // Validar query parameters
      if (Object.keys(query).length > 0) {
        const queryValidation = validateSchema(req.query, query, 'query');
        if (queryValidation.error) {
          validationErrors.push(queryValidation.error);
        } else {
          sanitizedData.query = queryValidation.value;
        }
      }

      // Validar URL parameters
      if (Object.keys(params).length > 0) {
        const paramsValidation = validateSchema(req.params, params, 'params');
        if (paramsValidation.error) {
          validationErrors.push(paramsValidation.error);
        } else {
          sanitizedData.params = paramsValidation.value;
        }
      }

      // Validar headers específicos
      if (Object.keys(headers).length > 0) {
        const headersValidation = validateSchema(req.headers, headers, 'headers');
        if (headersValidation.error) {
          validationErrors.push(headersValidation.error);
        } else {
          sanitizedData.headers = headersValidation.value;
        }
      }

      // Si hay errores de validación, retornar error 400
      if (validationErrors.length > 0) {
        const errorDetails = validationErrors.map(error => ({
          field: error.field,
          message: error.message,
          value: error.value,
          type: error.type
        }));

        logger.warn('Validación de request falló', {
          endpoint: req.originalUrl,
          method: req.method,
          userId: req.user?.id,
          errors: errorDetails
        });

        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Datos de entrada inválidos',
          details: errorDetails,
          timestamp: new Date().toISOString()
        });
      }

      // Reemplazar datos originales con datos sanitizados
      if (sanitizedData.body) req.body = sanitizedData.body;
      if (sanitizedData.query) req.query = sanitizedData.query;
      if (sanitizedData.params) req.params = sanitizedData.params;
      if (sanitizedData.headers) req.headers = { ...req.headers, ...sanitizedData.headers };

      // Log removido para reducir ruido en producción

      next();

    } catch (error) {
      logger.error('Error en middleware de validación:', error);
      next(new ApiError('VALIDATION_SYSTEM_ERROR', 'Error interno del sistema de validación', 500));
    }
  };
}

/**
 * Validar un esquema específico
 */
function validateSchema(data, schema, fieldType) {
  try {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: true  // 🔧 CAMBIADO: Permitir campos desconocidos
    });

    if (error) {
      const validationError = {
        field: fieldType,
        message: 'Datos inválidos',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type,
          value: detail.context?.value
        }))
      };

      return { error: validationError };
    }

    return { value };

  } catch (error) {
    logger.error(`Error validando ${fieldType}:`, error);
    return {
      error: {
        field: fieldType,
        message: 'Error interno de validación',
        details: [{ field: 'unknown', message: error.message }]
      }
    };
  }
}

/**
 * Middleware de validación para archivos
 */
function validateFile(options = {}) {
  return (req, res, next) => {
    try {
      const {
        maxSize = 10 * 1024 * 1024, // 10MB por defecto
        allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
        maxFiles = 1,
        required = false
      } = options;

      // Verificar si hay archivos
      if (!req.files && !req.file) {
        if (required) {
          return res.status(400).json({
            success: false,
            error: 'FILE_REQUIRED',
            message: 'Se requiere al menos un archivo',
            timestamp: new Date().toISOString()
          });
        }
        return next();
      }

      const files = req.files || [req.file];
      
      // Validar número de archivos
      if (files.length > maxFiles) {
        return res.status(400).json({
          success: false,
          error: 'TOO_MANY_FILES',
          message: `Máximo ${maxFiles} archivo(s) permitido(s)`,
          timestamp: new Date().toISOString()
        });
      }

      // Validar cada archivo
      for (const file of files) {
        // Validar tamaño
        if (file.size > maxSize) {
          return res.status(400).json({
            success: false,
            error: 'FILE_TOO_LARGE',
            message: `Archivo ${file.originalname} excede el tamaño máximo de ${formatFileSize(maxSize)}`,
            timestamp: new Date().toISOString()
          });
        }

        // Validar tipo
        if (!allowedTypes.includes(file.mimetype)) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_FILE_TYPE',
            message: `Tipo de archivo no permitido: ${file.mimetype}`,
            allowedTypes,
            timestamp: new Date().toISOString()
          });
        }

        // Validar nombre de archivo
        if (!file.originalname || file.originalname.length > 255) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_FILENAME',
            message: 'Nombre de archivo inválido',
            timestamp: new Date().toISOString()
          });
        }
      }

      logger.info('Validación de archivos exitosa', {
        endpoint: req.originalUrl,
        fileCount: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0)
      });

      next();

    } catch (error) {
      logger.error('Error en validación de archivos:', error);
      next(new ApiError('FILE_VALIDATION_ERROR', 'Error validando archivos', 500));
    }
  };
}

/**
 * Middleware de validación para IDs
 * 🔧 CORRECCIÓN CRÍTICA: Usar conversationId ya normalizado si está disponible
 */
function validateId(paramName = 'id') {
  return (req, res, next) => {
    try {
      // 🔧 CORRECCIÓN CRÍTICA: Usar el ID ya normalizado si está disponible
      const id = req.normalizedConversationId || req.params[paramName];
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_ID',
          message: `ID requerido en parámetro: ${paramName}`,
          timestamp: new Date().toISOString()
        });
      }

      // 🔧 CORRECCIÓN: Validar tanto UUID como conversationId (ya normalizado)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const conversationIdRegex = /^conv_(\+?\d+)_(\+?\d+)$/;
      
      // Verificar si es UUID
      if (uuidRegex.test(id)) {
        return next();
      }
      
      // Verificar si es conversationId
      if (conversationIdRegex.test(id)) {
        return next();
      }
      
      // Si no es ninguno de los formatos válidos
      logger.warn('ID con formato inválido (ya normalizado)', {
        paramName,
        id: id,
        endpoint: req.originalUrl,
        method: req.method
      });
      
      return res.status(400).json({
        success: false,
        error: 'INVALID_ID_FORMAT',
        message: `Formato de ID inválido: ${paramName}. Debe ser UUID o conversationId (conv_+phone1_+phone2)`,
        value: id,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error en validación de ID:', error);
      next(new ApiError('ID_VALIDATION_ERROR', 'Error validando ID', 500));
    }
  };
}

/**
 * Middleware de validación específica para conversationId
 * 🔧 CORRECCIÓN CRÍTICA: Usar el conversationId ya normalizado por normalizeConversationId
 */
function validateConversationId(paramName = 'conversationId') {
  return (req, res, next) => {
    try {
      // 🔧 CORRECCIÓN CRÍTICA: Usar el conversationId ya normalizado
      // El middleware normalizeConversationId ya se encarga de la decodificación
      const id = req.normalizedConversationId || req.params[paramName] || req.query[paramName];
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_CONVERSATION_ID',
          message: `conversationId requerido en parámetro: ${paramName}`,
          timestamp: new Date().toISOString()
        });
      }

      // 🔧 CORRECCIÓN: El conversationId ya está normalizado, solo validar formato
      const conversationIdRegex = /^conv_(\+?\d+)_(\+?\d+)$/;
      
      if (!conversationIdRegex.test(id)) {
        logger.warn('ConversationId con formato inválido (ya normalizado)', {
          paramName,
          conversationId: id,
          endpoint: req.originalUrl,
          method: req.method
        });
        
        return res.status(400).json({
          success: false,
          error: 'INVALID_CONVERSATION_ID_FORMAT',
          message: `Formato de conversationId inválido: ${paramName}. Debe ser conv_+phone1_+phone2`,
          value: id,
          timestamp: new Date().toISOString()
        });
      }

      // 🔧 CORRECCIÓN: Actualizar el request con el ID decodificado
      if (req.params[paramName]) {
        req.params[paramName] = decodedId;
      }
      if (req.query[paramName]) {
        req.query[paramName] = decodedId;
      }

      next();

    } catch (error) {
      logger.error('Error en validación de conversationId:', error);
      next(new ApiError('CONVERSATION_ID_VALIDATION_ERROR', 'Error validando conversationId', 500));
    }
  };
}

/**
 * Middleware de validación para paginación
 */
function validatePagination() {
  return (req, res, next) => {
    try {
      const { page, limit, cursor } = req.query;
      
      const errors = [];

      // Validar página
      if (page !== undefined) {
        const pageNum = parseInt(page);
        if (isNaN(pageNum) || pageNum < 1) {
          errors.push({
            field: 'page',
            message: 'Página debe ser un número mayor a 0',
            value: page
          });
        }
      }

      // Validar límite
      if (limit !== undefined) {
        const limitNum = parseInt(limit);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
          errors.push({
            field: 'limit',
            message: 'Límite debe ser un número entre 1 y 100',
            value: limit
          });
        }
      }

      // Validar cursor
      if (cursor !== undefined && typeof cursor !== 'string') {
        errors.push({
          field: 'cursor',
          message: 'Cursor debe ser una cadena válida',
          value: cursor
        });
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'PAGINATION_VALIDATION_ERROR',
          message: 'Parámetros de paginación inválidos',
          details: errors,
          timestamp: new Date().toISOString()
        });
      }

      next();

    } catch (error) {
      logger.error('Error en validación de paginación:', error);
      next(new ApiError('PAGINATION_ERROR', 'Error validando paginación', 500));
    }
  };
}

/**
 * Middleware de validación para búsquedas
 */
function validateSearch() {
  return (req, res, next) => {
    try {
      const { search, q } = req.query;
      const searchTerm = search || q;

      if (searchTerm !== undefined) {
        if (typeof searchTerm !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'INVALID_SEARCH_TERM',
            message: 'Término de búsqueda debe ser una cadena',
            timestamp: new Date().toISOString()
          });
        }

        if (searchTerm.length < 2) {
          return res.status(400).json({
            success: false,
            error: 'SEARCH_TERM_TOO_SHORT',
            message: 'Término de búsqueda debe tener al menos 2 caracteres',
            timestamp: new Date().toISOString()
          });
        }

        if (searchTerm.length > 200) {
          return res.status(400).json({
            success: false,
            error: 'SEARCH_TERM_TOO_LONG',
            message: 'Término de búsqueda no puede exceder 200 caracteres',
            timestamp: new Date().toISOString()
          });
        }
      }

      next();

    } catch (error) {
      logger.error('Error en validación de búsqueda:', error);
      next(new ApiError('SEARCH_VALIDATION_ERROR', 'Error validando búsqueda', 500));
    }
  };
}

/**
 * Utilidad para formatear tamaño de archivo
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validar array de mensajes
 */
function validateMessagesArrayResponse(messages) {
  if (!Array.isArray(messages)) {
    throw new Error('Messages debe ser un array');
  }
  return messages.filter(msg => msg && typeof msg === 'object' && msg.id);
}

/**
 * 🔧 MIDDLEWARE PARA VALIDAR DOCUMENTOS DE FIREBASE
 * Previene errores de toJSON() y otros métodos de Firestore
 */
const validateFirestoreDocument = (doc, res, documentType = 'documento') => {
  if (!doc) {
    return {
      isValid: false,
      error: {
        success: false,
        error: "DOCUMENT_NOT_FOUND",
        message: `El ${documentType} no fue encontrado`,
        suggestion: "Verifica que el ID sea correcto y que el documento exista"
      }
    };
  }

  // Si es un documento de Firestore con método exists
  if (typeof doc.exists === 'boolean' && !doc.exists) {
    return {
      isValid: false,
      error: {
        success: false,
        error: "DOCUMENT_NOT_FOUND",
        message: `El ${documentType} no existe en la base de datos`,
        suggestion: "Verifica que el ID sea correcto"
      }
    };
  }

  return {
    isValid: true,
    data: doc
  };
};

/**
 * 🔧 FUNCIÓN PARA CONVERTIR DOCUMENTOS DE FIREBASE DE FORMA SEGURA
 */
const safeFirestoreToJSON = (doc) => {
  if (!doc) return null;
  
  // Si es un documento de Firestore con toJSON
  if (typeof doc.toJSON === 'function') {
    return doc.toJSON();
  }
  
  // Si es un objeto plano, devolver directamente
  if (typeof doc === 'object') {
    return doc;
  }
  
  return null;
};

/**
 * 🔐 VALIDACIONES DE PERMISOS ESTANDARIZADAS
 */

/**
 * Middleware para validar roles de usuario
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Usuario no autenticado'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: `Acceso denegado. Roles permitidos: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}

/**
 * Middleware para validar permisos específicos
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Usuario no autenticado'
      });
    }

    if (!req.user.permissions || !req.user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: `Permiso requerido: ${permission}`
      });
    }

    next();
  };
}

/**
 * Middleware para validar propiedad de recursos
 */
function requireOwnership(resourceType, getResourceId) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Usuario no autenticado'
        });
      }

      // Admins pueden acceder a todo
      if (req.user.role === 'admin') {
        return next();
      }

      const resourceId = getResourceId(req);
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_RESOURCE_ID',
          message: 'ID del recurso requerido'
        });
      }

      // Aquí implementarías la lógica para verificar propiedad
      // Por ahora, asumimos que el recurso tiene un campo createdBy o ownerId
      // Esta función debería ser implementada según el modelo específico

      next();
    } catch (error) {
      logger.error('Error validando propiedad de recurso:', error);
      return res.status(500).json({
        success: false,
        error: 'OWNERSHIP_VALIDATION_ERROR',
        message: 'Error validando propiedad del recurso'
      });
    }
  };
}

module.exports = {
  validateRequest,
  validateFile,
  validateId,
  validateConversationId,
  validatePagination,
  validateSearch,
  formatFileSize,
  validateMessagesArrayResponse,
  validateFirestoreDocument,
  safeFirestoreToJSON,
  requireRole,
  requirePermission,
  requireOwnership
}; 