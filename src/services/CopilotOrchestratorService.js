/**
 * 🧠 COPILOT ORCHESTRATOR SERVICE - IA INTELIGENTE
 *
 * Orquesta el copiloto IA para generar respuestas inteligentes y contextuales
 * usando una sola llamada principal con contexto completo y rico.
 *
 * @version 3.0.0 IA INTELIGENTE
 */

const { copilotCacheService } = require('./CopilotCacheService');
const { copilotMemoryService } = require('./CopilotMemoryService');
const { generateWithProvider, isProviderAvailable } = require('../ai/vendors');
const logger = require('../utils/logger');

class CopilotOrchestratorService {
  async processMessage(userMessage, conversationId, agentId, workspaceId) {
    const start = Date.now();

    try {
      // 1. Verificar cache inteligente
      const cached = await copilotCacheService.getCachedResponse(userMessage, { conversationId, agentId });
      if (cached) {
        logger.info('✅ Respuesta cacheada encontrada', { conversationId, agentId });
        return { ok: true, text: cached, source: 'cache' };
      }

      // 2. Construir contexto completo e inteligente
      const intelligentContext = await this.buildIntelligentContext(conversationId, agentId, workspaceId);
      
      // 3. Analizar mensaje inteligentemente
      const messageAnalysis = await this.analyzeMessageIntelligence(userMessage, intelligentContext);
      
      // 4. Crear prompt inteligente
      const intelligentPrompt = this.createIntelligentPrompt(userMessage, intelligentContext, messageAnalysis);
      
      // 5. Generar respuesta con IA inteligente
      let llmResponse = await generateWithProvider('llm_studio', {
        prompt: intelligentPrompt,
        model: 'gpt-oss-20b',
        temperature: 0.7, // Más creatividad para respuestas inteligentes
        maxTokens: 400,
        workspaceId,
        conversationId
      });

      // 6. Fallback a OpenAI si LLM Studio falla
      if (!llmResponse.ok && isProviderAvailable('openai')) {
        logger.warn('LLM Studio falló, aplicando fallback a OpenAI');
        llmResponse = await generateWithProvider('openai', {
          prompt: intelligentPrompt,
          model: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 400,
          workspaceId,
          conversationId
        });
      }

      if (!llmResponse.ok) {
        logger.error('❌ Error en generación de respuesta IA', { error: llmResponse.message });
        return { ok: false, error: llmResponse.message || 'Error de IA' };
      }

      // 7. Enriquecer respuesta con insights inteligentes
      const enrichedResponse = await this.enrichResponseWithInsights(
        llmResponse.text, 
        messageAnalysis, 
        intelligentContext
      );

      // 8. Cache y memoria inteligente
      await copilotCacheService.cacheResponse(userMessage, { conversationId, agentId }, enrichedResponse);
      await copilotMemoryService.addToMemory(conversationId, userMessage, enrichedResponse);

      // 9. Log de éxito
      const latencyMs = Date.now() - start;
      logger.info('✅ Respuesta IA inteligente generada', {
        conversationId,
        agentId,
        responseLength: enrichedResponse.length,
        latencyMs,
        model: llmResponse.model || 'llm_studio'
      });

      return { 
        ok: true, 
        text: enrichedResponse, 
        model: llmResponse.model || 'llm_studio',
        usage: llmResponse.usage,
        suggestions: messageAnalysis.suggestedActions || []
      };

    } catch (error) {
      logger.error('❌ Error en orquestador IA inteligente', { error: error.message });
      return { ok: false, error: error.message };
    }
  }

  /**
   * Construir contexto completo e inteligente
   */
  async buildIntelligentContext(conversationId, agentId, workspaceId) {
    try {
      // Obtener historial de conversación
      const conversationHistory = await this.getConversationHistory(conversationId);
      
      // Obtener información del agente
      const agentInfo = await this.getAgentInfo(agentId);
      
      // Obtener información del cliente
      const customerInfo = await this.getCustomerInfo(conversationId);
      
      // Obtener contexto del workspace
      const workspaceContext = await this.getWorkspaceContext(workspaceId);

      return {
        conversationHistory,
        agentInfo,
        customerInfo,
        workspaceContext,
        conversationId,
        agentId,
        workspaceId
      };
    } catch (error) {
      logger.warn('Error construyendo contexto inteligente', { error: error.message });
      return {
        conversationHistory: [],
        agentInfo: { name: 'Agente', role: 'support' },
        customerInfo: { name: 'Cliente', history: [] },
        workspaceContext: { businessType: 'general' },
        conversationId,
        agentId,
        workspaceId
      };
    }
  }

  /**
   * Obtener historial de conversación
   */
  async getConversationHistory(conversationId) {
    try {
      const history = await copilotMemoryService.getConversationMemory(conversationId);
      return history.recentMessages || [];
    } catch (error) {
      logger.warn('Error obteniendo historial', { error: error.message });
      return [];
    }
  }

  /**
   * Obtener información del agente
   */
  async getAgentInfo(agentId) {
    try {
      // Aquí podrías obtener información real del agente desde la base de datos
      return {
        id: agentId,
        name: 'Agente de Soporte',
        role: 'customer_service',
        communicationStyle: 'professional_friendly'
      };
    } catch (error) {
      logger.warn('Error obteniendo info del agente', { error: error.message });
      return { name: 'Agente', role: 'support' };
    }
  }

