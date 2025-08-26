/**
 * 👤 AGENT PERSONALIZATION SERVICE
 *
 * Personaliza respuestas según perfil y estilo del agente.
 * Integra con el modelo de usuarios si está disponible.
 *
 * @version 1.0.0
 */

const logger = require('../utils/logger');
const User = require('../models/User');

class AgentPersonalizationService {
  async getAgentProfile(agentId) {
    try {
      // Reutiliza modelo User si hay un campo style/preferences
      const user = await User.findById(agentId);
      if (!user) return { style: 'friendly', tone: 'neutral', signature: '' };

      return {
        style: user.preferences?.style || 'friendly',
        tone: user.preferences?.tone || 'neutral',
        signature: user.preferences?.signature || ''
      };
    } catch (error) {
      logger.warn('Error obteniendo perfil de agente', { error: error.message, agentId });
      return { style: 'friendly', tone: 'neutral', signature: '' };
    }
  }

  async analyzeAgentStyle(agentId) {
    // Placeholder simple que retorna el perfil; en futuro puede analizar historial
    return this.getAgentProfile(agentId);
  }

  async adaptResponseToAgent(response, agentId) {
    try {
      const profile = await this.getAgentProfile(agentId);
      let adapted = response;

      // Ajuste simple de tono
      if (profile.tone === 'formal') {
        adapted = adapted.replace(/(hola|hey|qué tal)/gi, 'Estimado/a');
      } else if (profile.tone === 'casual') {
        adapted = adapted.replace(/Estimado\/a/gi, 'Hola');
      }

      // Agregar firma si aplica
      if (profile.signature) {
        adapted += `\n\n${profile.signature}`;
      }

      return adapted;
    } catch (error) {
      logger.warn('Error adaptando respuesta a agente', { error: error.message, agentId });
      return response;
    }
  }
}

// Singleton
const agentPersonalizationService = new AgentPersonalizationService();

module.exports = {
  AgentPersonalizationService,
  agentPersonalizationService
};
