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
const STATIC_WHITELIST = [
  process.env.FRONTEND_URL,      // ej: https://utalk-frontend.vercel.app
  process.env.FRONTEND_URL_2,    // ej: https://utalk-frontend-glt2-git-main-israels-projects-xxxx.vercel.app
  process.env.FRONTEND_URL_3,    // opcional
  'https://utalk.com',
  'https://www.utalk.com',
  'https://app.utalk.com',
  'https://admin.utalk.com',
  // ✅ CRÍTICO: Agregar el dominio específico de Vercel que está causando el problema
  'https://utalk-frontend-glt2.vercel.app',
  'https://utalk-frontend-glt2-git-main-israels-projects-8c8c.vercel.app',
  'https://utalk-frontend-glt2-git-feature-israels-projects-8c8c.vercel.app',
  // Incluye el propio backend si lo usas en pruebas
  'https://utalk-backend-production.up.railway.app',
].filter(Boolean);

// Patrones permitidos (subdominios dinámicos)
const REGEX_WHITELIST = [
  /\.vercel\.app$/i,
  /\.railway\.app$/i,
  /^localhost$/i,
  /^localhost:\d+$/i,
];

/**
 * 🛡️ VALIDAR ORIGEN CON FUNCIÓN Y REGEX
 */
function isOriginAllowed(origin) {
  if (!origin) return true; // peticiones server-to-server (curl/postman) sin Origin
  
  try {
    const u = new URL(origin);
    
    // ✅ CRÍTICO: Log para debugging CORS
    console.log('🔍 CORS Check:', {
      origin,
      hostname: u.hostname,
      staticWhitelist: STATIC_WHITELIST,
      isInStaticList: STATIC_WHITELIST.includes(u.origin)
    });
    
    // Verificar lista estática
    if (STATIC_WHITELIST.includes(u.origin)) {
      logger.info('✅ CORS permitido (estático)', {
        category: 'CORS_ALLOWED',
        origin,
        type: 'static'
      });
      return true;
    }
    
    // Verificar patrones regex
    const isRegexMatch = REGEX_WHITELIST.some((re) => re.test(u.hostname));
    if (isRegexMatch) {
      logger.info('✅ CORS permitido (regex)', {
        category: 'CORS_ALLOWED',
        origin,
        hostname: u.hostname,
        type: 'regex'
      });
      return true;
    }
    
    // Origin no permitido
    logger.warn('🚫 CORS bloqueado - Origin no permitido', {
      category: 'CORS_BLOCKED',
      origin,
      hostname: u.hostname,
      staticWhitelist: STATIC_WHITELIST,
      regexPatterns: REGEX_WHITELIST.map(r => r.toString())
    });
    
    return false;
    
  } catch (error) {
    // Origin inválido
    logger.warn('🚫 CORS bloqueado - Origin inválido', {
      category: 'CORS_INVALID',
      origin,
      error: error.message
    });
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
    // Importante: no dispares error → no 500 en preflight
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-API-Key'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Request-ID'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  // ✅ CRÍTICO: Agregar maxAge para cachear preflight
  maxAge: 86400, // 24 horas
};

/**
 * 🔧 OPCIONES DE CORS PARA SOCKET.IO
 */
const socketCorsOptions = {
  origin(origin, cb) {
    if (isOriginAllowed(origin)) {
      return cb(null, true);
    }
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST'],
};

module.exports = { 
  corsOptions, 
  socketCorsOptions,
  isOriginAllowed, 
  STATIC_WHITELIST, 
  REGEX_WHITELIST 
}; 