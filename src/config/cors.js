/**
 * 🔒 CONFIGURACIÓN CORS SEGURA Y DINÁMICA
 * 
 * Configuración centralizada para Cross-Origin Resource Sharing (CORS)
 * que maneja diferentes entornos de manera segura sin wildcards problemáticos.
 * 
 * @version 2.0.0 - Función de validación + regex
 */

const { URL } = require('node:url');
const logger = require('../utils/logger');

// Lista estática desde variables y dominios propios
const FRONTEND_ENV = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(s => s && s.trim())
  .filter(Boolean);

const STATIC_WHITELIST = [
  ...FRONTEND_ENV,                 // e.g. https://utalk-frontend-glt2-git-main-...vercel.app, https://utalk-frontend-glt2.vercel.app
  process.env.FRONTEND_URL_2,
  process.env.FRONTEND_URL_3,
  'http://localhost:5173',
  // 🔧 CORRECCIÓN: Agregar dominio del backend para peticiones internas
  'https://utalk-backend-production.up.railway.app',
  'http://utalk-backend-production.up.railway.app'
].filter(Boolean);

// Patrones permitidos (subdominios dinámicos) — minimizar a lo necesario
const REGEX_WHITELIST = [
];

/**
 * 🛡️ VALIDAR ORIGEN CON FUNCIÓN — HTTP (Express)
 */
function isOriginAllowed(origin) {
  // Para HTTP no aceptamos Origin undefined (salvo rutas especiales que se configuran aparte)
  if (!origin) return false;
  try {
    const u = new URL(origin);
    const allowedStatic = STATIC_WHITELIST.includes(u.origin);
    logger.debug('CORS check', {
      category: 'CORS_CHECK',
      origin,
      hostname: u.hostname,
      allowed: allowedStatic
    });
    if (allowedStatic) {
      logger.info('✅ CORS permitido (estático)', { category: 'CORS_ALLOWED', origin, type: 'static' });
      return true;
    }
    // Patrones opcionales (actualmente vacíos)
    const isRegexMatch = REGEX_WHITELIST.some((re) => re.test(u.hostname));
    if (isRegexMatch) {
      logger.info('✅ CORS permitido (regex)', { category: 'CORS_ALLOWED', origin, hostname: u.hostname, type: 'regex' });
      return true;
    }
    logger.warn('🚫 CORS bloqueado - Origin no permitido', {
      category: 'CORS_BLOCKED', origin, hostname: u.hostname, staticWhitelist: STATIC_WHITELIST
    });
    return false;
  } catch (error) {
    logger.warn('🚫 CORS bloqueado - Origin inválido', { category: 'CORS_INVALID', origin, error: error.message });
    return false;
  }
}

/**
 * 🔧 OPCIONES DE CORS PARA EXPRESS
 */
const corsOptions = {
  origin(origin, cb) {
    // Solo log si hay un origen real (no undefined)
    if (origin) {
      logger.info('🌐 CORS Origin Check:', { category: '_CORS_ORIGIN_CHECK_', data: origin });
      if (isOriginAllowed(origin)) {
        logger.info('CORS Origin Allowed:', { category: 'CORS_ORIGIN_ALLOWED_', data: origin });
        return cb(null, true);
      }
      logger.error('CORS Origin Blocked:', { category: 'CORS_ORIGIN_BLOCKED_', data: origin });
      return cb(null, false);
    }
    // Para origins undefined (health checks, etc.) - permitir silenciosamente
    return cb(null, true);
  },
  credentials: false, // no cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Authorization',
    'Content-Type',
    'X-Request-Id'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400,
  failOnError: false
};

/**
 * 🔧 OPCIONES DE CORS PARA SOCKET.IO — CORREGIDO PARA ORIGIN UNDEFINED
 */
const socketCorsOptions = {
  origin(origin, cb) {
    logger.info('🔌 Socket CORS Origin Check:', { category: '_SOCKET_CORS_ORIGIN_CHECK_', data: origin });
    
    // 🔧 CORRECCIÓN: Manejar origin undefined de manera más robusta
    if (!origin || origin === 'undefined' || origin === 'null') {
      logger.info('Socket CORS Origin Allowed (undefined/null)', { category: 'SOCKET_CORS_ORIGIN_ALLOWED_UND' });
      logger.info('Socket CORS: Origin undefined permitido', {
        category: 'SOCKET_CORS_ALLOWED',
        origin: origin || 'undefined',
        reason: 'websocket_handshake'
      });
      return cb(null, true);
    }
    
    // Validar origen si está presente
    if (isOriginAllowed(origin)) {
      logger.info('Socket CORS Origin Allowed:', { category: 'SOCKET_CORS_ORIGIN_ALLOWED_', data: origin });
      logger.info('Socket CORS: Origin permitido', {
        category: 'SOCKET_CORS_ALLOWED',
        origin,
        type: 'validated'
      });
      return cb(null, true);
    }
    
    logger.error('Socket CORS Origin Blocked:', { category: 'SOCKET_CORS_ORIGIN_BLOCKED_', data: origin });
    logger.warn('Socket CORS: Origin bloqueado', {
      category: 'SOCKET_CORS_BLOCKED',
      origin,
      allowedOrigins: STATIC_WHITELIST
    });
    return cb(null, false);
  },
  credentials: true, // 🔧 CORRECCIÓN: Habilitar credenciales para WebSocket
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Authorization',
    'Content-Type',
    'X-Request-Id',
    'Origin',
    'Referer'
  ],
  transports: ['websocket', 'polling'],
  allowEIO3: true, // 🔧 CORRECCIÓN: Permitir Engine.IO v3
  allowRequest: (req, callback) => {
    // 🔧 CORRECCIÓN: Validación adicional para requests WebSocket
    const origin = req.headers.origin || req.headers.referer;
    
    if (!origin) {
      logger.debug('Socket CORS: Request sin origin permitido', {
        category: 'SOCKET_CORS_REQUEST',
        headers: Object.keys(req.headers)
      });
      return callback(null, true);
    }
    
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    
    logger.warn('Socket CORS: Request bloqueado', {
      category: 'SOCKET_CORS_REQUEST_BLOCKED',
      origin,
      headers: req.headers
    });
    return callback(null, false);
  }
};

module.exports = { 
  corsOptions, 
  socketCorsOptions,
  isOriginAllowed, 
  STATIC_WHITELIST, 
  REGEX_WHITELIST 
}; 