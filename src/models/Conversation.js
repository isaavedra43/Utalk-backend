const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const logger = require('../utils/logger');
const { prepareForFirestore } = require('../utils/firestore');
const { isValidConversationId } = require('../utils/conversation');
const { validateAndNormalizePhone, extractPhoneInfo } = require('../utils/phoneValidation');

class Conversation {
  constructor (data) {
    // ✅ VALIDACIÓN: ID requerido
    if (!data.id) {
      throw new Error('Conversation ID es requerido');
    }
    this.id = data.id;

    // ✅ VALIDACIÓN: Teléfonos de participantes
    this.participants = this.validateAndNormalizeParticipants(data.participants || []);
    
    // ✅ VALIDACIÓN: Teléfono del cliente
    if (data.customerPhone) {
      const customerValidation = validateAndNormalizePhone(data.customerPhone);
      if (!customerValidation.isValid) {
        throw new Error(`Teléfono del cliente inválido: ${customerValidation.error}`);
      }
      this.customerPhone = customerValidation.normalized;
    }

    // ✅ VALIDACIÓN: Teléfono del agente
    if (data.agentPhone) {
      const agentValidation = validateAndNormalizePhone(data.agentPhone);
      if (!agentValidation.isValid) {
        throw new Error(`Teléfono del agente inválido: ${agentValidation.error}`);
      }
      this.agentPhone = agentValidation.normalized;
    }

    // ✅ CAMPOS OBLIGATORIOS CON VALORES POR DEFECTO
    this.contact = data.contact || null;
    this.lastMessage = data.lastMessage || null;
    this.lastMessageId = data.lastMessageId || null;
    this.lastMessageAt = data.lastMessageAt || null;
    this.unreadCount = data.unreadCount || 0;
    this.messageCount = data.messageCount || 0;
    this.status = data.status || 'open';
    this.assignedTo = data.assignedTo || null;
    this.createdAt = data.createdAt || Timestamp.now();
    this.updatedAt = data.updatedAt || Timestamp.now();
  }

  /**
   * ✅ NUEVO: Validar y normalizar participantes
   * @param {Array} participants - Array de números de teléfono
   * @returns {Array} - Array de números normalizados
   */
  validateAndNormalizeParticipants (participants) {
    if (!Array.isArray(participants)) {
      logger.warn('Participants debe ser un array', { participants });
      return [];
    }

    const normalizedParticipants = [];
    const errors = [];

    participants.forEach((phone, index) => {
      const validation = validateAndNormalizePhone(phone, { logErrors: false });
      
      if (validation.isValid) {
        normalizedParticipants.push(validation.normalized);
      } else {
        errors.push(`Participante ${index + 1}: ${validation.error}`);
        logger.warn('Participante inválido', { phone, error: validation.error });
      }
    });

    if (errors.length > 0) {
      logger.warn('Errores en validación de participantes', { errors });
    }

    return normalizedParticipants;
  }

  /**
   * Identifica cuál número es del cliente y cuál del agente
   */
  getCustomerPhone () {
    const businessPhone = process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:', '') || '';
    return this.participants.find(phone => phone !== businessPhone) || this.participants[0];
  }

