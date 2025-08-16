const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/MessageController');
const { validateRequest } = require('../middleware/validation');
const { validatePhoneInBody, validateMultiplePhonesInBody } = require('../middleware/phoneValidation');
const { authMiddleware, requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const { normalizeConversationId, normalizeConversationIdQuery } = require('../middleware/conversationIdNormalization');
const Joi = require('joi');
const { validateId, validateConversationId } = require('../middleware/validation');

// Validadores específicos para mensajes
const messageValidators = {
  validateCreateInConversation: validateRequest({
    body: Joi.object({
      content: Joi.string().min(1).max(4096).required(),
      type: Joi.string().valid('text', 'image', 'audio', 'video', 'document').default('text'),
      replyToMessageId: Joi.string().uuid().optional(),
      metadata: Joi.object().optional()
    })
  }),

  validateSend: validateRequest({
    body: Joi.object({
      conversationId: Joi.string().uuid().optional(),
      to: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).optional(),
      content: Joi.string().min(1).max(4096).required(),
      type: Joi.string().valid('text', 'image', 'audio', 'video', 'document').default('text'),
      attachments: Joi.array().items(Joi.object({
        url: Joi.string().uri().required(),
        type: Joi.string().required(),
        name: Joi.string().optional()
      })).max(10).optional()
    })
  }),

  validateSendLocation: validateRequest({
    body: Joi.object({
      to: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
      name: Joi.string().max(100).optional(),
      address: Joi.string().max(200).optional(),
      conversationId: Joi.string().uuid().optional()
    })
  }),

  validateSendSticker: validateRequest({
    body: Joi.object({
      to: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
      stickerUrl: Joi.string().uri().required(),
      conversationId: Joi.string().uuid().optional()
    })
  }),

  validateSendWithAttachments: validateRequest({
    body: Joi.object({
      conversationId: Joi.string().uuid().required(),
      content: Joi.string().max(4096).optional(),
      attachments: Joi.array().items(Joi.object({
        buffer: Joi.binary().optional(),
        originalname: Joi.string().optional(),
        mimetype: Joi.string().required(),
        size: Joi.number().integer().min(1).max(100 * 1024 * 1024).optional(), // 100MB max
        fieldname: Joi.string().optional()
      })).min(1).max(10).required(), // Mínimo 1, máximo 10 archivos
      metadata: Joi.object().optional()
    })
  }),

  validateMarkRead: validateRequest({
    body: Joi.object({
      readAt: Joi.date().iso().default(() => new Date().toISOString())
    })
  }),

  validateWebhook: validateRequest({
    body: Joi.object({
      From: Joi.string().required(),
      To: Joi.string().required(),
      Body: Joi.string().optional(),
      MessageSid: Joi.string().required(),
      NumMedia: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
      MediaUrl0: Joi.string().uri().optional(),
      MediaContentType0: Joi.string().optional(),
      ProfileName: Joi.string().optional(),
      WaId: Joi.string().optional(),
      AccountSid: Joi.string().optional(),
      ApiVersion: Joi.string().optional(),
      Price: Joi.string().optional(),
      PriceUnit: Joi.string().optional(),
      // 🆕 CAMPOS PARA UBICACIÓN
      Latitude: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
      Longitude: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
      LocationName: Joi.string().optional(),
      LocationAddress: Joi.string().optional(),
      // 🆕 CAMPOS PARA STICKERS
      StickerId: Joi.string().optional(),
      StickerPackId: Joi.string().optional(),
      StickerEmoji: Joi.string().optional()
    })
  }),

  validateWhatsAppFile: validateRequest({
    body: Joi.object({
      MediaUrl0: Joi.string().uri().required(),
      From: Joi.string().required(),
      Body: Joi.string().optional(),
      MessageSid: Joi.string().required(),
      NumMedia: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
      MediaContentType0: Joi.string().optional(),
      ProfileName: Joi.string().optional(),
      WaId: Joi.string().optional()
    })
  }),

  validateSendFileToWhatsApp: validateRequest({
    body: Joi.object({
      phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
      fileUrl: Joi.string().uri().required(),
      caption: Joi.string().max(1000).optional()
    })
  }),

  validateList: validateRequest({
    query: Joi.object({
      conversationId: Joi.string().required(),
      limit: Joi.number().integer().min(1).max(100).default(50),
      cursor: Joi.string().optional(),
      before: Joi.string().optional(),
      after: Joi.string().optional()
    })
  })
};

/**
 * @route GET /api/messages
 * @desc Listar mensajes de una conversación (para frontend)
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/',
  authMiddleware,
  requireReadAccess,
  (req, res, next) => {
    // 🔧 LOG CRÍTICO PARA RAILWAY: Llamada a mensajes
    console.log(`💬 MESSAGES_REQUEST: ${req.user?.email || 'anonymous'} - ${req.method} ${req.path} - Query: ${JSON.stringify(req.query)}`);
    next();
  },
  normalizeConversationIdQuery, // 🔧 CORRECCIÓN: Normalizar conversationId en query
  messageValidators.validateList,
  MessageController.getMessages
);

/**
 * @route GET /api/conversations/:conversationId/messages
 * @desc Listar mensajes de una conversación
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/conversations/:conversationId/messages',
  authMiddleware,
  requireReadAccess,
  normalizeConversationId,
  (req, res, next) => {
    // 🔧 CORRECCIÓN: Usar el conversationId normalizado para validación
    if (req.normalizedConversationId) {
      req.params.conversationId = req.normalizedConversationId;
    }
    next();
  },
  // 🔧 CORRECCIÓN CRÍTICA: Remover validación redundante ya que normalizeConversationId ya valida
  MessageController.getMessages
);

/**
 * @route POST /api/conversations/:conversationId/messages
 * @desc Crear mensaje en conversación
 * @access Private (Agent, Admin)
 */
