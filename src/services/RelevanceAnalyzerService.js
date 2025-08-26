/**
 * 🧠 RELEVANCE ANALYZER SERVICE - SÚPER INTELIGENTE
 * 
 * Servicio de análisis de relevancia que combina:
 * - Extracción de entidades avanzada
 * - Detección de tipos de consulta inteligente
 * - Búsqueda semántica optimizada
 * - Priorización por relevancia contextual
 * 
 * @version 2.0.0 SÚPER INTELIGENTE
 * @author Backend Team
 */

const { copilotCacheService } = require('./CopilotCacheService');
const { generateWithProvider } = require('../ai/vendors');
const logger = require('../utils/logger');

class RelevanceAnalyzerService {
  constructor() {
    this.cacheService = copilotCacheService;
    
    // Patrones de entidades pre-definidos
    this.entityPatterns = {
      // Productos y servicios
      products: [
        /\b(piel|cuero|textil|tela|material|producto|servicio)\b/gi,
        /\b(precio|costo|valor|tarifa|cotización)\b/gi,
        /\b(metro|m2|centímetro|pieza|unidad)\b/gi
      ],
      
      // Información de contacto
      contact: [
        /\b(teléfono|celular|whatsapp|email|correo|dirección)\b/gi,
        /\b(horario|atención|soporte|ayuda)\b/gi
      ],
      
      // Estados y ubicaciones
      location: [
        /\b(envío|entrega|domicilio|dirección|ciudad|estado)\b/gi,
        /\b(urgente|inmediato|rápido|express)\b/gi
      ],
      
      // Problemas y soporte
      support: [
        /\b(problema|error|falla|defecto|daño|reclamo)\b/gi,
        /\b(garantía|devolución|cambio|reembolso)\b/gi
      ]
    };

    // Tipos de consulta detectables
    this.queryTypes = {
      PRICE_INQUIRY: 'price_inquiry',
      PRODUCT_INFO: 'product_info',
      ORDER_STATUS: 'order_status',
      TECHNICAL_SUPPORT: 'technical_support',
      CONTACT_INFO: 'contact_info',
      DELIVERY_INFO: 'delivery_info',
      COMPLAINT: 'complaint',
      GENERAL_INQUIRY: 'general_inquiry'
    };
  }

  /**
   * Extraer entidades de manera inteligente
   */
  async extractEntities(userMessage) {
    try {
      // 1. Extracción basada en patrones
      const patternEntities = this.extractPatternEntities(userMessage);
      
      // 2. Extracción semántica con IA (si es necesario)
      const semanticEntities = await this.extractSemanticEntities(userMessage);
      
      // 3. Combinar y priorizar entidades
      const combinedEntities = this.combineAndPrioritizeEntities(patternEntities, semanticEntities);
      
      logger.debug('Entidades extraídas', {
        messageLength: userMessage.length,
        patternEntities: patternEntities.length,
        semanticEntities: semanticEntities.length,
        combinedEntities: combinedEntities.length
      });

      return combinedEntities;
      
    } catch (error) {
      logger.warn('Error extrayendo entidades', { error: error.message });
      return this.extractPatternEntities(userMessage); // Fallback a patrones
    }
  }

  /**
   * Extraer entidades usando patrones pre-definidos
   */
  extractPatternEntities(userMessage) {
    const entities = [];
    const message = userMessage.toLowerCase();

    // Buscar en cada categoría de patrones
    for (const [category, patterns] of Object.entries(this.entityPatterns)) {
      for (const pattern of patterns) {
        const matches = message.match(pattern);
        if (matches) {
          entities.push({
            type: category,
            value: matches[0],
            confidence: 0.8, // Alta confianza para patrones
            source: 'pattern'
          });
        }
      }
    }

    // Extraer números (precios, cantidades)
    const numberMatches = message.match(/\b\d+(?:\.\d+)?\b/g);
    if (numberMatches) {
      numberMatches.forEach(match => {
        entities.push({
          type: 'quantity',
          value: match,
          confidence: 0.9,
          source: 'pattern'
        });
      });
    }

    return entities;
  }

