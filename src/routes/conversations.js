const express = require('express');
const router = express.Router();
const ConversationController = require('../controllers/ConversationController');
const { validateRequest } = require('../middleware/validation');
const { validatePhoneInBody } = require('../middleware/phoneValidation');
const Joi = require('joi');

// Validadores específicos para conversaciones
const conversationValidators = {
  validateCreate: validateRequest({
    body: Joi.object({
      customerPhone: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
      customerName: Joi.string().min(1).max(100).optional(),
      subject: Joi.string().min(1).max(200).optional(),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
      tags: Joi.array().items(Joi.string()).max(10).optional(),
      metadata: Joi.object().optional()
    })
  }),

  validateUpdate: validateRequest({
    body: Joi.object({
      customerName: Joi.string().min(1).max(100).optional(),
      subject: Joi.string().min(1).max(200).optional(),
      status: Joi.string().valid('open', 'pending', 'resolved', 'closed').optional(),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
      tags: Joi.array().items(Joi.string()).max(10).optional(),
      metadata: Joi.object().optional()
    })
  }),

  validateAssign: validateRequest({
    body: Joi.object({
      agentEmail: Joi.string().email().required()
    })
  }),

  validateTransfer: validateRequest({
    body: Joi.object({
      targetAgentEmail: Joi.string().email().required(),
      reason: Joi.string().min(1).max(500).optional()
    })
  })
};
const { validateId } = require('../middleware/validation');

/**
 * @route GET /api/conversations
 * @desc Listar conversaciones con filtros y paginación
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/',
  authMiddleware,
  requireReadAccess,
  conversationValidators.validateList,
  ConversationController.list
);

/**
 * @route GET /api/conversations/:id
 * @desc Obtener conversación por ID
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:id',
  authMiddleware,
  requireReadAccess,
  validateId('id'),
  ConversationController.getById
);

/**
 * @route PUT /api/conversations/:id
 * @desc Actualizar conversación
 * @access Private (Agent, Admin)
 */
router.put('/:id',
  authMiddleware,
  requireWriteAccess,
  validateId('id'),
  conversationValidators.validateUpdate,
  ConversationController.update
);

/**
 * @route PUT /api/conversations/:id/assign
 * @desc Asignar conversación a agente
 * @access Private (Agent, Admin)
 */
router.put('/:id/assign',
  authMiddleware,
  requireWriteAccess,
  validateId('id'),
  conversationValidators.validateAssign,
  ConversationController.assign
);

/**
 * @route PUT /api/conversations/:id/unassign
 * @desc Desasignar conversación
 * @access Private (Agent, Admin)
 */
router.put('/:id/unassign',
  authMiddleware,
  requireWriteAccess,
  validateId('id'),
  ConversationController.unassign
);

/**
 * @route POST /api/conversations/:id/transfer
 * @desc Transferir conversación a otro agente
 * @access Private (Agent, Admin)
 */
router.post('/:id/transfer',
  authMiddleware,
  requireWriteAccess,
  validateId('id'),
  conversationValidators.validateTransfer,
  ConversationController.transfer
);

/**
 * @route PUT /api/conversations/:id/status
 * @desc Cambiar estado de conversación
 * @access Private (Agent, Admin)
 */
router.put('/:id/status',
  authMiddleware,
  requireWriteAccess,
  validateId('id'),
  conversationValidators.validateChangeStatus,
  ConversationController.changeStatus
);

/**
 * @route PUT /api/conversations/:id/priority
 * @desc Cambiar prioridad de conversación
 * @access Private (Agent, Admin)
 */
router.put('/:id/priority',
  authMiddleware,
  requireWriteAccess,
  validateId('id'),
  conversationValidators.validateChangePriority,
  ConversationController.changePriority
);

/**
 * @route PUT /api/conversations/:id/read-all
 * @desc Marcar todos los mensajes como leídos
 * @access Private (Agent, Admin)
 */
router.put('/:id/read-all',
  authMiddleware,
  requireWriteAccess,
  validateId('id'),
  ConversationController.markAllAsRead
);

/**
 * @route POST /api/conversations/:id/typing
 * @desc Indicar que usuario está escribiendo
 * @access Private (Agent, Admin)
 */
router.post('/:id/typing',
  authMiddleware,
  requireWriteAccess,
  validateId('id'),
  ConversationController.typing
);

/**
 * @route POST /api/conversations
 * @desc Crear nueva conversación
 * @access Private (Agent, Admin)
 */
router.post('/',
  authMiddleware,
  requireWriteAccess,
  conversationValidators.validateCreate,
  ConversationController.create
);

/**
 * @route DELETE /api/conversations/:id
 * @desc Eliminar conversación
 * @access Private (Admin)
 */
router.delete('/:id',
  authMiddleware,
  requireWriteAccess,
  validateId('id'),
  ConversationController.delete
);

module.exports = router;
