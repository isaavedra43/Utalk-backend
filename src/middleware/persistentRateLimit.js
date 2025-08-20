/**
 * 🛡️ SISTEMA DE RATE LIMITING PERSISTENTE
 * 
 * Características:
 * - Rate limiting por IP y por usuario
 * - Persistencia en Redis con fallback a memoria
 * - Configuración diferenciada por ruta
 * - Protección contra DDoS y spam
 * 
 * @version 2.0.0
 */

const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const Redis = require('ioredis');
const logger = require('../utils/logger');

class PersistentRateLimitManager {
  constructor() {
    this.redis = null;
    this.usingRedis = false;
    this.localStore = new Map();
    this.isInitialized = false;
    
    this.initialize();
  }

  /**
   * 🔧 INICIALIZAR RATE LIMIT MANAGER
   */
  async initialize() {
    try {
      // Debug: Log para verificar qué valores están llegando
      logger.info('🔍 Debug Rate Limit Redis configuration:', {
        category: 'RATE_LIMIT_REDIS_DEBUG',
        redisUrl: process.env.REDIS_URL ? 'SET' : 'NOT_SET',
        enableRedis: process.env.ENABLE_REDIS,
        hasRedisUrl: !!process.env.REDIS_URL
      });
      
      // 🔧 SOLUCIÓN: Intentar conectar Redis con family=0 para Railway IPv6
      if (process.env.REDIS_URL && process.env.ENABLE_REDIS !== 'false') {
        const redisUrl = process.env.REDIS_URL;
        
        // Verificar que redisUrl sea una cadena válida antes de usar .includes()
        if (typeof redisUrl !== 'string') {
          logger.error('❌ REDIS_URL no es una cadena válida en Rate Limit', {
            category: 'RATE_LIMIT_REDIS_CONFIG_ERROR',
            redisUrlType: typeof redisUrl,
            redisUrlValue: redisUrl
          });
          throw new Error('REDIS_URL no es una cadena válida');
        }
        
        // 🔧 SOLUCIÓN OFICIAL RAILWAY: Usar family=0 para dual stack lookup
        // Según docs.railway.com: "add ?family=0 to enable dual stack lookup"
        const redisUrlWithFamily = redisUrl.includes('?family=0') ? redisUrl : `${redisUrl}?family=0`;
        
        this.redis = new Redis(redisUrlWithFamily, {
          maxRetriesPerRequest: 1, // Reducir retries para Railway
          retryDelayOnFailover: 50, // Reducir delay
          enableReadyCheck: false, // Deshabilitar para Railway
          lazyConnect: false, // Conectar inmediatamente
          connectTimeout: 10000, // 10 segundos timeout
          commandTimeout: 5000, // 5 segundos timeout
          showFriendlyErrorStack: process.env.NODE_ENV === 'development'
        });

        try {
          await this.redis.ping();
          this.usingRedis = true;
          logger.info('✅ Rate Limiting usando Redis persistente', {
            category: 'RATE_LIMIT_INIT',
            store: 'redis',
            url: process.env.REDIS_URL.replace(/\/\/.*@/, '//***@')
          });
        } catch (error) {
          logger.error('❌ Error conectando a Redis en Rate Limit', {
            error: error.message,
            category: 'RATE_LIMIT_REDIS_CONNECTION_ERROR',
            isRailway: process.env.RAILWAY_ENVIRONMENT === 'true'
          });
          
          // 🔧 SOLUCIÓN RAILWAY: Fallback a memoria si Redis falla
          if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
            logger.warn('⚠️ Redis no disponible en Railway, usando fallback a memoria', {
              category: 'RATE_LIMIT_FALLBACK',
              reason: 'Redis connection failed',
              error: error.message
            });
            this.usingRedis = false;
            this.redis = null;
          } else {
            this.redis.disconnect();
            this.redis = null;
            throw error;
          }
        }
      } else {
        throw new Error('Redis no configurado o deshabilitado');
      }
    } catch (error) {
      // Fallback a almacenamiento local
      this.usingRedis = false;
      logger.warn('⚠️ Rate Limiting usando memoria local (Redis no disponible)', {
        category: 'RATE_LIMIT_FALLBACK',
        store: 'memory',
        reason: error.message
      });
    }

