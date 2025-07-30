const multer = require('multer');
const rateLimit = require('express-rate-limit');
const storageConfig = require('../config/storage');
const audioProcessor = require('../services/AudioProcessor');
const Conversation = require('../models/Conversation');
const { ResponseHandler, ApiError } = require('../utils/responseHandler');
const logger = require('../utils/logger');
const sharp = require('sharp');
const path = require('path');

/**
 * CONTROLADOR DE SUBIDA DE MEDIA
 * Maneja la subida segura de archivos multimedia a Firebase Storage
 */
class MediaUploadController {

  /**
   * CONFIGURACIÓN DE MULTER PARA MEMORIA
   */
  static getMulterConfig() {
    return multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB límite global
        files: 5, // Máximo 5 archivos por request
      },
      fileFilter: (req, file, cb) => {
        try {
          const validation = storageConfig.validateFile(file);
          if (validation.valid) {
            cb(null, true);
          } else {
            cb(new ApiError('INVALID_FILE', validation.error, 'Verifica el tipo y tamaño del archivo', 400), false);
          }
        } catch (error) {
          logger.error('Error en fileFilter:', error);
          cb(new ApiError('FILE_VALIDATION_ERROR', 'Error validando archivo', 'Intenta nuevamente', 500), false);
        }
      }
    });
  }

  /**
   * RATE LIMITING ESPECÍFICO PARA UPLOADS
   */
  static getUploadRateLimit() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 50, // 50 uploads por ventana
      message: {
        error: 'UPLOAD_RATE_LIMIT',
        message: 'Demasiadas subidas de archivos. Intenta en 15 minutos.',
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  /**
   * ENDPOINT PRINCIPAL: POST /api/media/upload
   */
  static async uploadMedia(req, res, next) {
    const startTime = Date.now();
    
    try {
      const { conversationId } = req.body;
      const file = req.file;

      // 🔍 VALIDACIONES BÁSICAS
      if (!file) {
        throw new ApiError('NO_FILE', 'No se recibió ningún archivo', 'Selecciona un archivo para subir', 400);
      }

      if (!conversationId) {
        throw new ApiError('NO_CONVERSATION', 'conversationId es requerido', 'Especifica la conversación', 400);
      }

      logger.info('📁 Iniciando subida de archivo', {
        filename: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        conversationId,
        userEmail: req.user.email
      });

      // 🔒 VALIDAR PERMISOS DE CONVERSACIÓN
      const conversation = await Conversation.getById(conversationId);
      if (!conversation) {
        throw new ApiError('CONVERSATION_NOT_FOUND', 'Conversación no encontrada', 'Verifica el ID de conversación', 404);
      }

      // Verificar que el usuario sea participante de la conversación
      const isParticipant = conversation.participants.includes(req.user.email) || 
                           conversation.assignedTo === req.user.email ||
                           req.user.role === 'admin' || 
                           req.user.role === 'superadmin';

      if (!isParticipant) {
        throw new ApiError('ACCESS_DENIED', 'Sin permisos para subir archivos a esta conversación', 'Solo los participantes pueden subir archivos', 403);
      }

      // VALIDAR ARCHIVO
      const validation = storageConfig.validateFile(file);
      if (!validation.valid) {
        throw new ApiError('INVALID_FILE', validation.error, 'Verifica el tipo y tamaño del archivo', 400);
      }

      // PROCESAR ARCHIVO SEGÚN TIPO
      const processedFile = await MediaUploadController.processFileByType(file, validation.category);

      // GENERAR PATH SEGURO EN FIREBASE
      const storagePath = storageConfig.generateSecurePath(validation.category, conversationId, file.originalname);

      // PREPARAR METADATOS
      const uploadMetadata = {
        contentType: file.mimetype,
        uploadedBy: req.user.email,
        conversationId,
        category: validation.category,
        originalName: file.originalname,
        originalSize: file.size,
        processedSize: processedFile.buffer.length,
        processed: processedFile.processed || false,
        ...processedFile.metadata
      };

      // SUBIR A FIREBASE STORAGE
      const firebaseFile = await storageConfig.uploadFile(processedFile.buffer, storagePath, uploadMetadata);

      // GENERAR URL FIRMADA
      const signedUrlData = await storageConfig.generateSignedUrl(storagePath);

      // RESPUESTA AL FRONTEND
      const responseData = {
        mediaUrl: signedUrlData.url,
        fileId: path.basename(storagePath, path.extname(storagePath)),
        category: validation.category,
        size: storageConfig.formatFileSize(processedFile.buffer.length),
        sizeBytes: processedFile.buffer.length,
        originalName: file.originalname,
        storagePath: storagePath,
        expiresAt: signedUrlData.expiresAt,
        metadata: processedFile.metadata || {},
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.user.email
      };

      const processingTime = Date.now() - startTime;

      logger.info('Archivo subido exitosamente a Firebase Storage', {
        filename: file.originalname,
        category: validation.category,
        size: responseData.size,
        storagePath,
        processingTime: `${processingTime}ms`,
        userEmail: req.user.email
      });

      return ResponseHandler.success(res, responseData, 'Archivo subido exitosamente', 201);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Error subiendo archivo', {
        error: error.message,
        stack: error.stack,
        filename: req.file?.originalname,
        userEmail: req.user?.email,
        conversationId: req.body?.conversationId,
        processingTime: `${processingTime}ms`
      });

      return ResponseHandler.error(res, error);
    }
  }

  /**
   * PROCESAR ARCHIVO SEGÚN TIPO
   */
  static async processFileByType(file, category) {
    try {
      switch (category) {
        case 'audio':
          return await MediaUploadController.processAudio(file);
        
        case 'image':
          return await MediaUploadController.processImage(file);
        
        case 'video':
          return await MediaUploadController.processVideo(file);
        
        case 'document':
          return await MediaUploadController.processDocument(file);
        
        default:
          return {
            buffer: file.buffer,
            processed: false,
            metadata: {
              originalSize: file.size,
              originalMimeType: file.mimetype
            }
          };
      }
    } catch (error) {
      logger.error('Error procesando archivo por tipo:', error);
      // En caso de error, devolver archivo original
      return {
        buffer: file.buffer,
        processed: false,
        metadata: {
          originalSize: file.size,
          originalMimeType: file.mimetype,
          processingError: error.message
        }
      };
    }
  }

  /**
   * PROCESAR AUDIO
   */
  static async processAudio(file) {
    try {
      const result = await audioProcessor.processAudio(file.buffer, file.originalname);
      
      return {
        buffer: result.processedBuffer,
        processed: result.metadata.processed,
        metadata: {
          ...result.metadata,
          originalMimeType: file.mimetype,
          // Agregar campos específicos para audio
          type: 'audio',
          isPlayable: true
        }
      };
    } catch (error) {
      logger.error('Error procesando audio:', error);
      return {
        buffer: file.buffer,
        processed: false,
        metadata: {
          originalSize: file.size,
          originalMimeType: file.mimetype,
          type: 'audio',
          processingError: error.message
        }
      };
    }
  }

  /**
   * PROCESAR IMAGEN
   */
  static async processImage(file) {
    try {
      // Procesar imagen con Sharp para optimización
      const imageBuffer = await sharp(file.buffer)
        .resize(1920, 1080, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({
          quality: 85,
          progressive: true
        })
        .toBuffer();

      // Extraer metadatos
      const metadata = await sharp(file.buffer).metadata();

      return {
        buffer: imageBuffer,
        processed: true,
        metadata: {
          originalSize: file.size,
          processedSize: imageBuffer.length,
          originalMimeType: file.mimetype,
          type: 'image',
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          optimized: true
        }
      };
    } catch (error) {
      logger.error('Error procesando imagen:', error);
      return {
        buffer: file.buffer,
        processed: false,
        metadata: {
          originalSize: file.size,
          originalMimeType: file.mimetype,
          type: 'image',
          processingError: error.message
        }
      };
    }
  }

  /**
   * PROCESAR VIDEO
   */
  static async processVideo(file) {
    // Implementar procesamiento de video con ffmpeg
    return {
      buffer: file.buffer,
      processed: false,
      metadata: {
        originalSize: file.size,
        originalMimeType: file.mimetype,
        type: 'video',
        note: 'Procesamiento de video pendiente de implementación'
      }
    };
  }

  /**
   * PROCESAR DOCUMENTO
   */
  static async processDocument(file) {
    return {
      buffer: file.buffer,
      processed: false,
      metadata: {
        originalSize: file.size,
        originalMimeType: file.mimetype,
        type: 'document',
        isDownloadable: true
      }
    };
  }

  /**
   * OBTENER INFORMACIÓN DE ARCHIVO
   */
  static async getFileInfo(req, res, next) {
    try {
      const { fileId } = req.params;
      
      // Implementar obtención de info desde Firebase Storage
      // Por ahora retornar placeholder
      
      logger.info('Solicitando información de archivo', {
        fileId,
        userEmail: req.user.email
      });

      return ResponseHandler.success(res, {
        fileId,
        message: 'Información de archivo - por implementar'
      });

    } catch (error) {
      logger.error('Error obteniendo información de archivo:', error);
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * VERIFICAR COMPATIBILIDAD CON WHATSAPP
   */
  static isWhatsAppCompatible(category, metadata = {}) {
    const whatsAppLimits = {
      image: {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/jpeg', 'image/png']
      },
      video: {
        maxSize: 16 * 1024 * 1024, // 16MB
        allowedTypes: ['video/mp4', 'video/3gp']
      },
      audio: {
        maxSize: 16 * 1024 * 1024, // 16MB
        allowedTypes: ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg']
      },
      document: {
        maxSize: 100 * 1024 * 1024, // 100MB
        allowedTypes: ['application/pdf']
      }
    };

    const limits = whatsAppLimits[category];
    if (!limits) return false;

    // Verificar tamaño
    if (metadata.sizeBytes && metadata.sizeBytes > limits.maxSize) {
      return false;
    }

    // Verificar tipo MIME
    if (metadata.originalMimeType && !limits.allowedTypes.includes(metadata.originalMimeType)) {
      return false;
    }

    return true;
  }

  /**
   * ELIMINAR ARCHIVO
   */
  static async deleteFile(req, res, next) {
    try {
      const { fileId } = req.params;
      
      // Implementar eliminación desde Firebase Storage
      // Verificar permisos del usuario
      
      logger.info('Solicitando eliminación de archivo', {
        fileId,
        userEmail: req.user.email
      });

      return ResponseHandler.success(res, {
        fileId,
        message: 'Archivo eliminado - por implementar'
      });

    } catch (error) {
      logger.error('Error eliminando archivo:', error);
      return ResponseHandler.error(res, error);
    }
  }
}

module.exports = MediaUploadController; 