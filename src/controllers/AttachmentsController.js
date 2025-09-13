const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const admin = require('firebase-admin');

/**
 * Controlador de Archivos Adjuntos
 * Maneja la subida, descarga y gestión de archivos para movimientos de extras
 */
class AttachmentsController {

  /**
   * Configuración de multer para subida de archivos
   */
  static getMulterConfig() {
    const storage = multer.memoryStorage();
    
    return multer({
      storage: storage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB máximo
        files: 5 // Máximo 5 archivos por vez
      },
      fileFilter: (req, file, cb) => {
        // Tipos de archivo permitidos
        const allowedTypes = [
          'application/pdf',                    // PDF
          'image/jpeg',                         // JPG
          'image/png',                          // PNG
          'application/msword',                 // DOC
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
          'text/plain'                          // TXT
        ];

        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Tipo de archivo no permitido. Solo se permiten: PDF, JPG, PNG, DOC, DOCX, TXT'), false);
        }
      }
    });
  }

  /**
   * Sube archivos a Firebase Storage
   * POST /api/attachments
   */
  static async uploadFiles(req, res) {
    try {
      const { employeeId, movementId, movementType } = req.body;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No se han proporcionado archivos'
        });
      }

      if (!employeeId || !movementType) {
        return res.status(400).json({
          success: false,
          error: 'ID de empleado y tipo de movimiento son requeridos'
        });
      }

      const bucket = admin.storage().bucket();
      const uploadPromises = [];
      const uploadedFiles = [];

      // Procesar cada archivo
      for (const file of req.files) {
        const fileId = uuidv4();
        const fileName = `${fileId}_${file.originalname}`;
        const filePath = `employees/${employeeId}/movements/${movementType}/${fileName}`;

        // Crear referencia del archivo en Firebase Storage
        const fileRef = bucket.file(filePath);

        // Configurar metadatos
        const metadata = {
          metadata: {
            employeeId,
            movementId: movementId || 'pending',
            movementType,
            originalName: file.originalname,
            uploadedAt: new Date().toISOString(),
            uploadedBy: req.user?.id || 'system'
          },
          contentType: file.mimetype
        };

        // Crear promesa de subida
        const uploadPromise = new Promise((resolve, reject) => {
          const stream = fileRef.createWriteStream({
            metadata: metadata,
            resumable: false
          });

          stream.on('error', (error) => {
            console.error('Error uploading file:', error);
            reject(error);
          });

          stream.on('finish', async () => {
            try {
              // Hacer el archivo público (opcional, depende de los requerimientos de seguridad)
              await fileRef.makePublic();

              // Obtener URL pública
              const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

              const fileInfo = {
                id: fileId,
                originalName: file.originalname,
                fileName: fileName,
                filePath: filePath,
                url: publicUrl,
                size: file.size,
                mimetype: file.mimetype,
                employeeId,
                movementId: movementId || null,
                movementType,
                uploadedAt: new Date().toISOString(),
                uploadedBy: req.user?.id || 'system'
              };

              resolve(fileInfo);
            } catch (error) {
              reject(error);
            }
          });

          // Escribir el buffer del archivo
          stream.end(file.buffer);
        });

        uploadPromises.push(uploadPromise);
      }

      // Esperar a que todos los archivos se suban
      const results = await Promise.all(uploadPromises);
      uploadedFiles.push(...results);

      res.json({
        success: true,
        data: {
          files: uploadedFiles,
          total: uploadedFiles.length
        },
        message: `${uploadedFiles.length} archivo(s) subido(s) exitosamente`
      });

    } catch (error) {
      console.error('Error uploading files:', error);
      
      if (error.message.includes('Tipo de archivo no permitido')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Error al subir archivos',
        details: error.message
      });
    }
  }

  /**
   * Obtiene información de un archivo
   * GET /api/attachments/:fileId
   */
  static async getFileInfo(req, res) {
    try {
      const { fileId } = req.params;

      if (!fileId) {
        return res.status(400).json({
          success: false,
          error: 'ID de archivo es requerido'
        });
      }

      // Buscar archivo en Firebase Storage
      // Nota: Esta es una implementación simplificada
      // En un caso real, se debería mantener un registro de archivos en Firestore
      
      res.json({
        success: true,
        data: {
          id: fileId,
          message: 'Información del archivo'
        }
      });

    } catch (error) {
      console.error('Error getting file info:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener información del archivo'
      });
    }
  }

  /**
   * Descarga un archivo
   * GET /api/attachments/:fileId/download
   */
  static async downloadFile(req, res) {
    try {
      const { fileId } = req.params;
      const { filePath } = req.query;

      if (!fileId || !filePath) {
        return res.status(400).json({
          success: false,
          error: 'ID de archivo y ruta son requeridos'
        });
      }

      const bucket = admin.storage().bucket();
      const file = bucket.file(filePath);

      // Verificar que el archivo existe
      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: 'Archivo no encontrado'
        });
      }

      // Obtener metadatos del archivo
      const [metadata] = await file.getMetadata();
      
      // Configurar headers para descarga
      res.set({
        'Content-Type': metadata.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${metadata.metadata?.originalName || fileId}"`,
        'Cache-Control': 'no-cache'
      });

      // Crear stream de descarga
      const stream = file.createReadStream();
      
      stream.on('error', (error) => {
        console.error('Error downloading file:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Error al descargar archivo'
          });
        }
      });

      // Enviar archivo
      stream.pipe(res);

    } catch (error) {
      console.error('Error downloading file:', error);
      res.status(500).json({
        success: false,
        error: 'Error al descargar archivo'
      });
    }
  }

  /**
   * Elimina un archivo
   * DELETE /api/attachments/:fileId
   */
  static async deleteFile(req, res) {
    try {
      const { fileId } = req.params;
      const { filePath } = req.body;

      if (!fileId || !filePath) {
        return res.status(400).json({
          success: false,
          error: 'ID de archivo y ruta son requeridos'
        });
      }

      const bucket = admin.storage().bucket();
      const file = bucket.file(filePath);

      // Verificar que el archivo existe
      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: 'Archivo no encontrado'
        });
      }

      // Eliminar archivo
      await file.delete();

      res.json({
        success: true,
        message: 'Archivo eliminado exitosamente'
      });

    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({
        success: false,
        error: 'Error al eliminar archivo'
      });
    }
  }

  /**
   * Obtiene archivos por movimiento
   * GET /api/movements/:movementId/attachments
   */
  static async getMovementFiles(req, res) {
    try {
      const { movementId } = req.params;
      const { employeeId } = req.query;

      if (!movementId || !employeeId) {
        return res.status(400).json({
          success: false,
          error: 'ID de movimiento y empleado son requeridos'
        });
      }

      // En una implementación real, se buscarían los archivos en Firestore
      // o se mantendría un registro de archivos asociados a movimientos
      
      const bucket = admin.storage().bucket();
      const folderPath = `employees/${employeeId}/movements/`;
      
      // Listar archivos en la carpeta del empleado
      const [files] = await bucket.getFiles({
        prefix: folderPath,
        delimiter: '/'
      });

      // Filtrar archivos por movimiento (basado en metadatos)
      const movementFiles = [];
      
      for (const file of files) {
        try {
          const [metadata] = await file.getMetadata();
          if (metadata.metadata?.movementId === movementId) {
            movementFiles.push({
              id: metadata.metadata?.fileId || file.name,
              originalName: metadata.metadata?.originalName || file.name,
              fileName: file.name,
              url: `https://storage.googleapis.com/${bucket.name}/${file.name}`,
              size: metadata.size,
              contentType: metadata.contentType,
              uploadedAt: metadata.metadata?.uploadedAt,
              uploadedBy: metadata.metadata?.uploadedBy
            });
          }
        } catch (metadataError) {
          // Ignorar archivos con metadatos inválidos
          console.warn('Error reading file metadata:', metadataError);
        }
      }

      res.json({
        success: true,
        data: {
          files: movementFiles,
          total: movementFiles.length,
          movementId
        }
      });

    } catch (error) {
      console.error('Error getting movement files:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener archivos del movimiento'
      });
    }
  }

  /**
   * Valida archivos antes de subir
   * POST /api/attachments/validate
   */
  static async validateFiles(req, res) {
    try {
      const files = req.files;
      
      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No se han proporcionado archivos para validar'
        });
      }

      const validationResults = [];
      
      for (const file of files) {
        const validation = {
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          valid: true,
          errors: []
        };

        // Validar tamaño
        if (file.size > 10 * 1024 * 1024) { // 10MB
          validation.valid = false;
          validation.errors.push('Archivo excede el tamaño máximo de 10MB');
        }

        // Validar tipo
        const allowedTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain'
        ];

        if (!allowedTypes.includes(file.mimetype)) {
          validation.valid = false;
          validation.errors.push('Tipo de archivo no permitido');
        }

        // Validar nombre
        if (file.originalname.length > 255) {
          validation.valid = false;
          validation.errors.push('Nombre de archivo demasiado largo');
        }

        validationResults.push(validation);
      }

      const allValid = validationResults.every(result => result.valid);

      res.json({
        success: true,
        data: {
          validationResults,
          allValid,
          totalFiles: files.length,
          validFiles: validationResults.filter(r => r.valid).length
        }
      });

    } catch (error) {
      console.error('Error validating files:', error);
      res.status(500).json({
        success: false,
        error: 'Error al validar archivos'
      });
    }
  }
}

module.exports = AttachmentsController;
