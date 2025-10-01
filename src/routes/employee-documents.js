/**
 * 📄 RUTAS DE DOCUMENTOS DE EMPLEADO
 * 
 * Configura todas las rutas para el módulo de documentos de empleados
 * con middleware de autenticación, autorización y validación.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const express = require('express');
const router = express.Router();

// Middleware de autenticación
const { authMiddleware, requireRole } = require('../middleware/auth');

// Middleware de autorización HR
const { checkHRPermission } = require('../middleware/hrAuthorization');

// Controlador
const EmployeeDocumentController = require('../controllers/EmployeeDocumentController');

// Middleware de validación
const { validateEmployeeId, validateDocumentId } = require('../middleware/validation');

/**
 * 🔐 MIDDLEWARE DE AUTENTICACIÓN
 * Todas las rutas requieren autenticación
 */
router.use(authMiddleware);

/**
 * 📋 RUTAS DE DOCUMENTOS POR EMPLEADO
 * Prefijo: /api/employee-documents
 */

/**
 * GET /api/employee-documents/:employeeId
 * Lista documentos de un empleado con filtros y paginación
 * 
 * Permisos: HR read + acceso al empleado
 */
router.get('/:employeeId',
  validateEmployeeId,
  checkHRPermission('documents', 'read'),
  EmployeeDocumentController.listDocuments
);

/**
 * POST /api/employee-documents/:employeeId
 * Sube un documento para un empleado
 * 
 * Permisos: HR write + acceso al empleado
 */
router.post('/:employeeId',
  validateEmployeeId,
  checkHRPermission('documents', 'create'),
  EmployeeDocumentController.uploadMiddleware,
  EmployeeDocumentController.uploadDocument
);

/**
 * GET /api/employee-documents/:employeeId/summary
 * Obtiene resumen de documentos de un empleado
 * 
 * Permisos: HR read + acceso al empleado
 */
router.get('/:employeeId/summary',
  validateEmployeeId,
  checkHRPermission('documents', 'read'),
  EmployeeDocumentController.getDocumentsSummary
);

/**
 * GET /api/employee-documents/:employeeId/:documentId/download
 * Descarga un documento
 * 
 * Permisos: HR read + acceso al empleado + permisos de confidencialidad
 */
router.get('/:employeeId/:documentId/download',
  validateEmployeeId,
  validateDocumentId,
  checkHRPermission('documents', 'read'),
  EmployeeDocumentController.downloadDocument
);

/**
 * PUT /api/employee-documents/:employeeId/:documentId
 * Actualiza metadatos de un documento
 * 
 * Permisos: HR write + acceso al empleado
 */
router.put('/:employeeId/:documentId',
  validateEmployeeId,
  validateDocumentId,
  checkHRPermission('documents', 'update'),
  EmployeeDocumentController.updateDocument
);

/**
 * DELETE /api/employee-documents/:employeeId/:documentId
 * Elimina un documento
 * 
 * Permisos: HR write + acceso al empleado
 */
router.delete('/:employeeId/:documentId',
  validateEmployeeId,
  validateDocumentId,
  checkHRPermission('documents', 'delete'),
  EmployeeDocumentController.deleteDocument
);

/**
 * 📊 RUTAS GLOBALES DE DOCUMENTOS
 */

/**
 * GET /api/employees/documents/stats
 * Obtiene estadísticas globales de documentos
 * 
 * Permisos: HR admin o manager
 */
router.get('/documents/stats',
  requireRole(['admin', 'hr_admin', 'hr_manager']),
  EmployeeDocumentController.getGlobalStats
);

/**
 * GET /api/employees/documents/expiring
 * Obtiene documentos que expiran pronto
 * 
 * Permisos: HR admin o manager
 */
router.get('/documents/expiring',
  requireRole(['admin', 'hr_admin', 'hr_manager']),
  EmployeeDocumentController.getExpiringDocuments
);

module.exports = router;
