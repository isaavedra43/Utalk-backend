const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const logger = require('../utils/logger');
const { prepareForFirestore } = require('../utils/firestore');
const { isValidConversationId } = require('../utils/conversation');

class Message {
  constructor (data) {
    this.id = data.id;
    this.conversationId = data.conversationId;
    this.sender = data.sender;
    this.content = data.content;
    this.timestamp = data.timestamp;
    this.media = data.media;
    this.status = data.status || 'sent';
  }

  /**
   * Crear un nuevo mensaje en la subcolección correspondiente
   */
  static async create (messageData) {
    const message = new Message(messageData);

    // Preparar datos para Firestore, removiendo campos undefined/null/vacíos
    const cleanData = prepareForFirestore({
      ...message,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      timestamp: FieldValue.serverTimestamp(),
    });

    // Guardar en subcolección: /conversations/{conversationId}/messages/{messageId}
    await firestore
      .collection('conversations')
      .doc(message.conversationId)
      .collection('messages')
      .doc(message.id)
      .set(cleanData);

    return message;
  }

  /**
   * Obtener mensaje por ID buscando en todas las conversaciones
   * NOTA: Esta operación es costosa, usar solo cuando no se conoce el conversationId
   * Idealmente, la API debería incluir conversationId en la ruta
   */
  static async getByIdAnyConversation (messageId) {
    const conversationsSnapshot = await firestore.collection('conversations').get();

    for (const conversationDoc of conversationsSnapshot.docs) {
      const messageDoc = await firestore
        .collection('conversations')
        .doc(conversationDoc.id)
        .collection('messages')
        .doc(messageId)
        .get();

      if (messageDoc.exists) {
        return new Message({
          id: messageDoc.id,
          conversationId: conversationDoc.id,
          ...messageDoc.data(),
        });
      }
    }

    return null;
  }

  /**
   * Obtener mensaje por ID y conversationId
   */
  static async getById (messageId, conversationId) {
    if (!conversationId) {
      throw new Error('conversationId es requerido para obtener un mensaje por ID');
    }

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
    return new Message({ id: doc.id, conversationId, ...doc.data() });
  }

  /**
   * Obtener mensajes por conversación con paginación
   * Maneja tanto timestamp como createdAt para retrocompatibilidad
   */
  static async getByConversation (conversationId, options = {}) {
    const {
      limit = 50,
      startAfter = null,
      orderBy = 'timestamp',
      order = 'desc',
    } = options;

    if (!isValidConversationId(conversationId)) {
      throw new Error(`conversationId inválido: ${conversationId}`);
    }

    // SOLUCIÓN PARA TIMESTAMP VS CREATEDAT
    // Primero intentar con el campo solicitado, luego fallback
    let query = firestore
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy(orderBy, order);

    if (startAfter) {
      // Obtener el documento de referencia para paginación
      const startAfterDoc = await firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .doc(startAfter)
        .get();

      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    }

    query = query.limit(limit);

    try {
      const snapshot = await query.get();

      // Si no hay resultados y estábamos buscando por timestamp, intentar con createdAt
      if (snapshot.empty && orderBy === 'timestamp') {
        console.warn(`No se encontraron mensajes con timestamp para conversación ${conversationId}, intentando con createdAt`);

        let fallbackQuery = firestore
          .collection('conversations')
          .doc(conversationId)
          .collection('messages')
          .orderBy('createdAt', order);

        if (startAfter) {
          const startAfterDoc = await firestore
            .collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .doc(startAfter)
            .get();

          if (startAfterDoc.exists) {
            fallbackQuery = fallbackQuery.startAfter(startAfterDoc);
          }
        }

        fallbackQuery = fallbackQuery.limit(limit);
        const fallbackSnapshot = await fallbackQuery.get();

        return fallbackSnapshot.docs.map(doc => new Message({
          id: doc.id,
          conversationId,
          ...doc.data(),
        }));
      }

      return snapshot.docs.map(doc => new Message({
        id: doc.id,
        conversationId,
        ...doc.data(),
      }));
    } catch (error) {
      // Si falla la query principal (posiblemente por índice faltante), intentar con createdAt
      if (orderBy === 'timestamp') {
        console.warn(`Error en query con timestamp para conversación ${conversationId}, intentando con createdAt:`, error.message);

        let fallbackQuery = firestore
          .collection('conversations')
          .doc(conversationId)
          .collection('messages')
          .orderBy('createdAt', order);

        if (startAfter) {
          const startAfterDoc = await firestore
            .collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .doc(startAfter)
            .get();

          if (startAfterDoc.exists) {
            fallbackQuery = fallbackQuery.startAfter(startAfterDoc);
          }
        }

        fallbackQuery = fallbackQuery.limit(limit);
        const fallbackSnapshot = await fallbackQuery.get();

        return fallbackSnapshot.docs.map(doc => new Message({
          id: doc.id,
          conversationId,
          ...doc.data(),
        }));
      }

      throw error;
    }
  }

