/**
 * 🧾 PROFESSIONAL RESPONSE SERVICE
 *
 * Genera y optimiza respuestas profesionales para agentes,
 * reutilizando el proveedor LLM Studio y el contexto disponible.
 *
 * @version 1.0.0
 */

const { generateWithProvider } = require('../ai/vendors');
const logger = require('../utils/logger');

class ProfessionalResponseService {
  async generateProfessionalResponse(context, clientInfo = {}) {
    try {
      const { conversationMemory, analysis } = context || {};
      const summary = conversationMemory?.conversationSummary || '';
      const intent = analysis?.intent || 'general_inquiry';

      const prompt = `
Eres un redactor profesional de atención al cliente.
Escribe una respuesta clara, concisa y profesional, lista para enviar al cliente.
Mantén tono cordial y resolutivo, adaptado al español.

Resumen de conversación: ${summary}
Intención detectada: ${intent}

Genera solo el texto de la respuesta final (sin encabezados):
`;

      const resp = await generateWithProvider('llm_studio', {
        prompt,
        model: 'gpt-oss-20b',
        temperature: 0.25,
        maxTokens: 250,
        workspaceId: 'default'
      });

      if (!resp.ok) return '';
      return (resp.text || '').trim();
    } catch (error) {
      logger.warn('Error generando respuesta profesional', { error: error.message });
      return '';
    }
  }

  async optimizeExistingResponse(response) {
    try {
      if (!response || response.length < 20) return response || '';

      const prompt = `
Mejora el siguiente texto para que sea profesional, claro y conciso.
Corrige gramática y estilo manteniendo el contenido original.
Devuelve solo el texto optimizado.

Texto:
"""
${response}
"""
`;

      const resp = await generateWithProvider('llm_studio', {
        prompt,
        model: 'gpt-oss-20b',
        temperature: 0.15,
        maxTokens: 220,
        workspaceId: 'default'
      });

      if (!resp.ok) return response;
      return (resp.text || '').trim();
    } catch (error) {
      return response;
    }
  }

  async generateQuickResponse(urgency, context) {
    try {
      const tone = urgency === 'high' ? 'directo y breve' : urgency === 'medium' ? 'claro y cortés' : 'amable';
      const topic = context?.analysis?.intent || 'consulta general';

      const prompt = `
Genera una respuesta ultra breve (${tone}) para un cliente sobre: ${topic}.
Máximo 2 oraciones.
`;

      const resp = await generateWithProvider('llm_studio', {
        prompt,
        model: 'gpt-oss-20b',
        temperature: 0.35,
        maxTokens: 80,
        workspaceId: 'default'
      });

      if (!resp.ok) return '';
      return (resp.text || '').trim();
    } catch (error) {
      return '';
    }
  }
}

// Singleton
const professionalResponseService = new ProfessionalResponseService();

module.exports = {
  ProfessionalResponseService,
  professionalResponseService
};
