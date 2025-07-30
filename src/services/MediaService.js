const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const logger = require('../utils/logger');

class MediaService {
  constructor () {
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
  async ensureDirectories () {
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
  async processWebhookMedia (mediaUrl, messageId, mediaIndex = 0) {
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
          'User-Agent': 'UTalk-Backend/1.0',
        },
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const contentLength = parseInt(response.headers['content-length'] || buffer.length);

      console.log('📥 MEDIA DESCARGADA:', {
        fileId,
        contentType,
        size: contentLength,
        sizeFormatted: this.formatFileSize(contentLength),
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
          etag: response.headers.etag,
        },
      };

      logger.info('Media procesada exitosamente', {
        fileId,
        messageId,
        contentType,
        size: contentLength,
        category,
      });

      console.log('MEDIA GUARDADA:', {
        fileId,
        publicUrl,
        category,
        size: this.formatFileSize(contentLength),
      });

      return mediaInfo;
    } catch (error) {
      console.error('ERROR PROCESANDO MEDIA:', {
        error: error.message,
        mediaUrl: mediaUrl?.substring(0, 100) + '...',
        messageId,
      });

      logger.error('Error procesando media:', {
        error: error.message,
        stack: error.stack,
        mediaUrl,
        messageId,
      });

      throw error;
    }
  }

  /**
   * Validar archivo multimedia
   */
  validateFile (buffer, contentType, size) {
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
        ...this.allowedDocumentTypes,
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
          error: `Archivo demasiado grande: ${this.formatFileSize(size)} (máximo: ${this.formatFileSize(maxSize)})`,
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
  validateFileSignature (signature, contentType) {
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
  getFileCategory (contentType) {
    if (this.allowedImageTypes.includes(contentType)) return 'images';
    if (this.allowedVideoTypes.includes(contentType)) return 'videos';
    if (this.allowedAudioTypes.includes(contentType)) return 'audio';
    if (this.allowedDocumentTypes.includes(contentType)) return 'documents';
    return 'other';
  }

  /**
   * Obtener extensión de archivo según tipo MIME
   */
  getFileExtension (contentType) {
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
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    };

    return extensions[contentType] || 'bin';
  }

  /**
   * Generar ID único para archivo
   */
  generateFileId (messageId, mediaIndex) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `${messageId}_${mediaIndex}_${timestamp}_${random}`;
  }

  /**
   * Generar URL pública para archivo
   */
  generatePublicUrl (relativePath) {
    const baseUrl = process.env.MEDIA_BASE_URL || `${process.env.BACKEND_URL || 'http://localhost:3000'}/media`;
    return `${baseUrl}/${relativePath}`;
  }

