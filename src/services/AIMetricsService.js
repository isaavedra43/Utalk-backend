/**
 * 📊 SERVICIO DE MÉTRICAS Y CONTADORES DE IA
 * 
 * Maneja contadores diarios, límites de consumo y métricas
 * de rendimiento por workspace y modelo.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { firestore } = require('../config/firebase');
const { getAILimits, calculateCost } = require('../config/aiLimits');
const logger = require('../utils/logger');

/**
 * Almacén de contadores en memoria (cache)
 * En producción, esto debería usar Redis
 */
const countersCache = new Map();

/**
 * Obtener clave de contador
 */
function getCounterKey(date, workspaceId, model) {
  return `${date}_${workspaceId}_${model}`;
}

/**
 * Obtener contador desde cache o DB
 */
async function getCounter(date, workspaceId, model) {
  const key = getCounterKey(date, workspaceId, model);
  
  // Verificar cache
  if (countersCache.has(key)) {
    return countersCache.get(key);
  }
  
  try {
    // Obtener desde Firestore
    const doc = await firestore
      .collection('ai_counters')
      .doc(date)
      .collection('workspaces')
      .doc(workspaceId)
      .collection('models')
      .doc(model)
      .get();

    if (doc.exists) {
      const counter = doc.data();
      countersCache.set(key, counter);
      return counter;
    }

    // Crear contador vacío
    const emptyCounter = {
      tokens_in_sum: 0,
      tokens_out_sum: 0,
      calls_ok: 0,
      calls_err: 0,
      cost_usd_sum: 0,
      latencies: [],
      last_updated: new Date().toISOString()
    };

    countersCache.set(key, emptyCounter);
    return emptyCounter;
  } catch (error) {
    logger.error('❌ Error obteniendo contador', {
      date,
      workspaceId,
      model,
      error: error.message
    });
    
    // Retornar contador vacío en caso de error
    const emptyCounter = {
      tokens_in_sum: 0,
      tokens_out_sum: 0,
      calls_ok: 0,
      calls_err: 0,
      cost_usd_sum: 0,
      latencies: [],
      last_updated: new Date().toISOString()
    };
    
    countersCache.set(key, emptyCounter);
    return emptyCounter;
  }
}

/**
 * Actualizar contador
 */
async function updateCounter(date, workspaceId, model, metrics) {
  const key = getCounterKey(date, workspaceId, model);
  const counter = await getCounter(date, workspaceId, model);
  
  // Actualizar contador
  const updatedCounter = {
    ...counter,
    tokens_in_sum: counter.tokens_in_sum + (metrics.tokensIn || 0),
    tokens_out_sum: counter.tokens_out_sum + (metrics.tokensOut || 0),
    calls_ok: counter.calls_ok + (metrics.success ? 1 : 0),
    calls_err: counter.calls_err + (metrics.success ? 0 : 1),
    cost_usd_sum: counter.cost_usd_sum + (metrics.costUsd || 0),
    last_updated: new Date().toISOString()
  };

  // Agregar latencia si existe
  if (metrics.latencyMs) {
    updatedCounter.latencies = [
      ...(updatedCounter.latencies || []),
      metrics.latencyMs
    ].slice(-100); // Mantener solo las últimas 100 latencias
  }

  // Calcular percentiles
  if (updatedCounter.latencies && updatedCounter.latencies.length > 0) {
    const sortedLatencies = [...updatedCounter.latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);
    
    updatedCounter.p95_ms = sortedLatencies[p95Index];
    updatedCounter.p99_ms = sortedLatencies[p99Index];
  }

  // Actualizar cache
  countersCache.set(key, updatedCounter);

  // Guardar en Firestore (async, no esperar)
  setImmediate(async () => {
    try {
      await firestore
        .collection('ai_counters')
        .doc(date)
        .collection('workspaces')
        .doc(workspaceId)
        .collection('models')
        .doc(model)
        .set(updatedCounter, { merge: true });
    } catch (error) {
      logger.error('❌ Error guardando contador en DB', {
        date,
        workspaceId,
        model,
        error: error.message
      });
    }
  });

  return updatedCounter;
}

/**
 * Verificar límites diarios
 */
async function checkDailyLimits(workspaceId, model, tokensIn, tokensOut) {
  try {
    const limits = await getAILimits(workspaceId);
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const counter = await getCounter(date, workspaceId, model);
    
    const estimatedCost = calculateCost(model, tokensIn, tokensOut);
    const newTokensIn = counter.tokens_in_sum + tokensIn;
    const newTokensOut = counter.tokens_out_sum + tokensOut;
    const newCost = counter.cost_usd_sum + estimatedCost;

    const remaining = {
      tokens_in: Math.max(0, limits.daily.max_tokens_in - newTokensIn),
      tokens_out: Math.max(0, limits.daily.max_tokens_out - newTokensOut),
      cost_usd: Math.max(0, limits.daily.max_cost_usd - newCost)
    };

    // Verificar si excede algún límite
    const exceedsTokensIn = newTokensIn > limits.daily.max_tokens_in;
    const exceedsTokensOut = newTokensOut > limits.daily.max_tokens_out;
    const exceedsCost = newCost > limits.daily.max_cost_usd;

    if (exceedsTokensIn || exceedsTokensOut || exceedsCost) {
      logger.warn('⚠️ Límites diarios excedidos', {
        workspaceId,
        model,
        date,
        exceedsTokensIn,
        exceedsTokensOut,
        exceedsCost,
        current: {
          tokens_in: counter.tokens_in_sum,
          tokens_out: counter.tokens_out_sum,
          cost_usd: counter.cost_usd_sum
        },
        limits: limits.daily,
        remaining
      });

      return {
        allowed: false,
        reason: 'CAP_EXCEEDED',
        remaining,
        exceeded: {
          tokens_in: exceedsTokensIn,
          tokens_out: exceedsTokensOut,
          cost_usd: exceedsCost
        }
      };
    }

    return {
      allowed: true,
      remaining,
      estimatedCost
    };
  } catch (error) {
    logger.error('❌ Error verificando límites diarios', {
      workspaceId,
      model,
      error: error.message
    });
    
    // En caso de error, permitir la operación
    return {
      allowed: true,
      remaining: { tokens_in: 999999, tokens_out: 999999, cost_usd: 999 },
      estimatedCost: 0
    };
  }
}

