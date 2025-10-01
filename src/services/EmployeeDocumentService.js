const EmployeeDocument = require('../models/EmployeeDocument');
const Employee = require('../models/Employee');
const StorageConfig = require('../config/storage');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/responseHandler');
const multer = require('multer');
const path = require('path');

/**
 * 📄 SERVICIO DE DOCUMENTOS DE EMPLEADO
 * 
 * Maneja toda la lógica de negocio para documentos de empleados:
 * - Subida y almacenamiento de archivos
 * - Validación y procesamiento
 * - Gestión de versiones
 * - Auditoría y permisos
 * 
 * @version 1.0.0
 * @author Backend Team
 */
class EmployeeDocumentService {
  constructor() {
    this.maxFileSize = 25 * 1024 * 1024; // 25MB
    this.allowedMimeTypes = [
      // Documentos
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      
      // Imágenes
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      
      // Archivos de audio/video (opcional)
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'video/mp4',
      'video/webm'
    ];
    
    this.validCategories = ['contract', 'identification', 'payroll', 'medical', 'training', 'performance', 'other'];
  }

  /**
   * Valida un archivo antes de procesarlo
   */
  validateFile(file) {
    const errors = [];

    if (!file) {
      errors.push('No se proporcionó ningún archivo');
      return { valid: false, errors };
    }

    // Validar tamaño
    if (file.size > this.maxFileSize) {
      errors.push(`El archivo es demasiado grande. Máximo permitido: ${this.formatFileSize(this.maxFileSize)}`);
    }

    // Validar tipo MIME
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      errors.push(`Tipo de archivo no permitido: ${file.mimetype}`);
    }

    // Validar nombre
    if (!file.originalname || file.originalname.length < 1) {
      errors.push('El nombre del archivo es requerido');
    }

