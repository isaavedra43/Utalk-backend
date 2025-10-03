const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo de Documento de RH
 * Gestiona los documentos de la biblioteca corporativa
 * Alineado 100% con especificaciones del Frontend
 */
class HRDocument {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.name = data.name || '';
    this.description = data.description || '';
    this.type = data.type || 'other';
    this.category = data.category || 'otro';
    this.fileSize = data.fileSize || 0;
    this.mimeType = data.mimeType || '';
    this.fileUrl = data.fileUrl || '';
    this.thumbnailUrl = data.thumbnailUrl || null;
    this.uploadedBy = data.uploadedBy || '';
    this.uploadedByName = data.uploadedByName || '';
    this.uploadedAt = data.uploadedAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.tags = data.tags || [];
    this.isPublic = data.isPublic !== undefined ? data.isPublic : true;
    this.isPinned = data.isPinned || false;
    this.isFavorite = data.isFavorite || false;
    this.downloadCount = data.downloadCount || 0;
    this.viewCount = data.viewCount || 0;
    this.lastAccessedAt = data.lastAccessedAt || null;
    this.version = data.version || 1;
    this.folder = data.folder || null;
    this.permissions = {
      canView: data.permissions?.canView !== undefined ? data.permissions.canView : true,
      canDownload: data.permissions?.canDownload !== undefined ? data.permissions.canDownload : true,
      canEdit: data.permissions?.canEdit || false,
      canDelete: data.permissions?.canDelete || false,
      canShare: data.permissions?.canShare !== undefined ? data.permissions.canShare : true
    };
  }

  /**
   * Valida los datos del documento
   */
  validate() {
    const errors = [];

    if (!this.name || this.name.length < 3) {
      errors.push('El nombre debe tener al menos 3 caracteres');
    }

    if (!this.category) {
      errors.push('La categoría es requerida');
    }

    const validCategories = ['plantilla', 'politica', 'procedimiento', 'manual', 'formato', 'capacitacion', 'legal', 'multimedia', 'otro'];
    if (!validCategories.includes(this.category)) {
      errors.push('La categoría no es válida');
    }

    const validTypes = ['pdf', 'image', 'document', 'video', 'audio', 'spreadsheet', 'presentation', 'archive', 'template', 'other'];
    if (!validTypes.includes(this.type)) {
      errors.push('El tipo de archivo no es válido');
    }

    if (this.fileSize <= 0) {
      errors.push('El tamaño del archivo debe ser mayor a 0');
    }

    if (!this.mimeType) {
      errors.push('El tipo MIME es requerido');
    }

    if (!this.fileUrl) {
      errors.push('La URL del archivo es requerida');
    }

    if (!this.uploadedBy) {
      errors.push('El ID del usuario que subió el archivo es requerido');
    }

    if (!this.uploadedByName) {
      errors.push('El nombre del usuario que subió el archivo es requerido');
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
      type: this.type,
      category: this.category,
      fileSize: this.fileSize,
      mimeType: this.mimeType,
      fileUrl: this.fileUrl,
      thumbnailUrl: this.thumbnailUrl,
      uploadedBy: this.uploadedBy,
      uploadedByName: this.uploadedByName,
      uploadedAt: this.uploadedAt,
      updatedAt: this.updatedAt,
      tags: this.tags,
      isPublic: this.isPublic,
      isPinned: this.isPinned,
      isFavorite: this.isFavorite,
      downloadCount: this.downloadCount,
      viewCount: this.viewCount,
      lastAccessedAt: this.lastAccessedAt,
      version: this.version,
      folder: this.folder,
      permissions: this.permissions
    };
  }

  /**
   * Crea un documento desde datos de Firestore
   */
  static fromFirestore(doc) {
    return new HRDocument({ id: doc.id, ...doc.data() });
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

      const docRef = db.collection('hr_documents').doc('documents')
        .collection('list').doc(this.id);
      
      await docRef.set(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error saving HR document:', error);
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

      const docRef = db.collection('hr_documents').doc('documents')
        .collection('list').doc(this.id);
      
      await docRef.update(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error updating HR document:', error);
      throw error;
    }
  }

  /**
   * Busca un documento por ID
   */
  static async findById(id) {
    try {
      const doc = await db.collection('hr_documents').doc('documents')
        .collection('list').doc(id).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return HRDocument.fromFirestore(doc);
    } catch (error) {
      console.error('Error finding HR document by ID:', error);
      throw error;
    }
  }

  /**
   * Lista documentos con filtros
   */
  static async list(options = {}) {
    try {
      const {
        search = null,
        category = null,
        type = null,
        folder = null,
        tags = null,
        isPublic = null,
        isPinned = null,
        uploadedBy = null,
        dateFrom = null,
        dateTo = null,
        page = 1,
        limit = 20
      } = options;

      let query = db.collection('hr_documents').doc('documents').collection('list');

      // Aplicar filtros
      if (category) {
        query = query.where('category', '==', category);
      }

      if (type) {
        query = query.where('type', '==', type);
      }

      if (folder) {
        query = query.where('folder', '==', folder);
      }

      if (isPublic !== null) {
        query = query.where('isPublic', '==', isPublic);
      }

      if (isPinned !== null) {
        query = query.where('isPinned', '==', isPinned);
      }

      if (uploadedBy) {
        query = query.where('uploadedBy', '==', uploadedBy);
      }

      if (dateFrom) {
        query = query.where('uploadedAt', '>=', dateFrom);
      }

      if (dateTo) {
        query = query.where('uploadedAt', '<=', dateTo);
      }

      // Ordenar por fecha de subida (más recientes primero)
      query = query.orderBy('uploadedAt', 'desc');

      // Paginación
      const offset = (page - 1) * limit;
      query = query.offset(offset).limit(limit);

      const snapshot = await query.get();
      const documents = [];

      snapshot.forEach(doc => {
        documents.push(HRDocument.fromFirestore(doc));
      });

      // Si hay búsqueda por texto, filtrar en memoria
      let filteredDocuments = documents;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredDocuments = documents.filter(doc => 
          doc.name.toLowerCase().includes(searchLower) ||
          doc.description.toLowerCase().includes(searchLower) ||
          doc.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
          doc.uploadedByName.toLowerCase().includes(searchLower)
        );
      }

      // Si hay búsqueda por tags, filtrar en memoria
      if (tags && Array.isArray(tags)) {
        filteredDocuments = filteredDocuments.filter(doc =>
          tags.some(tag => doc.tags.includes(tag))
        );
      }

      return filteredDocuments;
    } catch (error) {
      console.error('Error listing HR documents:', error);
      throw error;
    }
  }

  /**
   * Incrementa el contador de descargas
   */
  async incrementDownloadCount() {
    try {
      this.downloadCount += 1;
      this.lastAccessedAt = new Date().toISOString();
      
      const docRef = db.collection('hr_documents').doc('documents')
        .collection('list').doc(this.id);
      
      await docRef.update({
        downloadCount: this.downloadCount,
        lastAccessedAt: this.lastAccessedAt
      });

      return this;
    } catch (error) {
      console.error('Error incrementing download count:', error);
      throw error;
    }
  }

  /**
   * Incrementa el contador de visualizaciones
   */
  async incrementViewCount() {
    try {
      this.viewCount += 1;
      this.lastAccessedAt = new Date().toISOString();
      
      const docRef = db.collection('hr_documents').doc('documents')
        .collection('list').doc(this.id);
      
      await docRef.update({
        viewCount: this.viewCount,
        lastAccessedAt: this.lastAccessedAt
      });

      return this;
    } catch (error) {
      console.error('Error incrementing view count:', error);
      throw error;
    }
  }

  /**
   * Toggle favorito
   */
  async toggleFavorite() {
    try {
      this.isFavorite = !this.isFavorite;
      this.updatedAt = new Date().toISOString();
      
      const docRef = db.collection('hr_documents').doc('documents')
        .collection('list').doc(this.id);
      
      await docRef.update({
        isFavorite: this.isFavorite,
        updatedAt: this.updatedAt
      });

      return this;
    } catch (error) {
      console.error('Error toggling favorite:', error);
      throw error;
    }
  }

  /**
   * Toggle pin
   */
  async togglePin() {
    try {
      this.isPinned = !this.isPinned;
      this.updatedAt = new Date().toISOString();
      
      const docRef = db.collection('hr_documents').doc('documents')
        .collection('list').doc(this.id);
      
      await docRef.update({
        isPinned: this.isPinned,
        updatedAt: this.updatedAt
      });

      return this;
    } catch (error) {
      console.error('Error toggling pin:', error);
      throw error;
    }
  }

  /**
   * Mueve a carpeta
   */
  async moveToFolder(folderName) {
    try {
      this.folder = folderName;
      this.updatedAt = new Date().toISOString();
      
      const docRef = db.collection('hr_documents').doc('documents')
        .collection('list').doc(this.id);
      
      await docRef.update({
        folder: this.folder,
        updatedAt: this.updatedAt
      });

      return this;
    } catch (error) {
      console.error('Error moving to folder:', error);
      throw error;
    }
  }

  /**
   * Duplica el documento
   */
  async duplicate(newName, uploadedBy, uploadedByName) {
    try {
      const duplicate = new HRDocument({
        name: newName,
        description: this.description,
        type: this.type,
        category: this.category,
        fileSize: this.fileSize,
        mimeType: this.mimeType,
        fileUrl: this.fileUrl, // Misma URL del archivo
        thumbnailUrl: this.thumbnailUrl,
        uploadedBy,
        uploadedByName,
        tags: [...this.tags],
        isPublic: this.isPublic,
        folder: this.folder,
        permissions: { ...this.permissions }
      });

      await duplicate.save();
      return duplicate;
    } catch (error) {
      console.error('Error duplicating document:', error);
      throw error;
    }
  }

  /**
   * Elimina el documento
   */
  static async delete(id) {
    try {
      const docRef = db.collection('hr_documents').doc('documents')
        .collection('list').doc(id);
      
      await docRef.delete();
      
      return true;
    } catch (error) {
      console.error('Error deleting HR document:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de documentos
   */
  static async getStats() {
    try {
      const snapshot = await db.collection('hr_documents').doc('documents')
        .collection('list').get();
      
      const stats = {
        totalDocuments: 0,
        totalSize: 0,
        byCategory: {},
        byType: {},
        recentUploads: [],
        mostDownloaded: [],
        mostViewed: [],
        pinnedDocuments: []
      };

      const documents = [];
      snapshot.forEach(doc => {
        documents.push(HRDocument.fromFirestore(doc));
      });

      // Procesar estadísticas
      documents.forEach(doc => {
        stats.totalDocuments++;
        stats.totalSize += doc.fileSize;

        // Por categoría
        stats.byCategory[doc.category] = (stats.byCategory[doc.category] || 0) + 1;

        // Por tipo
        stats.byType[doc.type] = (stats.byType[doc.type] || 0) + 1;

        // Documentos fijados
        if (doc.isPinned) {
          stats.pinnedDocuments.push({
            id: doc.id,
            name: doc.name
          });
        }
      });

      // Más descargados
      stats.mostDownloaded = documents
        .sort((a, b) => b.downloadCount - a.downloadCount)
        .slice(0, 10)
        .map(doc => ({
          id: doc.id,
          name: doc.name,
          downloadCount: doc.downloadCount
        }));

      // Más vistos
      stats.mostViewed = documents
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, 10)
        .map(doc => ({
          id: doc.id,
          name: doc.name,
          viewCount: doc.viewCount
        }));

      // Subidas recientes
      stats.recentUploads = documents
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
        .slice(0, 10)
        .map(doc => ({
          id: doc.id,
          name: doc.name,
          uploadedAt: doc.uploadedAt
        }));

      return stats;
    } catch (error) {
      console.error('Error getting HR document stats:', error);
      throw error;
    }
  }
}

module.exports = HRDocument;
