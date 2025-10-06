const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Controladores
const EmployeeController = require('../controllers/EmployeeController');
const PayrollController = require('../controllers/PayrollController');
const AttendanceController = require('../controllers/AttendanceController');
const VacationController = require('../controllers/VacationController');
const IncidentController = require('../controllers/IncidentController');
const EquipmentController = require('../controllers/EquipmentController');
const SkillsController = require('../controllers/SkillsController');
const EquipmentReviewController = require('../controllers/EquipmentReviewController');
const ExtrasController = require('../controllers/ExtrasController');
const AttachmentsController = require('../controllers/AttachmentsController');
const ReportsController = require('../controllers/ReportsController');

// Middleware
const { authMiddleware } = require('../middleware/auth');
const { validateRequest, validateRequiredFields } = require('../middleware/validation');
const { intelligentRateLimit } = require('../middleware/intelligentRateLimit');
const Joi = require('joi');

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

// 🛡️ VALIDADORES ESPECÍFICOS PARA EMPLEADOS
const employeeValidators = {
  // Validación para crear empleado
  validateCreate: validateRequest({
    body: Joi.object({
      // Información básica del empleado
      employeeNumber: Joi.string().min(1).max(20).optional().messages({
        'string.min': 'El número de empleado debe tener al menos 1 carácter',
        'string.max': 'El número de empleado no puede exceder 20 caracteres'
      }),
      
      firstName: Joi.string().min(2).max(50).required().messages({
        'any.required': 'El nombre es obligatorio',
        'string.empty': 'El nombre no puede estar vacío',
        'string.min': 'El nombre debe tener al menos 2 caracteres',
        'string.max': 'El nombre no puede exceder 50 caracteres'
      }),
      
      lastName: Joi.string().min(2).max(50).required().messages({
        'any.required': 'Los apellidos son obligatorios',
        'string.empty': 'Los apellidos no pueden estar vacíos',
        'string.min': 'Los apellidos deben tener al menos 2 caracteres',
        'string.max': 'Los apellidos no pueden exceder 50 caracteres'
      }),
      
      email: Joi.string().email().required().messages({
        'any.required': 'El email es obligatorio',
        'string.empty': 'El email no puede estar vacío',
        'string.email': 'El email debe tener un formato válido (ejemplo@dominio.com)'
      }),
      
      phone: Joi.string().min(10).max(15).required().messages({
        'any.required': 'El teléfono es obligatorio',
        'string.empty': 'El teléfono no puede estar vacío',
        'string.min': 'El teléfono debe tener al menos 10 dígitos',
        'string.max': 'El teléfono no puede exceder 15 dígitos'
      }),
      
      status: Joi.string().valid('active', 'inactive', 'pending', 'terminated').default('active').messages({
        'any.only': 'El estado debe ser: active, inactive, pending o terminated'
      }),
      
      hireDate: Joi.date().iso().required().messages({
        'any.required': 'La fecha de contratación es obligatoria',
        'date.format': 'La fecha debe estar en formato ISO (YYYY-MM-DD)'
      }),
      
      // Información personal
      personalInfo: Joi.object({
        rfc: Joi.string().min(10).max(13).optional().messages({
          'string.min': 'El RFC debe tener al menos 10 caracteres',
          'string.max': 'El RFC no puede exceder 13 caracteres'
        }),
        curp: Joi.string().length(18).optional().messages({
          'string.length': 'El CURP debe tener exactamente 18 caracteres'
        }),
        nss: Joi.string().min(8).max(11).optional().messages({
          'string.min': 'El NSS debe tener al menos 8 caracteres',
          'string.max': 'El NSS no puede exceder 11 caracteres'
        }),
        birthDate: Joi.date().iso().optional().messages({
          'date.format': 'La fecha de nacimiento debe estar en formato ISO (YYYY-MM-DD)'
        }),
        gender: Joi.string().valid('male', 'female', 'other').optional(),
        maritalStatus: Joi.string().valid('single', 'married', 'divorced', 'widowed').optional(),
        
        // Dirección
        address: Joi.object({
          street: Joi.string().max(100).optional(),
          number: Joi.string().max(20).optional(),
          neighborhood: Joi.string().max(50).optional(),
          city: Joi.string().max(50).optional(),
          state: Joi.string().max(50).optional(),
          zipCode: Joi.string().max(10).optional(),
          country: Joi.string().max(50).optional()
        }).optional(),
        
        // Contacto de emergencia
        emergencyContact: Joi.object({
          name: Joi.string().max(100).optional(),
          relationship: Joi.string().max(50).optional(),
          phone: Joi.string().max(15).optional(),
          email: Joi.string().email().optional()
        }).optional(),
        
        // Información bancaria
        bankInfo: Joi.object({
          bankName: Joi.string().max(100).optional(),
          accountNumber: Joi.string().max(20).optional(),
          clabe: Joi.string().length(18).optional().messages({
            'string.length': 'La CLABE debe tener exactamente 18 caracteres'
          }),
          accountType: Joi.string().valid('checking', 'savings').optional()
        }).optional()
      }).optional(),
      
      // Posición y trabajo
      position: Joi.object({
        title: Joi.string().min(2).max(100).required().messages({
          'any.required': 'El título del puesto es obligatorio',
          'string.min': 'El título debe tener al menos 2 caracteres',
          'string.max': 'El título no puede exceder 100 caracteres'
        }),
        department: Joi.string().min(2).max(50).required().messages({
          'any.required': 'El departamento es obligatorio',
          'string.min': 'El departamento debe tener al menos 2 caracteres',
          'string.max': 'El departamento no puede exceder 50 caracteres'
        }),
        level: Joi.string().valid('Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'Executive').required().messages({
          'any.required': 'El nivel del puesto es obligatorio',
          'any.only': 'El nivel debe ser: Entry, Junior, Mid, Senior, Lead, Manager, Director o Executive'
        }),
        reportsTo: Joi.string().max(100).optional(),
        jobDescription: Joi.string().max(1000).optional(),
        requirements: Joi.array().items(Joi.string().max(200)).max(10).optional(),
        skills: Joi.array().items(Joi.string().max(50)).max(20).optional(),
        salaryRange: Joi.object({
          min: Joi.number().min(0).optional(),
          max: Joi.number().min(0).optional()
        }).optional()
      }).required(),
      
      // Ubicación
      location: Joi.object({
        name: Joi.string().max(100).optional(),
        address: Joi.object({
          street: Joi.string().max(100).optional(),
          number: Joi.string().max(20).optional(),
          neighborhood: Joi.string().max(50).optional(),
          city: Joi.string().max(50).optional(),
          state: Joi.string().max(50).optional(),
          zipCode: Joi.string().max(10).optional(),
          country: Joi.string().max(50).optional()
        }).optional(),
        timezone: Joi.string().max(50).optional(),
        isRemote: Joi.boolean().optional()
      }).optional(),
      
      // Contrato
      contract: Joi.object({
        type: Joi.string().valid('permanent', 'temporary', 'intern', 'contractor').required().messages({
          'any.required': 'El tipo de contrato es obligatorio',
          'any.only': 'El tipo debe ser: permanent, temporary, intern o contractor'
        }),
        startDate: Joi.date().iso().required().messages({
          'any.required': 'La fecha de inicio del contrato es obligatoria',
          'date.format': 'La fecha debe estar en formato ISO (YYYY-MM-DD)'
        }),
        endDate: Joi.date().iso().optional().messages({
          'date.format': 'La fecha de fin debe estar en formato ISO (YYYY-MM-DD)'
        }),
        workingHours: Joi.number().min(1).max(80).optional().messages({
          'number.min': 'Las horas de trabajo deben ser al menos 1',
          'number.max': 'Las horas de trabajo no pueden exceder 80'
        }),
        workingDays: Joi.string().max(100).optional(),
        workingHoursRange: Joi.string().max(20).optional(),
        customSchedule: Joi.object().optional(),
        benefits: Joi.array().items(Joi.string().max(100)).max(20).optional(),
        clauses: Joi.array().items(Joi.string().max(500)).max(10).optional(),
        schedule: Joi.string().max(500).optional()
      }).required(),
      
      // Salario
      salary: Joi.object({
        baseSalary: Joi.number().min(0).required().messages({
          'any.required': 'El salario base es obligatorio',
          'number.min': 'El salario base debe ser mayor o igual a 0'
        }),
        currency: Joi.string().valid('MXN', 'USD', 'EUR').default('MXN').messages({
          'any.only': 'La moneda debe ser: MXN, USD o EUR'
        }),
        frequency: Joi.string().valid('hourly', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly').default('monthly').messages({
          'any.only': 'La frecuencia debe ser: hourly, daily, weekly, biweekly, monthly o yearly'
        }),
        paymentMethod: Joi.string().valid('cash', 'check', 'bank_transfer', 'payroll_card').default('bank_transfer').messages({
          'any.only': 'El método de pago debe ser: cash, check, bank_transfer o payroll_card'
        }),
        allowances: Joi.array().items(Joi.object({
          name: Joi.string().max(100).required(),
          amount: Joi.number().min(0).required(),
          type: Joi.string().valid('fixed', 'percentage').required()
        })).max(10).optional(),
        deductions: Joi.array().items(Joi.object({
          name: Joi.string().max(100).required(),
          amount: Joi.number().min(0).required(),
          type: Joi.string().valid('fixed', 'percentage').required()
        })).max(10).optional()
      }).required(),
      
      // Información adicional
      sbc: Joi.number().min(0).optional().messages({
        'number.min': 'El SBC debe ser mayor o igual a 0'
      }),
      vacationBalance: Joi.number().min(0).max(365).optional().messages({
        'number.min': 'El balance de vacaciones debe ser mayor o igual a 0',
        'number.max': 'El balance de vacaciones no puede exceder 365 días'
      }),
      sickLeaveBalance: Joi.number().min(0).max(365).optional().messages({
        'number.min': 'El balance de incapacidades debe ser mayor o igual a 0',
        'number.max': 'El balance de incapacidades no puede exceder 365 días'
      }),
      
      // Métricas (opcional para creación)
      metrics: Joi.object({
        totalEarnings: Joi.number().min(0).optional(),
        totalDeductions: Joi.number().min(0).optional(),
        netPay: Joi.number().min(0).optional(),
        attendanceRate: Joi.number().min(0).max(100).optional(),
        lateArrivals: Joi.number().min(0).optional(),
        absences: Joi.number().min(0).optional(),
        vacationDaysUsed: Joi.number().min(0).optional(),
        vacationDaysRemaining: Joi.number().min(0).optional(),
        overtimeHours: Joi.number().min(0).optional(),
        overtimeAmount: Joi.number().min(0).optional(),
        incidentsCount: Joi.number().min(0).optional(),
        incidentsLast30Days: Joi.number().min(0).optional(),
        documentCompliance: Joi.number().min(0).max(100).optional(),
        trainingCompletion: Joi.number().min(0).max(100).optional(),
        performanceScore: Joi.number().min(0).max(100).optional()
      }).optional()
    }).options({ allowUnknown: false })
  }),

  // Validación para filtros de lista
  validateListQuery: validateRequest({
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1).messages({
        'number.min': 'La página debe ser mayor a 0'
      }),
      limit: Joi.number().integer().min(1).max(100).default(20).messages({
        'number.min': 'El límite debe ser mayor a 0',
        'number.max': 'El límite no puede exceder 100'
      }),
      search: Joi.string().max(100).optional(),
      sortBy: Joi.string().valid('firstName', 'lastName', 'email', 'department', 'hireDate', 'createdAt').default('createdAt').messages({
        'any.only': 'El campo de ordenamiento debe ser: firstName, lastName, email, department, hireDate o createdAt'
      }),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc').messages({
        'any.only': 'El orden debe ser: asc o desc'
      }),
      status: Joi.string().valid('active', 'inactive', 'pending', 'terminated').optional(),
      department: Joi.string().max(50).optional(),
      level: Joi.string().valid('Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'Executive').optional()
    }).options({ allowUnknown: false })
  })
};

