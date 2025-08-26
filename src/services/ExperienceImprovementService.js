/**
 * 🌟 EXPERIENCE IMPROVEMENT SERVICE
 *
 * Identifica gaps en la experiencia del cliente y sugiere mejoras.
 *
 * @version 1.0.0
 */

const logger = require('../utils/logger');

class ExperienceImprovementService {
  async identifyExperienceGaps(conversation) {
    try {
      const messages = conversation?.recentMessages || [];
      const gaps = [];

      const hasLongSilences = false; // Placeholder: requiere timestamps
      const repeatedQuestions = this.detectRepeatedQuestions(messages);

      if (hasLongSilences) gaps.push('Reducir tiempos muertos en conversación');
      if (repeatedQuestions) gaps.push('Asegurar que las respuestas sean completas para evitar repreguntas');

      return gaps;
    } catch (error) {
      return [];
    }
  }

  detectRepeatedQuestions(messages) {
    const questions = messages.filter(m => /\?|¿/.test(m.message || ''));
    const normalized = new Set();
    for (const q of questions) {
      const key = (q.message || '').toLowerCase().replace(/[^\w\s]/g, '').slice(0, 30);
      if (normalized.has(key)) return true;
      normalized.add(key);
    }
    return false;
  }

  async suggestImprovements(context) {
    try {
      const intent = context?.analysis?.intent || 'general_inquiry';
      const improvements = [];
      if (intent === 'product_info') improvements.push('Agregar ficha técnica breve en la respuesta');
      if (intent === 'price_inquiry') improvements.push('Incluir validez de precio y tiempos de entrega');
      improvements.push('Usar bullets para mejorar legibilidad');
      return improvements;
    } catch (error) {
      return [];
    }
  }

  async generateEnhancementPlan(context) {
    try {
      return [
        '1) Estandarizar tono y estilo en respuestas',
        '2) Añadir snippets reutilizables por intención',
        '3) Implementar seguimiento automático post-respuesta'
      ];
    } catch (error) {
      return [];
    }
  }
}

// Singleton
const experienceImprovementService = new ExperienceImprovementService();

module.exports = {
  ExperienceImprovementService,
  experienceImprovementService
};
