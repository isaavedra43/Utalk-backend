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
const { checkAllProvidersHealth } = require('../ai/vendors');
const logger = require('../utils/logger');
const { Suggestion } = require('../models/Suggestion');

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
   * POST /api/ai/dry-run/suggest
   * Endpoint de prueba para generar sugerencia (dry-run, no guarda en DB)
   */
  static async dryRunSuggestion(req, res, next) {
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

      logger.info('🧪 Iniciando dry-run de sugerencia IA', {
        workspaceId,
        conversationId,
        messageId,
        userEmail: req.user.email
      });

      // Generar sugerencia (sin guardar en DB)
      const result = await AIService.generateSuggestionForMessage(
        workspaceId,
        conversationId,
        messageId,
        {
          dryRun: true
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

      // Preparar respuesta de dry-run
      const suggestion = result.suggestion;
      const warnings = [];

      // Verificar latencia
      if (result.metrics.latencyMs > 2500) {
        warnings.push('Latencia alta detectada');
      }

      // Verificar si es real o fake
      if (!result.isReal) {
        warnings.push('Usando modo fake (proveedor no disponible)');
      }

      // Verificar longitud de sugerencia
      if (suggestion.sugerencia.texto.length > 300) {
        warnings.push('Sugerencia muy larga');
      }

      logger.info('✅ Dry-run de sugerencia IA completado', {
        workspaceId,
        conversationId,
        messageId,
        suggestionId: suggestion.id,
        isReal: result.isReal,
        latencyMs: result.metrics.latencyMs,
        userEmail: req.user.email
      });

      return ResponseHandler.success(res, {
        ok: true,
        suggestion_preview: suggestion.sugerencia.texto.substring(0, 300),
        usage: {
          in: result.metrics.tokensIn,
          out: result.metrics.tokensOut,
          latencyMs: result.metrics.latencyMs
        },
        warnings: warnings,
        provider: result.provider,
        isReal: result.isReal
      }, 'Sugerencia IA generada exitosamente (dry-run)', 200);

    } catch (error) {
      logger.error('❌ Error en dry-run de sugerencia IA', {
        workspaceId: req.body?.workspaceId,
        conversationId: req.body?.conversationId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * POST /api/ai/suggestions/generate
   * Endpoint interno para generar y guardar sugerencia
   */
  static async generateSuggestion(req, res, next) {
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

      // Verificar permisos (solo roles internos/admin/QA)
      if (!['admin', 'agent', 'qa'].includes(req.user.role)) {
        throw CommonErrors.USER_NOT_AUTHORIZED('generar sugerencias IA', workspaceId);
      }

      // Verificar feature flags
      const aiEnabled = process.env.AI_ENABLED === 'true';
      if (!aiEnabled) {
        throw new ApiError(
          'AI_DISABLED',
          'Módulo IA deshabilitado globalmente',
          'El módulo IA no está habilitado',
          403
        );
      }

      // Verificar configuración del workspace
      const config = await getAIConfig(workspaceId);
      if (!config.ai_enabled || !config.flags.suggestions) {
        throw new ApiError(
          'SUGGESTIONS_DISABLED',
          'Sugerencias IA deshabilitadas para este workspace',
          'Las sugerencias IA no están habilitadas para este workspace',
          403
        );
      }

      logger.info('🚀 Iniciando generación de sugerencia IA', {
        workspaceId,
        conversationId,
        messageId,
        userEmail: req.user.email,
        userRole: req.user.role
      });

      // Generar sugerencia (con guardado en Firestore)
      const result = await AIService.generateSuggestionForMessage(
        workspaceId,
        conversationId,
        messageId,
        {
          dryRun: false // Guardar en Firestore
        }
      );

      if (!result.success) {
        throw new ApiError(
          'SUGGESTION_GENERATION_FAILED',
          'Error generando sugerencia',
          result.reason || 'Error desconocido en la generación',
          500
        );
      }

      const suggestion = result.suggestion;
      const savedSuggestion = result.savedSuggestion;

      // Preparar respuesta
      const response = {
        ok: true,
        suggestionId: suggestion.id,
        conversationId: suggestion.conversationId,
        messageIdOrigen: suggestion.messageIdOrigen,
        preview: savedSuggestion ? savedSuggestion.getPreview() : suggestion.sugerencia.texto.substring(0, 200),
        usage: {
          in: result.metrics.tokensIn,
          out: result.metrics.tokensOut,
          latencyMs: result.metrics.latencyMs
        },
        flagged: suggestion.flagged || false,
        warnings: []
      };

      // Agregar warnings si es necesario
      if (result.metrics.latencyMs > 2500) {
        response.warnings.push('Latencia alta detectada');
      }

      if (!result.isReal) {
        response.warnings.push('Usando modo fake (proveedor no disponible)');
      }

      if (suggestion.flagged) {
        response.warnings.push('Contenido sensible detectado');
      }

      if (!savedSuggestion) {
        response.warnings.push('No se pudo guardar en base de datos');
      }

      logger.info('✅ Sugerencia IA generada y guardada exitosamente', {
        workspaceId,
        conversationId,
        messageId,
        suggestionId: suggestion.id,
        isReal: result.isReal,
        latencyMs: result.metrics.latencyMs,
        flagged: suggestion.flagged,
        saved: !!savedSuggestion,
        userEmail: req.user.email
      });

      return ResponseHandler.success(res, response, 'Sugerencia IA generada exitosamente', 200);

    } catch (error) {
      logger.error('❌ Error en generación de sugerencia IA', {
        workspaceId: req.body?.workspaceId,
        conversationId: req.body?.conversationId,
        messageId: req.body?.messageId,
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
      const { limit = 20, estado, flagged } = req.query;

      // Verificar permisos
      if (req.user.role !== 'admin' && req.user.role !== 'agent') {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver sugerencias IA', conversationId);
      }

      const options = {
        limit: parseInt(limit),
        estado: estado || null,
        flagged: flagged !== undefined ? flagged === 'true' : null
      };

      const suggestions = await AIService.getSuggestionsForConversation(conversationId, options);

      logger.info('✅ Sugerencias obtenidas', {
        conversationId,
        count: suggestions.length,
        userEmail: req.user.email
      });

      return ResponseHandler.success(res, {
        suggestions: suggestions.map(s => ({
          id: s.id,
          conversationId: s.conversationId,
          messageIdOrigen: s.messageIdOrigen,
          texto: s.texto,
          confianza: s.confianza,
          estado: s.estado,
          flagged: s.flagged,
          modelo: s.modelo,
          createdAt: s.createdAt,
          preview: s.getPreview(),
          tipo: s.getType()
        })),
        count: suggestions.length
      }, 'Sugerencias obtenidas exitosamente');

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

      // Verificar permisos
      if (req.user.role !== 'admin' && req.user.role !== 'agent') {
        throw CommonErrors.USER_NOT_AUTHORIZED('actualizar sugerencias IA', conversationId);
      }

      // Validar estado
      const validStates = ['draft', 'sent', 'discarded'];
      if (!validStates.includes(status)) {
        throw new ApiError(
          'INVALID_STATUS',
          'Estado inválido',
          'El estado debe ser draft, sent o discarded',
          400
        );
      }

      const result = await AIService.updateSuggestionStatus(conversationId, suggestionId, status);

      logger.info('✅ Estado de sugerencia actualizado', {
        conversationId,
        suggestionId,
        newStatus: status,
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
   * GET /api/ai/suggestions/:conversationId/stats
   * Obtener estadísticas de sugerencias
   */
  static async getSuggestionStats(req, res, next) {
    try {
      const { conversationId } = req.params;

      // Verificar permisos
      if (req.user.role !== 'admin' && req.user.role !== 'agent') {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver estadísticas de sugerencias IA', conversationId);
      }

      const stats = await AIService.getSuggestionStats(conversationId);

      logger.info('✅ Estadísticas de sugerencias obtenidas', {
        conversationId,
        userEmail: req.user.email
      });

      return ResponseHandler.success(res, stats, 'Estadísticas obtenidas exitosamente');

    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas de sugerencias', {
        conversationId: req.params?.conversationId,
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
   * Health check del módulo IA con proveedores
   */
  static async getAIHealth(req, res, next) {
    try {
      // Verificar si IA está habilitada globalmente
      const aiEnabled = process.env.AI_ENABLED === 'true';
      
      if (!aiEnabled) {
        return ResponseHandler.success(res, {
          status: 'disabled',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          phase: 'B',
          reason: 'AI_ENABLED=false',
          features: {
            config: true,
            suggestions: true,
            contextLoader: true,
            logging: true,
            fakeMode: true,
            provider_ready: false
          }
        }, 'Módulo IA deshabilitado', 200);
      }

      // Verificar salud de proveedores
      const providersHealth = await checkAllProvidersHealth();
      const openaiHealth = providersHealth.openai;
      
      // Determinar estado general
      let status = 'healthy';
      let provider_ready = false;
      
      if (openaiHealth && openaiHealth.ok) {
        provider_ready = true;
      } else {
        status = 'degraded';
      }

      const health = {
        status: status,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        phase: 'B',
        features: {
          config: true,
          suggestions: true,
          contextLoader: true,
          logging: true,
          fakeMode: true,
          provider_ready: provider_ready
        },
        providers: providersHealth,
        environment: {
          nodeEnv: process.env.NODE_ENV || 'development',
          aiEnabled: aiEnabled,
          openaiKey: !!process.env.OPENAI_API_KEY
        }
      };

      logger.info('✅ Health check IA', {
        status: health.status,
        provider_ready: provider_ready,
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