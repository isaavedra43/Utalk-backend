/**
 * 📱 MIDDLEWARE DE AUTENTICACIÓN PARA APLICACIONES MÓVILES
 * 
 * Middleware especializado para manejar autenticación en aplicaciones móviles
 * con soporte para diferentes plataformas y tipos de cliente.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const logger = require('../utils/logger');
const { 
  extractDeviceInfo, 
  isClientTypeSupported, 
  isPlatformSupported,
  getTokenConfigForPlatform,
  getMobileRateLimitConfig
} = require('../config/mobileConfig');

/**
 * Middleware para validar información de dispositivo móvil
 */
const validateMobileDevice = (req, res, next) => {
  try {
    const deviceInfo = extractDeviceInfo(req);
    
    // Validar tipo de cliente
    if (deviceInfo.clientType && !isClientTypeSupported(deviceInfo.clientType)) {
      logger.warn('Tipo de cliente no soportado', {
        category: 'MOBILE_UNSUPPORTED_CLIENT',
        clientType: deviceInfo.clientType,
        ip: req.ip
      });
      
      return res.status(400).json({
        success: false,
        error: {
          type: 'CLIENT_ERROR',
          code: 'UNSUPPORTED_CLIENT_TYPE',
          message: `Tipo de cliente '${deviceInfo.clientType}' no soportado`,
          supportedTypes: ['web', 'mobile', 'react-native', 'flutter', 'ionic', 'capacitor', 'expo']
        }
      });
    }
    
    // Validar plataforma
    if (deviceInfo.platform && !isPlatformSupported(deviceInfo.platform)) {
      logger.warn('Plataforma no soportada', {
        category: 'MOBILE_UNSUPPORTED_PLATFORM',
        platform: deviceInfo.platform,
        ip: req.ip
      });
      
      return res.status(400).json({
        success: false,
        error: {
          type: 'CLIENT_ERROR',
          code: 'UNSUPPORTED_PLATFORM',
          message: `Plataforma '${deviceInfo.platform}' no soportada`,
          supportedPlatforms: ['ios', 'android', 'web', 'desktop']
        }
      });
    }
    
    // Adjuntar información del dispositivo a la petición
    req.deviceInfo = deviceInfo;
    
    logger.debug('Información de dispositivo validada', {
      category: 'MOBILE_DEVICE_VALIDATED',
      deviceId: deviceInfo.deviceId,
      platform: deviceInfo.platform,
      clientType: deviceInfo.clientType,
      ip: req.ip
    });
    
    next();
  } catch (error) {
    logger.error('Error validando dispositivo móvil', {
      category: 'MOBILE_DEVICE_ERROR',
      error: error.message,
      ip: req.ip
    });
    
    return res.status(500).json({
      success: false,
      error: {
        type: 'SERVER_ERROR',
        code: 'DEVICE_VALIDATION_ERROR',
        message: 'Error validando información del dispositivo'
      }
    });
  }
};

/**
 * Middleware para aplicar configuración de tokens específica por plataforma
 */
const applyPlatformTokenConfig = (req, res, next) => {
  try {
    const deviceInfo = req.deviceInfo || extractDeviceInfo(req);
    const platform = deviceInfo.platform || 'web';
    
    // Obtener configuración de tokens para la plataforma
    const tokenConfig = getTokenConfigForPlatform(platform);
    
    // Adjuntar configuración a la petición
    req.platformTokenConfig = tokenConfig;
    
    logger.debug('Configuración de tokens aplicada', {
      category: 'MOBILE_TOKEN_CONFIG_APPLIED',
      platform,
      accessTokenExpiry: tokenConfig.accessTokenExpiry,
      refreshTokenExpiry: tokenConfig.refreshTokenExpiry
    });
    
    next();
  } catch (error) {
    logger.error('Error aplicando configuración de tokens', {
      category: 'MOBILE_TOKEN_CONFIG_ERROR',
      error: error.message,
      ip: req.ip
    });
    
    // Continuar sin configuración específica
    next();
  }
};

/**
 * Middleware para rate limiting específico de móviles
 */
const mobileRateLimit = (operation = 'api') => {
  return (req, res, next) => {
    try {
      const deviceInfo = req.deviceInfo || extractDeviceInfo(req);
      const rateLimitConfig = getMobileRateLimitConfig(operation);
      
      // Usar deviceId como identificador único para rate limiting
      const identifier = deviceInfo.deviceId || req.ip;
      
      // Aquí podrías implementar tu lógica de rate limiting
      // Por ahora, solo loggeamos la información
      logger.debug('Rate limiting aplicado para móvil', {
        category: 'MOBILE_RATE_LIMIT',
        operation,
        identifier,
        deviceType: deviceInfo.deviceType,
        platform: deviceInfo.platform
      });
      
      next();
    } catch (error) {
      logger.error('Error en rate limiting móvil', {
        category: 'MOBILE_RATE_LIMIT_ERROR',
        error: error.message,
        ip: req.ip
      });
      
      // Continuar sin rate limiting en caso de error
      next();
    }
  };
};

/**
 * Middleware para detectar si la petición viene de una aplicación móvil
 */
const detectMobileClient = (req, res, next) => {
  try {
    const deviceInfo = extractDeviceInfo(req);
    const userAgent = req.headers['user-agent'] || '';
    
    // Detectar si es una aplicación móvil
    const isMobileApp = deviceInfo.clientType && 
      ['mobile', 'react-native', 'flutter', 'ionic', 'capacitor', 'expo'].includes(deviceInfo.clientType);
    
    const isMobilePlatform = deviceInfo.platform && 
      ['ios', 'android'].includes(deviceInfo.platform);
    
    const isMobileUserAgent = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    req.isMobileClient = isMobileApp || isMobilePlatform || isMobileUserAgent;
    req.mobileClientType = deviceInfo.clientType || (isMobileUserAgent ? 'mobile' : 'web');
    
    logger.debug('Cliente móvil detectado', {
      category: 'MOBILE_CLIENT_DETECTED',
      isMobileClient: req.isMobileClient,
      mobileClientType: req.mobileClientType,
      platform: deviceInfo.platform,
      userAgent: userAgent.substring(0, 100)
    });
    
    next();
  } catch (error) {
    logger.error('Error detectando cliente móvil', {
      category: 'MOBILE_CLIENT_DETECTION_ERROR',
      error: error.message,
      ip: req.ip
    });
    
    // Asumir que no es móvil en caso de error
    req.isMobileClient = false;
    req.mobileClientType = 'web';
    next();
  }
};

/**
 * Middleware para optimizar respuestas para móviles
 */
const optimizeForMobile = (req, res, next) => {
  try {
    if (req.isMobileClient) {
      // Agregar headers específicos para móviles
      res.set({
        'X-Mobile-Optimized': 'true',
        'X-Client-Type': req.mobileClientType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      logger.debug('Respuesta optimizada para móvil', {
        category: 'MOBILE_OPTIMIZATION',
        clientType: req.mobileClientType,
        url: req.originalUrl
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error optimizando para móvil', {
      category: 'MOBILE_OPTIMIZATION_ERROR',
      error: error.message,
      ip: req.ip
    });
    
    next();
  }
};

/**
 * Middleware combinado para aplicaciones móviles
 */
const mobileMiddleware = [
  detectMobileClient,
  validateMobileDevice,
  applyPlatformTokenConfig,
  optimizeForMobile
];

module.exports = {
  validateMobileDevice,
  applyPlatformTokenConfig,
  mobileRateLimit,
  detectMobileClient,
  optimizeForMobile,
  mobileMiddleware
};


