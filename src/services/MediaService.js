const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const logger = require('../utils/logger');

class MediaService {
  constructor() {
    // Configuración de tipos de archivo permitidos
    this.allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    this.allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    this.allowedAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'];
    this.allowedDocumentTypes = ['application/pdf', 'text/plain', 'application/msword', 
                               'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    // Límites de tamaño (en bytes)
    this.maxImageSize = 10 * 1024 * 1024; // 10MB
    this.maxVideoSize = 50 * 1024 * 1024; // 50MB
    this.maxAudioSize = 20 * 1024 * 1024; // 20MB
    this.maxDocumentSize = 25 * 1024 * 1024; // 25MB

    // Directorio de almacenamiento local (temporal)
    this.tempDir = process.env.TEMP_MEDIA_DIR || './temp/media';
    this.mediaDir = process.env.MEDIA_DIR || './uploads/media';

    this.ensureDirectories();
  }

  /**
   * Asegurar que existan los directorios necesarios
   */
  async ensureDirectories() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.mediaDir, { recursive: true });
      await fs.mkdir(path.join(this.mediaDir, 'images'), { recursive: true });
      await fs.mkdir(path.join(this.mediaDir, 'videos'), { recursive: true });
      await fs.mkdir(path.join(this.mediaDir, 'audio'), { recursive: true });
      await fs.mkdir(path.join(this.mediaDir, 'documents'), { recursive: true });
    } catch (error) {
      logger.error('Error creando directorios de media:', error);
    }
  }

  /**
   * Descargar archivo multimedia de Twilio y almacenarlo permanentemente
   */
  async processWebhookMedia(mediaUrl, messageId, mediaIndex = 0) {
    try {
      console.log('📥 DESCARGANDO MEDIA:', { mediaUrl, messageId, mediaIndex });

      // Validar URL
      if (!mediaUrl || !mediaUrl.startsWith('https://')) {
        throw new Error('URL de media inválida');
      }

      // Generar nombre único para el archivo
      const fileId = this.generateFileId(messageId, mediaIndex);
      
      // Descargar archivo
      const response = await axios.get(mediaUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 segundos timeout
        headers: {
          'User-Agent': 'UTalk-Backend/1.0'
        }
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const contentLength = parseInt(response.headers['content-length'] || buffer.length);

      console.log('📥 MEDIA DESCARGADA:', {
        fileId,
        contentType,
        size: contentLength,
        sizeFormatted: this.formatFileSize(contentLength)
      });

      // Validar archivo
      const validation = this.validateFile(buffer, contentType, contentLength);
      if (!validation.valid) {
        throw new Error(`Archivo inválido: ${validation.error}`);
      }

      // Determinar categoría y extensión
      const category = this.getFileCategory(contentType);
      const extension = this.getFileExtension(contentType);
      
      // Generar ruta de almacenamiento
      const fileName = `${fileId}.${extension}`;
      const relativePath = `${category}/${fileName}`;
      const fullPath = path.join(this.mediaDir, relativePath);

      // Guardar archivo
      await fs.writeFile(fullPath, buffer);

      // Generar URL pública
      const publicUrl = this.generatePublicUrl(relativePath);

      const mediaInfo = {
        id: fileId,
        originalUrl: mediaUrl,
        publicUrl,
        localPath: fullPath,
        relativePath,
        fileName,
        contentType,
        category,
        size: contentLength,
        sizeFormatted: this.formatFileSize(contentLength),
        messageId,
        mediaIndex,
        downloadedAt: new Date().toISOString(),
        metadata: {
          userAgent: response.headers['user-agent'],
          lastModified: response.headers['last-modified'],
          etag: response.headers['etag']
        }
      };

      logger.info('Media procesada exitosamente', {
        fileId,
        messageId,
        contentType,
        size: contentLength,
        category
      });

      console.log('✅ MEDIA GUARDADA:', {
        fileId,
        publicUrl,
        category,
        size: this.formatFileSize(contentLength)
      });

      return mediaInfo;

    } catch (error) {
      console.error('❌ ERROR PROCESANDO MEDIA:', {
        error: error.message,
        mediaUrl: mediaUrl?.substring(0, 100) + '...',
        messageId
      });

      logger.error('Error procesando media:', {
        error: error.message,
        stack: error.stack,
        mediaUrl,
        messageId
      });

      throw error;
    }
  }

  /**
   * Validar archivo multimedia
   */
  validateFile(buffer, contentType, size) {
    try {
      // Validar tamaño del buffer
      if (!buffer || buffer.length === 0) {
        return { valid: false, error: 'Archivo vacío' };
      }

      // Validar tipo de contenido
      const allAllowedTypes = [
        ...this.allowedImageTypes,
        ...this.allowedVideoTypes,
        ...this.allowedAudioTypes,
        ...this.allowedDocumentTypes
      ];

      if (!allAllowedTypes.includes(contentType)) {
        return { valid: false, error: `Tipo de archivo no permitido: ${contentType}` };
      }

      // Validar tamaño según categoría
      const category = this.getFileCategory(contentType);
      let maxSize;

      switch (category) {
        case 'images':
          maxSize = this.maxImageSize;
          break;
        case 'videos':
          maxSize = this.maxVideoSize;
          break;
        case 'audio':
          maxSize = this.maxAudioSize;
          break;
        case 'documents':
          maxSize = this.maxDocumentSize;
          break;
        default:
          return { valid: false, error: 'Categoría de archivo desconocida' };
      }

      if (size > maxSize) {
        return { 
          valid: false, 
          error: `Archivo demasiado grande: ${this.formatFileSize(size)} (máximo: ${this.formatFileSize(maxSize)})` 
        };
      }

      // Validación básica de firma de archivo
      const signature = buffer.slice(0, 4).toString('hex');
      if (!this.validateFileSignature(signature, contentType)) {
        return { valid: false, error: 'Firma de archivo no coincide con el tipo MIME' };
      }

      return { valid: true };

    } catch (error) {
      return { valid: false, error: `Error validando archivo: ${error.message}` };
    }
  }

  /**
   * Validar firma de archivo (magic numbers)
   */
  validateFileSignature(signature, contentType) {
    const signatures = {
      'image/jpeg': ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2', 'ffd8ffe3', 'ffd8ffe8'],
      'image/png': ['89504e47'],
      'image/gif': ['47494638'],
      'video/mp4': ['00000018', '00000020'],
      'application/pdf': ['25504446'],
      // Agregar más según necesidad
    };

    const validSignatures = signatures[contentType];
    if (!validSignatures) {
      return true; // Si no tenemos firma definida, permitir
    }

    return validSignatures.some(sig => signature.startsWith(sig));
  }

  /**
   * Obtener categoría del archivo según tipo MIME
   */
  getFileCategory(contentType) {
    if (this.allowedImageTypes.includes(contentType)) return 'images';
    if (this.allowedVideoTypes.includes(contentType)) return 'videos';
    if (this.allowedAudioTypes.includes(contentType)) return 'audio';
    if (this.allowedDocumentTypes.includes(contentType)) return 'documents';
    return 'other';
  }

  /**
   * Obtener extensión de archivo según tipo MIME
   */
  getFileExtension(contentType) {
    const extensions = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/ogg': 'ogv',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/webm': 'weba',
      'application/pdf': 'pdf',
      'text/plain': 'txt',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
    };

    return extensions[contentType] || 'bin';
  }

  /**
   * Generar ID único para archivo
   */
  generateFileId(messageId, mediaIndex) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `${messageId}_${mediaIndex}_${timestamp}_${random}`;
  }

  /**
   * Generar URL pública para archivo
   */
  generatePublicUrl(relativePath) {
    const baseUrl = process.env.MEDIA_BASE_URL || `${process.env.BACKEND_URL || 'http://localhost:3000'}/media`;
    return `${baseUrl}/${relativePath}`;
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
   * Eliminar archivo multimedia
   */
  async deleteMedia(relativePath) {
    try {
      const fullPath = path.join(this.mediaDir, relativePath);
      await fs.unlink(fullPath);
      
      logger.info('Media eliminada', { relativePath });
      return true;
    } catch (error) {
      logger.error('Error eliminando media:', { error: error.message, relativePath });
      return false;
    }
  }

  /**
   * Obtener información de archivo
   */
  async getMediaInfo(relativePath) {
    try {
      const fullPath = path.join(this.mediaDir, relativePath);
      const stats = await fs.stat(fullPath);
      
      return {
        exists: true,
        size: stats.size,
        sizeFormatted: this.formatFileSize(stats.size),
        created: stats.birthtime,
        modified: stats.mtime,
        fullPath
      };
    } catch (error) {
      return { exists: false };
    }
  }

  /**
   * Limpiar archivos temporales antiguos
   */
  async cleanupOldFiles(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const categories = ['images', 'videos', 'audio', 'documents'];
      let deletedCount = 0;

      for (const category of categories) {
        const categoryPath = path.join(this.mediaDir, category);
        
        try {
          const files = await fs.readdir(categoryPath);
          
          for (const file of files) {
            const filePath = path.join(categoryPath, file);
            const stats = await fs.stat(filePath);
            
            if (stats.mtime < cutoffDate) {
              await fs.unlink(filePath);
              deletedCount++;
            }
          }
        } catch (error) {
          logger.warn(`Error limpiando categoría ${category}:`, error);
        }
      }

      logger.info(`Limpieza de archivos completada: ${deletedCount} archivos eliminados`);
      return deletedCount;

    } catch (error) {
      logger.error('Error en limpieza de archivos:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de almacenamiento
   */
  async getStorageStats() {
    try {
      const categories = ['images', 'videos', 'audio', 'documents'];
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        byCategory: {}
      };

      for (const category of categories) {
        const categoryPath = path.join(this.mediaDir, category);
        let categoryFiles = 0;
        let categorySize = 0;

        try {
          const files = await fs.readdir(categoryPath);
          
          for (const file of files) {
            const filePath = path.join(categoryPath, file);
            const fileStats = await fs.stat(filePath);
            
            categoryFiles++;
            categorySize += fileStats.size;
          }
        } catch (error) {
          // Directorio no existe o error de acceso
        }

        stats.byCategory[category] = {
          files: categoryFiles,
          size: categorySize,
          sizeFormatted: this.formatFileSize(categorySize)
        };

        stats.totalFiles += categoryFiles;
        stats.totalSize += categorySize;
      }

      stats.totalSizeFormatted = this.formatFileSize(stats.totalSize);

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de almacenamiento:', error);
      throw error;
    }
  }
}

module.exports = new MediaService(); 