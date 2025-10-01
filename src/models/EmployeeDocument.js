const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');
const { FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');
const logger = require('../utils/logger');

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
    this.category = data.category || 'other'; // 'contract' | 'identification' | 'payroll' | 'medical' | 'training' | 'performance' | 'other'
    this.subcategory = data.subcategory || null;
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
    const validCategories = ['contract', 'identification', 'payroll', 'medical', 'training', 'performance', 'other'];
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
      // 🔧 CORRECCIÓN: Buscar versiones en subcolección
      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('documents')
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
      subcategory: this.subcategory,
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

      // 🔧 CORRECCIÓN CRÍTICA: Verificar si Firebase está disponible
      if (!db) {
        console.error('❌ Firebase no está disponible - no se puede guardar el documento');
        throw new Error('Firebase no está disponible');
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

      // 🔧 CORRECCIÓN: Guardar en subcolección del empleado
      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('documents').doc(this.id);
      
      const firestoreData = this.toFirestore();
      
      console.log('📝 Guardando documento en subcolección del empleado:', {
        path: `employees/${this.employeeId}/documents/${this.id}`,
        fileName: this.originalName,
        category: this.category,
        auditDeletedAt: firestoreData.audit.deletedAt
      });
      
      await docRef.set(firestoreData);

      // Verificar que se guardó correctamente
      const savedDoc = await docRef.get();
      if (!savedDoc.exists) {
        throw new Error('El documento no se guardó correctamente en Firestore');
      }

      console.log('✅ Documento guardado y verificado en subcolección:', {
        path: `employees/${this.employeeId}/documents/${this.id}`,
        fileName: this.originalName,
        exists: savedDoc.exists
      });

      return this;
    } catch (error) {
      console.error('❌ Error saving employee document:', error);
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
      if (data.subcategory !== undefined) {
        this.subcategory = data.subcategory;
      }

      this.audit.updatedAt = new Date().toISOString();
      this.audit.updatedBy = updatedBy;

      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      // 🔧 CORRECCIÓN: Actualizar en subcolección del empleado
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
   * Elimina el documento (soft delete)
   */
  async delete(deletedBy = null) {
    try {
      this.audit.deletedAt = new Date().toISOString();
      this.audit.deletedBy = deletedBy;

      // 🔧 CORRECCIÓN: Eliminar en subcolección del empleado
      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('documents').doc(this.id);
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
   * Busca un documento por ID (necesita employeeId)
   */
  static async findById(documentId, employeeId = null) {
    try {
      // 🔍 LOG DE DEPURACIÓN CRÍTICO
      console.log('🔍 findById recibió:', {
        documentId,
        employeeId,
        employeeIdType: typeof employeeId,
        employeeIdIsNull: employeeId === null,
        employeeIdIsUndefined: employeeId === undefined,
        employeeIdIsFalsy: !employeeId
      });

      if (!employeeId) {
        console.warn('findById sin employeeId - búsqueda lenta');
        // Buscar en la colección antigua primero para compatibilidad
        const oldDoc = await db.collection('employee_documents').doc(documentId).get();
        if (oldDoc.exists) {
          return EmployeeDocument.fromFirestore(oldDoc);
        }
        return null;
      }

      // 🔧 CORRECCIÓN: Buscar PRIMERO en subcolección nueva
      const newDoc = await db.collection('employees').doc(employeeId)
        .collection('documents').doc(documentId).get();
      
      if (newDoc.exists) {
        return EmployeeDocument.fromFirestore(newDoc);
      }

      // 🔧 COMPATIBILIDAD: Si no está en la subcolección, buscar en colección antigua
      console.log('📍 Documento no encontrado en subcolección, buscando en colección antigua...');
      const oldDoc = await db.collection('employee_documents').doc(documentId).get();
      
      if (oldDoc.exists) {
        const document = EmployeeDocument.fromFirestore(oldDoc);
        // Verificar que pertenece al empleado correcto
        if (document.employeeId === employeeId) {
          console.log('✅ Documento encontrado en colección antigua');
          return document;
        }
      }

      return null;
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

      console.log('🔍 Listando documentos para empleado:', {
        employeeId,
        options,
        firebaseAvailable: !!db
      });

      // 🔧 CORRECCIÓN CRÍTICA: Verificar si Firebase está disponible
      if (!db) {
        console.warn('Firebase no está disponible, retornando respuesta vacía');
        return {
          documents: [],
          pagination: {
            page: options.page || 1,
            limit: options.limit || 20,
            total: 0,
            totalPages: 0
          }
        };
      }

      // 🔧 CORRECCIÓN: Consultar subcolección del empleado
      let query = db.collection('employees').doc(employeeId)
        .collection('documents')
        .where('audit.deletedAt', '==', null);

      console.log('🔍 Consulta en subcolección del empleado:', {
        path: `employees/${employeeId}/documents`,
        whereDeletedAt: null
      });

      // Filtro por categoría
      if (category) {
        query = query.where('category', '==', category);
        console.log('➕ Filtro de categoría agregado:', category);
      }

      // Filtro por confidencialidad
      if (confidential !== null) {
        query = query.where('isConfidential', '==', confidential);
        console.log('➕ Filtro de confidencialidad agregado:', confidential);
      }

      // Ordenamiento
      query = query.orderBy(sortBy, sortOrder);
      console.log('📊 Ordenamiento configurado:', { sortBy, sortOrder });

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

      console.log('📊 Resultados de consulta Firebase:', {
        employeeId,
        snapshotSize: snapshot.size,
        isEmpty: snapshot.empty
      });

      snapshot.forEach(doc => {
        const document = EmployeeDocument.fromFirestore(doc);
        console.log('📄 Documento encontrado:', {
          id: document.id,
          employeeId: document.employeeId,
          fileName: document.originalName,
          category: document.category
        });
        
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

      // 🔧 CORRECCIÓN: Obtener total de subcolección
      let totalQuery = db.collection('employees').doc(employeeId)
        .collection('documents')
        .where('audit.deletedAt', '==', null);
      
      if (category) {
        totalQuery = totalQuery.where('category', '==', category);
      }
      if (confidential !== null) {
        totalQuery = totalQuery.where('isConfidential', '==', confidential);
      }

      const totalSnapshot = await totalQuery.get();
      let total = totalSnapshot.size;

      // 🔧 COMPATIBILIDAD: También buscar documentos en la colección antigua
      try {
        let oldQuery = db.collection('employee_documents')
          .where('employeeId', '==', employeeId)
          .where('audit.deletedAt', '==', null);
        
        if (category) {
          oldQuery = oldQuery.where('category', '==', category);
        }
        if (confidential !== null) {
          oldQuery = oldQuery.where('isConfidential', '==', confidential);
        }
        
        const oldSnapshot = await oldQuery.get();
        
        console.log('📍 Documentos encontrados en colección antigua:', oldSnapshot.size);
        
        oldSnapshot.forEach(doc => {
          const document = EmployeeDocument.fromFirestore(doc);
          
          // Filtro de búsqueda
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
        
        total += oldSnapshot.size;
      } catch (oldCollectionError) {
        console.warn('Error consultando colección antigua, continuando sin ella:', oldCollectionError.message);
      }

      console.log('📈 Resultado final de listado:', {
        employeeId,
        documentsFound: documents.length,
        totalInDB: total,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });

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
      // 🔧 CORRECCIÓN CRÍTICA: En caso de error, retornar respuesta vacía
      console.warn('Error en Firebase, retornando respuesta vacía');
      return {
        documents: [],
        pagination: {
          page: options.page || 1,
          limit: options.limit || 20,
          total: 0,
          totalPages: 0
        }
      };
    }
  }


  /**
   * Obtiene resumen de documentos de un empleado
   */
  static async getSummaryByEmployee(employeeId) {
    try {
      // 🔧 CORRECCIÓN CRÍTICA: Verificar si Firebase está disponible
      if (!db) {
        console.warn('Firebase no está disponible, retornando resumen vacío');
        return {
          totalCount: 0,
          totalSizeBytes: 0,
          categories: {
            contract: 0,
            identification: 0,
            payroll: 0,
            medical: 0,
            training: 0,
            performance: 0,
            other: 0
          },
          confidentialCount: 0,
          publicCount: 0,
          lastUploadAt: null
        };
      }

      // 🔧 CORRECCIÓN: Obtener resumen de subcolección
      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('documents')
        .where('audit.deletedAt', '==', null)
        .get();

      const summary = {
        totalCount: 0,
        totalSizeBytes: 0,
        categories: {
          contract: 0,
          identification: 0,
          payroll: 0,
          medical: 0,
          training: 0,
          performance: 0,
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
      // 🔧 CORRECCIÓN CRÍTICA: En caso de error, retornar resumen vacío
      console.warn('Error en Firebase, retornando resumen vacío');
      return {
        totalCount: 0,
        totalSizeBytes: 0,
        categories: {
          contract: 0,
          identification: 0,
          payroll: 0,
          medical: 0,
          training: 0,
          performance: 0,
          other: 0
        },
        confidentialCount: 0,
        publicCount: 0,
        lastUploadAt: null
      };
    }
  }

  /**
   * Busca documentos por checksum (para detectar duplicados)
   * NOTA: Con subcolecciones, esta búsqueda es más compleja
   */
  static async findByChecksum(checksum, employeeId = null) {
    try {
      if (employeeId) {
        // Buscar solo en el empleado específico
        const snapshot = await db.collection('employees').doc(employeeId)
          .collection('documents')
          .where('checksum', '==', checksum)
          .where('audit.deletedAt', '==', null)
          .get();

        return snapshot.docs.map(doc => EmployeeDocument.fromFirestore(doc));
      } else {
        // Buscar en colección antigua para compatibilidad
        const snapshot = await db.collection('employee_documents')
          .where('checksum', '==', checksum)
          .where('audit.deletedAt', '==', null)
          .get();

        return snapshot.docs.map(doc => EmployeeDocument.fromFirestore(doc));
      }
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
          identification: 0,
          payroll: 0,
          medical: 0,
          training: 0,
          performance: 0,
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