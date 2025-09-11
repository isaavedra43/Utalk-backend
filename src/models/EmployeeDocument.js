const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo de Documento de Empleado
 * Gestiona los archivos y documentos asociados a empleados
 */
class EmployeeDocument {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.employeeId = data.employeeId || '';
    this.fileName = data.fileName || '';
    this.originalName = data.originalName || '';
    this.fileSize = data.fileSize || 0;
    this.mimeType = data.mimeType || '';
    this.fileUrl = data.fileUrl || '';
    this.category = data.category || 'other'; // 'contract' | 'identification' | 'medical' | 'academic' | 'performance' | 'disciplinary' | 'personal' | 'other'
    this.description = data.description || null;
    this.tags = data.tags || [];
    this.isConfidential = data.isConfidential || false;
    this.uploadedBy = data.uploadedBy || null;
    this.uploadedAt = data.uploadedAt || new Date().toISOString();
    this.expiresAt = data.expiresAt || null;
    this.version = data.version || 1;
    this.previousVersionId = data.previousVersionId || null;
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Obtiene la configuración para cada categoría de documento
   */
  static getDocumentConfigs() {
    return {
      contract: {
        name: 'Contratos',
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'],
        retentionPeriod: 7 * 365, // 7 años
        isRequired: true
      },
      identification: {
        name: 'Identificación',
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
        retentionPeriod: 3 * 365, // 3 años
        isRequired: true
      },
      medical: {
        name: 'Médicos',
        maxFileSize: 20 * 1024 * 1024, // 20MB
        allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
        retentionPeriod: 5 * 365, // 5 años
        isRequired: false
      },
      academic: {
        name: 'Académicos',
        maxFileSize: 15 * 1024 * 1024, // 15MB
        allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
        retentionPeriod: 10 * 365, // 10 años
        isRequired: false
      },
      performance: {
        name: 'Desempeño',
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        allowedExtensions: ['.pdf', '.doc', '.docx'],
        retentionPeriod: 5 * 365, // 5 años
        isRequired: false
      },
      disciplinary: {
        name: 'Disciplinarios',
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        allowedExtensions: ['.pdf', '.doc', '.docx'],
        retentionPeriod: 5 * 365, // 5 años
        isRequired: false
      },
      personal: {
        name: 'Personales',
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
        retentionPeriod: 3 * 365, // 3 años
        isRequired: false
      },
      other: {
        name: 'Otros',
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'],
        retentionPeriod: 2 * 365, // 2 años
        isRequired: false
      }
    };
  }

  /**
   * Valida el archivo según su categoría
   */
  validateFile() {
    const errors = [];
    const configs = EmployeeDocument.getDocumentConfigs();
    const config = configs[this.category];

    if (!config) {
      errors.push('Categoría de documento no válida');
      return errors;
    }

    // Validar tamaño
    if (this.fileSize > config.maxFileSize) {
      errors.push(`El archivo excede el tamaño máximo permitido (${config.maxFileSize / (1024 * 1024)}MB)`);
    }

    // Validar tipo MIME
    if (!config.allowedTypes.includes(this.mimeType)) {
      errors.push(`Tipo de archivo no permitido. Tipos válidos: ${config.allowedExtensions.join(', ')}`);
    }

    return errors;
  }

  /**
   * Valida los datos del documento
   */
  validate() {
    const errors = [];

    if (!this.employeeId) {
      errors.push('El ID del empleado es requerido');
    }

    if (!this.fileName) {
      errors.push('El nombre del archivo es requerido');
    }

    if (!this.originalName) {
      errors.push('El nombre original del archivo es requerido');
    }

    if (!this.fileUrl) {
      errors.push('La URL del archivo es requerida');
    }

    if (this.fileSize <= 0) {
      errors.push('El tamaño del archivo debe ser mayor a 0');
    }

    const validCategories = Object.keys(EmployeeDocument.getDocumentConfigs());
    if (!validCategories.includes(this.category)) {
      errors.push('La categoría del documento no es válida');
    }

    // Validar archivo
    const fileErrors = this.validateFile();
    errors.push(...fileErrors);

    return errors;
  }

