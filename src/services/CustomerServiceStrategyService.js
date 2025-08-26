/**
 * 🎯 CUSTOMER SERVICE STRATEGY SERVICE
 *
 * Sugiere estrategias prácticas y un plan de acción para el agente.
 *
 * @version 1.0.0
 */

const logger = require('../utils/logger');

class CustomerServiceStrategyService {
  async suggestStrategies(context) {
    try {
      const strategies = [];
      const intent = context?.analysis?.intent || 'general_inquiry';
      const urgency = context?.analysis?.urgency || 'normal';

      if (intent === 'price_inquiry') strategies.push('Ofrecer cotización clara y opciones por volumen');
      if (intent === 'technical_support') strategies.push('Proveer pasos concretos y recursos visuales');
      if (intent === 'complaint') strategies.push('Empatía, disculpa sincera y solución concreta');
      if (urgency === 'high') strategies.push('Responder primero, detalles después');

      return strategies;
    } catch (error) {
      return [];
    }
  }

  async identifyImprovementOpportunities(conversation) {
    try {
      const text = (conversation?.recentMessages || []).map(m => m.message).join(' ').toLowerCase();
      const improvements = [];
      if (/confuso|no entiendo/.test(text)) improvements.push('Usar mensajes más claros y con bullets');
      if (/tarde|demora/.test(text)) improvements.push('Acelerar tiempos de respuesta');
      return improvements;
    } catch (error) {
      return [];
    }
  }

  async generateActionPlan(context) {
    try {
      const plan = [];
      const intent = context?.analysis?.intent || 'general_inquiry';

      if (intent === 'price_inquiry') {
        plan.push('1) Confirmar cantidades y especificaciones');
        plan.push('2) Enviar cotización en PDF con validez');
        plan.push('3) Ofrecer descuento por volumen');
      } else if (intent === 'technical_support') {
        plan.push('1) Identificar versión y entorno');
        plan.push('2) Proveer pasos de diagnóstico');
        plan.push('3) Agendar seguimiento si persiste');
      } else {
        plan.push('1) Confirmar necesidad del cliente');
        plan.push('2) Proveer información relevante');
        plan.push('3) Ofrecer apoyo adicional');
      }

      return plan;
    } catch (error) {
      return [];
    }
  }
}

// Singleton
const customerServiceStrategyService = new CustomerServiceStrategyService();

module.exports = {
  CustomerServiceStrategyService,
  customerServiceStrategyService
};
