const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { authMiddleware, requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const MessageController = require('../controllers/MessageController');

const router = express.Router();

/**
 * @route   POST /api/messages/send
 * @desc    Enviar un mensaje de WhatsApp saliente (EMAIL-FIRST)
 * @access  Private (Admin, Agent only)
 * @body    { conversationId: (UUID), content: "..." }
 */
router.post('/send',
  authMiddleware,
  requireWriteAccess,
  validate(schemas.message.send),
  MessageController.sendMessage,
);

module.exports = router;
