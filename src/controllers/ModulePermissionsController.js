/**
 * 🎯 CONTROLADOR DE PERMISOS DE MÓDULOS
 * 
 * Maneja la gestión de permisos de visualización por módulo.
 * Permite configurar qué módulos puede ver cada usuario.
 * 
 * @version 2.0.0 - COMPATIBLE CON SISTEMA ACTUAL
 * @author Backend Team
 */

const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
const logger = require('../utils/logger');
const User = require('../models/User');
const { firestore, FieldValue } = require('../config/firebase');
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
      
      // Formatear módulos según especificación del frontend
      const formattedModules = {};
      Object.entries(modules).forEach(([moduleId, moduleInfo]) => {
        formattedModules[moduleId] = {
          id: moduleInfo.id,
          name: moduleInfo.name,
          description: moduleInfo.description,
          level: moduleInfo.level || 'basic'
        };
      });
      
      logger.info('✅ Módulos disponibles obtenidos', {
        userEmail: req.user?.email,
        modulesCount: Object.keys(formattedModules).length
      });

      return ResponseHandler.success(res, {
        modules: formattedModules
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

      // Solo admins pueden ver permisos de otros usuarios
      if (req.user.role !== 'admin' && req.user.email !== email) {
        return ResponseHandler.authorizationError(res, 'Solo puedes ver tus propios permisos');
      }

      // Validar que el usuario existe
      const user = await User.getByEmail(email);
      if (!user) {
        return ResponseHandler.notFoundError(res, `Usuario ${email} no encontrado`);
      }

      // Obtener permisos del usuario
      let userPermissions = user.permissions || {};
      let accessibleModules = getAccessibleModules(userPermissions);

      // Fallback: si por alguna razón el usuario no tiene permisos cargados,
      // asignar permisos por defecto del rol
      if (!accessibleModules || accessibleModules.length === 0) {
        const defaultPerms = getDefaultPermissionsForRole(user.role || 'viewer');
        userPermissions = defaultPerms;
        accessibleModules = getAccessibleModules(defaultPerms);
      }

      // Formatear módulos accesibles según especificación del frontend
      const formattedAccessibleModules = accessibleModules.map(module => ({
        id: module.id,
        name: module.name,
        description: module.description,
        level: module.level || 'basic'
      }));
      
      logger.info('✅ Permisos de usuario obtenidos', {
        targetUser: email,
        requestedBy: req.user.email,
        accessibleModulesCount: formattedAccessibleModules.length
      });

      return ResponseHandler.success(res, {
        user: {
          email: user.email,
          name: user.name,
          role: user.role
        },
        permissions: {
          email: user.email,
          role: user.role,
          accessibleModules: formattedAccessibleModules,
          permissions: {
            modules: userPermissions.modules || {}
          }
        }
      }, 'Permisos de usuario obtenidos exitosamente');
    } catch (error) {
      logger.error('❌ Error obteniendo permisos de usuario', {
        targetUser: req.params?.email,
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
      // Obtener usuario completo desde Firestore
      const user = await User.getByEmail(req.user.email);
      if (!user) {
        return ResponseHandler.notFoundError(res, 'Usuario no encontrado');
      }

      // Obtener permisos del usuario (nuevo formato de módulos)
      let userPermissions = user.permissions || {};
      let accessibleModules = getAccessibleModules(userPermissions);

      // Fallback: si por alguna razón el usuario no tiene permisos cargados,
      // asignar permisos por defecto del rol para evitar que el frontend falle
      if (!accessibleModules || accessibleModules.length === 0) {
        const defaultPerms = getDefaultPermissionsForRole(req.user.role || 'viewer');
        userPermissions = defaultPerms;
        accessibleModules = getAccessibleModules(defaultPerms);
      }

      // Formatear módulos accesibles según especificación del frontend
      const formattedAccessibleModules = accessibleModules.map(module => ({
        id: module.id,
        name: module.name,
        description: module.description,
        level: module.level || 'basic'
      }));
      
      logger.info('✅ Mis permisos de módulos obtenidos', {
        userEmail: req.user.email,
        accessibleModulesCount: formattedAccessibleModules.length
      });

      return ResponseHandler.success(res, {
        permissions: {
          email: req.user.email,
          role: req.user.role,
          accessibleModules: formattedAccessibleModules,
          permissions: {
            modules: userPermissions.modules || {}
          }
        }
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

      // Actualizar permisos del usuario en Firestore
      const userQuery = await firestore
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (userQuery.empty) {
        return ResponseHandler.notFoundError(res, `Usuario ${email} no encontrado en Firestore`);
      }

      const userDoc = userQuery.docs[0];
      await userDoc.ref.update({
        permissions: permissions,
        updatedAt: FieldValue.serverTimestamp()
      });
      
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

      // Actualizar permisos del usuario en Firestore
      const userQuery = await firestore
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (userQuery.empty) {
        return ResponseHandler.notFoundError(res, `Usuario ${email} no encontrado en Firestore`);
      }

      const userDoc = userQuery.docs[0];
      await userDoc.ref.update({
        permissions: defaultPermissions,
        updatedAt: FieldValue.serverTimestamp()
      });
      
      logger.info('✅ Permisos de módulos reseteados', {
        targetUser: email,
        updatedBy: req.user.email,
        role: user.role,
        modulesCount: Object.keys(defaultPermissions.modules || {}).length
      });

      return ResponseHandler.updated(res, {
        user: {
          email: user.email,
          name: user.name,
          role: user.role
        },
        permissions: defaultPermissions
      }, 'Permisos de módulos reseteados exitosamente');
    } catch (error) {
      logger.error('❌ Error reseteando permisos de módulos', {
        targetUser: req.params?.email,
        updatedBy: req.user?.email,
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

      // Solo admins pueden consultar permisos por defecto
      if (req.user.role !== 'admin') {
        return ResponseHandler.authorizationError(res, 'Solo los administradores pueden consultar permisos por defecto');
      }

      // Obtener permisos por defecto del rol
      const defaultPermissions = getDefaultPermissionsForRole(role);
      
      logger.info('✅ Permisos por defecto del rol obtenidos', {
        role,
        requestedBy: req.user.email,
        modulesCount: Object.keys(defaultPermissions.modules || {}).length
      });

      return ResponseHandler.success(res, {
        role,
        permissions: defaultPermissions
      }, 'Permisos por defecto del rol obtenidos exitosamente');
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
      const usersQuery = await firestore
        .collection('users')
        .where('isActive', '==', true)
        .get();
      
      const summary = [];
      usersQuery.forEach(doc => {
        const userData = doc.data();
        const userPermissions = userData.permissions || {};
        const accessibleModules = getAccessibleModules(userPermissions);
        
        summary.push({
          email: userData.email,
          name: userData.name,
          role: userData.role,
          accessibleModulesCount: accessibleModules.length,
          accessibleModules: accessibleModules.map(m => m.id)
        });
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