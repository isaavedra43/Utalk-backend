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
   * Subida optimizada con indexación automática
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

      const { conversationId, tags } = req.body;
      if (!conversationId) {
        return ResponseHandler.error(res, new ApiError(
          'MISSING_CONVERSATION_ID',
          'ID de conversación requerido',
          'Incluye el conversationId en el cuerpo de la petición',
          400
        ));
      }

      const file = req.file;
      const userEmail = req.user.email;

      logger.info('🔄 Iniciando subida de archivo optimizada', {
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        conversationId,
        uploadedBy: userEmail
      });

      // Subir archivo con indexación automática
      const result = await this.fileService.uploadFile({
        buffer: file.buffer,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        conversationId,
        userId: req.user.id,
        uploadedBy: userEmail,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : []
      });

      // Verificar compatibilidad con WhatsApp para Twilio
      const isWhatsAppCompatible = this.isWhatsAppCompatible(file.mimetype, file.size);

      const response = {
        ...result,
        whatsAppCompatible: isWhatsAppCompatible
      };

      logger.info('✅ Archivo subido exitosamente con indexación', {
        fileId: result.id,
        category: result.category,
        size: result.size,
        uploadedBy: userEmail,
        conversationId
      });

      return ResponseHandler.success(res, response, 'Archivo subido exitosamente con indexación');

    } catch (error) {
      logger.error('❌ Error subiendo archivo optimizado:', {
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
}

module.exports = new MediaUploadController(); 