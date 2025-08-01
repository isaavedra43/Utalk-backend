const express = require('express');
const router = express.Router();
const MediaUploadController = require('../controllers/MediaUploadController');
const { validateRequest } = require('../middleware/validation');
const Joi = require('joi');

// Validadores específicos para media
const mediaValidators = {
  validateUpload: validateRequest({
    body: Joi.object({
      conversationId: Joi.string().uuid().optional(),
      tags: Joi.array().items(Joi.string()).max(10).optional(),
      metadata: Joi.object().optional()
    })
  }),

  validateGetFile: validateRequest({
    params: Joi.object({
      fileId: Joi.string().uuid().required()
    })
  }),

  validateDeleteFile: validateRequest({
    params: Joi.object({
      fileId: Joi.string().uuid().required()
    })
  }),

  validateSearchFiles: validateRequest({
    query: Joi.object({
      q: Joi.string().min(1).max(100).optional(),
      type: Joi.string().valid('image', 'audio', 'video', 'document').optional(),
      tags: Joi.string().optional(),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20)
    })
  })
};

/**
 * @route POST /api/media/upload
 * @desc Subir archivo multimedia con indexación automática
 * @access Private (Agent, Admin)
 */
router.post('/upload',
  authMiddleware,
  requireWriteAccess,
  mediaValidators.validateUpload,
  MediaUploadController.uploadMedia
);

/**
 * @route GET /api/media/file/:fileId
 * @desc Obtener información de archivo (eficiente con indexación)
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/file/:fileId',
  authMiddleware,
  requireReadAccess,
  MediaUploadController.getFileInfo
);

/**
 * @route DELETE /api/media/file/:fileId
 * @desc Eliminar archivo (eficiente con indexación)
 * @access Private (Agent, Admin)
 */
router.delete('/file/:fileId',
  authMiddleware,
  requireWriteAccess,
  MediaUploadController.deleteFile
);

/**
 * @route GET /api/media/file/:fileId/download
 * @desc Descargar archivo
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/file/:fileId/download',
  authMiddleware,
  requireReadAccess,
  MediaUploadController.downloadFile
);

/**
 * @route GET /api/media/conversation/:conversationId
 * @desc Listar archivos por conversación (eficiente con indexación)
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/conversation/:conversationId',
  authMiddleware,
  requireReadAccess,
  MediaUploadController.listFilesByConversation
);

/**
 * @route GET /api/media/user/:userId
 * @desc Listar archivos por usuario (eficiente con indexación)
 * @access Private (Admin, Agent)
 */
router.get('/user/:userId',
  authMiddleware,
  requireReadAccess,
  MediaUploadController.listFilesByUser
);

/**
 * @route GET /api/media/category/:category
 * @desc Listar archivos por categoría (eficiente con indexación)
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/category/:category',
  authMiddleware,
  requireReadAccess,
  MediaUploadController.listFilesByCategory
);

/**
 * @route GET /api/media/search
 * @desc Buscar archivos por texto (eficiente con indexación)
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/search',
  authMiddleware,
  requireReadAccess,
  MediaUploadController.searchFiles
);

/**
 * @route GET /api/media/stats
 * @desc Obtener estadísticas de archivos
 * @access Private (Admin, Agent)
 */
router.get('/stats',
  authMiddleware,
  requireReadAccess,
  MediaUploadController.getFileStats
);

/**
 * @route POST /api/media/file/:fileId/tags
 * @desc Agregar tags a archivo
 * @access Private (Agent, Admin)
 */
router.post('/file/:fileId/tags',
  authMiddleware,
  requireWriteAccess,
  MediaUploadController.addTagsToFile
);

/**
 * @route DELETE /api/media/file/:fileId/tags
 * @desc Remover tags de archivo
 * @access Private (Agent, Admin)
 */
router.delete('/file/:fileId/tags',
  authMiddleware,
  requireWriteAccess,
  MediaUploadController.removeTagsFromFile
);

module.exports = router;
