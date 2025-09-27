const express = require('express');
const router = express.Router();
const TeamController = require('../controllers/TeamController');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { sanitizeProfileData } = require('../middleware/sanitization');
const Joi = require('joi');

// 🛡️ VALIDADORES ESPECÍFICOS PARA TEAM (ESTANDARIZADOS)
const teamValidators = {
  // Validador común para parámetros de ID (acepta email o UUID)
  validateIdParam: validateRequest({
    params: Joi.object({
      id: Joi.alternatives().try(
        Joi.string().uuid(),
        Joi.string().email({ minDomainSegments: 2 })
      ).required().messages({
        'alternatives.types': 'ID debe ser un UUID válido o email válido',
        'any.required': 'ID es requerido'
      })
    })
  }),

  // Validar invitación de nuevo miembro
  validateInvite: [
    validateRequest({
      body: Joi.object({
        email: Joi.string().email({ minDomainSegments: 2 }).max(254).required(),
        name: Joi.string().min(1).max(100).required(),
        role: Joi.string().valid('admin', 'agent', 'viewer').default('viewer')
      })
    }),
    sanitizeProfileData
  ],

  // Validar actualización de miembro
  validateUpdate: [
    validateRequest({
      body: Joi.object({
        name: Joi.string().min(1).max(100).optional(),
        email: Joi.string().email({ minDomainSegments: 2 }).max(254).optional(),
        role: Joi.string().valid('admin', 'agent', 'viewer', 'supervisor').optional(),
        status: Joi.string().valid('active', 'inactive').optional(),
        permissions: Joi.object({
          read: Joi.boolean().optional(),
          write: Joi.boolean().optional(),
          approve: Joi.boolean().optional(),
          configure: Joi.boolean().optional(),
          modules: Joi.object().pattern(
            Joi.string(),
            Joi.object({
              read: Joi.boolean().optional(),
              write: Joi.boolean().optional(),
              configure: Joi.boolean().optional()
            })
          ).optional()
        }).optional()
      })
    }),
    sanitizeProfileData
  ],

  // Validar cambio de rol
  validateChangeRole: validateRequest({
    body: Joi.object({
      newRole: Joi.string().valid('admin', 'agent', 'viewer').required(),
      reason: Joi.string().max(500).optional()
    })
  }),

  // Validar reset de contraseña
  validateResetPassword: validateRequest({
    body: Joi.object({
      confirm: Joi.boolean().valid(true).required()
    })
  }),

  // 🆕 Validar creación de agente COMPLETO
  validateCreateAgent: validateRequest({
    body: Joi.object({
      // Información básica
      name: Joi.string().min(2).max(100).required().messages({
        'string.min': 'El nombre debe tener al menos 2 caracteres',
        'string.max': 'El nombre no puede exceder 100 caracteres',
        'any.required': 'El nombre es requerido'
      }),
      email: Joi.string().email({ minDomainSegments: 2 }).max(254).required().messages({
        'string.email': 'Debe ser un email válido',
        'any.required': 'El email es requerido'
      }),
      role: Joi.string().valid('admin', 'supervisor', 'agent', 'viewer').default('agent'),
      phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().allow(null).messages({
        'string.pattern.base': 'El teléfono debe ser un número válido'
      }),
      password: Joi.string().min(6).max(128).optional().allow('').messages({
        'string.min': 'La contraseña debe tener al menos 6 caracteres',
        'string.max': 'La contraseña no puede exceder 128 caracteres'
      }),
      
      // 🔐 PERMISOS COMPLETOS (básicos + módulos)
      permissions: Joi.object({
        // Permisos básicos
        read: Joi.boolean().default(true),
        write: Joi.boolean().default(true),
        approve: Joi.boolean().default(false),
        configure: Joi.boolean().default(false),
        
        // Permisos por módulo (ESTRUCTURA COMPLETA)
        modules: Joi.object().pattern(
          Joi.string().valid(
            'dashboard', 'contacts', 'campaigns', 'team', 'analytics', 'ai', 'settings', 'hr',
            'clients', 'notifications', 'chat', 'internal-chat', 'phone', 'knowledge-base',
            'supervision', 'copilot', 'providers', 'warehouse', 'shipping', 'services'
          ),
          Joi.object({
            read: Joi.boolean().required(),
            write: Joi.boolean().required(),
            configure: Joi.boolean().required()
          })
        ).optional()
      }).optional(),
      
      // 🔔 CONFIGURACIÓN DE NOTIFICACIONES
      notifications: Joi.object({
        email: Joi.boolean().default(true),
        push: Joi.boolean().default(true),
        sms: Joi.boolean().default(false),
        desktop: Joi.boolean().default(true)
      }).optional(),
      
      // ⚙️ CONFIGURACIÓN PERSONAL
      configuration: Joi.object({
        language: Joi.string().valid('es', 'en', 'fr', 'pt').default('es'),
        timezone: Joi.string().default('America/Mexico_City'),
        theme: Joi.string().valid('light', 'dark', 'auto').default('light'),
        autoLogout: Joi.boolean().default(true),
        twoFactor: Joi.boolean().default(false)
      }).optional()
    })
  }),

  // 🔄 Validar actualización de agente COMPLETO
  validateUpdateAgent: validateRequest({
    body: Joi.object({
      // Información básica
      name: Joi.string().min(2).max(100).optional(),
      email: Joi.string().email({ minDomainSegments: 2 }).max(254).optional(),
      role: Joi.string().valid('admin', 'supervisor', 'agent', 'viewer').optional(),
      phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().allow(null),
      isActive: Joi.boolean().optional(),
      newPassword: Joi.string().min(6).max(128).optional().allow('').messages({
        'string.min': 'La contraseña debe tener al menos 6 caracteres',
        'string.max': 'La contraseña no puede exceder 128 caracteres'
      }),
      
      // Permisos completos (acepta ambas estructuras)
      permissions: Joi.object({
        // Estructura 1: permisos básicos directos (como envía el frontend)
        read: Joi.boolean().optional(),
        write: Joi.boolean().optional(),
        approve: Joi.boolean().optional(),
        configure: Joi.boolean().optional(),
        
        // Estructura 2: permisos básicos anidados
        basic: Joi.object({
          read: Joi.boolean().optional(),
          write: Joi.boolean().optional(),
          approve: Joi.boolean().optional(),
          configure: Joi.boolean().optional()
        }).optional(),
        
        // Módulos (ambas estructuras)
        modules: Joi.object().pattern(
          Joi.string(),
          Joi.object({
            read: Joi.boolean().optional(),
            write: Joi.boolean().optional(),
            configure: Joi.boolean().optional()
          })
        ).optional()
      }).optional(),
      
      // Configuración de notificaciones
      notifications: Joi.object({
        email: Joi.boolean().optional(),
        push: Joi.boolean().optional(),
        sms: Joi.boolean().optional(),
        desktop: Joi.boolean().optional()
      }).optional(),
      
      // Configuración personal
      configuration: Joi.object({
        language: Joi.string().valid('es', 'en', 'fr', 'pt').optional(),
        timezone: Joi.string().optional(),
        theme: Joi.string().valid('light', 'dark', 'auto').optional(),
        autoLogout: Joi.boolean().optional(),
        twoFactor: Joi.boolean().optional()
      }).optional()
    })
  }),

  // 🗑️ Validar eliminación de agente
  validateDeleteAgent: validateRequest({
    body: Joi.object({
      confirm: Joi.boolean().valid(true).required().messages({
        'any.only': 'Se requiere confirmación para eliminar el agente',
        'any.required': 'Confirmación es requerida'
      }),
      reason: Joi.string().max(500).optional().messages({
        'string.max': 'La razón no puede exceder 500 caracteres'
      })
    })
  })
};

