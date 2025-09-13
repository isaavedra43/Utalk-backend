const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Controlador para gestión de archivos adjuntos
 */
class AttachmentsController {
  
  /**
   * Configuración de multer para subida de archivos
   */
  static getMulterConfig() {
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          const uploadDir = path.join(__dirname, '../../uploads/attachments');
          await fs.mkdir(uploadDir, { recursive: true });
          cb(null, uploadDir);
        } catch (error) {
          cb(error);
        }
      },
      filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      }
    });

    const fileFilter = (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Tipo de archivo no permitido. Solo se permiten: JPG, PNG, PDF, DOC, DOCX'), false);
      }
    };

    return multer({
      storage: storage,
      fileFilter: fileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 5 // Máximo 5 archivos por request
      }
    });
  }

  /**
   * Sube archivos adjuntos para un empleado
   * POST /api/attachments
   */
  static async uploadFiles(req, res) {
    try {
      const { employeeId, movementType, movementId } = req.body;
      
      if (!employeeId) {
        return res.status(400).json({
          success: false,
          error: 'ID del empleado es requerido'
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No se han subido archivos'
        });
      }

      const uploadedFiles = [];
      
      for (const file of req.files) {
        const fileData = {
          id: uuidv4(),
          originalName: file.originalname,
          filename: file.filename,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype,
          employeeId: employeeId,
          movementType: movementType || 'general',
          movementId: movementId || null,
          uploadedAt: new Date().toISOString(),
          uploadedBy: req.user?.email || 'system'
        };

        // Guardar metadatos en Firestore
        await db.collection('employees')
          .doc(employeeId)
          .collection('attachments')
          .doc(fileData.id)
          .set(fileData);

        uploadedFiles.push({
          id: fileData.id,
          originalName: fileData.originalName,
          filename: fileData.filename,
          size: fileData.size,
          mimetype: fileData.mimetype,
          uploadedAt: fileData.uploadedAt
        });
      }

      res.json({
        success: true,
        message: `${uploadedFiles.length} archivo(s) subido(s) exitosamente`,
        data: {
          files: uploadedFiles,
          employeeId: employeeId,
          movementType: movementType,
          totalFiles: uploadedFiles.length
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error subiendo archivos:', error);
      
      // Limpiar archivos subidos en caso de error
      if (req.files) {
        for (const file of req.files) {
          try {
            await fs.unlink(file.path);
          } catch (unlinkError) {
            console.error('Error eliminando archivo:', unlinkError);
          }
        }
      }

      res.status(500).json({
        success: false,
        error: 'Error subiendo archivos',
        details: error.message
      });
    }
  }

  /**
   * Obtiene archivos adjuntos de un empleado
   * GET /api/attachments/employee/:id
   */
  static async getEmployeeAttachments(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { movementType, limit = 50 } = req.query;

      let query = db.collection('employees')
        .doc(employeeId)
        .collection('attachments')
        .orderBy('uploadedAt', 'desc')
        .limit(parseInt(limit));

      if (movementType) {
        query = query.where('movementType', '==', movementType);
      }

      const snapshot = await query.get();
      const attachments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      res.json({
        success: true,
        data: {
          attachments: attachments,
          total: attachments.length,
          employeeId: employeeId
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error obteniendo archivos:', error);
      res.status(500).json({
        success: false,
        error: 'Error obteniendo archivos adjuntos',
        details: error.message
      });
    }
  }

  /**
   * Descarga un archivo específico
   * GET /api/attachments/:id/download
   */
  static async downloadFile(req, res) {
    try {
      const { id: fileId } = req.params;
      const { employeeId } = req.query;

      if (!employeeId) {
        return res.status(400).json({
          success: false,
          error: 'ID del empleado es requerido'
        });
      }

      const doc = await db.collection('employees')
        .doc(employeeId)
        .collection('attachments')
        .doc(fileId)
        .get();

      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Archivo no encontrado'
        });
      }

      const fileData = doc.data();
      
      // Verificar que el archivo existe físicamente
      try {
        await fs.access(fileData.path);
      } catch (error) {
        return res.status(404).json({
          success: false,
          error: 'Archivo físico no encontrado'
        });
      }

      res.download(fileData.path, fileData.originalName);

    } catch (error) {
      console.error('Error descargando archivo:', error);
      res.status(500).json({
        success: false,
        error: 'Error descargando archivo',
        details: error.message
      });
    }
  }

  /**
   * Elimina un archivo adjunto
   * DELETE /api/attachments/:id
   */
  static async deleteFile(req, res) {
    try {
      const { id: fileId } = req.params;
      const { employeeId } = req.body;

      if (!employeeId) {
        return res.status(400).json({
          success: false,
          error: 'ID del empleado es requerido'
        });
      }

      const doc = await db.collection('employees')
        .doc(employeeId)
        .collection('attachments')
        .doc(fileId)
        .get();

      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Archivo no encontrado'
        });
      }

      const fileData = doc.data();

      // Eliminar archivo físico
      try {
        await fs.unlink(fileData.path);
      } catch (error) {
        console.error('Error eliminando archivo físico:', error);
      }

      // Eliminar registro de Firestore
      await db.collection('employees')
        .doc(employeeId)
        .collection('attachments')
        .doc(fileId)
        .delete();

      res.json({
        success: true,
        message: 'Archivo eliminado exitosamente',
        data: {
          fileId: fileId,
          originalName: fileData.originalName
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error eliminando archivo:', error);
      res.status(500).json({
        success: false,
        error: 'Error eliminando archivo',
        details: error.message
      });
    }
  }

  /**
   * Obtiene estadísticas de archivos
   * GET /api/attachments/stats
   */
  static async getStats(req, res) {
    try {
      const { employeeId, startDate, endDate } = req.query;

      let query = db.collection('employees');
      
      if (employeeId) {
        query = query.doc(employeeId).collection('attachments');
      } else {
        // Para estadísticas globales, necesitaríamos una consulta más compleja
        // Por ahora retornamos estadísticas básicas
        return res.json({
          success: true,
          data: {
            message: 'Estadísticas globales no implementadas aún',
            employeeId: employeeId || 'all'
          }
        });
      }

      const snapshot = await query.get();
      const attachments = snapshot.docs.map(doc => doc.data());

      const stats = {
        totalFiles: attachments.length,
        totalSize: attachments.reduce((sum, file) => sum + (file.size || 0), 0),
        byType: {},
        byMovementType: {}
      };

      attachments.forEach(file => {
        // Estadísticas por tipo de archivo
        const extension = path.extname(file.originalName).toLowerCase();
        stats.byType[extension] = (stats.byType[extension] || 0) + 1;

        // Estadísticas por tipo de movimiento
        const movementType = file.movementType || 'general';
        stats.byMovementType[movementType] = (stats.byMovementType[movementType] || 0) + 1;
      });

      res.json({
        success: true,
        data: {
          stats: stats,
          employeeId: employeeId,
          period: { startDate, endDate }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        error: 'Error obteniendo estadísticas de archivos',
        details: error.message
      });
    }
  }
}

module.exports = AttachmentsController;