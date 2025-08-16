/**
 * 📊 RUTAS DE ANALYTICS Y MÉTRICAS
 * 
 * Endpoints para obtener métricas y analytics de uso de archivos
 * y comportamiento de usuarios.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/AnalyticsController');
const { authMiddleware, requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const Joi = require('joi');

// Instanciar controlador
const analyticsController = new AnalyticsController();

// Validadores Joi para analytics
const analyticsValidators = {
  // Validar rango de tiempo
  validateTimeRange: validateRequest({
    query: Joi.object({
      timeRange: Joi.string().valid('1d', '7d', '30d', '90d', '1y').default('30d')
    })
  }),

  // Validar configuración de tracking
  validateTrackingConfig: validateRequest({
    body: Joi.object({
      enabled: Joi.boolean().optional(),
      trackViews: Joi.boolean().optional(),
      trackDownloads: Joi.boolean().optional(),
      trackShares: Joi.boolean().optional(),
      trackUploads: Joi.boolean().optional(),
      trackDeletes: Joi.boolean().optional()
    }).min(1) // Al menos un campo debe estar presente
  })
};

/**
 * 📊 RUTAS DE ANALYTICS
 */

// GET /api/analytics/file/:fileId/usage
// Obtener estadísticas de uso de un archivo específico
router.get('/file/:fileId/usage',
  authMiddleware,
  requireReadAccess,
  analyticsValidators.validateTimeRange,
  analyticsController.getFileUsageStats.bind(analyticsController)
);

// GET /api/analytics/global/usage
// Obtener métricas globales de uso de archivos
router.get('/global/usage',
  authMiddleware,
  requireReadAccess,
  analyticsValidators.validateTimeRange,
  analyticsController.getGlobalUsageMetrics.bind(analyticsController)
);

// GET /api/analytics/conversation/:conversationId/usage
// Obtener métricas de uso de archivos por conversación
router.get('/conversation/:conversationId/usage',
  authMiddleware,
  requireReadAccess,
  analyticsValidators.validateTimeRange,
  analyticsController.getConversationUsageMetrics.bind(analyticsController)
);

// GET /api/analytics/user/:userId/usage
// Obtener métricas de uso de archivos por usuario
router.get('/user/:userId/usage',
  authMiddleware,
  requireReadAccess,
  analyticsValidators.validateTimeRange,
  analyticsController.getUserUsageMetrics.bind(analyticsController)
);

// POST /api/analytics/tracking/configure
// Configurar el tracking de uso de archivos
router.post('/tracking/configure',
  authMiddleware,
  requireWriteAccess,
  analyticsValidators.validateTrackingConfig,
  analyticsController.configureTracking.bind(analyticsController)
);

// GET /api/analytics/tracking/status
// Obtener el estado actual del tracking
router.get('/tracking/status',
  authMiddleware,
  requireReadAccess,
  analyticsController.getTrackingStatus.bind(analyticsController)
);

module.exports = router; 