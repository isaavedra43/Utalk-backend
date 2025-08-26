/**
 * 🧠 COPILOT ORCHESTRATOR SERVICE - IA INTELIGENTE SIMPLE
 *
 * Orquesta el copiloto IA con prompts simples y directos
 * para generar respuestas inteligentes sin complejidad innecesaria.
 *
 * @version 4.0.0 IA INTELIGENTE SIMPLE
 */

const { copilotCacheService } = require('./CopilotCacheService');
const { copilotMemoryService } = require('./CopilotMemoryService');
const { generateWithProvider, isProviderAvailable } = require('../ai/vendors');
const logger = require('../utils/logger');

class CopilotOrchestratorService {
  async processMessage(userMessage, conversationId, agentId, workspaceId) {
    const start = Date.now();

    try {
      // Validar workspaceId con fallback simple
      const finalWorkspaceId = workspaceId || 'default_workspace';

      logger.info('🚀 Orquestador iniciando procesamiento', {
        userMessage: userMessage.substring(0, 50),
        conversationId,
        agentId,
        workspaceId: finalWorkspaceId
      });

      // 1. Verificar cache
      const cached = await copilotCacheService.getCachedResponse(userMessage, { conversationId, agentId });
      if (cached) {
        logger.info('✅ Respuesta cacheada encontrada', { conversationId, agentId });
        return { ok: true, text: cached, source: 'cache' };
      }

      // 2. Crear prompt simple
      const simplePrompt = this.createSimplePrompt(userMessage, conversationId);
      
      // 3. Generar respuesta con IA - LLM Studio
      let llmResponse;
      try {
        llmResponse = await generateWithProvider('llm_studio', {
          prompt: simplePrompt,
          model: 'gpt-oss-20b',
          temperature: 0.7,
          maxTokens: 200,
          workspaceId: finalWorkspaceId,
          conversationId
        });
      } catch (llmError) {
        logger.warn('LLM Studio falló, intentando OpenAI', { error: llmError.message });
        llmResponse = { ok: false, error: llmError.message };
      }

      // 4. Fallback a OpenAI si LLM Studio falla
      if (!llmResponse.ok && isProviderAvailable('openai')) {
        try {
          llmResponse = await generateWithProvider('openai', {
            prompt: simplePrompt,
            model: 'gpt-4o-mini',
            temperature: 0.7,
            maxTokens: 200,
            workspaceId: finalWorkspaceId,
            conversationId
          });
        } catch (openaiError) {
          logger.error('OpenAI también falló', { error: openaiError.message });
          llmResponse = { ok: false, error: openaiError.message };
        }
      }

      // 5. Si ambos fallan, usar respuesta por defecto
      if (!llmResponse.ok) {
        logger.warn('Ambos proveedores fallaron, usando respuesta por defecto', {
          llmError: llmResponse.error
        });
        
        const defaultResponse = this.getDefaultResponse(userMessage);
        
        // Cache y memoria
        await copilotCacheService.cacheResponse(userMessage, { conversationId, agentId }, defaultResponse);
        await copilotMemoryService.addToMemory(conversationId, userMessage, defaultResponse);

        return { 
          ok: true, 
          text: defaultResponse, 
          model: 'fallback',
          usage: { in: 0, out: 0, latencyMs: Date.now() - start },
          suggestions: []
        };
      }

      // 6. Procesar respuesta exitosa
      let finalResponse = llmResponse.text.trim();
      
      // Si la respuesta está vacía, usar respuesta por defecto
      if (!finalResponse || finalResponse.length < 5) {
        logger.warn('Respuesta IA vacía, usando respuesta por defecto');
        finalResponse = this.getDefaultResponse(userMessage);
      }

      // 7. Cache y memoria
      await copilotCacheService.cacheResponse(userMessage, { conversationId, agentId }, finalResponse);
      await copilotMemoryService.addToMemory(conversationId, userMessage, finalResponse);

      // 8. Log de éxito
      const latencyMs = Date.now() - start;
      logger.info('✅ Respuesta IA generada exitosamente', {
        conversationId,
        agentId,
        workspaceId: finalWorkspaceId,
        responseLength: finalResponse.length,
        latencyMs,
        model: llmResponse.model || 'llm_studio'
      });

      return { 
        ok: true, 
        text: finalResponse, 
        model: llmResponse.model || 'llm_studio',
        usage: llmResponse.usage || { in: 0, out: 0, latencyMs },
        suggestions: []
      };

    } catch (error) {
      logger.error('❌ Error crítico en orquestador IA', { 
        error: error.message,
        stack: error.stack,
        workspaceId: workspaceId || 'undefined'
      });
      return { ok: false, error: error.message };
    }
  }

