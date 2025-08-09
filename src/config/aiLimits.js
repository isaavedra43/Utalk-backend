/**
 * 🚦 CONFIGURACIÓN DE LÍMITES Y POLÍTICAS DE IA
 * 
 * Define límites diarios, rate limiting, circuit breaker y alertas
 * por workspace con valores por defecto globales.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { firestore } = require('./firebase');
const logger = require('../utils/logger');

/**
 * Límites por defecto globales
 */
const DEFAULT_LIMITS = {
  daily: {
    max_tokens_in: 1000000,    // 1M tokens de entrada
    max_tokens_out: 300000,    // 300K tokens de salida
    max_cost_usd: 25.0         // $25 USD por día
  },
  rate: {
    per_minute: 6,             // 6 requests por minuto
    burst: 10                  // 10 requests en burst
  },
  latency: {
    p95_ms_threshold: 2500,    // 2.5s P95
    p99_ms_threshold: 4000     // 4s P99
  },
  errors: {
    error_rate_threshold_pct: 10,  // 10% error rate
    window_min: 5                  // 5 minutos de ventana
  },
  breaker: {
    enabled: true,
    cooldown_min: 10           // 10 minutos de cooldown
  },
  alerts: {
    enabled: true,
    webhook_url: null,         // URL de webhook para alertas
    email: null                // Email para alertas
  }
};

/**
 * Tarifas por modelo (USD por 1K tokens)
 */
const MODEL_PRICING = {
  'gpt-3.5-turbo': {
    input: 0.0015,    // $0.0015 por 1K tokens de entrada
    output: 0.002     // $0.002 por 1K tokens de salida
  },
  'gpt-4': {
    input: 0.03,      // $0.03 por 1K tokens de entrada
    output: 0.06      // $0.06 por 1K tokens de salida
  },
  'gpt-4-turbo': {
    input: 0.01,      // $0.01 por 1K tokens de entrada
    output: 0.03      // $0.03 por 1K tokens de salida
  },
  'claude-3-sonnet': {
    input: 0.003,     // $0.003 por 1K tokens de entrada
    output: 0.015     // $0.015 por 1K tokens de salida
  },
  'claude-3-haiku': {
    input: 0.00025,   // $0.00025 por 1K tokens de entrada
    output: 0.00125   // $0.00125 por 1K tokens de salida
  },
  'gemini-pro': {
    input: 0.0005,    // $0.0005 por 1K tokens de entrada
    output: 0.0015    // $0.0015 por 1K tokens de salida
  }
};

/**
 * Obtener límites para un workspace
 */
async function getAILimits(workspaceId) {
  try {
    const doc = await firestore
      .collection('workspaces')
      .doc(workspaceId)
      .collection('ai')
      .doc('limits')
      .get();

    if (!doc.exists) {
      logger.info('📋 Usando límites por defecto para workspace', {
        workspaceId
      });
      return DEFAULT_LIMITS;
    }

    const workspaceLimits = doc.data();
    
    // Merge con defaults (workspace override defaults)
    const mergedLimits = {
      daily: { ...DEFAULT_LIMITS.daily, ...workspaceLimits.daily },
      rate: { ...DEFAULT_LIMITS.rate, ...workspaceLimits.rate },
      latency: { ...DEFAULT_LIMITS.latency, ...workspaceLimits.latency },
      errors: { ...DEFAULT_LIMITS.errors, ...workspaceLimits.errors },
      breaker: { ...DEFAULT_LIMITS.breaker, ...workspaceLimits.breaker },
      alerts: { ...DEFAULT_LIMITS.alerts, ...workspaceLimits.alerts }
    };

    logger.debug('📋 Límites obtenidos para workspace', {
      workspaceId,
      hasCustomLimits: doc.exists,
      daily: mergedLimits.daily,
      rate: mergedLimits.rate
    });

    return mergedLimits;
  } catch (error) {
    logger.error('❌ Error obteniendo límites de IA', {
      workspaceId,
      error: error.message
    });
    return DEFAULT_LIMITS;
  }
}

/**
 * Actualizar límites para un workspace
 */
