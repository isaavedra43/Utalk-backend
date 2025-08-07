/**
 * 🧴 MIDDLEWARE DE SANITIZACIÓN CENTRALIZADA
 * 
 * Implementa sanitización robusta siguiendo las mejores prácticas de seguridad
 * para prevenir XSS, inyección HTML, y otros ataques por entrada de usuario.
 * 
 * Basado en: https://medium.com/devmap/7-best-practices-for-sanitizing-input-in-node-js-e61638440096
 * 
 * @author Backend Team
 * @version 1.0.0
 */

const sanitizeHtml = require('sanitize-html');
const validator = require('validator');
const logger = require('../utils/logger');

/**
 * 🛡️ CONFIGURACIONES DE SANITIZACIÓN POR TIPO DE CONTENIDO
 */
const SANITIZATION_CONFIGS = {
  // Para texto plano (nombres, títulos, etc.)
  plainText: {
    allowedTags: [],
    allowedAttributes: {},
    allowedIframeHostnames: [],
    disallowedTagsMode: 'discard',
    allowedSchemes: [],
    allowedSchemesAppliedToAttributes: [],
    parseStyleAttributes: false
  },

  // Para contenido básico (descripciones cortas)
  basicText: {
    allowedTags: ['b', 'i', 'em', 'strong'],
    allowedAttributes: {},
    allowedIframeHostnames: [],
    disallowedTagsMode: 'discard'
  },

  // Para contenido rico (comentarios, mensajes)
  richText: {
    allowedTags: [
      'b', 'i', 'em', 'strong', 'u', 'br', 'p', 
      'ul', 'ol', 'li', 'blockquote'
    ],
    allowedAttributes: {
      'p': ['class'],
      'ul': ['class'],
      'ol': ['class'],
      'li': ['class']
    },
    allowedClasses: {
      'p': ['text-*'],
      'ul': ['list-*'],
      'ol': ['list-*'],
      'li': ['list-*']
    },
    disallowedTagsMode: 'discard',
    allowedIframeHostnames: []
  },

  // Para URLs y enlaces
  url: {
    allowedTags: [],
    allowedAttributes: {},
    allowedSchemes: ['http', 'https'],
    allowedIframeHostnames: []
  }
};

/**
 * 🧹 FUNCIÓN PRINCIPAL DE SANITIZACIÓN
 */
function sanitizeValue(value, type = 'plainText', options = {}) {
  if (!value || typeof value !== 'string') {
    return value;
  }

  try {
    const config = { ...SANITIZATION_CONFIGS[type], ...options };
    
    // Sanitizar HTML
    let sanitized = sanitizeHtml(value, config);
    
    // Aplicar sanitización adicional según el tipo
    switch (type) {
      case 'email':
        sanitized = validator.normalizeEmail(sanitized) || '';
        break;
        
      case 'url':
        // Validar y limpiar URL
        if (validator.isURL(sanitized, { protocols: ['http', 'https'] })) {
          sanitized = validator.escape(sanitized);
        } else {
          sanitized = '';
        }
        break;
        
      case 'plainText':
      case 'basicText':
      case 'richText':
        // Escapar caracteres peligrosos adicionales
        sanitized = validator.escape(sanitized);
        // Revertir escapes necesarios para HTML permitido
        if (type !== 'plainText') {
          sanitized = sanitized
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"');
        }
        break;
        
      default:
        sanitized = validator.escape(sanitized);
    }
    
    // Truncar si es muy largo (prevenir ataques de DoS)
    const maxLength = options.maxLength || getMaxLengthForType(type);
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
      logger.warn('Input truncado por exceder longitud máxima', {
        category: 'SANITIZATION_TRUNCATED',
        type,
        originalLength: value.length,
        maxLength,
        truncatedLength: sanitized.length
      });
    }
    
    return sanitized;
    
  } catch (error) {
    logger.error('Error en sanitización', {
      category: 'SANITIZATION_ERROR',
      type,
      error: error.message,
      valueLength: value.length
    });
    
    // En caso de error, aplicar sanitización mínima
    return validator.escape(value.substring(0, 500));
  }
}

/**
 * 📏 OBTENER LONGITUD MÁXIMA POR TIPO
 */
function getMaxLengthForType(type) {
  const maxLengths = {
    plainText: 1000,
    basicText: 2000,
    richText: 10000,
    email: 254,
    url: 2000,
    phone: 20,
    name: 100,
    title: 200,
    description: 2000,
    message: 5000
  };
  
  return maxLengths[type] || 1000;
}

/**
 * 🔄 SANITIZACIÓN RECURSIVA DE OBJETOS
 */
function sanitizeObject(obj, fieldTypes = {}, prefix = '') {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map((item, index) => 
      sanitizeObject(item, fieldTypes, `${prefix}[${index}]`)
    );
  }
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    const fieldType = fieldTypes[key] || fieldTypes[fieldPath] || getFieldTypeByName(key);
    
    if (typeof value === 'string') {
      sanitized[key] = sanitizeValue(value, fieldType);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, fieldTypes, fieldPath);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * 🎯 DETECTAR TIPO DE CAMPO POR NOMBRE
 */
