/**
 * 🔧 RUTAS DE OPERACIONES DE IA
 * 
 * Endpoints internos para monitoreo, administración de límites
 * y control de circuit breakers.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const express = require('express');
const Joi = require('joi');
const router = express.Router();

// Middlewares
const { authMiddleware } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validationMiddleware');

// Controlador
const AIOpsController = require('../controllers/AIOpsController');

/**
 * Validaciones Joi para endpoints de operaciones
 */
const aiOpsValidators = {
  // Validación para workspaceId en params
  validateWorkspaceId: Joi.object({
    workspaceId: Joi.string().required().min(1).max(100)
      .description('ID del workspace')
  }),

  // Validación para actualizar límites
  validateUpdateLimits: Joi.object({
    daily: Joi.object({
      max_tokens_in: Joi.number().min(1000).max(10000000).optional()
        .description('Máximo tokens de entrada por día'),
      max_tokens_out: Joi.number().min(100).max(3000000).optional()
        .description('Máximo tokens de salida por día'),
      max_cost_usd: Joi.number().min(0.1).max(1000).optional()
        .description('Máximo costo USD por día')
    }).optional(),
    rate: Joi.object({
      per_minute: Joi.number().min(1).max(100).optional()
        .description('Requests por minuto'),
      burst: Joi.number().min(1).max(200).optional()
        .description('Requests en burst')
    }).optional(),
    latency: Joi.object({
      p95_ms_threshold: Joi.number().min(100).max(10000).optional()
        .description('Umbral P95 en milisegundos'),
      p99_ms_threshold: Joi.number().min(200).max(15000).optional()
        .description('Umbral P99 en milisegundos')
    }).optional(),
    errors: Joi.object({
      error_rate_threshold_pct: Joi.number().min(1).max(50).optional()
        .description('Umbral de error rate en porcentaje'),
      window_min: Joi.number().min(1).max(60).optional()
        .description('Ventana de tiempo en minutos')
    }).optional(),
    breaker: Joi.object({
      enabled: Joi.boolean().optional()
        .description('Habilitar circuit breaker'),
      cooldown_min: Joi.number().min(1).max(60).optional()
        .description('Tiempo de cooldown en minutos')
    }).optional(),
    alerts: Joi.object({
      enabled: Joi.boolean().optional()
        .description('Habilitar alertas'),
      webhook_url: Joi.string().uri().optional()
        .description('URL de webhook para alertas'),
      email: Joi.string().email().optional()
        .description('Email para alertas')
    }).optional()
  }),

  // Validación para forzar circuit breaker
  validateForceBreaker: Joi.object({
    action: Joi.string().valid('open', 'close').required()
      .description('Acción a realizar'),
    reason: Joi.string().max(200).optional()
      .description('Razón del cambio')
  }),

  // Validación para query parameters de contadores
  validateCountersQuery: Joi.object({
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional()
      .description('Fecha en formato YYYY-MM-DD'),
    workspaceId: Joi.string().min(1).max(100).optional()
      .description('ID del workspace'),
    model: Joi.string().min(1).max(50).optional()
      .description('Modelo de IA')
  })
};

/**
 * Rutas de operaciones de IA
 */

// GET /api/ai/ops/limits/:workspaceId
router.get('/ops/limits/:workspaceId',
  authMiddleware,
  validateRequest(aiOpsValidators.validateWorkspaceId, 'params'),
  AIOpsController.getLimits
);

// PUT /api/ai/ops/limits/:workspaceId
router.put('/ops/limits/:workspaceId',
  authMiddleware,
  validateRequest(aiOpsValidators.validateWorkspaceId, 'params'),
  validateRequest(aiOpsValidators.validateUpdateLimits, 'body'),
  AIOpsController.updateLimits
);

// GET /api/ai/ops/counters
router.get('/ops/counters',
  authMiddleware,
  validateRequest(aiOpsValidators.validateCountersQuery, 'query'),
  AIOpsController.getCounters
);

// POST /api/ai/ops/breaker/:workspaceId
router.post('/ops/breaker/:workspaceId',
  authMiddleware,
  validateRequest(aiOpsValidators.validateWorkspaceId, 'params'),
  validateRequest(aiOpsValidators.validateForceBreaker, 'body'),
  AIOpsController.forceBreakerState
);

// GET /api/ai/ops/health
router.get('/ops/health',
  authMiddleware,
  AIOpsController.getHealth
);

// GET /api/ai/ops/breakers
router.get('/ops/breakers',
  authMiddleware,
  AIOpsController.getAllBreakers
);

module.exports = {
  router,
  aiOpsValidators
}; 