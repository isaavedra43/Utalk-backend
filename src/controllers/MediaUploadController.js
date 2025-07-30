const multer = require('multer');
const StorageConfig = require('../config/storage');
const AudioProcessor = require('../services/AudioProcessor');
const { ResponseHandler, ApiError } = require('../utils/responseHandler');
const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const admin = require('firebase-admin');

/**
 * CONTROLADOR DE SUBIDA DE MEDIA
 * Maneja la subida segura de archivos multimedia a Firebase Storage
 */
class MediaUploadController {

  /**
   * Controlador para subida y gestión de archivos multimedia
   */
  constructor() {
    // Rate limiting para uploads
    this.uploadLimit = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 50, // 50 uploads por ventana
      message: {
        error: 'Demasiadas subidas de archivos',
        message: 'Has excedido el límite de subidas. Intenta nuevamente en 15 minutos.',
        retryAfter: '15 minutos'
      },
      standardHeaders: true,
      legacyHeaders: false,
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

      const { conversationId } = req.body;
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

      // Validar archivo
      const validation = StorageConfig.validateFile(file);
      if (!validation.valid) {
        return ResponseHandler.error(res, new ApiError(
          'INVALID_FILE',
          validation.error,
          'Verifica que el archivo tenga un formato válido y no exceda el tamaño máximo',
          400
        ));
      }

      const category = validation.category;
      const fileId = uuidv4();
      
      // Procesar según el tipo de archivo
      let processedFile;
      
      switch (category) {
        case 'audio':
          processedFile = await this.processAudioUpload(file, fileId, conversationId, userEmail);
          break;
        case 'image':
          processedFile = await this.processImageUpload(file, fileId, conversationId, userEmail);
          break;
        case 'video':
        case 'document':
        default:
          processedFile = await this.processGenericUpload(file, fileId, conversationId, category, userEmail);
          break;
      }

      // Verificar compatibilidad con WhatsApp para Twilio
      const isWhatsAppCompatible = this.isWhatsAppCompatible(file.mimetype, file.size);

      const result = {
        mediaUrl: processedFile.signedUrl,
        fileId,
        category,
        size: StorageConfig.formatFileSize(file.size),
        sizeBytes: file.size,
        originalName: file.originalname,
        storagePath: processedFile.storagePath,
        expiresAt: processedFile.expiresAt,
        metadata: processedFile.metadata || {},
        uploadedAt: new Date().toISOString(),
        uploadedBy: userEmail,
        whatsAppCompatible: isWhatsAppCompatible
      };

      logger.info('Archivo subido exitosamente', {
        fileId,
        category,
        size: file.size,
        userEmail,
        conversationId
      });

      return ResponseHandler.success(res, result, 'Archivo subido exitosamente');

    } catch (error) {
      logger.error('Error subiendo archivo:', {
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
   * Obtener bucket de forma segura
   */
  getBucket() {
    try {
      if (!admin.apps.length) {
        throw new Error('Firebase Admin SDK no inicializado');
      }
      return admin.storage().bucket();
    } catch (error) {
      logger.warn('Firebase Storage no disponible:', error.message);
      return {
        file: () => ({
          save: () => Promise.reject(new Error('Storage no disponible')),
          getSignedUrl: () => Promise.reject(new Error('Storage no disponible')),
          delete: () => Promise.reject(new Error('Storage no disponible'))
        })
      };
    }
  }

  /**
   * Procesar archivo de audio
   */
  async processAudioUpload(file, fileId, conversationId, userEmail) {
    try {
      const processor = new AudioProcessor();
      const processedAudio = await processor.processAudio(file.buffer, fileId, file.mimetype);
      
      const storagePath = `audio/${conversationId}/${fileId}.mp3`;
      const bucket = StorageConfig.getBucket();
      const firebaseFile = bucket.file(storagePath);

      await firebaseFile.save(processedAudio.buffer, {
        metadata: {
          contentType: 'audio/mp3',
          metadata: {
            originalFormat: file.mimetype,
            originalName: file.originalname,
            processedAt: new Date().toISOString(),
            uploadedBy: userEmail,
            duration: processedAudio.metadata.duration,
            bitrate: processedAudio.metadata.bitrate
          }
        }
      });

      const [signedUrl] = await firebaseFile.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
      });

      return {
        storagePath,
        signedUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: processedAudio.metadata
      };
    } catch (error) {
      logger.error('Error procesando audio upload:', error);
      throw error;
    }
  }

  /**
   * Procesar archivo de imagen
   */
  async processImageUpload(file, fileId, conversationId, userEmail) {
    try {
      // Optimizar imagen con Sharp
      const optimizedBuffer = await sharp(file.buffer)
        .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      const storagePath = `images/${conversationId}/${fileId}.jpg`;
      const bucket = StorageConfig.getBucket();
      const firebaseFile = bucket.file(storagePath);

      await firebaseFile.save(optimizedBuffer, {
        metadata: {
          contentType: 'image/jpeg',
          metadata: {
            originalFormat: file.mimetype,
            originalName: file.originalname,
            processedAt: new Date().toISOString(),
            uploadedBy: userEmail,
            optimized: true
          }
        }
      });

      const [signedUrl] = await firebaseFile.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
      });

      return {
        storagePath,
        signedUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          originalSize: file.buffer.length,
          optimizedSize: optimizedBuffer.length,
          compression: ((file.buffer.length - optimizedBuffer.length) / file.buffer.length * 100).toFixed(1) + '%'
        }
      };
    } catch (error) {
      logger.error('Error procesando imagen upload:', error);
      throw error;
    }
  }

  /**
   * Procesar archivo genérico
   */
  async processGenericUpload(file, fileId, conversationId, category, userEmail) {
    try {
      const extension = path.extname(file.originalname).toLowerCase() || '.bin';
      const storagePath = `${category}/${conversationId}/${fileId}${extension}`;
      const bucket = StorageConfig.getBucket();
      const firebaseFile = bucket.file(storagePath);

      await firebaseFile.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
          metadata: {
            originalName: file.originalname,
            processedAt: new Date().toISOString(),
            uploadedBy: userEmail,
            category
          }
        }
      });

      const [signedUrl] = await firebaseFile.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
      });

      return {
        storagePath,
        signedUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          originalSize: file.buffer.length
        }
      };
    } catch (error) {
      logger.error('Error procesando archivo genérico:', error);
      throw error;
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

  /**
   * Obtener información de archivo
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

      // Buscar archivo en Firebase Storage
      const bucket = StorageConfig.getBucket();
      const [files] = await bucket.getFiles({
        prefix: ``,
        delimiter: '/'
      });

      // Buscar archivo que contenga el fileId
      const file = files.find(f => f.name.includes(fileId));
      
      if (!file) {
        return ResponseHandler.error(res, new ApiError(
          'FILE_NOT_FOUND',
          'Archivo no encontrado',
          'El archivo especificado no existe o fue eliminado',
          404
        ));
      }

      const [metadata] = await file.getMetadata();
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
      });

      const result = {
        fileId,
        name: file.name,
        size: parseInt(metadata.size),
        contentType: metadata.contentType,
        created: metadata.timeCreated,
        updated: metadata.updated,
        signedUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: metadata.metadata || {}
      };

      return ResponseHandler.success(res, result, 'Información de archivo obtenida');

    } catch (error) {
      logger.error('Error obteniendo información de archivo:', error);
      return ResponseHandler.error(res, new ApiError(
        'FILE_INFO_ERROR',
        'Error obteniendo información del archivo',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }

  /**
   * Eliminar archivo
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

      // Buscar y eliminar archivo en Firebase Storage
      const bucket = StorageConfig.getBucket();
      const [files] = await bucket.getFiles({
        prefix: ``,
        delimiter: '/'
      });

      const file = files.find(f => f.name.includes(fileId));
      
      if (!file) {
        return ResponseHandler.error(res, new ApiError(
          'FILE_NOT_FOUND',
          'Archivo no encontrado',
          'El archivo especificado no existe o ya fue eliminado',
          404
        ));
      }

      await file.delete();

      logger.info('Archivo eliminado exitosamente', {
        fileId,
        fileName: file.name,
        deletedBy: req.user.email
      });

      return ResponseHandler.success(res, { 
        fileId,
        deleted: true,
        deletedAt: new Date().toISOString() 
      }, 'Archivo eliminado exitosamente');

    } catch (error) {
      logger.error('Error eliminando archivo:', error);
      return ResponseHandler.error(res, new ApiError(
        'DELETE_ERROR',
        'Error eliminando archivo',
        'Intenta nuevamente o contacta soporte',
        500
      ));
    }
  }
}

module.exports = new MediaUploadController(); 