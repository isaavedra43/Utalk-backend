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
      contact: docData.contact || (docData.customerPhone ? { phone: docData.customerPhone } : undefined),
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
        status: 'sent',
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
          status: 'sent',
          senderIdentifier: msg.senderIdentifier,
          recipientIdentifier: msg.recipientIdentifier,
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
        const { getTwilioService } = require('../services/TwilioService');
        const twilioService = getTwilioService();
        
        // Construir from y to con prefijos correctos
        const from = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;
        const to = msg.recipientIdentifier?.startsWith('whatsapp:') 
          ? msg.recipientIdentifier 
          : `whatsapp:${msg.recipientIdentifier}`;
        
        // Marcar como queued inicialmente
        result.message.status = 'queued';
        
        logger.info('TWILIO:REQUEST', {
          to,
          from,
          type: msg.type,
          bodyLen: msg.content?.length,
          hasMedia: !!msg.mediaUrl,
          messageId: msg.messageId,
          conversationId: msg.conversationId
        });

        // Llamar a Twilio con parámetros correctos
        const twilioResult = await twilioService.sendWhatsAppMessage(
          to.replace('whatsapp:', ''), // TwilioService espera solo el número
          msg.content,
          msg.mediaUrl
        );

        if (twilioResult.success) {
          logger.info('TWILIO:RESPONSE_OK', {
            sid: twilioResult.twilioResponse.sid,
            status: twilioResult.twilioResponse.status,
            messageId: msg.messageId,
            conversationId: msg.conversationId
          });
          
          // Actualizar mensaje con Twilio SID y status sent
          result.message.twilioSid = twilioResult.twilioResponse.sid;
          result.message.status = 'sent';
          result.message.metadata = {
            ...result.message.metadata,
            twilioSid: twilioResult.twilioResponse.sid,
            twilioStatus: twilioResult.twilioResponse.status,
            sentAt: new Date().toISOString()
          };
        } else {
          logger.error('TWILIO:RESPONSE_ERR', {
            error: twilioResult.error,
            messageId: msg.messageId,
            conversationId: msg.conversationId
          });
          
          // Marcar mensaje como fallido
          result.message.status = 'failed';
          result.message.error = twilioResult.error;
          result.message.metadata = {
            ...result.message.metadata,
            twilioError: twilioResult.error,
            failedAt: new Date().toISOString()
          };
          
          throw new Error(`Twilio send failed: ${twilioResult.error}`);
        }
      } catch (twilioError) {
        logger.error('TWILIO:RESPONSE_ERR', {
          code: twilioError.code,
          message: twilioError.message,
          more: twilioError?.moreInfo,
          messageId: msg.messageId,
          conversationId: msg.conversationId
        });
        
        // Marcar mensaje como fallido
        result.message.status = 'failed';
        result.message.error = twilioError.message;
        result.message.metadata = {
          ...result.message.metadata,
          twilioError: twilioError.message,
          twilioErrorCode: twilioError.code,
          failedAt: new Date().toISOString()
        };
        
        throw twilioError;
      }

      // Emitir eventos RT (sin tocar el manager)
      // TODO: Implementar emisión de eventos RT aquí

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