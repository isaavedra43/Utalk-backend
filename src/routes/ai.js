/**
 * 🤖 RUTAS DE IA
 * 
 * Endpoints para configuración y operaciones de IA
 * con validaciones Joi y middleware de autenticación.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const express = require('express');
const Joi = require('joi');
const router = express.Router();

// Middlewares
const authMiddleware = require('../middleware/authMiddleware');
const { requireReadAccess, requireWriteAccess } = require('../middleware/accessMiddleware');
const { validateRequest } = require('../middleware/validationMiddleware');

// Controlador
const AIController = require('../controllers/AIController');

/**
 * Validaciones Joi para endpoints de IA
 */
const aiValidators = {
  // Validación para workspaceId en params
  validateWorkspaceId: Joi.object({
    workspaceId: Joi.string().required().min(1).max(100)
      .description('ID del workspace')
  }),

  // Validación para actualizar configuración IA
  validateUpdateConfig: Joi.object({
    ai_enabled: Joi.boolean().optional()
      .description('Habilitar/deshabilitar IA'),
    provider: Joi.string().valid('openai', 'anthropic', 'gemini').optional()
      .description('Proveedor de IA'),
    defaultModel: Joi.string().optional().valid(
      'gpt-4o-mini',
      'gpt-4o',
      'gpt-3.5-turbo',
      'claude-3-haiku',
      'claude-3-sonnet',
      'gemini-1.5-flash'
    ).description('Modelo de IA por defecto'),
    escalationModel: Joi.string().optional().valid(
      'gpt-4o-mini',
      'gpt-4o',
      'gpt-3.5-turbo',
      'claude-3-haiku',
      'claude-3-sonnet',
      'gemini-1.5-flash'
    ).description('Modelo de escalación'),
    temperature: Joi.number().min(0).max(1).optional()
      .description('Temperatura del modelo (0-1)'),
    maxTokens: Joi.number().integer().min(1).max(300).optional()
      .description('Máximo de tokens de respuesta'),
    flags: Joi.object({
      suggestions: Joi.boolean().optional(),
      rag: Joi.boolean().optional(),
      reports: Joi.boolean().optional(),
      console: Joi.boolean().optional(),
      provider_ready: Joi.boolean().optional()
    }).optional().description('Banderas de funcionalidades'),
    policies: Joi.object({
      no_inventar_precios: Joi.boolean().optional(),
      tono: Joi.string().valid('profesional', 'amigable', 'formal').optional(),
      idioma: Joi.string().valid('es', 'en').optional()
    }).optional().description('Políticas de IA'),
    limits: Joi.object({
      maxContextMessages: Joi.number().integer().min(1).max(50).optional(),
      maxResponseLength: Joi.number().integer().min(1).max(1000).optional(),
      maxLatencyMs: Joi.number().integer().min(100).max(30000).optional(),
      maxTokensOut: Joi.number().integer().min(1).max(150).optional(),
      timeout: Joi.number().integer().min(500).max(10000).optional(),
      maxRetries: Joi.number().integer().min(0).max(3).optional()
    }).optional().description('Límites de configuración')
  }),

  // Validación para conversationId
  validateConversationId: Joi.object({
    conversationId: Joi.string().required()
      .description('ID de la conversación')
  }),

  // Validación para actualizar estado de sugerencia
  validateUpdateSuggestionStatus: Joi.object({
    status: Joi.string().valid('draft', 'sent', 'discarded').required()
      .description('Nuevo estado de la sugerencia')
  }),

  // Validación para prueba de sugerencia
  validateTestSuggestion: Joi.object({
    workspaceId: Joi.string().required().min(1).max(100)
      .description('ID del workspace'),
    conversationId: Joi.string().required().min(1).max(100)
      .description('ID de la conversación'),
    messageId: Joi.string().required().min(1).max(100)
      .description('ID del mensaje')
  }),

  // Validación para conversationId en params
  validateConversationId: Joi.object({
    conversationId: Joi.string().required().min(1).max(100)
      .description('ID de la conversación')
  }),

  // Validación para query params de sugerencias
  validateSuggestionsQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(10)
      .description('Límite de sugerencias a obtener'),
    status: Joi.string().valid('draft', 'used', 'rejected', 'archived').optional()
      .description('Filtrar por estado de sugerencia')
  }),

  // Validación para actualizar estado de sugerencia
  validateUpdateSuggestionStatus: Joi.object({
    status: Joi.string().required().valid('draft', 'used', 'rejected', 'archived')
      .description('Nuevo estado de la sugerencia')
  }),

  // Validación para suggestionId en params
  validateSuggestionId: Joi.object({
    conversationId: Joi.string().required().min(1).max(100)
      .description('ID de la conversación'),
    suggestionId: Joi.string().required().min(1).max(100)
      .description('ID de la sugerencia')
  }),

  // Validación para query params de estadísticas
  validateStatsQuery: Joi.object({
    days: Joi.number().integer().min(1).max(90).default(7)
      .description('Número de días para las estadísticas')
  })
};

