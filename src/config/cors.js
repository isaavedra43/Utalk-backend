/**
 * 🔒 CONFIGURACIÓN CORS SEGURA Y DINÁMICA
 * 
 * Configuración centralizada para Cross-Origin Resource Sharing (CORS)
 * que maneja diferentes entornos de manera segura.
 * 
 * @version 1.0.0
 */

const logger = require('../utils/logger');

/**
 * 📋 ORÍGENES PERMITIDOS POR ENTORNO
 */
const ALLOWED_ORIGINS = {
  development: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173', // Vite dev server
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8080'
  ],
  
  production: [
    'https://utalk.com',
    'https://www.utalk.com',
    'https://app.utalk.com',
    'https://admin.utalk.com',
    'https://api.utalk.com'
  ],
  
  test: [
    'http://localhost:3000'
  ]
};

/**
 * 🔧 OBTENER ORÍGENES PERMITIDOS PARA EL ENTORNO ACTUAL
 */
function getAllowedOrigins() {
  const env = process.env.NODE_ENV || 'development';
  
  // Permitir orígenes desde variable de entorno en producción
  if (env === 'production' && process.env.CORS_ORIGINS) {
    const envOrigins = process.env.CORS_ORIGINS.split(',').map(origin => origin.trim());
    return [...new Set([...ALLOWED_ORIGINS.production, ...envOrigins])];
  }
  
  return ALLOWED_ORIGINS[env] || ALLOWED_ORIGINS.development;
}

/**
 * 🛡️ VALIDAR ORIGEN
 */
function validateOrigin(origin, callback) {
  const env = process.env.NODE_ENV || 'development';
  
  // En desarrollo, permitir cualquier origin (incluyendo undefined para requests sin origin)
  if (env === 'development') {
    return callback(null, true);
  }
  
  // Permitir requests sin origin (como mobile apps, Postman, etc.)
  if (!origin) {
    return callback(null, true);
  }
  
  const allowedOrigins = getAllowedOrigins();
  
  // Verificar si el origin está en la lista permitida
  if (allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    logger.warn('🚫 CORS bloqueado - Origin no permitido', {
      category: 'CORS_BLOCKED',
      origin,
      allowedOrigins,
      environment: env,
      ip: 'unknown' // Se puede obtener del request si está disponible
    });
    
    callback(new Error(`Origin ${origin} no permitido por CORS`));
  }
}

/**
 * 🔒 CONFIGURACIÓN CORS COMPLETA
 */
function getCorsConfig() {
  const env = process.env.NODE_ENV || 'development';
  const allowedOrigins = getAllowedOrigins();
  
  const corsConfig = {
    origin: validateOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'Cache-Control',
      'X-Request-ID'
    ],
    exposedHeaders: [
      'X-Total-Count', 
      'X-Page-Count', 
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],
    optionsSuccessStatus: 200, // Para compatibilidad con navegadores legacy
    maxAge: env === 'production' ? 86400 : 300 // Cache preflight: 24h en prod, 5min en dev
  };
  
  logger.info('🔒 Configuración CORS inicializada', {
    category: 'CORS_CONFIG',
    environment: env,
    allowedOrigins: allowedOrigins.length,
    strictMode: env === 'production',
    credentials: corsConfig.credentials,
    methods: corsConfig.methods,
    maxAge: corsConfig.maxAge
  });
  
  return corsConfig;
}

/**
 * 📊 OBTENER ESTADÍSTICAS DE CORS
 */
function getCorsStats() {
  const env = process.env.NODE_ENV || 'development';
  const allowedOrigins = getAllowedOrigins();
  
  return {
    environment: env,
    allowedOrigins,
    totalOrigins: allowedOrigins.length,
    strictMode: env === 'production',
    envVariableOverride: !!(env === 'production' && process.env.CORS_ORIGINS),
    configSource: env === 'production' && process.env.CORS_ORIGINS ? 'environment' : 'default'
  };
}

module.exports = {
  getCorsConfig,
  getAllowedOrigins,
  validateOrigin,
  getCorsStats,
  ALLOWED_ORIGINS
}; 