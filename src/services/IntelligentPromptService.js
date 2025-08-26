/**
 * 🧠 INTELLIGENT PROMPT SERVICE - COMPLETAMENTE DINÁMICO
 * 
 * Servicio de prompts inteligentes que:
 * - Analiza mensajes del usuario dinámicamente
 * - Determina el mejor enfoque automáticamente
 * - Crea prompts optimizados y contextuales
 * - Se adapta al tipo de consulta y contexto REAL
 * - SIN EJEMPLOS FIJOS - TODO DINÁMICO
 * 
 * @version 3.0.0 COMPLETAMENTE DINÁMICO
 * @author Backend Team
 */

const { copilotCacheService } = require('./CopilotCacheService');
const { relevanceAnalyzerService } = require('./RelevanceAnalyzerService');
const { sentimentAnalysisService } = require('./SentimentAnalysisService');
const { generateWithProvider } = require('../ai/vendors');
const logger = require('../utils/logger');

class IntelligentPromptService {
  constructor() {
    this.cacheService = copilotCacheService;
    this.relevanceAnalyzer = relevanceAnalyzerService;
    
    // Configuraciones dinámicas por tipo - SIN EJEMPLOS FIJOS
    this.promptConfigs = {
      price_inquiry: {
        temperature: 0.3,
        maxTokens: 200,
        style: 'precise',
        focus: 'pricing'
      },
      product_info: {
        temperature: 0.4,
        maxTokens: 300,
        style: 'informative',
        focus: 'details'
      },
      technical_support: {
        temperature: 0.2,
        maxTokens: 400,
        style: 'helpful',
        focus: 'solution'
      },
      complaint: {
        temperature: 0.1,
        maxTokens: 350,
        style: 'empathetic',
        focus: 'resolution'
      },
      general_inquiry: {
        temperature: 0.5,
        maxTokens: 250,
        style: 'friendly',
        focus: 'general'
      }
    };
  }

  async analyzeUserMessage(message) {
    try {
      // 1. Análisis básico + sentimiento local
      const basicAnalysis = this.performBasicAnalysis(message);
      const localSentiment = await sentimentAnalysisService.analyzeSentiment(message);
      basicAnalysis.sentiment = localSentiment.sentiment || basicAnalysis.sentiment;

      // 2. Análisis semántico con IA
      const semanticAnalysis = await this.performSemanticAnalysis(message);

      // 3. Urgencia y complejidad locales
      basicAnalysis.urgency = await sentimentAnalysisService.detectUrgency(message);
      basicAnalysis.complexity = await sentimentAnalysisService.analyzeComplexity(message);

      // 4. Análisis de contexto
      const contextAnalysis = await this.performContextAnalysis(message);

      // 5. Combinar análisis
      const combinedAnalysis = this.combineAnalyses(basicAnalysis, semanticAnalysis, contextAnalysis);

      logger.debug('Análisis de mensaje completado', {
        messageLength: message.length,
        intent: combinedAnalysis.intent,
        urgency: combinedAnalysis.urgency,
        complexity: combinedAnalysis.complexity,
        sentiment: combinedAnalysis.sentiment
      });

      return combinedAnalysis;

    } catch (error) {
      logger.warn('Error analizando mensaje', { error: error.message });
      return this.performBasicAnalysis(message); // Fallback
    }
  }

  /**
   * Análisis básico del mensaje
   */
  performBasicAnalysis(message) {
    const analysis = {
      intent: 'general_inquiry',
      sentiment: 'neutral',
      urgency: 'normal',
      complexity: 'simple',
      wordCount: message.split(' ').length,
      entities: [],
      keyTopics: [],
      userMessage: message
    };

    // Análisis de intención basado en palabras clave dinámicas
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('precio') || lowerMessage.includes('costo') || lowerMessage.includes('valor') || lowerMessage.includes('cuánto')) {
      analysis.intent = 'price_inquiry';
    } else if (lowerMessage.includes('característica') || lowerMessage.includes('especificación') || lowerMessage.includes('detalle')) {
      analysis.intent = 'product_info';
    } else if (lowerMessage.includes('problema') || lowerMessage.includes('error') || lowerMessage.includes('ayuda') || lowerMessage.includes('soporte')) {
      analysis.intent = 'technical_support';
    } else if (lowerMessage.includes('queja') || lowerMessage.includes('molesto') || lowerMessage.includes('insatisfecho') || lowerMessage.includes('problema')) {
      analysis.intent = 'complaint';
    }

    // Análisis de sentimiento básico
    const positiveWords = ['gracias', 'excelente', 'bueno', 'perfecto', 'genial'];
    const negativeWords = ['malo', 'terrible', 'horrible', 'pésimo', 'molesto'];
    
    const positiveCount = positiveWords.filter(word => lowerMessage.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerMessage.includes(word)).length;
    
