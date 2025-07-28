const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const ConversationController = require('../controllers/ConversationController');
const MessageController = require('../controllers/MessageController');

const router = express.Router();

/**
 * @route GET /api/conversations
 * @desc Listar conversaciones con filtros y paginación
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/',
  requireReadAccess,
  ConversationController.listConversations,
);

/**
 * @route GET /api/conversations/unassigned
 * @desc Obtener conversaciones sin asignar
 * @access Private (Admin, Agent)
 */
router.get('/unassigned',
  requireWriteAccess,
  ConversationController.getUnassignedConversations,
);

/**
 * @route GET /api/conversations/stats
 * @desc Obtener estadísticas de conversaciones
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/stats',
  requireReadAccess,
  ConversationController.getConversationStats,
);

/**
 * @route GET /api/conversations/search
 * @desc Buscar conversaciones
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/search',
  requireReadAccess,
  ConversationController.searchConversations,
);

/**
 * @route GET /api/conversations/:conversationId
 * @desc Obtener conversación específica por su UUID
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:conversationId',
  requireReadAccess,
  ConversationController.getConversation,
);

/**
 * @route GET /api/conversations/:conversationId/messages
 * @desc Obtener los mensajes de una conversación (EMAIL-FIRST)
 * @access Private (Admin, Agent, Viewer)
 * @params conversationId (UUID)
 */
router.get('/:conversationId/messages',
  requireReadAccess,
  MessageController.getMessages,
);

/**
 * @route POST /api/conversations/:conversationId/messages
 * @desc Crear/enviar mensaje en una conversación específica
 * @access Private (Admin, Agent only)
 */
router.post('/:conversationId/messages',
  requireWriteAccess,
  validate(schemas.message.createInConversation),
  MessageController.createMessageInConversation,
);

/**
 * @route PUT /api/conversations/:conversationId/messages/:messageId/read
 * @desc Marcar mensaje específico como leído
 * @access Private (Admin, Agent, Viewer)
 */
router.put('/:conversationId/messages/:messageId/read',
  requireReadAccess,
  MessageController.markMessageAsRead,
);

/**
 * @route PUT /api/conversations/:conversationId/read-all
 * @desc Marcar toda la conversación como leída
 * @access Private (Admin, Agent, Viewer)
 */
router.put('/:conversationId/read-all',
  requireReadAccess,
  ConversationController.markConversationAsRead,
);

/**
 * @route DELETE /api/conversations/:conversationId/messages/:messageId
 * @desc Eliminar mensaje específico (soft delete)
 * @access Private (Admin, Agent only)
 */
router.delete('/:conversationId/messages/:messageId',
  requireWriteAccess,
  MessageController.deleteMessage,
);

/**
 * @route POST /api/conversations
 * @desc Crear nueva conversación (EMAIL-FIRST)
 * @access Private (Admin, Agent only)
 */
router.post('/',
  requireWriteAccess,
  validate(schemas.conversation.create),
  ConversationController.createConversation,
);

/**
 * @route PUT /api/conversations/:id
 * @desc Actualizar conversación
 * @access Private (Admin, Agent only)
 */
router.put('/:id',
  requireWriteAccess,
  validate(schemas.conversation.update),
  ConversationController.updateConversation,
);

/**
 * @route PUT /api/conversations/:id/assign
 * @desc Asignar conversación a agente
 * @access Private (Admin, Agent only)
 */
router.put('/:id/assign',
  requireWriteAccess,
  validate(schemas.conversation.assign),
  ConversationController.assignConversation,
);

/**
 * @route PUT /api/conversations/:id/unassign
 * @desc Desasignar conversación (quitar agente)
 * @access Private (Admin, Agent only)
 */
router.put('/:id/unassign',
  requireWriteAccess,
  ConversationController.unassignConversation,
);

/**
 * @route POST /api/conversations/:id/transfer
 * @desc Transferir conversación a otro agente
 * @access Private (Admin, Agent only)
 */
router.post('/:id/transfer',
  requireWriteAccess,
  validate(schemas.conversation.transfer),
  ConversationController.transferConversation,
);

/**
 * @route PUT /api/conversations/:id/status
 * @desc Cambiar estado de conversación
 * @access Private (Admin, Agent only)
 */
router.put('/:id/status',
  requireWriteAccess,
  validate(schemas.conversation.changeStatus),
  ConversationController.changeConversationStatus,
);

/**
 * @route PUT /api/conversations/:id/priority
 * @desc Cambiar prioridad de conversación
 * @access Private (Admin, Agent only)
 */
router.put('/:id/priority',
  requireWriteAccess,
  validate(schemas.conversation.changePriority),
  ConversationController.changeConversationPriority,
);

/**
 * @route POST /api/conversations/:id/typing
 * @desc Indicar que el usuario está escribiendo
 * @access Private (Admin, Agent, Viewer)
 */
router.post('/:id/typing',
  requireReadAccess,
  ConversationController.indicateTyping,
);

module.exports = router;