// Aplicar autenticación a todas las rutas
router.use(authMiddleware);

// Aplicar rate limiting inteligente
router.use(intelligentRateLimit);

/**
 * RUTAS PRINCIPALES DE EMPLEADOS
 */

// Listar empleados con filtros y paginación
router.get('/', employeeValidators.validateListQuery, EmployeeController.list);

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
  employeeValidators.validateCreate,
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

// Obtener períodos pendientes de pago
router.get('/payroll/pending', PayrollController.getPendingPayments);


// Obtener estadísticas de nómina
router.get('/payroll/stats', PayrollController.getPayrollStats);

// Configurar nómina para un empleado
router.post('/:id/payroll/config', PayrollController.configurePayroll);

// Obtener configuración de nómina de un empleado
router.get('/:id/payroll/config', PayrollController.getPayrollConfig);

// Actualizar configuración de nómina
router.put('/:id/payroll/config', PayrollController.updatePayrollConfig);

// Generar nómina para un empleado
router.post('/:id/payroll/generate', PayrollController.generatePayroll);

// Obtener períodos de nómina de un empleado
router.get('/:id/payroll/periods', PayrollController.getPayrollPeriods);

// Obtener detalles de un período específico
router.get('/:id/payroll/period/:payrollId/details', PayrollController.getPayrollDetails);

