const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const PayrollAttachment = require('../models/PayrollAttachment');
const logger = require('../utils/logger');

/**
 * Servicio para gestión de archivos adjuntos de nómina
 */
class AttachmentService {
  constructor() {
    this.storage = new Storage();
    this.bucketName = process.env.GOOGLE_CLOUD_BUCKET || 'utalk-attachments';
    
    // Configurar multer para subida de archivos
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB máximo
      },
      fileFilter: (req, file, cb) => {
        if (PayrollAttachment.isValidFileType(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Tipo de archivo no permitido'), false);
        }
      }
    });
  }

  /**
   * Subir archivo adjunto a nómina
   */
  async uploadAttachment(payrollId, employeeId, file, uploadedBy, options = {}) {
    try {
      logger.info('📎 Subiendo archivo adjunto', {
        payrollId,
        employeeId,
        originalName: file.originalname,
        size: file.size
      });

      // Validar archivo
      if (!PayrollAttachment.isValidFileType(file.mimetype)) {
        throw new Error('Tipo de archivo no permitido');
      }

      if (!PayrollAttachment.isValidFileSize(file.size)) {
        throw new Error('Archivo demasiado grande (máximo 10MB)');
      }

      // Generar nombre único
      const uniqueFileName = PayrollAttachment.generateUniqueFileName(
        file.originalname, 
        payrollId
      );

      // Subir a Google Cloud Storage
      const fileUrl = await this.uploadToStorage(file.buffer, uniqueFileName);

      // Crear registro en base de datos
      const attachment = new PayrollAttachment({
        payrollId,
        employeeId,
        fileName: uniqueFileName,
        originalName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileUrl,
        category: options.category || 'general',
        description: options.description || '',
        uploadedBy
      });

      await attachment.save();

      logger.info('✅ Archivo adjunto subido exitosamente', {
        attachmentId: attachment.id,
        fileName: uniqueFileName,
        fileUrl
      });

      return attachment.getInfo();
    } catch (error) {
      logger.error('❌ Error subiendo archivo adjunto', error);
      throw error;
    }
  }

  /**
   * Subir archivo a Google Cloud Storage
   */
  async uploadToStorage(buffer, fileName) {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(`payroll-attachments/${fileName}`);
      
      await file.save(buffer, {
        metadata: {
          contentType: this.getContentType(fileName),
          metadata: {
            uploadedAt: new Date().toISOString(),
            service: 'utalk-payroll'
          }
        }
      });

      // Hacer el archivo público
      await file.makePublic();

      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/payroll-attachments/${fileName}`;
      
      logger.info('📤 Archivo subido a Google Cloud Storage', {
        fileName,
        publicUrl,
        size: buffer.length
      });

      return publicUrl;
    } catch (error) {
      logger.error('❌ Error subiendo archivo a storage', error);
      throw error;
    }
  }

  /**
   * Obtener archivos adjuntos de una nómina
   */
  async getAttachmentsByPayroll(payrollId) {
    try {
      const attachments = await PayrollAttachment.findByPayroll(payrollId);
      
      logger.info('📎 Archivos adjuntos obtenidos', {
        payrollId,
        count: attachments.length
      });

      return attachments.map(attachment => attachment.getInfo());
    } catch (error) {
      logger.error('❌ Error obteniendo archivos adjuntos', error);
      throw error;
    }
  }

  /**
   * Eliminar archivo adjunto
   */
  async deleteAttachment(attachmentId, payrollId) {
    try {
      const attachment = await PayrollAttachment.findById(attachmentId);
      
      if (!attachment) {
        throw new Error('Archivo adjunto no encontrado');
      }

      if (attachment.payrollId !== payrollId) {
        throw new Error('El archivo no pertenece a esta nómina');
      }

      // Eliminar de base de datos (soft delete)
      await attachment.delete();

      // Opcional: Eliminar del storage también
      // await this.deleteFromStorage(attachment.fileName);

      logger.info('✅ Archivo adjunto eliminado', {
        attachmentId,
        payrollId
      });

      return true;
    } catch (error) {
      logger.error('❌ Error eliminando archivo adjunto', error);
      throw error;
    }
  }

  /**
   * Eliminar archivo del storage
   */
  async deleteFromStorage(fileName) {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(`payroll-attachments/${fileName}`);
      
      await file.delete();
      
      logger.info('🗑️ Archivo eliminado del storage', { fileName });
    } catch (error) {
      logger.error('❌ Error eliminando archivo del storage', error);
      // No lanzar error para no afectar la eliminación de la BD
    }
  }

  /**
   * Obtener content type por extensión
   */
  getContentType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const contentTypes = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Middleware para subida de archivos
   */
  getUploadMiddleware() {
    return this.upload.single('file');
  }

  /**
   * Middleware para manejo de errores de multer
   */
  handleUploadError(error, req, res, next) {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'Archivo demasiado grande (máximo 10MB)'
        });
      }
    }
    
    if (error.message === 'Tipo de archivo no permitido') {
      return res.status(400).json({
        success: false,
        error: 'Tipo de archivo no permitido'
      });
    }
    
    next(error);
  }
}

module.exports = new AttachmentService();
