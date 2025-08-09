/**
 * 🚦 RATE LIMITER PARA IA
 * 
 * Controla la frecuencia de llamadas a IA por conversación
 * para evitar saturación y costos excesivos.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const logger = require('./logger');

/**
 * Configuración de rate limiting
 */
const RATE_LIMIT_CONFIG = {
  MAX_REQUESTS_PER_MINUTE: 6,
  MAX_CONCURRENT_REQUESTS: 1,
  WINDOW_MS: 60 * 1000, // 1 minuto
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000 // 5 minutos
};

/**
 * Almacén de rate limits por conversación
 * En producción, esto debería usar Redis
 */
const rateLimitStore = new Map();

/**
 * Limpiar entradas expiradas
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  const expiredKeys = [];
  
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.lastReset > RATE_LIMIT_CONFIG.WINDOW_MS) {
      expiredKeys.push(key);
    }
  }
  
  expiredKeys.forEach(key => rateLimitStore.delete(key));
  
  if (expiredKeys.length > 0) {
    logger.debug('🧹 Rate limiter cleanup', {
      expiredKeys: expiredKeys.length,
      remainingKeys: rateLimitStore.size
    });
  }
}

/**
 * Verificar rate limit para una conversación
 */
function checkRateLimit(conversationId, workspaceId) {
  const key = `${workspaceId}:${conversationId}`;
  const now = Date.now();
  
  // Limpiar entradas expiradas periódicamente
  if (now % RATE_LIMIT_CONFIG.CLEANUP_INTERVAL_MS === 0) {
    cleanupExpiredEntries();
  }
  
  let data = rateLimitStore.get(key);
  
  // Si no existe o expiró, crear nueva entrada
  if (!data || now - data.lastReset > RATE_LIMIT_CONFIG.WINDOW_MS) {
    data = {
      count: 0,
      lastReset: now,
      concurrent: 0
    };
    rateLimitStore.set(key, data);
  }
  
  // Verificar límite de requests por minuto
  if (data.count >= RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_MINUTE) {
    logger.warn('⚠️ Rate limit excedido para conversación', {
      conversationId,
      workspaceId,
      count: data.count,
      limit: RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_MINUTE,
      windowMs: RATE_LIMIT_CONFIG.WINDOW_MS
    });
    return {
      allowed: false,
      reason: 'rate_limit_exceeded',
      remainingTime: RATE_LIMIT_CONFIG.WINDOW_MS - (now - data.lastReset)
    };
  }
  
  // Verificar límite de requests concurrentes
  if (data.concurrent >= RATE_LIMIT_CONFIG.MAX_CONCURRENT_REQUESTS) {
    logger.warn('⚠️ Límite concurrente excedido para conversación', {
      conversationId,
      workspaceId,
      concurrent: data.concurrent,
      limit: RATE_LIMIT_CONFIG.MAX_CONCURRENT_REQUESTS
    });
    return {
      allowed: false,
      reason: 'concurrent_limit_exceeded'
    };
  }
  
  // Incrementar contadores
  data.count++;
  data.concurrent++;
  
  logger.debug('✅ Rate limit check passed', {
    conversationId,
    workspaceId,
    count: data.count,
    concurrent: data.concurrent,
    limit: RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_MINUTE
  });
  
  return {
    allowed: true,
    count: data.count,
    concurrent: data.concurrent
  };
}

/**
 * Liberar slot concurrente
 */
function releaseConcurrentSlot(conversationId, workspaceId) {
  const key = `${workspaceId}:${conversationId}`;
  const data = rateLimitStore.get(key);
  
  if (data && data.concurrent > 0) {
    data.concurrent--;
    logger.debug('🔓 Slot concurrente liberado', {
      conversationId,
      workspaceId,
      concurrent: data.concurrent
    });
  }
}

/**
 * Obtener estadísticas de rate limiting
 */
function getRateLimitStats() {
  const stats = {
    totalConversations: rateLimitStore.size,
    config: RATE_LIMIT_CONFIG,
    conversations: []
  };
  
  for (const [key, data] of rateLimitStore.entries()) {
    const [workspaceId, conversationId] = key.split(':');
    stats.conversations.push({
      workspaceId,
      conversationId,
      count: data.count,
      concurrent: data.concurrent,
      lastReset: data.lastReset,
      timeUntilReset: RATE_LIMIT_CONFIG.WINDOW_MS - (Date.now() - data.lastReset)
    });
  }
  
  return stats;
}

/**
 * Resetear rate limit para una conversación (para testing)
 */
function resetRateLimit(conversationId, workspaceId) {
  const key = `${workspaceId}:${conversationId}`;
  rateLimitStore.delete(key);
  
  logger.info('🔄 Rate limit reseteado', {
    conversationId,
    workspaceId
  });
}

module.exports = {
  RATE_LIMIT_CONFIG,
  checkRateLimit,
  releaseConcurrentSlot,
  getRateLimitStats,
  resetRateLimit
}; 