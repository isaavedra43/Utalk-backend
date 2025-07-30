const User = require('../models/User');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const { ResponseHandler, ApiError } = require('../utils/responseHandler');
const { safeDateToISOString } = require('../utils/dateHelpers');

class AuthController {
  /**
   * 🔒 LOGIN CON FIRESTORE ÚNICAMENTE (EMAIL + PASSWORD)
   * NO más JWT interno - Solo Firestore y JWT interno
   */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // ✅ NUEVO: Log de intento de login
      req.logger.auth('login_attempt', {
        email,
        ip: req.ip,
        userAgent: req.headers['user-agent']?.substring(0, 100)
      });

      // Validación de entrada
      if (!email || !password) {
        req.logger.auth('login_failed', {
          reason: 'missing_credentials',
          email: email || 'not_provided',
          hasPassword: !!password
        });

        return res.status(400).json({
          error: 'Credenciales incompletas',
          message: 'Email y contraseña son requeridos',
          code: 'MISSING_CREDENTIALS',
        });
      }

      // ✅ NUEVO: Log de validación de contraseña
      req.logger.database('query_started', {
        operation: 'user_validation',
        email
      });

      // Validar credenciales
      const isValidPassword = await User.validatePassword(email, password);
      
      if (!isValidPassword) {
        req.logger.auth('login_failed', {
          reason: 'invalid_credentials',
          email,
          ip: req.ip
        });

        req.logger.security('suspicious_activity', {
          type: 'failed_login',
          email,
          ip: req.ip,
          userAgent: req.headers['user-agent']?.substring(0, 100)
        });

        return res.status(401).json({
          error: 'Credenciales inválidas',
          message: 'Email o contraseña incorrectos',
          code: 'INVALID_CREDENTIALS',
          });
        }

      // ✅ NUEVO: Log de usuario obtenido
      const user = await User.getByEmail(email);
      req.logger.database('document_read', {
        operation: 'user_by_email',
        email,
        found: !!user
      });

      // ACTUALIZAR último login
      await user.updateLastLogin();
      req.logger.database('document_updated', {
        operation: 'last_login_update',
        email
      });

      // GENERAR JWT INTERNO
      const jwtSecret = process.env.JWT_SECRET;
      const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';

      if (!jwtSecret) {
        req.logger.error('💥 JWT_SECRET no configurado');
        return res.status(500).json({
          error: 'Error de configuración',
          message: 'Servidor mal configurado',
          code: 'SERVER_ERROR',
        });
      }

      // ✅ PAYLOAD DEL JWT - Claims que se incluyen en el token
      const tokenPayload = {
          email: user.email,        // Identificador principal del usuario
          role: user.role,          // Rol para autorización
        name: user.name,          // Nombre para UI
        iat: Math.floor(Date.now() / 1000), // Timestamp de emisión
      };

      // ✅ GENERACIÓN DEL JWT CON CLAIMS DE SEGURIDAD
      const token = jwt.sign(tokenPayload, jwtSecret, { 
        expiresIn: jwtExpiresIn,
        issuer: 'utalk-backend',      // Debe coincidir con auth.js:55
        audience: 'utalk-frontend',   // Debe coincidir con auth.js:56
      });

      // ✅ NUEVO: Log de token generado
      req.logger.auth('token_generated', {
        email: user.email,
        role: user.role,
        expiresIn: jwtExpiresIn
      });

      // LOGIN EXITOSO
      req.logger.auth('login_success', {
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        ip: req.ip,
        userAgent: req.headers['user-agent']?.substring(0, 100)
      });

      // RESPUESTA ESTÁNDAR (EMAIL-FIRST)
      res.json({
        success: true,
        message: 'Login exitoso',
        token: token,
        user: user.toJSON(),
      });
    } catch (error) {
      req.logger.error('💥 Error crítico en login', {
        email: req.body?.email,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        ip: req.ip
      });
      next(error);
    }
  }

  /**
   * 🚪 LOGOUT
   */
  static async logout(req, res, next) {
    try {
      const email = req.user?.email;

      req.logger.auth('logout', {
        email,
        ip: req.ip,
        userAgent: req.headers['user-agent']?.substring(0, 100)
      });

      res.json({
        success: true,
        message: 'Logout exitoso',
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

      logger.info('Contraseña cambiada exitosamente', { email });

      res.json({
        success: true,
        message: 'Contraseña cambiada exitosamente',
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
   * 🔍 GET /api/auth/validate-token
   * Valida JWT existente para mantener sesión al refrescar página
   * 
   * Este endpoint es CRÍTICO para la experiencia de usuario:
   * - Permite al frontend restaurar el estado de autenticación
   * - Evita logout automático al refrescar la página
   * - Mantiene la sesión persistente sin pedir login nuevamente
   * 
   * NO renueva tokens, solo valida y responde con datos del usuario
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
        decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        
        req.logger.auth('token_validated', {
          email: decodedToken.email,
          role: decodedToken.role,
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
          suggestion = 'Inicia sesión nuevamente para renovar tu sesión';
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
      req.logger.database('query_started', {
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
      req.logger.timing('token_validation', startTime, {
        email: user.email,
        role: user.role,
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
}

module.exports = AuthController;
