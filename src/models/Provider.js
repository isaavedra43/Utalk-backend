/**
 * 📦 MODELO DE PROVEEDOR
 * 
 * Gestiona proveedores de materiales para el módulo de inventario.
 * 
 * @version 1.0.0
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

class Provider {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.userId = data.userId;
    this.name = data.name || '';
    this.contact = data.contact || '';
    this.phone = data.phone || '';
    this.email = data.email || '';
    this.address = data.address || '';
    this.materialIds = data.materialIds || [];
    this.isActive = data.isActive !== undefined ? data.isActive : true;
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
      contact: this.contact,
      phone: this.phone,
      email: this.email,
      address: this.address,
      materialIds: this.materialIds,
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
    return new Provider({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
    });
  }

  /**
   * Guarda el proveedor en Firestore
   */
  async save() {
    try {
      this.updatedAt = new Date();
      const docRef = db.collection('users').doc(this.userId)
        .collection('providers').doc(this.id);
      
      await docRef.set(this.toFirestore());
      return this;
    } catch (error) {
      console.error('Error guardando proveedor:', error);
      throw error;
    }
  }

  /**
   * Actualiza el proveedor en Firestore
   */
  async update(updates) {
    try {
      Object.assign(this, updates);
      this.updatedAt = new Date();
      
      const docRef = db.collection('users').doc(this.userId)
        .collection('providers').doc(this.id);
      
      await docRef.update(this.toFirestore());
      return this;
    } catch (error) {
      console.error('Error actualizando proveedor:', error);
      throw error;
    }
  }

  /**
   * Elimina el proveedor (soft delete)
   */
  async delete() {
    try {
      const docRef = db.collection('users').doc(this.userId)
        .collection('providers').doc(this.id);
      
      await docRef.delete();
      return true;
    } catch (error) {
      console.error('Error eliminando proveedor:', error);
      throw error;
    }
  }

  /**
   * Busca un proveedor por ID
   */
  static async findById(userId, providerId) {
    try {
      const doc = await db.collection('users').doc(userId)
        .collection('providers').doc(providerId).get();
      
      return Provider.fromFirestore(doc);
    } catch (error) {
      console.error('Error buscando proveedor:', error);
      throw error;
    }
  }

  /**
   * Lista todos los proveedores de un usuario
   */
  static async listByUser(userId, options = {}) {
    try {
      const {
        active = null,
        search = '',
        limit = 100,
        offset = 0
      } = options;

      let query = db.collection('users').doc(userId)
        .collection('providers');

      // Filtrar por estado activo
      if (active !== null) {
        query = query.where('isActive', '==', active);
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
      let providers = snapshot.docs.map(doc => Provider.fromFirestore(doc));

      // Búsqueda local (Firestore no soporta LIKE)
      if (search) {
        const searchLower = search.toLowerCase();
        providers = providers.filter(p => 
          p.name.toLowerCase().includes(searchLower) ||
          p.contact.toLowerCase().includes(searchLower)
        );
      }

      // Contar total
      const totalQuery = active !== null 
        ? db.collection('users').doc(userId).collection('providers').where('isActive', '==', active)
        : db.collection('users').doc(userId).collection('providers');
      
      const totalSnapshot = await totalQuery.get();
      const total = totalSnapshot.size;

      return {
        providers,
        pagination: {
          total,
          limit,
          offset,
          hasMore: (offset + providers.length) < total
        }
      };
    } catch (error) {
      console.error('Error listando proveedores:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de un proveedor
   */
  static async getStats(userId, providerId) {
    try {
      // Obtener todas las plataformas del proveedor
      const platformsSnapshot = await db.collection('users').doc(userId)
        .collection('providers').doc(providerId)
        .collection('platforms').get();

      const platforms = platformsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const totalPlatforms = platforms.length;
      const totalLinearMeters = platforms.reduce((sum, p) => sum + (p.totalLinearMeters || 0), 0);
      const lastDelivery = platforms.length > 0 
        ? platforms.sort((a, b) => b.receptionDate - a.receptionDate)[0].receptionDate
        : null;

      return {
        totalPlatforms,
        totalLinearMeters,
        lastDelivery,
        averageDeliveryTime: 2.5 // Placeholder - calcular si tienes datos de tiempo
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas del proveedor:', error);
      throw error;
    }
  }
}

module.exports = Provider;

