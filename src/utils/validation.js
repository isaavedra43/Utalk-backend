const Joi = require('joi');
const sanitizeHtml = require('sanitize-html');

/**
 * Sanitización de datos contra XSS y inyecciones
 */
const sanitizeData = (data) => {
  if (typeof data === 'string') {
    // Sanitizar HTML y scripts maliciosos usando sanitize-html
    let sanitized = sanitizeHtml(data, {
      allowedTags: [],
      allowedAttributes: {},
      disallowedTagsMode: 'discard',
      textFilter: function (text) {
        return text
          .replace(/javascript:/gi, '')
          .replace(/on\w+=/gi, '')
          .replace(/data:/gi, '')
          .replace(/vbscript:/gi, '');
      },
    });

    // Escapar caracteres especiales adicionales
    sanitized = sanitized
      .replace(/[<>]/g, '')
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
      // Validar contra caracteres de control utilizando propiedades Unicode (Cc)
      if (/[<>:"/\\|?*\p{Cc}]/u.test(fileName)) {
        return res.status(400).json({
          error: 'Nombre de archivo inválido',
          message: 'El nombre del archivo contiene caracteres no permitidos',
        });
      }
    }

    next();
  };
};

/**
 * Validar que un objeto mensaje tenga todos los campos obligatorios
 * según la especificación del sistema
 * @param {Object} message - Objeto mensaje a validar
 * @returns {Object} Objeto validado con campos obligatorios garantizados
 */
const validateMessageResponse = (message) => {
  if (!message || typeof message !== 'object') {
    throw new Error('El mensaje debe ser un objeto válido');
  }

  // ✅ CAMPOS OBLIGATORIOS SEGÚN ESPECIFICACIÓN
  const requiredFields = [
    'id', 'content', 'timestamp', 'from', 'to',
    'direction', 'status', 'conversationId',
  ];

  // Verificar que todos los campos obligatorios estén presentes
  const missingFields = requiredFields.filter(field =>
    message[field] === null || message[field] === undefined,
  );

  if (missingFields.length > 0) {
    throw new Error(`Campos obligatorios faltantes en mensaje: ${missingFields.join(', ')}`);
  }

  // Validar valores específicos
  if (!['inbound', 'outbound', 'unknown'].includes(message.direction)) {
    throw new Error(`Direction inválido: ${message.direction}`);
  }

  if (!['pending', 'sent', 'delivered', 'read', 'failed'].includes(message.status)) {
    throw new Error(`Status inválido: ${message.status}`);
  }

  // ✅ GARANTIZAR QUE TEXT ESTÉ PRESENTE PARA COMPATIBILIDAD CON FRONTEND
  if (!Object.prototype.hasOwnProperty.call(message, 'text')) {
    message.text = message.content || '';
  }

  return message;
};

/**
 * Validar un array de mensajes
 * @param {Array} messages - Array de mensajes a validar
 * @returns {Array} Array de mensajes validados
 */
const validateMessagesArrayResponse = (messages) => {
  if (!Array.isArray(messages)) {
    throw new Error('Messages debe ser un array');
  }

  return messages.map((message, index) => {
    try {
      return validateMessageResponse(message);
    } catch (error) {
      throw new Error(`Error en mensaje ${index}: ${error.message}`);
    }
  });
};

/**
 * Crear respuesta de mensajes garantizada como válida
 * @param {Array} messages - Array de instancias del modelo Message
 * @param {Object} pagination - Información de paginación
 * @param {Object} additionalData - Datos adicionales (filtros, etc.)
 * @returns {Object} Respuesta validada
 */
