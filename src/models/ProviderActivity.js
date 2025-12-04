/**
 * 📋 MODELO DE ACTIVIDAD DE PROVEEDOR
 * 
 * Gestiona el historial de actividades y cambios en proveedores.
 * 
 * @version 1.0.0
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

class ProviderActivity {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.providerId = data.providerId;
    this.type = data.type || 'created';
    this.description = data.description || '';
    this.details = data.details || {};
    this.entityType = data.entityType || null;
    this.entityId = data.entityId || null;
    this.createdAt = data.createdAt || new Date();
    this.createdBy = data.createdBy;
    this.createdByName = data.createdByName || '';
  }

  /**
   * Convierte la instancia a formato Firestore
   */
  toFirestore() {
    return {
      providerId: this.providerId,
      type: this.type,
      description: this.description,
      details: this.details,
      entityType: this.entityType,
      entityId: this.entityId,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      createdByName: this.createdByName
    };
  }

  /**
   * Crea una instancia desde un documento de Firestore
   */
  static fromFirestore(doc) {
    if (!doc.exists) return null;
    
    const data = doc.data();
    return new ProviderActivity({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() || data.createdAt
    });
  }

  /**
   * Guarda la actividad en Firestore
   */
  async save() {
    try {
      const docRef = db.collection('providers').doc(this.providerId)
        .collection('activities').doc(this.id);
      
      await docRef.set(this.toFirestore());
      return this;
    } catch (error) {
      console.error('Error guardando actividad del proveedor:', error);
      throw error;
    }
  }

  /**
   * Busca una actividad por ID
   */
  static async findById(providerId, activityId) {
    try {
      const doc = await db.collection('providers').doc(providerId)
        .collection('activities').doc(activityId).get();
      
      return ProviderActivity.fromFirestore(doc);
    } catch (error) {
      console.error('Error buscando actividad del proveedor:', error);
      throw error;
    }
  }

  /**
   * Lista todas las actividades de un proveedor
   */
  static async listByProvider(providerId, options = {}) {
    try {
      const {
        type = null,
        entityType = null,
        entityId = null,
        limit = 100,
        offset = 0
      } = options;

      let query = db.collection('providers').doc(providerId)
        .collection('activities');

      // Filtrar por tipo
      if (type) {
        query = query.where('type', '==', type);
      }

      // Filtrar por tipo de entidad
      if (entityType) {
        query = query.where('entityType', '==', entityType);
      }

      // Filtrar por ID de entidad
      if (entityId) {
        query = query.where('entityId', '==', entityId);
      }

      // Ordenar por fecha de creación (más recientes primero)
      query = query.orderBy('createdAt', 'desc');

      // Paginación
      if (offset > 0) {
        query = query.offset(offset);
      }
      if (limit) {
        query = query.limit(limit);
      }

      const snapshot = await query.get();
      const activities = snapshot.docs.map(doc => ProviderActivity.fromFirestore(doc));

      return activities;
    } catch (error) {
      console.error('Error listando actividades del proveedor:', error);
      throw error;
    }
  }

  /**
   * Crea una actividad automáticamente
   */
  static async createActivity(providerId, type, description, options = {}) {
    try {
      const activity = new ProviderActivity({
        providerId,
        type,
        description,
        details: options.details || {},
        entityType: options.entityType || null,
        entityId: options.entityId || null,
        createdBy: options.createdBy,
        createdByName: options.createdByName || ''
      });

      await activity.save();
      return activity;
    } catch (error) {
      console.error('Error creando actividad automática:', error);
      // No lanzar error para no interrumpir la operación principal
      return null;
    }
  }
}

module.exports = ProviderActivity;

