const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { requireAgentOrAdmin } = require('../middleware/auth');
const MessageController = require('../controllers/MessageController');

const router = express.Router();

/**
 * @route GET /api/messages
 * @desc Listar conversaciones
 * @access Private
 */
router.get('/', MessageController.getConversations);

/**
 * @route GET /api/messages/conversation/:phone
 * @desc Obtener mensajes de una conversación por teléfono
 * @access Private
 */
router.get('/conversation/:phone', MessageController.getConversationByPhone);

/**
 * @route POST /api/messages/send
 * @desc Enviar mensaje de WhatsApp
 * @access Private (Agent+)
 */
router.post('/send', 
  requireAgentOrAdmin,
  validate(schemas.message.send),
  MessageController.sendMessage
);

/**
 * @route POST /api/messages/webhook
 * @desc Webhook para recibir mensajes de Twilio
 * @access Public (con validación de webhook)
 */
router.post('/webhook', 
  validate(schemas.message.webhook),
  MessageController.handleWebhook
);

/**
 * @route GET /api/messages/stats
 * @desc Obtener estadísticas de mensajes
 * @access Private
 */
router.get('/stats', MessageController.getStats);

/**
 * @route PUT /api/messages/:id/status
 * @desc Actualizar estado de mensaje
 * @access Private (Agent+)
 */
router.put('/:id/status', 
  requireAgentOrAdmin,
  MessageController.updateStatus
);

/**
 * @route GET /api/messages/search
 * @desc Buscar mensajes por contenido
 * @access Private
 */
router.get('/search', MessageController.search);

module.exports = router; 