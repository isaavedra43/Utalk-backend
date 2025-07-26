const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const logger = require('../utils/logger');
const { prepareForFirestore } = require('../utils/firestore');
// const { isValidConversationId } = require('../utils/conversation'); // DEPRECATED
const { validateAndNormalizePhone } = require('../utils/phoneValidation');
const { createCursor, parseCursor } = require('../utils/pagination');
const { safeDateToISOString } = require('../utils/dateHelpers');

class Message {
  constructor (data) {
    // ✅ ID y ConversationID (UUIDs)
    if (!data.id) throw new Error('Message ID es requerido');
    if (!data.conversationId) throw new Error('conversationId (UUID) es requerido');
    this.id = data.id;
    this.conversationId = data.conversationId;

    // ✅ Contenido
    if (!data.content && !data.mediaUrl) {
      throw new Error('Message debe tener content o mediaUrl');
    }
    this.content = data.content || null;
    this.mediaUrl = data.mediaUrl || null;
    
    // ✅ EMAIL-FIRST: Identificadores de remitente y destinatario.
    this.senderIdentifier = data.senderIdentifier; // Puede ser EMAIL o teléfono.
    this.recipientIdentifier = data.recipientIdentifier; // Puede ser EMAIL o teléfono.

    // ✅ DEPRECATED: Se eliminan los campos específicos de teléfono. La lógica se basa en los identifiers.
    // this.senderPhone = ...
    // this.recipientPhone = ...
    
    // ✅ CAMPOS OBLIGATORIOS CON VALORES POR DEFECTO
    this.direction = data.direction || 'inbound';
    this.type = data.type || (this.mediaUrl ? 'media' : 'text');
    this.status = data.status || 'sent';
    this.timestamp = data.timestamp || Timestamp.now();
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || Timestamp.now();
    this.updatedAt = data.updatedAt || Timestamp.now();
  }

  isPhone(identifier) {
    return typeof identifier === 'string' && identifier.startsWith('+');
  }

  /**
   * Crear mensaje en Firestore (EMAIL-FIRST)
   */
  static async create (messageData) {
    const message = new Message(messageData);

    const cleanData = prepareForFirestore({ ...message });

    // Guardar en la subcolección de la conversación
    await firestore
      .collection('conversations')
      .doc(message.conversationId)
      .collection('messages')
      .doc(message.id)
      .set(cleanData);
      
    logger.info('Mensaje guardado (EMAIL-FIRST)', {
      messageId: message.id,
      conversationId: message.conversationId,
      sender: message.senderIdentifier,
      recipient: message.recipientIdentifier,
    });
    
    // Actualizar conversación
    const Conversation = require('./Conversation');
    const conversation = await Conversation.getById(message.conversationId);
    if (conversation) {
      await conversation.updateLastMessage(message);
    }

    return message;
  }

