const { v4: uuidv4 } = require('uuid');
const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const logger = require('../utils/logger');
const { prepareForFirestore } = require('../utils/firestore');
const { isValidConversationId } = require('../utils/conversation');
const { ensureConversationAssignment } = require('../utils/agentAssignment');
const { safeDateToISOString } = require('../utils/dateHelpers');

class Conversation {
  constructor (data) {
    // ✅ VALIDACIÓN: Asegurar que data sea un objeto válido
    if (!data || typeof data !== 'object') {
      logger.warn('Datos inválidos en constructor de Conversation', {
        category: 'CONVERSATION_CONSTRUCTOR_WARNING',
        dataType: typeof data,
        dataValue: data
      });
      data = {};
    }

    // ID: Usar UUIDv4 si no se proporciona uno. EMAIL-FIRST.
    this.id = data.id || uuidv4();

    // PARTICIPANTS: Array de emails de usuarios internos y/o teléfonos de externos.
    this.participants = Array.isArray(data.participants) ? data.participants : [];

    // CUSTOMER: Identificador del cliente externo.
    this.customerPhone = data.customerPhone || '';
    this.customerName = data.customerName || '';

    // DEPRECATED: agentPhone se elimina, se usa assignedTo (EMAIL).
    // this.agentPhone = data.agentPhone;

    // CONTACT: Info del cliente.
    this.contact = data.contact && typeof data.contact === 'object' 
      ? data.contact 
      : { id: this.customerPhone, name: this.customerName || this.customerPhone };

    // CAMPOS OBLIGATORIOS CON VALORES POR DEFECTO
    this.lastMessage = data.lastMessage || null;
    this.lastMessageId = data.lastMessageId || null;
    this.lastMessageAt = data.lastMessageAt || null;
    this.unreadCount = typeof data.unreadCount === 'number' ? data.unreadCount : 0;
    this.messageCount = typeof data.messageCount === 'number' ? data.messageCount : 0;
    this.status = data.status || 'open';
    this.priority = data.priority || 'normal'; // NUEVO: Prioridad
    this.tags = Array.isArray(data.tags) ? data.tags : []; // NUEVO: Etiquetas
    
    // ASSIGNED_TO: EMAIL del agente asignado. La única fuente de verdad.
    this.assignedTo = data.assignedTo || null;
    this.assignedToName = data.assignedToName || null;
    
    // CAMPOS DE CREACIÓN Y ACTUALIZACIÓN
    this.createdAt = data.createdAt || Timestamp.now();
    this.updatedAt = data.updatedAt || Timestamp.now();
    this.createdBy = data.createdBy || null;
    
    // CAMPOS DE WORKSPACE Y TENANT
    this.workspaceId = data.workspaceId || 'default_workspace';
    this.tenantId = data.tenantId || 'default_tenant';
    
    // CAMPOS ADICIONALES DEL FRONTEND
    this.subject = data.subject || null;
    this.channel = data.channel || 'whatsapp';
    this.source = data.source || 'manual';
    this.externalId = data.externalId || null;
    this.notes = data.notes || null;
    this.customFields = data.customFields || {};
    
    // METADATA EXPANDIDA
    this.metadata = {
      ...(data.metadata || {}),
      channel: this.channel,
      createdVia: this.source,
      frontendData: true
    };
    
    // CAMPOS DE MENSAJES (para compatibilidad)
    this.messages = Array.isArray(data.messages) ? data.messages : [];
  }

  /**
   * Valida y normaliza el teléfono del cliente.
   */
  validateCustomerPhone(phone) {
    if (!phone) {
        // En un sistema EMAIL-first, una conversación podría no tener un teléfono
      // si es entre dos usuarios internos. Por ahora, lo mantenemos requerido.
      throw new Error('customerPhone es requerido.');
    }
    return phone;
  }

  /**
   * 🔧 NUEVA FUNCIÓN: Asegurar que participants incluya cliente y agente
   * Garantiza que el array participants siempre contenga:
   * 1. El número de teléfono del cliente
   * 2. El email del agente/admin (si está asignado)
   * 3. El email del creador (siempre)
   * Sin duplicados
   */
  static ensureParticipantsArray(customerPhone, agentEmail = null, existingParticipants = []) {
    const participants = [...existingParticipants];
    
    // AGREGAR TELÉFONO DEL CLIENTE (si no existe)
    if (customerPhone && !participants.includes(customerPhone)) {
      participants.push(customerPhone);
    }
    
    // AGREGAR EMAIL DEL AGENTE (si no existe)
    if (agentEmail && !participants.includes(agentEmail)) {
      participants.push(agentEmail);
    }
    
    // 🔧 CRÍTICO: Agregar variantes del agente para compatibilidad
    if (agentEmail) {
      const agentVariants = [
        agentEmail,
        `agent:${agentEmail}`,
        `whatsapp:${customerPhone}`
      ];
      
      agentVariants.forEach(variant => {
        if (!participants.includes(variant)) {
          participants.push(variant);
        }
      });
    }
    
    logger.info('🔧 Array de participants actualizado', {
      customerPhone,
      agentEmail,
      participantsCount: participants.length,
      participants
    });
    
    return participants;
  }

