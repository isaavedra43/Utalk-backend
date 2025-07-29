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

      logger.info('🔐 Intento de login con Firestore', {
        email,
        hasPassword: !!password,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // ✅ VALIDACIÓN: Email y password requeridos
      if (!email || !password) {
        logger.warn('❌ Login fallido: Datos faltantes', { 
          email: email || 'FALTANTE',
          hasPassword: !!password,
          ip: req.ip 
        });
        
        return res.status(400).json({
          error: 'Datos requeridos',
          message: 'Email y contraseña son requeridos',
          code: 'MISSING_CREDENTIALS',
        });
      }

      // ✅ BUSCAR usuario en Firestore
      logger.info('🔍 Buscando usuario en Firestore...', { email });
      
      const user = await User.getByEmail(email);
      
      if (!user) {
        logger.warn('❌ Login fallido: Usuario no encontrado', { 
          email,
          ip: req.ip 
        });

        return res.status(401).json({
          error: 'Credenciales inválidas',
          message: 'Email o contraseña incorrectos',
          code: 'INVALID_CREDENTIALS',
        });
      }

      // ✅ VERIFICAR que el usuario esté activo
      if (!user.isActive) {
        logger.warn('❌ Login denegado: Usuario inactivo', {
          email: user.email,
          name: user.name,
          ip: req.ip,
        });

        return res.status(403).json({
          error: 'Usuario inactivo',
          message: 'Tu cuenta ha sido desactivada. Contacta al administrador.',
          code: 'USER_INACTIVE',
        });
      }

      // 🚨 VALIDAR contraseña en texto plano (SOLO PRUEBAS)
      logger.info('🔐 Validando contraseña en texto plano...', { email });
      
      const isPasswordValid = await User.validatePassword(email, password);
      
      if (!isPasswordValid) {
        logger.warn('❌ Login fallido: Contraseña incorrecta', { 
            email,
          ip: req.ip 
        });
        
        return res.status(401).json({
          error: 'Credenciales inválidas',
          message: 'Email o contraseña incorrectos',
          code: 'INVALID_CREDENTIALS',
        });
      }

      // ✅ ACTUALIZAR último login
      await user.updateLastLogin();

      // ✅ GENERAR JWT INTERNO
      const jwtSecret = process.env.JWT_SECRET;
      const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
      
      if (!jwtSecret) {
        logger.error('💥 JWT_SECRET no configurado');
        return res.status(500).json({
          error: 'Error de configuración',
          message: 'Servidor mal configurado',
          code: 'SERVER_ERROR',
        });
      }

      const tokenPayload = {
          email: user.email,
          role: user.role,
        name: user.name,
        iat: Math.floor(Date.now() / 1000),
      };

      const token = jwt.sign(tokenPayload, jwtSecret, { 
        expiresIn: jwtExpiresIn,
        issuer: 'utalk-backend',
        audience: 'utalk-frontend',
      });

      // ✅ LOGIN EXITOSO
      logger.info('🎉 LOGIN EXITOSO con Firestore', {
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });

      // ✅ RESPUESTA ESTÁNDAR (EMAIL-FIRST)
      res.json({
        success: true,
        message: 'Login exitoso',
        token: token,
        user: user.toJSON(),
      });
    } catch (error) {
      logger.error('💥 Error crítico en login', {
        email: req.body?.email,
        error: error.message,
        stack: error.stack,
        ip: req.ip,
        timestamp: new Date().toISOString(),
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

      logger.info('🚪 Logout iniciado', {
        email,
        ip: req.ip,
      });

      // En sistema con JWT, el logout es principalmente del lado del cliente
      // El token se invalida cuando expira o el cliente lo descarta

      logger.info('✅ Logout completado', { email });

      res.json({
        success: true,
        message: 'Logout exitoso',
      });
    } catch (error) {
      logger.error('❌ Error en logout', {
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

      logger.info('✅ Perfil obtenido correctamente', {
        email: user.email,
        name: user.name,
        role: user.role,
      });

      res.json({
        success: true,
        user: user.toJSON(),
      });
    } catch (error) {
      logger.error('❌ Error obteniendo perfil', {
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

      // ✅ Preparar actualizaciones permitidas (NO incluir email como actualizable)
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

      logger.info('✅ Perfil actualizado exitosamente', {
        email,
        updatedFields: Object.keys(allowedUpdates),
      });

      res.json({
        success: true,
        message: 'Perfil actualizado exitosamente',
        user: user.toJSON(),
      });
    } catch (error) {
      logger.error('❌ Error actualizando perfil', {
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
        logger.warn('❌ Cambio de contraseña fallido: Contraseña actual incorrecta', { email });
        
        return res.status(401).json({
          error: 'Contraseña actual incorrecta',
          message: 'La contraseña actual no es válida',
          code: 'INVALID_CURRENT_PASSWORD',
        });
      }

      // Obtener usuario y actualizar contraseña
      const user = await User.getByEmail(email);
      await user.update({ password: newPassword }); // Se hasheará automáticamente en el modelo

      logger.info('✅ Contraseña cambiada exitosamente', { email });

      res.json({
        success: true,
        message: 'Contraseña cambiada exitosamente',
      });
    } catch (error) {
      logger.error('❌ Error cambiando contraseña', {
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

      // ✅ Verificar permisos de administrador
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

      // ✅ Crear usuario en Firestore
      try {
      const newUser = await User.create({
        email,
          password,
        name,
        role,
          department,
          isActive: true,
        });

        logger.info('✅ Usuario creado completamente', {
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
        logger.warn('Validación de token fallida: Header ausente', {
          hasAuthHeader: !!authHeader,
          headerFormat: authHeader ? authHeader.substring(0, 20) + '...' : 'none',
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          endpoint: '/api/auth/validate-token'
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
        logger.warn('Validación de token fallida: Token vacío', {
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
        
        logger.info('Token JWT verificado exitosamente', {
          email: decodedToken.email,
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

        logger.warn('Validación JWT fallida', {
          error: jwtError.name,
          message: jwtError.message,
          tokenPreview: token.substring(0, 20) + '...',
          ip: req.ip,
          userAgent: req.get('User-Agent')
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
        logger.error('Token sin email', {
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
      const user = await User.getByEmail(decodedToken.email);

      if (!user) {
        logger.warn('Usuario no encontrado durante validación de token', {
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
        logger.warn('Usuario inactivo intentando validar token', {
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

      // ✅ TOKEN VÁLIDO - RESPONDER CON DATOS DEL USUARIO
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
          logger.error('Error actualizando última actividad', {
            email: user.email,
            error: activityError.message
          });
        }
      });

      logger.info('Token validado exitosamente', {
        email: user.email,
        role: user.role,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        responseTime: Date.now() - startTime + 'ms'
      });

      return ResponseHandler.success(res, {
        user: responseData,
        sessionValid: true,
        validatedAt: new Date().toISOString()
      }, 'Token válido - sesión activa');

    } catch (error) {
      logger.error('Error interno validando token', {
        error: error.message,
        stack: error.stack,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        responseTime: Date.now() - startTime + 'ms'
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
