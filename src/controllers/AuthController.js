const { auth } = require('../config/firebase');
const User = require('../models/User');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');

class AuthController {
  /**
   * 🔒 LOGIN EXCLUSIVO VÍA FIREBASE AUTH
   * ALINEADO 100% CON FRONTEND - Solo acepta idToken de Firebase
   */
  static async login (req, res, next) {
    try {
      const { idToken } = req.body;

      // ✅ VALIDACIÓN: Solo aceptar idToken
      if (!idToken) {
        return res.status(400).json({
          error: 'Token de Firebase requerido',
          message: 'Debes proporcionar un idToken válido de Firebase Auth',
        });
      }

      // ✅ VALIDAR idToken con Firebase Admin SDK
      let decodedToken;
      try {
        decodedToken = await auth.verifyIdToken(idToken);
      } catch (firebaseError) {
        logger.warn('Token de Firebase inválido', {
          error: firebaseError.message,
          ip: req.ip,
        });

        return res.status(401).json({
          error: 'Token inválido',
          message: 'El token de Firebase proporcionado no es válido',
        });
      }

      // ✅ OBTENER información del usuario desde Firebase
      const { uid, email, name, email_verified: emailVerified } = decodedToken;

      if (!email) {
        return res.status(400).json({
          error: 'Email requerido',
          message: 'El usuario debe tener un email válido en Firebase',
        });
      }

      // ✅ SINCRONIZAR usuario en Firestore (crear si no existe)
      let user = await User.getById(uid);

      if (!user) {
        // Crear usuario en Firestore sincronizado con Firebase
        try {
          user = await User.create({
            id: uid,
            email,
            name: name || email.split('@')[0], // Usar email como fallback
            role: 'viewer', // Rol por defecto
            status: 'active',
            emailVerified,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          logger.info('Usuario creado automáticamente desde Firebase', {
            userId: uid,
            email,
          });
        } catch (createError) {
          logger.error('Error creando usuario desde Firebase', {
            userId: uid,
            email,
            error: createError.message,
          });

          return res.status(500).json({
            error: 'Error creando usuario',
            message: 'No se pudo crear el usuario en el sistema',
          });
        }
      } else {
        // Actualizar información si ha cambiado en Firebase
        const updates = {};
        if (user.email !== email) updates.email = email;
        if (user.name !== name && name) updates.name = name;
        if (user.emailVerified !== emailVerified) updates.emailVerified = emailVerified;

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = new Date();
          await user.update(updates);
          logger.info('Usuario actualizado desde Firebase', { userId: uid, updates });
        }
      }

      // ✅ VERIFICAR que el usuario esté activo
      if (user.status !== 'active') {
        return res.status(401).json({
          error: 'Usuario inactivo',
          message: 'Tu cuenta ha sido desactivada. Contacta al administrador.',
        });
      }

      // ✅ GENERAR JWT PROPIO para la API
      const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
      const token = jwt.sign(
        {
          id: user.id, // uid de Firebase
          email: user.email,
          role: user.role,
          uid: user.id, // Compatibilidad
        },
        process.env.JWT_SECRET,
        { expiresIn },
      );

      logger.info('Login exitoso via Firebase', {
        userId: user.id,
        email: user.email,
        role: user.role,
        ip: req.ip,
      });

      // ✅ ESTRUCTURA CANÓNICA EXACTA según especificación
      res.json({
        user: user.toJSON(),
        token,
      });
    } catch (error) {
      logger.error('Error en login Firebase', {
        error: error.message,
        stack: error.stack,
        ip: req.ip,
      });
      next(error);
    }
  }

  /**
   * Logout
   */
  static async logout (req, res, next) {
    try {
      const { id } = req.user;

      // Revocar tokens de Firebase (opcional)
      // await auth.revokeRefreshTokens(id);

      logger.info('Logout exitoso', { id });

      res.json({
        message: 'Logout exitoso',
      });
    } catch (error) {
      logger.error('Error en logout:', error);
      next(error);
    }
  }

  /**
   * Refrescar token
   */
  static async refreshToken (req, res, next) {
    try {
      // Nota: El refresh de tokens se maneja en el frontend con Firebase SDK
      // Aquí podríamos implementar lógica adicional si es necesario

      res.json({
        message: 'Token refrescado exitosamente',
      });
    } catch (error) {
      logger.error('Error al refrescar token:', error);
      next(error);
    }
  }

  /**
   * Obtener perfil del usuario actual
   */
  static async getProfile (req, res, next) {
    try {
      const { id } = req.user; // id desde el token JWT
      const user = await User.getById(id);
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
      res.json({ user: user.toJSON() });
    } catch (error) { next(error); }
  }

  /**
   * Actualizar perfil del usuario
   */
  static async updateProfile (req, res, next) {
    try {
      const { id } = req.user;
      const { name } = req.body; // Solo 'name' es actualizable por el usuario
      const user = await User.getById(id);
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      await user.update({ name });
      logger.info('Perfil actualizado', { userId: id });

      res.json({
        message: 'Perfil actualizado exitosamente',
        user: user.toJSON(),
      });
    } catch (error) { next(error); }
  }

  /**
   * Crear usuario (solo administradores)
   */
  static async createUser (req, res, next) {
    try {
      const { email, name, role = 'viewer' } = req.body;

      // Verificar que es administrador
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Permisos insuficientes',
          message: 'Solo los administradores pueden crear usuarios',
        });
      }

      // Crear usuario en Firebase Auth
      const userRecord = await auth.createUser({ email, displayName: name });

      // Establecer claims personalizados
      await auth.setCustomUserClaims(userRecord.uid, { role });

      // Crear usuario en Firestore
      const newUser = await User.create({
        id: userRecord.uid,
        email,
        name,
        role,
        status: 'active',
      });
      logger.info('Usuario creado', { newUserId: newUser.id, createdBy: req.user.id });

      res.status(201).json({
        message: 'Usuario creado exitosamente',
        user: newUser.toJSON(),
      });
    } catch (error) { next(error); }
  }
}

module.exports = AuthController;
