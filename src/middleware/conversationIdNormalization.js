const logger = require('../utils/logger');

/**
 * Middleware para normalizar conversationId con URL encoding
 * Maneja tanto + como %2B en el patrón conv_+<from>_+<to>
 */
function normalizeConversationId(req, res, next) {
  try {
    // 🔧 CORRECCIÓN CRÍTICA: Buscar conversationId en múltiples ubicaciones
    const rawConversationId = req.params.conversationId || req.params.id || req.query.conversationId;
    
    // 🔍 LOGGING CRÍTICO PARA DEBUG - Ver qué parámetros están disponibles
    logger.info('ConversationId middleware - Parámetros disponibles', {
      requestId: req.id || 'unknown',
      paramsConversationId: req.params.conversationId,
      paramsId: req.params.id,
      queryConversationId: req.query.conversationId,
      rawConversationId: rawConversationId,
      method: req.method,
      url: req.originalUrl,
      timestamp: new Date().toISOString()
    });
    
    if (!rawConversationId) {
      logger.warn('ConversationId no encontrado en ningún parámetro', {
        requestId: req.id || 'unknown',
        params: req.params,
        query: req.query,
        method: req.method,
        url: req.originalUrl
      });
      
      return res.status(400).json({
        error: 'validation_error',
        details: [{
          field: 'conversationId',
          code: 'required',
          message: 'conversationId es obligatorio'
        }]
      });
    }

    // 🔧 CORRECCIÓN CRÍTICA: Mejorar decodificación URL encoding
    let normalized;
    try {
      // Decodificar URL encoding para manejar %2B -> +
      normalized = decodeURIComponent(rawConversationId);
      
      // 🔍 LOGGING MEJORADO PARA DEBUG - Ver qué se recibe y qué se decodifica
      logger.info('ConversationId decodificación EXITOSA', {
        requestId: req.id || 'unknown',
        rawConversationId,
        decodedConversationId: normalized,
        method: req.method,
        url: req.originalUrl,
        timestamp: new Date().toISOString()
      });
      
    } catch (decodeError) {
      logger.warn('Error decodificando conversationId', {
        requestId: req.id || 'unknown',
        rawConversationId,
        error: decodeError.message
      });
      // Intentar con el ID original
      normalized = rawConversationId;
    }
    
    // Validar formato del conversationId normalizado
    const parseResult = parseConversationId(normalized);
    
    if (!parseResult.valid) {
      logger.warn('ConversationId con formato inválido', {
        requestId: req.id || 'unknown',
        rawConversationId,
        normalized,
        error: parseResult.error
      });
      
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
    
    // 🔍 LOGGING MEJORADO PARA DEBUG
    logger.info('ConversationId normalizado exitosamente', {
      requestId: req.id || 'unknown',
      conversationIdRaw: rawConversationId,
      conversationIdNormalized: normalized,
      participants: parseResult.participants,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      method: req.method,
      url: req.originalUrl
    });

    next();
  } catch (error) {
    logger.error('Error crítico normalizando conversationId', {
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
 * Middleware para normalizar conversationId en query parameters
 * Específicamente para rutas como /api/messages?conversationId=...
 */
function normalizeConversationIdQuery(req, res, next) {
  try {
    const rawConversationId = req.query.conversationId;
    
    if (!rawConversationId) {
      return next(); // No hay conversationId, continuar
    }

    // 🔧 CORRECCIÓN CRÍTICA: Decodificar conversationId en query parameters
    let normalized;
    try {
      // Decodificar URL encoding para manejar %2B -> +
      normalized = decodeURIComponent(rawConversationId);
      
      // 🔍 LOGGING PARA DEBUG - Ver qué se recibe y qué se decodifica
      logger.info('ConversationId query decodificación', {
        requestId: req.id || 'unknown',
        rawConversationId,
        decodedConversationId: normalized,
        method: req.method,
        url: req.originalUrl
      });
      
    } catch (decodeError) {
      logger.warn('Error decodificando conversationId en query', {
        requestId: req.id || 'unknown',
        rawConversationId,
        error: decodeError.message
      });
      // Intentar con el ID original
      normalized = rawConversationId;
    }
    
    // Validar formato del conversationId normalizado
    const parseResult = parseConversationId(normalized);
    
    if (!parseResult.valid) {
      logger.warn('ConversationId en query con formato inválido', {
        requestId: req.id || 'unknown',
        rawConversationId,
        normalized,
        error: parseResult.error
      });
      
      return res.status(400).json({
        error: 'validation_error',
        details: [{
          field: 'conversationId',
          code: 'invalid_format',
          message: 'Formato de conversationId inválido en query parameters',
          value: rawConversationId,
          normalized: normalized
        }]
      });
    }

    // Reemplazar el conversationId en query con el normalizado
    req.query.conversationId = normalized;
    req.conversationParticipants = parseResult.participants;
    
    // 🔍 LOGGING PARA DEBUG
    logger.info('ConversationId en query normalizado exitosamente', {
      requestId: req.id || 'unknown',
      conversationIdRaw: rawConversationId,
      conversationIdNormalized: normalized,
      participants: parseResult.participants,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      method: req.method,
      url: req.originalUrl
    });

    next();
  } catch (error) {
    logger.error('Error crítico normalizando conversationId en query', {
      requestId: req.id || 'unknown',
      conversationId: req.query?.conversationId,
      error: error.message,
      stack: error.stack
    });

    return res.status(400).json({
      error: 'validation_error',
      details: [{
        field: 'conversationId',
        code: 'normalization_error',
        message: 'Error procesando conversationId en query parameters'
      }]
    });
  }
}

/**
 * Parsea y valida un conversationId normalizado
 * @param {string} conversationId - ID normalizado
 * @returns {Object} - { valid: boolean, participants: { from, to }, error?: string }
 */
function parseConversationId(conversationId) {
  try {
    if (!conversationId || typeof conversationId !== 'string') {
      return { valid: false, error: 'conversationId debe ser una cadena válida' };
    }

    // 🔧 CORRECCIÓN CRÍTICA: Validar formato conv_+phone1_+phone2
    if (!conversationId.startsWith('conv_')) {
      return { valid: false, error: 'conversationId debe comenzar con conv_' };
    }

    const parts = conversationId.replace('conv_', '').split('_');
    
    if (parts.length !== 2) {
      return { valid: false, error: 'conversationId debe contener exactamente 2 números separados por _' };
    }

    // Validar que cada parte sea un número válido (con o sin +)
    const phone1 = parts[0];
    const phone2 = parts[1];

    // 🔧 CORRECCIÓN: Validación más flexible para conversationId
    // Aceptar números con o sin +, entre 7 y 15 dígitos
    const phoneRegex = /^\+?\d{7,15}$/;
    
    if (!phoneRegex.test(phone1) || !phoneRegex.test(phone2)) {
      return { 
        valid: false, 
        error: 'Los números de teléfono deben tener entre 7 y 15 dígitos y pueden incluir +' 
      };
    }

    // Normalizar números (agregar + si no lo tienen)
    const normalizedPhone1 = phone1.startsWith('+') ? phone1 : '+' + phone1;
    const normalizedPhone2 = phone2.startsWith('+') ? phone2 : '+' + phone2;

    return {
      valid: true,
      participants: {
        from: normalizedPhone1,
        to: normalizedPhone2
      }
    };

  } catch (error) {
    return { 
      valid: false, 
      error: `Error parseando conversationId: ${error.message}` 
    };
  }
}

module.exports = {
  normalizeConversationId,
  normalizeConversationIdQuery,
  parseConversationId
}; 