  /**
   * Extraer entidades usando IA semántica
   */
  async extractSemanticEntities(userMessage) {
    try {
      // Verificar cache primero
      const cacheKey = `semantic_entities_${userMessage.length}_${userMessage.substring(0, 50)}`;
      const cached = this.cacheService.contextCache.get(cacheKey);
      
      if (cached && this.isValidCache(cached)) {
        return cached.entities;
      }

      // Usar IA para extracción semántica
      const prompt = `
Analiza el siguiente mensaje y extrae entidades relevantes en formato JSON:

Mensaje: "${userMessage}"

Extrae entidades en este formato:
{
  "entities": [
    {
      "type": "producto|precio|ubicación|contacto|problema",
      "value": "valor extraído",
      "confidence": 0.0-1.0
    }
  ]
}

Solo responde con el JSON válido:
`;

      const response = await generateWithProvider('llm_studio', {
        prompt,
        model: 'gpt-oss-20b',
        temperature: 0.1,
        maxTokens: 200,
        workspaceId: 'default'
      });

      if (!response.ok) {
        throw new Error('Error en extracción semántica');
      }

      // Parsear respuesta JSON
      const parsed = JSON.parse(response.text);
      const entities = parsed.entities || [];

      // Cachear resultado
      this.cacheService.contextCache.set(cacheKey, {
        entities,
        timestamp: Date.now()
      });

      return entities;

    } catch (error) {
      logger.warn('Error en extracción semántica', { error: error.message });
      return [];
    }
  }

  /**
   * Combinar y priorizar entidades
   */
  combineAndPrioritizeEntities(patternEntities, semanticEntities) {
    const combined = [...patternEntities, ...semanticEntities];
    
    // Remover duplicados basado en valor
    const uniqueEntities = [];
    const seenValues = new Set();
    
    for (const entity of combined) {
      const normalizedValue = entity.value.toLowerCase().trim();
      if (!seenValues.has(normalizedValue)) {
        seenValues.add(normalizedValue);
        uniqueEntities.push(entity);
      }
    }

    // Priorizar por confianza y tipo
    return uniqueEntities.sort((a, b) => {
      // Priorizar entidades de alta confianza
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      
      // Priorizar tipos importantes
      const typePriority = {
        'quantity': 1,
        'products': 2,
        'contact': 3,
        'support': 4,
        'location': 5
      };
      
      const aPriority = typePriority[a.type] || 6;
      const bPriority = typePriority[b.type] || 6;
      
      return aPriority - bPriority;
    });
  }

  /**
   * Detectar tipo de consulta inteligentemente
   */
  async detectQueryType(userMessage) {
    try {
      const message = userMessage.toLowerCase();
      
      // 1. Detección basada en palabras clave
      const keywordType = this.detectByKeywords(message);
      
      // 2. Detección semántica con IA (para casos complejos)
      const semanticType = await this.detectSemanticType(userMessage);
      
      // 3. Combinar resultados
      return this.combineQueryTypes(keywordType, semanticType);
      
    } catch (error) {
      logger.warn('Error detectando tipo de consulta', { error: error.message });
      return this.queryTypes.GENERAL_INQUIRY;
    }
  }

  /**
   * Detectar tipo por palabras clave
   */
  detectByKeywords(message) {
    // Consultas de precio
    if (message.includes('precio') || message.includes('costo') || message.includes('cuánto') || message.includes('valor')) {
      return this.queryTypes.PRICE_INQUIRY;
    }
    
    // Información de productos
    if (message.includes('producto') || message.includes('característica') || message.includes('especificación') || message.includes('detalle')) {
      return this.queryTypes.PRODUCT_INFO;
    }
    
    // Estado de pedidos
    if (message.includes('pedido') || message.includes('orden') || message.includes('estado') || message.includes('seguimiento')) {
      return this.queryTypes.ORDER_STATUS;
    }
    
    // Soporte técnico
    if (message.includes('problema') || message.includes('error') || message.includes('falla') || message.includes('ayuda')) {
      return this.queryTypes.TECHNICAL_SUPPORT;
    }
    
    // Información de contacto
    if (message.includes('teléfono') || message.includes('email') || message.includes('horario') || message.includes('atención')) {
      return this.queryTypes.CONTACT_INFO;
    }
    
    // Información de entrega
    if (message.includes('envío') || message.includes('entrega') || message.includes('domicilio') || message.includes('dirección')) {
      return this.queryTypes.DELIVERY_INFO;
    }
    
    // Reclamos
    if (message.includes('reclamo') || message.includes('queja') || message.includes('insatisfecho') || message.includes('devolución')) {
      return this.queryTypes.COMPLAINT;
    }
    
    return this.queryTypes.GENERAL_INQUIRY;
  }