// Aprobar período de nómina
router.put('/:id/payroll/approve/:payrollId', PayrollController.approvePayroll);

// Marcar período como pagado
router.put('/:id/payroll/pay/:payrollId', PayrollController.markAsPaid);

// Cancelar período de nómina
router.put('/:id/payroll/cancel/:payrollId', PayrollController.cancelPayroll);

// Eliminar período de nómina
router.delete('/:id/payroll/period/:payrollId', PayrollController.deletePayroll);

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

// Recalcular salarios diarios
router.put('/:id/attendance/recalculate-salaries', AttendanceController.recalculateSalaries);

// Obtener resumen de salarios
router.get('/:id/attendance/salary-summary', AttendanceController.getSalarySummary);

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
  validateRequiredFields(['type', 'date', 'description']),
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
  validateRequiredFields(['date', 'hours', 'reason', 'description']),
  ExtrasController.registerExtra
);

// Obtener ausencias de un empleado
router.get('/:id/absences', ExtrasController.getMovementsByType);

// Registrar ausencia
router.post('/:id/absences', 
  validateRequiredFields(['date', 'reason', 'description', 'duration']),
  ExtrasController.registerExtra
);

// Obtener préstamos de un empleado
router.get('/:id/loans', ExtrasController.getMovementsByType);

