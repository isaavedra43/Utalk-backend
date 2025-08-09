/**
 * 🤖 LOGGER ESPECIALIZADO PARA IA
 * 
 * Maneja logs, métricas y contadores de uso para operaciones de IA
 * sin llamar a proveedores reales en esta fase.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const logger = require('./logger');
const { firestore, FieldValue } = require('../config/firebase');

/**
 * Contador de uso diario de IA
 */
class AIUsageCounter {
  constructor() {
    this.dailyCounts = new Map();
    this.lastResetDate = new Date().toDateString();
  }

  /**
   * Incrementar contador de uso
   */
  async incrementUsage(workspaceId, operation, model = 'fake-model') {
    try {
      const today = new Date().toDateString();
      
      // Resetear contadores si es un nuevo día
      if (today !== this.lastResetDate) {
        this.dailyCounts.clear();
        this.lastResetDate = today;
      }

      // Incrementar contador en memoria
      const key = `${workspaceId}:${operation}:${today}`;
      this.dailyCounts.set(key, (this.dailyCounts.get(key) || 0) + 1);

      // Guardar en Firestore para persistencia
      const usageRef = firestore
        .collection('ai_usage')
        .doc(workspaceId)
        .collection('daily')
        .doc(today);

      await usageRef.set({
        [operation]: FieldValue.increment(1),
        [operation + '_' + model]: FieldValue.increment(1),
        lastUpdated: new Date()
      }, { merge: true });

      logger.info('📊 Uso de IA registrado', {
        workspaceId,
        operation,
        model,
        date: today,
        count: this.dailyCounts.get(key)
      });

    } catch (error) {
      logger.error('❌ Error registrando uso de IA', {
        workspaceId,
        operation,
        error: error.message
      });
    }
  }

  /**
   * Obtener estadísticas de uso
   */
  async getUsageStats(workspaceId, days = 7) {
    try {
      const stats = {
        total: 0,
        byOperation: {},
        byModel: {},
        byDay: {}
      };

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const usageRef = firestore
        .collection('ai_usage')
        .doc(workspaceId)
        .collection('daily');

      const snapshot = await usageRef
        .where('lastUpdated', '>=', startDate)
        .get();

      snapshot.forEach(doc => {
        const data = doc.data();
        const date = doc.id;

        stats.byDay[date] = {};

        Object.keys(data).forEach(key => {
          if (key !== 'lastUpdated') {
            const value = data[key] || 0;
            stats.total += value;

            // Contar por operación
            if (!key.includes('_')) {
              stats.byOperation[key] = (stats.byOperation[key] || 0) + value;
              stats.byDay[date][key] = value;
            }

            // Contar por modelo
            if (key.includes('_')) {
              const model = key.split('_').slice(1).join('_');
              stats.byModel[model] = (stats.byModel[model] || 0) + value;
            }
          }
        });
      });

      return stats;

    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas de uso', {
        workspaceId,
        error: error.message
      });

      return {
        total: 0,
        byOperation: {},
        byModel: {},
        byDay: {},
        error: 'failed_to_load'
      };
    }
  }
}

// Instancia global del contador
const usageCounter = new AIUsageCounter();

/**
 * Logger especializado para operaciones de IA
 */
class AILogger {
  constructor() {
    this.usageCounter = usageCounter;
  }

  /**
   * Log de inicio de operación IA
   */
  logAIStart(workspaceId, operation, params = {}) {
    const logData = {
      workspaceId,
      operation,
      params,
      timestamp: new Date().toISOString(),
      phase: 'start'
    };

    logger.info('🤖 IA - Iniciando operación', logData);
    return logData;
  }

  /**
   * Log de éxito de operación IA
   */
  async logAISuccess(workspaceId, operation, result, metrics = {}) {
    const logData = {
      workspaceId,
      operation,
      success: true,
      model: metrics.model || 'fake-model',
      tokensIn: metrics.tokensIn || 0,
      tokensOut: metrics.tokensOut || 0,
      latencyMs: metrics.latencyMs || 0,
      costUsd: metrics.costUsd || 0,
      timestamp: new Date().toISOString(),
      phase: 'success'
    };

    logger.info('✅ IA - Operación exitosa', logData);

    // Registrar uso
    await this.usageCounter.incrementUsage(workspaceId, operation, metrics.model);

    return logData;
  }

  /**
   * Log de error de operación IA
   */
  logAIError(workspaceId, operation, error, metrics = {}) {
    const logData = {
      workspaceId,
      operation,
      success: false,
      error: error.message,
      errorType: error.constructor.name,
      model: metrics.model || 'fake-model',
      latencyMs: metrics.latencyMs || 0,
      timestamp: new Date().toISOString(),
      phase: 'error'
    };

    logger.error('❌ IA - Error en operación', logData);

    return logData;
  }

  /**
   * Log de sugerencia generada
   */
  logSuggestionGenerated(workspaceId, conversationId, messageId, suggestion, metrics = {}) {
    const logData = {
      workspaceId,
      conversationId,
      messageId,
      suggestionId: suggestion.id,
      confidence: suggestion.confidence || 0,
      model: metrics.model || 'fake-model',
      tokensIn: metrics.tokensIn || 0,
      tokensOut: metrics.tokensOut || 0,
      latencyMs: metrics.latencyMs || 0,
      timestamp: new Date().toISOString(),
      phase: 'suggestion_generated'
    };

    logger.info('💡 IA - Sugerencia generada', logData);

    return logData;
  }

  /**
   * Log de contexto cargado
   */
  logContextLoaded(workspaceId, conversationId, contextMetrics = {}) {
    const logData = {
      workspaceId,
      conversationId,
      messagesCount: contextMetrics.messagesCount || 0,
      totalTokens: contextMetrics.totalTokens || 0,
      loadTimeMs: contextMetrics.loadTimeMs || 0,
      timestamp: new Date().toISOString(),
      phase: 'context_loaded'
    };

    logger.info('📚 IA - Contexto cargado', logData);

    return logData;
  }

  /**
   * Obtener estadísticas de uso
   */
  async getUsageStats(workspaceId, days = 7) {
    return await this.usageCounter.getUsageStats(workspaceId, days);
  }
}

// Instancia global del logger IA
const aiLogger = new AILogger();

module.exports = {
  AILogger,
  AIUsageCounter,
  aiLogger,
  usageCounter
};