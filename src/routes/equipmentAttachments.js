const express = require('express');
const router = express.Router();
const EquipmentAttachmentController = require('../controllers/EquipmentAttachmentController');
const { authMiddleware } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

/**
 * 🔧 RUTAS DE ARCHIVOS ADJUNTOS DE EQUIPOS
 * 
 * Endpoints para gestión de archivos de equipos
 * Alineado 100% con especificaciones del Frontend
 * 
 * @version 1.0.0
 * @author Backend Team
 */

// Configurar multer para subida de archivos
const upload = EquipmentAttachmentController.getUploadConfig();

// 1. Subir archivos adjuntos
router.post('/upload', upload.array('files'), EquipmentAttachmentController.uploadAttachments);

// 2. Obtener información de archivo adjunto
router.get('/:attachmentId', EquipmentAttachmentController.getAttachment);

// 3. Eliminar archivo adjunto
router.delete('/:attachmentId', EquipmentAttachmentController.deleteAttachment);

// 4. Descargar archivo adjunto
router.get('/:attachmentId/download', EquipmentAttachmentController.downloadAttachment);

// 5. Obtener vista previa de archivo
router.get('/:attachmentId/preview', EquipmentAttachmentController.previewAttachment);

// 6. Obtener configuración de subida
router.get('/config/upload', EquipmentAttachmentController.getUploadConfig);

module.exports = router;
