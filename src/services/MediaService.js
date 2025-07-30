const axios = require('axios');
const logger = require('../utils/logger');
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
      // Retornar mock para desarrollo
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
        ...processedFile
      };

      logger.info('Media procesada exitosamente:', {
        fileId,
        category,
        size: this.formatFileSize(contentLength)
      });

      return result;

    } catch (error) {
      logger.error('Error procesando media desde webhook:', {
        mediaUrl,
        messageId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Procesar archivo de audio
   */
  async processAudioFile(buffer, fileId, conversationId, contentType) {
    try {
      const processor = new AudioProcessor();
      const processedAudio = await processor.processAudio(buffer, fileId, contentType);

      const storagePath = `audio/${conversationId}/${fileId}.mp3`;
      const bucket = this.getBucket();
      const file = bucket.file(storagePath);

      await file.save(processedAudio.buffer, {
        metadata: {
          contentType: 'audio/mp3',
          metadata: {
            originalFormat: contentType,
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
        storageUrl: `gs://${bucket.name}/${storagePath}`,
        publicUrl: signedUrl,
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
  async processImageFile(buffer, fileId, conversationId, contentType) {
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
            originalFormat: contentType,
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
        storageUrl: `gs://${bucket.name}/${storagePath}`,
        publicUrl: signedUrl,
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
  async processGenericFile(buffer, fileId, conversationId, category, contentType) {
    try {
      const extension = this.getFileExtension(contentType);
      const storagePath = `${category}/${conversationId}/${fileId}.${extension}`;
      const bucket = this.getBucket();
      const file = bucket.file(storagePath);

      await file.save(buffer, {
        metadata: {
          contentType,
          metadata: {
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
        storageUrl: `gs://${bucket.name}/${storagePath}`,
        publicUrl: signedUrl,
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
      const file = this.getBucket().file(storagePath);
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
      const file = this.getBucket().file(storagePath);
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
