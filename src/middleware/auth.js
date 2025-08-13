const User = require('../models/User');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const { getAccessTokenConfig } = require('../config/jwt');

/**
 * Middleware de autenticación con JWT INTERNO - SUPER ROBUSTO
 *
 * CRÍTICO: Este middleware valida los JWT generados por nuestro backend.
 * En cada petición válida, obtiene el usuario completo desde Firestore
 * y adjunta la instancia del modelo User a `req.user`.
 * 
 * @version 2.0.0 - Super robusto con mejor manejo de errores
 */
const authMiddleware = async (req, res, next) => {
  const startTime = Date.now();
  const requestId = req.requestId || 'unknown';
  
  try {
    // ✅ SUPER ROBUSTO: Logging de inicio de autenticación
    logger.info('🔐 Iniciando autenticación', {
      category: 'AUTH_START',
      requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent')?.substring(0, 100),
      url: req.originalUrl,
      method: req.method
    });

    const authHeader = req.headers.authorization;

    // ✅ SUPER ROBUSTO: Validación mejorada del header de autorización
    if (!authHeader) {
      logger.warn('Token de autorización faltante', {
        category: 'AUTH_MISSING_HEADER',
        requestId,
        ip: req.ip,
        userAgent: req.get('User-Agent')?.substring(0, 100),
        url: req.originalUrl
      });
      return res.status(401).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'MISSING_AUTHORIZATION_HEADER',
          message: 'Header de autorización requerido.',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      logger.warn('Formato de autorización incorrecto', {
        category: 'AUTH_INVALID_FORMAT',
        requestId,
        ip: req.ip,
        authHeader: authHeader.substring(0, 20) + '...',
        url: req.originalUrl
      });
      return res.status(401).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'INVALID_AUTHORIZATION_FORMAT',
          message: 'Formato de autorización debe ser "Bearer <token>".',
          timestamp: new Date().toISOString()
        }
      });
    }

    const token = authHeader.substring(7); // Remover "Bearer "

    // ✅ SUPER ROBUSTO: Validación mejorada del token
    if (!token || token.trim().length === 0) {
      logger.warn('Token vacío o solo espacios', { 
        category: 'AUTH_EMPTY_TOKEN',
        requestId,
        ip: req.ip,
        url: req.originalUrl
      });
      return res.status(401).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'EMPTY_TOKEN',
          message: 'El token no puede estar vacío.',
          timestamp: new Date().toISOString()
        }
      });
    }

    // ✅ SUPER ROBUSTO: Verificar configuración JWT
    const jwtConfig = getAccessTokenConfig();
    
    if (!jwtConfig || !jwtConfig.secret) {
      logger.error('💥 JWT_SECRET no configurado en servidor', {
        category: 'AUTH_CONFIG_ERROR',
        requestId,
        hasConfig: !!jwtConfig,
        hasSecret: !!(jwtConfig && jwtConfig.secret)
      });
      return res.status(500).json({
        success: false,
        error: {
          type: 'SERVER_ERROR',
          code: 'JWT_CONFIG_MISSING',
          message: 'Error de configuración del servidor.',
          timestamp: new Date().toISOString()
        }
      });
    }

    // ✅ SUPER ROBUSTO: Verificación JWT con mejor manejo de errores
    let decodedToken;
    try {
      decodedToken = jwt.verify(token, jwtConfig.secret, {
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
        algorithms: ['HS256'], // ✅ SUPER ROBUSTO: Especificar algoritmo
        clockTolerance: 30, // ✅ SUPER ROBUSTO: Tolerancia de 30 segundos
      });
      
      logger.info('✅ Token JWT verificado exitosamente', {
        category: 'AUTH_JWT_SUCCESS',
        requestId,
        email: decodedToken.email,
        role: decodedToken.role,
        exp: decodedToken.exp,
        iat: decodedToken.iat
      });
      
    } catch (jwtError) {
      // ✅ SUPER ROBUSTO: Manejo detallado de errores JWT
      let errorMessage = 'Token inválido o expirado.';
      let errorCode = 'INVALID_TOKEN';
      let statusCode = 401;

      if (jwtError.name === 'TokenExpiredError') {
        errorMessage = 'El token ha expirado. Por favor, inicia sesión de nuevo.';
        errorCode = 'TOKEN_EXPIRED';
        logger.warn('Token expirado', {
          category: 'AUTH_TOKEN_EXPIRED',
          requestId,
          ip: req.ip,
          exp: jwtError.expiredAt,
          currentTime: new Date().toISOString()
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        errorMessage = 'El token proporcionado no es válido.';
        errorCode = 'MALFORMED_TOKEN';
        logger.warn('Token malformado', {
          category: 'AUTH_MALFORMED_TOKEN',
          requestId,
          ip: req.ip,
          error: jwtError.message
        });
      } else if (jwtError.name === 'NotBeforeError') {
        errorMessage = 'El token aún no es válido.';
        errorCode = 'TOKEN_NOT_ACTIVE';
        logger.warn('Token no activo', {
          category: 'AUTH_TOKEN_NOT_ACTIVE',
          requestId,
          ip: req.ip,
          notBefore: jwtError.date
        });
      } else {
        // ✅ SUPER ROBUSTO: Error desconocido
        errorMessage = 'Error interno de verificación de token.';
        errorCode = 'JWT_VERIFICATION_ERROR';
        statusCode = 500;
        logger.error('Error desconocido en verificación JWT', {
          category: 'AUTH_JWT_UNKNOWN_ERROR',
          requestId,
          ip: req.ip,
          error: jwtError.message,
          name: jwtError.name,
          stack: jwtError.stack?.split('\n').slice(0, 3)
        });
      }

      // ✅ VALIDACIÓN: Asegurar que res sea válido antes de enviar respuesta
      if (!res || typeof res.status !== 'function' || typeof res.json !== 'function') {
        logger.error('Objeto res inválido en middleware de auth', {
          category: 'AUTH_MIDDLEWARE_ERROR',
          resType: typeof res,
          hasStatus: typeof res?.status === 'function',
          hasJson: typeof res?.json === 'function'
        });
        return;
      }

      return res.status(statusCode).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: errorCode,
          message: errorMessage,
          timestamp: new Date().toISOString()
        }
      });
    }

    // ✅ SUPER ROBUSTO: Validación de claims críticos
    if (!decodedToken.email) {
      logger.error('Token sin claim email requerido', {
        category: 'AUTH_INVALID_CLAIMS',
        requestId,
        tokenPayload: decodedToken,
        ip: req.ip,
      });
      // ✅ VALIDACIÓN: Asegurar que res sea válido
      if (!res || typeof res.status !== 'function' || typeof res.json !== 'function') {
        logger.error('Objeto res inválido en middleware de auth (MISSING_EMAIL_CLAIM)', {
          category: 'AUTH_MIDDLEWARE_ERROR',
          resType: typeof res
        });
        return;
      }

      // ✅ VALIDACIÓN: Asegurar que res sea válido
      if (!res || typeof res.status !== 'function' || typeof res.json !== 'function') {
        logger.error('Objeto res inválido en middleware de auth (USER_NOT_FOUND)', {
          category: 'AUTH_MIDDLEWARE_ERROR',
          resType: typeof res
        });
        return;
      }

      return res.status(401).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'MISSING_EMAIL_CLAIM',
          message: 'El token no contiene el email requerido.',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (!decodedToken.role) {
      logger.warn('Token sin claim role', {
        category: 'AUTH_MISSING_ROLE',
        requestId,
        email: decodedToken.email,
        ip: req.ip,
      });
      // No es crítico, pero es recomendable
    }

    // ✅ SUPER ROBUSTO: OBTENER usuario completo desde Firestore usando email del token
    const email = decodedToken.email;
    
    logger.info('🔍 Buscando usuario en Firestore', {
      category: 'AUTH_USER_LOOKUP',
      requestId,
      email: email.substring(0, 20) + '...',
      role: decodedToken.role
    });

    let userFromDb;
    try {
      userFromDb = await User.getByEmail(email);
      
      logger.info('✅ Usuario encontrado en Firestore', {
        category: 'AUTH_USER_FOUND',
        requestId,
        email: email.substring(0, 20) + '...',
        hasUser: !!userFromDb,
        userRole: userFromDb?.role,
        isActive: userFromDb?.isActive
      });
      
    } catch (dbError) {
      logger.error('Error consultando usuario en Firestore', {
        category: 'AUTH_DB_ERROR',
        requestId,
        email: email.substring(0, 20) + '...',
        error: dbError.message,
        stack: dbError.stack?.split('\n').slice(0, 3)
      });
      
      // ✅ VALIDACIÓN: Asegurar que res sea válido
      if (!res || typeof res.status !== 'function' || typeof res.json !== 'function') {
        logger.error('Objeto res inválido en middleware de auth (DATABASE_ERROR)', {
          category: 'AUTH_MIDDLEWARE_ERROR',
          resType: typeof res
        });
        return;
      }

      return res.status(503).json({
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          code: 'USER_LOOKUP_FAILED',
          message: 'Error al verificar usuario. Intenta de nuevo en unos momentos.',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!userFromDb) {
      logger.error('Usuario del token no encontrado en Firestore', {
        category: 'AUTH_USER_NOT_FOUND',
        requestId,
        email: email.substring(0, 20) + '...',
        ip: req.ip,
      });
      return res.status(403).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'USER_NOT_FOUND',
          message: 'El usuario autenticado no existe en la base de datos.',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // ✅ SUPER ROBUSTO: VERIFICACIÓN DE ESTADO: Asegurarse que el usuario esté activo
    if (!userFromDb.isActive) {
      logger.warn('Intento de acceso de usuario inactivo', {
        category: 'AUTH_USER_INACTIVE',
        requestId,
        email: userFromDb.email,
        name: userFromDb.name,
        ip: req.ip,
      });
      return res.status(403).json({
        success: false,
        error: {
          type: 'AUTHENTICATION_ERROR',
          code: 'USER_INACTIVE',
          message: 'Tu cuenta ha sido desactivada. Contacta al administrador.',
          timestamp: new Date().toISOString()
        }
      });
    }

    // ✅ SUPER ROBUSTO: Adjuntar la instancia completa del usuario de Firestore a la petición
    req.user = userFromDb;

    // ✅ SUPER ROBUSTO: Logging de éxito con métricas
    const duration = Date.now() - startTime;
    logger.info('✅ Usuario autenticado correctamente', {
      category: 'AUTH_SUCCESS',
      requestId,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      ip: req.ip,
      url: req.originalUrl,
      duration: `${duration}ms`
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

// Cualquier rol con permisos de escritura (incluye QA)
const requireWriteAccess = requireRole(['admin', 'superadmin', 'agent', 'qa']);

// Solo roles admin y QA para operaciones de IA
const requireAdminOrQA = requireRole(['admin', 'qa']);

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
