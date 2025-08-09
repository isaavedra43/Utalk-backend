/**
 * 🤖 INTEGRACIÓN DE IA CON WEBHOOK
 * 
 * Servicio que integra el orquestador de IA con el flujo de webhook
 * de forma segura y reversible, respetando rate limits y timeouts.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { getAIConfig, isAIEnabled } = require('../config/aiConfig');
const { generateSuggestionForMessage } = require('./AIService');
const { checkRateLimit, releaseConcurrentSlot } = require('../utils/aiRateLimiter');
const { checkDailyLimits, recordAIUsage } = require('./AIMetricsService');
const { isBreakerOpen, recordCallResult } = require('./AICircuitBreaker');
const logger = require('../utils/logger');
const { aiLogger } = require('../utils/aiLogger');

/**
 * Configuración de timeouts y límites
 */
const INTEGRATION_CONFIG = {
  TIMEOUT_MS: 2000, // 2 segundos
  RETRY_DELAY_MS: 250, // 250ms para primer retry
  MAX_RETRIES: 1,
  MAX_CONTEXT_MESSAGES: 20,
  MAX_OUTPUT_TOKENS: 150
};

/**
 * Circuit breaker para IA
 */
let circuitBreaker = {
  isOpen: false,
  failureCount: 0,
  lastFailureTime: null,
  threshold: 10, // 10% error rate
  windowMs: 5 * 60 * 1000, // 5 minutos
  resetTimeoutMs: 30 * 1000 // 30 segundos
};

/**
 * Verificar si el circuit breaker está abierto
 */
function isCircuitBreakerOpen() {
  if (!circuitBreaker.isOpen) {
    return false;
  }
  
  const now = Date.now();
  if (now - circuitBreaker.lastFailureTime > circuitBreaker.resetTimeoutMs) {
    circuitBreaker.isOpen = false;
    circuitBreaker.failureCount = 0;
    logger.info('🔄 Circuit breaker reseteado automáticamente');
    return false;
  }
  
  return true;
}

/**
 * Registrar fallo en circuit breaker
 */
function recordFailure() {
  circuitBreaker.failureCount++;
  circuitBreaker.lastFailureTime = Date.now();
  
  if (circuitBreaker.failureCount >= circuitBreaker.threshold) {
    circuitBreaker.isOpen = true;
    logger.warn('🚨 Circuit breaker abierto - demasiados fallos de IA', {
      failureCount: circuitBreaker.failureCount,
      threshold: circuitBreaker.threshold
    });
  }
}

/**
 * Registrar éxito en circuit breaker
 */
function recordSuccess() {
  if (circuitBreaker.failureCount > 0) {
    circuitBreaker.failureCount = Math.max(0, circuitBreaker.failureCount - 1);
  }
}

/**
 * Verificar si IA está habilitada para el workspace
 */
async function isAIEnabledForWorkspace(workspaceId) {
  try {
    // Verificar flag global
    const globalEnabled = process.env.AI_ENABLED === 'true';
    if (!globalEnabled) {
      return false;
    }
    
    // Verificar si IA está habilitada para el workspace
    const aiEnabled = await isAIEnabled(workspaceId);
    if (!aiEnabled) {
      return false;
    }
    
    // Verificar configuración específica
    const config = await getAIConfig(workspaceId);
    return config.flags.suggestions === true;
  } catch (error) {
    logger.warn('⚠️ Error verificando habilitación de IA, asumiendo deshabilitada', {
      workspaceId,
      error: error.message
    });
    return false;
  }
}

/**
 * Generar sugerencia con timeout y retry
 */
async function generateSuggestionWithTimeout(workspaceId, conversationId, messageId, options = {}) {
  const startTime = Date.now();
  
  try {
    // Crear promise con timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Timeout generando sugerencia'));
      }, INTEGRATION_CONFIG.TIMEOUT_MS);
    });
    
    // Promise de generación de sugerencia
    const suggestionPromise = generateSuggestionForMessage(workspaceId, conversationId, messageId, {
      ...options,
      maxContextMessages: INTEGRATION_CONFIG.MAX_CONTEXT_MESSAGES,
      maxOutputTokens: INTEGRATION_CONFIG.MAX_OUTPUT_TOKENS
    });
    
    // Ejecutar con timeout
    const result = await Promise.race([suggestionPromise, timeoutPromise]);
    
    const latencyMs = Date.now() - startTime;
    
    logger.info('✅ Sugerencia generada exitosamente', {
      workspaceId,
      conversationId,
      messageId,
      latencyMs,
      hasSuggestion: !!result.suggestion
    });
    
    recordSuccess();
    return result;
    
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    
    logger.warn('⚠️ Error generando sugerencia', {
      workspaceId,
      conversationId,
      messageId,
      error: error.message,
      latencyMs
    });
    
    recordFailure();
    throw error;
  }
}

/**
 * Generar sugerencia con retry
 */
