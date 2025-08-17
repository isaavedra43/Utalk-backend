/**
 * 🛡️ WRAPPER DE MANEJO DE ERRORES
 * 
 * Proporciona funciones para manejar errores de manera consistente
 * en todos los servicios del backend.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const logger = require('./logger');

class ErrorWrapper {
  /**
   * 🔄 WRAPPER PARA FUNCIONES ASÍNCRONAS
   */
  static async wrapAsync(fn, context = 'unknown') {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        logger.error(`❌ Error en ${context}`, {
          category: 'ERROR_WRAPPER',
          context,
          error: error.message,
          stack: error.stack?.split('\n').slice(0, 3),
          args: args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
              return Object.keys(arg).length > 0 ? '[Object]' : '[Empty Object]';
            }
            return typeof arg;
          })
        });
        throw error;
      }
    };
  }

  /**
   * 🔄 WRAPPER PARA FUNCIONES SINCRONAS
   */
  static wrapSync(fn, context = 'unknown') {
    return (...args) => {
      try {
        return fn(...args);
      } catch (error) {
        logger.error(`❌ Error en ${context}`, {
          category: 'ERROR_WRAPPER',
          context,
          error: error.message,
          stack: error.stack?.split('\n').slice(0, 3),
          args: args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
              return Object.keys(arg).length > 0 ? '[Object]' : '[Empty Object]';
            }
            return typeof arg;
          })
        });
        throw error;
      }
    };
  }

  /**
   * 🎯 MANEJAR ERRORES CON FALLBACK
   */
  static async withFallback(fn, fallbackValue, context = 'unknown') {
    try {
      return await fn();
    } catch (error) {
      logger.warn(`⚠️ Error en ${context}, usando fallback`, {
        category: 'ERROR_FALLBACK',
        context,
        error: error.message,
        fallbackValue: typeof fallbackValue
      });
      return fallbackValue;
    }
  }

  /**
   * 🔄 MANEJAR ERRORES CON REINTENTOS
   */
  static async withRetry(fn, maxRetries = 3, delay = 1000, context = 'unknown') {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        logger.warn(`⚠️ Intento ${attempt}/${maxRetries} falló en ${context}`, {
          category: 'ERROR_RETRY',
          context,
          attempt,
          maxRetries,
          error: error.message
        });

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }

    logger.error(`❌ Todos los intentos fallaron en ${context}`, {
      category: 'ERROR_RETRY_FAILED',
      context,
      maxRetries,
      finalError: lastError.message
    });

    throw lastError;
  }

  /**
   * 🛡️ VALIDAR DATOS CON MANEJO DE ERRORES
   */
  static validateData(data, schema, context = 'unknown') {
    try {
      if (!data) {
        throw new Error('Datos requeridos no proporcionados');
      }

      if (schema && typeof schema === 'function') {
        return schema(data);
      }

      return data;
    } catch (error) {
      logger.error(`❌ Error de validación en ${context}`, {
        category: 'VALIDATION_ERROR',
        context,
        error: error.message,
        dataType: typeof data,
        hasData: !!data
      });
      throw error;
    }
  }

  /**
   * 🔍 MANEJAR ERRORES DE RECURSOS NO ENCONTRADOS
   */
  static handleNotFound(resource, context = 'unknown') {
    if (!resource) {
      const error = new Error(`${context} no encontrado`);
      error.code = 'NOT_FOUND';
      error.status = 404;
      
      logger.warn(`🔍 ${context} no encontrado`, {
        category: 'NOT_FOUND',
        context
      });
      
      throw error;
    }
    return resource;
  }

  /**
   * 🔐 MANEJAR ERRORES DE AUTORIZACIÓN
   */
  static handleAuthorization(user, requiredRole, context = 'unknown') {
    if (!user) {
      const error = new Error('Usuario no autenticado');
      error.code = 'UNAUTHORIZED';
      error.status = 401;
      throw error;
    }

    if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
      const error = new Error(`Acceso denegado. Se requiere rol: ${requiredRole}`);
      error.code = 'FORBIDDEN';
      error.status = 403;
      
      logger.warn(`🚫 Acceso denegado en ${context}`, {
        category: 'AUTHORIZATION_ERROR',
        context,
        userRole: user.role,
        requiredRole,
        userEmail: user.email
      });
      
      throw error;
    }

    return true;
  }

  /**
   * 📊 MANEJAR ERRORES DE BASE DE DATOS
   */
  static handleDatabaseError(error, context = 'unknown') {
    logger.error(`🗄️ Error de base de datos en ${context}`, {
      category: 'DATABASE_ERROR',
      context,
      error: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 3)
    });

    // Crear error estructurado
    const dbError = new Error(`Error de base de datos: ${error.message}`);
    dbError.code = 'DATABASE_ERROR';
    dbError.status = 500;
    dbError.originalError = error;

    throw dbError;
  }

  /**
   * 🌐 MANEJAR ERRORES DE RED
   */
  static handleNetworkError(error, context = 'unknown') {
    logger.error(`🌐 Error de red en ${context}`, {
      category: 'NETWORK_ERROR',
      context,
      error: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 3)
    });

    // Crear error estructurado
    const networkError = new Error(`Error de conectividad: ${error.message}`);
    networkError.code = 'NETWORK_ERROR';
    networkError.status = 503;
    networkError.originalError = error;

    throw networkError;
  }

  /**
   * 💾 MANEJAR ERRORES DE ARCHIVOS
   */
  static handleFileError(error, context = 'unknown') {
    logger.error(`💾 Error de archivo en ${context}`, {
      category: 'FILE_ERROR',
      context,
      error: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 3)
    });

    // Crear error estructurado
    const fileError = new Error(`Error de archivo: ${error.message}`);
    fileError.code = 'FILE_ERROR';
    fileError.status = 422;
    fileError.originalError = error;

    throw fileError;
  }

  /**
   * 🎯 CREAR ERROR ESTRUCTURADO
   */
  static createError(message, code = 'INTERNAL_ERROR', status = 500, details = null) {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    if (details) {
      error.details = details;
    }
    return error;
  }

  /**
   * 📝 LOGGING DE ERRORES CON CONTEXTO
   */
  static logError(error, context = 'unknown', additionalData = {}) {
    const errorInfo = {
      category: 'ERROR_LOGGING',
      context,
      error: {
        message: error.message,
        code: error.code,
        status: error.status,
        name: error.name
      },
      timestamp: new Date().toISOString(),
      ...additionalData
    };

    if (error.stack) {
      errorInfo.error.stack = error.stack.split('\n').slice(0, 5);
    }

    logger.error(`❌ Error en ${context}`, errorInfo);
  }

  /**
   * 🔄 MANEJAR PROMESAS CON TIMEOUT
   */
  static async withTimeout(promise, timeoutMs = 30000, context = 'unknown') {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout después de ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } catch (error) {
      if (error.message.includes('Timeout')) {
        logger.error(`⏰ Timeout en ${context}`, {
          category: 'TIMEOUT_ERROR',
          context,
          timeoutMs
        });
      }
      throw error;
    }
  }
}

module.exports = ErrorWrapper; 