  /**
   * DEPRECATED: Ya no se usa.
   */
  validateAndNormalizeParticipants (participants) {
    // Esta lógica ahora se centrará en validar EMAILs y teléfonos.
    // Por ahora, aceptamos el array como viene.
    return participants;
  }

  /**
   * DEPRECATED: Se reemplaza por lógica de EMAILs.
   */
  getCustomerPhone () {
    return this.customerPhone;
  }

  /**
   * DEPRECATED: Se reemplaza por assignedTo.
   */
  getAgentPhone () {
    logger.warn('getAgentPhone() está obsoleto. Usar `assignedTo` (EMAIL).');
    return null;
  }

  /**
   * REFACTORIZADO: Crear o encontrar una conversación. EMAIL-FIRST.
   * Busca una conversación abierta para un `customerPhone`. Si no existe, la crea.
   */
  static async findOrCreate(customerPhone, agentEmail = null) {
    const normalizedPhone = customerPhone;
    if (!normalizedPhone) {
      throw new Error('Número de teléfono de cliente inválido.');
    }

    // Buscar una conversación abierta o pendiente para este cliente.
    const existingConversation = await this.findOpenByCustomerPhone(normalizedPhone);

    if (existingConversation) {
      logger.info(`Conversación existente encontrada para ${normalizedPhone}`, { id: existingConversation.id });
      return existingConversation;
    }

    // Si no existe, crear una nueva.
    logger.info(`No se encontró conversación abierta. Creando nueva para ${normalizedPhone}`);
    
    // 🔧 CRÍTICO: Generar conversationId con formato correcto
    const { generateConversationId } = require('../utils/conversation');
    const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_FROM || process.env.WHATSAPP_FROM;
    
    if (!whatsappNumber) {
      throw new Error('TWILIO_WHATSAPP_NUMBER no configurado');
    }

    const conversationId = generateConversationId(whatsappNumber, normalizedPhone);
    
    // 🔧 CORREGIDO: Usar ensureParticipantsArray para garantizar participants correcto
    const participants = Conversation.ensureParticipantsArray(
      normalizedPhone, 
      agentEmail,
      [agentEmail] // Incluir explícitamente al agente
    );
    
    const conversationData = {
      id: conversationId,
      customerPhone: normalizedPhone,
      participants: participants, // 🔧 CORREGIDO: Array completo con cliente y agente
      status: 'open',
      assignedTo: agentEmail, // EMAIL del agente (puede ser null)
      createdBy: agentEmail, // 🔧 AGREGAR: Campo createdBy
      workspaceId: 'default_workspace',
      tenantId: 'default_tenant',
      unreadCount: 0,
      messageCount: 0,
      priority: 'normal',
      tags: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      lastMessageAt: Timestamp.now()
    };

    const conversation = new Conversation(conversationData);
    
    // 🔧 NUEVO: Crear conversación con subcolección messages
    await conversation.saveWithMessagesSubcollection();
    
    return conversation;
  }

  /**
   * NUEVO: Busca una conversación abierta o pendiente por el teléfono del cliente.
   */
  static async findOpenByCustomerPhone(customerPhone) {
    const q = firestore.collection('conversations')
      .where('customerPhone', '==', customerPhone)
      .where('status', 'in', ['open', 'pending'])
      .limit(1);

    const snapshot = await q.get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return new Conversation({ id: doc.id, ...doc.data() });
  }


  /**
   * Guarda o actualiza la conversación en Firestore.
   */
  async save() {
    const data = prepareForFirestore({
      ...this,
        updatedAt: FieldValue.serverTimestamp(),
      });

    await firestore.collection('conversations').doc(this.id).set(data, { merge: true });
    logger.info('Conversación guardada.', { id: this.id });
  }

