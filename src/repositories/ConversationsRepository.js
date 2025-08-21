/**
 * 🏗️ REPOSITORIO UNIFICADO DE CONVERSACIONES
 * 
 * Implementa acceso estandarizado a conversaciones con soporte para:
 * - Modo tenant (docs con workspaceId/tenantId)
 * - Modo legacy (docs existentes sin esos campos) durante migración
 * - Compatibilidad retroactiva con flags de configuración
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { firestore } = require('../config/firebase');
const logger = require('../utils/logger');
const { FieldValue } = require('firebase-admin/firestore');
const { redactQueryLog } = require('../utils/redact');
const { getDefaultViewerEmails } = require('../config/defaultViewers');

/**
 * ViewModel canónico para conversaciones
 * @typedef {object} ConversationVM
 * @property {string} id - Unique identifier for the conversation
 * @property {object} [contact] - Optional contact information
 * @property {string} [contact.name] - Contact's name
 * @property {string} [contact.phone] - Contact's phone number
 * @property {string} customerPhone - The primary phone number associated with the conversation
 * @property {object} [lastMessage] - Details of the last message in the conversation
 * @property {string} lastMessage.content - Content of the last message
 * @property {string} [lastMessage.messageId] - ID of the last message
 * @property {string} [lastMessage.sender] - Sender of the last message
 * @property {admin.firestore.Timestamp} [lastMessage.timestamp] - Timestamp of the last message
 * @property {admin.firestore.Timestamp} [lastMessageAt] - Timestamp of the last message
 * @property {number} [unreadCount=0] - Number of unread messages
 * @property {'open'|'closed'|'archived'} [status] - Current status of the conversation
 * @property {string} [workspaceId] - ID of the workspace this conversation belongs to
 * @property {string} [tenantId] - ID of the tenant this conversation belongs to
 * @property {string} [assignedTo] - User ID to whom the conversation is assigned
 * @property {string[]} [participants] - Array of participant identifiers
 */

class ConversationsRepository {
  constructor() {
    this.collectionPath = process.env.CONVERSATIONS_COLLECTION_PATH || 'conversations';
    this.tenantMode = process.env.TENANT_MODE === 'true';
    this.legacyCompat = process.env.LEGACY_COMPAT === 'true';
    this.verboseLogs = process.env.LOG_VERBOSE_CONVERSATIONS === 'true';
  }

  /**
   * Construir query de Firestore con filtros reales (endurecido)
   * @param {object} params - Parámetros de construcción
   * @returns {object} Query builder y debug info
   */
  buildQuery(params = {}) {
    const {
      workspaceId,
      tenantId,
      filters = {},
      pagination = {}
    } = params;

    const { status, assignedTo, participantsContains } = filters;
    const { limit = 50, cursor } = pagination;

    let query = firestore.collection(this.collectionPath);

    // Aplicar filtros reales (siempre que existan)
    if (workspaceId) {
      query = query.where('workspaceId', '==', workspaceId);
    }

    if (tenantId) {
      query = query.where('tenantId', '==', tenantId);
    }

    // Aplicar filtros de estado (solo si viene en filtros)
    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }

    // Aplicar filtro de asignación (solo si viene en filtros)
    if (assignedTo) {
      query = query.where('assignedTo', '==', assignedTo);
    }

    // Aplicar filtro de participantes (array-contains) - CRÍTICO
    if (participantsContains) {
      query = query.where('participants', 'array-contains', participantsContains);
    }

    // Ordenar por última actividad
    query = query.orderBy('lastMessageAt', 'desc');

    // Aplicar paginación
    if (cursor) {
      // Implementar cursor-based pagination si es necesario
      // Por ahora, usar limit simple
    }
    query = query.limit(limit);

    const debug = {
      collectionPath: this.collectionPath,
      wheres: this._extractWheres(query),
      orderBy: 'lastMessageAt desc',
      limit,
      cursor,
      mode: 'hardened'
    };

