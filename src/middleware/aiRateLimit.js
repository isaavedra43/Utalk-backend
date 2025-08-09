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
  message: {
    error: 'Rate limit excedido',
    message: 'Demasiadas solicitudes de configuración IA. Intenta de nuevo en 1 minuto.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Usar workspaceId + userId para rate limiting
    const workspaceId = req.params.workspaceId || req.body.workspaceId || 'default';
    const userId = req.user?.email || req.ip;
    return `ai_console:${workspaceId}:${userId}`;
  },
  handler: (req, res) => {
    logger.warn('🚫 Rate limit excedido en consola IA', {
      workspaceId: req.params.workspaceId || req.body.workspaceId,
      userEmail: req.user?.email,
      ip: req.ip,
      url: req.originalUrl
    });
    res.status(429).json({
      error: 'Rate limit excedido',
      message: 'Demasiadas solicitudes de configuración IA. Intenta de nuevo en 1 minuto.',
      code: 'RATE_LIMIT_EXCEEDED'
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
  message: {
    error: 'Rate limit excedido',
    message: 'Demasiadas solicitudes QA de IA. Intenta de nuevo en 1 minuto.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Usar workspaceId + userId para rate limiting
    const workspaceId = req.body.workspaceId || 'default';
    const userId = req.user?.email || req.ip;
    return `ai_qa:${workspaceId}:${userId}`;
  },
  handler: (req, res) => {
    logger.warn('🚫 Rate limit excedido en QA IA', {
      workspaceId: req.body.workspaceId,
      userEmail: req.user?.email,
      ip: req.ip,
      url: req.originalUrl
    });
    res.status(429).json({
      error: 'Rate limit excedido',
      message: 'Demasiadas solicitudes QA de IA. Intenta de nuevo en 1 minuto.',
      code: 'RATE_LIMIT_EXCEEDED'
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
  message: {
    error: 'Rate limit excedido',
    message: 'Demasiadas validaciones de configuración. Intenta de nuevo en 1 minuto.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Usar userId para rate limiting
    const userId = req.user?.email || req.ip;
    return `ai_validation:${userId}`;
  },
  handler: (req, res) => {
    logger.warn('🚫 Rate limit excedido en validación IA', {
      userEmail: req.user?.email,
      ip: req.ip,
      url: req.originalUrl
    });
    res.status(429).json({
      error: 'Rate limit excedido',
      message: 'Demasiadas validaciones de configuración. Intenta de nuevo en 1 minuto.',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }
});

module.exports = {
  consoleRateLimiter,
  qaRateLimiter,
  validationRateLimiter
}; 