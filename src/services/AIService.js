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
const { generateWithProvider } = require('../ai/vendors');
const { buildPromptWithGuardrails } = require('../ai/vendors/openai');

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

    // Generar sugerencia con proveedor real o fake según configuración
    let suggestion;
    if (config.flags.provider_ready && config.provider === 'openai') {
      suggestion = await generateRealSuggestion(context, contextSummary, config);
    } else {
      suggestion = await generateFakeSuggestion(context, contextSummary, config);
    }

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
    await aiLogger.logAISuccess(workspaceId, 'generate_suggestion', suggestion, metrics);

    // Log de sugerencia generada
    aiLogger.logSuggestionGenerated(workspaceId, conversationId, messageId, suggestion, metrics);

    const isReal = config.flags.provider_ready && config.provider === 'openai';
    logger.info(`✅ Sugerencia IA generada (${isReal ? 'REAL' : 'FAKE'})`, {
      workspaceId,
      conversationId,
      messageId,
      suggestionId: suggestion.id,
      confidence: suggestion.confianza,
      latencyMs,
      provider: config.provider
    });

    return {
      success: true,
      suggestion: suggestion,
      context: {
        messagesCount: context.totalMessages,
        totalTokens: context.totalTokens,
        summary: contextSummary.summary
      },
      metrics,
      provider: config.provider,
      isReal: isReal
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
 * Generar sugerencia REAL con proveedor de IA
 */
async function generateRealSuggestion(context, contextSummary, config) {
  const suggestionId = uuidv4();
  
  try {
    // Construir prompt con guardrails
    const prompt = buildPromptWithGuardrails(context, config);
    
    // Generar con proveedor real
    const result = await generateWithProvider(config.provider, {
      model: config.defaultModel,
      prompt: prompt,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      workspaceId: context.workspaceId,
      conversationId: context.conversationId
    });

    if (!result.ok) {
      logger.warn('⚠️ Error generando sugerencia real, fallback a fake', {
        error: result.error,
        message: result.message,
        conversationId: context.conversationId
      });
      
      // Fallback a sugerencia fake
      return await generateFakeSuggestion(context, contextSummary, config);
    }

    // Procesar respuesta del proveedor
    const suggestedText = result.text || 'No se pudo generar una respuesta.';
    const confidence = calculateConfidence(result.text, context);
    const tipo = determineSuggestionType(result.text, context);

    // Crear objeto de sugerencia
    const suggestion = {
      id: suggestionId,
      conversationId: context.conversationId,
      messageIdOrigen: context.messages[context.messages.length - 1]?.id || 'unknown',
      sugerencia: {
        texto: suggestedText,
        confianza: confidence,
        tipo: tipo,
        fuentes: ['proveedor_ia_real'],
        contexto: {
          historialMensajes: context.totalMessages,
          ultimoMensaje: context.messages[context.messages.length - 1]?.content?.substring(0, 50) + '...',
          resumen: contextSummary.summary
        }
      },
      estado: 'draft',
      modelo: config.defaultModel,
      proveedor: config.provider,
      tokensEstimados: {
        in: result.usage.in,
        out: result.usage.out
      },
      createdAt: new Date().toISOString(),
      metadata: {
        latencyMs: result.usage.latencyMs,
        costUsd: estimateCost(result.usage.in, result.usage.out, config.defaultModel),
        version: '1.0.0',
        real: true,
        provider: config.provider
      }
    };

    return suggestion;

  } catch (error) {
    logger.error('❌ Error generando sugerencia real', {
      error: error.message,
      conversationId: context.conversationId
    });
    
    // Fallback a sugerencia fake
    return await generateFakeSuggestion(context, contextSummary, config);
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
 * Calcular confianza de la sugerencia
 */
function calculateConfidence(text, context) {
  if (!text || text.length < 10) return 0.3;
  
  // Factores que aumentan la confianza
  let confidence = 0.5;
  
  // Longitud apropiada
  if (text.length >= 20 && text.length <= 200) confidence += 0.2;
  
  // Contiene palabras clave profesionales
  const professionalWords = ['ayudar', 'asistir', 'informar', 'proporcionar', 'ofrecer'];
  const hasProfessionalWords = professionalWords.some(word => 
    text.toLowerCase().includes(word)
  );
  if (hasProfessionalWords) confidence += 0.1;
  
  // No contiene palabras problemáticas
  const problematicWords = ['no sé', 'no tengo', 'no puedo', 'no disponible'];
  const hasProblematicWords = problematicWords.some(word => 
    text.toLowerCase().includes(word)
  );
  if (!hasProblematicWords) confidence += 0.1;
  
  // Termina con puntuación apropiada
  if (text.endsWith('.') || text.endsWith('?') || text.endsWith('!')) confidence += 0.1;
  
  return Math.min(0.95, confidence);
}

/**
 * Determinar tipo de sugerencia
 */
function determineSuggestionType(text, context) {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('hola') || lowerText.includes('gracias')) {
    return 'saludo';
  }
  
  if (lowerText.includes('precio') || lowerText.includes('costo') || lowerText.includes('valor')) {
    return 'consulta_precios';
  }
  
  if (lowerText.includes('horario') || lowerText.includes('hora') || lowerText.includes('disponible')) {
    return 'horarios_atencion';
  }
  
  if (lowerText.includes('problema') || lowerText.includes('error') || lowerText.includes('ayuda')) {
    return 'soporte_tecnico';
  }
  
  if (lowerText.includes('?') || lowerText.includes('pregunta')) {
    return 'pregunta';
  }
  
  return 'respuesta_general';
}

/**
 * Estimar costo de tokens
 */
function estimateCost(tokensIn, tokensOut, model) {
  const costs = {
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 }
  };
  
  const modelCosts = costs[model] || costs['gpt-4o-mini'];
  const inputCost = (tokensIn / 1000) * modelCosts.input;
  const outputCost = (tokensOut / 1000) * modelCosts.output;
  
  return inputCost + outputCost;
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
  generateRealSuggestion,
  generateFakeSuggestion,
  saveSuggestion,
  getSuggestionsForConversation,
  updateSuggestionStatus,
  getSuggestionStats
};