const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const { validateRequest } = require('../middleware/validation');
const Joi = require('joi');

// Validadores específicos para autenticación
const authValidators = {
  validateLogin: validateRequest({
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required()
    })
  }),

  validateRegister: validateRequest({
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      name: Joi.string().min(1).max(100).required(),
      phone: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).optional(),
      role: Joi.string().valid('admin', 'agent', 'viewer').default('viewer')
    })
  }),

  validateRefresh: validateRequest({
    body: Joi.object({
      refreshToken: Joi.string().required()
    })
  }),

  validateLogout: validateRequest({
    body: Joi.object({
      refreshToken: Joi.string().optional()
    })
  })
};

/**
 * @route POST /api/auth/login
 * @desc Autenticar usuario con refresh tokens
 * @access Public
 */
router.post('/login',
  authValidators.validateLogin,
  AuthController.login
);

/**
 * @route POST /api/auth/refresh
 * @desc Renovar access token usando refresh token
 * @access Public
 */
router.post('/refresh',
  AuthController.refreshToken
);

/**
 * @route POST /api/auth/validate-token
 * @desc Validar token JWT (sin renovación)
 * @access Public
 */
router.post('/validate-token', 
  AuthController.validateToken
);

/**
 * @route POST /api/auth/logout
 * @desc Cerrar sesión e invalidar refresh tokens
 * @access Private
 */
router.post('/logout', 
  AuthController.logout
);

/**
 * @route GET /api/auth/profile
 * @desc Obtener perfil del usuario actual
 * @access Private
 */
router.get('/profile',
  AuthController.getProfile
);

/**
 * @route PUT /api/auth/profile
 * @desc Actualizar perfil de usuario
 * @access Private
 */
router.put('/profile', 
  AuthController.updateProfile
);

/**
 * @route POST /api/auth/change-password
 * @desc Cambiar contraseña e invalidar todas las sesiones
 * @access Private
 */
router.post('/change-password', 
  AuthController.changePassword
);

/**
 * @route POST /api/auth/create-user
 * @desc Crear nuevo usuario (solo admin)
 * @access Private (Admin)
 */
router.post('/create-user', 
  AuthController.createUser
);

/**
 * @route GET /api/auth/sessions
 * @desc Obtener sesiones activas del usuario
 * @access Private
 */
router.get('/sessions',
  AuthController.getActiveSessions
);

/**
 * @route DELETE /api/auth/sessions/:sessionId
 * @desc Cerrar sesión específica
 * @access Private
 */
router.delete('/sessions/:sessionId',
  AuthController.closeSession
);

module.exports = router;
