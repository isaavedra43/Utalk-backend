/**
 * 📚 LOADER DE CONTEXTO CONVERSACIONAL
 * 
 * Carga el historial de mensajes de una conversación para proporcionar
 * contexto a la IA. Optimizado para velocidad (<150ms).
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { firestore } = require('../config/firebase');
const logger = require('./logger');
const { aiLogger } = require('./aiLogger');

/**
 * Cargar contexto conversacional para IA
 */
async function loadConversationContext(conversationId, options = {}) {
  const startTime = Date.now();
  
  try {
    const {
      maxMessages = 20,
      includeMetadata = false,
      workspaceId = null
    } = options;

    // Validar parámetros
    if (!conversationId) {
      throw new Error('conversationId es requerido');
    }

    if (maxMessages > 50) {
      throw new Error('maxMessages no puede exceder 50');
    }

    logger.info('📚 Cargando contexto conversacional', {
      conversationId,
      maxMessages,
      workspaceId
    });

    // 🗑️ OBSOLETO: contextLoader deshabilitado temporalmente
    logger.warn('🗑️ OBSOLETO: contextLoader usa estructura antigua', {
      conversationId: conversationId?.substring(0, 20),
      note: 'Deshabilitar hasta migrar a nueva estructura'
    });
    
    return {
      messages: [],
      summary: 'Context loader deshabilitado - estructura antigua',
      totalMessages: 0,
      timestamp: new Date().toISOString(),
      conversationId,
      workspaceId
    };

    const snapshot = await messagesRef
      .orderBy('timestamp', 'desc')
      .limit(maxMessages)
      .get();

    if (snapshot.empty) {
      logger.warn('⚠️ No se encontraron mensajes para el contexto', {
        conversationId,
        maxMessages
      });

      return {
        conversationId,
        messages: [],
        totalMessages: 0,
        loadTimeMs: Date.now() - startTime,
        workspaceId
      };
    }

    // Procesar mensajes
    const messages = [];
    let totalTokens = 0;

    snapshot.forEach(doc => {
      const messageData = doc.data();
      
      // Determinar rol del mensaje
      let role = 'user';
      if (messageData.direction === 'outbound') {
        role = 'assistant';
      }

      // Construir mensaje para contexto
      const contextMessage = {
        id: messageData.id,
        role: role,
        content: messageData.content || '',
        timestamp: messageData.timestamp,
        type: messageData.type || 'text'
      };

      // Agregar metadata si se solicita
      if (includeMetadata) {
        contextMessage.metadata = {
          senderIdentifier: messageData.senderIdentifier,
          recipientIdentifier: messageData.recipientIdentifier,
          direction: messageData.direction,
          status: messageData.status
        };
      }

      // Agregar datos específicos por tipo
      if (messageData.type === 'location' && messageData.location) {
        contextMessage.location = {
          latitude: messageData.location.latitude,
          longitude: messageData.location.longitude,
          name: messageData.location.name,
          address: messageData.location.address
        };
      }

      if (messageData.type === 'sticker' && messageData.sticker) {
        contextMessage.sticker = {
          emoji: messageData.sticker.emoji,
          packId: messageData.sticker.packId
        };
      }

      messages.push(contextMessage);

      // Calcular tokens aproximados (4 caracteres = 1 token)
      totalTokens += Math.ceil((messageData.content || '').length / 4);
    });

    // Ordenar mensajes por timestamp (ascendente para contexto)
    messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const loadTimeMs = Date.now() - startTime;

    // Log de contexto cargado
    aiLogger.logContextLoaded(workspaceId, conversationId, {
      messagesCount: messages.length,
      totalTokens,
      loadTimeMs
    });

    logger.info('✅ Contexto conversacional cargado', {
      conversationId,
      messagesCount: messages.length,
      totalTokens,
      loadTimeMs,
      workspaceId
    });

    return {
      conversationId,
      messages,
      totalMessages: messages.length,
      totalTokens,
      loadTimeMs,
      workspaceId,
      lastMessageAt: messages.length > 0 ? messages[messages.length - 1].timestamp : null
    };

  } catch (error) {
    const loadTimeMs = Date.now() - startTime;
    
    logger.error('❌ Error cargando contexto conversacional', {
      conversationId,
      error: error.message,
      loadTimeMs
    });

    throw error;
  }
}

/**
 * Cargar contexto con información adicional de la conversación
 */
async function loadConversationContextWithMetadata(conversationId, options = {}) {
  try {
    // Cargar contexto básico
    const context = await loadConversationContext(conversationId, {
      ...options,
      includeMetadata: true
    });

    // 🗑️ OBSOLETO: loadConversationContextWithMetadata deshabilitado
    logger.warn('🗑️ OBSOLETO: loadConversationContextWithMetadata usa estructura antigua', {
      conversationId: conversationId?.substring(0, 20),
      note: 'Retornando contexto básico sin metadata adicional'
    });
    
    return context; // Retornar solo el contexto básico (ya deshabilitado arriba)

    if (conversationDoc.exists) {
      const conversationData = conversationDoc.data();
      
      context.conversation = {
        id: conversationData.id,
        customerPhone: conversationData.customerPhone,
        customerName: conversationData.customerName,
        status: conversationData.status,
        participants: conversationData.participants || [],
        workspaceId: conversationData.workspaceId,
        tenantId: conversationData.tenantId,
        createdAt: conversationData.createdAt,
        lastMessageAt: conversationData.lastMessageAt
      };
    }

    return context;

  } catch (error) {
    logger.error('❌ Error cargando contexto con metadata', {
      conversationId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Obtener resumen del contexto (útil para prompts)
 */
function generateContextSummary(context) {
  try {
    const { messages, conversation } = context;
    
    if (!messages || messages.length === 0) {
      return {
        summary: 'Conversación vacía',
        messageCount: 0,
        lastActivity: null
      };
    }

    // Contar mensajes por rol
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;

    // Obtener último mensaje
    const lastMessage = messages[messages.length - 1];

    // Generar resumen básico
    const summary = `Conversación con ${userMessages} mensajes del cliente y ${assistantMessages} respuestas del agente. Último mensaje: "${lastMessage.content.substring(0, 100)}${lastMessage.content.length > 100 ? '...' : ''}"`;

    return {
      summary,
      messageCount: messages.length,
      userMessages,
      assistantMessages,
      lastActivity: lastMessage.timestamp,
      customerPhone: conversation?.customerPhone,
      customerName: conversation?.customerName
    };

  } catch (error) {
    logger.error('❌ Error generando resumen de contexto', {
      error: error.message
    });

    return {
      summary: 'Error generando resumen',
      messageCount: 0,
      lastActivity: null
    };
  }
}

/**
 * Validar si el contexto es válido para IA
 */
function validateContextForAI(context) {
  const validations = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Verificar que hay mensajes
  if (!context.messages || context.messages.length === 0) {
    validations.isValid = false;
    validations.errors.push('No hay mensajes en el contexto');
  }

  // Verificar límite de tokens
  if (context.totalTokens > 4000) {
    validations.warnings.push('Contexto muy largo, puede exceder límites de tokens');
  }

  // Verificar que hay al menos un mensaje del usuario
  const userMessages = context.messages.filter(m => m.role === 'user');
  if (userMessages.length === 0) {
    validations.warnings.push('No hay mensajes del usuario en el contexto');
  }

  // Verificar tiempo de carga
  if (context.loadTimeMs > 150) {
    validations.warnings.push('Tiempo de carga lento para contexto');
  }

  return validations;
}

module.exports = {
  loadConversationContext,
  loadConversationContextWithMetadata,
  generateContextSummary,
  validateContextForAI
};