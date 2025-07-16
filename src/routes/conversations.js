const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { requireAgentOrAdmin, requireAdmin } = require('../middleware/auth');
const ConversationController = require('../controllers/ConversationController');

const router = express.Router();

/**
 * @route GET /api/conversations
 * @desc Listar conversaciones con filtros y paginación
 * @access Private (Agent+)
 */
router.get('/',
  requireAgentOrAdmin,
  ConversationController.list,
);

/**
 * @route GET /api/conversations/stats
 * @desc Obtener estadísticas de conversaciones
 * @access Private (Agent+)
 */
router.get('/stats',
  requireAgentOrAdmin,
  ConversationController.getStats,
);

/**
 * @route GET /api/conversations/:id
 * @desc Obtener conversación específica
 * @access Private (Agent+)
 */
router.get('/:id',
  requireAgentOrAdmin,
  ConversationController.getById,
);

/**
 * @route GET /api/conversations/:id/messages
 * @desc Obtener mensajes de una conversación
 * @access Private (Agent+)
 */
router.get('/:id/messages',
  requireAgentOrAdmin,
  ConversationController.getMessages,
);

/**
 * @route PUT /api/conversations/:id/read
 * @desc Marcar conversación como leída
 * @access Private (Agent+)
 */
router.put('/:id/read',
  requireAgentOrAdmin,
  ConversationController.markAsRead,
);

/**
 * @route PUT /api/conversations/:id/assign
 * @desc Asignar conversación a agente
 * @access Private (Agent+)
 */
router.put('/:id/assign',
  requireAgentOrAdmin,
  validate(schemas.conversation.assign),
  ConversationController.assign,
);

/**
 * @route PUT /api/conversations/:id/status
 * @desc Cambiar estado de conversación
 * @access Private (Agent+)
 */
router.put('/:id/status',
  requireAgentOrAdmin,
  validate(schemas.conversation.changeStatus),
  ConversationController.changeStatus,
);

/**
 * @route DELETE /api/conversations/:id
 * @desc Archivar conversación
 * @access Private (Agent+)
 */
router.delete('/:id',
  requireAgentOrAdmin,
  ConversationController.archive,
);

module.exports = router; 