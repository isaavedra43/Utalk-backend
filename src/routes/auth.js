const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { authMiddleware } = require('../middleware/auth');
const AuthController = require('../controllers/AuthController');

const router = express.Router();

/**
 * @route POST /api/auth/login
 * @desc Login con Firebase
 * @access Public
 */
router.post('/login', validate(schemas.auth.login), AuthController.login);

/**
 * @route POST /api/auth/logout
 * @desc Logout
 * @access Private
 */
router.post('/logout', authMiddleware, AuthController.logout);

// NOTA: En sistema UID-first, el refresh se maneja directamente en el frontend con Firebase SDK
// No necesitamos endpoint de refresh en el backend

/**
 * @route GET /api/auth/me
 * @desc Obtener información del usuario actual
 * @access Private - CRÍTICO: Requiere JWT válido
 */
router.get('/me', authMiddleware, AuthController.getProfile);

/**
 * @route PUT /api/auth/profile
 * @desc Actualizar perfil del usuario
 * @access Private
 */
router.put('/profile', authMiddleware, AuthController.updateProfile);

/**
 * @route POST /api/auth/change-password
 * @desc Cambiar contraseña del usuario
 * @access Private
 */
router.post('/change-password', authMiddleware, validate(schemas.auth.changePassword), AuthController.changePassword);

/**
 * @route POST /api/auth/create-user
 * @desc Crear nuevo usuario (solo administradores)
 * @access Private - Admin only
 */
router.post('/create-user', authMiddleware, validate(schemas.auth.createUser), AuthController.createUser);

// EXPORT PATTERN: Single router export (STANDARD for all routes)
// USAGE: const authRoutes = require('./routes/auth');
module.exports = router;
