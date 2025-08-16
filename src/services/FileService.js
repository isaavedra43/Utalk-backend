const File = require('../models/File');
const { logger } = require('../utils/logger');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const AudioProcessor = require('./AudioProcessor');
const path = require('path');
const { FieldValue } = require('firebase-admin');
const firestore = require('firebase-admin').firestore();

/**
 * 📁 SERVICIO DE GESTIÓN DE ARCHIVOS OPTIMIZADO
 * 
 * Proporciona gestión eficiente de archivos con indexación
 * para consultas rápidas sin recorrer el bucket completo.
 * 
 * @version 2.0.0
 * @author Backend Team
 */
class FileService {
  constructor() {
    // Configuración de tipos de archivo permitidos
    this.allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    this.allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi'];
    this.allowedAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/m4a'];
    this.allowedDocumentTypes = ['application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    
    // 🆕 SOPORTE PARA STICKERS DE WHATSAPP
    this.allowedStickerTypes = ['image/webp', 'image/png']; // WhatsApp usa principalmente WebP para stickers

    // Límites de tamaño (en bytes)
    this.maxImageSize = 10 * 1024 * 1024; // 10MB
    this.maxVideoSize = 100 * 1024 * 1024; // 100MB
    this.maxAudioSize = 50 * 1024 * 1024; // 50MB
    this.maxDocumentSize = 25 * 1024 * 1024; // 25MB
    this.maxStickerSize = 5 * 1024 * 1024; // 5MB para stickers

    // 🆕 ⚡ CACHE PARA OPTIMIZACIÓN DE RENDIMIENTO
    this.fileCache = new Map();
    this.previewCache = new Map();
    this.metadataCache = new Map();
    
    // Configuración de cache
    this.cacheConfig = {
      maxSize: 100, // Máximo número de archivos en cache
      ttl: 30 * 60 * 1000, // 30 minutos
      cleanupInterval: 5 * 60 * 1000 // 5 minutos
    };
    
    // Iniciar limpieza automática de cache
    this.startCacheCleanup();
    
    // Métricas de rendimiento
    this.performanceMetrics = {
      filesProcessed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      processingTimes: [],
      errors: 0
    };

    // 🔄 FASE 8: Sistema de tracking de uso de archivos
    this.usageTracking = {
      enabled: true,
      trackViews: true,
      trackDownloads: true,
      trackShares: true,
      trackUploads: true,
      trackDeletes: true
    };
  }

  /**
   * Obtener bucket de Firebase Storage de forma segura
   */
  getBucket() {
    try {
      if (!admin.apps.length) {
        throw new Error('Firebase Admin SDK no inicializado');
      }
      const bucket = admin.storage().bucket();
      if (!bucket) {
        throw new Error('Bucket de Firebase Storage no disponible');
      }
      return bucket;
    } catch (error) {
      logger.error('Error obteniendo bucket de Firebase Storage:', error);
      throw new Error('Firebase Storage no disponible: ' + error.message);
    }
  }

  /**
   * Obtener attachments por IDs
   */
  async getAttachmentsByIds(attachmentIds) {
    try {
      const attachments = [];
      
      for (const id of attachmentIds) {
        const file = await File.getById(id);
        if (file) {
          attachments.push({
            id: file.id,
            url: file.url,
            mime: file.mimetype,
            name: file.originalName,
            size: file.size,
            type: this.getFileType(file.mimetype)
          });
        }
      }
      
      return attachments;
    } catch (error) {
      logger.error('Error obteniendo attachments por IDs:', error);
      throw error;
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
   * 🆕 Subir archivo con indexación automática
   */
  async uploadFile(fileData, options = {}) {
    const startTime = Date.now();
    
    try {
      const {
        buffer,
        originalName,
        mimetype,
        size,
        conversationId,
        messageId = null,
        userId,
        uploadedBy,
        tags = []
      } = fileData;

      logger.info('🔄 Iniciando subida de archivo con indexación', {
        originalName,
        mimetype,
        size,
        conversationId,
        uploadedBy
      });

      // Validar archivo
      const validation = this.validateFile({ buffer, mimetype, size });
      if (!validation || !validation.valid) {
        const errorMessage = validation && validation.error ? validation.error : 'Error de validación desconocido';
        throw new Error(`Archivo inválido: ${errorMessage}`);
      }

      const category = validation.category;
      const fileId = uuidv4();

      // 🆕 EMITIR EVENTO DE PROCESAMIENTO INICIADO
      try {
        const { EnterpriseSocketManager } = require('../socket/enterpriseSocketManager');
        const socketManager = new EnterpriseSocketManager();
        
        socketManager.emitFileProcessing({
          fileId: fileId,
          conversationId: conversationId || 'general',
          progress: 0,
          stage: 'uploading',
          processedBy: uploadedBy
        });
      } catch (socketError) {
        logger.warn('⚠️ Error emitiendo evento de procesamiento iniciado', {
          error: socketError.message,
          fileId
        });
      }

      // Procesar archivo según su tipo
      const processedFile = await this.processFileByCategory(
        buffer, fileId, conversationId, category, mimetype, originalName
      );

      // Validar que processedFile existe y tiene las propiedades necesarias
      if (!processedFile) {
        throw new Error('Error: No se pudo procesar el archivo. Resultado indefinido.');
      }

      // 🆕 Guardar archivo en base de datos con metadata completa
      let fileRecord;
      try {
        fileRecord = await this.saveFileToDatabase({
          fileId,
          conversationId,
          userId,
          uploadedBy,
          originalName,
          mimetype,
          size,
          url: processedFile.storageUrl,
          thumbnailUrl: processedFile.metadata?.thumbnailUrl,
          previewUrl: processedFile.metadata?.previewUrl,
          metadata: processedFile.metadata || {},
          category,
          storagePath: processedFile.storagePath,
          publicUrl: processedFile.publicUrl,
          tags
        });
      } catch (dbError) {
        logger.error('❌ Error guardando archivo en base de datos', {
          fileId,
          conversationId,
          error: dbError.message,
          stack: dbError.stack
        });
        throw dbError;
      }

      const processTime = Date.now() - startTime;

      logger.info('✅ Archivo subido exitosamente con indexación', {
        fileId,
        category,
        size: this.formatFileSize(size),
        storagePath: processedFile.storagePath,
        processTime: `${processTime}ms`,
        uploadedBy
      });

      // 🆕 EMITIR EVENTO DE ARCHIVO LISTO
      try {
        const { EnterpriseSocketManager } = require('../socket/enterpriseSocketManager');
        const socketManager = new EnterpriseSocketManager();
        
        socketManager.emitFileReady({
          fileId: fileId,
          conversationId: conversationId || 'general',
          fileUrl: processedFile.publicUrl,
          metadata: {
            category,
            size: this.formatFileSize(size),
            processTime: `${processTime}ms`,
            storagePath: processedFile.storagePath
          },
          readyBy: uploadedBy
        });
      } catch (socketError) {
        logger.warn('⚠️ Error emitiendo evento de archivo listo', {
          error: socketError.message,
          fileId
        });
      }

      return {
        ...(fileRecord ? fileRecord.toJSON() : {}),
        processTime: `${processTime}ms`
      };

    } catch (error) {
      logger.error('❌ Error subiendo archivo con indexación', {
        originalName: fileData.originalName,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3)
      });
      throw error;
    }
  }

  /**
   * 🔍 Buscar archivo por ID (eficiente)
   */
  async getFileById(fileId) {
    try {
      logger.info('🔍 Buscando archivo por ID', { fileId });

      const file = await File.getById(fileId);
      
      if (!file) {
        logger.warn('⚠️ Archivo no encontrado', { fileId });
        return null;
      }

      // Verificar que el archivo existe en Storage
      const bucket = this.getBucket();
      const storageFile = bucket.file(file.storagePath);
      const [exists] = await storageFile.exists();

      if (!exists) {
        logger.warn('⚠️ Archivo encontrado en índice pero no en Storage', { 
          fileId, 
          storagePath: file.storagePath 
        });
        
        // Marcar como eliminado en la base de datos
        await file.update({ isActive: false });
        return null;
      }

      // Generar nueva URL firmada si es necesario
      if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
        const [newSignedUrl] = await storageFile.getSignedUrl({
          action: 'read',
          expires: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
        });

        await file.update({ 
          publicUrl: newSignedUrl,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
      }

      logger.info('✅ Archivo encontrado exitosamente', { fileId });
      return file.toJSON();

    } catch (error) {
      logger.error('❌ Error buscando archivo por ID', {
        fileId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 📋 Listar archivos por conversación (eficiente)
   */
  async listFilesByConversation(conversationId, options = {}) {
    try {
      const {
        limit = 50,
        startAfter = null,
        category = null,
        isActive = true
      } = options;

      logger.info('📋 Listando archivos por conversación', {
        conversationId,
        limit,
        category,
        isActive
      });

      const files = await File.listByConversation(conversationId, {
        limit,
        startAfter,
        category,
        isActive
      });

      logger.info('✅ Archivos listados exitosamente', {
        conversationId,
        count: files.length
      });

      return files.map(file => file.toJSON());

    } catch (error) {
      logger.error('❌ Error listando archivos por conversación', {
        conversationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 👤 Listar archivos por usuario (eficiente)
   */
  async listFilesByUser(userId, options = {}) {
    try {
      const {
        limit = 50,
        startAfter = null,
        category = null,
        isActive = true
      } = options;

      logger.info('👤 Listando archivos por usuario', {
        userId,
        limit,
        category,
        isActive
      });

      const files = await File.listByUser(userId, {
        limit,
        startAfter,
        category,
        isActive
      });

      logger.info('✅ Archivos de usuario listados exitosamente', {
        userId,
        count: files.length
      });

      return files.map(file => file.toJSON());

    } catch (error) {
      logger.error('❌ Error listando archivos por usuario', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🗂️ Listar archivos por categoría (eficiente)
   */
  async listFilesByCategory(category, options = {}) {
    try {
      const {
        limit = 50,
        startAfter = null,
        isActive = true
      } = options;

      logger.info('🗂️ Listando archivos por categoría', {
        category,
        limit,
        isActive
      });

      const files = await File.listByCategory(category, {
        limit,
        startAfter,
        isActive
      });

      logger.info('✅ Archivos por categoría listados exitosamente', {
        category,
        count: files.length
      });

      return files.map(file => file.toJSON());

    } catch (error) {
      logger.error('❌ Error listando archivos por categoría', {
        category,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 📅 Listar archivos por fecha (eficiente)
   */
  async listFilesByDate(date, options = {}) {
    try {
      const {
        limit = 50,
        startAfter = null,
        category = null,
        isActive = true
      } = options;

      logger.info('📅 Listando archivos por fecha', {
        date,
        limit,
        category,
        isActive
      });

      const files = await File.listByDate(date, {
        limit,
        startAfter,
        category,
        isActive
      });

      logger.info('✅ Archivos por fecha listados exitosamente', {
        date,
        count: files.length
      });

      return files.map(file => file.toJSON());

    } catch (error) {
      logger.error('❌ Error listando archivos por fecha', {
        date,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🔍 Buscar archivos por texto (eficiente)
   */
  async searchFiles(searchTerm, options = {}) {
    try {
      const {
        limit = 50,
        category = null,
        userId = null,
        isActive = true
      } = options;

      logger.info('🔍 Buscando archivos por texto', {
        searchTerm,
        limit,
        category,
        userId,
        isActive
      });

      const files = await File.search(searchTerm, {
        limit,
        category,
        userId,
        isActive
      });

      logger.info('✅ Búsqueda de archivos completada', {
        searchTerm,
        count: files.length
      });

      return files.map(file => file.toJSON());

    } catch (error) {
      logger.error('❌ Error buscando archivos', {
        searchTerm,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 📊 Obtener estadísticas de archivos
   */
  async getFileStats(options = {}) {
    try {
      const {
        userId = null,
        conversationId = null,
        category = null,
        startDate = null,
        endDate = null
      } = options;

      logger.info('📊 Obteniendo estadísticas de archivos', {
        userId,
        conversationId,
        category,
        startDate,
        endDate
      });

      const stats = await File.getStats({
        userId,
        conversationId,
        category,
        startDate,
        endDate
      });

      logger.info('✅ Estadísticas de archivos obtenidas', {
        total: stats.total,
        totalSize: this.formatFileSize(stats.totalSize)
      });

      return {
        ...stats,
        totalSizeFormatted: this.formatFileSize(stats.totalSize),
        averageSizeFormatted: this.formatFileSize(stats.averageSize)
      };

    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas de archivos', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🗑️ Eliminar archivo (soft delete)
   */
  async deleteFile(fileId, userId) {
    try {
      logger.info('🗑️ Eliminando archivo', { fileId, userId });

      const file = await File.getById(fileId);
      if (!file) {
        throw new Error('Archivo no encontrado');
      }

      // Verificar permisos (solo el propietario o admin puede eliminar)
      if (file.uploadedBy !== userId) {
        throw new Error('No tienes permisos para eliminar este archivo');
      }

      // Soft delete en la base de datos
      await file.delete();

      // Eliminar de Firebase Storage
      const bucket = this.getBucket();
      const storageFile = bucket.file(file.storagePath);
      await storageFile.delete();

      logger.info('✅ Archivo eliminado exitosamente', {
        fileId,
        storagePath: file.storagePath,
        deletedBy: userId
      });

      return {
        fileId,
        deleted: true,
        deletedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('❌ Error eliminando archivo', {
        fileId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🗑️ Eliminar archivo permanentemente
   */
  async hardDeleteFile(fileId, userId) {
    try {
      logger.info('🗑️ Eliminando archivo permanentemente', { fileId, userId });

      const file = await File.getById(fileId);
      if (!file) {
        throw new Error('Archivo no encontrado');
      }

      // Verificar permisos
      if (file.uploadedBy !== userId) {
        throw new Error('No tienes permisos para eliminar este archivo');
      }

      // Eliminar de Firebase Storage
      const bucket = this.getBucket();
      const storageFile = bucket.file(file.storagePath);
      await storageFile.delete();

      // Eliminar de la base de datos y todos los índices
      await file.hardDelete();

      logger.info('✅ Archivo eliminado permanentemente', {
        fileId,
        storagePath: file.storagePath,
        deletedBy: userId
      });

      return {
        fileId,
        hardDeleted: true,
        deletedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('❌ Error eliminando archivo permanentemente', {
        fileId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 📥 Descargar archivo
   */
  async downloadFile(fileId, userId) {
    try {
      logger.info('📥 Descargando archivo', { fileId, userId });

      const file = await File.getById(fileId);
      if (!file || !file.isActive) {
        throw new Error('Archivo no encontrado o inactivo');
      }

      // Incrementar contador de descargas
      await file.incrementDownloadCount();

      // Generar nueva URL firmada
      const bucket = this.getBucket();
      const storageFile = bucket.file(file.storagePath);
      const [signedUrl] = await storageFile.getSignedUrl({
        action: 'read',
        expires: Date.now() + 1 * 60 * 60 * 1000 // 1 hora
      });

      logger.info('✅ Archivo preparado para descarga', {
        fileId,
        downloadCount: file.downloadCount + 1
      });

      return {
        fileId,
        downloadUrl: signedUrl,
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
        downloadCount: file.downloadCount + 1
      };

    } catch (error) {
      logger.error('❌ Error descargando archivo', {
        fileId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🏷️ Agregar tags a archivo
   */
  async addTagsToFile(fileId, tags, userId) {
    try {
      logger.info('🏷️ Agregando tags a archivo', { fileId, tags, userId });

      const file = await File.getById(fileId);
      if (!file) {
        throw new Error('Archivo no encontrado');
      }

      // Verificar permisos
      if (file.uploadedBy !== userId) {
        throw new Error('No tienes permisos para modificar este archivo');
      }

      await file.addTags(tags);

      logger.info('✅ Tags agregados exitosamente', {
        fileId,
        tags,
        totalTags: file.tags.length
      });

      return file.toJSON();

    } catch (error) {
      logger.error('❌ Error agregando tags', {
        fileId,
        tags,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🏷️ Remover tags de archivo
   */
  async removeTagsFromFile(fileId, tags, userId) {
    try {
      logger.info('🏷️ Removiendo tags de archivo', { fileId, tags, userId });

      const file = await File.getById(fileId);
      if (!file) {
        throw new Error('Archivo no encontrado');
      }

      // Verificar permisos
      if (file.uploadedBy !== userId) {
        throw new Error('No tienes permisos para modificar este archivo');
      }

      await file.removeTags(tags);

      logger.info('✅ Tags removidos exitosamente', {
        fileId,
        tags,
        remainingTags: file.tags.length
      });

      return file.toJSON();

    } catch (error) {
      logger.error('❌ Error removiendo tags', {
        fileId,
        tags,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Procesar archivo según su categoría
   */
  async processFileByCategory(buffer, fileId, conversationId, category, mimetype, originalName) {
    try {
      let result;
      
      switch (category) {
        case 'audio':
          result = await this.processAudioFile(buffer, fileId, conversationId, mimetype, originalName);
          break;
        case 'image':
          result = await this.processImageFile(buffer, fileId, conversationId, mimetype, originalName);
          break;
        case 'video':
        case 'document':
        default:
          result = await this.processGenericFile(buffer, fileId, conversationId, category, mimetype, originalName);
          break;
      }

      // Validar que el resultado existe
      if (!result) {
        throw new Error(`Error procesando archivo de categoría ${category}: resultado indefinido`);
      }

      return result;
    } catch (error) {
      logger.error('❌ Error en processFileByCategory', {
        category,
        fileId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Procesar archivo de audio
   */
  async processAudioFile(buffer, fileId, conversationId, mimetype, originalName) {
    try {
      const processor = new AudioProcessor();
      const processedAudio = await processor.processAudio(buffer, fileId, mimetype);

      const storagePath = `audio/${conversationId}/${fileId}.mp3`;
      const bucket = this.getBucket();
      const file = bucket.file(storagePath);

      await file.save(processedAudio.buffer, {
        metadata: {
          contentType: 'audio/mp3',
          metadata: {
            originalFormat: mimetype,
            originalName,
            processedAt: new Date().toISOString(),
            duration: processedAudio.metadata.duration,
            bitrate: processedAudio.metadata.bitrate
          }
        }
      });

      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
      });

      const result = {
        storagePath,
        storageUrl: `gs://${bucket.name}/${storagePath}`,
        publicUrl: signedUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: processedAudio.metadata || {}
      };

      // Validar que el resultado tiene las propiedades necesarias
      if (!result.storagePath || !result.publicUrl) {
        throw new Error('Error: Resultado de procesamiento de audio incompleto');
      }

      return result;
    } catch (error) {
      logger.error('Error procesando audio:', error);
      throw error;
    }
  }

  /**
   * Procesar archivo de imagen
   */
  async processImageFile(buffer, fileId, conversationId, mimetype, originalName) {
    try {
      // Optimizar imagen con Sharp
      const optimizedBuffer = await sharp(buffer)
        .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      const storagePath = `images/${conversationId}/${fileId}.jpg`;
      const bucket = this.getBucket();
      const file = bucket.file(storagePath);

      await file.save(optimizedBuffer, {
        metadata: {
          contentType: 'image/jpeg',
          metadata: {
            originalFormat: mimetype,
            originalName,
            processedAt: new Date().toISOString(),
            optimized: true
          }
        }
      });

      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
      });

      const result = {
        storagePath,
        storageUrl: `gs://${bucket.name}/${storagePath}`,
        publicUrl: signedUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          originalSize: buffer.length,
          optimizedSize: optimizedBuffer.length,
          compression: ((buffer.length - optimizedBuffer.length) / buffer.length * 100).toFixed(1) + '%'
        }
      };

      // Validar que el resultado tiene las propiedades necesarias
      if (!result.storagePath || !result.publicUrl) {
        throw new Error('Error: Resultado de procesamiento de imagen incompleto');
      }

      return result;
    } catch (error) {
      logger.error('Error procesando imagen:', error);
      throw error;
    }
  }

  /**
   * Procesar archivo genérico
   */
  async processGenericFile(buffer, fileId, conversationId, category, mimetype, originalName) {
    try {
      const extension = this.getFileExtension(mimetype);
      const storagePath = `${category}/${conversationId}/${fileId}.${extension}`;
      const bucket = this.getBucket();
      const file = bucket.file(storagePath);

      await file.save(buffer, {
        metadata: {
          contentType: mimetype,
          metadata: {
            originalName,
            processedAt: new Date().toISOString(),
            category
          }
        }
      });

      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
      });

      const result = {
        storagePath,
        storageUrl: `gs://${bucket.name}/${storagePath}`,
        publicUrl: signedUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          originalSize: buffer.length
        }
      };

      // Validar que el resultado tiene las propiedades necesarias
      if (!result.storagePath || !result.publicUrl) {
        throw new Error('Error: Resultado de procesamiento de archivo genérico incompleto');
      }

      return result;
    } catch (error) {
      logger.error('Error procesando archivo genérico:', error);
      throw error;
    }
  }

  /**
   * Validar archivo
   */
  validateFile(file) {
    const { buffer, mimetype, size } = file;

    if (!buffer || !mimetype || !size) {
      return { valid: false, error: 'Datos de archivo incompletos' };
    }

    const category = this.getFileCategory(mimetype);

    if (category === 'unknown') {
      return { valid: false, error: `Tipo de archivo no permitido: ${mimetype}` };
    }

    const maxSize = this.getMaxSize(category);
    if (size > maxSize) {
      return { valid: false, error: `Archivo demasiado grande. Máximo: ${this.formatFileSize(maxSize)}` };
    }

    return { valid: true, category };
  }

  /**
   * Obtener categoría del archivo
   */
  getFileCategory(mimeType) {
    if (this.allowedImageTypes.includes(mimeType)) return 'image';
    if (this.allowedVideoTypes.includes(mimeType)) return 'video';
    if (this.allowedAudioTypes.includes(mimeType)) return 'audio';
    if (this.allowedDocumentTypes.includes(mimeType)) return 'document';
    if (this.allowedStickerTypes.includes(mimeType)) return 'sticker';
    return 'unknown';
  }

  /**
   * Obtener tamaño máximo por categoría
   */
  getMaxSize(category) {
    switch (category) {
      case 'image': return this.maxImageSize;
      case 'video': return this.maxVideoSize;
      case 'audio': return this.maxAudioSize;
      case 'document': return this.maxDocumentSize;
      case 'sticker': return this.maxStickerSize;
      default: return this.maxDocumentSize;
    }
  }

  /**
   * Obtener extensión de archivo
   */
  getFileExtension(mimeType) {
    const mimeMap = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/webm': 'webm',
      'audio/m4a': 'm4a',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/ogg': 'ogv',
      'video/avi': 'avi',
      'application/pdf': 'pdf',
      'text/plain': 'txt',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
    };
    return mimeMap[mimeType] || 'bin';
  }

  /**
   * Formatear tamaño de archivo
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 🆕 PROCESAR ARCHIVOS ADJUNTOS EN MENSAJES
   * Método crítico para integrar archivos con el sistema de mensajes
   */
  async processMessageAttachments(attachments, userEmail, conversationId = null) {
    try {
      logger.info('🔄 Procesando archivos adjuntos para mensaje', {
        attachmentCount: attachments.length,
        userEmail: userEmail?.substring(0, 20) + '...',
        conversationId: conversationId?.substring(0, 20) + '...'
      });

      const processedAttachments = [];

      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];
        
        try {
          // Validar que el attachment tenga los datos necesarios
          if (!attachment.buffer || !attachment.type || !attachment.name) {
            logger.warn('⚠️ Attachment inválido, saltando', {
              index: i,
              hasBuffer: !!attachment.buffer,
              hasType: !!attachment.type,
              hasName: !!attachment.name
            });
            continue;
          }

          // Procesar archivo usando el método existente
          const result = await this.uploadFile({
            buffer: attachment.buffer,
            originalName: attachment.name,
            mimetype: attachment.type,
            size: attachment.size || attachment.buffer.length,
            conversationId,
            uploadedBy: userEmail,
            tags: ['message-attachment']
          });

          // Formatear respuesta para el mensaje
          const processedAttachment = {
            id: result.id,
            url: result.publicUrl,
            mime: result.mimeType,
            name: result.originalName,
            size: result.size,
            type: this.getFileType(result.mimeType),
            category: result.category,
            metadata: result.metadata || {}
          };

          processedAttachments.push(processedAttachment);

          logger.info('✅ Attachment procesado exitosamente', {
            index: i,
            fileId: result.id,
            type: processedAttachment.type,
            size: result.size
          });

        } catch (attachmentError) {
          logger.error('❌ Error procesando attachment individual', {
            index: i,
            attachmentName: attachment.name,
            error: attachmentError.message
          });
          
          // Continuar con el siguiente attachment en lugar de fallar completamente
          continue;
        }
      }

      logger.info('✅ Procesamiento de attachments completado', {
        totalAttachments: attachments.length,
        processedSuccessfully: processedAttachments.length,
        failed: attachments.length - processedAttachments.length
      });

      return {
        attachments: processedAttachments,
        count: processedAttachments.length,
        success: processedAttachments.length > 0
      };

    } catch (error) {
      logger.error('❌ Error crítico procesando attachments', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        userEmail: userEmail?.substring(0, 20) + '...'
      });
      
      throw new Error(`Error procesando archivos adjuntos: ${error.message}`);
    }
  }

  /**
   * 🆕 PROCESAR ATTACHMENT ÚNICO (Método simplificado)
   */
  async processSingleAttachment(attachment, userEmail, conversationId = null) {
    try {
      const result = await this.processMessageAttachments([attachment], userEmail, conversationId);
      return result.attachments[0] || null;
    } catch (error) {
      logger.error('❌ Error procesando attachment único', {
        attachmentName: attachment.name,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🆕 📱 VALIDACIÓN DE COMPATIBILIDAD CON WHATSAPP
   * Valida si un archivo cumple con los límites y formatos de WhatsApp.
   * @param {object} file - Objeto de archivo con mimetype y size.
   * @returns {object} { isValid: boolean, message: string, category: string, maxSize: number }
   */
  validateWhatsAppCompatibility(file) {
    try {
      const { mimetype, size } = file;
      
      // Límites de tamaño por categoría (en MB)
      const WHATSAPP_LIMITS = {
        image: {
          maxSize: 5,   // 5MB para imágenes
          formats: ['image/jpeg', 'image/png', 'image/webp'],
          maxDimensions: { width: 4096, height: 4096 }
        },
        video: {
          maxSize: 16,  // 16MB para videos
          formats: ['video/mp4', 'video/3gpp', 'video/avi', 'video/mov'],
          maxDuration: 180, // 3 minutos máximo
          maxBitrate: 2000000 // 2Mbps máximo
        },
        audio: {
          maxSize: 16,  // 16MB para audios
          formats: ['audio/mpeg', 'audio/ogg', 'audio/amr', 'audio/aac', 'audio/mp4', 'audio/wav'],
          maxDuration: 7200 // 2 horas máximo
        },
        document: {
          maxSize: 100, // 100MB para documentos
          formats: [
            'application/pdf',
            'application/msword', // .doc
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/vnd.ms-excel', // .xls
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-powerpoint', // .ppt
            'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
            'text/plain', // .txt
            'application/json',
            'application/xml',
            'text/csv',
            'application/zip',
            'application/x-rar-compressed'
          ]
        },
        sticker: {
          maxSize: 0.1, // 100KB para stickers
          formats: ['image/webp', 'image/png'],
          maxDimensions: { width: 512, height: 512 },
          maxFrames: 30 // Para stickers animados
        }
      };

      const fileSizeMB = size / (1024 * 1024);

      // Determinar la categoría del archivo
      let category = 'document';
      if (mimetype.startsWith('image/')) {
        category = 'image';
        // Detectar si es sticker
        if (mimetype === 'image/webp' || (mimetype === 'image/png' && fileSizeMB <= 0.1)) {
          category = 'sticker';
        }
      } else if (mimetype.startsWith('video/')) {
        category = 'video';
      } else if (mimetype.startsWith('audio/')) {
        category = 'audio';
      }

      const limits = WHATSAPP_LIMITS[category];
      if (!limits) {
        return {
          isValid: false,
          message: `Categoría de archivo no soportada: ${category}`,
          category: 'unknown',
          maxSize: 0
        };
      }

      // 1. Validar formato de archivo
      if (!limits.formats.includes(mimetype)) {
        return {
          isValid: false,
          message: `Formato no soportado por WhatsApp para ${category}: ${mimetype}. Formatos soportados: ${limits.formats.join(', ')}`,
          category,
          maxSize: limits.maxSize,
          supportedFormats: limits.formats
        };
      }

      // 2. Validar tamaño del archivo
      if (fileSizeMB > limits.maxSize) {
        return {
          isValid: false,
          message: `El archivo excede el tamaño máximo permitido por WhatsApp para ${category} (${limits.maxSize}MB). Tamaño actual: ${fileSizeMB.toFixed(2)}MB`,
          category,
          maxSize: limits.maxSize,
          currentSize: fileSizeMB
        };
      }

      // 3. Validaciones específicas por categoría
      if (category === 'sticker') {
        // Validaciones adicionales para stickers
        if (fileSizeMB > 0.1) { // 100KB máximo para stickers
          return {
            isValid: false,
            message: `El sticker excede el tamaño máximo (100KB). Tamaño actual: ${fileSizeMB.toFixed(3)}MB`,
            category,
            maxSize: 0.1,
            currentSize: fileSizeMB
          };
        }
      }

      logger.info('✅ Archivo validado para WhatsApp', {
        category,
        mimetype,
        size: `${fileSizeMB.toFixed(2)}MB`,
        maxSize: `${limits.maxSize}MB`
      });

      return {
        isValid: true,
        message: `Archivo compatible con WhatsApp (${category})`,
        category,
        maxSize: limits.maxSize,
        currentSize: fileSizeMB,
        supportedFormats: limits.formats
      };

    } catch (error) {
      logger.error('❌ Error validando compatibilidad con WhatsApp', {
        error: error.message,
        file: {
          mimetype: file?.mimetype,
          size: file?.size
        }
      });

      return {
        isValid: false,
        message: `Error validando archivo: ${error.message}`,
        category: 'error',
        maxSize: 0
      };
    }
  }

  /**
   * 🆕 🔄 CONVERSIÓN AUTOMÁTICA PARA WHATSAPP
   * Convierte automáticamente archivos para que sean compatibles con WhatsApp.
   * @param {object} file - Objeto de archivo con buffer, mimetype y size.
   * @returns {object} { success: boolean, convertedFile: object, message: string }
   */
  async convertForWhatsApp(file) {
    try {
      const { buffer, mimetype, size, originalName } = file;
      
      logger.info('🔄 Iniciando conversión para WhatsApp', {
        originalMimetype: mimetype,
        originalSize: `${(size / (1024 * 1024)).toFixed(2)}MB`,
        originalName
      });

      // Validar compatibilidad inicial
      const validation = this.validateWhatsAppCompatibility({ mimetype, size });
      
      if (validation.isValid) {
        logger.info('✅ Archivo ya es compatible con WhatsApp, no necesita conversión');
        return {
          success: true,
          convertedFile: file,
          message: 'Archivo ya compatible con WhatsApp',
          conversionApplied: false
        };
      }

      const category = validation.category;
      let convertedBuffer = buffer;
      let convertedMimetype = mimetype;
      let conversionApplied = false;

      // Conversiones específicas por categoría
      switch (category) {
        case 'image':
          convertedBuffer = await this.convertImageForWhatsApp(buffer, mimetype);
          convertedMimetype = 'image/jpeg'; // WhatsApp prefiere JPEG
          conversionApplied = true;
          break;

        case 'video':
          convertedBuffer = await this.convertVideoForWhatsApp(buffer, mimetype);
          convertedMimetype = 'video/mp4'; // WhatsApp prefiere MP4
          conversionApplied = true;
          break;

        case 'audio':
          convertedBuffer = await this.convertAudioForWhatsApp(buffer, mimetype);
          convertedMimetype = 'audio/mpeg'; // WhatsApp prefiere MP3
          conversionApplied = true;
          break;

        case 'sticker':
          convertedBuffer = await this.convertStickerForWhatsApp(buffer, mimetype);
          convertedMimetype = 'image/webp'; // WhatsApp prefiere WebP para stickers
          conversionApplied = true;
          break;

        default:
          // Para documentos, intentar comprimir si es posible
          if (size > 16 * 1024 * 1024) { // Si es mayor a 16MB
            convertedBuffer = await this.compressDocumentForWhatsApp(buffer, mimetype);
            conversionApplied = true;
          }
          break;
      }

      // Validar el archivo convertido
      const convertedValidation = this.validateWhatsAppCompatibility({
        mimetype: convertedMimetype,
        size: convertedBuffer.length
      });

      if (!convertedValidation.isValid) {
        logger.warn('⚠️ Archivo convertido aún no es compatible con WhatsApp', {
          originalMimetype: mimetype,
          convertedMimetype,
          originalSize: `${(size / (1024 * 1024)).toFixed(2)}MB`,
          convertedSize: `${(convertedBuffer.length / (1024 * 1024)).toFixed(2)}MB`,
          validationMessage: convertedValidation.message
        });

        return {
          success: false,
          convertedFile: null,
          message: `No se pudo convertir el archivo para WhatsApp: ${convertedValidation.message}`,
          conversionApplied,
          originalValidation: validation,
          convertedValidation
        };
      }

      const convertedFile = {
        buffer: convertedBuffer,
        mimetype: convertedMimetype,
        size: convertedBuffer.length,
        originalName: this.updateFileExtension(originalName, convertedMimetype),
        category,
        conversionApplied
      };

      logger.info('✅ Archivo convertido exitosamente para WhatsApp', {
        originalMimetype: mimetype,
        convertedMimetype,
        originalSize: `${(size / (1024 * 1024)).toFixed(2)}MB`,
        convertedSize: `${(convertedBuffer.length / (1024 * 1024)).toFixed(2)}MB`,
        compressionRatio: `${((size - convertedBuffer.length) / size * 100).toFixed(1)}%`
      });

      return {
        success: true,
        convertedFile,
        message: 'Archivo convertido exitosamente para WhatsApp',
        conversionApplied,
        compressionRatio: ((size - convertedBuffer.length) / size * 100).toFixed(1) + '%'
      };

    } catch (error) {
      logger.error('❌ Error convirtiendo archivo para WhatsApp', {
        error: error.message,
        file: {
          mimetype: file?.mimetype,
          size: file?.size,
          originalName: file?.originalName
        }
      });

      return {
        success: false,
        convertedFile: null,
        message: `Error en conversión: ${error.message}`,
        conversionApplied: false
      };
    }
  }

  /**
   * 🆕 🖼️ CONVERTIR IMAGEN PARA WHATSAPP
   */
  async convertImageForWhatsApp(buffer, originalMimetype) {
    try {
      logger.info('🖼️ Convirtiendo imagen para WhatsApp', {
        originalMimetype,
        originalSize: `${(buffer.length / (1024 * 1024)).toFixed(2)}MB`
      });

      let sharpInstance = sharp(buffer);

      // Redimensionar si es muy grande
      const metadata = await sharpInstance.metadata();
      if (metadata.width > 4096 || metadata.height > 4096) {
        sharpInstance = sharpInstance.resize(4096, 4096, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Convertir a JPEG con calidad optimizada para WhatsApp
      const convertedBuffer = await sharpInstance
        .jpeg({
          quality: 85,
          progressive: true,
          mozjpeg: true
        })
        .toBuffer();

      logger.info('✅ Imagen convertida para WhatsApp', {
        originalSize: `${(buffer.length / (1024 * 1024)).toFixed(2)}MB`,
        convertedSize: `${(convertedBuffer.length / (1024 * 1024)).toFixed(2)}MB`,
        compressionRatio: `${((buffer.length - convertedBuffer.length) / buffer.length * 100).toFixed(1)}%`
      });

      return convertedBuffer;

    } catch (error) {
      logger.error('❌ Error convirtiendo imagen para WhatsApp', {
        error: error.message,
        originalMimetype
      });
      throw error;
    }
  }

  /**
   * 🆕 🎥 CONVERTIR VIDEO PARA WHATSAPP
   */
  async convertVideoForWhatsApp(buffer, originalMimetype) {
    try {
      logger.info('🎥 Convirtiendo video para WhatsApp', {
        originalMimetype,
        originalSize: `${(buffer.length / (1024 * 1024)).toFixed(2)}MB`
      });

      const { Readable } = require('stream');
      const videoStream = new Readable();
      videoStream.push(buffer);
      videoStream.push(null);

      const ffmpeg = require('fluent-ffmpeg');
      
      const convertedBuffer = await new Promise((resolve, reject) => {
        const chunks = [];
        
        ffmpeg(videoStream)
          .toFormat('mp4')
          .videoCodec('libx264')
          .audioCodec('aac')
          .videoBitrate(1000000) // 1Mbps
          .audioBitrate(128000)  // 128kbps
          .size('1280x720')      // Resolución HD
          .duration(180)         // Máximo 3 minutos
          .on('end', () => {
            const outputBuffer = Buffer.concat(chunks);
            resolve(outputBuffer);
          })
          .on('error', (err) => {
            logger.warn('Error convirtiendo video, usando original:', err.message);
            resolve(buffer); // Fallback al original
          })
          .pipe(require('stream').Writable({
            write(chunk, encoding, callback) {
              chunks.push(chunk);
              callback();
            }
          }));
      });

      logger.info('✅ Video convertido para WhatsApp', {
        originalSize: `${(buffer.length / (1024 * 1024)).toFixed(2)}MB`,
        convertedSize: `${(convertedBuffer.length / (1024 * 1024)).toFixed(2)}MB`,
        compressionRatio: `${((buffer.length - convertedBuffer.length) / buffer.length * 100).toFixed(1)}%`
      });

      return convertedBuffer;

    } catch (error) {
      logger.error('❌ Error convirtiendo video para WhatsApp', {
        error: error.message,
        originalMimetype
      });
      throw error;
    }
  }

  /**
   * 🆕 🎵 CONVERTIR AUDIO PARA WHATSAPP
   */
  async convertAudioForWhatsApp(buffer, originalMimetype) {
    try {
      logger.info('🎵 Convirtiendo audio para WhatsApp', {
        originalMimetype,
        originalSize: `${(buffer.length / (1024 * 1024)).toFixed(2)}MB`
      });

      const { Readable } = require('stream');
      const audioStream = new Readable();
      audioStream.push(buffer);
      audioStream.push(null);

      const ffmpeg = require('fluent-ffmpeg');
      
      const convertedBuffer = await new Promise((resolve, reject) => {
        const chunks = [];
        
        ffmpeg(audioStream)
          .toFormat('mp3')
          .audioCodec('libmp3lame')
          .audioBitrate(128000)  // 128kbps
          .audioChannels(2)      // Estéreo
          .audioFrequency(44100) // 44.1kHz
          .duration(7200)        // Máximo 2 horas
          .on('end', () => {
            const outputBuffer = Buffer.concat(chunks);
            resolve(outputBuffer);
          })
          .on('error', (err) => {
            logger.warn('Error convirtiendo audio, usando original:', err.message);
            resolve(buffer); // Fallback al original
          })
          .pipe(require('stream').Writable({
            write(chunk, encoding, callback) {
              chunks.push(chunk);
              callback();
            }
          }));
      });

      logger.info('✅ Audio convertido para WhatsApp', {
        originalSize: `${(buffer.length / (1024 * 1024)).toFixed(2)}MB`,
        convertedSize: `${(convertedBuffer.length / (1024 * 1024)).toFixed(2)}MB`,
        compressionRatio: `${((buffer.length - convertedBuffer.length) / buffer.length * 100).toFixed(1)}%`
      });

      return convertedBuffer;

    } catch (error) {
      logger.error('❌ Error convirtiendo audio para WhatsApp', {
        error: error.message,
        originalMimetype
      });
      throw error;
    }
  }

  /**
   * 🆕 📄 COMPRIMIR DOCUMENTO PARA WHATSAPP
   */
  async compressDocumentForWhatsApp(buffer, originalMimetype) {
    try {
      logger.info('📄 Comprimiendo documento para WhatsApp', {
        originalMimetype,
        originalSize: `${(buffer.length / (1024 * 1024)).toFixed(2)}MB`
      });

      // Para documentos, intentar comprimir usando diferentes estrategias
      if (originalMimetype === 'application/pdf') {
        // Comprimir PDF si es posible
        return await this.compressPDFForWhatsApp(buffer);
      } else if (originalMimetype.includes('image/')) {
        // Comprimir imágenes en documentos
        return await this.convertImageForWhatsApp(buffer, originalMimetype);
      } else {
        // Para otros documentos, devolver el original
        logger.warn('⚠️ No se puede comprimir este tipo de documento, usando original');
        return buffer;
      }

    } catch (error) {
      logger.error('❌ Error comprimiendo documento para WhatsApp', {
        error: error.message,
        originalMimetype
      });
      return buffer; // Fallback al original
    }
  }

  /**
   * 🆕 📄 COMPRIMIR PDF PARA WHATSAPP
   */
  async compressPDFForWhatsApp(buffer) {
    try {
      // Para PDFs, intentar reducir calidad si es posible
      // Por ahora, devolver el original ya que la compresión de PDF requiere librerías específicas
      logger.info('📄 PDF detectado, usando original (compresión de PDF requiere librerías adicionales)');
      return buffer;
    } catch (error) {
      logger.error('❌ Error comprimiendo PDF para WhatsApp', {
        error: error.message
      });
      return buffer;
    }
  }

  /**
   * 🆕 🔧 ACTUALIZAR EXTENSIÓN DE ARCHIVO
   */
  updateFileExtension(filename, newMimetype) {
    try {
      const extension = this.getFileExtension(newMimetype);
      const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
      return `${nameWithoutExt}.${extension}`;
    } catch (error) {
      logger.warn('Error actualizando extensión de archivo:', error.message);
      return filename;
    }
  }

  /**
   * 🆕 🎭 CONVERTIR STICKER PARA WHATSAPP
   * Procesa y optimiza stickers para WhatsApp.
   */
  async convertStickerForWhatsApp(buffer, originalMimetype) {
    try {
      logger.info('🎭 Convirtiendo sticker para WhatsApp', {
        originalMimetype,
        originalSize: `${(buffer.length / (1024 * 1024)).toFixed(3)}MB`
      });

      let sharpInstance = sharp(buffer);

      // Obtener metadatos de la imagen
      const metadata = await sharpInstance.metadata();
      
      // Verificar si es un sticker animado (WebP con múltiples frames)
      const isAnimated = metadata.pages && metadata.pages > 1;
      
      if (isAnimated) {
        logger.info('🎭 Sticker animado detectado', {
          frames: metadata.pages,
          width: metadata.width,
          height: metadata.height
        });
        
        // Para stickers animados, limitar a 30 frames máximo
        if (metadata.pages > 30) {
          sharpInstance = sharpInstance.pages(0, 29); // Tomar solo los primeros 30 frames
        }
      }

      // Redimensionar si es muy grande (máximo 512x512 para stickers)
      if (metadata.width > 512 || metadata.height > 512) {
        sharpInstance = sharpInstance.resize(512, 512, {
          fit: 'inside',
          withoutEnlargement: true,
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Fondo transparente
        });
      }

      // Convertir a WebP optimizado para stickers
      const convertedBuffer = await sharpInstance
        .webp({
          quality: 80,
          lossless: false,
          nearLossless: true,
          smartSubsample: true,
          effort: 6 // Máximo esfuerzo de compresión
        })
        .toBuffer();

      // Verificar que el tamaño final sea menor a 100KB
      if (convertedBuffer.length > 100 * 1024) {
        logger.warn('⚠️ Sticker convertido aún es muy grande, aplicando compresión adicional');
        
        // Aplicar compresión más agresiva
        const compressedBuffer = await sharp(buffer)
          .resize(256, 256, {
            fit: 'inside',
            withoutEnlargement: true,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .webp({
            quality: 60,
            lossless: false,
            nearLossless: false,
            effort: 6
          })
          .toBuffer();

        logger.info('✅ Sticker comprimido adicionalmente', {
          originalSize: `${(buffer.length / 1024).toFixed(1)}KB`,
          finalSize: `${(compressedBuffer.length / 1024).toFixed(1)}KB`,
          compressionRatio: `${((buffer.length - compressedBuffer.length) / buffer.length * 100).toFixed(1)}%`
        });

        return compressedBuffer;
      }

      logger.info('✅ Sticker convertido para WhatsApp', {
        originalSize: `${(buffer.length / 1024).toFixed(1)}KB`,
        convertedSize: `${(convertedBuffer.length / 1024).toFixed(1)}KB`,
        compressionRatio: `${((buffer.length - convertedBuffer.length) / buffer.length * 100).toFixed(1)}%`,
        isAnimated: isAnimated,
        frames: metadata.pages || 1
      });

      return convertedBuffer;

    } catch (error) {
      logger.error('❌ Error convirtiendo sticker para WhatsApp', {
        error: error.message,
        originalMimetype
      });
      throw error;
    }
  }

  /**
   * 🆕 🎭 VALIDAR STICKER PARA WHATSAPP
   * Valida específicamente si un sticker cumple con los requisitos de WhatsApp.
   */
  validateStickerForWhatsApp(buffer, mimetype) {
    try {
      const fileSizeKB = buffer.length / 1024;
      
      // Validaciones específicas para stickers
      const stickerRequirements = {
        maxSize: 100, // 100KB máximo
        maxDimensions: { width: 512, height: 512 },
        maxFrames: 30, // Para stickers animados
        supportedFormats: ['image/webp', 'image/png']
      };

      // Validar formato
      if (!stickerRequirements.supportedFormats.includes(mimetype)) {
        return {
          isValid: false,
          message: `Formato de sticker no soportado: ${mimetype}. Formatos soportados: ${stickerRequirements.supportedFormats.join(', ')}`,
          requirements: stickerRequirements
        };
      }

      // Validar tamaño
      if (fileSizeKB > stickerRequirements.maxSize) {
        return {
          isValid: false,
          message: `Sticker excede el tamaño máximo (${stickerRequirements.maxSize}KB). Tamaño actual: ${fileSizeKB.toFixed(1)}KB`,
          requirements: stickerRequirements,
          currentSize: fileSizeKB
        };
      }

      return {
        isValid: true,
        message: 'Sticker válido para WhatsApp',
        requirements: stickerRequirements,
        currentSize: fileSizeKB
      };

    } catch (error) {
      logger.error('❌ Error validando sticker para WhatsApp', {
        error: error.message,
        mimetype
      });

      return {
        isValid: false,
        message: `Error validando sticker: ${error.message}`,
        requirements: null
      };
    }
  }

  /**
   * 🆕 🎭 PROCESAR STICKER COMPLETO
   * Procesa un sticker completo: valida, convierte y optimiza.
   */
  async processStickerForWhatsApp(buffer, originalMimetype, originalName) {
    try {
      logger.info('🎭 Procesando sticker completo para WhatsApp', {
        originalMimetype,
        originalName,
        originalSize: `${(buffer.length / 1024).toFixed(1)}KB`
      });

      // 1. Validar sticker
      const validation = this.validateStickerForWhatsApp(buffer, originalMimetype);
      
      if (!validation.isValid) {
        logger.warn('⚠️ Sticker no válido para WhatsApp', {
          message: validation.message,
          requirements: validation.requirements
        });

        // Intentar convertir el sticker
        logger.info('🔄 Intentando convertir sticker para cumplir requisitos...');
        const convertedBuffer = await this.convertStickerForWhatsApp(buffer, originalMimetype);
        
        // Validar el sticker convertido
        const convertedValidation = this.validateStickerForWhatsApp(convertedBuffer, 'image/webp');
        
        if (!convertedValidation.isValid) {
          return {
            success: false,
            message: `No se pudo procesar el sticker para WhatsApp: ${convertedValidation.message}`,
            originalValidation: validation,
            convertedValidation: convertedValidation
          };
        }

        // Sticker convertido exitosamente
        const processedSticker = {
          buffer: convertedBuffer,
          mimetype: 'image/webp',
          size: convertedBuffer.length,
          originalName: this.updateFileExtension(originalName, 'image/webp'),
          category: 'sticker',
          conversionApplied: true
        };

        logger.info('✅ Sticker procesado exitosamente para WhatsApp', {
          originalSize: `${(buffer.length / 1024).toFixed(1)}KB`,
          processedSize: `${(convertedBuffer.length / 1024).toFixed(1)}KB`,
          compressionRatio: `${((buffer.length - convertedBuffer.length) / buffer.length * 100).toFixed(1)}%`
        });

        return {
          success: true,
          processedSticker,
          message: 'Sticker procesado exitosamente para WhatsApp',
          conversionApplied: true,
          compressionRatio: ((buffer.length - convertedBuffer.length) / buffer.length * 100).toFixed(1) + '%'
        };
      }

      // Sticker ya es válido
      const processedSticker = {
        buffer,
        mimetype: originalMimetype,
        size: buffer.length,
        originalName,
        category: 'sticker',
        conversionApplied: false
      };

      logger.info('✅ Sticker ya es válido para WhatsApp', {
        size: `${(buffer.length / 1024).toFixed(1)}KB`,
        mimetype: originalMimetype
      });

      return {
        success: true,
        processedSticker,
        message: 'Sticker ya es válido para WhatsApp',
        conversionApplied: false
      };

    } catch (error) {
      logger.error('❌ Error procesando sticker para WhatsApp', {
        error: error.message,
        originalMimetype,
        originalName
      });

      return {
        success: false,
        message: `Error procesando sticker: ${error.message}`,
        processedSticker: null
      };
    }
  }

  /**
   * 🆕 🖼️ GENERAR PREVIEW DE IMAGEN
   * Genera thumbnails y previews optimizados para imágenes.
   */
  async generateImagePreview(buffer, fileId, conversationId, options = {}) {
    try {
      const {
        thumbnailSize = 150,    // Tamaño del thumbnail en píxeles
        previewSize = 800,      // Tamaño del preview en píxeles
        quality = 85,           // Calidad JPEG
        format = 'jpeg'         // Formato de salida
      } = options;

      logger.info('🖼️ Generando preview de imagen', {
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        thumbnailSize,
        previewSize,
        quality,
        format
      });

      // Obtener metadatos de la imagen original
      const metadata = await sharp(buffer).metadata();
      
      logger.info('📊 Metadatos de imagen original', {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        hasAlpha: metadata.hasAlpha,
        isOpaque: metadata.isOpaque
      });

      // Generar thumbnail
      const thumbnailBuffer = await sharp(buffer)
        .resize(thumbnailSize, thumbnailSize, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80, progressive: true })
        .toBuffer();

      // Generar preview
      const previewBuffer = await sharp(buffer)
        .resize(previewSize, previewSize, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality, progressive: true })
        .toBuffer();

      // Guardar thumbnail
      const thumbnailPath = `previews/${conversationId}/thumbnails/${fileId}_thumb.jpg`;
      const thumbnailUrl = await this.savePreviewToStorage(thumbnailBuffer, thumbnailPath, 'image/jpeg');

      // Guardar preview
      const previewPath = `previews/${conversationId}/images/${fileId}_preview.jpg`;
      const previewUrl = await this.savePreviewToStorage(previewBuffer, previewPath, 'image/jpeg');

      const previewData = {
        thumbnail: {
          url: thumbnailUrl,
          size: thumbnailBuffer.length,
          dimensions: { width: thumbnailSize, height: thumbnailSize }
        },
        preview: {
          url: previewUrl,
          size: previewBuffer.length,
          dimensions: { width: Math.min(previewSize, metadata.width), height: Math.min(previewSize, metadata.height) }
        },
        original: {
          size: buffer.length,
          dimensions: { width: metadata.width, height: metadata.height },
          format: metadata.format
        },
        metadata: {
          hasAlpha: metadata.hasAlpha,
          isOpaque: metadata.isOpaque,
          orientation: metadata.orientation
        }
      };

      logger.info('✅ Preview de imagen generado exitosamente', {
        fileId: fileId.substring(0, 20) + '...',
        thumbnailSize: `${thumbnailBuffer.length / 1024}KB`,
        previewSize: `${previewBuffer.length / 1024}KB`,
        compressionRatio: `${((buffer.length - previewBuffer.length) / buffer.length * 100).toFixed(1)}%`
      });

      return previewData;

    } catch (error) {
      logger.error('❌ Error generando preview de imagen', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...',
        conversationId: conversationId?.substring(0, 20) + '...'
      });
      throw error;
    }
  }

  /**
   * 🆕 🖼️ GENERAR THUMBNAIL RÁPIDO
   * Genera un thumbnail básico para lazy loading.
   */
  async generateQuickThumbnail(buffer, fileId, conversationId) {
    try {
      logger.info('🖼️ Generando thumbnail rápido', {
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...'
      });

      // Generar thumbnail muy pequeño para lazy loading
      const thumbnailBuffer = await sharp(buffer)
        .resize(50, 50, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 60, progressive: true })
        .toBuffer();

      // Guardar thumbnail rápido
      const thumbnailPath = `previews/${conversationId}/quick/${fileId}_quick.jpg`;
      const thumbnailUrl = await this.savePreviewToStorage(thumbnailBuffer, thumbnailPath, 'image/jpeg');

      logger.info('✅ Thumbnail rápido generado', {
        fileId: fileId.substring(0, 20) + '...',
        size: `${thumbnailBuffer.length / 1024}KB`
      });

      return {
        url: thumbnailUrl,
        size: thumbnailBuffer.length,
        dimensions: { width: 50, height: 50 }
      };

    } catch (error) {
      logger.error('❌ Error generando thumbnail rápido', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...'
      });
      throw error;
    }
  }

  /**
   * 🆕 💾 GUARDAR PREVIEW EN STORAGE
   * Guarda un preview en Firebase Storage y retorna la URL.
   */
  async savePreviewToStorage(buffer, storagePath, contentType) {
    try {
      const bucket = this.getBucket();
      const file = bucket.file(storagePath);

      await file.save(buffer, {
        metadata: {
          contentType,
          cacheControl: 'public, max-age=31536000', // Cache por 1 año
          metadata: {
            generatedAt: new Date().toISOString(),
            type: 'preview'
          }
        }
      });

      // Generar URL firmada con expiración larga
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 año
      });

      return signedUrl;

    } catch (error) {
      logger.error('❌ Error guardando preview en storage', {
        error: error.message,
        storagePath
      });
      throw error;
    }
  }

  /**
   * 🆕 📄 GENERAR PREVIEW DE DOCUMENTO
   * Genera previews y extrae texto de documentos (PDF, DOC, etc.).
   */
  async generateDocumentPreview(buffer, fileId, conversationId, mimetype, options = {}) {
    try {
      const {
        extractText = true,     // Extraer texto del documento
        generateThumbnail = true, // Generar thumbnail
        maxPages = 3,           // Máximo número de páginas para preview
        thumbnailSize = 200     // Tamaño del thumbnail
      } = options;

      logger.info('📄 Generando preview de documento', {
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        mimetype,
        extractText,
        generateThumbnail,
        maxPages
      });

      const previewData = {
        documentType: this.getDocumentType(mimetype),
        originalSize: buffer.length,
        pages: [],
        text: null,
        thumbnail: null
      };

      // Procesar según el tipo de documento
      if (mimetype === 'application/pdf') {
        const pdfPreview = await this.generatePDFPreview(buffer, fileId, conversationId, {
          extractText,
          generateThumbnail,
          maxPages,
          thumbnailSize
        });
        Object.assign(previewData, pdfPreview);
      } else if (mimetype.includes('word') || mimetype.includes('document')) {
        const wordPreview = await this.generateWordPreview(buffer, fileId, conversationId, {
          extractText,
          generateThumbnail,
          thumbnailSize
        });
        Object.assign(previewData, wordPreview);
      } else if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) {
        const excelPreview = await this.generateExcelPreview(buffer, fileId, conversationId, {
          extractText,
          generateThumbnail,
          thumbnailSize
        });
        Object.assign(previewData, excelPreview);
      } else if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) {
        const pptPreview = await this.generatePowerPointPreview(buffer, fileId, conversationId, {
          extractText,
          generateThumbnail,
          thumbnailSize
        });
        Object.assign(previewData, pptPreview);
      } else {
        // Para otros tipos de documentos, generar thumbnail básico
        if (generateThumbnail) {
          const thumbnail = await this.generateDocumentThumbnail(buffer, fileId, conversationId, mimetype, thumbnailSize);
          previewData.thumbnail = thumbnail;
        }
      }

      logger.info('✅ Preview de documento generado exitosamente', {
        fileId: fileId.substring(0, 20) + '...',
        documentType: previewData.documentType,
        pagesCount: previewData.pages.length,
        hasText: !!previewData.text,
        hasThumbnail: !!previewData.thumbnail
      });

      return previewData;

    } catch (error) {
      logger.error('❌ Error generando preview de documento', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...',
        mimetype
      });
      throw error;
    }
  }

  /**
   * 🆕 📄 GENERAR PREVIEW DE PDF
   */
  async generatePDFPreview(buffer, fileId, conversationId, options = {}) {
    try {
      const { extractText, generateThumbnail, maxPages, thumbnailSize } = options;

      logger.info('📄 Generando preview de PDF', {
        fileId: fileId.substring(0, 20) + '...',
        extractText,
        generateThumbnail,
        maxPages
      });

      const previewData = {
        documentType: 'pdf',
        pages: [],
        text: null,
        thumbnail: null
      };

      // Extraer texto si se solicita
      if (extractText) {
        try {
          const pdfText = await this.extractTextFromPDF(buffer);
          previewData.text = pdfText;
          logger.info('✅ Texto extraído del PDF', {
            characters: pdfText.length,
            words: pdfText.split(/\s+/).length
          });
        } catch (textError) {
          logger.warn('⚠️ No se pudo extraer texto del PDF:', textError.message);
        }
      }

      // Generar thumbnails de páginas
      if (generateThumbnail) {
        try {
          const pageThumbnails = await this.generatePDFThumbnails(buffer, fileId, conversationId, maxPages, thumbnailSize);
          previewData.pages = pageThumbnails.pages;
          previewData.thumbnail = pageThumbnails.thumbnail;
          
          logger.info('✅ Thumbnails de PDF generados', {
            pagesCount: pageThumbnails.pages.length,
            thumbnailSize: `${pageThumbnails.thumbnail.size / 1024}KB`
          });
        } catch (thumbError) {
          logger.warn('⚠️ No se pudieron generar thumbnails del PDF:', thumbError.message);
        }
      }

      return previewData;

    } catch (error) {
      logger.error('❌ Error generando preview de PDF', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...'
      });
      throw error;
    }
  }

  /**
   * 🆕 📄 EXTRAER TEXTO DE PDF
   */
  async extractTextFromPDF(buffer) {
    try {
      // Usar pdf-parse para extraer texto
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      
      return data.text || '';

    } catch (error) {
      logger.error('❌ Error extrayendo texto de PDF', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🆕 📄 GENERAR THUMBNAILS DE PDF
   */
  async generatePDFThumbnails(buffer, fileId, conversationId, maxPages, thumbnailSize) {
    try {
      // Usar pdf2pic para generar thumbnails
      const pdf2pic = require('pdf2pic');
      
      const options = {
        density: 100,
        saveFilename: fileId,
        savePath: `/tmp/${conversationId}`,
        format: 'png',
        width: thumbnailSize,
        height: thumbnailSize
      };

      const convert = pdf2pic.fromBuffer(buffer, options);
      
      const pages = [];
      const totalPages = Math.min(maxPages, await this.getPDFPageCount(buffer));

      for (let i = 1; i <= totalPages; i++) {
        try {
          const result = await convert(i);
          if (result && result.path) {
            // Leer el archivo generado
            const fs = require('fs').promises;
            const thumbnailBuffer = await fs.readFile(result.path);
            
            // Guardar en storage
            const thumbnailPath = `previews/${conversationId}/documents/${fileId}_page_${i}.jpg`;
            const thumbnailUrl = await this.savePreviewToStorage(thumbnailBuffer, thumbnailPath, 'image/jpeg');
            
            pages.push({
              page: i,
              url: thumbnailUrl,
              size: thumbnailBuffer.length,
              dimensions: { width: thumbnailSize, height: thumbnailSize }
            });

            // Limpiar archivo temporal
            await fs.unlink(result.path);
          }
        } catch (pageError) {
          logger.warn(`⚠️ Error generando thumbnail de página ${i}:`, pageError.message);
        }
      }

      // Usar la primera página como thumbnail principal
      const thumbnail = pages.length > 0 ? pages[0] : null;

      return { pages, thumbnail };

    } catch (error) {
      logger.error('❌ Error generando thumbnails de PDF', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...'
      });
      throw error;
    }
  }

  /**
   * 🆕 📄 OBTENER NÚMERO DE PÁGINAS DE PDF
   */
  async getPDFPageCount(buffer) {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.numpages || 1;
    } catch (error) {
      logger.warn('⚠️ No se pudo obtener número de páginas del PDF:', error.message);
      return 1;
    }
  }

  /**
   * 🆕 📄 GENERAR PREVIEW DE WORD
   */
  async generateWordPreview(buffer, fileId, conversationId, options = {}) {
    try {
      const { extractText, generateThumbnail, thumbnailSize } = options;

      logger.info('📄 Generando preview de Word', {
        fileId: fileId.substring(0, 20) + '...',
        extractText,
        generateThumbnail
      });

      const previewData = {
        documentType: 'word',
        pages: [],
        text: null,
        thumbnail: null
      };

      // Extraer texto si se solicita
      if (extractText) {
        try {
          const wordText = await this.extractTextFromWord(buffer);
          previewData.text = wordText;
          logger.info('✅ Texto extraído del documento Word', {
            characters: wordText.length,
            words: wordText.split(/\s+/).length
          });
        } catch (textError) {
          logger.warn('⚠️ No se pudo extraer texto del documento Word:', textError.message);
        }
      }

      // Generar thumbnail básico
      if (generateThumbnail) {
        try {
          const thumbnail = await this.generateDocumentThumbnail(buffer, fileId, conversationId, 'application/msword', thumbnailSize);
          previewData.thumbnail = thumbnail;
        } catch (thumbError) {
          logger.warn('⚠️ No se pudo generar thumbnail del documento Word:', thumbError.message);
        }
      }

      return previewData;

    } catch (error) {
      logger.error('❌ Error generando preview de Word', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...'
      });
      throw error;
    }
  }

  /**
   * 🆕 📄 EXTRAER TEXTO DE WORD
   */
  async extractTextFromWord(buffer) {
    try {
      // Para documentos Word, usar mammoth para extraer texto
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      
      return result.value || '';

    } catch (error) {
      logger.error('❌ Error extrayendo texto de Word', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🆕 📄 GENERAR PREVIEW DE EXCEL
   */
  async generateExcelPreview(buffer, fileId, conversationId, options = {}) {
    try {
      const { extractText, generateThumbnail, thumbnailSize } = options;

      logger.info('📄 Generando preview de Excel', {
        fileId: fileId.substring(0, 20) + '...',
        extractText,
        generateThumbnail
      });

      const previewData = {
        documentType: 'excel',
        pages: [],
        text: null,
        thumbnail: null
      };

      // Extraer datos si se solicita
      if (extractText) {
        try {
          const excelData = await this.extractDataFromExcel(buffer);
          previewData.text = excelData;
          logger.info('✅ Datos extraídos del archivo Excel', {
            characters: excelData.length
          });
        } catch (dataError) {
          logger.warn('⚠️ No se pudieron extraer datos del archivo Excel:', dataError.message);
        }
      }

      // Generar thumbnail básico
      if (generateThumbnail) {
        try {
          const thumbnail = await this.generateDocumentThumbnail(buffer, fileId, conversationId, 'application/vnd.ms-excel', thumbnailSize);
          previewData.thumbnail = thumbnail;
        } catch (thumbError) {
          logger.warn('⚠️ No se pudo generar thumbnail del archivo Excel:', thumbError.message);
        }
      }

      return previewData;

    } catch (error) {
      logger.error('❌ Error generando preview de Excel', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...'
      });
      throw error;
    }
  }

  /**
   * 🆕 📄 EXTRAER DATOS DE EXCEL
   */
  async extractDataFromExcel(buffer) {
    try {
      // Para archivos Excel, usar xlsx para extraer datos
      const XLSX = require('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      
      let extractedText = '';
      
      // Extraer texto de todas las hojas
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        jsonData.forEach(row => {
          if (Array.isArray(row)) {
            extractedText += row.join('\t') + '\n';
          }
        });
      });
      
      return extractedText;

    } catch (error) {
      logger.error('❌ Error extrayendo datos de Excel', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🆕 📄 GENERAR PREVIEW DE POWERPOINT
   */
  async generatePowerPointPreview(buffer, fileId, conversationId, options = {}) {
    try {
      const { extractText, generateThumbnail, thumbnailSize } = options;

      logger.info('📄 Generando preview de PowerPoint', {
        fileId: fileId.substring(0, 20) + '...',
        extractText,
        generateThumbnail
      });

      const previewData = {
        documentType: 'powerpoint',
        pages: [],
        text: null,
        thumbnail: null
      };

      // Extraer texto si se solicita
      if (extractText) {
        try {
          const pptText = await this.extractTextFromPowerPoint(buffer);
          previewData.text = pptText;
          logger.info('✅ Texto extraído de la presentación PowerPoint', {
            characters: pptText.length,
            words: pptText.split(/\s+/).length
          });
        } catch (textError) {
          logger.warn('⚠️ No se pudo extraer texto de la presentación PowerPoint:', textError.message);
        }
      }

      // Generar thumbnail básico
      if (generateThumbnail) {
        try {
          const thumbnail = await this.generateDocumentThumbnail(buffer, fileId, conversationId, 'application/vnd.ms-powerpoint', thumbnailSize);
          previewData.thumbnail = thumbnail;
        } catch (thumbError) {
          logger.warn('⚠️ No se pudo generar thumbnail de la presentación PowerPoint:', thumbError.message);
        }
      }

      return previewData;

    } catch (error) {
      logger.error('❌ Error generando preview de PowerPoint', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...'
      });
      throw error;
    }
  }

  /**
   * 🆕 📄 EXTRAER TEXTO DE POWERPOINT
   */
  async extractTextFromPowerPoint(buffer) {
    try {
      // Para presentaciones PowerPoint, usar pptxjs para extraer texto
      const pptxjs = require('pptxjs');
      const presentation = await pptxjs.parse(buffer);
      
      let extractedText = '';
      
      // Extraer texto de todas las diapositivas
      presentation.slides.forEach(slide => {
        if (slide.text) {
          extractedText += slide.text + '\n';
        }
      });
      
      return extractedText;

    } catch (error) {
      logger.error('❌ Error extrayendo texto de PowerPoint', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🆕 📄 GENERAR THUMBNAIL DE DOCUMENTO
   * Genera un thumbnail básico para cualquier tipo de documento.
   */
  async generateDocumentThumbnail(buffer, fileId, conversationId, mimetype, thumbnailSize = 200) {
    try {
      logger.info('📄 Generando thumbnail de documento', {
        fileId: fileId.substring(0, 20) + '...',
        mimetype,
        thumbnailSize
      });

      // Crear un thumbnail básico basado en el tipo de documento
      const canvas = require('canvas');
      const thumbnailCanvas = canvas.createCanvas(thumbnailSize, thumbnailSize);
      const ctx = thumbnailCanvas.getContext('2d');

      // Fondo blanco
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, thumbnailSize, thumbnailSize);

      // Borde gris
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, thumbnailSize - 20, thumbnailSize - 20);

      // Icono según tipo de documento
      const iconColor = this.getDocumentIconColor(mimetype);
      const iconText = this.getDocumentIconText(mimetype);
      
      ctx.fillStyle = iconColor;
      ctx.font = `${thumbnailSize / 4}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(iconText, thumbnailSize / 2, thumbnailSize / 2);

      // Convertir canvas a buffer
      const thumbnailBuffer = thumbnailCanvas.toBuffer('image/jpeg', { quality: 0.8 });

      // Guardar en storage
      const thumbnailPath = `previews/${conversationId}/documents/${fileId}_doc_thumb.jpg`;
      const thumbnailUrl = await this.savePreviewToStorage(thumbnailBuffer, thumbnailPath, 'image/jpeg');

      logger.info('✅ Thumbnail de documento generado', {
        fileId: fileId.substring(0, 20) + '...',
        size: `${thumbnailBuffer.length / 1024}KB`
      });

      return {
        url: thumbnailUrl,
        size: thumbnailBuffer.length,
        dimensions: { width: thumbnailSize, height: thumbnailSize },
        type: 'document'
      };

    } catch (error) {
      logger.error('❌ Error generando thumbnail de documento', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...',
        mimetype
      });
      throw error;
    }
  }

  /**
   * 🆕 📄 OBTENER COLOR DE ICONO DE DOCUMENTO
   */
  getDocumentIconColor(mimetype) {
    const iconColors = {
      'application/pdf': '#ff4444',
      'application/msword': '#2b579a',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '#2b579a',
      'application/vnd.ms-excel': '#217346',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '#217346',
      'application/vnd.ms-powerpoint': '#d24726',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': '#d24726',
      'text/plain': '#666666',
      'application/json': '#f7df1e',
      'application/xml': '#ff6600',
      'text/csv': '#217346'
    };
    
    return iconColors[mimetype] || '#666666';
  }

  /**
   * 🆕 📄 OBTENER TEXTO DE ICONO DE DOCUMENTO
   */
  getDocumentIconText(mimetype) {
    const iconTexts = {
      'application/pdf': 'PDF',
      'application/msword': 'DOC',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOC',
      'application/vnd.ms-excel': 'XLS',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLS',
      'application/vnd.ms-powerpoint': 'PPT',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPT',
      'text/plain': 'TXT',
      'application/json': 'JSON',
      'application/xml': 'XML',
      'text/csv': 'CSV'
    };
    
    return iconTexts[mimetype] || 'DOC';
  }

  /**
   * 🆕 📄 OBTENER TIPO DE DOCUMENTO
   */
  getDocumentType(mimetype) {
    if (mimetype === 'application/pdf') return 'pdf';
    if (mimetype.includes('word') || mimetype.includes('document')) return 'word';
    if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return 'excel';
    if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return 'powerpoint';
    if (mimetype === 'text/plain') return 'text';
    if (mimetype === 'application/json') return 'json';
    if (mimetype === 'application/xml') return 'xml';
    if (mimetype === 'text/csv') return 'csv';
    return 'document';
  }

  /**
   * 🆕 🎥 GENERAR PREVIEW DE VIDEO
   * Genera thumbnails y extrae metadatos de videos.
   */
  async generateVideoPreview(buffer, fileId, conversationId, options = {}) {
    try {
      const {
        generateThumbnail = true, // Generar thumbnail del video
        extractMetadata = true,   // Extraer metadatos del video
        thumbnailSize = 320,      // Tamaño del thumbnail
        thumbnailTime = 5         // Tiempo en segundos para generar thumbnail
      } = options;

      logger.info('🎥 Generando preview de video', {
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        generateThumbnail,
        extractMetadata,
        thumbnailSize,
        thumbnailTime
      });

      const previewData = {
        videoType: 'video',
        originalSize: buffer.length,
        thumbnail: null,
        metadata: null
      };

      // Extraer metadatos del video
      if (extractMetadata) {
        try {
          const videoMetadata = await this.extractVideoMetadata(buffer);
          previewData.metadata = videoMetadata;
          
          logger.info('✅ Metadatos de video extraídos', {
            duration: videoMetadata.duration,
            resolution: `${videoMetadata.width}x${videoMetadata.height}`,
            bitrate: videoMetadata.bitrate,
            format: videoMetadata.format
          });
        } catch (metadataError) {
          logger.warn('⚠️ No se pudieron extraer metadatos del video:', metadataError.message);
        }
      }

      // Generar thumbnail del video
      if (generateThumbnail) {
        try {
          const videoThumbnail = await this.generateVideoThumbnail(buffer, fileId, conversationId, {
            size: thumbnailSize,
            time: thumbnailTime
          });
          previewData.thumbnail = videoThumbnail;
          
          logger.info('✅ Thumbnail de video generado', {
            size: `${videoThumbnail.size / 1024}KB`,
            dimensions: `${videoThumbnail.dimensions.width}x${videoThumbnail.dimensions.height}`
          });
        } catch (thumbError) {
          logger.warn('⚠️ No se pudo generar thumbnail del video:', thumbError.message);
        }
      }

      logger.info('✅ Preview de video generado exitosamente', {
        fileId: fileId.substring(0, 20) + '...',
        hasMetadata: !!previewData.metadata,
        hasThumbnail: !!previewData.thumbnail
      });

      return previewData;

    } catch (error) {
      logger.error('❌ Error generando preview de video', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...',
        conversationId: conversationId?.substring(0, 20) + '...'
      });
      throw error;
    }
  }

  /**
   * 🆕 🎥 EXTRAER METADATOS DE VIDEO
   */
  async extractVideoMetadata(buffer) {
    try {
      const ffprobe = require('fluent-ffmpeg');
      
      return new Promise((resolve, reject) => {
        const { Readable } = require('stream');
        const videoStream = new Readable();
        videoStream.push(buffer);
        videoStream.push(null);

        ffprobe.ffprobe(videoStream, (err, metadata) => {
          if (err) {
            reject(err);
            return;
          }

          const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
          const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');

          const videoMetadata = {
            duration: parseFloat(metadata.format.duration) || 0,
            size: parseInt(metadata.format.size) || 0,
            bitrate: parseInt(metadata.format.bit_rate) || 0,
            format: metadata.format.format_name,
            filename: metadata.format.filename,
            video: videoStream ? {
              codec: videoStream.codec_name,
              width: videoStream.width,
              height: videoStream.height,
              fps: parseFloat(videoStream.r_frame_rate?.split('/')[0]) / parseFloat(videoStream.r_frame_rate?.split('/')[1]) || 0,
              bitrate: parseInt(videoStream.bit_rate) || 0
            } : null,
            audio: audioStream ? {
              codec: audioStream.codec_name,
              channels: audioStream.channels,
              sampleRate: audioStream.sample_rate,
              bitrate: parseInt(audioStream.bit_rate) || 0
            } : null
          };

          resolve(videoMetadata);
        });
      });

    } catch (error) {
      logger.error('❌ Error extrayendo metadatos de video', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🆕 🎥 GENERAR THUMBNAIL DE VIDEO
   */
  async generateVideoThumbnail(buffer, fileId, conversationId, options = {}) {
    try {
      const { size = 320, time = 5 } = options;

      logger.info('🎥 Generando thumbnail de video', {
        fileId: fileId.substring(0, 20) + '...',
        size,
        time
      });

      const ffmpeg = require('fluent-ffmpeg');
      
      return new Promise((resolve, reject) => {
        const { Readable } = require('stream');
        const videoStream = new Readable();
        videoStream.push(buffer);
        videoStream.push(null);

        const chunks = [];
        
        ffmpeg(videoStream)
          .seekInput(time)
          .frames(1)
          .size(`${size}x${size}`)
          .format('image2')
          .on('end', async () => {
            try {
              const thumbnailBuffer = Buffer.concat(chunks);
              
              // Guardar thumbnail en storage
              const thumbnailPath = `previews/${conversationId}/videos/${fileId}_thumb.jpg`;
              const thumbnailUrl = await this.savePreviewToStorage(thumbnailBuffer, thumbnailPath, 'image/jpeg');

              const thumbnail = {
                url: thumbnailUrl,
                size: thumbnailBuffer.length,
                dimensions: { width: size, height: size },
                time: time,
                type: 'video-thumbnail'
              };

              logger.info('✅ Thumbnail de video generado exitosamente', {
                fileId: fileId.substring(0, 20) + '...',
                size: `${thumbnailBuffer.length / 1024}KB`,
                dimensions: `${size}x${size}`
              });

              resolve(thumbnail);

            } catch (saveError) {
              reject(saveError);
            }
          })
          .on('error', (err) => {
            logger.warn('⚠️ Error generando thumbnail de video, usando método alternativo:', err.message);
            
            // Método alternativo: generar thumbnail básico
            this.generateBasicVideoThumbnail(fileId, conversationId, size)
              .then(resolve)
              .catch(reject);
          })
          .pipe(require('stream').Writable({
            write(chunk, encoding, callback) {
              chunks.push(chunk);
              callback();
            }
          }));
      });

    } catch (error) {
      logger.error('❌ Error generando thumbnail de video', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...'
      });
      throw error;
    }
  }

  /**
   * 🆕 🎥 GENERAR THUMBNAIL BÁSICO DE VIDEO
   * Método alternativo cuando FFmpeg falla.
   */
  async generateBasicVideoThumbnail(fileId, conversationId, size = 320) {
    try {
      logger.info('🎥 Generando thumbnail básico de video', {
        fileId: fileId.substring(0, 20) + '...',
        size
      });

      // Crear un thumbnail básico con icono de video
      const canvas = require('canvas');
      const thumbnailCanvas = canvas.createCanvas(size, size);
      const ctx = thumbnailCanvas.getContext('2d');

      // Fondo negro
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, size, size);

      // Borde gris
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 3;
      ctx.strokeRect(10, 10, size - 20, size - 20);

      // Icono de play
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(size * 0.35, size * 0.25);
      ctx.lineTo(size * 0.35, size * 0.75);
      ctx.lineTo(size * 0.75, size * 0.5);
      ctx.closePath();
      ctx.fill();

      // Texto "VIDEO"
      ctx.fillStyle = '#ffffff';
      ctx.font = `${size / 8}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VIDEO', size / 2, size * 0.85);

      // Convertir canvas a buffer
      const thumbnailBuffer = thumbnailCanvas.toBuffer('image/jpeg', { quality: 0.8 });

      // Guardar en storage
      const thumbnailPath = `previews/${conversationId}/videos/${fileId}_basic_thumb.jpg`;
      const thumbnailUrl = await this.savePreviewToStorage(thumbnailBuffer, thumbnailPath, 'image/jpeg');

      logger.info('✅ Thumbnail básico de video generado', {
        fileId: fileId.substring(0, 20) + '...',
        size: `${thumbnailBuffer.length / 1024}KB`
      });

      return {
        url: thumbnailUrl,
        size: thumbnailBuffer.length,
        dimensions: { width: size, height: size },
        type: 'video-thumbnail-basic'
      };

    } catch (error) {
      logger.error('❌ Error generando thumbnail básico de video', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...'
      });
      throw error;
    }
  }

  /**
   * 🆕 🎥 GENERAR PREVIEW COMPLETO DE VIDEO
   * Genera thumbnail, metadatos y URLs de preview para videos.
   */
  async generateCompleteVideoPreview(buffer, fileId, conversationId, mimetype, options = {}) {
    try {
      const {
        generateThumbnail = true,
        extractMetadata = true,
        thumbnailSize = 320,
        thumbnailTime = 5,
        generatePreviewUrl = true
      } = options;

      logger.info('🎥 Generando preview completo de video', {
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        mimetype,
        generateThumbnail,
        extractMetadata,
        generatePreviewUrl
      });

      const previewData = {
        videoType: this.getVideoType(mimetype),
        originalSize: buffer.length,
        originalMimetype: mimetype,
        thumbnail: null,
        metadata: null,
        previewUrl: null
      };

      // Generar preview básico
      const basicPreview = await this.generateVideoPreview(buffer, fileId, conversationId, {
        generateThumbnail,
        extractMetadata,
        thumbnailSize,
        thumbnailTime
      });

      Object.assign(previewData, basicPreview);

      // Generar URL de preview si se solicita
      if (generatePreviewUrl) {
        try {
          const previewUrl = await this.generateVideoPreviewUrl(buffer, fileId, conversationId, mimetype);
          previewData.previewUrl = previewUrl;
          
          logger.info('✅ URL de preview de video generada', {
            fileId: fileId.substring(0, 20) + '...',
            previewUrl: previewUrl.substring(0, 50) + '...'
          });
        } catch (urlError) {
          logger.warn('⚠️ No se pudo generar URL de preview del video:', urlError.message);
        }
      }

      logger.info('✅ Preview completo de video generado exitosamente', {
        fileId: fileId.substring(0, 20) + '...',
        hasMetadata: !!previewData.metadata,
        hasThumbnail: !!previewData.thumbnail,
        hasPreviewUrl: !!previewData.previewUrl
      });

      return previewData;

    } catch (error) {
      logger.error('❌ Error generando preview completo de video', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...',
        mimetype
      });
      throw error;
    }
  }

  /**
   * 🆕 🎥 GENERAR URL DE PREVIEW DE VIDEO
   * Genera una URL para preview/streaming del video.
   */
  async generateVideoPreviewUrl(buffer, fileId, conversationId, mimetype) {
    try {
      logger.info('🎥 Generando URL de preview de video', {
        fileId: fileId.substring(0, 20) + '...',
        mimetype
      });

      // Guardar video en storage para preview
      const videoPath = `previews/${conversationId}/videos/${fileId}_preview.${this.getVideoExtension(mimetype)}`;
      const videoUrl = await this.savePreviewToStorage(buffer, videoPath, mimetype);

      logger.info('✅ URL de preview de video generada exitosamente', {
        fileId: fileId.substring(0, 20) + '...',
        videoPath,
        url: videoUrl.substring(0, 50) + '...'
      });

      return videoUrl;

    } catch (error) {
      logger.error('❌ Error generando URL de preview de video', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...'
      });
      throw error;
    }
  }

  /**
   * 🆕 🎥 OBTENER TIPO DE VIDEO
   */
  getVideoType(mimetype) {
    if (mimetype.includes('mp4')) return 'mp4';
    if (mimetype.includes('avi')) return 'avi';
    if (mimetype.includes('mov')) return 'mov';
    if (mimetype.includes('wmv')) return 'wmv';
    if (mimetype.includes('flv')) return 'flv';
    if (mimetype.includes('webm')) return 'webm';
    if (mimetype.includes('3gpp')) return '3gpp';
    return 'video';
  }

  /**
   * 🆕 🎥 OBTENER EXTENSIÓN DE VIDEO
   */
  getVideoExtension(mimetype) {
    const extensions = {
      'video/mp4': 'mp4',
      'video/avi': 'avi',
      'video/quicktime': 'mov',
      'video/x-ms-wmv': 'wmv',
      'video/x-flv': 'flv',
      'video/webm': 'webm',
      'video/3gpp': '3gp'
    };
    
    return extensions[mimetype] || 'mp4';
  }



  /**
   * 🆕 ⚡ PROCESAR ARCHIVO GRANDE OPTIMIZADO
   * Procesa archivos grandes en chunks para evitar problemas de memoria.
   */
  async processLargeFile(buffer, fileId, conversationId, options = {}) {
    try {
      const startTime = Date.now();
      const fileSize = buffer.length;
      
      logger.info('⚡ Procesando archivo grande optimizado', {
        fileId: fileId.substring(0, 20) + '...',
        fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`,
        conversationId: conversationId.substring(0, 20) + '...'
      });

      // Verificar cache primero
      const cacheKey = `${fileId}_${fileSize}_${JSON.stringify(options)}`;
      const cachedResult = this.getFromCache(this.fileCache, cacheKey);
      
      if (cachedResult) {
        this.performanceMetrics.cacheHits++;
        logger.info('⚡ Resultado obtenido de cache', {
          fileId: fileId.substring(0, 20) + '...',
          cacheHit: true
        });
        return cachedResult;
      }

      this.performanceMetrics.cacheMisses++;

      // Procesar en chunks si el archivo es muy grande (>50MB)
      if (fileSize > 50 * 1024 * 1024) {
        const result = await this.processLargeFileInChunks(buffer, fileId, conversationId, options);
        this.addToCache(this.fileCache, cacheKey, result);
        this.updatePerformanceMetrics(startTime);
        return result;
      }

      // Procesamiento normal para archivos medianos
      const result = await this.processFileOptimized(buffer, fileId, conversationId, options);
      this.addToCache(this.fileCache, cacheKey, result);
      this.updatePerformanceMetrics(startTime);
      
      return result;

    } catch (error) {
      this.performanceMetrics.errors++;
      logger.error('❌ Error procesando archivo grande', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...',
        fileSize: buffer?.length
      });
      throw error;
    }
  }

  /**
   * 🆕 ⚡ PROCESAR ARCHIVO GRANDE EN CHUNKS
   */
  async processLargeFileInChunks(buffer, fileId, conversationId, options = {}) {
    try {
      const chunkSize = 10 * 1024 * 1024; // 10MB chunks
      const chunks = [];
      
      // Dividir buffer en chunks
      for (let i = 0; i < buffer.length; i += chunkSize) {
        chunks.push(buffer.slice(i, i + chunkSize));
      }

      logger.info('⚡ Procesando archivo en chunks', {
        fileId: fileId.substring(0, 20) + '...',
        totalChunks: chunks.length,
        chunkSize: `${(chunkSize / 1024 / 1024).toFixed(1)}MB`
      });

      // Procesar cada chunk
      const processedChunks = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        logger.info(`⚡ Procesando chunk ${i + 1}/${chunks.length}`, {
          fileId: fileId.substring(0, 20) + '...',
          chunkSize: `${(chunk.length / 1024 / 1024).toFixed(2)}MB`
        });

        // Procesar chunk individual
        const processedChunk = await this.processChunk(chunk, i, options);
        processedChunks.push(processedChunk);

        // Liberar memoria del chunk original
        chunks[i] = null;
      }

      // Combinar resultados
      const combinedResult = this.combineChunkResults(processedChunks, fileId, conversationId);
      
      logger.info('✅ Archivo grande procesado exitosamente', {
        fileId: fileId.substring(0, 20) + '...',
        totalChunks: chunks.length,
        finalSize: `${(combinedResult.buffer?.length / 1024 / 1024).toFixed(2)}MB`
      });

      return combinedResult;

    } catch (error) {
      logger.error('❌ Error procesando archivo en chunks', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...'
      });
      throw error;
    }
  }

  /**
   * 🆕 ⚡ PROCESAR CHUNK INDIVIDUAL
   */
  async processChunk(chunk, chunkIndex, options = {}) {
    try {
      // Procesamiento básico del chunk
      const processedChunk = {
        index: chunkIndex,
        size: chunk.length,
        processed: true,
        data: chunk // En una implementación real, aquí se procesaría el chunk
      };

      return processedChunk;

    } catch (error) {
      logger.error('❌ Error procesando chunk', {
        error: error.message,
        chunkIndex
      });
      throw error;
    }
  }

  /**
   * 🆕 ⚡ COMBINAR RESULTADOS DE CHUNKS
   */
  combineChunkResults(processedChunks, fileId, conversationId) {
    try {
      // Combinar todos los chunks procesados
      const combinedBuffer = Buffer.concat(processedChunks.map(chunk => chunk.data));
      
      const result = {
        buffer: combinedBuffer,
        fileId,
        conversationId,
        processedInChunks: true,
        totalChunks: processedChunks.length,
        finalSize: combinedBuffer.length
      };

      return result;

    } catch (error) {
      logger.error('❌ Error combinando resultados de chunks', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...'
      });
      throw error;
    }
  }

  /**
   * 🆕 ⚡ PROCESAR ARCHIVO OPTIMIZADO
   */
  async processFileOptimized(buffer, fileId, conversationId, options = {}) {
    try {
      const startTime = Date.now();
      
      // Optimizaciones específicas según el tipo de archivo
      const mimetype = options.mimetype || 'application/octet-stream';
      
      if (mimetype.startsWith('image/')) {
        return await this.optimizeImageProcessing(buffer, fileId, conversationId, options);
      } else if (mimetype.startsWith('video/')) {
        return await this.optimizeVideoProcessing(buffer, fileId, conversationId, options);
      } else if (mimetype.startsWith('audio/')) {
        return await this.optimizeAudioProcessing(buffer, fileId, conversationId, options);
      } else {
        return await this.processFile(buffer, fileId, conversationId, options);
      }

    } catch (error) {
      logger.error('❌ Error en procesamiento optimizado', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...'
      });
      throw error;
    }
  }

  /**
   * 🆕 ⚡ OPTIMIZAR PROCESAMIENTO DE IMAGENES
   */
  async optimizeImageProcessing(buffer, fileId, conversationId, options = {}) {
    try {
      // Usar worker threads para procesamiento de imágenes pesado
      const { Worker } = require('worker_threads');
      
      return new Promise((resolve, reject) => {
        const worker = new Worker(`
          const { parentPort } = require('worker_threads');
          const sharp = require('sharp');
          
          parentPort.on('message', async (data) => {
            try {
              const { buffer, options } = data;
              
              // Procesamiento optimizado con sharp
              const processedBuffer = await sharp(buffer)
                .resize(options.width || 800, options.height || 600, {
                  fit: 'inside',
                  withoutEnlargement: true
                })
                .jpeg({ quality: options.quality || 85, progressive: true })
                .toBuffer();
              
              parentPort.postMessage({ success: true, buffer: processedBuffer });
            } catch (error) {
              parentPort.postMessage({ success: false, error: error.message });
            }
          });
        `, { eval: true });

        worker.on('message', (result) => {
          if (result && result.success) {
            resolve({
              buffer: result.buffer,
              fileId,
              conversationId,
              optimized: true,
              processingTime: Date.now() - startTime
            });
          } else {
            const errorMessage = result && result.error ? result.error : 'Error desconocido en procesamiento de imagen';
            reject(new Error(errorMessage));
          }
          worker.terminate();
        });

        worker.on('error', reject);
        worker.postMessage({ buffer, options });
      });

    } catch (error) {
      logger.error('❌ Error en optimización de imagen', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...'
      });
      throw error;
    }
  }

  /**
   * 🆕 ⚡ OPTIMIZAR PROCESAMIENTO DE VIDEOS
   */
  async optimizeVideoProcessing(buffer, fileId, conversationId, options = {}) {
    try {
      // Para videos, usar procesamiento asíncrono y streaming
      const result = {
        buffer,
        fileId,
        conversationId,
        optimized: true,
        videoOptimized: true,
        processingMethod: 'streaming'
      };

      // En una implementación real, aquí se optimizaría el video
      // usando FFmpeg con opciones optimizadas

      return result;

    } catch (error) {
      logger.error('❌ Error en optimización de video', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...'
      });
      throw error;
    }
  }

  /**
   * 🆕 ⚡ OPTIMIZAR PROCESAMIENTO DE AUDIO
   */
  async optimizeAudioProcessing(buffer, fileId, conversationId, options = {}) {
    try {
      // Para audio, usar procesamiento optimizado
      const result = {
        buffer,
        fileId,
        conversationId,
        optimized: true,
        audioOptimized: true,
        processingMethod: 'optimized'
      };

      // En una implementación real, aquí se optimizaría el audio
      // usando FFmpeg con opciones específicas para audio

      return result;

    } catch (error) {
      logger.error('❌ Error en optimización de audio', {
        error: error.message,
        fileId: fileId?.substring(0, 20) + '...'
      });
      throw error;
    }
  }

  /**
   * 🆕 ⚡ GESTIÓN DE CACHE
   */
  getFromCache(cache, key) {
    const item = cache.get(key);
    if (item && Date.now() - item.timestamp < this.cacheConfig.ttl) {
      return item.data;
    }
    if (item) {
      cache.delete(key); // Eliminar item expirado
    }
    return null;
  }

  addToCache(cache, key, data) {
    // Limpiar cache si está lleno
    if (cache.size >= this.cacheConfig.maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      
      // Limpiar fileCache
      for (const [key, item] of this.fileCache.entries()) {
        if (now - item.timestamp > this.cacheConfig.ttl) {
          this.fileCache.delete(key);
        }
      }

      // Limpiar previewCache
      for (const [key, item] of this.previewCache.entries()) {
        if (now - item.timestamp > this.cacheConfig.ttl) {
          this.previewCache.delete(key);
        }
      }

      // Limpiar metadataCache
      for (const [key, item] of this.metadataCache.entries()) {
        if (now - item.timestamp > this.cacheConfig.ttl) {
          this.metadataCache.delete(key);
        }
      }

      // 🔧 CORRECCIÓN CRÍTICA: Validar que logger existe antes de usarlo
      if (logger && typeof logger.debug === 'function') {
        try {
          logger.debug('🧹 Cache cleanup completado', {
            fileCacheSize: this.fileCache.size,
            previewCacheSize: this.previewCache.size,
            metadataCacheSize: this.metadataCache.size
          });
        } catch (logError) {
          console.error('Error en logger.debug durante cache cleanup:', logError.message);
        }
      } else {
        console.log('🧹 Cache cleanup completado - Logger no disponible');
      }
    }, this.cacheConfig.cleanupInterval);
  }

  /**
   * 🆕 ⚡ ACTUALIZAR MÉTRICAS DE RENDIMIENTO
   */
  updatePerformanceMetrics(startTime) {
    const processingTime = Date.now() - startTime;
    this.performanceMetrics.filesProcessed++;
    this.performanceMetrics.processingTimes.push(processingTime);
    
    // Mantener solo los últimos 100 tiempos
    if (this.performanceMetrics.processingTimes.length > 100) {
      this.performanceMetrics.processingTimes.shift();
    }
  }

  /**
   * 🆕 ⚡ OBTENER MÉTRICAS DE RENDIMIENTO
   */
  getPerformanceMetrics() {
    const avgProcessingTime = this.performanceMetrics.processingTimes.length > 0
      ? this.performanceMetrics.processingTimes.reduce((a, b) => a + b, 0) / this.performanceMetrics.processingTimes.length
      : 0;

    const cacheHitRate = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses > 0
      ? (this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)) * 100
      : 0;

    return {
      filesProcessed: this.performanceMetrics.filesProcessed,
      cacheHits: this.performanceMetrics.cacheHits,
      cacheMisses: this.performanceMetrics.cacheMisses,
      cacheHitRate: cacheHitRate.toFixed(2) + '%',
      averageProcessingTime: avgProcessingTime.toFixed(2) + 'ms',
      errors: this.performanceMetrics.errors,
      cacheSize: {
        fileCache: this.fileCache.size,
        previewCache: this.previewCache.size,
        metadataCache: this.metadataCache.size
      }
    };
  }

  /**
   * 🆕 Guardar archivo en base de datos con metadata completa
   */
  async saveFileToDatabase(fileData) {
    try {
      const {
        fileId,
        conversationId,
        userId,
        uploadedBy,
        originalName,
        mimetype,
        size,
        url,
        thumbnailUrl,
        previewUrl,
        metadata = {},
        category,
        storagePath,
        publicUrl,
        tags = []
      } = fileData;

      logger.info('💾 Guardando archivo en base de datos', {
        fileId,
        conversationId,
        originalName,
        category
      });

      const fileRecord = {
        id: fileId,
        conversationId,
        userId,
        uploadedBy,
        originalName,
        mimetype,
        size,
        sizeBytes: size,
        url,
        thumbnailUrl,
        previewUrl,
        storagePath,
        publicUrl,
        category,
        metadata: {
          ...metadata,
          savedAt: new Date().toISOString(),
          processingCompleted: true
        },
        tags: [...tags, 'database-saved'],
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        downloadCount: 0,
        lastAccessedAt: null
      };

      // Guardar en Firestore usando el modelo File
      try {
        const savedFile = await File.create(fileRecord);

        logger.info('✅ Archivo guardado exitosamente en base de datos', {
          fileId,
          conversationId,
          category
        });

        return savedFile;
      } catch (createError) {
        logger.error('❌ Error en File.create()', {
          fileId,
          conversationId,
          error: createError.message,
          stack: createError.stack,
          fileRecord: {
            id: fileRecord.id,
            conversationId: fileRecord.conversationId,
            category: fileRecord.category
          }
        });
        throw createError;
      }
    } catch (error) {
      logger.error('❌ Error guardando archivo en base de datos', {
        error: error.message,
        fileData: { fileId: fileData.fileId, conversationId: fileData.conversationId }
      });
      throw error;
    }
  }

  /**
   * 🆕 Obtener archivo de base de datos por ID
   */
  async getFileFromDatabase(fileId) {
    try {
      const file = await File.getById(fileId);
      if (!file) {
        throw new Error(`Archivo no encontrado: ${fileId}`);
      }
      return file;
    } catch (error) {
      logger.error('❌ Error obteniendo archivo de base de datos', {
        error: error.message,
        fileId
      });
      throw error;
    }
  }

  /**
   * 🆕 Obtener archivos de una conversación desde base de datos
   */
  async getFilesByConversation(conversationId, options = {}) {
    try {
      const { limit = 50, offset = 0, category = null, sortBy = 'uploadedAt', sortOrder = 'desc' } = options;

      let query = firestore
        .collection('files')
        .where('conversationId', '==', conversationId)
        .where('isActive', '==', true);

      if (category) {
        query = query.where('category', '==', category);
      }

      query = query.orderBy(sortBy, sortOrder).limit(limit).offset(offset);

      const snapshot = await query.get();
      const files = [];

      snapshot.forEach(doc => {
        files.push({
          id: doc.id,
          ...doc.data()
        });
      });

      logger.info('📋 Archivos obtenidos de conversación', {
        conversationId,
        count: files.length,
        category
      });

      return files;
    } catch (error) {
      logger.error('❌ Error obteniendo archivos de conversación', {
        error: error.message,
        conversationId
      });
      throw error;
    }
  }

  /**
   * 🆕 Actualizar metadata de archivo en base de datos
   */
  async updateFileMetadata(fileId, updates) {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };

      await firestore.collection('files').doc(fileId).update(updateData);

      logger.info('✅ Metadata de archivo actualizada', {
        fileId,
        updates: Object.keys(updates)
      });

      return true;
    } catch (error) {
      logger.error('❌ Error actualizando metadata de archivo', {
        error: error.message,
        fileId
      });
      throw error;
    }
  }

  /**
   * 🆕 Marcar archivo como eliminado (soft delete)
   */
  async softDeleteFile(fileId, deletedBy) {
    try {
      await this.updateFileMetadata(fileId, {
        isActive: false,
        deletedAt: new Date(),
        deletedBy
      });

      logger.info('🗑️ Archivo marcado como eliminado', {
        fileId,
        deletedBy
      });

      return true;
    } catch (error) {
      logger.error('❌ Error eliminando archivo', {
        error: error.message,
        fileId
      });
      throw error;
    }
  }

  /**
   * 🆕 Incrementar contador de descargas
   */
  async incrementDownloadCount(fileId) {
    try {
      await firestore.collection('files').doc(fileId).update({
        downloadCount: FieldValue.increment(1),
        lastAccessedAt: new Date(),
        updatedAt: new Date()
      });

      logger.info('📥 Contador de descargas incrementado', { fileId });
      return true;
    } catch (error) {
      logger.error('❌ Error incrementando contador de descargas', {
        error: error.message,
        fileId
      });
      throw error;
    }
  }

  /**
   * 🆕 Obtener estadísticas de archivos por conversación
   */
  async getFileStatsByConversation(conversationId) {
    try {
      const files = await this.getFilesByConversation(conversationId, { limit: 1000 });
      
      const stats = {
        totalFiles: files.length,
        totalSize: 0,
        byCategory: {
          image: { count: 0, size: 0 },
          video: { count: 0, size: 0 },
          audio: { count: 0, size: 0 },
          document: { count: 0, size: 0 }
        },
        recentUploads: 0,
        mostActiveUser: null
      };

      const userActivity = {};

      files.forEach(file => {
        stats.totalSize += file.sizeBytes || 0;
        
        if (stats.byCategory[file.category]) {
          stats.byCategory[file.category].count++;
          stats.byCategory[file.category].size += file.sizeBytes || 0;
        }

        // Archivos recientes (últimos 7 días)
        const uploadDate = new Date(file.uploadedAt?.toDate?.() || file.uploadedAt);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (uploadDate > weekAgo) {
          stats.recentUploads++;
        }

        // Usuario más activo
        const uploadedBy = file.uploadedBy;
        userActivity[uploadedBy] = (userActivity[uploadedBy] || 0) + 1;
      });

      // Encontrar usuario más activo
      if (Object.keys(userActivity).length > 0) {
        stats.mostActiveUser = Object.entries(userActivity)
          .sort(([,a], [,b]) => b - a)[0][0];
      }

      logger.info('📊 Estadísticas de archivos obtenidas', {
        conversationId,
        totalFiles: stats.totalFiles,
        totalSize: this.formatFileSize(stats.totalSize)
      });

      return stats;
    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas de archivos', {
        error: error.message,
        conversationId
      });
      throw error;
    }
  }

  /**
   * 🆕 Buscar archivos por texto en nombre o metadata
   */
  async searchFiles(conversationId, searchTerm, options = {}) {
    try {
      const { limit = 20, category = null } = options;

      let query = firestore
        .collection('files')
        .where('conversationId', '==', conversationId)
        .where('isActive', '==', true);

      if (category) {
        query = query.where('category', '==', category);
      }

      const snapshot = await query.get();
      const files = [];

      snapshot.forEach(doc => {
        const fileData = doc.data();
        const searchableText = `${fileData.originalName} ${fileData.metadata?.description || ''} ${fileData.tags?.join(' ') || ''}`.toLowerCase();
        
        if (searchableText.includes(searchTerm.toLowerCase())) {
          files.push({
            id: doc.id,
            ...fileData
          });
        }
      });

      // Ordenar por relevancia y fecha
      files.sort((a, b) => {
        const aRelevance = a.originalName.toLowerCase().includes(searchTerm.toLowerCase()) ? 2 : 1;
        const bRelevance = b.originalName.toLowerCase().includes(searchTerm.toLowerCase()) ? 2 : 1;
        
        if (aRelevance !== bRelevance) {
          return bRelevance - aRelevance;
        }
        
        return new Date(b.uploadedAt?.toDate?.() || b.uploadedAt) - new Date(a.uploadedAt?.toDate?.() || a.uploadedAt);
      });

      const limitedFiles = files.slice(0, limit);

      logger.info('🔍 Búsqueda de archivos completada', {
        conversationId,
        searchTerm,
        results: limitedFiles.length,
        totalFound: files.length
      });

      return limitedFiles;
    } catch (error) {
      logger.error('❌ Error buscando archivos', {
        error: error.message,
        conversationId,
        searchTerm
      });
      throw error;
    }
  }

  /**
   * 🆕 Obtener archivos duplicados por hash
   */
  async findDuplicateFiles(conversationId) {
    try {
      const files = await this.getFilesByConversation(conversationId, { limit: 1000 });
      const hashGroups = {};

      // Agrupar por hash si existe
      files.forEach(file => {
        const hash = file.metadata?.fileHash;
        if (hash) {
          if (!hashGroups[hash]) {
            hashGroups[hash] = [];
          }
          hashGroups[hash].push(file);
        }
      });

      // Filtrar solo grupos con duplicados
      const duplicates = Object.values(hashGroups).filter(group => group.length > 1);

      logger.info('🔍 Archivos duplicados encontrados', {
        conversationId,
        duplicateGroups: duplicates.length,
        totalDuplicates: duplicates.reduce((sum, group) => sum + group.length, 0)
      });

      return duplicates;
    } catch (error) {
      logger.error('❌ Error buscando archivos duplicados', {
        error: error.message,
        conversationId
      });
      throw error;
    }
  }

  /**
   * 🔄 FASE 8: TRACKING DE USO DE ARCHIVOS
   * Registra el uso de archivos para analytics y métricas
   */
  async trackFileUsage(fileId, action, userId, requestData = {}) {
    try {
      if (!this.usageTracking.enabled) {
        logger.debug('Tracking de uso deshabilitado', { fileId, action });
        return;
      }

      // Validar acción permitida
      const allowedActions = ['view', 'download', 'share', 'upload', 'delete', 'preview', 'edit'];
      if (!allowedActions.includes(action)) {
        logger.warn('Acción de tracking no permitida', { fileId, action, userId });
        return;
      }

      // Crear registro de uso
      const usageRecord = {
        fileId,
        action,
        userId,
        timestamp: new Date(),
        userAgent: requestData.userAgent || 'unknown',
        ip: requestData.ip || 'unknown',
        sessionId: requestData.sessionId || null,
        metadata: {
          workspaceId: requestData.workspaceId || 'default',
          tenantId: requestData.tenantId || 'default',
          conversationId: requestData.conversationId || null,
          deviceType: this.getDeviceType(requestData.userAgent),
          browser: this.getBrowserInfo(requestData.userAgent),
          platform: this.getPlatformInfo(requestData.userAgent)
        }
      };

      // Guardar en Firestore
      await firestore.collection('file_usage').add(usageRecord);

      // Actualizar métricas en tiempo real
      const fileMonitoringSystem = require('./monitoring');
      if (fileMonitoringSystem && fileMonitoringSystem.recordFileAction) {
        fileMonitoringSystem.recordFileAction(fileId, action, userId);
      }

      logger.info('📊 Uso de archivo registrado', {
        fileId: fileId.substring(0, 20) + '...',
        action,
        userId: userId?.substring(0, 20) + '...',
        userAgent: requestData.userAgent?.substring(0, 50) + '...'
      });

      return usageRecord;

    } catch (error) {
      logger.error('❌ Error registrando uso de archivo', {
        fileId: fileId?.substring(0, 20) + '...',
        action,
        userId: userId?.substring(0, 20) + '...',
        error: error.message
      });
      // No fallar la operación principal por error de tracking
    }
  }

  /**
   * 🔄 FASE 8: OBTENER ESTADÍSTICAS DE USO DE ARCHIVO
   * Obtiene estadísticas detalladas de uso de un archivo específico
   */
  async getFileUsageStats(fileId, timeRange = '30d') {
    try {
      const startDate = this.getStartDate(timeRange);
      
      const snapshot = await firestore
        .collection('file_usage')
        .where('fileId', '==', fileId)
        .where('timestamp', '>=', startDate)
        .orderBy('timestamp', 'desc')
        .get();

      const usageRecords = [];
      const actionCounts = {};
      const userCounts = {};
      const dailyCounts = {};

      snapshot.forEach(doc => {
        const record = doc.data();
        usageRecords.push(record);

        // Contar acciones
        actionCounts[record.action] = (actionCounts[record.action] || 0) + 1;

        // Contar usuarios únicos
        if (record.userId) {
          userCounts[record.userId] = (userCounts[record.userId] || 0) + 1;
        }

        // Contar por día
        const day = record.timestamp.toDate().toISOString().split('T')[0];
        dailyCounts[day] = (dailyCounts[day] || 0) + 1;
      });

      const stats = {
        fileId,
        timeRange,
        totalUsage: usageRecords.length,
        uniqueUsers: Object.keys(userCounts).length,
        actionBreakdown: actionCounts,
        topUsers: Object.entries(userCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([userId, count]) => ({ userId, count })),
        dailyUsage: Object.entries(dailyCounts)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, count]) => ({ date, count })),
        recentActivity: usageRecords.slice(0, 20),
        averageUsagePerDay: usageRecords.length / Math.max(1, Object.keys(dailyCounts).length)
      };

      logger.info('📊 Estadísticas de uso obtenidas', {
        fileId: fileId.substring(0, 20) + '...',
        timeRange,
        totalUsage: stats.totalUsage,
        uniqueUsers: stats.uniqueUsers
      });

      return stats;

    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas de uso', {
        fileId: fileId?.substring(0, 20) + '...',
        timeRange,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🔄 FASE 8: OBTENER MÉTRICAS GLOBALES DE USO
   * Obtiene métricas globales de uso de archivos
   */
  async getGlobalUsageMetrics(timeRange = '30d') {
    try {
      const startDate = this.getStartDate(timeRange);
      
      const snapshot = await firestore
        .collection('file_usage')
        .where('timestamp', '>=', startDate)
        .orderBy('timestamp', 'desc')
        .get();

      const usageRecords = [];
      const fileCounts = {};
      const actionCounts = {};
      const userCounts = {};
      const conversationCounts = {};

      snapshot.forEach(doc => {
        const record = doc.data();
        usageRecords.push(record);

        // Contar archivos únicos
        fileCounts[record.fileId] = (fileCounts[record.fileId] || 0) + 1;

        // Contar acciones
        actionCounts[record.action] = (actionCounts[record.action] || 0) + 1;

        // Contar usuarios únicos
        if (record.userId) {
          userCounts[record.userId] = (userCounts[record.userId] || 0) + 1;
        }

        // Contar conversaciones únicas
        if (record.metadata?.conversationId) {
          conversationCounts[record.metadata.conversationId] = (conversationCounts[record.metadata.conversationId] || 0) + 1;
        }
      });

      const metrics = {
        timeRange,
        totalUsage: usageRecords.length,
        uniqueFiles: Object.keys(fileCounts).length,
        uniqueUsers: Object.keys(userCounts).length,
        uniqueConversations: Object.keys(conversationCounts).length,
        actionBreakdown: actionCounts,
        topFiles: Object.entries(fileCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 20)
          .map(([fileId, count]) => ({ fileId, count })),
        topUsers: Object.entries(userCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 20)
          .map(([userId, count]) => ({ userId, count })),
        topConversations: Object.entries(conversationCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 20)
          .map(([conversationId, count]) => ({ conversationId, count })),
        averageUsagePerFile: usageRecords.length / Math.max(1, Object.keys(fileCounts).length),
        averageUsagePerUser: usageRecords.length / Math.max(1, Object.keys(userCounts).length)
      };

      logger.info('📊 Métricas globales de uso obtenidas', {
        timeRange,
        totalUsage: metrics.totalUsage,
        uniqueFiles: metrics.uniqueFiles,
        uniqueUsers: metrics.uniqueUsers
      });

      return metrics;

    } catch (error) {
      logger.error('❌ Error obteniendo métricas globales', {
        timeRange,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🔄 FASE 8: FUNCIONES AUXILIARES PARA TRACKING
   */

  /**
   * Obtener fecha de inicio basada en el rango de tiempo
   */
  getStartDate(timeRange) {
    const now = new Date();
    switch (timeRange) {
      case '1d':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case '1y':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 días por defecto
    }
  }

  /**
   * Detectar tipo de dispositivo desde User-Agent
   */
  getDeviceType(userAgent) {
    if (!userAgent) return 'unknown';
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  /**
   * Detectar información del navegador
   */
  getBrowserInfo(userAgent) {
    if (!userAgent) return 'unknown';
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome')) return 'chrome';
    if (ua.includes('firefox')) return 'firefox';
    if (ua.includes('safari')) return 'safari';
    if (ua.includes('edge')) return 'edge';
    if (ua.includes('opera')) return 'opera';
    return 'other';
  }

  /**
   * Detectar información de la plataforma
   */
  getPlatformInfo(userAgent) {
    if (!userAgent) return 'unknown';
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('windows')) return 'windows';
    if (ua.includes('mac')) return 'mac';
    if (ua.includes('linux')) return 'linux';
    if (ua.includes('android')) return 'android';
    if (ua.includes('ios')) return 'ios';
    return 'other';
  }

  /**
   * 🔄 FASE 8: CONFIGURAR TRACKING DE USO
   * Habilita o deshabilita el tracking de uso
   */
  configureUsageTracking(config) {
    try {
      this.usageTracking = {
        ...this.usageTracking,
        ...config
      };

      logger.info('📊 Configuración de tracking actualizada', {
        enabled: this.usageTracking.enabled,
        trackViews: this.usageTracking.trackViews,
        trackDownloads: this.usageTracking.trackDownloads,
        trackShares: this.usageTracking.trackShares,
        trackUploads: this.usageTracking.trackUploads,
        trackDeletes: this.usageTracking.trackDeletes
      });

      return this.usageTracking;

    } catch (error) {
      logger.error('❌ Error configurando tracking de uso', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🔄 FASE 9: FUNCIONES FALTANTES PARA 100%
   */

  /**
   * 🔗 COMPARTIR ARCHIVO
   * Genera enlaces de compartir temporales con permisos específicos
   */
  async shareFile(fileId, shareWith, permissions = 'view', userId, options = {}) {
    try {
      const { expiresIn = 24 * 60 * 60 * 1000, password = null, maxDownloads = null } = options;

      logger.info('🔗 Compartiendo archivo', {
        fileId,
        shareWith,
        permissions,
        userId,
        expiresIn
      });

      // Verificar que el archivo existe y el usuario tiene permisos
      const file = await File.getById(fileId);
      if (!file || !file.isActive) {
        throw new Error('Archivo no encontrado o inactivo');
      }

      if (file.uploadedBy !== userId && !this.isAdmin(userId)) {
        throw new Error('No tienes permisos para compartir este archivo');
      }

      // Generar token de compartir único
      const shareToken = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Crear registro de compartir
      const shareRecord = {
        fileId,
        sharedBy: userId,
        sharedWith: shareWith,
        permissions,
        shareToken,
        expiresAt: new Date(Date.now() + expiresIn),
        password: password ? await this.hashPassword(password) : null,
        maxDownloads,
        downloadCount: 0,
        createdAt: new Date()
      };

      // Guardar en Firestore
      await firestore.collection('file_shares').doc(shareToken).set(shareRecord);

      // Generar URL de compartir
      const shareUrl = `${process.env.FRONTEND_URL || 'https://app.utalk.com'}/shared/${shareToken}`;

      // Tracking de compartir
      await this.trackFileUsage(fileId, 'share', userId, {
        shareWith,
        permissions,
        shareToken
      });

      logger.info('✅ Archivo compartido exitosamente', {
        fileId,
        shareToken,
        shareUrl: shareUrl.substring(0, 50) + '...'
      });

      return {
        fileId,
        shareToken,
        shareUrl,
        expiresAt: shareRecord.expiresAt,
        permissions,
        maxDownloads
      };

    } catch (error) {
      logger.error('❌ Error compartiendo archivo', {
        fileId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🖼️ GENERAR PREVIEW COMPLETO
   * Genera previews optimizados para todos los tipos de archivo
   */
  async generatePreview(fileId, options = {}) {
    try {
      const {
        width = 800,
        height = 600,
        quality = 80,
        format = 'webp',
        generateThumbnail = true
      } = options;

      logger.info('🖼️ Generando preview completo', {
        fileId,
        width,
        height,
        quality,
        format
      });

      const file = await File.getById(fileId);
      if (!file || !file.isActive) {
        throw new Error('Archivo no encontrado o inactivo');
      }

      // Obtener archivo desde storage
      const bucket = this.getBucket();
      const storageFile = bucket.file(file.storagePath);
      const [fileBuffer] = await storageFile.download();

      let previewData = {
        fileId,
        originalSize: file.size,
        originalMimetype: file.mimetype,
        thumbnail: null,
        previewUrl: null,
        metadata: null
      };

      // Generar preview según tipo de archivo
      if (this.isImage(file.mimetype)) {
        previewData = await this.generateImagePreview(fileBuffer, fileId, file.conversationId, {
          width,
          height,
          quality,
          format,
          generateThumbnail
        });
      } else if (this.isVideo(file.mimetype)) {
        previewData = await this.generateVideoPreview(fileBuffer, fileId, file.conversationId, {
          width,
          height,
          quality,
          generateThumbnail
        });
      } else if (this.isDocument(file.mimetype)) {
        previewData = await this.generateDocumentPreview(fileBuffer, fileId, file.conversationId, {
          width,
          height,
          quality,
          format
        });
      } else {
        // Preview genérico para otros tipos
        previewData = await this.generateGenericPreview(file, fileId, file.conversationId);
      }

      // Actualizar archivo con información de preview
      await file.update({
        previewUrl: previewData.previewUrl,
        thumbnailUrl: previewData.thumbnail?.url,
        previewMetadata: previewData.metadata
      });

      logger.info('✅ Preview completo generado exitosamente', {
        fileId,
        previewUrl: previewData.previewUrl?.substring(0, 50) + '...',
        thumbnailUrl: previewData.thumbnail?.url?.substring(0, 50) + '...'
      });

      return previewData;

    } catch (error) {
      logger.error('❌ Error generando preview completo', {
        fileId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🗜️ COMPRIMIR ARCHIVO INTELIGENTEMENTE
   * Comprime archivos manteniendo calidad aceptable
   */
  async compressFile(fileId, quality = 80, format = null) {
    try {
      logger.info('🗜️ Comprimiendo archivo', {
        fileId,
        quality,
        format
      });

      const file = await File.getById(fileId);
      if (!file || !file.isActive) {
        throw new Error('Archivo no encontrado o inactivo');
      }

      // Obtener archivo desde storage
      const bucket = this.getBucket();
      const storageFile = bucket.file(file.storagePath);
      const [fileBuffer] = await storageFile.download();

      let compressedData = {
        fileId,
        originalSize: file.size,
        originalMimetype: file.mimetype,
        compressedSize: file.size,
        compressionRatio: 1.0,
        compressedUrl: file.url
      };

      // Comprimir según tipo de archivo
      if (this.isImage(file.mimetype)) {
        compressedData = await this.compressImage(fileBuffer, fileId, file.conversationId, {
          quality,
          format: format || 'webp'
        });
      } else if (this.isVideo(file.mimetype)) {
        compressedData = await this.compressVideo(fileBuffer, fileId, file.conversationId, {
          quality,
          format: format || 'mp4'
        });
      } else if (this.isDocument(file.mimetype)) {
        compressedData = await this.compressDocument(fileBuffer, fileId, file.conversationId, {
          quality,
          format: format || 'pdf'
        });
      }

      // Actualizar archivo con información de compresión
      await file.update({
        compressedUrl: compressedData.compressedUrl,
        compressedSize: compressedData.compressedSize,
        compressionRatio: compressedData.compressionRatio
      });

      logger.info('✅ Archivo comprimido exitosamente', {
        fileId,
        originalSize: compressedData.originalSize,
        compressedSize: compressedData.compressedSize,
        compressionRatio: compressedData.compressionRatio
      });

      return compressedData;

    } catch (error) {
      logger.error('❌ Error comprimiendo archivo', {
        fileId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🔄 CONVERTIR FORMATO DE ARCHIVO
   * Convierte archivos a formatos optimizados
   */
  async convertFile(fileId, targetFormat, options = {}) {
    try {
      const { quality = 80, maintainMetadata = true } = options;

      logger.info('🔄 Convirtiendo formato de archivo', {
        fileId,
        targetFormat,
        quality
      });

      const file = await File.getById(fileId);
      if (!file || !file.isActive) {
        throw new Error('Archivo no encontrado o inactivo');
      }

      // Obtener archivo desde storage
      const bucket = this.getBucket();
      const storageFile = bucket.file(file.storagePath);
      const [fileBuffer] = await storageFile.download();

      let convertedData = {
        fileId,
        originalFormat: file.mimetype,
        targetFormat,
        originalSize: file.size,
        convertedSize: file.size,
        convertedUrl: file.url
      };

      // Convertir según tipo de archivo
      if (this.isImage(file.mimetype)) {
        convertedData = await this.convertImage(fileBuffer, fileId, file.conversationId, {
          targetFormat,
          quality,
          maintainMetadata
        });
      } else if (this.isVideo(file.mimetype)) {
        convertedData = await this.convertVideo(fileBuffer, fileId, file.conversationId, {
          targetFormat,
          quality,
          maintainMetadata
        });
      } else if (this.isDocument(file.mimetype)) {
        convertedData = await this.convertDocument(fileBuffer, fileId, file.conversationId, {
          targetFormat,
          quality,
          maintainMetadata
        });
      }

      // Crear nuevo registro de archivo convertido
      const convertedFile = await File.create({
        originalName: file.originalName.replace(/\.[^/.]+$/, `.${targetFormat.split('/')[1]}`),
        mimetype: targetFormat,
        size: convertedData.convertedSize,
        url: convertedData.convertedUrl,
        storagePath: convertedData.storagePath,
        conversationId: file.conversationId,
        uploadedBy: file.uploadedBy,
        metadata: {
          ...file.metadata,
          convertedFrom: file.id,
          conversionDate: new Date().toISOString(),
          originalFormat: file.mimetype
        }
      });

      logger.info('✅ Archivo convertido exitosamente', {
        fileId,
        originalFormat: convertedData.originalFormat,
        targetFormat: convertedData.targetFormat,
        convertedFileId: convertedFile.id
      });

      return {
        ...convertedData,
        convertedFileId: convertedFile.id
      };

    } catch (error) {
      logger.error('❌ Error convirtiendo archivo', {
        fileId,
        targetFormat,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🔍 VALIDAR CONTENIDO DE ARCHIVO
   * Verifica integridad y seguridad del archivo
   */
  async validateFileContent(buffer, mimetype) {
    try {
      logger.info('🔍 Validando contenido de archivo', {
        size: buffer.length,
        mimetype
      });

      const validation = {
        isValid: true,
        isCorrupted: false,
        isMalicious: false,
        realMimeType: mimetype,
        fileSize: buffer.length,
        warnings: []
      };

      // Verificar tamaño mínimo
      if (buffer.length < 10) {
        validation.isValid = false;
        validation.isCorrupted = true;
        validation.warnings.push('Archivo demasiado pequeño');
      }

      // Verificar tipo MIME real vs declarado
      const realMimeType = await this.detectRealMimeType(buffer);
      if (realMimeType !== mimetype) {
        validation.warnings.push(`Tipo MIME real (${realMimeType}) diferente al declarado (${mimetype})`);
      }
      validation.realMimeType = realMimeType;

      // Verificar integridad básica
      if (this.isImage(mimetype)) {
        validation.isCorrupted = await this.validateImageIntegrity(buffer);
      } else if (this.isVideo(mimetype)) {
        validation.isCorrupted = await this.validateVideoIntegrity(buffer);
      } else if (this.isDocument(mimetype)) {
        validation.isCorrupted = await this.validateDocumentIntegrity(buffer);
      }

      // Verificar patrones sospechosos (básico)
      validation.isMalicious = await this.detectSuspiciousPatterns(buffer);

      if (validation.isCorrupted || validation.isMalicious) {
        validation.isValid = false;
      }

      logger.info('✅ Validación de contenido completada', {
        isValid: validation.isValid,
        isCorrupted: validation.isCorrupted,
        isMalicious: validation.isMalicious,
        warnings: validation.warnings.length
      });

      return validation;

    } catch (error) {
      logger.error('❌ Error validando contenido', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 💾 CREAR BACKUP DE ARCHIVO
   * Crea copias de seguridad automáticas
   */
  async backupFile(fileId) {
    try {
      logger.info('💾 Creando backup de archivo', { fileId });

      const file = await File.getById(fileId);
      if (!file || !file.isActive) {
        throw new Error('Archivo no encontrado o inactivo');
      }

      // Obtener archivo desde storage
      const bucket = this.getBucket();
      const storageFile = bucket.file(file.storagePath);
      const [fileBuffer] = await storageFile.download();

      // Crear ruta de backup
      const backupPath = `backups/${file.conversationId}/${fileId}_${Date.now()}.backup`;
      
      // Subir a storage de backup
      const backupFile = bucket.file(backupPath);
      await backupFile.save(fileBuffer, {
        metadata: {
          originalFileId: fileId,
          backupDate: new Date().toISOString(),
          originalPath: file.storagePath,
          contentType: file.mimetype
        }
      });

      // Crear registro de backup
      const backupRecord = {
        fileId,
        backupPath,
        backupDate: new Date(),
        backupSize: fileBuffer.length,
        status: 'completed'
      };

      await firestore.collection('file_backups').add(backupRecord);

      logger.info('✅ Backup creado exitosamente', {
        fileId,
        backupPath,
        backupSize: fileBuffer.length
      });

      return backupRecord;

    } catch (error) {
      logger.error('❌ Error creando backup', {
        fileId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🧹 LIMPIAR ARCHIVOS HUÉRFANOS
   * Elimina archivos sin referencias en la base de datos
   */
  async cleanupOrphanedFiles() {
    try {
      logger.info('🧹 Iniciando limpieza de archivos huérfanos');

      const bucket = this.getBucket();
      const [files] = await bucket.getFiles();

      let orphanedCount = 0;
      let cleanedSize = 0;

      for (const file of files) {
        try {
          // Verificar si existe en la base de datos
          const fileId = this.extractFileIdFromPath(file.name);
          if (fileId) {
            const dbFile = await File.getById(fileId);
            if (!dbFile || !dbFile.isActive) {
              // Archivo huérfano, eliminar
              await file.delete();
              orphanedCount++;
              cleanedSize += file.metadata?.size || 0;

              logger.info('🗑️ Archivo huérfano eliminado', {
                path: file.name,
                size: file.metadata?.size
              });
            }
          }
        } catch (error) {
          logger.warn('⚠️ Error procesando archivo durante limpieza', {
            path: file.name,
            error: error.message
          });
        }
      }

      logger.info('✅ Limpieza de archivos huérfanos completada', {
        orphanedCount,
        cleanedSize: `${(cleanedSize / 1024 / 1024).toFixed(2)}MB`
      });

      return {
        orphanedCount,
        cleanedSize,
        cleanedAt: new Date()
      };

    } catch (error) {
      logger.error('❌ Error en limpieza de archivos huérfanos', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🔄 MIGRAR ARCHIVO A NUEVO ALMACENAMIENTO
   * Mueve archivos entre diferentes sistemas de almacenamiento
   */
  async migrateFile(fileId, newStorage, options = {}) {
    try {
      const { deleteOriginal = false, validateAfterMigration = true } = options;

      logger.info('🔄 Migrando archivo a nuevo almacenamiento', {
        fileId,
        newStorage,
        deleteOriginal
      });

      const file = await File.getById(fileId);
      if (!file || !file.isActive) {
        throw new Error('Archivo no encontrado o inactivo');
      }

      // Obtener archivo desde storage actual
      const currentBucket = this.getBucket();
      const currentFile = currentBucket.file(file.storagePath);
      const [fileBuffer] = await currentFile.download();

      // Subir a nuevo almacenamiento
      const newBucket = this.getBucket(newStorage);
      const newPath = `migrated/${file.conversationId}/${fileId}_${Date.now()}`;
      const newFile = newBucket.file(newPath);
      
      await newFile.save(fileBuffer, {
        metadata: {
          originalPath: file.storagePath,
          migratedAt: new Date().toISOString(),
          originalStorage: 'firebase',
          newStorage
        }
      });

      // Obtener nueva URL
      const [newUrl] = await newFile.getSignedUrl({
        action: 'read',
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 año
      });

      // Actualizar registro en base de datos
      await file.update({
        url: newUrl,
        storagePath: newPath,
        storageProvider: newStorage,
        migratedAt: new Date()
      });

      // Eliminar archivo original si se solicita
      if (deleteOriginal) {
        await currentFile.delete();
      }

      // Validar migración si se solicita
      if (validateAfterMigration) {
        const validation = await this.validateFileContent(fileBuffer, file.mimetype);
        if (!validation.isValid) {
          throw new Error('Archivo migrado no es válido');
        }
      }

      logger.info('✅ Archivo migrado exitosamente', {
        fileId,
        newPath,
        newUrl: newUrl.substring(0, 50) + '...',
        deleteOriginal
      });

      return {
        fileId,
        newPath,
        newUrl,
        originalPath: file.storagePath,
        migratedAt: new Date()
      };

    } catch (error) {
      logger.error('❌ Error migrando archivo', {
        fileId,
        newStorage,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🔧 FUNCIONES AUXILIARES PARA FUNCIONES FALTANTES
   */

  /**
   * Verificar si el usuario es admin
   */
  isAdmin(userId) {
    // Implementar lógica de verificación de admin
    return false; // Por defecto, implementar según tu sistema de roles
  }

  /**
   * Hashear contraseña para compartir
   */
  async hashPassword(password) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * Detectar tipo MIME real del archivo
   */
  async detectRealMimeType(buffer) {
    const fileType = require('file-type');
    const result = await fileType.fromBuffer(buffer);
    return result ? result.mime : 'application/octet-stream';
  }

  /**
   * Validar integridad de imagen
   */
  async validateImageIntegrity(buffer) {
    try {
      const sharp = require('sharp');
      await sharp(buffer).metadata();
      return false; // No está corrupto
    } catch (error) {
      return true; // Está corrupto
    }
  }

  /**
   * Validar integridad de video
   */
  async validateVideoIntegrity(buffer) {
    // Implementación básica - en producción usar ffmpeg
    return buffer.length > 1000; // Verificación básica
  }

  /**
   * Validar integridad de documento
   */
  async validateDocumentIntegrity(buffer) {
    // Implementación básica - en producción usar librerías específicas
    return buffer.length > 100; // Verificación básica
  }

  /**
   * Detectar patrones sospechosos
   */
  async detectSuspiciousPatterns(buffer) {
    // Implementación básica - en producción usar antivirus
    const suspiciousPatterns = [
      Buffer.from('MZ'), // Ejecutables
      Buffer.from('PK'), // ZIPs con posible malware
    ];

    for (const pattern of suspiciousPatterns) {
      if (buffer.includes(pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Extraer ID de archivo desde ruta
   */
  extractFileIdFromPath(path) {
    const match = path.match(/([a-f0-9-]{36})/);
    return match ? match[1] : null;
  }

  /**
   * Generar preview de imagen
   */
  async generateImagePreview(buffer, fileId, conversationId, options) {
    const sharp = require('sharp');
    const { width, height, quality, format, generateThumbnail } = options;

    const previewBuffer = await sharp(buffer)
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .toFormat(format, { quality })
      .toBuffer();

    const previewPath = `previews/${conversationId}/images/${fileId}_preview.${format}`;
    const previewUrl = await this.savePreviewToStorage(previewBuffer, previewPath, `image/${format}`);

    let thumbnail = null;
    if (generateThumbnail) {
      const thumbnailBuffer = await sharp(buffer)
        .resize(200, 200, { fit: 'cover' })
        .toFormat('webp', { quality: 80 })
        .toBuffer();

      const thumbnailPath = `previews/${conversationId}/thumbnails/${fileId}_thumb.webp`;
      const thumbnailUrl = await this.savePreviewToStorage(thumbnailBuffer, thumbnailPath, 'image/webp');

      thumbnail = {
        url: thumbnailUrl,
        size: thumbnailBuffer.length,
        dimensions: { width: 200, height: 200 }
      };
    }

    return {
      previewUrl,
      thumbnail,
      size: previewBuffer.length,
      dimensions: { width, height },
      format: `image/${format}`
    };
  }

  /**
   * Comprimir imagen
   */
  async compressImage(buffer, fileId, conversationId, options) {
    const sharp = require('sharp');
    const { quality, format } = options;

    const compressedBuffer = await sharp(buffer)
      .toFormat(format, { quality })
      .toBuffer();

    const compressedPath = `compressed/${conversationId}/${fileId}_compressed.${format}`;
    const compressedUrl = await this.savePreviewToStorage(compressedBuffer, compressedPath, `image/${format}`);

    return {
      compressedUrl,
      compressedSize: compressedBuffer.length,
      compressionRatio: buffer.length / compressedBuffer.length
    };
  }

  /**
   * Convertir imagen
   */
  async convertImage(buffer, fileId, conversationId, options) {
    const sharp = require('sharp');
    const { targetFormat, quality, maintainMetadata } = options;

    let sharpInstance = sharp(buffer);
    
    if (maintainMetadata) {
      sharpInstance = sharpInstance.withMetadata();
    }

    const convertedBuffer = await sharpInstance
      .toFormat(targetFormat.split('/')[1], { quality })
      .toBuffer();

    const convertedPath = `converted/${conversationId}/${fileId}_converted.${targetFormat.split('/')[1]}`;
    const convertedUrl = await this.savePreviewToStorage(convertedBuffer, convertedPath, targetFormat);

    return {
      convertedUrl,
      convertedSize: convertedBuffer.length,
      storagePath: convertedPath
    };
  }

  /**
   * Guardar preview en storage
   */
  async savePreviewToStorage(buffer, path, contentType) {
    const bucket = this.getBucket();
    const file = bucket.file(path);
    
    await file.save(buffer, {
      metadata: {
        contentType,
        cacheControl: 'public, max-age=31536000' // 1 año
      }
    });

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 año
    });

    return url;
  }

  /**
   * 🎵 GENERAR WAVEFORM PARA AUDIO
   * Genera waveform para archivos de audio (ALINEACIÓN CON FRONTEND)
   */
  async generateAudioWaveform(buffer, fileId, conversationId) {
    try {
      logger.info('🎵 Generando waveform para audio', {
        fileId: fileId.substring(0, 20) + '...',
        bufferSize: buffer.length
      });

      // Simular generación de waveform (en producción usar librería como wavesurfer.js)
      const sampleRate = 44100;
      const duration = buffer.length / sampleRate;
      const samples = Math.floor(duration * 100); // 100 puntos por segundo
      
      const waveform = [];
      for (let i = 0; i < samples; i++) {
        // Simular amplitud basada en posición
        const amplitude = Math.random() * 0.5 + 0.1;
        waveform.push(amplitude);
      }

      // Guardar waveform como JSON
      const waveformPath = `waveforms/${conversationId}/${fileId}_waveform.json`;
      const waveformBuffer = Buffer.from(JSON.stringify(waveform));
      
      const bucket = this.getBucket();
      const waveformFile = bucket.file(waveformPath);
      
      await waveformFile.save(waveformBuffer, {
        metadata: {
          contentType: 'application/json',
          cacheControl: 'public, max-age=31536000'
        }
      });

      const [waveformUrl] = await waveformFile.getSignedUrl({
        action: 'read',
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000
      });

      logger.info('✅ Waveform generado exitosamente', {
        fileId: fileId.substring(0, 20) + '...',
        samples: waveform.length,
        duration: `${duration.toFixed(2)}s`
      });

      return {
        url: waveformUrl,
        data: waveform,
        samples: waveform.length,
        duration: duration,
        sampleRate: sampleRate
      };

    } catch (error) {
      logger.error('❌ Error generando waveform', {
        fileId: fileId?.substring(0, 20) + '...',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🎵 PROCESAR AUDIO COMPLETO
   * Procesa archivo de audio con waveform y metadatos
   */
  async processAudioFile(buffer, fileId, conversationId, mimetype) {
    try {
      logger.info('🎵 Procesando archivo de audio completo', {
        fileId: fileId.substring(0, 20) + '...',
        mimetype,
        bufferSize: buffer.length
      });

      const audioData = {
        originalSize: buffer.length,
        originalMimetype: mimetype,
        waveform: null,
        metadata: null,
        duration: null
      };

      // Generar waveform
      try {
        const waveform = await this.generateAudioWaveform(buffer, fileId, conversationId);
        audioData.waveform = waveform;
        audioData.duration = waveform.duration;
      } catch (waveformError) {
        logger.warn('⚠️ Error generando waveform, continuando sin él', {
          error: waveformError.message
        });
      }

      // Extraer metadatos básicos
      audioData.metadata = {
        fileSize: buffer.length,
        duration: audioData.duration,
        sampleRate: audioData.waveform?.sampleRate || 44100,
        channels: 2, // Asumir estéreo
        bitrate: Math.floor((buffer.length * 8) / (audioData.duration || 1)),
        format: mimetype.split('/')[1].toUpperCase()
      };

      logger.info('✅ Archivo de audio procesado exitosamente', {
        fileId: fileId.substring(0, 20) + '...',
        duration: audioData.duration,
        waveformSamples: audioData.waveform?.samples
      });

      return audioData;

    } catch (error) {
      logger.error('❌ Error procesando archivo de audio', {
        fileId: fileId?.substring(0, 20) + '...',
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = FileService; 