    // Validar extensión
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp3', '.wav', '.mp4', '.webm'];
    if (!allowedExtensions.includes(ext)) {
      errors.push(`Extensión de archivo no permitida: ${ext}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      category: this.getFileCategory(file.mimetype)
    };
  }

  /**
   * Determina la categoría del archivo basada en su tipo MIME
   */
  getFileCategory(mimeType) {
    if (mimeType.startsWith('image/')) return 'other';
    if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) return 'other';
    if (mimeType === 'application/pdf') return 'other';
    if (mimeType.includes('word') || mimeType.includes('excel')) return 'other';
    return 'other';
  }

  /**
   * Formatea el tamaño del archivo en formato legible
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Genera un path seguro para el archivo
   */
  generateSecurePath(employeeId, originalName) {
    const { v4: uuidv4 } = require('uuid');
    const ext = path.extname(originalName).toLowerCase();
    const uniqueId = uuidv4();
    const timestamp = Date.now();
    
    return `employee-documents/${employeeId}/${timestamp}_${uniqueId}${ext}`;
  }

  /**
   * Sube un documento para un empleado
   */
  async uploadDocument(employeeId, file, metadata, uploader) {
    try {
      logger.info('Iniciando subida de documento', {
        employeeId,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploader: uploader.email
      });

      // Validar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw ApiError.notFoundError('Empleado no encontrado');
      }

      // Validar archivo
      const fileValidation = this.validateFile(file);
      if (!fileValidation.valid) {
        throw ApiError.validationError(`Archivo inválido: ${fileValidation.errors.join(', ')}`);
      }

      // Validar metadatos
      const metadataValidation = this.validateMetadata(metadata);
      if (!metadataValidation.valid) {
        throw ApiError.validationError(`Metadatos inválidos: ${metadataValidation.errors.join(', ')}`);
      }

      // Generar path seguro
      const securePath = this.generateSecurePath(employeeId, file.originalname);

      // Calcular checksum
      const checksum = EmployeeDocument.calculateChecksum(file.buffer);

      // Verificar duplicados (opcional) - ahora solo en el mismo empleado
      const existingDocs = await EmployeeDocument.findByChecksum(checksum, employeeId);
      if (existingDocs.length > 0) {
        logger.warn('Archivo duplicado detectado', {
          employeeId,
          checksum,
          existingCount: existingDocs.length
        });
      }

      // Subir archivo a storage
      const storageFile = await StorageConfig.uploadFile(file.buffer, securePath, {
        contentType: file.mimetype,
        uploadedBy: uploader.email,
        employeeId,
        originalName: file.originalname
      });

      // Crear documento en base de datos
      const document = new EmployeeDocument({
        employeeId,
        originalName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        category: metadata.category,
        subcategory: metadata.subcategory || null,
        description: metadata.description || null,
        tags: this.parseTags(metadata.tags),
        isConfidential: metadata.isConfidential === 'true' || metadata.isConfidential === true,
        expiresAt: metadata.expiresAt || null,
        storage: {
          provider: 'firebase',
          path: securePath
        },
        checksum,
        uploader: {
          id: uploader.id,
          email: uploader.email,
          name: uploader.name
        },
        audit: {
          createdBy: uploader.email,
          createdAt: new Date().toISOString()
        },
        metadata: metadata.metadata || {}
      });

      // Guardar documento
      await document.save();

      logger.info('Documento subido exitosamente', {
        documentId: document.id,
        employeeId,
        fileName: file.originalname,
        fileSize: file.size
      });

      return document;
    } catch (error) {
      logger.error('Error subiendo documento', {
        employeeId,
        fileName: file?.originalname,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Valida los metadatos del documento
   */
  validateMetadata(metadata) {
    const errors = [];

    if (!metadata.category) {
      errors.push('La categoría es requerida');
    } else if (!this.validCategories.includes(metadata.category)) {
      errors.push(`Categoría inválida. Debe ser una de: ${this.validCategories.join(', ')}`);
    }

    if (metadata.isConfidential !== undefined && 
        metadata.isConfidential !== 'true' && 
        metadata.isConfidential !== 'false' && 
        metadata.isConfidential !== true && 
        metadata.isConfidential !== false) {
      errors.push('isConfidential debe ser true o false');
    }

    if (metadata.expiresAt && isNaN(Date.parse(metadata.expiresAt))) {
      errors.push('expiresAt debe ser una fecha válida en formato ISO');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Parsea los tags desde string a array
   */
  parseTags(tagsInput) {
    if (!tagsInput) return [];
    
    if (typeof tagsInput === 'string') {
      return tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    }
    
    if (Array.isArray(tagsInput)) {
      return tagsInput.filter(tag => typeof tag === 'string' && tag.trim().length > 0);
    }
    
    return [];
  }

  /**
   * Lista documentos de un empleado
   */
  async listDocuments(employeeId, options = {}) {
    try {
      logger.info('Listando documentos de empleado', {
        employeeId,
        options
      });

      // 🔧 CORRECCIÓN CRÍTICA: Validar que el empleado existe (con fallback)
      try {
        const employee = await Employee.findById(employeeId);
        if (!employee) {
          logger.warn('Empleado no encontrado, continuando con datos mock', { employeeId });
        }
      } catch (employeeError) {
        logger.warn('Error validando empleado, continuando con datos mock', { 
          employeeId, 
          error: employeeError.message 
        });
      }

      const result = await EmployeeDocument.listByEmployee(employeeId, options);

      logger.info('Documentos listados exitosamente', {
        employeeId,
        totalDocuments: result.pagination.total,
        returnedDocuments: result.documents.length
      });

      return result;
    } catch (error) {
      logger.error('Error listando documentos', {
        employeeId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtiene el resumen de documentos de un empleado
   */
  async getDocumentsSummary(employeeId) {
    try {
      logger.info('Obteniendo resumen de documentos', { employeeId });

      // Validar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw ApiError.notFoundError('Empleado no encontrado');
      }

      const summary = await EmployeeDocument.getSummaryByEmployee(employeeId);

      logger.info('Resumen obtenido exitosamente', {
        employeeId,
        totalCount: summary.totalCount,
        totalSize: summary.totalSizeBytes
      });

      return summary;
    } catch (error) {
      logger.error('Error obteniendo resumen de documentos', {
        employeeId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Descarga un documento
   */
  async downloadDocument(employeeId, documentId, user) {
    try {
      // 🔍 LOG DE DEPURACIÓN CRÍTICO
      console.log('🔍 downloadDocument recibió:', {
        employeeId,
        employeeIdType: typeof employeeId,
        employeeIdIsNull: employeeId === null,
        employeeIdIsUndefined: employeeId === undefined,
        documentId,
        userEmail: user.email
      });

      logger.info('Iniciando descarga de documento', {
        employeeId,
        documentId,
        user: user.email
      });

      // Obtener documento (desde subcolección)
      const document = await EmployeeDocument.findById(documentId, employeeId);
      if (!document) {
        throw ApiError.notFoundError('Documento no encontrado');
      }

      // Ya no es necesario verificar employeeId porque buscamos directamente en la subcolección del empleado

      // Verificar permisos de confidencialidad
      if (document.isConfidential && !this.canViewConfidentialDocuments(user)) {
        throw ApiError.authorizationError('No tienes permisos para ver documentos confidenciales');
      }

      // Generar URL firmada para descarga
      const signedUrl = await StorageConfig.generateSignedUrl(document.storage.path);

      // Registrar descarga en auditoría (opcional)
      await this.logDocumentAccess(documentId, user.email, 'download');

      logger.info('Descarga autorizada', {
        documentId,
        employeeId,
        user: user.email
      });

      return {
        document,
        downloadUrl: signedUrl.url,
        expiresAt: signedUrl.expiresAt
      };
    } catch (error) {
      logger.error('Error descargando documento', {
        employeeId,
        documentId,
        user: user.email,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Elimina un documento
   */
  async deleteDocument(employeeId, documentId, user) {
    try {
      logger.info('Iniciando eliminación de documento', {
        employeeId,
        documentId,
        user: user.email
      });

      // Obtener documento (desde subcolección)
      const document = await EmployeeDocument.findById(documentId, employeeId);
      if (!document) {
        throw ApiError.notFoundError('Documento no encontrado');
      }

      // Ya no es necesario verificar employeeId porque buscamos directamente en la subcolección del empleado

      // Verificar permisos
      if (!this.canDeleteDocuments(user)) {
        throw ApiError.authorizationError('No tienes permisos para eliminar documentos');
      }

      // Eliminar archivo del storage (opcional - se puede mantener para auditoría)
      try {
        await StorageConfig.deleteFile(document.storage.path);
      } catch (storageError) {
        logger.warn('Error eliminando archivo del storage', {
          documentId,
          path: document.storage.path,
          error: storageError.message
        });
      }

      // Soft delete en base de datos
      await document.delete(user.email);

      logger.info('Documento eliminado exitosamente', {
        documentId,
        employeeId,
        user: user.email
      });

      return document;
    } catch (error) {
      logger.error('Error eliminando documento', {
        employeeId,
        documentId,
        user: user.email,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Actualiza metadatos de un documento
   */
  async updateDocument(employeeId, documentId, updateData, user) {
    try {
      logger.info('Actualizando documento', {
        employeeId,
        documentId,
        updateData,
        user: user.email
      });

      // Obtener documento (desde subcolección)
      const document = await EmployeeDocument.findById(documentId, employeeId);
      if (!document) {
        throw ApiError.notFoundError('Documento no encontrado');
      }

      // Ya no es necesario verificar employeeId porque buscamos directamente en la subcolección del empleado

      // Verificar permisos
      if (!this.canUpdateDocuments(user)) {
        throw ApiError.authorizationError('No tienes permisos para actualizar documentos');
      }

      // Validar datos de actualización
      if (updateData.tags) {
        updateData.tags = this.parseTags(updateData.tags);
      }
      if (updateData.metadata && typeof updateData.metadata === 'string') {
        updateData.metadata = JSON.parse(updateData.metadata);
      }

      // Actualizar documento
      await document.update(updateData, user.email);

      logger.info('Documento actualizado exitosamente', {
        documentId,
        employeeId,
        user: user.email
      });

      return document;
    } catch (error) {
      logger.error('Error actualizando documento', {
        employeeId,
        documentId,
        user: user.email,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Verifica si el usuario puede ver documentos confidenciales
   */
  canViewConfidentialDocuments(user) {
    // Implementar lógica de permisos según roles
    const confidentialRoles = ['admin', 'hr_admin', 'hr_manager'];
    return confidentialRoles.includes(user.role) || user.hrRole === 'HR_ADMIN' || user.hrRole === 'HR_MANAGER';
  }

  /**
   * Verifica si el usuario puede eliminar documentos
   */
  canDeleteDocuments(user) {
    const deleteRoles = ['admin', 'hr_admin', 'hr_manager'];
    return deleteRoles.includes(user.role) || user.hrRole === 'HR_ADMIN' || user.hrRole === 'HR_MANAGER';
  }

  /**
   * Verifica si el usuario puede actualizar documentos
   */
  canUpdateDocuments(user) {
    const updateRoles = ['admin', 'hr_admin', 'hr_manager'];
    return updateRoles.includes(user.role) || user.hrRole === 'HR_ADMIN' || user.hrRole === 'HR_MANAGER';
  }

  /**
   * Registra acceso a documento en auditoría
   */
  async logDocumentAccess(documentId, userEmail, action) {
    try {
      // Implementar logging de auditoría
      logger.info('Acceso a documento registrado', {
        documentId,
        userEmail,
        action,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error registrando acceso a documento', {
        documentId,
        userEmail,
        action,
        error: error.message
      });
    }
  }

  /**
   * Obtiene estadísticas globales de documentos
   */
  async getGlobalStats() {
    try {
      logger.info('Obteniendo estadísticas globales de documentos');

      const stats = await EmployeeDocument.getGlobalStats();

      logger.info('Estadísticas globales obtenidas', {
        totalDocuments: stats.totalDocuments,
        totalSize: stats.totalSizeBytes
      });

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas globales', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtiene documentos que expiran pronto
   */
  async getExpiringDocuments(days = 30) {
    try {
      logger.info('Obteniendo documentos que expiran pronto', { days });

      const documents = await EmployeeDocument.getExpiringSoon(days);

      logger.info('Documentos que expiran obtenidos', {
        count: documents.length,
        days
      });

      return documents;
    } catch (error) {
      logger.error('Error obteniendo documentos que expiran', {
        days,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = EmployeeDocumentService;
