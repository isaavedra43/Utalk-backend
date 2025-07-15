const Joi = require('joi');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const purify = DOMPurify(window);

/**
 * Sanitización de datos contra XSS y inyecciones
 */
const sanitizeData = (data) => {
  if (typeof data === 'string') {
    // Sanitizar HTML y scripts maliciosos
    let sanitized = purify.sanitize(data, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    });
    
    // Escapar caracteres especiales adicionales
    sanitized = sanitized
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '')
      .trim();
    
    return sanitized;
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }
  
  if (data && typeof data === 'object') {
    const sanitizedObj = {};
    for (const [key, value] of Object.entries(data)) {
      const sanitizedKey = sanitizeData(key);
      sanitizedObj[sanitizedKey] = sanitizeData(value);
    }
    return sanitizedObj;
  }
  
  return data;
};

/**
 * Middleware para validar datos con Joi y sanitización
 */
const validate = (schema, options = {}) => {
  return (req, res, next) => {
    const {
      property = 'body',
      sanitize = true,
      allowUnknown = false,
      stripUnknown = true,
    } = options;

    let dataToValidate = req[property];
    
    // Aplicar sanitización si está habilitada
    if (sanitize && dataToValidate) {
      dataToValidate = sanitizeData(dataToValidate);
    }

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      allowUnknown,
      stripUnknown,
      convert: true,
      presence: 'required',
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/["]/g, ''),
        type: detail.type,
        value: detail.context?.value,
      }));

      return res.status(400).json({
        error: 'Error de validación',
        message: 'Los datos enviados no son válidos',
        details: errorDetails,
      });
    }

    // Reemplazar los datos validados y sanitizados
    req[property] = value;
    req.validatedData = value;
    next();
  };
};

/**
 * Validar parámetros de query
 */
const validateQuery = (additionalSchema = {}) => {
  const baseQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().max(50).default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    search: Joi.string().max(200),
    ...additionalSchema,
  });

  return validate(baseQuerySchema, { property: 'query', allowUnknown: true });
};

/**
 * Validar parámetros de ruta
 */
const validateParams = (schema) => {
  return validate(schema, { property: 'params' });
};

/**
 * Validador común para IDs
 */
const validateId = () => {
  return validateParams(Joi.object({
    id: Joi.string().min(1).max(128).required(),
  }));
};

/**
 * Validador de archivos con seguridad mejorada
 */
const validateFile = (options = {}) => {
  const {
    allowedMimeTypes = [],
    maxSize = 10 * 1024 * 1024, // 10MB por defecto
    required = true,
    fieldName = 'file',
  } = options;

  return (req, res, next) => {
    const file = req.file || req.files?.[fieldName];

    if (!file && required) {
      return res.status(400).json({
        error: 'Archivo requerido',
        message: 'Debe subir un archivo',
      });
    }

    if (file) {
      // Validar tipo MIME
      if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({
          error: 'Tipo de archivo no permitido',
          message: `Tipos permitidos: ${allowedMimeTypes.join(', ')}`,
        });
      }

      // Validar tamaño
      if (file.size > maxSize) {
        return res.status(400).json({
          error: 'Archivo demasiado grande',
          message: `Tamaño máximo: ${(maxSize / (1024 * 1024)).toFixed(1)}MB`,
        });
      }

      // Validar extensión y patrones peligrosos
      const dangerousPatterns = [
        /\.exe$/i, /\.bat$/i, /\.cmd$/i, /\.com$/i, /\.scr$/i,
        /\.js$/i, /\.vbs$/i, /\.php$/i, /\.asp$/i, /\.jsp$/i,
        /\.sh$/i, /\.py$/i, /\.pl$/i, /\.rb$/i,
      ];

      const fileName = file.originalname || file.name || '';
      if (dangerousPatterns.some(pattern => pattern.test(fileName))) {
        return res.status(400).json({
          error: 'Tipo de archivo peligroso',
          message: 'Este tipo de archivo no está permitido por seguridad',
        });
      }

      // Validar nombre de archivo contra caracteres peligrosos
      if (/[<>:"/\\|?*\x00-\x1f]/.test(fileName)) {
        return res.status(400).json({
          error: 'Nombre de archivo inválido',
          message: 'El nombre del archivo contiene caracteres no permitidos',
        });
      }
    }

    next();
  };
};