// Registrar préstamo
router.post('/:id/loans', 
  validateRequiredFields(['date', 'totalAmount', 'totalInstallments', 'reason', 'description', 'justification']),
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

// Validar archivos antes de subir - FUNCIÓN NO IMPLEMENTADA
// router.post('/attachments/validate', 
//   extrasUpload.array('files', 5), 
//   AttachmentsController.validateFiles
// );

// Obtener información de archivo - FUNCIÓN NO IMPLEMENTADA
// router.get('/attachments/:fileId', AttachmentsController.getFileInfo);

// Descargar archivo
router.get('/attachments/:fileId/download', AttachmentsController.downloadFile);

// Eliminar archivo
router.delete('/attachments/:fileId', AttachmentsController.deleteFile);

// Obtener archivos de un movimiento - FUNCIÓN NO IMPLEMENTADA
// router.get('/movements/:movementId/attachments', AttachmentsController.getMovementFiles);

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

/**
 * RUTAS DE VACACIONES - Alineadas 100% con Frontend
 * Endpoints exactos según especificaciones del modal
 */

// 1. Obtener todos los datos de vacaciones del empleado
router.get('/:id/vacations', VacationController.getByEmployee);

// 2. Obtener solo el balance
router.get('/:id/vacations/balance', VacationController.getBalance);

// 3. Obtener todas las solicitudes
router.get('/:id/vacations/requests', VacationController.getRequests);

// 3.1 Calcular pago de vacaciones (sin persistir)
router.post('/:id/vacations/calculate-payment', VacationController.calculatePayment);
// Fallback cuando el frontend envía la ruta sin id (doble slash)
router.post('/vacations/calculate-payment', VacationController.calculatePayment);

/**
 * RUTAS DE EQUIPO/HERRAMIENTAS POR EMPLEADO
 */

// Lista paginada
router.get('/:id/equipment', EquipmentController.list);
// Resumen (200 con ceros si vacío)
router.get('/:id/equipment/summary', EquipmentController.summary);
// Asignación
router.post('/:id/equipment/assign', EquipmentController.assign);
// Alias de compatibilidad: algunos clientes envían POST /:id/equipment
router.post('/:id/equipment', EquipmentController.assign);
// Movimientos
router.post('/:id/equipment/movements', EquipmentController.addMovement);
// Actualizar item
router.put('/:id/equipment/:itemId', EquipmentController.update);
// Devolver item
router.put('/:id/equipment/:itemId/return', EquipmentController.returnItem);
// Eliminar item
router.delete('/:id/equipment/:itemId', EquipmentController.remove);

/**
 * RUTAS DE HABILIDADES (skills) POR EMPLEADO
 */
// Skills
router.get('/:id/skills', SkillsController.listSkills);
router.post('/:id/skills', SkillsController.createSkill);
router.put('/:id/skills/:skillId', SkillsController.updateSkill);
router.delete('/:id/skills/:skillId', SkillsController.deleteSkill);
// Certifications
router.get('/:id/certifications', SkillsController.listCertifications);
router.post('/:id/certifications', SkillsController.createCertification);
router.put('/:id/certifications/:certId', SkillsController.updateCertification);
router.delete('/:id/certifications/:certId', SkillsController.deleteCertification);
// Development plans
router.get('/:id/development-plans', SkillsController.listPlans);
router.post('/:id/development-plans', SkillsController.createPlan);
router.put('/:id/development-plans/:planId', SkillsController.updatePlan);
router.delete('/:id/development-plans/:planId', SkillsController.deletePlan);
// Evaluations
router.get('/:id/skill-evaluations', SkillsController.listEvaluations);
router.post('/:id/skill-evaluations', SkillsController.createEvaluation);
router.put('/:id/skill-evaluations/:evaluationId', SkillsController.updateEvaluation);
router.delete('/:id/skill-evaluations/:evaluationId', SkillsController.deleteEvaluation);
// Summary
router.get('/:id/skills/summary', SkillsController.summary);

// 4. Crear nueva solicitud
router.post('/:id/vacations/requests', 
  validateRequiredFields(['startDate', 'endDate', 'type', 'reason']),
  VacationController.createRequest
);

// 5. Actualizar solicitud (solo pending)
router.put('/:id/vacations/requests/:requestId', VacationController.updateRequest);

// 6. Eliminar solicitud (solo pending)
router.delete('/:id/vacations/requests/:requestId', VacationController.deleteRequest);

// 7. Aprobar solicitud
router.put('/:id/vacations/requests/:requestId/approve', VacationController.approveRequest);

// 8. Rechazar solicitud
router.put('/:id/vacations/requests/:requestId/reject', 
  validateRequiredFields(['reason']),
  VacationController.rejectRequest
);

// 9. Cancelar solicitud
router.put('/:id/vacations/requests/:requestId/cancel', VacationController.cancelRequest);

// 10. Obtener política
router.get('/:id/vacations/policy', VacationController.getPolicy);

// 11. Obtener historial
router.get('/:id/vacations/history', VacationController.getHistory);

// 12. Obtener resumen estadístico
router.get('/:id/vacations/summary', VacationController.getSummary);

// 13. Calcular días entre fechas
router.post('/:id/vacations/calculate-days', 
  validateRequiredFields(['startDate', 'endDate']),
  VacationController.calculateDays
);

// 14. Verificar disponibilidad de fechas
router.post('/:id/vacations/check-availability',
  validateRequiredFields(['startDate', 'endDate']),
  VacationController.checkAvailability
);

// 16. Exportar reporte
router.get('/:id/vacations/export', VacationController.exportReport);

// 17. Obtener calendario
router.get('/:id/vacations/calendar', VacationController.getCalendar);

/**
 * RUTAS DE ARCHIVOS ADJUNTOS PARA VACACIONES
 * NOTA: Las rutas de adjuntos están en /api/vacations/attachments (archivo separado)
 * No es necesario duplicarlas aquí
 */

/**
 * RUTAS DE INCIDENTES - Alineadas 100% con Frontend
 * Endpoints exactos según especificaciones del modal
 */

// 1. Obtener todos los incidentes del empleado
router.get('/:id/incidents', IncidentController.getByEmployee);

// 10. Obtener resumen estadístico (ANTES de :incidentId)
router.get('/:id/incidents/summary', IncidentController.getSummary);

// 12. Exportar incidentes (ANTES de :incidentId)
router.get('/:id/incidents/export', IncidentController.export);

// 2. Obtener incidente específico (DESPUÉS de rutas específicas)
router.get('/:id/incidents/:incidentId', IncidentController.getById);

// 3. Crear nuevo incidente
router.post('/:id/incidents', 
  validateRequiredFields(['title', 'description', 'type', 'severity', 'date', 'involvedPersons']),
  IncidentController.create
);

// 4. Actualizar incidente
router.put('/:id/incidents/:incidentId', IncidentController.update);

// 5. Eliminar incidente
router.delete('/:id/incidents/:incidentId', IncidentController.delete);

// 6. Aprobar incidente
router.put('/:id/incidents/:incidentId/approve', IncidentController.approve);

// 7. Rechazar incidente
router.put('/:id/incidents/:incidentId/reject', 
  validateRequiredFields(['comments']),
  IncidentController.reject
);

// 8. Cerrar incidente
router.put('/:id/incidents/:incidentId/close', 
  validateRequiredFields(['resolution']),
  IncidentController.close
);

// 9. Marcar costo como pagado
router.put('/:id/incidents/:incidentId/mark-paid', IncidentController.markPaid);


// 13. Generar reporte específico
router.get('/:id/incidents/:incidentId/report/:type', IncidentController.generateReport);

/**
 * RUTAS DE ARCHIVOS ADJUNTOS PARA INCIDENTES
 * NOTA: Las rutas de adjuntos están en /api/incidents/attachments (archivo separado)
 * No es necesario duplicarlas aquí
 */

/**
 * RUTAS DE ARCHIVOS ADJUNTOS PARA EQUIPOS
 * NOTA: Las rutas de adjuntos están en /api/equipment/attachments (archivo separado)
 * No es necesario duplicarlas aquí
 */

/**
 * RUTAS DE DOCUMENTOS
 * Estas rutas se implementarán en el siguiente controlador
 */

// Las rutas de documentos están implementadas en src/routes/employee-documents.js
// y se registran en src/config/routes.js como /api/employees

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
 * (implementadas arriba con SkillsController)
 */

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
