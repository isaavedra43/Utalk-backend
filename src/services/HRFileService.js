const { Storage } = require('@google-cloud/storage');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const EmployeeDocument = require('../models/EmployeeDocument');
const EmployeeHistory = require('../models/EmployeeHistory');

/**
 * Servicio de Gestión de Archivos para Recursos Humanos
 * Maneja subida, almacenamiento y gestión de documentos de empleados
 */
class HRFileService {
  constructor() {
    // Configuración de Google Cloud Storage
    this.storage = new Storage({
      projectId: process.env.FIREBASE_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });
    
    this.bucketName = process.env.HR_FILES_BUCKET || `${process.env.FIREBASE_PROJECT_ID}-hr-files`;
    this.bucket = this.storage.bucket(this.bucketName);
    
    // Configuraciones por categoría de documento
    this.documentConfigs = EmployeeDocument.getDocumentConfigs();
  }

  /**
   * Sube un archivo de empleado
   */
  async uploadEmployeeDocument(file, employeeId, category, metadata = {}, uploadedBy = null) {
    try {
      // Validar archivo
      const validation = this.validateFile(file, category);
      if (!validation.isValid) {
        throw new Error(`Archivo inválido: ${validation.errors.join(', ')}`);
      }

      // Generar nombre único
      const fileName = this.generateUniqueFileName(file.originalname, employeeId, category);
      
      // Configurar metadatos
      const fileMetadata = {
        contentType: file.mimetype,
        metadata: {
          employeeId,
          category,
          originalName: file.originalname,
          uploadedBy: uploadedBy || 'system',
          uploadedAt: new Date().toISOString(),
          ...metadata
        }
      };

      // Subir archivo a Google Cloud Storage
      const fileUpload = this.bucket.file(fileName);
      const stream = fileUpload.createWriteStream({
        metadata: fileMetadata,
        resumable: false
      });

      return new Promise((resolve, reject) => {
        stream.on('error', (error) => {
          console.error('Error uploading file:', error);
          reject(new Error('Error al subir archivo'));
        });

        stream.on('finish', async () => {
          try {
            // Hacer el archivo público si no es confidencial
            if (!metadata.isConfidential) {
              await fileUpload.makePublic();
            }

            // Obtener URL pública
            const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${fileName}`;

            // Crear registro en base de datos
            const document = new EmployeeDocument({
              employeeId,
              fileName,
              originalName: file.originalname,
              fileSize: file.size,
              mimeType: file.mimetype,
              fileUrl: publicUrl,
              category,
              description: metadata.description || null,
              tags: metadata.tags || [],
              isConfidential: metadata.isConfidential || false,
              uploadedBy,
              expiresAt: metadata.expiresAt || null
            });

            await document.save();

            // Registrar en historial
            await EmployeeHistory.createHistoryRecord(
              employeeId,
              'document_uploaded',
              `Documento subido: ${file.originalname}`,
              {
                documentId: document.id,
                fileName: file.originalname,
                category,
                fileSize: file.size
              },
              uploadedBy
            );

            resolve({
              document,
              fileUrl: publicUrl,
              fileName
            });
          } catch (error) {
            console.error('Error saving document record:', error);
            reject(error);
          }
        });

        stream.end(file.buffer);
      });
    } catch (error) {
      console.error('Error in uploadEmployeeDocument:', error);
      throw error;
    }
  }

  /**
   * Elimina un documento de empleado
   */
  async deleteEmployeeDocument(documentId, deletedBy = null) {
    try {
      // Buscar documento en base de datos
      const document = await EmployeeDocument.findById(documentId.split('/')[0], documentId);
      if (!document) {
        throw new Error('Documento no encontrado');
      }

      // Eliminar archivo de Google Cloud Storage
      const file = this.bucket.file(document.fileName);
      const [exists] = await file.exists();
      
      if (exists) {
        await file.delete();
      }

      // Eliminar registro de base de datos
      await document.delete();

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        document.employeeId,
        'document_uploaded',
        `Documento eliminado: ${document.originalName}`,
        {
          documentId: document.id,
          fileName: document.originalName,
          category: document.category,
          action: 'delete'
        },
        deletedBy
      );

      return { success: true, message: 'Documento eliminado exitosamente' };
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Genera URL firmada para acceso temporal
   */
  async generateSignedUrl(documentId, expiresIn = 3600) {
    try {
      const document = await EmployeeDocument.findById(documentId.split('/')[0], documentId);
      if (!document) {
        throw new Error('Documento no encontrado');
      }

      const file = this.bucket.file(document.fileName);
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresIn * 1000
      });

      return signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw error;
    }
  }

  /**
   * Obtiene información de un archivo
   */
  async getFileInfo(fileName) {
    try {
      const file = this.bucket.file(fileName);
      const [metadata] = await file.getMetadata();
      
      return {
        name: metadata.name,
        size: metadata.size,
        contentType: metadata.contentType,
        created: metadata.timeCreated,
        updated: metadata.updated,
        metadata: metadata.metadata || {}
      };
    } catch (error) {
      console.error('Error getting file info:', error);
      throw error;
    }
  }

  /**
   * Crea una nueva versión de un documento existente
   */
  async createDocumentVersion(originalDocumentId, newFile, uploadedBy = null) {
    try {
      const originalDocument = await EmployeeDocument.findById(
        originalDocumentId.split('/')[0], 
        originalDocumentId
      );
      
      if (!originalDocument) {
        throw new Error('Documento original no encontrado');
      }

      // Subir nueva versión
      const result = await this.uploadEmployeeDocument(
        newFile,
        originalDocument.employeeId,
        originalDocument.category,
        {
          description: originalDocument.description,
          tags: originalDocument.tags,
          isConfidential: originalDocument.isConfidential,
          previousVersionId: originalDocument.id
        },
        uploadedBy
      );

      // Actualizar versión en el documento
      await result.document.update({
        version: originalDocument.version + 1,
        previousVersionId: originalDocument.id
      });

      return result;
    } catch (error) {
      console.error('Error creating document version:', error);
      throw error;
    }
  }

  /**
   * Comprime archivos para descarga masiva
   */
  async createArchive(documentIds, archiveName = 'documents.zip') {
    try {
      const archiver = require('archiver');
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      // TODO: Implementar compresión de archivos
      // Esto requiere descargar archivos de GCS y comprimirlos
      
      throw new Error('Funcionalidad de archivo comprimido en desarrollo');
    } catch (error) {
      console.error('Error creating archive:', error);
      throw error;
    }
  }

  /**
   * Escanea archivos en busca de virus (integración con servicio externo)
   */
  async scanFileForVirus(file) {
    try {
      // TODO: Integrar con servicio de escaneo de virus como ClamAV
      // Por ahora, solo verificar extensiones peligrosas
      
      const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      if (dangerousExtensions.includes(fileExtension)) {
        return {
          isClean: false,
          threat: 'Extensión de archivo potencialmente peligrosa'
        };
      }

      return { isClean: true, threat: null };
    } catch (error) {
      console.error('Error scanning file:', error);
      return { isClean: false, threat: 'Error al escanear archivo' };
    }
  }

  /**
   * Valida un archivo según su categoría
   */
  validateFile(file, category) {
    const errors = [];
    const config = this.documentConfigs[category];

    if (!config) {
      return { isValid: false, errors: ['Categoría de documento no válida'] };
    }

    // Validar tamaño
    if (file.size > config.maxFileSize) {
      errors.push(`El archivo excede el tamaño máximo permitido (${this.formatFileSize(config.maxFileSize)})`);
    }

    // Validar tipo MIME
    if (!config.allowedTypes.includes(file.mimetype)) {
      errors.push(`Tipo de archivo no permitido. Tipos válidos: ${config.allowedExtensions.join(', ')}`);
    }

    // Validar extensión
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (!config.allowedExtensions.includes(fileExtension)) {
      errors.push(`Extensión de archivo no permitida. Extensiones válidas: ${config.allowedExtensions.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Genera nombre único para archivo
   */
  generateUniqueFileName(originalName, employeeId, category) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(6).toString('hex');
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    
    return `employees/${employeeId}/${category}/${timestamp}_${random}_${baseName}${extension}`;
  }

  /**
   * Formatea tamaño de archivo para mostrar
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Obtiene estadísticas de almacenamiento
   */
  async getStorageStats(employeeId = null) {
    try {
      let query = this.bucket.getFiles();
      
      if (employeeId) {
        query = this.bucket.getFiles({
          prefix: `employees/${employeeId}/`
        });
      }

      const [files] = await query;
      
      const stats = {
        totalFiles: files.length,
        totalSize: 0,
        byCategory: {},
        byEmployee: {}
      };

      for (const file of files) {
        const [metadata] = await file.getMetadata();
        const size = parseInt(metadata.size) || 0;
        
        stats.totalSize += size;
        
        // Extraer categoría del path
        const pathParts = file.name.split('/');
        if (pathParts.length >= 3) {
          const category = pathParts[2];
          const empId = pathParts[1];
          
          stats.byCategory[category] = (stats.byCategory[category] || 0) + size;
          stats.byEmployee[empId] = (stats.byEmployee[empId] || 0) + size;
        }
      }

      return stats;
    } catch (error) {
      console.error('Error getting storage stats:', error);
      throw error;
    }
  }

  /**
   * Limpia archivos expirados
   */
  async cleanupExpiredFiles() {
    try {
      const now = new Date();
      let cleanedCount = 0;
      let cleanedSize = 0;

      // TODO: Implementar lógica para buscar documentos expirados en Firebase
      // y eliminar sus archivos correspondientes de GCS
      
      console.log(`Cleanup completed: ${cleanedCount} files removed, ${this.formatFileSize(cleanedSize)} freed`);
      
      return {
        cleanedCount,
        cleanedSize: this.formatFileSize(cleanedSize)
      };
    } catch (error) {
      console.error('Error cleaning up expired files:', error);
      throw error;
    }
  }

  /**
   * Migra archivos entre buckets
   */
  async migrateFiles(sourceBucket, targetBucket, employeeId = null) {
    try {
      // TODO: Implementar migración de archivos
      throw new Error('Funcionalidad de migración en desarrollo');
    } catch (error) {
      console.error('Error migrating files:', error);
      throw error;
    }
  }

  /**
   * Crea backup de documentos de un empleado
   */
  async backupEmployeeDocuments(employeeId) {
    try {
      const documents = await EmployeeDocument.listByEmployee(employeeId, { limit: 1000 });
      
      const backupInfo = {
        employeeId,
        timestamp: new Date().toISOString(),
        totalDocuments: documents.length,
        categories: {},
        files: []
      };

      for (const document of documents) {
        backupInfo.categories[document.category] = (backupInfo.categories[document.category] || 0) + 1;
        backupInfo.files.push({
          id: document.id,
          fileName: document.fileName,
          originalName: document.originalName,
          category: document.category,
          uploadedAt: document.uploadedAt
        });
      }

      // TODO: Crear archivo de backup físico
      
      return backupInfo;
    } catch (error) {
      console.error('Error backing up employee documents:', error);
      throw error;
    }
  }

  /**
   * Valida integridad de archivos
   */
  async validateFileIntegrity(documentId) {
    try {
      const document = await EmployeeDocument.findById(documentId.split('/')[0], documentId);
      if (!document) {
        throw new Error('Documento no encontrado');
      }

      const file = this.bucket.file(document.fileName);
      const [exists] = await file.exists();
      
      if (!exists) {
        return {
          isValid: false,
          error: 'Archivo físico no encontrado en almacenamiento'
        };
      }

      const [metadata] = await file.getMetadata();
      
      // Verificar que el tamaño coincida
      if (parseInt(metadata.size) !== document.fileSize) {
        return {
          isValid: false,
          error: 'El tamaño del archivo no coincide con el registro'
        };
      }

      return {
        isValid: true,
        metadata: {
          size: metadata.size,
          contentType: metadata.contentType,
          created: metadata.timeCreated,
          updated: metadata.updated
        }
      };
    } catch (error) {
      console.error('Error validating file integrity:', error);
      return {
        isValid: false,
        error: error.message
      };
    }
  }
}

module.exports = HRFileService;
