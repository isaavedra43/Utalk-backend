const axios = require('axios');
const logger = require('../utils/logger');
const { Storage } = require('@google-cloud/storage');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const AudioProcessor = require('./AudioProcessor');

/**
 * Servicio de gestión de archivos multimedia con Firebase Storage exclusivamente
 * Sin almacenamiento local - todo en la nube
 */
class MediaService {
  constructor() {
    this.storage = new Storage();
    this.bucket = admin.storage().bucket();
    
    // Configuración de tipos de archivo permitidos
    this.allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    this.allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi'];
    this.allowedAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/m4a'];
    this.allowedDocumentTypes = ['application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    // Límites de tamaño (en bytes)
    this.maxImageSize = 10 * 1024 * 1024; // 10MB
    this.maxVideoSize = 100 * 1024 * 1024; // 100MB
    this.maxAudioSize = 50 * 1024 * 1024; // 50MB
    this.maxDocumentSize = 25 * 1024 * 1024; // 25MB
  }

  /**
   * Procesar archivo multimedia desde webhook de Twilio
   */
  async processWebhookMedia(mediaUrl, messageId, mediaIndex = 0) {
    try {
      logger.info('Procesando media desde webhook:', { mediaUrl, messageId, mediaIndex });

      if (!mediaUrl || !mediaUrl.startsWith('https://')) {
        throw new Error('URL de media inválida');
      }

      // Descargar archivo
      const response = await axios.get(mediaUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: { 'User-Agent': 'UTalk-Backend/1.0' }
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const contentLength = buffer.length;

      // Validar archivo
      const validation = this.validateFile({ buffer, mimetype: contentType, size: contentLength });
      if (!validation.valid) {
        throw new Error(`Archivo inválido: ${validation.error}`);
      }

      // Procesar según el tipo
      const category = this.getFileCategory(contentType);
      const fileId = this.generateFileId(messageId, mediaIndex);
      const conversationId = messageId.split('_')[0] || 'unknown';

      let processedFile;
      
      switch (category) {
        case 'audio':
          processedFile = await this.processAudioFile(buffer, fileId, conversationId, contentType);
          break;
        case 'image':
          processedFile = await this.processImageFile(buffer, fileId, conversationId, contentType);
          break;
        case 'video':
        case 'document':
        default:
          processedFile = await this.processGenericFile(buffer, fileId, conversationId, category, contentType);
          break;
      }

      const result = {
        id: fileId,
        originalUrl: mediaUrl,
        category,
        size: contentLength,
        sizeFormatted: this.formatFileSize(contentLength),
        messageId,
        mediaIndex,
        downloadedAt: new Date().toISOString(),
        ...processedFile
      };

      logger.info('Media procesada exitosamente:', { fileId, category, size: contentLength });
      return result;
    } catch (error) {
      logger.error('Error procesando media:', error);
      throw error;
    }
  }

  /**
   * Procesar archivo de audio
   */
  async processAudioFile(buffer, fileId, conversationId, contentType) {
    try {
      const originalFilename = `${fileId}_original.${this.getFileExtension(contentType)}`;
      
      // Usar AudioProcessor para procesar el audio
      const audioResult = await AudioProcessor.processAudio(buffer, originalFilename, conversationId);
      
      return {
        storagePath: audioResult.storagePath,
        signedUrl: audioResult.signedUrl,
        contentType: 'audio/mpeg', // Siempre MP3 después del procesamiento
        metadata: audioResult.metadata,
        processed: true
      };
    } catch (error) {
      logger.error('Error procesando archivo de audio:', error);
      throw error;
    }
  }

  /**
   * Procesar archivo de imagen con optimización
   */
  async processImageFile(buffer, fileId, conversationId, contentType) {
    try {
      const extension = this.getFileExtension(contentType);
      const filename = `${fileId}.${extension}`;
      const storagePath = `images/${conversationId}/${filename}`;

      // Optimizar imagen con Sharp
      let processedBuffer = buffer;
      let finalContentType = contentType;

      if (contentType.startsWith('image/')) {
        const sharpImage = sharp(buffer);
        const metadata = await sharpImage.metadata();
        
        // Redimensionar si es muy grande
        if (metadata.width > 1920 || metadata.height > 1920) {
          processedBuffer = await sharpImage
            .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85, progressive: true })
            .toBuffer();
          finalContentType = 'image/jpeg';
        } else if (contentType === 'image/jpeg') {
          processedBuffer = await sharpImage
            .jpeg({ quality: 90, progressive: true })
            .toBuffer();
        }
      }

      // Subir a Firebase Storage
      const file = this.bucket.file(storagePath);
      await file.save(processedBuffer, {
        metadata: {
          contentType: finalContentType,
          metadata: {
            originalContentType: contentType,
            conversationId: conversationId,
            processedAt: new Date().toISOString(),
            fileId: fileId
          }
        }
      });

      // Generar URL firmada
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
      });

      return {
        storagePath,
        signedUrl,
        contentType: finalContentType,
        size: processedBuffer.length,
        metadata: {
          dimensions: await this.getImageDimensions(processedBuffer),
          optimized: processedBuffer.length < buffer.length,
          originalSize: buffer.length
        },
        processed: true
      };
    } catch (error) {
      logger.error('Error procesando imagen:', error);
      throw error;
    }
  }

  /**
   * Procesar archivo genérico (video, documento)
   */
  async processGenericFile(buffer, fileId, conversationId, category, contentType) {
    try {
      const extension = this.getFileExtension(contentType);
      const filename = `${fileId}.${extension}`;
      const storagePath = `${category}/${conversationId}/${filename}`;

      // Subir directamente a Firebase Storage
      const file = this.bucket.file(storagePath);
      await file.save(buffer, {
        metadata: {
          contentType,
          metadata: {
            conversationId: conversationId,
            uploadedAt: new Date().toISOString(),
            fileId: fileId,
            category: category
          }
        }
      });

      // Generar URL firmada
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
      });

      return {
        storagePath,
        signedUrl,
        contentType,
        size: buffer.length,
        processed: true
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
   * Generar ID único para archivo
   */
  generateFileId(messageId, mediaIndex) {
    const timestamp = Date.now();
    const uuid = uuidv4().substring(0, 8);
    return `${timestamp}_${uuid}_${messageId}_${mediaIndex}`;
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
   * Obtener dimensiones de imagen
   */
  async getImageDimensions(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format
      };
    } catch (error) {
      logger.warn('Error obteniendo dimensiones de imagen:', error);
      return null;
    }
  }

  /**
   * Eliminar archivo de Firebase Storage
   */
  async deleteFile(storagePath) {
    try {
      const file = this.bucket.file(storagePath);
      await file.delete();
      logger.info('Archivo eliminado de Firebase Storage:', { storagePath });
      return true;
    } catch (error) {
      logger.error('Error eliminando archivo:', error);
      throw error;
    }
  }

  /**
   * Obtener URL firmada para archivo existente
   */
  async getSignedUrl(storagePath, expirationHours = 24) {
    try {
      const file = this.bucket.file(storagePath);
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + (expirationHours * 60 * 60 * 1000)
      });
      return signedUrl;
    } catch (error) {
      logger.error('Error generando URL firmada:', error);
      throw error;
    }
  }
}

module.exports = new MediaService();
