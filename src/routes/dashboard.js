const express = require('express');
const { authMiddleware, requireReadAccess } = require('../middleware/auth');
const DashboardController = require('../controllers/DashboardController');

const router = express.Router();

/**
 * @route GET /api/dashboard/metrics
 * @desc Obtener métricas del dashboard
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/metrics',
  authMiddleware,
  requireReadAccess,
  DashboardController.getMetrics,
);

/**
 * @route GET /api/dashboard/messages/stats
 * @desc Estadísticas de mensajes
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/messages/stats',
  authMiddleware,
  requireReadAccess,
  DashboardController.getMessageStats,
);

/**
 * @route GET /api/dashboard/contacts/stats
 * @desc Estadísticas de contactos
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/contacts/stats',
  authMiddleware,
  requireReadAccess,
  DashboardController.getContactStats,
);

/**
 * @route GET /api/dashboard/campaigns/stats
 * @desc Estadísticas de campañas
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/campaigns/stats',
  authMiddleware,
  requireReadAccess,
  DashboardController.getCampaignStats,
);

/**
 * @route GET /api/dashboard/recent-activity
 * @desc Actividad reciente
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/recent-activity',
  authMiddleware,
  requireReadAccess,
  DashboardController.getRecentActivity,
);

/**
 * @route GET /api/dashboard/export-report
 * @desc Exportar reporte del dashboard
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/export-report',
  authMiddleware,
  requireReadAccess,
  DashboardController.exportReport,
);

/**
 * @route GET /api/dashboard/performance
 * @desc Métricas de rendimiento
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/performance',
  authMiddleware,
  requireReadAccess,
  DashboardController.getPerformanceMetrics,
);

module.exports = router;
