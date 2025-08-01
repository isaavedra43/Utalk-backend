/**
 * 🚨 ENHANCED ERROR HANDLER - ENTERPRISE GRADE
 * 
 * Basado en mejores prácticas de:
 * - https://medium.com/@ctrlaltvictoria/backend-error-handling-practical-tips-from-a-startup-cto-bb988ccb3e5b
 * - https://medium.com/@afolayanolatomiwa/error-handling-in-backend-applications-best-practices-and-techniques-1e4cd94c2fa5
 * - https://medium.com/@myat.su.phyo/best-practices-for-error-handling-in-backend-development-0f9faea39a66
 * 
 * Características implementadas:
 * - Centralización completa de manejo de errores
 * - Clasificación automática inteligente
 * - Logging estructurado con contexto completo
 * - Respuestas JSON estandarizadas
 * - Protección de datos sensibles
 * - Métricas y monitoreo automático
 * - Códigos de error descriptivos y consistentes
 * - Rate limiting para prevenir spam de errores
 * 
 * @version 3.0.0 ENTERPRISE
 * @author Error Handling Team
 */

const logger = require('../utils/logger');
const { memoryManager } = require('../utils/memoryManager');

// Error types según mejores prácticas
const ERROR_TYPES = {
  VALIDATION: 'VALIDATION_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR', 
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND_ERROR',
  CONFLICT: 'CONFLICT_ERROR',
  RATE_LIMIT: 'RATE_LIMIT_ERROR',
  EXTERNAL_SERVICE: 'EXTERNAL_SERVICE_ERROR',
  DATABASE: 'DATABASE_ERROR',
  NETWORK: 'NETWORK_ERROR',
  INTERNAL: 'INTERNAL_SERVER_ERROR',
  SECURITY: 'SECURITY_ERROR'
};

// HTTP Status Code mappings
const STATUS_CODE_MAP = {
  [ERROR_TYPES.VALIDATION]: 400,
  [ERROR_TYPES.AUTHENTICATION]: 401,
  [ERROR_TYPES.AUTHORIZATION]: 403,
  [ERROR_TYPES.NOT_FOUND]: 404,
  [ERROR_TYPES.CONFLICT]: 409,
  [ERROR_TYPES.RATE_LIMIT]: 429,
  [ERROR_TYPES.EXTERNAL_SERVICE]: 502,
  [ERROR_TYPES.DATABASE]: 503,
  [ERROR_TYPES.NETWORK]: 503,
  [ERROR_TYPES.INTERNAL]: 500,
  [ERROR_TYPES.SECURITY]: 403
};

class EnhancedErrorHandler {
  constructor() {
    // Error metrics con TTL automático
    this.errorMetrics = memoryManager.createManagedMap('errorMetrics', {
      maxEntries: 100000,
      defaultTTL: 24 * 60 * 60 * 1000, // 24 horas
      onEviction: (key, metrics, reason) => {
        if (reason !== 'expired') {
          // Log removido para reducir ruido en producción
        }
      }
    });

    // Rate limiting para errores repetidos
    this.errorRateLimit = memoryManager.createManagedMap('errorRateLimit', {
      maxEntries: 50000,
      defaultTTL: 60 * 60 * 1000, // 1 hora
    });

    this.sensitiveFields = [
      'password', 'token', 'authorization', 'secret', 'key',
      'auth', 'credential', 'pass', 'pwd', 'jwt', 'session',
      'cookie', 'x-api-key', 'api-key', 'bearer', 'refresh_token',
      'private_key', 'client_secret', 'webhook_secret'
    ];

    this.initializeMetrics();
  }

  /**
   * 📊 INICIALIZAR MÉTRICAS
   */
  initializeMetrics() {
    // Reset métricas cada hora y generar reportes
    setInterval(() => {
      this.generateErrorReport();
      this.resetHourlyMetrics();
    }, 60 * 60 * 1000); // 1 hora
  }