  /**
   * Obtener mensaje por SID de Twilio buscando en todas las conversaciones
   * NOTA: Esta operación es menos eficiente, considerar cachear twilioSid -> conversationId
   */
  static async getByTwilioSid (twilioSid) {
    // Necesitamos buscar en todas las conversaciones ya que no sabemos en cuál está
    // Esta es una operación costosa, considerar implementar un índice separado
    const conversationsSnapshot = await firestore.collection('conversations').get();

    for (const conversationDoc of conversationsSnapshot.docs) {
      const messagesSnapshot = await firestore
        .collection('conversations')
        .doc(conversationDoc.id)
        .collection('messages')
        .where('twilioSid', '==', twilioSid)
        .limit(1)
        .get();

      if (!messagesSnapshot.empty) {
        const messageDoc = messagesSnapshot.docs[0];
        return new Message({
          id: messageDoc.id,
          conversationId: conversationDoc.id,
          ...messageDoc.data(),
        });
      }
    }

    return null;
  }

  /**
   * Listar mensajes entre dos números usando conversationId
   */
  static async getByPhones (phone1, phone2, { limit = 50, startAfter = null } = {}) {
    // Importar función para generar conversationId
    const { generateConversationId } = require('../utils/conversation');

    // Generar conversationId basado en los teléfonos
    const conversationId = generateConversationId(phone1, phone2);

    // Usar getByConversation que ya está optimizado
    return await this.getByConversation(conversationId, { limit, startAfter });
  }

  /**
   * Obtener mensajes recientes para un usuario buscando en todas las conversaciones
   * NOTA: Operación costosa, considerar implementar una vista materializada
   */
  static async getRecentMessages (userId, limit = 20) {
    const conversationsSnapshot = await firestore.collection('conversations').get();
    const allMessages = [];

    // Buscar en cada conversación los mensajes del usuario
    for (const conversationDoc of conversationsSnapshot.docs) {
      try {
        const messagesSnapshot = await firestore
          .collection('conversations')
          .doc(conversationDoc.id)
          .collection('messages')
          .where('userId', '==', userId)
          .orderBy('timestamp', 'desc')
          .limit(limit)
          .get();

        const conversationMessages = messagesSnapshot.docs.map(doc =>
          new Message({
            id: doc.id,
            conversationId: conversationDoc.id,
            ...doc.data(),
          }),
        );

        allMessages.push(...conversationMessages);
      } catch (error) {
        // Log error pero continuar con otras conversaciones
        console.warn(`Error al obtener mensajes de conversación ${conversationDoc.id}:`, error.message);
      }
    }

    // Ordenar todos los mensajes y limitar
    return allMessages
      .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
      .slice(0, limit);
  }

  /**
   * Buscar mensajes por término en todas las conversaciones
   */
  static async search (searchTerm, userId = null) {
    const conversationsSnapshot = await firestore.collection('conversations').get();
    const allMessages = [];

    for (const conversationDoc of conversationsSnapshot.docs) {
      try {
        let query = firestore
          .collection('conversations')
          .doc(conversationDoc.id)
          .collection('messages');

        if (userId) {
          query = query.where('userId', '==', userId);
        }

        const snapshot = await query.get();
        const searchLower = searchTerm.toLowerCase();

        const filteredMessages = snapshot.docs
          .map(doc => new Message({
            id: doc.id,
            conversationId: conversationDoc.id,
            ...doc.data(),
          }))
          .filter(message =>
            message.content.toLowerCase().includes(searchLower) ||
            message.from.includes(searchTerm) ||
            message.to.includes(searchTerm),
          );

        allMessages.push(...filteredMessages);
      } catch (error) {
        console.warn(`Error al buscar en conversación ${conversationDoc.id}:`, error.message);
      }
    }

    return allMessages.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
  }

