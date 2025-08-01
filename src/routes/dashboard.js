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
const { authMiddleware } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorization');
const logger = require('../utils/logger');

/**
 * 🎯 OBTENER MÉTRICAS GENERALES DEL DASHBOARD (CACHED)
 * Rate limit: 10 requests/minuto
 * Cache TTL: 5 minutos
 */
router.get('/metrics',
  authMiddleware,
  requireRole(['admin', 'agent', 'viewer']),
  asyncWrapper(async (req, res, next) => {
    logger.info('Dashboard metrics request', {
      category: 'DASHBOARD_ROUTE',
      userId: req.user.id,
      role: req.user.role,
      period: req.query.period || '7d'
    });
    
    await EnterpriseDashboardController.getMetrics(req, res, next);
  })
);

/**
 * 📊 OBTENER ESTADÍSTICAS DE MENSAJES (CACHED + SHARDED)
 * Rate limit: 20 requests/minuto
 * Cache TTL: 10 minutos
 */
router.get('/messages/stats',
  authMiddleware,
  requireRole(['admin', 'agent', 'viewer']),
  asyncWrapper(async (req, res, next) => {
    logger.info('Message stats request', {
      category: 'DASHBOARD_ROUTE',
      userId: req.user.id,
      period: req.query.period || '7d'
    });
    
    await EnterpriseDashboardController.getMessageStats(req, res, next);
  })
);

/**
 * 👥 OBTENER ESTADÍSTICAS DE CONTACTOS (CACHED + BATCH)
 * Rate limit: 20 requests/minuto
 * Cache TTL: 10 minutos
 */
router.get('/contacts/stats',
  authMiddleware,
  requireRole(['admin', 'agent', 'viewer']),
  asyncWrapper(async (req, res, next) => {
    logger.info('Contact stats request', {
      category: 'DASHBOARD_ROUTE',
      userId: req.user.id,
      period: req.query.period || '7d'
    });
    
    await EnterpriseDashboardController.getContactStats(req, res, next);
  })
);

/**
 * 📢 OBTENER ESTADÍSTICAS DE CAMPAÑAS (CACHED)
 * Rate limit: 20 requests/minuto
 * Cache TTL: 10 minutos
 */
router.get('/campaigns/stats',
  authMiddleware,
  requireRole(['admin', 'agent', 'viewer']),
  asyncWrapper(async (req, res, next) => {
    logger.info('Campaign stats request', {
      category: 'DASHBOARD_ROUTE',
      userId: req.user.id,
      period: req.query.period || '7d'
    });
    
    await EnterpriseDashboardController.getCampaignStats(req, res, next);
  })
);

/**
 * 📈 OBTENER ACTIVIDAD RECIENTE (CACHED + PROGRESSIVE)
 * Rate limit: 30 requests/minuto
 * Cache TTL: 2 minutos
 */
router.get('/recent-activity',
  authMiddleware,
  requireRole(['admin', 'agent', 'viewer']),
  asyncWrapper(async (req, res, next) => {
    logger.info('Recent activity request', {
      category: 'DASHBOARD_ROUTE',
      userId: req.user.id,
      limit: req.query.limit || 10,
      offset: req.query.offset || 0
    });
    
    await EnterpriseDashboardController.getRecentActivity(req, res, next);
  })
);

/**
 * 📤 EXPORTAR REPORTE (BATCH + CACHED)
 * Rate limit: 5 requests/minuto
 * Cache TTL: 1 hora
 */
router.get('/export-report',
  authMiddleware,
  requireRole(['admin', 'agent']),
  asyncWrapper(async (req, res, next) => {
    logger.info('Export report request', {
      category: 'DASHBOARD_ROUTE',
      userId: req.user.id,
      format: req.query.format || 'csv',
      period: req.query.period || '7d',
      type: req.query.type || 'all'
    });
    
    await EnterpriseDashboardController.exportReport(req, res, next);
  })
);

/**
 * ⚡ OBTENER MÉTRICAS DE PERFORMANCE (REAL-TIME)
 * Rate limit: 60 requests/minuto
 * No cache - datos en tiempo real
 */
router.get('/performance',
  authMiddleware,
  requireRole(['admin']),
  asyncWrapper(async (req, res, next) => {
    logger.info('Performance metrics request', {
      category: 'DASHBOARD_ROUTE',
      userId: req.user.id,
      period: req.query.period || '1h'
    });
    
    await EnterpriseDashboardController.getPerformanceMetrics(req, res, next);
  })
);

/**
 * 📊 OBTENER ESTADÍSTICAS DEL SISTEMA (INTERNAL)
 * Solo para admins
 * Rate limit: 10 requests/minuto
 */
router.get('/system-stats',
  authMiddleware,
  requireRole(['admin']),
  asyncWrapper(async (req, res, next) => {
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
  })
);

module.exports = router;
