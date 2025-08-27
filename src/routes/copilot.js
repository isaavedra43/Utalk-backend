/**
 * 🤖 RUTAS DEL COPILOTO IA
 * 
 * Endpoints para el copiloto IA de agentes
 * con validaciones y middleware de autenticación.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const express = require('express');
const Joi = require('joi');
const router = express.Router();

// Middlewares
const { authMiddleware, requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

// Controlador
const CopilotController = require('../controllers/CopilotController');

/**
 * Validaciones Joi para endpoints del copiloto
 */
const copilotValidators = {
  // Validación para chat del copiloto
  validateChat: Joi.object({
    body: Joi.object({
      message: Joi.string().required().min(1).max(2000)
        .description('Mensaje del agente para el copiloto'),
      conversationId: Joi.string().required().min(1).max(100)
        .description('ID de la conversación'),
      agentId: Joi.string().required().min(1).max(100)
        .description('ID del agente'),
      workspaceId: Joi.string().required().min(1).max(100)
        .description('ID del workspace')
    })
  }),

  // Validación para test del copiloto
  validateTest: Joi.object({
    body: Joi.object({
      // Opcional: mensaje de prueba personalizado
      testMessage: Joi.string().optional().max(500)
        .description('Mensaje de prueba personalizado')
    })
  }),
  validateGenerateResponse: Joi.object({
    body: Joi.object({
      conversationId: Joi.string().required(),
      agentId: Joi.string().required(),
      message: Joi.string().allow('').max(4000)
    })
  }),
  validateAnalyzeConversation: Joi.object({
    body: Joi.object({
      conversationMemory: Joi.object().required()
    })
  }),
  validateOptimizeResponse: Joi.object({
    body: Joi.object({
      response: Joi.string().required().max(4000)
    })
  }),
  validateStrategySuggestions: Joi.object({
    body: Joi.object({
      analysis: Joi.object().optional(),
      conversationMemory: Joi.object().optional()
    })
  }),
  validateQuickResponse: Joi.object({
    body: Joi.object({
      urgency: Joi.string().valid('low','normal','medium','high').default('normal'),
      context: Joi.object().optional()
    })
  }),
  validateImproveExperience: Joi.object({
    body: Joi.object({
      conversationMemory: Joi.object().required(),
      analysis: Joi.object().optional()
    })
  })
};

/**
 * Rutas del copiloto
 */

// POST /api/copilot/chat - Chat principal del copiloto
router.post('/chat',
  authMiddleware,
  requireWriteAccess,
  validateRequest(copilotValidators.validateChat, 'body'),
  CopilotController.chat
);

// GET /api/copilot/health - Health check del copiloto
router.get('/health',
  authMiddleware,
  requireReadAccess,
  CopilotController.health
);

// POST /api/copilot/test - Test de funcionalidad
router.post('/test',
  authMiddleware,
  requireWriteAccess,
  validateRequest(copilotValidators.validateTest, 'body'),
  CopilotController.test
);

// POST /api/copilot/clear-cache - Limpiar cache
router.post('/clear-cache',
  authMiddleware,
  requireWriteAccess,
  CopilotController.clearCache
);

// Nuevos endpoints para frontend
router.post('/generate-response', authMiddleware, requireWriteAccess, validateRequest(copilotValidators.validateGenerateResponse, 'body'), CopilotController.generateResponse);
router.post('/analyze-conversation', authMiddleware, requireReadAccess, validateRequest(copilotValidators.validateAnalyzeConversation, 'body'), CopilotController.analyzeConversation);
router.post('/optimize-response', authMiddleware, requireWriteAccess, validateRequest(copilotValidators.validateOptimizeResponse, 'body'), CopilotController.optimizeResponse);
router.post('/strategy-suggestions', authMiddleware, requireReadAccess, validateRequest(copilotValidators.validateStrategySuggestions, 'body'), CopilotController.strategySuggestions);
router.post('/quick-response', authMiddleware, requireWriteAccess, validateRequest(copilotValidators.validateQuickResponse, 'body'), CopilotController.quickResponse);
router.post('/improve-experience', authMiddleware, requireReadAccess, validateRequest(copilotValidators.validateImproveExperience, 'body'), CopilotController.improveExperience);

module.exports = {
  router,
  copilotValidators
};