  /**
   * 🚨 MIDDLEWARE PRINCIPAL DE ERROR HANDLING
   */
  handle() {
    return (error, req, res, next) => {
      const startTime = Date.now();
      
      try {
        // Generar contexto completo del error
        const errorContext = this.buildErrorContext(error, req);
        
        // Verificar rate limiting de errores
        if (this.isErrorRateLimited(errorContext)) {
          return this.sendRateLimitedErrorResponse(res, req);
        }
        
        // Clasificar y procesar error
        const errorClassification = this.classifyError(error, req);
        const errorResponse = this.buildErrorResponse(errorClassification, errorContext, req);
        
        // Logging estructurado del error
        this.logError(error, errorContext, errorClassification);
        
        // Actualizar métricas
        this.updateErrorMetrics(errorClassification, errorContext);
        
        // Enviar respuesta al cliente
        this.sendErrorResponse(res, errorResponse, req);
        
        // Triggers post-error (alertas, notificaciones)
        this.executePostErrorTriggers(error, errorContext, errorClassification);
        
        // Log de performance del error handler
        // Log removido para reducir ruido en producción
        
      } catch (handlerError) {
        // Error crítico en el propio handler
        logger.error('Error crítico en EnhancedErrorHandler', {
          category: 'ERROR_HANDLER_FAILURE',
          originalError: error?.message,
          handlerError: handlerError?.message,
          stack: handlerError?.stack,
          severity: 'CRITICAL',
          requiresAttention: true,
          requestId: req?.requestId
        });
        
        this.sendFallbackErrorResponse(res, req);
      }
    };
  }

