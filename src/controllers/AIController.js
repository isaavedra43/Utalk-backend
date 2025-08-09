/**
 * 🤖 CONTROLADOR DE IA
 * 
 * Maneja endpoints de configuración IA y operaciones de sugerencias
 * sin integrar con webhooks existentes.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
const { getAIConfig, updateAIConfig, isAIEnabled } = require('../config/aiConfig');
const { aiLogger } = require('../utils/aiLogger');
const AIService = require('../services/AIService');
const logger = require('../utils/logger');

class AIController {
  /**
   * GET /api/ai/config/:workspaceId
   * Obtener configuración IA de un workspace
   */
  static async getAIConfig(req, res, next) {
    try {
      const { workspaceId } = req.params;

      // Validar workspaceId
      if (!workspaceId) {
        throw new ApiError(
          'MISSING_WORKSPACE_ID',
          'workspaceId es requerido',
          'Proporciona el ID del workspace',
          400
        );
      }

      // Verificar permisos (solo admin puede ver config)
      if (req.user.role !== 'admin') {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver configuración IA', workspaceId);
      }

      // Obtener configuración
      const config = await getAIConfig(workspaceId);

      logger.info('✅ Configuración IA obtenida', {
        workspaceId,
        userEmail: req.user.email,
        aiEnabled: config.ai_enabled
      });

      return ResponseHandler.success(res, config, 'Configuración IA obtenida exitosamente');

    } catch (error) {
      logger.error('❌ Error obteniendo configuración IA', {
        workspaceId: req.params?.workspaceId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * PUT /api/ai/config/:workspaceId
   * Actualizar configuración IA de un workspace
   */
  static async updateAIConfig(req, res, next) {
    try {
      const { workspaceId } = req.params;
      const updates = req.body;

      // Validar workspaceId
      if (!workspaceId) {
        throw new ApiError(
          'MISSING_WORKSPACE_ID',
          'workspaceId es requerido',
          'Proporciona el ID del workspace',
          400
        );
      }

      // Verificar permisos (solo admin puede modificar config)
      if (req.user.role !== 'admin') {
        throw CommonErrors.USER_NOT_AUTHORIZED('modificar configuración IA', workspaceId);
      }

      // Validar payload
      if (!updates || typeof updates !== 'object') {
        throw new ApiError(
          'INVALID_PAYLOAD',
          'Payload inválido',
          'Proporciona un objeto válido con la configuración',
          400
        );
      }

      // Actualizar configuración
      const updatedConfig = await updateAIConfig(workspaceId, updates);

      logger.info('✅ Configuración IA actualizada', {
        workspaceId,
        userEmail: req.user.email,
        updates: Object.keys(updates)
      });

      return ResponseHandler.success(res, updatedConfig, 'Configuración IA actualizada exitosamente');

    } catch (error) {
      logger.error('❌ Error actualizando configuración IA', {
        workspaceId: req.params?.workspaceId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * POST /api/ai/test-suggestion
   * Endpoint de prueba para generar sugerencia (sin webhook)
   */
  static async testSuggestion(req, res, next) {
    try {
      const { workspaceId, conversationId, messageId } = req.body;

      // Validar campos requeridos
      if (!workspaceId || !conversationId || !messageId) {
        throw new ApiError(
          'MISSING_REQUIRED_FIELDS',
          'workspaceId, conversationId y messageId son requeridos',
          'Proporciona todos los campos obligatorios',
          400
        );
      }

      // Verificar permisos
      if (req.user.role !== 'admin' && req.user.role !== 'agent') {
        throw CommonErrors.USER_NOT_AUTHORIZED('generar sugerencias IA', workspaceId);
      }

      logger.info('🧪 Iniciando prueba de sugerencia IA', {
        workspaceId,
        conversationId,
        messageId,
        userEmail: req.user.email
      });

      // Generar sugerencia
      const result = await AIService.generateSuggestionForMessage(
        workspaceId,
        conversationId,
        messageId,
        {
          test: true
        }
      );

      if (!result.success) {
        throw new ApiError(
          'SUGGESTION_GENERATION_FAILED',
          'Error generando sugerencia',
          result.reason,
          500
        );
      }

      // Guardar sugerencia en Firestore
      const savedSuggestion = await AIService.saveSuggestion(result.suggestion);

      logger.info('✅ Prueba de sugerencia IA completada', {
        workspaceId,
        conversationId,
        messageId,
        suggestionId: savedSuggestion.id,
        userEmail: req.user.email
      });

      return ResponseHandler.success(res, {
        suggestion: savedSuggestion,
        context: result.context,
        metrics: result.metrics
      }, 'Sugerencia IA generada exitosamente', 201);

    } catch (error) {
      logger.error('❌ Error en prueba de sugerencia IA', {
        workspaceId: req.body?.workspaceId,
        conversationId: req.body?.conversationId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * GET /api/ai/suggestions/:conversationId
   * Obtener sugerencias de una conversación
   */
  static async getSuggestions(req, res, next) {
    try {
      const { conversationId } = req.params;
      const { limit = 10, status } = req.query;

      // Validar conversationId
      if (!conversationId) {
        throw new ApiError(
          'MISSING_CONVERSATION_ID',
          'conversationId es requerido',
          'Proporciona el ID de la conversación',
          400
        );
      }

      // Verificar permisos
      if (req.user.role !== 'admin' && req.user.role !== 'agent') {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver sugerencias IA', conversationId);
      }

      // Obtener sugerencias
      const suggestions = await AIService.getSuggestionsForConversation(conversationId, {
        limit: parseInt(limit),
        status
      });

      logger.info('✅ Sugerencias obtenidas', {
        conversationId,
        count: suggestions.length,
        userEmail: req.user.email
      });

      return ResponseHandler.success(res, {
        suggestions,
        count: suggestions.length
      }, `${suggestions.length} sugerencias obtenidas`);

    } catch (error) {
      logger.error('❌ Error obteniendo sugerencias', {
        conversationId: req.params?.conversationId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * PUT /api/ai/suggestions/:conversationId/:suggestionId/status
   * Actualizar estado de una sugerencia
   */
  static async updateSuggestionStatus(req, res, next) {
    try {
      const { conversationId, suggestionId } = req.params;
      const { status } = req.body;

      // Validar campos requeridos
      if (!conversationId || !suggestionId || !status) {
        throw new ApiError(
          'MISSING_REQUIRED_FIELDS',
          'conversationId, suggestionId y status son requeridos',
          'Proporciona todos los campos obligatorios',
          400
        );
      }

      // Validar status
      const validStatuses = ['draft', 'used', 'rejected', 'archived'];
      if (!validStatuses.includes(status)) {
        throw new ApiError(
          'INVALID_STATUS',
          'Status inválido',
          `Status debe ser uno de: ${validStatuses.join(', ')}`,
          400
        );
      }

      // Verificar permisos
      if (req.user.role !== 'admin' && req.user.role !== 'agent') {
        throw CommonErrors.USER_NOT_AUTHORIZED('actualizar sugerencias IA', conversationId);
      }

      // Actualizar estado
      const result = await AIService.updateSuggestionStatus(conversationId, suggestionId, status);

      logger.info('✅ Estado de sugerencia actualizado', {
        conversationId,
        suggestionId,
        status,
        userEmail: req.user.email
      });

      return ResponseHandler.success(res, result, 'Estado de sugerencia actualizado exitosamente');

    } catch (error) {
      logger.error('❌ Error actualizando estado de sugerencia', {
        conversationId: req.params?.conversationId,
        suggestionId: req.params?.suggestionId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * GET /api/ai/stats/:workspaceId
   * Obtener estadísticas de IA por workspace
   */
  static async getAIStats(req, res, next) {
    try {
      const { workspaceId } = req.params;
      const { days = 7 } = req.query;

      // Validar workspaceId
      if (!workspaceId) {
        throw new ApiError(
          'MISSING_WORKSPACE_ID',
          'workspaceId es requerido',
          'Proporciona el ID del workspace',
          400
        );
      }

      // Verificar permisos
      if (req.user.role !== 'admin') {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver estadísticas IA', workspaceId);
      }

      // Obtener estadísticas
      const [suggestionStats, usageStats] = await Promise.all([
        AIService.getSuggestionStats(workspaceId, parseInt(days)),
        aiLogger.getUsageStats(workspaceId, parseInt(days))
      ]);

      const stats = {
        suggestions: suggestionStats,
        usage: usageStats,
        workspaceId,
        period: `${days} días`
      };

      logger.info('✅ Estadísticas IA obtenidas', {
        workspaceId,
        userEmail: req.user.email,
        days
      });

      return ResponseHandler.success(res, stats, 'Estadísticas IA obtenidas exitosamente');

    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas IA', {
        workspaceId: req.params?.workspaceId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * GET /api/ai/health
   * Health check del módulo IA
   */
  static async getAIHealth(req, res, next) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        phase: 'A',
        features: {
          config: true,
          suggestions: true,
          contextLoader: true,
          logging: true,
          fakeMode: true
        },
        environment: {
          nodeEnv: process.env.NODE_ENV || 'development',
          aiEnabled: process.env.AI_ENABLED === 'true'
        }
      };

      logger.info('✅ Health check IA', {
        status: health.status,
        userEmail: req.user?.email
      });

      return ResponseHandler.success(res, health, 'Módulo IA funcionando correctamente');

    } catch (error) {
      logger.error('❌ Error en health check IA', {
        error: error.message
      });

      return ResponseHandler.success(res, {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      }, 'Módulo IA con problemas', 500);
    }
  }
}

module.exports = AIController;