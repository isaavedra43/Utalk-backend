/**
 * 📋 MODELO DE ORDEN DE COMPRA
 * 
 * Gestiona las órdenes de compra a proveedores.
 * 
 * @version 1.0.0
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

class PurchaseOrder {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.orderNumber = data.orderNumber || '';
    this.providerId = data.providerId;
    this.providerName = data.providerName || '';
    this.status = data.status || 'draft';
    this.items = data.items || [];
    this.subtotal = data.subtotal || 0;
    this.tax = data.tax || 0;
    this.total = data.total || 0;
    this.notes = data.notes || '';
    this.internalNotes = data.internalNotes || '';
    this.createdAt = data.createdAt || new Date();
    this.sentAt = data.sentAt || null;
    this.expectedDeliveryDate = data.expectedDeliveryDate || null;
    this.acceptedAt = data.acceptedAt || null;
    this.deliveredAt = data.deliveredAt || null;
    this.createdBy = data.createdBy;
    this.createdByName = data.createdByName || '';
    this.deliveryAddress = data.deliveryAddress || '';
    this.deliveryNotes = data.deliveryNotes || '';
    this.attachments = data.attachments || [];
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Convierte la instancia a formato Firestore
   */
  toFirestore() {
    return {
      orderNumber: this.orderNumber,
      providerId: this.providerId,
      providerName: this.providerName,
      status: this.status,
      items: this.items,
      subtotal: this.subtotal,
      tax: this.tax,
      total: this.total,
      notes: this.notes,
      internalNotes: this.internalNotes,
      createdAt: this.createdAt,
      sentAt: this.sentAt,
      expectedDeliveryDate: this.expectedDeliveryDate,
      acceptedAt: this.acceptedAt,
      deliveredAt: this.deliveredAt,
      createdBy: this.createdBy,
      createdByName: this.createdByName,
      deliveryAddress: this.deliveryAddress,
      deliveryNotes: this.deliveryNotes,
      attachments: this.attachments,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crea una instancia desde un documento de Firestore
   */
  static fromFirestore(doc) {
    if (!doc.exists) return null;
    
    const data = doc.data();
    return new PurchaseOrder({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      sentAt: data.sentAt?.toDate?.() || data.sentAt,
      expectedDeliveryDate: data.expectedDeliveryDate?.toDate?.() || data.expectedDeliveryDate,
      acceptedAt: data.acceptedAt?.toDate?.() || data.acceptedAt,
      deliveredAt: data.deliveredAt?.toDate?.() || data.deliveredAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
    });
  }

  /**
   * Guarda la orden en Firestore
   */
  async save() {
    try {
      this.updatedAt = new Date();
      const docRef = db.collection('providers').doc(this.providerId)
        .collection('purchaseOrders').doc(this.id);
      
      await docRef.set(this.toFirestore());
      return this;
    } catch (error) {
      console.error('Error guardando orden de compra:', error);
      throw error;
    }
  }

  /**
   * Actualiza la orden en Firestore
   */
  async update(updates) {
    try {
      Object.assign(this, updates);
      this.updatedAt = new Date();
      
      const docRef = db.collection('providers').doc(this.providerId)
        .collection('purchaseOrders').doc(this.id);
      
      await docRef.update(this.toFirestore());
      return this;
    } catch (error) {
      console.error('Error actualizando orden de compra:', error);
      throw error;
    }
  }

  /**
   * Elimina la orden
   */
  async delete() {
    try {
      const docRef = db.collection('providers').doc(this.providerId)
        .collection('purchaseOrders').doc(this.id);
      
      await docRef.delete();
      return true;
    } catch (error) {
      console.error('Error eliminando orden de compra:', error);
      throw error;
    }
  }

  /**
   * Busca una orden por ID
   */
  static async findById(providerId, orderId) {
    try {
      const doc = await db.collection('providers').doc(providerId)
        .collection('purchaseOrders').doc(orderId).get();
      
      return PurchaseOrder.fromFirestore(doc);
    } catch (error) {
      console.error('Error buscando orden de compra:', error);
      throw error;
    }
  }

  /**
   * Lista todas las órdenes de un proveedor
   */
  static async listByProvider(providerId, options = {}) {
    try {
      const {
        status = null,
        limit = 100,
        offset = 0
      } = options;

      let query = db.collection('providers').doc(providerId)
        .collection('purchaseOrders');

      // Filtrar por status
      if (status) {
        query = query.where('status', '==', status);
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
      const orders = snapshot.docs.map(doc => PurchaseOrder.fromFirestore(doc));

      return orders;
    } catch (error) {
      console.error('Error listando órdenes de compra:', error);
      throw error;
    }
  }

  /**
   * Genera el siguiente número de orden secuencial
   */
  static async generateOrderNumber() {
    try {
      // Buscar el último número de orden
      const snapshot = await db.collection('providers')
        .collectionGroup('purchaseOrders')
        .orderBy('orderNumber', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) {
        return 'OC-000001';
      }

      const lastOrder = snapshot.docs[0].data();
      const lastNumber = parseInt(lastOrder.orderNumber.split('-')[1]);
      const nextNumber = lastNumber + 1;

      return `OC-${nextNumber.toString().padStart(6, '0')}`;
    } catch (error) {
      console.error('Error generando número de orden:', error);
      // Fallback: generar basado en timestamp
      const timestamp = Date.now().toString().slice(-6);
      return `OC-${timestamp}`;
    }
  }
}

module.exports = PurchaseOrder;

