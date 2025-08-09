const File = require('../models/File');
const { logger } = require('../utils/logger');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const AudioProcessor = require('./AudioProcessor');
const path = require('path');

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
  }

  /**
   * Obtener bucket de Firebase Storage de forma segura
   */
  getBucket() {
    try {
      if (!admin.apps.length) {
        throw new Error('Firebase Admin SDK no inicializado');
      }
      return admin.storage().bucket();
    } catch (error) {
      logger.error('Error obteniendo bucket de Firebase Storage:', error);
      return {
        file: () => ({
          save: () => Promise.reject(new Error('Storage no disponible')),
          getSignedUrl: () => Promise.reject(new Error('Storage no disponible')),
          delete: () => Promise.reject(new Error('Storage no disponible')),
          exists: () => Promise.resolve([false])
        })
      };
    }
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
      if (!validation.valid) {
        throw new Error(`Archivo inválido: ${validation.error}`);
      }

      const category = validation.category;
      const fileId = uuidv4();

      // Procesar archivo según su tipo
      const processedFile = await this.processFileByCategory(
        buffer, fileId, conversationId, category, mimetype, originalName
      );

      // Crear registro en base de datos con indexación
      const fileRecord = await File.create({
        id: fileId,
        originalName,
        storagePath: processedFile.storagePath,
        storageUrl: processedFile.storageUrl,
        publicUrl: processedFile.publicUrl,
        category,
        mimeType: mimetype,
        size: this.formatFileSize(size),
        sizeBytes: size,
        conversationId,
        messageId,
        userId,
        uploadedBy,
        expiresAt: processedFile.expiresAt,
        metadata: processedFile.metadata || {},
        tags
      });

      const processTime = Date.now() - startTime;

      logger.info('✅ Archivo subido exitosamente con indexación', {
        fileId,
        category,
        size: this.formatFileSize(size),
        storagePath: processedFile.storagePath,
        processTime: `${processTime}ms`,
        uploadedBy
      });

      return {
        ...fileRecord.toJSON(),
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
    switch (category) {
      case 'audio':
        return await this.processAudioFile(buffer, fileId, conversationId, mimetype, originalName);
      case 'image':
        return await this.processImageFile(buffer, fileId, conversationId, mimetype, originalName);
      case 'video':
      case 'document':
      default:
        return await this.processGenericFile(buffer, fileId, conversationId, category, mimetype, originalName);
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

      return {
        storagePath,
        storageUrl: `gs://${bucket.name}/${storagePath}`,
        publicUrl: signedUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: processedAudio.metadata
      };
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

      return {
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

      return {
        storagePath,
        storageUrl: `gs://${bucket.name}/${storagePath}`,
        publicUrl: signedUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          originalSize: buffer.length
        }
      };
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
}

module.exports = FileService; 