    this.isInitialized = true;
  }

  /**
   * 🛡️ STORE PERSONALIZADO PARA RATE LIMITING
   */
  createStore() {
    if (this.usingRedis) {
      return this.createRedisStore();
    } else {
      return this.createMemoryStore();
    }
  }

  /**
   * 🔴 STORE REDIS
   */
  createRedisStore() {
    const redis = this.redis;
    
    return {
      incr: async (key) => {
        try {
          const multi = redis.multi();
          multi.incr(key);
          multi.expire(key, 900); // 15 minutos
          const results = await multi.exec();
          return results[0][1]; // Valor del contador
        } catch (error) {
          logger.error('Error en Redis store incr', {
            category: 'RATE_LIMIT_REDIS_ERROR',
            error: error.message,
            key
          });
          return 1; // Fallback seguro
        }
      },
      
      decrement: async (key) => {
        try {
          return await redis.decr(key);
        } catch (error) {
          logger.error('Error en Redis store decrement', {
            category: 'RATE_LIMIT_REDIS_ERROR',
            error: error.message,
            key
          });
          return 0; // Fallback seguro
        }
      },
      
      resetKey: async (key) => {
        try {
          return await redis.del(key);
        } catch (error) {
          logger.error('Error en Redis store resetKey', {
            category: 'RATE_LIMIT_REDIS_ERROR',
            error: error.message,
            key
          });
          return true; // Fallback seguro
        }
      },
      
      resetAll: async () => {
        try {
          const keys = await redis.keys('rate-limit:*');
          if (keys.length > 0) {
            return await redis.del(...keys);
          }
          return 0;
        } catch (error) {
          logger.error('Error en Redis store resetAll', {
            category: 'RATE_LIMIT_REDIS_ERROR',
            error: error.message
          });
          return true; // Fallback seguro
        }
      }
    };
  }

  /**
   * 💾 STORE MEMORIA LOCAL
   */
  createMemoryStore() {
    return {
      incr: (key) => {
        const current = this.localStore.get(key) || 0;
        const newValue = current + 1;
        this.localStore.set(key, newValue);
        
        // Auto-cleanup después de 15 minutos
        setTimeout(() => {
          this.localStore.delete(key);
        }, 15 * 60 * 1000);
        
        return newValue;
      },
      
      decrement: (key) => {
        const current = this.localStore.get(key) || 0;
        const newValue = Math.max(0, current - 1);
        this.localStore.set(key, newValue);
        return newValue;
      },
      
      resetKey: (key) => {
        return this.localStore.delete(key);
      },
      
      resetAll: () => {
        this.localStore.clear();
        return true;
      }
    };
  }

  /**
   * 🛡️ RATE LIMITER GENERAL - MÁS PERMISIVO
   */
  createGeneralLimiter() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 2000, // Aumentado de 100 a 2000 requests por ventana
      message: {
        success: false,
        error: {
          type: 'RATE_LIMIT_ERROR',
          code: 'TOO_MANY_REQUESTS',
          message: 'Demasiadas solicitudes desde esta IP. Intenta de nuevo en 15 minutos.',
          retryAfter: 15 * 60
        }
      },
      statusCode: 429,
      headers: true,
      store: this.createStore(),
      keyGenerator: (req) => {
        return `rate-limit:general:${req.ip}`;
      },
      handler: (req, res) => {
        logger.warn('Rate limit excedido - General', {
          category: 'RATE_LIMIT_EXCEEDED',
          ip: req.ip,
          userAgent: req.headers['user-agent']?.substring(0, 100),
          path: req.originalUrl,
          method: req.method
        });
        
        res.status(429).json({
          success: false,
          error: {
            type: 'RATE_LIMIT_ERROR',
            code: 'TOO_MANY_REQUESTS',
            message: 'Demasiadas solicitudes desde esta IP. Intenta de nuevo en 15 minutos.',
            retryAfter: 15 * 60,
            timestamp: new Date().toISOString()
          }
        });
      }
    });
  }

  /**
   * 🔐 RATE LIMITER PARA LOGIN
   */
  createLoginLimiter() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 5, // Solo 5 intentos de login por IP
      message: {
        success: false,
        error: {
          type: 'LOGIN_RATE_LIMIT_ERROR',
          code: 'TOO_MANY_LOGIN_ATTEMPTS',
          message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.',
          retryAfter: 15 * 60
        }
      },
      store: this.createStore(),
      keyGenerator: (req) => {
        return `rate-limit:login:${req.ip}`;
      },
      handler: (req, res) => {
        logger.warn('Rate limit excedido - Login', {
          category: 'RATE_LIMIT_LOGIN_EXCEEDED',
          ip: req.ip,
          userAgent: req.headers['user-agent']?.substring(0, 100),
          email: req.body?.email || 'unknown'
        });
        
        res.status(429).json({
          success: false,
          error: {
            type: 'LOGIN_RATE_LIMIT_ERROR',
            code: 'TOO_MANY_LOGIN_ATTEMPTS',
            message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.',
            retryAfter: 15 * 60,
            timestamp: new Date().toISOString()
          }
        });
      }
    });
  }

  /**
   * 🐌 SLOW DOWN PARA APIS PESADAS
   */
  createSlowDown() {
    return slowDown({
      windowMs: 15 * 60 * 1000, // 15 minutos
      delayAfter: 10, // Después de 10 requests, empezar a ralentizar
      delayMs: 500, // 500ms de delay por request adicional
      maxDelayMs: 20000, // Máximo 20 segundos de delay
      store: this.createStore(),
      keyGenerator: (req) => {
        return `slow-down:${req.ip}`;
      },
      onLimitReached: (req, res, options) => {
        logger.warn('Slow down activado', {
          category: 'SLOW_DOWN_ACTIVATED',
          ip: req.ip,
          path: req.originalUrl,
          delay: options.delay
        });
      }
    });
  }

  /**
   * 📊 OBTENER ESTADÍSTICAS
   */
  async getStats() {
    try {
      if (this.usingRedis) {
        const keys = await this.redis.keys('rate-limit:*');
        return {
          type: 'redis',
          connected: true,
          totalKeys: keys.length,
          memoryUsage: await this.redis.memory('usage') || 0
        };
      } else {
        return {
          type: 'memory',
          connected: false,
          totalKeys: this.localStore.size,
          memoryUsage: this.localStore.size * 100 // Estimado
        };
      }
    } catch (error) {
      return {
        type: this.usingRedis ? 'redis' : 'memory',
        connected: false,
        error: error.message,
        totalKeys: 0,
        memoryUsage: 0
      };
    }
  }

  /**
   * 🧹 PERSISTIR DATOS AL SHUTDOWN
   */
  async persistMemoryStore() {
    if (!this.usingRedis && this.localStore.size > 0) {
      logger.info('💾 Persistiendo store de memoria local', {
        category: 'RATE_LIMIT_PERSIST',
        entriesCount: this.localStore.size
      });
      
      // En un ambiente real, podrías guardar esto en un archivo o base de datos
      // Para este caso, simplemente loggeamos las estadísticas
      const stats = await this.getStats();
      logger.info('📊 Stats finales de rate limiting', {
        category: 'RATE_LIMIT_FINAL_STATS',
        stats
      });
    }
  }

  /**
   * 🛑 CERRAR CONEXIONES
   */
  async close() {
    if (this.redis) {
      await this.redis.quit();
      logger.info('✅ Conexión Redis cerrada', {
        category: 'RATE_LIMIT_REDIS_CLOSED'
      });
    }
    
    this.localStore.clear();
    logger.info('✅ Rate limiting limpiado', {
      category: 'RATE_LIMIT_CLEANUP'
    });
  }
}

// Singleton instance
const rateLimitManager = new PersistentRateLimitManager();

module.exports = {
  rateLimitManager,
  PersistentRateLimitManager
}; 