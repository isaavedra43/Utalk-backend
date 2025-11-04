/**
 * ⭐ MODELO DE CALIFICACIÓN DE PROVEEDOR
 * 
 * Gestiona las calificaciones de proveedores.
 * 
 * @version 1.0.0
 */

const { db } = require('../config/firebase');

class ProviderRating {
  constructor(data = {}) {
    this.providerId = data.providerId;
    this.overall = data.overall || 0;
    this.quality = data.quality || 0;
    this.delivery = data.delivery || 0;
    this.price = data.price || 0;
    this.communication = data.communication || 0;
    this.totalReviews = data.totalReviews || 0;
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Convierte la instancia a formato Firestore
   */
  toFirestore() {
    return {
      overall: this.overall,
      quality: this.quality,
      delivery: this.delivery,
      price: this.price,
      communication: this.communication,
      totalReviews: this.totalReviews,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crea una instancia desde un documento de Firestore
   */
  static fromFirestore(doc) {
    if (!doc.exists) return null;
    
    const data = doc.data();
    return new ProviderRating({
      providerId: doc.id,
      ...data,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
    });
  }

  /**
   * Guarda o actualiza la calificación en Firestore
   */
  async save() {
    try {
      this.updatedAt = new Date();
      const docRef = db.collection('providers').doc(this.providerId)
        .collection('metadata').doc('rating');
      
      await docRef.set(this.toFirestore(), { merge: true });
      return this;
    } catch (error) {
      console.error('Error guardando calificación del proveedor:', error);
      throw error;
    }
  }

  /**
   * Actualiza la calificación
   */
  async update(updates) {
    try {
      Object.assign(this, updates);
      this.updatedAt = new Date();
      
      const docRef = db.collection('providers').doc(this.providerId)
        .collection('metadata').doc('rating');
      
      await docRef.set(this.toFirestore(), { merge: true });
      return this;
    } catch (error) {
      console.error('Error actualizando calificación del proveedor:', error);
      throw error;
    }
  }

  /**
   * Busca la calificación de un proveedor
   */
  static async findByProvider(providerId) {
    try {
      const doc = await db.collection('providers').doc(providerId)
        .collection('metadata').doc('rating').get();
      
      if (!doc.exists) {
        // Retornar calificación por defecto si no existe
        return new ProviderRating({ providerId });
      }
      
      return ProviderRating.fromFirestore(doc);
    } catch (error) {
      console.error('Error buscando calificación del proveedor:', error);
      throw error;
    }
  }
}

module.exports = ProviderRating;

