/**
 * 🕹️ COPILOT ORCHESTRATOR SERVICE
 *
 * Orquesta todos los servicios del copiloto para procesar un mensaje end-to-end
 * usando la infraestructura existente sin duplicar lógica.
 *
 * @version 1.0.0
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
      const cached = await copilotCacheService.getCachedResponse(userMessage, { conversationId, agentId });
      if (cached) {
        await copilotMetricsService.trackResponseTime(start, Date.now(), true);
        await copilotMetricsService.trackUsage(agentId, 'chat_cache');
        return { ok: true, text: cached, source: 'cache' };
      }

      const conversationMemory = await copilotMemoryService.getConversationMemory(conversationId, userMessage);

      const analysis = await intelligentPromptService.analyzeUserMessage(userMessage);
      analysis.userMessage = userMessage;
      const approach = await intelligentPromptService.determineBestApproach(analysis);

      const compressedContext = await requestOptimizationService.compressContext(conversationMemory);
      const optimizedContext = await requestOptimizationService.optimizeTokens(compressedContext);
      const estimatedTokens = Math.min((approach.maxTokens || 300) + (analysis.wordCount || 0), 600);
      const model = await requestOptimizationService.selectBestModel(analysis.intent, estimatedTokens);
      const optimalConfig = await requestOptimizationService.getOptimalConfig(analysis.intent);

      const prompt = await intelligentPromptService.createOptimizedPrompt(analysis, { ...approach, ...optimalConfig }, { conversationMemory: optimizedContext });

      // Preferir LLM Studio; fallback a OpenAI si falla
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
        // Retry ligero 1 vez con OpenAI
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

      let finalText = llmResponse.text;

      // Análisis dinámico del contexto para mejorar la respuesta
      const patterns = await needsPredictionService.analyzeConversationPatterns(userMessage);
      const implicitNeeds = await needsPredictionService.detectImplicitNeeds(userMessage, patterns);
      const futureNeeds = await needsPredictionService.predictFutureNeeds(implicitNeeds);
      const proactiveSuggestions = await needsPredictionService.generateProactiveSuggestions(futureNeeds);

      // Optimizar respuesta profesional dinámicamente
      const professional = await professionalResponseService.generateProfessionalResponse({ conversationMemory, analysis });
      if (professional) finalText = professional;
      finalText = await professionalResponseService.optimizeExistingResponse(finalText);

      // Análisis dinámico de la conversación
      const convAnalysis = await conversationAnalysisService.analyzeTone(conversationMemory);
      const convOpportunities = await conversationAnalysisService.identifyOpportunities(conversationMemory);

      // Estrategias dinámicas basadas en el contexto
      const strategies = await customerServiceStrategyService.suggestStrategies({ analysis });
      const actionPlan = await customerServiceStrategyService.generateActionPlan({ analysis });

      // Mejoras dinámicas de experiencia
      const gaps = await experienceImprovementService.identifyExperienceGaps(conversationMemory);
      const improvements = await experienceImprovementService.suggestImprovements({ analysis });

      // Generar anexos dinámicos solo si hay información relevante
      const dynamicAnnex = generateDynamicAnnex({
        proactiveSuggestions,
        convOpportunities,
        strategies,
        actionPlan,
        gaps,
        improvements,
        analysis
      });

      // Agregar anexos dinámicos solo si son relevantes
      if (dynamicAnnex.length > 0) {
        finalText += '\n\n---\nNotas para el agente (no enviar al cliente):\n' + dynamicAnnex.join('\n\n');
      }

      // Personalizar respuesta para el agente dinámicamente
      finalText = await agentPersonalizationService.adaptResponseToAgent(finalText, agentId);

      await copilotCacheService.cacheResponse(userMessage, { conversationId, agentId }, finalText);
      await copilotMemoryService.addToMemory(conversationId, userMessage, finalText);

      await copilotMetricsService.trackResponseTime(start, Date.now(), true);
      await copilotMetricsService.trackUsage(agentId, 'chat');
      await copilotMetricsService.trackAccuracy(userMessage, finalText, null);

      return { ok: true, text: finalText, model, usage: llmResponse.usage, suggestions: proactiveSuggestions };

    } catch (error) {
      await copilotMetricsService.trackResponseTime(start, Date.now(), false);
      logger.error('Error en orquestador del copiloto', { error: error.message });
      return { ok: false, error: error.message };
    }
  }

  /**
   * Generar anexos dinámicos basados en el contexto real
   */
  generateDynamicAnnex(context) {
    const annex = [];
    
    // Solo agregar anexos si hay información relevante y útil
    if (context.proactiveSuggestions && context.proactiveSuggestions.length > 0) {
      const relevantSuggestions = context.proactiveSuggestions.filter(s => s.length > 10);
      if (relevantSuggestions.length > 0) {
        annex.push('Sugerencias proactivas:\n- ' + relevantSuggestions.join('\n- '));
      }
    }
    
    if (context.convOpportunities && context.convOpportunities.length > 0) {
      const relevantOpportunities = context.convOpportunities.filter(o => o.length > 10);
      if (relevantOpportunities.length > 0) {
        annex.push('Oportunidades:\n- ' + relevantOpportunities.join('\n- '));
      }
    }
    
    if (context.strategies && context.strategies.length > 0) {
      const relevantStrategies = context.strategies.filter(s => s.length > 10);
      if (relevantStrategies.length > 0) {
        annex.push('Estrategias:\n- ' + relevantStrategies.join('\n- '));
      }
    }
    
    if (context.actionPlan && context.actionPlan.length > 0) {
      const relevantActions = context.actionPlan.filter(a => a.length > 10);
      if (relevantActions.length > 0) {
        annex.push('Plan de acción:\n' + relevantActions.join('\n'));
      }
    }
    
    if ((context.gaps && context.gaps.length > 0) || (context.improvements && context.improvements.length > 0)) {
      const allImprovements = [...(context.gaps || []), ...(context.improvements || [])].filter(i => i.length > 10);
      if (allImprovements.length > 0) {
        annex.push('Mejoras:\n- ' + allImprovements.join('\n- '));
      }
    }
    
    return annex;
  }
}

const copilotOrchestratorService = new CopilotOrchestratorService();

module.exports = {
  CopilotOrchestratorService,
  copilotOrchestratorService
};