  /**
   * Formatear tamaño de archivo
   */
  formatFileSize (bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Eliminar archivo multimedia
   */
  async deleteMedia (relativePath) {
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
  async getMediaInfo (relativePath) {
    try {
      const fullPath = path.join(this.mediaDir, relativePath);
      const stats = await fs.stat(fullPath);

      return {
        exists: true,
        size: stats.size,
        sizeFormatted: this.formatFileSize(stats.size),
        created: stats.birthtime,
        modified: stats.mtime,
        fullPath,
      };
    } catch (error) {
      return { exists: false };
    }
  }

  /**
   * Limpiar archivos temporales antiguos
   */
  async cleanupOldFiles (daysOld = 30) {
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
  async getStorageStats () {
    try {
      const categories = ['images', 'videos', 'audio', 'documents'];
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        byCategory: {},
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
          sizeFormatted: this.formatFileSize(categorySize),
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

  /**
   * Detectar y limpiar archivos huérfanos (no referenciados en mensajes)
   */
  async cleanOrphanedFiles (options = {}) {
    try {
      const { dryRun = false, batchSize = 100 } = options;

      logger.info('Iniciando limpieza de archivos huérfanos', { dryRun });

      // Obtener todos los archivos del sistema
      const allFiles = await this.getAllStoredFiles();

      // Obtener todas las referencias de media en mensajes (por lotes)
      const referencedFiles = await this.getReferencedMediaFiles(batchSize);

      // Identificar huérfanos
      const orphanedFiles = allFiles.filter(file =>
        !referencedFiles.has(file.fileName),
      );

      if (orphanedFiles.length === 0) {
        logger.info('No se encontraron archivos huérfanos');
        return { orphansFound: 0, orphansDeleted: 0, spaceSaved: 0 };
      }

      let deletedCount = 0;
      let spaceSaved = 0;

      if (!dryRun) {
        // Eliminar archivos huérfanos
        for (const file of orphanedFiles) {
          try {
            await fs.unlink(file.fullPath);
            deletedCount++;
            spaceSaved += file.size;

            logger.debug('Archivo huérfano eliminado', {
              fileName: file.fileName,
              category: file.category,
              size: this.formatFileSize(file.size),
            });
          } catch (error) {
            logger.warn(`Error eliminando archivo huérfano ${file.fileName}:`, error);
          }
        }
      }

      const result = {
        orphansFound: orphanedFiles.length,
        orphansDeleted: deletedCount,
        spaceSaved,
        spaceSavedFormatted: this.formatFileSize(spaceSaved),
        orphanedFiles: dryRun ? orphanedFiles.slice(0, 10) : [], // Muestra solo 10 en dry run
      };

      logger.info('Limpieza de huérfanos completada', result);
      return result;
    } catch (error) {
      logger.error('Error en limpieza de archivos huérfanos:', error);
      throw error;
    }
  }

  /**
   * Obtener todos los archivos almacenados
   */
  async getAllStoredFiles () {
    const files = [];
    const categories = ['images', 'videos', 'audio', 'documents'];

    for (const category of categories) {
      const categoryPath = path.join(this.mediaDir, category);

      try {
        const categoryFiles = await fs.readdir(categoryPath);

        for (const fileName of categoryFiles) {
          const fullPath = path.join(categoryPath, fileName);
          const stats = await fs.stat(fullPath);

          files.push({
            fileName,
            category,
            fullPath,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
          });
        }
      } catch (error) {
        // Directorio no existe o error de acceso
        logger.debug(`Categoría ${category} no accesible:`, error.message);
      }
    }

    return files;
  }

  /**
   * Obtener archivos referenciados en mensajes
   */
  async getReferencedMediaFiles (batchSize = 100) {
    const referencedFiles = new Set();
    const Message = require('../models/Message');

    try {
      // Obtener mensajes con media en lotes
      let startAfter = null;
      let hasMore = true;

      while (hasMore) {
        let query = Message.getCollection()
          .where('type', 'in', ['image', 'video', 'audio', 'document'])
          .limit(batchSize);

        if (startAfter) {
          query = query.startAfter(startAfter);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
          hasMore = false;
          continue;
        }

        // Procesar lote
        snapshot.docs.forEach(doc => {
          const data = doc.data();

          // Extraer nombres de archivo de URLs
          if (data.mediaUrls && Array.isArray(data.mediaUrls)) {
            data.mediaUrls.forEach(url => {
              const fileName = this.extractFileNameFromUrl(url);
              if (fileName) {
                referencedFiles.add(fileName);
              }
            });
          }

          // También revisar metadata por archivos procesados
          if (data.metadata && data.metadata.media && Array.isArray(data.metadata.media)) {
            data.metadata.media.forEach(mediaInfo => {
              if (mediaInfo.fileName) {
                referencedFiles.add(mediaInfo.fileName);
              }
            });
          }
        });

        // Preparar para siguiente lote
        startAfter = snapshot.docs[snapshot.docs.length - 1];
        hasMore = snapshot.docs.length === batchSize;
      }

      logger.info(`Referencias de media encontradas: ${referencedFiles.size}`);
      return referencedFiles;
    } catch (error) {
      logger.error('Error obteniendo archivos referenciados:', error);
      throw error;
    }
  }

  /**
   * Extraer nombre de archivo de URL
   */
  extractFileNameFromUrl (url) {
    if (!url || typeof url !== 'string') return null;

    try {
      // Para URLs locales como /media/images/filename.jpg
      if (url.startsWith('/media/') || url.includes('/media/')) {
        const parts = url.split('/');
        return parts[parts.length - 1];
      }

      // Para URLs completas
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      return pathname.split('/').pop();
    } catch (error) {
      logger.debug('Error extrayendo nombre de archivo de URL:', { url, error: error.message });
      return null;
    }
  }

  /**
   * Validar integridad de archivos multimedia
   */
  async validateFileIntegrity (options = {}) {
    try {
      const { checkSignatures = true, checkSizes = true } = options;

      logger.info('Iniciando validación de integridad de archivos');

      const allFiles = await this.getAllStoredFiles();
      const results = {
        totalFiles: allFiles.length,
        validFiles: 0,
        corruptedFiles: [],
        invalidSignatures: [],
        sizeMismatches: [],
      };

      for (const file of allFiles) {
        try {
          // Verificar que el archivo existe y es accesible
          const stats = await fs.stat(file.fullPath);

          if (checkSizes && stats.size !== file.size) {
            results.sizeMismatches.push({
              fileName: file.fileName,
              expectedSize: file.size,
              actualSize: stats.size,
            });
            continue;
          }

          // Verificar firma de archivo si está habilitado
          if (checkSignatures) {
            const buffer = await fs.readFile(file.fullPath);
            const isValidSignature = this.validateFileSignatureByBuffer(buffer, file.category);

            if (!isValidSignature) {
              results.invalidSignatures.push({
                fileName: file.fileName,
                category: file.category,
              });
              continue;
            }
          }

          results.validFiles++;
        } catch (error) {
          results.corruptedFiles.push({
            fileName: file.fileName,
            error: error.message,
          });
        }
      }

      logger.info('Validación de integridad completada', {
        total: results.totalFiles,
        valid: results.validFiles,
        corrupted: results.corruptedFiles.length,
        invalidSignatures: results.invalidSignatures.length,
        sizeMismatches: results.sizeMismatches.length,
      });

      return results;
    } catch (error) {
      logger.error('Error en validación de integridad:', error);
      throw error;
    }
  }

  /**
   * Validar firma de archivo
   */
  validateFileSignatureByBuffer (buffer, expectedCategory) {
    if (!buffer || buffer.length < 4) return false;

    // Firmas comunes de archivos
    const signatures = {
      images: [
        [0xFF, 0xD8, 0xFF], // JPEG
        [0x89, 0x50, 0x4E, 0x47], // PNG
        [0x47, 0x49, 0x46, 0x38], // GIF
        [0x52, 0x49, 0x46, 0x46], // WebP (RIFF)
      ],
      documents: [
        [0x25, 0x50, 0x44, 0x46], // PDF
        [0x50, 0x4B, 0x03, 0x04], // ZIP/DOCX
        [0xD0, 0xCF, 0x11, 0xE0], // DOC
      ],
      videos: [
        [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // MP4
        [0x1A, 0x45, 0xDF, 0xA3], // WebM
        [0x52, 0x49, 0x46, 0x46], // AVI (RIFF)
      ],
      audio: [
        [0x49, 0x44, 0x33], // MP3
        [0xFF, 0xFB], // MP3 (alternative)
        [0x52, 0x49, 0x46, 0x46], // WAV (RIFF)
        [0x4F, 0x67, 0x67, 0x53], // OGG
      ],
    };

    const categorySignatures = signatures[expectedCategory] || [];

    return categorySignatures.some(signature => {
      if (buffer.length < signature.length) return false;

      return signature.every((byte, index) => buffer[index] === byte);
    });
  }

  /**
   * Comprimir imágenes automáticamente
   */
  async compressImages (options = {}) {
    try {
      const {
        quality = 85,
        maxWidth = 1920,
        maxHeight = 1080,
        dryRun = false,
      } = options;

      logger.info('Iniciando compresión de imágenes', { quality, maxWidth, maxHeight, dryRun });

      const imagesPath = path.join(this.mediaDir, 'images');
      const images = await fs.readdir(imagesPath);

      const results = {
        totalImages: images.length,
        processed: 0,
        skipped: 0,
        errors: 0,
        spaceSaved: 0,
      };

      for (const imageName of images) {
        try {
          const imagePath = path.join(imagesPath, imageName);
          const originalStats = await fs.stat(imagePath);

          // Solo procesar archivos de imagen
          if (!['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(imageName).toLowerCase())) {
            results.skipped++;
            continue;
          }

          // Simular compresión si es dry run
          if (dryRun) {
            results.processed++;
            continue;
          }

          // Aquí iría la lógica de compresión real
          // Por ahora, simulamos el proceso
          const compressionResult = await this.simulateImageCompression(imagePath, {
            quality,
            maxWidth,
            maxHeight,
            originalSize: originalStats.size,
          });

          if (compressionResult.shouldCompress) {
            // En una implementación real, aquí se comprimiría la imagen
            results.processed++;
            results.spaceSaved += compressionResult.spaceSaved;
          } else {
            results.skipped++;
          }
        } catch (error) {
          logger.warn(`Error procesando imagen ${imageName}:`, error);
          results.errors++;
        }
      }

      logger.info('Compresión de imágenes completada', results);
      return results;
    } catch (error) {
      logger.error('Error en compresión de imágenes:', error);
      throw error;
    }
  }

  /**
   * Simular compresión de imagen (placeholder para implementación real)
   */
  async simulateImageCompression (imagePath, options) {
    const { originalSize, quality } = options;

    // Simulación: estimar reducción basada en calidad
    const estimatedReduction = Math.max(0, (100 - quality) / 100 * 0.5);
    const estimatedNewSize = originalSize * (1 - estimatedReduction);
    const spaceSaved = originalSize - estimatedNewSize;

    return {
      shouldCompress: spaceSaved > 1024, // Solo si ahorra más de 1KB
      spaceSaved: spaceSaved > 0 ? spaceSaved : 0,
      estimatedNewSize,
    };
  }

  /**
   * Migrar archivos antiguos a nueva estructura
   */
  async migrateOldFiles (options = {}) {
    try {
      const { sourceDir = './uploads', dryRun = false } = options;

      logger.info('Iniciando migración de archivos antiguos', { sourceDir, dryRun });

      if (!await this.directoryExists(sourceDir)) {
        logger.warn('Directorio fuente no existe:', sourceDir);
        return { migrated: 0, errors: 0 };
      }

      const oldFiles = await fs.readdir(sourceDir);
      const results = {
        totalFiles: oldFiles.length,
        migrated: 0,
        skipped: 0,
        errors: 0,
      };

      for (const fileName of oldFiles) {
        try {
          const sourcePath = path.join(sourceDir, fileName);
          const stats = await fs.stat(sourcePath);

          if (!stats.isFile()) {
            results.skipped++;
            continue;
          }

          // Determinar categoría por extensión
          const category = this.getFileCategoryByExtension(fileName);
          const targetDir = path.join(this.mediaDir, category);
          const targetPath = path.join(targetDir, fileName);

          // Verificar si ya existe
          if (await this.fileExists(targetPath)) {
            results.skipped++;
            continue;
          }

          if (!dryRun) {
            // Asegurar que existe el directorio destino
            await fs.mkdir(targetDir, { recursive: true });

            // Mover archivo
            await fs.rename(sourcePath, targetPath);
          }

          results.migrated++;
        } catch (error) {
          logger.warn(`Error migrando archivo ${fileName}:`, error);
          results.errors++;
        }
      }

      logger.info('Migración completada', results);
      return results;
    } catch (error) {
      logger.error('Error en migración de archivos:', error);
      throw error;
    }
  }

  /**
   * Obtener categoría por extensión de archivo
   */
  getFileCategoryByExtension (fileName) {
    const ext = path.extname(fileName).toLowerCase();

    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      return 'images';
    } else if (['.mp4', '.avi', '.mov', '.webm'].includes(ext)) {
      return 'videos';
    } else if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
      return 'audio';
    } else {
      return 'documents';
    }
  }

  /**
   * Verificar si directorio existe
   */
  async directoryExists (dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  /**
   * Verificar si archivo existe
   */
  async fileExists (filePath) {
    try {
      await fs.stat(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Limpiar archivos temporales automáticamente
   */
  async cleanTemporaryFiles (options = {}) {
    try {
      const { olderThanHours = 24, dryRun = false } = options;

      const cutoffDate = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));

      logger.info('Limpiando archivos temporales', {
        olderThanHours,
        cutoffDate: cutoffDate.toISOString(),
        dryRun,
      });

      if (!await this.directoryExists(this.tempDir)) {
        logger.info('Directorio temporal no existe');
        return { deleted: 0 };
      }

      const tempFiles = await fs.readdir(this.tempDir);
      let deletedCount = 0;
      let spaceSaved = 0;

      for (const fileName of tempFiles) {
        try {
          const filePath = path.join(this.tempDir, fileName);
          const stats = await fs.stat(filePath);

          if (stats.mtime < cutoffDate) {
            if (!dryRun) {
              await fs.unlink(filePath);
            }
            deletedCount++;
            spaceSaved += stats.size;
          }
        } catch (error) {
          logger.warn(`Error procesando archivo temporal ${fileName}:`, error);
        }
      }

      const result = {
        deleted: deletedCount,
        spaceSaved,
        spaceSavedFormatted: this.formatFileSize(spaceSaved),
      };

      logger.info('Limpieza de temporales completada', result);
      return result;
    } catch (error) {
      logger.error('Error limpiando archivos temporales:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas avanzadas de almacenamiento
   */
  async getAdvancedStorageStats () {
    try {
      const basicStats = await this.getStorageStats();
      const referencedFiles = await this.getReferencedMediaFiles();
      const allFiles = await this.getAllStoredFiles();

      // Calcular archivos huérfanos
      const orphanedFiles = allFiles.filter(file =>
        !referencedFiles.has(file.fileName),
      );

      const orphanedSize = orphanedFiles.reduce((total, file) => total + file.size, 0);

      // Estadísticas por edad
      const now = new Date();
      const ageRanges = {
        lastDay: 24 * 60 * 60 * 1000,
        lastWeek: 7 * 24 * 60 * 60 * 1000,
        lastMonth: 30 * 24 * 60 * 60 * 1000,
        older: Infinity,
      };

      const byAge = {};
      Object.keys(ageRanges).forEach(range => {
        byAge[range] = { files: 0, size: 0 };
      });

      allFiles.forEach(file => {
        const age = now - file.createdAt;

        for (const [range, maxAge] of Object.entries(ageRanges)) {
          if (age <= maxAge) {
            byAge[range].files++;
            byAge[range].size += file.size;
            break;
          }
        }
      });

      // Formatear tamaños
      Object.keys(byAge).forEach(range => {
        byAge[range].sizeFormatted = this.formatFileSize(byAge[range].size);
      });

      return {
        ...basicStats,
        orphaned: {
          files: orphanedFiles.length,
          size: orphanedSize,
          sizeFormatted: this.formatFileSize(orphanedSize),
          percentage: basicStats.totalSize > 0 ? (orphanedSize / basicStats.totalSize * 100).toFixed(2) : 0,
        },
        byAge,
        efficiency: {
          referencedFiles: referencedFiles.size,
          totalFiles: allFiles.length,
          utilizationRate: allFiles.length > 0 ? ((allFiles.length - orphanedFiles.length) / allFiles.length * 100).toFixed(2) : 100,
        },
      };
    } catch (error) {
      logger.error('Error obteniendo estadísticas avanzadas:', error);
      throw error;
    }
  }
}

module.exports = new MediaService();
