const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const logger = require('../utils/logger');
const { prepareForFirestore } = require('../utils/firestore');
const { isValidConversationId } = require('../utils/conversation');
const { validateAndNormalizePhone } = require('../utils/phoneValidation');
const { createCursor, parseCursor } = require('../utils/pagination');
const { safeDateToISOString } = require('../utils/dateHelpers');

class Message {
  constructor (data) {
    // ✅ VALIDACIÓN: ID requerido
    if (!data.id) {
      throw new Error('Message ID es requerido');
    }
    this.id = data.id;

    // ✅ VALIDACIÓN: ConversationId requerido
    if (!data.conversationId || !isValidConversationId(data.conversationId)) {
      throw new Error(`conversationId inválido: ${data.conversationId}`);
    }
    this.conversationId = data.conversationId;

    // ✅ VALIDACIÓN: Contenido requerido
    if (!data.content && !data.mediaUrl) {
      throw new Error('Message debe tener content o mediaUrl');
    }
    this.content = data.content || null;
    this.mediaUrl = data.mediaUrl || null;

    // ✅ MAPEAR CAMPOS DE COMPATIBILIDAD
    // from/to -> senderPhone/recipientPhone
    this.senderPhone = data.senderPhone || data.from || null;
    this.recipientPhone = data.recipientPhone || data.to || null;

    // ✅ VALIDACIÓN: Teléfono del remitente
    if (this.senderPhone) {
      const senderValidation = validateAndNormalizePhone(this.senderPhone);
      if (!senderValidation.isValid) {
        throw new Error(`Teléfono del remitente inválido: ${senderValidation.error}`);
      }
      this.senderPhone = senderValidation.normalized;
    }

    // ✅ VALIDACIÓN: Teléfono del destinatario
    if (this.recipientPhone) {
      const recipientValidation = validateAndNormalizePhone(this.recipientPhone);
      if (!recipientValidation.isValid) {
        throw new Error(`Teléfono del destinatario inválido: ${recipientValidation.error}`);
      }
      this.recipientPhone = recipientValidation.normalized;
    }

    // ✅ CAMPOS OBLIGATORIOS CON VALORES POR DEFECTO
    this.sender = data.sender || 'customer';
    this.direction = data.direction || 'inbound';
    this.type = data.type || 'text';
    this.status = data.status || 'sent';
    this.timestamp = data.timestamp || Timestamp.now();
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || Timestamp.now();
    this.updatedAt = data.updatedAt || Timestamp.now();
  }

