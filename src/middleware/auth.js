const User = require('../models/User');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');

/**
 * Middleware de autenticación con JWT INTERNO
 *
 * CRÍTICO: Este middleware valida los JWT generados por nuestro backend.
 * En cada petición válida, obtiene el usuario completo desde Firestore
 * y adjunta la instancia del modelo User a `req.user`.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Token de autorización faltante o con formato incorrecto', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl,
        authHeader: authHeader ? authHeader.substring(0, 20) + '...' : 'N/A',
      });
      return res.status(401).json({
        error: 'Token de autorización inválido',
        message: 'Se requiere un token "Bearer" válido.',
        code: 'MISSING_TOKEN',
      });
    }

    const token = authHeader.substring(7); // Remover "Bearer "

    if (!token) {
      logger.warn('Token vacío detectado', { ip: req.ip });
      return res.status(401).json({
        error: 'Token vacío',
        message: 'El token no puede estar vacío.',
        code: 'EMPTY_TOKEN',
      });
    }

    // ✅ Verificar JWT interno con JWT_SECRET
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      logger.error('💥 JWT_SECRET no configurado en servidor');
      return res.status(500).json({
        error: 'Error de configuración del servidor',
        message: 'Servidor mal configurado.',
        code: 'SERVER_CONFIG_ERROR',
      });
    }

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, jwtSecret, {
        issuer: 'utalk-backend',
        audience: 'utalk-frontend',
      });
    } catch (jwtError) {
      let errorMessage = 'Token inválido o expirado.';
      let errorCode = 'INVALID_TOKEN';

      if (jwtError.name === 'TokenExpiredError') {
        errorMessage = 'El token ha expirado. Por favor, inicia sesión de nuevo.';
        errorCode = 'TOKEN_EXPIRED';
      } else if (jwtError.name === 'JsonWebTokenError') {
        errorMessage = 'El token proporcionado no es válido.';
        errorCode = 'MALFORMED_TOKEN';
      } else if (jwtError.name === 'NotBeforeError') {
        errorMessage = 'El token aún no es válido.';
        errorCode = 'TOKEN_NOT_ACTIVE';
      }

      logger.warn('❌ JWT inválido', {
        error: jwtError.message,
        name: jwtError.name,
        ip: req.ip,
        tokenPrefix: token ? token.substring(0, 20) + '...' : 'N/A',
      });

      return res.status(401).json({
        error: 'Token inválido',
        message: errorMessage,
        code: errorCode,
      });
    }

    // ✅ OBTENER usuario completo desde Firestore usando email del token
    const email = decodedToken.email;
    
    if (!email) {
      logger.error('❌ Token sin email', {
        tokenPayload: decodedToken,
        ip: req.ip,
      });
      return res.status(401).json({
        error: 'Token inválido',
        message: 'El token no contiene un email válido.',
        code: 'INVALID_TOKEN_PAYLOAD',
      });
    }

    const userFromDb = await User.getByEmail(email);

    if (!userFromDb) {
      logger.error('❌ Usuario del token no encontrado en Firestore', {
        email,
        ip: req.ip,
      });
      return res.status(403).json({
        error: 'Usuario no encontrado',
        message: 'El usuario autenticado no existe en la base de datos.',
        code: 'USER_NOT_FOUND',
      });
    }
    
    // ✅ VERIFICACIÓN DE ESTADO: Asegurarse que el usuario esté activo
    if (!userFromDb.isActive) {
      logger.warn('❌ Intento de acceso de usuario inactivo', {
        email: userFromDb.email,
        name: userFromDb.name,
        ip: req.ip,
      });
      return res.status(403).json({
        error: 'Cuenta inactiva',
        message: 'Tu cuenta ha sido desactivada. Contacta al administrador.',
        code: 'USER_INACTIVE',
      });
    }

    // ✅ Adjuntar la instancia completa del usuario de Firestore a la petición
    req.user = userFromDb;

    logger.info('✅ Usuario autenticado correctamente', {
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      ip: req.ip,
      url: req.originalUrl,
    });

    next();
  } catch (error) {
    logger.error('💥 Error inesperado en middleware de autenticación', {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      url: req.originalUrl,
    });

    return res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error procesando la autenticación.',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Middleware para requerir rol específico
 */
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuario no autenticado',
        code: 'NOT_AUTHENTICATED',
      });
    }

    if (!req.user.hasRole(role)) {
      logger.warn('🚫 Acceso denegado por rol insuficiente', {
        email: req.user.email,
        requiredRole: role,
        userRole: req.user.role,
        ip: req.ip,
      });

      return res.status(403).json({
        error: 'Permisos insuficientes',
        message: `Se requiere rol: ${role}`,
        code: 'INSUFFICIENT_ROLE',
      });
    }

    next();
  };
};

/**
 * Middleware para requerir ser administrador
 */
const requireAdmin = requireRole('admin');

/**
 * Middleware para requerir ser administrador o superadmin
 */
const requireAgentOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Usuario no autenticado',
      code: 'NOT_AUTHENTICATED',
    });
  }

  const allowedRoles = ['admin', 'superadmin', 'agent'];
  if (!allowedRoles.includes(req.user.role)) {
    logger.warn('🚫 Acceso denegado: Se requiere rol de agente o admin', {
      email: req.user.email,
      userRole: req.user.role,
      allowedRoles,
      ip: req.ip,
    });

    return res.status(403).json({
      error: 'Permisos insuficientes',
      message: 'Se requiere ser agente o administrador',
      code: 'INSUFFICIENT_ROLE',
    });
  }

  next();
};

/**
 * Middleware para requerir acceso de lectura
 */
const requireReadAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Usuario no autenticado',
      code: 'NOT_AUTHENTICATED',
    });
  }

  // Todos los usuarios activos tienen acceso de lectura básico
  // Los permisos específicos se validan en los controladores
  next();
};

/**
 * Middleware para requerir acceso de escritura
 */
const requireWriteAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Usuario no autenticado',
      code: 'NOT_AUTHENTICATED',
    });
  }

  const writeRoles = ['admin', 'superadmin', 'agent'];
  if (!writeRoles.includes(req.user.role)) {
    logger.warn('🚫 Acceso de escritura denegado', {
      email: req.user.email,
      userRole: req.user.role,
      writeRoles,
      ip: req.ip,
    });

    return res.status(403).json({
      error: 'Permisos de escritura insuficientes',
      message: 'No tienes permisos para realizar esta acción',
      code: 'INSUFFICIENT_WRITE_ACCESS',
    });
  }

  next();
};

/**
 * Middleware para requerir nivel viewer o superior
 */
const requireViewerOrHigher = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Usuario no autenticado',
      code: 'NOT_AUTHENTICATED',
    });
  }

  // Todos los usuarios activos tienen al menos nivel viewer
  next();
};

/**
 * Middleware para requerir permiso específico
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuario no autenticado',
        code: 'NOT_AUTHENTICATED',
      });
    }

    if (!req.user.hasPermission(permission)) {
      logger.warn('🚫 Acceso denegado por permiso insuficiente', {
        email: req.user.email,
        requiredPermission: permission,
        userPermissions: req.user.permissions,
        userRole: req.user.role,
        ip: req.ip,
      });

      return res.status(403).json({
        error: 'Permisos insuficientes',
        message: `Se requiere permiso: ${permission}`,
        code: 'INSUFFICIENT_PERMISSION',
      });
    }

    next();
  };
};

module.exports = {
  authMiddleware,
  requireRole,
  requireAdmin,
  requireAgentOrAdmin,
  requireReadAccess,
  requireWriteAccess,
  requireViewerOrHigher,
  requirePermission,
};
