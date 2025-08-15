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
  'http://localhost:5173'
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
    console.log(`🔍 CORS Check: origin=${origin}, hostname=${u.hostname}, allowed=${allowedStatic}`);
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
    console.log('🌐 CORS Origin Check:', origin);
    if (isOriginAllowed(origin)) {
      console.log('✅ CORS Origin Allowed:', origin);
      return cb(null, true);
    }
    console.log('❌ CORS Origin Blocked:', origin);
    return cb(null, false);
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
 * 🔧 OPCIONES DE CORS PARA SOCKET.IO — permite Origin undefined (clientes WS)
 */
const socketCorsOptions = {
  origin(origin, cb) {
    console.log('🔌 Socket CORS Origin Check:', origin);
    if (!origin) {
      // Aceptar handshakes sin Origin (clientes WS/herramientas)
      console.log('✅ Socket CORS Origin Allowed (no origin)');
      return cb(null, true);
    }
    if (isOriginAllowed(origin)) {
      console.log('✅ Socket CORS Origin Allowed:', origin);
      return cb(null, true);
    }
    console.log('❌ Socket CORS Origin Blocked:', origin);
    return cb(null, false);
  },
  credentials: false, // no cookies en WS
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Authorization',
    'Content-Type',
    'X-Request-Id'
  ],
  transports: ['websocket', 'polling']
};

module.exports = { 
  corsOptions, 
  socketCorsOptions,
  isOriginAllowed, 
  STATIC_WHITELIST, 
  REGEX_WHITELIST 
}; 