const { Storage } = require('@google-cloud/storage');
const admin = require('firebase-admin');
const path = require('path');
const logger = require('../utils/logger');

/**
 * CONFIGURACIÓN DE FIREBASE STORAGE
 * Configuración centralizada para manejo de archivos multimedia
 */
class StorageConfig {
  constructor() {
    try {
      // INICIALIZAR FIREBASE STORAGE
      this.storage = new Storage({
        projectId: process.env.FIREBASE_PROJECT_ID,
        keyFilename: process.env.FIREBASE_SERVICE_ACCOUNT_KEY, // Opcional si se usa default credentials
      });

      // BUCKET PRINCIPAL
      this.bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;
      this.bucket = this.storage.bucket(this.bucketName);

      // CONFIGURACIÓN DE ARCHIVOS
      this.config = {
        // Límites de tamaño por tipo (en bytes)
        maxSizes: {
          image: 10 * 1024 * 1024,    // 10MB
          video: 100 * 1024 * 1024,   // 100MB  
          audio: 50 * 1024 * 1024,    // 50MB
          document: 25 * 1024 * 1024, // 25MB
        },

        // Tipos MIME permitidos
        allowedMimeTypes: {
          image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
          video: ['video/mp4', 'video/webm', 'video/ogg', 'video/avi'],
          audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/m4a'],
          document: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        },

        // Configuración de URLs firmadas
        signedUrlExpiration: 24 * 60 * 60 * 1000, // 24 horas
      };

      logger.info('Firebase Storage configurado correctamente', {
        bucketName: this.bucketName,
        projectId: process.env.FIREBASE_PROJECT_ID
      });

    } catch (error) {
      logger.error('Error configurando Firebase Storage:', error);
      throw error;
    }
  }

  /**
   * OBTENER CATEGORÍA DEL ARCHIVO
   */
  getFileCategory(mimeType) {
    for (const [category, types] of Object.entries(this.config.allowedMimeTypes)) {
      if (types.includes(mimeType)) {
        return category;
      }
    }
    return 'other';
  }

  /**
   * VALIDAR ARCHIVO
   */
  validateFile(file) {
    const category = this.getFileCategory(file.mimetype);
    
    if (category === 'other') {
      return {
        valid: false,
        error: `Tipo de archivo no permitido: ${file.mimetype}`
      };
    }

    const maxSize = this.config.maxSizes[category];
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `Archivo demasiado grande. Máximo permitido: ${this.formatFileSize(maxSize)}`
      };
    }

    return { valid: true, category };
  }

  /**
   * FORMATEAR TAMAÑO DE ARCHIVO
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * GENERAR PATH SEGURO
   */
  generateSecurePath(category, conversationId, originalName) {
    const { v4: uuidv4 } = require('uuid');
    const ext = path.extname(originalName).toLowerCase();
    const uniqueId = uuidv4();
    const timestamp = Date.now();
    
    return `${category}/${conversationId}/${timestamp}_${uniqueId}${ext}`;
  }

  /**
   * SUBIR ARCHIVO A FIREBASE STORAGE
   */
  async uploadFile(buffer, filePath, metadata = {}) {
    try {
      const file = this.bucket.file(filePath);
      
      await file.save(buffer, {
        metadata: {
          contentType: metadata.contentType,
          metadata: {
            ...metadata,
            uploadedAt: new Date().toISOString(),
            uploadedBy: metadata.uploadedBy || 'system'
          }
        },
        resumable: false
      });

      logger.info('Archivo subido a Firebase Storage', {
        filePath,
        size: buffer.length,
        contentType: metadata.contentType
      });

      return file;
    } catch (error) {
      logger.error('Error subiendo archivo a Firebase Storage:', error);
      throw error;
    }
  }

  /**
   * GENERAR URL FIRMADA
   */
  async generateSignedUrl(filePath, expirationMs = null) {
    try {
      const expiration = Date.now() + (expirationMs || this.config.signedUrlExpiration);
      
      const [url] = await this.bucket
        .file(filePath)
        .getSignedUrl({
          action: 'read',
          expires: expiration,
        });

      return {
        url,
        expiresAt: new Date(expiration).toISOString()
      };
    } catch (error) {
      logger.error('Error generando URL firmada:', error);
      throw error;
    }
  }

  /**
   * ELIMINAR ARCHIVO
   */
  async deleteFile(filePath) {
    try {
      await this.bucket.file(filePath).delete();
      logger.info('Archivo eliminado de Firebase Storage', { filePath });
    } catch (error) {
      logger.error('Error eliminando archivo:', error);
      throw error;
    }
  }

  /**
   * VERIFICAR SI ARCHIVO EXISTE
   */
  async fileExists(filePath) {
    try {
      const [exists] = await this.bucket.file(filePath).exists();
      return exists;
    } catch (error) {
      logger.error('Error verificando existencia de archivo:', error);
      return false;
    }
  }
}

// EXPORTAR INSTANCIA SINGLETON
module.exports = new StorageConfig(); 