/**
 * Registrar uso de IA
 */
async function recordAIUsage(workspaceId, model, metrics) {
  try {
    const date = new Date().toISOString().split('T')[0];
    
    // Calcular costo si no se proporciona
    if (!metrics.costUsd) {
      metrics.costUsd = calculateCost(model, metrics.tokensIn || 0, metrics.tokensOut || 0);
    }

    // Actualizar contador
    await updateCounter(date, workspaceId, model, metrics);

    logger.info('📊 Uso de IA registrado', {
      workspaceId,
      model,
      date,
      tokensIn: metrics.tokensIn,
      tokensOut: metrics.tokensOut,
      costUsd: metrics.costUsd,
      success: metrics.success,
      latencyMs: metrics.latencyMs
    });

    return true;
  } catch (error) {
    logger.error('❌ Error registrando uso de IA', {
      workspaceId,
      model,
      error: error.message
    });
    return false;
  }
}

/**
 * Obtener estadísticas por fecha
 */
async function getStatsByDate(date, workspaceId = null, model = null) {
  try {
    let query = firestore.collection('ai_counters').doc(date);
    
    if (workspaceId) {
      query = query.collection('workspaces').doc(workspaceId);
      if (model) {
        query = query.collection('models').doc(model);
      } else {
        query = query.collection('models');
      }
    } else {
      query = query.collection('workspaces');
    }

    const snapshot = await query.get();
    const stats = {};

    if (model) {
      // Un solo modelo
      if (snapshot.exists) {
        stats[model] = snapshot.data();
      }
    } else {
      // Múltiples modelos/workspaces
      snapshot.forEach(doc => {
        stats[doc.id] = snapshot.data();
      });
    }

    return stats;
  } catch (error) {
    logger.error('❌ Error obteniendo estadísticas', {
      date,
      workspaceId,
      model,
      error: error.message
    });
    return {};
  }
}

/**
 * Obtener resumen de uso diario
 */
async function getDailySummary(date, workspaceId) {
  try {
    const stats = await getStatsByDate(date, workspaceId);
    
    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let totalCallsOk = 0;
    let totalCallsErr = 0;
    let totalCost = 0;
    let allLatencies = [];

    Object.values(stats).forEach(modelStats => {
      totalTokensIn += modelStats.tokens_in_sum || 0;
      totalTokensOut += modelStats.tokens_out_sum || 0;
      totalCallsOk += modelStats.calls_ok || 0;
      totalCallsErr += modelStats.calls_err || 0;
      totalCost += modelStats.cost_usd_sum || 0;
      
      if (modelStats.latencies) {
        allLatencies = allLatencies.concat(modelStats.latencies);
      }
    });

    // Calcular percentiles globales
    let p95_ms = null;
    let p99_ms = null;
    
    if (allLatencies.length > 0) {
      const sortedLatencies = allLatencies.sort((a, b) => a - b);
      const p95Index = Math.floor(sortedLatencies.length * 0.95);
      const p99Index = Math.floor(sortedLatencies.length * 0.99);
      
      p95_ms = sortedLatencies[p95Index];
      p99_ms = sortedLatencies[p99Index];
    }

    const totalCalls = totalCallsOk + totalCallsErr;
    const errorRate = totalCalls > 0 ? (totalCallsErr / totalCalls) * 100 : 0;

    return {
      date,
      workspaceId,
      summary: {
        totalTokensIn,
        totalTokensOut,
        totalCalls,
        totalCallsOk,
        totalCallsErr,
        errorRate: Math.round(errorRate * 100) / 100,
        totalCost: Math.round(totalCost * 1000000) / 1000000,
        p95_ms,
        p99_ms
      },
      byModel: stats
    };
  } catch (error) {
    logger.error('❌ Error obteniendo resumen diario', {
      date,
      workspaceId,
      error: error.message
    });
    return null;
  }
}

/**
 * Limpiar cache de contadores
 */
function clearCountersCache() {
  const beforeSize = countersCache.size;
  countersCache.clear();
  
  logger.info('🧹 Cache de contadores limpiado', {
    beforeSize,
    afterSize: 0
  });
}

/**
 * Obtener estadísticas del cache
 */
function getCacheStats() {
  return {
    size: countersCache.size,
    keys: Array.from(countersCache.keys())
  };
}

module.exports = {
  getCounter,
  updateCounter,
  checkDailyLimits,
  recordAIUsage,
  getStatsByDate,
  getDailySummary,
  clearCountersCache,
  getCacheStats
}; 