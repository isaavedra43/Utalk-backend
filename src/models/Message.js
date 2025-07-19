const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const logger = require('../utils/logger');
const { prepareForFirestore } = require('../utils/firestore');
const { isValidConversationId } = require('../utils/conversation');

class Message {
  constructor (data) {
    // ✅ CRÍTICO: Generar ID automáticamente si no se proporciona
    this.id = data.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // ✅ ASEGURAR conversationId válido (crítico para Firestore path)
    this.conversationId = data.conversationId;
    if (!this.conversationId) {
      throw new Error('conversationId es requerido para crear un mensaje');
    }

    // ✅ MAPEO DE CAMPOS para compatibilidad con alineación anterior
    this.from = data.from;
    this.to = data.to;
    this.content = data.content || '';

    this.type = data.type || 'text';
    this.direction = data.direction;
    this.status = data.status || 'sent';
    this.userId = data.userId || null;

    // ✅ TIMESTAMPS: Mantener estructura original + nueva
    this.timestamp = data.timestamp || new Date();
    this.createdAt = data.createdAt || this.timestamp;
    this.updatedAt = data.updatedAt || this.timestamp;

    // ✅ MEDIA: Mantener nombres de campos originales
    this.mediaUrls = data.mediaUrls || [];
    this.media = data.media || null; // Campo legacy

    // ✅ TWILIO: Campos específicos
    this.twilioSid = data.twilioSid || null;

    // ✅ METADATA: Toda la información adicional
    this.metadata = data.metadata || {};

    // ✅ LOG para debugging (solo si hay problemas)
    if (!this.conversationId || !this.id) {
      console.error('❌ Error en constructor Message:', {
        id: this.id,
        conversationId: this.conversationId,
      });
      throw new Error('Campos críticos faltantes en Message constructor');
    }
  }

  /**
   * Crear un nuevo mensaje en la subcolección correspondiente
   * ✅ CORREGIDO: Logs detallados y validación completa antes de Firestore
   */
  static async create (messageData) {
    try {
      // ✅ LOG INICIAL para debugging
      console.log('🔄 Message.create - Iniciando con datos:', {
        id: messageData.id,
        conversationId: messageData.conversationId,
        from: messageData.from,
        to: messageData.to,
        type: messageData.type,
        direction: messageData.direction,
        twilioSid: messageData.twilioSid,
      });

      const message = new Message(messageData);

      // ✅ VALIDAR ANTES DE GUARDAR
      if (!message.id || message.id.trim() === '') {
        throw new Error('Message ID no puede estar vacío');
      }

      if (!message.conversationId || message.conversationId.trim() === '') {
        throw new Error('conversationId no puede estar vacío');
      }

      // ✅ PREPARAR DATOS PARA FIRESTORE (estructura interna)
      const firestoreData = {
        // Campos originales para Firestore (NO cambiar)
        from: message.from,
        to: message.to,
        content: message.content,
        type: message.type,
        direction: message.direction,
        status: message.status,
        userId: message.userId,
        mediaUrls: message.mediaUrls,
        twilioSid: message.twilioSid,
        metadata: message.metadata,

        // Timestamps de Firestore
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        timestamp: FieldValue.serverTimestamp(),
      };

      // ✅ LIMPIAR datos undefined/null para Firestore
      const cleanData = prepareForFirestore(firestoreData);

      console.log('💾 Message.create - Guardando en Firestore:', {
        messageId: message.id,
        conversationId: message.conversationId,
        firestorePath: `conversations/${message.conversationId}/messages/${message.id}`,
        cleanDataKeys: Object.keys(cleanData),
        hasCleanData: Object.keys(cleanData).length > 0,
      });

      // ✅ GUARDAR EN FIRESTORE con path completo
      const docRef = firestore
        .collection('conversations')
        .doc(message.conversationId)
        .collection('messages')
        .doc(message.id);

      await docRef.set(cleanData);

      console.log('✅ Message.create - Guardado exitosamente:', {
        messageId: message.id,
        conversationId: message.conversationId,
      });

      logger.info('Mensaje creado exitosamente', {
        messageId: message.id,
        conversationId: message.conversationId,
        direction: message.direction,
        type: message.type,
      });

      return message;
    } catch (error) {
      console.error('❌ Message.create - Error:', {
        error: error.message,
        messageData: {
          id: messageData.id,
          conversationId: messageData.conversationId,
        },
      });

      logger.error('Error creando mensaje', {
        error: error.message,
        messageData,
      });

      throw error;
    }
  }

