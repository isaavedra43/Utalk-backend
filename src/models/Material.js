/**
 * 🎨 MODELO DE MATERIAL
 * 
 * Gestiona materiales disponibles para el módulo de inventario.
 * 
 * @version 1.0.0
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

class Material {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.userId = data.userId;
    this.name = data.name || '';
    this.category = data.category || '';
    this.description = data.description || '';
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.providerIds = data.providerIds || [];
    this.unit = data.unit || 'm²';
    this.standardWidth = data.standardWidth !== undefined ? data.standardWidth : 0.3;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Convierte la instancia a formato Firestore
   */
  toFirestore() {
    return {
      userId: this.userId,
      name: this.name,
      category: this.category,
      description: this.description,
      isActive: this.isActive,
      providerIds: this.providerIds,
      unit: this.unit,
      standardWidth: this.standardWidth,
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
    return new Material({
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
      const docRef = db.collection('users').doc(this.userId)
        .collection('materials').doc(this.id);
      
      await docRef.set(this.toFirestore());
      return this;
    } catch (error) {
      console.error('Error guardando material:', error);
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
      
      const docRef = db.collection('users').doc(this.userId)
        .collection('materials').doc(this.id);
      
      await docRef.update(this.toFirestore());
      return this;
    } catch (error) {
      console.error('Error actualizando material:', error);
      throw error;
    }
  }

  /**
   * Elimina el material
   */
  async delete() {
    try {
      const docRef = db.collection('users').doc(this.userId)
        .collection('materials').doc(this.id);
      
      await docRef.delete();
      return true;
    } catch (error) {
      console.error('Error eliminando material:', error);
      throw error;
    }
  }

  /**
   * Busca un material por ID
   */
  static async findById(userId, materialId) {
    try {
      const doc = await db.collection('users').doc(userId)
        .collection('materials').doc(materialId).get();
      
      return Material.fromFirestore(doc);
    } catch (error) {
      console.error('Error buscando material:', error);
      throw error;
    }
  }

  /**
   * Lista todos los materiales de un usuario
   */
  static async listByUser(userId, options = {}) {
    try {
      const {
        active = null,
        category = '',
        providerId = '',
        search = '',
        limit = 100,
        offset = 0
      } = options;

      let query = db.collection('users').doc(userId)
        .collection('materials');

      // Filtrar por estado activo
      if (active !== null) {
        query = query.where('isActive', '==', active);
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
      let materials = snapshot.docs.map(doc => Material.fromFirestore(doc));

      // Filtros locales
      if (providerId) {
        materials = materials.filter(m => m.providerIds.includes(providerId));
      }

      if (search) {
        const searchLower = search.toLowerCase();
        materials = materials.filter(m => 
          m.name.toLowerCase().includes(searchLower) ||
          m.description.toLowerCase().includes(searchLower)
        );
      }

      // Contar total
      const totalQuery = active !== null 
        ? db.collection('users').doc(userId).collection('materials').where('isActive', '==', active)
        : db.collection('users').doc(userId).collection('materials');
      
      const totalSnapshot = await totalQuery.get();
      const total = totalSnapshot.size;

      return {
        materials,
        pagination: {
          total,
          limit,
          offset,
          hasMore: (offset + materials.length) < total
        }
      };
    } catch (error) {
      console.error('Error listando materiales:', error);
      throw error;
    }
  }

  /**
   * Lista materiales por categoría
   */
  static async listByCategory(userId, category) {
    try {
      const snapshot = await db.collection('users').doc(userId)
        .collection('materials')
        .where('category', '==', category)
        .where('isActive', '==', true)
        .orderBy('name', 'asc')
        .get();

      return snapshot.docs.map(doc => Material.fromFirestore(doc));
    } catch (error) {
      console.error('Error listando materiales por categoría:', error);
      throw error;
    }
  }

  /**
   * Obtiene todas las categorías únicas
   */
  static async getCategories(userId) {
    try {
      const snapshot = await db.collection('users').doc(userId)
        .collection('materials')
        .where('isActive', '==', true)
        .get();

      const categories = new Set();
      snapshot.docs.forEach(doc => {
        const category = doc.data().category;
        if (category) categories.add(category);
      });

      return Array.from(categories).sort();
    } catch (error) {
      console.error('Error obteniendo categorías:', error);
      throw error;
    }
  }
}

module.exports = Material;

