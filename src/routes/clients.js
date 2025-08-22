const express = require('express');
const router = express.Router();
const ClientController = require('../controllers/ClientController');
const { authMiddleware } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const Joi = require('joi');

/**
 * 🎯 Rutas del módulo de clientes
 * 
 * Los clientes son mapeados desde la colección 'contacts' existente.
 * No se crea una nueva colección, sino que se reutilizan los datos de contactos.
 */

// 📊 VALIDADORES
const clientValidators = {
  // Validador para filtros de lista
  validateListQuery: validateRequest({
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      search: Joi.string().max(100).optional(),
      stages: Joi.alternatives().try(
        Joi.string(),
        Joi.array().items(Joi.string().valid('lead', 'prospect', 'demo', 'propuesta', 'negociacion', 'ganado', 'perdido'))
      ).optional(),
      agents: Joi.alternatives().try(
        Joi.string(),
        Joi.array().items(Joi.string())
      ).optional(),
      sources: Joi.alternatives().try(
        Joi.string(),
        Joi.array().items(Joi.string().valid('website', 'social', 'referral', 'email', 'cold_call', 'event', 'advertising'))
      ).optional(),
      segments: Joi.alternatives().try(
        Joi.string(),
        Joi.array().items(Joi.string().valid('startup', 'sme', 'enterprise', 'freelancer', 'agency'))
      ).optional(),
      status: Joi.string().valid('all', 'active', 'inactive').default('all'),
      sortBy: Joi.string().valid('name', 'createdAt', 'updatedAt', 'lastContact', 'score', 'expectedValue', 'probability').default('createdAt'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
      aiScoreMin: Joi.number().min(0).max(100).optional(),
      aiScoreMax: Joi.number().min(0).max(100).optional(),
      valueMin: Joi.number().min(0).optional(),
      valueMax: Joi.number().optional(),
      probabilityMin: Joi.number().min(0).max(100).optional(),
      probabilityMax: Joi.number().min(0).max(100).optional(),
      tags: Joi.alternatives().try(
        Joi.string(),
        Joi.array().items(Joi.string())
      ).optional(),
      createdAfter: Joi.date().iso().optional(),
      createdBefore: Joi.date().iso().optional()
    }).options({ allowUnknown: false })
  }),

  // Validador para ID de cliente
  validateClientId: validateRequest({
    params: Joi.object({
      id: Joi.string().required().messages({
        'any.required': 'ID del cliente es requerido',
        'string.empty': 'ID del cliente no puede estar vacío'
      })
    })
  }),

  // Validador para crear cliente
  validateCreate: validateRequest({
    body: Joi.object({
      name: Joi.string().min(1).max(100).required().messages({
        'any.required': 'Nombre del cliente es requerido',
        'string.empty': 'Nombre del cliente no puede estar vacío',
        'string.min': 'Nombre debe tener al menos 1 carácter',
        'string.max': 'Nombre no puede exceder 100 caracteres'
      }),
      phone: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required().messages({
        'any.required': 'Teléfono del cliente es requerido',
        'string.pattern.base': 'Teléfono debe estar en formato internacional (+1234567890)'
      }),
      email: Joi.string().email().optional().messages({
        'string.email': 'Email debe tener un formato válido'
      }),
      company: Joi.string().max(100).optional(),
      stage: Joi.string().valid('lead', 'prospect', 'demo', 'propuesta', 'negociacion', 'ganado', 'perdido').optional(),
      expectedValue: Joi.number().min(0).optional(),
      source: Joi.string().valid('website', 'social', 'referral', 'email', 'cold_call', 'event', 'advertising', 'manual').optional(),
      segment: Joi.string().valid('startup', 'sme', 'enterprise', 'freelancer', 'agency').optional(),
      tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
      metadata: Joi.object().optional()
    }).options({ allowUnknown: false })
  }),

  // Validador para actualizar cliente
  validateUpdate: validateRequest({
    body: Joi.object({
      name: Joi.string().min(1).max(100).optional(),
      email: Joi.string().email().optional(),
      company: Joi.string().max(100).optional(),
      stage: Joi.string().valid('lead', 'prospect', 'demo', 'propuesta', 'negociacion', 'ganado', 'perdido').optional(),
      expectedValue: Joi.number().min(0).optional(),
      source: Joi.string().valid('website', 'social', 'referral', 'email', 'cold_call', 'event', 'advertising', 'manual').optional(),
      segment: Joi.string().valid('startup', 'sme', 'enterprise', 'freelancer', 'agency').optional(),
      tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
      metadata: Joi.object().optional()
    }).options({ allowUnknown: false })
  })
};

