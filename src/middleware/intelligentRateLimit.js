/**
 * 🛡️ INTELLIGENT RATE LIMITING MIDDLEWARE
 * 
 * Rate limiting inteligente que adapta los límites según el tipo de usuario
 * y reduce las llamadas excesivas que causan rate limit
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const logger = require('../utils/logger');
const { cacheService } = require('../services/CacheService');
const { logMonitor } = require('../services/LogMonitorService');

// Configuración de rate limits por tipo de usuario
const RATE_LIMIT_CONFIG = {
  // Límites por minuto
  admin: {
    requestsPerMinute: 1000,
    burstLimit: 50
  },
  agent: {
    requestsPerMinute: 500,
    burstLimit: 25
  },
  viewer: {
    requestsPerMinute: 200,
    burstLimit: 10
  },
  default: {
    requestsPerMinute: 100,
    burstLimit: 5
  }
};

// Endpoints críticos con límites especiales
const CRITICAL_ENDPOINTS = {
  '/api/conversations': {
    requestsPerMinute: 300,  // Aumentado de 60 a 300 (5x más)
    burstLimit: 50           // Aumentado de 10 a 50 (5x más)
  },
  '/api/messages': {
    requestsPerMinute: 120,
    burstLimit: 20
  },
  '/api/auth': {
    requestsPerMinute: 30,
    burstLimit: 5
  }
};

class IntelligentRateLimiter {
  constructor() {
    this.requestCounts = new Map(); // userId -> { count, resetTime }
    this.burstCounts = new Map();   // userId -> { count, resetTime }
    
    // Limpiar contadores expirados cada minuto
    setInterval(() => {
      this.cleanupExpiredCounters();
    }, 60 * 1000);
  }

  /**
   * 🔧 GET USER RATE LIMIT CONFIG
   */
  getUserRateLimit(user) {
    if (!user || !user.role) {
      return RATE_LIMIT_CONFIG.default;
    }
    
    return RATE_LIMIT_CONFIG[user.role] || RATE_LIMIT_CONFIG.default;
  }

  /**
   * 🔧 GET ENDPOINT RATE LIMIT CONFIG
   */
  getEndpointRateLimit(path) {
    for (const [endpoint, config] of Object.entries(CRITICAL_ENDPOINTS)) {
      if (path.startsWith(endpoint)) {
        return config;
      }
    }
    return null;
  }

  /**
   * 🔧 CHECK RATE LIMIT
   */
  checkRateLimit(userId, path) {
    const now = Date.now();
    const minuteKey = Math.floor(now / 60000); // Clave por minuto
    
    // Obtener configuración de rate limit
    const userConfig = this.getUserRateLimit({ role: 'agent' }); // Por defecto agent
    const endpointConfig = this.getEndpointRateLimit(path);
    
    // Usar el límite más restrictivo
    const effectiveConfig = endpointConfig || userConfig;
    const windowMs = 60000; // Ventana de 1 minuto
    
    // Verificar límite por minuto
    const minuteKeyStr = `${userId}:${minuteKey}`;
    let minuteCount = this.requestCounts.get(minuteKeyStr) || { count: 0, resetTime: now + windowMs };
    
    if (now > minuteCount.resetTime) {
      minuteCount = { count: 0, resetTime: now + windowMs };
    }
    
    if (minuteCount.count >= effectiveConfig.requestsPerMinute) {
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        limit: effectiveConfig.requestsPerMinute,
        resetTime: minuteCount.resetTime,
        windowMs
      };
    }
    
    // Verificar límite de burst (por segundo)
    const secondKey = Math.floor(now / 1000);
    const burstKeyStr = `${userId}:${secondKey}`;
    let burstCount = this.burstCounts.get(burstKeyStr) || { count: 0, resetTime: now + 1000 };
    
    if (now > burstCount.resetTime) {
      burstCount = { count: 0, resetTime: now + 1000 };
    }
    
    if (burstCount.count >= effectiveConfig.burstLimit) {
      return {
        allowed: false,
        reason: 'burst_limit_exceeded',
        limit: effectiveConfig.burstLimit,
        resetTime: burstCount.resetTime,
        windowMs: 1000
      };
    }
    
    // Incrementar contadores
    minuteCount.count++;
    burstCount.count++;
    
    this.requestCounts.set(minuteKeyStr, minuteCount);
    this.burstCounts.set(burstKeyStr, burstCount);
    
    return {
      allowed: true,
      remaining: effectiveConfig.requestsPerMinute - minuteCount.count,
      burstRemaining: effectiveConfig.burstLimit - burstCount.count,
      limit: effectiveConfig.requestsPerMinute,
      resetTime: minuteCount.resetTime,
      windowMs
    };
  }

  /**
   * 🧹 CLEANUP EXPIRED COUNTERS
   */
  cleanupExpiredCounters() {
    const now = Date.now();
    let cleanedMinute = 0;
    let cleanedBurst = 0;
    
    // Limpiar contadores de minuto expirados
    for (const [key, value] of this.requestCounts.entries()) {
      if (now > value.resetTime) {
        this.requestCounts.delete(key);
        cleanedMinute++;
      }
    }
    
    // Limpiar contadores de burst expirados
    for (const [key, value] of this.burstCounts.entries()) {
      if (now > value.resetTime) {
        this.burstCounts.delete(key);
        cleanedBurst++;
      }
    }
    
    if (cleanedMinute > 0 || cleanedBurst > 0) {
      logger.debug('Rate limit counters cleanup', {
        category: 'RATE_LIMIT_CLEANUP',
        cleanedMinute,
        cleanedBurst,
        remainingMinute: this.requestCounts.size,
        remainingBurst: this.burstCounts.size
      });
    }
  }
}

