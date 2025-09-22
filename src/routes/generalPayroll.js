const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const GeneralPayrollController = require('../controllers/GeneralPayrollController');

/**
 * Rutas de Nómina General - Endpoints para gestión masiva de nóminas
 * Todas las rutas requieren autenticación y roles específicos
 */

// ================================
// GESTIÓN PRINCIPAL
// ================================

/**
 * Crear nueva nómina general
 * POST /api/payroll/general
 * Body: { startDate, endDate, frequency, includeEmployees }
 * Requiere: admin, superadmin
 */
router.post('/', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  GeneralPayrollController.createGeneralPayroll
);

/**
 * Obtener lista de nóminas generales
 * GET /api/payroll/general
 * Query: ?limit=10&offset=0&status=all&year=2024
 * Requiere: admin, superadmin, agent
 */
router.get('/', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'agent']), 
  GeneralPayrollController.getGeneralPayrolls
);

/**
 * Obtener nómina general específica
 * GET /api/payroll/general/:id
 * Requiere: admin, superadmin, agent
 */
router.get('/:id', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'agent']), 
  GeneralPayrollController.getGeneralPayrollById
);

/**
 * Simular cálculos de nómina general
 * POST /api/payroll/general/:id/simulate
 * Requiere: admin, superadmin
 */
router.post('/:id/simulate', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  GeneralPayrollController.simulateGeneralPayroll
);

/**
 * Aprobar nómina general
 * POST /api/payroll/general/:id/approve
 * Requiere: admin, superadmin
 */
router.post('/:id/approve', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  GeneralPayrollController.approveGeneralPayroll
);

/**
 * Cerrar nómina general y generar individuales
 * POST /api/payroll/general/:id/close
 * Requiere: admin, superadmin
 */
router.post('/:id/close', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  GeneralPayrollController.closeGeneralPayroll
);

// ================================
// GESTIÓN DE EMPLEADOS
// ================================

/**
 * Obtener empleados disponibles para nómina general
 * GET /api/payroll/general/available-employees
 * Query: ?startDate=2024-01-01&endDate=2024-01-07
 * Requiere: admin, superadmin, agent
 */
router.get('/available-employees', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'agent']), 
  GeneralPayrollController.getAvailableEmployees
);

/**
 * Aplicar ajuste a empleado específico
 * PUT /api/payroll/general/:id/employee/:employeeId/adjust
 * Body: { type, concept, amount, reason }
 * Requiere: admin, superadmin
 */
router.put('/:id/employee/:employeeId/adjust', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  GeneralPayrollController.applyEmployeeAdjustment
);

/**
 * Aprobar empleado específico
 * POST /api/payroll/general/:id/employee/:employeeId/approve
 * Requiere: admin, superadmin
 */
router.post('/:id/employee/:employeeId/approve', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  GeneralPayrollController.approveEmployee
);

/**
 * Marcar empleado como pagado
 * POST /api/payroll/general/:id/employee/:employeeId/mark-paid
 * Body: { paymentMethod }
 * Requiere: admin, superadmin
 */
router.post('/:id/employee/:employeeId/mark-paid', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  GeneralPayrollController.markEmployeeAsPaid
);

// ================================
// ENDPOINTS ESPECÍFICOS PARA FRONTEND
// ================================

/**
 * Obtener datos para vista de ajustes y aprobación
 * GET /api/payroll/general/:id/approval
 * Requiere: admin, superadmin, agent
 */
router.get('/:id/approval', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'agent']), 
  GeneralPayrollController.getApprovalData
);

/**
 * Obtener nóminas individuales generadas desde una general
 * GET /api/payroll/general/:id/individual-payrolls
 * Requiere: admin, superadmin, agent
 */
router.get('/:id/individual-payrolls', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'agent']), 
  GeneralPayrollController.getIndividualPayrolls
);

/**
 * Obtener estadísticas generales de nómina para dashboard
 * GET /api/payroll/general/stats
 * Requiere: admin, superadmin
 */
router.get('/stats', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  GeneralPayrollController.getDashboardStats
);

/**
 * Obtener estadísticas de nómina general específica
 * GET /api/payroll/general/:id/stats
 * Requiere: admin, superadmin, agent
 */
router.get('/:id/stats', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'agent']), 
  GeneralPayrollController.getGeneralPayrollStats
);

// ================================
// RUTAS DE INTEGRACIÓN (Para futuro)
// ================================

/**
 * Exportar nómina general
 * GET /api/payroll/general/:id/export
 * Query: ?format=excel|pdf
 * Requiere: admin, superadmin
 * TODO: Implementar exportación
 */
router.get('/:id/export', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  (req, res) => {
    res.status(501).json({
      success: false,
      error: 'Funcionalidad de exportación no implementada aún',
      message: 'Esta funcionalidad estará disponible en una futura actualización'
    });
  }
);

/**
 * Obtener comprobantes de empleados
 * GET /api/payroll/general/:id/vouchers
 * Requiere: admin, superadmin
 * TODO: Implementar generación de comprobantes masivos
 */
router.get('/:id/vouchers', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  (req, res) => {
    res.status(501).json({
      success: false,
      error: 'Funcionalidad de comprobantes no implementada aún',
      message: 'Esta funcionalidad estará disponible en una futura actualización'
    });
  }
);

/**
 * Descargar comprobantes masivos
 * GET /api/payroll/general/:id/vouchers/download
 * Requiere: admin, superadmin
 * TODO: Implementar descarga masiva de comprobantes
 */
router.get('/:id/vouchers/download', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  (req, res) => {
    res.status(501).json({
      success: false,
      error: 'Funcionalidad de descarga masiva no implementada aún',
      message: 'Esta funcionalidad estará disponible en una futura actualización'
    });
  }
);

module.exports = router;
