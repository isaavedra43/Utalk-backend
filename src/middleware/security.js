const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { rateLimitConfig } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * Rate limiting configurado por endpoint
 */
const createRateLimit = (endpoint) => {
  const config = rateLimitConfig[endpoint] || rateLimitConfig.default;
  
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: {
      error: 'Demasiadas solicitudes',
      message: 'Has excedido el límite de solicitudes. Intenta de nuevo más tarde.',
      retryAfter: Math.ceil(config.windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Saltar rate limiting para usuarios admin en desarrollo
      if (process.env.NODE_ENV === 'development' && req.user?.role === 'admin') {
        return true;
      }
      return false;
    },
    onLimitReached: (req, res, options) => {
      logger.warn('Rate limit alcanzado', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        user: req.user?.uid,
      });
    },
  });
};

/**
 * Middleware de seguridad con Helmet
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.twilio.com", "https://firestore.googleapis.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

/**
 * Middleware para validar origen de requests
 */
const validateOrigin = (req, res, next) => {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
  const origin = req.get('Origin') || req.get('Referer');

  // Permitir requests sin origin en desarrollo
  if (process.env.NODE_ENV === 'development' && !origin) {
    return next();
  }

  // Validar origin si está configurado
  if (allowedOrigins.length > 0 && origin) {
    const isAllowed = allowedOrigins.some(allowedOrigin => 
      origin.startsWith(allowedOrigin.trim())
    );

    if (!isAllowed) {
      logger.warn('Origin no permitido', {
        origin,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return res.status(403).json({
        error: 'Origin no permitido',
        message: 'Tu solicitud no proviene de un origen autorizado',
      });
    }
  }

  next();
};

/**
 * Middleware para detectar y bloquear ataques
 */
const attackDetection = (req, res, next) => {
  const suspiciousPatterns = [
    // SQL Injection
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b.*\b(FROM|INTO|SET|WHERE|TABLE)\b)/i,
    
    // XSS básico
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/i,
    /on\w+\s*=/i,
    
    // Path traversal
    /\.\.\//g,
    /\.\.\\/g,
    
    // Command injection
    /[;&|`$(){}[\]]/,
  ];

  const requestString = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(requestString)
  );

  if (isSuspicious) {
    logger.error('Intento de ataque detectado', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      query: req.query,
      user: req.user?.uid,
    });

    return res.status(400).json({
      error: 'Solicitud no válida',
      message: 'Los datos enviados contienen patrones no permitidos',
    });
  }

  next();
};

/**
 * Middleware para logging de seguridad
 */
const securityLogger = (req, res, next) => {
  // Log de actividades sensibles
  const sensitiveEndpoints = [
    '/auth/login',
    '/team/invite',
    '/team/',
    '/campaigns/',
    '/knowledge/upload',
  ];

  const isSensitive = sensitiveEndpoints.some(endpoint => 
    req.originalUrl.includes(endpoint)
  );

  if (isSensitive) {
    logger.info('Actividad sensible', {
      action: `${req.method} ${req.originalUrl}`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      user: req.user?.uid,
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

/**
 * Middleware para validar tamaño de payload
 */
const validatePayloadSize = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    const maxBytes = typeof maxSize === 'string' 
      ? parseInt(maxSize) * 1024 * 1024 
      : maxSize;

    if (contentLength > maxBytes) {
      logger.warn('Payload demasiado grande', {
        contentLength,
        maxBytes,
        ip: req.ip,
        user: req.user?.uid,
      });

      return res.status(413).json({
        error: 'Payload demasiado grande',
        message: `El tamaño de la solicitud excede el límite de ${maxSize}`,
      });
    }

    next();
  };
};

/**
 * Middleware para verificar headers requeridos
 */
const validateRequiredHeaders = (req, res, next) => {
  const requiredHeaders = ['user-agent'];
  const missingHeaders = requiredHeaders.filter(header => 
    !req.get(header)
  );

  if (missingHeaders.length > 0) {
    logger.warn('Headers requeridos faltantes', {
      missingHeaders,
      ip: req.ip,
    });

    return res.status(400).json({
      error: 'Headers requeridos faltantes',
      message: `Headers requeridos: ${missingHeaders.join(', ')}`,
    });
  }

  next();
};

/**
 * Middleware para protección CSRF básica
 */
const csrfProtection = (req, res, next) => {
  // Solo aplicar CSRF para métodos que modifican datos
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Verificar origin/referer para requests con cookies
  if (req.get('Cookie')) {
    const origin = req.get('Origin');
    const referer = req.get('Referer');
    const host = req.get('Host');

    if (!origin && !referer) {
      logger.warn('CSRF: Missing origin/referer', {
        ip: req.ip,
        user: req.user?.uid,
        url: req.originalUrl,
      });

      return res.status(403).json({
        error: 'CSRF protection',
        message: 'Request must include valid origin or referer',
      });
    }

    // Validar que el origin/referer coincida con el host
    const originHost = origin ? new URL(origin).host : null;
    const refererHost = referer ? new URL(referer).host : null;

    if (originHost && originHost !== host) {
      logger.warn('CSRF: Origin mismatch', {
        origin,
        host,
        ip: req.ip,
        user: req.user?.uid,
      });

      return res.status(403).json({
        error: 'CSRF protection',
        message: 'Origin mismatch',
      });
    }

    if (refererHost && refererHost !== host) {
      logger.warn('CSRF: Referer mismatch', {
        referer,
        host,
        ip: req.ip,
        user: req.user?.uid,
      });

      return res.status(403).json({
        error: 'CSRF protection',
        message: 'Referer mismatch',
      });
    }
  }

  next();
};

/**
 * Aplicar rate limiting específico por endpoint
 */
const applyEndpointRateLimit = (endpoint) => {
  return createRateLimit(endpoint);
};

/**
 * Middleware de seguridad combinado
 */
const applySecurity = () => {
  return [
    securityHeaders,
    validateOrigin,
    validateRequiredHeaders,
    validatePayloadSize(),
    attackDetection,
    csrfProtection,
    securityLogger,
  ];
};

module.exports = {
  securityHeaders,
  validateOrigin,
  attackDetection,
  securityLogger,
  validatePayloadSize,
  validateRequiredHeaders,
  csrfProtection,
  createRateLimit,
  applyEndpointRateLimit,
  applySecurity,
}; 