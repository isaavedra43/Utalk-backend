const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const { prepareForFirestore } = require('../utils/firestore');

class Campaign {
  constructor (data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.status = data.status || 'draft';
    this.createdAt = data.createdAt || Timestamp.now();
    this.messagesSent = data.messagesSent || 0;

    // Propiedades internas no expuestas en la API
    this.internalProperties = {
        message: data.message,
        contacts: data.contacts || [],
        createdBy: data.createdBy,
        scheduledAt: data.scheduledAt,
    };
  }

  /**
   * Crear nueva campaña
   */
  static async create (campaignData) {
    const campaign = new Campaign(campaignData);

    // Preparar datos para Firestore, removiendo campos undefined/null/vacíos
    const cleanData = prepareForFirestore({
      ...campaign,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await firestore.collection('campaigns').doc(campaign.id).set(cleanData);
    return campaign;
  }

  /**
   * Obtener campaña por ID
   */
  static async getById (id) {
    const doc = await firestore.collection('campaigns').doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new Campaign({ id: doc.id, ...doc.data() });
  }

  /**
   * Listar campañas con filtros
   */
  static async list ({
    limit = 20,
    startAfter = null,
    status = null,
    createdBy = null,
    isActive = true,
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
  static async search (searchTerm, createdBy = null) {
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
        campaign.message.toLowerCase().includes(searchLower),
      );
  }

  /**
   * Obtener campañas por estado
   */
  static async getByStatus (status, createdBy = null) {
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
  async update (updates) {
    const validUpdates = prepareForFirestore({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await firestore.collection('campaigns').doc(this.id).update(validUpdates);

    // Actualizar propiedades locales
    Object.assign(this, updates);
    this.updatedAt = Timestamp.now();
  }

  /**
   * Cambiar estado de la campaña
   */
  async updateStatus (newStatus) {
    const updates = { status: newStatus };

    if (newStatus === 'completed') {
      updates.completedAt = FieldValue.serverTimestamp();
    }

    await this.update(updates);
  }

  /**
   * Agregar resultado de envío
   */
  async addResult (result) {
    const newResults = [...this.results, result];
    await this.update({ results: newResults });
  }

  /**
   * Actualizar métricas de la campaña
   */
  async updateMetrics (metrics) {
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
  async schedule (scheduledAt) {
    await this.update({
      scheduledAt: Timestamp.fromDate(new Date(scheduledAt)),
      status: 'scheduled',
    });
  }

  /**
   * Pausar campaña
   */
  async pause () {
    await this.updateStatus('paused');
  }

  /**
   * Reanudar campaña
   */
  async resume () {
    const newStatus = this.scheduledAt && this.scheduledAt.toDate() > new Date()
      ? 'scheduled'
      : 'sending';
    await this.updateStatus(newStatus);
  }

  /**
   * Cancelar campaña
   */
  async cancel () {
    await this.updateStatus('cancelled');
  }

  /**
   * Eliminar campaña (soft delete)
   */
  async delete () {
    await this.update({
      isActive: false,
      deletedAt: FieldValue.serverTimestamp(),
    });
  }

  /**
   * Eliminar campaña permanentemente
   */
  async hardDelete () {
    await firestore.collection('campaigns').doc(this.id).delete();
  }

  /**
   * Obtener estadísticas de la campaña
   */
  getStats () {
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
  canBeSent () {
    return ['draft', 'scheduled', 'paused'].includes(this.status) &&
           this.contacts.length > 0 &&
           this.message &&
           this.message.trim().length > 0;
  }

  /**
   * Verificar si la campaña puede ser editada
   */
  canBeEdited () {
    return ['draft', 'scheduled', 'paused'].includes(this.status);
  }

  /**
   * Obtener campaña con detalles de contactos
   */
  async getWithContactDetails () {
    const Contact = require('./Contact');
    const contactDetails = await Promise.all(
      this.contacts.map(async (contactId) => {
        const contact = await Contact.getById(contactId);
        return contact ? contact.toJSON() : null;
      }),
    );

    return {
      ...this.toJSON(),
      contactDetails: contactDetails.filter(contact => contact !== null),
    };
  }

  /**
   * Convertir a objeto plano para respuestas JSON
   */
  toJSON () {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      createdAt: this.createdAt,
      messagesSent: this.messagesSent,
    };
  }
}

module.exports = Campaign;
