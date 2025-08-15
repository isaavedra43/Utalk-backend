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
    requestsPerMinute: 60,
    burstLimit: 10
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
    
    // Verificar límite por minuto
    const minuteKeyStr = `${userId}:${minuteKey}`;
    let minuteCount = this.requestCounts.get(minuteKeyStr) || { count: 0, resetTime: now + 60000 };
    
    if (now > minuteCount.resetTime) {
      minuteCount = { count: 0, resetTime: now + 60000 };
    }
    
    if (minuteCount.count >= effectiveConfig.requestsPerMinute) {
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        limit: effectiveConfig.requestsPerMinute,
        resetTime: minuteCount.resetTime
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
        resetTime: burstCount.resetTime
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
      burstRemaining: effectiveConfig.burstLimit - burstCount.count
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
    const userId = req.user?.email || req.ip;
    const path = req.path;
    
    // Verificar rate limit
    const rateLimitResult = rateLimiter.checkRateLimit(userId, path);
    
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded', {
        category: 'RATE_LIMIT_EXCEEDED',
        userId: req.user?.email || 'anonymous',
        ip: req.ip,
        path,
        reason: rateLimitResult.reason,
        limit: rateLimitResult.limit,
        resetTime: new Date(rateLimitResult.resetTime).toISOString()
      });
      
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        timestamp: new Date().toISOString()
      });
    }
    
    // Agregar headers de rate limit
    res.set({
      'X-RateLimit-Limit': rateLimitResult.limit || 'unknown',
      'X-RateLimit-Remaining': rateLimitResult.remaining || 'unknown',
      'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
    });
    
    next();
  } catch (error) {
    logger.error('Error en rate limiting', {
      category: 'RATE_LIMIT_ERROR',
      error: error.message,
      userId: req.user?.email || 'anonymous',
      path: req.path
    });
    
    // En caso de error, permitir la solicitud
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