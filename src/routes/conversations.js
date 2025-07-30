const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { authMiddleware, requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const ConversationController = require('../controllers/ConversationController');
const MessageController = require('../controllers/MessageController');

const router = express.Router();

/**
 * @route GET /api/conversations
 * @desc Listar conversaciones con filtros y paginación
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/',
  authMiddleware,
  requireReadAccess,
  ConversationController.listConversations,
);

/**
 * @route GET /api/conversations/unassigned
 * @desc Obtener conversaciones sin asignar
 * @access Private (Admin, Agent)
 */
router.get('/unassigned',
  authMiddleware,
  requireWriteAccess,
  ConversationController.getUnassignedConversations,
);

/**
 * @route GET /api/conversations/stats
 * @desc Obtener estadísticas de conversaciones
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/stats',
  authMiddleware,
  requireReadAccess,
  ConversationController.getConversationStats,
);

/**
 * @route GET /api/conversations/search
 * @desc Buscar conversaciones
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/search',
  authMiddleware,
  requireReadAccess,
  ConversationController.searchConversations,
);

/**
 * @route GET /api/conversations/:conversationId
 * @desc Obtener conversación específica por su UUID
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:conversationId',
  authMiddleware,
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
  authMiddleware,
  requireReadAccess,
  MessageController.getMessages,
);

/**
 * @route POST /api/conversations/:conversationId/messages
 * @desc Crear/enviar mensaje en una conversación específica
 * @access Private (Admin, Agent only)
 */
router.post('/:conversationId/messages',
  authMiddleware,
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
  authMiddleware,
  requireReadAccess,
  MessageController.markMessageAsRead,
);

/**
 * @route PUT /api/conversations/:conversationId/read-all
 * @desc Marcar toda la conversación como leída
 * @access Private (Admin, Agent, Viewer)
 */
router.put('/:conversationId/read-all',
  authMiddleware,
  requireReadAccess,
  ConversationController.markConversationAsRead,
);

/**
 * @route POST /api/conversations
 * @desc Crear nueva conversación
 * @access Private (Admin, Agent only)
 */
router.post('/',
  authMiddleware,
  requireWriteAccess,
  validate(schemas.conversation.create),
  ConversationController.createConversation,
);

/**
 * @route PUT /api/conversations/:conversationId
 * @desc Actualizar conversación
 * @access Private (Admin, Agent only)
 */
router.put('/:conversationId',
  authMiddleware,
  requireWriteAccess,
  validate(schemas.conversation.update),
  ConversationController.updateConversation,
);

/**
 * @route PUT /api/conversations/:conversationId/assign
 * @desc Asignar conversación a un agente
 * @access Private (Admin, Agent only)
 */
router.put('/:conversationId/assign',
  authMiddleware,
  requireWriteAccess,
  validate(schemas.conversation.assign),
  ConversationController.assignConversation,
);

/**
 * @route PUT /api/conversations/:conversationId/unassign
 * @desc Desasignar conversación
 * @access Private (Admin, Agent only)
 */
router.put('/:conversationId/unassign',
  authMiddleware,
  requireWriteAccess,
  ConversationController.unassignConversation,
);

/**
 * @route PUT /api/conversations/:conversationId/transfer
 * @desc Transferir conversación a otro agente
 * @access Private (Admin, Agent only)
 */
router.put('/:conversationId/transfer',
  authMiddleware,
  requireWriteAccess,
  validate(schemas.conversation.transfer),
  ConversationController.transferConversation,
);

/**
 * @route PUT /api/conversations/:conversationId/priority
 * @desc Cambiar prioridad de conversación
 * @access Private (Admin, Agent only)
 */
router.put('/:conversationId/priority',
  authMiddleware,
  requireWriteAccess,
  validate(schemas.conversation.priority),
  ConversationController.changeConversationPriority,
);

/**
 * @route POST /api/conversations/:conversationId/typing
 * @desc Indicar que el usuario está escribiendo
 * @access Private (Admin, Agent only)
 */
router.post('/:conversationId/typing',
  authMiddleware,
  requireWriteAccess,
  ConversationController.indicateTyping,
);

// TODO: Implementar deleteConversation en ConversationController
// /**
//  * @route DELETE /api/conversations/:conversationId
//  * @desc Eliminar conversación (soft delete)
//  * @access Private (Admin only)
//  */
// router.delete('/:conversationId',
//   authMiddleware,
//   requireWriteAccess,
//   ConversationController.deleteConversation,
// );

module.exports = router;
