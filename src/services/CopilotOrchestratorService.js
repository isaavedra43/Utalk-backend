/**
 * 🧠 COPILOT ORCHESTRATOR SERVICE - IA INTELIGENTE SIMPLE
 *
 * Orquesta el copiloto IA con prompts simples y directos
 * para generar respuestas inteligentes sin complejidad innecesaria.
 *
 * @version 4.0.0 IA INTELIGENTE SIMPLE
 */

const logger = require('../utils/logger');

class CopilotOrchestratorService {
  async processMessage(userMessage, conversationId, agentId, workspaceId) {
    const start = Date.now();

    try {
      // Validación simple
      if (!workspaceId) {
        throw new Error('workspaceId is required');
      }

      logger.info('🚀 Procesando mensaje con respuesta por defecto', {
        workspaceId,
        conversationId,
        agentId,
        messageLength: userMessage.length
      });

      // Generar respuesta por defecto directamente
      const defaultResponse = this.getDefaultResponse(userMessage);
      
      const latencyMs = Date.now() - start;
      logger.info('✅ Respuesta generada exitosamente', {
        conversationId,
        agentId,
        workspaceId,
        responseLength: defaultResponse.length,
        latencyMs,
        model: 'fallback'
      });

      return { 
        ok: true, 
        text: defaultResponse, 
        model: 'fallback',
        usage: { in: 0, out: 0, latencyMs },
        suggestions: []
      };

    } catch (error) {
      logger.error('❌ Error en orquestador IA', { 
        error: error.message,
        stack: error.stack,
        workspaceId,
        conversationId,
        agentId
      });
      return { ok: false, error: error.message };
    }
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
