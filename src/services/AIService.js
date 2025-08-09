/**
 * 🤖 SERVICIO DE IA CENTRALIZADO
 * 
 * Orquestador principal para operaciones de IA. En esta fase
 * genera respuestas "fake" sin llamar a proveedores reales.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { firestore } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { aiLogger } = require('../utils/aiLogger');
const { getAIConfig, isAIEnabled } = require('../config/aiConfig');
const { 
  loadConversationContext, 
  generateContextSummary, 
  validateContextForAI 
} = require('../utils/contextLoader');

/**
 * Generar sugerencia para un mensaje (FAKE - sin IA real)
 */
async function generateSuggestionForMessage(workspaceId, conversationId, messageId, options = {}) {
  const startTime = Date.now();
  
  try {
    // Verificar si IA está habilitada para el workspace
    const aiEnabled = await isAIEnabled(workspaceId);
    if (!aiEnabled) {
      logger.info('🤖 IA deshabilitada para workspace', { workspaceId });
      return {
        success: false,
        reason: 'ai_disabled',
        workspaceId
      };
    }

    // Obtener configuración IA
    const config = await getAIConfig(workspaceId);
    
    // Log de inicio
    aiLogger.logAIStart(workspaceId, 'generate_suggestion', {
      conversationId,
      messageId,
      config: {
        model: config.defaultModel,
        temperature: config.temperature,
        maxTokens: config.maxTokens
      }
    });

    // Cargar contexto conversacional
    const context = await loadConversationContext(conversationId, {
      maxMessages: config.limits.maxContextMessages,
      workspaceId
    });

    // Validar contexto
    const contextValidation = validateContextForAI(context);
    if (!contextValidation.isValid) {
      logger.warn('⚠️ Contexto inválido para IA', {
        conversationId,
        errors: contextValidation.errors
      });

      return {
        success: false,
        reason: 'invalid_context',
        errors: contextValidation.errors,
        conversationId
      };
    }

    // Generar resumen del contexto
    const contextSummary = generateContextSummary(context);

    // Generar sugerencia FAKE (sin llamar a IA real)
    const fakeSuggestion = await generateFakeSuggestion(context, contextSummary, config);

    // Calcular métricas
    const latencyMs = Date.now() - startTime;
    const metrics = {
      model: config.defaultModel,
      tokensIn: context.totalTokens,
      tokensOut: Math.ceil(fakeSuggestion.texto.length / 4),
      latencyMs,
      costUsd: 0.001 // Costo simulado
    };

    // Log de éxito
    await aiLogger.logAISuccess(workspaceId, 'generate_suggestion', fakeSuggestion, metrics);

    // Log de sugerencia generada
    aiLogger.logSuggestionGenerated(workspaceId, conversationId, messageId, fakeSuggestion, metrics);

    logger.info('✅ Sugerencia IA generada (FAKE)', {
      workspaceId,
      conversationId,
      messageId,
      suggestionId: fakeSuggestion.id,
      confidence: fakeSuggestion.confianza,
      latencyMs
    });

    return {
      success: true,
      suggestion: fakeSuggestion,
      context: {
        messagesCount: context.totalMessages,
        totalTokens: context.totalTokens,
        summary: contextSummary.summary
      },
      metrics
    };

  } catch (error) {
    const latencyMs = Date.now() - startTime;
    
    // Log de error
    aiLogger.logAIError(workspaceId, 'generate_suggestion', error, {
      latencyMs
    });

    logger.error('❌ Error generando sugerencia IA', {
      workspaceId,
      conversationId,
      messageId,
      error: error.message,
      latencyMs
    });

    return {
      success: false,
      reason: 'error',
      error: error.message,
      workspaceId,
      conversationId,
      messageId
    };
  }
}

/**
 * Generar sugerencia FAKE basada en el contexto
 */
