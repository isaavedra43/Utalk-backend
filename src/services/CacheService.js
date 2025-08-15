/**
 * 🚀 CACHE SERVICE - REDUCCIÓN DE RATE LIMIT
 * 
 * Servicio de cache inteligente para reducir llamadas repetitivas
 * y optimizar el rendimiento del backend
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.cache = new Map();
    this.ttl = new Map(); // Time To Live para cada entrada
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
    
    // Limpiar cache expirado cada 5 minutos
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
    
    logger.info('✅ CacheService inicializado', {
      category: 'CACHE_INIT',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 🔧 SET - Guardar valor en cache con TTL
   */
  set(key, value, ttlSeconds = 300) { // 5 minutos por defecto
    try {
      const expiresAt = Date.now() + (ttlSeconds * 1000);
      
      this.cache.set(key, value);
      this.ttl.set(key, expiresAt);
      this.stats.sets++;
      
      logger.debug('Cache SET exitoso', {
        category: 'CACHE_SET',
        key: key.substring(0, 50) + '...',
        ttlSeconds,
        cacheSize: this.cache.size
      });
      
      return true;
    } catch (error) {
      logger.error('Error en Cache SET', {
        category: 'CACHE_SET_ERROR',
        key: key.substring(0, 50) + '...',
        error: error.message
      });
      return false;
    }
  }

  /**
   * 🔍 GET - Obtener valor del cache
   */
  get(key) {
    try {
      const value = this.cache.get(key);
      const expiresAt = this.ttl.get(key);
      
      // Verificar si expiró
      if (expiresAt && Date.now() > expiresAt) {
        this.delete(key);
        this.stats.misses++;
        return null;
      }
      
      if (value !== undefined) {
        this.stats.hits++;
        logger.debug('Cache HIT', {
          category: 'CACHE_HIT',
          key: key.substring(0, 50) + '...'
        });
        return value;
      } else {
        this.stats.misses++;
        logger.debug('Cache MISS', {
          category: 'CACHE_MISS',
          key: key.substring(0, 50) + '...'
        });
        return null;
      }
    } catch (error) {
      logger.error('Error en Cache GET', {
        category: 'CACHE_GET_ERROR',
        key: key.substring(0, 50) + '...',
        error: error.message
      });
      this.stats.misses++;
      return null;
    }
  }

  /**
   * 🗑️ DELETE - Eliminar entrada del cache
   */
  delete(key) {
    try {
      const deleted = this.cache.delete(key);
      this.ttl.delete(key);
      
      if (deleted) {
        this.stats.deletes++;
        logger.debug('Cache DELETE exitoso', {
          category: 'CACHE_DELETE',
          key: key.substring(0, 50) + '...'
        });
      }
      
      return deleted;
    } catch (error) {
      logger.error('Error en Cache DELETE', {
        category: 'CACHE_DELETE_ERROR',
        key: key.substring(0, 50) + '...',
        error: error.message
      });
      return false;
    }
  }

  /**
   * 🧹 CLEANUP - Limpiar entradas expiradas
   */
  cleanup() {
    try {
      const now = Date.now();
      let cleanedCount = 0;
      
      for (const [key, expiresAt] of this.ttl.entries()) {
        if (now > expiresAt) {
          this.cache.delete(key);
          this.ttl.delete(key);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        logger.info('Cache cleanup completado', {
          category: 'CACHE_CLEANUP',
          cleanedCount,
          remainingEntries: this.cache.size
        });
      }
      
      return cleanedCount;
    } catch (error) {
      logger.error('Error en Cache cleanup', {
        category: 'CACHE_CLEANUP_ERROR',
        error: error.message
      });
      return 0;
    }
  }

  /**
   * 📊 GET STATS - Obtener estadísticas del cache
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      deletes: this.stats.deletes,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      ttlEntries: this.ttl.size
    };
  }

  /**
   * 🔄 CLEAR ALL - Limpiar todo el cache
   */
  clearAll() {
    try {
      const size = this.cache.size;
      this.cache.clear();
      this.ttl.clear();
      
      logger.info('Cache completamente limpiado', {
        category: 'CACHE_CLEAR_ALL',
        clearedEntries: size
      });
      
      return size;
    } catch (error) {
      logger.error('Error limpiando cache', {
        category: 'CACHE_CLEAR_ERROR',
        error: error.message
      });
      return 0;
    }
  }

  /**
   * 🔧 CACHE WRAPPER - Wrapper para funciones con cache automático
   */
  async wrap(key, fn, ttlSeconds = 300) {
    try {
      // Intentar obtener del cache
      const cached = this.get(key);
      if (cached !== null) {
        return cached;
      }
      
      // Si no está en cache, ejecutar función
      const result = await fn();
      
      // Guardar en cache
      this.set(key, result, ttlSeconds);
      
      return result;
    } catch (error) {
      logger.error('Error en Cache wrapper', {
        category: 'CACHE_WRAPPER_ERROR',
        key: key.substring(0, 50) + '...',
        error: error.message
      });
      
      // En caso de error, intentar ejecutar función sin cache
      return await fn();
    }
  }
}

// Singleton instance
const cacheService = new CacheService();

module.exports = {
  CacheService,
  cacheService
}; 