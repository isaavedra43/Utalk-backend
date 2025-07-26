const { getAuth } = require('firebase-admin/auth');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Middleware de autenticación con Firebase ID Token
 *
 * CRÍTICO: Este middleware valida los ID Tokens de Firebase Auth.
 * En cada petición válida, sincroniza el usuario con Firestore
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
        message: 'Se requiere un token "Bearer" de Firebase Auth.',
      });
    }

    const idToken = authHeader.substring(7); // Remover "Bearer "

    if (!idToken) {
      logger.warn('Token vacío detectado', { ip: req.ip });
      return res.status(401).json({
        error: 'Token vacío',
        message: 'El token no puede estar vacío.',
      });
    }

    // ✅ Verificar Firebase ID Token
    const decodedToken = await getAuth().verifyIdToken(idToken, true);

    // ✅ SINCRONIZACIÓN AUTOMÁTICA Auth -> Firestore
    // En cada petición, nos aseguramos que el usuario exista en nuestra BD
    // y que sus datos básicos (email, nombre) estén actualizados.
    const userFromDb = await User.syncFromAuth(decodedToken);

    if (!userFromDb) {
      logger.error('Fallo crítico: No se pudo sincronizar al usuario desde el token', {
        uid: decodedToken.uid,
        email: decodedToken.email,
        ip: req.ip,
      });
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'El usuario autenticado no pudo ser verificado en la base de datos.',
      });
    }
    
    // ✅ VERIFICACIÓN DE ESTADO: Asegurarse que el usuario no esté deshabilitado
    if (!userFromDb.isActive) {
      logger.warn('Intento de acceso de usuario inactivo', {
        uid: userFromDb.uid,
        email: userFromDb.email,
        ip: req.ip,
      });
      return res.status(403).json({
        error: 'Cuenta inactiva',
        message: 'Tu cuenta ha sido desactivada. Contacta al administrador.',
      });
    }

    // ✅ Adjuntar la instancia completa del usuario de Firestore a la petición
    req.user = userFromDb;

    logger.info('Usuario autenticado y sincronizado vía Firebase Token', {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
      ip: req.ip,
    });

    next();
  } catch (error) {
    let errorMessage = 'Token de autenticación inválido o expirado.';
    let errorDetails = {
      name: error.name,
      code: error.code,
      message: error.message,
    };

    if (error.code === 'auth/id-token-expired') {
      errorMessage = 'El token de Firebase ha expirado. Por favor, inicia sesión de nuevo.';
      logger.warn('Firebase ID token expirado', { ip: req.ip, ...errorDetails });
    } else if (error.code === 'auth/argument-error') {
      errorMessage = 'El token de Firebase proporcionado no es válido.';
      logger.warn('Token de Firebase inválido', { ip: req.ip, ...errorDetails });
    } else {
      logger.error('Error inesperado en middleware de autenticación', {
        error: error.message,
        stack: error.stack,
        ip: req.ip,
      });
      errorMessage = 'Error interno al procesar la autenticación.';
    }

    return res.status(401).json({
      error: 'Error de autenticación',
      message: errorMessage,
      details: error.code, // Enviar el código de error para debugging en frontend
    });
  }
};


/**
 * Middleware para verificar roles específicos.
 * Ahora opera sobre `req.user.role` que viene de Firestore.
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    // `req.user` es ahora una instancia de nuestro modelo User
    if (!req.user) {
      logger.warn('Usuario no autenticado intentando acceder a recurso con rol', {
        ip: req.ip,
        requiredRoles: roles,
        url: req.originalUrl,
      });
      return res.status(401).json({
        error: 'Usuario no autenticado',
        message: 'Debes estar autenticado para acceder a este recurso.',
      });
    }

    const userRole = req.user.role; // ✅ Rol viene de Firestore
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      logger.warn('Permisos insuficientes por rol', {
        uid: req.user.uid,
        userRole,
        requiredRoles: allowedRoles,
        ip: req.ip,
      });
      return res.status(403).json({
        error: 'Permisos insuficientes',
        message: `Necesitas uno de los siguientes roles: ${allowedRoles.join(', ')}`,
        requiredRoles: allowedRoles,
        userRole,
      });
    }

    logger.info('Acceso autorizado por rol', {
      uid: req.user.uid,
      userRole,
      requiredRoles: allowedRoles,
    });
    next();
  };
};

/**
 * Middleware para verificar permisos específicos.
 * Es más granular que los roles.
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user || !req.user.hasPermission) {
      logger.warn('Intento de acceso sin objeto de usuario válido para permisos', {
        ip: req.ip,
        url: req.originalUrl,
      });
      return res.status(401).json({
        error: 'Usuario no autenticado',
        message: 'No se puede verificar el permiso sin un usuario autenticado.',
      });
    }

    // La lógica de permisos está en el modelo User
    if (!req.user.hasPermission(permission)) {
      logger.warn('Permiso denegado', {
        uid: req.user.uid,
        role: req.user.role,
        requiredPermission: permission,
        userPermissions: req.user.permissions,
        ip: req.ip,
      });
      return res.status(403).json({
        error: 'Permiso denegado',
        message: `No tienes el permiso requerido: "${permission}"`,
        requiredPermission: permission,
      });
    }

    logger.info('Acceso autorizado por permiso', {
      uid: req.user.uid,
      permission,
    });
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

/**
 * Middleware para usuarios que pueden leer conversaciones (incluye viewer)
 * Para endpoints GET de conversaciones y mensajes
 */
const requireReadAccess = requireRole(['admin', 'agent', 'viewer']);

/**
 * Middleware para usuarios que pueden escribir/modificar (excluye viewer)
 * Para endpoints POST, PUT, PATCH, DELETE
 */
const requireWriteAccess = requireRole(['admin', 'agent']);

/**
 * Middleware para verificar acceso específico del viewer
 * Los viewers solo pueden leer, no escribir
 */
const requireViewerOrHigher = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Usuario no autenticado',
      message: 'Debes estar autenticado para acceder a este recurso',
    });
  }

  const userRole = req.user.role;
  const allowedRoles = ['admin', 'agent', 'viewer'];

  if (!allowedRoles.includes(userRole)) {
    logger.warn('Rol no autorizado para acceso básico', {
      uid: req.user.uid,
      userRole,
      ip: req.ip,
    });

    return res.status(403).json({
      error: 'Rol no autorizado',
      message: 'Tu rol no tiene acceso a este sistema',
    });
  }

  // Log de acceso para auditoria
  logger.info('Acceso autorizado para viewer o superior', {
    uid: req.user.uid,
    userRole,
    method: req.method,
    url: req.originalUrl,
  });

  next();
};


// EXPORTS ACTUALIZADOS
module.exports = {
  authMiddleware,
  requireRole,
  requirePermission, // ✅ Exportar nuevo middleware de permisos
  requireAdmin,
  requireAgentOrAdmin,
  requireReadAccess,
  requireWriteAccess,
  requireViewerOrHigher,
};