  /**
   * Obtener mensaje por ID
   */
  static async getById (messageId) {
    try {
      // Buscar en todas las conversaciones (esto es costoso, mejor tener conversationId)
      const conversationsSnapshot = await firestore.collection('conversations').get();

      for (const conversationDoc of conversationsSnapshot.docs) {
        const messageDoc = await firestore
          .collection('conversations')
          .doc(conversationDoc.id)
          .collection('messages')
          .doc(messageId)
          .get();

        if (messageDoc.exists) {
          return new Message({ id: messageDoc.id, ...messageDoc.data() });
        }
      }

      return null;
    } catch (error) {
      logger.error('Error obteniendo mensaje por ID:', error);
      throw error;
    }
  }

  /**
   * Obtener mensajes por conversationId con paginación cursor-based
   * ✅ REFACTORIZADO: Usa Firestore queries nativas para mejor rendimiento
   */
  static async getByConversation (conversationId, options = {}) {
    try {
      const {
        limit = 50,
        startAfter = null,
        orderBy = 'timestamp',
        order = 'desc',
      } = options;

      logger.info('[Message.getByConversation] Iniciando query', {
        conversationId,
        limit,
        startAfter,
        orderBy,
        order,
      });

      // ✅ VALIDACIÓN: conversationId válido
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

      const snapshot = await query.get();

      if (snapshot.empty) {
        logger.info('[Message.getByConversation] No se encontraron mensajes', {
          conversationId,
          limit,
        });
        return [];
      }

      const messages = snapshot.docs.map(doc => new Message({
        id: doc.id,
        conversationId,
        ...doc.data(),
      }));

      logger.info('[Message.getByConversation] Mensajes obtenidos exitosamente', {
        conversationId,
        messageCount: messages.length,
        limit,
      });

      return messages;
    } catch (error) {
      logger.error('[Message.getByConversation] Error', {
        conversationId,
        error: error.message,
        options,
      });
      throw error;
    }
  }

