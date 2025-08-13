/**
 * 🛡️ ERROR WRAPPER UTILITY
 * 
 * Utilidad para envolver automáticamente métodos de controladores
 * con manejo robusto de errores según mejores prácticas.
 * 
 * Basado en:
 * - https://medium.com/@ctrlaltvictoria/backend-error-handling-practical-tips-from-a-startup-cto-bb988ccb3e5b
 * - https://medium.com/@myat.su.phyo/best-practices-for-error-handling-in-backend-development-0f9faea39a66
 * 
 * @version 1.0.0
 * @author Error Handling Team
 */

const logger = require('./logger');
const { ERROR_TYPES } = require('../middleware/enhancedErrorHandler');

/**
 * 🔧 WRAPPER PARA MÉTODOS ASYNC DE CONTROLADORES
 * 
 * Envuelve automáticamente métodos async para capturar errores
 * y asegurar que lleguen al error handler global
 */
function asyncWrapper(fn, options = {}) {
  const {
    operationName = 'unknown_operation',
    logParams = true,
    sanitizeParams = true,
    timeoutMs = 30000, // 30 segundos por defecto
    retryable = false
  } = options;

  return async (req, res, next) => {
    // ✅ CRÍTICO: Verificar que next sea una función válida
    if (typeof next !== 'function') {
      console.error('❌ ERROR: next no es una función válida en asyncWrapper', {
        operationName,
        nextType: typeof next,
        nextValue: next
      });
      return res.status(500).json({
        success: false,
        error: {
          type: 'MIDDLEWARE_ERROR',
          code: 'NEXT_FUNCTION_INVALID',
          message: 'Error interno del servidor: middleware mal configurado'
        }
      });
    }

    const startTime = Date.now();
    const requestId = req.requestId || 'unknown';
    
    // Timeout handler
    const timeoutHandler = setTimeout(() => {
      const error = new Error(`Operation timeout: ${operationName}`);
      error.name = 'TimeoutError';
      error.statusCode = 408;
      error.operationName = operationName;
      error.timeoutMs = timeoutMs;
      
      logger.error('Operación timeout', {
        category: 'OPERATION_TIMEOUT',
        operationName,
        timeoutMs,
        requestId,
        severity: 'HIGH'
      });
      
      // ✅ CRÍTICO: Verificar que next sea una función antes de llamarla
      if (typeof next === 'function') {
        next(error);
      } else {
        console.error('❌ ERROR: next no es función en timeout handler');
      }
    }, timeoutMs);

    try {
      // Log inicio de operación
      if (logParams) {
        logger.info(`Iniciando operación: ${operationName}`, {
          category: 'OPERATION_START',
          operationName,
          method: req.method,
          url: req.originalUrl,
          userId: req.user?.id,
          requestId,
          params: sanitizeParams ? sanitizeForLogging(req.params) : req.params,
          query: sanitizeParams ? sanitizeForLogging(req.query) : req.query
        });
      }

      // Ejecutar función original
      await fn(req, res, next);
      
      // Limpiar timeout si completó exitosamente
      clearTimeout(timeoutHandler);
      
      // Log éxito de operación
      const duration = Date.now() - startTime;
      logger.info(`Operación completada: ${operationName}`, {
        category: 'OPERATION_SUCCESS',
        operationName,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        requestId,
        userId: req.user?.id
      });

    } catch (error) {
      // Limpiar timeout
      clearTimeout(timeoutHandler);
      
      // Enriquecer error con contexto
      error.operationName = operationName;
      error.duration = Date.now() - startTime;
      error.requestId = requestId;
      error.retryable = retryable;
      
      // Log error de operación
      logger.error(`Error en operación: ${operationName}`, {
        category: 'OPERATION_ERROR',
        operationName,
        error: error.message,
        stack: error.stack,
        duration: `${error.duration}ms`,
        requestId,
        userId: req.user?.id,
        severity: 'HIGH'
      });

      // ✅ CRÍTICO: Verificar que next sea una función antes de llamarla
      if (typeof next === 'function') {
        next(error);
      } else {
        console.error('❌ ERROR: next no es función en catch handler', {
          operationName,
          nextType: typeof next,
          error: error.message
        });
        
        // Fallback: enviar respuesta de error directamente
        if (!res.headersSent) {
          return res.status(500).json({
            success: false,
            error: {
              type: 'MIDDLEWARE_ERROR',
              code: 'NEXT_FUNCTION_INVALID',
              message: 'Error interno del servidor: middleware mal configurado'
            }
          });
        }
      }
    }
  };
}