    return { query, debug };
  }

  /**
   * Extraer información de where clauses para debug
   * @private
   */
  _extractWheres(query) {
    // Esta es una implementación simplificada
    // En una implementación real, necesitarías acceder a los where clauses del query
    const wheres = [];
    
    // Reconstruir wheres basado en los filtros reales aplicados
    // workspaceId y tenantId se aplican siempre si existen
    wheres.push({ field: 'workspaceId', op: '==', value: 'masked' });
    wheres.push({ field: 'tenantId', op: '==', value: 'masked' });
    
    // Filtros opcionales (solo si vienen en params)
    wheres.push({ field: 'participants', op: 'array-contains', value: 'masked' });
    wheres.push({ field: 'status', op: '==', value: 'masked' });
    wheres.push({ field: 'assignedTo', op: '==', value: 'masked' });
    
    return wheres.filter(Boolean);
  }

  /**
   * Mapear documento de Firestore a ConversationVM
   * @param {FirebaseFirestore.DocumentSnapshot} doc - Documento de Firestore
   * @returns {ConversationVM} ViewModel de conversación
   */
  mapToConversationVM(doc) {
    const docData = doc.data();
    const docId = doc.id;

    const vm = {
      id: docData.id || docId,
      customerPhone: docData.customerPhone,
      lastMessage: docData.lastMessage || {},
      unreadCount: docData.unreadCount !== undefined ? docData.unreadCount : 0,
      status: docData.status,
      workspaceId: docData.workspaceId,
      tenantId: docData.tenantId,
      assignedTo: docData.assignedTo,
      participants: docData.participants,
      // Derive lastMessageAt if not present
      lastMessageAt: docData.lastMessageAt || (docData.lastMessage && docData.lastMessage.timestamp ? docData.lastMessage.timestamp : null),
      // Optional: derive contact if not present
      contact: docData.contact ? {
        id: docData.contact.id || docData.customerPhone,
        name: docData.contact.profileName || docData.contact.name || docData.customerName || 'Cliente',
        profileName: docData.contact.profileName || docData.customerName,
        phoneNumber: docData.customerPhone,
        waId: docData.contact.waId,
        hasProfilePhoto: docData.contact.hasProfilePhoto || false,
        avatar: docData.contact.avatar || null,
        channel: 'whatsapp'
      } : (docData.customerPhone ? { 
        id: docData.customerPhone,
        name: docData.customerName || 'Cliente',
        profileName: docData.customerName,
        phoneNumber: docData.customerPhone,
        waId: null,
        hasProfilePhoto: false,
        avatar: null,
        channel: 'whatsapp'
      } : undefined),
      // Preserve other fields
      createdAt: docData.createdAt,
      updatedAt: docData.updatedAt,
      messageCount: docData.messageCount,
      priority: docData.priority,
      tags: docData.tags
    };

    return vm;
  }

  /**
   * Listar conversaciones con filtros reales (endurecido)
   * @param {object} params - Parámetros de listado
   * @returns {Promise<{conversations: ConversationVM[], hasNext: boolean, nextCursor: string|null, debug?: object}>}
   */
  async list(params = {}) {
    const startTime = Date.now();
    const { workspaceId, tenantId, filters = {}, pagination = {} } = params;

    // Helper para enmascarar PII
    const maskEmail = (email) => {
      if (!email) return null;
      const [name, domain] = email.split('@');
      if (!name || !domain) return 'invalid_email';
      return `${name.charAt(0)}***@${domain}`;
    };

    const maskPhone = (phone) => {
      if (!phone) return null;
      const digits = phone.replace(/\D/g, '');
      if (digits.length <= 4) return '****';
      
      const internationalPrefixMatch = phone.match(/^(\+\d{1,4})?(\d+)$/);
      if (internationalPrefixMatch) {
        const prefix = internationalPrefixMatch[1] || '';
        const numberPart = internationalPrefixMatch[2];
        if (numberPart.length <= 4) return `${prefix}****`;
        return `${prefix}${numberPart.substring(0, numberPart.length - 4)}****${numberPart.substring(numberPart.length - 2)}`;
      }
      
      return phone.substring(0, phone.length - 4) + '****' + phone.substring(phone.length - 2);
    };

    try {
      // Construir query única con filtros reales
      const { query, debug } = this.buildQuery(params);
      
      // --- LOGS DE DIAGNÓSTICO (solo si LOG_CONV_DIAG=true) ---
      if (process.env.LOG_CONV_DIAG === 'true') {
        const diagnosticLog = {
          event: 'conversations_repo:query',
          collectionPath: this.collectionPath,
          wheres: [
            ...(workspaceId ? [{ field: 'workspaceId', op: '==', value: 'masked' }] : []),
            ...(tenantId ? [{ field: 'tenantId', op: '==', value: 'masked' }] : []),
            ...(filters.status && filters.status !== 'all' ? [{ field: 'status', op: '==', value: filters.status }] : []),
            ...(filters.assignedTo ? [{ field: 'assignedTo', op: '==', value: maskEmail(filters.assignedTo) }] : []),
            ...(filters.participantsContains ? [{ field: 'participants', op: 'array-contains', value: maskEmail(filters.participantsContains) }] : [])
          ],
          orderBy: 'lastMessageAt desc',
          limit: pagination.limit || 50,
          cursor: pagination.cursor ? 'present' : 'none',
          mode: 'hardened', // Identificar versión endurecida
          user: {
            emailMasked: maskEmail(filters.participantsContains),
            workspaceId: workspaceId ? 'present' : 'none',
            tenantId: tenantId ? 'present' : 'none'
          },
          ts: new Date().toISOString(),
          // A2: índice requerido (aprox) según combinación
          indexHint: {
            primary: workspaceId ? 'workspaceId + lastMessageAt desc' : (filters.participantsContains ? 'participants array-contains + lastMessageAt desc' : 'UNKNOWN'),
            withStatus: filters.status && filters.status !== 'all' ? 'workspaceId + status + lastMessageAt desc' : 'optional'
          }
        };

        logger.info('list.query_shape', diagnosticLog);
      }

      // Ejecutar query única (sin fallbacks)
      const snapshot = await query.get();
      const conversations = snapshot.docs.map(doc => this.mapToConversationVM(doc));

      const duration = Date.now() - startTime;
      const hasNext = conversations.length === pagination.limit;
      const nextCursor = hasNext ? conversations[conversations.length - 1]?.id : null;

      // --- LOGS DE DIAGNÓSTICO POST-QUERY (solo si LOG_CONV_DIAG=true) ---
      if (process.env.LOG_CONV_DIAG === 'true') {
        const postQueryLog = {
          event: 'conversations_repo:post_query',
          snapshotSize: conversations.length,
          mode: 'hardened',
          durationMs: duration,
          hasNext,
          nextCursor: nextCursor ? 'present' : 'none',
          ts: new Date().toISOString()
        };

        logger.info('conversations_diag', postQueryLog);
      }

      const result = {
        conversations,
        hasNext,
        nextCursor,
        debug: {
          source: 'hardened',
          duration_ms: duration,
          collectionPath: this.collectionPath,
          mode: 'hardened'
        }
      };

      if (this.verboseLogs) {
        logger.info('conversations_repo:list_completed', {
          event: 'conversations_repo:list_completed',
          conversationsCount: conversations.length,
          hasNext,
          nextCursor,
          mode: 'hardened',
          duration_ms: duration
        });
      }

      return result;

    } catch (error) {
      // --- LOGS DE DIAGNÓSTICO DE ERROR (solo si LOG_CONV_DIAG=true) ---
      if (process.env.LOG_CONV_DIAG === 'true') {
        const errorLog = {
          event: 'conversations_repo:error',
          error: {
            name: error.name,
            message: error.message
          },
          stack: error.stack,
          durationMs: Date.now() - startTime,
          mode: 'hardened',
          ts: new Date().toISOString()
        };

        logger.error('conversations_diag', errorLog);
      }

      if (this.verboseLogs) {
        logger.error('conversations_repo:list_error', {
          event: 'conversations_repo:list_error',
          error: error.message,
          stack: error.stack,
          params,
          mode: 'hardened',
          duration_ms: Date.now() - startTime
        });
      }
      throw error;
    }
  }

  /**
   * 🧠 ESCRITOR CANÓNICO: Procesar mensaje entrante (inbound)
   * Garantiza que cada mensaje inbound deje la conversación en estado canónico
   * 
   * @param {object} msg - Datos del mensaje normalizados
   * @returns {Promise<{message: object, conversation: object}>}
   */
  async upsertFromInbound(msg) {
    const startTime = Date.now();
    const requestId = msg.requestId || `upsert_inbound_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Helper para enmascarar PII
    const maskEmail = (email) => {
      if (!email) return null;
      const [name, domain] = email.split('@');
      if (!name || !domain) return 'invalid_email';
      return `${name.charAt(0)}***@${domain}`;
    };

    const maskPhone = (phone) => {
      if (!phone) return null;
      const digits = phone.replace(/\D/g, '');
      if (digits.length <= 4) return '****';
      
      const internationalPrefixMatch = phone.match(/^(\+\d{1,4})?(\d+)$/);
      if (internationalPrefixMatch) {
        const prefix = internationalPrefixMatch[1] || '';
        const numberPart = internationalPrefixMatch[2];
        if (numberPart.length <= 4) return `${prefix}****`;
        return `${prefix}${numberPart.substring(0, numberPart.length - 4)}****${numberPart.substring(numberPart.length - 2)}`;
      }
      
      return phone.substring(0, phone.length - 4) + '****' + phone.substring(phone.length - 2);
    };

    try {
      // Validar datos obligatorios
      if (!msg.conversationId || !msg.messageId || !msg.senderIdentifier) {
        throw new Error('conversationId, messageId y senderIdentifier son obligatorios');
      }

      // Normalizar datos
      const messageData = {
        id: msg.messageId,
        conversationId: msg.conversationId,
        content: msg.content || '',
        type: msg.type || 'text',
        direction: 'inbound',
        status: 'received',
        senderIdentifier: msg.senderIdentifier,
        recipientIdentifier: msg.recipientIdentifier,
        timestamp: msg.timestamp || new Date(),
        workspaceId: msg.workspaceId,
        tenantId: msg.tenantId,
        metadata: msg.metadata || {}
      };

      // 🔍 LOGGING ESTRUCTURADO DE INICIO
      if (process.env.LOG_MSG_WRITE === 'true') {
        logger.info({
          event: 'msg_inbound_attempt',
          requestId,
          conv: { conversationId: `conv_***${msg.conversationId.slice(-4)}` },
          msg: { messageId: `MSG_***${msg.messageId.slice(-4)}` },
          workspaceIdMasked: msg.workspaceId ? 'present' : 'none',
          tenantIdMasked: msg.tenantId ? 'present' : 'none',
          senderMasked: maskPhone(msg.senderIdentifier),
          recipientMasked: maskPhone(msg.recipientIdentifier),
          contentLength: msg.content?.length || 0
        });
      }

      // Transacción atómica: mensaje + conversación
      const result = await firestore.runTransaction(async (transaction) => {
        const conversationRef = firestore.collection(this.collectionPath).doc(msg.conversationId);
        const messageRef = conversationRef.collection('messages').doc(msg.messageId);

        // Verificar si el mensaje ya existe (idempotencia)
        const messageDoc = await transaction.get(messageRef);
        if (messageDoc.exists) {
          // Mensaje ya existe, no duplicar
          if (process.env.LOG_MSG_WRITE === 'true') {
            logger.info('message_write_diag', {
              event: 'message_write_idempotent',
              direction: 'inbound',
              conversationIdMasked: `conv_***${msg.conversationId.slice(-4)}`,
              messageIdMasked: `MSG_***${msg.messageId.slice(-4)}`,
              reason: 'message_already_exists',
              ts: new Date().toISOString()
            });
          }
          return { message: messageDoc.data(), conversation: null, idempotent: true };
        }

        // Verificar si la conversación existe
        const conversationDoc = await transaction.get(conversationRef);
        const conversationExists = conversationDoc.exists;

        // Preparar datos del mensaje para Firestore
        const messageFirestoreData = {
          id: msg.messageId,
          conversationId: msg.conversationId,
          content: msg.content || '',
          type: msg.type || 'text',
          direction: 'inbound',
          status: 'received',
          senderIdentifier: msg.senderIdentifier,
          recipientIdentifier: msg.recipientIdentifier,
          mediaUrl: msg.mediaUrl || null, // 🔧 AGREGADO: Campo mediaUrl
          timestamp: msg.timestamp || new Date(),
          metadata: msg.metadata || {},
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Guardar mensaje
        transaction.set(messageRef, messageFirestoreData);

        // Preparar actualización de conversación
        const lastMessage = {
          messageId: msg.messageId,
          content: msg.content || '',
          sender: msg.senderIdentifier,
          direction: 'inbound',
          timestamp: msg.timestamp || new Date()
        };

        const lastMessageAt = msg.timestamp || new Date();

        // Asegurar que participants incluya el cliente y el agente (email)
        const existingParticipants = conversationExists ? (conversationDoc.data().participants || []) : [];
        const participantsSet = new Set(existingParticipants);
        if (msg.senderIdentifier) participantsSet.add(msg.senderIdentifier);
        if (msg.agentEmail) participantsSet.add(msg.agentEmail);

        // NEW: mergear viewers por defecto (sin duplicar)
        const viewers_in = getDefaultViewerEmails();
        const sizeBefore_in = participantsSet.size;
        for (const v of viewers_in) participantsSet.add(String(v || '').toLowerCase().trim());
        const participants = Array.from(participantsSet);
        if (process.env.LOG_MSG_WRITE === 'true') {
          logger.info({ event: 'participants.merge', source: 'inbound', before: sizeBefore_in, after: participants.length, added: Math.max(0, participants.length - sizeBefore_in) });
        }

        const conversationUpdate = {
          lastMessage,
          lastMessageAt,
          messageCount: FieldValue.increment(1),
          unreadCount: FieldValue.increment(1), // inbound suma no-leídos
          participants,
          updatedAt: new Date()
        };

        // Agregar campos tenant si están disponibles
        if (msg.workspaceId) {
          conversationUpdate.workspaceId = msg.workspaceId;
        }
        if (msg.tenantId) {
          conversationUpdate.tenantId = msg.tenantId;
        }

        // Si la conversación no existe, agregar campos obligatorios
        if (!conversationExists) {
          conversationUpdate.id = msg.conversationId;
          conversationUpdate.customerPhone = msg.senderIdentifier;
          conversationUpdate.status = 'open';
          conversationUpdate.createdAt = new Date();
        }

        // Persistir nombre del cliente (WhatsApp ProfileName) si viene y no existe
        if (msg.profileName && !conversationDoc?.data()?.customerName) {
          conversationUpdate.customerName = msg.profileName; // persistir nombre legible
        }

        // Validar y forzar workspaceId/tenantId
        if (msg.workspaceId) conversationUpdate.workspaceId = msg.workspaceId;
        if (msg.tenantId) conversationUpdate.tenantId = msg.tenantId;

        // Actualizar conversación
        transaction.set(conversationRef, conversationUpdate, { merge: true });

        return { 
          message: messageFirestoreData, 
          conversation: conversationUpdate,
          idempotent: false
        };
      });

      const duration = Date.now() - startTime;

      // 🔍 LOGGING ESTRUCTURADO DE ÉXITO
      const durationMs = Date.now() - startTime;
      if (process.env.LOG_MSG_WRITE === 'true') {
        logger.info({
          event: 'msg_inbound_ok',
          requestId,
          conv: { conversationId: `conv_***${msg.conversationId.slice(-4)}` },
          msg: { messageId: `MSG_***${msg.messageId.slice(-4)}` },
          updates: ['lastMessage', 'lastMessageAt', 'participants', 'unreadCount', 'messageCount'],
          durationMs,
          idempotent: result.idempotent
        });
      }

      // Emitir eventos RT (sin tocar el manager)
      // TODO: Implementar emisión de eventos RT aquí

      return result;

    } catch (error) {
      // 🔍 LOGGING ESTRUCTURADO DE ERROR
      if (process.env.LOG_MSG_WRITE === 'true') {
        logger.error({
          event: 'msg_inbound_error',
          requestId,
          conv: { conversationId: `conv_***${msg.conversationId?.slice(-4)}` },
          msg: { messageId: `MSG_***${msg.messageId?.slice(-4)}` },
          err: error.message,
          durationMs: Date.now() - startTime
        });
      }

      throw error;
    }
  }

  /**
   * 🧠 ESCRITOR CANÓNICO: Procesar mensaje saliente (outbound)
   * Garantiza que cada mensaje outbound deje la conversación en estado canónico
   * 
   * @param {object} msg - Datos del mensaje normalizados
   * @returns {Promise<{message: object, conversation: object}>}
   */
  async appendOutbound(msg) {
    const startTime = Date.now();
    const requestId = `append_outbound_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Helper para enmascarar PII
    const maskEmail = (email) => {
      if (!email) return null;
      const [name, domain] = email.split('@');
      if (!name || !domain) return 'invalid_email';
      return `${name.charAt(0)}***@${domain}`;
    };

    const maskPhone = (phone) => {
      if (!phone) return null;
      const digits = phone.replace(/\D/g, '');
      if (digits.length <= 4) return '****';
      
      const internationalPrefixMatch = phone.match(/^(\+\d{1,4})?(\d+)$/);
      if (internationalPrefixMatch) {
        const prefix = internationalPrefixMatch[1] || '';
        const numberPart = internationalPrefixMatch[2];
        if (numberPart.length <= 4) return `${prefix}****`;
        return `${prefix}${numberPart.substring(0, numberPart.length - 4)}****${numberPart.substring(numberPart.length - 2)}`;
      }
      
      return phone.substring(0, phone.length - 4) + '****' + phone.substring(phone.length - 2);
    };

    try {
      // Validar datos obligatorios
      if (!msg.conversationId || !msg.messageId || !msg.senderIdentifier) {
        const missingFields = [];
        if (!msg.conversationId) missingFields.push('conversationId');
        if (!msg.messageId) missingFields.push('messageId');
        if (!msg.senderIdentifier) missingFields.push('senderIdentifier');
        
        const error = new Error(`Campos obligatorios faltantes: ${missingFields.join(', ')}`);
        error.statusCode = 400;
        error.validationError = true;
        error.details = missingFields.map(field => ({
          field,
          code: 'required',
          message: `${field} es obligatorio`
        }));
        throw error;
      }

      // Normalizar datos
      const messageData = {
        id: msg.messageId,
        conversationId: msg.conversationId,
        content: msg.content || '',
        type: msg.type || 'text',
        direction: 'outbound',
        status: 'queued', // Inicialmente queued
        senderIdentifier: msg.senderIdentifier,
        recipientIdentifier: msg.recipientIdentifier,
        timestamp: msg.timestamp || new Date(),
        workspaceId: msg.workspaceId,
        tenantId: msg.tenantId,
        metadata: msg.metadata || {}
      };

      // --- LOGS DE DIAGNÓSTICO (solo si LOG_MSG_WRITE=true) ---
      if (process.env.LOG_MSG_WRITE === 'true') {
        const diagnosticLog = {
          event: 'message_write_attempt',
          direction: 'outbound',
          conversationIdMasked: `conv_***${msg.conversationId.slice(-4)}`,
          messageIdMasked: `MSG_***${msg.messageId.slice(-4)}`,
          workspaceIdMasked: msg.workspaceId ? 'present' : 'none',
          tenantIdMasked: msg.tenantId ? 'present' : 'none',
          senderMasked: maskEmail(msg.senderIdentifier),
          recipientMasked: maskPhone(msg.recipientIdentifier),
          contentLength: msg.content?.length || 0,
          ts: new Date().toISOString()
        };

        logger.info('message_write_diag', diagnosticLog);
      }

      // Transacción atómica: mensaje + conversación
      const result = await firestore.runTransaction(async (transaction) => {
        const conversationRef = firestore.collection(this.collectionPath).doc(msg.conversationId);
        const messageRef = conversationRef.collection('messages').doc(msg.messageId);

        // Verificar si el mensaje ya existe (idempotencia)
        const messageDoc = await transaction.get(messageRef);
        if (messageDoc.exists) {
          // Mensaje ya existe, no duplicar
          if (process.env.LOG_MSG_WRITE === 'true') {
            logger.info('message_write_diag', {
              event: 'message_write_idempotent',
              direction: 'outbound',
              conversationIdMasked: `conv_***${msg.conversationId.slice(-4)}`,
              messageIdMasked: `MSG_***${msg.messageId.slice(-4)}`,
              reason: 'message_already_exists',
              ts: new Date().toISOString()
            });
          }
          return { message: messageDoc.data(), conversation: null, idempotent: true };
        }

        // Verificar si la conversación existe
        const conversationDoc = await transaction.get(conversationRef);
        const conversationExists = conversationDoc.exists;

        // Preparar datos del mensaje para Firestore
        const messageFirestoreData = {
          id: msg.messageId,
          conversationId: msg.conversationId,
          content: msg.content || '',
          type: msg.type || 'text',
          direction: 'outbound',
          status: 'queued', // Inicialmente queued, se actualizará después de Twilio
          senderIdentifier: msg.senderIdentifier,
          recipientIdentifier: msg.recipientIdentifier,
          timestamp: msg.timestamp || new Date(),
          metadata: msg.metadata || {},
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Guardar mensaje
        transaction.set(messageRef, messageFirestoreData);

        // 🔄 Escritura anidada en contacts/{contactId}/conversations/{conversationId}/messages
        try {
          const customerPhone = msg.recipientIdentifier; // outbound → cliente es recipient
          const contactSnap = await firestore.collection('contacts').where('phone', '==', customerPhone).limit(1).get();
          if (!contactSnap.empty) {
            const contactId = contactSnap.docs[0].id;
            const nestedConvRef = firestore.collection('contacts').doc(contactId).collection('conversations').doc(msg.conversationId);
            transaction.set(nestedConvRef, {
              id: msg.conversationId,
              customerPhone,
              participants: [msg.senderIdentifier, msg.recipientIdentifier].filter(Boolean),
              status: 'open',
              updatedAt: new Date(),
              createdAt: new Date()
            }, { merge: true });
            const nestedMsgRef = nestedConvRef.collection('messages').doc(msg.messageId);
            transaction.set(nestedMsgRef, messageFirestoreData);
          }
        } catch (_) {
          // no-op nested write
        }

        // Preparar actualización de conversación
        const lastMessage = {
          messageId: msg.messageId,
          content: msg.content || '',
          sender: msg.senderIdentifier,
          direction: 'outbound',
          timestamp: msg.timestamp || new Date()
        };

        const lastMessageAt = msg.timestamp || new Date();

        // Asegurar que participants incluya sender (agente/email) y recipient (cliente)
        const existingParticipants = conversationExists ? (conversationDoc.data().participants || []) : [];
        const participantsSet = new Set(existingParticipants);
        if (msg.senderIdentifier) participantsSet.add(msg.senderIdentifier);
        if (msg.recipientIdentifier) participantsSet.add(msg.recipientIdentifier);
        if (msg.agentEmail) participantsSet.add(msg.agentEmail);

        // NEW: mergear viewers por defecto (sin duplicar)
        const viewers_out = getDefaultViewerEmails();
        const sizeBefore_out = participantsSet.size;
        for (const v of viewers_out) participantsSet.add(String(v || '').toLowerCase().trim());
        const participants = Array.from(participantsSet);
        if (process.env.LOG_MSG_WRITE === 'true') {
          logger.info({ event: 'participants.merge', source: 'outbound', before: sizeBefore_out, after: participants.length, added: Math.max(0, participants.length - sizeBefore_out) });
        }

        const conversationUpdate = {
          lastMessage,
          lastMessageAt,
          messageCount: FieldValue.increment(1),
          // NO incrementar unreadCount en outbound
          participants,
          updatedAt: new Date()
        };

        // Agregar campos tenant si están disponibles
        if (msg.workspaceId) {
          conversationUpdate.workspaceId = msg.workspaceId;
        }
        if (msg.tenantId) {
          conversationUpdate.tenantId = msg.tenantId;
        }

        // Si la conversación no existe, agregar campos obligatorios
        if (!conversationExists) {
          conversationUpdate.id = msg.conversationId;
          conversationUpdate.customerPhone = msg.recipientIdentifier;
          conversationUpdate.status = 'open';
          conversationUpdate.createdAt = new Date();
        }

        // Actualizar conversación
        transaction.set(conversationRef, conversationUpdate, { merge: true });

        // 🔄 También actualizar lastMessage en conversación anidada si existe contacto
        try {
          const contactSnap2 = await firestore.collection('contacts').where('phone', '==', msg.recipientIdentifier).limit(1).get();
          if (!contactSnap2.empty) {
            const contactId = contactSnap2.docs[0].id;
            const nestedConvRef = firestore.collection('contacts').doc(contactId).collection('conversations').doc(msg.conversationId);
            transaction.set(nestedConvRef, {
              lastMessage,
              lastMessageAt,
              updatedAt: new Date()
            }, { merge: true });
          }
        } catch (_) {}

        return { 
          message: messageFirestoreData, 
          conversation: conversationUpdate,
          idempotent: false
        };
      });

      const duration = Date.now() - startTime;

      // --- LOGS DE DIAGNÓSTICO POST-ESCRITURA (solo si LOG_MSG_WRITE=true) ---
      if (process.env.LOG_MSG_WRITE === 'true') {
        const postWriteLog = {
          event: 'message_write_success',
          direction: 'outbound',
          conversationIdMasked: `conv_***${msg.conversationId.slice(-4)}`,
          messageIdMasked: `MSG_***${msg.messageId.slice(-4)}`,
          wroteMessage: true,
          updatedConversation: true,
          conversationExisted: !result.idempotent,
          durationMs: duration,
          ts: new Date().toISOString()
        };

        logger.info('message_write_diag', postWriteLog);
      }

      // 🚨 FIX: ENVIAR MENSAJE A TWILIO CON FLUJO CORRECTO
      try {
        const { getMessageService } = require('../services/MessageService');
        
        // IDEMPOTENCIA: Verificar si ya se envió a Twilio
        if (result.message?.twilioSid) {
          // ya enviado previamente
          logger.info('TWILIO:IDEMPOTENT', { 
            correlationId: requestId, 
            conversationId: msg.conversationId, 
            messageId: msg.messageId, 
            existingSid: result.message.twilioSid,
            existingStatus: result.message.status
          });
          return result;
        }
        
        // Construcción de from/to y llamada Twilio
        const messageService = getMessageService();
        const rawFrom = messageService.whatsappNumber;
        const from = messageService.ensureFrom(rawFrom);
        const to = messageService.ensureWhatsApp(msg.recipientIdentifier);
        
        // Extraer URLs de medios desde metadata.attachments para envío con archivos
        let mediaUrls = null;
        if (msg.metadata?.attachments && Array.isArray(msg.metadata.attachments) && msg.metadata.attachments.length > 0) {
          mediaUrls = msg.metadata.attachments
            .filter(attachment => attachment && attachment.url)
            .map(attachment => attachment.url)
            .filter(url => url && typeof url === 'string' && url.startsWith('http'));
        }
        
        // Fallback para compatibilidad con formato anterior
        if (!mediaUrls && msg.media?.mediaUrl) {
          mediaUrls = Array.isArray(msg.media.mediaUrl) ? msg.media.mediaUrl : [msg.media.mediaUrl];
        }

        logger.info('TWILIO:REQUEST', { 
          correlationId: requestId, 
          conversationId: msg.conversationId, 
          messageId: msg.messageId, 
          from, 
          to, 
          type: msg.type, 
          hasMedia: !!(mediaUrls && mediaUrls.length > 0), 
          mediaCount: mediaUrls?.length || 0,
          bodyLen: msg.content?.length 
        });

        const resp = await messageService.sendWhatsAppMessage({
          from, to, body: msg.content, mediaUrl: mediaUrls
        });

        result.message.twilioSid = resp?.sid;
        result.message.status = resp?.status || 'queued';

        // persiste actualización de twilioSid/status en Firestore
        const messageRef = firestore.collection(this.collectionPath).doc(msg.conversationId).collection('messages').doc(msg.messageId);
        await messageRef.update({ 
          status: result.message.status, 
          twilioSid: result.message.twilioSid,
          metadata: {
            ...result.message.metadata,
            twilioSid: result.message.twilioSid,
            twilioStatus: resp?.status,
            sentAt: new Date().toISOString()
          }
        });
      } catch (err) {
        logger.error('TWILIO:RESPONSE_ERR', { 
          correlationId: requestId, 
          conversationId: msg.conversationId, 
          messageId: msg.messageId, 
          code: err?.code, 
          message: err?.message, 
          more: err?.moreInfo 
        });
        
        // Persistir error en el documento de mensaje
        const messageRef = firestore.collection(this.collectionPath).doc(msg.conversationId).collection('messages').doc(msg.messageId);
        await messageRef.update({ 
          status: 'failed', 
          error: String(err?.message || err),
          metadata: {
            ...result.message.metadata,
            twilioError: String(err?.message || err),
            failedAt: new Date().toISOString()
          }
        });
        
        // Actualizar resultado
        result.message.status = 'failed';
        result.message.error = String(err?.message || err);
        result.message.metadata = {
          ...result.message.metadata,
          twilioError: String(err?.message || err),
          failedAt: new Date().toISOString()
        };
        
        // Propaga para que el controller lo mapee a 424
        throw err;
      }

      // Emitir eventos RT usando facade
      try {
        const { getSocketManager } = require('../socket');
        const rt = getSocketManager();
        if (rt) {
          rt.emitNewMessage({
            workspaceId: msg.workspaceId,
            tenantId: msg.tenantId,
            conversationId: msg.conversationId,
            message: result.message,
            correlationId: requestId
          });
          
          rt.emitConversationUpdated({
            workspaceId: msg.workspaceId,
            tenantId: msg.tenantId,
            conversationId: msg.conversationId,
            lastMessage: { 
              text: msg.content, 
              type: msg.type, 
              direction: 'outbound' 
            },
            updatedAt: new Date().toISOString(),
            unreadCount: 0,
            correlationId: requestId
          });
        }
      } catch (rtError) {
        logger.warn('RT:ERROR emitir eventos', { 
          where: 'appendOutbound', 
          err: rtError.message,
          conversationId: msg.conversationId?.substring(0, 20) + '...'
        });
      }

      return result;

    } catch (error) {
      // --- LOGS DE DIAGNÓSTICO DE ERROR (solo si LOG_MSG_WRITE=true) ---
      if (process.env.LOG_MSG_WRITE === 'true') {
        const errorLog = {
          event: 'message_write_error',
          direction: 'outbound',
          conversationIdMasked: `conv_***${msg.conversationId?.slice(-4)}`,
          messageIdMasked: `MSG_***${msg.messageId?.slice(-4)}`,
          error: {
            name: error.name,
            message: error.message
          },
          stack: error.stack,
          durationMs: Date.now() - startTime,
          ts: new Date().toISOString()
        };

        logger.error('message_write_diag', errorLog);
      }

      throw error;
    }
  }
}

// Singleton
let instance = null;
const getConversationsRepository = () => {
  if (!instance) {
    instance = new ConversationsRepository();
  }
  return instance;
};

module.exports = {
  ConversationsRepository,
  getConversationsRepository
}; 