  /**
   * Crear mensaje en Firestore
   */
  static async create (messageData) {
    // ✅ GENERAR ID ÚNICO si no existe
    if (!messageData.id && !messageData.messageId) {
      // Usar twilioSid si está disponible, sino generar UUID
      messageData.id = messageData.twilioSid || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logger.info('ID de mensaje generado automáticamente', {
        generatedId: messageData.id,
        hasTwilioSid: !!messageData.twilioSid,
        conversationId: messageData.conversationId,
      });
    }

    // ✅ VALIDACIÓN: Asegurar que tenemos un ID
    if (!messageData.id) {
      throw new Error('No se pudo generar un ID para el mensaje');
    }

    const message = new Message(messageData);

    // Preparar datos para Firestore
    const cleanData = prepareForFirestore({
      ...message,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Crear en subcolección de la conversación
    await firestore
      .collection('conversations')
      .doc(message.conversationId)
      .collection('messages')
      .doc(message.id) // ✅ USAR ID GENERADO como document ID
      .set(cleanData);

    // ✅ LOG DE ÉXITO
    logger.info('Mensaje guardado exitosamente en Firebase', {
      messageId: message.id,
      conversationId: message.conversationId,
      direction: message.direction,
      type: message.type,
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
    if (!isValidConversationId(conversationId)) {
      throw new Error(`conversationId inválido: ${conversationId}`);
    }

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
    if (!isValidConversationId(conversationId)) {
      throw new Error(`conversationId inválido: ${conversationId}`);
    }

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
    if (!isValidConversationId(conversationId)) {
      throw new Error(`conversationId inválido: ${conversationId}`);
    }

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
   * ✅ CORREGIDO: Convertir a objeto plano para respuestas JSON
   * ESTRUCTURA CANÓNICA según especificación del frontend
   * SOLO usa senderPhone/recipientPhone - NO from/to
   * ✅ FECHAS SIEMPRE COMO STRING ISO: Utiliza safeDateToISOString
   */
  toJSON () {
    try {
      // ✅ FECHAS COMO STRING ISO 8601 - SIEMPRE
      const normalizedTimestamp = safeDateToISOString(this.timestamp);
      const normalizedCreatedAt = safeDateToISOString(this.createdAt);
      const normalizedUpdatedAt = safeDateToISOString(this.updatedAt);

      // ✅ VALIDACIÓN: Verificar que los teléfonos estén presentes y normalizados
      if (!this.senderPhone) {
        logger.error('Mensaje sin senderPhone en serialización', {
          messageId: this.id,
          conversationId: this.conversationId,
          direction: this.direction,
          sender: this.sender,
        });
      }

      if (!this.recipientPhone) {
        logger.error('Mensaje sin recipientPhone en serialización', {
          messageId: this.id,
          conversationId: this.conversationId,
          direction: this.direction,
          sender: this.sender,
        });
      }

      // ✅ VALIDACIÓN: Re-normalizar teléfonos antes de enviar
      let normalizedSenderPhone = this.senderPhone;
      let normalizedRecipientPhone = this.recipientPhone;

      if (this.senderPhone) {
        const senderValidation = validateAndNormalizePhone(this.senderPhone, { logErrors: false });
        if (senderValidation.isValid) {
          normalizedSenderPhone = senderValidation.normalized;
        } else {
          logger.error('senderPhone malformado en serialización', {
            messageId: this.id,
            originalPhone: this.senderPhone,
            error: senderValidation.error,
          });
        }
      }

      if (this.recipientPhone) {
        const recipientValidation = validateAndNormalizePhone(this.recipientPhone, { logErrors: false });
        if (recipientValidation.isValid) {
          normalizedRecipientPhone = recipientValidation.normalized;
        } else {
          logger.error('recipientPhone malformado en serialización', {
            messageId: this.id,
            originalPhone: this.recipientPhone,
            error: recipientValidation.error,
          });
        }
      }

      // ✅ VALIDACIÓN: Asegurar que todos los campos críticos estén presentes
      const result = {
        id: this.id,
        conversationId: this.conversationId,
        content: this.content,
        mediaUrl: this.mediaUrl,
        sender: this.sender,
        senderPhone: normalizedSenderPhone, // ✅ CAMPO PRINCIPAL
        recipientPhone: normalizedRecipientPhone, // ✅ CAMPO PRINCIPAL
        // ✅ ELIMINADOS: from y to ya NO se envían al frontend
        direction: this.direction,
        type: this.type,
        status: this.status,
        timestamp: normalizedTimestamp, // ✅ STRING ISO o null
        metadata: this.metadata || {},
        createdAt: normalizedCreatedAt, // ✅ STRING ISO o null
        updatedAt: normalizedUpdatedAt, // ✅ STRING ISO o null
      };

      // ✅ VALIDACIÓN: Log si faltan campos críticos
      const missingFields = [];
      if (!result.id) missingFields.push('id');
      if (!result.conversationId) missingFields.push('conversationId');
      if (!result.content && !result.mediaUrl) missingFields.push('content/mediaUrl');
      if (!result.sender) missingFields.push('sender');
      if (!result.senderPhone) missingFields.push('senderPhone');
      if (!result.recipientPhone) missingFields.push('recipientPhone');
      if (!result.direction) missingFields.push('direction');
      if (!result.type) missingFields.push('type');
      if (!result.status) missingFields.push('status');

      if (missingFields.length > 0) {
        logger.error('Campos críticos faltantes en Message.toJSON()', {
          messageId: this.id,
          conversationId: this.conversationId,
          missingFields,
        });
      }

      // ✅ LOGGING: Log detallado antes de enviar la respuesta
      logger.info('Mensaje serializado para frontend', {
        messageId: result.id,
        conversationId: result.conversationId,
        senderPhone: result.senderPhone,
        recipientPhone: result.recipientPhone,
        direction: result.direction,
        type: result.type,
        hasContent: !!result.content,
        hasMedia: !!result.mediaUrl,
        datesAsISO: {
          timestamp: normalizedTimestamp,
          createdAt: normalizedCreatedAt,
          updatedAt: normalizedUpdatedAt,
        },
      });

      return result;

    } catch (error) {
      // ✅ SAFETY NET: Nunca fallar la serialización
      logger.error('Error crítico en Message.toJSON()', {
        messageId: this.id,
        conversationId: this.conversationId,
        error: error.message,
        stack: error.stack,
        originalData: {
          senderPhone: this.senderPhone,
          recipientPhone: this.recipientPhone,
          timestamp: this.timestamp,
          createdAt: this.createdAt,
          updatedAt: this.updatedAt,
        },
      });

      // Retornar estructura mínima pero válida
      return {
        id: this.id || 'error',
        conversationId: this.conversationId || 'error',
        content: 'Error al serializar mensaje',
        mediaUrl: null,
        sender: 'system',
        senderPhone: null,
        recipientPhone: null,
        direction: 'error',
        type: 'text',
        status: 'error',
        timestamp: null,
        metadata: {},
        createdAt: null,
        updatedAt: null,
      };
    }
  }

  /**
   * Buscar mensajes
   */
  static async search (conversationId, searchTerm, options = {}) {
    if (!isValidConversationId(conversationId)) {
      throw new Error(`conversationId inválido: ${conversationId}`);
    }

    const messages = await this.getByConversation(conversationId, { ...options, limit: 1000 });
    return messages.messages.filter(message =>
      message.content?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }
}

module.exports = Message;
