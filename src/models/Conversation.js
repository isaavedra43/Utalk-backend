const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const { prepareForFirestore } = require('../utils/firestore');
const { isValidConversationId, extractParticipants } = require('../utils/conversation');

class Conversation {
  constructor (data) {
    // Validación crítica: conversationId es obligatorio
    if (!data.id) {
      throw new Error('id (conversationId) es obligatorio para crear una conversación');
    }
    
    if (!isValidConversationId(data.id)) {
      throw new Error(`conversationId inválido: ${data.id}`);
    }

    // Extraer y validar participantes
    const participants = extractParticipants(data.id);
    
    this.id = data.id; // conversationId
    this.participants = data.participants || [participants.phone1, participants.phone2];
    this.lastMessage = data.lastMessage || '';
    this.lastMessageAt = data.lastMessageAt || null;
    this.lastMessageId = data.lastMessageId || null;
    this.messageCount = data.messageCount || 0;
    this.unreadCount = data.unreadCount || 0;
    this.assignedTo = data.assignedTo || null; // userId del agente asignado
    this.status = data.status || 'open'; // 'open', 'closed', 'assigned', 'pending', 'archived'
    this.priority = data.priority || 'normal'; // 'low', 'normal', 'high', 'urgent'
    this.tags = data.tags || [];
    this.customerPhone = data.customerPhone || this.getCustomerPhone();
    this.agentPhone = data.agentPhone || this.getAgentPhone();
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || Timestamp.now();
    this.updatedAt = data.updatedAt || Timestamp.now();
  }

  /**
   * Identifica cuál número es del cliente y cuál del agente
   */
  getCustomerPhone() {
    const businessPhone = process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:', '') || '';
    return this.participants.find(phone => phone !== businessPhone) || this.participants[0];
  }

  getAgentPhone() {
    const businessPhone = process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:', '') || '';
    return this.participants.find(phone => phone === businessPhone) || this.participants[1];
  }

