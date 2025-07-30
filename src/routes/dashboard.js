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
 * @route GET /api/dashboard/conversations/stats
 * @desc Estadísticas de conversaciones
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/conversations/stats',
  authMiddleware,
  requireReadAccess,
  DashboardController.getConversationStats,
);

/**
 * @route GET /api/dashboard/agents/performance
 * @desc Rendimiento de agentes
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/agents/performance',
  authMiddleware,
  requireReadAccess,
  DashboardController.getAgentPerformance,
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