router.post('/conversations/:conversationId/messages',
  authMiddleware,
  requireWriteAccess,
  normalizeConversationId,
  (req, res, next) => {
    // 🔧 CORRECCIÓN: Usar el conversationId normalizado para validación
    if (req.normalizedConversationId) {
      req.params.conversationId = req.normalizedConversationId;
    }
    next();
  },
  // 🔧 CORRECCIÓN CRÍTICA: Remover validación redundante ya que normalizeConversationId ya valida
  messageValidators.validateCreateInConversation,
  MessageController.createMessageInConversation
);

/**
 * @route PUT /api/conversations/:conversationId/messages/:messageId/read
 * @desc Marcar mensaje como leído
 * @access Private (Agent, Admin)
 */
router.put('/conversations/:conversationId/messages/:messageId/read',
  authMiddleware,
  requireWriteAccess,
  normalizeConversationId,
  (req, res, next) => {
    // 🔧 CORRECCIÓN: Usar el conversationId normalizado para validación
    if (req.normalizedConversationId) {
      req.params.conversationId = req.normalizedConversationId;
    }
    next();
  },
  // 🔧 CORRECCIÓN CRÍTICA: Remover validación redundante ya que normalizeConversationId ya valida
  validateId('messageId'),
  messageValidators.validateMarkRead,
  MessageController.markMessageAsRead
);

/**
 * @route DELETE /api/conversations/:conversationId/messages/:messageId
 * @desc Eliminar mensaje
 * @access Private (Agent, Admin)
 */
router.delete('/conversations/:conversationId/messages/:messageId',
  authMiddleware,
  requireWriteAccess,
  normalizeConversationId,
  (req, res, next) => {
    // 🔧 CORRECCIÓN: Usar el conversationId normalizado para validación
    if (req.normalizedConversationId) {
      req.params.conversationId = req.normalizedConversationId;
    }
    next();
  },
  // 🔧 CORRECCIÓN CRÍTICA: Remover validación redundante ya que normalizeConversationId ya valida
  validateId('messageId'),
  MessageController.deleteMessage
);

/**
 * @route POST /api/messages/send
 * @desc Enviar mensaje independiente (DEPRECATED)
 * @access Private (Agent, Admin)
 * @deprecated Use POST /api/conversations/:conversationId/messages instead
 */
router.post('/send',
  authMiddleware,
  requireWriteAccess,
  (req, res) => {
    res.status(410).json({
      error: 'deprecated_endpoint',
      message: 'Este endpoint está deprecado. Usa POST /api/conversations/:conversationId/messages',
      details: {
        newEndpoint: '/api/conversations/:conversationId/messages',
        requiredFields: ['messageId', 'type', 'content', 'senderIdentifier', 'recipientIdentifier'],
        conversationIdFormat: 'conv_+<from>_+<to> (acepta + y %2B)'
      }
    });
  }
);

/**
 * @route POST /api/messages/webhook
 * @desc Webhook de Twilio para mensajes entrantes
 * @access Public (Twilio)
 */
router.post('/webhook',
  messageValidators.validateWebhook,
  MessageController.handleWebhookSafe
);

/**
 * 🆕 @route POST /api/messages/send-location
 * @desc Enviar mensaje de ubicación
 * @access Private (Agent, Admin)
 */
router.post('/send-location',
  authMiddleware,
  requireWriteAccess,
  messageValidators.validateSendLocation,
  MessageController.sendLocationMessage
);

/**
 * 🆕 @route POST /api/messages/send-sticker
 * @desc Enviar mensaje de sticker
 * @access Private (Agent, Admin)
 */
router.post('/send-sticker',
  authMiddleware,
  requireWriteAccess,
  messageValidators.validateSendSticker,
  MessageController.sendStickerMessage
);

/**
 * 📨 @route POST /api/messages/send-with-attachments
 * @desc Enviar mensaje con archivos adjuntos (FASE 2)
 * @access Private (Agent, Admin)
 */
router.post('/send-with-attachments',
  authMiddleware,
  requireWriteAccess,
  messageValidators.validateSendWithAttachments,
  MessageController.sendMessageWithAttachments
);

/**
 * 📱 @route POST /api/messages/whatsapp-file
 * @desc Manejar archivo recibido de WhatsApp (FASE 6)
 * @access Public (Twilio Webhook)
 */
router.post('/whatsapp-file',
  messageValidators.validateWhatsAppFile,
  MessageController.handleWhatsAppFile
);

/**
 * 📎 @route POST /api/messages/send-file-to-whatsapp
 * @desc Enviar archivo específico a WhatsApp (FASE 6)
 * @access Private (Agent, Admin)
 */
router.post('/send-file-to-whatsapp',
  authMiddleware,
  requireWriteAccess,
  messageValidators.validateSendFileToWhatsApp,
  MessageController.sendFileToWhatsApp
);

module.exports = router;
