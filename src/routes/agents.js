/**
 * 🎯 RUTAS DE AGENTES
 * 
 * Endpoints específicos para gestión de agentes con permisos de módulos.
 * Compatibilidad completa con el frontend.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const express = require('express');
const router = express.Router();
const TeamController = require('../controllers/TeamController');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const Joi = require('joi');

// 🛡️ VALIDADORES PARA AGENTES
const agentValidators = {
  // Validar creación de agente
  validateCreateAgent: validateRequest({
    body: Joi.object({
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
      phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().messages({
        'string.pattern.base': 'El teléfono debe ser un número válido'
      }),
      password: Joi.string().min(6).max(128).optional().messages({
        'string.min': 'La contraseña debe tener al menos 6 caracteres'
      }),
      permissions: Joi.object({
        read: Joi.boolean().default(true),
        write: Joi.boolean().default(true),
        approve: Joi.boolean().default(false),
        configure: Joi.boolean().default(false)
      }).optional(),
      modulePermissions: Joi.object({
        modules: Joi.object().pattern(
          Joi.string(),
          Joi.object({
            read: Joi.boolean().required(),
            write: Joi.boolean().required(),
            configure: Joi.boolean().required()
          })
        ).optional()
      }).optional()
    })
  }),

  // Validar actualización de agente
  validateUpdateAgent: validateRequest({
    body: Joi.object({
      name: Joi.string().min(2).max(100).optional(),
      role: Joi.string().valid('admin', 'supervisor', 'agent', 'viewer').optional(),
      phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().allow(null),
      isActive: Joi.boolean().optional(),
      permissions: Joi.object({
        read: Joi.boolean().optional(),
        write: Joi.boolean().optional(),
        approve: Joi.boolean().optional(),
        configure: Joi.boolean().optional()
      }).optional(),
      modulePermissions: Joi.object({
        modules: Joi.object().pattern(
          Joi.string(),
          Joi.object({
            read: Joi.boolean().required(),
            write: Joi.boolean().required(),
            configure: Joi.boolean().required()
          })
        ).optional()
      }).optional()
    }).min(1)
  }),

  // Validar ID de agente
  validateAgentId: validateRequest({
    params: Joi.object({
      id: Joi.string().required()
    })
  })
};

/**
 * @route GET /api/agents
 * @desc Obtener lista de agentes
 * @access Private (Admin, Supervisor)
 */
router.get('/',
  authMiddleware,
  TeamController.listAgents
);

/**
 * @route POST /api/agents
 * @desc Crear nuevo agente
 * @access Private (Solo admin)
 */
router.post('/',
  authMiddleware,
  requireAdmin,
  agentValidators.validateCreateAgent,
  TeamController.createAgent
);

/**
 * @route GET /api/agents/:id
 * @desc Obtener agente específico
 * @access Private (Admin, Supervisor, propio agente)
 */
router.get('/:id',
  authMiddleware,
  agentValidators.validateAgentId,
  TeamController.getAgent
);

/**
 * @route PUT /api/agents/:id
 * @desc Actualizar agente
 * @access Private (Solo admin)
 */
router.put('/:id',
  authMiddleware,
  requireAdmin,
  agentValidators.validateAgentId,
  agentValidators.validateUpdateAgent,
  TeamController.updateAgent
);

/**
 * @route DELETE /api/agents/:id
 * @desc Eliminar/desactivar agente
 * @access Private (Solo admin)
 */
router.delete('/:id',
  authMiddleware,
  requireAdmin,
  agentValidators.validateAgentId,
  TeamController.deleteAgent
);

module.exports = router;
