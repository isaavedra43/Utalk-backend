/**
 * 🕹️ COPILOT ORCHESTRATOR SERVICE - COMPLETAMENTE DINÁMICO
 *
 * Orquesta todos los servicios del copiloto para procesar un mensaje end-to-end
 * usando la infraestructura existente sin duplicar lógica.
 * TODO DINÁMICO - SIN CONTENIDO FIJO
 *
 * @version 2.0.0 COMPLETAMENTE DINÁMICO
 */

const { copilotCacheService } = require('./CopilotCacheService');
const { copilotMemoryService } = require('./CopilotMemoryService');
const { intelligentPromptService } = require('./IntelligentPromptService');
const { requestOptimizationService } = require('./RequestOptimizationService');
const { needsPredictionService } = require('./NeedsPredictionService');
const { agentPersonalizationService } = require('./AgentPersonalizationService');
const { professionalResponseService } = require('./ProfessionalResponseService');
const { conversationAnalysisService } = require('./ConversationAnalysisService');
const { customerServiceStrategyService } = require('./CustomerServiceStrategyService');
const { experienceImprovementService } = require('./ExperienceImprovementService');
const { copilotMetricsService } = require('./CopilotMetricsService');
const { generateWithProvider, isProviderAvailable } = require('../ai/vendors');
const logger = require('../utils/logger');

class CopilotOrchestratorService {
  async processMessage(userMessage, conversationId, agentId, workspaceId) {
    const start = Date.now();

    try {
      // 1. Verificar cache dinámicamente
      const cached = await copilotCacheService.getCachedResponse(userMessage, { conversationId, agentId });
      if (cached) {
        await copilotMetricsService.trackResponseTime(start, Date.now(), true);
        await copilotMetricsService.trackUsage(agentId, 'chat_cache');
        return { ok: true, text: cached, source: 'cache' };
      }

      // 2. Obtener memoria de conversación dinámicamente
      const conversationMemory = await copilotMemoryService.getConversationMemory(conversationId, userMessage);

      // 3. Análisis dinámico del mensaje
      const analysis = await intelligentPromptService.analyzeUserMessage(userMessage);
      analysis.userMessage = userMessage;
      const approach = await intelligentPromptService.determineBestApproach(analysis);

      // 4. Optimización dinámica del contexto
      const compressedContext = await requestOptimizationService.compressContext(conversationMemory);
      const optimizedContext = await requestOptimizationService.optimizeTokens(compressedContext);
      const estimatedTokens = Math.min((approach.maxTokens || 300) + (analysis.wordCount || 0), 600);
      const model = await requestOptimizationService.selectBestModel(analysis.intent, estimatedTokens);
      const optimalConfig = await requestOptimizationService.getOptimalConfig(analysis.intent);

      // 5. Crear prompt dinámico optimizado
      const prompt = await intelligentPromptService.createOptimizedPrompt(analysis, { ...approach, ...optimalConfig }, { conversationMemory: optimizedContext });

      // 6. Generar respuesta con LLM Studio (preferido) o fallback a OpenAI
      let llmResponse = await generateWithProvider('llm_studio', {
        prompt,
        model,
        temperature: optimalConfig.temperature,
        maxTokens: optimalConfig.maxTokens,
        workspaceId,
        conversationId
      });

      if (!llmResponse.ok && isProviderAvailable('openai')) {
        logger.warn('LLM Studio falló, aplicando fallback a OpenAI');
        llmResponse = await generateWithProvider('openai', {
          prompt,
          model: 'gpt-4o-mini',
          temperature: optimalConfig.temperature,
          maxTokens: optimalConfig.maxTokens,
          workspaceId,
          conversationId
        });
      }

      if (!llmResponse.ok) {
        await copilotMetricsService.trackResponseTime(start, Date.now(), false);
        await copilotMetricsService.trackUsage(agentId, 'chat_error');
        return { ok: false, error: llmResponse.message || 'LLM error' };
      }

      // 7. Procesar respuesta dinámicamente
      let finalText = llmResponse.text;

      // 8. Análisis dinámico de necesidades (solo si es relevante)
      const needsAnalysis = await this.performDynamicNeedsAnalysis(userMessage, analysis);
      
      // 9. Optimización dinámica de respuesta profesional
      const professionalOptimization = await this.performDynamicProfessionalOptimization(finalText, analysis, conversationMemory);
      if (professionalOptimization) {
        finalText = professionalOptimization;
      }

      // 10. Análisis dinámico de conversación (solo si es relevante)
      const conversationInsights = await this.performDynamicConversationAnalysis(conversationMemory, analysis);
      
      // 11. Estrategias dinámicas de servicio al cliente (solo si es relevante)
      const serviceStrategies = await this.performDynamicServiceStrategies(analysis);
      
      // 12. Mejoras dinámicas de experiencia (solo si es relevante)
      const experienceImprovements = await this.performDynamicExperienceImprovements(conversationMemory, analysis);

      // 13. Generar anexo dinámico para el agente (solo si hay información relevante)
      const dynamicAgentAnnex = this.generateDynamicAgentAnnex(needsAnalysis, conversationInsights, serviceStrategies, experienceImprovements);
      
      if (dynamicAgentAnnex.length > 0) {
        finalText += '\n\n---\nNotas para el agente (no enviar al cliente):\n' + dynamicAgentAnnex.join('\n\n');
      }

      // 14. Personalización dinámica para el agente
      finalText = await agentPersonalizationService.adaptResponseToAgent(finalText, agentId);

      // 15. Cache y memoria dinámicos
      await copilotCacheService.cacheResponse(userMessage, { conversationId, agentId }, finalText);
      await copilotMemoryService.addToMemory(conversationId, userMessage, finalText);

      // 16. Métricas dinámicas
      await copilotMetricsService.trackResponseTime(start, Date.now(), true);
      await copilotMetricsService.trackUsage(agentId, 'chat');
      await copilotMetricsService.trackAccuracy(userMessage, finalText, null);

      return { 
        ok: true, 
        text: finalText, 
        model, 
        usage: llmResponse.usage, 
        suggestions: needsAnalysis.proactiveSuggestions || []
      };

    } catch (error) {
      await copilotMetricsService.trackResponseTime(start, Date.now(), false);
      logger.error('Error en orquestador dinámico del copiloto', { error: error.message });
      return { ok: false, error: error.message };
    }
  }

