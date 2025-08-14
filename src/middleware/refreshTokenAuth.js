const jwt = require('jsonwebtoken');
const RefreshToken = require('../models/RefreshToken');
const User = require('../models/User');
const { logger } = require('../utils/logger');
const { getAccessTokenConfig, getRefreshTokenConfig } = require('../config/jwt');

/**
 * 🔄 MIDDLEWARE DE AUTENTICACIÓN CON REFRESH TOKENS
 * 
 * Maneja automáticamente la renovación de tokens cuando:
 * - El access token está por expirar
 * - El access token ya expiró
 * - Se detecta uso sospechoso
 * 
 * @version 1.0.0
 * @author Backend Team
 */
class RefreshTokenAuth {
  /**
   * Middleware principal de autenticación con refresh automático
   */
  static async authenticate(req, res, next) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return this.handleMissingToken(req, res);
      }

      const token = authHeader.substring(7);

      if (!token) {
        return this.handleEmptyToken(req, res);
      }

      // 🔍 VERIFICAR ACCESS TOKEN
      const tokenValidation = await this.validateAccessToken(token, req);
      
      if (tokenValidation.isValid) {
        // Token válido - continuar
        req.user = tokenValidation.user;
        return next();
      }

      // 🔄 INTENTAR RENOVACIÓN AUTOMÁTICA
      if (tokenValidation.shouldRefresh) {
        return await this.handleTokenRefresh(req, res, next);
      }

      // ❌ TOKEN INVÁLIDO
      return this.handleInvalidToken(req, res, tokenValidation.error);

    } catch (error) {
      logger.error('Error en middleware de autenticación con refresh', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent')?.substring(0, 50)
      });

      return res.status(500).json({
        error: 'Error de autenticación',
        message: 'Error interno del servidor',
        code: 'AUTH_ERROR',
      });
    }
  }

  /**
   * Validar access token
   */
  static async validateAccessToken(token, req) {
    try {
      const jwtConfig = getAccessTokenConfig();
      const decodedToken = jwt.verify(token, jwtConfig.secret, {
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      });

      // Verificar que sea un access token
      if (decodedToken.type !== 'access') {
        return {
          isValid: false,
          shouldRefresh: false,
          error: 'INVALID_TOKEN_TYPE',
          message: 'Token no es un access token válido'
        };
      }

      // Verificar claims requeridos
      if (!decodedToken.email) {
        return {
          isValid: false,
          shouldRefresh: false,
          error: 'MISSING_EMAIL_CLAIM',
          message: 'Token sin email requerido'
        };
      }

      // Obtener usuario
      const user = await User.getByEmail(decodedToken.email);
      if (!user || !user.isActive) {
        return {
          isValid: false,
          shouldRefresh: false,
          error: 'USER_INVALID',
          message: 'Usuario no válido o inactivo'
        };
      }

      // Verificar si el token está por expirar (5 minutos antes)
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = decodedToken.exp - now;
      const shouldRefresh = timeUntilExpiry < 300; // 5 minutos

      req.logger.auth('token_validated', {
        email: user.email,
        role: user.role,
        timeUntilExpiry: `${timeUntilExpiry}s`,
        shouldRefresh,
        ip: req.ip
      });

      return {
        isValid: true,
        shouldRefresh,
        user,
        timeUntilExpiry
      };

    } catch (jwtError) {
      // Determinar si se debe intentar refresh
      const shouldRefresh = jwtError.name === 'TokenExpiredError';
      
      req.logger.auth('token_invalid', {
        error: jwtError.name,
        message: jwtError.message,
        shouldRefresh,
        ip: req.ip
      });

      return {
        isValid: false,
        shouldRefresh,
        error: jwtError.name,
        message: jwtError.message
      };
    }
  }

  /**
   * Manejar renovación automática de token
   */
  static async handleTokenRefresh(req, res, next) {
    try {
      const refreshToken = req.headers['x-refresh-token'] || req.body.refreshToken;

      if (!refreshToken) {
        req.logger.auth('refresh_attempt_failed', {
          reason: 'no_refresh_token_provided',
          ip: req.ip
        });

        return res.status(401).json({
          error: 'Refresh token requerido',
          message: 'Incluye el refresh token para renovar la sesión',
          code: 'REFRESH_TOKEN_REQUIRED',
        });
      }

      req.logger.auth('auto_refresh_attempt', {
        refreshTokenPreview: refreshToken.substring(0, 20) + '...',
        ip: req.ip
      });

      // Validar refresh token
      const storedRefreshToken = await RefreshToken.getByToken(refreshToken);
      
      if (!storedRefreshToken || !storedRefreshToken.isValid()) {
        req.logger.auth('auto_refresh_failed', {
          reason: 'invalid_refresh_token',
          tokenExists: !!storedRefreshToken,
          isValid: storedRefreshToken?.isValid(),
          ip: req.ip
        });

        return res.status(401).json({
          error: 'Refresh token inválido',
          message: 'El refresh token ha expirado o ha sido invalidado',
          code: 'INVALID_REFRESH_TOKEN',
        });
      }

      // Verificar JWT del refresh token
      try {
        const refreshConfig = getRefreshTokenConfig();
        jwt.verify(
          refreshToken, 
          refreshConfig.secret,
          {
            issuer: refreshConfig.issuer,
            audience: refreshConfig.audience
          }
        );
      } catch (jwtError) {
        req.logger.auth('auto_refresh_failed', {
          reason: 'refresh_token_jwt_invalid',
          error: jwtError.message,
          ip: req.ip
        });

        return res.status(401).json({
          error: 'Refresh token inválido',
          message: 'El refresh token no es válido',
          code: 'REFRESH_TOKEN_JWT_INVALID',
        });
      }

      // Obtener usuario
      const user = await User.getByEmail(storedRefreshToken.userEmail);
      if (!user || !user.isActive) {
        return res.status(401).json({
          error: 'Usuario no válido',
          message: 'El usuario asociado al refresh token no existe o está inactivo',
          code: 'USER_INVALID',
        });
      }

      // Generar nuevo access token
      const accessConfig = getAccessTokenConfig();
      const newAccessToken = jwt.sign(
        {
          email: user.email,
          role: user.role,
          name: user.name,
          type: 'access',
          userId: user.id,           // 🔧 CORRECCIÓN: Agregar userId
          workspaceId: user.workspaceId || 'default',  // 🔧 CORRECCIÓN: Agregar workspaceId
          tenantId: user.tenantId || 'na',             // 🔧 CORRECCIÓN: Agregar tenantId
          iat: Math.floor(Date.now() / 1000),
        },
        accessConfig.secret,
        {
          expiresIn: accessConfig.expiresIn,
          issuer: accessConfig.issuer,
          audience: accessConfig.audience,
        }
      );

      // Actualizar refresh token
      await storedRefreshToken.update({
        usedCount: 1,
        lastUsedAt: new Date()
      });

      // Rotación de refresh token si es necesario
      let newRefreshToken = null;
      if (storedRefreshToken.usedCount >= storedRefreshToken.maxUses * 0.8) {
        await RefreshToken.invalidateFamily(storedRefreshToken.familyId);
        
        const deviceInfo = {
          deviceId: storedRefreshToken.deviceId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']?.substring(0, 200),
          deviceType: 'web',
          rotatedAt: new Date().toISOString()
        };

        newRefreshToken = await RefreshToken.generate(user.email, user.id, deviceInfo);
      }

      req.logger.auth('auto_refresh_success', {
        userEmail: user.email,
        oldTokenId: storedRefreshToken.id,
        newTokenId: newRefreshToken?.id,
        ip: req.ip
      });

      // Establecer usuario en request
      req.user = user;

      // Agregar headers con nuevos tokens
      res.set({
        'X-New-Access-Token': newAccessToken,
        'X-Access-Token-Expires-In': accessConfig.expiresIn
      });

      if (newRefreshToken) {
        res.set('X-New-Refresh-Token', newRefreshToken.token);
      }

      // Continuar con la petición original
      return next();

    } catch (error) {
      req.logger.error('Error en renovación automática de token', {
        error: error.message,
        ip: req.ip
      });

      return res.status(500).json({
        error: 'Error renovando token',
        message: 'Error interno del servidor',
        code: 'REFRESH_ERROR',
      });
    }
  }

  /**
   * Manejar token faltante
   */
  static handleMissingToken(req, res) {
    req.logger.auth('token_missing', {
      hasAuthHeader: !!req.headers.authorization,
      ip: req.ip
    });

    return res.status(401).json({
      error: 'Token de autorización faltante',
      message: 'Se requiere un token "Bearer" válido',
      code: 'MISSING_TOKEN',
    });
  }

  /**
   * Manejar token vacío
   */
  static handleEmptyToken(req, res) {
    req.logger.auth('token_empty', {
      ip: req.ip
    });

    return res.status(401).json({
      error: 'Token vacío',
      message: 'El token no puede estar vacío',
      code: 'EMPTY_TOKEN',
    });
  }

  /**
   * Manejar token inválido
   */
  static handleInvalidToken(req, res, error) {
    let errorMessage = 'Token inválido';
    let errorCode = 'INVALID_TOKEN';

    if (error === 'TokenExpiredError') {
      errorMessage = 'El token ha expirado';
      errorCode = 'TOKEN_EXPIRED';
    } else if (error === 'JsonWebTokenError') {
      errorMessage = 'El token proporcionado no es válido';
      errorCode = 'MALFORMED_TOKEN';
    } else if (error === 'NotBeforeError') {
      errorMessage = 'El token aún no es válido';
      errorCode = 'TOKEN_NOT_ACTIVE';
    }

    req.logger.auth('token_invalid', {
      error,
      ip: req.ip
    });

    return res.status(401).json({
      error: 'Token inválido',
      message: errorMessage,
      code: errorCode,
    });
  }

  /**
   * Middleware para verificar si el token está por expirar
   */
  static async checkTokenExpiry(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
      }

      const token = authHeader.substring(7);
      
      try {
        const jwtConfig = getAccessTokenConfig();
        const decodedToken = jwt.verify(token, jwtConfig.secret, {
          issuer: jwtConfig.issuer,
          audience: jwtConfig.audience,
        });

        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = decodedToken.exp - now;
        
        // Advertencia si expira en menos de 10 minutos
        if (timeUntilExpiry < 600) {
          res.set('X-Token-Expires-In', `${timeUntilExpiry}s`);
          res.set('X-Token-Refresh-Recommended', 'true');
        }

      } catch (jwtError) {
        // Token inválido - continuar sin advertencia
      }

      next();
    } catch (error) {
      next();
    }
  }

  /**
   * Middleware para limpiar tokens expirados
   */
  static async cleanupExpiredTokens(req, res, next) {
    try {
      // Ejecutar limpieza en background
      setImmediate(async () => {
        try {
          await RefreshToken.cleanupExpiredTokens();
        } catch (cleanupError) {
          logger.error('Error limpiando tokens expirados', {
            error: cleanupError.message
          });
        }
      });

      next();
    } catch (error) {
      next();
    }
  }
}

module.exports = RefreshTokenAuth; 