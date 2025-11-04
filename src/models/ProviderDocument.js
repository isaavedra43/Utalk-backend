/**
 * 📄 MODELO DE DOCUMENTO DE PROVEEDOR
 * 
 * Gestiona los documentos asociados a proveedores.
 * 
 * @version 1.0.0
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

class ProviderDocument {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.providerId = data.providerId;
    this.name = data.name || '';
    this.type = data.type || 'other';
    this.fileUrl = data.fileUrl || '';
    this.fileSize = data.fileSize || 0;
    this.mimeType = data.mimeType || '';
    this.uploadedAt = data.uploadedAt || new Date();
    this.uploadedBy = data.uploadedBy;
    this.uploadedByName = data.uploadedByName || '';
    this.notes = data.notes || '';
  }

  /**
   * Convierte la instancia a formato Firestore
   */
  toFirestore() {
    return {
      providerId: this.providerId,
      name: this.name,
      type: this.type,
      fileUrl: this.fileUrl,
      fileSize: this.fileSize,
      mimeType: this.mimeType,
      uploadedAt: this.uploadedAt,
      uploadedBy: this.uploadedBy,
      uploadedByName: this.uploadedByName,
      notes: this.notes
    };
  }

  /**
   * Crea una instancia desde un documento de Firestore
   */
  static fromFirestore(doc) {
    if (!doc.exists) return null;
    
    const data = doc.data();
    return new ProviderDocument({
      id: doc.id,
      ...data,
      uploadedAt: data.uploadedAt?.toDate?.() || data.uploadedAt
    });
  }

  /**
   * Guarda el documento en Firestore
   */
  async save() {
    try {
      const docRef = db.collection('providers').doc(this.providerId)
        .collection('documents').doc(this.id);
      
      await docRef.set(this.toFirestore());
      return this;
    } catch (error) {
      console.error('Error guardando documento del proveedor:', error);
      throw error;
    }
  }

  /**
   * Elimina el documento
   */
  async delete() {
    try {
      const docRef = db.collection('providers').doc(this.providerId)
        .collection('documents').doc(this.id);
      
      await docRef.delete();
      return true;
    } catch (error) {
      console.error('Error eliminando documento del proveedor:', error);
      throw error;
    }
  }

  /**
   * Busca un documento por ID
   */
  static async findById(providerId, documentId) {
    try {
      const doc = await db.collection('providers').doc(providerId)
        .collection('documents').doc(documentId).get();
      
      return ProviderDocument.fromFirestore(doc);
    } catch (error) {
      console.error('Error buscando documento del proveedor:', error);
      throw error;
    }
  }

  /**
   * Lista todos los documentos de un proveedor
   */
  static async listByProvider(providerId, options = {}) {
    try {
      const {
        type = null,
        limit = 100,
        offset = 0
      } = options;

      let query = db.collection('providers').doc(providerId)
        .collection('documents');

      // Filtrar por tipo
      if (type) {
        query = query.where('type', '==', type);
      }

      // Ordenar por fecha de subida (más recientes primero)
      query = query.orderBy('uploadedAt', 'desc');

      // Paginación
      if (offset > 0) {
        query = query.offset(offset);
      }
      if (limit) {
        query = query.limit(limit);
      }

      const snapshot = await query.get();
      const documents = snapshot.docs.map(doc => ProviderDocument.fromFirestore(doc));

      return documents;
    } catch (error) {
      console.error('Error listando documentos del proveedor:', error);
      throw error;
    }
  }
}

module.exports = ProviderDocument;

