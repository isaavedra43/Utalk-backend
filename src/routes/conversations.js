const express = require('express');
const router = express.Router();
const ConversationController = require('../controllers/ConversationController');
const { validateRequest } = require('../middleware/validation');
const { validatePhoneInBody } = require('../middleware/phoneValidation');
const { authMiddleware, requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const { normalizeConversationId } = require('../middleware/conversationIdNormalization');
const { validateMessagePayload, autoGenerateMessageId, fallbackSenderIdentifier } = require('../middleware/messageValidation');
const { validateId, validateConversationId } = require('../middleware/validation');
const { intelligentRateLimit, cacheMiddleware } = require('../middleware/intelligentRateLimit');
const Joi = require('joi');

// 🔧 FORZAR REDEPLOY RAILWAY - Esquema de validación expandido para frontend
const logger = require('../utils/logger');

const conversationValidators = {
  validateCreate: validateRequest({
    body: Joi.object({
      // Campos básicos requeridos
      customerPhone: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
      customerName: Joi.string().max(100).allow('', null).optional(),
      
      // Campos opcionales básicos
      subject: Joi.string().max(200).allow('', null).optional(),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
      tags: Joi.array().items(Joi.string()).max(10).optional(),
      metadata: Joi.object().optional(),
      
      // Campos adicionales que envía el frontend
      id: Joi.string().optional(),
      status: Joi.string().valid('open', 'pending', 'resolved', 'closed').optional(),
      participants: Joi.array().items(Joi.string()).optional(),
      createdBy: Joi.string().email().optional(),
      assignedTo: Joi.string().email().optional(),
      assignedToName: Joi.string().optional().allow(null, ''),
      createdAt: Joi.string().isoDate().optional(),
      updatedAt: Joi.string().isoDate().optional(),
      lastMessageAt: Joi.string().isoDate().optional(),
      unreadCount: Joi.number().integer().min(0).optional(),
      messageCount: Joi.number().integer().min(0).optional(),
      tenantId: Joi.string().optional(),
      workspaceId: Joi.string().optional(),
      messages: Joi.array().optional(),
      lastMessage: Joi.object().optional().allow(null),
      
      // Campos adicionales para compatibilidad
      initialMessage: Joi.string().allow('', null).optional(),
      channel: Joi.string().optional(),
      source: Joi.string().optional(),
      externalId: Joi.string().optional(),
      notes: Joi.string().optional(),
      customFields: Joi.object().optional()
    }).unknown(true) // Permitir campos adicionales no definidos
  }),

  validateUpdate: validateRequest({
    body: Joi.object({
      customerName: Joi.string().min(1).max(100).optional(),
      subject: Joi.string().min(1).max(200).optional(),
      status: Joi.string().valid('open', 'pending', 'resolved', 'closed').optional(),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
      tags: Joi.array().items(Joi.string()).max(10).optional(),
      metadata: Joi.object().optional()
    })
  }),

  validateAssign: validateRequest({
    body: Joi.object({
      agentEmail: Joi.string().email().required()
    })
  }),

  validateTransfer: validateRequest({
    body: Joi.object({
      targetAgentEmail: Joi.string().email().required(),
      reason: Joi.string().min(1).max(500).optional()
    })
  }),

  validateList: validateRequest({
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      status: Joi.string().valid('open', 'pending', 'resolved', 'closed', 'all').optional(),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
      assignedTo: Joi.string().email().optional(),
      search: Joi.string().min(1).max(100).optional()
    })
  }),

  validateChangeStatus: validateRequest({
    body: Joi.object({
      status: Joi.string().valid('open', 'pending', 'resolved', 'closed').required()
    })
  }),

  validateChangePriority: validateRequest({
    body: Joi.object({
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').required()
    })
  }),

  validateSendMessage: validateRequest({
    body: Joi.object({
      content: Joi.string().min(1).max(4096).required(),
      type: Joi.string().valid('text', 'image', 'audio', 'video', 'document').default('text'),
      replyToMessageId: Joi.string().optional(),
      metadata: Joi.object().optional()
    })
  })
};

/**
 * @route GET /api/conversations
 * @desc Listar conversaciones con filtros y paginación
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/',
  authMiddleware,
  requireReadAccess,
  (req, res, next) => {
    // 🔧 LOG CRÍTICO PARA RAILWAY: Llamada a conversaciones
    req.logger.info('CONVERSATIONS_REQUEST', {
      category: 'CONVERSATIONS_API',
      user: req.user?.email || 'anonymous',
      method: req.method,
      path: req.path,
      query: req.query
    });
    next();
  },
  intelligentRateLimit,
  cacheMiddleware(120), // Cache por 2 minutos
  conversationValidators.validateList,
  ConversationController.listConversations
);

/**
 * @route GET /api/conversations/:id
 * @desc Obtener conversación por ID
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:id',
  authMiddleware,
  requireReadAccess,
  normalizeConversationId, // 🔧 CORRECCIÓN: Normalizar conversationId en params
  (req, res, next) => {
    // 🔧 CORRECCIÓN: Usar el conversationId normalizado para validación
    if (req.normalizedConversationId) {
      req.params.id = req.normalizedConversationId;
    }
    next();
  },
  // 🔧 CORRECCIÓN CRÍTICA: Remover validación redundante ya que normalizeConversationId ya valida
  ConversationController.getConversation
);

/**
 * @route PUT /api/conversations/:id
 * @desc Actualizar conversación
 * @access Private (Agent, Admin)
 */
router.put('/:id',
  authMiddleware,
  requireWriteAccess,
  normalizeConversationId,
  (req, res, next) => {
    if (req.normalizedConversationId) {
      req.params.id = req.normalizedConversationId;
    }
    next();
  },
  // 🔧 CORRECCIÓN CRÍTICA: Remover validación redundante ya que normalizeConversationId ya valida
  conversationValidators.validateUpdate,
  ConversationController.updateConversation
);

