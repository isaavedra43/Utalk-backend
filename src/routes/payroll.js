const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const PayrollController = require('../controllers/PayrollController');

/**
 * Rutas de Nómina - Endpoints para gestión de nóminas
 * Todas las rutas requieren autenticación
 */

// ================================
// CONFIGURACIÓN DE NÓMINA
// ================================

/**
 * Configurar nómina para un empleado
 * POST /api/payroll/config/:employeeId
 * Requiere: admin, superadmin
 */
router.post('/config/:employeeId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  PayrollController.configurePayroll
);

/**
 * Obtener configuración de nómina de un empleado
 * GET /api/payroll/config/:employeeId
 * Requiere: autenticación
 */
router.get('/config/:employeeId', 
  authMiddleware, 
  PayrollController.getPayrollConfig
);

/**
 * Actualizar configuración de nómina
 * PUT /api/payroll/config/:employeeId
 * Requiere: admin, superadmin
 */
router.put('/config/:employeeId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  PayrollController.updatePayrollConfig
);

// ================================
// GENERACIÓN DE NÓMINA
// ================================

/**
 * Generar nómina para un empleado
 * POST /api/payroll/generate/:employeeId
 * Body: { periodDate?, forceRegenerate? }
 * Requiere: admin, superadmin
 */
router.post('/generate/:employeeId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  PayrollController.generatePayroll
);

/**
 * Generar múltiples nóminas automáticamente
 * POST /api/payroll/auto-generate
 * Body: { frequency?, employeeIds? }
 * Requiere: admin, superadmin
 */
router.post('/auto-generate', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  PayrollController.autoGeneratePayrolls
);

// ================================
// CONSULTA DE PERÍODOS
// ================================

/**
 * Obtener períodos de nómina de un empleado
 * GET /api/payroll/periods/:employeeId
 * Query: limit?, year?, month?, status?
 * Requiere: autenticación
 */
router.get('/periods/:employeeId', 
  authMiddleware, 
  PayrollController.getPayrollPeriods
);

/**
 * Obtener detalles de un período específico
 * GET /api/payroll/period/:payrollId/details
 * Requiere: autenticación
 */
router.get('/period/:payrollId/details', 
  authMiddleware, 
  PayrollController.getPayrollDetails
);

/**
 * Obtener períodos pendientes de pago
 * GET /api/payroll/pending
 * Query: limit?
 * Requiere: admin, superadmin, agent
 */
router.get('/pending', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'agent']), 
  PayrollController.getPendingPayments
);

// ================================
// GESTIÓN DE ESTADOS
// ================================

/**
 * Aprobar período de nómina
 * PUT /api/payroll/approve/:payrollId
 * Requiere: admin, superadmin
 */
router.put('/approve/:payrollId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  PayrollController.approvePayroll
);

/**
 * Marcar período como pagado
 * PUT /api/payroll/pay/:payrollId
 * Body: { paymentDate? }
 * Requiere: admin, superadmin
 */
router.put('/pay/:payrollId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  PayrollController.markAsPaid
);

/**
 * Cancelar período de nómina
 * PUT /api/payroll/cancel/:payrollId
 * Body: { reason? }
 * Requiere: admin, superadmin
 */
router.put('/cancel/:payrollId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  PayrollController.cancelPayroll
);

/**
 * Eliminar período de nómina
 * DELETE /api/payroll/period/:payrollId
 * Requiere: admin, superadmin
 */
router.delete('/period/:payrollId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  PayrollController.deletePayroll
);

// ================================
// ESTADÍSTICAS Y REPORTES
// ================================

/**
 * Obtener estadísticas de nómina
 * GET /api/payroll/stats
 * Query: year?, month?, employeeId?
 * Requiere: admin, superadmin, agent
 */
router.get('/stats', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'agent']), 
  PayrollController.getPayrollStats
);

// ================================
// RUTAS ADICIONALES PARA FUTURAS FUNCIONALIDADES
// ================================

/**
 * Generar PDF de recibo de nómina
 * GET /api/payroll/pdf/:payrollId
 * Requiere: autenticación
 * TODO: Implementar generación de PDF
 */
router.get('/pdf/:payrollId', 
  authMiddleware, 
  (req, res) => {
    res.status(501).json({
      success: false,
      error: 'Funcionalidad de PDF no implementada aún',
      message: 'Esta funcionalidad estará disponible en una próxima versión'
    });
  }
);

/**
 * Exportar nóminas a Excel
 * GET /api/payroll/export
 * Query: employeeId?, year?, month?, format?
 * Requiere: admin, superadmin
 * TODO: Implementar exportación a Excel
 */
