/**
 * 🧠 INTELLIGENT PROMPT SERVICE - COMPLETAMENTE DINÁMICO
 * 
 * Servicio de prompts inteligentes que:
 * - Analiza mensajes del usuario dinámicamente
 * - Determina el mejor enfoque automáticamente
 * - Crea prompts optimizados y contextuales
 * - Se adapta al tipo de consulta y contexto
 * - SIN prompts fijos ni ejemplos hardcodeados
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
  }

  async analyzeUserMessage(message) {
    try {
      // 1. Análisis básico dinámico
      const basicAnalysis = this.performDynamicBasicAnalysis(message);
      
      // 2. Análisis de sentimiento dinámico
      const sentimentAnalysis = await sentimentAnalysisService.analyzeSentiment(message);
      basicAnalysis.sentiment = sentimentAnalysis.sentiment || basicAnalysis.sentiment;

      // 3. Análisis semántico dinámico con IA
      const semanticAnalysis = await this.performDynamicSemanticAnalysis(message);

      // 4. Análisis de contexto dinámico
      const contextAnalysis = await this.performDynamicContextAnalysis(message);

      // 5. Combinar análisis dinámicamente
      const combinedAnalysis = this.combineAnalysesDynamically(basicAnalysis, semanticAnalysis, contextAnalysis);

      logger.debug('Análisis dinámico completado', {
        messageLength: message.length,
        intent: combinedAnalysis.intent,
        urgency: combinedAnalysis.urgency,
        complexity: combinedAnalysis.complexity,
        sentiment: combinedAnalysis.sentiment
      });

      return combinedAnalysis;

    } catch (error) {
      logger.warn('Error en análisis dinámico', { error: error.message });
      return this.performDynamicBasicAnalysis(message); // Fallback dinámico
    }
  }

  /**
   * Análisis básico dinámico del mensaje
   */
  performDynamicBasicAnalysis(message) {
    const analysis = {
      intent: 'general_inquiry',
      entities: [],
      sentiment: 'neutral',
      urgency: 'normal',
      complexity: 'simple',
      language: 'es',
      hasQuestions: false,
      hasNumbers: false,
      wordCount: 0,
      keyTopics: [],
      emotions: []
    };

    const text = message.toLowerCase();
    
    // Análisis dinámico de palabras
    analysis.wordCount = text.split(/\s+/).length;
    
    // Detectar preguntas dinámicamente
    analysis.hasQuestions = /\?|¿|cuál|qué|cómo|dónde|cuándo|por qué|puede|podría/.test(text);
    
    // Detectar números dinámicamente
    analysis.hasNumbers = /\d/.test(text);
    
    // Detectar urgencia dinámicamente
    if (/\b(urgente|inmediato|rápido|ya|ahora|crítico|emergencia)\b/.test(text)) {
      analysis.urgency = 'high';
    } else if (/\b(pronto|próximo|fecha|cuando|mientras)\b/.test(text)) {
      analysis.urgency = 'medium';
    }
    
    // Detectar complejidad dinámicamente
    if (analysis.wordCount > 50) {
      analysis.complexity = 'complex';
    } else if (analysis.wordCount > 20) {
      analysis.complexity = 'medium';
    }
    
    // Detectar sentimiento dinámicamente
    if (/\b(gracias|excelente|perfecto|genial|fantástico|maravilloso)\b/.test(text)) {
      analysis.sentiment = 'positive';
    } else if (/\b(problema|error|molesto|enojado|frustrado|molestia)\b/.test(text)) {
      analysis.sentiment = 'negative';
    }

    // Extraer temas clave dinámicamente
    analysis.keyTopics = this.extractDynamicTopics(text);
    
    // Detectar emociones dinámicamente
    analysis.emotions = this.extractDynamicEmotions(text);

    return analysis;
  }

  /**
   * Extraer temas clave dinámicamente
   */
  extractDynamicTopics(text) {
    const topics = [];
    
    // Detectar temas por palabras clave dinámicas
    if (/\b(precio|costo|valor|tarifa|cuánto)\b/.test(text)) {
      topics.push('pricing');
    }
    if (/\b(producto|servicio|característica|función|especificación)\b/.test(text)) {
      topics.push('product_info');
    }
    if (/\b(problema|error|falla|soporte|ayuda|solución)\b/.test(text)) {
      topics.push('technical_support');
    }
    if (/\b(queja|reclamo|molestia|insatisfecho|mal|pésimo)\b/.test(text)) {
      topics.push('complaint');
    }
    if (/\b(información|consulta|pregunta|duda|ayuda)\b/.test(text)) {
      topics.push('general_inquiry');
    }
    
    return topics;
  }

  /**
   * Extraer emociones dinámicamente
   */
  extractDynamicEmotions(text) {
    const emotions = [];
    
    if (/\b(feliz|contento|satisfecho|alegre|emocionado)\b/.test(text)) {
      emotions.push('happy');
    }
    if (/\b(triste|decepcionado|frustrado|molesto|enojado)\b/.test(text)) {
      emotions.push('frustrated');
    }
    if (/\b(preocupado|ansioso|nervioso|estresado)\b/.test(text)) {
      emotions.push('worried');
    }
    if (/\b(confundido|perdido|no entiendo|no sé)\b/.test(text)) {
      emotions.push('confused');
    }
    
    return emotions;
  }

  /**
   * Análisis semántico dinámico con IA
   */
  async performDynamicSemanticAnalysis(message) {
    try {
      const prompt = `
Analiza dinámicamente el siguiente mensaje y proporciona un análisis semántico en formato JSON:

Mensaje: "${message}"

Proporciona análisis dinámico en este formato:
{
  "intent": "price_inquiry|product_info|technical_support|complaint|general_inquiry",
  "sentiment": "positive|neutral|negative",
  "urgency": "low|normal|high",
  "complexity": "simple|medium|complex",
  "keyTopics": ["tema1", "tema2"],
  "emotions": ["emoción1", "emoción2"],
  "tone": "formal|casual|urgent|friendly"
}

Solo responde con el JSON válido:
`;

      const response = await generateWithProvider('llm_studio', {
        prompt,
        model: 'gpt-oss-20b',
        temperature: 0.1,
        maxTokens: 300,
        workspaceId: 'default'
      });

      if (!response.ok) {
        throw new Error('Error en análisis semántico dinámico');
      }

      const parsed = JSON.parse(response.text);
      return {
        intent: parsed.intent || 'general_inquiry',
        sentiment: parsed.sentiment || 'neutral',
        urgency: parsed.urgency || 'normal',
        complexity: parsed.complexity || 'simple',
        keyTopics: parsed.keyTopics || [],
        emotions: parsed.emotions || [],
        tone: parsed.tone || 'casual'
      };

    } catch (error) {
      logger.warn('Error en análisis semántico dinámico', { error: error.message });
      return {
        intent: 'general_inquiry',
        sentiment: 'neutral',
        urgency: 'normal',
        complexity: 'simple',
        keyTopics: [],
        emotions: [],
        tone: 'casual'
      };
    }
  }

  /**
   * Análisis de contexto dinámico
   */
  async performDynamicContextAnalysis(message) {
    try {
      // Extraer entidades dinámicamente
      const entities = await this.relevanceAnalyzer.extractEntities(message);
      
      // Detectar tipo de consulta dinámicamente
      const queryType = await this.relevanceAnalyzer.detectQueryType(message);
      
      return {
        entities,
        queryType,
        hasSpecificEntities: entities.length > 0,
        entityTypes: [...new Set(entities.map(e => e.type))],
        confidence: entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length || 0
      };

    } catch (error) {
      logger.warn('Error en análisis de contexto dinámico', { error: error.message });
      return {
        entities: [],
        queryType: 'general_inquiry',
        hasSpecificEntities: false,
        entityTypes: [],
        confidence: 0
      };
    }
  }

  /**
   * Combinar análisis dinámicamente
   */
  combineAnalysesDynamically(basic, semantic, context) {
    return {
      // Intent: priorizar semántico, luego contexto, luego básico
      intent: semantic.intent || context.queryType || basic.intent,
      
      // Sentiment: priorizar semántico
      sentiment: semantic.sentiment || basic.sentiment,
      
      // Urgency: combinar análisis dinámicamente
      urgency: this.combineUrgencyDynamically(basic.urgency, semantic.urgency),
      
      // Complexity: usar el más alto dinámicamente
      complexity: this.getHighestComplexityDynamically(basic.complexity, semantic.complexity),
      
      // Entidades del contexto
      entities: context.entities || [],
      
      // Información adicional dinámica
      keyTopics: [...new Set([...semantic.keyTopics, ...basic.keyTopics])],
      emotions: [...new Set([...semantic.emotions, ...basic.emotions])],
      tone: semantic.tone || 'casual',
      
      // Métricas básicas
      wordCount: basic.wordCount,
      hasQuestions: basic.hasQuestions,
      hasNumbers: basic.hasNumbers,
      
      // Confianza del análisis dinámico
      confidence: context.confidence || 0.5
    };
  }

  /**
   * Combinar niveles de urgencia dinámicamente
   */
  combineUrgencyDynamically(basic, semantic) {
    const urgencyLevels = { low: 1, normal: 2, high: 3 };
    const basicLevel = urgencyLevels[basic] || 2;
    const semanticLevel = urgencyLevels[semantic] || 2;
    
    const combinedLevel = Math.max(basicLevel, semanticLevel);
    return Object.keys(urgencyLevels).find(key => urgencyLevels[key] === combinedLevel);
  }

  /**
   * Obtener complejidad más alta dinámicamente
   */
  getHighestComplexityDynamically(basic, semantic) {
    const complexityLevels = { simple: 1, medium: 2, complex: 3 };
    const basicLevel = complexityLevels[basic] || 1;
    const semanticLevel = complexityLevels[semantic] || 1;
    
    const highestLevel = Math.max(basicLevel, semanticLevel);
    return Object.keys(complexityLevels).find(key => complexityLevels[key] === highestLevel);
  }

  /**
   * Determinar el mejor enfoque dinámicamente
   */
  async determineBestApproach(analysis) {
    try {
      const approach = {
        style: 'friendly',
        focus: 'general',
        temperature: 0.5,
        maxTokens: 250,
        includeContext: true,
        includeExamples: false,
        includeSteps: false,
        includeEmotion: false
      };

      // Configurar dinámicamente según el intent
      approach.style = this.determineDynamicStyle(analysis);
      approach.focus = this.determineDynamicFocus(analysis);
      approach.temperature = this.determineDynamicTemperature(analysis);
      approach.maxTokens = this.determineDynamicMaxTokens(analysis);

      // Ajustar dinámicamente según urgencia
      if (analysis.urgency === 'high') {
        approach.style = 'direct';
        approach.maxTokens = Math.min(approach.maxTokens, 150);
        approach.includeSteps = true;
      }

      // Ajustar dinámicamente según complejidad
      if (analysis.complexity === 'complex') {
        approach.maxTokens = Math.max(approach.maxTokens, 400);
        approach.includeSteps = true;
      }

      // Ajustar dinámicamente según sentimiento
      if (analysis.sentiment === 'negative') {
        approach.style = 'empathetic';
        approach.includeEmotion = true;
        approach.temperature = Math.min(approach.temperature, 0.3);
      }

      // Ajustar dinámicamente según entidades
      if (analysis.entities.length > 0) {
        approach.includeContext = true;
        approach.focus = 'specific';
      }

      return approach;

    } catch (error) {
      logger.warn('Error determinando enfoque dinámico', { error: error.message });
      return {
        style: 'friendly',
        focus: 'general',
        temperature: 0.5,
        maxTokens: 250,
        includeContext: true,
        includeExamples: false,
        includeSteps: false,
        includeEmotion: false
      };
    }
  }

  /**
   * Determinar estilo dinámicamente
   */
  determineDynamicStyle(analysis) {
    if (analysis.sentiment === 'negative') return 'empathetic';
    if (analysis.urgency === 'high') return 'direct';
    if (analysis.complexity === 'complex') return 'informative';
    if (analysis.intent === 'technical_support') return 'helpful';
    if (analysis.intent === 'complaint') return 'empathetic';
    return 'friendly';
  }

  /**
   * Determinar enfoque dinámicamente
   */
  determineDynamicFocus(analysis) {
    if (analysis.intent === 'price_inquiry') return 'pricing';
    if (analysis.intent === 'product_info') return 'details';
    if (analysis.intent === 'technical_support') return 'solution';
    if (analysis.intent === 'complaint') return 'resolution';
    if (analysis.entities.length > 0) return 'specific';
    return 'general';
  }

  /**
   * Determinar temperatura dinámicamente
   */
  determineDynamicTemperature(analysis) {
    if (analysis.sentiment === 'negative') return 0.2;
    if (analysis.urgency === 'high') return 0.3;
    if (analysis.complexity === 'complex') return 0.4;
    if (analysis.intent === 'technical_support') return 0.2;
    return 0.5;
  }

  /**
   * Determinar max tokens dinámicamente
   */
  determineDynamicMaxTokens(analysis) {
    if (analysis.complexity === 'complex') return 400;
    if (analysis.urgency === 'high') return 150;
    if (analysis.intent === 'technical_support') return 300;
    if (analysis.intent === 'product_info') return 250;
    return 200;
  }

  /**
   * Crear prompt dinámico optimizado
   */
  async createOptimizedPrompt(analysis, approach, context) {
    try {
      // 1. Construir prompt base dinámico
      let prompt = this.buildDynamicBasePrompt(analysis, approach);
      
      // 2. Agregar contexto dinámicamente si es necesario
      if (approach.includeContext && context) {
        prompt += this.addDynamicContextToPrompt(context, analysis);
      }
      
      // 3. Agregar pasos dinámicamente si es necesario
      if (approach.includeSteps) {
        prompt += this.addDynamicStepsToPrompt(analysis);
      }
      
      // 4. Agregar instrucciones emocionales dinámicamente si es necesario
      if (approach.includeEmotion) {
        prompt += this.addDynamicEmotionalInstructions(analysis);
      }
      
      // 5. Finalizar prompt dinámicamente
      prompt += this.finalizeDynamicPrompt(analysis, approach);
      
      logger.debug('Prompt dinámico creado', {
        intent: analysis.intent,
        style: approach.style,
        length: prompt.length,
        includesContext: approach.includeContext,
        includesSteps: approach.includeSteps
      });

      return prompt;

    } catch (error) {
      logger.warn('Error creando prompt dinámico', { error: error.message });
      return this.createDynamicFallbackPrompt(analysis);
    }
  }

  /**
   * Construir prompt base dinámico
   */
  buildDynamicBasePrompt(analysis, approach) {
    const dynamicRole = this.generateDynamicRole(analysis);
    const dynamicStyle = this.generateDynamicStyleInstructions(approach.style);
    const dynamicFocus = this.generateDynamicFocusInstructions(approach.focus);
    
    return `
${dynamicRole}

ESTILO DE COMUNICACIÓN: ${dynamicStyle}
ENFOQUE: ${dynamicFocus}

`;
  }

  /**
   * Generar rol dinámicamente
   */
  generateDynamicRole(analysis) {
    const roles = {
      price_inquiry: 'Eres un experto en precios y cotizaciones que proporciona información precisa y detallada sobre costos.',
      product_info: 'Eres un especialista en productos que ofrece información técnica y características detalladas.',
      technical_support: 'Eres un técnico de soporte experto en resolver problemas y proporcionar soluciones efectivas.',
      complaint: 'Eres un representante de atención al cliente empático que se enfoca en resolver problemas y satisfacer al cliente.',
      general_inquiry: 'Eres un asistente inteligente y amigable que ayuda con consultas generales de manera clara y útil.'
    };
    
    return roles[analysis.intent] || roles.general_inquiry;
  }

  /**
   * Generar instrucciones de estilo dinámicamente
   */
  generateDynamicStyleInstructions(style) {
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
   * Generar instrucciones de enfoque dinámicamente
   */
  generateDynamicFocusInstructions(focus) {
    const focuses = {
      pricing: 'Enfócate en información de precios, costos y cotizaciones.',
      details: 'Proporciona detalles técnicos y características específicas.',
      solution: 'Enfócate en resolver el problema y proporcionar soluciones.',
      resolution: 'Enfócate en resolver la situación y satisfacer al cliente.',
      specific: 'Enfócate en los detalles específicos mencionados en la consulta.',
      general: 'Proporciona información general y útil.'
    };
    
    return focuses[focus] || focuses.general;
  }

  /**
   * Agregar contexto dinámicamente al prompt
   */
  addDynamicContextToPrompt(context, analysis) {
    let contextSection = '\nCONTEXTO RELEVANTE:\n';
    
    // Agregar entidades identificadas dinámicamente
    if (analysis.entities.length > 0) {
      contextSection += `Entidades identificadas: ${analysis.entities.map(e => `${e.value} (${e.type})`).join(', ')}\n`;
    }
    
    // Agregar temas clave dinámicamente
    if (analysis.keyTopics.length > 0) {
      contextSection += `Temas clave: ${analysis.keyTopics.join(', ')}\n`;
    }
    
    // Agregar información de conversación dinámicamente si existe
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
   * Agregar pasos dinámicamente al prompt
   */
  addDynamicStepsToPrompt(analysis) {
    const dynamicInstructions = {
      price_inquiry: 'Proporciona el precio de manera clara y, si es posible, incluye opciones o variaciones.',
      product_info: 'Explica las características principales y, si es relevante, menciona beneficios y usos.',
      technical_support: 'Proporciona pasos específicos para resolver el problema y, si es necesario, menciona recursos adicionales.',
      complaint: 'Reconoce el problema, muestra empatía y proporciona una solución o próximos pasos claros.',
      general_inquiry: 'Proporciona una respuesta útil y clara basada en la consulta específica.'
    };
    
    const instruction = dynamicInstructions[analysis.intent] || dynamicInstructions.general_inquiry;
    return `\nINSTRUCCIONES ESPECÍFICAS: ${instruction}\n`;
  }

  /**
   * Agregar instrucciones emocionales dinámicamente
   */
  addDynamicEmotionalInstructions(analysis) {
    const dynamicInstructions = {
      negative: 'El usuario parece estar molesto o frustrado. Muestra empatía y comprensión. Reconoce sus sentimientos antes de proporcionar una solución.',
      positive: 'El usuario está satisfecho. Mantén el tono positivo y refuerza la buena experiencia.',
      neutral: 'Mantén un tono profesional pero amigable.'
    };
    
    const instruction = dynamicInstructions[analysis.sentiment] || dynamicInstructions.neutral;
    return `\nCONSIDERACIONES EMOCIONALES: ${instruction}\n`;
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
- Responde directamente al mensaje del usuario sin generar conversaciones ficticias

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
Responde directamente al mensaje sin generar conversaciones ficticias.

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