/**
 * @route PUT /api/conversations/:id/assign
 * @desc Asignar conversación a agente
 * @access Private (Agent, Admin)
 */
router.put('/:id/assign',
  authMiddleware,
  requireWriteAccess,
  normalizeConversationId,
  (req, res, next) => {
    if (req.normalizedConversationId) {
      req.params.id = req.normalizedConversationId;
    }
    next();
  },
  // 🔧 CORRECCIÓN CRÍTICA: Remover validación redundante ya que normalizeConversationId ya valida
  conversationValidators.validateAssign,
  ConversationController.assignConversation
);

/**
 * @route PUT /api/conversations/:id/unassign
 * @desc Desasignar conversación
 * @access Private (Agent, Admin)
 */
router.put('/:id/unassign',
  authMiddleware,
  requireWriteAccess,
  normalizeConversationId,
  (req, res, next) => {
    if (req.normalizedConversationId) {
      req.params.id = req.normalizedConversationId;
    }
    next();
  },
  // 🔧 CORRECCIÓN CRÍTICA: Remover validación redundante ya que normalizeConversationId ya valida
  ConversationController.unassignConversation
);

/**
 * @route POST /api/conversations/:id/transfer
 * @desc Transferir conversación a otro agente
 * @access Private (Agent, Admin)
 */
router.post('/:id/transfer',
  authMiddleware,
  requireWriteAccess,
  normalizeConversationId,
  (req, res, next) => {
    if (req.normalizedConversationId) {
      req.params.id = req.normalizedConversationId;
    }
    next();
  },
  // 🔧 CORRECCIÓN CRÍTICA: Remover validación redundante ya que normalizeConversationId ya valida
  conversationValidators.validateTransfer,
  ConversationController.transferConversation
);

/**
 * @route PUT /api/conversations/:id/status
 * @desc Cambiar estado de conversación
 * @access Private (Agent, Admin)
 */
router.put('/:id/status',
  authMiddleware,
  requireWriteAccess,
  normalizeConversationId,
  (req, res, next) => {
    if (req.normalizedConversationId) {
      req.params.id = req.normalizedConversationId;
    }
    next();
  },
  // 🔧 CORRECCIÓN CRÍTICA: Remover validación redundante ya que normalizeConversationId ya valida
  conversationValidators.validateChangeStatus,
  ConversationController.changeConversationStatus
);

/**
 * @route PUT /api/conversations/:id/priority
 * @desc Cambiar prioridad de conversación
 * @access Private (Agent, Admin)
 */
router.put('/:id/priority',
  authMiddleware,
  requireWriteAccess,
  normalizeConversationId,
  (req, res, next) => {
    if (req.normalizedConversationId) {
      req.params.id = req.normalizedConversationId;
    }
    next();
  },
  // 🔧 CORRECCIÓN CRÍTICA: Remover validación redundante ya que normalizeConversationId ya valida
  conversationValidators.validateChangePriority,
  ConversationController.changeConversationPriority
);

/**
 * @route PUT /api/conversations/:id/read-all
 * @desc Marcar todos los mensajes como leídos
 * @access Private (Agent, Admin)
 */
router.put('/:id/read-all',
  authMiddleware,
  requireWriteAccess,
  normalizeConversationId,
  (req, res, next) => {
    if (req.normalizedConversationId) {
      req.params.id = req.normalizedConversationId;
    }
    next();
  },
  // 🔧 CORRECCIÓN CRÍTICA: Remover validación redundante ya que normalizeConversationId ya valida
  ConversationController.markConversationAsRead
);

/**
 * @route POST /api/conversations/:id/messages
 * @desc Enviar mensaje en conversación específica
 * @access Private (Agent, Admin)
 */
router.post('/:id/messages',
  authMiddleware,
  requireWriteAccess,
  normalizeConversationId,
  (req, res, next) => {
    if (req.normalizedConversationId) {
      req.params.id = req.normalizedConversationId;
    }
    next();
  },
  // 🔧 CORRECCIÓN CRÍTICA: Remover validación redundante ya que normalizeConversationId ya valida
  autoGenerateMessageId,
  fallbackSenderIdentifier,
  validateMessagePayload,
  ConversationController.sendMessageInConversation
);

/**
 * @route POST /api/conversations/:id/typing
 * @desc Indicar que usuario está escribiendo
 * @access Private (Agent, Admin)
 */
router.post('/:id/typing',
  authMiddleware,
  requireWriteAccess,
  normalizeConversationId,
  (req, res, next) => {
    if (req.normalizedConversationId) {
      req.params.id = req.normalizedConversationId;
    }
    next();
  },
  // 🔧 CORRECCIÓN CRÍTICA: Remover validación redundante ya que normalizeConversationId ya valida
  ConversationController.indicateTyping
);

/**
 * @route POST /api/conversations
 * @desc Crear nueva conversación
 * @access Private (Agent, Admin)
 */
router.post('/',
  authMiddleware,
  requireWriteAccess,
  conversationValidators.validateCreate,
  ConversationController.createConversation
);

/**
 * @route DELETE /api/conversations/:id
 * @desc Eliminar conversación
 * @access Private (Admin)
 */
router.delete('/:id',
  authMiddleware,
  requireWriteAccess,
  normalizeConversationId,
  (req, res, next) => {
    if (req.normalizedConversationId) {
      req.params.id = req.normalizedConversationId;
    }
    next();
  },
  // 🔧 CORRECCIÓN CRÍTICA: Remover validación redundante ya que normalizeConversationId ya valida
  ConversationController.deleteConversation
);

module.exports = router;
