const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const { prepareForFirestore } = require('../utils/firestore');
const { isValidConversationId } = require('../utils/conversation');

class Message {
  constructor (data) {
    // Validación crítica: conversationId es obligatorio
    if (!data.conversationId) {
      throw new Error('conversationId es obligatorio para crear un mensaje');
    }

    if (!isValidConversationId(data.conversationId)) {
      throw new Error(`conversationId inválido: ${data.conversationId}. Debe tener formato conv_XXXXXX_YYYYYY`);
    }

    // Validar campos críticos
    if (!data.from || !data.to) {
      throw new Error('Los campos from y to son obligatorios');
    }

    if (!data.direction || !['inbound', 'outbound'].includes(data.direction)) {
      throw new Error('direction debe ser "inbound" o "outbound"');
    }

    this.id = data.id || uuidv4();
    this.conversationId = data.conversationId; // SIEMPRE requerido
    this.from = data.from; // Número de teléfono
    this.to = data.to; // Número de teléfono
    this.content = data.content || '';
    this.type = data.type || 'text'; // 'text', 'image', 'document', 'audio'
    this.direction = data.direction; // 'inbound', 'outbound'
    this.status = data.status || 'pending'; // 'pending', 'sent', 'delivered', 'read', 'failed'
    this.twilioSid = data.twilioSid; // ID de Twilio

    this.metadata = data.metadata || {}; // Información adicional
    this.userId = data.userId; // Usuario que envió el mensaje (si es outbound)
    this.timestamp = data.timestamp || Timestamp.now();
    this.createdAt = data.createdAt || Timestamp.now();
    this.updatedAt = data.updatedAt || Timestamp.now();
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
   * Convertir a JSON
   */
  toJSON () {
    return {
      id: this.id,
      conversationId: this.conversationId,
      from: this.from,
      to: this.to,
      content: this.content,
      text: this.content, // Mapping para compatibilidad con frontend
      type: this.type,
      direction: this.direction,
      status: this.status,
      twilioSid: this.twilioSid,
      metadata: this.metadata,
      userId: this.userId,
      timestamp: this.timestamp,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

module.exports = Message;
