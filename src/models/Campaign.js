const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

class Campaign {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.message = data.message;
    this.contacts = data.contacts || []; // Array de contact IDs
    this.scheduledAt = data.scheduledAt;
    this.status = data.status || 'draft'; // draft, scheduled, sending, completed, paused, cancelled
    this.createdBy = data.createdBy;
    this.sentCount = data.sentCount || 0;
    this.deliveredCount = data.deliveredCount || 0;
    this.failedCount = data.failedCount || 0;
    this.openedCount = data.openedCount || 0;
    this.clickedCount = data.clickedCount || 0;
    this.results = data.results || [];
    this.template = data.template || {};
    this.targetAudience = data.targetAudience || {};
    this.estimatedReach = data.estimatedReach || 0;
    this.budget = data.budget || 0;
    this.createdAt = data.createdAt || Timestamp.now();
    this.updatedAt = data.updatedAt || Timestamp.now();
    this.completedAt = data.completedAt;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
  }

  /**
   * Crear nueva campaña
   */
  static async create(campaignData) {
    const campaign = new Campaign(campaignData);
    await firestore.collection('campaigns').doc(campaign.id).set({
      ...campaign,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return campaign;
  }

  /**
   * Obtener campaña por ID
   */
  static async getById(id) {
    const doc = await firestore.collection('campaigns').doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new Campaign({ id: doc.id, ...doc.data() });
  }

  /**
   * Listar campañas con filtros
   */
  static async list({ 
    limit = 20, 
    startAfter = null, 
    status = null, 
    createdBy = null,
    isActive = true 
  } = {}) {
    let query = firestore.collection('campaigns');

    if (createdBy) {
      query = query.where('createdBy', '==', createdBy);
    }

    if (status) {
      query = query.where('status', '==', status);
    }

    if (isActive !== null) {
      query = query.where('isActive', '==', isActive);
    }

    query = query.orderBy('createdAt', 'desc').limit(limit);

    if (startAfter) {
      query = query.startAfter(startAfter);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => new Campaign({ id: doc.id, ...doc.data() }));
  }

  /**
   * Buscar campañas por nombre
   */
  static async search(searchTerm, createdBy = null) {
    let query = firestore.collection('campaigns').where('isActive', '==', true);

    if (createdBy) {
      query = query.where('createdBy', '==', createdBy);
    }

    const snapshot = await query.get();
    const searchLower = searchTerm.toLowerCase();
    
    return snapshot.docs
      .map(doc => new Campaign({ id: doc.id, ...doc.data() }))
      .filter(campaign => 
        campaign.name.toLowerCase().includes(searchLower) ||
        campaign.message.toLowerCase().includes(searchLower)
      );
  }

  /**
   * Obtener campañas por estado
   */
  static async getByStatus(status, createdBy = null) {
    let query = firestore.collection('campaigns')
      .where('status', '==', status)
      .where('isActive', '==', true);

    if (createdBy) {
      query = query.where('createdBy', '==', createdBy);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => new Campaign({ id: doc.id, ...doc.data() }));
  }

  /**
   * Actualizar campaña
   */
  async update(updates) {
    const validUpdates = { ...updates, updatedAt: FieldValue.serverTimestamp() };
    await firestore.collection('campaigns').doc(this.id).update(validUpdates);
    
    // Actualizar propiedades locales
    Object.assign(this, updates);
    this.updatedAt = Timestamp.now();
  }

  /**
   * Cambiar estado de la campaña
   */
  async updateStatus(newStatus) {
    const updates = { status: newStatus };
    
    if (newStatus === 'completed') {
      updates.completedAt = FieldValue.serverTimestamp();
    }
    
    await this.update(updates);
  }

  /**
   * Agregar resultado de envío
   */
  async addResult(result) {
    const newResults = [...this.results, result];
    await this.update({ results: newResults });
  }

  /**
   * Actualizar métricas de la campaña
   */
  async updateMetrics(metrics) {
    const updates = {
      sentCount: metrics.sentCount || this.sentCount,
      deliveredCount: metrics.deliveredCount || this.deliveredCount,
      failedCount: metrics.failedCount || this.failedCount,
      openedCount: metrics.openedCount || this.openedCount,
      clickedCount: metrics.clickedCount || this.clickedCount,
    };
    
    await this.update(updates);
  }

  /**
   * Programar campaña
   */
  async schedule(scheduledAt) {
    await this.update({
      scheduledAt: Timestamp.fromDate(new Date(scheduledAt)),
      status: 'scheduled'
    });
  }

  /**
   * Pausar campaña
   */
  async pause() {
    await this.updateStatus('paused');
  }

  /**
   * Reanudar campaña
   */
  async resume() {
    const newStatus = this.scheduledAt && this.scheduledAt.toDate() > new Date() 
      ? 'scheduled' 
      : 'sending';
    await this.updateStatus(newStatus);
  }

  /**
   * Cancelar campaña
   */
  async cancel() {
    await this.updateStatus('cancelled');
  }

  /**
   * Eliminar campaña (soft delete)
   */
  async delete() {
    await this.update({ 
      isActive: false, 
      deletedAt: FieldValue.serverTimestamp() 
    });
  }

  /**
   * Eliminar campaña permanentemente
   */
  async hardDelete() {
    await firestore.collection('campaigns').doc(this.id).delete();
  }

  /**
   * Obtener estadísticas de la campaña
   */
  getStats() {
    const total = this.sentCount || 0;
    const delivered = this.deliveredCount || 0;
    const failed = this.failedCount || 0;
    const opened = this.openedCount || 0;
    const clicked = this.clickedCount || 0;

    return {
      total,
      delivered,
      failed,
      opened,
      clicked,
      deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
      openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
      clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
      failureRate: total > 0 ? (failed / total) * 100 : 0,
    };
  }

  /**
   * Verificar si la campaña puede ser enviada
   */
  canBeSent() {
    return ['draft', 'scheduled', 'paused'].includes(this.status) && 
           this.contacts.length > 0 && 
           this.message && 
           this.message.trim().length > 0;
  }

  /**
   * Verificar si la campaña puede ser editada
   */
  canBeEdited() {
    return ['draft', 'scheduled', 'paused'].includes(this.status);
  }

  /**
   * Obtener campaña con detalles de contactos
   */
  async getWithContactDetails() {
    const Contact = require('./Contact');
    const contactDetails = await Promise.all(
      this.contacts.map(async (contactId) => {
        const contact = await Contact.getById(contactId);
        return contact ? contact.toJSON() : null;
      })
    );

    return {
      ...this.toJSON(),
      contactDetails: contactDetails.filter(contact => contact !== null),
    };
  }

  /**
   * Convertir a objeto plano para respuestas JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      message: this.message,
      contacts: this.contacts,
      scheduledAt: this.scheduledAt,
      status: this.status,
      createdBy: this.createdBy,
      sentCount: this.sentCount,
      deliveredCount: this.deliveredCount,
      failedCount: this.failedCount,
      openedCount: this.openedCount,
      clickedCount: this.clickedCount,
      results: this.results,
      template: this.template,
      targetAudience: this.targetAudience,
      estimatedReach: this.estimatedReach,
      budget: this.budget,
      stats: this.getStats(),
      canBeSent: this.canBeSent(),
      canBeEdited: this.canBeEdited(),
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      completedAt: this.completedAt,
    };
  }
}

module.exports = Campaign; 