  /**
   * Obtener información del cliente
   */
  async getCustomerInfo(conversationId) {
    try {
      // Aquí podrías obtener información real del cliente desde la base de datos
      return {
        name: 'Cliente',
        history: [],
        status: 'active'
      };
    } catch (error) {
      logger.warn('Error obteniendo info del cliente', { error: error.message });
      return { name: 'Cliente', history: [] };
    }
  }

  /**
   * Obtener contexto del workspace
   */
  async getWorkspaceContext(workspaceId) {
    try {
      // Aquí podrías obtener información real del workspace desde la base de datos
      return {
        businessType: 'customer_service',
        products: ['servicios generales'],
        policies: ['atención profesional']
      };
    } catch (error) {
      logger.warn('Error obteniendo contexto del workspace', { error: error.message });
      return { businessType: 'general' };
    }
  }

  /**
   * Analizar mensaje inteligentemente
   */
  async analyzeMessageIntelligence(message, context) {
    try {
      const prompt = `Analiza este mensaje en el contexto de atención al cliente:

MENSAJE: "${message}"

CONTEXTO:
- Historial de conversación: ${context.conversationHistory.length} mensajes
- Agente: ${context.agentInfo.name} (${context.agentInfo.role})
- Cliente: ${context.customerInfo.name}

Proporciona análisis en JSON:
{
  "intent": "qué quiere el cliente",
  "emotion": "estado emocional",
  "urgency": "nivel de urgencia",
  "complexity": "complejidad del problema",
  "hiddenNeeds": ["necesidades no expresadas"],
  "suggestedActions": ["acciones recomendadas"],
  "tone": "tono de respuesta recomendado"
}`;

      const response = await generateWithProvider('llm_studio', {
        prompt,
        model: 'gpt-oss-20b',
        temperature: 0.3,
        maxTokens: 200,
        workspaceId: context.workspaceId
      });

      if (response.ok) {
        return JSON.parse(response.text);
      } else {
        return this.getDefaultAnalysis(message);
      }
    } catch (error) {
      logger.warn('Error analizando mensaje', { error: error.message });
      return this.getDefaultAnalysis(message);
    }
  }

  /**
   * Análisis por defecto
   */
  getDefaultAnalysis(message) {
    const text = message.toLowerCase();
    
    return {
      intent: 'general_inquiry',
      emotion: 'neutral',
      urgency: 'normal',
      complexity: 'simple',
      hiddenNeeds: [],
      suggestedActions: ['responder amablemente'],
      tone: 'friendly'
    };
  }

  /**
   * Crear prompt inteligente
   */
  createIntelligentPrompt(userMessage, context, analysis) {
    const conversationHistory = context.conversationHistory
      .slice(-5) // Últimos 5 mensajes
      .map(msg => `${msg.role === 'client' ? 'Cliente' : 'Agente'}: ${msg.message}`)
      .join('\n');

    return `Eres un copiloto IA inteligente que ayuda a agentes de atención al cliente.

CONTEXTO DEL AGENTE:
- Nombre: ${context.agentInfo.name}
- Rol: ${context.agentInfo.role}
- Estilo: ${context.agentInfo.communicationStyle}

CONTEXTO DEL CLIENTE:
- Nombre: ${context.customerInfo.name}
- Estado: ${context.customerInfo.status}

CONTEXTO DE LA EMPRESA:
- Tipo: ${context.workspaceContext.businessType}
- Productos: ${context.workspaceContext.products.join(', ')}

ANÁLISIS DEL MENSAJE:
- Intención: ${analysis.intent}
- Emoción: ${analysis.emotion}
- Urgencia: ${analysis.urgency}
- Complejidad: ${analysis.complexity}
- Necesidades ocultas: ${analysis.hiddenNeeds.join(', ')}

HISTORIAL RECIENTE:
${conversationHistory || 'Nueva conversación'}

MENSAJE ACTUAL DEL CLIENTE:
"${userMessage}"

INSTRUCCIONES:
- Analiza el contexto completo
- Entiende la situación del cliente
- Proporciona una respuesta inteligente y útil
- Considera el historial de la conversación
- Adapta tu respuesta al estilo del agente
- Sé empático y profesional
- Ofrece soluciones concretas cuando sea apropiado
- Tono recomendado: ${analysis.tone}

RESPUESTA INTELIGENTE:
`;
  }

  /**
   * Enriquecer respuesta con insights
   */
  async enrichResponseWithInsights(response, analysis, context) {
    let enrichedResponse = response;

    // Agregar insights si son relevantes
    if (analysis.hiddenNeeds.length > 0 || analysis.suggestedActions.length > 0) {
      enrichedResponse += `\n\n---\nINSIGHTS PARA EL AGENTE:\n`;
      
      if (analysis.hiddenNeeds.length > 0) {
        enrichedResponse += `• Necesidades detectadas: ${analysis.hiddenNeeds.join(', ')}\n`;
      }
      
      if (analysis.suggestedActions.length > 0) {
        enrichedResponse += `• Acciones sugeridas: ${analysis.suggestedActions.join(', ')}\n`;
      }
      
      enrichedResponse += `• Tono recomendado: ${analysis.tone}\n`;
      enrichedResponse += `• Urgencia: ${analysis.urgency}\n`;
    }

    return enrichedResponse;
  }
}

const copilotOrchestratorService = new CopilotOrchestratorService();

module.exports = {
  CopilotOrchestratorService,
  copilotOrchestratorService
};
