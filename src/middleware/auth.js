/**
 * 🔐 MIDDLEWARE DE AUTENTICACIÓN CON LOGGING VISUAL
 * 
 * Middleware para verificar la autenticación de usuarios con logging detallado
 * para detectar problemas de autenticación y autorización
 * 
 * @version 2.0.0
 * @author Backend Team
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Middleware de autenticación con logging visual
 */
const authenticateToken = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    req.logger?.info('🔐 Iniciando verificación de autenticación', {
      category: 'AUTH_MIDDLEWARE_START',
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      req.logger?.warn('❌ Header de autorización no encontrado', {
        category: 'AUTH_MISSING_HEADER',
        method: req.method,
        path: req.path,
        ip: req.ip,
        headers: Object.keys(req.headers)
      });
      
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    req.logger?.debug('🔍 Header de autorización encontrado', {
      category: 'AUTH_HEADER_FOUND',
      headerLength: authHeader.length,
      startsWithBearer: authHeader.startsWith('Bearer ')
    });

    if (!authHeader.startsWith('Bearer ')) {
      req.logger?.warn('❌ Formato de autorización inválido', {
        category: 'AUTH_INVALID_FORMAT',
        method: req.method,
        path: req.path,
        headerPrefix: authHeader.substring(0, 10) + '...'
      });
      
      return res.status(401).json({
        success: false,
        error: 'Invalid authorization format'
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      req.logger?.warn('❌ Token no encontrado en header', {
        category: 'AUTH_MISSING_TOKEN',
        method: req.method,
        path: req.path
      });
      
      return res.status(401).json({
        success: false,
        error: 'Token not found'
      });
    }

    req.logger?.debug('🔍 Token extraído del header', {
      category: 'AUTH_TOKEN_EXTRACTED',
      tokenLength: token.length,
      tokenPreview: token.substring(0, 20) + '...'
    });

    // Verificar token JWT
    req.logger?.info('🔑 Verificando token JWT', {
      category: 'AUTH_JWT_VERIFICATION',
      tokenLength: token.length
    });

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET);
      
      req.logger?.info('✅ Token JWT verificado exitosamente', {
        category: 'AUTH_JWT_SUCCESS',
        email: decodedToken.email,
        role: decodedToken.role,
        type: decodedToken.type,
        exp: decodedToken.exp
      });
    } catch (jwtError) {
      req.logger?.error('❌ Error en verificación JWT', {
        category: 'AUTH_JWT_ERROR',
        error: jwtError.message,
        errorName: jwtError.name,
        method: req.method,
        path: req.path,
        details: jwtError
      });
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired'
        });
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token'
        });
      }
      
      return res.status(401).json({
        success: false,
        error: 'Token verification failed'
      });
    }

    // Buscar usuario en base de datos
    req.logger?.info('👤 Buscando usuario en base de datos', {
      category: 'AUTH_USER_LOOKUP',
      email: decodedToken.email
    });

    req.logger?.database('query_started', {
      operation: 'user_by_email_for_auth',
      email: decodedToken.email
    });

    let user;
    try {
      user = await User.getByEmail(decodedToken.email);
      
      req.logger?.database('query_completed', {
        operation: 'user_by_email_for_auth',
        email: decodedToken.email,
        userFound: !!user,
        userRole: user?.role || 'not_found'
      });
    } catch (dbError) {
      req.logger?.error('❌ Error consultando usuario en base de datos', {
        category: 'AUTH_DB_ERROR',
        email: decodedToken.email,
        error: dbError.message,
        stack: dbError.stack?.split('\n').slice(0, 3),
        details: dbError
      });
      
      return res.status(500).json({
        success: false,
        error: 'Database error during authentication'
      });
    }

    if (!user) {
      req.logger?.warn('❌ Usuario no encontrado en base de datos', {
        category: 'AUTH_USER_NOT_FOUND',
        email: decodedToken.email,
        method: req.method,
        path: req.path
      });
      
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verificar si el usuario está activo
    if (user.status !== 'active') {
      req.logger?.warn('❌ Usuario inactivo', {
        category: 'AUTH_USER_INACTIVE',
        email: user.email,
        status: user.status,
        method: req.method,
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        error: 'User account is not active'
      });
    }

    // Agregar usuario al request
    req.user = user;
    req.token = decodedToken;

    req.logger?.info('✅ Autenticación exitosa', {
      category: 'AUTH_SUCCESS',
      userId: user.id,
      email: user.email,
      role: user.role,
      method: req.method,
      path: req.path,
      executionTime: Date.now() - startTime
    });

    next();

  } catch (error) {
    req.logger?.error('❌ Error general en middleware de autenticación', {
      category: 'AUTH_GENERAL_ERROR',
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3),
      method: req.method,
      path: req.path,
      executionTime: Date.now() - startTime,
      details: error
    });

    return res.status(500).json({
      success: false,
      error: 'Authentication error'
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
  authenticateToken,
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
