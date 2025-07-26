const { getAuth } = require('firebase-admin/auth');
const User = require('../models/User');
const logger = require('../utils/logger');

class AuthController {
  /**
   * 🔒 LOGIN EXCLUSIVO VÍA FIREBASE AUTH (UID-FIRST)
   * Solo acepta Firebase ID Tokens válidos y sincroniza automáticamente con Firestore
   */
  static async login(req, res, next) {
    try {
      const { idToken } = req.body;

      logger.info('🔐 Intento de login con Firebase ID Token', {
        hasIdToken: !!idToken,
        tokenLength: idToken ? idToken.length : 0,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // ✅ VALIDACIÓN: Solo aceptar idToken de Firebase
      if (!idToken) {
        logger.warn('❌ Login fallido: Token faltante', { ip: req.ip });
        return res.status(400).json({
          error: 'Token de Firebase requerido',
          message: 'Debes proporcionar un idToken válido de Firebase Auth',
          code: 'MISSING_ID_TOKEN',
        });
      }

      // ✅ VALIDAR idToken con Firebase Admin SDK
      let decodedToken;
      try {
        logger.info('🔍 Verificando Firebase ID Token...');
        decodedToken = await getAuth().verifyIdToken(idToken, true); // checkRevoked = true
        
        logger.info('✅ Firebase ID Token válido', {
          uid: decodedToken.uid,
          email: decodedToken.email,
          emailVerified: decodedToken.email_verified,
          hasKid: !!decodedToken.kid,
          issuer: decodedToken.iss,
          audience: decodedToken.aud,
        });
      } catch (firebaseError) {
        logger.error('❌ Firebase ID Token inválido', {
          error: firebaseError.message,
          code: firebaseError.code,
          ip: req.ip,
          tokenPrefix: idToken ? idToken.substring(0, 20) + '...' : 'N/A',
        });

        let errorMessage = 'El token de Firebase proporcionado no es válido';
        let errorCode = 'INVALID_ID_TOKEN';

        if (firebaseError.code === 'auth/id-token-expired') {
          errorMessage = 'El token de Firebase ha expirado. Por favor, inicia sesión de nuevo.';
          errorCode = 'TOKEN_EXPIRED';
        } else if (firebaseError.code === 'auth/argument-error') {
          errorMessage = 'El token de Firebase tiene un formato inválido.';
          errorCode = 'TOKEN_FORMAT_ERROR';
        } else if (firebaseError.message.includes('kid')) {
          errorMessage = 'El token no es un Firebase ID Token válido. Asegúrate de usar getIdToken() en el frontend.';
          errorCode = 'INVALID_TOKEN_TYPE';
        }

        return res.status(401).json({
          error: 'Token inválido',
          message: errorMessage,
          code: errorCode,
        });
      }

      // ✅ EXTRAER información del usuario desde el token verificado
      const {
        uid,
        email,
        name,
        picture,
        phone_number: phoneNumber,
        email_verified: emailVerified
      } = decodedToken;

      if (!email) {
        logger.warn('❌ Login fallido: Email faltante en token', { uid });
        return res.status(400).json({
          error: 'Email requerido',
          message: 'El usuario debe tener un email válido en Firebase Auth',
          code: 'MISSING_EMAIL',
        });
      }

      logger.info('🔄 Iniciando sincronización usuario Firebase -> Firestore', {
        uid,
        email,
        hasDisplayName: !!name,
        hasPhoneNumber: !!phoneNumber,
        emailVerified,
      });

      // ✅ SINCRONIZAR usuario con Firestore (crear si no existe, actualizar si existe)
      let user;
      try {
        user = await User.syncFromAuth({
          uid,
          email,
          displayName: name,
          photoURL: picture,
          phoneNumber,
          emailVerified,
        });

        logger.info('✅ Usuario sincronizado correctamente', {
          uid: user.uid,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          wasCreated: !user.lastLoginAt,
        });
      } catch (syncError) {
        logger.error('❌ Error crítico en sincronización Firebase -> Firestore', {
          uid,
          email,
          error: syncError.message,
          stack: syncError.stack,
        });

        return res.status(500).json({
          error: 'Error de sincronización',
          message: 'No se pudo sincronizar el usuario con la base de datos',
          code: 'SYNC_ERROR',
        });
      }

      // ✅ VERIFICAR que el usuario esté activo
      if (!user.isActive) {
        logger.warn('❌ Login denegado: Usuario inactivo', {
          uid: user.uid,
          email: user.email,
        });

        return res.status(403).json({
          error: 'Usuario inactivo',
          message: 'Tu cuenta ha sido desactivada. Contacta al administrador.',
          code: 'USER_INACTIVE',
        });
      }

      // ✅ LOGIN EXITOSO - Respuesta canónica
      logger.info('🎉 LOGIN EXITOSO', {
        uid: user.uid,
        email: user.email,
        role: user.role,
        department: user.department,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });

      // ✅ RESPUESTA ESTÁNDAR UID-FIRST (sin JWT propio, solo Firebase ID Token)
      res.json({
        success: true,
        message: 'Login exitoso',
        user: user.toJSON(),
        // NO enviamos token JWT propio - el frontend sigue usando Firebase ID Token
      });
    } catch (error) {
      logger.error('💥 Error crítico en login', {
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
      const uid = req.user?.uid;

      logger.info('🚪 Logout iniciado', {
        uid,
        ip: req.ip,
      });

      // En UID-first, el logout es principalmente del lado del cliente
      // Firebase Admin SDK puede revocar refresh tokens si es necesario
      if (uid) {
        try {
          await getAuth().revokeRefreshTokens(uid);
          logger.info('✅ Refresh tokens revocados en Firebase', { uid });
        } catch (revokeError) {
          logger.warn('⚠️ No se pudieron revocar tokens en Firebase', {
            uid,
            error: revokeError.message,
          });
        }
      }

      logger.info('✅ Logout completado', { uid });

      res.json({
        success: true,
        message: 'Logout exitoso',
      });
    } catch (error) {
      logger.error('❌ Error en logout', {
        error: error.message,
        uid: req.user?.uid,
      });
      next(error);
    }
  }

  /**
   * 👤 OBTENER PERFIL DEL USUARIO ACTUAL
   */
  static async getProfile(req, res, next) {
    try {
      const uid = req.user?.uid;

      if (!uid) {
        return res.status(401).json({
          error: 'Usuario no autenticado',
          message: 'No se pudo obtener el UID del usuario',
          code: 'MISSING_UID',
        });
      }

      logger.info('👤 Obteniendo perfil de usuario', { uid });

      const user = await User.getByUid(uid);
      
      if (!user) {
        logger.warn('⚠️ Usuario no encontrado en Firestore', { uid });
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: 'El usuario no existe en la base de datos',
          code: 'USER_NOT_FOUND',
        });
      }

      logger.info('✅ Perfil obtenido correctamente', {
        uid: user.uid,
        email: user.email,
      });

      res.json({
        success: true,
        user: user.toJSON(),
      });
    } catch (error) {
      logger.error('❌ Error obteniendo perfil', {
        error: error.message,
        uid: req.user?.uid,
      });
      next(error);
    }
  }

  /**
   * ✏️ ACTUALIZAR PERFIL DEL USUARIO
   */
  static async updateProfile(req, res, next) {
    try {
      const uid = req.user?.uid;
      const { displayName, phone, settings } = req.body;

      if (!uid) {
        return res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'MISSING_UID',
        });
      }

      logger.info('✏️ Actualizando perfil de usuario', {
        uid,
        updates: { displayName, phone, settings },
      });

      const user = await User.getByUid(uid);
      
      if (!user) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND',
        });
      }

      // ✅ Preparar actualizaciones permitidas
      const allowedUpdates = {};
      if (displayName !== undefined) allowedUpdates.displayName = displayName;
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
        uid,
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
        uid: req.user?.uid,
      });
      next(error);
    }
  }

  /**
   * 👥 CREAR USUARIO (solo administradores)
   */
  static async createUser(req, res, next) {
    try {
      const { email, displayName, role = 'viewer', department } = req.body;
      const adminUid = req.user?.uid;

      logger.info('👥 Creación de usuario solicitada por admin', {
        adminUid,
        targetEmail: email,
        role,
        department,
      });

      // ✅ Verificar permisos de administrador
      if (!req.user?.hasRole('admin') && !req.user?.hasRole('superadmin')) {
        logger.warn('🚫 Intento de creación de usuario sin permisos', {
          adminUid,
          adminRole: req.user?.role,
        });

        return res.status(403).json({
          error: 'Permisos insuficientes',
          message: 'Solo los administradores pueden crear usuarios',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      // ✅ Crear usuario en Firebase Auth primero
      let userRecord;
      try {
        userRecord = await getAuth().createUser({
          email,
          displayName,
          emailVerified: false,
        });

        logger.info('✅ Usuario creado en Firebase Auth', {
          uid: userRecord.uid,
          email: userRecord.email,
        });
      } catch (authError) {
        logger.error('❌ Error creando usuario en Firebase Auth', {
          email,
          error: authError.message,
        });

        return res.status(400).json({
          error: 'Error creando usuario en Firebase',
          message: authError.message,
          code: 'FIREBASE_CREATE_ERROR',
        });
      }

      // ✅ Establecer claims personalizados en Firebase
      try {
        await getAuth().setCustomUserClaims(userRecord.uid, { role, department });
        logger.info('✅ Claims personalizados establecidos', {
          uid: userRecord.uid,
          role,
          department,
        });
      } catch (claimsError) {
        logger.warn('⚠️ Error estableciendo claims personalizados', {
          uid: userRecord.uid,
          error: claimsError.message,
        });
      }

      // ✅ Crear usuario en Firestore usando syncFromAuth
      let newUser;
      try {
        newUser = await User.syncFromAuth({
          uid: userRecord.uid,
          email: userRecord.email,
          displayName,
        }, {
          role,
          department,
          isActive: true,
        });

        logger.info('✅ Usuario creado completamente', {
          uid: newUser.uid,
          email: newUser.email,
          role: newUser.role,
          createdBy: adminUid,
        });
      } catch (syncError) {
        logger.error('❌ Error creando usuario en Firestore', {
          uid: userRecord.uid,
          error: syncError.message,
        });

        // Intentar limpiar el usuario de Firebase Auth si falla Firestore
        try {
          await getAuth().deleteUser(userRecord.uid);
          logger.info('🧹 Usuario eliminado de Firebase Auth tras error en Firestore', {
            uid: userRecord.uid,
          });
        } catch (cleanupError) {
          logger.error('💥 Error eliminando usuario de Firebase tras fallo', {
            uid: userRecord.uid,
            error: cleanupError.message,
          });
        }

        return res.status(500).json({
          error: 'Error creando usuario en base de datos',
          message: syncError.message,
          code: 'DATABASE_CREATE_ERROR',
        });
      }

      res.status(201).json({
        success: true,
        message: 'Usuario creado exitosamente',
        user: newUser.toJSON(),
      });
    } catch (error) {
      logger.error('💥 Error crítico creando usuario', {
        error: error.message,
        stack: error.stack,
        adminUid: req.user?.uid,
      });
      next(error);
    }
  }
}

module.exports = AuthController;