  /**
   * Genera nombre único para el archivo
   */
  static generateFileName(originalName, employeeId, category) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const extension = originalName.substring(originalName.lastIndexOf('.'));
    return `employees/${employeeId}/${category}/${timestamp}_${random}${extension}`;
  }

  /**
   * Convierte el modelo a objeto plano para Firebase
   */
  toFirestore() {
    return {
      id: this.id,
      employeeId: this.employeeId,
      fileName: this.fileName,
      originalName: this.originalName,
      fileSize: this.fileSize,
      mimeType: this.mimeType,
      fileUrl: this.fileUrl,
      category: this.category,
      description: this.description,
      tags: this.tags,
      isConfidential: this.isConfidential,
      uploadedBy: this.uploadedBy,
      uploadedAt: this.uploadedAt,
      expiresAt: this.expiresAt,
      version: this.version,
      previousVersionId: this.previousVersionId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
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

      this.updatedAt = new Date().toISOString();

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('documents').doc(this.id);
      
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
  async update(data) {
    try {
      Object.assign(this, data);
      this.updatedAt = new Date().toISOString();

      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('documents').doc(this.id);
      
      await docRef.update(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error updating employee document:', error);
      throw error;
    }
  }

  /**
   * Elimina el documento
   */
  async delete() {
    try {
      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('documents').doc(this.id);
      
      await docRef.delete();

      return true;
    } catch (error) {
      console.error('Error deleting employee document:', error);
      throw error;
    }
  }

  /**
   * Busca un documento por ID
   */
  static async findById(employeeId, id) {
    try {
      const doc = await db.collection('employees').doc(employeeId)
        .collection('documents').doc(id).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return EmployeeDocument.fromFirestore(doc);
    } catch (error) {
      console.error('Error finding employee document by ID:', error);
      throw error;
    }
  }

  /**
   * Lista documentos de un empleado
   */
  static async listByEmployee(employeeId, options = {}) {
    try {
      const {
        category = null,
        search = '',
        page = 1,
        limit = 20,
        includeExpired = false
      } = options;

      let query = db.collection('employees').doc(employeeId)
        .collection('documents');

      // Filtro por categoría
      if (category) {
        query = query.where('category', '==', category);
      }

      // Filtro por documentos no expirados
      if (!includeExpired) {
        const now = new Date().toISOString();
        query = query.where('expiresAt', '>', now);
      }

      // Ordenamiento
      query = query.orderBy('uploadedAt', 'desc');

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
        
        // Filtro de búsqueda (en memoria)
        if (search) {
          const searchLower = search.toLowerCase();
          const originalName = document.originalName.toLowerCase();
          const description = (document.description || '').toLowerCase();
          const tags = document.tags.join(' ').toLowerCase();
          
          if (originalName.includes(searchLower) || 
              description.includes(searchLower) || 
              tags.includes(searchLower)) {
            documents.push(document);
          }
        } else {
          documents.push(document);
        }
      });

      return documents;
    } catch (error) {
      console.error('Error listing employee documents:', error);
      throw error;
    }
  }

  /**
   * Obtiene resumen de documentos por categoría
   */
  static async getSummaryByEmployee(employeeId) {
    try {
      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('documents').get();

      const summary = {
        totalFiles: 0,
        totalSize: 0,
        categories: {},
        expiredDocuments: 0,
        recentUploads: 0
      };

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      snapshot.forEach(doc => {
        const document = doc.data();
        
        summary.totalFiles++;
        summary.totalSize += document.fileSize || 0;
        
        // Contar por categoría
        summary.categories[document.category] = (summary.categories[document.category] || 0) + 1;
        
        // Contar documentos expirados
        if (document.expiresAt && new Date(document.expiresAt) < now) {
          summary.expiredDocuments++;
        }
        
        // Contar subidas recientes
        if (new Date(document.uploadedAt) > thirtyDaysAgo) {
          summary.recentUploads++;
        }
      });

      return summary;
    } catch (error) {
      console.error('Error getting documents summary:', error);
      throw error;
    }
  }

  /**
   * Obtiene documentos próximos a expirar
   */
  static async getExpiringDocuments(employeeId, days = 30) {
    try {
      const now = new Date();
      const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const nowStr = now.toISOString();
      const futureDateStr = futureDate.toISOString();

      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('documents')
        .where('expiresAt', '>', nowStr)
        .where('expiresAt', '<=', futureDateStr)
        .orderBy('expiresAt', 'asc')
        .get();

      const expiringDocuments = [];
      snapshot.forEach(doc => {
        expiringDocuments.push(EmployeeDocument.fromFirestore(doc));
      });

      return expiringDocuments;
    } catch (error) {
      console.error('Error getting expiring documents:', error);
      throw error;
    }
  }

  /**
   * Crea una nueva versión de un documento
   */
  async createNewVersion(newFileData, uploadedBy) {
    try {
      // Crear nuevo documento con versión incrementada
      const newDocument = new EmployeeDocument({
        ...newFileData,
        employeeId: this.employeeId,
        category: this.category,
        description: this.description,
        tags: this.tags,
        isConfidential: this.isConfidential,
        version: this.version + 1,
        previousVersionId: this.id,
        uploadedBy
      });

      await newDocument.save();
      return newDocument;
    } catch (error) {
      console.error('Error creating new document version:', error);
      throw error;
    }
  }

  /**
   * Obtiene el historial de versiones de un documento
   */
  async getVersionHistory() {
    try {
      const versions = [];
      let currentDoc = this;
      
      // Recorrer hacia atrás en el historial
      while (currentDoc) {
        versions.push(currentDoc);
        
        if (currentDoc.previousVersionId) {
          currentDoc = await EmployeeDocument.findById(this.employeeId, currentDoc.previousVersionId);
        } else {
          currentDoc = null;
        }
      }

      return versions.sort((a, b) => b.version - a.version);
    } catch (error) {
      console.error('Error getting document version history:', error);
      throw error;
    }
  }

  /**
   * Verifica si un documento está expirado
   */
  isExpired() {
    if (!this.expiresAt) return false;
    return new Date(this.expiresAt) < new Date();
  }

  /**
   * Calcula días hasta expiración
   */
  getDaysUntilExpiration() {
    if (!this.expiresAt) return null;
    
    const now = new Date();
    const expiration = new Date(this.expiresAt);
    const diffTime = expiration - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  /**
   * Obtiene documentos requeridos faltantes para un empleado
   */
  static async getMissingRequiredDocuments(employeeId) {
    try {
      const configs = EmployeeDocument.getDocumentConfigs();
      const requiredCategories = Object.keys(configs).filter(cat => configs[cat].isRequired);
      
      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('documents').get();

      const existingCategories = new Set();
      snapshot.forEach(doc => {
        const document = doc.data();
        if (!document.isExpired) {
          existingCategories.add(document.category);
        }
      });

      const missingCategories = requiredCategories.filter(cat => !existingCategories.has(cat));
      
      return missingCategories.map(cat => ({
        category: cat,
        name: configs[cat].name,
        config: configs[cat]
      }));
    } catch (error) {
      console.error('Error getting missing required documents:', error);
      throw error;
    }
  }
}

module.exports = EmployeeDocument;
