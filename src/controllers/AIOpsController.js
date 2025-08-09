/**
 * 🔧 CONTROLADOR DE OPERACIONES DE IA
 * 
 * Endpoints internos para monitoreo, administración de límites
 * y control de circuit breakers.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
const { getAILimits, updateAILimits, getAvailableModels } = require('../config/aiLimits');
const { getDailySummary, getCacheStats } = require('../services/AIMetricsService');
const { getBreakerStatus, forceBreakerState, getAllBreakerStats } = require('../services/AICircuitBreaker');
const { getRateLimitStats } = require('../utils/aiRateLimiter');
const logger = require('../utils/logger');

class AIOpsController {
  /**
   * GET /api/ai/ops/limits/:workspaceId
   * Obtener límites efectivos de un workspace
   */
  static async getLimits(req, res, next) {
    try {
      const { workspaceId } = req.params;

      // Verificar permisos (solo admin/ops pueden ver límites)
      if (!['admin', 'ops'].includes(req.user.role)) {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver límites de IA');
      }

      // Validar workspaceId
      if (!workspaceId) {
        throw new ApiError(
          'MISSING_WORKSPACE_ID',
          'workspaceId es requerido',
          'Proporciona el ID del workspace',
          400
        );
      }

      // Obtener límites
      const limits = await getAILimits(workspaceId);

      logger.info('✅ Límites de IA obtenidos', {
        workspaceId,
        userEmail: req.user.email
      });

      return ResponseHandler.success(res, {
        workspaceId,
        limits,
        models: getAvailableModels(),
        timestamp: new Date().toISOString()
      }, 'Límites obtenidos exitosamente');

    } catch (error) {
      logger.error('❌ Error obteniendo límites de IA', {
        workspaceId: req.params?.workspaceId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * PUT /api/ai/ops/limits/:workspaceId
   * Actualizar límites de un workspace
   */
  static async updateLimits(req, res, next) {
    try {
      const { workspaceId } = req.params;
      const updates = req.body;

      // Verificar permisos (solo admin puede modificar límites)
      if (req.user.role !== 'admin') {
        throw CommonErrors.USER_NOT_AUTHORIZED('modificar límites de IA');
      }

      // Validar workspaceId
      if (!workspaceId) {
        throw new ApiError(
          'MISSING_WORKSPACE_ID',
          'workspaceId es requerido',
          'Proporciona el ID del workspace',
          400
        );
      }

      // Validar payload
      if (!updates || typeof updates !== 'object') {
        throw new ApiError(
          'INVALID_PAYLOAD',
          'Payload inválido',
          'Proporciona un objeto válido con los límites',
          400
        );
      }

      // Actualizar límites
      const newLimits = await updateAILimits(workspaceId, updates);

      logger.info('✅ Límites de IA actualizados', {
        workspaceId,
        userEmail: req.user.email,
        updates: Object.keys(updates)
      });

      return ResponseHandler.success(res, {
        workspaceId,
        limits: newLimits,
        updated: Object.keys(updates),
        timestamp: new Date().toISOString()
      }, 'Límites actualizados exitosamente');

    } catch (error) {
      logger.error('❌ Error actualizando límites de IA', {
        workspaceId: req.params?.workspaceId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * GET /api/ai/ops/counters
   * Obtener contadores y métricas
   */
  static async getCounters(req, res, next) {
    try {
      const { date, workspaceId, model } = req.query;

      // Verificar permisos (solo admin/ops pueden ver contadores)
      if (!['admin', 'ops'].includes(req.user.role)) {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver contadores de IA');
      }

      // Validar fecha
      const targetDate = date || new Date().toISOString().split('T')[0];

      // Obtener resumen diario
      const summary = await getDailySummary(targetDate, workspaceId);

      // Obtener estadísticas del cache
      const cacheStats = getCacheStats();

      logger.info('✅ Contadores de IA obtenidos', {
        date: targetDate,
        workspaceId,
        userEmail: req.user.email
      });

      return ResponseHandler.success(res, {
        date: targetDate,
        workspaceId,
        summary,
        cache: cacheStats,
        timestamp: new Date().toISOString()
      }, 'Contadores obtenidos exitosamente');

    } catch (error) {
      logger.error('❌ Error obteniendo contadores de IA', {
        date: req.query?.date,
        workspaceId: req.query?.workspaceId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * POST /api/ai/ops/breaker/:workspaceId
   * Forzar estado del circuit breaker
   */
  static async forceBreakerState(req, res, next) {
    try {
      const { workspaceId } = req.params;
      const { action, reason } = req.body;

      // Verificar permisos (solo admin puede forzar circuit breaker)
      if (req.user.role !== 'admin') {
        throw CommonErrors.USER_NOT_AUTHORIZED('forzar estado de circuit breaker');
      }

      // Validar workspaceId
      if (!workspaceId) {
        throw new ApiError(
          'MISSING_WORKSPACE_ID',
          'workspaceId es requerido',
          'Proporciona el ID del workspace',
          400
        );
      }

      // Validar acción
      if (!action || !['open', 'close'].includes(action)) {
        throw new ApiError(
          'INVALID_ACTION',
          'Acción inválida',
          'La acción debe ser "open" o "close"',
          400
        );
      }

      // Forzar estado
      const isOpen = action === 'open';
      const success = await forceBreakerState(workspaceId, isOpen, reason || 'manual_override');

      if (!success) {
        throw new ApiError(
          'BREAKER_UPDATE_FAILED',
          'Error actualizando circuit breaker',
          'No se pudo actualizar el estado del circuit breaker',
          500
        );
      }

      // Obtener estado actualizado
      const status = getBreakerStatus(workspaceId);

      logger.info('🔧 Estado del circuit breaker forzado', {
        workspaceId,
        action,
        reason: reason || 'manual_override',
        userEmail: req.user.email
      });

      return ResponseHandler.success(res, {
        workspaceId,
        action,
        reason: reason || 'manual_override',
        status,
        timestamp: new Date().toISOString()
      }, 'Estado del circuit breaker actualizado exitosamente');

    } catch (error) {
      logger.error('❌ Error forzando estado del circuit breaker', {
        workspaceId: req.params?.workspaceId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * GET /api/ai/ops/health
   * Obtener estado de salud general de IA
   */
  static async getHealth(req, res, next) {
    try {
      // Verificar permisos (solo admin/ops pueden ver salud)
      if (!['admin', 'ops'].includes(req.user.role)) {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver salud de IA');
      }

      // Obtener estadísticas de circuit breakers
      const breakerStats = getAllBreakerStats();
      
      // Obtener estadísticas de rate limiting
      const rateLimitStats = getRateLimitStats();
      
      // Obtener estadísticas del cache
      const cacheStats = getCacheStats();

      // Calcular métricas globales
      let totalBreakers = 0;
      let openBreakers = 0;
      let totalErrorRate = 0;
      let totalP95 = 0;
      let breakerCount = 0;

      Object.values(breakerStats).forEach(stats => {
        totalBreakers++;
        if (stats.isOpen) openBreakers++;
        if (stats.errorRate) {
          totalErrorRate += stats.errorRate;
          breakerCount++;
        }
        if (stats.p95_ms) totalP95 += stats.p95_ms;
      });

      const avgErrorRate = breakerCount > 0 ? totalErrorRate / breakerCount : 0;
      const avgP95 = Object.values(breakerStats).filter(s => s.p95_ms).length > 0 
        ? totalP95 / Object.values(breakerStats).filter(s => s.p95_ms).length 
        : null;

      const health = {
        provider_ready: openBreakers === 0,
        error_rate_pct: Math.round(avgErrorRate * 100) / 100,
        p95_ms: avgP95 ? Math.round(avgP95) : null,
        caps_remaining: {
          total_workspaces: totalBreakers,
          open_breakers: openBreakers,
          healthy_breakers: totalBreakers - openBreakers
        },
        rate_limiting: {
          total_conversations: rateLimitStats.totalConversations,
          config: rateLimitStats.config
        },
        cache: {
          size: cacheStats.size,
          keys_count: cacheStats.keys.length
        },
        timestamp: new Date().toISOString()
      };

      logger.info('✅ Estado de salud de IA obtenido', {
        userEmail: req.user.email,
        providerReady: health.provider_ready,
        openBreakers,
        totalBreakers
      });

      return ResponseHandler.success(res, health, 'Estado de salud obtenido exitosamente');

    } catch (error) {
      logger.error('❌ Error obteniendo estado de salud de IA', {
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * GET /api/ai/ops/breakers
   * Obtener estado de todos los circuit breakers
   */
  static async getAllBreakers(req, res, next) {
    try {
      // Verificar permisos (solo admin/ops pueden ver circuit breakers)
      if (!['admin', 'ops'].includes(req.user.role)) {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver circuit breakers');
      }

      // Obtener estadísticas de todos los circuit breakers
      const breakerStats = getAllBreakerStats();

      logger.info('✅ Estado de circuit breakers obtenido', {
        userEmail: req.user.email,
        totalBreakers: Object.keys(breakerStats).length
      });

      return ResponseHandler.success(res, {
        breakers: breakerStats,
        total: Object.keys(breakerStats).length,
        timestamp: new Date().toISOString()
      }, 'Estado de circuit breakers obtenido exitosamente');

    } catch (error) {
      logger.error('❌ Error obteniendo estado de circuit breakers', {
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }
}

module.exports = AIOpsController; 