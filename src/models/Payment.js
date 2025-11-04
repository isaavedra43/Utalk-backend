/**
 * 💰 MODELO DE PAGO
 * 
 * Gestiona los pagos realizados a proveedores.
 * 
 * @version 1.0.0
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

class Payment {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.paymentNumber = data.paymentNumber || '';
    this.providerId = data.providerId;
    this.providerName = data.providerName || '';
    this.purchaseOrderId = data.purchaseOrderId || null;
    this.orderNumber = data.orderNumber || null;
    this.relatedOrderIds = data.relatedOrderIds || [];
    this.amount = data.amount || 0;
    this.currency = data.currency || 'MXN';
    this.paymentMethod = data.paymentMethod || 'cash';
    this.reference = data.reference || '';
    this.status = data.status || 'completed';
    this.notes = data.notes || '';
    this.paymentDate = data.paymentDate || new Date();
    this.createdAt = data.createdAt || new Date();
    this.createdBy = data.createdBy;
    this.createdByName = data.createdByName || '';
    this.receiptUrl = data.receiptUrl || '';
    this.attachments = data.attachments || [];
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Convierte la instancia a formato Firestore
   */
  toFirestore() {
    return {
      paymentNumber: this.paymentNumber,
      providerId: this.providerId,
      providerName: this.providerName,
      purchaseOrderId: this.purchaseOrderId,
      orderNumber: this.orderNumber,
      relatedOrderIds: this.relatedOrderIds,
      amount: this.amount,
      currency: this.currency,
      paymentMethod: this.paymentMethod,
      reference: this.reference,
      status: this.status,
      notes: this.notes,
      paymentDate: this.paymentDate,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      createdByName: this.createdByName,
      receiptUrl: this.receiptUrl,
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
    return new Payment({
      id: doc.id,
      ...data,
      paymentDate: data.paymentDate?.toDate?.() || data.paymentDate,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
    });
  }

  /**
   * Guarda el pago en Firestore
   */
  async save() {
    try {
      this.updatedAt = new Date();
      const docRef = db.collection('providers').doc(this.providerId)
        .collection('payments').doc(this.id);
      
      await docRef.set(this.toFirestore());
      return this;
    } catch (error) {
      console.error('Error guardando pago:', error);
      throw error;
    }
  }

  /**
   * Actualiza el pago en Firestore
   */
  async update(updates) {
    try {
      Object.assign(this, updates);
      this.updatedAt = new Date();
      
      const docRef = db.collection('providers').doc(this.providerId)
        .collection('payments').doc(this.id);
      
      await docRef.update(this.toFirestore());
      return this;
    } catch (error) {
      console.error('Error actualizando pago:', error);
      throw error;
    }
  }

  /**
   * Elimina el pago
   */
  async delete() {
    try {
      const docRef = db.collection('providers').doc(this.providerId)
        .collection('payments').doc(this.id);
      
      await docRef.delete();
      return true;
    } catch (error) {
      console.error('Error eliminando pago:', error);
      throw error;
    }
  }

  /**
   * Busca un pago por ID
   */
  static async findById(providerId, paymentId) {
    try {
      const doc = await db.collection('providers').doc(providerId)
        .collection('payments').doc(paymentId).get();
      
      return Payment.fromFirestore(doc);
    } catch (error) {
      console.error('Error buscando pago:', error);
      throw error;
    }
  }

  /**
   * Lista todos los pagos de un proveedor
   */
  static async listByProvider(providerId, options = {}) {
    try {
      const {
        status = null,
        limit = 100,
        offset = 0
      } = options;

      let query = db.collection('providers').doc(providerId)
        .collection('payments');

      // Filtrar por status
      if (status) {
        query = query.where('status', '==', status);
      }

      // Ordenar por fecha de pago (más recientes primero)
      query = query.orderBy('paymentDate', 'desc');

      // Paginación
      if (offset > 0) {
        query = query.offset(offset);
      }
      if (limit) {
        query = query.limit(limit);
      }

      const snapshot = await query.get();
      const payments = snapshot.docs.map(doc => Payment.fromFirestore(doc));

      return payments;
    } catch (error) {
      console.error('Error listando pagos:', error);
      throw error;
    }
  }

  /**
   * Genera el siguiente número de pago secuencial con formato PAY-YYYYMMDD-XXX
   */
  static async generatePaymentNumber() {
    try {
      // Obtener fecha actual en formato YYYYMMDD
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const datePrefix = `${year}${month}${day}`;
      
      // Buscar el último número de pago del día
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      
      const snapshot = await db.collection('providers')
        .collectionGroup('payments')
        .where('createdAt', '>=', startOfDay)
        .where('createdAt', '<', endOfDay)
        .orderBy('createdAt', 'desc')
        .orderBy('paymentNumber', 'desc')
        .limit(1)
        .get();

      let sequence = 1;
      
      if (!snapshot.empty) {
        const lastPayment = snapshot.docs[0].data();
        const lastPaymentNumber = lastPayment.paymentNumber;
        
        // Verificar que sea del mismo día
        if (lastPaymentNumber.startsWith(`PAY-${datePrefix}`)) {
          const lastSequence = parseInt(lastPaymentNumber.split('-')[2]);
          sequence = lastSequence + 1;
        }
      }

      return `PAY-${datePrefix}-${sequence.toString().padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generando número de pago:', error);
      // Fallback: generar basado en timestamp
      const now = new Date();
      const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const sequence = String(Date.now()).slice(-3);
      return `PAY-${datePrefix}-${sequence}`;
    }
  }
}

module.exports = Payment;

