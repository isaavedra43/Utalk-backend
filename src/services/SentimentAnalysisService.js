/**
 * 😊 SENTIMENT ANALYSIS SERVICE
 *
 * Analiza sentimiento, urgencia y complejidad de mensajes de usuario.
 * Combina reglas simples con heurísticas y normaliza salidas.
 *
 * @version 1.0.0
 */

const logger = require('../utils/logger');

class SentimentAnalysisService {
  async analyzeSentiment(userMessage) {
    try {
      const text = (userMessage || '').toLowerCase();

      // Heurísticas básicas
      const positiveWords = ['gracias', 'excelente', 'perfecto', 'genial', 'buen', 'feliz', 'satisfecho'];
      const negativeWords = ['problema', 'error', 'molesto', 'enojado', 'mal', 'malo', 'queja', 'reclamo'];

      const positiveHits = positiveWords.filter(w => text.includes(w)).length;
      const negativeHits = negativeWords.filter(w => text.includes(w)).length;

      let sentiment = 'neutral';
      let confidence = 0.5;

      if (positiveHits > negativeHits && positiveHits > 0) {
        sentiment = 'positive';
        confidence = Math.min(0.9, 0.6 + 0.1 * positiveHits);
      } else if (negativeHits > positiveHits && negativeHits > 0) {
        sentiment = 'negative';
        confidence = Math.min(0.9, 0.6 + 0.1 * negativeHits);
      }

      return { sentiment, confidence };
    } catch (error) {
      logger.warn('Error analizando sentimiento', { error: error.message });
      return { sentiment: 'neutral', confidence: 0.5 };
    }
  }

  async detectUrgency(userMessage) {
    try {
      const text = (userMessage || '').toLowerCase();
      if (/(urgente|inmediato|rápido|ya|ahora|lo antes posible)/.test(text)) return 'high';
      if (/(pronto|próximo|fecha|cuando)/.test(text)) return 'medium';
      return 'normal';
    } catch (error) {
      return 'normal';
    }
  }

  async analyzeComplexity(userMessage) {
    try {
      const words = (userMessage || '').trim().split(/\s+/).length;
      if (words > 50) return 'complex';
      if (words > 20) return 'medium';
      return 'simple';
    } catch (error) {
      return 'simple';
    }
  }
}

// Singleton
const sentimentAnalysisService = new SentimentAnalysisService();

module.exports = {
  SentimentAnalysisService,
  sentimentAnalysisService
};
