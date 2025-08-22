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
    const ResponseHandler = require('../utils/responseHandler');
    return ResponseHandler.error(res, {
      type: 'NOT_IMPLEMENTED',
      message: 'Funcionalidad de exportación no implementada aún',
      statusCode: 501
    });
  }
);

// 🔄 RUTAS CRUD (FUTURAS)

/**
 * ➕ Crear cliente (FUTURO)
 * POST /api/clients
 */
router.post('/',
  async (req, res) => {
    // TODO: Implementar creación de clientes
    const ResponseHandler = require('../utils/responseHandler');
    return ResponseHandler.error(res, {
      type: 'NOT_IMPLEMENTED', 
      message: 'Creación de clientes no implementada aún - usar formulario de conversación',
      statusCode: 501
    });
  }
);

/**
 * ✏️ Actualizar cliente (FUTURO)
 * PUT /api/clients/:id
 */
router.put('/:id',
  clientValidators.validateClientId,
  async (req, res) => {
    // TODO: Implementar actualización de clientes
    const ResponseHandler = require('../utils/responseHandler');
    return ResponseHandler.error(res, {
      type: 'NOT_IMPLEMENTED',
      message: 'Actualización de clientes no implementada aún',
      statusCode: 501
    });
  }
);

/**
 * 🗑️ Eliminar cliente (FUTURO)
 * DELETE /api/clients/:id
 */
router.delete('/:id',
  clientValidators.validateClientId,
  async (req, res) => {
    // TODO: Implementar eliminación de clientes
    const ResponseHandler = require('../utils/responseHandler');
    return ResponseHandler.error(res, {
      type: 'NOT_IMPLEMENTED',
      message: 'Eliminación de clientes no implementada aún',
      statusCode: 501
    });
  }
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
    const ResponseHandler = require('../utils/responseHandler');
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
    const ResponseHandler = require('../utils/responseHandler');
    return ResponseHandler.success(res, {
      deals: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
    }, 'Deals obtenidos exitosamente');
  }
);

module.exports = router;
