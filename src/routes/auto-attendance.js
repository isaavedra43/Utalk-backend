const express = require('express');
const router = express.Router();
const AutoAttendanceController = require('../controllers/AutoAttendanceController');
const AutoAttendanceConfigController = require('../controllers/AutoAttendanceConfigController');
const authMiddleware = require('../middleware/authMiddleware');
const hrAuthorization = require('../middleware/hrAuthorization');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

/**
 * RUTAS DE ASISTENCIA AUTOMÁTICA
 */

// Procesar asistencia automática para el día actual
router.post('/process-today', 
  hrAuthorization(['HR_ADMIN', 'HR_MANAGER']),
  AutoAttendanceController.processToday
);

// Procesar asistencia automática para una fecha específica
router.post('/process-date', 
  hrAuthorization(['HR_ADMIN', 'HR_MANAGER']),
  AutoAttendanceController.processDate
);

// Procesar asistencia automática para un rango de fechas
router.post('/process-range', 
  hrAuthorization(['HR_ADMIN', 'HR_MANAGER']),
  AutoAttendanceController.processDateRange
);

// Procesar asistencia automática para un empleado específico
router.post('/process-employee/:id', 
  hrAuthorization(['HR_ADMIN', 'HR_MANAGER', 'SUPERVISOR']),
  AutoAttendanceController.processEmployee
);

// Obtener estadísticas de asistencia automática
router.get('/stats', 
  hrAuthorization(['HR_ADMIN', 'HR_MANAGER', 'SUPERVISOR']),
  AutoAttendanceController.getStats
);

// Obtener configuración de empleados
router.get('/employees-config', 
  hrAuthorization(['HR_ADMIN', 'HR_MANAGER', 'SUPERVISOR']),
  AutoAttendanceController.getEmployeesConfig
);

// Simular procesamiento de asistencia (para testing)
router.post('/simulate', 
  hrAuthorization(['HR_ADMIN', 'HR_MANAGER']),
  AutoAttendanceController.simulate
);

// CONFIGURACIÓN DE ASISTENCIA AUTOMÁTICA

// Obtener configuración general
router.get('/config', 
  hrAuthorization(['HR_ADMIN', 'HR_MANAGER']),
  AutoAttendanceConfigController.getConfig
);

// Actualizar configuración general
router.put('/config', 
  hrAuthorization(['HR_ADMIN']),
  AutoAttendanceConfigController.updateConfig
);

// Obtener configuración por empleado
router.get('/config/employee/:id', 
  hrAuthorization(['HR_ADMIN', 'HR_MANAGER', 'SUPERVISOR']),
  AutoAttendanceConfigController.getEmployeeConfig
);

// Actualizar configuración por empleado
router.put('/config/employee/:id', 
  hrAuthorization(['HR_ADMIN', 'HR_MANAGER']),
  AutoAttendanceConfigController.updateEmployeeConfig
);

module.exports = router;
