const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');

/**
 * Middleware de autenticación con JWT propio (NO Firebase ID Token)
 *
 * CRÍTICO: Este middleware ahora valida ÚNICAMENTE nuestro JWT generado internamente
 * por el backend en el login, NO los tokens de Firebase Auth.
 *
 * El JWT contiene: { uid, email, role } y está firmado con JWT_SECRET
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Validación estricta del header Authorization
    if (!authHeader) {
      logger.warn('Token de autorización faltante', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl,
      });

      return res.status(401).json({
        error: 'Token de autorización requerido',
        message: 'Debes incluir el header Authorization con un token Bearer válido',
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      logger.warn('Formato de token inválido', {
        ip: req.ip,
        authHeader: authHeader.substring(0, 20) + '...', // Solo primeros caracteres por seguridad
      });

      return res.status(401).json({
        error: 'Formato de token inválido',
        message: 'El token debe tener el formato "Bearer <token>"',
      });
    }

    const token = authHeader.substring(7); // Remover "Bearer "

    if (!token) {
      logger.warn('Token vacío detectado', { ip: req.ip });

      return res.status(401).json({
        error: 'Token vacío',
        message: 'El token no puede estar vacío',
      });
    }

    // CRÍTICO: Verificar JWT propio (NO Firebase ID Token)
    jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
      if (error) {
        // Logs específicos por tipo de error JWT
        if (error.name === 'TokenExpiredError') {
          logger.warn('Token JWT expirado', {
            ip: req.ip,
            expiredAt: error.expiredAt,
          });

          return res.status(401).json({
            error: 'Token expirado',
            message: 'El token ha expirado, por favor inicia sesión nuevamente',
          });
        }

        if (error.name === 'JsonWebTokenError') {
          logger.warn('Token JWT inválido', {
            ip: req.ip,
            error: error.message,
          });

          return res.status(401).json({
            error: 'Token inválido',
            message: 'El token proporcionado no es válido',
          });
        }

        if (error.name === 'NotBeforeError') {
          logger.warn('Token JWT usado antes de tiempo', {
            ip: req.ip,
            notBefore: error.date,
          });

          return res.status(401).json({
            error: 'Token no válido aún',
            message: 'El token no es válido todavía',
          });
        }

        // Error genérico
        logger.error('Error al verificar JWT', {
          ip: req.ip,
          error: error.message,
          name: error.name,
        });

        return res.status(401).json({
          error: 'Error de autenticación',
          message: 'No se pudo verificar el token de autenticación',
        });
      }

      // IMPORTANTE: Construir req.user SOLO con propiedades del JWT propio
      // NO incluimos propiedades específicas de Firebase como emailVerified, photoURL, etc.
      // Ajustamos al contrato centralizado: solo id, email y role.
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      };

      logger.info('Usuario autenticado con JWT propio', {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        ip: req.ip,
      });

      next();
    });
  } catch (error) {
    logger.error('Error inesperado en middleware de autenticación', {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    });

    return res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error inesperado al procesar la autenticación',
    });
  }
};

/**
 * Middleware para verificar roles específicos
 * COMPATIBLE: Funciona igual que antes, pero ahora con JWT propio
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      logger.warn('Usuario no autenticado intentando acceder a recurso con rol', {
        ip: req.ip,
        requiredRoles: roles,
      });

      return res.status(401).json({
        error: 'Usuario no autenticado',
        message: 'Debes estar autenticado para acceder a este recurso',
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      logger.warn('Permisos insuficientes', {
        id: req.user.id,
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
      id: req.user.id,
      userRole,
      requiredRoles: allowedRoles,
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
      id: req.user.id,
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
    id: req.user.id,
    userRole,
    method: req.method,
    url: req.originalUrl,
  });

  next();
};

// IMPORTANTE: Este middleware ahora usa JWT propio (jsonwebtoken), NO Firebase ID Token
// Propiedades disponibles en req.user después de autenticación:
// - uid: string (ID único del usuario)
// - email: string (email del usuario)
// - role: string (rol: 'admin', 'agent', 'viewer')
module.exports = {
  authMiddleware,
  requireRole,
  requireAdmin,
  requireAgentOrAdmin,
  requireReadAccess,
  requireWriteAccess,
  requireViewerOrHigher,
};
