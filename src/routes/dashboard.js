const express = require('express');
const DashboardController = require('../controllers/DashboardController');

const router = express.Router();

/**
 * @route GET /api/dashboard/metrics
 * @desc Obtener métricas del dashboard
 * @access Private
 */
router.get('/metrics', DashboardController.getMetrics);

/**
 * @route GET /api/dashboard/messages/stats
 * @desc Estadísticas de mensajes
 * @access Private
 */
router.get('/messages/stats', DashboardController.getMessageStats);

/**
 * @route GET /api/dashboard/contacts/stats
 * @desc Estadísticas de contactos
 * @access Private
 */
router.get('/contacts/stats', DashboardController.getContactStats);

/**
 * @route GET /api/dashboard/campaigns/stats
 * @desc Estadísticas de campañas
 * @access Private
 */
router.get('/campaigns/stats', DashboardController.getCampaignStats);

/**
 * @route GET /api/dashboard/activity
 * @desc Actividad reciente
 * @access Private
 */
router.get('/activity', DashboardController.getRecentActivity);

/**
 * @route GET /api/dashboard/export
 * @desc Exportar reportes del dashboard
 * @access Private
 */
router.get('/export', DashboardController.exportReport);

/**
 * @route GET /api/dashboard/performance
 * @desc Métricas de rendimiento del equipo
 * @access Private
 */
router.get('/performance', DashboardController.getPerformanceMetrics);

// EXPORT PATTERN: Single router export (STANDARD for all routes)
// USAGE: const dashboardRoutes = require('./routes/dashboard');
module.exports = router; 