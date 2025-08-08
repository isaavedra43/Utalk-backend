const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const { ResponseHandler, ApiError } = require('../utils/responseHandler');
const { safeDateToISOString } = require('../utils/dateHelpers');
const { v4: uuidv4 } = require('uuid');
const { getAccessTokenConfig, getRefreshTokenConfig, validateJwtConfig } = require('../config/jwt');

class AuthController {
  /**
   * 🔒 LOGIN CON REFRESH TOKENS
   * Genera access token (corto) + refresh token (largo)
   */
  static async login(req, res, next) {
    console.log('🔍 [LOGIN] === INICIO DEL MÉTODO LOGIN ===');
    console.log('🔍 [LOGIN] req.logger existe:', !!req.logger);
    console.log('🔍 [LOGIN] req.logger.auth existe:', !!(req.logger && typeof req.logger.auth === 'function'));
    
    try {
      const { email, password } = req.body;
      console.log('🔍 [LOGIN] Datos recibidos:', { email: email ? 'presente' : 'ausente', password: password ? 'presente' : 'ausente' });

      // ✅ NUEVO: Log de intento de login
      console.log('🔍 [LOGIN] Intentando loggear intento de login...');
      if (req.logger && typeof req.logger.auth === 'function') {
        console.log('🔍 [LOGIN] req.logger.auth disponible, llamando...');
        req.logger.auth('login_attempt', {
          email,
          ip: req.ip,
          userAgent: req.headers['user-agent']?.substring(0, 100)
        });
        console.log('🔍 [LOGIN] req.logger.auth ejecutado exitosamente');
      } else {
        console.log('❌ [LOGIN] req.logger.auth NO disponible');
      }

      // Validación de entrada
      console.log('🔍 [LOGIN] Validando datos de entrada...');
      if (!email || !password) {
        console.log('❌ [LOGIN] Datos incompletos:', { email: !!email, password: !!password });
        if (req.logger && typeof req.logger.auth === 'function') {
          console.log('🔍 [LOGIN] Loggeando fallo por credenciales faltantes...');
          req.logger.auth('login_failed', {
            reason: 'missing_credentials',
            email: email || 'not_provided',
            hasPassword: !!password
          });
        }

        return res.status(400).json({
          error: 'Credenciales incompletas',
          message: 'Email y contraseña son requeridos',
          code: 'MISSING_CREDENTIALS',
        });
      }
      console.log('✅ [LOGIN] Datos de entrada válidos');

      // ✅ NUEVO: Log de validación de contraseña
      console.log('🔍 [LOGIN] Intentando loggear query de base de datos...');
      console.log('🔍 [LOGIN] req.logger.database existe:', !!(req.logger && typeof req.logger.database === 'function'));
      
      if (req.logger && typeof req.logger.database === 'function') {
        console.log('🔍 [LOGIN] req.logger.database disponible, llamando...');
        req.logger.info('query_started', {
          operation: 'user_validation',
          email
        });
        console.log('🔍 [LOGIN] req.logger.database ejecutado exitosamente');
      } else {
        console.log('❌ [LOGIN] req.logger.database NO disponible');
      }

      // Asegúrate que 'findUserByEmail' siempre retorne un objeto válido o null, pero nunca undefined directamente
      console.log('🔍 [LOGIN] Llamando User.getByEmail...');
      const user = await User.getByEmail(email);
      console.log('🔍 [LOGIN] User.getByEmail resultado:', { 
        userExists: !!user, 
        userType: typeof user, 
        userEmail: user?.email,
        userRole: user?.role 
      });

      // VERIFICACIÓN EXHAUSTIVA:
      console.log('🔍 [LOGIN] Verificando si usuario existe...');
      if (!user) {
        console.log('❌ [LOGIN] Usuario no encontrado');
        if (req.logger && typeof req.logger.auth === 'function') {
          console.log('🔍 [LOGIN] Loggeando fallo por usuario no encontrado...');
          req.logger.auth('login_failed', {
            reason: 'user_not_found',
            email,
            ip: req.ip
          });
        }

        return res.status(401).json({ 
          error: 'Usuario no encontrado',
          message: 'Email o contraseña incorrectos',
          code: 'USER_NOT_FOUND'
        });
      }
      console.log('✅ [LOGIN] Usuario encontrado');

      // VALIDA SIEMPRE LA CONTRASEÑA DIRECTAMENTE CON EL MODELO (sin Firebase Auth)
      console.log('🔍 [LOGIN] Validando contraseña...');
      const isPasswordValid = await User.validatePassword(email, password);
      console.log('🔍 [LOGIN] Resultado validación contraseña:', isPasswordValid);

      if (!isPasswordValid) {
        console.log('❌ [LOGIN] Contraseña inválida');
        if (req.logger && typeof req.logger.auth === 'function') {
          console.log('🔍 [LOGIN] Loggeando fallo por contraseña inválida...');
          req.logger.auth('login_failed', {
            reason: 'invalid_password',
            email,
            ip: req.ip
          });
        }

        if (req.logger && typeof req.logger.security === 'function') {
          console.log('🔍 [LOGIN] Loggeando actividad sospechosa...');
          req.logger.security('suspicious_activity', {
            type: 'failed_login',
            email,
            ip: req.ip,
            userAgent: req.headers['user-agent']?.substring(0, 100)
          });
        }

        return res.status(401).json({ 
          error: 'Contraseña incorrecta',
          message: 'Email o contraseña incorrectos',
          code: 'INVALID_PASSWORD'
        });
      }
      console.log('✅ [LOGIN] Contraseña válida');

      // ✅ NUEVO: Log de usuario obtenido
      console.log('🔍 [LOGIN] Loggeando documento leído...');
      if (req.logger && typeof req.logger.database === 'function') {
        console.log('🔍 [LOGIN] req.logger.database disponible para document_read...');
        req.logger.info('document_read', {
          operation: 'user_by_email',
          email,
          found: !!user
        });
        console.log('🔍 [LOGIN] document_read loggeado exitosamente');
      } else {
        console.log('❌ [LOGIN] req.logger.database NO disponible para document_read');
      }

      // ACTUALIZAR último login
      console.log('🔍 [LOGIN] Actualizando último login...');
      console.log('🔍 [LOGIN] user.updateLastLogin existe:', typeof user.updateLastLogin);
      await user.updateLastLogin();
      console.log('✅ [LOGIN] Último login actualizado');
      
      console.log('🔍 [LOGIN] Loggeando documento actualizado...');
      if (req.logger && typeof req.logger.database === 'function') {
        console.log('🔍 [LOGIN] req.logger.database disponible para document_updated...');
        req.logger.info('document_updated', {
          operation: 'last_login_update',
          email
        });
        console.log('🔍 [LOGIN] document_updated loggeado exitosamente');
      } else {
        console.log('❌ [LOGIN] req.logger.database NO disponible para document_updated');
      }

      // 🔄 GENERAR ACCESS TOKEN (corto - 15 minutos)
      console.log('🔍 [LOGIN] Obteniendo configuración JWT...');
      const jwtConfig = getAccessTokenConfig();
      console.log('🔍 [LOGIN] jwtConfig obtenido:', { 
        hasSecret: !!jwtConfig.secret, 
        hasExpiresIn: !!jwtConfig.expiresIn,
        hasIssuer: !!jwtConfig.issuer,
        hasAudience: !!jwtConfig.audience 
      });

      if (!jwtConfig.secret) {
        console.log('❌ [LOGIN] JWT_SECRET no configurado');
        if (req.logger && typeof req.logger.error === 'function') {
          console.log('🔍 [LOGIN] Loggeando error de JWT_SECRET...');
          req.logger.error('💥 JWT_SECRET no configurado');
        }
        return res.status(500).json({
          error: 'Error de configuración',
          message: 'Servidor mal configurado',
          code: 'SERVER_ERROR',
        });
      }
      console.log('✅ [LOGIN] JWT_SECRET configurado correctamente');

      // ✅ PAYLOAD DEL ACCESS TOKEN
      console.log('🔍 [LOGIN] Creando payload del access token...');
      const accessTokenPayload = {
        email: user.email,
        role: user.role,
        name: user.name,
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
      };
      console.log('🔍 [LOGIN] accessTokenPayload creado:', { 
        email: accessTokenPayload.email, 
        role: accessTokenPayload.role, 
        name: accessTokenPayload.name,
        type: accessTokenPayload.type,
        iat: accessTokenPayload.iat 
      });

      // ✅ GENERACIÓN DEL ACCESS TOKEN
      console.log('🔍 [LOGIN] Generando access token...');
      const accessToken = jwt.sign(accessTokenPayload, jwtConfig.secret, { 
        expiresIn: jwtConfig.expiresIn,
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      });
      console.log('✅ [LOGIN] Access token generado exitosamente');

      // 🔄 GENERAR REFRESH TOKEN (largo - 7 días)
      console.log('🔍 [LOGIN] Creando deviceInfo...');
      const deviceInfo = {
        deviceId: req.headers['x-device-id'] || uuidv4(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']?.substring(0, 200),
        deviceType: req.headers['x-device-type'] || 'web',
        loginAt: new Date().toISOString()
      };
      console.log('🔍 [LOGIN] deviceInfo creado:', { 
        deviceId: deviceInfo.deviceId, 
        ipAddress: deviceInfo.ipAddress, 
        deviceType: deviceInfo.deviceType,
        loginAt: deviceInfo.loginAt 
      });

      console.log('🔍 [LOGIN] Generando refresh token...');
      console.log('🔍 [LOGIN] Parámetros para RefreshToken.generate:', { 
        userEmail: user.email, 
        userId: user.id, 
        deviceInfoExists: !!deviceInfo 
      });
      const refreshToken = await RefreshToken.generate(user.email, user.id, deviceInfo);
      console.log('✅ [LOGIN] Refresh token generado exitosamente');

      // ✅ NUEVO: Log de tokens generados
      console.log('🔍 [LOGIN] Loggeando tokens generados...');
      if (req.logger && typeof req.logger.auth === 'function') {
        console.log('🔍 [LOGIN] req.logger.auth disponible para tokens_generated...');
        req.logger.auth('tokens_generated', {
          email: user.email,
          role: user.role,
          accessTokenExpiresIn: jwtConfig.expiresIn,
          refreshTokenExpiresIn: '7d',
          deviceId: deviceInfo.deviceId
        });
        console.log('🔍 [LOGIN] tokens_generated loggeado exitosamente');
      } else {
        console.log('❌ [LOGIN] req.logger.auth NO disponible para tokens_generated');
      }

      // LOGIN EXITOSO
      console.log('🔍 [LOGIN] Loggeando login exitoso...');
      if (req.logger && typeof req.logger.auth === 'function') {
        console.log('🔍 [LOGIN] req.logger.auth disponible para login_success...');
        req.logger.auth('login_success', {
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          ip: req.ip,
          userAgent: req.headers['user-agent']?.substring(0, 100),
          deviceId: deviceInfo.deviceId
        });
        console.log('🔍 [LOGIN] login_success loggeado exitosamente');
      } else {
        console.log('❌ [LOGIN] req.logger.auth NO disponible para login_success');
      }

      // Solo aquí retornas una respuesta de éxito
      console.log('🔍 [LOGIN] Preparando respuesta exitosa...');
      console.log('🔍 [LOGIN] user.toJSON existe:', typeof user.toJSON);
      const userJSON = user.toJSON();
      console.log('🔍 [LOGIN] user.toJSON resultado:', { 
        hasEmail: !!userJSON.email, 
        hasName: !!userJSON.name, 
        hasRole: !!userJSON.role 
      });
      
      const response = {
        success: true,
        message: 'Login exitoso',
        accessToken: accessToken,
        refreshToken: refreshToken.token,
        expiresIn: jwtConfig.expiresIn,
        refreshExpiresIn: '7d',
        user: userJSON,
        deviceInfo: {
          deviceId: deviceInfo.deviceId,
          deviceType: deviceInfo.deviceType,
          loginAt: deviceInfo.loginAt
        }
      };
      
      console.log('✅ [LOGIN] === LOGIN EXITOSO - ENVIANDO RESPUESTA ===');
      return res.status(200).json(response);

    } catch (error) {
      console.log('❌ [LOGIN] === ERROR CAPTURADO EN CATCH ===');
      console.log('❌ [LOGIN] Tipo de error:', typeof error);
      console.log('❌ [LOGIN] Error es objeto:', error && typeof error === 'object');
      console.log('❌ [LOGIN] Error tiene message:', !!(error && error.message));
      
      const errorMessage = error && typeof error === 'object' && error.message ? error.message : 'Error desconocido';
      console.error('❌ [LOGIN] Error en AuthController.login:', errorMessage);
      console.log('❌ [LOGIN] Stack trace:', error?.stack);
      
      // Validación adicional para evitar errores de undefined en el logger
      console.log('🔍 [LOGIN] Verificando req.logger.error...');
      console.log('🔍 [LOGIN] req existe:', !!req);
      console.log('🔍 [LOGIN] req.logger existe:', !!(req && req.logger));
      console.log('🔍 [LOGIN] req.logger.error existe:', !!(req && req.logger && typeof req.logger.error === 'function'));
      
      if (req && req.logger && typeof req.logger.error === 'function') {
        console.log('🔍 [LOGIN] Loggeando error crítico...');
        req.logger.error('Error crítico en login', {
          email: req.body?.email || 'unknown',
          error: errorMessage,
          ip: req.ip || 'unknown'
        });
        console.log('🔍 [LOGIN] Error crítico loggeado exitosamente');
      } else {
        console.log('❌ [LOGIN] req.logger.error NO disponible');
      }
      
      console.log('❌ [LOGIN] === ENVIANDO RESPUESTA DE ERROR ===');
      return res.status(500).json({ 
        error: 'Error interno del servidor',
        message: 'Ocurrió un error durante el login',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }

  /**
   * 🔄 REFRESH TOKEN ENDPOINT
   * Renueva access token usando refresh token válido
   */
  static async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        req.logger.auth('refresh_failed', {
          reason: 'missing_refresh_token',
          ip: req.ip
        });

        return res.status(400).json({
          error: 'Refresh token requerido',
          message: 'Incluye el refresh token en el cuerpo de la petición',
          code: 'MISSING_REFRESH_TOKEN',
        });
      }

      req.logger.auth('refresh_attempt', {
        refreshTokenPreview: refreshToken.substring(0, 20) + '...',
        ip: req.ip,
        userAgent: req.headers['user-agent']?.substring(0, 100)
      });

      // 🔍 VERIFICAR REFRESH TOKEN EN BASE DE DATOS
      const storedRefreshToken = await RefreshToken.getByToken(refreshToken);

      if (!storedRefreshToken) {
        req.logger.auth('refresh_failed', {
          reason: 'refresh_token_not_found',
          ip: req.ip
        });

        return res.status(401).json({
          error: 'Refresh token inválido',
          message: 'El refresh token no existe o ha sido invalidado',
          code: 'INVALID_REFRESH_TOKEN',
        });
      }

      // 🔍 VERIFICAR VALIDEZ DEL REFRESH TOKEN
      if (!storedRefreshToken.isValid()) {
        req.logger.auth('refresh_failed', {
          reason: 'refresh_token_invalid',
          tokenId: storedRefreshToken.id,
          isActive: storedRefreshToken.isActive,
          isExpired: storedRefreshToken.isExpired(),
          hasExceededMaxUses: storedRefreshToken.hasExceededMaxUses(),
          ip: req.ip
        });

        return res.status(401).json({
          error: 'Refresh token inválido',
          message: 'El refresh token ha expirado o ha sido invalidado',
          code: 'REFRESH_TOKEN_INVALID',
        });
      }

      // 🔍 VERIFICAR JWT DEL REFRESH TOKEN
      let decodedRefreshToken;
      try {
        decodedRefreshToken = jwt.verify(
          refreshToken, 
          process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
          {
            issuer: 'utalk-backend',
            audience: 'utalk-frontend'
          }
        );
      } catch (jwtError) {
        req.logger.auth('refresh_failed', {
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

      // 🔍 VERIFICAR QUE EL USUARIO EXISTA
      const user = await User.getByEmail(storedRefreshToken.userEmail);
      if (!user || !user.isActive) {
        req.logger.auth('refresh_failed', {
          reason: 'user_not_found_or_inactive',
          userEmail: storedRefreshToken.userEmail,
          userExists: !!user,
          userActive: user?.isActive,
          ip: req.ip
        });

        return res.status(401).json({
          error: 'Usuario no válido',
          message: 'El usuario asociado al refresh token no existe o está inactivo',
          code: 'USER_INVALID',
        });
      }

      // 🔄 GENERAR NUEVO ACCESS TOKEN
      const jwtConfig = getAccessTokenConfig();

      const newAccessTokenPayload = {
        email: user.email,
        role: user.role,
        name: user.name,
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
      };

      const newAccessToken = jwt.sign(newAccessTokenPayload, jwtConfig.secret, {
        expiresIn: jwtConfig.expiresIn,
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      });

      // 🔄 ACTUALIZAR REFRESH TOKEN (incrementar contador de usos)
      await storedRefreshToken.update({
        usedCount: 1,
        lastUsedAt: new Date()
      });

      // 🔄 ROTACIÓN DE REFRESH TOKEN (si se acerca al límite)
      let newRefreshToken = null;
      if (storedRefreshToken.usedCount >= storedRefreshToken.maxUses * 0.8) {
        // Invalidar familia actual y generar nueva
        await RefreshToken.invalidateFamily(storedRefreshToken.familyId);
        
        const deviceInfo = {
          deviceId: storedRefreshToken.deviceId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']?.substring(0, 200),
          deviceType: 'web',
          rotatedAt: new Date().toISOString()
        };

        newRefreshToken = await RefreshToken.generate(user.email, user.id, deviceInfo);

        req.logger.auth('refresh_token_rotated', {
          oldTokenId: storedRefreshToken.id,
          newTokenId: newRefreshToken.id,
          userEmail: user.email,
          reason: 'approaching_max_uses'
        });
      }

      req.logger.auth('refresh_success', {
        userEmail: user.email,
        oldTokenId: storedRefreshToken.id,
        newTokenId: newRefreshToken?.id,
        usedCount: storedRefreshToken.usedCount + 1,
        ip: req.ip
      });

      // RESPUESTA CON NUEVO ACCESS TOKEN
      const response = {
        success: true,
        message: 'Token renovado exitosamente',
        accessToken: newAccessToken,
        expiresIn: jwtConfig.expiresIn,
        user: user.toJSON()
      };

      // Incluir nuevo refresh token si se rotó
      if (newRefreshToken) {
        response.refreshToken = newRefreshToken.token;
        response.refreshExpiresIn = '7d';
        response.tokenRotated = true;
      }

      res.json(response);

    } catch (error) {
      req.logger.error('💥 Error crítico en refresh token', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        ip: req.ip
      });
      next(error);
    }
  }

  /**
   * 🚪 LOGOUT CON INVALIDACIÓN DE REFRESH TOKENS
   */
  static async logout(req, res, next) {
    try {
      const email = req.user?.email;
      const { refreshToken, invalidateAll = false } = req.body;

      req.logger.auth('logout_attempt', {
        email,
        hasRefreshToken: !!refreshToken,
        invalidateAll,
        ip: req.ip,
        userAgent: req.headers['user-agent']?.substring(0, 100)
      });

      // Invalidar refresh token específico si se proporciona
      if (refreshToken) {
        const storedRefreshToken = await RefreshToken.getByToken(refreshToken);
        if (storedRefreshToken && storedRefreshToken.userEmail === email) {
          await storedRefreshToken.invalidate();
          
          req.logger.auth('refresh_token_invalidated', {
            tokenId: storedRefreshToken.id,
            userEmail: email,
            ip: req.ip
          });
        }
      }

      // Invalidar todos los refresh tokens del usuario si se solicita
      if (invalidateAll) {
        const invalidatedCount = await RefreshToken.invalidateAllForUser(email);
        
        req.logger.auth('all_refresh_tokens_invalidated', {
          userEmail: email,
          count: invalidatedCount,
          ip: req.ip
        });
      }

      req.logger.auth('logout_success', {
        email,
        ip: req.ip,
        userAgent: req.headers['user-agent']?.substring(0, 100)
      });

      res.json({
        success: true,
        message: 'Logout exitoso',
        invalidatedTokens: invalidateAll ? 'all' : refreshToken ? 1 : 0
      });
    } catch (error) {
      req.logger.error('Error en logout', {
        error: error.message,
        email: req.user?.email,
      });
      next(error);
    }
  }

  /**
   * 🔍 VALIDAR TOKEN (sin renovación)
   */
  static async validateToken(req, res) {
    const startTime = Date.now();
    
    try {
      // 🔍 EXTRAER TOKEN DEL HEADER
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.logger.auth('token_missing', {
          hasAuthHeader: !!authHeader,
          headerFormat: authHeader ? authHeader.substring(0, 20) + '...' : 'none',
          userAgent: req.get('User-Agent')?.substring(0, 50),
          ip: req.ip
        });

        return ResponseHandler.error(res, new ApiError(
          'NO_TOKEN',
          'No se encontró token de autenticación en la petición',
          'Incluye el header Authorization: Bearer {token} en tu petición',
          401,
          { headerPresent: !!authHeader }
        ));
      }

      const token = authHeader.split(' ')[1];

      if (!token || token === 'null' || token === 'undefined') {
        req.logger.auth('token_invalid', {
          reason: 'empty_token',
          tokenExists: !!token,
          tokenValue: token,
          ip: req.ip
        });

        return ResponseHandler.error(res, new ApiError(
          'EMPTY_TOKEN',
          'El token de autenticación está vacío',
          'Proporciona un token JWT válido',
          401
        ));
      }

      // 🔐 VERIFICAR JWT
      let decodedToken;
      try {
        const jwtConfig = getAccessTokenConfig();
        decodedToken = jwt.verify(token, jwtConfig.secret);
        
        req.logger.auth('token_validated', {
          email: decodedToken.email,
          role: decodedToken.role,
          type: decodedToken.type,
          iat: decodedToken.iat ? new Date(decodedToken.iat * 1000).toISOString() : 'unknown',
          exp: decodedToken.exp ? new Date(decodedToken.exp * 1000).toISOString() : 'unknown',
          ip: req.ip
        });

      } catch (jwtError) {
        // 🚨 DIFERENTES TIPOS DE ERRORES JWT
        let errorCode = 'INVALID_TOKEN';
        let errorMessage = 'El token es inválido o ha expirado';
        let suggestion = 'Inicia sesión nuevamente para obtener un token válido';

        if (jwtError.name === 'TokenExpiredError') {
          errorCode = 'TOKEN_EXPIRED';
          errorMessage = 'El token ha expirado';
          suggestion = 'Usa el refresh token para renovar tu sesión';
        } else if (jwtError.name === 'JsonWebTokenError') {
          errorCode = 'MALFORMED_TOKEN';
          errorMessage = 'El formato del token es inválido';
          suggestion = 'Verifica que el token esté correctamente formateado';
        } else if (jwtError.name === 'NotBeforeError') {
          errorCode = 'TOKEN_NOT_ACTIVE';
          errorMessage = 'El token aún no es válido';
          suggestion = 'Espera a que el token se active o solicita uno nuevo';
        }

        req.logger.auth('token_invalid', {
          error: jwtError.name,
          message: jwtError.message,
          tokenPreview: token.substring(0, 20) + '...',
          ip: req.ip,
          userAgent: req.get('User-Agent')?.substring(0, 50)
        });

        return ResponseHandler.error(res, new ApiError(
          errorCode,
          errorMessage,
          suggestion,
          401,
          { 
            jwtError: jwtError.name,
            timestamp: new Date().toISOString()
          }
        ));
      }

      // 📧 VALIDAR QUE EL TOKEN TENGA EMAIL
      if (!decodedToken.email) {
        req.logger.auth('token_invalid', {
          reason: 'missing_email_claim',
          tokenPayload: decodedToken,
          ip: req.ip
        });

        return ResponseHandler.error(res, new ApiError(
          'INVALID_TOKEN_PAYLOAD',
          'El token no contiene información de usuario válida',
          'Inicia sesión nuevamente para obtener un token correcto',
          401
        ));
      }

      // 👤 BUSCAR USUARIO EN FIRESTORE
      req.logger.info('query_started', {
        operation: 'user_by_email_for_validation',
        email: decodedToken.email
      });

      const user = await User.getByEmail(decodedToken.email);

      if (!user) {
        req.logger.auth('user_not_found', {
          email: decodedToken.email,
          tokenAge: decodedToken.iat ? Math.floor((Date.now() / 1000) - decodedToken.iat) : 'unknown',
          ip: req.ip
        });

        return ResponseHandler.error(res, new ApiError(
          'USER_NOT_FOUND',
          'El usuario asociado al token no existe',
          'El usuario puede haber sido eliminado. Inicia sesión nuevamente',
          401,
          { email: decodedToken.email }
        ));
      }

      // 🔒 VERIFICAR QUE EL USUARIO ESTÉ ACTIVO
      if (!user.isActive) {
        req.logger.auth('user_inactive', {
          email: user.email,
          isActive: user.isActive,
          role: user.role,
          ip: req.ip
        });

        return ResponseHandler.error(res, new ApiError(
          'USER_INACTIVE',
          'Tu cuenta ha sido desactivada',
          'Contacta al administrador para reactivar tu cuenta',
          401,
          { 
            email: user.email,
            isActive: user.isActive
          }
        ));
      }

      // TOKEN VÁLIDO - RESPONDER CON DATOS DEL USUARIO
      const responseData = {
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        permissions: user.permissions || [],
        avatar: user.avatar || null,
        lastLoginAt: user.lastLoginAt ? safeDateToISOString(user.lastLoginAt) : null,
        createdAt: user.createdAt ? safeDateToISOString(user.createdAt) : null
      };

      // 📊 ACTUALIZAR ÚLTIMA ACTIVIDAD (opcional, sin bloquear respuesta)
      setImmediate(async () => {
        try {
          await user.updateLastActivity();
        } catch (activityError) {
          req.logger.error('Error actualizando última actividad', {
            email: user.email,
            error: activityError.message
          });
        }
      });

      const responseTime = Date.now() - startTime;
      req.logger.auth('token_validation_success', {
        email: user.email,
        role: user.role,
        responseTime: `${responseTime}ms`,
        successful: true
      });

      return ResponseHandler.success(res, {
        user: responseData,
        sessionValid: true,
        validatedAt: new Date().toISOString()
      }, 'Token válido - sesión activa');

    } catch (error) {
      const responseTime = Date.now() - startTime;
      req.logger.error('Error interno validando token', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        ip: req.ip,
        userAgent: req.get('User-Agent')?.substring(0, 50),
        responseTime: responseTime + 'ms'
      });

      return ResponseHandler.error(res, new ApiError(
        'VALIDATION_ERROR',
        'Error interno validando el token de autenticación',
        'Intenta nuevamente o inicia sesión si el problema persiste',
        500,
        { 
          originalError: process.env.NODE_ENV === 'development' ? error.message : undefined,
          timestamp: new Date().toISOString()
        }
      ));
    }
  }

  /**
   * 👤 OBTENER PERFIL DEL USUARIO ACTUAL
   */
  static async getProfile(req, res, next) {
    try {
      const email = req.user?.email;

      if (!email) {
        return res.status(401).json({
          error: 'Usuario no autenticado',
          message: 'No se pudo obtener el email del usuario',
          code: 'MISSING_EMAIL',
        });
      }

      logger.info('👤 Obteniendo perfil de usuario', { email });

      // Obtener datos frescos de Firestore
      const user = await User.getByEmail(email);
      
      if (!user) {
        logger.warn('⚠️ Usuario no encontrado en Firestore', { email });
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: 'El usuario no existe en la base de datos',
          code: 'USER_NOT_FOUND',
        });
      }

      logger.info('Perfil obtenido correctamente', {
        email: user.email,
        name: user.name,
        role: user.role,
      });

      res.json({
        success: true,
        user: user.toJSON(),
      });
    } catch (error) {
      logger.error('Error obteniendo perfil', {
        error: error.message,
        email: req.user?.email,
      });
      next(error);
    }
  }

  /**
   * ✏️ ACTUALIZAR PERFIL DEL USUARIO
   */
  static async updateProfile(req, res, next) {
    try {
      const email = req.user?.email;
      const { name, phone, settings } = req.body;

      if (!email) {
        return res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'MISSING_EMAIL',
        });
      }

      logger.info('✏️ Actualizando perfil de usuario', {
        email,
        updates: { name, phone, settings },
      });

      const user = await User.getByEmail(email);
      
      if (!user) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND',
        });
      }

      // Preparar actualizaciones permitidas (NO incluir email como actualizable)
      const allowedUpdates = {};
      if (name !== undefined) allowedUpdates.name = name;
      if (phone !== undefined) allowedUpdates.phone = phone;
      if (settings !== undefined) allowedUpdates.settings = { ...user.settings, ...settings };

      if (Object.keys(allowedUpdates).length === 0) {
        return res.status(400).json({
          error: 'Sin actualizaciones',
          message: 'No se proporcionaron campos válidos para actualizar',
          code: 'NO_UPDATES',
        });
      }

      await user.update(allowedUpdates);

      logger.info('Perfil actualizado exitosamente', {
        email,
        updatedFields: Object.keys(allowedUpdates),
      });

      res.json({
        success: true,
        message: 'Perfil actualizado exitosamente',
        user: user.toJSON(),
      });
    } catch (error) {
      logger.error('Error actualizando perfil', {
        error: error.message,
        email: req.user?.email,
      });
      next(error);
    }
  }

  /**
   * 🔑 CAMBIAR CONTRASEÑA
   */
  static async changePassword(req, res, next) {
    try {
      const email = req.user?.email;
      const { currentPassword, newPassword } = req.body;

      if (!email) {
        return res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'MISSING_EMAIL',
        });
      }

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: 'Datos requeridos',
          message: 'Contraseña actual y nueva contraseña son requeridas',
          code: 'MISSING_PASSWORDS',
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          error: 'Contraseña débil',
          message: 'La nueva contraseña debe tener al menos 8 caracteres',
          code: 'WEAK_PASSWORD',
        });
      }

      logger.info('🔑 Cambio de contraseña solicitado', { email });

      // Validar contraseña actual
      const isCurrentPasswordValid = await User.validatePassword(email, currentPassword);
      
      if (!isCurrentPasswordValid) {
        logger.warn('Cambio de contraseña fallido: Contraseña actual incorrecta', { email });
        
        return res.status(401).json({
          error: 'Contraseña actual incorrecta',
          message: 'La contraseña actual no es válida',
          code: 'INVALID_CURRENT_PASSWORD',
        });
      }

      // Obtener usuario y actualizar contraseña
      const user = await User.getByEmail(email);
      await user.update({ password: newPassword }); // Se hasheará automáticamente en el modelo

      // 🔄 INVALIDAR TODOS LOS REFRESH TOKENS DEL USUARIO
      const invalidatedCount = await RefreshToken.invalidateAllForUser(email);
      
      logger.info('Contraseña cambiada exitosamente', { 
        email,
        invalidatedTokens: invalidatedCount
      });

      res.json({
        success: true,
        message: 'Contraseña cambiada exitosamente. Todos los dispositivos han sido desconectados.',
        invalidatedTokens: invalidatedCount
      });
    } catch (error) {
      logger.error('Error cambiando contraseña', {
        error: error.message,
        email: req.user?.email,
      });
      next(error);
    }
  }

  /**
   * 👥 CREAR USUARIO (solo administradores)
   */
  static async createUser(req, res, next) {
    try {
      const { email, password, name, role = 'viewer', department } = req.body;
      const adminEmail = req.user?.email;

      logger.info('👥 Creación de usuario solicitada por admin', {
        adminEmail,
        targetEmail: email,
        role,
        department,
      });

      // Verificar permisos de administrador
      if (!req.user?.hasRole('admin') && !req.user?.hasRole('superadmin')) {
        logger.warn('🚫 Intento de creación de usuario sin permisos', {
          adminEmail,
          adminRole: req.user?.role,
        });

        return res.status(403).json({
          error: 'Permisos insuficientes',
          message: 'Solo los administradores pueden crear usuarios',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      if (!email || !password || !name) {
        return res.status(400).json({
          error: 'Datos requeridos',
          message: 'Email, contraseña y nombre son requeridos',
          code: 'MISSING_REQUIRED_FIELDS',
        });
      }

      // Crear usuario en Firestore
      try {
        const newUser = await User.create({
          email,
          password,
          name,
          role,
          department,
          isActive: true,
        });

        logger.info('Usuario creado completamente', {
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          createdBy: adminEmail,
        });

        res.status(201).json({
          success: true,
          message: 'Usuario creado exitosamente',
          user: newUser.toJSON(),
        });
      } catch (createError) {
        if (createError.message === 'Usuario ya existe') {
          return res.status(409).json({
            error: 'Usuario ya existe',
            message: 'Ya existe un usuario con ese email',
            code: 'USER_ALREADY_EXISTS',
          });
        }
        throw createError;
      }
    } catch (error) {
      logger.error('💥 Error crítico creando usuario', {
        error: error.message,
        stack: error.stack,
        adminEmail: req.user?.email,
      });
      next(error);
    }
  }

  /**
   * 🔍 OBTENER SESIONES ACTIVAS DEL USUARIO
   */
  static async getActiveSessions(req, res, next) {
    try {
      const email = req.user?.email;

      if (!email) {
        return res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'MISSING_EMAIL',
        });
      }

      logger.info('🔍 Obteniendo sesiones activas', { email });

      const activeTokens = await RefreshToken.listByUser(email, { activeOnly: true });

      const sessions = activeTokens.map(token => ({
        id: token.id,
        deviceId: token.deviceId,
        deviceInfo: token.deviceInfo,
        ipAddress: token.ipAddress,
        userAgent: token.userAgent,
        createdAt: token.createdAt?.toDate?.()?.toISOString() || token.createdAt,
        lastUsedAt: token.lastUsedAt?.toDate?.()?.toISOString() || token.lastUsedAt,
        usedCount: token.usedCount,
        maxUses: token.maxUses,
        expiresAt: token.expiresAt?.toDate?.()?.toISOString() || token.expiresAt
      }));

      logger.info('Sesiones activas obtenidas', {
        email,
        count: sessions.length
      });

      res.json({
        success: true,
        sessions,
        count: sessions.length
      });
    } catch (error) {
      logger.error('Error obteniendo sesiones activas', {
        error: error.message,
        email: req.user?.email,
      });
      next(error);
    }
  }

  /**
   * 🚫 CERRAR SESIÓN ESPECÍFICA
   */
  static async closeSession(req, res, next) {
    try {
      const email = req.user?.email;
      const { sessionId } = req.params;

      if (!email) {
        return res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'MISSING_EMAIL',
        });
      }

      logger.info('🚫 Cerrando sesión específica', { 
        email, 
        sessionId 
      });

      const token = await RefreshToken.getById(sessionId);
      
      if (!token) {
        return res.status(404).json({
          error: 'Sesión no encontrada',
          code: 'SESSION_NOT_FOUND',
        });
      }

      if (token.userEmail !== email) {
        return res.status(403).json({
          error: 'No tienes permisos para cerrar esta sesión',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      await token.invalidate();

      logger.info('Sesión cerrada exitosamente', {
        email,
        sessionId
      });

      res.json({
        success: true,
        message: 'Sesión cerrada exitosamente'
      });
    } catch (error) {
      logger.error('Error cerrando sesión', {
        error: error.message,
        email: req.user?.email,
        sessionId: req.params.sessionId
      });
      next(error);
    }
  }
}

module.exports = AuthController;
