const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const { prepareForFirestore } = require('../utils/firestore');
const logger = require('../utils/logger');

class Campaign {
  constructor (data) {
    this.id = data.id;
    this.name = data.name;
    this.status = data.status || 'draft';
    this.createdAt = data.createdAt || Timestamp.now();
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
   * 🚀 OPTIMIZED BATCH GET CONTACT DETAILS
   * Optimiza la obtención de detalles de contactos usando batch operations
   */
  static async getContactDetailsOptimized(contacts) {
    try {
      if (!contacts || contacts.length === 0) {
        return [];
      }

      const BatchOptimizer = require('../services/BatchOptimizer');
      const contactIds = contacts.map(contact => contact.id);
      
      const documents = await BatchOptimizer.batchGet('contacts', contactIds, {
        batchSize: 500,
        timeout: 30000
      });

      const contactDetails = documents
        .filter(doc => doc.exists)
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

      logger.info('Contact details obtenidos con batch optimization', {
        totalContacts: contacts.length,
        successfulGets: contactDetails.length,
        failedGets: contacts.length - contactDetails.length
      });

      return contactDetails;

    } catch (error) {
      logger.error('Error obteniendo contact details optimizados', {
        error: error.message,
        stack: error.stack
      });
      return [];
    }
  }

  /**
   * 📊 OPTIMIZED BATCH CAMPAIGN STATS
   * Optimiza la obtención de estadísticas de campañas usando batch operations
   */
  static async getCampaignStatsOptimized(campaignIds, options = {}) {
    try {
      const { startDate, endDate, createdBy } = options;
      
      const BatchOptimizer = require('../services/BatchOptimizer');
      
      // Crear queries de batch para cada campaña
      const queries = campaignIds.map(campaignId => {
        let query = firestore.collection('campaigns').doc(campaignId);
        return query;
      });

      const results = await BatchOptimizer.batchQuery(queries, {
        maxConcurrent: 10,
        timeout: 30000
      });

      // Procesar resultados
      const stats = {
        totalCampaigns: 0,
        campaignsByStatus: {},
        campaignsByType: {},
        campaigns: {}
      };

      results.forEach((doc, index) => {
        if (doc.exists) {
          const campaignData = doc.data();
          const campaignId = campaignIds[index];

          stats.campaigns[campaignId] = {
            id: campaignId,
            ...campaignData
          };

          stats.totalCampaigns++;

          // Contar por status
          const status = campaignData.status || 'unknown';
          stats.campaignsByStatus[status] = (stats.campaignsByStatus[status] || 0) + 1;

          // Contar por tipo
          const type = campaignData.type || 'unknown';
          stats.campaignsByType[type] = (stats.campaignsByType[type] || 0) + 1;
        }
      });

      logger.info('Campaign stats obtenidos con batch optimization', {
        totalCampaigns: campaignIds.length,
        successfulGets: stats.totalCampaigns,
        uniqueStatuses: Object.keys(stats.campaignsByStatus).length,
        uniqueTypes: Object.keys(stats.campaignsByType).length
      });

      return stats;

    } catch (error) {
      logger.error('Error obteniendo campaign stats optimizados', {
        error: error.message,
        stack: error.stack
      });
      return {
        totalCampaigns: 0,
        campaignsByStatus: {},
        campaignsByType: {},
        campaigns: {}
      };
    }
  }

  /**
   * Convertir a objeto plano para respuestas JSON con timestamps ISO
   */
  toJSON () {
    // Convertir timestamps a formato ISO string
    let createdAtISO = '';
    if (this.createdAt && typeof this.createdAt.toDate === 'function') {
      createdAtISO = this.createdAt.toDate().toISOString();
    } else if (this.createdAt instanceof Date) {
      createdAtISO = this.createdAt.toISOString();
    } else if (typeof this.createdAt === 'string') {
      createdAtISO = this.createdAt;
    }

    return {
      id: this.id,
      name: this.name || '',
      status: this.status || 'draft',
      createdAt: createdAtISO,
      messagesSent: this.messagesSent || 0,
    };
  }
}

module.exports = Campaign;
