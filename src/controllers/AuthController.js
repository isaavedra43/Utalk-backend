const { auth } = require('../config/firebase');
const User = require('../models/User');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');

class AuthController {
  /**
   * Login con Firebase
   */
  static async login (req, res, next) {
    try {
      const { email } = req.body;
      const user = await User.getByEmail(email);

      if (!user || user.status !== 'active') {
        return res.status(401).json({ error: 'Credenciales inválidas o usuario inactivo' });
      }

      await user.updateLastLogin();

      const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn }
      );

      logger.info('Login exitoso', { userId: user.id });

      res.json({
        token,
        user: user.toJSON(),
        expiresIn,
      });
    } catch (error) { next(error); }
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
        status: 'active'
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
