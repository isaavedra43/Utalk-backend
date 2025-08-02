const User = require('../models/User');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const { getAccessTokenConfig } = require('../config/jwt');

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
        category: 'AUTH_MISSING_TOKEN',
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
      logger.warn('Token vacío detectado', { 
        category: 'AUTH_EMPTY_TOKEN',
        ip: req.ip 
      });
      return res.status(401).json({
        error: 'Token vacío',
        message: 'El token no puede estar vacío.',
        code: 'EMPTY_TOKEN',
      });
    }

    // Verificar JWT interno con configuración centralizada
    const jwtConfig = getAccessTokenConfig();
    
    if (!jwtConfig.secret) {
      logger.error('💥 JWT_SECRET no configurado en servidor', {
        category: 'AUTH_CONFIG_ERROR'
      });
      return res.status(500).json({
        error: 'Error de configuración del servidor',
        message: 'Servidor mal configurado.',
        code: 'SERVER_CONFIG_ERROR',
      });
    }

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, jwtConfig.secret, {
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      });
      
      // ✅ VALIDACIÓN ADICIONAL DE CLAIMS CRÍTICOS
      if (!decodedToken.email) {
        logger.error('Token sin claim email requerido', {
          category: 'AUTH_INVALID_CLAIMS',
          tokenPayload: decodedToken,
          ip: req.ip,
        });
        return res.status(401).json({
          error: 'Token inválido',
          message: 'El token no contiene el email requerido.',
          code: 'MISSING_EMAIL_CLAIM',
        });
      }
      
      if (!decodedToken.role) {
        logger.warn('Token sin claim role', {
          category: 'AUTH_MISSING_ROLE',
          email: decodedToken.email,
          ip: req.ip,
        });
        // No es crítico, pero es recomendable
      }
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

      logger.warn('JWT inválido', {
        category: 'AUTH_JWT_ERROR',
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

    // OBTENER usuario completo desde Firestore usando email del token
    const email = decodedToken.email;
    
    if (!email) {
      logger.error('Token sin email', {
        category: 'AUTH_NO_EMAIL',
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
      logger.error('Usuario del token no encontrado en Firestore', {
        category: 'AUTH_USER_NOT_FOUND',
        email,
        ip: req.ip,
      });
      return res.status(403).json({
        error: 'Usuario no encontrado',
        message: 'El usuario autenticado no existe en la base de datos.',
        code: 'USER_NOT_FOUND',
      });
    }
    
    // VERIFICACIÓN DE ESTADO: Asegurarse que el usuario esté activo
    if (!userFromDb.isActive) {
      logger.warn('Intento de acceso de usuario inactivo', {
        category: 'AUTH_USER_INACTIVE',
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

    // Adjuntar la instancia completa del usuario de Firestore a la petición
    req.user = userFromDb;

    logger.debug('Usuario autenticado correctamente', {
      category: 'AUTH_SUCCESS',
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      ip: req.ip,
      url: req.originalUrl,
    });

    next();
  } catch (error) {
    logger.error('💥 Error inesperado en middleware de autenticación', {
      category: 'AUTH_SYSTEM_ERROR',
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
 * 🛡️ MIDDLEWARE UNIFICADO PARA ROLES
 * Middleware estándar para requerir roles específicos
 * Acepta tanto string como array de roles
 */
const requireRole = (allowedRoles) => {
  // Normalizar a array
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req, res, next) => {
    if (!req.user) {
      logger.warn('Intento de acceso sin autenticación', {
        category: 'ROLE_NOT_AUTHENTICATED',
        ip: req.ip,
        url: req.originalUrl
      });
      return res.status(401).json({
        error: 'Usuario no autenticado',
        message: 'Se requiere autenticación para acceder a este recurso',
        code: 'NOT_AUTHENTICATED',
      });
    }

    // Verificar si el usuario tiene al menos uno de los roles permitidos
    const userRole = req.user.role;
    const hasRequiredRole = roles.includes(userRole);

    if (!hasRequiredRole) {
      logger.warn('🚫 Acceso denegado por rol insuficiente', {
        category: 'ROLE_ACCESS_DENIED',
        email: req.user.email,
        userRole: userRole,
        requiredRoles: roles,
        ip: req.ip,
        url: req.originalUrl
      });

      return res.status(403).json({
        error: 'Permisos insuficientes',
        message: `Se requiere uno de los siguientes roles: ${roles.join(', ')}`,
        code: 'INSUFFICIENT_ROLE',
      });
    }

    logger.debug('Acceso autorizado por rol', {
      category: 'ROLE_ACCESS_GRANTED',
      email: req.user.email,
      userRole: userRole,
      requiredRoles: roles,
      url: req.originalUrl
    });

    next();
  };
};

/**
 * 🔒 MIDDLEWARES ESPECÍFICOS ESTANDARIZADOS
 * Todos basados en requireRole para consistencia
 */

// Solo administradores
const requireAdmin = requireRole(['admin']);

// Administradores y superadmins
const requireAdminOrSuperAdmin = requireRole(['admin', 'superadmin']);

// Cualquier rol con permisos de escritura
const requireWriteAccess = requireRole(['admin', 'superadmin', 'agent']);

// Cualquier rol con permisos de lectura (todos los usuarios activos)
const requireReadAccess = (req, res, next) => {
  if (!req.user) {
    logger.warn('Intento de lectura sin autenticación', {
      category: 'READ_NOT_AUTHENTICATED',
      ip: req.ip,
      url: req.originalUrl
    });
    return res.status(401).json({
      error: 'Usuario no autenticado',
      message: 'Se requiere autenticación para leer este recurso',
      code: 'NOT_AUTHENTICATED',
    });
  }

  // Todos los usuarios autenticados tienen acceso de lectura básico
  // Los permisos específicos se validan en los controladores
  next();
};

/**
 * 🧩 MIDDLEWARE PARA PERMISOS ESPECÍFICOS
 * Para casos donde se necesitan permisos granulares
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuario no autenticado',
        code: 'NOT_AUTHENTICATED',
      });
    }

    if (!req.user.hasPermission || !req.user.hasPermission(permission)) {
      logger.warn('🚫 Acceso denegado por permiso insuficiente', {
        category: 'PERMISSION_ACCESS_DENIED',
        email: req.user.email,
        requiredPermission: permission,
        userPermissions: req.user.permissions || [],
        userRole: req.user.role,
        ip: req.ip,
        url: req.originalUrl
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

/**
 * 🎯 MIDDLEWARE PARA VALIDAR PROPIETARIO O ADMIN
 * Permite acceso si el usuario es propietario del recurso o admin
 */
const requireOwnerOrAdmin = (resourceIdParam = 'id', userIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuario no autenticado',
        code: 'NOT_AUTHENTICATED',
      });
    }

    const resourceId = req.params[resourceIdParam];
    const userId = req.user.id;
    const userRole = req.user.role;

    // Admins tienen acceso completo
    if (userRole === 'admin' || userRole === 'superadmin') {
      return next();
    }

    // Para otros usuarios, verificar ownership
    // Esta verificación se puede extender según el modelo de datos
    if (req.body && req.body[userIdField] && req.body[userIdField] !== userId) {
      logger.warn('🚫 Acceso denegado: no es propietario del recurso', {
        category: 'OWNERSHIP_ACCESS_DENIED',
        email: req.user.email,
        userId: userId,
        resourceId: resourceId,
        ip: req.ip,
        url: req.originalUrl
      });

      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo puedes acceder a tus propios recursos',
        code: 'NOT_OWNER',
      });
    }

    next();
  };
};

module.exports = {
  authMiddleware,
  requireRole,
  requireAdmin,
  requireAdminOrSuperAdmin,
  requireWriteAccess,
  requireReadAccess,
  requirePermission,
  requireOwnerOrAdmin,
  
  // Deprecated - mantener para compatibilidad temporal
  requireAgentOrAdmin: requireRole(['admin', 'superadmin', 'agent']), // TODO: Migrar a requireWriteAccess
  requireViewerOrHigher: requireReadAccess // TODO: Migrar a requireReadAccess
};
