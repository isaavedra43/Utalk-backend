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
    this.discount = data.discount || 0;
    this.discountType = data.discountType || 'amount';
    this.tax = data.tax || 0;
    this.total = data.total || 0;
    this.notes = data.notes || '';
    this.internalNotes = data.internalNotes || '';
    this.createdAt = data.createdAt || new Date();
    this.sentAt = data.sentAt || null;
    this.expectedDeliveryDate = data.expectedDeliveryDate || null;
    this.acceptedAt = data.acceptedAt || null;
    this.rejectedAt = data.rejectedAt || null;
    this.deliveredAt = data.deliveredAt || null;
    this.cancelledAt = data.cancelledAt || null;
    this.createdBy = data.createdBy;
    this.createdByName = data.createdByName || '';
    this.deliveryAddress = data.deliveryAddress || '';
    this.deliveryNotes = data.deliveryNotes || '';
    this.attachments = data.attachments || [];
    this.acceptedBy = data.acceptedBy || null;
    this.acceptedDeliveryDate = data.acceptedDeliveryDate || null;
    this.rejectionReason = data.rejectionReason || null;
    this.cancellationReason = data.cancellationReason || null;
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
      discount: this.discount,
      discountType: this.discountType,
      tax: this.tax,
      total: this.total,
      notes: this.notes,
      internalNotes: this.internalNotes,
      createdAt: this.createdAt,
      sentAt: this.sentAt,
      expectedDeliveryDate: this.expectedDeliveryDate,
      acceptedAt: this.acceptedAt,
      rejectedAt: this.rejectedAt,
      deliveredAt: this.deliveredAt,
      cancelledAt: this.cancelledAt,
      createdBy: this.createdBy,
      createdByName: this.createdByName,
      deliveryAddress: this.deliveryAddress,
      deliveryNotes: this.deliveryNotes,
      attachments: this.attachments,
      acceptedBy: this.acceptedBy,
      acceptedDeliveryDate: this.acceptedDeliveryDate,
      rejectionReason: this.rejectionReason,
      cancellationReason: this.cancellationReason,
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
      rejectedAt: data.rejectedAt?.toDate?.() || data.rejectedAt,
      deliveredAt: data.deliveredAt?.toDate?.() || data.deliveredAt,
      cancelledAt: data.cancelledAt?.toDate?.() || data.cancelledAt,
      acceptedDeliveryDate: data.acceptedDeliveryDate?.toDate?.() || data.acceptedDeliveryDate,
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
   * Genera el siguiente número de orden secuencial con formato PO-YYYYMMDD-XXX
   */
  static async generateOrderNumber() {
    try {
      // Obtener fecha actual en formato YYYYMMDD
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const datePrefix = `${year}${month}${day}`;
      
      // Buscar el último número de orden del día
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      
      const snapshot = await db.collection('providers')
        .collectionGroup('purchaseOrders')
        .where('createdAt', '>=', startOfDay)
        .where('createdAt', '<', endOfDay)
        .orderBy('createdAt', 'desc')
        .orderBy('orderNumber', 'desc')
        .limit(1)
        .get();

      let sequence = 1;
      
      if (!snapshot.empty) {
        const lastOrder = snapshot.docs[0].data();
        const lastOrderNumber = lastOrder.orderNumber;
        
        // Verificar que sea del mismo día
        if (lastOrderNumber.startsWith(`PO-${datePrefix}`)) {
          const lastSequence = parseInt(lastOrderNumber.split('-')[2]);
          sequence = lastSequence + 1;
        }
      }

      return `PO-${datePrefix}-${sequence.toString().padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generando número de orden:', error);
      // Fallback: generar basado en timestamp
      const now = new Date();
      const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const sequence = String(Date.now()).slice(-3);
      return `PO-${datePrefix}-${sequence}`;
    }
  }
}

module.exports = PurchaseOrder;