  /**
   * Detectar tipo semánticamente
   */
  async detectSemanticType(userMessage) {
    try {
      const prompt = `
Clasifica el siguiente mensaje en uno de estos tipos:
- price_inquiry: Consultas sobre precios, costos, cotizaciones
- product_info: Información sobre productos, características, especificaciones
- order_status: Estado de pedidos, seguimiento, tracking
- technical_support: Problemas técnicos, errores, fallas, ayuda
- contact_info: Información de contacto, teléfonos, horarios
- delivery_info: Información de envíos, entregas, domicilio
- complaint: Reclamos, quejas, insatisfacción
- general_inquiry: Consultas generales

Mensaje: "${userMessage}"

Responde solo con el tipo correspondiente:
`;

      const response = await generateWithProvider('llm_studio', {
        prompt,
        model: 'gpt-oss-20b',
        temperature: 0.1,
        maxTokens: 50,
        workspaceId: 'default'
      });

      if (!response.ok) {
        throw new Error('Error en detección semántica');
      }

      const detectedType = response.text.trim().toLowerCase();
      
      // Validar que sea un tipo válido
      if (Object.values(this.queryTypes).includes(detectedType)) {
        return detectedType;
      }
      
      return this.queryTypes.GENERAL_INQUIRY;
      
    } catch (error) {
      logger.warn('Error en detección semántica', { error: error.message });
      return this.queryTypes.GENERAL_INQUIRY;
    }
  }

  /**
   * Combinar tipos de consulta
   */
  combineQueryTypes(keywordType, semanticType) {
    // Si ambos coinciden, usar ese tipo
    if (keywordType === semanticType) {
      return keywordType;
    }
    
    // Si el semántico es más específico, usarlo
    const specificTypes = [
      this.queryTypes.PRICE_INQUIRY,
      this.queryTypes.ORDER_STATUS,
      this.queryTypes.TECHNICAL_SUPPORT,
      this.queryTypes.COMPLAINT
    ];
    
    if (specificTypes.includes(semanticType)) {
      return semanticType;
    }
    
    // Por defecto, usar el de palabras clave
    return keywordType;
  }

  /**
   * Buscar información relevante optimizada
   */
  async searchRelevantOnly(entities, queryType) {
    try {
      // 1. Construir query optimizada
      const optimizedQuery = this.buildOptimizedQuery(entities, queryType);
      
      // 2. Buscar en base de conocimiento
      const knowledgeResults = await this.searchKnowledgeBase(optimizedQuery);
      
      // 3. Buscar en documentos RAG
      const ragResults = await this.searchRAGDocuments(optimizedQuery);
      
      // 4. Combinar y priorizar resultados
      return this.combineAndPrioritizeResults(knowledgeResults, ragResults, queryType);
      
    } catch (error) {
      logger.warn('Error buscando información relevante', { error: error.message });
      return [];
    }
  }

  /**
   * Construir query optimizada
   */
  buildOptimizedQuery(entities, queryType) {
    const relevantEntities = entities
      .filter(entity => entity.confidence > 0.5)
      .map(entity => entity.value)
      .slice(0, 5); // Máximo 5 entidades
    
    const queryParts = [...relevantEntities];
    
    // Agregar contexto basado en tipo de consulta
    switch (queryType) {
      case this.queryTypes.PRICE_INQUIRY:
        queryParts.push('precio', 'costo', 'tarifa');
        break;
      case this.queryTypes.PRODUCT_INFO:
        queryParts.push('característica', 'especificación', 'detalle');
        break;
      case this.queryTypes.TECHNICAL_SUPPORT:
        queryParts.push('soporte', 'ayuda', 'solución');
        break;
    }
    
    return queryParts.join(' ');
  }

  /**
   * Buscar en base de conocimiento
   */
  async searchKnowledgeBase(query) {
    try {
      // Usar el modelo Knowledge existente
      const Knowledge = require('../models/Knowledge');
      const results = await Knowledge.search(query, { isPublic: true });
      
      return results.map(knowledge => ({
        id: knowledge.id,
        title: knowledge.title,
        content: knowledge.content,
        category: knowledge.category,
        score: 0.8, // Score base para knowledge
        source: 'knowledge_base'
      }));
      
    } catch (error) {
      logger.warn('Error buscando en knowledge base', { error: error.message });
      return [];
    }
  }

