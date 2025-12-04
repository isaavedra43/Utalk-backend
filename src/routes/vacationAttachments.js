const express = require('express');
const router = express.Router();

// Controlador
const VacationAttachmentController = require('../controllers/VacationAttachmentController');

// Middleware
const { authMiddleware } = require('../middleware/auth');

// Aplicar middleware de autenticación
router.use(authMiddleware);

/**
 * RUTAS DE ADJUNTOS DE VACACIONES
 * Rutas directas en /api/vacations/attachments
 */

// POST /api/vacations/attachments - Subir archivos adjuntos
router.post('/', VacationAttachmentController.uploadAttachments);

// GET /api/vacations/attachments/:attachmentId - Obtener información de archivo
router.get('/:attachmentId', VacationAttachmentController.getAttachment);

// DELETE /api/vacations/attachments/:attachmentId - Eliminar archivo
router.delete('/:attachmentId', VacationAttachmentController.deleteAttachment);

module.exports = router;