const createValidatedMessagesResponse = (messages, pagination = {}, additionalData = {}) => {
  // Convertir instancias de Message a JSON y validar
  const jsonMessages = messages.map(message => {
    if (typeof message.toJSON === 'function') {
      return message.toJSON();
    }
    return message;
  });

  // Validar que todos los mensajes tengan los campos correctos
  const validatedMessages = validateMessagesArrayResponse(jsonMessages);

  return {
    messages: validatedMessages,
    pagination: {
      limit: pagination.limit || 50,
      startAfter: pagination.startAfter || null,
      nextStartAfter: pagination.nextStartAfter || null,
      hasNextPage: pagination.hasNextPage || false,
      messageCount: validatedMessages.length,
      ...pagination,
    },
    ...additionalData,
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
      phone: commonSchemas.phone.required(),
      email: Joi.string().email({ minDomainSegments: 2 }).max(254).optional(),
      tags: commonSchemas.tags.optional().default([]),
    }),

    update: Joi.object({
      name: commonSchemas.safeText(100).optional(),
      phone: commonSchemas.phone.optional(),
      email: Joi.string().email({ minDomainSegments: 2 }).max(254).optional().allow(''),
      tags: commonSchemas.tags.optional(),
    }),

    importCsv: Joi.object({
      overwrite: Joi.boolean().default(false),
      skipErrors: Joi.boolean().default(true),
    }),

    addTags: Joi.object({
      tags: Joi.array().items(Joi.string().max(50).pattern(/^[a-zA-Z0-9_-]+$/)).min(1).max(10).required(),
    }),
  },

  // Conversaciones con validaciones estrictas
  conversation: {
    assign: Joi.object({
      assignedTo: Joi.object({
        id: commonSchemas.id,
        name: commonSchemas.safeText(100).required(),
      }).required(),
    }),

    changeStatus: Joi.object({
      status: Joi.string().valid('open', 'closed').required(),
    }),

    list: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      assignedTo: Joi.string().max(128).optional(),
      status: Joi.string().valid('open', 'closed').optional(),
      customerPhone: commonSchemas.phone.optional(),
      sortBy: Joi.string().valid('lastMessageAt', 'createdAt').default('lastMessageAt'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
      search: Joi.string().max(200).optional(),
    }),
  },

  // Mensajes con validación de contenido
  message: {
    send: Joi.object({
      conversationId: Joi.string().pattern(/^conv_\d+_\d+$/).required(),
      sender: Joi.object({
        id: commonSchemas.id,
        name: commonSchemas.safeText(100).required(),
      }).required(),
      content: Joi.string().min(1).max(4096).required(),
      timestamp: Joi.string().isoDate().required(),
      media: Joi.object({
        url: commonSchemas.url.required(),
        type: Joi.string().valid('image', 'document', 'audio', 'video').required(),
      }).optional().allow(null),
      status: Joi.string().valid('sent', 'pending', 'failed').optional(),
    }),

    create: Joi.object({
      conversationId: Joi.string().pattern(/^conv_\d+_\d+$/).required(),
      sender: Joi.object({
        id: commonSchemas.id,
        name: commonSchemas.safeText(100).required(),
      }).required(),
      content: Joi.string().max(4096).allow(''),
      timestamp: Joi.string().isoDate().required(),
      media: Joi.object({
        url: commonSchemas.url.required(),
        type: Joi.string().valid('image', 'document', 'audio', 'video').required(),
      }).optional().allow(null),
      status: Joi.string().valid('sent', 'pending', 'failed').optional(),
    }),

    readMultiple: Joi.object({
      messageIds: Joi.array().items(Joi.string().min(1).max(128)).min(1).max(100).required(),
      conversationId: Joi.string().pattern(/^conv_\d+_\d+$/).optional(),
    }),

    webhook: Joi.object({
      // Campos requeridos por Twilio
      From: Joi.string().required(),
      To: Joi.string().required(),
      MessageSid: Joi.string().required(),
      AccountSid: Joi.string().required(),

      // Campos opcionales comunes
      Body: Joi.string().max(4096).allow('').optional(),
      NumMedia: Joi.alternatives().try(
        Joi.string().pattern(/^\d+$/),
        Joi.number().integer().min(0),
      ).optional(),

      // Media handling - hasta 10 archivos posibles
      MediaUrl0: Joi.string().uri().optional(),
      MediaContentType0: Joi.string().max(100).optional(),
      MediaUrl1: Joi.string().uri().optional(),
      MediaContentType1: Joi.string().max(100).optional(),
      MediaUrl2: Joi.string().uri().optional(),
      MediaContentType2: Joi.string().max(100).optional(),
      MediaUrl3: Joi.string().uri().optional(),
      MediaContentType3: Joi.string().max(100).optional(),
      MediaUrl4: Joi.string().uri().optional(),
      MediaContentType4: Joi.string().max(100).optional(),

      // Status callback fields
      MessageStatus: Joi.string().valid('sent', 'delivered', 'undelivered', 'failed', 'received', 'read').optional(),
      SmsStatus: Joi.string().optional(),
      SmsSid: Joi.string().optional(),
      SmsMessageSid: Joi.string().optional(),

      // WhatsApp specific fields
      ProfileName: Joi.string().max(200).optional(),
      WaId: Joi.string().optional(),

      // Geolocation fields
      Latitude: Joi.string().pattern(/^-?\d+\.?\d*$/).optional(),
      Longitude: Joi.string().pattern(/^-?\d+\.?\d*$/).optional(),

      // Error handling
      ErrorCode: Joi.string().optional(),
      ErrorMessage: Joi.string().max(500).optional(),

      // Timestamp fields
      Timestamp: Joi.string().optional(),
      DateCreated: Joi.string().optional(),
      DateUpdated: Joi.string().optional(),
      DateSent: Joi.string().optional(),

      // Additional Twilio fields (flexible approach)
      ApiVersion: Joi.string().optional(),
      Direction: Joi.string().valid('inbound', 'outbound-api', 'outbound-call', 'outbound-reply').optional(),
      Price: Joi.string().optional(),
      PriceUnit: Joi.string().optional(),
      Uri: Joi.string().uri().optional(),
      SubresourceUris: Joi.object().optional(),

      // ForwardedFrom field for forwarded messages
      ForwardedFrom: Joi.string().optional(),
    }).unknown(true), // ✅ CRÍTICO: Permitir campos adicionales de Twilio

    markRead: Joi.object({
      messageId: commonSchemas.id,
    }),
  },

  // Campañas con validaciones de negocio
  campaign: {
    create: Joi.object({
      name: commonSchemas.safeText(200).required(),
      status: Joi.string().valid('active', 'draft').required(),
    }),

    update: Joi.object({
      name: commonSchemas.safeText(200).optional(),
      status: Joi.string().valid('active', 'draft').optional(),
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
      name: commonSchemas.safeText(100).required(),
      role: Joi.string().valid('admin', 'agent', 'viewer').default('viewer'),
    }),

    update: Joi.object({
      name: commonSchemas.safeText(100),
      role: Joi.string().valid('admin', 'agent', 'viewer'),
      status: Joi.string().valid('active', 'inactive'),
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
        Joi.array().items(Joi.string().max(50)).max(10),
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
  default: { windowMs: 15 * 60 * 1000, max: 1000 }, // 1000 requests por 15 min
};

// EXPORT PATTERN: Object with multiple utility functions and schemas
// USAGE: const { validate, schemas } = require('./validation');
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
  validateMessageResponse,
  validateMessagesArrayResponse,
  createValidatedMessagesResponse,
};
