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

      const patterns = await needsPredictionService.analyzeConversationPatterns(userMessage);
      const implicitNeeds = await needsPredictionService.detectImplicitNeeds(userMessage, patterns);
      const futureNeeds = await needsPredictionService.predictFutureNeeds(implicitNeeds);
      const proactiveSuggestions = await needsPredictionService.generateProactiveSuggestions(futureNeeds);

      const professional = await professionalResponseService.generateProfessionalResponse({ conversationMemory, analysis });
      if (professional) finalText = professional;
      finalText = await professionalResponseService.optimizeExistingResponse(finalText);

      const convAnalysis = await conversationAnalysisService.analyzeTone(conversationMemory);
      const convOpportunities = await conversationAnalysisService.identifyOpportunities(conversationMemory);

      const strategies = await customerServiceStrategyService.suggestStrategies({ analysis });
      const actionPlan = await customerServiceStrategyService.generateActionPlan({ analysis });

      const gaps = await experienceImprovementService.identifyExperienceGaps(conversationMemory);
      const improvements = await experienceImprovementService.suggestImprovements({ analysis });

      const agentAnnex = [];
      if (proactiveSuggestions.length) agentAnnex.push('Sugerencias proactivas:\n- ' + proactiveSuggestions.join('\n- '));
      if (convOpportunities.length) agentAnnex.push('Oportunidades:\n- ' + convOpportunities.join('\n- '));
      if (strategies.length) agentAnnex.push('Estrategias:\n- ' + strategies.join('\n- '));
      if (actionPlan.length) agentAnnex.push('Plan de acción:\n' + actionPlan.join('\n'));
      if (gaps.length || improvements.length) agentAnnex.push('Mejoras:\n- ' + [...gaps, ...improvements].join('\n- '));
      if (agentAnnex.length) finalText += '\n\n---\nNotas para el agente (no enviar al cliente):\n' + agentAnnex.join('\n\n');

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
}

const copilotOrchestratorService = new CopilotOrchestratorService();

module.exports = {
  CopilotOrchestratorService,
  copilotOrchestratorService
};