function getFieldTypeByName(fieldName) {
  const fieldTypeMap = {
    // Emails
    email: 'email',
    userEmail: 'email',
    contactEmail: 'email',
    
    // URLs
    url: 'url',
    website: 'url',
    avatar: 'url',
    profilePicture: 'url',
    mediaUrl: 'url',
    MediaUrl0: 'url',
    MediaUrl1: 'url',
    MediaUrl2: 'url',
    MediaUrl3: 'url',
    MediaUrl4: 'url',
    MediaUrl5: 'url',
    MediaUrl6: 'url',
    MediaUrl7: 'url',
    MediaUrl8: 'url',
    MediaUrl9: 'url',
    
    // Nombres y títulos
    name: 'plainText',
    firstName: 'plainText',
    lastName: 'plainText',
    title: 'plainText',
    subject: 'plainText',
    
    // Descripciones y contenido
    description: 'basicText',
    bio: 'basicText',
    summary: 'basicText',
    
    // Mensajes y contenido rico
    message: 'richText',
    content: 'richText',
    body: 'richText',
    comment: 'richText',
    
    // Teléfonos
    phone: 'plainText',
    phoneNumber: 'plainText',
    mobile: 'plainText',
    
    // Campos multimedia de Twilio
    MediaContentType0: 'plainText',
    MediaContentType1: 'plainText',
    MediaContentType2: 'plainText',
    MediaContentType3: 'plainText',
    MediaContentType4: 'plainText',
    MediaContentType5: 'plainText',
    MediaContentType6: 'plainText',
    MediaContentType7: 'plainText',
    MediaContentType8: 'plainText',
    MediaContentType9: 'plainText',
    NumMedia: 'plainText'
  };
  
  const normalizedName = fieldName.toLowerCase();
  
  // Buscar coincidencia exacta
  if (fieldTypeMap[normalizedName]) {
    return fieldTypeMap[normalizedName];
  }
  
  // Buscar coincidencia parcial
  for (const [pattern, type] of Object.entries(fieldTypeMap)) {
    if (normalizedName.includes(pattern.toLowerCase())) {
      return type;
    }
  }
  
  return 'plainText'; // Default seguro
}

/**
 * 🛡️ MIDDLEWARE DE SANITIZACIÓN AUTOMÁTICA
 * Sanitiza automáticamente body, query y params
 */
function sanitizeRequest(fieldTypes = {}, options = {}) {
  return (req, res, next) => {
    try {
      const { 
        sanitizeBody = true, 
        sanitizeQuery = true, 
        sanitizeParams = true,
        logSanitization = process.env.NODE_ENV === 'development'
      } = options;
      
      let sanitizationCount = 0;
      
      // Sanitizar body
      if (sanitizeBody && req.body && typeof req.body === 'object') {
        const originalBody = JSON.stringify(req.body);
        req.body = sanitizeObject(req.body, fieldTypes.body || fieldTypes);
        const sanitizedBody = JSON.stringify(req.body);
        
        if (originalBody !== sanitizedBody) {
          sanitizationCount++;
        }
      }
      
      // Sanitizar query parameters
      if (sanitizeQuery && req.query && typeof req.query === 'object') {
        const originalQuery = JSON.stringify(req.query);
        req.query = sanitizeObject(req.query, fieldTypes.query || {});
        const sanitizedQuery = JSON.stringify(req.query);
        
        if (originalQuery !== sanitizedQuery) {
          sanitizationCount++;
        }
      }
      
      // Sanitizar URL parameters
      if (sanitizeParams && req.params && typeof req.params === 'object') {
        const originalParams = JSON.stringify(req.params);
        req.params = sanitizeObject(req.params, fieldTypes.params || {});
        const sanitizedParams = JSON.stringify(req.params);
        
        if (originalParams !== sanitizedParams) {
          sanitizationCount++;
        }
      }
      
      // Log si hubo sanitización
      if (logSanitization && sanitizationCount > 0) {
        logger.debug('Request sanitizado', {
          category: 'SANITIZATION_APPLIED',
          url: req.originalUrl,
          method: req.method,
          userId: req.user?.id,
          sanitizedFields: sanitizationCount
        });
      }
      
      next();
      
    } catch (error) {
      logger.error('Error en middleware de sanitización', {
        category: 'SANITIZATION_MIDDLEWARE_ERROR',
        error: error.message,
        stack: error.stack,
        url: req.originalUrl
      });
      
      // En caso de error, continuar sin sanitización
      // Es mejor tener datos sin sanitizar que fallar completamente
      next();
    }
  };
}

/**
 * 🎨 MIDDLEWARE ESPECIALIZADO PARA DIFERENTES TIPOS DE CONTENIDO
 */

// Para contenido de usuario (comentarios, mensajes)
const sanitizeUserContent = sanitizeRequest({
  body: {
    message: 'richText',
    content: 'richText',
    comment: 'richText',
    description: 'basicText',
    title: 'plainText',
    name: 'plainText'
  }
});

// Para datos de contacto
const sanitizeContactData = sanitizeRequest({
  body: {
    name: 'plainText',
    email: 'email',
    phone: 'plainText',
    company: 'plainText',
    notes: 'basicText',
    tags: 'plainText'
  }
});

// Para datos de usuario/perfil
const sanitizeProfileData = sanitizeRequest({
  body: {
    name: 'plainText',
    firstName: 'plainText',
    lastName: 'plainText',
    email: 'email',
    bio: 'basicText',
    avatar: 'url',
    website: 'url'
  }
});

// Para contenido de campañas
const sanitizeCampaignData = sanitizeRequest({
  body: {
    name: 'plainText',
    title: 'plainText',
    description: 'basicText',
    message: 'richText',
    tags: 'plainText'
  }
});

module.exports = {
  sanitizeValue,
  sanitizeObject,
  sanitizeRequest,
  sanitizeUserContent,
  sanitizeContactData,
  sanitizeProfileData,
  sanitizeCampaignData,
  SANITIZATION_CONFIGS
}; 