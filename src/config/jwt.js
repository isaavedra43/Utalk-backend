/**
 * 🔐 CONFIGURACIÓN CENTRALIZADA DE JWT
 * 
 * Este módulo centraliza toda la configuración relacionada con JWT
 * para evitar inconsistencias y duplicaciones en el código.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const logger = require('../utils/logger');

/**
 * Configuración centralizada de JWT
 */
const jwtConfig = {
  // Secretos
  secret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
  
  // Tiempos de expiración
  expiresIn: process.env.JWT_EXPIRES_IN || '24h', // 🔧 CORRECCIÓN: Aumentado de 15m a 24h para WebSockets
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  // Configuración de claims
  issuer: process.env.JWT_ISSUER || 'utalk-backend',
  audience: process.env.JWT_AUDIENCE || 'utalk-api',
  
  // Configuración de algoritmos
  algorithm: 'HS256',
  
  // Configuración de refresh tokens
  refreshTokenConfig: {
    secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    algorithm: 'HS256'
  }
};

/**
 * Validar configuración de JWT
 */
function validateJwtConfig() {
  const errors = [];
  
  if (!jwtConfig.secret) {
    errors.push('JWT_SECRET no está configurado');
  }
  
  if (!jwtConfig.refreshSecret) {
    errors.push('JWT_REFRESH_SECRET no está configurado (usando JWT_SECRET como fallback)');
  }
  
  if (errors.length > 0) {
    logger.error('❌ Errores en configuración de JWT:', { errors });
    return false;
  }
  
  logger.info('✅ Configuración de JWT validada correctamente', {
    hasSecret: !!jwtConfig.secret,
    hasRefreshSecret: !!jwtConfig.refreshSecret,
    expiresIn: jwtConfig.expiresIn,
    refreshExpiresIn: jwtConfig.refreshExpiresIn,
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience
  });
  
  return true;
}

/**
 * Obtener configuración de JWT para access tokens
 */
function getAccessTokenConfig() {
  return {
    secret: jwtConfig.secret,
    expiresIn: jwtConfig.expiresIn,
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
    algorithm: jwtConfig.algorithm
  };
}

/**
 * Obtener configuración de JWT para refresh tokens
 */
function getRefreshTokenConfig() {
  return {
    secret: jwtConfig.refreshSecret,
    expiresIn: jwtConfig.refreshExpiresIn,
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
    algorithm: jwtConfig.algorithm
  };
}

/**
 * Obtener configuración completa de JWT
 */
function getFullConfig() {
  return {
    ...jwtConfig,
    accessToken: getAccessTokenConfig(),
    refreshToken: getRefreshTokenConfig()
  };
}

module.exports = {
  jwtConfig,
  validateJwtConfig,
  getAccessTokenConfig,
  getRefreshTokenConfig,
  getFullConfig
}; 