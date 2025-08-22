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
  validateModulePermissions 
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
      const userPermissions = req.user.permissions || {};
      const accessibleModules = getAccessibleModules(userPermissions);
      
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
        requestedBy: req.user.email,
        usersCount: summary.length
      });

      return ResponseHandler.success(res, {
        summary,
        total: summary.length
      }, 'Resumen de permisos de usuarios obtenido exitosamente');
    } catch (error) {
      logger.error('❌ Error obteniendo resumen de permisos de usuarios', {
        requestedBy: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }
}

module.exports = ModulePermissionsController;