/**
 * 🔒 WRAPPER PARA OPERACIONES QUE REQUIEREN PERMISOS
 */
function secureWrapper(fn, requiredPermissions, options = {}) {
  return asyncWrapper(async (req, res, next) => {
    // Verificar permisos antes de ejecutar
    if (!hasPermissions(req.user, requiredPermissions)) {
      const error = new Error('Permisos insuficientes para esta operación');
      error.name = 'AuthorizationError';
      error.statusCode = 403;
      error.requiredPermissions = requiredPermissions;
      error.userPermissions = req.user?.role || 'none';
      
      throw error;
    }

    await fn(req, res, next);
  }, {
    ...options,
    operationName: options.operationName || 'secure_operation'
  });
}

/**
 * 🔄 WRAPPER PARA OPERACIONES CON RETRY AUTOMÁTICO
 */
function retryableWrapper(fn, options = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    retryMultiplier = 2,
    retryableErrors = ['TimeoutError', 'NetworkError', 'DatabaseError']
  } = options;

  return asyncWrapper(async (req, res, next) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await fn(req, res, next);
        return; // Éxito, salir del loop
        
      } catch (error) {
        lastError = error;
        
        // Verificar si el error es retryable
        if (!retryableErrors.includes(error.name) || attempt === maxRetries) {
          throw error; // No retryable o último intento
        }
        
        // Log intento fallido
        logger.warn(`Intento ${attempt} fallido, reintentando...`, {
          category: 'OPERATION_RETRY',
          operationName: options.operationName || 'retryable_operation',
          attempt,
          maxRetries,
          error: error.message,
          nextRetryIn: `${retryDelay * Math.pow(retryMultiplier, attempt - 1)}ms`,
          requestId: req.requestId
        });
        
        // Esperar antes del siguiente intento
        await sleep(retryDelay * Math.pow(retryMultiplier, attempt - 1));
      }
    }
    
    // Si llegamos aquí, todos los intentos fallaron
    throw lastError;
  }, {
    ...options,
    retryable: true
  });
}

/**
 * 📊 WRAPPER PARA OPERACIONES DE VALIDACIÓN
 */
function validationWrapper(schema, options = {}) {
  const { validateBody = true, validateQuery = false, validateParams = false } = options;
  
  return (fn) => asyncWrapper(async (req, res, next) => {
    // Validar body
    if (validateBody && req.body) {
      const bodyValidation = schema.body ? schema.body.validate(req.body) : { error: null };
      if (bodyValidation.error) {
        const error = new ValidationError('Error de validación en body', bodyValidation.error.details);
        error.field = 'body';
        throw error;
      }
    }
    
    // Validar query
    if (validateQuery && req.query) {
      const queryValidation = schema.query ? schema.query.validate(req.query) : { error: null };
      if (queryValidation.error) {
        const error = new ValidationError('Error de validación en query', queryValidation.error.details);
        error.field = 'query';
        throw error;
      }
    }
    
    // Validar params
    if (validateParams && req.params) {
      const paramsValidation = schema.params ? schema.params.validate(req.params) : { error: null };
      if (paramsValidation.error) {
        const error = new ValidationError('Error de validación en params', paramsValidation.error.details);
        error.field = 'params';
        throw error;
      }
    }

    await fn(req, res, next);
  }, {
    ...options,
    operationName: options.operationName || 'validation_operation'
  });
}