/**
 * @route GET /api/team
 * @desc Listar miembros del equipo
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/',
  authMiddleware,
  TeamController.list
);

/**
 * 🆕 @route GET /api/team/agents
 * @desc Listar agentes para módulo frontend (estructura específica)
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/agents',
  authMiddleware,
  TeamController.listAgents
);

/**
 * 🆕 @route POST /api/team/agents
 * @desc Crear nuevo agente para módulo frontend
 * @access Private (Admin)
 */
router.post('/agents',
  authMiddleware,
  requireAdmin,
  teamValidators.validateCreateAgent,
  TeamController.createAgent
);

/**
 * 🆕 @route GET /api/team/agents/:id
 * @desc Obtener agente específico
 * @access Private (Admin, Supervisor)
 */
router.get('/agents/:id',
  authMiddleware,
  teamValidators.validateIdParam,
  TeamController.getAgent
);

/**
 * 🆕 @route PUT /api/team/agents/:id
 * @desc Actualizar agente completo (unificado)
 * @access Private (Admin)
 */
router.put('/agents/:id',
  authMiddleware,
  requireAdmin,
  teamValidators.validateIdParam,
  teamValidators.validateUpdateAgent,
  TeamController.updateAgent
);

/**
 * 📊 @route GET /api/team/agents/stats
 * @desc Obtener estadísticas generales de agentes
 * @access Private (Admin, Supervisor)
 */