// Esquemas de validación comunes mejorados
const commonSchemas = {
  // Validación de ID más estricta
  id: Joi.string().min(1).max(128).pattern(/^[a-zA-Z0-9_-]+$/).required(),
  
  // Validación de email con dominio
  email: Joi.string().email({ minDomainSegments: 2 }).max(254).required(),
  
  // Validación de teléfono internacional mejorada
  phone: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
  
  // Validación de texto con límites de seguridad
  safeText: (maxLength = 100) => Joi.string().min(1).max(maxLength).pattern(/^[^<>]*$/),
  
  // Validación de URL
  url: Joi.string().uri({ scheme: ['http', 'https'] }).max(2048),
  
  // Validación de fecha
  date: Joi.date().iso().max('now').required(),
  
  // Validación de tags con límites
  tags: Joi.array().items(Joi.string().max(50).pattern(/^[a-zA-Z0-9_-]+$/)).max(20),
};

// Esquemas específicos para cada entidad con validaciones mejoradas
const schemas = {
  // Autenticación con rate limiting considerado
  auth: {
    login: Joi.object({
      email: commonSchemas.email,
      password: Joi.string().min(6).max(128).required(),
      captcha: Joi.string().when('$requireCaptcha', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
    }),
    
    refreshToken: Joi.object({
      refreshToken: Joi.string().min(10).max(512).required(),
    }),
  },

  // Contactos con validaciones estrictas
  contact: {
    create: Joi.object({
      name: commonSchemas.safeText(100).required(),
      phone: commonSchemas.phone,
      email: Joi.string().email({ minDomainSegments: 2 }).max(254).optional(),
      tags: commonSchemas.tags.default([]),
      customFields: Joi.object().pattern(
        Joi.string().max(50).pattern(/^[a-zA-Z0-9_]+$/),
        Joi.alternatives().try(
          Joi.string().max(500),
          Joi.number().min(-999999999).max(999999999),
          Joi.boolean()
        )
      ).max(20),
      notes: Joi.string().max(1000).allow(''),
    }),
    
    update: Joi.object({
      name: commonSchemas.safeText(100),
      phone: commonSchemas.phone,
      email: Joi.string().email({ minDomainSegments: 2 }).max(254).allow(''),
      tags: commonSchemas.tags,
      customFields: Joi.object().pattern(
        Joi.string().max(50).pattern(/^[a-zA-Z0-9_]+$/),
        Joi.alternatives().try(
          Joi.string().max(500),
          Joi.number().min(-999999999).max(999999999),
          Joi.boolean()
        )
      ).max(20),
      notes: Joi.string().max(1000).allow(''),
    }),
    
    importCsv: Joi.object({
      overwrite: Joi.boolean().default(false),
      skipErrors: Joi.boolean().default(true),
    }),

    addTags: Joi.object({
      tags: Joi.array().items(Joi.string().max(50).pattern(/^[a-zA-Z0-9_-]+$/)).min(1).max(10).required(),
    }),
  },

  // Mensajes con validación de contenido
  message: {
    send: Joi.object({
      contactId: commonSchemas.id,
      content: Joi.string().min(1).max(4096).required(),
      type: Joi.string().valid('text', 'image', 'document', 'audio', 'video').default('text'),
      metadata: Joi.object().max(20).optional(),
    }),
    
    webhook: Joi.object({
      From: Joi.string().required(),
      To: Joi.string().required(),
      Body: Joi.string().max(4096).allow(''),
      MessageSid: Joi.string().required(),
      AccountSid: Joi.string().required(),
      NumMedia: Joi.string().pattern(/^\d+$/),
      MediaUrl0: Joi.string().uri().optional(),
      MediaContentType0: Joi.string().max(100).optional(),
    }),

    markRead: Joi.object({
      messageId: commonSchemas.id,
    }),
  },

  // Campañas con validaciones de negocio
  campaign: {
    create: Joi.object({
      name: commonSchemas.safeText(200).required(),
      message: Joi.string().min(1).max(4096).required(),
      contacts: Joi.array().items(commonSchemas.id).min(1).max(10000).required(),
      scheduledAt: Joi.date().greater('now').optional(),
      status: Joi.string().valid('draft', 'scheduled').default('draft'),
      budget: Joi.number().min(0).max(1000000).optional(),
      template: Joi.object().max(50).optional(),
    }),
    
    update: Joi.object({
      name: commonSchemas.safeText(200),
      message: Joi.string().min(1).max(4096),
      contacts: Joi.array().items(commonSchemas.id).min(1).max(10000),
      scheduledAt: Joi.date().greater('now'),
      budget: Joi.number().min(0).max(1000000),
      template: Joi.object().max(50),
    }),

    send: Joi.object({
      confirm: Joi.boolean().valid(true).required(),
    }),
  },

  // Base de conocimiento con validaciones de contenido
  knowledge: {
    create: Joi.object({
      title: commonSchemas.safeText(200).required(),
      content: Joi.string().min(1).max(50000).required(),
      category: Joi.string().max(50).pattern(/^[a-zA-Z0-9_-]+$/).default('general'),
      tags: commonSchemas.tags.default([]),
      type: Joi.string().valid('article', 'faq', 'video', 'document').default('article'),
      isPublic: Joi.boolean().default(true),
      isPinned: Joi.boolean().default(false),
      fileUrl: commonSchemas.url.optional(),
      fileName: Joi.string().max(255).optional(),
    }),
    
    update: Joi.object({
      title: commonSchemas.safeText(200),
      content: Joi.string().min(1).max(50000),
      category: Joi.string().max(50).pattern(/^[a-zA-Z0-9_-]+$/),
      tags: commonSchemas.tags,
      type: Joi.string().valid('article', 'faq', 'video', 'document'),
      isPublic: Joi.boolean(),
      isPinned: Joi.boolean(),
      fileUrl: commonSchemas.url,
      fileName: Joi.string().max(255),
    }),

    search: Joi.object({
      q: Joi.string().min(1).max(200).required(),
      category: Joi.string().max(50).pattern(/^[a-zA-Z0-9_-]+$/),
      type: Joi.string().valid('article', 'faq', 'video', 'document'),
      limit: Joi.number().min(1).max(100).default(20),
    }),

    vote: Joi.object({
      helpful: Joi.boolean().required(),
    }),

    rate: Joi.object({
      rating: Joi.number().min(1).max(5).required(),
    }),
  },

  // Equipo con validaciones de roles
  team: {
    invite: Joi.object({
      email: commonSchemas.email,
      displayName: commonSchemas.safeText(100).required(),
      role: Joi.string().valid('admin', 'agent', 'viewer').default('viewer'),
    }),
    
    update: Joi.object({
      displayName: commonSchemas.safeText(100),
      role: Joi.string().valid('admin', 'agent', 'viewer'),
      isActive: Joi.boolean(),
    }),

    resetPassword: Joi.object({
      confirm: Joi.boolean().valid(true).required(),
    }),
  },

  // Dashboard con validaciones de períodos
  dashboard: {
    metrics: Joi.object({
      period: Joi.string().valid('1d', '7d', '30d', '90d', '1y').default('7d'),
      startDate: Joi.date().iso(),
      endDate: Joi.date().iso().greater(Joi.ref('startDate')),
    }),

    export: Joi.object({
      format: Joi.string().valid('json', 'csv', 'pdf').default('json'),
      period: Joi.string().valid('7d', '30d', '90d').default('30d'),
      includeDetails: Joi.boolean().default(false),
    }),
  },

  // Validaciones para filtros comunes
  filters: {
    general: Joi.object({
      search: Joi.string().max(200),
      status: Joi.string().max(50),
      isActive: Joi.boolean(),
      startDate: Joi.date().iso(),
      endDate: Joi.date().iso().greater(Joi.ref('startDate')),
      tags: Joi.alternatives().try(
        Joi.string().max(50),
        Joi.array().items(Joi.string().max(50)).max(10)
      ),
    }),

    messages: Joi.object({
      contactId: commonSchemas.id,
      direction: Joi.string().valid('inbound', 'outbound'),
      status: Joi.string().valid('pending', 'sent', 'delivered', 'read', 'failed'),
      type: Joi.string().valid('text', 'image', 'document', 'audio', 'video'),
    }),

    campaigns: Joi.object({
      status: Joi.string().valid('draft', 'scheduled', 'sending', 'completed', 'paused', 'cancelled'),
      createdBy: commonSchemas.id,
    }),

    knowledge: Joi.object({
      category: Joi.string().max(50),
      type: Joi.string().valid('article', 'faq', 'video', 'document'),
      isPublic: Joi.boolean(),
      isPinned: Joi.boolean(),
    }),

    team: Joi.object({
      role: Joi.string().valid('admin', 'agent', 'viewer'),
      isActive: Joi.boolean(),
    }),
  },
};

/**
 * Rate limiting configuration
 */
const rateLimitConfig = {
  '/auth/login': { windowMs: 15 * 60 * 1000, max: 5 }, // 5 intentos por 15 min
  '/messages/send': { windowMs: 60 * 1000, max: 60 }, // 60 mensajes por minuto
  '/contacts/import/csv': { windowMs: 60 * 60 * 1000, max: 3 }, // 3 importaciones por hora
  '/team/invite': { windowMs: 60 * 60 * 1000, max: 10 }, // 10 invitaciones por hora
  '/knowledge/upload': { windowMs: 60 * 60 * 1000, max: 20 }, // 20 uploads por hora
  'default': { windowMs: 15 * 60 * 1000, max: 1000 }, // 1000 requests por 15 min
};

module.exports = {
  validate,
  validateQuery,
  validateParams,
  validateId,
  validateFile,
  sanitizeData,
  schemas,
  commonSchemas,
  rateLimitConfig,
}; 