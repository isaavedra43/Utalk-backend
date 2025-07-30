const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const MediaUploadController = require('../controllers/MediaUploadController');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/media/upload
 * @desc Subir archivo multimedia a Firebase Storage
 * @access Private - Requiere autenticación
 */
router.post('/upload', 
  authMiddleware,
  MediaUploadController.getUploadRateLimit(),
  MediaUploadController.getMulterConfig().single('file'),
  MediaUploadController.uploadMedia
);

/**
 * GET /api/media/file/:fileId
 * @desc Obtener información de un archivo
 * @access Private
 */
router.get('/file/:fileId', 
  authMiddleware,
  MediaUploadController.getFileInfo
);

/**
 * DELETE /api/media/file/:fileId
 * @desc Eliminar archivo de Firebase Storage
 * @access Private
 */
router.delete('/file/:fileId',
  authMiddleware, 
  MediaUploadController.deleteFile
);

/**
 * @route GET /media/:category/:filename
 * @desc Redirigir a Firebase Storage (LEGACY - solo para compatibilidad)
 * @access Private
 */
router.get('/:category/:filename', authMiddleware, async (req, res) => {
  try {
    const { category, filename } = req.params;

    // Validar categoría
    const allowedCategories = ['images', 'videos', 'audio', 'documents'];
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        error: 'Categoría inválida',
        message: 'Categoría de archivo no permitida',
      });
    }

    // Validar nombre de archivo
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({
        error: 'Nombre de archivo inválido',
        message: 'El nombre de archivo contiene caracteres no permitidos',
      });
    }

    logger.warn('Acceso a ruta legacy de media - migrar a Firebase Storage URLs', {
      userEmail: req.user.email,
      category,
      filename,
      path: req.originalUrl
    });

    return res.status(410).json({
      error: 'Endpoint obsoleto',
      message: 'Esta ruta ha sido migrada a Firebase Storage. Use /api/media/upload para subir archivos y las URLs firmadas para acceder a ellos.',
      migration: {
        upload: '/api/media/upload',
        info: '/api/media/file/:fileId'
      }
    });
  } catch (error) {
    logger.error('Error en ruta legacy de media:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

module.exports = router;