  /**
   * Análisis dinámico de necesidades
   */
  async performDynamicNeedsAnalysis(userMessage, analysis) {
    try {
      // Solo analizar necesidades si el mensaje es complejo o requiere análisis
      if (analysis.complexity === 'simple' && analysis.intent === 'general_inquiry') {
        return { proactiveSuggestions: [] };
      }

      const patterns = await needsPredictionService.analyzeConversationPatterns(userMessage);
      const implicitNeeds = await needsPredictionService.detectImplicitNeeds(userMessage, patterns);
      const futureNeeds = await needsPredictionService.predictFutureNeeds(implicitNeeds);
      const proactiveSuggestions = await needsPredictionService.generateProactiveSuggestions(futureNeeds);

      return {
        patterns,
        implicitNeeds,
        futureNeeds,
        proactiveSuggestions
      };
    } catch (error) {
      logger.warn('Error en análisis dinámico de necesidades', { error: error.message });
      return { proactiveSuggestions: [] };
    }
  }

  /**
   * Optimización dinámica de respuesta profesional
   */
  async performDynamicProfessionalOptimization(finalText, analysis, conversationMemory) {
    try {
      // Solo optimizar si es necesario
      if (analysis.complexity === 'simple' && analysis.sentiment === 'positive') {
        return null; // No optimizar respuestas simples y positivas
      }

      const professional = await professionalResponseService.generateProfessionalResponse({ conversationMemory, analysis });
      if (professional) {
        return await professionalResponseService.optimizeExistingResponse(professional);
      }
      
      return await professionalResponseService.optimizeExistingResponse(finalText);
    } catch (error) {
      logger.warn('Error en optimización dinámica profesional', { error: error.message });
      return null;
    }
  }

