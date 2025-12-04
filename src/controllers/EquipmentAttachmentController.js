const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');
const StorageConfig = require('../config/storage');
const { 
  EQUIPMENT_CONFIG, 
  getErrorMessage, 
  getSuccessMessage,
  validateFileSize,
  validateFileType
} = require('../config/equipmentConfig');
const logger = require('../utils/logger');

/**
 * 🎯 CONTROLADOR DE ARCHIVOS ADJUNTOS DE EQUIPOS
 * 
 * Maneja la subida y gestión de archivos para equipos
 * Alineado 100% con especificaciones del Frontend
 * 
 * @version 1.0.0
 * @author Backend Team
 */
class EquipmentAttachmentController {
  /**
   * Configuración de Multer para subida de archivos
   */
  static getUploadConfig() {
    return multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: EQUIPMENT_CONFIG.FILE_CONFIG.MAX_PHOTO_SIZE,
        files: EQUIPMENT_CONFIG.FILE_CONFIG.MAX_FILES_PER_UPLOAD
      },
      fileFilter: (req, file, cb) => {
        // Validar tipo de archivo
        const isValidPhoto = validateFileType(file.mimetype, 'photo');
        const isValidDocument = validateFileType(file.mimetype, 'document');
        
        if (isValidPhoto || isValidDocument) {
          cb(null, true);
        } else {
          cb(new Error('Tipo de archivo no permitido'), false);
        }
      }
    });
  }

  /**
   * Subir archivos adjuntos
   */
  static async uploadAttachments(req, res) {
    try {
      const { type = 'photo' } = req.body; // 'photo', 'invoice', 'document'
      const files = req.files;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No se proporcionaron archivos'
        });
      }

      // Validar número de archivos
      if (files.length > EQUIPMENT_CONFIG.FILE_CONFIG.MAX_FILES_PER_UPLOAD) {
        return res.status(400).json({
          success: false,
          error: getErrorMessage('TOO_MANY_FILES')
        });
      }

      const uploadedFiles = [];
      const errors = [];

      // Procesar cada archivo
      for (const file of files) {
        try {
          // Validar tamaño
          if (!validateFileSize(file.size, type)) {
            errors.push({
              fileName: file.originalname,
              error: getErrorMessage('FILE_TOO_LARGE')
            });
            continue;
          }

          // Validar tipo
          if (!validateFileType(file.mimetype, type)) {
            errors.push({
              fileName: file.originalname,
              error: getErrorMessage('INVALID_FILE_TYPE')
            });
            continue;
          }

          // Generar nombre único
          const fileId = uuidv4();
          const fileExtension = file.originalname.split('.').pop();
          const fileName = `${fileId}_${file.originalname}`;
          
          // Determinar ruta según tipo
          let storagePath;
          switch (type) {
            case 'invoice':
              storagePath = `equipment/invoices/${fileName}`;
              break;
            case 'document':
              storagePath = `equipment/documents/${fileName}`;
              break;
            case 'photo':
            default:
              storagePath = `equipment/photos/${fileName}`;
              break;
          }

          // Subir archivo usando StorageConfig
          const fileObj = await StorageConfig.uploadFile(file.buffer, storagePath, {
            contentType: file.mimetype,
            originalName: file.originalname,
            uploadedBy: req.user?.id || 'system',
            uploadedAt: new Date().toISOString(),
            type: type
          });

          // Obtener URL de descarga
          const { url: downloadURL } = await StorageConfig.generateSignedUrl(storagePath);

          uploadedFiles.push({
            id: fileId,
            fileName: file.originalname,
            url: downloadURL,
            size: file.size,
            type: file.mimetype,
            uploadedAt: new Date().toISOString(),
            storagePath: storagePath
          });

        } catch (fileError) {
          logger.error('Error al subir archivo individual', {
            fileName: file.originalname,
            error: fileError.message
          });
          
          errors.push({
            fileName: file.originalname,
            error: 'Error al subir archivo'
          });
        }
      }

      // Preparar respuesta
      const response = {
        success: uploadedFiles.length > 0,
        data: {
          attachmentIds: uploadedFiles.map(file => file.id),
          attachments: uploadedFiles
        },
        message: `${uploadedFiles.length} archivo(s) subido(s) exitosamente`
      };

      // Agregar errores si los hay
      if (errors.length > 0) {
        response.errors = errors;
        response.message += `, ${errors.length} archivo(s) fallaron`;
      }

      logger.info('Archivos de equipo subidos', {
        totalFiles: files.length,
        successfulUploads: uploadedFiles.length,
        failedUploads: errors.length,
        uploadedBy: req.user?.id
      });

      res.json(response);
    } catch (error) {
      logger.error('Error al subir archivos de equipo', {
        error: error.message,
        stack: error.stack,
        uploadedBy: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener información de un archivo adjunto
   */
  static async getAttachment(req, res) {
    try {
      const { attachmentId } = req.params;

      // Buscar archivo en la base de datos (esto requeriría una tabla de metadatos)
      // Por ahora, devolvemos información básica
      res.json({
        success: true,
        data: {
          id: attachmentId,
          message: 'Información de archivo obtenida exitosamente'
        }
      });
    } catch (error) {
      logger.error('Error al obtener archivo adjunto', {
        attachmentId: req.params.attachmentId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Eliminar archivo adjunto
   */
  static async deleteAttachment(req, res) {
    try {
      const { attachmentId } = req.params;
      const { storagePath } = req.body;

      if (!storagePath) {
        return res.status(400).json({
          success: false,
          error: 'Ruta de almacenamiento requerida'
        });
      }

      // Eliminar archivo usando StorageConfig
      await StorageConfig.deleteFile(storagePath);

      logger.info('Archivo de equipo eliminado', {
        attachmentId,
        storagePath,
        deletedBy: req.user?.id
      });

      res.json({
        success: true,
        message: 'Archivo eliminado exitosamente'
      });
    } catch (error) {
      logger.error('Error al eliminar archivo adjunto', {
        attachmentId: req.params.attachmentId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Descargar archivo adjunto
   */
  static async downloadAttachment(req, res) {
    try {
      const { attachmentId } = req.params;
      const { url } = req.query;

      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL de descarga requerida'
        });
      }

      // Redirigir a la URL de descarga de Firebase
      res.redirect(url);
    } catch (error) {
      logger.error('Error al descargar archivo adjunto', {
        attachmentId: req.params.attachmentId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener vista previa de archivo
   */
  static async previewAttachment(req, res) {
    try {
      const { attachmentId } = req.params;
      const { url, type } = req.query;

      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL de archivo requerida'
        });
      }

      // Para imágenes, redirigir directamente
      if (type && type.startsWith('image/')) {
        res.redirect(url);
        return;
      }

      // Para otros tipos, devolver información
      res.json({
        success: true,
        data: {
          id: attachmentId,
          url: url,
          type: type,
          message: 'Vista previa no disponible para este tipo de archivo'
        }
      });
    } catch (error) {
      logger.error('Error al obtener vista previa de archivo', {
        attachmentId: req.params.attachmentId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener configuración de subida
   */
  static async getUploadConfig(req, res) {
    try {
      res.json({
        success: true,
        data: {
          maxFileSize: EQUIPMENT_CONFIG.FILE_CONFIG.MAX_PHOTO_SIZE,
          maxFiles: EQUIPMENT_CONFIG.FILE_CONFIG.MAX_FILES_PER_UPLOAD,
          allowedPhotoTypes: EQUIPMENT_CONFIG.FILE_CONFIG.ALLOWED_PHOTO_TYPES,
          allowedDocumentTypes: EQUIPMENT_CONFIG.FILE_CONFIG.ALLOWED_DOCUMENT_TYPES
        }
      });
    } catch (error) {
      logger.error('Error al obtener configuración de subida', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }
}

module.exports = EquipmentAttachmentController;
