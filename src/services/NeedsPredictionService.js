/**
 * 🔮 NEEDS PREDICTION SERVICE
 *
 * Predice necesidades del cliente a partir de patrones conversacionales
 * y genera sugerencias proactivas para el agente.
 *
 * @version 1.0.0
 */

const logger = require('../utils/logger');

class NeedsPredictionService {
  async analyzeConversationPatterns(conversation) {
    try {
      const text = (conversation || '').toLowerCase();
      const patterns = {
        interest: /(me interesa|quiero|necesito|estoy buscando|me gustaría)/,
        priceSensitivity: /(caro|carísimo|descuento|rebaja|promoción|oferta)/,
        urgency: /(urgente|hoy|mañana|lo antes posible|rápido|inmediato)/,
        quantity: /(\b\d+\b\s*(m|m2|metros|piezas|unidades|mts|metros cuadrados))/,
        trust: /(garantía|devolución|calidad|prueba|muestra)/
      };

      const detected = Object.entries(patterns)
        .filter(([_, regex]) => regex.test(text))
        .map(([key]) => key);

      return { detected, raw: text };
    } catch (error) {
      logger.warn('Error analizando patrones', { error: error.message });
      return { detected: [], raw: '' };
    }
  }

  async detectImplicitNeeds(userMessage, patterns) {
    try {
      const needs = new Set();

      if (patterns.detected.includes('interest')) needs.add('product_match');
      if (patterns.detected.includes('priceSensitivity')) needs.add('price_offer');
      if (patterns.detected.includes('urgency')) needs.add('fast_delivery');
      if (patterns.detected.includes('quantity')) needs.add('bulk_discount');
      if (patterns.detected.includes('trust')) needs.add('guarantee_info');

      // Heurística extra desde el mensaje
      const msg = (userMessage || '').toLowerCase();
      if (/muestra|sample/.test(msg)) needs.add('sample_offer');
      if (/proyecto|cotización|cotizar|quote/.test(msg)) needs.add('quote_generation');

      return Array.from(needs);
    } catch (error) {
      logger.warn('Error detectando necesidades', { error: error.message });
      return [];
    }
  }

  async predictFutureNeeds(implicitNeeds) {
    try {
      const future = new Set();

      if (implicitNeeds.includes('product_match')) future.add('cross_sell');
      if (implicitNeeds.includes('bulk_discount')) future.add('logistics_planning');
      if (implicitNeeds.includes('fast_delivery')) future.add('inventory_check');
      if (implicitNeeds.includes('guarantee_info')) future.add('after_sales_followup');

      return Array.from(future);
    } catch (error) {
      return [];
    }
  }

  async generateProactiveSuggestions(futureNeeds) {
    try {
      const suggestions = [];

      for (const need of futureNeeds) {
        if (need === 'cross_sell') {
          suggestions.push('Sugiere productos complementarios que aumenten el valor del pedido.');
        }
        if (need === 'logistics_planning') {
          suggestions.push('Propón fechas tentativas de entrega y confirma disponibilidad logística.');
        }
        if (need === 'inventory_check') {
          suggestions.push('Verifica inventario en tiempo real y ofrece alternativas si falta stock.');
        }
        if (need === 'after_sales_followup') {
          suggestions.push('Incluye información de garantía y planea un seguimiento post-venta.');
        }
      }

      return suggestions;
    } catch (error) {
      return [];
    }
  }
}

// Singleton
const needsPredictionService = new NeedsPredictionService();

module.exports = {
  NeedsPredictionService,
  needsPredictionService
};
