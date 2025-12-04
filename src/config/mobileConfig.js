/**
 * 📱 CONFIGURACIÓN ESPECÍFICA PARA APLICACIONES MÓVILES
 * 
 * Este módulo centraliza toda la configuración relacionada con aplicaciones móviles
 * para facilitar la integración con React Native, Flutter, Ionic, etc.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const logger = require('../utils/logger');

/**
 * Configuración de aplicaciones móviles
 */
const mobileConfig = {
  // Tipos de cliente soportados
  supportedClientTypes: [
    'web',
    'mobile',
    'react-native',
    'flutter',
    'ionic',
    'capacitor',
    'expo'
  ],

  // Plataformas soportadas
  supportedPlatforms: [
    'ios',
    'android',
    'web',
    'desktop'
  ],

  // Headers específicos para móviles
  mobileHeaders: {
    deviceId: 'X-Device-ID',
    deviceType: 'X-Device-Type',
    platform: 'X-Platform',
    appVersion: 'X-App-Version',
    clientType: 'X-Client-Type'
  },

  // Configuración de rate limiting para móviles
  mobileRateLimits: {
    login: {
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 5, // 5 intentos por ventana
      message: 'Demasiados intentos de login desde este dispositivo'
    },
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 100, // 100 requests por ventana
      message: 'Demasiadas peticiones desde este dispositivo'
    }
  },

  // Configuración de tokens para móviles
  mobileTokenConfig: {
    // Los tokens de acceso duran más en móviles para mejor UX
    accessTokenExpiry: process.env.MOBILE_ACCESS_TOKEN_EXPIRY || '7d',
    refreshTokenExpiry: process.env.MOBILE_REFRESH_TOKEN_EXPIRY || '30d',
    
    // Configuración específica por plataforma
    platformSpecific: {
      ios: {
        accessTokenExpiry: '14d',
        refreshTokenExpiry: '60d'
      },
      android: {
        accessTokenExpiry: '14d',
        refreshTokenExpiry: '60d'
      },
      web: {
        accessTokenExpiry: '1d',
        refreshTokenExpiry: '7d'
      }
    }
  },

  // Configuración de WebSockets para móviles
  mobileWebSocketConfig: {
    // Timeouts más largos para móviles
    pingTimeout: 60000, // 60 segundos
    pingInterval: 25000, // 25 segundos
    
    // Configuración de reconexión
    reconnection: {
      enabled: true,
      delay: 1000,
      maxDelay: 5000,
      maxAttempts: 5
    }
  },

  // Configuración de notificaciones push (para futuras implementaciones)
  pushNotifications: {
    enabled: process.env.PUSH_NOTIFICATIONS_ENABLED === 'true',
    providers: {
      fcm: {
        enabled: process.env.FCM_ENABLED === 'true',
        serverKey: process.env.FCM_SERVER_KEY
      },
      apns: {
        enabled: process.env.APNS_ENABLED === 'true',
        keyId: process.env.APNS_KEY_ID,
        teamId: process.env.APNS_TEAM_ID
      }
    }
  }
};

/**
 * Validar configuración móvil
 */
function validateMobileConfig() {
  const errors = [];
  
  // Validar tipos de cliente
  if (!Array.isArray(mobileConfig.supportedClientTypes)) {
    errors.push('supportedClientTypes debe ser un array');
  }
  
  // Validar plataformas
  if (!Array.isArray(mobileConfig.supportedPlatforms)) {
    errors.push('supportedPlatforms debe ser un array');
  }
  
  if (errors.length > 0) {
    logger.error('❌ Errores en configuración móvil:', { errors });
    return false;
  }
  
  logger.info('✅ Configuración móvil validada correctamente', {
    supportedClientTypes: mobileConfig.supportedClientTypes.length,
    supportedPlatforms: mobileConfig.supportedPlatforms.length,
    pushNotificationsEnabled: mobileConfig.pushNotifications.enabled
  });
  
  return true;
}

/**
 * Obtener configuración de tokens para una plataforma específica
 */
function getTokenConfigForPlatform(platform) {
  const baseConfig = mobileConfig.mobileTokenConfig;
  const platformConfig = baseConfig.platformSpecific[platform];
  
  if (platformConfig) {
    return {
      accessTokenExpiry: platformConfig.accessTokenExpiry,
      refreshTokenExpiry: platformConfig.refreshTokenExpiry
    };
  }
  
  return {
    accessTokenExpiry: baseConfig.accessTokenExpiry,
    refreshTokenExpiry: baseConfig.refreshTokenExpiry
  };
}

/**
 * Validar si un tipo de cliente es soportado
 */
function isClientTypeSupported(clientType) {
  return mobileConfig.supportedClientTypes.includes(clientType);
}

/**
 * Validar si una plataforma es soportada
 */
function isPlatformSupported(platform) {
  return mobileConfig.supportedPlatforms.includes(platform);
}

/**
 * Extraer información del dispositivo desde headers
 */
function extractDeviceInfo(req) {
  const headers = req.headers;
  
  return {
    deviceId: headers['x-device-id'] || headers['X-Device-ID'],
    deviceType: headers['x-device-type'] || headers['X-Device-Type'] || 'unknown',
    platform: headers['x-platform'] || headers['X-Platform'] || 'unknown',
    appVersion: headers['x-app-version'] || headers['X-App-Version'],
    clientType: headers['x-client-type'] || headers['X-Client-Type'] || 'web',
    userAgent: headers['user-agent'] || headers['User-Agent']
  };
}

/**
 * Generar deviceId único si no se proporciona
 */
function generateDeviceId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2);
  return `mobile_${timestamp}_${random}`;
}

/**
 * Obtener configuración de rate limiting para móviles
 */
function getMobileRateLimitConfig(operation = 'api') {
  return mobileConfig.mobileRateLimits[operation] || mobileConfig.mobileRateLimits.api;
}

/**
 * Obtener configuración de WebSocket para móviles
 */
function getMobileWebSocketConfig() {
  return mobileConfig.mobileWebSocketConfig;
}

/**
 * Verificar si las notificaciones push están habilitadas
 */
function isPushNotificationsEnabled() {
  return mobileConfig.pushNotifications.enabled;
}

/**
 * Obtener configuración de proveedores de push
 */
function getPushNotificationProviders() {
  return mobileConfig.pushNotifications.providers;
}

module.exports = {
  mobileConfig,
  validateMobileConfig,
  getTokenConfigForPlatform,
  isClientTypeSupported,
  isPlatformSupported,
  extractDeviceInfo,
  generateDeviceId,
  getMobileRateLimitConfig,
  getMobileWebSocketConfig,
  isPushNotificationsEnabled,
  getPushNotificationProviders
};