  /**
   * Obtener estadísticas de mensajes
   */
  static async getStats (userId = null, startDate = null, endDate = null) {
    const conversationsSnapshot = await firestore.collection('conversations').get();
    let totalMessages = 0;
    let sentMessages = 0;
    let receivedMessages = 0;
    let failedMessages = 0;

    for (const conversationDoc of conversationsSnapshot.docs) {
      try {
        let query = firestore
          .collection('conversations')
          .doc(conversationDoc.id)
          .collection('messages');

        if (userId) {
          query = query.where('userId', '==', userId);
        }

        if (startDate) {
          query = query.where('timestamp', '>=', Timestamp.fromDate(startDate));
        }

        if (endDate) {
          query = query.where('timestamp', '<=', Timestamp.fromDate(endDate));
        }

        const snapshot = await query.get();

        snapshot.docs.forEach(doc => {
          const data = doc.data();
          totalMessages++;

          if (data.direction === 'outbound') {
            sentMessages++;
          } else {
            receivedMessages++;
          }

          if (data.status === 'failed') {
            failedMessages++;
          }
        });
      } catch (error) {
        console.warn(`Error al obtener estadísticas de conversación ${conversationDoc.id}:`, error.message);
      }
    }

    return {
      total: totalMessages,
      sent: sentMessages,
      received: receivedMessages,
      failed: failedMessages,
      successRate: totalMessages > 0 ? ((totalMessages - failedMessages) / totalMessages) * 100 : 0,
    };
  }

  /**
   * Marcar mensaje como leído
   */
  async markAsRead () {
    const validUpdates = prepareForFirestore({
      status: 'read',
      updatedAt: FieldValue.serverTimestamp(),
    });

    await firestore
      .collection('conversations')
      .doc(this.conversationId)
      .collection('messages')
      .doc(this.id)
      .update(validUpdates);

    this.status = 'read';
    this.updatedAt = Timestamp.now();
  }

