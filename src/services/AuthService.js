const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { getAccessTokenConfig, getRefreshTokenConfig } = require('../config/jwt');

class AuthService {
  static verifyAccessToken(token) {
    const cfg = getAccessTokenConfig();
    try {
      const decoded = jwt.verify(token, cfg.secret, {
        issuer: cfg.issuer,
        audience: cfg.audience,
        algorithms: ['HS256'],
        clockTolerance: 60
      });
      return decoded;
    } catch (error) {
      logger.warn('AuthService.verifyAccessToken: invalid token', {
        category: 'AUTH_VERIFY_ACCESS_FAIL',
        error: error.message
      });
      throw error;
    }
  }

  static verifyRefreshToken(token) {
    const cfg = getRefreshTokenConfig();
    try {
      const decoded = jwt.verify(token, cfg.secret, {
        issuer: cfg.issuer,
        audience: cfg.audience,
        algorithms: ['HS256'],
        clockTolerance: 60
      });
      return decoded;
    } catch (error) {
      logger.warn('AuthService.verifyRefreshToken: invalid token', {
        category: 'AUTH_VERIFY_REFRESH_FAIL',
        error: error.message
      });
      throw error;
    }
  }

  static signAccess(payload) {
    const cfg = getAccessTokenConfig();
    return jwt.sign(payload, cfg.secret, {
      issuer: cfg.issuer,
      audience: cfg.audience,
      algorithm: 'HS256',
      expiresIn: cfg.expiresIn
    });
  }

  static signRefresh(payload) {
    const cfg = getRefreshTokenConfig();
    return jwt.sign(payload, cfg.secret, {
      issuer: cfg.issuer,
      audience: cfg.audience,
      algorithm: 'HS256',
      expiresIn: cfg.expiresIn
    });
  }
}

module.exports = AuthService; 