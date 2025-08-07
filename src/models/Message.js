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
      logger.info('🔄 MESSAGE.CONSTRUCTOR - INICIANDO CONSTRUCCIÓN', {
        requestId,
        timestamp: new Date().toISOString(),
        dataKeys: Object.keys(data),
        dataValues: {
          id: data.id,
          messageId: data.messageId,
          conversationId: data.conversationId,
          senderIdentifier: data.senderIdentifier,
          recipientIdentifier: data.recipientIdentifier,
          content: data.content,
          mediaUrl: data.mediaUrl,
          direction: data.direction,
          type: data.type,
          status: data.status,
          hasMetadata: !!data.metadata,
          metadataKeys: data.metadata ? Object.keys(data.metadata) : []
        },
        step: 'constructor_start'
      });

      // ID y ConversationID (UUIDs) - ACEPTAR AMBOS FORMATOS
      logger.info('🔍 MESSAGE.CONSTRUCTOR - VALIDANDO ID', {
        requestId,
        hasId: !!data.id,
        hasMessageId: !!data.messageId,
        id: data.id,
        messageId: data.messageId,
        step: 'id_validation_start'
      });

      const messageId = data.id || data.messageId;
      if (!messageId) {
        logger.error('❌ MESSAGE.CONSTRUCTOR - ID FALTANTE', {
          requestId,
          data: {
            hasId: !!data.id,
            hasMessageId: !!data.messageId,
            id: data.id,
            messageId: data.messageId
          },
          step: 'validation_failed_id'
        });
        throw new Error('Message ID es requerido');
      }

      logger.info('✅ MESSAGE.CONSTRUCTOR - ID VÁLIDO', {
        requestId,
        messageId,
        step: 'id_validation_passed'
      });

      logger.info('🔍 MESSAGE.CONSTRUCTOR - VALIDANDO CONVERSATIONID', {
        requestId,
        hasConversationId: !!data.conversationId,
        conversationId: data.conversationId,
        step: 'conversation_id_validation_start'
      });

      if (!data.conversationId) {
        logger.error('❌ MESSAGE.CONSTRUCTOR - CONVERSATIONID FALTANTE', {
          requestId,
          conversationId: data.conversationId,
          step: 'validation_failed_conversation_id'
        });
        throw new Error('conversationId (UUID) es requerido');
      }

      logger.info('✅ MESSAGE.CONSTRUCTOR - CONVERSATIONID VÁLIDO', {
        requestId,
        conversationId: data.conversationId,
        step: 'conversation_id_validation_passed'
      });

      this.id = messageId;
      this.conversationId = data.conversationId;

      // === LOG CONSOLIDADO DE CONSTRUCTOR ===
      console.log('🚨 MESSAGE CONSTRUCTOR:', {
        requestId,
        originalDataId: data.id,
        originalDataConversationId: data.conversationId,
        assignedMessageId: this.id,
        assignedConversationId: this.conversationId,
        areIdsSame: this.id === this.conversationId,
        content: this.content?.substring(0, 30) + (this.content?.length > 30 ? '...' : ''),
        type: this.type,
        direction: this.direction,
        step: 'constructor_completed'
      });

      // Contenido
      logger.info('🔍 MESSAGE.CONSTRUCTOR - VALIDANDO CONTENIDO', {
        requestId,
        hasContent: !!data.content,
        hasMediaUrl: !!data.mediaUrl,
        content: data.content,
        mediaUrl: data.mediaUrl,
        contentType: typeof data.content,
        contentLength: data.content?.length || 0,
        step: 'content_validation_start'
      });

      // CORREGIDO: Permitir contenido vacío pero no null/undefined
      if (data.content === null || data.content === undefined) {
        logger.error('❌ MESSAGE.CONSTRUCTOR - CONTENIDO NULL/UNDEFINED', {
          requestId,
          hasContent: !!data.content,
          hasMediaUrl: !!data.mediaUrl,
          content: data.content,
          mediaUrl: data.mediaUrl,
          contentType: typeof data.content,
          step: 'validation_failed_content_null'
        });
        throw new Error('Message debe tener content (no puede ser null/undefined)');
      }

      // PERMITIR MENSAJES DE TEXTO CON CONTENIDO VACÍO
      // Solo rechazar si no hay contenido Y no hay mediaUrl
      if (!data.content && !data.mediaUrl) {
        logger.error('❌ MESSAGE.CONSTRUCTOR - CONTENIDO FALTANTE', {
          requestId,
          hasContent: !!data.content,
          hasMediaUrl: !!data.mediaUrl,
          content: data.content,
          mediaUrl: data.mediaUrl,
          contentType: typeof data.content,
          step: 'validation_failed_content_missing'
        });
        throw new Error('Message debe tener content o mediaUrl');
      }

      logger.info('✅ MESSAGE.CONSTRUCTOR - CONTENIDO VÁLIDO', {
        requestId,
        hasContent: !!data.content,
        hasMediaUrl: !!data.mediaUrl,
        contentLength: data.content?.length || 0,
        step: 'content_validation_passed'
      });

      // CORREGIDO: Asignar contenido como string (puede ser vacío)
      this.content = data.content || '';
      this.mediaUrl = data.mediaUrl || null;

      logger.info('✅ MESSAGE.CONSTRUCTOR - CONTENIDO ASIGNADO', {
        requestId,
        hasContent: !!this.content,
        hasMediaUrl: !!this.mediaUrl,
        step: 'content_assigned'
      });

      // EMAIL-FIRST: Identificadores de remitente y destinatario.
      logger.info('🔍 MESSAGE.CONSTRUCTOR - VALIDANDO IDENTIFICADORES', {
        requestId,
        hasSenderIdentifier: !!data.senderIdentifier,
        hasRecipientIdentifier: !!data.recipientIdentifier,
        senderIdentifier: data.senderIdentifier,
        recipientIdentifier: data.recipientIdentifier,
        step: 'identifiers_validation_start'
      });

      if (!data.senderIdentifier || !data.recipientIdentifier) {
        logger.error('❌ MESSAGE.CONSTRUCTOR - IDENTIFICADORES FALTANTES', {
          requestId,
          hasSenderIdentifier: !!data.senderIdentifier,
          hasRecipientIdentifier: !!data.recipientIdentifier,
          senderIdentifier: data.senderIdentifier,
          recipientIdentifier: data.recipientIdentifier,
          step: 'validation_failed_identifiers'
        });
        throw new Error('senderIdentifier y recipientIdentifier son requeridos');
      }

      logger.info('✅ MESSAGE.CONSTRUCTOR - IDENTIFICADORES VÁLIDOS', {
        requestId,
        senderIdentifier: data.senderIdentifier,
        recipientIdentifier: data.recipientIdentifier,
        step: 'identifiers_validation_passed'
      });

      this.senderIdentifier = data.senderIdentifier; // Puede ser EMAIL o teléfono.
      this.recipientIdentifier = data.recipientIdentifier; // Puede ser EMAIL o teléfono.

      logger.info('✅ MESSAGE.CONSTRUCTOR - IDENTIFICADORES ASIGNADOS', {
        requestId,
        senderIdentifier: this.senderIdentifier,
        recipientIdentifier: this.recipientIdentifier,
        step: 'identifiers_assigned'
      });

      // DEPRECATED: Se eliminan los campos específicos de teléfono. La lógica se basa en los identifiers.
      // this.senderPhone = ...
      // this.recipientPhone = ...

      // CAMPOS OBLIGATORIOS CON VALORES POR DEFECTO
      logger.info('🔍 MESSAGE.CONSTRUCTOR - ASIGNANDO CAMPOS OBLIGATORIOS', {
        requestId,
        direction: data.direction,
        type: data.type,
        status: data.status,
        hasTimestamp: !!data.timestamp,
        hasMetadata: !!data.metadata,
        hasCreatedAt: !!data.createdAt,
        hasUpdatedAt: !!data.updatedAt,
        step: 'required_fields_assignment_start'
      });

      this.direction = data.direction || 'inbound';
      this.type = data.type || (this.mediaUrl ? 'media' : 'text');
      this.status = data.status || 'sent';
      this.timestamp = data.timestamp || Timestamp.now();
      this.metadata = data.metadata || {};
      this.createdAt = data.createdAt || Timestamp.now();
      this.updatedAt = data.updatedAt || Timestamp.now();

      logger.info('✅ MESSAGE.CONSTRUCTOR - CAMPOS OBLIGATORIOS ASIGNADOS', {
        requestId,
        direction: this.direction,
        type: this.type,
        status: this.status,
        hasTimestamp: !!this.timestamp,
        hasMetadata: !!this.metadata,
        hasCreatedAt: !!this.createdAt,
        hasUpdatedAt: !!this.updatedAt,
        step: 'required_fields_assigned'
      });

      logger.info('✅ MESSAGE.CONSTRUCTOR - CONSTRUCCIÓN COMPLETADA', {
        requestId,
        messageId: this.id,
        conversationId: this.conversationId,
        senderIdentifier: this.senderIdentifier,
        recipientIdentifier: this.recipientIdentifier,
        content: this.content,
        type: this.type,
        direction: this.direction,
        step: 'constructor_complete'
      });

    } catch (error) {
      // === LOG EXTREMADAMENTE DETALLADO DEL ERROR DEL CONSTRUCTOR ===
      logger.error('❌ MESSAGE.CONSTRUCTOR - ERROR CRÍTICO', {
        requestId,
        error: error.message,
        errorType: error.constructor.name,
        stack: error.stack?.split('\n').slice(0, 20),
        data: {
          hasId: !!data.id,
          hasMessageId: !!data.messageId,
          hasConversationId: !!data.conversationId,
          hasSenderIdentifier: !!data.senderIdentifier,
          hasRecipientIdentifier: !!data.recipientIdentifier,
          hasContent: !!data.content,
          hasMediaUrl: !!data.mediaUrl,
          id: data.id,
          messageId: data.messageId,
          conversationId: data.conversationId,
          senderIdentifier: data.senderIdentifier,
          recipientIdentifier: data.recipientIdentifier,
          content: data.content,
          contentLength: data.content?.length || 0,
          mediaUrl: data.mediaUrl,
          type: data.type,
          direction: data.direction,
          status: data.status,
          hasMetadata: !!data.metadata,
          metadataKeys: data.metadata ? Object.keys(data.metadata) : []
        },
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
    
    console.log('🚨 MESSAGE.CREATE STARTED:', {
      requestId,
      messageDataId: messageData?.id,
      conversationId: messageData?.conversationId,
      uniqueMessageId,
      step: 'message_create_start'
    });
    
    try {
      const message = new Message(messageData);

      console.log('🚨 MESSAGE CONSTRUCTOR:', {
        requestId,
        originalDataId: messageData.id,
        assignedMessageId: message.id,
        assignedConversationId: message.conversationId,
        areIdsSame: message.id === message.conversationId,
        step: 'constructor_completed'
      });

      // Check if conversation exists, if not, create it
      const conversationRef = firestore.collection('conversations').doc(message.conversationId);
      const conversationDoc = await conversationRef.get();

      if (!conversationDoc.exists) {
        console.log('🚨 CONVERSATION NOT EXISTS:', {
          requestId,
          conversationId: message.conversationId,
          step: 'conversation_not_exists'
        });
        
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
        
        console.log('🚨 CONVERSATION CREATED:', {
          requestId,
          conversationId: message.conversationId,
          step: 'conversation_created'
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

      console.log('🚨 FIRESTORE PREPARATION:', {
        requestId,
        originalMessageId: message.id,
        cleanDataId: cleanData.id,
        areIdsSame: message.id === cleanData.id,
        step: 'firestore_prepared'
      });

      // Aggressive cleaning of undefined/null values
      const firestoreData = {};
      for (const [key, value] of Object.entries(cleanData)) {
        if (value !== undefined && value !== null && value !== '') {
          firestoreData[key] = value;
        }
      }

      console.log('🚨 FIRESTORE CLEANED DATA:', {
        requestId,
        originalKeys: Object.keys(cleanData),
        cleanedKeys: Object.keys(firestoreData),
        removedKeys: Object.keys(cleanData).filter(key => !firestoreData.hasOwnProperty(key)),
        hasId: !!firestoreData.id,
        hasContent: !!firestoreData.content,
        hasConversationId: !!firestoreData.conversationId,
        step: 'data_cleaning_complete'
      });

      // Critical verification before saving
      if (!firestoreData.id || !firestoreData.conversationId) {
        throw new Error(`CRITICAL DATA MISSING: id=${!!firestoreData.id}, conversationId=${!!firestoreData.conversationId}`);
      }

      console.log('🚨 EMERGENCY CRITICAL ID CHECK:', {
        requestId,
        idForFirestore: uniqueMessageId,
        path: `conversations/${message.conversationId}/messages/${uniqueMessageId}`,
        step: 'before_firestore_set'
      });

      // Save message to Firestore subcollection using the uniqueMessageId
      await firestore.collection('conversations').doc(message.conversationId).collection('messages').doc(uniqueMessageId).set(firestoreData);

      console.log('🚨 EMERGENCY LOG - AFTER FIRESTORE SAVE:', { 
        requestId, 
        messageId: uniqueMessageId, 
        conversationId: message.conversationId, 
        step: 'firestore_saved_emergency' 
      });

      return message;

    } catch (error) {
      console.log('🚨 EMERGENCY LOG - MESSAGE.CREATE ERROR:', {
        requestId,
        error: error.message,
        errorType: error.constructor.name,
        timestamp: new Date().toISOString()
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

    return {
      id: this.id,
      conversationId: this.conversationId,
      content: this.content,
      mediaUrl: this.mediaUrl,
      
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
}

module.exports = Message;
