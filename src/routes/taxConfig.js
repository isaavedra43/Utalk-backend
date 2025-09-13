const express = require('express');
const router = express.Router();

// Middleware
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/moduleAccess');

// Controladores
const TaxConfigController = require('../controllers/TaxConfigController');

// ================================
// CONFIGURACIONES GLOBALES DE IMPUESTOS
// ================================

/**
 * Obtener configuraciones globales de impuestos
 * GET /api/tax-config/global
 */
router.get('/global', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  TaxConfigController.getGlobalTaxConfigs
);

/**
 * Crear configuración global de impuesto
 * POST /api/tax-config/global
 */
router.post('/global', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  TaxConfigController.createGlobalTaxConfig
);

/**
 * Crear configuraciones por defecto para México
 * POST /api/tax-config/create-defaults
 */
router.post('/create-defaults', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  TaxConfigController.createDefaultTaxes
);

// ================================
// CONFIGURACIONES POR EMPLEADO
// ================================

/**
 * Obtener configuraciones de impuestos por empleado
 * GET /api/tax-config/employee/:employeeId
 */
router.get('/employee/:employeeId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'hr']), 
  TaxConfigController.getEmployeeTaxConfigs
);

/**
 * Crear configuración de impuesto por empleado
 * POST /api/tax-config/employee/:employeeId
 */
router.post('/employee/:employeeId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'hr']), 
  TaxConfigController.createEmployeeTaxConfig
);

/**
 * Obtener configuración efectiva para un empleado
 * GET /api/tax-config/effective/:employeeId
 */
router.get('/effective/:employeeId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'hr']), 
  TaxConfigController.getEffectiveTaxConfig
);

/**
 * Configurar impuestos para un empleado específico
 * PUT /api/tax-config/employee/:employeeId/settings
 */
router.put('/employee/:employeeId/settings', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'hr']), 
  TaxConfigController.configureEmployeeTaxes
);

// ================================
// OPERACIONES GENERALES
// ================================

/**
 * Actualizar configuración de impuesto
 * PUT /api/tax-config/:configId
 */
router.put('/:configId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  TaxConfigController.updateTaxConfig
);

/**
 * Eliminar configuración de impuesto
 * DELETE /api/tax-config/:configId
 */
router.delete('/:configId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin']), 
  TaxConfigController.deleteTaxConfig
);

/**
 * Vista previa de cálculo de impuestos
 * POST /api/tax-config/preview/:employeeId
 */
router.post('/preview/:employeeId', 
  authMiddleware, 
  requireRole(['admin', 'superadmin', 'hr']), 
  TaxConfigController.previewTaxCalculation
);

module.exports = router;
