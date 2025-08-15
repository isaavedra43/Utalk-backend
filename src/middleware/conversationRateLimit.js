/**
 * 🛡️ RATE LIMITING INTELIGENTE PARA CONVERSACIONES
 * 
 * Rate limiting específico para operaciones de conversación con:
 * - Límites diferenciados por tipo de usuario (admin, agent, viewer)
 * - Rate limiting por usuario en lugar de global
 * - Límites más permisivos para operaciones normales
 * - Manejo inteligente de errores para evitar cascadas
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Configuración de límites por tipo de usuario
 */
const USER_RATE_LIMITS = {
  admin: {
    syncState: { windowMs: 60 * 1000, max: 30 },      // 30 sync por minuto
    joinLeave: { windowMs: 60 * 1000, max: 60 },      // 60 join/leave por minuto
    messages: { windowMs: 60 * 1000, max: 200 },      // 200 mensajes por minuto
    general: { windowMs: 15 * 60 * 1000, max: 1000 }  // 1000 requests por 15 min
  },
  agent: {
    syncState: { windowMs: 60 * 1000, max: 20 },      // 20 sync por minuto
    joinLeave: { windowMs: 60 * 1000, max: 40 },      // 40 join/leave por minuto
    messages: { windowMs: 60 * 1000, max: 150 },      // 150 mensajes por minuto
    general: { windowMs: 15 * 60 * 1000, max: 800 }   // 800 requests por 15 min
  },
  viewer: {
    syncState: { windowMs: 60 * 1000, max: 10 },      // 10 sync por minuto
    joinLeave: { windowMs: 60 * 1000, max: 20 },      // 20 join/leave por minuto
    messages: { windowMs: 60 * 1000, max: 50 },       // 50 mensajes por minuto
    general: { windowMs: 15 * 60 * 1000, max: 500 }   // 500 requests por 15 min
  },
  default: {
    syncState: { windowMs: 60 * 1000, max: 15 },      // 15 sync por minuto
    joinLeave: { windowMs: 60 * 1000, max: 30 },      // 30 join/leave por minuto
    messages: { windowMs: 60 * 1000, max: 100 },      // 100 mensajes por minuto
    general: { windowMs: 15 * 60 * 1000, max: 600 }   // 600 requests por 15 min
  }
};

/**
 * Obtener límites para un usuario específico
 */
function getUserLimits(userRole) {
  return USER_RATE_LIMITS[userRole] || USER_RATE_LIMITS.default;
}

/**
 * Rate limiter para sincronización de estado (sync-state)
 * Límites más permisivos para evitar el problema actual
 */
const syncStateRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: (req) => {
    const userRole = req.user?.role || 'default';
    const limits = getUserLimits(userRole);
    return limits.syncState.max;
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userEmail = req.user?.email || req.ip;
    return `sync_state:${userEmail}`;
  },
  handler: (req, res) => {
    const userEmail = req.user?.email || req.ip;
    const userRole = req.user?.role || 'default';
    const now = Date.now();
    const retryAfter = 60; // por windowMs
    const resetEpoch = Math.ceil((now + 60000) / 1000);
    
    logger.warn('Rate limit excedido para sync-state', {
      category: 'RATE_LIMIT_SYNC_STATE',
      userEmail: String(userEmail).substring(0, 20) + '...',
      userRole,
      ip: req.ip,
      url: req.originalUrl,
      userAgent: req.headers['user-agent']?.substring(0, 100)
    });

    res.set({
      'Retry-After': String(retryAfter),
      'X-RateLimit-Limit': String(getUserLimits(userRole).syncState.max),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(resetEpoch)
    });

    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      details: { limit: getUserLimits(userRole).syncState.max, windowMs: 60000 },
      retryAfter
    });
  }
});

/**
 * Rate limiter para operaciones join/leave de conversaciones
 * Límites más permisivos para navegación normal
 */
const conversationJoinLeaveRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: (req) => {
    const userRole = req.user?.role || 'default';
    const limits = getUserLimits(userRole);
    return limits.joinLeave.max;
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userEmail = req.user?.email || req.ip;
    return `conversation_join_leave:${userEmail}`;
  },
  handler: (req, res) => {
    const userEmail = req.user?.email || req.ip;
    const userRole = req.user?.role || 'default';
    const now = Date.now();
    const retryAfter = 60;
    const resetEpoch = Math.ceil((now + 60000) / 1000);
    
    logger.warn('Rate limit excedido para join/leave conversación', {
      category: 'RATE_LIMIT_CONVERSATION_JOIN_LEAVE',
      userEmail: String(userEmail).substring(0, 20) + '...',
      userRole,
      ip: req.ip,
      url: req.originalUrl
    });

    res.set({
      'Retry-After': String(retryAfter),
      'X-RateLimit-Limit': String(getUserLimits(userRole).joinLeave.max),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(resetEpoch)
    });

    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      details: { limit: getUserLimits(userRole).joinLeave.max, windowMs: 60000 },
      retryAfter
    });
  }
});

/**
 * Rate limiter para mensajes
 * Límites diferenciados por tipo de usuario
 */
const messageRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: (req) => {
    const userRole = req.user?.role || 'default';
    const limits = getUserLimits(userRole);
    return limits.messages.max;
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userEmail = req.user?.email || req.ip;
    return `messages:${userEmail}`;
  },
  handler: (req, res) => {
    const userEmail = req.user?.email || req.ip;
    const userRole = req.user?.role || 'default';
    const now = Date.now();
    const retryAfter = 60;
    const resetEpoch = Math.ceil((now + 60000) / 1000);
    
    logger.warn('Rate limit excedido para mensajes', {
      category: 'RATE_LIMIT_MESSAGES',
      userEmail: String(userEmail).substring(0, 20) + '...',
      userRole,
      ip: req.ip,
      url: req.originalUrl
    });

    res.set({
      'Retry-After': String(retryAfter),
      'X-RateLimit-Limit': String(getUserLimits(userRole).messages.max),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(resetEpoch)
    });

    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      details: { limit: getUserLimits(userRole).messages.max, windowMs: 60000 },
      retryAfter
    });
  }
});

/**
 * Rate limiter general para conversaciones (más permisivo)
 */
const conversationGeneralRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: (req) => {
    const userRole = req.user?.role || 'default';
    const limits = getUserLimits(userRole);
    return limits.general.max;
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userEmail = req.user?.email || req.ip;
    return `conversation_general:${userEmail}`;
  },
  handler: (req, res) => {
    const userEmail = req.user?.email || req.ip;
    const userRole = req.user?.role || 'default';
    const now = Date.now();
    const retryAfter = 15 * 60;
    const resetEpoch = Math.ceil((now + 15 * 60 * 1000) / 1000);
    
    logger.warn('Rate limit general excedido para conversaciones', {
      category: 'RATE_LIMIT_CONVERSATION_GENERAL',
      userEmail: String(userEmail).substring(0, 20) + '...',
      userRole,
      ip: req.ip,
      url: req.originalUrl
    });

    res.set({
      'Retry-After': String(retryAfter),
      'X-RateLimit-Limit': String(getUserLimits(userRole).general.max),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(resetEpoch)
    });

    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      details: { limit: getUserLimits(userRole).general.max, windowMs: 15 * 60 * 1000 },
      retryAfter
    });
  }
});

/**
 * Middleware para aplicar rate limiting inteligente según la ruta
 */
function applyConversationRateLimiting(req, res, next) {
  const path = req.originalUrl;
  
  // Aplicar rate limiting específico según la ruta
  if (path.includes('/api/conversations') && path.includes('/sync')) {
    return syncStateRateLimiter(req, res, next);
  }
  
  if (path.includes('/api/conversations') && (path.includes('/join') || path.includes('/leave'))) {
    return conversationJoinLeaveRateLimiter(req, res, next);
  }
  
  if (path.includes('/api/messages')) {
    return messageRateLimiter(req, res, next);
  }
  
  // Rate limiting general para otras rutas de conversación
  if (path.includes('/api/conversations')) {
    return conversationGeneralRateLimiter(req, res, next);
  }
  
  // Si no coincide con ninguna ruta específica, continuar
  next();
}

module.exports = {
  syncStateRateLimiter,
  conversationJoinLeaveRateLimiter,
  messageRateLimiter,
  conversationGeneralRateLimiter,
  applyConversationRateLimiting,
  getUserLimits
}; 