const express = require('express');
const router = express.Router();
const AttachmentsController = require('../controllers/AttachmentsController');
const authMiddleware = require('../middleware/authMiddleware');
const hrAuthorization = require('../middleware/hrAuthorization');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

/**
 * RUTAS DE ARCHIVOS ADJUNTOS
 */

// Subir archivos adjuntos
router.post('/', 
  hrAuthorization(['HR_ADMIN', 'HR_MANAGER', 'SUPERVISOR']),
  AttachmentsController.getMulterConfig().array('files', 5),
  AttachmentsController.uploadFiles
);

// Obtener archivos de un empleado
router.get('/employee/:id', 
  hrAuthorization(['HR_ADMIN', 'HR_MANAGER', 'SUPERVISOR']),
  AttachmentsController.getEmployeeAttachments
);

// Descargar archivo específico
router.get('/:id/download', 
  hrAuthorization(['HR_ADMIN', 'HR_MANAGER', 'SUPERVISOR']),
  AttachmentsController.downloadFile
);

// Eliminar archivo
router.delete('/:id', 
  hrAuthorization(['HR_ADMIN', 'HR_MANAGER']),
  AttachmentsController.deleteFile
);

// Obtener estadísticas de archivos
router.get('/stats', 
  hrAuthorization(['HR_ADMIN', 'HR_MANAGER']),
  AttachmentsController.getStats
);

module.exports = router;
