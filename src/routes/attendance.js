const express = require('express');
const router = express.Router();
const AttendanceController = require('../controllers/AttendanceController');
const { authMiddleware } = require('../middleware/auth');

/**
 * RUTAS DE ASISTENCIA
 * Gestión completa de asistencia diaria de empleados
 */

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * GESTIÓN DE REPORTES DE ASISTENCIA
 */

// Crear reporte de asistencia
router.post('/reports', AttendanceController.createReport);

// Listar reportes con filtros
router.get('/reports', AttendanceController.listReports);

// Obtener reporte específico con detalles
router.get('/reports/:reportId', AttendanceController.getReport);

// Actualizar reporte
router.put('/reports/:reportId', AttendanceController.updateReport);

// Eliminar reporte
router.delete('/reports/:reportId', AttendanceController.deleteReport);

/**
 * FLUJO DE APROBACIÓN
 */

// Aprobar reporte
router.post('/reports/:reportId/approve', AttendanceController.approveReport);

// Rechazar reporte
router.post('/reports/:reportId/reject', AttendanceController.rejectReport);

/**
 * GENERACIÓN DE REPORTES
 */

// Generar reporte rápido
router.post('/reports/generate-quick', AttendanceController.generateQuickReport);

/**
 * ESTADÍSTICAS Y MÉTRICAS
 */

// Obtener estadísticas generales
router.get('/stats', AttendanceController.getStats);

// Obtener métricas avanzadas
router.get('/metrics', AttendanceController.getMetrics);

// Dashboard de asistencia
router.get('/dashboard', AttendanceController.getDashboard);

/**
 * PERMISOS DE USUARIO
 */

// Obtener permisos del usuario actual para asistencia
router.get('/permissions', AttendanceController.getUserPermissions);

/**
 * CONSULTAS POR EMPLEADO
 */

// Obtener estado de empleado específico para una fecha
router.get('/employee/:employeeId/status', AttendanceController.getEmployeeStatus);

// Obtener historial de asistencia de empleado
router.get('/employee/:employeeId/history', AttendanceController.getEmployeeHistory);

/**
 * GESTIÓN DE MOVIMIENTOS
 */

// Crear movimiento de asistencia (horas extra, préstamos, etc.)
router.post('/movements', AttendanceController.createMovement);

/**
 * GESTIÓN DE EXCEPCIONES
 */

// Crear excepción de asistencia (llegadas tarde, salidas tempranas, etc.)
router.post('/exceptions', AttendanceController.createException);

/**
 * EXPORTACIÓN DE DATOS
 */

// Exportar reporte en formato específico
router.get('/reports/:reportId/export', AttendanceController.exportReport);

module.exports = router;
