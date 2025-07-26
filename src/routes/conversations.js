const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const ConversationController = require('../controllers/ConversationController');
const MessageController = require('../controllers/MessageController'); // Importar MessageController

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
 * @route GET /api/conversations/stats
 * @desc Obtener estadísticas de conversaciones
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/stats',
  requireReadAccess,
  ConversationController.getConversationStats,
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
 * @route   GET /api/conversations/:conversationId/messages
 * @desc    Obtener los mensajes de una conversación (EMAIL-FIRST)
 * @access  Private (Admin, Agent, Viewer)
 * @params  conversationId (UUID)
 */
router.get('/:conversationId/messages',
  requireReadAccess,
  MessageController.getMessages, // <-- CORREGIDO: Apunta al controlador correcto.
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
 * @route GET /api/conversations/search
 * @desc Buscar conversaciones
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/search',
  requireReadAccess,
  ConversationController.searchConversations,
);

module.exports = router;
