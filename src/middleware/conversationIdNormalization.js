const logger = require('../utils/logger');

/**
 * Middleware para normalizar conversationId con URL encoding
 * Maneja tanto + como %2B en el patrón conv_+<from>_+<to>
 */
function normalizeConversationId(req, res, next) {
  try {
    req.logger?.info('🔄 Iniciando normalización de conversationId', {
      category: 'CONVERSATION_ID_NORMALIZATION_START',
      method: req.method,
      path: req.path,
      paramsConversationId: req.params.conversationId,
      queryConversationId: req.query.conversationId
    });

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
      logger.debug('❌ ConversationId inválido: entrada vacía o no string', {
        category: 'CONVERSATION_ID_PARSE_ERROR',
        conversationId: conversationId,
        type: typeof conversationId
      });
      return { valid: false, participants: null };
    }

    logger.debug('🔍 Parseando conversationId', {
      category: 'CONVERSATION_ID_PARSE_START',
      conversationId: conversationId,
      length: conversationId.length
    });

    // CORREGIDO: Validar patrón conv_+<from>_+<to> con regex más flexible
    const pattern = /^conv_(\+[1-9]\d{1,14})_(\+[1-9]\d{1,14})$/;
    const match = conversationId.match(pattern);

    if (!match) {
      logger.warn('❌ ConversationId no coincide con patrón esperado', {
        category: 'CONVERSATION_ID_PATTERN_MISMATCH',
        conversationId: conversationId,
        pattern: pattern.toString()
      });
      return { valid: false, participants: null };
    }

    const [, from, to] = match;

    logger.info('✅ ConversationId parseado exitosamente', {
      category: 'CONVERSATION_ID_PARSE_SUCCESS',
      conversationId: conversationId,
      from: from,
      to: to
    });

    return {
      valid: true,
      participants: {
        from: from,
        to: to
      }
    };
  } catch (error) {
    logger.error('❌ Error durante parseo de conversationId', {
      category: 'CONVERSATION_ID_PARSE_EXCEPTION',
      conversationId: conversationId,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3)
    });
    return { valid: false, participants: null };
  }
}

module.exports = {
  normalizeConversationId,
  parseConversationId
}; 