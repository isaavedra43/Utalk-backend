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
 * 🧪 GENERATE TEST LOGS
 * @route POST /api/logs/generate-test
 * @desc Generar logs de prueba para el dashboard
 * @access Public
 */
router.post('/generate-test', (req, res) => {
  try {
    console.log('🧪 GENERATE_TEST_LOGS: Generando logs de prueba...');
    
    const logger = require('../utils/logger');
    
    // Generar logs de diferentes niveles y categorías
    logger.info('Sistema iniciado correctamente', { category: 'SYSTEM', userId: 'system' });
    logger.info('Conexión a base de datos establecida', { category: 'DATABASE', userId: 'system' });
    logger.warn('Cache miss en consulta de usuarios', { category: 'CACHE', userId: 'system' });
    logger.info('Nueva conexión WebSocket establecida', { category: 'WEBSOCKET', userId: 'user_123' });
    logger.error('Error en endpoint de autenticación', { category: 'API', userId: 'user_456' });
    logger.info('Mensaje enviado exitosamente', { category: 'MESSAGE', userId: 'user_789' });
    logger.debug('Rate limit check completado', { category: 'RATE_LIMIT', userId: 'user_101' });
    
    // Generar logs adicionales con diferentes timestamps
    setTimeout(() => {
      logger.info('Procesamiento de mensaje completado', { category: 'MESSAGE', userId: 'user_202' });
    }, 1000);
    
    setTimeout(() => {
      logger.warn('Tiempo de respuesta lento detectado', { category: 'PERFORMANCE', userId: 'system' });
    }, 2000);
    
    setTimeout(() => {
      logger.error('Error de conexión a servicio externo', { category: 'EXTERNAL_SERVICE', userId: 'system' });
    }, 3000);
    
    res.json({
      success: true,
      message: 'Logs de prueba generados exitosamente',
      timestamp: new Date().toISOString(),
      logsGenerated: 9
    });
  } catch (error) {
    console.error('❌ Error generando logs de prueba:', error);
    res.status(500).json({
      success: false,
      error: 'GENERATE_TEST_ERROR',
      message: 'Error generando logs de prueba',
      details: error.message
    });
  }
});

/**
 * 🖥️ GET DASHBOARD HTML
 * @route GET /logs
 * @desc Dashboard visual de logs
 * @access Public (sin autenticación para debugging)
 */
router.get('/dashboard-html', 
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
router.get('/',
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