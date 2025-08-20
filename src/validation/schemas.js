const Joi = require('joi');

/**
 * Esquemas de validación centralizados
 * Elimina duplicaciones en validaciones Joi
 */

// Esquemas comunes reutilizables
const commonSchemas = {
  // Paginación estándar
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    startAfter: Joi.string().optional()
  }),

  // Ordenamiento estándar
  sorting: Joi.object({
    orderBy: Joi.string().valid('createdAt', 'updatedAt', 'timestamp', 'name', 'email').default('createdAt'),
    order: Joi.string().valid('asc', 'desc').default('desc')
  }),

  // Filtros de fecha
  dateFilters: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional()
  }),

  // Metadata opcional
  metadata: Joi.object().optional(),

  // Workspace/Tenant IDs
  workspaceId: Joi.string().required(),
  tenantId: Joi.string().required(),

  // UUIDs
  uuid: Joi.string().uuid().required(),
  optionalUuid: Joi.string().uuid().optional(),

  // Emails
  email: Joi.string().email().required(),
  optionalEmail: Joi.string().email().optional(),

  // Teléfonos
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
  optionalPhone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),

  // Contenido de mensajes
  messageContent: Joi.string().max(4096).optional(),
  messageType: Joi.string().valid('text', 'media', 'location', 'sticker', 'file').default('text'),
  messageDirection: Joi.string().valid('inbound', 'outbound').required(),

  // Estados
  status: Joi.string().valid('active', 'inactive', 'pending', 'completed', 'cancelled').optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),

  // Archivos
  fileUpload: Joi.object({
    filename: Joi.string().required(),
    mimetype: Joi.string().required(),
    size: Joi.number().max(10 * 1024 * 1024).required() // 10MB max
  }),

  // Twilio
  twilioSid: Joi.string().pattern(/^[A-Z]{2}[a-f0-9]{32}$/).required(),
  mediaSid: Joi.string().pattern(/^[A-Z]{2}[a-f0-9]{32}$/).optional()
};

// Esquemas específicos por módulo
const messageSchemas = {
  create: Joi.object({
    conversationId: Joi.string().uuid().required(),
    content: Joi.string().max(4096).optional(),
    type: Joi.string().valid('text', 'media', 'location', 'sticker', 'file').default('text'),
    direction: Joi.string().valid('inbound', 'outbound').required(),
    senderIdentifier: Joi.string().required(),
    recipientIdentifier: Joi.string().required(),
    metadata: Joi.object().optional()
  }),

  send: Joi.object({
    conversationId: Joi.string().uuid().required(),
    content: Joi.string().max(4096).optional(),
    type: Joi.string().valid('text', 'media', 'location', 'sticker', 'file').default('text'),
    attachments: Joi.array().items(Joi.object({
      type: Joi.string().required(),
      url: Joi.string().uri().required(),
      filename: Joi.string().optional()
    })).optional(),
    metadata: Joi.object().optional()
  }),

  location: Joi.object({
    conversationId: Joi.string().uuid().required(),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    address: Joi.string().optional(),
    metadata: Joi.object().optional()
  }),

  sticker: Joi.object({
    conversationId: Joi.string().uuid().required(),
    stickerId: Joi.string().required(),
    emoji: Joi.string().optional(),
    metadata: Joi.object().optional()
  }),

  webhook: Joi.object({
    MessageSid: Joi.string().pattern(/^[A-Z]{2}[a-f0-9]{32}$/).required(),
    From: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    To: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    Body: Joi.string().optional(),
    NumMedia: Joi.string().optional(),
    MediaUrl0: Joi.string().uri().optional(),
    MediaContentType0: Joi.string().optional()
  })
};

const conversationSchemas = {
  create: Joi.object({
    contactId: Joi.string().uuid().required(),
    title: Joi.string().max(255).optional(),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
    metadata: Joi.object().optional()
  }),

  update: Joi.object({
    title: Joi.string().max(255).optional(),
    status: Joi.string().valid('active', 'inactive', 'pending', 'completed', 'cancelled').optional(),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
    metadata: Joi.object().optional()
  }),

  assign: Joi.object({
    agentEmail: Joi.string().email().required()
  }),

  list: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    startAfter: Joi.string().optional(),
    orderBy: Joi.string().valid('createdAt', 'updatedAt', 'timestamp', 'name', 'email').default('createdAt'),
    order: Joi.string().valid('asc', 'desc').default('desc'),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    status: Joi.string().valid('active', 'inactive', 'pending', 'completed', 'cancelled').optional(),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
    agentEmail: Joi.string().email().optional()
  })
};

const userSchemas = {
  create: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    name: Joi.string().max(255).required(),
    role: Joi.string().valid('admin', 'agent', 'viewer').default('viewer'),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    department: Joi.string().max(255).optional(),
    metadata: Joi.object().optional()
  }),

  update: Joi.object({
    name: Joi.string().max(255).optional(),
    role: Joi.string().valid('admin', 'agent', 'viewer').optional(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    department: Joi.string().max(255).optional(),
    isActive: Joi.boolean().optional(),
    metadata: Joi.object().optional()
  })
};

const campaignSchemas = {
  create: Joi.object({
    name: Joi.string().max(255).required(),
    description: Joi.string().max(1000).optional(),
    targetAudience: Joi.array().items(Joi.string().pattern(/^\+?[1-9]\d{1,14}$/)).min(1).required(),
    messageTemplate: Joi.string().max(1000).required(),
    schedule: Joi.object({
      startDate: Joi.date().iso().required(),
      endDate: Joi.date().iso().optional(),
      timezone: Joi.string().default('America/Mexico_City')
    }).optional(),
    metadata: Joi.object().optional()
  }),

  update: Joi.object({
    name: Joi.string().max(255).optional(),
    description: Joi.string().max(1000).optional(),
    messageTemplate: Joi.string().max(1000).optional(),
    status: Joi.string().valid('active', 'inactive', 'pending', 'completed', 'cancelled').optional(),
    metadata: Joi.object().optional()
  })
};

const knowledgeSchemas = {
  create: Joi.object({
    title: Joi.string().max(255).required(),
    content: Joi.string().max(10000).required(),
    category: Joi.string().max(100).optional(),
    tags: Joi.array().items(Joi.string().max(50)).optional(),
    metadata: Joi.object().optional()
  }),

  update: Joi.object({
    title: Joi.string().max(255).optional(),
    content: Joi.string().max(10000).optional(),
    category: Joi.string().max(100).optional(),
    tags: Joi.array().items(Joi.string().max(50)).optional(),
    metadata: Joi.object().optional()
  }),

  search: Joi.object({
    query: Joi.string().min(1).required(),
    category: Joi.string().max(100).optional(),
    tags: Joi.array().items(Joi.string().max(50)).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    startAfter: Joi.string().optional()
  })
};

module.exports = {
  commonSchemas,
  messageSchemas,
  conversationSchemas,
  userSchemas,
  campaignSchemas,
  knowledgeSchemas
}; 