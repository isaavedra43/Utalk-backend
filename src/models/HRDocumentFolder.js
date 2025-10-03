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
    this.createdByName = data.createdByName || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.isPublic = data.isPublic !== undefined ? data.isPublic : true;
    this.documentCount = data.documentCount || 0;
    this.color = data.color || 'blue';
    this.icon = data.icon || 'folder';
  }

  /**
   * Valida los datos de la carpeta
   */
  validate() {
    const errors = [];

    if (!this.name || this.name.length < 2) {
      errors.push('El nombre debe tener al menos 2 caracteres');
    }

    if (!this.createdBy) {
      errors.push('El ID del usuario que creó la carpeta es requerido');
    }

    if (!this.createdByName) {
      errors.push('El nombre del usuario que creó la carpeta es requerido');
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
      createdByName: this.createdByName,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isPublic: this.isPublic,
      documentCount: this.documentCount,
      color: this.color,
      icon: this.icon
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

      this.updatedAt = new Date().toISOString();

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
      this.updatedAt = new Date().toISOString();

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
   * Busca una carpeta por nombre
   */
  static async findByName(name) {
    try {
      const query = db.collection('hr_documents').doc('folders')
        .collection('list').where('name', '==', name);
      
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        return null;
      }
      
      const doc = snapshot.docs[0];
      return HRDocumentFolder.fromFirestore(doc);
    } catch (error) {
      console.error('Error finding HR document folder by name:', error);
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
   * Lista carpetas con filtros
   */
  static async list(options = {}) {
    try {
      const {
        isPublic = null,
        createdBy = null,
        search = null,
        limit = 100
      } = options;

      let query = db.collection('hr_documents').doc('folders').collection('list');

      // Aplicar filtros
      if (isPublic !== null) {
        query = query.where('isPublic', '==', isPublic);
      }

      if (createdBy) {
        query = query.where('createdBy', '==', createdBy);
      }

      // Ordenar por nombre
      query = query.orderBy('name', 'asc');

      // Límite
      query = query.limit(limit);

      const snapshot = await query.get();
      const folders = [];

      snapshot.forEach(doc => {
        folders.push(HRDocumentFolder.fromFirestore(doc));
      });

      // Si hay búsqueda por texto, filtrar en memoria
      let filteredFolders = folders;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredFolders = folders.filter(folder => 
          folder.name.toLowerCase().includes(searchLower) ||
          folder.description.toLowerCase().includes(searchLower)
        );
      }

      return filteredFolders;
    } catch (error) {
      console.error('Error listing HR document folders:', error);
      throw error;
    }
  }

  /**
   * Incrementa el contador de documentos
   */
  async incrementDocumentCount() {
    try {
      this.documentCount += 1;
      this.updatedAt = new Date().toISOString();
      
      const docRef = db.collection('hr_documents').doc('folders')
        .collection('list').doc(this.id);
      
      await docRef.update({
        documentCount: this.documentCount,
        updatedAt: this.updatedAt
      });

      return this;
    } catch (error) {
      console.error('Error incrementing document count:', error);
      throw error;
    }
  }

  /**
   * Decrementa el contador de documentos
   */
  async decrementDocumentCount() {
    try {
      this.documentCount = Math.max(0, this.documentCount - 1);
      this.updatedAt = new Date().toISOString();
      
      const docRef = db.collection('hr_documents').doc('folders')
        .collection('list').doc(this.id);
      
      await docRef.update({
        documentCount: this.documentCount,
        updatedAt: this.updatedAt
      });

      return this;
    } catch (error) {
      console.error('Error decrementing document count:', error);
      throw error;
    }
  }

  /**
   * Elimina la carpeta
   */
  static async delete(id) {
    try {
      // Verificar si hay documentos en la carpeta
      const HRDocument = require('./HRDocument');
      const documentsInFolder = await HRDocument.list({ folder: id, limit: 1 });
      
      if (documentsInFolder.length > 0) {
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
   * Crea carpetas por defecto del sistema
   */
  static async createDefaultFolders(createdBy = 'system') {
    try {
      const { getConfig } = require('../config/hrDocumentConfig');
      const defaultFoldersConfig = getConfig('DEFAULT_FOLDERS');
      const createdFolders = [];

      for (const folderConfig of defaultFoldersConfig) {
        // Verificar si ya existe
        const existing = await HRDocumentFolder.findByName(folderConfig.name);
        if (existing) {
          console.log(`Carpeta "${folderConfig.name}" ya existe, omitiendo...`);
          continue;
        }

        // Crear carpeta
        const folder = new HRDocumentFolder({
          name: folderConfig.name,
          description: folderConfig.description,
          createdBy,
          createdByName: 'Sistema',
          isPublic: true,
          color: 'blue',
          icon: 'folder'
        });

        await folder.save();
        createdFolders.push(folder);
        console.log(`✅ Carpeta creada: ${folder.name}`);
      }

      return createdFolders;
    } catch (error) {
      console.error('Error creating default folders:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de carpetas
   */
  static async getStats() {
    try {
      const snapshot = await db.collection('hr_documents').doc('folders')
        .collection('list').get();
      
      const stats = {
        totalFolders: 0,
        totalDocuments: 0,
        publicFolders: 0,
        privateFolders: 0,
        mostUsedFolders: []
      };

      const folders = [];
      snapshot.forEach(doc => {
        folders.push(HRDocumentFolder.fromFirestore(doc));
      });

      // Procesar estadísticas
      folders.forEach(folder => {
        stats.totalFolders++;
        stats.totalDocuments += folder.documentCount;

        if (folder.isPublic) {
          stats.publicFolders++;
        } else {
          stats.privateFolders++;
        }
      });

      // Carpetas más usadas
      stats.mostUsedFolders = folders
        .sort((a, b) => b.documentCount - a.documentCount)
        .slice(0, 10)
        .map(folder => ({
          id: folder.id,
          name: folder.name,
          documentCount: folder.documentCount
        }));

      return stats;
    } catch (error) {
      console.error('Error getting HR document folder stats:', error);
      throw error;
    }
  }
}

module.exports = HRDocumentFolder;