async function generateFakeSuggestion(context, contextSummary, config) {
  const suggestionId = uuidv4();
  
  // Analizar el contexto para generar sugerencia contextual
  const messages = context.messages;
  const lastMessage = messages[messages.length - 1];
  
  let suggestedText = '';
  let confidence = 0.8;
  let tipo = 'respuesta_general';

  // Lógica simple para generar sugerencias contextuales
  if (messages.length === 1) {
    // Primer mensaje
    suggestedText = '¡Hola! Gracias por contactarnos. ¿En qué puedo ayudarte hoy?';
    tipo = 'saludo_inicial';
    confidence = 0.9;
  } else if (lastMessage.content.toLowerCase().includes('precio') || lastMessage.content.toLowerCase().includes('costo')) {
    suggestedText = 'Te ayudo con información sobre nuestros precios. ¿Podrías especificar qué producto o servicio te interesa?';
    tipo = 'consulta_precios';
    confidence = 0.85;
  } else if (lastMessage.content.toLowerCase().includes('horario') || lastMessage.content.toLowerCase().includes('hora')) {
    suggestedText = 'Nuestro horario de atención es de lunes a viernes de 9:00 AM a 6:00 PM. ¿Te gustaría agendar una cita?';
    tipo = 'horarios_atencion';
    confidence = 0.9;
  } else if (lastMessage.content.toLowerCase().includes('problema') || lastMessage.content.toLowerCase().includes('error')) {
    suggestedText = 'Entiendo que tienes un problema. Para ayudarte mejor, ¿podrías describir más detalles sobre la situación?';
    tipo = 'soporte_tecnico';
    confidence = 0.8;
  } else if (lastMessage.content.toLowerCase().includes('gracias')) {
    suggestedText = '¡De nada! Estoy aquí para ayudarte. ¿Hay algo más en lo que pueda asistirte?';
    tipo = 'agradecimiento';
    confidence = 0.95;
  } else {
    // Respuesta genérica
    suggestedText = 'Entiendo tu consulta. Permíteme ayudarte con eso. ¿Podrías proporcionarme más detalles para darte una mejor respuesta?';
    tipo = 'respuesta_general';
    confidence = 0.7;
  }

  // Crear objeto de sugerencia
  const suggestion = {
    id: suggestionId,
    conversationId: context.conversationId,
    messageIdOrigen: lastMessage?.id || 'unknown',
    sugerencia: {
      texto: suggestedText,
      confianza: confidence,
      tipo: tipo,
      fuentes: ['contexto_conversacional'],
      contexto: {
        historialMensajes: context.totalMessages,
        ultimoMensaje: lastMessage?.content?.substring(0, 50) + '...',
        resumen: contextSummary.summary
      }
    },
    estado: 'draft',
    modelo: config.defaultModel,
    tokensEstimados: {
      in: context.totalTokens,
      out: Math.ceil(suggestedText.length / 4)
    },
    createdAt: new Date().toISOString(),
    metadata: {
      latencyMs: Math.floor(Math.random() * 1000) + 500, // Simulado
      costUsd: 0.001, // Simulado
      version: '1.0.0',
      fake: true // Marca que es una sugerencia fake
    }
  };

  return suggestion;
}

/**
 * Guardar sugerencia en Firestore
 */
async function saveSuggestion(suggestion) {
  try {
    const { conversationId } = suggestion;
    
    // Guardar en subcolección de sugerencias
    await firestore
      .collection('suggestions')
      .doc(conversationId)
      .collection('suggestions')
      .doc(suggestion.id)
      .set(suggestion);

    logger.info('✅ Sugerencia guardada en Firestore', {
      conversationId,
      suggestionId: suggestion.id
    });

    return suggestion;

  } catch (error) {
    logger.error('❌ Error guardando sugerencia', {
      suggestionId: suggestion.id,
      error: error.message
    });
    throw error;
  }
}

/**
 * Obtener sugerencias de una conversación
 */
async function getSuggestionsForConversation(conversationId, options = {}) {
  try {
    const { limit = 10, status = 'draft' } = options;

    const suggestionsRef = firestore
      .collection('suggestions')
      .doc(conversationId)
      .collection('suggestions');

    let query = suggestionsRef.orderBy('createdAt', 'desc');

    if (status) {
      query = query.where('estado', '==', status);
    }

    const snapshot = await query.limit(limit).get();

    const suggestions = [];
    snapshot.forEach(doc => {
      suggestions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    logger.info('✅ Sugerencias obtenidas', {
      conversationId,
      count: suggestions.length
    });

    return suggestions;

  } catch (error) {
    logger.error('❌ Error obteniendo sugerencias', {
      conversationId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Actualizar estado de una sugerencia
 */
async function updateSuggestionStatus(conversationId, suggestionId, status) {
  try {
    await firestore
      .collection('suggestions')
      .doc(conversationId)
      .collection('suggestions')
      .doc(suggestionId)
      .update({
        estado: status,
        updatedAt: new Date().toISOString()
      });

    logger.info('✅ Estado de sugerencia actualizado', {
      conversationId,
      suggestionId,
      status
    });

    return { success: true };

  } catch (error) {
    logger.error('❌ Error actualizando estado de sugerencia', {
      conversationId,
      suggestionId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Obtener estadísticas de sugerencias por workspace
 */
async function getSuggestionStats(workspaceId, days = 7) {
  try {
    // Por ahora, devolver estadísticas simuladas
    // En fases futuras, esto se calculará desde Firestore
    
    const stats = {
      total: Math.floor(Math.random() * 100) + 50,
      byStatus: {
        draft: Math.floor(Math.random() * 30) + 20,
        used: Math.floor(Math.random() * 20) + 10,
        rejected: Math.floor(Math.random() * 10) + 5
      },
      byDay: {},
      averageConfidence: 0.8,
      mostCommonType: 'respuesta_general'
    };

    // Generar datos por día
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      stats.byDay[dateStr] = {
        total: Math.floor(Math.random() * 20) + 5,
        draft: Math.floor(Math.random() * 10) + 3,
        used: Math.floor(Math.random() * 8) + 2,
        rejected: Math.floor(Math.random() * 5) + 1
      };
    }

    logger.info('✅ Estadísticas de sugerencias obtenidas', {
      workspaceId,
      days
    });

    return stats;

  } catch (error) {
    logger.error('❌ Error obteniendo estadísticas de sugerencias', {
      workspaceId,
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  generateSuggestionForMessage,
  generateFakeSuggestion,
  saveSuggestion,
  getSuggestionsForConversation,
  updateSuggestionStatus,
  getSuggestionStats
};