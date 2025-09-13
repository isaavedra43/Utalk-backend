const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Controladores
const EmployeeController = require('../controllers/EmployeeController');
const PayrollController = require('../controllers/PayrollController');
const AttendanceController = require('../controllers/AttendanceController');
const VacationController = require('../controllers/VacationController');
const ExtrasController = require('../controllers/ExtrasController');
const AttachmentsController = require('../controllers/AttachmentsController');
const ReportsController = require('../controllers/ReportsController');

// Middleware
const { authMiddleware } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { intelligentRateLimit } = require('../middleware/intelligentRateLimit');

// Configuración de multer para subida de archivos
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Permitir solo ciertos tipos de archivo
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/pdf', // .pdf
      'image/jpeg', // .jpg
      'image/png' // .png
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'), false);
    }
  }
});

// Aplicar autenticación a todas las rutas
router.use(authMiddleware);

// Aplicar rate limiting inteligente
router.use(intelligentRateLimit);

/**
 * RUTAS PRINCIPALES DE EMPLEADOS
 */

// Listar empleados con filtros y paginación
router.get('/', EmployeeController.list);

// Buscar empleados
router.get('/search', EmployeeController.search);

// Obtener estadísticas de empleados
router.get('/stats', EmployeeController.getStats);

// Obtener organigrama
router.get('/org-chart', EmployeeController.getOrgChart);

// Obtener cumpleaños próximos
router.get('/birthdays', EmployeeController.getUpcomingBirthdays);

// Obtener jubilaciones próximas
router.get('/retirement', EmployeeController.getUpcomingRetirements);

// Obtener empleados por departamento
router.get('/department/:department', EmployeeController.getByDepartment);

// Importar empleados desde Excel
router.post('/import', upload.single('file'), EmployeeController.importEmployees);

// Exportar empleados
router.get('/export', EmployeeController.exportEmployees);

// Corregir status de empleados
router.post('/fix-status/:employeeId?', EmployeeController.fixEmployeeStatus);

// Crear nuevo empleado
router.post('/', 
  validateRequest([
    'personalInfo.firstName',
    'personalInfo.lastName', 
    'personalInfo.phone',
    'position.title',
    'position.department',
    'contract.salary'
  ]), 
  EmployeeController.create
);

// Obtener empleado específico
router.get('/:id', EmployeeController.getById);

// Actualizar empleado
router.put('/:id', EmployeeController.update);

// Eliminar empleado
router.delete('/:id', EmployeeController.delete);

/**
 * RUTAS DE NÓMINA
 */

// Obtener nómina semanal general
router.get('/payroll/weekly', PayrollController.getWeeklyPayroll);

// Obtener reportes de nómina
router.get('/payroll/reports', PayrollController.getReports);

// Procesar nómina masiva
router.post('/payroll/bulk-process', PayrollController.bulkProcess);

// Obtener nómina de un empleado
router.get('/:id/payroll', PayrollController.getByEmployee);

// Crear período de nómina
router.post('/:id/payroll', PayrollController.create);

// Calcular nómina automáticamente
router.post('/:id/payroll/calculate', PayrollController.calculatePayroll);

// Procesar nómina con extras incluidos
router.post('/:id/payroll/process-with-extras', PayrollController.processPayrollWithExtras);

// Actualizar período de nómina
router.put('/:id/payroll/:payrollId', PayrollController.update);

// Obtener desglose de nómina
router.get('/:id/payroll/:payrollId/breakdown', PayrollController.getBreakdown);

// Generar recibo de nómina
router.get('/:id/payroll/:payrollId/receipt', PayrollController.generateReceipt);

/**
 * RUTAS DE ASISTENCIA
 */

// Obtener reporte diario de asistencia
router.get('/attendance/daily', AttendanceController.getDailyReport);

// Obtener estadísticas de asistencia
router.get('/attendance/stats', AttendanceController.getStats);

// Exportar reporte de asistencia
router.get('/attendance/export', AttendanceController.exportReport);

// Obtener asistencia por departamento
router.get('/attendance/department/:department', AttendanceController.getByDepartment);

// Obtener asistencia de un empleado
router.get('/:id/attendance', AttendanceController.getByEmployee);

