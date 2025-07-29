const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const MessageController = require('../controllers/MessageController');

const router = express.Router();

/**
 * @route   POST /api/messages/send
 * @desc    Enviar un mensaje de WhatsApp saliente (EMAIL-FIRST)
 * @access  Private (Admin, Agent only)
 * @body    { conversationId: (UUID), content: "..." }
 */
router.post('/send',
  requireWriteAccess,
  validate(schemas.message.send), // Asegurarse que este schema esté actualizado
  MessageController.sendMessage,
);

module.exports = router;
