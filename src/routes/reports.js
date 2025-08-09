/**
 * 📊 RUTAS DE REPORTES IA
 * 
 * Endpoints para reportes de IA con ingesta de datos agregados
 * y generación opcional de resúmenes con IA.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const express = require('express');
const Joi = require('joi');
const router = express.Router();

// Middlewares
const { authMiddleware, requireAdminOrQA } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validationMiddleware');
const { qaRateLimiter } = require('../middleware/aiRateLimit');

// Controlador
const ReportController = require('../controllers/ReportController');

/**
 * Validaciones Joi para endpoints de reportes
 */
const reportValidators = {
  // Validación para ingesta de reporte
  validateIngestReport: Joi.object({
    workspaceId: Joi.string().required().min(1).max(100)
      .description('ID del workspace'),
    periodo: Joi.object({
      from: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
        .description('Fecha de inicio (YYYY-MM-DD)'),
      to: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
        .description('Fecha de fin (YYYY-MM-DD)')
    }).required().description('Período del reporte'),
    datos: Joi.object({
      mensajes_totales: Joi.number().integer().min(0).optional()
        .description('Total de mensajes'),
      tiempo_medio_respuesta_s: Joi.number().min(0).optional()
        .description('Tiempo medio de respuesta en segundos'),
      fcr: Joi.number().min(0).max(1).optional()
        .description('First Contact Resolution (0-1)'),
      intenciones: Joi.object().pattern(Joi.string(), Joi.number().min(0).max(1)).optional()
        .description('Proporciones de intenciones'),
      sentimiento: Joi.object({
        positivo: Joi.number().min(0).max(1).required(),
        neutral: Joi.number().min(0).max(1).required(),
        negativo: Joi.number().min(0).max(1).required()
      }).optional().description('Distribución de sentimientos')
    }).required().description('Datos agregados del reporte'),
    generate_summary: Joi.boolean().default(false)
      .description('Generar resumen con IA'),
    tipo: Joi.string().valid('daily', 'weekly', 'monthly', 'custom').default('weekly')
      .description('Tipo de reporte'),
    metadata: Joi.object().optional()
      .description('Metadatos adicionales')
  }),

  // Validación para workspaceId en params
  validateWorkspaceId: Joi.object({
    workspaceId: Joi.string().required().min(1).max(100)
      .description('ID del workspace')
  }),

  // Validación para reportId en params
  validateReportId: Joi.object({
    workspaceId: Joi.string().required().min(1).max(100)
      .description('ID del workspace'),
    reportId: Joi.string().required().min(1).max(100)
      .description('ID del reporte')
  }),

  // Validación para búsqueda de reportes
  validateSearchReports: Joi.object({
    workspaceId: Joi.string().required().min(1).max(100)
      .description('ID del workspace'),
    tipo: Joi.string().valid('daily', 'weekly', 'monthly', 'custom').optional()
      .description('Tipo de reporte'),
    fromDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional()
      .description('Fecha de inicio (YYYY-MM-DD)'),
    toDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional()
      .description('Fecha de fin (YYYY-MM-DD)'),
    hasAlerts: Joi.boolean().optional()
      .description('Filtrar por reportes con alertas'),
    limit: Joi.number().integer().min(1).max(100).default(50)
      .description('Límite de resultados'),
    offset: Joi.number().integer().min(0).default(0)
      .description('Offset para paginación')
  }),

  // Validación para verificar existencia
  validateCheckExists: Joi.object({
    workspaceId: Joi.string().required().min(1).max(100)
      .description('ID del workspace'),
    periodo: Joi.object({
      from: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
        .description('Fecha de inicio (YYYY-MM-DD)'),
      to: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
        .description('Fecha de fin (YYYY-MM-DD)')
    }).required().description('Período del reporte'),
    tipo: Joi.string().valid('daily', 'weekly', 'monthly', 'custom').default('weekly')
      .description('Tipo de reporte')
  }),

  // Validación para query params de reportes
  validateReportsQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(20)
      .description('Límite de reportes a obtener'),
    offset: Joi.number().integer().min(0).default(0)
      .description('Offset para paginación'),
    tipo: Joi.string().valid('daily', 'weekly', 'monthly', 'custom').optional()
      .description('Filtrar por tipo de reporte'),
    fromDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional()
      .description('Fecha de inicio (YYYY-MM-DD)'),
    toDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional()
      .description('Fecha de fin (YYYY-MM-DD)')
  }),

  // Validación para query params de estadísticas
  validateStatsQuery: Joi.object({
    days: Joi.number().integer().min(1).max(365).default(30)
      .description('Número de días para las estadísticas')
  })
};

/**
 * Rutas de reportes IA
 */

// POST /api/ai/reports/ingest
router.post('/ingest',
  authMiddleware,
  requireAdminOrQA,
  qaRateLimiter,
  validateRequest(reportValidators.validateIngestReport, 'body'),
  ReportController.ingestReport
);

// GET /api/ai/reports/:workspaceId
router.get('/:workspaceId',
  authMiddleware,
  requireAdminOrQA,
  validateRequest(reportValidators.validateWorkspaceId, 'params'),
  validateRequest(reportValidators.validateReportsQuery, 'query'),
  ReportController.getReports
);

// GET /api/ai/reports/:workspaceId/:reportId
router.get('/:workspaceId/:reportId',
  authMiddleware,
  requireAdminOrQA,
  validateRequest(reportValidators.validateReportId, 'params'),
  ReportController.getReport
);

// POST /api/ai/reports/search
router.post('/search',
  authMiddleware,
  requireAdminOrQA,
  qaRateLimiter,
  validateRequest(reportValidators.validateSearchReports, 'body'),
  ReportController.searchReports
);

// GET /api/ai/reports/:workspaceId/stats
router.get('/:workspaceId/stats',
  authMiddleware,
  requireAdminOrQA,
  validateRequest(reportValidators.validateWorkspaceId, 'params'),
  validateRequest(reportValidators.validateStatsQuery, 'query'),
  ReportController.getReportStats
);

// DELETE /api/ai/reports/:reportId
router.delete('/:reportId',
  authMiddleware,
  requireAdminOrQA,
  validateRequest(Joi.object({
    reportId: Joi.string().required().min(1).max(100)
      .description('ID del reporte')
  }), 'params'),
  ReportController.deleteReport
);

// POST /api/ai/reports/check-exists
router.post('/check-exists',
  authMiddleware,
  requireAdminOrQA,
  qaRateLimiter,
  validateRequest(reportValidators.validateCheckExists, 'body'),
  ReportController.checkReportExists
);

module.exports = {
  router,
  reportValidators
}; 