  /**
   * ✅ OPTIMIZADO: Obtener mensajes por conversación con paginación basada en cursor
   * @param {string} conversationId - ID de la conversación
   * @param {Object} options - Opciones de paginación y filtros
   * @returns {Object} - Resultado con mensajes y metadata de paginación
   */
  static async getByConversation (conversationId, options = {}) {
    // La validación isValidConversationId se elimina porque ahora son UUIDs.
    // ... el resto de la lógica de getByConversation permanece igual

    const {
      limit = 20,
      cursor = null,
      direction = null,
      status = null,
      type = null,
      startDate = null,
      endDate = null,
      orderBy = 'timestamp',
      order = 'desc',
    } = options;

    // ✅ VALIDACIÓN: Límites de paginación
    const validatedLimit = Math.min(Math.max(limit, 1), 100);
    const validatedOrder = ['asc', 'desc'].includes(order) ? order : 'desc';

    // ✅ MONITOREO: Log de parámetros de consulta
    logger.info('Consultando mensajes por conversación', {
      conversationId,
      limit: validatedLimit,
      cursor: cursor ? 'presente' : 'ausente',
      filters: {
        direction,
        status,
        type,
        startDate: startDate ? 'presente' : 'ausente',
        endDate: endDate ? 'presente' : 'ausente',
      },
      orderBy,
      order: validatedOrder,
    });

    let query = firestore
      .collection('conversations')
      .doc(conversationId)
      .collection('messages');

    // ✅ APLICAR FILTROS
    const appliedFilters = [];

    if (direction) {
      query = query.where('direction', '==', direction);
      appliedFilters.push(`direction: ${direction}`);
    }

    if (status) {
      query = query.where('status', '==', status);
      appliedFilters.push(`status: ${status}`);
    }

    if (type) {
      query = query.where('type', '==', type);
      appliedFilters.push(`type: ${type}`);
    }

    if (startDate) {
      const startTimestamp = startDate instanceof Date ? Timestamp.fromDate(startDate) : startDate;
      query = query.where('timestamp', '>=', startTimestamp);
      appliedFilters.push(`startDate: ${startDate}`);
    }

    if (endDate) {
      const endTimestamp = endDate instanceof Date ? Timestamp.fromDate(endDate) : endDate;
      query = query.where('timestamp', '<=', endTimestamp);
      appliedFilters.push(`endDate: ${endDate}`);
    }

    // ✅ ORDENAMIENTO
    query = query.orderBy(orderBy, validatedOrder);

    // ✅ PAGINACIÓN BASADA EN CURSOR
    if (cursor) {
      try {
        const cursorData = parseCursor(cursor);
        if (cursorData.conversationId === conversationId) {
          query = query.startAfter(cursorData.documentSnapshot);
        } else {
          logger.warn('Cursor de conversación diferente', {
            cursorConversationId: cursorData.conversationId,
            requestedConversationId: conversationId,
          });
        }
      } catch (error) {
        logger.error('Error parseando cursor', { cursor, error: error.message });
      }
    }

    // ✅ APLICAR LÍMITE
    query = query.limit(validatedLimit + 1); // +1 para determinar si hay más páginas

    // ✅ EJECUTAR CONSULTA
    const startTime = Date.now();
    const snapshot = await query.get();
    const queryTime = Date.now() - startTime;

    // ✅ PROCESAR RESULTADOS
    const messages = [];
    let hasMore = false;

    snapshot.docs.forEach((doc, index) => {
      if (index < validatedLimit) {
        messages.push(new Message({ id: doc.id, ...doc.data() }));
      } else {
        hasMore = true;
      }
    });

    // ✅ GENERAR CURSOR PARA SIGUIENTE PÁGINA
    let nextCursor = null;
    if (hasMore && messages.length > 0) {
      const lastDoc = snapshot.docs[validatedLimit - 1];
      nextCursor = createCursor({
        conversationId,
        documentSnapshot: lastDoc,
        timestamp: lastDoc.data().timestamp,
      });
    }

    // ✅ MONITOREO: Log de resultados
    logger.info('Consulta de mensajes completada', {
      conversationId,
      totalResults: messages.length,
      hasMore,
      queryTime: `${queryTime}ms`,
      appliedFilters: appliedFilters.length > 0 ? appliedFilters : ['ninguno'],
      nextCursor: nextCursor ? 'presente' : 'ausente',
    });

    return {
      messages,
      pagination: {
        hasMore,
        nextCursor,
        totalResults: messages.length,
        limit: validatedLimit,
        orderBy,
        order: validatedOrder,
      },
      metadata: {
        conversationId,
        appliedFilters,
        queryTime: `${queryTime}ms`,
      },
    };
  }

  /**
   * Obtener mensaje por ID
   */
  static async getById (conversationId, messageId) {
    // La validación isValidConversationId se elimina porque ahora son UUIDs.
    // ... el resto de la lógica de getById permanece igual

    const doc = await firestore
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .doc(messageId)
      .get();

    if (!doc.exists) {
      return null;
    }

    return new Message({ id: doc.id, ...doc.data() });
  }