  /**
   * Crear o actualizar una conversación
   */
  static async createOrUpdate (conversationData) {
    const conversation = new Conversation(conversationData);
    
    // Preparar datos para Firestore
    const cleanData = prepareForFirestore({
      ...conversation,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Usar merge para crear o actualizar
    await firestore.collection('conversations').doc(conversation.id).set(cleanData, { merge: true });
    
    return conversation;
  }

  /**
   * Obtener conversación por ID
   */
  static async getById (id) {
    if (!isValidConversationId(id)) {
      throw new Error(`conversationId inválido: ${id}`);
    }

    const doc = await firestore.collection('conversations').doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new Conversation({ id: doc.id, ...doc.data() });
  }

  /**
   * Listar conversaciones con filtros y paginación
   */
  static async list (options = {}) {
    const {
      limit = 20,
      startAfter = null,
      assignedTo = null,
      status = null,
      customerPhone = null,
      sortBy = 'lastMessageAt',
      sortOrder = 'desc'
    } = options;

    let query = firestore.collection('conversations');

    // Aplicar filtros
    if (assignedTo) {
      query = query.where('assignedTo', '==', assignedTo);
    }
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    if (customerPhone) {
      query = query.where('customerPhone', '==', customerPhone);
    }

    // Ordenamiento
    query = query.orderBy(sortBy, sortOrder);

    // Paginación
    if (startAfter) {
      query = query.startAfter(startAfter);
    }
    
    query = query.limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => new Conversation({ id: doc.id, ...doc.data() }));
  }

  /**
   * Actualizar conversación
   */
  async update (updates) {
    const validUpdates = prepareForFirestore({ 
      ...updates, 
      updatedAt: FieldValue.serverTimestamp() 
    });
    
    await firestore.collection('conversations').doc(this.id).update(validUpdates);

    // Actualizar propiedades locales
    Object.assign(this, updates);
    this.updatedAt = Timestamp.now();
  }

  /**
   * Actualizar cuando llega un nuevo mensaje
   */
  async updateLastMessage (message) {
    const updates = {
      lastMessage: message.content || '[Multimedia]',
      lastMessageAt: message.timestamp || FieldValue.serverTimestamp(),
      lastMessageId: message.id,
      messageCount: FieldValue.increment(1),
    };

    // Incrementar unreadCount solo para mensajes entrantes
    if (message.direction === 'inbound') {
      updates.unreadCount = FieldValue.increment(1);
    }

    await this.update(updates);
  }

  /**
   * Marcar mensajes como leídos
   */
  async markAsRead (userId = null) {
    const updates = {
      unreadCount: 0,
      metadata: {
        ...this.metadata,
        lastReadBy: userId,
        lastReadAt: FieldValue.serverTimestamp()
      }
    };

    await this.update(updates);
  }

  /**
   * Asignar conversación a agente
   */
  async assignTo (userId) {
    const updates = {
      assignedTo: userId,
      status: 'assigned',
      metadata: {
        ...this.metadata,
        assignedAt: FieldValue.serverTimestamp(),
        assignedBy: userId
      }
    };

    await this.update(updates);
  }

  /**
   * Cambiar estado de conversación
   */
  async changeStatus (newStatus, userId = null) {
    const validStatuses = ['open', 'closed', 'assigned', 'pending', 'archived'];
    
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Estado inválido: ${newStatus}. Válidos: ${validStatuses.join(', ')}`);
    }

    const updates = {
      status: newStatus,
      metadata: {
        ...this.metadata,
        statusChangedBy: userId,
        statusChangedAt: FieldValue.serverTimestamp(),
        previousStatus: this.status
      }
    };

    await this.update(updates);
  }

  /**
   * Obtener estadísticas de la conversación
   */
  async getStats () {
    const messagesQuery = firestore
      .collection('messages')
      .where('conversationId', '==', this.id);

    const snapshot = await messagesQuery.get();
    const messages = snapshot.docs.map(doc => doc.data());

    const stats = {
      totalMessages: messages.length,
      inboundMessages: messages.filter(m => m.direction === 'inbound').length,
      outboundMessages: messages.filter(m => m.direction === 'outbound').length,
      unreadMessages: messages.filter(m => m.status !== 'read').length,
      firstMessageAt: messages.length > 0 ? Math.min(...messages.map(m => m.timestamp)) : null,
      averageResponseTime: this.calculateAverageResponseTime(messages),
    };

    return stats;
  }

  /**
   * Calcular tiempo promedio de respuesta
   */
  calculateAverageResponseTime (messages) {
    const sortedMessages = messages.sort((a, b) => a.timestamp - b.timestamp);
    const responseTimes = [];

    for (let i = 1; i < sortedMessages.length; i++) {
      const current = sortedMessages[i];
      const previous = sortedMessages[i - 1];

      // Solo calcular si es respuesta del agente a cliente
      if (previous.direction === 'inbound' && current.direction === 'outbound') {
        responseTimes.push(current.timestamp - previous.timestamp);
      }
    }

    if (responseTimes.length === 0) return null;
    
    const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    return Math.round(average / 1000); // Retornar en segundos
  }

  /**
   * Serializar para JSON
   */
  toJSON () {
    return {
      id: this.id,
      participants: this.participants,
      lastMessage: this.lastMessage,
      lastMessageAt: this.lastMessageAt?.toDate?.() || this.lastMessageAt,
      lastMessageId: this.lastMessageId,
      messageCount: this.messageCount,
      unreadCount: this.unreadCount,
      assignedTo: this.assignedTo,
      status: this.status,
      priority: this.priority,
      tags: this.tags,
      customerPhone: this.customerPhone,
      agentPhone: this.agentPhone,
      metadata: this.metadata,
      createdAt: this.createdAt?.toDate?.() || this.createdAt,
      updatedAt: this.updatedAt?.toDate?.() || this.updatedAt,
    };
  }

  /**
   * Eliminar conversación (archivar)
   */
  async archive () {
    await this.changeStatus('archived');
  }

  /**
   * Buscar conversaciones por contenido
   */
  static async search (searchTerm, options = {}) {
    const { limit = 20, assignedTo = null } = options;
    
    // Por simplicidad, buscar por números de teléfono o contenido de último mensaje
    let query = firestore.collection('conversations');
    
    if (assignedTo) {
      query = query.where('assignedTo', '==', assignedTo);
    }

    // Firestore no soporta búsqueda full-text nativa, implementar con array-contains
    // o integrar con Algolia/Elasticsearch para búsqueda avanzada
    const snapshot = await query.limit(limit * 2).get();
    
    const conversations = snapshot.docs
      .map(doc => new Conversation({ id: doc.id, ...doc.data() }))
      .filter(conv => 
        conv.customerPhone.includes(searchTerm) ||
        conv.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .slice(0, limit);

    return conversations;
  }
}

module.exports = Conversation; 