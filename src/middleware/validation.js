/**
 * 🛡️ MIDDLEWARE DE VALIDACIÓN CENTRALIZADA
 * 
 * Sistema de validación robusto para todas las rutas del backend
 * Usa Joi para validación de esquemas y sanitización de datos
 * 
 * @author Backend Team
 * @version 2.0.0
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

      // Log de validación exitosa (solo en desarrollo)
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Validación de request exitosa', {
          endpoint: req.originalUrl,
          method: req.method,
          userId: req.user?.id,
          bodyKeys: Object.keys(req.body || {}),
          queryKeys: Object.keys(req.query || {}),
          paramsKeys: Object.keys(req.params || {})
        });
      }

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
      allowUnknown: false
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
 */
function validateId(paramName = 'id') {
  return (req, res, next) => {
    try {
      const id = req.params[paramName];
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_ID',
          message: `ID requerido en parámetro: ${paramName}`,
          timestamp: new Date().toISOString()
        });
      }

      // Validar formato UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      if (!uuidRegex.test(id)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_ID_FORMAT',
          message: `Formato de ID inválido: ${paramName}`,
          timestamp: new Date().toISOString()
        });
      }

      next();

    } catch (error) {
      logger.error('Error en validación de ID:', error);
      next(new ApiError('ID_VALIDATION_ERROR', 'Error validando ID', 500));
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

module.exports = {
  validateRequest,
  validateFile,
  validateId,
  validatePagination,
  validateSearch,
  formatFileSize
}; 