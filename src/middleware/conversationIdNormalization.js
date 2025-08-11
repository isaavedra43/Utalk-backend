const logger = require('../utils/logger');

/**
 * Middleware para normalizar conversationId con URL encoding
 * Maneja tanto + como %2B en el patrón conv_+<from>_+<to>
 */
function normalizeConversationId(req, res, next) {
  try {
    const rawConversationId = req.params.conversationId || req.params.id;
    
    if (!rawConversationId) {
      return res.status(400).json({
        error: 'validation_error',
        details: [{
          field: 'conversationId',
          code: 'required',
          message: 'conversationId es obligatorio'
        }]
      });
    }

    // Normalizar URL encoding
    const normalized = decodeURIComponent(rawConversationId);
    
    // Validar formato del conversationId normalizado
    const parseResult = parseConversationId(normalized);
    
    if (!parseResult.valid) {
      return res.status(400).json({
        error: 'validation_error',
        details: [{
          field: 'conversationId',
          code: 'invalid_format',
          message: 'Formato de conversationId inválido. Debe ser conv_+<from>_+<to>',
          value: rawConversationId,
          normalized: normalized
        }]
      });
    }

    // Agregar datos normalizados al request
    req.normalizedConversationId = normalized;
    req.conversationParticipants = parseResult.participants;
    
    // Log estructurado
    logger.info('ConversationId normalizado', {
      requestId: req.id || 'unknown',
      conversationIdRaw: rawConversationId,
      conversationIdNormalized: normalized,
      participants: parseResult.participants,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    next();
  } catch (error) {
    logger.error('Error normalizando conversationId', {
      requestId: req.id || 'unknown',
      conversationId: req.params.conversationId || req.params.id,
      error: error.message,
      stack: error.stack
    });

    return res.status(400).json({
      error: 'validation_error',
      details: [{
        field: 'conversationId',
        code: 'normalization_error',
        message: 'Error procesando conversationId'
      }]
    });
  }
}

/**
 * Parsea y valida un conversationId normalizado
 * @param {string} conversationId - ID normalizado
 * @returns {Object} - { valid: boolean, participants: { from, to } }
 */
function parseConversationId(conversationId) {
  try {
    if (!conversationId || typeof conversationId !== 'string') {
      return { valid: false, participants: null };
    }

    // Validar patrón conv_+<from>_+<to>
    const pattern = /^conv_\+([1-9]\d{1,14})_\+([1-9]\d{1,14})$/;
    const match = conversationId.match(pattern);

    if (!match) {
      return { valid: false, participants: null };
    }

    const [, from, to] = match;

    return {
      valid: true,
      participants: {
        from: `+${from}`,
        to: `+${to}`
      }
    };
  } catch (error) {
    return { valid: false, participants: null };
  }
}

module.exports = {
  normalizeConversationId,
  parseConversationId
}; 