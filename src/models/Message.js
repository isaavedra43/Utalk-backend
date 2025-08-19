const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const { admin } = require('../config/firebase');
const logger = require('../utils/logger');
const { prepareForFirestore } = require('../utils/firestore');
// const { isValidConversationId } = require('../utils/conversation'); // DEPRECATED
const { createCursor, parseCursor } = require('../utils/pagination');
const { safeDateToISOString } = require('../utils/dateHelpers');

class Message {
  constructor (data) {
    const requestId = `msg_constructor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // ID y ConversationID (UUIDs) - ACEPTAR AMBOS FORMATOS
      const messageId = data.id || data.messageId || `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      if (!data.conversationId) {
        throw new Error('conversationId (UUID) es requerido');
      }

      this.id = messageId;
      this.conversationId = data.conversationId;

      // === LOG CONSOLIDADO DE CONSTRUCTOR ===
      logger.debug('Message constructor', {
        category: 'MESSAGE_CONSTRUCTOR',
        requestId,
        originalDataId: data.id,
        assignedMessageId: this.id,
        assignedConversationId: this.conversationId,
        content: data.content?.substring(0, 30) + (data.content?.length > 30 ? '...' : ''),
        type: data.type,
        direction: data.direction,
        step: 'constructor_completed'
      });

      // Contenido
      const noContent = data.content === null || data.content === undefined;
      const noMedia = !data.mediaUrl || data.mediaUrl === null || data.mediaUrl === undefined;

      if (noContent && noMedia) {
        throw new Error('El mensaje debe tener contenido o mediaUrl');
      }

      // Asignar campos básicos
      this.content = data.content || '';
      this.mediaUrl = data.mediaUrl || null;
      this.type = data.type || 'text';
      this.direction = data.direction || 'inbound';
      this.status = data.status || 'received';
      this.senderIdentifier = data.senderIdentifier;
      this.recipientIdentifier = data.recipientIdentifier;
      this.timestamp = data.timestamp || new Date();
      this.metadata = data.metadata || {};
      this.createdAt = data.createdAt || new Date();
      this.updatedAt = data.updatedAt || new Date();

      // 🆕 SOPORTE PARA UBICACIÓN Y STICKERS
      this.location = data.location || null;
      this.sticker = data.sticker || null;

      // Validar y ajustar tipo según contenido
      if (this.location && this.type !== 'location') {
        this.type = 'location';
      }
      
      if (this.sticker && this.type !== 'sticker') {
        this.type = 'sticker';
      }

      // Validación específica para ubicación y stickers
      if (this.type === 'location' && !this.location) {
        throw new Error('Mensaje de tipo location debe incluir datos de ubicación');
      }
      
      if (this.type === 'sticker' && !this.sticker) {
        throw new Error('Mensaje de tipo sticker debe incluir datos de sticker');
      }

    } catch (error) {
      logger.error('❌ MESSAGE.CONSTRUCTOR - ERROR CRÍTICO', {
        requestId,
        error: error.message,
        dataKeys: Object.keys(data),
        step: 'constructor_error'
      });
      throw error;
    }
  }

  isPhone(identifier) {
    return typeof identifier === 'string' && identifier.startsWith('+');
  }

  /**
   * Crear mensaje en Firestore (EMAIL-FIRST)
   */
  static async create (messageData, uniqueMessageId) {
    const requestId = `msg_create_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      try {
        const message = new Message(messageData);

      // Check if conversation exists, if not, create it
          const conversationRef = firestore.collection('conversations').doc(message.conversationId);
          const conversationDoc = await conversationRef.get();

          if (!conversationDoc.exists) {
        // Create the parent conversation document
            await conversationRef.set({
              id: message.conversationId,
              customerPhone: message.senderIdentifier,
              createdAt: new Date(),
              updatedAt: new Date(),
              lastMessage: {
                content: message.content,
                timestamp: new Date(),
                sender: message.senderIdentifier
          },
          messageCount: 1
            });
      }

      // Update conversation with last message and increment count
      await conversationRef.update({
        lastMessage: {
          content: message.content,
          timestamp: new Date(),
            sender: message.senderIdentifier,
          messageId: uniqueMessageId
        },
        messageCount: admin.firestore.FieldValue.increment(1),
        updatedAt: new Date()
      });

      // Prepare data for Firestore, ensuring no undefined values
      const cleanData = prepareForFirestore({ ...message });

      // Aggressive cleaning of undefined/null values
      const firestoreData = {};
      for (const [key, value] of Object.entries(cleanData)) {
        if (value !== undefined && value !== null && value !== '') {
          firestoreData[key] = value;
        }
      }

      // Critical verification before saving
      if (!firestoreData.id || !firestoreData.conversationId) {
        throw new Error(`CRITICAL DATA MISSING: id=${!!firestoreData.id}, conversationId=${!!firestoreData.conversationId}`);
      }

      // Save message to Firestore subcollection using the uniqueMessageId
      await firestore.collection('conversations').doc(message.conversationId).collection('messages').doc(uniqueMessageId).set(firestoreData);

      // === LOG CRÍTICO DESPUÉS DE FIRESTORE SAVE ===
      logger.info('Message saved successfully', {
        category: 'MESSAGE_SAVED_SUCCESS',
        requestId,
        messageId: uniqueMessageId, 
          conversationId: message.conversationId,
        firestorePath: `conversations/${message.conversationId}/messages/${uniqueMessageId}`,
        dataKeys: Object.keys(firestoreData),
        step: 'firestore_save_success' 
        });

        return message;

    } catch (error) {
      logger.error('Message create error', {
        category: 'MESSAGE_CREATE_ERROR',
        requestId,
        error: error.message,
        errorType: error.constructor.name,
        messageId: uniqueMessageId,
        conversationId: messageData?.conversationId,
        step: 'firestore_save_error'
        });
      
      logger.error('❌ MESSAGE.CREATE - CRITICAL ERROR', {
        requestId,
        error: error.message,
        errorType: error.constructor.name,
        stack: error.stack?.split('\n').slice(0, 20),
        messageData: {
          id: messageData?.id,
          conversationId: messageData?.conversationId,
          senderIdentifier: messageData?.senderIdentifier,
          recipientIdentifier: messageData?.recipientIdentifier,
          content: messageData?.content,
          type: messageData?.type,
          direction: messageData?.direction,
          status: messageData?.status,
          mediaUrl: messageData?.mediaUrl
        },
        step: 'message_create_error'
      });
      throw error;
    }
  }

  /**
   * Obtener mensaje por Twilio SID
   * @param {string} twilioSid - SID de Twilio del mensaje
   * @returns {Message|null} - Mensaje encontrado o null
   */
  static async getByTwilioSid(twilioSid) {
    try {
      logger.info('🔍 MESSAGE.GETBYTWILIOSID - BUSCANDO MENSAJE', {
        twilioSid,
        step: 'search_start'
      });

      // Buscar en todas las conversaciones
      const conversationsRef = firestore.collection('conversations');
      const conversationsSnapshot = await conversationsRef.get();

      logger.info('📋 MESSAGE.GETBYTWILIOSID - CONVERSACIONES ENCONTRADAS', {
        twilioSid,
        conversationsCount: conversationsSnapshot.size,
        step: 'conversations_loaded'
      });

      // Buscar en cada conversación
      for (const conversationDoc of conversationsSnapshot.docs) {
        const messagesRef = conversationDoc.ref.collection('messages');
        const messagesSnapshot = await messagesRef
          .where('metadata.twilioSid', '==', twilioSid)
          .limit(1)
          .get();

        if (!messagesSnapshot.empty) {
          const messageDoc = messagesSnapshot.docs[0];
          const message = new Message({ id: messageDoc.id, ...messageDoc.data() });

          logger.info('✅ MESSAGE.GETBYTWILIOSID - MENSAJE ENCONTRADO', {
            twilioSid,
            messageId: message.id,
            conversationId: message.conversationId,
            step: 'message_found'
          });

          return message;
        }
      }

      logger.info('❌ MESSAGE.GETBYTWILIOSID - MENSAJE NO ENCONTRADO', {
        twilioSid,
        step: 'message_not_found'
      });

      return null;

    } catch (error) {
      logger.error('❌ MESSAGE.GETBYTWILIOSID - ERROR CRÍTICO', {
        twilioSid,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 5),
        step: 'search_error'
      });
      throw error;
    }
  }

  /**
   * OPTIMIZADO: Obtener mensajes por conversación con paginación basada en cursor
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

    // VALIDACIÓN: Límites de paginación
    const validatedLimit = Math.min(Math.max(limit, 1), 100);
    const validatedOrder = ['asc', 'desc'].includes(order) ? order : 'desc';

    // MONITOREO: Log de parámetros de consulta
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

    // APLICAR FILTROS
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

    // ORDENAMIENTO
    query = query.orderBy(orderBy, validatedOrder);

    // PAGINACIÓN BASADA EN CURSOR
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

    // APLICAR LÍMITE
    query = query.limit(validatedLimit + 1); // +1 para determinar si hay más páginas

    // EJECUTAR CONSULTA
    const startTime = Date.now();
    const snapshot = await query.get();
    const queryTime = Date.now() - startTime;

    // PROCESAR RESULTADOS
    const messages = [];
    let hasMore = false;

    snapshot.docs.forEach((doc, index) => {
      if (index < validatedLimit) {
        messages.push(new Message({ id: doc.id, ...doc.data() }));
      } else {
        hasMore = true;
      }
    });

    // GENERAR CURSOR PARA SIGUIENTE PÁGINA
    let nextCursor = null;
    if (hasMore && messages.length > 0) {
      const lastDoc = snapshot.docs[validatedLimit - 1];
      nextCursor = createCursor({
        conversationId,
        documentSnapshot: lastDoc,
        timestamp: lastDoc.data().timestamp,
      });
    }

    // MONITOREO: Log de resultados
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
   * EMAIL-FIRST: Convertir a objeto plano para respuestas JSON
   */
  toJSON () {
      const normalizedTimestamp = safeDateToISOString(this.timestamp);
      const normalizedCreatedAt = safeDateToISOString(this.createdAt);
      const normalizedUpdatedAt = safeDateToISOString(this.updatedAt);

    // 🔍 LOG PARA DEBUGGEAR TOJSON
    logger.debug('Message toJSON - procesando media URL', {
      category: 'MESSAGE_TOJSON_MEDIA',
      messageId: this.id,
      originalMediaUrl: this.mediaUrl,
      type: this.type,
      hasMediaUrl: !!this.mediaUrl
    });

    // 🔧 CORRECCIÓN CRÍTICA: Generar URL pública para mediaUrl si existe
    let processedMediaUrl = this.mediaUrl;
    
    if (this.mediaUrl) {
      try {
        const baseUrl = process.env.BASE_URL || 'https://utalk-backend-production.up.railway.app';
        
        // 🔍 LOG PARA DEBUGGEAR TRANSFORMACIÓN DE URL
        logger.debug('MESSAGE TOJSON - TRANSFORMANDO URL:', { category: 'MESSAGE_TOJSON_TRANSFORMANDO_U', 
          messageId: this.id,
          originalMediaUrl: this.mediaUrl,
          baseUrl: baseUrl,
          isFirebase: this.mediaUrl.includes('firebase'),
          isTwilio: this.mediaUrl.includes('api.twilio.com')
         });
        
        if (this.mediaUrl.includes('firebase')) {
          // Si es una URL de Firebase Storage, generar URL pública
          const urlParts = this.mediaUrl.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const fileId = fileName.split('.')[0]; // Remover extensión
          
          // Generar URL pública del proxy
          processedMediaUrl = `${baseUrl}/media/proxy-file-public/${fileId}`;
          
          logger.debug('MESSAGE TOJSON - FIREBASE URL TRANSFORMADA:', { category: 'MESSAGE_TOJSON_FIREBASE_URL_TR', 
            messageId: this.id,
            originalUrl: this.mediaUrl,
            publicUrl: processedMediaUrl,
            fileId
           });
        } else if (this.mediaUrl.includes('api.twilio.com')) {
          // Si es una URL de Twilio, generar URL pública del proxy
          const urlParts = this.mediaUrl.split('/');
          const messageSid = urlParts[urlParts.length - 3]; // MM...
          const mediaSid = urlParts[urlParts.length - 1]; // ME...
          
          // Generar URL pública del proxy de Twilio
          processedMediaUrl = `${baseUrl}/media/proxy-public?messageSid=${messageSid}&mediaSid=${mediaSid}`;
          
          logger.debug('MESSAGE TOJSON - TWILIO URL TRANSFORMADA:', { category: 'MESSAGE_TOJSON_TWILIO_URL_TRAN', 
            messageId: this.id,
            originalUrl: this.mediaUrl,
            publicUrl: processedMediaUrl,
            messageSid,
            mediaSid,
            urlParts: urlParts
           });
        } else {
          logger.debug('MESSAGE TOJSON - URL NO RECONOCIDA:', { category: 'MESSAGE_TOJSON_URL_NO_RECONOCI', 
            messageId: this.id,
            originalUrl: this.mediaUrl,
            processedMediaUrl: this.mediaUrl // Mantener original
           });
          processedMediaUrl = this.mediaUrl; // Mantener URL original
        }
      } catch (error) {
        logger.debug('MESSAGE TOJSON - ERROR EN TRANSFORMACIÓN:', { category: 'MESSAGE_TOJSON_ERROR_EN_TRANSF', 
          messageId: this.id,
          originalUrl: this.mediaUrl,
          error: error.message,
          stack: error.stack
         });
        // Mantener URL original si hay error
        processedMediaUrl = this.mediaUrl;
      }
    }

    // 🔍 LOG FINAL PARA DEBUGGEAR TOJSON
    logger.debug('MESSAGE TOJSON - RESULTADO FINAL:', { category: 'MESSAGE_TOJSON_RESULTADO_FINAL', 
      messageId: this.id,
      originalMediaUrl: this.mediaUrl,
      processedMediaUrl: processedMediaUrl,
      hasProcessedMediaUrl: !!processedMediaUrl
     });

    return {
      id: this.id,
      conversationId: this.conversationId,
      content: this.content,
      mediaUrl: processedMediaUrl,
      
      // NUEVO: Campos planos para Socket.IO
      senderIdentifier: this.senderIdentifier,
      recipientIdentifier: this.recipientIdentifier,
      
      // Mantener estructura anidada para compatibilidad
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
   * Marcar mensaje como leído por un usuario específico
   */
  async markAsReadBy(userEmail, readTimestamp = new Date()) {
    await firestore
      .collection('conversations')
      .doc(this.conversationId)
      .collection('messages')
      .doc(this.id)
      .update({
        status: 'read',
        readBy: FieldValue.arrayUnion(userEmail),
        readAt: Timestamp.fromDate(readTimestamp),
        updatedAt: FieldValue.serverTimestamp()
      });

    this.status = 'read';
    this.readBy = this.readBy || [];
    if (!this.readBy.includes(userEmail)) {
      this.readBy.push(userEmail);
    }
    this.readAt = readTimestamp;

    logger.info('Mensaje marcado como leído por usuario', {
          messageId: this.id,
          conversationId: this.conversationId,
      userEmail,
      readAt: readTimestamp
    });
  }

  /**
   * Marcar múltiples mensajes como leídos (operación en lote)
   */
  static async markManyAsRead(conversationId, messageIds, userEmail, readTimestamp = new Date()) {
    if (!conversationId || !Array.isArray(messageIds) || messageIds.length === 0) {
      return { updated: 0 };
    }

    // Construir referencias
    const refs = messageIds.map(messageId => firestore
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .doc(messageId)
    );

    // Obtener documentos al vuelo y filtrar existentes (opción B)
    const snapshots = await firestore.getAll(...refs);
    const existingDocs = snapshots.filter(doc => doc.exists);
    const missingCount = snapshots.length - existingDocs.length;

    if (existingDocs.length === 0) {
      logger.info('Mensajes a marcar como leídos no existen', {
        category: 'MESSAGES_MARK_READ_BATCH_EMPTY',
        conversationId: conversationId.substring(0, 30) + '...',
        userEmail: (userEmail || '').substring(0, 30) + '...',
        requested: messageIds.length,
        missing: missingCount
      });
      return { updated: 0 };
    }

    const readAtTs = Timestamp.fromDate(readTimestamp);
    const updateData = {
      status: 'read',
      readBy: FieldValue.arrayUnion(userEmail),
      readAt: readAtTs,
      updatedAt: FieldValue.serverTimestamp()
    };

    // Firestore limita a 500 operaciones por batch. Dividir si es necesario.
    const MAX_BATCH_OPS = 450; // margen de seguridad
    let updatedTotal = 0;

    for (let i = 0; i < existingDocs.length; i += MAX_BATCH_OPS) {
      const slice = existingDocs.slice(i, i + MAX_BATCH_OPS);
      const batch = firestore.batch();
      slice.forEach(docSnap => {
        batch.update(docSnap.ref, updateData);
      });
      await batch.commit();
      updatedTotal += slice.length;
    }

    logger.info('Mensajes marcados como leídos (batch robusto)', {
      category: 'MESSAGES_MARK_READ_BATCH',
      conversationId: conversationId.substring(0, 30) + '...',
      userEmail: (userEmail || '').substring(0, 30) + '...',
      requested: messageIds.length,
      updated: updatedTotal,
      skipped: missingCount
    });

    return { updated: updatedTotal };
  }

  /**
   * 🗑️ Eliminación soft del mensaje
   */
  async softDelete(deletedBy) {
    await firestore
      .collection('conversations')
      .doc(this.conversationId)
      .collection('messages')
      .doc(this.id)
      .update({
        isDeleted: true,
        deletedBy,
        deletedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

    this.isDeleted = true;
    this.deletedBy = deletedBy;
    this.deletedAt = new Date();

    logger.info('Mensaje eliminado (soft delete)', {
          messageId: this.id,
          conversationId: this.conversationId,
      deletedBy
    });
  }

  /**
   * 📊 Obtener estadísticas de mensajes
   */
  static async getStats(agentEmail = null, period = '7d', conversationId = null) {
    const startDate = new Date();
    const daysToSubtract = period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 7;
    startDate.setDate(startDate.getDate() - daysToSubtract);

    // Obtener todas las conversaciones del agente o una específica
    let conversationsQuery = firestore.collection('conversations');
    
    if (agentEmail) {
      conversationsQuery = conversationsQuery.where('assignedTo', '==', agentEmail);
    }
    
    if (conversationId) {
      conversationsQuery = conversationsQuery.where(FieldPath.documentId(), '==', conversationId);
    }

    const conversationsSnapshot = await conversationsQuery.get();
    
    let totalMessages = 0;
    let inboundMessages = 0;
    let outboundMessages = 0;
    let readMessages = 0;
    let mediaMessages = 0;
    let responseTimes = [];

    // Procesar mensajes de cada conversación
    for (const convDoc of conversationsSnapshot.docs) {
      const messagesQuery = convDoc.ref
        .collection('messages')
        .where('timestamp', '>=', Timestamp.fromDate(startDate))
        .orderBy('timestamp', 'asc');
      
      const messagesSnapshot = await messagesQuery.get();
      const messages = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      totalMessages += messages.length;
      inboundMessages += messages.filter(m => m.direction === 'inbound').length;
      outboundMessages += messages.filter(m => m.direction === 'outbound').length;
      readMessages += messages.filter(m => m.status === 'read').length;
      mediaMessages += messages.filter(m => m.type !== 'text').length;

      // Calcular tiempos de respuesta
      for (let i = 1; i < messages.length; i++) {
        const current = messages[i];
        const previous = messages[i - 1];
        
        if (previous.direction === 'inbound' && current.direction === 'outbound') {
          const prevTime = previous.timestamp.toDate ? previous.timestamp.toDate() : new Date(previous.timestamp);
          const currTime = current.timestamp.toDate ? current.timestamp.toDate() : new Date(current.timestamp);
          responseTimes.push(currTime - prevTime);
        }
      }
    }

    const averageResponseTime = responseTimes.length > 0 
      ? Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length / (1000 * 60))
      : 0;

    return {
      total: totalMessages,
      inbound: inboundMessages,
      outbound: outboundMessages,
      read: readMessages,
      unread: totalMessages - readMessages,
      media: mediaMessages,
      text: totalMessages - mediaMessages,
      averageResponseTime, // en minutos
      period,
      agentEmail,
      conversationId
    };
  }

  /**
   * 🔍 Buscar mensajes en conversaciones del usuario
   */
  static async searchInUserConversations(options = {}) {
    const { searchTerm, limit = 20, userEmail = null } = options;
    
    // Obtener conversaciones del usuario
    let conversationsQuery = firestore.collection('conversations');
    
    if (userEmail) {
      conversationsQuery = conversationsQuery.where('assignedTo', '==', userEmail);
    }

    const conversationsSnapshot = await conversationsQuery.limit(50).get(); // Limitar conversaciones
    const results = [];

    // Buscar en mensajes de cada conversación
    for (const convDoc of conversationsSnapshot.docs) {
      if (results.length >= limit) break;

      const messagesQuery = convDoc.ref
        .collection('messages')
        .where('content', '>=', searchTerm)
        .where('content', '<=', searchTerm + '\uf8ff')
        .limit(limit - results.length);
      
      const messagesSnapshot = await messagesQuery.get();
      
      messagesSnapshot.docs.forEach(doc => {
        const messageData = doc.data();
        if (messageData.content?.toLowerCase().includes(searchTerm.toLowerCase())) {
          results.push(new Message({ id: doc.id, ...messageData }));
        }
      });
    }

    return results;
  }

  /**
   * Buscar mensajes en una conversación específica
   */
  static async search (conversationId, searchTerm, options = {}) {
    const messages = await this.getByConversation(conversationId, { ...options, limit: 1000 });
    return messages.messages.filter(message =>
      message.content?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }

  /**
   * 📊 Obtener conteo de mensajes no leídos para una conversación y usuario
   */
  static async getUnreadCount(conversationId, userEmail) {
    try {
      // ✅ VALIDACIÓN: Verificar parámetros
      if (!conversationId || !userEmail) {
        logger.warn('Parámetros inválidos en getUnreadCount', {
          category: 'MESSAGE_UNREAD_COUNT_WARNING',
          conversationId: conversationId?.substring(0, 20) + '...',
          userEmail: userEmail?.substring(0, 20) + '...'
        });
        return 0;
      }

      // Obtener mensajes no leídos de la conversación
      const messagesQuery = firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .where('status', '==', 'received')
        .where('direction', '==', 'inbound');

      const snapshot = await messagesQuery.get();
      
      // Filtrar mensajes que no han sido leídos por el usuario específico
      let unreadCount = 0;
      
      snapshot.docs.forEach(doc => {
        const messageData = doc.data();
        
        // Verificar si el mensaje no ha sido leído por el usuario
        const readBy = messageData.readBy || [];
        if (!readBy.includes(userEmail)) {
          unreadCount++;
        }
      });

      logger.debug('Unread count obtenido', {
        category: 'MESSAGE_UNREAD_COUNT_SUCCESS',
        conversationId: conversationId.substring(0, 20) + '...',
        userEmail: userEmail.substring(0, 20) + '...',
        unreadCount
      });

      return unreadCount;

    } catch (error) {
      logger.error('Error obteniendo unread count', {
        category: 'MESSAGE_UNREAD_COUNT_ERROR',
        conversationId: conversationId?.substring(0, 20) + '...',
        userEmail: userEmail?.substring(0, 20) + '...',
        error: error.message
      });
      return 0;
    }
  }
}

module.exports = Message;