  getAgentPhone () {
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
      sortOrder = 'desc',
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
      updatedAt: FieldValue.serverTimestamp(),
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
   * ✅ NUEVO: Decrementar messageCount cuando se elimina un mensaje
   * @param {Object} deletedMessage - Mensaje que se eliminó
   * @param {Object} newLastMessage - Nuevo último mensaje (opcional)
   */
  async decrementMessageCount (deletedMessage, newLastMessage = null) {
    const updates = {
      messageCount: FieldValue.increment(-1),
    };

    // Si se eliminó el último mensaje, actualizar lastMessage
    if (newLastMessage) {
      updates.lastMessage = newLastMessage.content || '[Multimedia]';
      updates.lastMessageAt = newLastMessage.timestamp;
      updates.lastMessageId = newLastMessage.id;
    } else if (deletedMessage.id === this.lastMessageId) {
      // Si se eliminó el último mensaje y no se proporcionó reemplazo,
      // se necesitará recalcular manualmente
      updates.lastMessage = '[Mensaje eliminado]';
      updates.lastMessageAt = FieldValue.serverTimestamp();
      updates.lastMessageId = null;
    }

    // Decrementar unreadCount si el mensaje eliminado era inbound y no leído
    if (deletedMessage.direction === 'inbound' && deletedMessage.status !== 'read') {
      updates.unreadCount = FieldValue.increment(-1);
    }

    await this.update(updates);
  }

  /**
   * ✅ NUEVO: Recalcular messageCount basándose en el número real de mensajes
   * Útil para corregir inconsistencias
   */
  async recalculateMessageCount () {
    // Contar mensajes reales en la subcolección
    const messagesSnapshot = await firestore
      .collection('conversations')
      .doc(this.id)
      .collection('messages')
      .get();

    const actualCount = messagesSnapshot.size;

    // Actualizar solo si hay diferencia
    if (this.messageCount !== actualCount) {
      await this.update({
        messageCount: actualCount,
      });

      this.messageCount = actualCount;
    }

    return actualCount;
  }

  /**
   * Marcar mensajes como leídos
   */
  static async markAsRead (_userId) {
    const docRef = firestore.collection('conversations').doc(this.id);
    await docRef.update({
      unreadCount: 0,
      updatedAt: FieldValue.serverTimestamp(),
    });
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
        assignedBy: userId,
      },
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
        previousStatus: this.status,
      },
    };

    await this.update(updates);
  }

  /**
   * ✅ REFACTORIZADO: Obtener estadísticas de la conversación
   * Usa modelo Message centralizado en lugar de queries directos
   */
  async getStats () {
    try {
      // ✅ CENTRALIZADO: Usar modelo Message para obtener estadísticas
      const Message = require('./Message');

      // Para esta conversación específica, necesitamos filtrar por conversationId
      // Esto es más eficiente que hacer query directo
      const messages = await Message.getByConversation(this.id, {
        limit: 1000, // Límite alto para obtener todas las estadísticas
        orderBy: 'timestamp',
        order: 'asc',
      });

      // ✅ CENTRALIZADO: Usar la misma lógica de cálculo que Message.getStats()
      const stats = {
        totalMessages: messages.length,
        inboundMessages: messages.filter(m => m.direction === 'inbound').length,
        outboundMessages: messages.filter(m => m.direction === 'outbound').length,
        unreadMessages: messages.filter(m => m.status !== 'read').length,
        firstMessageAt: messages.length > 0 ? messages[0].timestamp : null,
        lastMessageAt: messages.length > 0 ? messages[messages.length - 1].timestamp : null,
        averageResponseTime: this.calculateAverageResponseTime(messages),
      };

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de conversación', {
        conversationId: this.id,
        error: error.message,
      });

      // Fallback con estadísticas básicas
      return {
        totalMessages: this.messageCount || 0,
        inboundMessages: 0,
        outboundMessages: 0,
        unreadMessages: this.unreadCount || 0,
        firstMessageAt: null,
        lastMessageAt: this.lastMessageAt,
        averageResponseTime: null,
      };
    }
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
   * ✅ CORREGIDO: Convertir a objeto plano para respuestas JSON
   * ESTRUCTURA CANÓNICA según especificación del frontend
   */
  toJSON () {
    // ✅ Normalizar timestamps a ISO strings
    let normalizedCreatedAt = null;
    let normalizedUpdatedAt = null;

    if (this.createdAt && typeof this.createdAt.toDate === 'function') {
      normalizedCreatedAt = this.createdAt.toDate().toISOString();
    } else if (this.createdAt instanceof Date) {
      normalizedCreatedAt = this.createdAt.toISOString();
    } else if (typeof this.createdAt === 'string') {
      normalizedCreatedAt = this.createdAt;
    }

    if (this.updatedAt && typeof this.updatedAt.toDate === 'function') {
      normalizedUpdatedAt = this.updatedAt.toDate().toISOString();
    } else if (this.updatedAt instanceof Date) {
      normalizedUpdatedAt = this.updatedAt.toISOString();
    } else if (typeof this.updatedAt === 'string') {
      normalizedUpdatedAt = this.updatedAt;
    }

    // ✅ Construir objeto contact según especificación
    const contact = {
      id: this.customerPhone || this.contact?.id || 'unknown',
      name: this.contact?.name || this.customerPhone || 'Cliente',
      avatar: this.contact?.avatar || null,
      channel: 'whatsapp' // Por defecto WhatsApp, se puede extender
    };

    // ✅ Construir objeto assignedTo si existe
    let assignedTo = null;
    if (this.assignedTo) {
      assignedTo = {
        id: this.assignedTo,
        name: this.assignedToName || this.assignedTo, // Si no tenemos el nombre, usar el ID
      };
    }

    // ✅ VALIDACIÓN: Asegurar que participants siempre sea un array
    const participants = Array.isArray(this.participants) ? this.participants : [];

    // ✅ VALIDACIÓN: Asegurar que todos los campos críticos estén presentes
    const result = {
      id: this.id,
      participants, // ✅ NUEVO: Campo participants requerido
      customerPhone: this.customerPhone || null,
      agentPhone: this.agentPhone || null,
      contact,
      assignedTo,
      status: this.status || 'open',
      unreadCount: this.unreadCount || 0,
      messageCount: this.messageCount || 0,
      lastMessage: this.lastMessage || null,
      lastMessageId: this.lastMessageId || null,
      lastMessageAt: this.lastMessageAt ? 
        (typeof this.lastMessageAt.toDate === 'function' ? 
          this.lastMessageAt.toDate().toISOString() : 
          this.lastMessageAt.toISOString()) : null,
      createdAt: normalizedCreatedAt,
      updatedAt: normalizedUpdatedAt,
    };

    // ✅ VALIDACIÓN: Log si faltan campos críticos
    const missingFields = [];
    if (!result.id) missingFields.push('id');
    if (!Array.isArray(result.participants)) missingFields.push('participants');
    if (!result.status) missingFields.push('status');

    if (missingFields.length > 0) {
      logger.warn('Campos críticos faltantes en Conversation.toJSON()', {
        conversationId: this.id,
        missingFields,
      });
    }

    return result;

    // ✅ ESTRUCTURA CANÓNICA EXACTA
    return {
      id: this.id,                                    // string único
      contact: contact,                               // objeto del contacto
      lastMessage: this.lastMessage || null,         // mensaje como objeto o null
      status: this.status || 'open',                 // string ('open', 'closed', 'pending', etc)
      assignedTo: assignedTo,                        // objeto del agente asignado o null
      createdAt: normalizedCreatedAt || new Date().toISOString(), // string ISO
      updatedAt: normalizedUpdatedAt || new Date().toISOString()  // string ISO
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
        conv.lastMessage.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .slice(0, limit);

    return conversations;
  }
}

module.exports = Conversation;
