/**
 * 🧠 COPILOT CACHE SERVICE
 * 
 * Servicio de cache específico para el copiloto IA
 * que extiende el CacheService existente.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { cacheService } = require('./CacheService');
const logger = require('../utils/logger');

class CopilotCacheService {
  constructor() {
    // Usar el cache service existente
    this.cacheService = cacheService;
    
    // Mapas específicos para el copiloto
    this.responseCache = this.cacheService.createManagedMap('copilot_responses', {
      maxEntries: 10000,
      defaultTTL: 30 * 60 * 1000, // 30 minutos
      onEviction: (key, value, reason) => {
        logger.debug('Copilot response cache eviction', { key, reason });
      }
    });

    this.contextCache = this.cacheService.createManagedMap('copilot_contexts', {
      maxEntries: 5000,
      defaultTTL: 15 * 60 * 1000, // 15 minutos
      onEviction: (key, value, reason) => {
        logger.debug('Copilot context cache eviction', { key, reason });
      }
    });

    this.conversationMemory = this.cacheService.createManagedMap('copilot_conversations', {
      maxEntries: 2000,
      defaultTTL: 60 * 60 * 1000, // 1 hora
      onEviction: (key, value, reason) => {
        logger.debug('Copilot conversation memory eviction', { key, reason });
      }
    });
  }

  /**
   * Generar hash inteligente para cache
   */
  async generateIntelligentHash(userMessage, context) {
    const messageHash = require('crypto')
      .createHash('sha256')
      .update(userMessage.toLowerCase().trim())
      .digest('hex');
    
    const contextHash = require('crypto')
      .createHash('sha256')
      .update(JSON.stringify(context || {}))
      .digest('hex');
    
    return `${messageHash}_${contextHash}`;
  }

  /**
   * Obtener respuesta cacheada
   */
  async getCachedResponse(userMessage, context) {
    try {
      const hash = await this.generateIntelligentHash(userMessage, context);
      const cached = this.responseCache.get(hash);
      
      if (cached && this.isValidCache(cached)) {
        logger.debug('Copilot cache hit', { hash: hash.substring(0, 10) });
        return cached.response;
      }
      
      return null;
    } catch (error) {
      logger.warn('Error getting cached response', { error: error.message });
      return null;
    }
  }

  /**
   * Cachear respuesta
   */
  async cacheResponse(userMessage, context, response) {
    try {
      const hash = await this.generateIntelligentHash(userMessage, context);
      this.responseCache.set(hash, {
        response,
        timestamp: Date.now(),
        usage: 1
      });
      
      logger.debug('Copilot response cached', { hash: hash.substring(0, 10) });
    } catch (error) {
      logger.warn('Error caching response', { error: error.message });
    }
  }

  /**
   * Verificar si cache es válido
   */
  isValidCache(cached) {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutos
    
    return cached && 
           cached.timestamp && 
           (now - cached.timestamp) < maxAge;
  }

  /**
   * Obtener memoria de conversación
   */
  async getConversationMemory(conversationId) {
    try {
      return this.conversationMemory.get(conversationId) || [];
    } catch (error) {
      logger.warn('Error getting conversation memory', { error: error.message });
      return [];
    }
  }

  /**
   * Agregar a memoria de conversación
   */
  async addToMemory(conversationId, message, response) {
    try {
      const memory = await this.getConversationMemory(conversationId);
      memory.push({
        message,
        response,
        timestamp: Date.now()
      });
      
      // Mantener solo los últimos 20 mensajes
      if (memory.length > 20) {
        memory.splice(0, memory.length - 20);
      }
      
      this.conversationMemory.set(conversationId, memory);
    } catch (error) {
      logger.warn('Error adding to memory', { error: error.message });
    }
  }

  /**
   * Limpiar cache
   */
  async clearCache() {
    try {
      this.responseCache.clear();
      this.contextCache.clear();
      logger.info('Copilot cache cleared');
    } catch (error) {
      logger.warn('Error clearing cache', { error: error.message });
    }
  }

  /**
   * Obtener estadísticas del cache
   */
  getStats() {
    return {
      responseCache: {
        size: this.responseCache.size,
        hits: this.responseCache.stats?.hits || 0,
        misses: this.responseCache.stats?.misses || 0
      },
      contextCache: {
        size: this.contextCache.size
      },
      conversationMemory: {
        size: this.conversationMemory.size
      }
    };
  }
}

// Singleton
const copilotCacheService = new CopilotCacheService();

module.exports = {
  CopilotCacheService,
  copilotCacheService
};