// Crear registro de asistencia
router.post('/:id/attendance', AttendanceController.create);

// Obtener estado actual de asistencia
router.get('/:id/attendance/current', AttendanceController.getCurrentStatus);

// Registrar entrada
router.post('/:id/attendance/clock-in', AttendanceController.clockIn);

// Registrar salida
router.post('/:id/attendance/clock-out', AttendanceController.clockOut);

// Actualizar registro de asistencia
router.put('/:id/attendance/:recordId', AttendanceController.update);

/**
 * RUTAS DE EXTRAS Y MOVIMIENTOS
 */

// Obtener estadísticas generales de extras
router.get('/extras/stats', ExtrasController.getExtrasStats);

// Obtener movimientos pendientes de aprobación
router.get('/extras/pending-approvals', ExtrasController.getPendingApprovals);

// Aprobar movimiento
router.put('/extras/:movementId/approve', ExtrasController.approveMovement);

// Rechazar movimiento
router.put('/extras/:movementId/reject', ExtrasController.rejectMovement);

// Obtener todos los movimientos de extras de un empleado
router.get('/:id/extras', ExtrasController.getExtrasByEmployee);

// Registrar nuevo movimiento de extras
router.post('/:id/extras', 
  validateRequest(['type', 'date', 'description']),
  ExtrasController.registerExtra
);

// Obtener resumen de movimientos
router.get('/:id/movements-summary', ExtrasController.getMovementsSummary);

// Obtener métricas de asistencia y extras
router.get('/:id/attendance-metrics', ExtrasController.getAttendanceMetrics);

// Obtener datos para gráficas
router.get('/:id/chart-data', ExtrasController.getChartData);

// Obtener impacto en nómina
router.get('/:id/payroll-impact', ExtrasController.getPayrollImpact);

// Actualizar movimiento específico
router.put('/:id/extras/:movementId', ExtrasController.updateMovement);

// Eliminar movimiento específico
router.delete('/:id/extras/:movementId', ExtrasController.deleteMovement);

// Obtener horas extra de un empleado
router.get('/:id/overtime', ExtrasController.getMovementsByType);

// Registrar horas extra
router.post('/:id/overtime', 
  validateRequest(['date', 'hours', 'reason', 'description']),
  ExtrasController.registerExtra
);

// Obtener ausencias de un empleado
router.get('/:id/absences', ExtrasController.getMovementsByType);

// Registrar ausencia
router.post('/:id/absences', 
  validateRequest(['date', 'reason', 'description', 'duration']),
  ExtrasController.registerExtra
);

// Obtener préstamos de un empleado
router.get('/:id/loans', ExtrasController.getMovementsByType);

// Registrar préstamo
router.post('/:id/loans', 
  validateRequest(['date', 'totalAmount', 'totalInstallments', 'reason', 'description', 'justification']),
  ExtrasController.registerExtra
);

/**
 * RUTAS DE ARCHIVOS ADJUNTOS
 */

// Configurar multer para archivos de extras
const extrasUpload = AttachmentsController.getMulterConfig();

// Subir archivos
router.post('/attachments', 
  extrasUpload.array('files', 5), 
  AttachmentsController.uploadFiles
);

// Validar archivos antes de subir
router.post('/attachments/validate', 
  extrasUpload.array('files', 5), 
  AttachmentsController.validateFiles
);

// Obtener información de archivo
router.get('/attachments/:fileId', AttachmentsController.getFileInfo);

// Descargar archivo
router.get('/attachments/:fileId/download', AttachmentsController.downloadFile);

// Eliminar archivo
router.delete('/attachments/:fileId', AttachmentsController.deleteFile);

// Obtener archivos de un movimiento
router.get('/movements/:movementId/attachments', AttachmentsController.getMovementFiles);

/**
 * RUTAS DE REPORTES
 */

// Reporte de extras por empleado
router.get('/reports/employee/:id/extras', ReportsController.generateEmployeeExtrasReport);

// Reporte de asistencia por empleado
router.get('/reports/employee/:id/attendance', ReportsController.generateEmployeeAttendanceReport);

// Reporte consolidado de nómina
router.get('/reports/payroll-consolidated', ReportsController.generatePayrollConsolidatedReport);