router.get('/export', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  (req, res) => {
    res.status(501).json({
      success: false,
      error: 'Funcionalidad de exportación no implementada aún',
      message: 'Esta funcionalidad estará disponible en una próxima versión'
    });
  }
);

/**
 * Enviar recibo por email
 * POST /api/payroll/email/:payrollId
 * Body: { email?, message? }
 * Requiere: admin, superadmin
 * TODO: Implementar envío por email
 */
router.post('/email/:payrollId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  (req, res) => {
    res.status(501).json({
      success: false,
      error: 'Funcionalidad de envío por email no implementada aún',
      message: 'Esta funcionalidad estará disponible en una próxima versión'
    });
  }
);

/**
 * Obtener resumen anual de nóminas
 * GET /api/payroll/annual/:employeeId/:year
 * Requiere: autenticación
 * TODO: Implementar resumen anual
 */
router.get('/annual/:employeeId/:year', 
  authMiddleware, 
  (req, res) => {
    res.status(501).json({
      success: false,
      error: 'Funcionalidad de resumen anual no implementada aún',
      message: 'Esta funcionalidad estará disponible en una próxima versión'
    });
  }
);

// ================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ================================

// Middleware para manejar rutas no encontradas en este router
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint de nómina no encontrado',
    message: `La ruta ${req.method} ${req.originalUrl} no existe`,
    availableEndpoints: {
      config: {
        'POST /api/payroll/config/:employeeId': 'Configurar nómina',
        'GET /api/payroll/config/:employeeId': 'Obtener configuración',
        'PUT /api/payroll/config/:employeeId': 'Actualizar configuración'
      },
      generation: {
        'POST /api/payroll/generate/:employeeId': 'Generar nómina',
        'POST /api/payroll/auto-generate': 'Generación automática'
      },
      consultation: {
        'GET /api/payroll/periods/:employeeId': 'Obtener períodos',
        'GET /api/payroll/period/:payrollId/details': 'Obtener detalles',
        'GET /api/payroll/pending': 'Períodos pendientes'
      },
      management: {
        'PUT /api/payroll/approve/:payrollId': 'Aprobar período',
        'PUT /api/payroll/pay/:payrollId': 'Marcar como pagado',
        'PUT /api/payroll/cancel/:payrollId': 'Cancelar período',
        'DELETE /api/payroll/period/:payrollId': 'Eliminar período'
      },
      stats: {
        'GET /api/payroll/stats': 'Obtener estadísticas'
      },
      advanced: {
        'POST /api/payroll/generate-advanced/:employeeId': 'Generar nómina avanzada',
        'POST /api/payroll/preview/:employeeId': 'Vista previa de nómina',
        'GET /api/payroll/:payrollId/summary-with-extras': 'Resumen con extras',
        'GET /api/payroll/extras-impact/:employeeId': 'Impacto de extras',
        'GET /api/payroll/check-duplicates/:employeeId': 'Verificar duplicados',
        'PUT /api/payroll/mark-movements-applied': 'Marcar movimientos aplicados'
      }
    }
  });
});

// ================================
// 🆕 FUNCIONALIDADES AVANZADAS
// ================================

/**
 * 🆕 Generar nómina avanzada con impuestos opcionales e integración de extras
 * POST /api/payroll/generate-advanced/:employeeId
 * Requiere: admin, superadmin
 */
router.post('/generate-advanced/:employeeId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  PayrollController.generateAdvancedPayroll
);

/**
 * 🆕 Vista previa de nómina sin generar
 * POST /api/payroll/preview/:employeeId
 * Requiere: admin, superadmin, hr
 */
router.post('/preview/:employeeId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'hr']), 
  PayrollController.previewPayroll
);

/**
 * 🆕 Obtener resumen de nómina con análisis de extras
 * GET /api/payroll/:payrollId/summary-with-extras
 * Requiere: autenticación
 */
router.get('/:payrollId/summary-with-extras', 
  authMiddleware, 
  PayrollController.getPayrollSummaryWithExtras
);

/**
 * 🆕 Obtener impacto de extras en nómina para un período
 * GET /api/payroll/extras-impact/:employeeId
 * Requiere: admin, superadmin, hr
 */
router.get('/extras-impact/:employeeId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'hr']), 
  PayrollController.getExtrasImpact
);

/**
 * 🆕 Verificar duplicados en movimientos de extras
 * GET /api/payroll/check-duplicates/:employeeId
 * Requiere: admin, superadmin, hr
 */
router.get('/check-duplicates/:employeeId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'hr']), 
  PayrollController.checkDuplicates
);

/**
 * 🆕 Marcar movimientos como aplicados manualmente
 * PUT /api/payroll/mark-movements-applied
 * Requiere: admin, superadmin
 */
router.put('/mark-movements-applied', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  PayrollController.markMovementsAsApplied
);

module.exports = router;
