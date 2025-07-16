const logger = require('../utils/logger');

/**
 * Middleware global de manejo de errores
 */
const errorHandler = (err, req, res, next) => {
  // Log del error
  logger.error('Error en la aplicación:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Errores de validación de Joi
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Error de validación',
      message: 'Los datos enviados no son válidos',
      details: err.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      })),
    });
  }

  // Errores de Firebase
  if (err.code && err.code.startsWith('auth/')) {
    return res.status(401).json({
      error: 'Error de autenticación',
      message: getFirebaseAuthErrorMessage(err.code),
      code: err.code,
    });
  }

  // Errores de Firestore
  if (err.code && (err.code.includes('firestore') || err.code.includes('permission-denied'))) {
    return res.status(403).json({
      error: 'Error de permisos',
      message: 'No tienes permisos para realizar esta acción',
    });
  }

  // Errores de Twilio
  if (err.status && err.code && err.moreInfo) {
    return res.status(err.status).json({
      error: 'Error de Twilio',
      message: err.message,
      code: err.code,
    });
  }

  // Errores de validación de Express
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Error de formato',
      message: 'El formato JSON enviado no es válido',
    });
  }

  // Errores de límite de payload
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Archivo demasiado grande',
      message: 'El archivo enviado excede el límite permitido',
    });
  }

  // Error genérico del servidor
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.name || 'Error',
    message: process.env.NODE_ENV === 'production' ? 'Ha ocurrido un error inesperado' : message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

/**
 * Traduce códigos de error de Firebase Auth a mensajes amigables
 */
function getFirebaseAuthErrorMessage (code) {
  const errorMessages = {
    'auth/user-not-found': 'Usuario no encontrado',
    'auth/wrong-password': 'Contraseña incorrecta',
    'auth/email-already-in-use': 'El email ya está en uso',
    'auth/weak-password': 'La contraseña es demasiado débil',
    'auth/invalid-email': 'Email inválido',
    'auth/user-disabled': 'Usuario deshabilitado',
    'auth/too-many-requests': 'Demasiados intentos, intenta más tarde',
    'auth/id-token-expired': 'Token expirado',
    'auth/id-token-revoked': 'Token revocado',
    'auth/invalid-id-token': 'Token inválido',
  };

  return errorMessages[code] || 'Error de autenticación';
}

// EXPORT PATTERN: Single function export
// USAGE: const errorHandler = require('./errorHandler');
module.exports = errorHandler;
