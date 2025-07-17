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
    this.mediaUrls = data.mediaUrls || []; // URLs de archivos multimedia
    this.metadata = data.metadata || {}; // Información adicional
    this.userId = data.userId; // Usuario que envió el mensaje (si es outbound)
    this.timestamp = data.timestamp || Timestamp.now();
    this.createdAt = data.createdAt || Timestamp.now();
    this.updatedAt = data.updatedAt || Timestamp.now();
  }

  /**
   * Crear un nuevo mensaje
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

    await firestore.collection('messages').doc(message.id).set(cleanData);
    return message;
  }

  /**
   * Obtener mensaje por ID
   */
  static async getById (id) {
    const doc = await firestore.collection('messages').doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return new Message({ id: doc.id, ...doc.data() });
  }

  /**
   * Obtener mensajes por conversación con paginación
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

    let query = firestore
      .collection('messages')
      .where('conversationId', '==', conversationId)
      .orderBy(orderBy, order);

    if (startAfter) {
      // Obtener el documento de referencia para paginación
      const startAfterDoc = await firestore.collection('messages').doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    }

    query = query.limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => new Message({ id: doc.id, ...doc.data() }));
  }

  /**
   * Obtener mensaje por SID de Twilio
   */
  static async getByTwilioSid (twilioSid) {
    const snapshot = await firestore
      .collection('messages')
      .where('twilioSid', '==', twilioSid)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return new Message({ id: doc.id, ...doc.data() });
  }

  /**
   * Listar mensajes entre dos números
   */
  static async getByPhones (phone1, phone2, { limit = 50, startAfter = null } = {}) {
    // Buscar mensajes en ambas direcciones usando consultas separadas
    // Firestore no soporta OR queries complejas de forma nativa

    // Consulta 1: phone1 -> phone2
    let query1 = firestore.collection('messages')
      .where('from', '==', phone1)
      .where('to', '==', phone2)
      .orderBy('timestamp', 'desc')
      .limit(limit);

    // Consulta 2: phone2 -> phone1
    let query2 = firestore.collection('messages')
      .where('from', '==', phone2)
      .where('to', '==', phone1)
      .orderBy('timestamp', 'desc')
      .limit(limit);

    if (startAfter) {
      query1 = query1.startAfter(startAfter);
      query2 = query2.startAfter(startAfter);
    }

    // Ejecutar ambas consultas en paralelo
    const [snapshot1, snapshot2] = await Promise.all([
      query1.get(),
      query2.get(),
    ]);

    // Combinar y ordenar resultados
    const messages = [
      ...snapshot1.docs.map(doc => new Message({ id: doc.id, ...doc.data() })),
      ...snapshot2.docs.map(doc => new Message({ id: doc.id, ...doc.data() })),
    ];

    // Ordenar por timestamp y limitar resultados
    return messages
      .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
      .slice(0, limit);
  }

  /**
   * Obtener mensajes recientes para un usuario
   */
  static async getRecentMessages (userId, limit = 20) {
    const snapshot = await firestore
      .collection('messages')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => new Message({ id: doc.id, ...doc.data() }));
  }

  /**
   * Buscar mensajes por contenido
   */
  static async search (searchTerm, userId = null) {
    let query = firestore.collection('messages');

    if (userId) {
      query = query.where('userId', '==', userId);
    }

    const snapshot = await query.get();
    const searchLower = searchTerm.toLowerCase();

    return snapshot.docs
      .map(doc => new Message({ id: doc.id, ...doc.data() }))
      .filter(message =>
        message.content.toLowerCase().includes(searchLower),
      );
  }

  /**
   * Obtener estadísticas de mensajes
   */
  static async getStats (userId = null, startDate = null, endDate = null) {
    let query = firestore.collection('messages');

    if (userId) {
      query = query.where('userId', '==', userId);
    }

    if (startDate) {
      query = query.where('timestamp', '>=', startDate);
    }

    if (endDate) {
      query = query.where('timestamp', '<=', endDate);
    }

    const snapshot = await query.get();
    const messages = snapshot.docs.map(doc => new Message({ id: doc.id, ...doc.data() }));

    return {
      total: messages.length,
      inbound: messages.filter(m => m.direction === 'inbound').length,
      outbound: messages.filter(m => m.direction === 'outbound').length,
      byStatus: {
        pending: messages.filter(m => m.status === 'pending').length,
        sent: messages.filter(m => m.status === 'sent').length,
        delivered: messages.filter(m => m.status === 'delivered').length,
        read: messages.filter(m => m.status === 'read').length,
        failed: messages.filter(m => m.status === 'failed').length,
      },
      byType: {
        text: messages.filter(m => m.type === 'text').length,
        image: messages.filter(m => m.type === 'image').length,
        document: messages.filter(m => m.type === 'document').length,
        audio: messages.filter(m => m.type === 'audio').length,
      },
    };
  }

  /**
   * Obtener mensajes por userId
   */
  static async getByUserId (userId, { limit = 50, orderBy = 'timestamp', order = 'desc' } = {}) {
    const query = firestore
      .collection('messages')
      .where('userId', '==', userId)
      .orderBy(orderBy, order)
      .limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => new Message({ id: doc.id, ...doc.data() }));
  }

  /**
   * Actualizar estado del mensaje
   */
  async updateStatus (status) {
    await this.update({ status });
  }

  /**
   * Actualizar mensaje
   */
  async update (updates) {
    const validUpdates = prepareForFirestore({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await firestore.collection('messages').doc(this.id).update(validUpdates);

    // Actualizar propiedades locales
    Object.assign(this, updates);
    this.updatedAt = Timestamp.now();
  }

  /**
   * Marcar como leído
   */
  async markAsRead () {
    await this.updateStatus('read');
  }

  /**
   * Eliminar mensaje
   */
  async delete () {
    await firestore.collection('messages').doc(this.id).delete();
  }

  /**
   * Convertir a objeto plano para respuestas JSON
   */
  toJSON () {
    return {
      id: this.id,
      conversationId: this.conversationId,
      from: this.from,
      to: this.to,
      content: this.content,
      type: this.type,
      direction: this.direction,
      status: this.status,
      twilioSid: this.twilioSid,
      mediaUrls: this.mediaUrls,
      metadata: this.metadata,
      userId: this.userId,
      timestamp: this.timestamp,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

module.exports = Message;
