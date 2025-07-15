const Joi = require('joi');

/**
 * Middleware para validar datos con Joi
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/["]/g, ''),
        value: detail.context.value,
      }));

      return res.status(400).json({
        error: 'Error de validación',
        message: 'Los datos enviados no son válidos',
        details: errorDetails,
      });
    }

    // Reemplazar los datos validados y sanitizados
    req[property] = value;
    next();
  };
};

// Esquemas de validación comunes
const commonSchemas = {
  // Validación de ID de MongoDB/Firebase
  id: Joi.string().min(1).max(128).required(),
  
  // Validación de email
  email: Joi.string().email().required(),
  
  // Validación de teléfono
  phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).required(),
  
  // Validación de paginación
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),
  
  // Validación de filtros
  filters: Joi.object({
    search: Joi.string().max(100),
    status: Joi.string().valid('active', 'inactive', 'pending'),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')),
  }),
};

// Esquemas específicos para cada entidad
const schemas = {
  // Autenticación
  auth: {
    login: Joi.object({
      email: commonSchemas.email,
      password: Joi.string().min(6).required(),
    }),
    
    refreshToken: Joi.object({
      refreshToken: Joi.string().required(),
    }),
  },

  // Contactos
  contact: {
    create: Joi.object({
      name: Joi.string().min(1).max(100).required(),
      phone: commonSchemas.phone,
      email: Joi.string().email().optional(),
      tags: Joi.array().items(Joi.string().max(50)).default([]),
      customFields: Joi.object().default({}),
    }),
    
    update: Joi.object({
      name: Joi.string().min(1).max(100),
      phone: commonSchemas.phone,
      email: Joi.string().email().allow(''),
      tags: Joi.array().items(Joi.string().max(50)),
      customFields: Joi.object(),
    }),
    
    list: Joi.object({
      ...commonSchemas.pagination,
      search: Joi.string().max(100),
      tags: Joi.array().items(Joi.string()),
    }),
  },

  // Mensajes
  message: {
    send: Joi.object({
      to: commonSchemas.phone,
      content: Joi.string().min(1).max(1600).required(),
      type: Joi.string().valid('text', 'image', 'document').default('text'),
    }),
    
    webhook: Joi.object({
      From: Joi.string().required(),
      To: Joi.string().required(),
      Body: Joi.string().allow(''),
      MessageSid: Joi.string().required(),
      AccountSid: Joi.string().required(),
      NumMedia: Joi.string(),
    }),
  },

  // Campañas
  campaign: {
    create: Joi.object({
      name: Joi.string().min(1).max(100).required(),
      message: Joi.string().min(1).max(1600).required(),
      contacts: Joi.array().items(Joi.string()).min(1).required(),
      scheduledAt: Joi.date().iso().greater('now').optional(),
      status: Joi.string().valid('draft', 'scheduled', 'sending', 'completed', 'paused').default('draft'),
    }),
    
    update: Joi.object({
      name: Joi.string().min(1).max(100),
      message: Joi.string().min(1).max(1600),
      contacts: Joi.array().items(Joi.string()).min(1),
      scheduledAt: Joi.date().iso().greater('now'),
      status: Joi.string().valid('draft', 'scheduled', 'sending', 'completed', 'paused'),
    }),
  },

  // Base de conocimiento
  knowledge: {
    create: Joi.object({
      title: Joi.string().min(1).max(200).required(),
      content: Joi.string().min(1).max(10000).required(),
      category: Joi.string().max(50).default('general'),
      tags: Joi.array().items(Joi.string().max(50)).default([]),
      isPublic: Joi.boolean().default(true),
    }),
    
    update: Joi.object({
      title: Joi.string().min(1).max(200),
      content: Joi.string().min(1).max(10000),
      category: Joi.string().max(50),
      tags: Joi.array().items(Joi.string().max(50)),
      isPublic: Joi.boolean(),
    }),
  },

  // Equipo
  team: {
    invite: Joi.object({
      email: commonSchemas.email,
      role: Joi.string().valid('admin', 'agent', 'viewer').required(),
      displayName: Joi.string().max(100),
    }),
    
    update: Joi.object({
      role: Joi.string().valid('admin', 'agent', 'viewer'),
      displayName: Joi.string().max(100),
      isActive: Joi.boolean(),
    }),
  },
};

module.exports = {
  validate,
  schemas,
  commonSchemas,
}; 