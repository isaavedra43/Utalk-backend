/**
 * 🌐 CONFIGURACIÓN CORS MEJORADA CON LOGGING VISUAL
 * 
 * Configuración de CORS para permitir comunicación entre frontend y backend
 * con logging detallado para detectar problemas de CORS
 * 
 * @version 2.0.0
 * @author Backend Team
 */

const cors = require('cors');
const logger = require('../utils/logger');

/**
 * Configuración de CORS con logging visual
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Log de la solicitud CORS
    logger.info('🌐 Solicitud CORS recibida', {
      category: 'CORS_REQUEST',
      origin: origin,
      userAgent: this.req?.headers['user-agent'],
      method: this.req?.method,
      path: this.req?.path
    });

    // Lista de orígenes permitidos
    const allowedOrigins = [
      'https://utalk-frontend-glt2.vercel.app',
      'https://utalk-frontend.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173'
    ];

    // Permitir solicitudes sin origen (como aplicaciones móviles o Postman)
    if (!origin) {
      logger.warn('⚠️ Solicitud CORS sin origen (posible app móvil o Postman)', {
        category: 'CORS_NO_ORIGIN',
        userAgent: this.req?.headers['user-agent'],
        method: this.req?.method,
        path: this.req?.path
      });
      return callback(null, true);
    }

    // Verificar si el origen está permitido
    if (allowedOrigins.includes(origin)) {
      logger.info('✅ Origen CORS permitido', {
        category: 'CORS_ALLOWED',
        origin: origin,
        method: this.req?.method,
        path: this.req?.path
      });
      return callback(null, true);
    }

    // Origen no permitido
    logger.error('❌ Origen CORS bloqueado', {
      category: 'CORS_BLOCKED',
      origin: origin,
      allowedOrigins: allowedOrigins,
      userAgent: this.req?.headers['user-agent'],
      method: this.req?.method,
      path: this.req?.path
    });

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-Request-ID',
    'X-Correlation-ID'
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-Correlation-ID',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ],
  maxAge: 86400, // 24 horas
  preflightContinue: false,
  optionsSuccessStatus: 204
};

/**
 * Middleware CORS con logging mejorado
 */
const corsMiddleware = cors(corsOptions);

/**
 * Middleware personalizado para logging de CORS
 */
function corsWithLogging(req, res, next) {
  // Log de la solicitud entrante
  logger.info('🌐 Solicitud HTTP entrante', {
    category: 'HTTP_REQUEST',
    method: req.method,
    path: req.path,
    origin: req.headers.origin,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });

  // Log específico para preflight requests
  if (req.method === 'OPTIONS') {
    logger.info('🔍 Solicitud preflight OPTIONS detectada', {
      category: 'CORS_PREFLIGHT',
      path: req.path,
      origin: req.headers.origin,
      accessControlRequestMethod: req.headers['access-control-request-method'],
      accessControlRequestHeaders: req.headers['access-control-request-headers']
    });
  }

  // Aplicar middleware CORS
  corsMiddleware(req, res, (err) => {
    if (err) {
      logger.error('❌ Error en middleware CORS', {
        category: 'CORS_ERROR',
        error: err.message,
        method: req.method,
        path: req.path,
        origin: req.headers.origin
      });
      return res.status(403).json({
        success: false,
        error: 'CORS policy violation',
        details: err.message
      });
    }

    // Log de respuesta CORS exitosa
    logger.info('✅ Solicitud CORS procesada exitosamente', {
      category: 'CORS_SUCCESS',
      method: req.method,
      path: req.path,
      origin: req.headers.origin,
      statusCode: res.statusCode
    });

    next();
  });
}

module.exports = {
  corsOptions,
  corsMiddleware,
  corsWithLogging
}; 