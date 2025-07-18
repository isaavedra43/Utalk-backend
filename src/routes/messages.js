const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const MessageController = require('../controllers/MessageController');

const router = express.Router();

/**
 * @route GET /api/messages
 * @desc Listar mensajes individuales con filtros flexibles
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/',
  requireReadAccess,
  MessageController.getMessages,
);

/**
 * @route GET /api/messages/conversation/:phone
 * @desc Obtener mensajes de una conversación por teléfono
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/conversation/:phone',
  requireReadAccess,
  MessageController.getConversationByPhone,
);

/**
 * @route POST /api/messages/send
 * @desc Enviar mensaje de WhatsApp
 * @access Private (Admin, Agent only)
 */
router.post('/send',
  requireWriteAccess,
  validate(schemas.message.send),
  MessageController.sendMessage,
);

/**
 * NOTA: El webhook se movió a /src/routes/webhook.js para ser público
 * La ruta /api/messages/webhook ahora está en /api/messages/webhook (archivo dedicado)
 * Esto permite que Twilio acceda sin autenticación mientras las demás rutas están protegidas
 */

/**
 * @route GET /api/messages/stats
 * @desc Obtener estadísticas de mensajes
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/stats',
  requireReadAccess,
  MessageController.getStats,
);

/**
 * @route PUT /api/messages/:id/status
 * @desc Actualizar estado de mensaje
 * @access Private (Admin, Agent only)
 */
router.put('/:id/status',
  requireWriteAccess,
  MessageController.updateStatus,
);

/**
 * @route PUT /api/messages/:id/read
 * @desc Marcar mensaje como leído
 * @access Private (Admin, Agent only)
 */
router.put('/:id/read',
  requireWriteAccess,
  MessageController.markAsRead,
);

/**
 * @route PUT /api/messages/read-multiple
 * @desc Marcar múltiples mensajes como leídos
 * @access Private (Admin, Agent only)
 */
router.put('/read-multiple',
  requireWriteAccess,
  validate(schemas.message.readMultiple),
  MessageController.markMultipleAsRead,
);

/**
 * @route GET /api/messages/search
 * @desc Buscar mensajes por contenido
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/search',
  requireReadAccess,
  MessageController.search,
);

// EXPORT PATTERN: Single router export (STANDARD for all routes)
// USAGE: const messageRoutes = require('./routes/messages');
module.exports = router;
