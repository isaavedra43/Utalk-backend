const express = require('express');
const router = express.Router();
const AutoAttendanceController = require('../controllers/AutoAttendanceController');
const AutoAttendanceConfigController = require('../controllers/AutoAttendanceConfigController');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

/**
 * RUTAS DE ASISTENCIA AUTOMÁTICA
 */

// Procesar asistencia automática para el día actual
router.post('/process-today', 
  requireRole(['admin', 'superadmin']),
  AutoAttendanceController.processToday
);

// Procesar asistencia automática para una fecha específica
router.post('/process-date', 
  requireRole(['admin', 'superadmin']),
  AutoAttendanceController.processDate
);

// Procesar asistencia automática para un rango de fechas
router.post('/process-range', 
  requireRole(['admin', 'superadmin']),
  AutoAttendanceController.processDateRange
);

// Procesar asistencia automática para un empleado específico
router.post('/process-employee/:id', 
  requireRole(['admin', 'superadmin', 'agent']),
  AutoAttendanceController.processEmployee
);

// Obtener estadísticas de asistencia automática
router.get('/stats', 
  requireRole(['admin', 'superadmin', 'agent']),
  AutoAttendanceController.getStats
);

// Obtener configuración de empleados
router.get('/employees-config', 
  requireRole(['admin', 'superadmin', 'agent']),
  AutoAttendanceController.getEmployeesConfig
);

// Simular procesamiento de asistencia (para testing)
router.post('/simulate', 
  requireRole(['admin', 'superadmin']),
  AutoAttendanceController.simulate
);

// CONFIGURACIÓN DE ASISTENCIA AUTOMÁTICA

// Obtener configuración general
router.get('/config', 
  requireRole(['admin', 'superadmin']),
  AutoAttendanceConfigController.getConfig
);

// Actualizar configuración general
router.put('/config', 
  requireRole(['admin']),
  AutoAttendanceConfigController.updateConfig
);

// Obtener configuración por empleado
router.get('/config/employee/:id', 
  requireRole(['admin', 'superadmin', 'agent']),
  AutoAttendanceConfigController.getEmployeeConfig
);

// Actualizar configuración por empleado
router.put('/config/employee/:id', 
  requireRole(['admin', 'superadmin']),
  AutoAttendanceConfigController.updateEmployeeConfig
);

module.exports = router;