// Singleton instance
const rateLimiter = new IntelligentRateLimiter();

/**
 * 🛡️ MIDDLEWARE DE RATE LIMITING INTELIGENTE
 */
function intelligentRateLimit(req, res, next) {
  try {
    const path = req.path || req.originalUrl || '';

    // Exclusiones: login/refresh, socket handshake y health
    if (
      path.startsWith('/socket.io') ||
      path.startsWith('/health') ||
      path.includes('/auth/login') ||
      path.includes('/auth/refresh') ||
      path.includes('/api/auth/login') ||
      path.includes('/api/auth/refresh')
    ) {
      return next();
    }

    const userId = req.user?.email || req.ip;
    
    // Verificar rate limit
    const rateLimitResult = rateLimiter.checkRateLimit(userId, path);
    
    if (!rateLimitResult.allowed) {
      const now = Date.now();
      const retryAfterSec = Math.max(1, Math.ceil((rateLimitResult.resetTime - now) / 1000));
      const resetEpoch = Math.ceil(rateLimitResult.resetTime / 1000);

      // Logs
              req.logger.warn('RATE_LIMIT_EXCEEDED', {
          category: 'RATE_LIMIT',
          user: req.user?.email || 'anonymous',
          path,
          reason: rateLimitResult.reason,
          limit: rateLimitResult.limit,
          ip: req.ip
        });
      logMonitor.addLog('error', 'RATE_LIMIT', `Rate limit exceeded: ${rateLimitResult.reason}`, {
        userId: req.user?.email || 'anonymous',
        ip: req.ip,
        endpoint: path,
        reason: rateLimitResult.reason,
        limit: rateLimitResult.limit,
        userAgent: req.headers['user-agent']
      });
      logger.warn('Rate limit exceeded', {
        category: 'RATE_LIMIT_EXCEEDED',
        userId: req.user?.email || 'anonymous',
        ip: req.ip,
        path,
        reason: rateLimitResult.reason,
        limit: rateLimitResult.limit,
        resetTimeISO: new Date(rateLimitResult.resetTime).toISOString()
      });

      // Headers estándar
      res.set({
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(resetEpoch)
      });
      
      return res.status(429).json({
        code: 'RATE_LIMITED',
        message: 'Too many requests',
        details: { limit: rateLimitResult.limit, windowMs: rateLimitResult.windowMs || 60000 },
        retryAfter: retryAfterSec
      });
    }
    
    // Agregar headers de rate limit (cuando permitido)
    const resetEpoch = Math.ceil((rateLimitResult.resetTime || (Date.now() + 60000)) / 1000);
    res.set({
      'X-RateLimit-Limit': String(rateLimitResult.limit || 'unknown'),
      'X-RateLimit-Remaining': String(rateLimitResult.remaining ?? 'unknown'),
      'X-RateLimit-Reset': String(resetEpoch)
    });
    
    if (typeof rateLimitResult.remaining === 'number' && rateLimitResult.remaining < 5) {
              req.logger.info('RATE_LIMIT_WARNING', {
          category: 'RATE_LIMIT',
          user: req.user?.email || 'anonymous',
          path,
          remaining: rateLimitResult.remaining,
          limit: rateLimitResult.limit,
          ip: req.ip
        });
      logMonitor.addLog('warn', 'RATE_LIMIT', `Rate limit warning: ${rateLimitResult.remaining} remaining`, {
        userId: req.user?.email || 'anonymous',
        ip: req.ip,
        endpoint: path,
        remaining: rateLimitResult.remaining,
        limit: rateLimitResult.limit,
        userAgent: req.headers['user-agent']
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error en rate limiting', {
      category: 'RATE_LIMIT_ERROR',
      error: error.message,
      userId: req.user?.email || 'anonymous',
      path: req.path
    });
    next();
  }
}

/**
 * 🔧 MIDDLEWARE DE CACHE PARA REDUCIR LLAMADAS
 */
function cacheMiddleware(ttlSeconds = 300) {
  return (req, res, next) => {
    // Solo cachear GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Generar clave de cache
    const cacheKey = `api:${req.method}:${req.path}:${JSON.stringify(req.query)}:${req.user?.email || 'anonymous'}`;
    
    // Intentar obtener del cache
    const cachedResponse = cacheService.get(cacheKey);
    
    if (cachedResponse) {
      // 🔧 LOG PARA RAILWAY: Cache hit
              req.logger.debug('CACHE_HIT', {
          category: 'RATE_LIMIT_CACHE',
          path: req.path,
          user: req.user?.email || 'anonymous',
          ip: req.ip
        });
      
      // 🔧 CAPTURAR EN LOG MONITOR
      logMonitor.addLog('info', 'CACHE', `Cache hit: ${req.path}`, {
        userId: req.user?.email || 'anonymous',
        ip: req.ip,
        endpoint: req.path,
        userAgent: req.headers['user-agent']
      });
      
      logger.debug('API response from cache', {
        category: 'API_CACHE_HIT',
        path: req.path,
        cacheKey: cacheKey.substring(0, 50) + '...'
      });
      
      return res.json(cachedResponse);
    }
    
    // Interceptar la respuesta para cachearla
    const originalJson = res.json;
    res.json = function(data) {
      // Cachear respuesta exitosa
      if (res.statusCode === 200) {
        cacheService.set(cacheKey, data, ttlSeconds);
        
        // 🔧 LOG PARA RAILWAY: Cache miss y set
        req.logger.debug('CACHE_MISS', {
          category: 'RATE_LIMIT_CACHE',
          path: req.path,
          user: req.user?.email || 'anonymous',
          ttlSeconds,
          ip: req.ip
        });
        
        // 🔧 CAPTURAR EN LOG MONITOR
        logMonitor.addLog('info', 'CACHE', `Cache miss: ${req.path}`, {
          userId: req.user?.email || 'anonymous',
          ip: req.ip,
          endpoint: req.path,
          ttlSeconds,
          userAgent: req.headers['user-agent']
        });
        
        logger.debug('API response cached', {
          category: 'API_CACHE_SET',
          path: req.path,
          cacheKey: cacheKey.substring(0, 50) + '...',
          ttlSeconds
        });
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
}

module.exports = {
  intelligentRateLimit,
  cacheMiddleware,
  rateLimiter
}; 