  /**
   * Obtener mensajes recientes para generar lista de conversaciones
   * ✅ OPTIMIZADO: Usa índices compuestos de Firestore
   */
  static async getRecentMessages (userId = null, limit = 100) {
    try {
      logger.info('[Message.getRecentMessages] Iniciando', {
        userId: userId || 'ADMIN (todos)',
        limit,
      });

      // Query base: obtener mensajes recientes
      let query = firestore.collectionGroup('messages')
        .orderBy('timestamp', 'desc');

      // ✅ FILTRO POR USUARIO: Solo si no es admin
      if (userId) {
        query = query.where('userId', '==', userId);
      }

      query = query.limit(limit);

      const snapshot = await query.get();

      if (snapshot.empty) {
        logger.info('[Message.getRecentMessages] No se encontraron mensajes');
        return [];
      }

      // ✅ MAPEAR RESULTADOS: Incluir conversationId desde el path
      const messages = snapshot.docs.map(doc => {
        const conversationId = doc.ref.parent.parent.id;
        return new Message({
          id: doc.id,
          conversationId,
          ...doc.data(),
        });
      });

      logger.info('[Message.getRecentMessages] Mensajes obtenidos', {
        messageCount: messages.length,
        userId: userId || 'ADMIN',
      });

      return messages;
    } catch (error) {
      logger.error('[Message.getRecentMessages] Error', {
        userId,
        limit,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Obtener mensaje por Twilio SID
   */
  static async getByTwilioSid (twilioSid) {
    try {
      const snapshot = await firestore.collectionGroup('messages')
        .where('twilioSid', '==', twilioSid)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const conversationId = doc.ref.parent.parent.id;
      return new Message({
        id: doc.id,
        conversationId,
        ...doc.data(),
      });
    } catch (error) {
      logger.error('Error obteniendo mensaje por Twilio SID:', error);
      throw error;
    }
  }

  /**
   * Actualizar estado del mensaje
   */
  async updateStatus (newStatus) {
    try {
      const docRef = firestore
        .collection('conversations')
        .doc(this.conversationId)
        .collection('messages')
        .doc(this.id);

      await docRef.update({
        status: newStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });

      this.status = newStatus;
      this.updatedAt = new Date();

      logger.info('Estado de mensaje actualizado', {
        messageId: this.id,
        newStatus,
      });
    } catch (error) {
      logger.error('Error actualizando estado de mensaje:', error);
      throw error;
    }
  }

  /**
   * ✅ CORREGIDO: Método toJSON con estructura canónica
   * ESTRUCTURA CANÓNICA según especificación del frontend
   */
  toJSON () {
    // ✅ Normalizar timestamp a ISO string
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

    // ✅ Determinar tipo de sender basado en direction
    let senderType = 'contact'; // Por defecto es contacto (cliente)
    if (this.direction === 'outbound' && this.userId) {
      senderType = 'agent'; // Es un agente si envió el mensaje
    } else if (this.direction === 'outbound' && !this.userId) {
      senderType = 'bot'; // Es bot si es saliente pero sin userId
    }

    // ✅ Construir objeto sender según especificación (sin campos null)
    const sender = {
      id: this.direction === 'inbound' ? this.from : (this.userId || this.from),
      name: this.direction === 'inbound' ? this.from : (this.userId || 'Sistema'),
      type: senderType,
      // avatar omitido en lugar de null
    };

    // ✅ Mapear mediaUrls a attachments con estructura completa
    const attachments = (this.mediaUrls || []).map((url, index) => ({
      id: `media_${this.id}_${index}`,
      name: this.extractFilenameFromUrl(url) || `archivo_${index + 1}`,
      url,
      type: this.guessContentTypeFromUrl(url) || 'application/octet-stream',
      size: null, // No tenemos el tamaño, se puede extender después
    }));

    // ✅ Determinar estados booleanos desde status
    const isDelivered = ['delivered', 'read'].includes(this.status);
    const isRead = this.status === 'read';

    // ✅ ESTRUCTURA CANÓNICA EXACTA
    return {
      id: this.id, // string único, requerido
      conversationId: this.conversationId, // string único, requerido
      content: this.content || '', // string, requerido
      type: this.type || 'text', // string, requerido
      timestamp: normalizedTimestamp, // string ISO, requerido
      sender, // objeto, requerido
      direction: this.direction, // string ('inbound' | 'outbound'), requerido
      attachments, // array, opcional
      isRead, // boolean, requerido
      isDelivered, // boolean, requerido
      metadata: { // objeto, opcional
        twilioSid: this.twilioSid || null,
        userId: this.userId || null,
        from: this.from,
        to: this.to,
        status: this.status,
      },
    };
  }

  /**
   * ✅ HELPER: Extraer nombre de archivo de URL
   */
  extractFilenameFromUrl (url) {
    if (!url || typeof url !== 'string') return null;
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      return filename && filename.includes('.') ? filename : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * ✅ HELPER: Adivinar tipo de contenido desde URL
   */
  guessContentTypeFromUrl (url) {
    if (!url || typeof url !== 'string') return null;

    const mimeTypes = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      mp4: 'video/mp4',
      webm: 'video/webm',
      txt: 'text/plain',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    const extension = url.split('.').pop().toLowerCase();
    return mimeTypes[extension] || null;
  }

  /**
   * Obtener estadísticas de mensajes
   */
  static async getStats (period = '7d', userId = null) {
    try {
      const now = new Date();
      let startDate;

      switch (period) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      let query = firestore.collectionGroup('messages')
        .where('timestamp', '>=', Timestamp.fromDate(startDate));

      if (userId) {
        query = query.where('userId', '==', userId);
      }

      const snapshot = await query.get();

      const stats = {
        total: snapshot.size,
        sent: 0,
        received: 0,
        byType: {},
        byStatus: {},
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
      };

      snapshot.docs.forEach(doc => {
        const data = doc.data();

        if (data.direction === 'outbound') {
          stats.sent++;
        } else {
          stats.received++;
        }

        stats.byType[data.type] = (stats.byType[data.type] || 0) + 1;
        stats.byStatus[data.status] = (stats.byStatus[data.status] || 0) + 1;
      });

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de mensajes:', error);
      throw error;
    }
  }
}

module.exports = Message;
