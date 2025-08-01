const express = require('express');
const router = express.Router();
const ConversationController = require('../controllers/ConversationController');
const { validateRequest } = require('../middleware/validation');
const { validatePhoneInBody } = require('../middleware/phoneValidation');
const { authMiddleware, requireReadAccess, requireWriteAccess } = require('../middleware/auth');
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
  }),

  validateList: validateRequest({
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      status: Joi.string().valid('open', 'pending', 'resolved', 'closed', 'all').optional(),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
      assignedTo: Joi.string().email().optional(),
      search: Joi.string().min(1).max(100).optional()
    })
  }),

  validateChangeStatus: validateRequest({
    body: Joi.object({
      status: Joi.string().valid('open', 'pending', 'resolved', 'closed').required()
    })
  }),

  validateChangePriority: validateRequest({
    body: Joi.object({
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').required()
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
  ConversationController.listConversations
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
  ConversationController.getConversation
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
  ConversationController.updateConversation
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
  ConversationController.assignConversation
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
  ConversationController.unassignConversation
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
  ConversationController.transferConversation
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
  ConversationController.changeConversationStatus
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
  ConversationController.changeConversationPriority
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
  ConversationController.markConversationAsRead
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
  ConversationController.indicateTyping
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
  ConversationController.createConversation
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
  ConversationController.deleteConversation
);

module.exports = router;
