const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo de Carpeta de Documentos de RH
 * Gestiona las carpetas de organización de documentos
 * Alineado 100% con especificaciones del Frontend
 */
class HRDocumentFolder {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.name = data.name || '';
    this.description = data.description || '';
    this.createdBy = data.createdBy || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.documentCount = data.documentCount || 0;
    this.totalSize = data.totalSize || 0;
    this.isPublic = data.isPublic !== undefined ? data.isPublic : true;
    this.permissions = {
      canView: data.permissions?.canView !== undefined ? data.permissions.canView : true,
      canEdit: data.permissions?.canEdit || false,
      canDelete: data.permissions?.canDelete || false
    };
  }

  /**
   * Valida los datos de la carpeta
   */
  validate() {
    const errors = [];

    if (!this.name || this.name.length < 2) {
      errors.push('El nombre de la carpeta debe tener al menos 2 caracteres');
    }

    if (this.name.length > 50) {
      errors.push('El nombre de la carpeta no puede exceder 50 caracteres');
    }

    if (!this.createdBy) {
      errors.push('El ID del usuario que creó la carpeta es requerido');
    }

    return errors;
  }

  /**
   * Convierte el modelo a objeto plano para Firebase
   */
  toFirestore() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      documentCount: this.documentCount,
      totalSize: this.totalSize,
      isPublic: this.isPublic,
      permissions: this.permissions
    };
  }

  /**
   * Crea una carpeta desde datos de Firestore
   */
  static fromFirestore(doc) {
    return new HRDocumentFolder({ id: doc.id, ...doc.data() });
  }

  /**
   * Guarda la carpeta en Firebase
   */
  async save() {
    try {
      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      const docRef = db.collection('hr_documents').doc('folders')
        .collection('list').doc(this.id);
      
      await docRef.set(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error saving HR document folder:', error);
      throw error;
    }
  }

  /**
   * Actualiza la carpeta
   */
  async update(data) {
    try {
      Object.assign(this, data);

      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      const docRef = db.collection('hr_documents').doc('folders')
        .collection('list').doc(this.id);
      
      await docRef.update(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error updating HR document folder:', error);
      throw error;
    }
  }

  /**
   * Busca una carpeta por ID
   */
  static async findById(id) {
    try {
      const doc = await db.collection('hr_documents').doc('folders')
        .collection('list').doc(id).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return HRDocumentFolder.fromFirestore(doc);
    } catch (error) {
      console.error('Error finding HR document folder by ID:', error);
      throw error;
    }
  }

  /**
   * Busca una carpeta por nombre
   */
  static async findByName(name) {
    try {
      const snapshot = await db.collection('hr_documents').doc('folders')
        .collection('list').where('name', '==', name).get();
      
      if (snapshot.empty) {
        return null;
      }
      
      return HRDocumentFolder.fromFirestore(snapshot.docs[0]);
    } catch (error) {
      console.error('Error finding HR document folder by name:', error);
      throw error;
    }
  }

  /**
   * Lista todas las carpetas
   */
  static async list(options = {}) {
    try {
      const { isPublic = null, createdBy = null } = options;

      let query = db.collection('hr_documents').doc('folders').collection('list');

      if (isPublic !== null) {
        query = query.where('isPublic', '==', isPublic);
      }

      if (createdBy) {
        query = query.where('createdBy', '==', createdBy);
      }

      query = query.orderBy('name', 'asc');

      const snapshot = await query.get();
      const folders = [];

      snapshot.forEach(doc => {
        folders.push(HRDocumentFolder.fromFirestore(doc));
      });

      return folders;
    } catch (error) {
      console.error('Error listing HR document folders:', error);
      throw error;
    }
  }

  /**
   * Actualiza el conteo de documentos en la carpeta
   */
  async updateDocumentCount() {
    try {
      const HRDocument = require('./HRDocument');
      const documents = await HRDocument.list({ folder: this.name, limit: 1000 });

      this.documentCount = documents.length;
      this.totalSize = documents.reduce((total, doc) => total + doc.fileSize, 0);

      const docRef = db.collection('hr_documents').doc('folders')
        .collection('list').doc(this.id);
      
      await docRef.update({
        documentCount: this.documentCount,
        totalSize: this.totalSize
      });

      return this;
    } catch (error) {
      console.error('Error updating document count:', error);
      throw error;
    }
  }

  /**
   * Verifica si la carpeta está vacía
   */
  async isEmpty() {
    try {
      const HRDocument = require('./HRDocument');
      const documents = await HRDocument.list({ folder: this.name, limit: 1 });
      return documents.length === 0;
    } catch (error) {
      console.error('Error checking if folder is empty:', error);
      throw error;
    }
  }

  /**
   * Elimina la carpeta
   */
  static async delete(id) {
    try {
      const folder = await HRDocumentFolder.findById(id);
      if (!folder) {
        throw new Error('Carpeta no encontrada');
      }

      // Verificar si está vacía
      const isEmpty = await folder.isEmpty();
      if (!isEmpty) {
        throw new Error('No se puede eliminar una carpeta que contiene documentos');
      }

      const docRef = db.collection('hr_documents').doc('folders')
        .collection('list').doc(id);
      
      await docRef.delete();
      
      return true;
    } catch (error) {
      console.error('Error deleting HR document folder:', error);
      throw error;
    }
  }

  /**
   * Crea carpetas por defecto
   */
  static async createDefaultFolders(createdBy) {
    try {
      const defaultFolders = [
        { name: 'Manuales', description: 'Manuales corporativos y de procedimientos' },
        { name: 'Políticas', description: 'Políticas de la empresa' },
        { name: 'Plantillas', description: 'Plantillas de documentos' },
        { name: 'Formatos', description: 'Formatos oficiales' },
        { name: 'Capacitación', description: 'Material de capacitación' },
        { name: 'Legal', description: 'Documentos legales' },
        { name: 'Multimedia', description: 'Videos, imágenes y archivos multimedia' }
      ];

      const createdFolders = [];

      for (const folderData of defaultFolders) {
        // Verificar si ya existe
        const existing = await HRDocumentFolder.findByName(folderData.name);
        if (!existing) {
          const folder = new HRDocumentFolder({
            ...folderData,
            createdBy
          });
          
          await folder.save();
          createdFolders.push(folder);
        }
      }

      return createdFolders;
    } catch (error) {
      console.error('Error creating default folders:', error);
      throw error;
    }
  }
}

module.exports = HRDocumentFolder;
