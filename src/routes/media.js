const express = require('express');
const router = express.Router();
const MediaUploadController = require('../controllers/MediaUploadController');
const { authMiddleware, requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { 
  fileAuthorizationMiddleware, 
  conversationFileAuthorizationMiddleware, 
  fileDeleteAuthorizationMiddleware 
} = require('../middleware/fileAuthorization');
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
  }),

  validateFilesByConversation: validateRequest({
    params: Joi.object({
      conversationId: Joi.string().uuid().required()
    }),
    query: Joi.object({
      limit: Joi.number().integer().min(1).max(100).default(50),
      cursor: Joi.string().optional(),
      type: Joi.string().valid('image', 'audio', 'video', 'document').optional(),
      sortBy: Joi.string().valid('createdAt', 'size', 'name').default('createdAt'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    })
  }),

  validateFilePreview: validateRequest({
    params: Joi.object({
      fileId: Joi.string().uuid().required()
    }),
    query: Joi.object({
      width: Joi.number().integer().min(50).max(1920).optional(),
      height: Joi.number().integer().min(50).max(1080).optional(),
      quality: Joi.number().integer().min(1).max(100).default(80).optional()
    })
  }),

  validateShareFile: validateRequest({
    params: Joi.object({
      fileId: Joi.string().uuid().required()
    }),
    body: Joi.object({
      shareWith: Joi.string().email().optional(),
      permissions: Joi.string().valid('view', 'download', 'edit').default('view'),
      expiresIn: Joi.number().integer().min(3600000).max(2592000000).default(86400000), // 1h - 30d
      password: Joi.string().min(4).max(50).optional(),
      maxDownloads: Joi.number().integer().min(1).max(1000).optional()
    })
  }),

  validateCompressFile: validateRequest({
    params: Joi.object({
      fileId: Joi.string().uuid().required()
    }),
    body: Joi.object({
      quality: Joi.number().integer().min(1).max(100).default(80),
      format: Joi.string().valid('webp', 'jpeg', 'png', 'mp4', 'pdf').optional()
    })
  }),

  validateConvertFile: validateRequest({
    params: Joi.object({
      fileId: Joi.string().uuid().required()
    }),
    body: Joi.object({
      targetFormat: Joi.string().valid('image/webp', 'image/jpeg', 'image/png', 'video/mp4', 'application/pdf').required(),
      quality: Joi.number().integer().min(1).max(100).default(80),
      maintainMetadata: Joi.boolean().default(true)
    })
  })
};

/**
 * @route POST /api/media/upload
 * @desc Subir archivo multimedia (FASE 4 - MEJORADO)
 * @access Private (Agent, Admin)
 */
router.post('/upload',
  authMiddleware,
  requireWriteAccess,
  mediaValidators.validateUpload,
  MediaUploadController.getUploadRateLimit(),
  MediaUploadController.uploadMedia
);

/**
 * @route GET /api/media/file/:fileId
 * @desc Obtener archivo específico (FASE 5 - CON AUTORIZACIÓN)
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/file/:fileId',
  authMiddleware,
  requireReadAccess,
  mediaValidators.validateGetFile,
  fileAuthorizationMiddleware,
  MediaUploadController.getFileInfo
);

/**
 * @route GET /api/media/preview/:fileId
 * @desc Obtener preview de archivo (FASE 5 - CON AUTORIZACIÓN)
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/preview/:fileId',
  authMiddleware,
  requireReadAccess,
  mediaValidators.validateFilePreview,
  fileAuthorizationMiddleware,
  MediaUploadController.getFilePreview
);

/**
 * @route DELETE /api/media/file/:fileId
 * @desc Eliminar archivo (FASE 5 - CON AUTORIZACIÓN)
 * @access Private (Agent, Admin)
 */
router.delete('/file/:fileId',
  authMiddleware,
  requireWriteAccess,
  mediaValidators.validateDeleteFile,
  fileDeleteAuthorizationMiddleware,
  MediaUploadController.deleteFile
);

/**
 * @route POST /api/media/file/:fileId/share
 * @desc Compartir archivo con enlace temporal (FASE 9 - NUEVO)
 * @access Private (Owner, Admin)
 */
router.post('/file/:fileId/share',
  authMiddleware,
  requireWriteAccess,
  mediaValidators.validateShareFile,
  MediaUploadController.shareFile
);

/**
 * @route POST /api/media/file/:fileId/compress
 * @desc Comprimir archivo inteligentemente (FASE 9 - NUEVO)
 * @access Private (Owner, Admin)
 */
router.post('/file/:fileId/compress',
  authMiddleware,
  requireWriteAccess,
  mediaValidators.validateCompressFile,
  MediaUploadController.compressFile
);

/**
 * @route POST /api/media/file/:fileId/convert
 * @desc Convertir formato de archivo (FASE 9 - NUEVO)
 * @access Private (Owner, Admin)
 */
router.post('/file/:fileId/convert',
  authMiddleware,
  requireWriteAccess,
  mediaValidators.validateConvertFile,
  MediaUploadController.convertFile
);

