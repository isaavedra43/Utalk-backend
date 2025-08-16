/**
 * 🛡️ RATE LIMITING PARA ENDPOINTS DE IA
 * 
 * Rate limiting específico para endpoints de IA con límites por workspace
 * y diferenciación entre endpoints de consola y QA.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Rate limiter para endpoints de consola/config IA
 * 10 requests por minuto por workspace
 */
const consoleRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máximo 10 requests por minuto
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Usar workspaceId + userId para rate limiting
    const workspaceId = req.params.workspaceId || req.body.workspaceId || 'default_workspace';
    const userId = req.user?.email || req.ip;
    return `ai_console:${workspaceId}:${userId}`;
  },
  handler: (req, res) => {
    const workspaceId = req.params.workspaceId || req.body.workspaceId || 'default_workspace';
    const userId = req.user?.email || req.ip;
    const now = Date.now();
    const retryAfter = 60;
    const resetEpoch = Math.ceil((now + 60000) / 1000);

    logger.warn('🚫 Rate limit excedido en consola IA', {
      workspaceId,
      userEmail: req.user?.email,
      ip: req.ip,
      url: req.originalUrl
    });

    res.set({
      'Retry-After': String(retryAfter),
      'X-RateLimit-Limit': '10',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(resetEpoch)
    });
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      details: { scope: 'ai_console', workspaceId, windowMs: 60000, limit: 10 },
      retryAfter
    });
  }
});

/**
 * Rate limiter para endpoints QA de IA
 * 10 requests por minuto por workspace
 */
const qaRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máximo 10 requests por minuto
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Usar workspaceId + userId para rate limiting
    const workspaceId = req.body.workspaceId || 'default_workspace';
    const userId = req.user?.email || req.ip;
    return `ai_qa:${workspaceId}:${userId}`;
  },
  handler: (req, res) => {
    const workspaceId = req.body.workspaceId || 'default_workspace';
    const now = Date.now();
    const retryAfter = 60;
    const resetEpoch = Math.ceil((now + 60000) / 1000);

    logger.warn('🚫 Rate limit excedido en QA IA', {
      workspaceId,
      userEmail: req.user?.email,
      ip: req.ip,
      url: req.originalUrl
    });

    res.set({
      'Retry-After': String(retryAfter),
      'X-RateLimit-Limit': '10',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(resetEpoch)
    });
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      details: { scope: 'ai_qa', workspaceId, windowMs: 60000, limit: 10 },
      retryAfter
    });
  }
});

/**
 * Rate limiter para validación de configuración
 * 5 requests por minuto por usuario
 */
const validationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // máximo 5 requests por minuto
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Usar userId para rate limiting
    const userId = req.user?.email || req.ip;
    return `ai_validation:${userId}`;
  },
  handler: (req, res) => {
    const userId = req.user?.email || req.ip;
    const now = Date.now();
    const retryAfter = 60;
    const resetEpoch = Math.ceil((now + 60000) / 1000);

    logger.warn('🚫 Rate limit excedido en validación IA', {
      userEmail: req.user?.email,
      ip: req.ip,
      url: req.originalUrl
    });

    res.set({
      'Retry-After': String(retryAfter),
      'X-RateLimit-Limit': '5',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(resetEpoch)
    });
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      details: { scope: 'ai_validation', userId, windowMs: 60000, limit: 5 },
      retryAfter
    });
  }
});

module.exports = {
  consoleRateLimiter,
  qaRateLimiter,
  validationRateLimiter
}; 