async function updateAILimits(workspaceId, updates) {
  try {
    // Validar y sanitizar updates
    const sanitizedUpdates = validateAndSanitizeLimits(updates);
    
    // Obtener límites actuales
    const currentLimits = await getAILimits(workspaceId);
    
    // Merge con actuales
    const newLimits = {
      daily: { ...currentLimits.daily, ...sanitizedUpdates.daily },
      rate: { ...currentLimits.rate, ...sanitizedUpdates.rate },
      latency: { ...currentLimits.latency, ...sanitizedUpdates.latency },
      errors: { ...currentLimits.errors, ...sanitizedUpdates.errors },
      breaker: { ...currentLimits.breaker, ...sanitizedUpdates.breaker },
      alerts: { ...currentLimits.alerts, ...sanitizedUpdates.alerts }
    };

    // Guardar en Firestore
    await firestore
      .collection('workspaces')
      .doc(workspaceId)
      .collection('ai')
      .doc('limits')
      .set(newLimits, { merge: true });

    logger.info('✅ Límites de IA actualizados', {
      workspaceId,
      updates: Object.keys(sanitizedUpdates),
      newLimits
    });

    return newLimits;
  } catch (error) {
    logger.error('❌ Error actualizando límites de IA', {
      workspaceId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Validar y sanitizar límites
 */
function validateAndSanitizeLimits(updates) {
  const sanitized = {};

  // Validar daily limits
  if (updates.daily) {
    sanitized.daily = {};
    if (typeof updates.daily.max_tokens_in === 'number') {
      sanitized.daily.max_tokens_in = Math.max(1000, Math.min(10000000, updates.daily.max_tokens_in));
    }
    if (typeof updates.daily.max_tokens_out === 'number') {
      sanitized.daily.max_tokens_out = Math.max(100, Math.min(3000000, updates.daily.max_tokens_out));
    }
    if (typeof updates.daily.max_cost_usd === 'number') {
      sanitized.daily.max_cost_usd = Math.max(0.1, Math.min(1000, updates.daily.max_cost_usd));
    }
  }

  // Validar rate limits
  if (updates.rate) {
    sanitized.rate = {};
    if (typeof updates.rate.per_minute === 'number') {
      sanitized.rate.per_minute = Math.max(1, Math.min(100, updates.rate.per_minute));
    }
    if (typeof updates.rate.burst === 'number') {
      sanitized.rate.burst = Math.max(1, Math.min(200, updates.rate.burst));
    }
  }

  // Validar latency thresholds
  if (updates.latency) {
    sanitized.latency = {};
    if (typeof updates.latency.p95_ms_threshold === 'number') {
      sanitized.latency.p95_ms_threshold = Math.max(100, Math.min(10000, updates.latency.p95_ms_threshold));
    }
    if (typeof updates.latency.p99_ms_threshold === 'number') {
      sanitized.latency.p99_ms_threshold = Math.max(200, Math.min(15000, updates.latency.p99_ms_threshold));
    }
  }

  // Validar error thresholds
  if (updates.errors) {
    sanitized.errors = {};
    if (typeof updates.errors.error_rate_threshold_pct === 'number') {
      sanitized.errors.error_rate_threshold_pct = Math.max(1, Math.min(50, updates.errors.error_rate_threshold_pct));
    }
    if (typeof updates.errors.window_min === 'number') {
      sanitized.errors.window_min = Math.max(1, Math.min(60, updates.errors.window_min));
    }
  }

  // Validar breaker config
  if (updates.breaker) {
    sanitized.breaker = {};
    if (typeof updates.breaker.enabled === 'boolean') {
      sanitized.breaker.enabled = updates.breaker.enabled;
    }
    if (typeof updates.breaker.cooldown_min === 'number') {
      sanitized.breaker.cooldown_min = Math.max(1, Math.min(60, updates.breaker.cooldown_min));
    }
  }

  // Validar alerts config
  if (updates.alerts) {
    sanitized.alerts = {};
    if (typeof updates.alerts.enabled === 'boolean') {
      sanitized.alerts.enabled = updates.alerts.enabled;
    }
    if (updates.alerts.webhook_url && typeof updates.alerts.webhook_url === 'string') {
      sanitized.alerts.webhook_url = updates.alerts.webhook_url;
    }
    if (updates.alerts.email && typeof updates.alerts.email === 'string') {
      sanitized.alerts.email = updates.alerts.email;
    }
  }

  return sanitized;
}

/**
 * Calcular costo estimado para un modelo
 */
function calculateCost(model, tokensIn, tokensOut) {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    logger.warn('⚠️ Precio no encontrado para modelo', {
      model,
      tokensIn,
      tokensOut
    });
    return 0;
  }

  const costIn = (tokensIn / 1000) * pricing.input;
  const costOut = (tokensOut / 1000) * pricing.output;
  const totalCost = costIn + costOut;

  return Math.round(totalCost * 1000000) / 1000000; // Redondear a 6 decimales
}

/**
 * Obtener precio de un modelo
 */
function getModelPricing(model) {
  return MODEL_PRICING[model] || null;
}

/**
 * Listar todos los modelos disponibles con precios
 */
function getAvailableModels() {
  return Object.keys(MODEL_PRICING).map(model => ({
    model,
    pricing: MODEL_PRICING[model]
  }));
}

module.exports = {
  DEFAULT_LIMITS,
  MODEL_PRICING,
  getAILimits,
  updateAILimits,
  validateAndSanitizeLimits,
  calculateCost,
  getModelPricing,
  getAvailableModels
}; 