async function generateSuggestionWithRetry(workspaceId, conversationId, messageId, options = {}) {
  let lastError;
  
  for (let attempt = 0; attempt <= INTEGRATION_CONFIG.MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        // Esperar antes del retry
        const delay = INTEGRATION_CONFIG.RETRY_DELAY_MS * attempt;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        logger.info('🔄 Reintentando generación de sugerencia', {
          workspaceId,
          conversationId,
          messageId,
          attempt: attempt + 1,
          maxRetries: INTEGRATION_CONFIG.MAX_RETRIES
        });
      }
      
      return await generateSuggestionWithTimeout(workspaceId, conversationId, messageId, options);
      
    } catch (error) {
      lastError = error;
      
      if (attempt === INTEGRATION_CONFIG.MAX_RETRIES) {
        logger.warn('⚠️ Máximo de reintentos alcanzado', {
          workspaceId,
          conversationId,
          messageId,
          attempts: attempt + 1,
          error: error.message
        });
      }
    }
  }
  
  throw lastError;
}

  /**
   * Integrar IA con mensaje entrante
   */
  async function integrateAIWithIncomingMessage(workspaceId, conversationId, messageId, messageData) {
    const startTime = Date.now();
    
    try {
      // Verificar si IA está habilitada
      const aiEnabled = await isAIEnabledForWorkspace(workspaceId);
      if (!aiEnabled) {
        logger.info('ℹ️ IA deshabilitada para workspace', {
          workspaceId,
          conversationId,
          messageId
        });
        return { success: false, reason: 'ai_disabled' };
      }
      
      // Verificar circuit breaker
      if (isBreakerOpen(workspaceId)) {
        logger.warn('🚨 Circuit breaker abierto, saltando generación de IA', {
          workspaceId,
          conversationId,
          messageId
        });
        return { success: false, reason: 'circuit_breaker_open' };
      }
      
      // Verificar rate limit
      const rateLimitResult = checkRateLimit(conversationId, workspaceId);
      if (!rateLimitResult.allowed) {
        logger.warn('⚠️ Rate limit excedido, saltando generación de IA', {
          workspaceId,
          conversationId,
          messageId,
          reason: rateLimitResult.reason
        });
        return { success: false, reason: rateLimitResult.reason };
      }
      
      // Verificar límites diarios (estimación)
      const estimatedTokensIn = 150; // Estimación conservadora
      const estimatedTokensOut = 50;  // Estimación conservadora
      const dailyLimitsResult = await checkDailyLimits(workspaceId, 'gpt-3.5-turbo', estimatedTokensIn, estimatedTokensOut);
      
      if (!dailyLimitsResult.allowed) {
        logger.warn('⚠️ Límites diarios excedidos, saltando generación de IA', {
          workspaceId,
          conversationId,
          messageId,
          reason: dailyLimitsResult.reason,
          remaining: dailyLimitsResult.remaining
        });
        return { success: false, reason: dailyLimitsResult.reason, remaining: dailyLimitsResult.remaining };
      }
      
      // Generar sugerencia
      const result = await generateSuggestionWithRetry(workspaceId, conversationId, messageId, {
        dryRun: false, // Guardar sugerencia
        includeContext: true
      });
      
      const latencyMs = Date.now() - startTime;
      
      // Registrar uso de IA
      await recordAIUsage(workspaceId, result.metrics?.model || 'gpt-3.5-turbo', {
        tokensIn: result.metrics?.tokensIn || estimatedTokensIn,
        tokensOut: result.metrics?.tokensOut || estimatedTokensOut,
        success: result.success,
        latencyMs,
        costUsd: result.metrics?.costUsd || dailyLimitsResult.estimatedCost
      });
      
      // Registrar resultado en circuit breaker
      await recordCallResult(workspaceId, result.success, latencyMs, result.error);
      
      // Log de métricas
      aiLogger.info('ai_webhook_integration', {
        workspaceId,
        conversationId,
        messageId,
        success: result.success,
        latencyMs,
        hasSuggestion: !!result.suggestion,
        tokensIn: result.metrics?.tokensIn || estimatedTokensIn,
        tokensOut: result.metrics?.tokensOut || estimatedTokensOut,
        model: result.metrics?.model || 'gpt-3.5-turbo',
        costUsd: result.metrics?.costUsd || dailyLimitsResult.estimatedCost
      });
      
      return {
        success: result.success,
        suggestion: result.suggestion,
        metrics: result.metrics,
        latencyMs,
        remaining: dailyLimitsResult.remaining
      };
      
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      
      logger.error('❌ Error en integración de IA con webhook', {
        workspaceId,
        conversationId,
        messageId,
        error: error.message,
        latencyMs
      });
      
      // Registrar error en circuit breaker
      await recordCallResult(workspaceId, false, latencyMs, error);
      
      // Log de métricas de error
      aiLogger.error('ai_webhook_integration_error', {
        workspaceId,
        conversationId,
        messageId,
        error: error.message,
        latencyMs
      });
      
      return {
        success: false,
        error: error.message,
        latencyMs
      };
    } finally {
      // Liberar slot concurrente
      releaseConcurrentSlot(conversationId, workspaceId);
    }
  }

/**
 * Obtener estado del circuit breaker
 */
function getCircuitBreakerStatus() {
  return {
    isOpen: circuitBreaker.isOpen,
    failureCount: circuitBreaker.failureCount,
    threshold: circuitBreaker.threshold,
    lastFailureTime: circuitBreaker.lastFailureTime,
    resetTimeoutMs: circuitBreaker.resetTimeoutMs
  };
}

/**
 * Resetear circuit breaker manualmente
 */
function resetCircuitBreaker() {
  circuitBreaker.isOpen = false;
  circuitBreaker.failureCount = 0;
  circuitBreaker.lastFailureTime = null;
  
  logger.info('🔄 Circuit breaker reseteado manualmente');
}

module.exports = {
  INTEGRATION_CONFIG,
  integrateAIWithIncomingMessage,
  isAIEnabledForWorkspace,
  getCircuitBreakerStatus,
  resetCircuitBreaker
}; 