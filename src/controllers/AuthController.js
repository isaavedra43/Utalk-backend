const { auth } = require('../config/firebase');
const User = require('../models/User');
const logger = require('../utils/logger');

class AuthController {
  /**
   * Login con Firebase
   */
  static async login (req, res, next) {
    try {
      const { email, password } = req.body;

      // Nota: En Firebase Auth, la verificación de credenciales se hace en el frontend
      // Aquí solo verificamos que el usuario existe y lo creamos/actualizamos en Firestore

      logger.info('Intento de login', { email });

      // Buscar o crear usuario en Firestore
      const user = await User.getByEmail(email);

      if (!user) {
        // Si el usuario no existe en Firestore pero tiene token válido de Firebase,
        // lo creamos (esto se maneja mejor en el middleware de auth)
        return res.status(400).json({
          error: 'Usuario no encontrado',
          message: 'El usuario debe ser creado primero por un administrador',
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          error: 'Usuario desactivado',
          message: 'Tu cuenta ha sido desactivada. Contacta al administrador.',
        });
      }

      // Actualizar último login
      await user.updateLastLogin();

      logger.info('Login exitoso', {
        uid: user.uid,
        email: user.email,
        role: user.role,
      });

      res.json({
        message: 'Login exitoso',
        user: user.toJSON(),
      });
    } catch (error) {
      logger.error('Error en login:', error);
      next(error);
    }
  }

  /**
   * Logout
   */
  static async logout (req, res, next) {
    try {
      const { uid } = req.user;

      // Revocar tokens de Firebase (opcional)
      // await auth.revokeRefreshTokens(uid);

      logger.info('Logout exitoso', { uid });

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
      const { refreshToken } = req.body;

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
      const { uid } = req.user;

      const user = await User.getByUid(uid);
      if (!user) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: 'El usuario no existe en la base de datos',
        });
      }

      res.json({
        user: user.toJSON(),
      });
    } catch (error) {
      logger.error('Error al obtener perfil:', error);
      next(error);
    }
  }

  /**
   * Actualizar perfil del usuario
   */
  static async updateProfile (req, res, next) {
    try {
      const { uid } = req.user;
      const updates = req.body;

      // Campos que no se pueden actualizar por el usuario
      const forbiddenFields = ['uid', 'email', 'role', 'isActive', 'createdAt'];
      forbiddenFields.forEach(field => delete updates[field]);

      const user = await User.getByUid(uid);
      if (!user) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: 'El usuario no existe en la base de datos',
        });
      }

      await user.update(updates);

      logger.info('Perfil actualizado', {
        uid,
        updates: Object.keys(updates),
      });

      res.json({
        message: 'Perfil actualizado exitosamente',
        user: user.toJSON(),
      });
    } catch (error) {
      logger.error('Error al actualizar perfil:', error);
      next(error);
    }
  }

  /**
   * Crear usuario (solo administradores)
   */
  static async createUser (req, res, next) {
    try {
      const { email, displayName, role = 'viewer' } = req.body;
      const { uid: adminUid } = req.user;

      // Verificar que es administrador
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Permisos insuficientes',
          message: 'Solo los administradores pueden crear usuarios',
        });
      }

      // Crear usuario en Firebase Auth
      const userRecord = await auth.createUser({
        email,
        displayName,
        emailVerified: false,
      });

      // Establecer claims personalizados
      await auth.setCustomUserClaims(userRecord.uid, { role });

      // Crear usuario en Firestore
      const user = await User.create({
        uid: userRecord.uid,
        email,
        displayName,
        role,
      });

      logger.info('Usuario creado', {
        uid: user.uid,
        email: user.email,
        role: user.role,
        createdBy: adminUid,
      });

      res.status(201).json({
        message: 'Usuario creado exitosamente',
        user: user.toJSON(),
      });
    } catch (error) {
      logger.error('Error al crear usuario:', error);
      next(error);
    }
  }
}

module.exports = AuthController;
