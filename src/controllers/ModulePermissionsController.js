/**
 * 🎯 CONTROLADOR DE PERMISOS DE MÓDULOS
 * 
 * Maneja la gestión de permisos de visualización por módulo.
 * Permite configurar qué módulos puede ver cada usuario.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
const logger = require('../utils/logger');
const User = require('../models/User');
const { 
  getAvailableModules, 
  getDefaultPermissionsForRole, 
  getAccessibleModules,
  validateModulePermissions,
  getModulePermissionsStats,
  validateSpecificAccess
} = require('../config/modulePermissions');

class ModulePermissionsController {
  /**
   * GET /api/module-permissions/modules
   * Obtener lista de módulos disponibles
   */
  static async getAvailableModules(req, res, next) {
    try {
      const modules = getAvailableModules();
      
      logger.info('✅ Módulos disponibles obtenidos', {
        userEmail: req.user?.email,
        modulesCount: Object.keys(modules).length
      });

      return ResponseHandler.success(res, {
        modules,
        total: Object.keys(modules).length
      }, 'Módulos disponibles obtenidos exitosamente');
    } catch (error) {
      logger.error('❌ Error obteniendo módulos disponibles', {
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * GET /api/module-permissions/user/:email
   * Obtener permisos de módulos de un usuario específico
   */
  static async getUserModulePermissions(req, res, next) {
    try {
      const { email } = req.params;
      
      // Verificar que el usuario solicitante es admin o está consultando sus propios permisos
      if (req.user.role !== 'admin' && req.user.email !== email) {
        return ResponseHandler.authorizationError(res, 'Solo puedes consultar tus propios permisos');
      }

      const user = await User.getByEmail(email);
      if (!user) {
        return ResponseHandler.notFoundError(res, `Usuario ${email} no encontrado`);
      }

      const userPermissions = user.permissions || {};
      const accessibleModules = getAccessibleModules(userPermissions);
      
      logger.info('✅ Permisos de módulos obtenidos', {
        requestedUser: email,
        requestedBy: req.user.email,
        accessibleModulesCount: accessibleModules.length
      });

      return ResponseHandler.success(res, {
        user: {
          email: user.email,
          name: user.name,
          role: user.role
        },
        permissions: userPermissions,
        accessibleModules,
        totalAccessible: accessibleModules.length
      }, 'Permisos de módulos obtenidos exitosamente');
    } catch (error) {
      logger.error('❌ Error obteniendo permisos de módulos', {
        requestedUser: req.params?.email,
        requestedBy: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * GET /api/module-permissions/my-permissions
   * Obtener permisos de módulos del usuario autenticado
   */
  static async getMyModulePermissions(req, res, next) {
    try {
      let userPermissions = req.user.permissions || {};
      let accessibleModules = getAccessibleModules(userPermissions);

      // Fallback: si por alguna razón el usuario no tiene permisos cargados,
      // asignar permisos por defecto del rol para evitar que el frontend falle
      if (!accessibleModules || accessibleModules.length === 0) {
        const defaultPerms = getDefaultPermissionsForRole(req.user.role || 'viewer');
        userPermissions = defaultPerms;
        accessibleModules = getAccessibleModules(defaultPerms);
      }
      
      logger.info('✅ Mis permisos de módulos obtenidos', {
        userEmail: req.user.email,
        accessibleModulesCount: accessibleModules.length
      });

      return ResponseHandler.success(res, {
        permissions: userPermissions,
        accessibleModules,
        totalAccessible: accessibleModules.length
      }, 'Mis permisos de módulos obtenidos exitosamente');
    } catch (error) {
      logger.error('❌ Error obteniendo mis permisos de módulos', {
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * PUT /api/module-permissions/user/:email
   * Actualizar permisos de módulos de un usuario
   */
  static async updateUserModulePermissions(req, res, next) {
    try {
      const { email } = req.params;
      const { permissions } = req.body;

      // Solo admins pueden actualizar permisos
      if (req.user.role !== 'admin') {
        return ResponseHandler.authorizationError(res, 'Solo los administradores pueden actualizar permisos de módulos');
      }

      // Validar que el usuario existe
      const user = await User.getByEmail(email);
      if (!user) {
        return ResponseHandler.notFoundError(res, `Usuario ${email} no encontrado`);
      }

      // Validar estructura de permisos
      const validation = validateModulePermissions(permissions);
      if (!validation.valid) {
        return ResponseHandler.validationError(res, validation.error);
      }

      // Actualizar permisos del usuario
      const updates = {
        permissions: permissions,
        updatedAt: new Date()
      };

      await user.update(updates);
      
      logger.info('✅ Permisos de módulos actualizados', {
        targetUser: email,
        updatedBy: req.user.email,
        modulesCount: Object.keys(permissions.modules || {}).length
      });

      return ResponseHandler.updated(res, {
        user: {
          email: user.email,
          name: user.name,
          role: user.role
        },
        permissions: permissions
      }, 'Permisos de módulos actualizados exitosamente');
    } catch (error) {
      logger.error('❌ Error actualizando permisos de módulos', {
        targetUser: req.params?.email,
        updatedBy: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * POST /api/module-permissions/user/:email/reset
   * Resetear permisos de módulos a los valores por defecto del rol
   */
  static async resetUserModulePermissions(req, res, next) {
    try {
      const { email } = req.params;

      // Solo admins pueden resetear permisos
      if (req.user.role !== 'admin') {
        return ResponseHandler.authorizationError(res, 'Solo los administradores pueden resetear permisos de módulos');
      }

      // Validar que el usuario existe
      const user = await User.getByEmail(email);
      if (!user) {
        return ResponseHandler.notFoundError(res, `Usuario ${email} no encontrado`);
      }

      // Obtener permisos por defecto del rol
      const defaultPermissions = getDefaultPermissionsForRole(user.role);

      // Actualizar permisos del usuario
      const updates = {
        permissions: defaultPermissions,
        updatedAt: new Date()
      };

      await user.update(updates);
      
      logger.info('✅ Permisos de módulos reseteados', {
        targetUser: email,
        resetBy: req.user.email,
        role: user.role
      });

      return ResponseHandler.success(res, {
        user: {
          email: user.email,
          name: user.name,
          role: user.role
        },
        permissions: defaultPermissions,
        message: `Permisos reseteados a configuración por defecto del rol '${user.role}'`
      }, 'Permisos de módulos reseteados exitosamente');
    } catch (error) {
      logger.error('❌ Error reseteando permisos de módulos', {
        targetUser: req.params?.email,
        resetBy: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * GET /api/module-permissions/role/:role
   * Obtener permisos por defecto de un rol específico
   */
  static async getRoleDefaultPermissions(req, res, next) {
    try {
      const { role } = req.params;
      
      // Solo admins pueden consultar permisos de roles
      if (req.user.role !== 'admin') {
        return ResponseHandler.authorizationError(res, 'Solo los administradores pueden consultar permisos de roles');
      }

      const defaultPermissions = getDefaultPermissionsForRole(role);
      const accessibleModules = getAccessibleModules(defaultPermissions);
      
      logger.info('✅ Permisos por defecto del rol obtenidos', {
        role,
        requestedBy: req.user.email,
        accessibleModulesCount: accessibleModules.length
      });

      return ResponseHandler.success(res, {
        role,
        permissions: defaultPermissions,
        accessibleModules,
        totalAccessible: accessibleModules.length
      }, `Permisos por defecto del rol '${role}' obtenidos exitosamente`);
    } catch (error) {
      logger.error('❌ Error obteniendo permisos por defecto del rol', {
        role: req.params?.role,
        requestedBy: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * GET /api/module-permissions/users-summary
   * Obtener resumen de permisos de módulos de todos los usuarios
   */
  static async getUsersPermissionsSummary(req, res, next) {
    try {
      // Solo admins pueden consultar resumen de permisos
      if (req.user.role !== 'admin') {
        return ResponseHandler.authorizationError(res, 'Solo los administradores pueden consultar resumen de permisos');
      }

      // Obtener todos los usuarios activos
      const users = await User.getAllActive();
      
      const summary = users.map(user => {
        const userPermissions = user.permissions || {};
        const accessibleModules = getAccessibleModules(userPermissions);
        
        return {
          email: user.email,
          name: user.name,
          role: user.role,
          accessibleModulesCount: accessibleModules.length,
          accessibleModules: accessibleModules.map(m => m.id)
        };
      });

      logger.info('✅ Resumen de permisos de usuarios obtenido', {
        category: 'MODULE_PERMISSIONS_SUMMARY',
        requestedBy: req.user.email,
        usersCount: summary.length
      });

      return ResponseHandler.success(res, {
        summary,
        total: summary.length
      }, 'Resumen de permisos de usuarios obtenido exitosamente');
    } catch (error) {
      logger.error('❌ Error obteniendo resumen de permisos de usuarios', {
        category: 'MODULE_PERMISSIONS_SUMMARY_ERROR',
        requestedBy: req.user?.email,
        error: error.message,
        stack: error.stack
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * GET /api/module-permissions/validate/:email/:moduleId/:action
   * Validar acceso específico de un usuario a un módulo
   */
  static async validateModuleAccess(req, res, next) {
    try {
      const { email, moduleId, action } = req.params;

      logger.info('🔍 Iniciando validación de acceso a módulo', {
        category: 'MODULE_ACCESS_VALIDATION_REQUEST',
        targetUser: email,
        requestedBy: req.user.email,
        moduleId,
        action
      });

      // Verificar que el usuario solicitante es admin o está consultando sus propios permisos
      if (req.user.role !== 'admin' && req.user.email !== email) {
        logger.warn('⚠️ Intento de validación no autorizada', {
          category: 'MODULE_ACCESS_VALIDATION_UNAUTHORIZED',
          targetUser: email,
          requestedBy: req.user.email,
          moduleId,
          action
        });
        return ResponseHandler.authorizationError(res, 'Solo puedes validar tus propios permisos');
      }

      const user = await User.getByEmail(email);
      if (!user) {
        logger.warn('⚠️ Usuario no encontrado para validación', {
          category: 'MODULE_ACCESS_VALIDATION_USER_NOT_FOUND',
          targetUser: email,
          requestedBy: req.user.email,
          moduleId,
          action
        });
        return ResponseHandler.notFoundError(res, `Usuario ${email} no encontrado`);
      }

      const userPermissions = user.permissions || {};
      const validation = validateSpecificAccess(email, moduleId, action, userPermissions);

      return ResponseHandler.success(res, {
        hasAccess: validation.hasAccess,
        user: {
          email: user.email,
          name: user.name,
          role: user.role
        },
        module: {
          id: moduleId,
          action: action
        },
        validation: validation
      }, validation.hasAccess ? 'Acceso validado correctamente' : 'Acceso denegado al módulo');
    } catch (error) {
      logger.error('💥 Error validando acceso a módulo', {
        category: 'MODULE_ACCESS_VALIDATION_ERROR',
        targetUser: req.params?.email,
        requestedBy: req.user?.email,
        moduleId: req.params?.moduleId,
        action: req.params?.action,
        error: error.message,
        stack: error.stack
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * GET /api/module-permissions/stats
   * Obtener estadísticas de permisos de módulos
   */
  static async getModulePermissionsStats(req, res, next) {
    try {
      // Solo admins pueden consultar estadísticas
      if (req.user.role !== 'admin') {
        return ResponseHandler.authorizationError(res, 'Solo los administradores pueden consultar estadísticas de permisos');
      }

      logger.info('📊 Generando estadísticas de permisos de módulos', {
        category: 'MODULE_PERMISSIONS_STATS_REQUEST',
        requestedBy: req.user.email
      });

      // Obtener todos los usuarios activos para estadísticas
      const users = await User.getAllActive();
      const stats = getModulePermissionsStats(users);

      // Estadísticas adicionales de usuarios
      const userStats = {
        totalUsers: users.length,
        usersByRole: {},
        activeUsers: users.filter(u => u.isActive).length,
        inactiveUsers: users.filter(u => !u.isActive).length
      };

      users.forEach(user => {
        userStats.usersByRole[user.role] = (userStats.usersByRole[user.role] || 0) + 1;
      });

      // Módulos más utilizados
      const moduleUsage = {};
      users.forEach(user => {
        const userPermissions = user.permissions || {};
        const accessibleModules = getAccessibleModules(userPermissions);
        accessibleModules.forEach(module => {
          moduleUsage[module.id] = (moduleUsage[module.id] || 0) + 1;
        });
      });

      const mostUsedModules = Object.entries(moduleUsage)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([moduleId, count]) => ({ moduleId, count }));

      const fullStats = {
        ...stats,
        users: userStats,
        mostUsedModules
      };

      logger.info('✅ Estadísticas de permisos generadas', {
        category: 'MODULE_PERMISSIONS_STATS_SUCCESS',
        requestedBy: req.user.email,
        totalModules: stats.totalModules,
        totalUsers: userStats.totalUsers
      });

      return ResponseHandler.success(res, fullStats, 'Estadísticas de permisos obtenidas exitosamente');
    } catch (error) {
      logger.error('💥 Error generando estadísticas de permisos', {
        category: 'MODULE_PERMISSIONS_STATS_ERROR',
        requestedBy: req.user?.email,
        error: error.message,
        stack: error.stack
      });
      return ResponseHandler.error(res, error);
    }
  }
}

module.exports = ModulePermissionsController;