  /**
   * Buscar en documentos RAG
   */
  async searchRAGDocuments(query) {
    try {
      // Usar el RAGService existente
      const RAGService = require('./RAGService');
      const ragService = new RAGService();
      
      const searchResult = await ragService.searchDocuments('default', query, {
        topK: 5,
        minScore: 0.3
      });
      
      if (!searchResult.ok) {
        return [];
      }
      
      return searchResult.fragments.map(fragment => ({
        id: fragment.id,
        title: fragment.title || 'Documento RAG',
        content: fragment.snippet,
        category: 'rag_document',
        score: fragment.score,
        source: 'rag'
      }));
      
    } catch (error) {
      logger.warn('Error buscando en RAG', { error: error.message });
      return [];
    }
  }

  /**
   * Combinar y priorizar resultados
   */
  combineAndPrioritizeResults(knowledgeResults, ragResults, queryType) {
    const allResults = [...knowledgeResults, ...ragResults];
    
    // Ordenar por score y relevancia
    return allResults
      .sort((a, b) => {
        // Priorizar por score
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        
        // Priorizar knowledge base sobre RAG
        if (a.source !== b.source) {
          return a.source === 'knowledge_base' ? -1 : 1;
        }
        
        return 0;
      })
      .slice(0, 10); // Top 10 resultados
  }

  /**
   * Priorizar por relevancia contextual
   */
  async prioritizeByRelevance(docs, userMessage, queryType) {
    try {
      // 1. Calcular relevancia semántica
      const semanticScores = await this.calculateSemanticRelevance(docs, userMessage);
      
      // 2. Ajustar por tipo de consulta
      const adjustedScores = this.adjustByQueryType(semanticScores, queryType);
      
      // 3. Ordenar por score final
      return adjustedScores
        .sort((a, b) => b.finalScore - a.finalScore)
        .map(item => item.doc);
      
    } catch (error) {
      logger.warn('Error priorizando por relevancia', { error: error.message });
      return docs; // Retornar sin cambios si hay error
    }
  }

  /**
   * Calcular relevancia semántica
   */
  async calculateSemanticRelevance(docs, userMessage) {
    const results = [];
    
    for (const doc of docs) {
      try {
        const prompt = `
Evalúa la relevancia del siguiente documento para la consulta del usuario.
Responde solo con un número entre 0.0 y 1.0.

Consulta: "${userMessage}"

Documento:
Título: ${doc.title}
Contenido: ${doc.content.substring(0, 200)}...

Relevancia (0.0-1.0):
`;

        const response = await generateWithProvider('llm_studio', {
          prompt,
          model: 'gpt-oss-20b',
          temperature: 0.1,
          maxTokens: 10,
          workspaceId: 'default'
        });

        if (response.ok) {
          const score = parseFloat(response.text.trim()) || 0.5;
          results.push({
            doc,
            semanticScore: score
          });
        } else {
          results.push({
            doc,
            semanticScore: 0.5 // Score por defecto
          });
        }
        
      } catch (error) {
        results.push({
          doc,
          semanticScore: 0.5 // Score por defecto
        });
      }
    }
    
    return results;
  }

  /**
   * Ajustar scores por tipo de consulta
   */
  adjustByQueryType(scores, queryType) {
    const adjustments = {
      [this.queryTypes.PRICE_INQUIRY]: 1.2, // Priorizar documentos de precios
      [this.queryTypes.TECHNICAL_SUPPORT]: 1.1, // Priorizar soporte
      [this.queryTypes.COMPLAINT]: 1.3, // Alta prioridad para reclamos
      [this.queryTypes.GENERAL_INQUIRY]: 1.0 // Sin ajuste
    };
    
    const multiplier = adjustments[queryType] || 1.0;
    
    return scores.map(item => ({
      ...item,
      finalScore: item.semanticScore * multiplier
    }));
  }

  /**
   * Verificar si cache es válido
   */
  isValidCache(cached) {
    const now = Date.now();
    const maxAge = 15 * 60 * 1000; // 15 minutos
    
    return cached && 
           cached.timestamp && 
           (now - cached.timestamp) < maxAge;
  }
}

// Singleton
const relevanceAnalyzerService = new RelevanceAnalyzerService();

module.exports = {
  RelevanceAnalyzerService,
  relevanceAnalyzerService
};
