/**
 * 🗣️ CONVERSATION ANALYSIS SERVICE
 *
 * Analiza la conversación para extraer tono, sentimiento acumulado
 * y oportunidades de negocio/comunicación.
 *
 * @version 1.0.0
 */

const { sentimentAnalysisService } = require('./SentimentAnalysisService');
const logger = require('../utils/logger');

class ConversationAnalysisService {
  async analyzeTone(conversation) {
    try {
      const text = this.flattenConversation(conversation);
      const sentiment = await sentimentAnalysisService.analyzeSentiment(text);
      const urgency = await sentimentAnalysisService.detectUrgency(text);
      return { tone: this.mapTone(sentiment.sentiment, urgency), sentiment: sentiment.sentiment, urgency };
    } catch (error) {
      return { tone: 'neutral', sentiment: 'neutral', urgency: 'normal' };
    }
  }

  async analyzeSentiment(conversation) {
    try {
      const text = this.flattenConversation(conversation);
      return await sentimentAnalysisService.analyzeSentiment(text);
    } catch (error) {
      return { sentiment: 'neutral', confidence: 0.5 };
    }
  }

  async identifyOpportunities(conversation) {
    try {
      const text = this.flattenConversation(conversation).toLowerCase();
      const opportunities = [];
      if (/cotizaci[óo]n|precio|presupuesto/.test(text)) opportunities.push('Ofrecer cotización detallada');
      if (/muestra|sample/.test(text)) opportunities.push('Ofrecer muestra de producto');
      if (/env[íi]o|entrega/.test(text)) opportunities.push('Aclarar tiempos y costos de envío');
      if (/garant[íi]a|devoluci[óo]n/.test(text)) opportunities.push('Resaltar políticas de garantía');
      return opportunities;
    } catch (error) {
      return [];
    }
  }

  flattenConversation(conversation) {
    const recent = conversation?.recentMessages || [];
    return recent.map(m => `[${m.role}] ${m.message}`).join(' ');
  }

  mapTone(sentiment, urgency) {
    if (sentiment === 'negative') return urgency === 'high' ? 'crítico' : 'delicado';
    if (sentiment === 'positive') return 'positivo';
    return 'neutral';
  }
}

// Singleton
const conversationAnalysisService = new ConversationAnalysisService();

module.exports = {
  ConversationAnalysisService,
  conversationAnalysisService
};
