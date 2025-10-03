const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');
const StorageConfig = require('../config/storage');

/**
 * Controlador de Archivos Adjuntos para Vacaciones
 * Maneja la subida y gestión de archivos relacionados con solicitudes de vacaciones
 */
class VacationAttachmentController {
  
  /**
   * Configuración de multer para archivos
   */
  static getUploadConfig() {
    const storage = multer.memoryStorage();
    
    return multer({
      storage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB máximo
        files: 5 // Máximo 5 archivos por solicitud
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/jpg',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Tipo de archivo no permitido'), false);
        }
      }
    });
  }

  /**
   * 15. POST /api/vacations/attachments
   * Subir archivos adjuntos
   */
  static async uploadAttachments(req, res) {
    try {
      const upload = VacationAttachmentController.getUploadConfig();
      
      upload.array('files', 5)(req, res, async (err) => {
        if (err) {
          return res.status(400).json({
            success: false,
            error: err.message
          });
        }

        if (!req.files || req.files.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No se proporcionaron archivos'
          });
        }

        const attachmentIds = [];

        try {
          for (const file of req.files) {
            const fileId = uuidv4();
            const fileName = `vacations/attachments/${fileId}_${file.originalname}`;
            
            // Usar StorageConfig que maneja el bucket correctamente
            const fileUpload = await StorageConfig.uploadFile(file.buffer, fileName, {
              contentType: file.mimetype,
              originalName: file.originalname,
              uploadedBy: req.user?.id || 'system',
              fileSize: file.size
            });

            // Generar URL firmada
            const signedUrl = await StorageConfig.generateSignedUrl(fileName);

            attachmentIds.push({
              id: fileId,
              fileName: file.originalname,
              url: signedUrl.url,
              size: file.size,
              type: file.mimetype,
              uploadedAt: new Date().toISOString()
            });
          }

          res.json({
            success: true,
            data: {
              attachmentIds: attachmentIds.map(a => a.id),
              attachments: attachmentIds
            },
            message: `${attachmentIds.length} archivo(s) subido(s) exitosamente`
          });

        } catch (uploadError) {
          console.error('Error uploading files:', uploadError);
          res.status(500).json({
            success: false,
            error: 'Error al subir archivos',
            details: uploadError.message
          });
        }
      });
    } catch (error) {
      console.error('Error in upload attachments:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  }

  /**
   * GET /api/vacations/attachments/:attachmentId
   * Obtener información de un archivo adjunto
   */
  static async getAttachment(req, res) {
    try {
      const { attachmentId } = req.params;
      
      const bucket = StorageConfig.getBucket();
      const [files] = await bucket.getFiles({
        prefix: `vacations/attachments/${attachmentId}_`
      });

      if (files.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Archivo no encontrado'
        });
      }

      const file = files[0];
      const [metadata] = await file.getMetadata();
      const signedUrl = await StorageConfig.generateSignedUrl(file.name);

      res.json({
        success: true,
        data: {
          id: attachmentId,
          fileName: metadata.metadata.originalName,
          url: signedUrl.url,
          size: parseInt(metadata.size),
          type: metadata.contentType,
          uploadedAt: metadata.metadata.uploadedAt,
          uploadedBy: metadata.metadata.uploadedBy
        }
      });
    } catch (error) {
      console.error('Error getting attachment:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener archivo',
        details: error.message
      });
    }
  }

  /**
   * DELETE /api/vacations/attachments/:attachmentId
   * Eliminar archivo adjunto
   */
  static async deleteAttachment(req, res) {
    try {
      const { attachmentId } = req.params;
      
      const bucket = StorageConfig.getBucket();
      const [files] = await bucket.getFiles({
        prefix: `vacations/attachments/${attachmentId}_`
      });

      if (files.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Archivo no encontrado'
        });
      }

      const file = files[0];
      await StorageConfig.deleteFile(file.name);

      res.json({
        success: true,
        message: 'Archivo eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error deleting attachment:', error);
      res.status(500).json({
        success: false,
        error: 'Error al eliminar archivo',
        details: error.message
      });
    }
  }
}

module.exports = VacationAttachmentController;