/**
 * RUTAS DE VACACIONES
 */

// Obtener solicitudes pendientes
router.get('/vacations/pending', VacationController.getPendingRequests);

// Obtener calendario de vacaciones
router.get('/vacations/calendar', VacationController.getCalendar);

// Obtener estadísticas de vacaciones
router.get('/vacations/stats', VacationController.getStats);

// Obtener próximas vacaciones
router.get('/vacations/upcoming', VacationController.getUpcoming);

// Exportar reporte de vacaciones
router.get('/vacations/export', VacationController.exportReport);

// Aprobar múltiples solicitudes
router.post('/vacations/bulk-approve', VacationController.bulkApprove);

// Obtener vacaciones de un empleado
router.get('/:id/vacations', VacationController.getByEmployee);

// Crear solicitud de vacaciones
router.post('/:id/vacations', 
  validateRequest(['startDate', 'endDate', 'type']),
  VacationController.create
);

// Obtener balance de vacaciones
router.get('/:id/vacations/balance', VacationController.getBalance);

// Actualizar solicitud de vacaciones
router.put('/:id/vacations/:requestId', VacationController.update);

/**
 * RUTAS DE DOCUMENTOS
 * Estas rutas se implementarán en el siguiente controlador
 */

// TODO: Implementar rutas de documentos
router.get('/:id/documents', (req, res) => {
  res.json({
    success: true,
    message: 'Funcionalidad de documentos en desarrollo',
    data: { documents: [] }
  });
});

router.post('/:id/documents', upload.single('file'), (req, res) => {
  res.json({
    success: true,
    message: 'Funcionalidad de subida de documentos en desarrollo'
  });
});

/**
 * RUTAS DE INCIDENCIAS
 * Estas rutas se implementarán en el siguiente controlador
 */

// TODO: Implementar rutas de incidencias
router.get('/:id/incidents', (req, res) => {
  res.json({
    success: true,
    message: 'Funcionalidad de incidencias en desarrollo',
    data: { incidents: [] }
  });
});

router.post('/:id/incidents', (req, res) => {
  res.json({
    success: true,
    message: 'Funcionalidad de creación de incidencias en desarrollo'
  });
});

/**
 * RUTAS DE EVALUACIONES
 * Estas rutas se implementarán en el siguiente controlador
 */

// TODO: Implementar rutas de evaluaciones
router.get('/:id/evaluations', (req, res) => {
  res.json({
    success: true,
    message: 'Funcionalidad de evaluaciones en desarrollo',
    data: { evaluations: [] }
  });
});

router.post('/:id/evaluations', (req, res) => {
  res.json({
    success: true,
    message: 'Funcionalidad de creación de evaluaciones en desarrollo'
  });
});

/**
 * RUTAS DE HABILIDADES
 * Estas rutas se implementarán en el siguiente controlador
 */

// TODO: Implementar rutas de habilidades
router.get('/:id/skills', (req, res) => {
  res.json({
    success: true,
    message: 'Funcionalidad de habilidades en desarrollo',
    data: { skills: [] }
  });
});

router.post('/:id/skills', (req, res) => {
  res.json({
    success: true,
    message: 'Funcionalidad de creación de habilidades en desarrollo'
  });
});

/**
 * RUTAS DE HISTORIAL
 * Estas rutas se implementarán en el siguiente controlador
 */

// TODO: Implementar rutas de historial
router.get('/:id/history', (req, res) => {
  res.json({
    success: true,
    message: 'Funcionalidad de historial en desarrollo',
    data: { history: [] }
  });
});

/**
 * MANEJO DE ERRORES
 */

// Manejo de errores de multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'El archivo es demasiado grande. Máximo 10MB permitido.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Campo de archivo inesperado.'
      });
    }
  }
  
  if (error.message === 'Tipo de archivo no permitido') {
    return res.status(400).json({
      success: false,
      error: 'Tipo de archivo no permitido. Solo se permiten archivos Excel, CSV, PDF, JPG y PNG.'
    });
  }
  
  next(error);
});

// Manejo general de errores
router.use((error, req, res, next) => {
  console.error('Error en rutas de empleados:', error);
  
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;
