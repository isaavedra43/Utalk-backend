/**
 * 🤖 CONTROLADOR DEL COPILOTO IA
 * 
 * Maneja endpoints del copiloto IA para agentes
 * integrando con servicios existentes.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
const { copilotCacheService } = require('../services/CopilotCacheService');
const { copilotOrchestratorService } = require('../services/CopilotOrchestratorService');
const { professionalResponseService } = require('../services/ProfessionalResponseService');
const { conversationAnalysisService } = require('../services/ConversationAnalysisService');
const { customerServiceStrategyService } = require('../services/CustomerServiceStrategyService');
const { experienceImprovementService } = require('../services/ExperienceImprovementService');
const logger = require('../utils/logger');

class CopilotController {
  /**
   * POST /api/copilot/chat
   * Chat principal del copiloto (delegado al orquestador)
   */
  static async chat(req, res, next) {
    try {
      const { message, conversationId, agentId } = req.body;

      if (!message || !conversationId || !agentId) {
        throw new ApiError(
          'MISSING_REQUIRED_FIELDS',
          'message, conversationId y agentId son requeridos',
          'Proporciona todos los campos obligatorios',
          400
        );
      }

      logger.info('🚀 Copiloto chat iniciado', {
        conversationId,
        agentId,
        messageLength: message.length
      });

      const result = await copilotOrchestratorService.processMessage(
        message,
        conversationId,
        agentId,
        req.user.workspaceId
      );

      if (!result.ok) {
        throw new ApiError(
          'LLM_GENERATION_FAILED',
          'Error generando respuesta',
          result.error || 'Unknown',
          500
        );
      }

      logger.info('✅ Copiloto chat completado', {
        conversationId,
        agentId,
        responseLength: (result.text || '').length,
        model: result.model || null
      });

      return ResponseHandler.success(res, {
        response: result.text,
        source: 'llm_studio',
        conversationId,
        usage: result.usage,
        model: result.model || null,
        suggestions: result.suggestions || []
      }, 'Respuesta del copiloto');

    } catch (error) {
      logger.error('❌ Error en copiloto chat', {
        conversationId: req.body?.conversationId,
        agentId: req.body?.agentId,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * GET /api/copilot/health
   * Health check del copiloto
   */
  static async health(req, res, next) {
    try {
      const cacheStats = copilotCacheService.getStats();

      logger.info('🏥 Copiloto health check', { cacheStats });

      return ResponseHandler.success(res, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        cache: cacheStats
      }, 'Copiloto funcionando correctamente');

    } catch (error) {
      logger.error('❌ Error en copiloto health check', { error: error.message });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * POST /api/copilot/test
   * Test de funcionalidad del copiloto (simple)
   */
  static async test(req, res, next) {
    try {
      const testMessage = "Hola, necesito ayuda con un cliente";
      const result = await copilotOrchestratorService.processMessage(testMessage, 'test', 'test', req.user.workspaceId);

      return ResponseHandler.success(res, {
        status: 'test_completed',
        timestamp: new Date().toISOString(),
        result
      }, 'Test del copiloto completado');

    } catch (error) {
      logger.error('❌ Error en copiloto test', { error: error.message });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * POST /api/copilot/clear-cache
   * Limpiar cache del copiloto
   */
  static async clearCache(req, res, next) {
    try {
      await copilotCacheService.clearCache();
      
      logger.info('🧹 Cache del copiloto limpiado');

      return ResponseHandler.success(res, {
        status: 'cache_cleared',
        timestamp: new Date().toISOString()
      }, 'Cache del copiloto limpiado');

    } catch (error) {
      logger.error('❌ Error limpiando cache del copiloto', { error: error.message });
      return ResponseHandler.error(res, error);
    }
  }

  // POST /api/copilot/generate-response
  static async generateResponse(req, res) {
    try {
      const { conversationId, agentId, message } = req.body || {};
      if (!conversationId || !agentId) {
        throw new ApiError('MISSING_REQUIRED_FIELDS', 'conversationId y agentId requeridos', 'Completa los campos requeridos', 400);
      }
      const result = await copilotOrchestratorService.processMessage(message || '', conversationId, agentId, req.user.workspaceId);
      if (!result.ok) throw new ApiError('LLM_ERROR', result.error || 'Error', result.error || 'Error', 500);
      return ResponseHandler.success(res, { response: result.text, model: result.model || null, suggestions: result.suggestions || [] }, 'Respuesta generada');
    } catch (error) { return ResponseHandler.error(res, error); }
  }

  // POST /api/copilot/analyze-conversation
  static async analyzeConversation(req, res) {
    try {
      const { conversationMemory } = req.body || {};
      const tone = await conversationAnalysisService.analyzeTone(conversationMemory || {});
      const opportunities = await conversationAnalysisService.identifyOpportunities(conversationMemory || {});
      return ResponseHandler.success(res, { tone, opportunities }, 'Análisis de conversación');
    } catch (error) { return ResponseHandler.error(res, error); }
  }

  // POST /api/copilot/optimize-response
  static async optimizeResponse(req, res) {
    try {
      const { response } = req.body || {};
      if (!response) throw new ApiError('MISSING_REQUIRED_FIELDS', 'response requerido', 'Proporciona response', 400);
      const optimized = await professionalResponseService.optimizeExistingResponse(response);
      return ResponseHandler.success(res, { optimized }, 'Respuesta optimizada');
    } catch (error) { return ResponseHandler.error(res, error); }
  }

  // POST /api/copilot/strategy-suggestions
  static async strategySuggestions(req, res) {
    try {
      const { analysis, conversationMemory } = req.body || {};
      const strategies = await customerServiceStrategyService.suggestStrategies({ analysis });
      const actionPlan = await customerServiceStrategyService.generateActionPlan({ analysis });
      return ResponseHandler.success(res, { strategies, actionPlan }, 'Sugerencias de estrategia');
    } catch (error) { return ResponseHandler.error(res, error); }
  }

  // POST /api/copilot/quick-response
  static async quickResponse(req, res) {
    try {
      const { urgency = 'normal', context = {} } = req.body || {};
      const { ProfessionalResponseService } = require('../services/ProfessionalResponseService');
      const quick = await professionalResponseService.generateQuickResponse(urgency, context);
      return ResponseHandler.success(res, { quick }, 'Respuesta rápida');
    } catch (error) { return ResponseHandler.error(res, error); }
  }

  // POST /api/copilot/improve-experience
  static async improveExperience(req, res) {
    try {
      const { conversationMemory, analysis } = req.body || {};
      const gaps = await experienceImprovementService.identifyExperienceGaps(conversationMemory || {});
      const improvements = await experienceImprovementService.suggestImprovements({ analysis });
      const plan = await experienceImprovementService.generateEnhancementPlan({ analysis });
      return ResponseHandler.success(res, { gaps, improvements, plan }, 'Mejoras de experiencia');
    } catch (error) { return ResponseHandler.error(res, error); }
  }
}

module.exports = CopilotController;
