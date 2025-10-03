const express = require('express');
const router = express.Router();

// Controlador
const IncidentAttachmentController = require('../controllers/IncidentAttachmentController');

// Middleware
const { authMiddleware } = require('../middleware/auth');

// Aplicar middleware de autenticación
router.use(authMiddleware);

/**
 * RUTAS DE ADJUNTOS DE INCIDENTES
 * Rutas directas en /api/incidents/attachments
 */

// POST /api/incidents/attachments - Subir archivos adjuntos
router.post('/', IncidentAttachmentController.uploadAttachments);

// GET /api/incidents/attachments/:attachmentId - Obtener información de archivo
router.get('/:attachmentId', IncidentAttachmentController.getAttachment);

// DELETE /api/incidents/attachments/:attachmentId - Eliminar archivo
router.delete('/:attachmentId', IncidentAttachmentController.deleteAttachment);

// GET /api/incidents/attachments/:attachmentId/download - Descargar archivo
router.get('/:attachmentId/download', IncidentAttachmentController.downloadAttachment);

// GET /api/incidents/attachments/:attachmentId/preview - Vista previa
router.get('/:attachmentId/preview', IncidentAttachmentController.previewAttachment);

module.exports = router;
