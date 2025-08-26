/**
 * ⚡ REQUEST OPTIMIZATION SERVICE
 *
 * Optimiza cada request al proveedor LLM:
 * - Comprime contexto (reciente + relevante)
 * - Optimiza conteo de tokens (truncation, summarization hints)
 * - Selecciona el mejor modelo según intención y costo/latencia
 * - Define configuración óptima (temperature, maxTokens)
 *
 * @version 1.0.0
 */

const { copilotCacheService } = require('./CopilotCacheService');
const logger = require('../utils/logger');

class RequestOptimizationService {
  constructor() {
    this.cacheService = copilotCacheService;
  }

  /**
   * Comprimir contexto: mantener mensajes más relevantes y resumen breve
   */
  async compressContext(context) {
    try {
      if (!context) return { recentMessages: [], summary: '' };

      const recentMessages = (context.recentMessages || []).slice(0, 5);
      const summary = context.conversationSummary || '';

      return { recentMessages, summary };
    } catch (error) {
      logger.warn('Error comprimiendo contexto', { error: error.message });
      return { recentMessages: [], summary: '' };
    }
  }

  /**
   * Optimizar tokens: recortar mensajes largos, limitar campos
   */
  async optimizeTokens(compressedContext) {
    const MAX_MSG_LEN = 600; // caracteres

    const trimmedMessages = (compressedContext.recentMessages || []).map(m => ({
      role: m.role,
      message: (m.message || '').slice(0, MAX_MSG_LEN)
    }));

    const summary = (compressedContext.summary || '').slice(0, 800);

    return { recentMessages: trimmedMessages, summary };
  }

  /**
   * Seleccionar mejor modelo según intención y tamaño estimado
   */
  async selectBestModel(intent, estimatedTokens = 300) {
    // Por ahora lógica simple pensada para LM Studio
    if (estimatedTokens > 600) {
      return 'gpt-oss-20b';
    }
    return 'gpt-oss-20b';
  }

  /**
   * Configuración óptima por intención
   */
  async getOptimalConfig(intent) {
    const defaults = { temperature: 0.4, maxTokens: 300 };

    const perIntent = {
      price_inquiry: { temperature: 0.2, maxTokens: 220 },
      product_info: { temperature: 0.35, maxTokens: 320 },
      technical_support: { temperature: 0.2, maxTokens: 380 },
      complaint: { temperature: 0.15, maxTokens: 320 },
      general_inquiry: { temperature: 0.5, maxTokens: 260 }
    };

    return perIntent[intent] || defaults;
  }
}

// Singleton
const requestOptimizationService = new RequestOptimizationService();

module.exports = {
  RequestOptimizationService,
  requestOptimizationService
};
