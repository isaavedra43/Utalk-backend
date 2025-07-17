const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const ConversationController = require('../controllers/ConversationController');

const router = express.Router();

/**
 * @route GET /api/conversations
 * @desc Listar conversaciones con filtros y paginación
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/',
  requireReadAccess,
  ConversationController.list,
);

/**
 * @route GET /api/conversations/stats
 * @desc Obtener estadísticas de conversaciones
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/stats',
  requireReadAccess,
  ConversationController.getStats,
);

/**
 * @route GET /api/conversations/:id
 * @desc Obtener conversación específica
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:id',
  requireReadAccess,
  ConversationController.getById,
);

/**
 * @route GET /api/conversations/:id/messages
 * @desc Obtener mensajes de una conversación
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:id/messages',
  requireReadAccess,
  ConversationController.getMessages,
);

/**
 * @route PUT /api/conversations/:id/read
 * @desc Marcar conversación como leída
 * @access Private (Admin, Agent only)
 */
router.put('/:id/read',
  requireWriteAccess,
  ConversationController.markAsRead,
);

/**
 * @route PUT /api/conversations/:id/assign
 * @desc Asignar conversación a agente
 * @access Private (Admin, Agent only)
 */
router.put('/:id/assign',
  requireWriteAccess,
  validate(schemas.conversation.assign),
  ConversationController.assign,
);

/**
 * @route PUT /api/conversations/:id/status
 * @desc Cambiar estado de conversación
 * @access Private (Admin, Agent only)
 */
router.put('/:id/status',
  requireWriteAccess,
  validate(schemas.conversation.changeStatus),
  ConversationController.changeStatus,
);

/**
 * @route DELETE /api/conversations/:id
 * @desc Archivar conversación
 * @access Private (Admin, Agent only)
 */
router.delete('/:id',
  requireWriteAccess,
  ConversationController.archive,
);

module.exports = router;