  /**
   * Análisis dinámico de conversación
   */
  async performDynamicConversationAnalysis(conversationMemory, analysis) {
    try {
      // Solo analizar si hay suficiente contexto
      if (!conversationMemory || !conversationMemory.recentMessages || conversationMemory.recentMessages.length < 2) {
        return { opportunities: [] };
      }

      const convAnalysis = await conversationAnalysisService.analyzeTone(conversationMemory);
      const convOpportunities = await conversationAnalysisService.identifyOpportunities(conversationMemory);

      return {
        tone: convAnalysis,
        opportunities: convOpportunities
      };
    } catch (error) {
      logger.warn('Error en análisis dinámico de conversación', { error: error.message });
      return { opportunities: [] };
    }
  }

  /**
   * Estrategias dinámicas de servicio al cliente
   */
  async performDynamicServiceStrategies(analysis) {
    try {
      // Solo generar estrategias para casos complejos o negativos
      if (analysis.complexity === 'simple' && analysis.sentiment !== 'negative') {
        return { strategies: [], actionPlan: [] };
      }

      const strategies = await customerServiceStrategyService.suggestStrategies({ analysis });
      const actionPlan = await customerServiceStrategyService.generateActionPlan({ analysis });

      return {
        strategies,
        actionPlan
      };
    } catch (error) {
      logger.warn('Error en estrategias dinámicas de servicio', { error: error.message });
      return { strategies: [], actionPlan: [] };
    }
  }

  /**
   * Mejoras dinámicas de experiencia
   */
  async performDynamicExperienceImprovements(conversationMemory, analysis) {
    try {
      // Solo analizar mejoras para conversaciones complejas
      if (analysis.complexity === 'simple') {
        return { gaps: [], improvements: [] };
      }

      const gaps = await experienceImprovementService.identifyExperienceGaps(conversationMemory);
      const improvements = await experienceImprovementService.suggestImprovements({ analysis });

      return {
        gaps,
        improvements
      };
    } catch (error) {
      logger.warn('Error en mejoras dinámicas de experiencia', { error: error.message });
      return { gaps: [], improvements: [] };
    }
  }

  /**
   * Generar anexo dinámico para el agente
   */
  generateDynamicAgentAnnex(needsAnalysis, conversationInsights, serviceStrategies, experienceImprovements) {
    const agentAnnex = [];

    // Solo agregar información relevante y útil
    if (needsAnalysis.proactiveSuggestions && needsAnalysis.proactiveSuggestions.length > 0) {
      agentAnnex.push('Sugerencias proactivas:\n- ' + needsAnalysis.proactiveSuggestions.join('\n- '));
    }

    if (conversationInsights.opportunities && conversationInsights.opportunities.length > 0) {
      agentAnnex.push('Oportunidades:\n- ' + conversationInsights.opportunities.join('\n- '));
    }

    if (serviceStrategies.strategies && serviceStrategies.strategies.length > 0) {
      agentAnnex.push('Estrategias:\n- ' + serviceStrategies.strategies.join('\n- '));
    }

    if (serviceStrategies.actionPlan && serviceStrategies.actionPlan.length > 0) {
      agentAnnex.push('Plan de acción:\n' + serviceStrategies.actionPlan.join('\n'));
    }

    if (experienceImprovements.gaps && experienceImprovements.gaps.length > 0) {
      agentAnnex.push('Áreas de mejora:\n- ' + experienceImprovements.gaps.join('\n- '));
    }

    if (experienceImprovements.improvements && experienceImprovements.improvements.length > 0) {
      agentAnnex.push('Sugerencias de mejora:\n- ' + experienceImprovements.improvements.join('\n- '));
    }

    return agentAnnex;
  }
}

const copilotOrchestratorService = new CopilotOrchestratorService();

module.exports = {
  CopilotOrchestratorService,
  copilotOrchestratorService
};
