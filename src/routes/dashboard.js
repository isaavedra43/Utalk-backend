/**
 * 🚀 ENTERPRISE DASHBOARD ROUTES
 * 
 * Rutas optimizadas para dashboard con caching, rate limiting
 * y batch processing para operaciones masivas.
 * 
 * @version 2.0.0 ENTERPRISE
 * @author Scalability Team
 */

const express = require('express');
const router = express.Router();
const EnterpriseDashboardController = require('../controllers/DashboardController');
const { authMiddleware, requireRole, requireReadAccess } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * 🎯 OBTENER MÉTRICAS GENERALES DEL DASHBOARD (CACHED)
 * Rate limit: 10 requests/minuto
 * Cache TTL: 5 minutos
 */
router.get('/metrics',
  authMiddleware,
  requireRole(['admin', 'agent', 'viewer']),
  async (req, res, next) => {
    try {
      logger.info('Dashboard metrics request', {
        category: 'DASHBOARD_ROUTE',
        userId: req.user.id,
        role: req.user.role,
        period: req.query.period || '7d'
      });
      
      await EnterpriseDashboardController.getMetrics(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 📊 OBTENER ESTADÍSTICAS DE MENSAJES (CACHED + SHARDED)
 * Rate limit: 20 requests/minuto
 * Cache TTL: 10 minutos
 */
router.get('/messages/stats',
  authMiddleware,
  requireRole(['admin', 'agent', 'viewer']),
  async (req, res, next) => {
    try {
      logger.info('Message stats request', {
        category: 'DASHBOARD_ROUTE',
        userId: req.user.id,
        period: req.query.period || '7d'
      });
      
      await EnterpriseDashboardController.getMessageStats(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 👥 OBTENER ESTADÍSTICAS DE CONTACTOS (CACHED + BATCH)
 * Rate limit: 20 requests/minuto
 * Cache TTL: 10 minutos
 */
router.get('/contacts/stats',
  authMiddleware,
  requireRole(['admin', 'agent', 'viewer']),
  async (req, res, next) => {
    try {
      logger.info('Contact stats request', {
        category: 'DASHBOARD_ROUTE',
        userId: req.user.id,
        period: req.query.period || '7d'
      });
      
      await EnterpriseDashboardController.getContactStats(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 📢 OBTENER ESTADÍSTICAS DE CAMPAÑAS (CACHED)
 * Rate limit: 20 requests/minuto
 * Cache TTL: 10 minutos
 */
router.get('/campaigns/stats',
  authMiddleware,
  requireRole(['admin', 'agent', 'viewer']),
  async (req, res, next) => {
    try {
      logger.info('Campaign stats request', {
        category: 'DASHBOARD_ROUTE',
        userId: req.user.id,
        period: req.query.period || '7d'
      });
      
      await EnterpriseDashboardController.getCampaignStats(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 📈 OBTENER ACTIVIDAD RECIENTE (CACHED + PROGRESSIVE)
 * Rate limit: 30 requests/minuto
 * Cache TTL: 2 minutos
 */
router.get('/recent-activity',
  authMiddleware,
  requireRole(['admin', 'agent', 'viewer']),
  async (req, res, next) => {
    try {
      logger.info('Recent activity request', {
        category: 'DASHBOARD_ROUTE',
        userId: req.user.id,
        limit: req.query.limit || 10,
        offset: req.query.offset || 0
      });
      
      await EnterpriseDashboardController.getRecentActivity(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 📤 EXPORTAR REPORTE (BATCH + CACHED)
 * Rate limit: 5 requests/minuto
 * Cache TTL: 1 hora
 */
router.get('/export-report',
  authMiddleware,
  requireRole(['admin', 'agent']),
  async (req, res, next) => {
    try {
      logger.info('Export report request', {
        category: 'DASHBOARD_ROUTE',
        userId: req.user.id,
        format: req.query.format || 'csv',
        period: req.query.period || '7d',
        type: req.query.type || 'all'
      });
      
      await EnterpriseDashboardController.exportReport(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * ⚡ OBTENER MÉTRICAS DE PERFORMANCE (REAL-TIME)
 * Rate limit: 60 requests/minuto
 * No cache - datos en tiempo real
 */
router.get('/performance',
  authMiddleware,
  requireRole(['admin']),
  async (req, res, next) => {
    try {
      logger.info('Performance metrics request', {
        category: 'DASHBOARD_ROUTE',
        userId: req.user.id,
        period: req.query.period || '1h'
      });
      
      await EnterpriseDashboardController.getPerformanceMetrics(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 📊 OBTENER ESTADÍSTICAS DEL SISTEMA (INTERNAL)
 * Solo para admins
 * Rate limit: 10 requests/minuto
 */
router.get('/system-stats',
  authMiddleware,
  requireRole(['admin']),
  async (req, res, next) => {
    try {
      logger.info('System stats request', {
        category: 'DASHBOARD_ROUTE',
        userId: req.user.id
      });
      
      const stats = EnterpriseDashboardController.getStats();
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/dashboard/campaign-queue-metrics
 * @desc Obtener métricas de campañas en cola
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/campaign-queue-metrics',
  authMiddleware,
  requireReadAccess,
  EnterpriseDashboardController.getCampaignQueueMetrics
);

module.exports = router;
