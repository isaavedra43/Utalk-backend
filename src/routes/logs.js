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
 * 🧪 TEST ENDPOINT
 * @route GET /api/logs/test
 * @desc Endpoint de prueba para verificar que funciona
 * @access Public
 */
router.get('/test', (req, res) => {
  console.log('🧪 LOGS_TEST: Endpoint de prueba accedido');
  res.json({
    success: true,
    message: 'Dashboard de logs funcionando correctamente',
    timestamp: new Date().toISOString(),
    endpoints: {
      dashboard: '/logs',
      api: '/api/logs',
      stats: '/api/logs/dashboard',
      export: '/api/logs/export'
    }
  });
});

/**
 * 🖥️ GET DASHBOARD HTML
 * @route GET /logs
 * @desc Dashboard visual de logs
 * @access Public (sin autenticación para debugging)
 */
router.get('/', 
  LogDashboardController.getDashboardHTML
);

/**
 * 📊 GET DASHBOARD DATA
 * @route GET /api/logs/dashboard
 * @desc Datos del dashboard (estadísticas)
 * @access Public (sin autenticación para debugging)
 */
router.get('/dashboard',
  LogDashboardController.getDashboard
);

/**
 * 📋 GET LOGS WITH FILTERS
 * @route GET /api/logs
 * @desc Obtener logs con filtros
 * @access Public (sin autenticación para debugging)
 */
router.get('/logs',
  LogDashboardController.getLogs
);

/**
 * 🔍 SEARCH LOGS
 * @route GET /api/logs/search
 * @desc Buscar en logs
 * @access Public (sin autenticación para debugging)
 */
router.get('/search',
  LogDashboardController.searchLogs
);

/**
 * 📤 EXPORT LOGS
 * @route GET /api/logs/export
 * @desc Exportar logs en JSON o CSV
 * @access Public (sin autenticación para debugging)
 */
router.get('/export',
  LogDashboardController.exportLogs
);

/**
 * 🗑️ CLEAR LOGS
 * @route POST /api/logs/clear
 * @desc Limpiar todos los logs
 * @access Public (sin autenticación para debugging)
 */
router.post('/clear',
  LogDashboardController.clearLogs
);

/**
 * 📈 GET RATE LIMIT METRICS
 * @route GET /api/logs/rate-limit-metrics
 * @desc Métricas específicas de rate limit
 * @access Public (sin autenticación para debugging)
 */
router.get('/rate-limit-metrics',
  LogDashboardController.getRateLimitMetrics
);

module.exports = router; 