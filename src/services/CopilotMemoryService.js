/**
 * 🧠 COPILOT MEMORY SERVICE
 * 
 * Servicio de memoria específico para el copiloto IA
 * que integra con la estructura existente.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { copilotCacheService } = require('./CopilotCacheService');
const { getConversationsRepository } = require('../repositories/ConversationsRepository');
const logger = require('../utils/logger');

class CopilotMemoryService {
  constructor() {
    this.cacheService = copilotCacheService;
    this.conversationsRepo = getConversationsRepository();
  }

  /**
   * Obtener memoria de conversación optimizada
   */
  async getConversationMemory(conversationId, userMessage) {
    try {
      // 1. Obtener memoria del cache
      const cachedMemory = await this.cacheService.getConversationMemory(conversationId);
      
      // 2. Si no hay memoria en cache, cargar desde base de datos
      if (!cachedMemory || cachedMemory.length === 0) {
        const conversationMemory = await this.loadFromDatabase(conversationId);
        return this.buildOptimizedContext(conversationMemory, userMessage);
      }
      
      // 3. Analizar relevancia y construir contexto optimizado
      return this.buildOptimizedContext(cachedMemory, userMessage);
      
    } catch (error) {
      logger.warn('Error getting conversation memory', { 
        conversationId, 
        error: error.message 
      });
      return [];
    }
  }

  /**
   * Cargar memoria desde base de datos
   */
  async loadFromDatabase(conversationId) {
    try {
      // Cargar últimos mensajes de la conversación
      const messages = await this.conversationsRepo.getConversationMessages(conversationId, {
        limit: 20,
        orderBy: 'timestamp',
        orderDirection: 'desc'
      });

      // Formatear para memoria
      return messages.map(msg => ({
        message: msg.content,
        role: msg.direction === 'inbound' ? 'client' : 'agent',
        timestamp: msg.timestamp,
        type: msg.type || 'text'
      }));

    } catch (error) {
      logger.warn('Error loading from database', { 
        conversationId, 
        error: error.message 
      });
      return [];
    }
  }

  /**
   * Analizar relevancia del contexto
   */
  async analyzeRelevance(userMessage, conversationMemory) {
    try {
      // Extraer palabras clave del mensaje del usuario
      const userKeywords = this.extractKeywords(userMessage);
      
      // Calcular relevancia de cada mensaje en la memoria
      const relevantMessages = conversationMemory
        .map(msg => ({
          ...msg,
          relevance: this.calculateRelevance(userKeywords, msg.message)
        }))
        .filter(msg => msg.relevance > 0.3) // Solo mensajes relevantes
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 10); // Top 10 más relevantes

      return relevantMessages;
      
    } catch (error) {
      logger.warn('Error analyzing relevance', { error: error.message });
      return conversationMemory.slice(-10); // Últimos 10 si hay error
    }
  }

  /**
   * Extraer palabras clave
   */
  extractKeywords(text) {
    if (!text) return [];
    
    // Convertir a minúsculas y dividir en palabras
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2); // Solo palabras de más de 2 caracteres
    
    // Filtrar palabras comunes (stop words)
    const stopWords = ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'del', 'los', 'las', 'una', 'como', 'pero', 'sus', 'me', 'hasta', 'hay', 'donde', 'han', 'quien', 'están', 'estado', 'desde', 'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mí', 'antes', 'algunos', 'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos', 'mucho', 'quienes', 'nada', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas', 'algunas', 'algo', 'nosotros'];
    
    return words.filter(word => !stopWords.includes(word));
  }

  /**
   * Calcular relevancia entre palabras clave y mensaje
   */
  calculateRelevance(keywords, message) {
    if (!keywords.length || !message) return 0;
    
    const messageWords = this.extractKeywords(message);
    const matches = keywords.filter(keyword => 
      messageWords.some(word => word.includes(keyword) || keyword.includes(word))
    );
    
    return matches.length / keywords.length;
  }

  /**
   * Construir contexto optimizado
   */
  async buildOptimizedContext(conversationMemory, userMessage) {
    try {
      // 1. Analizar relevancia
      const relevantMessages = await this.analyzeRelevance(userMessage, conversationMemory);
      
      // 2. Construir contexto optimizado
      const optimizedContext = {
        recentMessages: relevantMessages.slice(0, 5), // Top 5 más relevantes
        conversationSummary: this.generateConversationSummary(conversationMemory),
        userIntent: this.detectUserIntent(userMessage),
        conversationState: this.analyzeConversationState(conversationMemory)
      };
      
      return optimizedContext;
      
    } catch (error) {
      logger.warn('Error building optimized context', { error: error.message });
      return {
        recentMessages: conversationMemory.slice(-5),
        conversationSummary: 'Error generating summary',
        userIntent: 'unknown',
        conversationState: 'unknown'
      };
    }
  }

  /**
   * Generar resumen de conversación
   */
  generateConversationSummary(conversationMemory) {
    try {
      if (!conversationMemory.length) return 'Conversación nueva';
      
      const clientMessages = conversationMemory
        .filter(msg => msg.role === 'client')
        .map(msg => msg.message)
        .join(' ');
      
      // Resumen simple basado en palabras clave
      const keywords = this.extractKeywords(clientMessages);
      const topKeywords = keywords
        .slice(0, 5)
        .join(', ');
      
      return `Cliente interesado en: ${topKeywords}`;
      
    } catch (error) {
      return 'Resumen no disponible';
    }
  }

  /**
   * Detectar intención del usuario
   */
  detectUserIntent(userMessage) {
    const message = userMessage.toLowerCase();
    
    if (message.includes('precio') || message.includes('costo') || message.includes('cuánto')) {
      return 'price_inquiry';
    }
    
    if (message.includes('información') || message.includes('detalles') || message.includes('especificaciones')) {
      return 'information_request';
    }
    
    if (message.includes('problema') || message.includes('error') || message.includes('ayuda')) {
      return 'support_request';
    }
    
    if (message.includes('comprar') || message.includes('orden') || message.includes('pedido')) {
      return 'purchase_intent';
    }
    
    return 'general_inquiry';
  }

  /**
   * Analizar estado de la conversación
   */
  analyzeConversationState(conversationMemory) {
    if (!conversationMemory.length) return 'new';
    
    const recentMessages = conversationMemory.slice(-3);
    const hasAgentResponse = recentMessages.some(msg => msg.role === 'agent');
    
    if (!hasAgentResponse) return 'waiting_for_agent';
    
    const lastMessage = recentMessages[recentMessages.length - 1];
    if (lastMessage.role === 'client') return 'waiting_for_response';
    
    return 'active';
  }

  /**
   * Agregar mensaje a memoria
   */
  async addToMemory(conversationId, message, response) {
    try {
      await this.cacheService.addToMemory(conversationId, message, response);
      logger.debug('Message added to copilot memory', { conversationId });
    } catch (error) {
      logger.warn('Error adding to memory', { error: error.message });
    }
  }

  /**
   * Limpiar memoria de conversación
   */
  async clearMemory(conversationId) {
    try {
      this.cacheService.conversationMemory.delete(conversationId);
      logger.info('Conversation memory cleared', { conversationId });
    } catch (error) {
      logger.warn('Error clearing memory', { error: error.message });
    }
  }
}

// Singleton
const copilotMemoryService = new CopilotMemoryService();

module.exports = {
  CopilotMemoryService,
  copilotMemoryService
};
