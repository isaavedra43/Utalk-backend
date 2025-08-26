/**
 * 🧠 INTELLIGENT PROMPT SERVICE - SÚPER INTELIGENTE
 * 
 * Servicio de prompts inteligentes que:
 * - Analiza mensajes del usuario dinámicamente
 * - Determina el mejor enfoque automáticamente
 * - Crea prompts optimizados y contextuales
 * - Se adapta al tipo de consulta y contexto
 * 
 * @version 2.0.0 SÚPER INTELIGENTE
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
    
    // Configuraciones de prompts por tipo
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
      entities: [],
      sentiment: 'neutral',
      urgency: 'normal',
      complexity: 'simple',
      language: 'es',
      hasQuestions: false,
      hasNumbers: false,
      wordCount: 0
    };

    const text = message.toLowerCase();
    
    // Contar palabras
    analysis.wordCount = text.split(/\s+/).length;
    
    // Detectar preguntas
    analysis.hasQuestions = /\?|¿|cuál|qué|cómo|dónde|cuándo|por qué/.test(text);
    
    // Detectar números
    analysis.hasNumbers = /\d/.test(text);
    
    // Detectar urgencia
    if (/\b(urgente|inmediato|rápido|ya|ahora)\b/.test(text)) {
      analysis.urgency = 'high';
    } else if (/\b(pronto|próximo|fecha)\b/.test(text)) {
      analysis.urgency = 'medium';
    }
    
    // Detectar complejidad
    if (analysis.wordCount > 50) {
      analysis.complexity = 'complex';
    } else if (analysis.wordCount > 20) {
      analysis.complexity = 'medium';
    }
    
    // Detectar sentimiento básico
    if (/\b(gracias|excelente|perfecto|genial)\b/.test(text)) {
      analysis.sentiment = 'positive';
    } else if (/\b(problema|error|molesto|enojado)\b/.test(text)) {
      analysis.sentiment = 'negative';
    }

    return analysis;
  }

  /**
   * Análisis semántico con IA
   */
  async performSemanticAnalysis(message) {
    try {
      const prompt = `
Analiza el siguiente mensaje y proporciona un análisis semántico en formato JSON:

Mensaje: "${message}"

Proporciona análisis en este formato:
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
        throw new Error('Error en análisis semántico');
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
      logger.warn('Error en análisis semántico', { error: error.message });
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
   * Análisis de contexto
   */
  async performContextAnalysis(message) {
    try {
      // Extraer entidades usando el servicio de relevancia
      const entities = await this.relevanceAnalyzer.extractEntities(message);
      
      // Detectar tipo de consulta
      const queryType = await this.relevanceAnalyzer.detectQueryType(message);
      
      return {
        entities,
        queryType,
        hasSpecificEntities: entities.length > 0,
        entityTypes: [...new Set(entities.map(e => e.type))],
        confidence: entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length || 0
      };

    } catch (error) {
      logger.warn('Error en análisis de contexto', { error: error.message });
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
   * Combinar análisis
   */
  combineAnalyses(basic, semantic, context) {
    return {
      // Intent: priorizar semántico, luego contexto, luego básico
      intent: semantic.intent || context.queryType || basic.intent,
      
      // Sentiment: priorizar semántico
      sentiment: semantic.sentiment || basic.sentiment,
      
      // Urgency: combinar análisis
      urgency: this.combineUrgency(basic.urgency, semantic.urgency),
      
      // Complexity: usar el más alto
      complexity: this.getHighestComplexity(basic.complexity, semantic.complexity),
      
      // Entidades del contexto
      entities: context.entities || [],
      
      // Información adicional
      keyTopics: semantic.keyTopics || [],
      emotions: semantic.emotions || [],
      tone: semantic.tone || 'casual',
      
      // Métricas básicas
      wordCount: basic.wordCount,
      hasQuestions: basic.hasQuestions,
      hasNumbers: basic.hasNumbers,
      
      // Confianza del análisis
      confidence: context.confidence || 0.5
    };
  }

  /**
   * Combinar niveles de urgencia
   */
  combineUrgency(basic, semantic) {
    const urgencyLevels = { low: 1, normal: 2, high: 3 };
    const basicLevel = urgencyLevels[basic] || 2;
    const semanticLevel = urgencyLevels[semantic] || 2;
    
    const combinedLevel = Math.max(basicLevel, semanticLevel);
    return Object.keys(urgencyLevels).find(key => urgencyLevels[key] === combinedLevel);
  }

  /**
   * Obtener complejidad más alta
   */
  getHighestComplexity(basic, semantic) {
    const complexityLevels = { simple: 1, medium: 2, complex: 3 };
    const basicLevel = complexityLevels[basic] || 1;
    const semanticLevel = complexityLevels[semantic] || 1;
    
    const highestLevel = Math.max(basicLevel, semanticLevel);
    return Object.keys(complexityLevels).find(key => complexityLevels[key] === highestLevel);
  }

  /**
   * Determinar el mejor enfoque
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

      // Configurar según el intent
      const config = this.promptConfigs[analysis.intent] || this.promptConfigs.general_inquiry;
      Object.assign(approach, config);

      // Ajustar según urgencia
      if (analysis.urgency === 'high') {
        approach.style = 'direct';
        approach.maxTokens = Math.min(approach.maxTokens, 150);
        approach.includeSteps = true;
      }

      // Ajustar según complejidad
      if (analysis.complexity === 'complex') {
        approach.maxTokens = Math.max(approach.maxTokens, 400);
        approach.includeExamples = true;
        approach.includeSteps = true;
      }

      // Ajustar según sentimiento
      if (analysis.sentiment === 'negative') {
        approach.style = 'empathetic';
        approach.includeEmotion = true;
        approach.temperature = Math.min(approach.temperature, 0.3);
      }

      // Ajustar según entidades
      if (analysis.entities.length > 0) {
        approach.includeContext = true;
        approach.focus = 'specific';
      }

      return approach;

    } catch (error) {
      logger.warn('Error determinando enfoque', { error: error.message });
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
   * Crear prompt optimizado
   */
  async createOptimizedPrompt(analysis, approach, context) {
    try {
      // 1. Construir prompt base
      let prompt = this.buildBasePrompt(analysis, approach);
      
      // 2. Agregar contexto si es necesario
      if (approach.includeContext && context) {
        prompt += this.addContextToPrompt(context, analysis);
      }
      
      // 3. Agregar ejemplos si es necesario
      if (approach.includeExamples) {
        prompt += this.addExamplesToPrompt(analysis.intent);
      }
      
      // 4. Agregar pasos si es necesario
      if (approach.includeSteps) {
        prompt += this.addStepsToPrompt(analysis.intent);
      }
      
      // 5. Agregar instrucciones emocionales si es necesario
      if (approach.includeEmotion) {
        prompt += this.addEmotionalInstructions(analysis.sentiment);
      }
      
      // 6. Finalizar prompt
      prompt += this.finalizePrompt(analysis, approach);
      
      logger.debug('Prompt optimizado creado', {
        intent: analysis.intent,
        style: approach.style,
        length: prompt.length,
        includesContext: approach.includeContext,
        includesExamples: approach.includeExamples
      });

      return prompt;

    } catch (error) {
      logger.warn('Error creando prompt optimizado', { error: error.message });
      return this.createFallbackPrompt(analysis);
    }
  }

  /**
   * Construir prompt base
   */
  buildBasePrompt(analysis, approach) {
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

ESTILO DE COMUNICACIÓN: ${this.getStyleInstructions(approach.style)}
ENFOQUE: ${this.getFocusInstructions(approach.focus)}

`;
  }

  /**
   * Obtener instrucciones de estilo
   */
  getStyleInstructions(style) {
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
   * Obtener instrucciones de enfoque
   */
  getFocusInstructions(focus) {
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
   * Agregar contexto al prompt
   */
  addContextToPrompt(context, analysis) {
    let contextSection = '\nCONTEXTO RELEVANTE:\n';
    
    // Agregar entidades identificadas
    if (analysis.entities.length > 0) {
      contextSection += `Entidades identificadas: ${analysis.entities.map(e => `${e.value} (${e.type})`).join(', ')}\n`;
    }
    
    // Agregar temas clave
    if (analysis.keyTopics.length > 0) {
      contextSection += `Temas clave: ${analysis.keyTopics.join(', ')}\n`;
    }
    
    // Agregar información de conversación si existe
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
   * Agregar ejemplos al prompt
   */
  addExamplesToPrompt(intent) {
    const examples = {
      price_inquiry: `
EJEMPLOS DE RESPUESTA:
- "El precio de la piel de elefante es de $350 por metro cuadrado."
- "Para 100 metros cuadrados, el costo total sería de $35,000."
`,
      product_info: `
EJEMPLOS DE RESPUESTA:
- "La piel de elefante tiene las siguientes características: durabilidad extrema, textura suave, resistencia al agua."
- "Este material es ideal para muebles de lujo y artículos de cuero premium."
`,
      technical_support: `
EJEMPLOS DE RESPUESTA:
- "Para resolver este problema, sigue estos pasos: 1) Verifica la conexión, 2) Reinicia el sistema, 3) Contacta soporte si persiste."
- "Este error es común y tiene una solución rápida: actualiza el software a la versión más reciente."
`
    };
    
    return examples[intent] || '';
  }

  /**
   * Agregar pasos al prompt
   */
  addStepsToPrompt(intent) {
    const stepInstructions = {
      price_inquiry: 'Proporciona el precio de manera clara y, si es posible, incluye opciones o variaciones.',
      product_info: 'Explica las características principales y, si es relevante, menciona beneficios y usos.',
      technical_support: 'Proporciona pasos específicos para resolver el problema y, si es necesario, menciona recursos adicionales.',
      complaint: 'Reconoce el problema, muestra empatía y proporciona una solución o próximos pasos claros.'
    };
    
    return `\nINSTRUCCIONES ESPECÍFICAS: ${stepInstructions[intent] || 'Proporciona una respuesta útil y clara.'}\n`;
  }

  /**
   * Agregar instrucciones emocionales
   */
  addEmotionalInstructions(sentiment) {
    const emotionalInstructions = {
      negative: 'El usuario parece estar molesto o frustrado. Muestra empatía y comprensión. Reconoce sus sentimientos antes de proporcionar una solución.',
      positive: 'El usuario está satisfecho. Mantén el tono positivo y refuerza la buena experiencia.',
      neutral: 'Mantén un tono profesional pero amigable.'
    };
    
    return `\nCONSIDERACIONES EMOCIONALES: ${emotionalInstructions[sentiment] || emotionalInstructions.neutral}\n`;
  }

  /**
   * Finalizar prompt
   */
  finalizePrompt(analysis, approach) {
    return `
MENSAJE DEL USUARIO:
${analysis.userMessage || 'Mensaje del usuario'}

INSTRUCCIONES FINALES:
- Responde de manera ${approach.style}
- Enfócate en ${approach.focus}
- Mantén la respuesta dentro de ${approach.maxTokens} tokens
- Sé útil, preciso y profesional

RESPUESTA:
`;
  }

  /**
   * Crear prompt de fallback
   */
  createFallbackPrompt(analysis) {
    return `
Eres un asistente IA inteligente que ayuda a agentes de atención al cliente.

MENSAJE DEL USUARIO:
${analysis.userMessage || 'Mensaje del usuario'}

Proporciona una respuesta útil y profesional que ayude al agente a responder al cliente de manera efectiva.

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