router.get('/agents/stats',
  authMiddleware,
  TeamController.getAgentsStats
);

/**
 * 🆕 @route DELETE /api/team/agents/:id
 * @desc Eliminar agente
 * @access Private (Admin)
 */
router.delete('/agents/:id',
  authMiddleware,
  requireAdmin,
  teamValidators.validateIdParam,
  teamValidators.validateDeleteAgent,
  TeamController.deleteAgent
);

/**
 * 📊 @route GET /api/team/agents/:id/performance
 * @desc Obtener rendimiento de agente específico
 * @access Private (Admin, Supervisor)
 */
router.get('/agents/:id/performance',
  authMiddleware,
  teamValidators.validateIdParam,
  TeamController.getAgentPerformance
);

/**
 * 🔐 @route GET /api/team/agents/:id/permissions
 * @desc Obtener permisos de agente específico
 * @access Private (Admin, Supervisor)
 */
router.get('/agents/:id/permissions',
  authMiddleware,
  teamValidators.validateIdParam,
  TeamController.getAgentPermissions
);

/**
 * 🔄 @route PUT /api/team/agents/:id/permissions
 * @desc Actualizar permisos de agente específico
 * @access Private (Admin)
 */
router.put('/agents/:id/permissions',
  authMiddleware,
  requireAdmin,
  teamValidators.validateIdParam,
  TeamController.updateAgentPermissions
);

/**
 * 🔄 @route POST /api/team/agents/:id/permissions/reset
 * @desc Resetear permisos de agente a defaults del rol
 * @access Private (Admin)
 */
router.post('/agents/:id/permissions/reset',
  authMiddleware,
  requireAdmin,
  teamValidators.validateIdParam,
  TeamController.resetAgentPermissions
);

/**
 * @route GET /api/team/:id
 * @desc Obtener miembro por ID
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:id',
  authMiddleware,
  teamValidators.validateIdParam,
  TeamController.getById
);

/**
 * @route POST /api/team/invite
 * @desc Invitar nuevo miembro
 * @access Private (Admin)
 */
router.post('/invite',
  authMiddleware,
  requireAdmin,
  ...teamValidators.validateInvite,
  TeamController.invite
);

/**
 * @route PUT /api/team/:id/role
 * @desc Cambiar rol de miembro
 * @access Private (Admin)
 */
router.put('/:id/role',
  authMiddleware,
  requireAdmin,
  teamValidators.validateIdParam,
  teamValidators.validateChangeRole,
  TeamController.changeRole
);

/**
 * @route PUT /api/team/:id/deactivate
 * @desc Desactivar miembro
 * @access Private (Admin)
 */
router.put('/:id/deactivate',
  authMiddleware,
  requireAdmin,
  teamValidators.validateIdParam,
  TeamController.deactivate
);

/**
 * @route PUT /api/team/:id/activate
 * @desc Activar miembro
 * @access Private (Admin)
 */
router.put('/:id/activate',
  authMiddleware,
  requireAdmin,
  teamValidators.validateIdParam,
  TeamController.activate
);

/**
 * @route DELETE /api/team/:id
 * @desc Eliminar miembro
 * @access Private (Admin)
 */
router.delete('/:id',
  authMiddleware,
  requireAdmin,
  teamValidators.validateIdParam,
  TeamController.delete
);

/**
 * @route POST /api/team/:id/reset-password
 * @desc Resetear contraseña de miembro
 * @access Private (Admin)
 */
router.post('/:id/reset-password',
  authMiddleware,
  requireAdmin,
  teamValidators.validateIdParam,
  teamValidators.validateResetPassword,
  TeamController.resetPassword
);

/**
 * @route PUT /api/team/:id
 * @desc Actualizar miembro
 * @access Private (Admin)
 */
router.put('/:id',
  authMiddleware,
  requireAdmin,
  teamValidators.validateIdParam,
  ...teamValidators.validateUpdate,
  TeamController.update
);



module.exports = router;
