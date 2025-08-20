const multer = require('multer');
const StorageConfig = require('../config/storage');
const FileService = require('../services/FileService');
const { ResponseHandler, ApiError } = require('../utils/responseHandler');
const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');

/**
 * CONTROLADOR DE SUBIDA DE MEDIA OPTIMIZADO
 * Maneja la subida segura de archivos multimedia con indexación eficiente
 */
class MediaUploadController {

  constructor() {
    // Rate limiting para uploads
    this.uploadLimit = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 50, // 50 uploads por ventana
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn('Rate limit de uploads excedido', {
          ip: req.ip,
          userEmail: req.user?.email,
          userAgent: req.headers['user-agent']?.substring(0, 100),
          timestamp: new Date().toISOString()
        });
        
        res.status(429).json({
          error: 'Demasiadas subidas de archivos',
          message: 'Has excedido el límite de subidas. Intenta nuevamente en 15 minutos.',
          retryAfter: Math.ceil(15 * 60), // 15 minutos en segundos
          timestamp: new Date().toISOString()
        });
      }
    });

    // Configuración de multer para memoria
    this.multerConfig = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB máximo
        files: 1
      },
      fileFilter: (req, file, cb) => {
        const validation = StorageConfig.validateFile(file);
        
        if (validation.valid) {
          cb(null, true);
        } else {
          cb(new Error(validation.error), false);
        }
      }
    });

    // Instanciar FileService
    this.fileService = new FileService();
  }

  /**
   * Obtener configuración de rate limiting
   */
  getUploadRateLimit() {
    return this.uploadLimit;
  }

  /**
   * Obtener configuración de multer
   */
  getMulterConfig() {
    return this.multerConfig;
  }

  /**
   * ENDPOINT PRINCIPAL: POST /api/media/upload
   * Subida optimizada con indexación automática (FASE 4 - MEJORADO)
   */
  async uploadMedia(req, res) {
    try {
      if (!req.file) {
        return ResponseHandler.error(res, new ApiError(
          'NO_FILE',
          'No se recibió ningún archivo',
          'Incluye un archivo en el campo "file" del formulario',
          400
        ));
      }

      const file = req.file;
      const userEmail = req.user.email;
      const { conversationId, tags = [], metadata = {} } = req.body;

      logger.info('🔄 Iniciando subida de archivo (FASE 4)', {
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        uploadedBy: userEmail,
        conversationId: conversationId || 'none',
        hasTags: tags.length > 0
      });

      // Validar compatibilidad con WhatsApp
      const isWhatsAppCompatible = this.isWhatsAppCompatible(file.mimetype, file.size);
      
      if (!isWhatsAppCompatible) {
        logger.warn('⚠️ Archivo no compatible con WhatsApp', {
          mimetype: file.mimetype,
          size: file.size,
          uploadedBy: userEmail
        });
      }

      // Subir archivo y obtener metadatos
      const result = await this.fileService.uploadFile({
        buffer: file.buffer,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        userId: req.user.id,
        uploadedBy: userEmail,
        conversationId: conversationId,
        tags: tags,
        metadata: {
          ...metadata,
          whatsappCompatible: isWhatsAppCompatible,
          uploadedVia: 'api',
          userAgent: req.headers['user-agent']?.substring(0, 200)
        }
      });

      // Generar preview automático si es compatible
      let previewUrl = null;
      if (this.isPreviewable(file.mimetype)) {
        try {
          const previewResult = await this.fileService.generatePreview(result.id, {
            width: 300,
            height: 300,
            quality: 80,
            format: 'webp'
          });
          previewUrl = previewResult.previewUrl;
          
          logger.info('✅ Preview automático generado', {
            fileId: result.id,
            previewUrl: previewResult.previewUrl
          });
        } catch (previewError) {
          logger.warn('⚠️ Error generando preview automático', {
            fileId: result.id,
            error: previewError.message
          });
        }
      }

      // Formato canónico de respuesta mejorado
      const attachment = {
        id: result.id,
        url: result.url,
        mime: result.mimetype,
        name: result.originalName,
        size: result.size,
        type: this.getFileType(result.mimetype),
        previewUrl: previewUrl,
        whatsappCompatible: isWhatsAppCompatible,
        tags: tags,
        metadata: {
          uploadedAt: new Date().toISOString(),
          uploadedBy: userEmail,
          conversationId: conversationId || null,
          ...metadata
        }
      };

      logger.info('✅ Archivo subido exitosamente (FASE 4)', {
        fileId: result.id,
        size: result.size,
        uploadedBy: userEmail,
        hasPreview: !!previewUrl,
        whatsappCompatible: isWhatsAppCompatible
      });

      // 🔄 FASE 7: EMITIR EVENTO WEBSOCKET DE ARCHIVO SUBIDO
      try {
        const { EnterpriseSocketManager } = require('../socket/enterpriseSocketManager');
        const socketManager = new EnterpriseSocketManager();
        
        await socketManager.emitFileUploaded({
          fileId: result.id,
          conversationId: conversationId || 'general',
          fileName: result.originalName,
          fileType: result.mimetype,
          fileSize: result.size,
          uploadedBy: userEmail,
          previewUrl: previewUrl,
          whatsappCompatible: isWhatsAppCompatible
        });

        logger.info('✅ Evento WebSocket de archivo subido emitido', {
          fileId: result.id,
          conversationId: conversationId || 'general'
        });
      } catch (socketError) {
        logger.warn('⚠️ Error emitiendo evento WebSocket de archivo subido', {
          error: socketError.message,
          fileId: result.id
        });
        // No fallar la respuesta por error de WebSocket
      }

      // 🔄 FASE 8: TRACKING DE USO DE ARCHIVO
      try {
        await this.fileService.trackFileUsage(
          result.id,
          'upload',
          userEmail,
          {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            sessionId: req.session?.id,
            workspaceId: req.user?.workspaceId || 'default',
            tenantId: req.user?.tenantId || 'default',
            conversationId: conversationId || 'general'
          }
        );

        logger.info('✅ Tracking de uso de archivo registrado', {
          fileId: result.id,
          action: 'upload',
          userEmail
        });
      } catch (trackingError) {
        logger.warn('⚠️ Error en tracking de uso de archivo', {
          error: trackingError.message,
          fileId: result.id
        });
        // No fallar la respuesta por error de tracking
      }

      return ResponseHandler.success(res, { 
        attachments: [attachment],
        metadata: {
          totalFiles: 1,
          totalSize: result.size,
          whatsappCompatible: isWhatsAppCompatible,
          hasPreview: !!previewUrl
        }
      }, 'Archivo subido exitosamente');

    } catch (error) {
      logger.error('❌ Error subiendo archivo (FASE 4):', {
        error: error.message,
        userEmail: req.user?.email,
        fileSize: req.file?.size,
        mimetype: req.file?.mimetype
      });

      return ResponseHandler.error(res, new ApiError(
        'UPLOAD_FAILED',
        'Error subiendo archivo',
        'Intenta nuevamente o contacta soporte si el problema persiste',
        500,
        { originalError: error.message }
      ));
    }
  }

  /**
   * ENDPOINT: GET /api/media/file/:fileId
   * Obtener información de archivo (eficiente)
   */
  async getFileInfo(req, res) {
    try {
      const { fileId } = req.params;
      
      if (!fileId) {
        return ResponseHandler.error(res, new ApiError(
          'MISSING_FILE_ID',
          'ID de archivo requerido',
          'Especifica el ID del archivo en la URL',
          400
        ));
      }

      logger.info('🔍 Obteniendo información de archivo', { fileId });

      const fileInfo = await this.fileService.getFileById(fileId);
      
      if (!fileInfo) {
        return ResponseHandler.error(res, new ApiError(
          'FILE_NOT_FOUND',
          'Archivo no encontrado',
          'El archivo especificado no existe o fue eliminado',
          404
        ));
      }

      logger.info('✅ Información de archivo obtenida exitosamente', { fileId });

      // 🔄 FASE 8: TRACKING DE USO DE ARCHIVO
      try {
        await this.fileService.trackFileUsage(
          fileId,
          'view',
          req.user?.email,
          {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            sessionId: req.session?.id,
            workspaceId: req.user?.workspaceId || 'default',
            tenantId: req.user?.tenantId || 'default',
            conversationId: fileInfo.conversationId
          }
        );

        logger.debug('✅ Tracking de vista de archivo registrado', {
          fileId,
          action: 'view',
          userEmail: req.user?.email
        });
      } catch (trackingError) {
        logger.warn('⚠️ Error en tracking de vista de archivo', {
          error: trackingError.message,
          fileId
        });
        // No fallar la respuesta por error de tracking
      }

      return ResponseHandler.success(res, fileInfo, 'Información de archivo obtenida');

    } catch (error) {
      logger.error('❌ Error obteniendo información de archivo:', {
        fileId: req.params.fileId,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'FILE_INFO_ERROR',
        'Error obteniendo información del archivo',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * ENDPOINT: DELETE /api/media/file/:fileId
   * Eliminar archivo (eficiente)
   */
  async deleteFile(req, res) {
    try {
      const { fileId } = req.params;
      
      if (!fileId) {
        return ResponseHandler.error(res, new ApiError(
          'MISSING_FILE_ID',
          'ID de archivo requerido',
          'Especifica el ID del archivo en la URL',
          400
        ));
      }

      logger.info('🗑️ Eliminando archivo', { 
        fileId, 
        deletedBy: req.user.email 
      });

      const result = await this.fileService.deleteFile(fileId, req.user.email);

      logger.info('✅ Archivo eliminado exitosamente', {
        fileId,
        deletedBy: req.user.email
      });

      // 🔄 FASE 8: TRACKING DE USO DE ARCHIVO
      try {
        await this.fileService.trackFileUsage(
          fileId,
          'delete',
          req.user.email,
          {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            sessionId: req.session?.id,
            workspaceId: req.user?.workspaceId || 'default',
            tenantId: req.user?.tenantId || 'default',
            conversationId: result.conversationId
          }
        );

        logger.info('✅ Tracking de eliminación de archivo registrado', {
          fileId,
          action: 'delete',
          userEmail: req.user.email
        });
      } catch (trackingError) {
        logger.warn('⚠️ Error en tracking de eliminación de archivo', {
          error: trackingError.message,
          fileId
        });
        // No fallar la respuesta por error de tracking
      }

      return ResponseHandler.success(res, result, 'Archivo eliminado exitosamente');

    } catch (error) {
      logger.error('❌ Error eliminando archivo:', {
        fileId: req.params.fileId,
        deletedBy: req.user?.email,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'DELETE_ERROR',
        'Error eliminando archivo',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * ENDPOINT: GET /api/media/conversation/:conversationId
   * Listar archivos por conversación (eficiente)
   */
  async listFilesByConversation(req, res) {
    try {
      const { conversationId } = req.params;
      const { 
        limit = 50, 
        startAfter = null, 
        category = null,
        isActive = true 
      } = req.query;

      logger.info('📋 Listando archivos por conversación', {
        conversationId,
        limit: parseInt(limit),
        category,
        isActive: isActive === 'true'
      });

      const files = await this.fileService.listFilesByConversation(conversationId, {
        limit: parseInt(limit),
        startAfter,
        category,
        isActive: isActive === 'true'
      });

      logger.info('✅ Archivos por conversación listados exitosamente', {
        conversationId,
        count: files.length
      });

      return ResponseHandler.success(res, {
        files,
        count: files.length,
        conversationId
      }, 'Archivos listados exitosamente');

    } catch (error) {
      logger.error('❌ Error listando archivos por conversación:', {
        conversationId: req.params.conversationId,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'LIST_FILES_ERROR',
        'Error listando archivos',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * ENDPOINT: GET /api/media/user/:userId
   * Listar archivos por usuario (eficiente)
   */
  async listFilesByUser(req, res) {
    try {
      const { userId } = req.params;
      const { 
        limit = 50, 
        startAfter = null, 
        category = null,
        isActive = true 
      } = req.query;

      logger.info('👤 Listando archivos por usuario', {
        userId,
        limit: parseInt(limit),
        category,
        isActive: isActive === 'true'
      });

      const files = await this.fileService.listFilesByUser(userId, {
        limit: parseInt(limit),
        startAfter,
        category,
        isActive: isActive === 'true'
      });

      logger.info('✅ Archivos por usuario listados exitosamente', {
        userId,
        count: files.length
      });

      return ResponseHandler.success(res, {
        files,
        count: files.length,
        userId
      }, 'Archivos de usuario listados exitosamente');

    } catch (error) {
      logger.error('❌ Error listando archivos por usuario:', {
        userId: req.params.userId,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'LIST_USER_FILES_ERROR',
        'Error listando archivos del usuario',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * ENDPOINT: GET /api/media/category/:category
   * Listar archivos por categoría (eficiente)
   */
  async listFilesByCategory(req, res) {
    try {
      const { category } = req.params;
      const { 
        limit = 50, 
        startAfter = null,
        isActive = true 
      } = req.query;

      logger.info('🗂️ Listando archivos por categoría', {
        category,
        limit: parseInt(limit),
        isActive: isActive === 'true'
      });

      const files = await this.fileService.listFilesByCategory(category, {
        limit: parseInt(limit),
        startAfter,
        isActive: isActive === 'true'
      });

      logger.info('✅ Archivos por categoría listados exitosamente', {
        category,
        count: files.length
      });

      return ResponseHandler.success(res, {
        files,
        count: files.length,
        category
      }, 'Archivos por categoría listados exitosamente');

    } catch (error) {
      logger.error('❌ Error listando archivos por categoría:', {
        category: req.params.category,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'LIST_CATEGORY_FILES_ERROR',
        'Error listando archivos por categoría',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * ENDPOINT: GET /api/media/search
   * Buscar archivos por texto (eficiente)
   */
  async searchFiles(req, res) {
    try {
      const { 
        q: searchTerm, 
        limit = 50, 
        category = null, 
        userId = null,
        isActive = true 
      } = req.query;

      if (!searchTerm) {
        return ResponseHandler.error(res, new ApiError(
          'MISSING_SEARCH_TERM',
          'Término de búsqueda requerido',
          'Incluye el parámetro "q" con el término a buscar',
          400
        ));
      }

      logger.info('🔍 Buscando archivos', {
        searchTerm,
        limit: parseInt(limit),
        category,
        userId,
        isActive: isActive === 'true'
      });

      const files = await this.fileService.searchFiles(searchTerm, {
        limit: parseInt(limit),
        category,
        userId,
        isActive: isActive === 'true'
      });

      logger.info('✅ Búsqueda de archivos completada', {
        searchTerm,
        count: files.length
      });

      return ResponseHandler.success(res, {
        files,
        count: files.length,
        searchTerm
      }, 'Búsqueda completada exitosamente');

    } catch (error) {
      logger.error('❌ Error buscando archivos:', {
        searchTerm: req.query.q,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'SEARCH_FILES_ERROR',
        'Error buscando archivos',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * ENDPOINT: GET /api/media/stats
   * Obtener estadísticas de archivos
   */
  async getFileStats(req, res) {
    try {
      const { 
        userId = null, 
        conversationId = null, 
        category = null,
        startDate = null,
        endDate = null 
      } = req.query;

      logger.info('📊 Obteniendo estadísticas de archivos', {
        userId,
        conversationId,
        category,
        startDate,
        endDate
      });

      const stats = await this.fileService.getFileStats({
        userId,
        conversationId,
        category,
        startDate,
        endDate
      });

      logger.info('✅ Estadísticas de archivos obtenidas', {
        total: stats.total,
        totalSize: stats.totalSizeFormatted
      });

      return ResponseHandler.success(res, stats, 'Estadísticas obtenidas exitosamente');

    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas de archivos:', {
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'STATS_ERROR',
        'Error obteniendo estadísticas',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * ENDPOINT: POST /api/media/file/:fileId/tags
   * Agregar tags a archivo
   */
  async addTagsToFile(req, res) {
    try {
      const { fileId } = req.params;
      const { tags } = req.body;

      if (!tags || !Array.isArray(tags)) {
        return ResponseHandler.error(res, new ApiError(
          'MISSING_TAGS',
          'Tags requeridos',
          'Incluye un array de tags en el cuerpo de la petición',
          400
        ));
      }

      logger.info('🏷️ Agregando tags a archivo', {
        fileId,
        tags,
        userEmail: req.user.email
      });

      const result = await this.fileService.addTagsToFile(fileId, tags, req.user.email);

      logger.info('✅ Tags agregados exitosamente', {
        fileId,
        tags,
        totalTags: result.tags.length
      });

      return ResponseHandler.success(res, result, 'Tags agregados exitosamente');

    } catch (error) {
      logger.error('❌ Error agregando tags:', {
        fileId: req.params.fileId,
        tags: req.body.tags,
        userEmail: req.user?.email,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'ADD_TAGS_ERROR',
        'Error agregando tags',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * ENDPOINT: DELETE /api/media/file/:fileId/tags
   * Remover tags de archivo
   */
  async removeTagsFromFile(req, res) {
    try {
      const { fileId } = req.params;
      const { tags } = req.body;

      if (!tags || !Array.isArray(tags)) {
        return ResponseHandler.error(res, new ApiError(
          'MISSING_TAGS',
          'Tags requeridos',
          'Incluye un array de tags en el cuerpo de la petición',
          400
        ));
      }

      logger.info('🏷️ Removiendo tags de archivo', {
        fileId,
        tags,
        userEmail: req.user.email
      });

      const result = await this.fileService.removeTagsFromFile(fileId, tags, req.user.email);

      logger.info('✅ Tags removidos exitosamente', {
        fileId,
        tags,
        remainingTags: result.tags.length
      });

      return ResponseHandler.success(res, result, 'Tags removidos exitosamente');

    } catch (error) {
      logger.error('❌ Error removiendo tags:', {
        fileId: req.params.fileId,
        tags: req.body.tags,
        userEmail: req.user?.email,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'REMOVE_TAGS_ERROR',
        'Error removiendo tags',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * ENDPOINT: GET /api/media/file/:fileId/download
   * Descargar archivo
   */
  async downloadFile(req, res) {
    try {
      const { fileId } = req.params;

      logger.info('📥 Descargando archivo', {
        fileId,
        userEmail: req.user.email
      });

      const result = await this.fileService.downloadFile(fileId, req.user.email);

      logger.info('✅ Archivo preparado para descarga', {
        fileId,
        downloadCount: result.downloadCount
      });

      return ResponseHandler.success(res, result, 'Archivo preparado para descarga');

    } catch (error) {
      logger.error('❌ Error descargando archivo:', {
        fileId: req.params.fileId,
        userEmail: req.user?.email,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'DOWNLOAD_ERROR',
        'Error descargando archivo',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * ENDPOINT: GET /api/media/preview/:fileId
   * Obtener preview de archivo (FASE 4 - NUEVO)
   */
  async getFilePreview(req, res) {
    try {
      const { fileId } = req.params;
      const { width, height, quality = 80 } = req.query;

      logger.info('🖼️ Generando preview de archivo', {
        fileId,
        width: width ? parseInt(width) : 'auto',
        height: height ? parseInt(height) : 'auto',
        quality: parseInt(quality),
        userEmail: req.user.email
      });

      // Obtener información del archivo
      const fileInfo = await this.fileService.getFileById(fileId);
      
      if (!fileInfo) {
        return ResponseHandler.error(res, new ApiError(
          'FILE_NOT_FOUND',
          'Archivo no encontrado',
          'El archivo especificado no existe o fue eliminado',
          404
        ));
      }

      // Verificar si el archivo es compatible con preview
      const isPreviewable = this.isPreviewable(fileInfo.mimetype);
      
      if (!isPreviewable) {
        return ResponseHandler.error(res, new ApiError(
          'PREVIEW_NOT_SUPPORTED',
          'Preview no soportado para este tipo de archivo',
          'Solo se pueden generar previews de imágenes, videos y documentos PDF',
          400
        ));
      }

      // Generar preview usando FileService
      const previewOptions = {
        width: width ? parseInt(width) : undefined,
        height: height ? parseInt(height) : undefined,
        quality: parseInt(quality),
        format: 'webp' // Formato optimizado para web
      };

      const previewResult = await this.fileService.generatePreview(fileId, previewOptions);

      logger.info('✅ Preview generado exitosamente', {
        fileId,
        previewUrl: previewResult.previewUrl,
        originalSize: fileInfo.size,
        previewSize: previewResult.size
      });

      return ResponseHandler.success(res, {
        fileId,
        originalFile: {
          id: fileInfo.id,
          name: fileInfo.originalName,
          mimetype: fileInfo.mimetype,
          size: fileInfo.size,
          url: fileInfo.url
        },
        preview: {
          url: previewResult.previewUrl,
          width: previewResult.width,
          height: previewResult.height,
          size: previewResult.size,
          format: previewResult.format
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          generatedBy: req.user.email,
          options: previewOptions
        }
      }, 'Preview generado exitosamente');

    } catch (error) {
      logger.error('❌ Error generando preview:', {
        fileId: req.params.fileId,
        userEmail: req.user?.email,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'PREVIEW_ERROR',
        'Error generando preview',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * Obtener tipo de archivo basado en MIME type
   */
  getFileType(mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'file';
  }

  /**
   * Verificar compatibilidad con WhatsApp
   */
  isWhatsAppCompatible(mimetype, size) {
    const whatsappLimits = {
      'image/jpeg': 5 * 1024 * 1024,   // 5MB
      'image/png': 5 * 1024 * 1024,    // 5MB
      'video/mp4': 16 * 1024 * 1024,   // 16MB
      'audio/mpeg': 16 * 1024 * 1024,  // 16MB
      'audio/ogg': 16 * 1024 * 1024,   // 16MB (WhatsApp voice notes)
      'application/pdf': 100 * 1024 * 1024 // 100MB
    };

    return whatsappLimits.hasOwnProperty(mimetype) && size <= whatsappLimits[mimetype];
  }

  /**
   * Verificar si un archivo es compatible con preview
   */
  isPreviewable(mimetype) {
    const previewableTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/wmv',
      'application/pdf'
    ];

    return previewableTypes.includes(mimetype);
  }

  /**
   * 🔗 POST /api/media/file/:fileId/share
   * Compartir archivo con enlace temporal
   */
  async shareFile(req, res) {
    try {
      const { fileId } = req.params;
      const { shareWith, permissions = 'view', expiresIn, password, maxDownloads } = req.body;

      logger.info('🔗 Compartiendo archivo', {
        fileId,
        shareWith,
        permissions,
        userEmail: req.user.email
      });

      const result = await this.fileService.shareFile(
        fileId,
        shareWith,
        permissions,
        req.user.email,
        { expiresIn, password, maxDownloads }
      );

      logger.info('✅ Archivo compartido exitosamente', {
        fileId,
        shareToken: result.shareToken
      });

      return ResponseHandler.success(res, result, 'Archivo compartido exitosamente');

    } catch (error) {
      logger.error('❌ Error compartiendo archivo:', {
        fileId: req.params.fileId,
        userEmail: req.user?.email,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'SHARE_ERROR',
        'Error compartiendo archivo',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * 🗜️ POST /api/media/file/:fileId/compress
   * Comprimir archivo inteligentemente
   */
  async compressFile(req, res) {
    try {
      const { fileId } = req.params;
      const { quality = 80, format } = req.body;

      logger.info('🗜️ Comprimiendo archivo', {
        fileId,
        quality,
        format,
        userEmail: req.user.email
      });

      const result = await this.fileService.compressFile(fileId, quality, format);

      logger.info('✅ Archivo comprimido exitosamente', {
        fileId,
        compressionRatio: result.compressionRatio
      });

      return ResponseHandler.success(res, result, 'Archivo comprimido exitosamente');

    } catch (error) {
      logger.error('❌ Error comprimiendo archivo:', {
        fileId: req.params.fileId,
        userEmail: req.user?.email,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'COMPRESS_ERROR',
        'Error comprimiendo archivo',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * 🔄 POST /api/media/file/:fileId/convert
   * Convertir formato de archivo
   */
  async convertFile(req, res) {
    try {
      const { fileId } = req.params;
      const { targetFormat, quality = 80, maintainMetadata = true } = req.body;

      logger.info('🔄 Convirtiendo archivo', {
        fileId,
        targetFormat,
        quality,
        userEmail: req.user.email
      });

      const result = await this.fileService.convertFile(fileId, targetFormat, {
        quality,
        maintainMetadata
      });

      logger.info('✅ Archivo convertido exitosamente', {
        fileId,
        targetFormat,
        convertedFileId: result.convertedFileId
      });

      return ResponseHandler.success(res, result, 'Archivo convertido exitosamente');

    } catch (error) {
      logger.error('❌ Error convirtiendo archivo:', {
        fileId: req.params.fileId,
        userEmail: req.user?.email,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'CONVERT_ERROR',
        'Error convirtiendo archivo',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * 🔍 POST /api/media/file/:fileId/validate
   * Validar contenido de archivo
   */
  async validateFile(req, res) {
    try {
      const { fileId } = req.params;

      logger.info('🔍 Validando archivo', {
        fileId,
        userEmail: req.user.email
      });

      // Obtener archivo desde storage
      const fileInfo = await this.fileService.getFileById(fileId);
      if (!fileInfo) {
        return ResponseHandler.error(res, new ApiError(
          'FILE_NOT_FOUND',
          'Archivo no encontrado',
          'El archivo especificado no existe',
          404
        ));
      }

      const bucket = this.fileService.getBucket();
      const storageFile = bucket.file(fileInfo.storagePath);
      const [fileBuffer] = await storageFile.download();

      const result = await this.fileService.validateFileContent(fileBuffer, fileInfo.mimetype);

      logger.info('✅ Archivo validado exitosamente', {
        fileId,
        isValid: result.isValid,
        warnings: result.warnings.length
      });

      return ResponseHandler.success(res, result, 'Archivo validado exitosamente');

    } catch (error) {
      logger.error('❌ Error validando archivo:', {
        fileId: req.params.fileId,
        userEmail: req.user?.email,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'VALIDATE_ERROR',
        'Error validando archivo',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * 💾 POST /api/media/file/:fileId/backup
   * Crear backup de archivo
   */
  async backupFile(req, res) {
    try {
      const { fileId } = req.params;

      logger.info('💾 Creando backup de archivo', {
        fileId,
        userEmail: req.user.email
      });

      const result = await this.fileService.backupFile(fileId);

      logger.info('✅ Backup creado exitosamente', {
        fileId,
        backupPath: result.backupPath
      });

      return ResponseHandler.success(res, result, 'Backup creado exitosamente');

    } catch (error) {
      logger.error('❌ Error creando backup:', {
        fileId: req.params.fileId,
        userEmail: req.user?.email,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'BACKUP_ERROR',
        'Error creando backup',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * 🧹 POST /api/media/cleanup
   * Limpiar archivos huérfanos (FASE 9 - NUEVO)
   * @access Private (Admin only)
   */
  async cleanupOrphanedFiles(req, res) {
    try {
      logger.info('🧹 Iniciando limpieza de archivos huérfanos', {
        userEmail: req.user.email
      });

      const result = await this.fileService.cleanupOrphanedFiles();

      logger.info('✅ Limpieza completada exitosamente', {
        orphanedCount: result.orphanedCount,
        cleanedSize: result.cleanedSize
      });

      return ResponseHandler.success(res, result, 'Limpieza completada exitosamente');

    } catch (error) {
      logger.error('❌ Error en limpieza:', {
        userEmail: req.user?.email,
        error: error.message
      });

      return ResponseHandler.error(res, new ApiError(
        'CLEANUP_ERROR',
        'Error en limpieza',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * 🖼️ POST /api/upload/image
   * Subir imagen específicamente (ALINEACIÓN CON FRONTEND)
   * @access Private (Agent, Admin)
   */
  async uploadImage(req, res) {
    try {
      const { conversationId, tags, metadata } = req.body;
      const file = req.file;

      if (!file) {
        return ResponseHandler.error(res, new ApiError(
          'MISSING_FILE',
          'Archivo de imagen requerido',
          'Selecciona una imagen para subir',
          400
        ));
      }

      logger.info('🖼️ Subiendo imagen específica', {
        fileName: file.originalname,
        fileSize: file.size,
        mimetype: file.mimetype,
        conversationId,
        userEmail: req.user.email
      });

      // Emitir evento de inicio de subida
      this.emitUploadStart(file, req.user.email, conversationId);

      const result = await this.fileService.uploadFile({
        buffer: file.buffer,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        conversationId: conversationId || 'general',
        userId: req.user.id,
        uploadedBy: req.user.email,
        tags: [...(tags || []), 'image', 'uploaded'],
        metadata: {
          ...metadata,
          uploadMethod: 'image-specific',
          userAgent: req.headers['user-agent']
        }
      });

      // Emitir evento de completado
      this.emitUploadComplete(result, req.user.email, conversationId);

      return ResponseHandler.success(res, {
        id: result.id,
        url: result.url,
        filename: result.originalName,
        size: result.size,
        type: 'image',
        thumbnail: result.thumbnailUrl,
        metadata: result.metadata
      }, 'Imagen subida exitosamente');

    } catch (error) {
      logger.error('❌ Error subiendo imagen:', {
        fileName: req.file?.originalname,
        userEmail: req.user?.email,
        error: error.message
      });

      // Emitir evento de error
      this.emitUploadError(req.file, error.message, req.user.email);

      return ResponseHandler.error(res, new ApiError(
        'UPLOAD_ERROR',
        'Error subiendo imagen',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * 🎵 POST /api/upload/audio
   * Subir audio específicamente (ALINEACIÓN CON FRONTEND)
   * @access Private (Agent, Admin)
   */
  async uploadAudio(req, res) {
    try {
      const { conversationId, tags, metadata } = req.body;
      const file = req.file;

      if (!file) {
        return ResponseHandler.error(res, new ApiError(
          'MISSING_FILE',
          'Archivo de audio requerido',
          'Selecciona un archivo de audio para subir',
          400
        ));
      }

      logger.info('🎵 Subiendo audio específico', {
        fileName: file.originalname,
        fileSize: file.size,
        mimetype: file.mimetype,
        conversationId,
        userEmail: req.user.email
      });

      // Emitir evento de inicio de subida
      this.emitUploadStart(file, req.user.email, conversationId);

      const result = await this.fileService.uploadFile({
        buffer: file.buffer,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        conversationId: conversationId || 'general',
        userId: req.user.id,
        uploadedBy: req.user.email,
        tags: [...(tags || []), 'audio', 'uploaded'],
        metadata: {
          ...metadata,
          uploadMethod: 'audio-specific',
          userAgent: req.headers['user-agent']
        }
      });

      // Emitir evento de completado
      this.emitUploadComplete(result, req.user.email, conversationId);

      return ResponseHandler.success(res, {
        id: result.id,
        url: result.url,
        filename: result.originalName,
        size: result.size,
        type: 'audio',
        duration: result.metadata?.duration,
        waveform: result.metadata?.waveform,
        metadata: result.metadata
      }, 'Audio subido exitosamente');

    } catch (error) {
      logger.error('❌ Error subiendo audio:', {
        fileName: req.file?.originalname,
        userEmail: req.user?.email,
        error: error.message
      });

      // Emitir evento de error
      this.emitUploadError(req.file, error.message, req.user.email);

      return ResponseHandler.error(res, new ApiError(
        'UPLOAD_ERROR',
        'Error subiendo audio',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * 🎬 POST /api/upload/video
   * Subir video específicamente (ALINEACIÓN CON FRONTEND)
   * @access Private (Agent, Admin)
   */
  async uploadVideo(req, res) {
    try {
      const { conversationId, tags, metadata } = req.body;
      const file = req.file;

      if (!file) {
        return ResponseHandler.error(res, new ApiError(
          'MISSING_FILE',
          'Archivo de video requerido',
          'Selecciona un video para subir',
          400
        ));
      }

      logger.info('🎬 Subiendo video específico', {
        fileName: file.originalname,
        fileSize: file.size,
        mimetype: file.mimetype,
        conversationId,
        userEmail: req.user.email
      });

      // Emitir evento de inicio de subida
      this.emitUploadStart(file, req.user.email, conversationId);

      const result = await this.fileService.uploadFile({
        buffer: file.buffer,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        conversationId: conversationId || 'general',
        userId: req.user.id,
        uploadedBy: req.user.email,
        tags: [...(tags || []), 'video', 'uploaded'],
        metadata: {
          ...metadata,
          uploadMethod: 'video-specific',
          userAgent: req.headers['user-agent']
        }
      });

      // Emitir evento de completado
      this.emitUploadComplete(result, req.user.email, conversationId);

      return ResponseHandler.success(res, {
        id: result.id,
        url: result.url,
        filename: result.originalName,
        size: result.size,
        type: 'video',
        duration: result.metadata?.duration,
        thumbnail: result.thumbnailUrl,
        resolution: result.metadata?.resolution,
        metadata: result.metadata
      }, 'Video subido exitosamente');

    } catch (error) {
      logger.error('❌ Error subiendo video:', {
        fileName: req.file?.originalname,
        userEmail: req.user?.email,
        error: error.message
      });

      // Emitir evento de error
      this.emitUploadError(req.file, error.message, req.user.email);

      return ResponseHandler.error(res, new ApiError(
        'UPLOAD_ERROR',
        'Error subiendo video',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * 📄 POST /api/upload/document
   * Subir documento específicamente (ALINEACIÓN CON FRONTEND)
   * @access Private (Agent, Admin)
   */
  async uploadDocument(req, res) {
    try {
      const { conversationId, tags, metadata } = req.body;
      const file = req.file;

      if (!file) {
        return ResponseHandler.error(res, new ApiError(
          'MISSING_FILE',
          'Documento requerido',
          'Selecciona un documento para subir',
          400
        ));
      }

      logger.info('📄 Subiendo documento específico', {
        fileName: file.originalname,
        fileSize: file.size,
        mimetype: file.mimetype,
        conversationId,
        userEmail: req.user.email
      });

      // Emitir evento de inicio de subida
      this.emitUploadStart(file, req.user.email, conversationId);

      const result = await this.fileService.uploadFile({
        buffer: file.buffer,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        conversationId: conversationId || 'general',
        userId: req.user.id,
        uploadedBy: req.user.email,
        tags: [...(tags || []), 'document', 'uploaded'],
        metadata: {
          ...metadata,
          uploadMethod: 'document-specific',
          userAgent: req.headers['user-agent']
        }
      });

      // Emitir evento de completado
      this.emitUploadComplete(result, req.user.email, conversationId);

      return ResponseHandler.success(res, {
        id: result.id,
        url: result.url,
        filename: result.originalName,
        size: result.size,
        type: 'document',
        pages: result.metadata?.pages,
        preview: result.previewUrl,
        metadata: result.metadata
      }, 'Documento subido exitosamente');

    } catch (error) {
      logger.error('❌ Error subiendo documento:', {
        fileName: req.file?.originalname,
        userEmail: req.user?.email,
        error: error.message
      });

      // Emitir evento de error
      this.emitUploadError(req.file, error.message, req.user.email);

      return ResponseHandler.error(res, new ApiError(
        'UPLOAD_ERROR',
        'Error subiendo documento',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * 🔄 FUNCIONES AUXILIARES PARA WEBSOCKET
   */

  /**
   * Emitir evento de inicio de subida
   */
  emitUploadStart(file, userEmail, conversationId) {
    try {
      const { EnterpriseSocketManager } = require('../socket/enterpriseSocketManager');
      const socketManager = new EnterpriseSocketManager();
      
      socketManager.io.to(`conversation_${conversationId || 'general'}`).emit('file-upload-start', {
        fileId: `temp_${Date.now()}`,
        fileName: file.originalname,
        fileSize: file.size,
        uploadedBy: userEmail,
        timestamp: new Date().toISOString()
      });

      logger.debug('📡 Evento file-upload-start emitido', {
        fileName: file.originalname,
        userEmail
      });
    } catch (error) {
      logger.warn('⚠️ Error emitiendo file-upload-start', { error: error.message });
    }
  }

  /**
   * Emitir evento de progreso de subida
   */
  emitUploadProgress(fileId, progress, bytesUploaded, userEmail, conversationId) {
    try {
      const { EnterpriseSocketManager } = require('../socket/enterpriseSocketManager');
      const socketManager = new EnterpriseSocketManager();
      
      socketManager.io.to(`conversation_${conversationId || 'general'}`).emit('file-upload-progress', {
        fileId,
        progress,
        bytesUploaded,
        uploadedBy: userEmail,
        timestamp: new Date().toISOString()
      });

      logger.debug('📡 Evento file-upload-progress emitido', {
        fileId,
        progress: `${progress}%`,
        userEmail
      });
    } catch (error) {
      logger.warn('⚠️ Error emitiendo file-upload-progress', { error: error.message });
    }
  }

  /**
   * Emitir evento de subida completada
   */
  emitUploadComplete(result, userEmail, conversationId) {
    try {
      const { EnterpriseSocketManager } = require('../socket/enterpriseSocketManager');
      const socketManager = new EnterpriseSocketManager();
      
      socketManager.io.to(`conversation_${conversationId || 'general'}`).emit('file-upload-complete', {
        fileId: result.id,
        url: result.url,
        fileName: result.originalName,
        fileSize: result.size,
        type: this.getFileType(result.mimetype),
        thumbnail: result.thumbnailUrl,
        metadata: result.metadata,
        uploadedBy: userEmail,
        timestamp: new Date().toISOString()
      });

      logger.debug('📡 Evento file-upload-complete emitido', {
        fileId: result.id,
        fileName: result.originalName,
        userEmail
      });
    } catch (error) {
      logger.warn('⚠️ Error emitiendo file-upload-complete', { error: error.message });
    }
  }

  /**
   * Emitir evento de error en subida
   */
  emitUploadError(file, errorMessage, userEmail) {
    try {
      const { EnterpriseSocketManager } = require('../socket/enterpriseSocketManager');
      const socketManager = new EnterpriseSocketManager();
      
      socketManager.io.emit('file-upload-error', {
        fileId: `temp_${Date.now()}`,
        fileName: file?.originalname,
        error: errorMessage,
        uploadedBy: userEmail,
        timestamp: new Date().toISOString()
      });

      logger.debug('📡 Evento file-upload-error emitido', {
        fileName: file?.originalname,
        error: errorMessage,
        userEmail
      });
    } catch (error) {
      logger.warn('⚠️ Error emitiendo file-upload-error', { error: error.message });
    }
  }

  /**
   * PROXY PARA MEDIA DE TWILIO
   * Endpoint para acceder a imágenes y media de Twilio de forma segura
   * SOLUCIÓN PARA EL PROBLEMA DE RENDERIZADO DE IMÁGENES
   */
  async proxyTwilioMedia(req, res) {
    const startTime = Date.now();
    const requestId = `proxy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const { messageSid, mediaSid } = req.query;
      const userEmail = req.user?.email || 'anonymous';
      
      // 🔧 CORRECCIÓN CRÍTICA: Validar parámetros requeridos
      if (!messageSid || !mediaSid) {
        logger.error('❌ Parámetros faltantes en proxyTwilioMedia', {
          requestId,
          messageSid,
          mediaSid,
          userEmail
        });
        return res.status(400).json({
          success: false,
          error: 'messageSid y mediaSid son requeridos'
        });
      }

      logger.info('🔄 PROXY TWILIO MEDIA - Iniciando', {
        requestId,
        messageSid,
        mediaSid,
        userEmail,
        userAgent: req.headers['user-agent']?.substring(0, 100),
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      // Validar parámetros
      if (!messageSid || !mediaSid) {
        logger.warn('❌ PROXY TWILIO MEDIA - Parámetros faltantes', {
          requestId,
          messageSid: !!messageSid,
          mediaSid: !!mediaSid,
          userEmail
        });
        
        return ResponseHandler.error(res, new ApiError(
          'MISSING_PARAMETERS',
          'Parámetros requeridos faltantes',
          'Se requieren messageSid y mediaSid',
          400
        ));
      }

      // Construir URL de Twilio
      const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (!accountSid || !authToken) {
        logger.error('❌ PROXY TWILIO MEDIA - Credenciales de Twilio faltantes', {
          requestId,
          hasAccountSid: !!accountSid,
          hasAuthToken: !!authToken,
          userEmail
        });
        
        return ResponseHandler.error(res, new ApiError(
          'TWILIO_CONFIG_ERROR',
          'Error de configuración de Twilio',
          'Las credenciales de Twilio no están configuradas',
          500
        ));
      }

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${messageSid}/Media/${mediaSid}`;

      logger.debug('🔗 PROXY TWILIO MEDIA - URL construida', {
        requestId,
        twilioUrl: twilioUrl.replace(accountSid, '***'),
        userEmail
      });

      // 🔧 SOLUCIÓN: Configuración mejorada con timeout extendido y retry
      const axios = require('axios');
      
      // Función con retry automático para errores de red
      const makeTwilioRequest = async (attempt = 1, maxRetries = 3) => {
        try {
          logger.info(`🔄 PROXY TWILIO MEDIA - Intento ${attempt}/${maxRetries}`, {
            requestId,
            messageSid,
            mediaSid,
            userEmail,
            attempt,
            maxRetries
          });

          const response = await axios({
            method: 'GET',
            url: twilioUrl,
            auth: {
              username: accountSid,
              password: authToken
            },
            responseType: 'stream',
            timeout: 120000, // 🔧 Aumentado a 2 minutos
            maxContentLength: 16 * 1024 * 1024, // 🔧 16MB máximo para WhatsApp
            headers: {
              'User-Agent': 'Utalk-Backend/1.0'
            }
          });

          return response;
        } catch (error) {
          // 🔧 Detectar errores específicos que merecen retry
          const isRetryableError = 
            error.code === 'ECONNABORTED' || 
            error.code === 'ETIMEDOUT' ||
            error.code === 'ECONNRESET' ||
            error.code === 'ENOTFOUND' ||
            (error.response && error.response.status >= 500);

          if (isRetryableError && attempt < maxRetries) {
            const delay = 1000 * attempt; // Backoff exponencial
            logger.warn(`⚠️ PROXY TWILIO MEDIA - Retry en ${delay}ms`, {
              requestId,
              attempt,
              maxRetries,
              error: error.message,
              errorCode: error.code
            });
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return makeTwilioRequest(attempt + 1, maxRetries);
          }
          
          throw error;
        }
      };

      const response = await makeTwilioRequest();

      logger.info('✅ PROXY TWILIO MEDIA - Respuesta exitosa de Twilio', {
        requestId,
        statusCode: response.status,
        contentType: response.headers['content-type'],
        contentLength: response.headers['content-length'],
        userEmail,
        latencyMs: Date.now() - startTime
      });

      // Configurar headers de respuesta
      res.set({
        'Content-Type': response.headers['content-type'] || 'application/octet-stream',
        'Content-Length': response.headers['content-length'],
        'Cache-Control': 'public, max-age=3600', // Cache por 1 hora
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Proxy-By': 'Utalk-Backend',
        'X-Twilio-Message-Sid': messageSid,
        'X-Twilio-Media-Sid': mediaSid
      });

      // Pipe la respuesta de Twilio al cliente
      response.data.pipe(res);

      // Log de finalización
      response.data.on('end', () => {
        logger.info('✅ PROXY TWILIO MEDIA - Transferencia completada', {
          requestId,
          userEmail,
          totalLatencyMs: Date.now() - startTime
        });
      });

      // 🔧 SOLUCIÓN: Manejo mejorado de errores en el stream
      response.data.on('error', (error) => {
        const latencyMs = Date.now() - startTime;
        const isAbortedError = error.message.includes('aborted') || error.code === 'ECONNABORTED';
        
        logger.error('❌ PROXY TWILIO MEDIA - Error en stream', {
          requestId,
          error: error.message,
          errorCode: error.code,
          isAbortedError,
          userEmail,
          latencyMs,
          headersSent: res.headersSent,
          contentType: response.headers['content-type'],
          contentLength: response.headers['content-length']
        });
        
        // 🔧 Manejo específico para errores "aborted"
        if (isAbortedError) {
          logger.warn('⚠️ PROXY TWILIO MEDIA - Cliente abortó la conexión', {
            requestId,
            userEmail,
            latencyMs,
            possibleCauses: [
              'Usuario navegó a otra página',
              'Timeout del navegador',
              'Conexión inestable',
              'Archivo muy grande'
            ]
          });
        }
        
        if (!res.headersSent) {
          const errorMessage = isAbortedError 
            ? 'La descarga fue cancelada por el cliente'
            : 'Error en la transferencia de datos';
            
          ResponseHandler.error(res, new ApiError(
            isAbortedError ? 'CLIENT_ABORTED' : 'STREAM_ERROR',
            errorMessage,
            isAbortedError 
              ? 'El usuario canceló la descarga o la conexión se perdió'
              : 'Ocurrió un error al transferir el archivo',
            isAbortedError ? 499 : 500 // 499 = Client Closed Request
          ));
        }
      });

    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const isAbortedError = error.message.includes('aborted') || error.code === 'ECONNABORTED';
      
      logger.error('❌ PROXY TWILIO MEDIA - Error crítico', {
        requestId,
        error: error.message,
        errorCode: error.code,
        isAbortedError,
        stack: error.stack?.split('\n').slice(0, 5), // Solo primeras 5 líneas
        userEmail: req.user?.email,
        messageSid: req.query.messageSid,
        mediaSid: req.query.mediaSid,
        latencyMs,
        userAgent: req.headers['user-agent']?.substring(0, 100),
        ip: req.ip,
        hasResponse: !!error.response,
        responseStatus: error.response?.status,
        responseData: error.response?.data ? 'present' : 'none'
      });

      // Manejar errores específicos de Twilio
      if (error.response) {
        const statusCode = error.response.status;
        const twilioError = error.response.data;
        
        logger.warn('⚠️ PROXY TWILIO MEDIA - Error de Twilio', {
          requestId,
          statusCode,
          twilioError: typeof twilioError === 'string' ? twilioError.substring(0, 200) : JSON.stringify(twilioError),
          userEmail: req.user?.email
        });

        if (statusCode === 404) {
          return ResponseHandler.error(res, new ApiError(
            'MEDIA_NOT_FOUND',
            'Media no encontrado',
            'El archivo multimedia no existe o no está disponible',
            404
          ));
        } else if (statusCode === 401) {
          return ResponseHandler.error(res, new ApiError(
            'TWILIO_AUTH_ERROR',
            'Error de autenticación con Twilio',
            'Las credenciales de Twilio no son válidas',
            500
          ));
        } else {
          return ResponseHandler.error(res, new ApiError(
            'TWILIO_ERROR',
            'Error de Twilio',
            `Twilio devolvió un error: ${statusCode}`,
            statusCode
          ));
        }
      }

      // Error de red o timeout
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return ResponseHandler.error(res, new ApiError(
          'TIMEOUT_ERROR',
          'Timeout en la conexión',
          'La conexión con Twilio tardó demasiado',
          504
        ));
      }

      // Error genérico
      return ResponseHandler.error(res, new ApiError(
        'PROXY_ERROR',
        'Error en el proxy',
        'Ocurrió un error al procesar la solicitud',
        500
      ));
    }
  }

  /**
   * 🔗 GET /api/media/permanent-url/:fileId
   * Generar URL permanente para archivo almacenado
   */
  async generatePermanentUrl(req, res) {
    const startTime = Date.now();
    const requestId = `permanent_url_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const { fileId } = req.params;
      const userEmail = req.user?.email || 'anonymous';
      
      logger.info('🔗 GENERAR URL PERMANENTE - Iniciando', {
        requestId,
        fileId,
        userEmail
      });
      
      // Validar fileId
      if (!fileId) {
        return ResponseHandler.error(res, new ApiError(
          'MISSING_FILE_ID',
          'ID de archivo requerido',
          'Proporciona el ID del archivo',
          400
        ));
      }
      
      // Obtener archivo de la base de datos
      const File = require('../models/File');
      const file = await File.getById(fileId);
      
      if (!file) {
        return ResponseHandler.error(res, new ApiError(
          'FILE_NOT_FOUND',
          'Archivo no encontrado',
          'El archivo especificado no existe',
          404
        ));
      }
      
      // Generar nueva URL firmada si es necesario
      let publicUrl = file.publicUrl;
      
      if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
        logger.info('🔄 Regenerando URL firmada expirada', {
          requestId,
          fileId,
          expiresAt: file.expiresAt
        });
        
        const FileService = require('../services/FileService');
        const fileService = new FileService();
        
        try {
          const bucket = fileService.getBucket();
          const storageFile = bucket.file(file.storagePath);
          
          const [newSignedUrl] = await storageFile.getSignedUrl({
            action: 'read',
            expires: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
          });
          
          // Actualizar archivo en base de datos
          await file.update({
            publicUrl: newSignedUrl,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          });
          
          publicUrl = newSignedUrl;
          
          logger.info('✅ URL firmada regenerada exitosamente', {
            requestId,
            fileId
          });
        } catch (regenerateError) {
          logger.error('❌ Error regenerando URL firmada', {
            requestId,
            fileId,
            error: regenerateError.message
          });
          // Continuar con la URL existente
        }
      }
      
      // Generar URL permanente del proxy
      const permanentUrl = `${process.env.BASE_URL || 'https://utalk-backend-production.up.railway.app'}/api/media/proxy-file/${fileId}`;
      
      logger.info('✅ URL PERMANENTE GENERADA', {
        requestId,
        fileId,
        permanentUrl,
        latencyMs: Date.now() - startTime
      });
      
      return ResponseHandler.success(res, {
        permanentUrl,
        originalUrl: publicUrl,
        fileId: file.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.mimetype,
        expiresAt: file.expiresAt
      }, 'URL permanente generada exitosamente');
      
    } catch (error) {
      logger.error('❌ Error generando URL permanente', {
        requestId,
        fileId: req.params?.fileId,
        error: error.message,
        stack: error.stack
      });
      
      return ResponseHandler.error(res, new ApiError(
        'PERMANENT_URL_ERROR',
        'Error generando URL permanente',
        'Ocurrió un error al generar la URL permanente',
        500
      ));
    }
  }

  /**
   * 🔗 GET /api/media/proxy-file/:fileId
   * Proxy para archivos almacenados en Firebase
   */
  async proxyStoredFile(req, res) {
    const startTime = Date.now();
    const requestId = `proxy_file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const { fileId } = req.params;
      const userEmail = req.user?.email || 'anonymous';
      
      logger.info('🔗 PROXY ARCHIVO ALMACENADO - Iniciando', {
        requestId,
        fileId,
        userEmail
      });
      
      // Obtener archivo de la base de datos
      const File = require('../models/File');
      const file = await File.getById(fileId);
      
      if (!file) {
        return ResponseHandler.error(res, new ApiError(
          'FILE_NOT_FOUND',
          'Archivo no encontrado',
          'El archivo especificado no existe',
          404
        ));
      }
      
      // Verificar que el archivo existe en Storage
      const FileService = require('../services/FileService');
      const fileService = new FileService();
      const bucket = fileService.getBucket();
      const storageFile = bucket.file(file.storagePath);
      
      const [exists] = await storageFile.exists();
      if (!exists) {
        return ResponseHandler.error(res, new ApiError(
          'FILE_NOT_FOUND_IN_STORAGE',
          'Archivo no encontrado en almacenamiento',
          'El archivo no existe en el almacenamiento',
          404
        ));
      }
      
      // Generar URL firmada si es necesario
      let publicUrl = file.publicUrl;
      
      if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
        const [newSignedUrl] = await storageFile.getSignedUrl({
          action: 'read',
          expires: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
        });
        
        await file.update({
          publicUrl: newSignedUrl,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
        
        publicUrl = newSignedUrl;
      }
      
      // Descargar archivo de Firebase Storage
      const [fileBuffer] = await storageFile.download();
      
      // Configurar headers de respuesta
      res.set({
        'Content-Type': file.mimetype || 'application/octet-stream',
        'Content-Length': file.size,
        'Cache-Control': 'public, max-age=3600', // Cache por 1 hora
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Proxy-By': 'Utalk-Backend',
        'X-File-Id': fileId,
        'X-File-Name': file.name
      });
      
      // Enviar archivo
      res.send(fileBuffer);
      
      logger.info('✅ PROXY ARCHIVO ALMACENADO - Transferencia completada', {
        requestId,
        fileId,
        userEmail,
        latencyMs: Date.now() - startTime
      });
      
    } catch (error) {
      logger.error('❌ Error en proxy de archivo almacenado', {
        requestId,
        fileId: req.params?.fileId,
        error: error.message,
        stack: error.stack
      });
      
      return ResponseHandler.error(res, new ApiError(
        'PROXY_FILE_ERROR',
        'Error en proxy de archivo',
        'Ocurrió un error al servir el archivo',
        500
      ));
    }
  }
}

module.exports = new MediaUploadController(); 