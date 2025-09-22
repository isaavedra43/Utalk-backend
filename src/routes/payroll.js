const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const PayrollController = require('../controllers/PayrollController');
const AttachmentService = require('../services/AttachmentService');

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
 * Generar primer período de nómina
 * POST /api/payroll/generate-first/:employeeId
 * Requiere: admin, superadmin
 */
router.post('/generate-first/:employeeId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  PayrollController.generateFirstPayroll
);

/**
 * Regenerar nómina incluyendo extras pendientes
 * POST /api/payroll/regenerate-with-extras/:payrollId
 * Requiere: admin, superadmin
 */
router.post('/regenerate-with-extras/:payrollId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  PayrollController.regeneratePayrollWithExtras
);

/**
 * Regenerar nómina sin impuestos automáticos
 * POST /api/payroll/regenerate/:payrollId
 * Requiere: admin, superadmin
 */
router.post('/regenerate/:payrollId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  PayrollController.regeneratePayrollWithoutTaxes
);

// ================================
// ARCHIVOS ADJUNTOS
// ================================

/**
 * Subir archivo adjunto a nómina
 * POST /api/payroll/:payrollId/attachments
 * Requiere: admin, superadmin, hr
 */
router.post('/:payrollId/attachments', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'hr']),
  AttachmentService.getUploadMiddleware(),
  AttachmentService.handleUploadError,
  PayrollController.uploadAttachment
);

/**
 * Obtener archivos adjuntos de nómina
 * GET /api/payroll/:payrollId/attachments
 * Requiere: autenticación
 */
router.get('/:payrollId/attachments', 
  authMiddleware, 
  PayrollController.getAttachments
);

/**
 * Eliminar archivo adjunto
 * DELETE /api/payroll/:payrollId/attachments/:attachmentId
 * Requiere: admin, superadmin, hr
 */
router.delete('/:payrollId/attachments/:attachmentId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'hr']),
  PayrollController.deleteAttachment
);

// ================================
// EDICIÓN Y REGENERACIÓN
// ================================

/**
 * Editar configuración de nómina
 * PUT /api/payroll/:payrollId
 * Requiere: admin, superadmin, hr
 */
router.put('/:payrollId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'hr']),
  PayrollController.editPayroll
);

/**
 * Regenerar nómina con recálculos
 * POST /api/payroll/:payrollId/regenerate
 * Requiere: admin, superadmin, hr
 */
router.post('/:payrollId/regenerate', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'hr']),
  PayrollController.regeneratePayroll
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

/**
 * Verificar extras pendientes para un empleado
 * GET /api/payroll/extras-pending/:employeeId
 * Query: periodStart?, periodEnd?
 * Requiere: autenticación
 */
router.get('/extras-pending/:employeeId', 
  authMiddleware, 
  PayrollController.getPendingExtras
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
 */
router.get('/pdf/:payrollId', 
  authMiddleware, 
  PayrollController.generatePayrollPDF
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
        'POST /api/payroll/generate/:employeeId': 'Generar nómina'
      },
      consultation: {
        'GET /api/payroll/periods/:employeeId': 'Obtener períodos',
        'GET /api/payroll/period/:payrollId/details': 'Obtener detalles',
        'GET /api/payroll/pending': 'Períodos pendientes',
        'GET /api/payroll/extras-pending/:employeeId': 'Verificar extras pendientes'
      },
      attachments: {
        'POST /api/payroll/:payrollId/attachments': 'Subir archivo adjunto',
        'GET /api/payroll/:payrollId/attachments': 'Obtener archivos adjuntos',
        'DELETE /api/payroll/:payrollId/attachments/:attachmentId': 'Eliminar archivo adjunto'
      },
      management: {
        'PUT /api/payroll/:payrollId': 'Editar configuración de nómina',
        'POST /api/payroll/:payrollId/regenerate': 'Regenerar nómina',
        'PUT /api/payroll/approve/:payrollId': 'Aprobar período',
        'PUT /api/payroll/pay/:payrollId': 'Marcar como pagado',
        'PUT /api/payroll/cancel/:payrollId': 'Cancelar período',
        'DELETE /api/payroll/period/:payrollId': 'Eliminar período'
      },
      stats: {
        'GET /api/payroll/stats': 'Obtener estadísticas'
      }
    }
  });
});

module.exports = router;