  /**
   * 🔧 NUEVO: Guarda la conversación y crea la subcolección messages
   */
  async saveWithMessagesSubcollection() {
    const data = prepareForFirestore({
      ...this,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const conversationRef = firestore.collection('conversations').doc(this.id);
    
    // 🔧 CRÍTICO: Crear conversación y subcolección messages en una transacción
    await firestore.runTransaction(async (transaction) => {
      // Crear el documento de conversación
      transaction.set(conversationRef, data, { merge: true });
      
      // 🔧 CRÍTICO: Crear la subcolección messages con un documento inicial
      const messagesRef = conversationRef.collection('messages');
      const initialMessageDoc = {
        id: 'initial_placeholder',
        conversationId: this.id,
        content: 'Conversación iniciada',
        type: 'system',
        direction: 'system',
        status: 'sent',
        senderIdentifier: this.createdBy || 'system',
        recipientIdentifier: this.customerPhone,
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          isInitialPlaceholder: true,
          createdWithConversation: true
        }
      };
      
      // Crear documento inicial en la subcolección messages
      transaction.set(messagesRef.doc('initial_placeholder'), initialMessageDoc);
    });

    logger.info('✅ Conversación guardada con subcolección messages', { 
      id: this.id,
      hasMessagesSubcollection: true 
    });
  }

  /**
   * Obtener conversación por ID
   */
  static async getById (id) {
    // Se mantiene igual, pero ahora el ID es un UUID.
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
      assignedTo = undefined,
      status = null,
      customerPhone = null,
      participantEmail = null,
      fetchForUser = null, // NUEVO
      sortBy = 'lastMessageAt',
      sortOrder = 'desc',
    } = options;

    const validatedLimit = Math.min(Math.max(limit, 1), 100);
    
    // VISTA GENERAL DEL PANEL
    if (fetchForUser) {
      logger.info('Ejecutando consulta combinada para panel', { user: fetchForUser });

      const assignedQuery = firestore.collection('conversations').where('assignedTo', '==', fetchForUser);
      const unassignedQuery = firestore.collection('conversations').where('assignedTo', '==', null);

      let queries = [assignedQuery, unassignedQuery];
      
      // Aplicar filtros adicionales a ambas consultas
      queries = queries.map(q => {
          if (status) q = q.where('status', '==', status);
          return q.orderBy(sortBy, sortOrder).limit(validatedLimit);
      });

      const [assignedSnapshot, unassignedSnapshot] = await Promise.all(queries.map(q => q.get()));
      
      // 🔍 LOG CRÍTICO DE CONSULTA FIRESTORE
      logger.info(`[BACKEND][CONVERSATIONS][FIRESTORE] Asignadas: ${assignedSnapshot.size} | No asignadas: ${unassignedSnapshot.size} | Usuario: ${fetchForUser}`);
      
      const combined = new Map();
      assignedSnapshot.docs.forEach(doc => combined.set(doc.id, new Conversation({ id: doc.id, ...doc.data() })));
      unassignedSnapshot.docs.forEach(doc => combined.set(doc.id, new Conversation({ id: doc.id, ...doc.data() })));

      const uniqueConversations = Array.from(combined.values());
      
      uniqueConversations.sort((a, b) => {
          const valA = a[sortBy] || new Date(0);
          const valB = b[sortBy] || new Date(0);
          const timeA = valA.toMillis ? valA.toMillis() : new Date(valA).getTime();
          const timeB = valB.toMillis ? valB.toMillis() : new Date(valB).getTime();
          return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
      
      const conversations = uniqueConversations.slice(0, validatedLimit);
      
      // 🔍 LOG CRÍTICO DE RESULTADO FINAL
      logger.info(`[BACKEND][CONVERSATIONS][COMBINADAS] Total únicas: ${uniqueConversations.length} | Limitadas: ${conversations.length}`);
      
      return { conversations, pagination: { hasMore: uniqueConversations.length > validatedLimit, limit: validatedLimit } };
    }

    // BÚSQUEDA ESPECÍFICA
    logger.info('Ejecutando consulta específica', { options });
    let query = firestore.collection('conversations');

    if (participantEmail) {
      query = query.where('participants', 'array-contains', participantEmail);
    } else if (assignedTo !== undefined) {
      query = query.where('assignedTo', '==', assignedTo);
    }
    
    if (status) query = query.where('status', '==', status);
    if (customerPhone) {
      query = query.where('customerPhone', '==', customerPhone);
    }

    query = query.orderBy(sortBy, sortOrder);
    if (startAfter) query = query.startAfter(startAfter);

    const snapshot = await query.limit(validatedLimit + 1).get();
    
    // 🔍 LOG CRÍTICO DE CONSULTA ESPECÍFICA
    logger.info(`[BACKEND][CONVERSATIONS][FIRESTORE] Consulta específica: ${snapshot.size} documentos | Filtros: participantEmail=${participantEmail}, assignedTo=${assignedTo}, status=${status}`);
    
    const conversations = snapshot.docs.map(doc => {
      try {
        const conversationData = doc.data();
        // ✅ VALIDACIÓN: Asegurar que los datos de Firestore sean válidos
        if (!conversationData || typeof conversationData !== 'object') {
          logger.warn('Datos de conversación inválidos en Firestore', {
            category: 'CONVERSATION_MODEL_WARNING',
            docId: doc.id,
            dataType: typeof conversationData
          });
          return null;
        }
        
        return new Conversation({ id: doc.id, ...conversationData });
      } catch (error) {
        logger.error('Error creando instancia de Conversation', {
          category: 'CONVERSATION_MODEL_ERROR',
          docId: doc.id,
          error: error.message
        });
        return null;
      }
    }).filter(conv => conv !== null); // Remover conversaciones inválidas

    const hasMore = conversations.length > validatedLimit;
    if (hasMore) conversations.pop();

    const nextCursor = hasMore && conversations.length ? conversations[conversations.length - 1][sortBy] : null;

    // 🔍 LOG CRÍTICO DE RESULTADO ESPECÍFICO
    logger.info(`[BACKEND][CONVERSATIONS][ESPECIFICA] Resultado: ${conversations.length} conversaciones | hasMore: ${hasMore}`);

    return {
      conversations,
      pagination: { hasMore, nextCursor, limit: validatedLimit }
    };
  }

  /**
   * Actualizar conversación
   */
  async update (updates) {
    // No se actualiza el `agentPhone` porque ya no existe.
    const disallowedUpdates = ['id', 'agentPhone', 'createdAt'];
    for (const key of disallowedUpdates) {
      if (updates[key]) {
        delete updates[key];
      }
    }

    const cleanData = prepareForFirestore({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await firestore.collection('conversations').doc(this.id).update(cleanData);

    // Actualizar instancia local
    Object.assign(this, updates);
    this.updatedAt = Timestamp.now();
  }

  /**
   * Actualizar último mensaje
   */
  async updateLastMessage (message) {
    const lastMessageData = {
      id: message.id,
      content: message.content,
      timestamp: message.timestamp,
      sender: message.sender,
      type: message.type,
    };

    await this.update({
      lastMessage: lastMessageData,
      lastMessageId: message.id,
      lastMessageAt: message.timestamp,
      messageCount: FieldValue.increment(1),
      status: 'open', // Re-abrir la conversación si estaba cerrada.
    });

    this.lastMessage = lastMessageData;
    this.lastMessageId = message.id;
    this.lastMessageAt = message.timestamp;
    this.messageCount = (this.messageCount || 0) + 1;
  }

  /**
   * Decrementar contador de mensajes al eliminar
   */
  async decrementMessageCount (deletedMessage, newLastMessage = null) {
    const updates = {
      messageCount: FieldValue.increment(-1),
    };

    if (newLastMessage) {
      updates.lastMessage = {
        id: newLastMessage.id,
        content: newLastMessage.content,
        timestamp: newLastMessage.timestamp,
        sender: newLastMessage.sender,
        type: newLastMessage.type,
      };
      updates.lastMessageId = newLastMessage.id;
      updates.lastMessageAt = newLastMessage.timestamp;
    } else {
      updates.lastMessage = null;
      updates.lastMessageId = null;
      updates.lastMessageAt = null;
    }

    await this.update(updates);
  }

  /**
   * Recalcular contador de mensajes
   */
  async recalculateMessageCount () {
    const messagesSnapshot = await firestore
      .collection('conversations')
      .doc(this.id)
      .collection('messages')
      .get();

    const messageCount = messagesSnapshot.size;

    await this.update({
      messageCount,
    });

    this.messageCount = messageCount;
  }

  /**
   * Marcar como leída
   */
  static async markAsRead () {
    // Implementación futura
    logger.info('Marcando conversación como leída');
  }

  /**
   * Asignar a usuario
   */
  async assignTo (userEmail, userName = null) {
    // VALIDACIÓN: userEmail debe ser un EMAIL real
    if (!userEmail || typeof userEmail !== 'string') {
      throw new Error('userEmail debe ser un EMAIL válido');
    }

    // Aquí se podría validar que el EMAIL existe en la colección users
    logger.info('Asignando conversación a usuario', {
      conversationId: this.id,
      userEmail,
      userName: userName || 'no_especificado',
      previousAssignedTo: this.assignedTo,
    });

    // 🔧 CORREGIDO: Actualizar participants para incluir al nuevo agente
    const updatedParticipants = Conversation.ensureParticipantsArray(
      this.customerPhone,
      userEmail,
      this.participants || []
    );

    const updateData = {
      assignedTo: userEmail,
      participants: updatedParticipants, // 🔧 CORREGIDO: Actualizar participants
      updatedAt: Timestamp.now(),
    };

    // Agregar nombre si se proporciona
    if (userName) {
      updateData.assignedToName = userName;
    }

    await this.update(updateData);

    // 🔧 CORREGIDO: Actualizar instancia local
    this.assignedTo = userEmail;
    this.participants = updatedParticipants;
    if (userName) {
      this.assignedToName = userName;
    }
  }

  /**
   * Cambiar estado
   */
  async changeStatus (newStatus) {
    const validStatuses = ['open', 'closed', 'pending', 'archived'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Estado inválido: ${newStatus}`);
    }

    await this.update({
      status: newStatus,
    });

    this.status = newStatus;
  }

  /**
   * Obtener estadísticas de la conversación
   */
  async getStats () {
    try {
      const messagesSnapshot = await firestore
        .collection('conversations')
        .doc(this.id)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .get();

      const messages = messagesSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      }));

      // CENTRALIZADO: Usar la misma lógica de cálculo que Message.getStats()
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
   * CORREGIDO: Convertir a objeto plano para respuestas JSON
   * ESTRUCTURA CANÓNICA según especificación del frontend
   * assignedTo es el campo PRINCIPAL - assignedAgent solo para compatibilidad
   * FECHAS SIEMPRE COMO STRING ISO: Utiliza safeDateToISOString
   */
  toJSON () {
    try {
      // FECHAS SIEMPRE COMO STRING ISO
      const normalizedCreatedAt = safeDateToISOString(this.createdAt);
      const normalizedUpdatedAt = safeDateToISOString(this.updatedAt);
      const normalizedLastMessageAt = safeDateToISOString(this.lastMessageAt);

      // PARTICIPANTS: Puede contener EMAILs y/o teléfonos.
      const validatedParticipants = this.participants || [];

      // CUSTOMER PHONE:
      const normalizedCustomerPhone = this.customerPhone;

      // AGENT PHONE (DEPRECATED): Se elimina.
      // const normalizedAgentPhone = null;

      // Construir objeto contact según especificación
      const contact = {
        id: normalizedCustomerPhone || this.contact?.id || 'unknown',
        name: this.contact?.profileName || this.contact?.name || this.customerName || normalizedCustomerPhone || 'Cliente',
        profileName: this.contact?.profileName || this.customerName,
        phoneNumber: normalizedCustomerPhone,
        waId: this.contact?.waId,
        avatar: this.contact?.avatar || null,
        channel: 'whatsapp',
        hasProfilePhoto: this.contact?.hasProfilePhoto || false,
        lastSeen: this.contact?.lastSeen || this.lastMessageAt
      };

      // ✅ NUEVA REFERENCIA AL CONTACTO
      const contactId = normalizedCustomerPhone;

              // ASSIGNED_TO: Objeto con EMAIL y nombre.
      let assignedTo = null;
      if (this.assignedTo) {
        assignedTo = {
          id: this.assignedTo,
          name: this.assignedToName || this.assignedTo,
        };
      }

              // ESTRUCTURA DE RESPUESTA FINAL (EMAIL-FIRST)
      const result = {
        id: this.id,
        participants: validatedParticipants,
        customerPhone: normalizedCustomerPhone,
        contactId: contactId, // ✅ NUEVA REFERENCIA AL CONTACTO
        // agentPhone: DEPRECATED
        contact,
        assignedTo,
        status: this.status || 'open',
        priority: this.priority || 'normal', // NUEVO: Prioridad
        tags: this.tags || [], // NUEVO: Etiquetas
        unreadCount: this.unreadCount || 0,
        messageCount: this.messageCount || 0,
        lastMessage: this.lastMessage || null,
        lastMessageId: this.lastMessageId || null,
        lastMessageAt: normalizedLastMessageAt,
        createdAt: normalizedCreatedAt,
        updatedAt: normalizedUpdatedAt,
      };

      // Validación final (simplificada)
      const missingFields = [];
      if (!result.id) missingFields.push('id');
      if (!result.customerPhone) missingFields.push('customerPhone');
      if (!result.status) missingFields.push('status');

      if (missingFields.length > 0) {
        logger.error('Campos críticos faltantes en Conversation.toJSON()', {
          conversationId: this.id,
          missingFields,
        });
      }

      return result;

    } catch (error) {
      // SAFETY NET: Nunca fallar la serialización
      logger.error('Error crítico en Conversation.toJSON()', {
        conversationId: this.id,
        error: error.message,
        stack: error.stack,
        originalData: {
          participants: this.participants,
          customerPhone: this.customerPhone,
          agentPhone: this.agentPhone,
          assignedTo: this.assignedTo,
          assignedToType: typeof this.assignedTo,
          lastMessageAt: this.lastMessageAt,
          createdAt: this.createdAt,
          updatedAt: this.updatedAt,
        },
      });

      // Retornar estructura mínima pero válida
      return {
        id: this.id || 'error',
        participants: [],
        customerPhone: null,
        agentPhone: null,
        contact: { id: 'error', name: 'Error', avatar: null, channel: 'whatsapp' },
        assignedTo: null,
        assignedAgent: null,
        status: 'error',
        unreadCount: 0,
        messageCount: 0,
        lastMessage: null,
        lastMessageId: null,
        lastMessageAt: null,
        createdAt: null,
        updatedAt: null,
      };
    }
  }

  /**
   * 🚫 Desasignar conversación (quitar agente)
   */
  async unassign() {
    this.assignedTo = null;
    this.assignedToName = null;
    this.updatedAt = Timestamp.now();

    await firestore
      .collection('conversations')
      .doc(this.id)
      .update(prepareForFirestore({
        assignedTo: null,
        assignedToName: null,
        updatedAt: FieldValue.serverTimestamp()
      }));

    logger.info('Conversación desasignada', {
      conversationId: this.id,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 🎯 Cambiar prioridad de conversación
   */
  async changePriority(newPriority) {
    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    if (!validPriorities.includes(newPriority)) {
      throw new Error(`Prioridad inválida: ${newPriority}. Debe ser: ${validPriorities.join(', ')}`);
    }

    this.priority = newPriority;
    this.updatedAt = Timestamp.now();

    await firestore
      .collection('conversations')
      .doc(this.id)
      .update(prepareForFirestore({
        priority: newPriority,
        updatedAt: FieldValue.serverTimestamp()
      }));

    logger.info('Prioridad de conversación cambiada', {
      conversationId: this.id,
      newPriority,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Marcar toda la conversación como leída por un usuario
   */
  async markAllAsRead(userEmail) {
    const messagesSnapshot = await firestore
      .collection('conversations')
      .doc(this.id)
      .collection('messages')
      .where('status', '!=', 'read')
      .get();

    let markedCount = 0;
    const batch = firestore.batch();

    messagesSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'read',
        readBy: FieldValue.arrayUnion(userEmail),
        readAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      markedCount++;
    });

    if (markedCount > 0) {
      await batch.commit();
      
      // Actualizar contador de no leídos
      this.unreadCount = 0;
      await firestore
        .collection('conversations')
        .doc(this.id)
        .update({ unreadCount: 0 });
    }

    logger.info('Conversación marcada como leída', {
      conversationId: this.id,
      userEmail,
      markedCount,
      timestamp: new Date().toISOString()
    });

    return markedCount;
  }

  /**
   * 📊 Obtener estadísticas de la conversación
   */
  static async getStats(agentEmail = null, period = '7d') {
    const startDate = new Date();
    const daysToSubtract = period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 7;
    startDate.setDate(startDate.getDate() - daysToSubtract);

    let query = firestore.collection('conversations');

    if (agentEmail) {
      query = query.where('assignedTo', '==', agentEmail);
    }

    query = query.where('createdAt', '>=', Timestamp.fromDate(startDate));

    const snapshot = await query.get();
    const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const stats = {
      total: conversations.length,
      open: conversations.filter(c => c.status === 'open').length,
      closed: conversations.filter(c => c.status === 'closed').length,
      pending: conversations.filter(c => c.status === 'pending').length,
      archived: conversations.filter(c => c.status === 'archived').length,
      assigned: conversations.filter(c => c.assignedTo).length,
      unassigned: conversations.filter(c => !c.assignedTo).length,
      byPriority: {
        low: conversations.filter(c => c.priority === 'low').length,
        normal: conversations.filter(c => c.priority === 'normal').length,
        high: conversations.filter(c => c.priority === 'high').length,
        urgent: conversations.filter(c => c.priority === 'urgent').length
      },
      averageResponseTime: this.calculateAverageResponseTime(conversations),
      period: period,
      agentEmail: agentEmail
    };

    return stats;
  }

  /**
   * 📊 Calcular tiempo promedio de respuesta
   */
  static calculateAverageResponseTime(conversations) {
    if (!conversations.length) return 0;

    const responseTimes = conversations
      .filter(c => c.lastMessageAt && c.createdAt)
      .map(c => {
        const created = c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
        const lastMsg = c.lastMessageAt.toDate ? c.lastMessageAt.toDate() : new Date(c.lastMessageAt);
        return lastMsg - created;
      });

    if (!responseTimes.length) return 0;

    const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    return Math.round(average / (1000 * 60)); // Retornar en minutos
  }

  /**
   * 🆕 Crear nueva conversación
   */
  static async create(conversationData) {
    const conversation = new Conversation(conversationData);
    
    const cleanData = prepareForFirestore({ ...conversation });
    
    await firestore
      .collection('conversations')
      .doc(conversation.id)
      .set(cleanData);
      
    logger.info('Nueva conversación creada', {
      conversationId: conversation.id,
      customerPhone: conversation.customerPhone,
      assignedTo: conversation.assignedTo,
      priority: conversation.priority,
      tags: conversation.tags
    });
    
    return conversation;
  }

  /**
   * 📋 Listar conversaciones con filtros y paginación mejorada
   */
  static async list(options = {}) {
    const {
      limit = 20,
      cursor = null,
      assignedTo = undefined,
      status = null,
      priority = null,
      tags = null,
      search = null,
      sortBy = 'lastMessageAt',
      sortOrder = 'desc'
    } = options;

    // Lógica de consulta principal
    // Si se especifica `fetchForUser`, se obtienen las conversaciones de ese usuario Y las no asignadas.
    if (assignedTo !== undefined) {
      logger.info('🚀 Ejecutando consulta combinada: (asignadas a usuario + no asignadas)', { fetchForUser: assignedTo });

      // 1. Crear las dos consultas base
      const baseUnassignedQuery = firestore.collection('conversations').where('assignedTo', '==', null);
      const baseAssignedQuery = firestore.collection('conversations').where('assignedTo', '==', assignedTo);

      // Lista de promesas de consulta
      const queries = [baseUnassignedQuery, baseAssignedQuery];
      let finalResults = [];

      // 2. Aplicar filtros y ejecutar consultas
      for (const baseQuery of queries) {
        let query = baseQuery;
        if (status) {
          query = query.where('status', '==', status);
        }
        // Aquí se pueden agregar más filtros comunes si es necesario (priority, tags, etc.)
        
        query = query.orderBy(sortBy, sortOrder);

        if (startAfter) {
          query = query.startAfter(startAfter);
        }

        query = query.limit(limit);
        
        const snapshot = await query.get();
        snapshot.docs.forEach(doc => {
          try {
            const conversationData = doc.data();
            // ✅ VALIDACIÓN: Asegurar que los datos de Firestore sean válidos
            if (!conversationData || typeof conversationData !== 'object') {
              logger.warn('Datos de conversación inválidos en Firestore (consulta combinada)', {
                category: 'CONVERSATION_MODEL_WARNING',
                docId: doc.id,
                dataType: typeof conversationData
              });
              return;
            }
            
            finalResults.push(new Conversation({ id: doc.id, ...conversationData }));
          } catch (error) {
            logger.error('Error creando instancia de Conversation (consulta combinada)', {
              category: 'CONVERSATION_MODEL_ERROR',
              docId: doc.id,
              error: error.message
            });
          }
        });
      }

      // 3. Unificar y ordenar resultados
      // Eliminar duplicados por si acaso
      finalResults = Array.from(new Map(finalResults.map(c => [c.id, c])).values());

      // Ordenar el array combinado
      finalResults.sort((a, b) => {
        const valA = a[sortBy] || new Date(0);
        const valB = b[sortBy] || new Date(0);
        const timeA = valA.toMillis ? valA.toMillis() : new Date(valA).getTime();
        const timeB = valB.toMillis ? valB.toMillis() : new Date(valB).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });

      // 4. Paginar el resultado final
      const conversations = finalResults.slice(0, limit);
      const hasMore = finalResults.length > limit;
      const nextCursor = hasMore && conversations.length > 0 ? conversations[conversations.length - 1][sortBy] : null;

      logger.info(`Consulta combinada completada. Total unificado: ${conversations.length}`, { fetchForUser: assignedTo });

      return {
        conversations,
        pagination: { hasMore, nextCursor, limit, totalResults: conversations.length },
      };
    }

    // Lógica de consulta específica (cuando no es la vista general)
    logger.info('🚀 Ejecutando consulta específica (no combinada)');
    let query = firestore.collection('conversations');

    // 🔍 APLICAR FILTROS
    if (assignedTo !== undefined) {
      query = query.where('assignedTo', '==', assignedTo);
    }

    if (status) {
      query = query.where('status', '==', status);
    }

    if (priority) {
      query = query.where('priority', '==', priority);
    }

    if (tags && tags.length > 0) {
      query = query.where('tags', 'array-contains-any', tags);
    }

    // 🔍 BÚSQUEDA POR TEXTO (limitada en Firestore)
    if (search) {
      // Buscar por customerPhone (implementar más tarde con Algolia si es necesario)
      query = query.where('customerPhone', '>=', search)
                   .where('customerPhone', '<=', search + '\uf8ff');
    }

    // 📊 ORDENAMIENTO
    query = query.orderBy(sortBy, sortOrder);

    // 📄 PAGINACIÓN
    if (cursor) {
      // Implementar cursor pagination
      query = query.startAfter(cursor);
    }

    query = query.limit(limit + 1); // +1 para determinar hasMore

    const snapshot = await query.get();
    const conversations = [];
    let hasMore = false;

    snapshot.docs.forEach((doc, index) => {
      if (index < limit) {
        conversations.push(new Conversation({ id: doc.id, ...doc.data() }));
      } else {
        hasMore = true;
      }
    });

    const result = {
      conversations,
      pagination: {
        hasMore,
        nextCursor: hasMore && conversations.length > 0 ? conversations[conversations.length - 1].id : null,
        totalResults: conversations.length,
        limit
      }
    };

    return result;
  }

  /**
   * Archivar conversación
   */
  async archive () {
    await this.changeStatus('archived');
  }

  /**
   * 🔍 Buscar conversaciones con mejor implementación
   */
  static async search (searchTerm, options = {}) {
    // Implementación mejorada de búsqueda
    const { limit = 20, assignedTo = null } = options;
    
    let query = firestore.collection('conversations');
    
    if (assignedTo) {
      query = query.where('assignedTo', '==', assignedTo);
    }

    // Búsqueda básica por customerPhone
    if (searchTerm.startsWith('+')) {
      query = query.where('customerPhone', '>=', searchTerm)
                   .where('customerPhone', '<=', searchTerm + '\uf8ff');
    }

    query = query.limit(limit);
    const snapshot = await query.get();

    const conversations = snapshot.docs.map(doc => 
      new Conversation({ id: doc.id, ...doc.data() })
    );

    // Filtro adicional por nombre de contacto (en memoria)
    if (!searchTerm.startsWith('+')) {
    return conversations.filter(conv =>
      conv.contact?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.customerPhone?.includes(searchTerm)
    );
    }

    return conversations;
  }

  /**
   * Buscar conversación por números de teléfono
   */
  static async findByPhones (phone1, phone2) {
    try {
      logger.info('🔍 CONVERSATION.FINDBYPHONES - BUSCANDO CONVERSACIÓN', {
        phone1,
        phone2,
        step: 'search_start'
      });

      const { generateConversationId } = require('../utils/conversation');
      const conversationId = generateConversationId(phone1, phone2);

      logger.info('🔍 CONVERSATION.FINDBYPHONES - CONVERSATIONID GENERADO', {
        conversationId,
        phone1,
        phone2,
        step: 'conversation_id_generated'
      });

      const conversation = await this.getById(conversationId);

      if (conversation) {
        logger.info('✅ CONVERSATION.FINDBYPHONES - CONVERSACIÓN ENCONTRADA', {
          conversationId,
          phone1,
          phone2,
          step: 'conversation_found'
        });
      } else {
        logger.info('❌ CONVERSATION.FINDBYPHONES - CONVERSACIÓN NO ENCONTRADA', {
          conversationId,
          phone1,
          phone2,
          step: 'conversation_not_found'
        });
      }

      return conversation;

    } catch (error) {
      logger.error('❌ CONVERSATION.FINDBYPHONES - ERROR CRÍTICO', {
        phone1,
        phone2,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 5),
        step: 'search_error'
      });
      throw error;
    }
  }
}

module.exports = Conversation;
