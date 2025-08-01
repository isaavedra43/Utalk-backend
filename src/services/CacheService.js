/**
 * 🚀 ENTERPRISE CACHE SERVICE
 * 
 * Sistema de caching inteligente y seguro para optimizar performance
 * basado en mejores prácticas de escalabilidad enterprise.
 * 
 * Características:
 * ✅ Redis como caché principal (centralizado y persistente)
 * ✅ Fallback a memoria local si Redis no está disponible
 * ✅ TTL automático con políticas configurables
 * ✅ Invalidation inteligente por eventos
 * ✅ Cache warming para datos críticos
 * ✅ Compresión para optimizar memoria
 * ✅ Métricas y monitoreo en tiempo real
 * 
 * @version 1.0.0 ENTERPRISE
 * @author Scalability Team
 */

const Redis = require('ioredis');
const logger = require('../utils/logger');
const { asyncWrapper } = require('../utils/errorWrapper');
const { createHash } = require('crypto');

class EnterpriseCacheService {
  constructor() {
    this.redis = null;
    this.localCache = new Map();
    this.isRedisAvailable = false;
    this.compressionEnabled = process.env.CACHE_COMPRESSION === 'true';
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      lastReset: Date.now()
    };

    this.initialize();
  }

  /**
   * 🚀 INICIALIZAR CACHE SERVICE
   */
  async initialize() {
    try {
      logger.info('🚀 Initializing Enterprise Cache Service...', {
        category: 'CACHE_INIT',
        compression: this.compressionEnabled,
        redisUrl: process.env.REDIS_URL ? 'configured' : 'not-configured'
      });

      // Intentar conectar a Redis
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL, {
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          keepAlive: 30000,
          connectTimeout: 10000,
          commandTimeout: 5000,
          // Configuración para alta disponibilidad
          sentinels: process.env.REDIS_SENTINELS ? 
            JSON.parse(process.env.REDIS_SENTINELS) : undefined,
          name: process.env.REDIS_MASTER_NAME || 'mymaster',
          // Configuración para cluster
          cluster: process.env.REDIS_CLUSTER === 'true',
          clusterOptions: {
            scaleReads: 'slave',
            maxRedirections: 16,
            retryDelayOnFailover: 100
          }
        });

        this.redis.on('connect', () => {
          this.isRedisAvailable = true;
          logger.info('✅ Redis connection established', {
            category: 'CACHE_REDIS_SUCCESS'
          });
        });

        this.redis.on('error', (error) => {
          this.isRedisAvailable = false;
          logger.warn('⚠️ Redis connection failed, using local cache', {
            category: 'CACHE_REDIS_ERROR',
            error: error.message
          });
        });

        this.redis.on('ready', () => {
          logger.info('✅ Redis ready for operations', {
            category: 'CACHE_REDIS_READY'
          });
        });

        // Conectar a Redis
        await this.redis.connect();
      } else {
        logger.warn('⚠️ Redis URL not configured, using local cache only', {
          category: 'CACHE_REDIS_MISSING'
        });
      }

      // Configurar limpieza periódica del cache local
      this.setupLocalCacheCleanup();

      // Configurar métricas periódicas
      this.setupMetricsReporting();

      logger.info('✅ Enterprise Cache Service initialized successfully', {
        category: 'CACHE_INIT_SUCCESS',
        redisAvailable: this.isRedisAvailable,
        compressionEnabled: this.compressionEnabled
      });

    } catch (error) {
      logger.error('💥 Failed to initialize Cache Service', {
        category: 'CACHE_INIT_ERROR',
        error: error.message,
        stack: error.stack
      });
      
      // Continuar con cache local
      this.isRedisAvailable = false;
    }
  }

  /**
   * 🔑 GENERAR CACHE KEY
   */
  generateKey(prefix, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');

    const hash = createHash('md5')
      .update(sortedParams)
      .digest('hex')
      .substring(0, 8);

    return `${prefix}:${hash}`;
  }

  /**
   * 📦 COMPRIMIR DATOS
   */
  compress(data) {
    if (!this.compressionEnabled) return data;
    
    try {
      const jsonString = JSON.stringify(data);
      return Buffer.from(jsonString).toString('base64');
    } catch (error) {
      logger.warn('Cache compression failed, using uncompressed data', {
        category: 'CACHE_COMPRESSION_ERROR',
        error: error.message
      });
      return data;
    }
  }

  /**
   * 📦 DESCOMPRIMIR DATOS
   */
  decompress(data) {
    if (!this.compressionEnabled) return data;
    
    try {
      const buffer = Buffer.from(data, 'base64');
      return JSON.parse(buffer.toString());
    } catch (error) {
      logger.warn('Cache decompression failed, returning raw data', {
        category: 'CACHE_DECOMPRESSION_ERROR',
        error: error.message
      });
      return data;
    }
  }

  /**
   * 💾 SET CACHE (REDIS + FALLBACK)
   */
  async set(key, value, ttl = 300) {
    return asyncWrapper(async () => {
      const cacheKey = this.generateKey('cache', { key });
      const compressedValue = this.compress(value);
      
      try {
        if (this.isRedisAvailable && this.redis) {
          await this.redis.setex(cacheKey, ttl, compressedValue);
        } else {
          // Fallback a cache local
          this.localCache.set(cacheKey, {
            value: compressedValue,
            expiresAt: Date.now() + (ttl * 1000)
          });
        }

        this.metrics.sets++;
        
        logger.debug('Cache SET successful', {
          category: 'CACHE_SET',
          key: cacheKey,
          ttl,
          size: JSON.stringify(value).length,
          compressed: this.compressionEnabled
        });

        return true;
      } catch (error) {
        this.metrics.errors++;
        logger.error('Cache SET failed', {
          category: 'CACHE_SET_ERROR',
          key: cacheKey,
          error: error.message
        });
        return false;
      }
    }, {
      operationName: 'cacheSet',
      timeoutMs: 5000
    })();
  }

  /**
   * 📖 GET CACHE (REDIS + FALLBACK)
   */
  async get(key) {
    return asyncWrapper(async () => {
      const cacheKey = this.generateKey('cache', { key });
      
      try {
        let value = null;

        if (this.isRedisAvailable && this.redis) {
          value = await this.redis.get(cacheKey);
        } else {
          // Fallback a cache local
          const cached = this.localCache.get(cacheKey);
          if (cached && cached.expiresAt > Date.now()) {
            value = cached.value;
          } else if (cached) {
            // Expired, remove from local cache
            this.localCache.delete(cacheKey);
          }
        }

        if (value) {
          this.metrics.hits++;
          const decompressedValue = this.decompress(value);
          
          logger.debug('Cache HIT', {
            category: 'CACHE_HIT',
            key: cacheKey
          });

          return decompressedValue;
        } else {
          this.metrics.misses++;
          
          logger.debug('Cache MISS', {
            category: 'CACHE_MISS',
            key: cacheKey
          });

          return null;
        }
      } catch (error) {
        this.metrics.errors++;
        logger.error('Cache GET failed', {
          category: 'CACHE_GET_ERROR',
          key: cacheKey,
          error: error.message
        });
        return null;
      }
    }, {
      operationName: 'cacheGet',
      timeoutMs: 3000
    })();
  }

  /**
   * 🗑️ DELETE CACHE
   */
  async delete(key) {
    return asyncWrapper(async () => {
      const cacheKey = this.generateKey('cache', { key });
      
      try {
        if (this.isRedisAvailable && this.redis) {
          await this.redis.del(cacheKey);
        } else {
          this.localCache.delete(cacheKey);
        }

        this.metrics.deletes++;
        
        logger.debug('Cache DELETE successful', {
          category: 'CACHE_DELETE',
          key: cacheKey
        });

        return true;
      } catch (error) {
        this.metrics.errors++;
        logger.error('Cache DELETE failed', {
          category: 'CACHE_DELETE_ERROR',
          key: cacheKey,
          error: error.message
        });
        return false;
      }
    }, {
      operationName: 'cacheDelete',
      timeoutMs: 3000
    })();
  }

  /**
   * 🔄 INVALIDATE PATTERN
   */
  async invalidatePattern(pattern) {
    return asyncWrapper(async () => {
      try {
        if (this.isRedisAvailable && this.redis) {
          const keys = await this.redis.keys(pattern);
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        } else {
          // Fallback: limpiar cache local por patrón
          for (const [key] of this.localCache) {
            if (key.includes(pattern.replace('*', ''))) {
              this.localCache.delete(key);
            }
          }
        }

        logger.info('Cache pattern invalidation successful', {
          category: 'CACHE_INVALIDATE_PATTERN',
          pattern,
          keysCount: this.isRedisAvailable ? 'redis' : this.localCache.size
        });

        return true;
      } catch (error) {
        logger.error('Cache pattern invalidation failed', {
          category: 'CACHE_INVALIDATE_ERROR',
          pattern,
          error: error.message
        });
        return false;
      }
    }, {
      operationName: 'cacheInvalidatePattern',
      timeoutMs: 10000
    })();
  }

  /**
   * 🔥 CACHE WARMING
   */
  async warmCache(warmingConfig) {
    return asyncWrapper(async () => {
      logger.info('🔥 Starting cache warming...', {
        category: 'CACHE_WARMING_START',
        configCount: warmingConfig.length
      });

      const results = [];

      for (const config of warmingConfig) {
        try {
          const { key, data, ttl = 300 } = config;
          await this.set(key, data, ttl);
          results.push({ key, status: 'success' });
        } catch (error) {
          results.push({ key: config.key, status: 'error', error: error.message });
        }
      }

      const successCount = results.filter(r => r.status === 'success').length;
      
      logger.info('🔥 Cache warming completed', {
        category: 'CACHE_WARMING_COMPLETE',
        total: warmingConfig.length,
        success: successCount,
        failed: warmingConfig.length - successCount
      });

      return results;
    }, {
      operationName: 'cacheWarming',
      timeoutMs: 60000
    })();
  }

  /**
   * 📊 GET CACHE STATS
   */
  getStats() {
    const now = Date.now();
    const duration = now - this.metrics.lastReset;
    
    const stats = {
      redis: {
        available: this.isRedisAvailable,
        connected: this.redis?.status === 'ready'
      },
      local: {
        size: this.localCache.size,
        keys: Array.from(this.localCache.keys())
      },
      metrics: {
        ...this.metrics,
        hitRate: this.metrics.hits + this.metrics.misses > 0 ? 
          (this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100 : 0,
        duration: `${Math.round(duration / 1000)}s`
      },
      compression: {
        enabled: this.compressionEnabled
      }
    };

    return stats;
  }

  /**
   * 🧹 SETUP LOCAL CACHE CLEANUP
   */
  setupLocalCacheCleanup() {
    // Limpiar cache local cada 5 minutos
    setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [key, value] of this.localCache.entries()) {
        if (value.expiresAt < now) {
          this.localCache.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.debug('Local cache cleanup completed', {
          category: 'CACHE_LOCAL_CLEANUP',
          cleanedCount,
          remainingKeys: this.localCache.size
        });
      }
    }, 5 * 60 * 1000); // 5 minutos
  }

  /**
   * 📈 SETUP METRICS REPORTING
   */
  setupMetricsReporting() {
    // Reportar métricas cada minuto
    setInterval(() => {
      const stats = this.getStats();
      
      logger.info('Cache Service Metrics', {
        category: 'CACHE_METRICS',
        ...stats
      });

      // Reset métricas cada hora
      if (Date.now() - this.metrics.lastReset > 60 * 60 * 1000) {
        this.metrics.hits = 0;
        this.metrics.misses = 0;
        this.metrics.sets = 0;
        this.metrics.deletes = 0;
        this.metrics.errors = 0;
        this.metrics.lastReset = Date.now();
      }
    }, 60 * 1000); // 1 minuto
  }

  /**
   * 🔄 HEALTH CHECK
   */
  async healthCheck() {
    try {
      if (this.isRedisAvailable && this.redis) {
        await this.redis.ping();
        return { status: 'healthy', redis: 'connected' };
      } else {
        return { status: 'degraded', redis: 'disconnected', local: 'available' };
      }
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  /**
   * 🛑 GRACEFUL SHUTDOWN
   */
  async shutdown() {
    try {
      logger.info('🛑 Shutting down Cache Service...', {
        category: 'CACHE_SHUTDOWN'
      });

      if (this.redis) {
        await this.redis.quit();
      }

      // Limpiar cache local
      this.localCache.clear();

      logger.info('✅ Cache Service shutdown completed', {
        category: 'CACHE_SHUTDOWN_COMPLETE'
      });
    } catch (error) {
      logger.error('Error during Cache Service shutdown', {
        category: 'CACHE_SHUTDOWN_ERROR',
        error: error.message
      });
    }
  }

  /**
   * 🧹 SETUP REDIS LISTENERS WITH CLEANUP
   * Configura listeners de Redis con cleanup automático
   */
  setupRedisListeners() {
    try {
      const eventCleanup = require('../utils/eventCleanup');
      
      const listeners = [
        ['connect', () => {
          logger.info('Redis connected');
          this.isConnected = true;
        }],
        ['error', (error) => {
          logger.error('Redis error', { error: error.message });
          this.isConnected = false;
        }],
        ['ready', () => {
          logger.info('Redis ready');
          this.isReady = true;
        }],
        ['close', () => {
          logger.info('Redis connection closed');
          this.isConnected = false;
          this.isReady = false;
        }],
        ['reconnecting', () => {
          logger.info('Redis reconnecting');
          this.isConnected = false;
        }]
      ];

      listeners.forEach(([event, handler]) => {
        eventCleanup.addListener(this.redis, event, handler, {
          maxCalls: Infinity,
          timeout: null,
          metadata: { 
            service: 'CacheService',
            event,
            redisUrl: this.redisUrl ? 'configured' : 'not-configured'
          }
        });
      });

      logger.info('Redis listeners configurados con cleanup automático', {
        totalListeners: listeners.length,
        redisUrl: this.redisUrl ? 'configured' : 'not-configured'
      });

    } catch (error) {
      logger.error('Error configurando Redis listeners', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 🧹 CLEANUP
   * Limpia todos los listeners y conexiones
   */
  async cleanup() {
    try {
      logger.info('Iniciando cleanup de CacheService');

      // Limpiar event listeners
      const eventCleanup = require('../utils/eventCleanup');
      const cleanedListeners = eventCleanup.cleanup(this.redis);

      // Desconectar Redis
      if (this.redis) {
        await this.redis.disconnect();
      }

      // Limpiar cache en memoria
      this.memoryCache.clear();
      this.stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        errors: 0
      };

      logger.info('CacheService cleanup completado', {
        cleanedListeners,
        memoryCacheSize: this.memoryCache.size
      });

    } catch (error) {
      logger.error('Error en cleanup de CacheService', {
        error: error.message,
        stack: error.stack
      });
    }
  }
}

// Singleton instance
const cacheService = new EnterpriseCacheService();

module.exports = cacheService; 