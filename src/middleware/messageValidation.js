const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Schema de validación para mensajes salientes
 */
const messageSchema = Joi.object({
  messageId: Joi.string().uuid().required().messages({
    'string.empty': 'messageId es obligatorio',
    'string.guid': 'messageId debe ser un UUID válido',
    'any.required': 'messageId es obligatorio'
  }),
  
  type: Joi.string().valid('text', 'image', 'audio', 'video', 'document', 'location', 'sticker').default('text').messages({
    'string.base': 'type debe ser una cadena',
    'any.only': 'type debe ser uno de: text, image, audio, video, document, location, sticker'
  }),
  
  content: Joi.string().min(1).max(1000).required().messages({
    'string.empty': 'content es obligatorio',
    'string.min': 'content debe tener al menos 1 carácter',
    'string.max': 'content no puede exceder 1000 caracteres',
    'any.required': 'content es obligatorio'
  }),
  
  senderIdentifier: Joi.string().required().custom((value, helpers) => {
    // Validar formato E.164 o agent:
    const e164Pattern = /^whatsapp:\+[1-9]\d{1,14}$/;
    const agentPattern = /^agent:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$|^agent:[a-zA-Z0-9_-]+$/;
    
    if (e164Pattern.test(value) || agentPattern.test(value)) {
      return value;
    }
    
    return helpers.error('any.invalid');
  }).messages({
    'string.empty': 'senderIdentifier es obligatorio',
    'any.required': 'senderIdentifier es obligatorio',
    'any.invalid': 'senderIdentifier debe ser whatsapp:+<E164> o agent:<id|email>'
  }),
  
  recipientIdentifier: Joi.string().required().custom((value, helpers) => {
    // Validar formato E.164
    const e164Pattern = /^whatsapp:\+[1-9]\d{1,14}$/;
    
    if (e164Pattern.test(value)) {
      return value;
    }
    
    return helpers.error('any.invalid');
  }).messages({
    'string.empty': 'recipientIdentifier es obligatorio',
    'any.required': 'recipientIdentifier es obligatorio',
    'any.invalid': 'recipientIdentifier debe ser whatsapp:+<E164>'
  }),
  
  metadata: Joi.object().optional().default({}).messages({
    'object.base': 'metadata debe ser un objeto'
  })
});

/**
 * Middleware de validación para mensajes salientes
 */
function validateMessagePayload(req, res, next) {
  try {
    const { error, value } = messageSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        code: detail.type,
        message: detail.message
      }));

      logger.warn('Validación de mensaje falló', {
        requestId: req.id || 'unknown',
        conversationId: req.normalizedConversationId,
        errors: details,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });

      return res.status(400).json({
        error: 'validation_error',
        details: details
      });
    }

    // Agregar datos validados al request
    req.validatedMessage = value;
    
    // Log de validación exitosa
    logger.info('Mensaje validado exitosamente', {
      requestId: req.id || 'unknown',
      conversationId: req.normalizedConversationId,
      messageId: value.messageId,
      type: value.type,
      contentLength: value.content.length,
      senderIdentifier: value.senderIdentifier,
      recipientIdentifier: value.recipientIdentifier,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    next();
  } catch (error) {
    logger.error('Error en validación de mensaje', {
      requestId: req.id || 'unknown',
      conversationId: req.normalizedConversationId,
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      error: 'validation_system_error',
      message: 'Error interno en validación'
    });
  }
}

/**
 * Middleware para autogenerar messageId si no se proporciona (extensión opcional)
 */
function autoGenerateMessageId(req, res, next) {
  try {
    if (!req.body.messageId || req.body.messageId.trim() === '') {
      req.body.messageId = uuidv4();
      
      logger.info('MessageId autogenerado', {
        requestId: req.id || 'unknown',
        conversationId: req.normalizedConversationId,
        generatedMessageId: req.body.messageId,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error autogenerando messageId', {
      requestId: req.id || 'unknown',
      conversationId: req.normalizedConversationId,
      error: error.message
    });
    
    return res.status(500).json({
      error: 'message_id_generation_error',
      message: 'Error generando ID de mensaje'
    });
  }
}

/**
 * Middleware para fallback de senderIdentifier (extensión opcional)
 */
function fallbackSenderIdentifier(req, res, next) {
  try {
    // Solo aplicar si está habilitado el flag
    if (process.env.AI_SAFE_FALLBACK !== 'true') {
      return next();
    }

    if (!req.body.senderIdentifier || req.body.senderIdentifier.trim() === '') {
      // Intentar obtener del workspace configurado
      const workspaceFrom = req.user?.workspaceId ? `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER || '+1234567890'}` : null;
      
      if (workspaceFrom) {
        req.body.senderIdentifier = workspaceFrom;
        
        logger.info('SenderIdentifier fallback aplicado', {
          requestId: req.id || 'unknown',
          conversationId: req.normalizedConversationId,
          fallbackSender: req.body.senderIdentifier,
          userAgent: req.headers['user-agent'],
          ip: req.ip
        });
      }
    }
    
    next();
  } catch (error) {
    logger.error('Error en fallback de senderIdentifier', {
      requestId: req.id || 'unknown',
      conversationId: req.normalizedConversationId,
      error: error.message
    });
    
    next(); // Continuar sin fallback
  }
}

module.exports = {
  validateMessagePayload,
  autoGenerateMessageId,
  fallbackSenderIdentifier,
  messageSchema
}; 