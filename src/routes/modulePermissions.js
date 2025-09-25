/**
 * 🎯 RUTAS DE PERMISOS DE MÓDULOS
 * 
 * Endpoints para gestionar permisos de visualización por módulo.
 * Permite configurar qué módulos puede ver cada usuario.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const express = require('express');
const router = express.Router();
const ModulePermissionsController = require('../controllers/ModulePermissionsController');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const Joi = require('joi');

// 🛡️ VALIDADORES PARA PERMISOS DE MÓDULOS
const modulePermissionsValidators = {
  // Validar email de usuario
  validateUserEmail: validateRequest({
    params: Joi.object({
      email: Joi.string().email({ minDomainSegments: 2 }).max(254).required().messages({
        'string.email': 'Debe ser un email válido',
        'any.required': 'Email es requerido'
      })
    })
  }),

  // Validar rol
  validateRole: validateRequest({
    params: Joi.object({
      role: Joi.string().valid('admin', 'agent', 'viewer', 'supervisor').required().messages({
        'any.only': 'Rol debe ser admin, agent, viewer o supervisor',
        'any.required': 'Rol es requerido'
      })
    })
  }),

  // Validar actualización de permisos
  validateUpdatePermissions: validateRequest({
    body: Joi.object({
      permissions: Joi.object({
        modules: Joi.object().pattern(
          Joi.string(),
          Joi.object({
            read: Joi.boolean().required(),
            write: Joi.boolean().required(),
            configure: Joi.boolean().required()
          })
        ).required()
      }).required()
    })
  })
};

/**
 * @route GET /api/module-permissions/modules
 * @desc Obtener lista de módulos disponibles
 * @access Private (todos los usuarios autenticados)
 */
router.get('/modules',
  authMiddleware,
  ModulePermissionsController.getAvailableModules
);

/**
 * @route GET /api/module-permissions/my-permissions
 * @desc Obtener permisos de módulos del usuario autenticado
 * @access Private (todos los usuarios autenticados)
 */
router.get('/my-permissions',
  authMiddleware,
  ModulePermissionsController.getMyModulePermissions
);

/**
 * @route GET /api/module-permissions/user/:email
 * @desc Obtener permisos de módulos de un usuario específico
 * @access Private (admin o propio usuario)
 */
router.get('/user/:email',
  authMiddleware,
  modulePermissionsValidators.validateUserEmail,
  ModulePermissionsController.getUserModulePermissions
);

/**
 * @route PUT /api/module-permissions/user/:email
 * @desc Actualizar permisos de módulos de un usuario
 * @access Private (solo admin)
 */
router.put('/user/:email',
  authMiddleware,
  requireAdmin,
  modulePermissionsValidators.validateUserEmail,
  modulePermissionsValidators.validateUpdatePermissions,
  ModulePermissionsController.updateUserModulePermissions
);

/**
 * @route POST /api/module-permissions/user/:email/reset
 * @desc Resetear permisos de módulos a valores por defecto del rol
 * @access Private (solo admin)
 */
router.post('/user/:email/reset',
  authMiddleware,
  requireAdmin,
  modulePermissionsValidators.validateUserEmail,
  ModulePermissionsController.resetUserModulePermissions
);

/**
 * @route GET /api/module-permissions/role/:role
 * @desc Obtener permisos por defecto de un rol específico
 * @access Private (solo admin)
 */
router.get('/role/:role',
  authMiddleware,
  requireAdmin,
  modulePermissionsValidators.validateRole,
  ModulePermissionsController.getRoleDefaultPermissions
);

/**
 * @route GET /api/module-permissions/users-summary
 * @desc Obtener resumen de permisos de módulos de todos los usuarios
 * @access Private (solo admin)
 */
router.get('/users-summary',
  authMiddleware,
  requireAdmin,
  ModulePermissionsController.getUsersPermissionsSummary
);

/**
 * @route GET /api/module-permissions/validate/:email/:moduleId/:action
 * @desc Validar acceso específico de un usuario a un módulo
 * @access Private (admin o propio usuario)
 */
router.get('/validate/:email/:moduleId/:action',
  authMiddleware,
  validateRequest({
    params: Joi.object({
      email: Joi.string().email({ minDomainSegments: 2 }).max(254).required(),
      moduleId: Joi.string().min(1).max(100).required(),
      action: Joi.string().valid('read', 'write', 'configure').required()
    })
  }),
  ModulePermissionsController.validateModuleAccess
);

/**
 * @route GET /api/module-permissions/stats
 * @desc Obtener estadísticas de permisos de módulos
 * @access Private (solo admin)
 */
router.get('/stats',
  authMiddleware,
  requireAdmin,
  ModulePermissionsController.getModulePermissionsStats
);

module.exports = router;
