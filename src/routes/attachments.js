const express = require('express');
const router = express.Router();
const AttachmentsController = require('../controllers/AttachmentsController');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

/**
 * RUTAS DE ARCHIVOS ADJUNTOS
 */

// Subir archivos adjuntos
router.post('/', 
  requireRole(['admin', 'superadmin', 'agent']),
  AttachmentsController.getMulterConfig().array('files', 5),
  AttachmentsController.uploadFiles
);

// Obtener archivos de un empleado
router.get('/employee/:id', 
  requireRole(['admin', 'superadmin', 'agent']),
  AttachmentsController.getEmployeeAttachments
);

// Descargar archivo específico
router.get('/:id/download', 
  requireRole(['admin', 'superadmin', 'agent']),
  AttachmentsController.downloadFile
);

// Eliminar archivo
router.delete('/:id', 
  requireRole(['admin', 'superadmin']),
  AttachmentsController.deleteFile
);

// Obtener estadísticas de archivos
router.get('/stats', 
  requireRole(['admin', 'superadmin']),
  AttachmentsController.getStats
);

module.exports = router;
