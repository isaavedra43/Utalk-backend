/**
 * 🧠 INTELLIGENT PROMPT SERVICE - IA INTELIGENTE
 * 
 * Servicio de prompts inteligentes que:
 * - Analiza mensajes del usuario inteligentemente
 * - Crea prompts contextuales y ricos
 * - Se adapta al contexto de la conversación
 * - Proporciona análisis inteligente
 * 
 * @version 3.0.0 IA INTELIGENTE
 * @author Backend Team
 */

const { generateWithProvider } = require('../ai/vendors');
const logger = require('../utils/logger');

class IntelligentPromptService {
  /**
   * Analizar mensaje inteligentemente
   */
  async analyzeUserMessage(message) {
    try {
      const analysis = await this.performIntelligentAnalysis(message);
      
      logger.debug('Análisis inteligente completado', {
        messageLength: message.length,
        intent: analysis.intent,
        emotion: analysis.emotion,
        complexity: analysis.complexity
      });

      return analysis;

    } catch (error) {
      logger.warn('Error en análisis inteligente', { error: error.message });
      return this.getDefaultAnalysis(message);
    }
  }

  /**
   * Análisis inteligente del mensaje
   */
  async performIntelligentAnalysis(message) {
    try {
      const prompt = `Analiza este mensaje de atención al cliente de manera inteligente:

MENSAJE: "${message}"

Proporciona análisis en JSON:
{
  "intent": "qué quiere el cliente",
  "emotion": "estado emocional",
  "urgency": "nivel de urgencia",
  "complexity": "complejidad del problema",
  "keyTopics": ["temas principales"],
  "suggestedActions": ["acciones recomendadas"],
  "tone": "tono de respuesta recomendado"
}`;

      const response = await generateWithProvider('llm_studio', {
        prompt,
        model: 'gpt-oss-20b',
        temperature: 0.3,
        maxTokens: 200,
        workspaceId: 'default'
      });

      if (!response.ok) {
        throw new Error('Error en análisis inteligente');
      }

      const parsed = JSON.parse(response.text);
      return {
        intent: parsed.intent || 'general_inquiry',
        emotion: parsed.emotion || 'neutral',
        urgency: parsed.urgency || 'normal',
        complexity: parsed.complexity || 'simple',
        keyTopics: parsed.keyTopics || [],
        suggestedActions: parsed.suggestedActions || [],
        tone: parsed.tone || 'friendly'
      };

    } catch (error) {
      logger.warn('Error en análisis inteligente', { error: error.message });
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
      keyTopics: [],
      suggestedActions: ['responder amablemente'],
      tone: 'friendly'
    };
  }

  /**
   * Crear prompt inteligente
   */
  createIntelligentPrompt(userMessage, context = {}) {
    const conversationHistory = context.conversationHistory || [];
    const agentInfo = context.agentInfo || { name: 'Agente', role: 'support' };
    const customerInfo = context.customerInfo || { name: 'Cliente', status: 'active' };
    const workspaceContext = context.workspaceContext || { businessType: 'general' };

    const recentHistory = conversationHistory
      .slice(-5)
      .map(msg => `${msg.role === 'client' ? 'Cliente' : 'Agente'}: ${msg.message}`)
      .join('\n');

    return `Eres un copiloto IA inteligente que ayuda a agentes de atención al cliente.

CONTEXTO DEL AGENTE:
- Nombre: ${agentInfo.name}
- Rol: ${agentInfo.role}

CONTEXTO DEL CLIENTE:
- Nombre: ${customerInfo.name}
- Estado: ${customerInfo.status}

CONTEXTO DE LA EMPRESA:
- Tipo: ${workspaceContext.businessType}

HISTORIAL RECIENTE:
${recentHistory || 'Nueva conversación'}

MENSAJE ACTUAL DEL CLIENTE:
"${userMessage}"

INSTRUCCIONES:
- Analiza el contexto completo
- Entiende la situación del cliente
- Proporciona una respuesta inteligente y útil
- Considera el historial de la conversación
- Sé empático y profesional
- Ofrece soluciones concretas cuando sea apropiado

RESPUESTA INTELIGENTE:
`;
  }

  /**
   * Crear prompt de fallback
   */
  createFallbackPrompt(userMessage) {
    return `Eres un asistente de atención al cliente. Responde al siguiente mensaje de manera útil y profesional.

MENSAJE DEL CLIENTE:
"${userMessage}"

RESPUESTA SUGERIDA PARA EL AGENTE:
`;
  }
}

// Singleton
const intelligentPromptService = new IntelligentPromptService();

module.exports = {
  IntelligentPromptService,
  intelligentPromptService
};
