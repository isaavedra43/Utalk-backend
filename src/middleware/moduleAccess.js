/**
 * 🎯 MIDDLEWARE DE ACCESO A MÓDULOS
 * 
 * Verifica que el usuario tenga permisos para acceder a módulos específicos.
 * Integra con el sistema de permisos existente.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const logger = require('../utils/logger');
const { hasModuleAccess, getAvailableModules } = require('../config/modulePermissions');

/**
 * Middleware para verificar acceso a un módulo específico
 * @param {string} moduleId - ID del módulo a verificar
 * @param {string} action - Acción requerida (read, write, configure)
 */
const requireModuleAccess = (moduleId, action = 'read') => {
  return (req, res, next) => {
    if (!req.user) {
      logger.warn('🚫 Intento de acceso a módulo sin autenticación', {
        category: 'MODULE_ACCESS_NO_AUTH',
        moduleId,
        action,
        ip: req.ip,
        url: req.originalUrl
      });
      
      return res.status(401).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'NOT_AUTHENTICATED',
          message: 'Usuario no autenticado',
          details: {
            moduleId,
            action
          },
          timestamp: new Date().toISOString()
        }
      });
    }

    // Verificar si el módulo existe
    const availableModules = getAvailableModules();
    if (!availableModules[moduleId]) {
      logger.warn('🚫 Módulo no encontrado', {
        category: 'MODULE_ACCESS_NOT_FOUND',
        moduleId,
        action,
        userEmail: req.user.email,
        ip: req.ip,
        url: req.originalUrl
      });
      
      return res.status(404).json({
        success: false,
        error: {
          type: 'NOT_FOUND_ERROR',
          code: 'MODULE_NOT_FOUND',
          message: `Módulo '${moduleId}' no encontrado`,
          details: {
            moduleId,
            action
          },
          timestamp: new Date().toISOString()
        }
      });
    }

    // Verificar permisos del usuario
    const userPermissions = req.user.permissions || {};
    const hasAccess = hasModuleAccess(userPermissions, moduleId, action);

    if (!hasAccess) {
      logger.warn('🚫 Acceso denegado a módulo', {
        category: 'MODULE_ACCESS_DENIED',
        moduleId,
        action,
        userEmail: req.user.email,
        userRole: req.user.role,
        userPermissions: userPermissions,
        ip: req.ip,
        url: req.originalUrl
      });
      
      return res.status(403).json({
        success: false,
        error: {
          type: 'AUTHORIZATION_ERROR',
          code: 'MODULE_ACCESS_DENIED',
          message: `Sin permisos para acceder al módulo '${moduleId}'`,
          details: {
            moduleId,
            action,
            userRole: req.user.role,
            requiredAction: action
          },
          timestamp: new Date().toISOString()
        }
      });
    }

    logger.debug('✅ Acceso autorizado a módulo', {
      category: 'MODULE_ACCESS_GRANTED',
      moduleId,
      action,
      userEmail: req.user.email,
      userRole: req.user.role,
      url: req.originalUrl
    });

    next();
  };
};

/**
 * Middleware para verificar acceso de lectura a un módulo
 */
const requireModuleRead = (moduleId) => requireModuleAccess(moduleId, 'read');

/**
 * Middleware para verificar acceso de escritura a un módulo
 */
const requireModuleWrite = (moduleId) => requireModuleAccess(moduleId, 'write');

/**
 * Middleware para verificar acceso de configuración a un módulo
 */
const requireModuleConfigure = (moduleId) => requireModuleAccess(moduleId, 'configure');

/**
 * Middleware para verificar acceso a múltiples módulos
 * @param {Array} modules - Array de objetos {moduleId, action}
 */
const requireMultipleModuleAccess = (modules) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'NOT_AUTHENTICATED',
          message: 'Usuario no autenticado',
          timestamp: new Date().toISOString()
        }
      });
    }

    const userPermissions = req.user.permissions || {};
    const availableModules = getAvailableModules();

    // Verificar acceso a todos los módulos requeridos
    for (const { moduleId, action = 'read' } of modules) {
      // Verificar si el módulo existe
      if (!availableModules[moduleId]) {
        logger.warn('🚫 Módulo no encontrado en verificación múltiple', {
          category: 'MULTIPLE_MODULE_ACCESS_NOT_FOUND',
          moduleId,
          action,
          userEmail: req.user.email
        });
        
        return res.status(404).json({
          success: false,
          error: {
            type: 'NOT_FOUND_ERROR',
            code: 'MODULE_NOT_FOUND',
            message: `Módulo '${moduleId}' no encontrado`,
            details: { moduleId, action },
            timestamp: new Date().toISOString()
          }
        });
      }

      // Verificar permisos
      const hasAccess = hasModuleAccess(userPermissions, moduleId, action);
      if (!hasAccess) {
        logger.warn('🚫 Acceso denegado en verificación múltiple', {
          category: 'MULTIPLE_MODULE_ACCESS_DENIED',
          moduleId,
          action,
          userEmail: req.user.email,
          userRole: req.user.role
        });
        
        return res.status(403).json({
          success: false,
          error: {
            type: 'AUTHORIZATION_ERROR',
            code: 'MODULE_ACCESS_DENIED',
            message: `Sin permisos para acceder al módulo '${moduleId}'`,
            details: { moduleId, action, userRole: req.user.role },
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    logger.debug('✅ Acceso autorizado a múltiples módulos', {
      category: 'MULTIPLE_MODULE_ACCESS_GRANTED',
      modules,
      userEmail: req.user.email,
      userRole: req.user.role
    });

    next();
  };
};

/**
 * Middleware para verificar acceso a al menos uno de varios módulos
 * @param {Array} modules - Array de objetos {moduleId, action}
 */
const requireAnyModuleAccess = (modules) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'NOT_AUTHENTICATED',
          message: 'Usuario no autenticado',
          timestamp: new Date().toISOString()
        }
      });
    }

    const userPermissions = req.user.permissions || {};
    const availableModules = getAvailableModules();

    // Verificar acceso a al menos un módulo
    for (const { moduleId, action = 'read' } of modules) {
      // Verificar si el módulo existe
      if (!availableModules[moduleId]) {
        continue; // Saltar módulos que no existen
      }

      // Verificar permisos
      const hasAccess = hasModuleAccess(userPermissions, moduleId, action);
      if (hasAccess) {
        logger.debug('✅ Acceso autorizado a al menos un módulo', {
          category: 'ANY_MODULE_ACCESS_GRANTED',
          grantedModule: { moduleId, action },
          userEmail: req.user.email,
          userRole: req.user.role
        });
        
        return next();
      }
    }

    logger.warn('🚫 Acceso denegado a todos los módulos', {
      category: 'ANY_MODULE_ACCESS_DENIED',
      modules,
      userEmail: req.user.email,
      userRole: req.user.role
    });
    
    return res.status(403).json({
      success: false,
      error: {
        type: 'AUTHORIZATION_ERROR',
        code: 'MODULE_ACCESS_DENIED',
        message: 'Sin permisos para acceder a ninguno de los módulos requeridos',
        details: { modules, userRole: req.user.role },
        timestamp: new Date().toISOString()
      }
    });
  };
};

module.exports = {
  requireModuleAccess,
  requireModuleRead,
  requireModuleWrite,
  requireModuleConfigure,
  requireMultipleModuleAccess,
  requireAnyModuleAccess
};
