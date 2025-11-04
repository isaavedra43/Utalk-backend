/**
 * 📦 MODELO DE MATERIAL DE PROVEEDOR
 * 
 * Gestiona los materiales específicos de cada proveedor.
 * 
 * @version 1.0.0
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

class ProviderMaterial {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.providerId = data.providerId;
    this.name = data.name || '';
    this.description = data.description || '';
    this.category = data.category || '';
    this.unitPrice = data.unitPrice || 0;
    this.unit = data.unit || '';
    this.sku = data.sku || '';
    this.imageUrl = data.imageUrl || '';
    this.stock = data.stock || 0;
    this.minStock = data.minStock || 0;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Convierte la instancia a formato Firestore
   */
  toFirestore() {
    return {
      providerId: this.providerId,
      name: this.name,
      description: this.description,
      category: this.category,
      unitPrice: this.unitPrice,
      unit: this.unit,
      sku: this.sku,
      imageUrl: this.imageUrl,
      stock: this.stock,
      minStock: this.minStock,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crea una instancia desde un documento de Firestore
   */
  static fromFirestore(doc) {
    if (!doc.exists) return null;
    
    const data = doc.data();
    return new ProviderMaterial({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
    });
  }

  /**
   * Guarda el material en Firestore
   */
  async save() {
    try {
      this.updatedAt = new Date();
      const docRef = db.collection('providers').doc(this.providerId)
        .collection('materials').doc(this.id);
      
      await docRef.set(this.toFirestore());
      return this;
    } catch (error) {
      console.error('Error guardando material del proveedor:', error);
      throw error;
    }
  }

  /**
   * Actualiza el material en Firestore
   */
  async update(updates) {
    try {
      Object.assign(this, updates);
      this.updatedAt = new Date();
      
      const docRef = db.collection('providers').doc(this.providerId)
        .collection('materials').doc(this.id);
      
      await docRef.update(this.toFirestore());
      return this;
    } catch (error) {
      console.error('Error actualizando material del proveedor:', error);
      throw error;
    }
  }

  /**
   * Elimina el material
   */
  async delete() {
    try {
      const docRef = db.collection('providers').doc(this.providerId)
        .collection('materials').doc(this.id);
      
      await docRef.delete();
      return true;
    } catch (error) {
      console.error('Error eliminando material del proveedor:', error);
      throw error;
    }
  }

  /**
   * Busca un material por ID
   */
  static async findById(providerId, materialId) {
    try {
      const doc = await db.collection('providers').doc(providerId)
        .collection('materials').doc(materialId).get();
      
      return ProviderMaterial.fromFirestore(doc);
    } catch (error) {
      console.error('Error buscando material del proveedor:', error);
      throw error;
    }
  }

  /**
   * Lista todos los materiales de un proveedor
   */
  static async listByProvider(providerId, options = {}) {
    try {
      const {
        isActive = null,
        category = null,
        limit = 100,
        offset = 0
      } = options;

      let query = db.collection('providers').doc(providerId)
        .collection('materials');

      // Filtrar por estado activo
      if (isActive !== null) {
        query = query.where('isActive', '==', isActive);
      }

      // Filtrar por categoría
      if (category) {
        query = query.where('category', '==', category);
      }

      // Ordenar por nombre
      query = query.orderBy('name', 'asc');

      // Paginación
      if (offset > 0) {
        query = query.offset(offset);
      }
      if (limit) {
        query = query.limit(limit);
      }

      const snapshot = await query.get();
      const materials = snapshot.docs.map(doc => ProviderMaterial.fromFirestore(doc));

      return materials;
    } catch (error) {
      console.error('Error listando materiales del proveedor:', error);
      throw error;
    }
  }
}

module.exports = ProviderMaterial;

