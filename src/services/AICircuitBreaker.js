/**
 * 🚨 CIRCUIT BREAKER AVANZADO PARA IA
 * 
 * Implementa circuit breaker inteligente con políticas por workspace,
 * monitoreo de latencia y auto-recovery.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { getAILimits } = require('../config/aiLimits');
const logger = require('../utils/logger');

/**
 * Almacén de circuit breakers por workspace
 * En producción, esto debería usar Redis
 */
const circuitBreakers = new Map();

/**
 * Obtener clave del circuit breaker
 */
function getBreakerKey(workspaceId) {
  return `breaker_${workspaceId}`;
}

/**
 * Obtener circuit breaker para un workspace
 */
function getCircuitBreaker(workspaceId) {
  const key = getBreakerKey(workspaceId);
  
  if (!circuitBreakers.has(key)) {
    circuitBreakers.set(key, {
      isOpen: false,
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      lastStateChange: null,
      consecutiveTimeouts: 0,
      latencies: [],
      errorRate: 0,
      p95_ms: null,
      p99_ms: null
    });
  }
  
  return circuitBreakers.get(key);
}

/**
 * Verificar si el circuit breaker está abierto
 */
function isBreakerOpen(workspaceId) {
  const breaker = getCircuitBreaker(workspaceId);
  return breaker.isOpen;
}

/**
 * Registrar resultado de llamada IA
 */
async function recordCallResult(workspaceId, success, latencyMs, error = null) {
  try {
    const breaker = getCircuitBreaker(workspaceId);
    const now = Date.now();
    
    // Actualizar contadores
    if (success) {
      breaker.successCount++;
      breaker.lastSuccessTime = now;
      breaker.consecutiveTimeouts = 0;
    } else {
      breaker.failureCount++;
      breaker.lastFailureTime = now;
      
      // Incrementar timeouts consecutivos si es timeout
      if (error && error.message && error.message.includes('timeout')) {
        breaker.consecutiveTimeouts++;
      }
    }
    
    // Agregar latencia si existe
    if (latencyMs) {
      breaker.latencies = [
        ...breaker.latencies,
        latencyMs
      ].slice(-100); // Mantener solo las últimas 100
    }
    
    logger.debug('📊 Resultado de llamada registrado', {
      workspaceId,
      success,
      latencyMs,
      isOpen: breaker.isOpen
    });
    
  } catch (error) {
    logger.error('❌ Error registrando resultado de llamada', {
      workspaceId,
      error: error.message
    });
  }
}

/**
 * Forzar estado del circuit breaker
 */
async function forceBreakerState(workspaceId, isOpen, reason = 'manual') {
  try {
    const breaker = getCircuitBreaker(workspaceId);
    const now = Date.now();
    
    const previousState = breaker.isOpen;
    breaker.isOpen = isOpen;
    breaker.lastStateChange = now;
    
    if (isOpen) {
      // Resetear contadores al abrir
      breaker.failureCount = 0;
      breaker.successCount = 0;
      breaker.consecutiveTimeouts = 0;
    }
    
    logger.info('🔧 Estado del circuit breaker forzado', {
      workspaceId,
      previousState,
      newState: isOpen,
      reason
    });
    
    return true;
  } catch (error) {
    logger.error('❌ Error forzando estado del circuit breaker', {
      workspaceId,
      error: error.message
    });
    return false;
  }
}

/**
 * Obtener estado del circuit breaker
 */
function getBreakerStatus(workspaceId) {
  const breaker = getCircuitBreaker(workspaceId);
  
  return {
    isOpen: breaker.isOpen,
    failureCount: breaker.failureCount,
    successCount: breaker.successCount,
    consecutiveTimeouts: breaker.consecutiveTimeouts,
    errorRate: breaker.errorRate,
    p95_ms: breaker.p95_ms,
    p99_ms: breaker.p99_ms,
    lastFailureTime: breaker.lastFailureTime,
    lastSuccessTime: breaker.lastSuccessTime,
    lastStateChange: breaker.lastStateChange
  };
}

/**
 * Obtener estadísticas de todos los circuit breakers
 */
function getAllBreakerStats() {
  const stats = {};
  
  for (const [key, breaker] of circuitBreakers.entries()) {
    const workspaceId = key.replace('breaker_', '');
    stats[workspaceId] = getBreakerStatus(workspaceId);
  }
  
  return stats;
}

/**
 * Resetear circuit breaker
 */
function resetBreaker(workspaceId) {
  const key = getBreakerKey(workspaceId);
  circuitBreakers.delete(key);
  
  logger.info('🔄 Circuit breaker reseteado', {
    workspaceId
  });
}

module.exports = {
  getCircuitBreaker,
  isBreakerOpen,
  recordCallResult,
  forceBreakerState,
  getBreakerStatus,
  getAllBreakerStats,
  resetBreaker
}; 