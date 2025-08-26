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
      // 1. Verificar cache
      const cached = await copilotCacheService.getCachedResponse(userMessage, { conversationId, agentId });
      if (cached) {
        logger.info('✅ Respuesta cacheada encontrada', { conversationId, agentId });
        return { ok: true, text: cached, source: 'cache' };
      }

      // 2. Crear prompt ultra simple y directo
      const simplePrompt = this.createSimplePrompt(userMessage, conversationId);
      
      // 3. Generar respuesta con IA
      let llmResponse = await generateWithProvider('llm_studio', {
        prompt: simplePrompt,
        model: 'gpt-oss-20b',
        temperature: 0.7,
        maxTokens: 200,
        workspaceId,
        conversationId
      });

      // 4. Fallback a OpenAI si LLM Studio falla
      if (!llmResponse.ok && isProviderAvailable('openai')) {
        logger.warn('LLM Studio falló, aplicando fallback a OpenAI');
        llmResponse = await generateWithProvider('openai', {
          prompt: simplePrompt,
          model: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 200,
          workspaceId,
          conversationId
        });
      }

      if (!llmResponse.ok) {
        logger.error('❌ Error en generación de respuesta IA', { error: llmResponse.message });
        return { ok: false, error: llmResponse.message || 'Error de IA' };
      }

      // 5. Procesar respuesta
      let finalResponse = llmResponse.text.trim();
      
      // Si la respuesta está vacía o es muy corta, usar respuesta por defecto
      if (!finalResponse || finalResponse.length < 5) {
        finalResponse = this.getDefaultResponse(userMessage);
      }

      // 6. Cache y memoria
      await copilotCacheService.cacheResponse(userMessage, { conversationId, agentId }, finalResponse);
      await copilotMemoryService.addToMemory(conversationId, userMessage, finalResponse);

      // 7. Log de éxito
      const latencyMs = Date.now() - start;
      logger.info('✅ Respuesta IA generada', {
        conversationId,
        agentId,
        responseLength: finalResponse.length,
        latencyMs,
        model: llmResponse.model || 'llm_studio'
      });

      return { 
        ok: true, 
        text: finalResponse, 
        model: llmResponse.model || 'llm_studio',
        usage: llmResponse.usage,
        suggestions: []
      };

    } catch (error) {
      logger.error('❌ Error en orquestador IA', { error: error.message });
      return { ok: false, error: error.message };
    }
  }

  /**
   * Crear prompt ultra simple y directo
   */
  createSimplePrompt(userMessage, conversationId) {
    return `Eres un asistente de atención al cliente. Responde al siguiente mensaje de manera útil y profesional.

Mensaje del cliente: "${userMessage}"

Responde de manera natural y útil:`;
  }

  /**
   * Respuesta por defecto si la IA falla
   */
  getDefaultResponse(userMessage) {
    const text = userMessage.toLowerCase();
    
    if (/^(hola|buenos días|buenas|hi|hello)$/.test(text)) {
      return '¡Hola! Gracias por contactarnos. ¿En qué puedo ayudarte hoy?';
    }
    
    if (/^(gracias|thank you|thanks)$/.test(text)) {
      return '¡De nada! Estoy aquí para ayudarte. ¿Hay algo más en lo que pueda asistirte?';
    }
    
    if (/^(adiós|chao|bye|goodbye)$/.test(text)) {
      return '¡Que tengas un excelente día! No dudes en contactarnos si necesitas ayuda en el futuro.';
    }
    
    return 'Entiendo tu mensaje. ¿Podrías proporcionarme más detalles para ayudarte mejor?';
  }
}

const copilotOrchestratorService = new CopilotOrchestratorService();

module.exports = {
  CopilotOrchestratorService,
  copilotOrchestratorService
};