/**
 * @route POST /api/media/file/:fileId/validate
 * @desc Validar contenido de archivo (FASE 9 - NUEVO)
 * @access Private (Owner, Admin)
 */
router.post('/file/:fileId/validate',
  authMiddleware,
  requireReadAccess,
  mediaValidators.validateGetFile,
  MediaUploadController.validateFile
);

/**
 * @route POST /api/media/file/:fileId/backup
 * @desc Crear backup de archivo (FASE 9 - NUEVO)
 * @access Private (Owner, Admin)
 */
router.post('/file/:fileId/backup',
  authMiddleware,
  requireWriteAccess,
  mediaValidators.validateGetFile,
  MediaUploadController.backupFile
);

/**
 * @route POST /api/media/cleanup
 * @desc Limpiar archivos huérfanos (FASE 9 - NUEVO)
 * @access Private (Admin only)
 */
router.post('/cleanup',
  authMiddleware,
  requireWriteAccess,
  MediaUploadController.cleanupOrphanedFiles
);

/**
 * @route POST /api/upload/image
 * @desc Subir imagen específicamente (ALINEACIÓN CON FRONTEND)
 * @access Private (Agent, Admin)
 */
router.post('/upload/image',
  authMiddleware,
  requireWriteAccess,
  mediaValidators.validateUpload,
  MediaUploadController.getUploadRateLimit(),
  MediaUploadController.uploadImage
);

/**
 * @route POST /api/upload/audio
 * @desc Subir audio específicamente (ALINEACIÓN CON FRONTEND)
 * @access Private (Agent, Admin)
 */
router.post('/upload/audio',
  authMiddleware,
  requireWriteAccess,
  mediaValidators.validateUpload,
  MediaUploadController.getUploadRateLimit(),
  MediaUploadController.uploadAudio
);

/**
 * @route POST /api/upload/video
 * @desc Subir video específicamente (ALINEACIÓN CON FRONTEND)
 * @access Private (Agent, Admin)
 */
router.post('/upload/video',
  authMiddleware,
  requireWriteAccess,
  mediaValidators.validateUpload,
  MediaUploadController.getUploadRateLimit(),
  MediaUploadController.uploadVideo
);

/**
 * @route POST /api/upload/document
 * @desc Subir documento específicamente (ALINEACIÓN CON FRONTEND)
 * @access Private (Agent, Admin)
 */
router.post('/upload/document',
  authMiddleware,
  requireWriteAccess,
  mediaValidators.validateUpload,
  MediaUploadController.getUploadRateLimit(),
  MediaUploadController.uploadDocument
);

/**
 * @route GET /api/media/file/:fileId/download
 * @desc Descargar archivo (FASE 5 - CON AUTORIZACIÓN)
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/file/:fileId/download',
  authMiddleware,
  requireReadAccess,
  fileAuthorizationMiddleware,
  MediaUploadController.downloadFile
);

/**
 * @route GET /api/media/files/:conversationId
 * @desc Listar archivos de conversación (FASE 5 - CON AUTORIZACIÓN)
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/files/:conversationId',
  authMiddleware,
  requireReadAccess,
  mediaValidators.validateFilesByConversation,
  conversationFileAuthorizationMiddleware,
  MediaUploadController.listFilesByConversation
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

/**
 * @route GET /api/media/proxy
 * @desc Proxy para acceder a media de Twilio (SOLUCIÓN PARA RENDERIZADO DE IMÁGENES)
 * @access Private (Admin, Agent, Viewer)
 * @query messageSid - ID del mensaje de Twilio
 * @query mediaSid - ID del media de Twilio
 * 
 * TEMPORALMENTE DESHABILITADO PARA PERMITIR ACCESO SIN AUTENTICACIÓN
 */
/*
router.get('/proxy',
  authMiddleware,
  requireReadAccess,
  validateRequest({
    query: Joi.object({
      messageSid: Joi.string().required().pattern(/^MM[a-f0-9]{32}$/),
      mediaSid: Joi.string().required().pattern(/^ME[a-f0-9]{32}$/)
    })
  }),
  MediaUploadController.proxyTwilioMedia
);
*/

/**
 * @route GET /media/proxy
 * @desc Proxy para acceder a media de Twilio (SIN AUTENTICACIÓN - SOLO DESARROLLO)
 * @access Public (Solo para desarrollo)
 * @query messageSid - ID del mensaje de Twilio
 * @query mediaSid - ID del media de Twilio
 * 
 * NOTA: Este endpoint es temporal para solucionar el problema del frontend
 * que está llamando a /media/proxy en lugar de /api/media/proxy
 */
router.get('/proxy-public',
  validateRequest({
    query: Joi.object({
      messageSid: Joi.string().required().pattern(/^MM[a-f0-9]{32}$/),
      mediaSid: Joi.string().required().pattern(/^ME[a-f0-9]{32}$/)
    })
  }),
  MediaUploadController.proxyTwilioMedia
);

module.exports = router;