  /**
   * Actualizar mensaje
   */
  async update (updates) {
    const cleanData = prepareForFirestore({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await firestore
      .collection('conversations')
      .doc(this.conversationId)
      .collection('messages')
      .doc(this.id)
      .update(cleanData);

    // Actualizar instancia local
    Object.assign(this, updates);
    this.updatedAt = Timestamp.now();
  }

  /**
   * Eliminar mensaje
   */
  async delete () {
    await firestore
      .collection('conversations')
      .doc(this.conversationId)
      .collection('messages')
      .doc(this.id)
      .delete();

    // Actualizar conversación
    const Conversation = require('./Conversation');
    const conversation = await Conversation.getById(this.conversationId);
    if (conversation) {
      await conversation.decrementMessageCount(this);
    }
  }

  /**
   * Marcar como leído
   */
  async markAsRead () {
    await this.update({
      status: 'read',
    });

    this.status = 'read';
  }

  /**
   * Obtener estadísticas de mensajes
   */
  static async getStats (conversationId, options = {}) {
    // La validación isValidConversationId se elimina porque ahora son UUIDs.
    // ... el resto de la lógica de getStats permanece igual

    const { startDate = null, endDate = null } = options;

    let query = firestore
      .collection('conversations')
      .doc(conversationId)
      .collection('messages');

    if (startDate) {
      const startTimestamp = startDate instanceof Date ? Timestamp.fromDate(startDate) : startDate;
      query = query.where('timestamp', '>=', startTimestamp);
    }

    if (endDate) {
      const endTimestamp = endDate instanceof Date ? Timestamp.fromDate(endDate) : endDate;
      query = query.where('timestamp', '<=', endTimestamp);
    }

    const snapshot = await query.get();

    const messages = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    }));

    // Calcular estadísticas
    const stats = {
      totalMessages: messages.length,
      inboundMessages: messages.filter(m => m.direction === 'inbound').length,
      outboundMessages: messages.filter(m => m.direction === 'outbound').length,
      readMessages: messages.filter(m => m.status === 'read').length,
      unreadMessages: messages.filter(m => m.status !== 'read').length,
      textMessages: messages.filter(m => m.type === 'text').length,
      mediaMessages: messages.filter(m => m.type !== 'text').length,
      firstMessageAt: messages.length > 0 ? messages[0].timestamp : null,
      lastMessageAt: messages.length > 0 ? messages[messages.length - 1].timestamp : null,
      averageResponseTime: this.calculateAverageResponseTime(messages),
    };

    return stats;
  }

  /**
   * Calcular tiempo promedio de respuesta
   */
  static calculateAverageResponseTime (messages) {
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
   * ✅ EMAIL-FIRST: Convertir a objeto plano para respuestas JSON
   */
  toJSON () {
    const normalizedTimestamp = safeDateToISOString(this.timestamp);
    const normalizedCreatedAt = safeDateToISOString(this.createdAt);
    const normalizedUpdatedAt = safeDateToISOString(this.updatedAt);

    return {
      id: this.id,
      conversationId: this.conversationId,
      content: this.content,
      mediaUrl: this.mediaUrl,
      
      sender: {
        identifier: this.senderIdentifier,
        type: this.isPhone(this.senderIdentifier) ? 'customer' : 'agent',
      },
      recipient: {
        identifier: this.recipientIdentifier,
        type: this.isPhone(this.recipientIdentifier) ? 'customer' : 'agent',
      },

      direction: this.direction,
      type: this.type,
      status: this.status,
      timestamp: normalizedTimestamp,
      metadata: this.metadata,
      createdAt: normalizedCreatedAt,
      updatedAt: normalizedUpdatedAt,
    };
  }

  /**
   * Buscar mensajes
   */
  static async search (conversationId, searchTerm, options = {}) {
    // La validación isValidConversationId se elimina porque ahora son UUIDs.
    // ... el resto de la lógica de search permanece igual

    const messages = await this.getByConversation(conversationId, { ...options, limit: 1000 });
    return messages.messages.filter(message =>
      message.content?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }
}

module.exports = Message;
