const express = require('express');
const router = express.Router();
const TeamController = require('../controllers/TeamController');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const Joi = require('joi');

// Validadores específicos para team
const teamValidators = {
  validateInvite: validateRequest({
    body: Joi.object({
      email: Joi.string().email({ minDomainSegments: 2 }).max(254).required(),
      name: Joi.string().min(1).max(100).required(),
      role: Joi.string().valid('admin', 'agent', 'viewer').default('viewer')
    })
  }),

  validateUpdate: validateRequest({
    body: Joi.object({
      name: Joi.string().min(1).max(100).optional(),
      role: Joi.string().valid('admin', 'agent', 'viewer').optional(),
      status: Joi.string().valid('active', 'inactive').optional()
    })
  }),

  validateChangeRole: validateRequest({
    body: Joi.object({
      newRole: Joi.string().valid('admin', 'agent', 'viewer').required(),
      reason: Joi.string().max(500).optional()
    })
  }),

  validateResetPassword: validateRequest({
    body: Joi.object({
      confirm: Joi.boolean().valid(true).required()
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
 * @route GET /api/team/:id
 * @desc Obtener miembro por ID
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:id',
  authMiddleware,
  validateRequest('id'),
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
  teamValidators.validateInvite,
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
  validateRequest('id'),
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
  validateRequest('id'),
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
  validateRequest('id'),
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
  validateRequest('id'),
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
  validateRequest('id'),
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
  validateRequest('id'),
  teamValidators.validateUpdate,
  TeamController.update
);



module.exports = router;
