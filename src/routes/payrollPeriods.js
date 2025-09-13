const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const PayrollPeriodController = require('../controllers/PayrollPeriodController');

/**
 * Rutas para gestión de períodos de nómina masiva
 * Todas las rutas requieren autenticación
 */

// ================================
// GESTIÓN DE PERÍODOS
// ================================

/**
 * Crear nuevo período de nómina
 * POST /api/payroll-periods
 * Requiere: admin, superadmin, hr
 */
router.post('/', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'hr']),
  PayrollPeriodController.createPeriod
);

/**
 * Obtener todos los períodos de nómina
 * GET /api/payroll-periods?status=all&frequency=monthly&page=1&limit=10
 * Requiere: autenticación
 */
router.get('/', 
  authMiddleware,
  PayrollPeriodController.getPeriods
);

/**
 * Obtener período actual activo
 * GET /api/payroll-periods/current
 * Requiere: autenticación
 */
router.get('/current', 
  authMiddleware,
  PayrollPeriodController.getCurrentPeriod
);

/**
 * Obtener estadísticas de períodos
 * GET /api/payroll-periods/stats
 * Requiere: admin, superadmin, hr
 */
router.get('/stats', 
  authMiddleware,
  requireRole(['admin', 'superadmin', 'hr']),
  PayrollPeriodController.getPeriodStats
);

/**
 * Obtener información de tablas fiscales
 * GET /api/payroll-periods/tax-info
 * Requiere: autenticación
 */
router.get('/tax-info', 
  authMiddleware,
  PayrollPeriodController.getTaxInfo
);

/**
 * Validar fechas de período
 * POST /api/payroll-periods/validate-dates
 * Requiere: admin, superadmin, hr
 */
router.post('/validate-dates', 
  authMiddleware,
  requireRole(['admin', 'superadmin', 'hr']),
  PayrollPeriodController.validatePeriodDates
);

/**
 * Obtener período específico por ID
 * GET /api/payroll-periods/:periodId
 * Requiere: autenticación
 */
router.get('/:periodId', 
  authMiddleware,
  PayrollPeriodController.getPeriodById
);

/**
 * Eliminar período (solo si está en borrador)
 * DELETE /api/payroll-periods/:periodId
 * Requiere: admin, superadmin
 */
router.delete('/:periodId', 
  authMiddleware,
  requireRole(['admin', 'superadmin']),
  PayrollPeriodController.deletePeriod
);

// ================================
// PROCESAMIENTO DE NÓMINA
// ================================

/**
 * Procesar nómina masiva para un período
 * POST /api/payroll-periods/:periodId/process
 * Requiere: admin, superadmin, hr
 */
router.post('/:periodId/process', 
  authMiddleware,
  requireRole(['admin', 'superadmin', 'hr']),
  PayrollPeriodController.processPeriod
);

/**
 * Obtener empleados de un período con sus nóminas
 * GET /api/payroll-periods/:periodId/employees?page=1&limit=50&search=juan&department=IT&status=pending
 * Requiere: autenticación
 */
router.get('/:periodId/employees', 
  authMiddleware,
  PayrollPeriodController.getPeriodEmployees
);

// ================================
// GESTIÓN DE ESTADOS
// ================================

/**
 * Aprobar período completo
 * PUT /api/payroll-periods/:periodId/approve
 * Requiere: admin, superadmin, hr
 */
router.put('/:periodId/approve', 
  authMiddleware,
  requireRole(['admin', 'superadmin', 'hr']),
  PayrollPeriodController.approvePeriod
);

/**
 * Marcar período como pagado
 * PUT /api/payroll-periods/:periodId/mark-paid
 * Requiere: admin, superadmin, hr
 */
router.put('/:periodId/mark-paid', 
  authMiddleware,
  requireRole(['admin', 'superadmin', 'hr']),
  PayrollPeriodController.markPeriodAsPaid
);

/**
 * Cerrar período
 * PUT /api/payroll-periods/:periodId/close
 * Requiere: admin, superadmin
 */
router.put('/:periodId/close', 
  authMiddleware,
  requireRole(['admin', 'superadmin']),
  PayrollPeriodController.closePeriod
);

// ================================
// INFORMACIÓN DE ENDPOINTS
// ================================

/**
 * Información de endpoints disponibles
 * GET /api/payroll-periods/info
 */
router.get('/info', (req, res) => {
  res.json({
    message: 'API de Períodos de Nómina - Endpoints disponibles',
    version: '1.0.0',
    endpoints: {
      periods: {
        'POST /api/payroll-periods': 'Crear período de nómina',
        'GET /api/payroll-periods': 'Obtener todos los períodos',
        'GET /api/payroll-periods/current': 'Obtener período actual',
        'GET /api/payroll-periods/:periodId': 'Obtener período específico',
        'DELETE /api/payroll-periods/:periodId': 'Eliminar período'
      },
      processing: {
        'POST /api/payroll-periods/:periodId/process': 'Procesar nómina masiva',
        'GET /api/payroll-periods/:periodId/employees': 'Obtener empleados del período'
      },
      management: {
        'PUT /api/payroll-periods/:periodId/approve': 'Aprobar período',
        'PUT /api/payroll-periods/:periodId/mark-paid': 'Marcar como pagado',
        'PUT /api/payroll-periods/:periodId/close': 'Cerrar período'
      },
      utilities: {
        'GET /api/payroll-periods/stats': 'Obtener estadísticas',
        'GET /api/payroll-periods/tax-info': 'Información fiscal',
        'POST /api/payroll-periods/validate-dates': 'Validar fechas'
      }
    },
    states: {
      flow: 'draft → calculated → approved → paid → closed',
      descriptions: {
        draft: 'Período creado, listo para procesar',
        calculated: 'Nómina calculada para todos los empleados',
        approved: 'Nómina revisada y aprobada',
        paid: 'Nómina procesada y pagada',
        closed: 'Período finalizado y archivado'
      }
    },
    frequencies: ['weekly', 'biweekly', 'monthly'],
    configurations: {
      calculateTaxes: 'boolean - Calcular impuestos automáticamente',
      includeOvertime: 'boolean - Incluir horas extras',
      applyAbsenceDeductions: 'boolean - Aplicar deducciones por faltas',
      includeLoans: 'boolean - Incluir préstamos y adelantos'
    }
  });
});

module.exports = router;