/**
 * Rutas de configuración IA
 */

// GET /api/ai/config/:workspaceId
router.get('/config/:workspaceId',
  authMiddleware,
  requireReadAccess,
  validateRequest(aiValidators.validateWorkspaceId, 'params'),
  AIController.getAIConfig
);

// PUT /api/ai/config/:workspaceId
router.put('/config/:workspaceId',
  authMiddleware,
  requireWriteAccess,
  validateRequest(aiValidators.validateWorkspaceId, 'params'),
  validateRequest(aiValidators.validateUpdateConfig, 'body'),
  AIController.updateAIConfig
);

/**
 * Rutas de sugerencias IA
 */

// POST /api/ai/suggestions/generate
router.post('/suggestions/generate',
  authMiddleware,
  requireWriteAccess,
  validateRequest(aiValidators.validateTestSuggestion, 'body'),
  AIController.generateSuggestion
);

// POST /api/ai/dry-run/suggest
router.post('/dry-run/suggest',
  authMiddleware,
  requireWriteAccess,
  validateRequest(aiValidators.validateTestSuggestion, 'body'),
  AIController.dryRunSuggestion
);

// POST /api/ai/test-suggestion
router.post('/test-suggestion',
  authMiddleware,
  requireWriteAccess,
  validateRequest(aiValidators.validateTestSuggestion, 'body'),
  AIController.testSuggestion
);

// GET /api/ai/suggestions/:conversationId
router.get('/suggestions/:conversationId',
  authMiddleware,
  requireReadAccess,
  validateRequest(aiValidators.validateConversationId, 'params'),
  AIController.getSuggestions
);

// PUT /api/ai/suggestions/:conversationId/:suggestionId/status
router.put('/suggestions/:conversationId/:suggestionId/status',
  authMiddleware,
  requireWriteAccess,
  validateRequest(aiValidators.validateUpdateSuggestionStatus, 'body'),
  AIController.updateSuggestionStatus
);

// GET /api/ai/suggestions/:conversationId/stats
router.get('/suggestions/:conversationId/stats',
  authMiddleware,
  requireReadAccess,
  validateRequest(aiValidators.validateConversationId, 'params'),
  AIController.getSuggestionStats
);

// GET /api/ai/suggestions/:conversationId
router.get('/suggestions/:conversationId',
  authMiddleware,
  requireReadAccess,
  validateRequest(aiValidators.validateConversationId, 'params'),
  validateRequest(aiValidators.validateSuggestionsQuery, 'query'),
  AIController.getSuggestions
);

// PUT /api/ai/suggestions/:conversationId/:suggestionId/status
router.put('/suggestions/:conversationId/:suggestionId/status',
  authMiddleware,
  requireWriteAccess,
  validateRequest(aiValidators.validateSuggestionId, 'params'),
  validateRequest(aiValidators.validateUpdateSuggestionStatus, 'body'),
  AIController.updateSuggestionStatus
);

/**
 * Rutas de estadísticas IA
 */

// GET /api/ai/stats/:workspaceId
router.get('/stats/:workspaceId',
  authMiddleware,
  requireReadAccess,
  validateRequest(aiValidators.validateWorkspaceId, 'params'),
  validateRequest(aiValidators.validateStatsQuery, 'query'),
  AIController.getAIStats
);

/**
 * Rutas de health check
 */

// GET /api/ai/health
router.get('/health',
  AIController.getAIHealth
);

module.exports = {
  router,
  aiValidators
};