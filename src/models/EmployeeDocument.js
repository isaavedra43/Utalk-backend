const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');
const { FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');

/**
 * 📄 MODELO DE DOCUMENTO DE EMPLEADO
 * 
 * Gestiona documentos de empleados con versionado, categorización,
 * permisos de confidencialidad y auditoría completa.
 * 
 * @version 1.0.0
 * @author Backend Team
 */
class EmployeeDocument {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.employeeId = data.employeeId || null;
    
    // Información del archivo
    this.originalName = data.originalName || '';
    this.fileSize = data.fileSize || 0;
    this.mimeType = data.mimeType || '';
    this.category = data.category || 'other'; // 'contract' | 'id' | 'tax' | 'certification' | 'other'
    this.description = data.description || null;
    this.tags = data.tags || [];
    this.isConfidential = data.isConfidential || false;
    this.version = data.version || 1;
    
    // Fechas
    this.uploadedAt = data.uploadedAt || new Date().toISOString();
    this.expiresAt = data.expiresAt || null;
    
    // Almacenamiento
    this.storage = {
      provider: data.storage?.provider || 'firebase', // 'firebase' | 's3' | 'gcs' | 'local'
      bucket: data.storage?.bucket || null,
      key: data.storage?.key || null,
      path: data.storage?.path || null
    };
    
    // Seguridad
    this.checksum = data.checksum || null;
    
    // Usuario que subió el archivo
    this.uploader = {
      id: data.uploader?.id || null,
      email: data.uploader?.email || null,
      name: data.uploader?.name || null
    };
    
    // Auditoría
    this.audit = {
      createdBy: data.audit?.createdBy || null,
      createdAt: data.audit?.createdAt || new Date().toISOString(),
      deletedAt: data.audit?.deletedAt || null,
      deletedBy: data.audit?.deletedBy || null
    };
    
    // Metadatos adicionales
    this.metadata = data.metadata || {};
  }

  /**
   * Valida los datos del documento
   */
  validate() {
    const errors = [];

    // Validaciones requeridas
    if (!this.employeeId) {
      errors.push('El ID del empleado es requerido');
    }

    if (!this.originalName || this.originalName.length < 1) {
      errors.push('El nombre del archivo es requerido');
    }

    if (!this.mimeType) {
      errors.push('El tipo MIME es requerido');
    }

    if (!this.category) {
      errors.push('La categoría es requerida');
    }

    // Validar categoría
    const validCategories = ['contract', 'id', 'tax', 'certification', 'other'];
    if (!validCategories.includes(this.category)) {
      errors.push(`Categoría inválida. Debe ser una de: ${validCategories.join(', ')}`);
    }

    // Validar tamaño
    if (this.fileSize < 0) {
      errors.push('El tamaño del archivo debe ser mayor o igual a 0');
    }

    // Validar versión
    if (this.version < 1) {
      errors.push('La versión debe ser mayor o igual a 1');
    }

    // Validar tags
    if (!Array.isArray(this.tags)) {
      errors.push('Los tags deben ser un array');
    }

    return errors;
  }

  /**
   * Calcula el checksum SHA256 del archivo
   */
  static calculateChecksum(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Genera el siguiente número de versión para un documento
   */
  static async getNextVersion(employeeId, originalName) {
    try {
      const snapshot = await db.collection('employee_documents')
        .where('employeeId', '==', employeeId)
        .where('originalName', '==', originalName)
        .where('audit.deletedAt', '==', null)
        .orderBy('version', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) {
        return 1;
      }

      const lastDoc = snapshot.docs[0].data();
      return (lastDoc.version || 1) + 1;
    } catch (error) {
      console.error('Error getting next version:', error);
      return 1;
    }
  }

  /**
   * Convierte el modelo a objeto plano para Firebase
   */
  toFirestore() {
    return {
      id: this.id,
      employeeId: this.employeeId,
      originalName: this.originalName,
      fileSize: this.fileSize,
      mimeType: this.mimeType,
      category: this.category,
      description: this.description,
      tags: this.tags,
      isConfidential: this.isConfidential,
      version: this.version,
      uploadedAt: this.uploadedAt,
      expiresAt: this.expiresAt,
      storage: this.storage,
      checksum: this.checksum,
      uploader: this.uploader,
      audit: this.audit,
      metadata: this.metadata
    };
  }

  /**
   * Crea un documento desde datos de Firestore
   */
  static fromFirestore(doc) {
    return new EmployeeDocument({ id: doc.id, ...doc.data() });
  }

  /**
   * Guarda el documento en Firebase
   */
  async save() {
    try {
      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      // Verificar que el empleado existe
      const employee = await db.collection('employees').doc(this.employeeId).get();
      if (!employee.exists) {
        throw new Error('El empleado no existe');
      }

      // Generar versión si no existe
      if (!this.version || this.version === 1) {
        this.version = await EmployeeDocument.getNextVersion(this.employeeId, this.originalName);
      }

      const docRef = db.collection('employee_documents').doc(this.id);
      await docRef.set(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error saving employee document:', error);
      throw error;
    }
  }

  /**
   * Actualiza el documento
   */
  async update(data, updatedBy = null) {
    try {
      // Actualizar solo los campos permitidos
      if (data.description !== undefined) {
        this.description = data.description;
      }
      if (data.tags !== undefined) {
        this.tags = data.tags;
      }
      if (data.isConfidential !== undefined) {
        this.isConfidential = data.isConfidential;
      }
      if (data.expiresAt !== undefined) {
        this.expiresAt = data.expiresAt;
      }
      if (data.metadata !== undefined) {
        this.metadata = { ...this.metadata, ...data.metadata };
      }

      this.audit.updatedAt = new Date().toISOString();
      this.audit.updatedBy = updatedBy;

      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      const docRef = db.collection('employee_documents').doc(this.id);
      await docRef.update(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error updating employee document:', error);
      throw error;
    }
  }

  /**
   * Elimina el documento (soft delete)
   */
  async delete(deletedBy = null) {
    try {
      this.audit.deletedAt = new Date().toISOString();
      this.audit.deletedBy = deletedBy;

      const docRef = db.collection('employee_documents').doc(this.id);
      await docRef.update({
        'audit.deletedAt': this.audit.deletedAt,
        'audit.deletedBy': this.audit.deletedBy
      });

      return this;
    } catch (error) {
      console.error('Error deleting employee document:', error);
      throw error;
    }
  }

  /**
   * Busca un documento por ID
   */
  static async findById(id) {
    try {
      const doc = await db.collection('employee_documents').doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return EmployeeDocument.fromFirestore(doc);
    } catch (error) {
      console.error('Error finding document by ID:', error);
      throw error;
    }
  }

  /**
   * Lista documentos de un empleado con filtros y paginación
   */
  static async listByEmployee(employeeId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        category = '',
        confidential = null,
        sortBy = 'uploadedAt',
        sortOrder = 'desc'
      } = options;

      let query = db.collection('employee_documents')
        .where('employeeId', '==', employeeId)
        .where('audit.deletedAt', '==', null);

      // Filtro por categoría
      if (category) {
        query = query.where('category', '==', category);
      }

      // Filtro por confidencialidad
      if (confidential !== null) {
        query = query.where('isConfidential', '==', confidential);
      }

      // Ordenamiento
      query = query.orderBy(sortBy, sortOrder);

      // Paginación
      const offset = (page - 1) * limit;
      if (offset > 0) {
        const offsetSnapshot = await query.limit(offset).get();
        if (!offsetSnapshot.empty) {
          const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
          query = query.startAfter(lastDoc);
        }
      }

      query = query.limit(limit);

      const snapshot = await query.get();
      const documents = [];

      snapshot.forEach(doc => {
        const document = EmployeeDocument.fromFirestore(doc);
        
        // Filtro de búsqueda (se hace en memoria por limitaciones de Firestore)
        if (search) {
          const searchLower = search.toLowerCase();
          const originalName = (document.originalName || '').toLowerCase();
          const description = (document.description || '').toLowerCase();
          const tags = (document.tags || []).join(' ').toLowerCase();
          
          if (originalName.includes(searchLower) || 
              description.includes(searchLower) || 
              tags.includes(searchLower)) {
            documents.push(document);
          }
        } else {
          documents.push(document);
        }
      });

      // Obtener total para paginación
      let totalQuery = db.collection('employee_documents')
        .where('employeeId', '==', employeeId)
        .where('audit.deletedAt', '==', null);
      
      if (category) {
        totalQuery = totalQuery.where('category', '==', category);
      }
      if (confidential !== null) {
        totalQuery = totalQuery.where('isConfidential', '==', confidential);
      }

      const totalSnapshot = await totalQuery.get();
      const total = totalSnapshot.size;

      return {
        documents,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error listing employee documents:', error);
      throw error;
    }
  }

  /**
   * Obtiene resumen de documentos de un empleado
   */
  static async getSummaryByEmployee(employeeId) {
    try {
      const snapshot = await db.collection('employee_documents')
        .where('employeeId', '==', employeeId)
        .where('audit.deletedAt', '==', null)
        .get();

      const summary = {
        totalCount: 0,
        totalSizeBytes: 0,
        categories: {
          contract: 0,
          id: 0,
          tax: 0,
          certification: 0,
          other: 0
        },
        lastUploadAt: null
      };

      let lastUpload = null;

      snapshot.forEach(doc => {
        const document = doc.data();
        summary.totalCount++;
        summary.totalSizeBytes += document.fileSize || 0;
        
        if (summary.categories.hasOwnProperty(document.category)) {
          summary.categories[document.category]++;
        }

        const uploadDate = new Date(document.uploadedAt);
        if (!lastUpload || uploadDate > lastUpload) {
          lastUpload = uploadDate;
        }
      });

      summary.lastUploadAt = lastUpload ? lastUpload.toISOString() : null;

      return summary;
    } catch (error) {
      console.error('Error getting employee documents summary:', error);
      throw error;
    }
  }

  /**
   * Busca documentos por checksum (para detectar duplicados)
   */
  static async findByChecksum(checksum) {
    try {
      const snapshot = await db.collection('employee_documents')
        .where('checksum', '==', checksum)
        .where('audit.deletedAt', '==', null)
        .get();

      return snapshot.docs.map(doc => EmployeeDocument.fromFirestore(doc));
    } catch (error) {
      console.error('Error finding documents by checksum:', error);
      throw error;
    }
  }

  /**
   * Obtiene documentos que expiran pronto
   */
  static async getExpiringSoon(days = 30) {
    try {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + days);

      const snapshot = await db.collection('employee_documents')
        .where('expiresAt', '<=', expirationDate.toISOString())
        .where('expiresAt', '>', new Date().toISOString())
        .where('audit.deletedAt', '==', null)
        .get();

      return snapshot.docs.map(doc => EmployeeDocument.fromFirestore(doc));
    } catch (error) {
      console.error('Error getting expiring documents:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas globales de documentos
   */
  static async getGlobalStats() {
    try {
      const snapshot = await db.collection('employee_documents')
        .where('audit.deletedAt', '==', null)
        .get();

      const stats = {
        totalDocuments: 0,
        totalSizeBytes: 0,
        categories: {
          contract: 0,
          id: 0,
          tax: 0,
          certification: 0,
          other: 0
        },
        confidentialCount: 0,
        averageFileSize: 0
      };

      snapshot.forEach(doc => {
        const document = doc.data();
        stats.totalDocuments++;
        stats.totalSizeBytes += document.fileSize || 0;
        
        if (stats.categories.hasOwnProperty(document.category)) {
          stats.categories[document.category]++;
        }

        if (document.isConfidential) {
          stats.confidentialCount++;
        }
      });

      stats.averageFileSize = stats.totalDocuments > 0 
        ? Math.round(stats.totalSizeBytes / stats.totalDocuments) 
        : 0;

      return stats;
    } catch (error) {
      console.error('Error getting global document stats:', error);
      throw error;
    }
  }
}

module.exports = EmployeeDocument;