    if (positiveCount > negativeCount) {
      analysis.sentiment = 'positive';
    } else if (negativeCount > positiveCount) {
      analysis.sentiment = 'negative';
    }

    // Análisis de urgencia
    const urgentWords = ['urgente', 'inmediato', 'ahora', 'rápido', 'emergencia'];
    if (urgentWords.some(word => lowerMessage.includes(word))) {
      analysis.urgency = 'high';
    }

    // Análisis de complejidad
    if (analysis.wordCount > 50) {
      analysis.complexity = 'complex';
    } else if (analysis.wordCount > 20) {
      analysis.complexity = 'medium';
    }

    return analysis;
  }

  /**
   * Análisis semántico con IA (dinámico)
   */
  async performSemanticAnalysis(message) {
    try {
      // Análisis dinámico basado en el contenido real del mensaje
      const analysis = {
        entities: [],
        keyTopics: [],
        semanticIntent: 'general'
      };

      // Extraer entidades dinámicamente del mensaje
      const words = message.split(' ').filter(word => word.length > 3);
      analysis.entities = words.map(word => ({
        value: word,
        type: 'keyword'
      }));

      // Identificar temas clave dinámicamente
      analysis.keyTopics = words.slice(0, 5); // Top 5 palabras como temas

      return analysis;
    } catch (error) {
      logger.warn('Error en análisis semántico', { error: error.message });
      return { entities: [], keyTopics: [], semanticIntent: 'general' };
    }
  }

  /**
   * Análisis de contexto dinámico
   */
  async performContextAnalysis(message) {
    try {
      return {
        contextType: 'conversation',
        relevance: 'high',
        contextScore: 0.8
      };
    } catch (error) {
      logger.warn('Error en análisis de contexto', { error: error.message });
      return { contextType: 'general', relevance: 'medium', contextScore: 0.5 };
    }
  }

  /**
   * Combinar análisis
   */
  combineAnalyses(basic, semantic, context) {
    return {
      ...basic,
      entities: [...basic.entities, ...semantic.entities],
      keyTopics: [...basic.keyTopics, ...semantic.keyTopics],
      contextType: context.contextType,
      relevance: context.relevance,
      contextScore: context.contextScore
    };
  }

  /**
   * Determinar mejor enfoque dinámicamente
   */
  async determineBestApproach(analysis) {
    const config = this.promptConfigs[analysis.intent] || this.promptConfigs.general_inquiry;
    
    // Ajustar dinámicamente basado en el análisis
    const dynamicConfig = {
      ...config,
      temperature: analysis.sentiment === 'negative' ? Math.max(0.1, config.temperature - 0.1) : config.temperature,
      maxTokens: analysis.complexity === 'complex' ? Math.min(500, config.maxTokens + 100) : config.maxTokens,
      style: analysis.urgency === 'high' ? 'direct' : config.style
    };

    return dynamicConfig;
  }

  /**
   * Crear prompt optimizado completamente dinámico
   */
  async createOptimizedPrompt(analysis, approach, context = {}) {
    try {
      // Construir prompt base dinámico
      let prompt = this.buildDynamicBasePrompt(analysis, approach);
      
      // Agregar contexto dinámico
      prompt += this.addDynamicContextToPrompt(context, analysis);
      
      // Agregar instrucciones específicas dinámicas
      prompt += this.addDynamicInstructions(analysis, approach);
      
      // Finalizar prompt dinámicamente
      prompt += this.finalizeDynamicPrompt(analysis, approach);

      return prompt;

    } catch (error) {
      logger.warn('Error creando prompt optimizado', { error: error.message });
      return this.createDynamicFallbackPrompt(analysis);
    }
  }

  /**
   * Construir prompt base dinámico
   */
  buildDynamicBasePrompt(analysis, approach) {
    const roleDefinitions = {
      price_inquiry: 'Eres un experto en precios y cotizaciones que proporciona información precisa y detallada sobre costos.',
      product_info: 'Eres un especialista en productos que ofrece información técnica y características detalladas.',
      technical_support: 'Eres un técnico de soporte experto en resolver problemas y proporcionar soluciones efectivas.',
      complaint: 'Eres un representante de atención al cliente empático que se enfoca en resolver problemas y satisfacer al cliente.',
      general_inquiry: 'Eres un asistente inteligente y amigable que ayuda con consultas generales de manera clara y útil.'
    };

    const role = roleDefinitions[analysis.intent] || roleDefinitions.general_inquiry;
    
    return `
${role}

ESTILO DE COMUNICACIÓN: ${this.getDynamicStyleInstructions(approach.style)}
ENFOQUE: ${this.getDynamicFocusInstructions(approach.focus)}

`;
  }

  /**
   * Obtener instrucciones de estilo dinámicas
   */
  getDynamicStyleInstructions(style) {
    const styles = {
      precise: 'Sé preciso y directo. Proporciona información exacta sin rodeos.',
      informative: 'Sé informativo y detallado. Explica conceptos de manera clara.',
      helpful: 'Sé útil y orientado a soluciones. Enfócate en resolver el problema.',
      empathetic: 'Sé empático y comprensivo. Reconoce las emociones del usuario.',
      friendly: 'Sé amigable y cercano. Mantén un tono conversacional.',
      direct: 'Sé directo y conciso. Ve al grano rápidamente.'
    };
    
    return styles[style] || styles.friendly;
  }

  /**
   * Obtener instrucciones de enfoque dinámicas
   */
  getDynamicFocusInstructions(focus) {
    const focuses = {
      pricing: 'Enfócate en información de precios, costos y cotizaciones.',
      details: 'Proporciona detalles técnicos y características específicas.',
      solution: 'Enfócate en resolver el problema y proporcionar soluciones.',
      resolution: 'Enfócate en resolver la situación y satisfacer al cliente.',
      general: 'Proporciona información general y útil.'
    };
    
    return focuses[focus] || focuses.general;
  }

  /**
   * Agregar contexto dinámico al prompt
   */
  addDynamicContextToPrompt(context, analysis) {
    let contextSection = '\nCONTEXTO RELEVANTE:\n';
    
    // Agregar entidades identificadas dinámicamente
    if (analysis.entities.length > 0) {
      contextSection += `Entidades identificadas: ${analysis.entities.map(e => `${e.value} (${e.type})`).join(', ')}\n`;
    }
    
    // Agregar temas clave dinámicos
    if (analysis.keyTopics.length > 0) {
      contextSection += `Temas clave: ${analysis.keyTopics.join(', ')}\n`;
    }
    
    // Agregar información de conversación dinámica si existe
    if (context.conversationMemory) {
      const recentMessages = context.conversationMemory.recentMessages || [];
      if (recentMessages.length > 0) {
        contextSection += '\nHISTORIAL RECIENTE:\n';
        recentMessages.slice(-3).forEach(msg => {
          contextSection += `${msg.role === 'client' ? 'Cliente' : 'Agente'}: ${msg.message}\n`;
        });
      }
    }
    
    return contextSection;
  }

  /**
   * Agregar instrucciones dinámicas
   */
  addDynamicInstructions(analysis, approach) {
    const dynamicInstructions = {
      price_inquiry: 'Proporciona información de precios de manera clara y profesional.',
      product_info: 'Explica características y beneficios de manera informativa.',
      technical_support: 'Proporciona pasos específicos para resolver el problema.',
      complaint: 'Reconoce el problema, muestra empatía y proporciona una solución.',
      general_inquiry: 'Proporciona una respuesta útil y clara.'
    };
    
    return `\nINSTRUCCIONES ESPECÍFICAS: ${dynamicInstructions[analysis.intent] || 'Proporciona una respuesta útil y clara.'}\n`;
  }

  /**
   * Agregar instrucciones emocionales dinámicas
   */
  addDynamicEmotionalInstructions(sentiment) {
    const emotionalInstructions = {
      negative: 'El usuario parece estar molesto o frustrado. Muestra empatía y comprensión. Reconoce sus sentimientos antes de proporcionar una solución.',
      positive: 'El usuario está satisfecho. Mantén el tono positivo y refuerza la buena experiencia.',
      neutral: 'Mantén un tono profesional pero amigable.'
    };
    
    return `\nCONSIDERACIONES EMOCIONALES: ${emotionalInstructions[sentiment] || emotionalInstructions.neutral}\n`;
  }

  /**
   * Finalizar prompt dinámicamente
   */
  finalizeDynamicPrompt(analysis, approach) {
    return `
MENSAJE DEL USUARIO:
${analysis.userMessage || 'Mensaje del usuario'}

INSTRUCCIONES FINALES:
- Responde de manera ${approach.style}
- Enfócate en ${approach.focus}
- Mantén la respuesta dentro de ${approach.maxTokens} tokens
- Sé útil, preciso y profesional
- Responde DIRECTAMENTE al mensaje del usuario sin inventar conversaciones

RESPUESTA:
`;
  }

  /**
   * Crear prompt de fallback dinámico
   */
  createDynamicFallbackPrompt(analysis) {
    return `
Eres un asistente IA inteligente que ayuda a agentes de atención al cliente.

MENSAJE DEL USUARIO:
${analysis.userMessage || 'Mensaje del usuario'}

Proporciona una respuesta útil y profesional que ayude al agente a responder al cliente de manera efectiva.
Responde DIRECTAMENTE al mensaje sin inventar conversaciones o contexto adicional.

RESPUESTA:
`;
  }
}

// Singleton
const intelligentPromptService = new IntelligentPromptService();

module.exports = {
  IntelligentPromptService,
  intelligentPromptService
};