  /**
   * Crear prompt inteligente y contextual
   */
  createSimplePrompt(userMessage, conversationId) {
    return `Eres un asistente de atención al cliente. Responde directamente al mensaje del cliente de manera útil y profesional.

MENSAJE DEL CLIENTE: "${userMessage}"

RESPUESTA:`;
  }

  /**
   * Limpiar y corregir respuestas problemáticas del modelo
   */
  cleanResponse(response) {
    if (!response) return response;
    
    // Detectar meta-instrucciones comunes
    const metaInstructions = [
      /no uses código markdown/i,
      /no incluyas ninguna explicación/i,
      /solo la respuesta final/i,
      /responde en español/i,
      /evita el lenguaje ofensivo/i,
      /mantente profesional/i,
      /luego responde/i,
      /2\)/i,
      /3\)/i
    ];
    
    // Si la respuesta contiene meta-instrucciones, usar respuesta por defecto
    const hasMetaInstructions = metaInstructions.some(pattern => pattern.test(response));
    if (hasMetaInstructions) {
      logger.warn('Meta-instrucciones detectadas en respuesta, usando respuesta por defecto', { response });
      return null; // Forzar uso de respuesta por defecto
    }
    
    // Remover comillas extra al inicio y final
    response = response.replace(/^["']+|["']+$/g, '');
    
    // Remover espacios extra
    response = response.trim();
    
    return response;
  }

  /**
   * Respuesta inteligente por defecto si la IA falla
   */
  getDefaultResponse(userMessage) {
    const text = userMessage.toLowerCase().trim();
    
    // Saludos
    if (/^(hola|buenos días|buenas|hi|hello|hey)$/.test(text)) {
      return '¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?';
    }
    
    // Despedidas
    if (/^(adiós|chao|bye|goodbye|hasta luego|nos vemos)$/.test(text)) {
      return '¡Que tengas un excelente día! No dudes en contactarnos si necesitas ayuda en el futuro.';
    }
    
    // Agradecimientos
    if (/^(gracias|thank you|thanks|muchas gracias)$/.test(text)) {
      return '¡De nada! Es un placer ayudarte. ¿Hay algo más en lo que pueda asistirte?';
    }
    
    // Preguntas sobre capacidad de pensamiento
    if (/puedes pensar|eres inteligente|tienes conciencia|eres real/i.test(text)) {
      return 'Soy un asistente virtual diseñado para ayudarte. Aunque no tengo conciencia como un humano, puedo procesar información y ayudarte con tus consultas de manera efectiva. ¿En qué puedo asistirte?';
    }
    
    // Preguntas sobre el nombre
    if (/como te llamas|cuál es tu nombre|quien eres/i.test(text)) {
      return 'Soy tu asistente virtual de atención al cliente. Estoy aquí para ayudarte con cualquier consulta que tengas. ¿En qué puedo asistirte?';
    }
    
    // Preguntas sobre respuestas prefijadas
    if (/respuestas prefijadas|respuestas falsas|estás programado/i.test(text)) {
      return 'Entiendo tu preocupación. Mi objetivo es ayudarte de la mejor manera posible. Cada respuesta que doy está basada en el contexto de tu mensaje. ¿Cómo puedo ayudarte específicamente con tu consulta?';
    }
    
    // Preguntas complejas o críticas
    if (text.length > 50 || /por qué|explica|analiza/i.test(text)) {
      return 'Entiendo tu pregunta. Para darte la mejor respuesta posible, ¿podrías ser más específico sobre lo que necesitas? Estoy aquí para ayudarte.';
    }
    
    // Respuesta genérica para otros casos
    return 'Entiendo tu mensaje. Para ayudarte mejor, ¿podrías proporcionarme más detalles sobre lo que necesitas?';
  }
}

const copilotOrchestratorService = new CopilotOrchestratorService();

module.exports = {
  CopilotOrchestratorService,
  copilotOrchestratorService
};