/**
 * 🗄️ WRAPPER PARA OPERACIONES DE BASE DE DATOS
 */
function databaseWrapper(fn, options = {}) {
  return asyncWrapper(async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      // Transformar errores específicos de base de datos
      if (error.code === 11000) { // MongoDB duplicate key
        const duplicateError = new Error('Recurso duplicado');
        duplicateError.name = 'ConflictError';
        duplicateError.statusCode = 409;
        duplicateError.originalError = error;
        throw duplicateError;
      }
      
      if (error.name === 'CastError') {
        const castError = new Error('ID inválido');
        castError.name = 'ValidationError';
        castError.statusCode = 400;
        castError.originalError = error;
        throw castError;
      }
      
      // Re-throw error original si no es específico
      throw error;
    }
  }, {
    ...options,
    operationName: options.operationName || 'database_operation',
    retryable: true
  });
}

/**
 * 🌐 WRAPPER PARA SERVICIOS EXTERNOS
 */
function externalServiceWrapper(serviceName, fn, options = {}) {
  return retryableWrapper(async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      // Enriquecer error con información del servicio
      error.serviceName = serviceName;
      error.serviceError = true;
      
      // Categorizar errores de servicio externo
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        error.name = 'NetworkError';
        error.statusCode = 503;
      } else if (error.name === 'TimeoutError') {
        error.statusCode = 504;
      }
      
      throw error;
    }
  }, {
    ...options,
    operationName: options.operationName || `${serviceName}_operation`,
    maxRetries: options.maxRetries || 2,
    retryableErrors: ['TimeoutError', 'NetworkError', 'TwilioError']
  });
}

// CLASES DE ERROR PERSONALIZADAS

class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
    this.isJoi = true; // Para compatibilidad con sistema existente
  }
}

class AuthorizationError extends Error {
  constructor(message, requiredPermissions = []) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
    this.requiredPermissions = requiredPermissions;
  }
}

class ExternalServiceError extends Error {
  constructor(message, serviceName, originalError = null) {
    super(message);
    this.name = 'ExternalServiceError';
    this.statusCode = 502;
    this.serviceName = serviceName;
    this.originalError = originalError;
  }
}

// UTILITIES

function sanitizeForLogging(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sensitiveFields = ['password', 'token', 'authorization', 'secret', 'key'];
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[FILTERED]';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

function hasPermissions(user, requiredPermissions) {
  if (!user || !requiredPermissions.length) return false;
  
  // Implementar lógica de permisos según tu sistema
  const userRole = user.role;
  const rolePermissions = {
    'admin': ['read', 'write', 'delete', 'manage'],
    'agent': ['read', 'write'],
    'viewer': ['read'],
    'user': ['read']
  };
  
  const userPermissions = rolePermissions[userRole] || [];
  return requiredPermissions.every(permission => userPermissions.includes(permission));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// DECORATOR PARA CLASES COMPLETAS
function errorHandlerClass(target) {
  const methodNames = Object.getOwnPropertyNames(target.prototype)
    .filter(name => name !== 'constructor' && typeof target.prototype[name] === 'function');
  
  methodNames.forEach(methodName => {
    const originalMethod = target.prototype[methodName];
    
    target.prototype[methodName] = asyncWrapper(originalMethod, {
      operationName: `${target.name}.${methodName}`,
      logParams: true
    });
  });
  
  return target;
}

module.exports = {
  asyncWrapper,
  secureWrapper,
  retryableWrapper,
  validationWrapper,
  databaseWrapper,
  externalServiceWrapper,
  errorHandlerClass,
  ValidationError,
  AuthorizationError,
  ExternalServiceError,
  sanitizeForLogging,
  hasPermissions
}; 