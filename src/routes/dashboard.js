const express = require('express');
const { requireReadAccess } = require('../middleware/auth');
const DashboardController = require('../controllers/DashboardController');

const router = express.Router();

/**
 * @route GET /api/dashboard/metrics
 * @desc Obtener métricas del dashboard
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/metrics',
  requireReadAccess, // CORREGIDO: Agregado requireReadAccess
  DashboardController.getMetrics,
);

/**
 * @route GET /api/dashboard/messages/stats
 * @desc Estadísticas de mensajes
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/messages/stats',
  requireReadAccess, // CORREGIDO: Agregado requireReadAccess
  DashboardController.getMessageStats,
);

/**
 * @route GET /api/dashboard/contacts/stats
 * @desc Estadísticas de contactos
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/contacts/stats',
  requireReadAccess, // CORREGIDO: Agregado requireReadAccess
  DashboardController.getContactStats,
);

/**
 * @route GET /api/dashboard/campaigns/stats
 * @desc Estadísticas de campañas
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/campaigns/stats',
  requireReadAccess, // CORREGIDO: Agregado requireReadAccess
  DashboardController.getCampaignStats,
);

/**
 * @route GET /api/dashboard/activity
 * @desc Actividad reciente
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/activity',
  requireReadAccess, // CORREGIDO: Agregado requireReadAccess
  DashboardController.getRecentActivity,
);

/**
 * @route GET /api/dashboard/export
 * @desc Exportar reporte del dashboard
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/export',
  requireReadAccess, // CORREGIDO: Agregado requireReadAccess
  DashboardController.exportReport,
);

/**
 * @route GET /api/dashboard/performance
 * @desc Métricas de performance
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/performance',
  requireReadAccess, // CORREGIDO: Agregado requireReadAccess
  DashboardController.getPerformanceMetrics,
);

// EXPORT PATTERN: Single router export (STANDARD for all routes)
// USAGE: const dashboardRoutes = require('./routes/dashboard');
module.exports = router;
