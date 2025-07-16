const { auth } = require('../config/firebase');
const logger = require('../utils/logger');

/**
 * Middleware de autenticación con Firebase Auth
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Token de autorización requerido',
        message: 'Debes incluir el header Authorization con un token Bearer válido',
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Formato de token inválido',
        message: 'El token debe tener el formato "Bearer <token>"',
      });
    }

    const token = authHeader.substring(7); // Remover "Bearer "

    if (!token) {
      return res.status(401).json({
        error: 'Token vacío',
        message: 'El token no puede estar vacío',
      });
    }

    // Verificar el token con Firebase
    const decodedToken = await auth.verifyIdToken(token);
    
    // Obtener información adicional del usuario
    const userRecord = await auth.getUser(decodedToken.uid);
    
    // Agregar información del usuario al request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      displayName: userRecord.displayName,
      photoURL: userRecord.photoURL,
      role: decodedToken.role || 'viewer', // Rol por defecto
      claims: decodedToken,
    };

    logger.info('Usuario autenticado:', {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
    });

    next();
  } catch (error) {
    logger.error('Error de autenticación:', error);

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: 'Token expirado',
        message: 'El token ha expirado, por favor inicia sesión nuevamente',
      });
    }

    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({
        error: 'Token revocado',
        message: 'El token ha sido revocado, por favor inicia sesión nuevamente',
      });
    }

    if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'El token proporcionado no es válido',
      });
    }

    return res.status(401).json({
      error: 'Error de autenticación',
      message: 'No se pudo verificar el token de autenticación',
    });
  }
};

/**
 * Middleware para verificar roles específicos
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuario no autenticado',
        message: 'Debes estar autenticado para acceder a este recurso',
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Permisos insuficientes',
        message: `Necesitas uno de los siguientes roles: ${allowedRoles.join(', ')}`,
        requiredRoles: allowedRoles,
        userRole: userRole,
      });
    }

    next();
  };
};

/**
 * Middleware para verificar si el usuario es administrador
 */
const requireAdmin = requireRole(['admin']);

/**
 * Middleware para verificar si el usuario es agente o administrador
 */
const requireAgentOrAdmin = requireRole(['agent', 'admin']);

// EXPORT PATTERN: Object with multiple middleware functions
// This pattern allows importing specific middlewares with destructuring:
// const { authMiddleware, requireAdmin } = require('./auth');
module.exports = {
  authMiddleware,
  requireRole,
  requireAdmin,
  requireAgentOrAdmin,
}; 