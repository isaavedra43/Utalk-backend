const admin = require('firebase-admin');
const path = require('path');
const logger = require('../utils/logger');

/**
 * CONFIGURACIÓN SIMPLIFICADA DE FIREBASE STORAGE
 * Solo utilidades estáticas, sin inicialización en constructor
 */
class StorageConfig {
  /**
   * Obtener bucket de forma segura
   */
  static getBucket() {
    try {
      if (!admin.apps.length) {
        throw new Error('Firebase Admin SDK no inicializado');
      }
      const explicitBucket = process.env.FIREBASE_STORAGE_BUCKET;
      const bucket = explicitBucket ? admin.storage().bucket(explicitBucket) : admin.storage().bucket();
      // Validación liviana (no bloqueante)
      bucket.getFiles({ maxResults: 1 }).catch(err => {
        logger.warn('⚠️ Validación de bucket falló (posible bucket inexistente o permisos)', {
          error: err.message,
          explicitBucket
        });
      });
      logger.info('StorageConfig: usando bucket', { bucketName: bucket.name, explicitBucketConfigured: !!explicitBucket });
      return bucket;
    } catch (error) {
      logger.warn('Firebase Storage no disponible:', error.message);
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
   * CONFIGURACIÓN DE ARCHIVOS
   */
  static getConfig() {
    return {
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
  }

  /**
   * OBTENER CATEGORÍA DEL ARCHIVO
   */
  static getFileCategory(mimeType) {
    const config = this.getConfig();
    for (const [category, types] of Object.entries(config.allowedMimeTypes)) {
      if (types.includes(mimeType)) {
        return category;
      }
    }
    return 'other';
  }

  /**
   * VALIDAR ARCHIVO
   */
  static validateFile(file) {
    const category = this.getFileCategory(file.mimetype);
    const config = this.getConfig();
    
    if (category === 'other') {
      return {
        valid: false,
        error: `Tipo de archivo no permitido: ${file.mimetype}`
      };
    }

    const maxSize = config.maxSizes[category];
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
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * GENERAR PATH SEGURO
   */
  static generateSecurePath(category, conversationId, originalName) {
    const { v4: uuidv4 } = require('uuid');
    const ext = path.extname(originalName).toLowerCase();
    const uniqueId = uuidv4();
    const timestamp = Date.now();
    
    return `${category}/${conversationId}/${timestamp}_${uniqueId}${ext}`;
  }

  /**
   * SUBIR ARCHIVO A FIREBASE STORAGE
   */
  static async uploadFile(buffer, filePath, metadata = {}) {
    try {
      const bucket = this.getBucket();
      const file = bucket.file(filePath);
      
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
  static async generateSignedUrl(filePath, expirationMs = null) {
    try {
      const bucket = this.getBucket();
      const file = bucket.file(filePath);

      // Asegurar token de descarga en metadatos
      const [meta] = await file.getMetadata();
      let token = (meta && meta.metadata && meta.metadata.firebaseStorageDownloadTokens) || null;
      if (!token) {
        const existingMeta = (meta && meta.metadata) || {};
        token = require('uuid').v4();
        await file.setMetadata({ metadata: { ...existingMeta, firebaseStorageDownloadTokens: token } });
      }

      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;

      return {
        url,
        expiresAt: null
      };
    } catch (error) {
      logger.error('Error generando URL firmada:', error);
      throw error;
    }
  }

  /**
   * ELIMINAR ARCHIVO
   */
  static async deleteFile(filePath) {
    try {
      const bucket = this.getBucket();
      await bucket.file(filePath).delete();
      logger.info('Archivo eliminado de Firebase Storage', { filePath });
    } catch (error) {
      logger.error('Error eliminando archivo:', error);
      throw error;
    }
  }

  /**
   * VERIFICAR SI ARCHIVO EXISTE
   */
  static async fileExists(filePath) {
    try {
      const bucket = this.getBucket();
      const [exists] = await bucket.file(filePath).exists();
      return exists;
    } catch (error) {
      logger.error('Error verificando existencia de archivo:', error);
      return false;
    }
  }
}

// EXPORTAR CLASE ESTÁTICA
module.exports = StorageConfig; 