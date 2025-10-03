const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');
const { getStorage } = require('firebase-admin/storage');
const { isValidAttachmentType, getErrorMessage, getSuccessMessage } = require('../config/incidentConfig');

/**
 * Controlador de Archivos Adjuntos para Incidentes
 * Maneja la subida y gestión de archivos relacionados con incidentes
 */
class IncidentAttachmentController {
  
  /**
   * Configuración de multer para archivos
   */
  static getUploadConfig() {
    const storage = multer.memoryStorage();
    
    return multer({
      storage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB máximo
        files: 10 // Máximo 10 archivos por incidente
      },
      fileFilter: (req, file, cb) => {
        if (isValidAttachmentType(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Tipo de archivo no permitido'), false);
        }
      }
    });
  }

  /**
   * 11. POST /api/incidents/attachments
   * Subir archivos adjuntos
   */
  static async uploadAttachments(req, res) {
    try {
      const upload = IncidentAttachmentController.getUploadConfig();
      
      upload.array('files', 10)(req, res, async (err) => {
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

        const bucket = getStorage().bucket();
        const attachmentIds = [];

        try {
          for (const file of req.files) {
            const fileId = uuidv4();
            const fileName = `incidents/attachments/${fileId}_${file.originalname}`;
            
            const fileUpload = bucket.file(fileName);
            
            await fileUpload.save(file.buffer, {
              metadata: {
                contentType: file.mimetype,
                metadata: {
                  originalName: file.originalname,
                  uploadedBy: req.user?.id || 'system',
                  uploadedAt: new Date().toISOString(),
                  fileSize: file.size,
                  incidentRelated: true
                }
              }
            });

            // Hacer el archivo público (opcional, según necesidades)
            await fileUpload.makePublic();

            attachmentIds.push({
              id: fileId,
              fileName: file.originalname,
              url: `https://storage.googleapis.com/${bucket.name}/${fileName}`,
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
   * GET /api/incidents/attachments/:attachmentId
   * Obtener información de un archivo adjunto
   */
  static async getAttachment(req, res) {
    try {
      const { attachmentId } = req.params;
      
      const bucket = getStorage().bucket();
      const [files] = await bucket.getFiles({
        prefix: `incidents/attachments/${attachmentId}_`
      });

      if (files.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Archivo no encontrado'
        });
      }

      const file = files[0];
      const [metadata] = await file.getMetadata();

      res.json({
        success: true,
        data: {
          id: attachmentId,
          fileName: metadata.metadata.originalName,
          url: `https://storage.googleapis.com/${bucket.name}/${file.name}`,
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
   * DELETE /api/incidents/attachments/:attachmentId
   * Eliminar archivo adjunto
   */
  static async deleteAttachment(req, res) {
    try {
      const { attachmentId } = req.params;
      
      const bucket = getStorage().bucket();
      const [files] = await bucket.getFiles({
        prefix: `incidents/attachments/${attachmentId}_`
      });

      if (files.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Archivo no encontrado'
        });
      }

      const file = files[0];
      await file.delete();

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

  /**
   * GET /api/incidents/attachments/:attachmentId/download
   * Descargar archivo adjunto
   */
  static async downloadAttachment(req, res) {
    try {
      const { attachmentId } = req.params;
      
      const bucket = getStorage().bucket();
      const [files] = await bucket.getFiles({
        prefix: `incidents/attachments/${attachmentId}_`
      });

      if (files.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Archivo no encontrado'
        });
      }

      const file = files[0];
      const [metadata] = await file.getMetadata();

      // Configurar headers para descarga
      res.setHeader('Content-Type', metadata.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${metadata.metadata.originalName}"`);
      res.setHeader('Content-Length', metadata.size);

      // Stream del archivo
      const stream = file.createReadStream();
      stream.pipe(res);

      stream.on('error', (error) => {
        console.error('Error streaming file:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Error al descargar archivo'
          });
        }
      });

    } catch (error) {
      console.error('Error downloading attachment:', error);
      res.status(500).json({
        success: false,
        error: 'Error al descargar archivo',
        details: error.message
      });
    }
  }

  /**
   * GET /api/incidents/attachments/:attachmentId/preview
   * Vista previa de archivo adjunto
   */
  static async previewAttachment(req, res) {
    try {
      const { attachmentId } = req.params;
      
      const bucket = getStorage().bucket();
      const [files] = await bucket.getFiles({
        prefix: `incidents/attachments/${attachmentId}_`
      });

      if (files.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Archivo no encontrado'
        });
      }

      const file = files[0];
      const [metadata] = await file.getMetadata();

      // Solo permitir vista previa para imágenes y PDFs
      const allowedPreviewTypes = [
        'image/jpeg',
        'image/png',
        'image/jpg',
        'application/pdf'
      ];

      if (!allowedPreviewTypes.includes(metadata.contentType)) {
        return res.status(400).json({
          success: false,
          error: 'Tipo de archivo no compatible con vista previa'
        });
      }

      // Configurar headers para vista previa
      res.setHeader('Content-Type', metadata.contentType);
      res.setHeader('Content-Disposition', `inline; filename="${metadata.metadata.originalName}"`);
      res.setHeader('Content-Length', metadata.size);

      // Stream del archivo
      const stream = file.createReadStream();
      stream.pipe(res);

      stream.on('error', (error) => {
        console.error('Error streaming file preview:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Error al mostrar vista previa'
          });
        }
      });

    } catch (error) {
      console.error('Error previewing attachment:', error);
      res.status(500).json({
        success: false,
        error: 'Error al mostrar vista previa',
        details: error.message
      });
    }
  }
}

module.exports = IncidentAttachmentController;