  /**
   * Actualizar estado del mensaje
   */
  async updateStatus (newStatus) {
    const validStatuses = ['pending', 'sent', 'delivered', 'read', 'failed'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Estado inválido: ${newStatus}`);
    }

    const validUpdates = prepareForFirestore({
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await firestore
      .collection('conversations')
      .doc(this.conversationId)
      .collection('messages')
      .doc(this.id)
      .update(validUpdates);

    this.status = newStatus;
    this.updatedAt = Timestamp.now();
  }

  /**
   * Eliminar mensaje (soft delete)
   */
  async delete () {
    await firestore
      .collection('conversations')
      .doc(this.conversationId)
      .collection('messages')
      .doc(this.id)
      .delete();
  }

  /**
   * Convertir a JSON con validación y normalización de campos obligatorios
   */
  toJSON () {
    let normalizedTimestamp;
    if (this.timestamp && typeof this.timestamp.toDate === 'function') {
      normalizedTimestamp = this.timestamp.toDate().toISOString();
    } else if (this.timestamp instanceof Date) {
      normalizedTimestamp = this.timestamp.toISOString();
    } else if (typeof this.timestamp === 'string') {
      normalizedTimestamp = this.timestamp;
    } else {
      normalizedTimestamp = new Date().toISOString();
    }

    return {
      id: this.id,
      conversationId: this.conversationId,
      sender: this.sender,
      content: this.content,
      timestamp: normalizedTimestamp,
      media: this.media,
      status: this.status,
    };
  }

  /**
   * ✅ NUEVO: Eliminar mensaje y actualizar messageCount automáticamente
   * @param {string} messageId - ID del mensaje a eliminar
   * @param {string} conversationId - ID de la conversación
   * @returns {boolean} True si se eliminó correctamente
   */
  static async deleteById (messageId, conversationId) {
    if (!conversationId) {
      throw new Error('conversationId es requerido para eliminar un mensaje');
    }

    if (!isValidConversationId(conversationId)) {
      throw new Error(`conversationId inválido: ${conversationId}`);
    }

    try {
      // Obtener el mensaje antes de eliminarlo
      const messageToDelete = await this.getById(messageId, conversationId);
      if (!messageToDelete) {
        logger.warn('Intento de eliminar mensaje inexistente', {
          messageId,
          conversationId,
        });
        return false;
      }

      // Verificar si es el último mensaje
      const Conversation = require('./Conversation');
      const conversation = await Conversation.getById(conversationId);

      let newLastMessage = null;
      if (conversation && messageToDelete.id === conversation.lastMessageId) {
        // Buscar el mensaje anterior
        const previousMessages = await this.getByConversation(conversationId, {
          limit: 2,
          orderBy: 'timestamp',
          order: 'desc',
        });

        // El segundo mensaje (índice 1) será el nuevo último mensaje
        newLastMessage = previousMessages.length > 1 ? previousMessages[1] : null;
      }

      // Eliminar el mensaje de Firestore
      await firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .doc(messageId)
        .delete();

      // Actualizar messageCount en la conversación
      if (conversation) {
        await conversation.decrementMessageCount(messageToDelete, newLastMessage);
      }

      logger.info('Mensaje eliminado y messageCount actualizado', {
        messageId,
        conversationId,
        wasLastMessage: messageToDelete.id === conversation?.lastMessageId,
        newLastMessageId: newLastMessage?.id || null,
      });

      return true;
    } catch (error) {
      logger.error('Error eliminando mensaje', {
        messageId,
        conversationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * ✅ NUEVO: Eliminar múltiples mensajes y actualizar messageCount
   * @param {Array} messageIds - Array de IDs de mensajes a eliminar
   * @param {string} conversationId - ID de la conversación
   * @returns {Object} Resultado con estadísticas
   */
  static async deleteBatch (messageIds, conversationId) {
    if (!conversationId || !Array.isArray(messageIds) || messageIds.length === 0) {
      throw new Error('conversationId y array de messageIds son requeridos');
    }

    const batch = firestore.batch();
    let deletedCount = 0;
    const errors = [];

    try {
      // Procesar cada mensaje
      for (const messageId of messageIds) {
        try {
          const messageRef = firestore
            .collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .doc(messageId);

          batch.delete(messageRef);
          deletedCount++;
        } catch (error) {
          errors.push({ messageId, error: error.message });
        }
      }

      // Ejecutar eliminación batch
      await batch.commit();

      // Recalcular messageCount completo (más seguro para operaciones batch)
      const Conversation = require('./Conversation');
      const conversation = await Conversation.getById(conversationId);
      if (conversation) {
        await conversation.recalculateMessageCount();
      }

      logger.info('Eliminación batch completada', {
        conversationId,
        totalRequested: messageIds.length,
        deletedCount,
        errorsCount: errors.length,
      });

      return {
        success: true,
        deletedCount,
        errors,
        totalRequested: messageIds.length,
      };
    } catch (error) {
      logger.error('Error en eliminación batch', {
        conversationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * ✅ NUEVO: Búsqueda global centralizada de mensajes
   * Garantiza formato consistente para cualquier módulo que necesite buscar mensajes
   * @param {Object} searchOptions - Opciones de búsqueda
   * @returns {Array} Mensajes con formato estandarizado
   */
  static async searchGlobal (searchOptions = {}) {
    const {
      query = '',
      userId = null,
      conversationIds = [], // Array de IDs de conversación específicos
      dateRange = null, // { start: Date, end: Date }
      direction = null, // 'inbound' | 'outbound'
      status = null, // 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
      limit = 100,
      orderBy = 'timestamp',
      order = 'desc',
    } = searchOptions;

    try {
      let allMessages = [];

      if (conversationIds.length > 0) {
        // ✅ CENTRALIZADO: Buscar en conversaciones específicas
        for (const conversationId of conversationIds) {
          if (isValidConversationId(conversationId)) {
            const messages = await this.getByConversation(conversationId, {
              limit,
              orderBy,
              order,
            });
            allMessages.push(...messages);
          }
        }
      } else {
        // ✅ CENTRALIZADO: Usar método search existente
        allMessages = await this.search(query, userId);
      }

      // ✅ FILTROS ADICIONALES usando lógica centralizada
      let filteredMessages = allMessages;

      if (direction) {
        filteredMessages = filteredMessages.filter(msg => msg.direction === direction);
      }

      if (status) {
        filteredMessages = filteredMessages.filter(msg => msg.status === status);
      }

      if (dateRange && dateRange.start && dateRange.end) {
        filteredMessages = filteredMessages.filter(msg => {
          const msgTime = msg.timestamp instanceof Date
            ? msg.timestamp
            : new Date(msg.timestamp);
          return msgTime >= dateRange.start && msgTime <= dateRange.end;
        });
      }

      // ✅ ORDENAMIENTO Y LÍMITE
      if (orderBy === 'timestamp') {
        filteredMessages.sort((a, b) => {
          const timeA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
          const timeB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
          return order === 'desc' ? timeB - timeA : timeA - timeB;
        });
      }

      // ✅ FORMATO ESTANDARIZADO: Usar toJSON() para consistencia
      const formattedMessages = filteredMessages
        .slice(0, limit)
        .map(message => message.toJSON ? message.toJSON() : message);

      logger.info('Búsqueda global de mensajes completada', {
        searchQuery: query,
        totalFound: filteredMessages.length,
        returned: formattedMessages.length,
        filters: { direction, status, userId },
      });

      return formattedMessages;
    } catch (error) {
      logger.error('Error en búsqueda global de mensajes', {
        error: error.message,
        searchOptions,
      });
      throw error;
    }
  }

  /**
   * ✅ NUEVO: Obtener mensajes por múltiples criterios (para Dashboard y Campañas)
   * Centraliza lógica que podría duplicarse en otros módulos
   * @param {Object} criteria - Criterios de búsqueda
   * @returns {Object} Resultado con estadísticas y mensajes
   */
  static async getMessagesByCriteria (criteria = {}) {
    const {
      userIds = [],
      conversationIds = [],
      dateRange = null,
      includeStats = true,
      limit = 50,
    } = criteria;

    try {
      let messages = [];
      let stats = null;

      // ✅ CENTRALIZADO: Buscar por conversaciones específicas
      if (conversationIds.length > 0) {
        for (const conversationId of conversationIds) {
          const convMessages = await this.getByConversation(conversationId, {
            limit,
            orderBy: 'timestamp',
            order: 'desc',
          });
          messages.push(...convMessages);
        }
      }

      // ✅ CENTRALIZADO: Buscar por usuarios específicos
      if (userIds.length > 0) {
        for (const userId of userIds) {
          const userMessages = await this.getByUserId(userId, {
            limit,
            orderBy: 'timestamp',
            order: 'desc',
          });
          messages.push(...userMessages);
        }
      }

      // ✅ FILTRO POR FECHA
      if (dateRange && dateRange.start && dateRange.end) {
        messages = messages.filter(msg => {
          const msgTime = msg.timestamp instanceof Date
            ? msg.timestamp
            : new Date(msg.timestamp);
          return msgTime >= dateRange.start && msgTime <= dateRange.end;
        });
      }

      // ✅ ESTADÍSTICAS OPCIONALES usando lógica centralizada
      if (includeStats) {
        stats = {
          total: messages.length,
          inbound: messages.filter(m => m.direction === 'inbound').length,
          outbound: messages.filter(m => m.direction === 'outbound').length,
          byStatus: {},
        };

        // Contar por status
        ['pending', 'sent', 'delivered', 'read', 'failed'].forEach(status => {
          stats.byStatus[status] = messages.filter(m => m.status === status).length;
        });
      }

      // ✅ FORMATO CONSISTENTE
      const formattedMessages = messages.map(message =>
        message.toJSON ? message.toJSON() : message,
      );

      return {
        messages: formattedMessages,
        stats,
        total: messages.length,
      };
    } catch (error) {
      logger.error('Error obteniendo mensajes por criterios', {
        error: error.message,
        criteria,
      });
      throw error;
    }
  }
}

module.exports = Message;
