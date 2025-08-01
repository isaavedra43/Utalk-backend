/**
 * 🚦 SISTEMA DE RATE LIMITING PERSISTENTE, CONFIGURABLE Y ADAPTATIVO
 * 
 * Implementa rate limiting robusto que persiste entre reinicios del servidor
 * usando Redis como store principal y fallback a memoria con persistencia en archivo.
 * 
 * CARACTERÍSTICAS:
 * - Persistencia entre reinicios
 * - Configuración granular por endpoint/usuario/IP
 * - Múltiples algoritmos (sliding window, token bucket)
 * - Logging detallado de intentos de abuso
 * - Escalable horizontalmente
 * - LÍMITES ADAPTATIVOS según carga del sistema
 * - FALLBACK ROBUSTO de Redis a memoria
 * 
 * @version 2.0.0 ADAPTATIVO
 * @author Security Team
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const os = require('os');

class PersistentRateLimit {
  constructor() {
    this.redisClient = null;
    this.memoryStore = new Map();
    this.persistenceFile = path.join(process.cwd(), 'temp', 'rate-limits.json');
    this.initialized = false;
    
    // Inicializar funcionalidades adaptativas
    this.initializeAdaptiveFeatures();
    
    // Configuraciones por defecto para diferentes tipos de endpoints
    this.configs = {
      // 🔐 WEBHOOKS: Muy restrictivo para prevenir abuse
      webhook: {
        windowMs: 1 * 60 * 1000, // 1 minuto
        max: (req) => this.getAdaptiveMax(30), // 30 requests por minuto por IP (adaptativo)
        message: {
          error: 'Webhook rate limit exceeded',
          code: 'WEBHOOK_RATE_LIMIT',
          retryAfter: '60 seconds'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => `webhook:${req.ip}`,
        skipSuccessfulRequests: false,
        skipFailedRequests: false
      },

      // 🔐 LOGIN: Muy restrictivo para prevenir brute force
      login: {
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: (req) => this.getAdaptiveMax(5), // 5 intentos por IP en 15 minutos (adaptativo)
        message: {
          error: 'Too many login attempts',
          code: 'LOGIN_RATE_LIMIT',
          retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => `login:${req.ip}:${req.body?.email || 'unknown'}`,
        skipSuccessfulRequests: true, // No contar logins exitosos
        skipFailedRequests: false
      },

      // 💬 MESSAGES: Moderadamente restrictivo
      messages: {
        windowMs: 1 * 60 * 1000, // 1 minuto
        max: (req) => {
          // Rate limit dinámico basado en rol de usuario + adaptativo
          let baseLimit;
          if (req.user?.role === 'admin') baseLimit = 100;
          else if (req.user?.role === 'agent') baseLimit = 60;
          else baseLimit = 30; // usuarios básicos
          
          return this.getAdaptiveMax(baseLimit);
        },
        message: {
          error: 'Message rate limit exceeded',
          code: 'MESSAGE_RATE_LIMIT',
          retryAfter: '1 minute'
        },
        keyGenerator: (req) => `messages:${req.user?.id || req.ip}`,
        skipSuccessfulRequests: false,
        skipFailedRequests: true
      },

      // 📝 CONVERSATIONS: Restrictivo para crear/modificar
      conversations: {
        windowMs: 5 * 60 * 1000, // 5 minutos
        max: (req) => this.getAdaptiveMax(20), // 20 operaciones por usuario en 5 minutos (adaptativo)
        message: {
          error: 'Conversation operations rate limit exceeded',
          code: 'CONVERSATION_RATE_LIMIT',
          retryAfter: '5 minutes'
        },
        keyGenerator: (req) => `conversations:${req.user?.id || req.ip}`,
        skipSuccessfulRequests: false,
        skipFailedRequests: true
      },

      // 📁 MEDIA: Muy restrictivo para uploads
      media: {
        windowMs: 10 * 60 * 1000, // 10 minutos
        max: (req) => this.getAdaptiveMax(10), // 10 uploads por usuario en 10 minutos (adaptativo)
        message: {
          error: 'Media upload rate limit exceeded',
          code: 'MEDIA_RATE_LIMIT',
          retryAfter: '10 minutes'
        },
        keyGenerator: (req) => `media:${req.user?.id || req.ip}`,
        skipSuccessfulRequests: false,
        skipFailedRequests: true
      },

      // 🌐 GENERAL: Rate limit global por defecto
      general: {
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: (req) => this.getAdaptiveMax(1000), // 1000 requests por IP en 15 minutos (adaptativo)
        message: {
          error: 'Too many requests',
          code: 'GENERAL_RATE_LIMIT',
          retryAfter: '15 minutes'
        },
        keyGenerator: (req) => `general:${req.ip}`,
        skipSuccessfulRequests: false,
        skipFailedRequests: false
      }
    };
  }

  /**
   * 🚀 INICIALIZAR FUNCIONALIDADES ADAPTATIVAS
   */
  initializeAdaptiveFeatures() {
    // Configurar monitoreo de carga del sistema
    this.startLoadMonitoring();
    
    logger.info('🔄 Funcionalidades adaptativas inicializadas', {
      systemLoad: this.getSystemLoad(),
      adaptiveLimits: this.getAdaptiveLimitsInfo()
    });
  }

  /**
   * 📊 OBTENER CARGA DEL SISTEMA
   */
  getSystemLoad() {
    return os.loadavg()[0]; // carga promedio del último minuto
  }

  /**
   * 🔧 CALCULAR LÍMITE MÁXIMO ADAPTATIVO
   */
  getAdaptiveMax(baseMax) {
    const load = this.getSystemLoad();
    
    // Si la carga promedio supera 2.0, reduce el límite a la mitad
    if (load > 2.0) {
      const reducedMax = Math.floor(baseMax * 0.5);
      logger.warn('🔄 Reduciendo rate limit por alta carga del sistema', {
        originalMax: baseMax,
        reducedMax,
        systemLoad: load,
        reason: 'Carga del sistema > 2.0'
      });
      return reducedMax;
    }
    
    // Si la carga es moderada (1.0-2.0), reduce ligeramente
    if (load > 1.0) {
      const reducedMax = Math.floor(baseMax * 0.8);
      logger.info('🔄 Ajustando rate limit por carga moderada', {
        originalMax: baseMax,
        reducedMax,
        systemLoad: load
      });
      return reducedMax;
    }
    
    // Carga normal, usar límite base
    return baseMax;
  }

  /**
   * 📈 INICIAR MONITOREO DE CARGA DEL SISTEMA
   */
  startLoadMonitoring() {
    // Monitorear carga cada 30 segundos
    setInterval(() => {
      const load = this.getSystemLoad();
      
      if (load > 2.0) {
        logger.warn('⚠️ Alta carga del sistema detectada', {
          load,
          impact: 'Rate limits reducidos automáticamente',
          recommendation: 'Considerar escalar recursos'
        });
      } else if (load > 1.0) {
        logger.info('📊 Carga moderada del sistema', {
          load,
          impact: 'Rate limits ligeramente reducidos'
        });
      }
    }, 30000);
  }

  /**
   * 📊 OBTENER INFORMACIÓN DE LÍMITES ADAPTATIVOS
   */
  getAdaptiveLimitsInfo() {
    const load = this.getSystemLoad();
    const baseLimits = {
      webhook: 30,
      login: 5,
      messages: 60,
      conversations: 20,
      media: 10,
      general: 1000
    };
    
    const adaptiveLimits = {};
    
    for (const [type, baseMax] of Object.entries(baseLimits)) {
      adaptiveLimits[type] = {
        baseMax,
        adaptiveMax: this.getAdaptiveMax(baseMax),
        systemLoad: load,
        reduction: baseMax - this.getAdaptiveMax(baseMax)
      };
    }
    
    return {
      systemLoad: load,
      adaptiveLimits,
      recommendations: this.getLoadRecommendations(load)
    };
  }

  /**
   * 💡 OBTENER RECOMENDACIONES BASADAS EN CARGA
   */
  getLoadRecommendations(load) {
    if (load > 3.0) {
      return ['CRÍTICO: Considerar escalar inmediatamente', 'Revisar procesos background'];
    } else if (load > 2.0) {
      return ['ALTO: Monitorear tendencia', 'Considerar optimizaciones'];
    } else if (load > 1.0) {
      return ['MODERADO: Sistema funcionando normalmente'];
    } else {
      return ['NORMAL: Sistema con buena capacidad'];
    }
  }

  /**
   * 🚀 INICIALIZAR SISTEMA DE RATE LIMITING
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // 1. INTENTAR CONECTAR A REDIS
      await this.initializeRedis();
      
      // 2. SI REDIS FALLA, USAR MEMORIA PERSISTENTE
      if (!this.redisClient) {
        await this.initializeMemoryStore();
      }
      
      // 3. CONFIGURAR LIMPIEZA AUTOMÁTICA
      this.setupCleanupTasks();
      
      this.initialized = true;
      
      logger.info('🚦 Sistema de Rate Limiting inicializado', {
        store: this.redisClient ? 'Redis' : 'Memory',
        configs: Object.keys(this.configs),
        persistenceFile: this.persistenceFile
      });

    } catch (error) {
      logger.error('Error inicializando Rate Limiting', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 🔴 INICIALIZAR REDIS
   */
  async initializeRedis() {
    try {
      const redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL;
      
      if (!redisUrl) {
        logger.warn('Redis URL no configurada, usando memoria persistente');
        return;
      }

      this.redisClient = redis.createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000,
          commandTimeout: 3000,
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              logger.error('Redis: Máximo número de reintentos alcanzado');
              return false;
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.redisClient.on('error', (err) => {
        logger.error('Redis error:', err);
        this.redisClient = null; // Fallback a memoria
      });

      await this.redisClient.connect();
      
      // Test de conexión
      await this.redisClient.ping();
      
      logger.info('✅ Redis conectado exitosamente para Rate Limiting');

    } catch (error) {
      logger.warn('No se pudo conectar a Redis, usando memoria persistente', {
        error: error.message
      });
      this.redisClient = null;
    }
  }

  /**
   * 💾 INICIALIZAR STORE DE MEMORIA PERSISTENTE
   */
  async initializeMemoryStore() {
    try {
      // Crear directorio temp si no existe
      await fs.mkdir(path.dirname(this.persistenceFile), { recursive: true });
      
      // Cargar datos persistidos
      try {
        const data = await fs.readFile(this.persistenceFile, 'utf8');
        const savedLimits = JSON.parse(data);
        
        // Restaurar límites que no hayan expirado
        const now = Date.now();
        for (const [key, value] of Object.entries(savedLimits)) {
          if (value.expiresAt > now) {
            this.memoryStore.set(key, value);
          }
        }
        
        logger.info('📁 Rate limits restaurados desde archivo', {
          file: this.persistenceFile,
          restored: this.memoryStore.size
        });
        
      } catch (fileError) {
        // Archivo no existe o está corrupto, continuar sin datos
        logger.info('📁 Iniciando con store de memoria limpio');
      }

    } catch (error) {
      logger.error('Error inicializando memoria persistente', {
        error: error.message,
        file: this.persistenceFile
      });
    }
  }

  /**
   * 🧹 CONFIGURAR TAREAS DE LIMPIEZA
   */
  setupCleanupTasks() {
    // Limpiar memoria cada 5 minutos
    setInterval(() => {
      this.cleanupMemoryStore();
    }, 5 * 60 * 1000);

    // Persistir a archivo cada 2 minutos
    setInterval(() => {
      this.persistMemoryStore();
    }, 2 * 60 * 1000);

    // Persistir al cerrar la aplicación
    process.on('SIGINT', () => this.persistMemoryStore());
    process.on('SIGTERM', () => this.persistMemoryStore());
  }

  /**
   * 🧹 LIMPIAR ENTRADAS EXPIRADAS DE MEMORIA
   */
  cleanupMemoryStore() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.memoryStore.entries()) {
      if (value.expiresAt <= now) {
        this.memoryStore.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      // Log removido para reducir ruido en producción
    }
  }

  /**
   * 💾 PERSISTIR STORE DE MEMORIA A ARCHIVO
   */
  async persistMemoryStore() {
    try {
      const dataToSave = {};
      
      for (const [key, value] of this.memoryStore.entries()) {
        dataToSave[key] = value;
      }
      
      await fs.writeFile(
        this.persistenceFile, 
        JSON.stringify(dataToSave, null, 2), 
        'utf8'
      );
      
      // Log removido para reducir ruido en producción

    } catch (error) {
      logger.error('Error persistiendo rate limits', {
        error: error.message,
        file: this.persistenceFile
      });
    }
  }

  /**
   * 🏭 CREAR MIDDLEWARE DE RATE LIMITING
   */
  createLimiter(type = 'general', customConfig = {}) {
    if (!this.initialized) {
      throw new Error('Rate limiting no inicializado. Llama a initialize() primero.');
    }

    const config = {
      ...this.configs[type] || this.configs.general,
      ...customConfig
    };

    // Configurar store apropiado
    if (this.redisClient) {
      config.store = new RedisStore({
        sendCommand: (...args) => this.redisClient.sendCommand(args),
        prefix: `rate_limit:${type}:`
      });
    } else {
      // Custom memory store con persistencia
      config.store = this.createCustomMemoryStore(type);
    }

    // Handler personalizado para logging de rate limits
    const originalHandler = config.handler;
    config.handler = (req, res, next, options) => {
      const key = config.keyGenerator ? config.keyGenerator(req) : req.ip;
      
      // Log del intento de abuso
      logger.security('rate_limit_exceeded', {
        type,
        key,
        ip: req.ip,
        userAgent: req.headers['user-agent']?.substring(0, 100),
        endpoint: req.originalUrl,
        method: req.method,
        userId: req.user?.id || null,
        userRole: req.user?.role || null,
        windowMs: config.windowMs,
        maxRequests: typeof config.max === 'function' ? config.max(req) : config.max,
        timestamp: new Date().toISOString(),
        severity: type === 'login' ? 'CRITICAL' : 'HIGH'
      });

      // Ejecutar handler original o enviar respuesta por defecto
      if (originalHandler) {
        return originalHandler(req, res, next, options);
      } else {
        return res.status(429).json({
          ...config.message,
          timestamp: new Date().toISOString(),
          retryAfter: Math.ceil(config.windowMs / 1000)
        });
      }
    };

    return rateLimit(config);
  }

  /**
   * 💾 CREAR CUSTOM MEMORY STORE CON PERSISTENCIA
   */
  createCustomMemoryStore(type) {
    return {
      incr: (key, callback) => {
        const fullKey = `${type}:${key}`;
        const now = Date.now();
        
        let record = this.memoryStore.get(fullKey);
        
        if (!record || record.expiresAt <= now) {
          // Crear nuevo record
          record = {
            count: 1,
            expiresAt: now + (this.configs[type]?.windowMs || 15 * 60 * 1000)
          };
        } else {
          // Incrementar existente
          record.count++;
        }
        
        this.memoryStore.set(fullKey, record);
        
        callback(null, {
          totalHits: record.count,
          timeRemaining: Math.max(0, record.expiresAt - now)
        });
      },
      
      decrement: (key, callback) => {
        const fullKey = `${type}:${key}`;
        const record = this.memoryStore.get(fullKey);
        
        if (record && record.count > 0) {
          record.count--;
          this.memoryStore.set(fullKey, record);
        }
        
        callback(null, {
          totalHits: record?.count || 0,
          timeRemaining: record ? Math.max(0, record.expiresAt - Date.now()) : 0
        });
      },
      
      resetKey: (key, callback) => {
        const fullKey = `${type}:${key}`;
        this.memoryStore.delete(fullKey);
        callback(null);
      }
    };
  }

  /**
   * 📊 OBTENER ESTADÍSTICAS DE RATE LIMITING CON INFORMACIÓN ADAPTATIVA
   */
  async getStats() {
    const stats = {
      store: this.redisClient ? 'Redis' : 'Memory',
      memoryEntries: this.memoryStore.size,
      configurations: Object.keys(this.configs),
      initialized: this.initialized,
      adaptiveRateLimiting: this.getAdaptiveLimitsInfo(),
      systemLoad: this.getSystemLoad(),
      recommendations: this.getLoadRecommendations(this.getSystemLoad())
    };

    if (this.redisClient) {
      try {
        const info = await this.redisClient.info('memory');
        stats.redisMemoryUsage = info;
      } catch (error) {
        stats.redisError = error.message;
      }
    }

    return stats;
  }
}

// Singleton instance
const rateLimitManager = new PersistentRateLimit();

module.exports = {
  rateLimitManager,
  PersistentRateLimit
}; 