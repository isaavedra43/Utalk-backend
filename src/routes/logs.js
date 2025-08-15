/**
 * 📊 LOG DASHBOARD ROUTES
 * 
 * Rutas para el dashboard interno de logs
 * Permite visualización, filtrado y exportación de logs
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const express = require('express');
const router = express.Router();
const LogDashboardController = require('../controllers/LogDashboardController');
const { authMiddleware } = require('../middleware/auth');

/**
 * 🖥️ GET DASHBOARD HTML
 * @route GET /logs
 * @desc Dashboard visual de logs
 * @access Private (Admin)
 */
router.get('/', 
  authMiddleware,
  LogDashboardController.getDashboardHTML
);

/**
 * 📊 GET DASHBOARD DATA
 * @route GET /api/logs/dashboard
 * @desc Datos del dashboard (estadísticas)
 * @access Private (Admin)
 */
router.get('/dashboard',
  authMiddleware,
  LogDashboardController.getDashboard
);

/**
 * 📋 GET LOGS WITH FILTERS
 * @route GET /api/logs
 * @desc Obtener logs con filtros
 * @access Private (Admin)
 */
router.get('/logs',
  authMiddleware,
  LogDashboardController.getLogs
);

/**
 * 🔍 SEARCH LOGS
 * @route GET /api/logs/search
 * @desc Buscar en logs
 * @access Private (Admin)
 */
router.get('/search',
  authMiddleware,
  LogDashboardController.searchLogs
);

/**
 * 📤 EXPORT LOGS
 * @route GET /api/logs/export
 * @desc Exportar logs en JSON o CSV
 * @access Private (Admin)
 */
router.get('/export',
  authMiddleware,
  LogDashboardController.exportLogs
);

/**
 * 🗑️ CLEAR LOGS
 * @route POST /api/logs/clear
 * @desc Limpiar todos los logs
 * @access Private (Admin)
 */
router.post('/clear',
  authMiddleware,
  LogDashboardController.clearLogs
);

/**
 * 📈 GET RATE LIMIT METRICS
 * @route GET /api/logs/rate-limit-metrics
 * @desc Métricas específicas de rate limit
 * @access Private (Admin)
 */
router.get('/rate-limit-metrics',
  authMiddleware,
  LogDashboardController.getRateLimitMetrics
);

module.exports = router; 