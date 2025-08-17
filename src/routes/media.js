const express = require('express');
const router = express.Router();
const MediaUploadController = require('../controllers/MediaUploadController');
const TwilioMediaService = require('../services/TwilioMediaService');
const { authMiddleware, requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { 
  fileAuthorizationMiddleware, 
  conversationFileAuthorizationMiddleware, 
  fileDeleteAuthorizationMiddleware 
} = require('../middleware/fileAuthorization');
const { ResponseHandler, ApiError } = require('../utils/responseHandler');
const logger = require('../utils/logger');
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
 */
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

/**
 * @route GET /media/proxy
 * @desc Proxy para acceder a media de Twilio (SIN AUTENTICACIÓN - SOLO DESARROLLO)
 * @access Public (Solo para desarrollo)
 * @query messageSid - ID del mensaje de Twilio
 * @query mediaSid - ID del media de Twilio
 * 
 * NOTA: Este endpoint está configurado en src/index.js para evitar conflictos
 * y asegurar que funcione correctamente sin autenticación
 */

/**
 * @route GET /api/media/permanent-url/:fileId
 * @desc Generar URL permanente para archivo almacenado
 * @access Private (Admin, Agent, Viewer)
 * @param fileId - ID del archivo'¿0
 */
router.get('/permanent-url/:fileId',
  authMiddleware,
  requireReadAccess,
  validateRequest({
    params: Joi.object({
      fileId: Joi.string().uuid().required()
    })
  }),
  MediaUploadController.generatePermanentUrl
);

/**
 * @route GET /api/media/proxy-file/:fileId
 * @desc Proxy para archivos almacenados en Firebase
 * @access Private (Admin, Agent, Viewer)
 * @param fileId - ID del archivo
 */
router.get('/proxy-file/:fileId',
  authMiddleware,
  requireReadAccess,
  validateRequest({
    params: Joi.object({
      fileId: Joi.string().uuid().required()
    })
  }),
  MediaUploadController.proxyStoredFile
);

/**
 * @route GET /media/proxy-file/:fileId
 * @desc Proxy para archivos almacenados (SIN AUTENTICACIÓN - SOLO DESARROLLO)
 * @access Public (Solo para desarrollo)
 * @param fileId - ID del archivo
 */
router.get('/proxy-file-public/:fileId',
  validateRequest({
    params: Joi.object({
      fileId: Joi.string().uuid().required()
    })
  }),
  MediaUploadController.proxyStoredFile
);

/**
 * 🔧 RECONSTRUIR URLs DE MEDIA
 * Endpoint para reconstruir URLs de media usando los SIDs de Twilio
 */
router.post('/reconstruct-urls', async (req, res) => {
  try {
    const { messageSid, mediaSid } = req.body;
    
    if (!messageSid) {
      return res.status(400).json({
        success: false,
        message: 'messageSid es requerido'
      });
    }
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
    
    if (!accountSid) {
      return res.status(500).json({
        success: false,
        message: 'Credenciales de Twilio no configuradas'
      });
    }
    
    // Si se proporciona mediaSid específico, reconstruir esa URL
    if (mediaSid) {
      const mediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${messageSid}/Media/${mediaSid}`;
      const proxyUrl = `${req.protocol}://${req.get('host')}/media/proxy-public?messageSid=${messageSid}&mediaSid=${mediaSid}`;
      
      return res.json({
        success: true,
        data: {
          originalUrl: mediaUrl,
          proxyUrl: proxyUrl,
          messageSid,
          mediaSid
        }
      });
    }
    
    // Si no se proporciona mediaSid, intentar obtener todos los media del mensaje
    try {
      const twilioClient = require('twilio')(accountSid, process.env.TWILIO_AUTH_TOKEN);
      const mediaList = await twilioClient.messages(messageSid).media.list();
      
      const mediaUrls = mediaList.map(media => ({
        mediaSid: media.sid,
        originalUrl: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${messageSid}/Media/${media.sid}`,
        proxyUrl: `${req.protocol}://${req.get('host')}/media/proxy-public?messageSid=${messageSid}&mediaSid=${media.sid}`,
        contentType: media.contentType,
        size: media.size
      }));
      
      return res.json({
        success: true,
        data: {
          messageSid,
          mediaCount: mediaUrls.length,
          mediaUrls
        }
      });
      
    } catch (twilioError) {
      console.error('Error obteniendo media de Twilio:', twilioError);
      return res.status(500).json({
        success: false,
        message: 'Error obteniendo media de Twilio',
        error: twilioError.message
      });
    }
    
  } catch (error) {
    console.error('Error reconstruyendo URLs de media:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});


/**
 * 📱 RUTAS PARA PROCESAMIENTO DE MEDIOS DE TWILIO
 * 
 * Endpoints para procesar y almacenar medios de WhatsApp
 * que vienen desde URLs de Twilio que requieren autenticación.
 */

/**
 * @route POST /api/media/twilio/process
 * @desc Procesar y almacenar medio de Twilio
 * @access Private (Admin, Agent)
 */
router.post('/twilio/process',
  authMiddleware,
  requireWriteAccess,
  async (req, res) => {
    try {
      const { mediaUrl, messageSid, conversationId, index = 0 } = req.body;
      const userId = req.user.email;

      // Validar parámetros requeridos
      if (!mediaUrl) {
        return ResponseHandler.error(res, new ApiError(
          'MEDIA_URL_REQUIRED',
          'URL del medio es requerida',
          'Proporciona una URL válida de Twilio',
          400
        ));
      }

      if (!messageSid) {
        return ResponseHandler.error(res, new ApiError(
          'MESSAGE_SID_REQUIRED',
          'MessageSid es requerido',
          'Proporciona el MessageSid de Twilio',
          400
        ));
      }

      if (!conversationId) {
        return ResponseHandler.error(res, new ApiError(
          'CONVERSATION_ID_REQUIRED',
          'ID de conversación es requerido',
          'Proporciona el ID de la conversación',
          400
        ));
      }

      logger.info('🔄 Procesando medio de Twilio', {
        mediaUrl,
        messageSid,
        conversationId,
        index,
        userId
      });

      // Instanciar servicio
      const twilioMediaService = new TwilioMediaService();

      // Procesar y almacenar el medio
      const result = await twilioMediaService.processAndStoreMedia(
        mediaUrl,
        messageSid,
        index,
        conversationId,
        userId
      );

      logger.info('✅ Medio de Twilio procesado exitosamente', {
        fileId: result.fileId,
        category: result.category,
        publicUrl: result.url,
        size: result.size
      });

      return ResponseHandler.success(res, result, 'Medio procesado y almacenado exitosamente');

    } catch (error) {
      logger.error('❌ Error procesando medio de Twilio', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        body: req.body,
        userEmail: req.user?.email
      });

      return ResponseHandler.error(res, error);
    }
  }
);

/**
 * @route POST /api/media/twilio/process-multiple
 * @desc Procesar múltiples medios de Twilio
 * @access Private (Admin, Agent)
 */
router.post('/twilio/process-multiple',
  authMiddleware,
  requireWriteAccess,
  async (req, res) => {
    try {
      const { mediaUrls, messageSid, conversationId } = req.body;
      const userId = req.user.email;

      // Validar parámetros requeridos
      if (!mediaUrls || !Array.isArray(mediaUrls) || mediaUrls.length === 0) {
        return ResponseHandler.error(res, new ApiError(
          'MEDIA_URLS_REQUIRED',
          'Array de URLs de medios es requerido',
          'Proporciona un array válido de URLs de Twilio',
          400
        ));
      }

      if (!messageSid) {
        return ResponseHandler.error(res, new ApiError(
          'MESSAGE_SID_REQUIRED',
          'MessageSid es requerido',
          'Proporciona el MessageSid de Twilio',
          400
        ));
      }

      if (!conversationId) {
        return ResponseHandler.error(res, new ApiError(
          'CONVERSATION_ID_REQUIRED',
          'ID de conversación es requerido',
          'Proporciona el ID de la conversación',
          400
        ));
      }

      logger.info('🔄 Procesando múltiples medios de Twilio', {
        messageSid,
        conversationId,
        userId,
        mediaCount: mediaUrls.length
      });

      // Instanciar servicio
      const twilioMediaService = new TwilioMediaService();

      // Procesar múltiples medios
      const results = await twilioMediaService.processMultipleMedia(
        mediaUrls,
        messageSid,
        conversationId,
        userId
      );

      const successCount = results.filter(r => r.processed).length;
      const errorCount = results.filter(r => r.error).length;

      logger.info('✅ Múltiples medios de Twilio procesados', {
        messageSid,
        totalProcessed: successCount,
        totalErrors: errorCount,
        total: results.length
      });

      return ResponseHandler.success(res, {
        results,
        summary: {
          total: results.length,
          processed: successCount,
          errors: errorCount
        }
      }, `Procesados ${successCount} de ${results.length} medios exitosamente`);

    } catch (error) {
      logger.error('❌ Error procesando múltiples medios de Twilio', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        body: req.body,
        userEmail: req.user?.email
      });

      return ResponseHandler.error(res, error);
    }
  }
);

/**
 * @route GET /api/media/twilio/info
 * @desc Obtener información de medio de Twilio sin descargar
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/twilio/info',
  authMiddleware,
  requireReadAccess,
  async (req, res) => {
    try {
      const { mediaUrl } = req.query;

      if (!mediaUrl) {
        return ResponseHandler.error(res, new ApiError(
          'MEDIA_URL_REQUIRED',
          'URL del medio es requerida',
          'Proporciona una URL válida de Twilio',
          400
        ));
      }

      logger.info('🔍 Obteniendo información de medio de Twilio', {
        mediaUrl,
        userEmail: req.user.email
      });

      // Instanciar servicio
      const twilioMediaService = new TwilioMediaService();

      // Obtener información del medio
      const info = await twilioMediaService.getMediaInfo(mediaUrl);

      logger.info('✅ Información de medio obtenida', {
        mediaUrl,
        contentType: info.contentType,
        contentLength: info.contentLength
      });

      return ResponseHandler.success(res, info, 'Información del medio obtenida exitosamente');

    } catch (error) {
      logger.error('❌ Error obteniendo información de medio de Twilio', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        query: req.query,
        userEmail: req.user?.email
      });

      return ResponseHandler.error(res, error);
    }
  }
);

/**
 * @route POST /api/media/twilio/cleanup
 * @desc Limpiar medios temporales
 * @access Private (Admin)
 */
router.post('/twilio/cleanup',
  authMiddleware,
  requireWriteAccess,
  async (req, res) => {
    try {
      const { fileIds } = req.body;

      if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
        return ResponseHandler.error(res, new ApiError(
          'FILE_IDS_REQUIRED',
          'Array de IDs de archivos es requerido',
          'Proporciona un array válido de IDs de archivos',
          400
        ));
      }

      logger.info('🧹 Iniciando limpieza de medios temporales', {
        fileCount: fileIds.length,
        userEmail: req.user.email
      });

      // Instanciar servicio
      const twilioMediaService = new TwilioMediaService();

      // Limpiar medios temporales
      const results = await twilioMediaService.cleanupTempMedia(fileIds);

      const successCount = results.filter(r => r.cleaned).length;
      const errorCount = results.filter(r => r.error).length;

      logger.info('✅ Limpieza de medios temporales completada', {
        totalCleaned: successCount,
        totalErrors: errorCount,
        total: results.length
      });

      return ResponseHandler.success(res, {
        results,
        summary: {
          total: results.length,
          cleaned: successCount,
          errors: errorCount
        }
      }, `Limpieza completada: ${successCount} de ${results.length} archivos`);

    } catch (error) {
      logger.error('❌ Error en limpieza de medios temporales', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        body: req.body,
        userEmail: req.user?.email
      });

      return ResponseHandler.error(res, error);
    }
  }
);

module.exports = router;