// 🛡️ MIDDLEWARE DE AUTENTICACIÓN
// Todas las rutas requieren autenticación
router.use(authMiddleware);

// 📋 RUTAS PRINCIPALES

/**
 * 📊 Obtener lista de clientes con filtros y paginación
 * GET /api/clients
 */
router.get('/', 
  clientValidators.validateListQuery,
  ClientController.list
);

/**
 * 🔍 Health check para Firebase
 * GET /api/clients/health
 */
router.get('/health', 
  ClientController.healthCheck
);

/**
 * 📈 Obtener métricas de clientes
 * GET /api/clients/metrics
 */
router.get('/metrics', 
  ClientController.getMetrics
);

/**
 * 🔍 Obtener cliente específico por ID
 * GET /api/clients/:id
 */
router.get('/:id',
  clientValidators.validateClientId,
  ClientController.getById
);

// 📊 RUTAS ADICIONALES DE MÉTRICAS

/**
 * 📊 Obtener métricas por etapas
 * GET /api/clients/metrics/stages
 */
router.get('/metrics/stages', 
  async (req, res) => {
    // Por ahora redirigir a métricas generales
    // En el futuro se puede implementar endpoint específico
    req.url = '/metrics';
    ClientController.getMetrics(req, res);
  }
);

/**
 * 🧑‍💼 Obtener métricas por agentes
 * GET /api/clients/metrics/agents
 */
router.get('/metrics/agents', 
  async (req, res) => {
    // Por ahora redirigir a métricas generales
    // En el futuro se puede implementar endpoint específico
    req.url = '/metrics';
    ClientController.getMetrics(req, res);
  }
);

/**
 * 📤 Exportar clientes (FUTURO)
 * GET /api/clients/export
 */
router.get('/export',
  async (req, res) => {
    // TODO: Implementar exportación
    const { ResponseHandler } = require('../utils/responseHandler');
    return ResponseHandler.error(res, {
      type: 'NOT_IMPLEMENTED',
      message: 'Funcionalidad de exportación no implementada aún',
      statusCode: 501
    });
  }
);

// 🔄 RUTAS CRUD IMPLEMENTADAS

/**
 * ➕ Crear cliente
 * POST /api/clients
 */
router.post('/',
  clientValidators.validateCreate,
  ClientController.create
);

/**
 * ✏️ Actualizar cliente
 * PUT /api/clients/:id
 */
router.put('/:id',
  clientValidators.validateClientId,
  clientValidators.validateUpdate,
  ClientController.update
);

/**
 * 🗑️ Eliminar cliente
 * DELETE /api/clients/:id
 */
router.delete('/:id',
  clientValidators.validateClientId,
  ClientController.delete
);

// 📄 RUTAS DE ACTIVIDADES Y DEALS (FUTURAS)

/**
 * 📝 Obtener actividades del cliente (FUTURO)
 * GET /api/clients/:id/activities
 */
router.get('/:id/activities',
  clientValidators.validateClientId,
  async (req, res) => {
    // TODO: Obtener actividades desde conversaciones
    const { ResponseHandler } = require('../utils/responseHandler');
    return ResponseHandler.success(res, {
      activities: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
    }, 'Actividades obtenidas exitosamente');
  }
);

/**
 * 💼 Obtener deals del cliente (FUTURO)
 * GET /api/clients/:id/deals
 */
router.get('/:id/deals',
  clientValidators.validateClientId,
  async (req, res) => {
    // TODO: Obtener deals desde metadata o nueva colección
    const { ResponseHandler } = require('../utils/responseHandler');
    return ResponseHandler.success(res, {
      deals: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
    }, 'Deals obtenidos exitosamente');
  }
);

module.exports = router;
