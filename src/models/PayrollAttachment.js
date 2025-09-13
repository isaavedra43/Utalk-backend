const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Modelo para archivos adjuntos de nómina
 */
class PayrollAttachment {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.payrollId = data.payrollId;
    this.employeeId = data.employeeId;
    this.fileName = data.fileName; // Nombre único en storage
    this.originalName = data.originalName; // Nombre original del archivo
    this.fileSize = data.fileSize;
    this.mimeType = data.mimeType;
    this.fileUrl = data.fileUrl;
    this.category = data.category || 'general'; // comprobante, recibo, documento, etc.
    this.description = data.description || '';
    this.uploadedBy = data.uploadedBy; // ID del usuario que subió
    this.uploadedAt = data.uploadedAt || new Date().toISOString();
    this.isActive = data.isActive !== undefined ? data.isActive : true;
  }

  /**
   * Guardar archivo adjunto en Firestore
   */
  async save() {
    try {
      const { db } = require('../config/firebase');
      const docRef = db.collection('payroll_attachments').doc(this.id);
      
      await docRef.set({
        id: this.id,
        payrollId: this.payrollId,
        employeeId: this.employeeId,
        fileName: this.fileName,
        originalName: this.originalName,
        fileSize: this.fileSize,
        mimeType: this.mimeType,
        fileUrl: this.fileUrl,
        category: this.category,
        description: this.description,
        uploadedBy: this.uploadedBy,
        uploadedAt: this.uploadedAt,
        isActive: this.isActive
      });

      logger.info('✅ Archivo adjunto guardado', {
        attachmentId: this.id,
        payrollId: this.payrollId,
        fileName: this.originalName
      });

      return this;
    } catch (error) {
      logger.error('❌ Error guardando archivo adjunto', error);
      throw error;
    }
  }

  /**
   * Eliminar archivo adjunto (soft delete)
   */
  async delete() {
    try {
      const { db } = require('../config/firebase');
      const docRef = db.collection('payroll_attachments').doc(this.id);
      
      await docRef.update({
        isActive: false,
        deletedAt: new Date().toISOString()
      });

      logger.info('✅ Archivo adjunto eliminado', {
        attachmentId: this.id,
        payrollId: this.payrollId
      });

      return true;
    } catch (error) {
      logger.error('❌ Error eliminando archivo adjunto', error);
      throw error;
    }
  }

  /**
   * Buscar archivos adjuntos por nómina
   */
  static async findByPayroll(payrollId) {
    try {
      const { db } = require('../config/firebase');
      const snapshot = await db.collection('payroll_attachments')
        .where('payrollId', '==', payrollId)
        .where('isActive', '==', true)
        .orderBy('uploadedAt', 'desc')
        .get();

      const attachments = [];
      snapshot.forEach(doc => {
        attachments.push(new PayrollAttachment(doc.data()));
      });

      logger.info('📎 Archivos adjuntos encontrados', {
        payrollId,
        count: attachments.length
      });

      return attachments;
    } catch (error) {
      logger.error('❌ Error buscando archivos adjuntos', error);
      throw error;
    }
  }

  /**
   * Buscar archivo adjunto por ID
   */
  static async findById(attachmentId) {
    try {
      const { db } = require('../config/firebase');
      const doc = await db.collection('payroll_attachments').doc(attachmentId).get();
      
      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      if (!data.isActive) {
        return null;
      }

      return new PayrollAttachment(data);
    } catch (error) {
      logger.error('❌ Error buscando archivo adjunto por ID', error);
      throw error;
    }
  }

  /**
   * Validar tipo de archivo permitido
   */
  static isValidFileType(mimeType) {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    return allowedTypes.includes(mimeType);
  }

  /**
   * Validar tamaño de archivo (máximo 10MB)
   */
  static isValidFileSize(fileSize) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    return fileSize <= maxSize;
  }

  /**
   * Generar nombre único para archivo
   */
  static generateUniqueFileName(originalName, payrollId) {
    const timestamp = Date.now();
    const extension = originalName.split('.').pop();
    const baseName = originalName.replace(`.${extension}`, '').replace(/[^a-zA-Z0-9]/g, '_');
    
    return `payroll_${payrollId}_${baseName}_${timestamp}.${extension}`;
  }

  /**
   * Obtener información del archivo para respuesta
   */
  getInfo() {
    return {
      id: this.id,
      fileName: this.fileName,
      originalName: this.originalName,
      fileSize: this.fileSize,
      mimeType: this.mimeType,
      fileUrl: this.fileUrl,
      category: this.category,
      description: this.description,
      uploadedAt: this.uploadedAt
    };
  }
}

module.exports = PayrollAttachment;