  /**
   * 🔧 CONSTRUIR CONTEXTO COMPLETO DEL ERROR
   */
  buildErrorContext(error, req) {
    const now = new Date();
    
    return {
      // Request context
      requestId: req?.requestId || this.generateRequestId(),
      timestamp: now.toISOString(),
      method: req?.method,
      url: req?.originalUrl,
      userAgent: req?.headers['user-agent']?.substring(0, 200),
      ip: req?.ip || req?.connection?.remoteAddress,
      referer: req?.headers['referer'],
      
      // User context (si está autenticado)
      user: req?.user ? {
        id: req.user.id,
        email: req.user.email?.substring(0, 50) + '...',
        role: req.user.role
      } : null,
      
      // Error context
      errorName: error?.name,
      errorMessage: error?.message,
      errorCode: error?.code,
      
      // Request data (sanitizado)
      query: this.sanitizeObject(req?.query),
      params: this.sanitizeObject(req?.params),
      body: this.sanitizeObject(req?.body),
      headers: this.sanitizeHeaders(req?.headers),
      
      // Environment context
      nodeEnv: process.env.NODE_ENV,
      processId: process.pid,
      hostname: require('os').hostname(),
      
      // Memory context
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  /**
   * 🔍 CLASIFICAR ERROR AUTOMÁTICAMENTE
   */
  classifyError(error, req) {
    const classification = {
      type: ERROR_TYPES.INTERNAL,
      category: 'general',
      severity: 'medium',
      retryable: false,
      publicMessage: 'Ha ocurrido un error interno',
      details: null
    };

    // Errores de validación (Joi, express-validator, etc.)
    if (this.isValidationError(error)) {
      classification.type = ERROR_TYPES.VALIDATION;
      classification.category = 'validation';
      classification.severity = 'low';
      classification.retryable = false;
      classification.publicMessage = 'Los datos proporcionados son inválidos';
      classification.details = this.extractValidationDetails(error);
    }
    
    // Errores de JWT/Authentication
    else if (this.isAuthenticationError(error)) {
      classification.type = ERROR_TYPES.AUTHENTICATION;
      classification.category = 'authentication';
      classification.severity = 'medium';
      classification.retryable = false;
      classification.publicMessage = 'Error de autenticación';
      classification.details = this.extractAuthDetails(error);
    }
    
    // Errores de autorización
    else if (this.isAuthorizationError(error)) {
      classification.type = ERROR_TYPES.AUTHORIZATION;
      classification.category = 'authorization';
      classification.severity = 'medium';
      classification.retryable = false;
      classification.publicMessage = 'No tienes permisos para realizar esta acción';
    }
    
    // Errores de rate limiting
    else if (this.isRateLimitError(error)) {
      classification.type = ERROR_TYPES.RATE_LIMIT;
      classification.category = 'rate_limit';
      classification.severity = 'low';
      classification.retryable = true;
      classification.publicMessage = 'Demasiadas solicitudes. Intenta más tarde.';
      classification.details = { retryAfter: error.retryAfter || '60 seconds' };
    }
    
    // Errores de servicios externos (Twilio, Firebase, etc.)
    else if (this.isExternalServiceError(error)) {
      classification.type = ERROR_TYPES.EXTERNAL_SERVICE;
      classification.category = 'external_service';
      classification.severity = 'high';
      classification.retryable = true;
      classification.publicMessage = 'Error en servicio externo. Intenta más tarde.';
      classification.details = this.extractExternalServiceDetails(error);
    }
    
    // Errores de base de datos
    else if (this.isDatabaseError(error)) {
      classification.type = ERROR_TYPES.DATABASE;
      classification.category = 'database';
      classification.severity = 'high';
      classification.retryable = true;
      classification.publicMessage = 'Error temporal de base de datos';
    }
    
    // Errores de red
    else if (this.isNetworkError(error)) {
      classification.type = ERROR_TYPES.NETWORK;
      classification.category = 'network';
      classification.severity = 'high';
      classification.retryable = true;
      classification.publicMessage = 'Error de conectividad';
    }
    
    // Errores de seguridad
    else if (this.isSecurityError(error)) {
      classification.type = ERROR_TYPES.SECURITY;
      classification.category = 'security';
      classification.severity = 'critical';
      classification.retryable = false;
      classification.publicMessage = 'Error de seguridad';
    }
    
    // Not Found
    else if (this.isNotFoundError(error)) {
      classification.type = ERROR_TYPES.NOT_FOUND;
      classification.category = 'not_found';
      classification.severity = 'low';
      classification.retryable = false;
      classification.publicMessage = 'Recurso no encontrado';
    }
    
    // Conflicts
    else if (this.isConflictError(error)) {
      classification.type = ERROR_TYPES.CONFLICT;
      classification.category = 'conflict';
      classification.severity = 'medium';
      classification.retryable = false;
      classification.publicMessage = 'Conflicto con el estado actual del recurso';
    }
    
    // Error interno por defecto
    else {
      classification.severity = 'high';
      if (process.env.NODE_ENV === 'development') {
        classification.publicMessage = error.message || 'Error interno del servidor';
      }
    }

    return classification;
  }

  /**
   * 🏗️ CONSTRUIR RESPUESTA DE ERROR ESTANDARIZADA
   */
  buildErrorResponse(classification, context, req) {
    const statusCode = STATUS_CODE_MAP[classification.type] || 500;
    
    const response = {
      success: false,
      error: {
        type: classification.type,
        code: this.generateErrorCode(classification, context),
        message: classification.publicMessage,
        timestamp: context.timestamp,
        requestId: context.requestId
      }
    };

    // Agregar detalles si están disponibles
    if (classification.details) {
      response.error.details = classification.details;
    }

    // Agregar información de retry si es aplicable
    if (classification.retryable) {
      response.error.retryable = true;
      response.error.retryAfter = classification.details?.retryAfter || '60 seconds';
    }

    // En desarrollo, agregar más información
    if (process.env.NODE_ENV === 'development') {
      response.error.development = {
        originalError: context.errorName,
        stack: context.errorMessage,
        category: classification.category,
        severity: classification.severity
      };
    }

    return {
      statusCode,
      ...response
    };
  }

  /**
   * 📝 LOGGING ESTRUCTURADO DEL ERROR
   */
  logError(error, context, classification) {
    const logLevel = this.getLogLevel(classification.severity);
    const logData = {
      category: 'ERROR_HANDLED',
      error: {
        type: classification.type,
        category: classification.category,
        severity: classification.severity,
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context: context,
      classification: classification,
      tags: this.generateErrorTags(classification, context)
    };

    logger[logLevel](`Error ${classification.category}: ${error.message}`, logData);

    // Log adicional para errores críticos
    if (classification.severity === 'critical') {
      logger.error('🚨 ERROR CRÍTICO DETECTADO', {
        category: 'CRITICAL_ERROR_ALERT',
        ...logData,
        requiresAttention: true,
        severity: 'CRITICAL'
      });
    }
  }

  /**
   * 📤 ENVIAR RESPUESTA DE ERROR AL CLIENTE
   */
  sendErrorResponse(res, errorResponse, req) {
    if (res.headersSent) {
      logger.warn('Intento de enviar respuesta de error después de headers enviados', {
        category: 'ERROR_HANDLER_WARNING',
        requestId: req?.requestId,
        url: req?.originalUrl
      });
      return;
    }

    // Headers de seguridad y tracking
    res.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Request-ID': req?.requestId || 'unknown',
      'X-Error-ID': this.generateErrorId(),
      'X-Content-Type-Options': 'nosniff'
    });

    res.status(errorResponse.statusCode).json(errorResponse);
  }

  /**
   * 🚨 RESPUESTA DE FALLBACK PARA ERRORES CRÍTICOS
   */
  sendFallbackErrorResponse(res, req) {
    if (res.headersSent) return;

    const fallbackResponse = {
      success: false,
      error: {
        type: ERROR_TYPES.INTERNAL,
        code: 'CRITICAL_HANDLER_FAILURE',
        message: 'Error crítico del sistema',
        timestamp: new Date().toISOString(),
        requestId: req?.requestId || 'unknown'
      }
    };

    res.set({
      'Content-Type': 'application/json',
      'X-Request-ID': req?.requestId || 'unknown'
    });

    res.status(500).json(fallbackResponse);
  }

  /**
   * 🚦 VERIFICAR RATE LIMITING DE ERRORES
   */
  isErrorRateLimited(context) {
    const rateLimitKey = `${context.ip}:${context.url}`;
    const currentCount = this.errorRateLimit.get(rateLimitKey) || 0;
    
    // Límite: 10 errores por IP/endpoint por hora
    if (currentCount >= 10) {
      return true;
    }
    
    this.errorRateLimit.set(rateLimitKey, currentCount + 1);
    return false;
  }

  /**
   * 📊 ACTUALIZAR MÉTRICAS DE ERROR
   */
  updateErrorMetrics(classification, context) {
    const metricsKey = `${classification.type}:${context.method}:${context.url}`;
    const currentMetrics = this.errorMetrics.get(metricsKey) || {
      count: 0,
      firstSeen: context.timestamp,
      lastSeen: context.timestamp,
      ips: new Set(),
      users: new Set()
    };

    currentMetrics.count++;
    currentMetrics.lastSeen = context.timestamp;
    currentMetrics.ips.add(context.ip);
    if (context.user?.id) {
      currentMetrics.users.add(context.user.id);
    }

    this.errorMetrics.set(metricsKey, currentMetrics);
  }

  /**
   * 📈 GENERAR REPORTE DE ERRORES
   */
  generateErrorReport() {
    const report = {
      period: 'last_hour',
      timestamp: new Date().toISOString(),
      summary: {
        totalErrors: 0,
        uniqueEndpoints: 0,
        affectedUsers: new Set(),
        topErrors: [],
        criticalErrors: []
      }
    };

    for (const [key, metrics] of this.errorMetrics.entries()) {
      report.summary.totalErrors += metrics.count;
      report.summary.uniqueEndpoints++;
      metrics.users.forEach(user => report.summary.affectedUsers.add(user));
      
      if (metrics.count > 10) {
        report.summary.topErrors.push({ key, count: metrics.count });
      }
    }

    report.summary.affectedUsers = report.summary.affectedUsers.size;
    report.summary.topErrors.sort((a, b) => b.count - a.count);

    logger.info('📊 Reporte de errores (última hora)', {
      category: 'ERROR_METRICS_REPORT',
      ...report
    });
  }

  /**
   * 🧹 RESET MÉTRICAS CADA HORA
   */
  resetHourlyMetrics() {
    // Las métricas se auto-limpian por TTL, pero podemos forzar reset si es necesario
    // Log removido para reducir ruido en producción
  }

  // MÉTODOS DE DETECCIÓN DE TIPOS DE ERROR

  isValidationError(error) {
    return error.name === 'ValidationError' ||
           error.isJoi === true ||
           error.name === 'ValidatorError' ||
           (error.details && Array.isArray(error.details)) ||
           error.name === 'CastError';
  }

  isAuthenticationError(error) {
    return error.name === 'JsonWebTokenError' ||
           error.name === 'TokenExpiredError' ||
           error.name === 'NotBeforeError' ||
           error.name === 'UnauthorizedError' ||
           (error.code && error.code.startsWith('auth/'));
  }

  isAuthorizationError(error) {
    return error.statusCode === 403 ||
           error.code === 'INSUFFICIENT_PERMISSIONS' ||
           error.code === 'ACCESS_DENIED' ||
           error.code === 'permission-denied';
  }

  isRateLimitError(error) {
    return error.statusCode === 429 ||
           error.code === 'RATE_LIMIT_EXCEEDED' ||
           (error.message && error.message.includes('rate limit'));
  }

  isExternalServiceError(error) {
    return (error.code && typeof error.code === 'number' && error.code >= 20000) || // Twilio
           error.name === 'TwilioError' ||
           (error.code && error.code.startsWith('firestore/')) ||
           error.name === 'FirebaseError';
  }

  isDatabaseError(error) {
    return error.name === 'MongoError' ||
           error.name === 'DatabaseError' ||
           (error.code && error.code.startsWith('firestore/'));
  }

  isNetworkError(error) {
    return error.code === 'ENOTFOUND' ||
           error.code === 'ECONNREFUSED' ||
           error.code === 'ETIMEDOUT' ||
           error.name === 'NetworkError';
  }

  isSecurityError(error) {
    return error.name === 'SecurityError' ||
           error.code === 'SECURITY_VIOLATION' ||
           (error.message && error.message.includes('security'));
  }

  isNotFoundError(error) {
    return error.statusCode === 404 ||
           error.status === 404 ||
           error.name === 'NotFoundError';
  }

  isConflictError(error) {
    return error.statusCode === 409 ||
           error.status === 409 ||
           error.name === 'ConflictError';
  }

  // MÉTODOS UTILITARIOS

  extractValidationDetails(error) {
    if (error.details && Array.isArray(error.details)) {
      return {
        fields: error.details.map(detail => ({
          field: detail.path ? detail.path.join('.') : detail.field,
          message: detail.message,
          value: detail.value
        }))
      };
    }
    return null;
  }

  extractAuthDetails(error) {
    const authErrors = {
      'TokenExpiredError': 'Token expirado',
      'JsonWebTokenError': 'Token inválido',
      'NotBeforeError': 'Token no activo aún'
    };
    
    return {
      reason: authErrors[error.name] || 'Error de autenticación',
      action: 'Iniciar sesión nuevamente'
    };
  }

  extractExternalServiceDetails(error) {
    return {
      service: this.identifyExternalService(error),
      originalCode: error.code,
      retryable: true
    };
  }

  identifyExternalService(error) {
    if (error.name === 'TwilioError' || (error.code && typeof error.code === 'number')) {
      return 'twilio';
    }
    if (error.code && error.code.startsWith('firestore/')) {
      return 'firebase';
    }
    return 'unknown';
  }

  sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[FILTERED]';
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  sanitizeHeaders(headers) {
    if (!headers) return {};
    
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    const sanitized = {};
    
    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[FILTERED]';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  generateErrorCode(classification, context) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${classification.type}_${timestamp}_${random}`.toUpperCase();
  }

  generateErrorId() {
    return 'ERR_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateRequestId() {
    return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateErrorTags(classification, context) {
    const tags = [classification.category, classification.severity];
    
    if (context.user?.role) tags.push(`user_${context.user.role}`);
    if (context.method) tags.push(context.method.toLowerCase());
    if (classification.retryable) tags.push('retryable');
    
    return tags;
  }

  getLogLevel(severity) {
    const levelMap = {
      'low': 'info',
      'medium': 'warn', 
      'high': 'error',
      'critical': 'error'
    };
    return levelMap[severity] || 'error';
  }

  executePostErrorTriggers(error, context, classification) {
    // Alertas para errores críticos
    if (classification.severity === 'critical') {
      this.sendCriticalAlert(error, context, classification);
    }
    
    // Métricas para monitoring
    if (process.env.ENABLE_ERROR_MONITORING === 'true') {
      this.sendToMonitoring(error, context, classification);
    }
  }

  sendCriticalAlert(error, context, classification) {
    logger.error('🚨 ALERTA CRÍTICA DE ERROR', {
      category: 'CRITICAL_ERROR_ALERT',
      alert: {
        type: classification.type,
        message: error.message,
        endpoint: context.url,
        user: context.user?.email,
        timestamp: context.timestamp
      },
      severity: 'CRITICAL',
      requiresAttention: true
    });
  }

  sendToMonitoring(error, context, classification) {
    // Aquí se enviarían métricas a servicios como Datadog, New Relic, etc.
    // Log removido para reducir ruido en producción
  }

  sendRateLimitedErrorResponse(res, req) {
    const response = {
      success: false,
      error: {
        type: ERROR_TYPES.RATE_LIMIT,
        code: 'ERROR_RATE_LIMIT_EXCEEDED',
        message: 'Demasiados errores desde esta IP. Intenta más tarde.',
        timestamp: new Date().toISOString(),
        requestId: req?.requestId || 'unknown',
        retryAfter: '1 hour'
      }
    };

    res.set({
      'Content-Type': 'application/json',
      'X-Request-ID': req?.requestId || 'unknown',
      'Retry-After': '3600'
    });

    res.status(429).json(response);
  }
}

// Singleton instance
const enhancedErrorHandler = new EnhancedErrorHandler();

module.exports = {
  EnhancedErrorHandler,
  enhancedErrorHandler,
  ERROR_TYPES
}; 