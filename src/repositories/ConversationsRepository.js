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
const { generateConversationId } = require('../utils/conversation');

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
      // 🔧 CORRECCIÓN CRÍTICA: Buscar en subcolecciones de contactos
      const conversations = await this.searchConversationsInContacts(params);
      
      const duration = Date.now() - startTime;
      
      // --- LOGS DE DIAGNÓSTICO (solo si LOG_CONV_DIAG=true) ---
      if (process.env.LOG_CONV_DIAG === 'true') {
        const diagnosticLog = {
          event: 'conversations_repo:query_completed',
          conversationsFound: conversations.length,
          durationMs: duration,
          params: {
            workspaceIdMasked: workspaceId ? 'present' : 'none',
            tenantIdMasked: tenantId ? 'present' : 'none',
            hasFilters: Object.keys(filters).length > 0,
            limit: pagination.limit || 50
          },
          ts: new Date().toISOString()
        };

        logger.info('conversations_repo_diag', diagnosticLog);
      }

      return {
        conversations,
        hasNext: false, // TODO: implementar paginación real
        nextCursor: null,
        debug: {
          method: 'searchConversationsInContacts',
          duration,
          found: conversations.length
        }
      };

    } catch (error) {
      logger.error('Error en ConversationsRepository.list', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3),
        params: {
          workspaceIdMasked: workspaceId ? 'present' : 'none',
          tenantIdMasked: tenantId ? 'present' : 'none',
          hasFilters: Object.keys(filters).length > 0
        }
      });

      throw error;
    }
  }

  /**
   * 🔧 MÉTODO NUEVO: Buscar conversaciones en subcolecciones de contactos
   * @param {object} params - Parámetros de búsqueda
   * @returns {Promise<ConversationVM[]>} Lista de conversaciones
   */
  async searchConversationsInContacts(params = {}) {
    const { workspaceId, tenantId, filters = {}, pagination = {} } = params;
    const { participantsContains } = filters;
    const { limit = 50 } = pagination;

    try {
      // 🔧 PASO 1: Obtener todos los contactos
      const contactsSnapshot = await firestore.collection('contacts').get();
      const conversations = [];

      // 🔧 PASO 2: Para cada contacto, buscar conversaciones
      for (const contactDoc of contactsSnapshot.docs) {
        const contactId = contactDoc.id;
        const contactData = contactDoc.data();

        // Construir query para conversaciones de este contacto
        let query = firestore
          .collection('contacts')
          .doc(contactId)
          .collection('conversations');

        // Aplicar filtros
        if (workspaceId) {
          query = query.where('workspaceId', '==', workspaceId);
        }

        if (tenantId) {
          query = query.where('tenantId', '==', tenantId);
        }

        if (participantsContains) {
          query = query.where('participants', 'array-contains', participantsContains);
        }

        // Ordenar y limitar
        query = query.orderBy('lastMessageAt', 'desc');

        // Ejecutar query
        const conversationsSnapshot = await query.get();

        // Procesar conversaciones encontradas
        for (const conversationDoc of conversationsSnapshot.docs) {
          const conversationData = conversationDoc.data();
          
          // Agregar información del contacto
          const conversationVM = {
            ...conversationData,
            id: conversationDoc.id,
            contact: {
              id: contactId,
              name: contactData.name,
              phone: contactData.phone,
              profilePhotoUrl: contactData.profilePhotoUrl
            }
          };

          conversations.push(conversationVM);
        }

        // 🔧 LIMITAR RESULTADOS TOTALES
        if (conversations.length >= limit) {
          break;
        }
      }

      // 🔧 PASO 3: Ordenar por lastMessageAt globalmente y limitar
      conversations.sort((a, b) => {
        const timeA = a.lastMessageAt?.toDate?.() || new Date(0);
        const timeB = b.lastMessageAt?.toDate?.() || new Date(0);
        return timeB - timeA;
      });

      return conversations.slice(0, limit);

    } catch (error) {
      logger.error('Error en searchConversationsInContacts', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3)
      });
      throw error;
    }
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
      let conversations = snapshot.docs.map(doc => this.mapToConversationVM(doc));

      // 🔁 FALLBACK CRÍTICO: si la colección raíz está vacía, leer de contacts/{contactId}/conversations
      if (conversations.length === 0) {
        try {
          const { default: _path } = { default: 'contacts/*/conversations' };
          logger.warn('conversations_repo:root_empty_fallback', {
            event: 'conversations_repo:root_empty_fallback',
            collectionPath: this.collectionPath,
            fallback: _path,
            note: 'Leyendo desde contacts/{contactId}/conversations'
          });

          const ConversationService = require('../services/ConversationService');
          const agg = await ConversationService.getConversations({
            status: filters.status,
            assignedTo: filters.assignedTo,
            participants: filters.participantsContains,
            limit: pagination.limit || 50,
            sortBy: 'lastMessageAt',
            sortOrder: 'desc'
          });

          // Mapear al mismo VM usado por el front
          conversations = (agg || []).map(item => ({
            id: item.id,
            customerPhone: item.customerPhone,
            lastMessage: item.lastMessage || {},
            unreadCount: typeof item.unreadCount === 'number' ? item.unreadCount : 0,
            status: item.status || 'open',
            workspaceId: item.workspaceId,
            tenantId: item.tenantId,
            assignedTo: item.assignedTo || null,
            participants: Array.isArray(item.participants) ? item.participants : [],
            lastMessageAt: item.lastMessageAt || null,
            contact: item.contact || (item.customerPhone ? { id: item.customerPhone, name: item.customerName || 'Cliente', phoneNumber: item.customerPhone, channel: 'whatsapp' } : undefined),
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            messageCount: item.messageCount,
            priority: item.priority,
            tags: item.tags
          }));
        } catch (fallbackError) {
          logger.error('conversations_repo:fallback_error', { error: fallbackError.message });
        }
      }

      const duration = Date.now() - startTime;
      const hasNext = conversations.length === (pagination.limit || 50);
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

    // 🔧 OBTENER USUARIOS SIN ÍNDICES - FALLBACK DIRECTO
    let allUserEmails = [];
    try {
      // Estrategia simple: Query directa sin límites ni ordenación
      const usersSnapshot = await firestore.collection('users').get();
      allUserEmails = usersSnapshot.docs
        .map(doc => doc.data())
        .filter(u => u.isActive !== false) // Incluir true y undefined como activos
        .map(u => String(u.email || '').toLowerCase().trim())
        .filter(Boolean);
        
      // Fallback: Si no hay usuarios, usar al menos el agente
      if (allUserEmails.length === 0 && msg.agentEmail && msg.agentEmail.includes('@')) {
        allUserEmails = [msg.agentEmail.toLowerCase()];
      }
    } catch (userError) {
      // Fallback final: usar solo el agente
      if (msg.agentEmail && msg.agentEmail.includes('@')) {
        allUserEmails = [msg.agentEmail.toLowerCase()];
      }
    }

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

      // Calcular ID canónico cliente-primero (customer, then our)
      const canonicalConversationId = (() => {
        try {
          const ourNumber = msg.recipientIdentifier; // inbound → nuestro número es el recipient
          const customerPhone = msg.senderIdentifier; // cliente es el sender
          return generateConversationId(ourNumber, customerPhone);
        } catch (_) {
          return msg.conversationId; // fallback
        }
      })();

      // 🔒 BÚSQUEDA ROBUSTA DE CONTACTO: Normalizar teléfono y buscar múltiples variantes
      let contactId = null;
      const originalPhone = msg.senderIdentifier;
      const normalizedPhone = this.normalizePhoneForContact(originalPhone);
      
      logger.info('🔍 ConversationsRepository.upsertFromInbound - Buscando contacto', {
        originalPhone,
        normalizedPhone,
        requestId
      });

      // Buscar por teléfono normalizado primero
      let contactSnap = await firestore.collection('contacts')
        .where('phone', '==', normalizedPhone)
        .limit(1)
        .get();

      // Si no se encuentra con normalizado, buscar con original
      if (contactSnap.empty && normalizedPhone !== originalPhone) {
        contactSnap = await firestore.collection('contacts')
          .where('phone', '==', originalPhone)
          .limit(1)
          .get();
      }

      // Si aún no se encuentra, buscar variantes comunes
      if (contactSnap.empty) {
        const phoneVariants = this.generatePhoneVariants(originalPhone);
        for (const variant of phoneVariants) {
          if (variant !== normalizedPhone && variant !== originalPhone) {
            const variantQuery = await firestore.collection('contacts')
              .where('phone', '==', variant)
              .limit(1)
              .get();
            
            if (!variantQuery.empty) {
              contactSnap = variantQuery;
              logger.info('✅ Contacto encontrado con variante de teléfono', {
                originalPhone,
                foundWith: variant,
                contactId: variantQuery.docs[0].id,
                requestId
              });
              break;
            }
          }
        }
      }

      if (!contactSnap.empty) {
        contactId = contactSnap.docs[0].id;
        logger.info('✅ Contacto existente encontrado', {
          contactId,
          originalPhone,
          normalizedPhone,
          requestId
        });
      } else {
        // 🔒 CREAR CONTACTO CON VALIDACIÓN ANTI-DUPLICADOS
        logger.info('🆕 Creando nuevo contacto (no encontrado)', {
          originalPhone,
          normalizedPhone,
          requestId
        });

        // ÚLTIMA VERIFICACIÓN antes de crear: buscar de nuevo por si hay condición de carrera
        const finalCheck = await firestore.collection('contacts')
          .where('phone', '==', normalizedPhone)
          .limit(1)
          .get();

        if (!finalCheck.empty) {
          contactId = finalCheck.docs[0].id;
          logger.warn('⚠️ Contacto encontrado en verificación final (condición de carrera evitada)', {
            contactId,
            normalizedPhone,
            requestId
          });
        } else {
          // Crear contacto con teléfono NORMALIZADO
        const newContactRef = await firestore.collection('contacts').add({
            phone: normalizedPhone, // USAR NORMALIZADO para evitar duplicados futuros
            name: msg.profileName || originalPhone,
            metadata: { 
              createdVia: 'inbound_message', 
              createdAt: new Date().toISOString(),
              originalPhone: originalPhone // Guardar original por referencia
            },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        contactId = newContactRef.id;
          
          logger.info('✅ Nuevo contacto creado exitosamente', {
            contactId,
            originalPhone,
            normalizedPhone,
            requestId
          });
        }
      }

      // Transacción atómica: mensaje + conversación (SOLO en contacts/{contactId}/conversations)
      const result = await firestore.runTransaction(async (transaction) => {
        const conversationRef = firestore
          .collection('contacts').doc(contactId)
          .collection('conversations').doc(canonicalConversationId);
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

        // Actualizar contadores de conversación (INBOUND)
        const currentData = conversationExists ? conversationDoc.data() : {};
        const newMessageCount = (currentData.messageCount || 0) + 1;
        const newUnreadCount = (currentData.unreadCount || 0) + 1;

        // Preparar actualización de conversación
        const lastMessage = {
          messageId: msg.messageId,
          content: msg.content || '',
          sender: msg.senderIdentifier,
          direction: 'inbound',
          timestamp: msg.timestamp || new Date()
        };

        const lastMessageAt = msg.timestamp || new Date();

        // Participants: todos los usuarios activos (ya obtenidos) + agente/creador + viewers por defecto
        const existingParticipants = conversationExists ? (conversationDoc.data().participants || []) : [];
        const participantsSet = new Set(existingParticipants.map(p => String(p || '').toLowerCase()));
        // agregar todos los usuarios activos
        for (const email of allUserEmails) participantsSet.add(email);
        // agregar agente si existe
        if (msg.agentEmail) participantsSet.add(String(msg.agentEmail).toLowerCase());
        // viewers por defecto
        const viewers_in = getDefaultViewerEmails();
        for (const v of viewers_in) participantsSet.add(String(v || '').toLowerCase().trim());
        const participants = Array.from(participantsSet);
        if (process.env.LOG_MSG_WRITE === 'true') {
          logger.info({ event: 'participants.merge', source: 'inbound', allUsersCount: allUserEmails.length, totalParticipants: participants.length });
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
          conversationUpdate.id = canonicalConversationId;
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

        // Actualizar conversación SOLO en estructura de contacts
        transaction.set(conversationRef, conversationUpdate, { merge: true });

        return { 
          message: messageFirestoreData, 
          conversation: conversationUpdate,
          idempotent: false,
          contactId
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

      // Emitir eventos RT (pendiente integrar con socket manager si aplica)

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

    // 🔧 OBTENER USUARIOS SIN ÍNDICES - FALLBACK DIRECTO
    let allUserEmails = [];
    try {
      // Estrategia simple: Query directa sin límites ni ordenación
      const usersSnapshot = await firestore.collection('users').get();
      allUserEmails = usersSnapshot.docs
        .map(doc => doc.data())
        .filter(u => u.isActive !== false) // Incluir true y undefined como activos
        .map(u => String(u.email || '').toLowerCase().trim())
        .filter(Boolean);
        
      // Fallback: Si no hay usuarios, usar al menos el sender
      if (allUserEmails.length === 0 && msg.senderIdentifier && msg.senderIdentifier.includes('@')) {
        allUserEmails = [msg.senderIdentifier.toLowerCase()];
      }
    } catch (userError) {
      // Fallback final: usar solo el sender
      if (msg.senderIdentifier && msg.senderIdentifier.includes('@')) {
        allUserEmails = [msg.senderIdentifier.toLowerCase()];
      }
    }

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

      // Resolver contactId por teléfono del cliente (outbound → recipient)
      const recipientPhone = msg.recipientIdentifier;
      
      // 🔧 NORMALIZAR TELÉFONO: Usar método robusto de normalización
      const normalizedPhone = this.normalizePhoneForContact(recipientPhone);
      
      // 🔍 LOGGING PARA DIAGNÓSTICO DE DUPLICADOS
      if (process.env.LOG_MSG_WRITE === 'true') {
        logger.info('appendOutbound_contact_search', {
          event: 'contact_search_attempt',
          direction: 'outbound',
          originalPhone: recipientPhone,
          normalizedPhone: normalizedPhone,
          requestId
        });
      }
      
      // 🔧 BÚSQUEDA ROBUSTA: Buscar contacto existente con teléfono normalizado
      let contactSnap = await firestore.collection('contacts').where('phone', '==', normalizedPhone).limit(1).get();
      let contactId;
      
      if (contactSnap.empty) {
        // 🔍 LOGGING: Contacto no encontrado, creando nuevo
        if (process.env.LOG_MSG_WRITE === 'true') {
          logger.info('appendOutbound_contact_creation', {
            event: 'contact_not_found_creating_new',
            direction: 'outbound',
            originalPhone: recipientPhone,
            normalizedPhone: normalizedPhone,
            requestId
          });
        }
        
        // Crear contacto mínimo sin metadatos complejos
        const newContactData = {
          phone: normalizedPhone, // Usar teléfono normalizado
          name: normalizedPhone,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const newContactRef = await firestore.collection('contacts').add(newContactData);
        contactId = newContactRef.id;
        
        // 🔍 LOGGING: Contacto creado exitosamente
        if (process.env.LOG_MSG_WRITE === 'true') {
          logger.info('appendOutbound_contact_created', {
            event: 'contact_created_successfully',
            direction: 'outbound',
            contactId: contactId,
            normalizedPhone: normalizedPhone,
            requestId
          });
        }
      } else {
        contactId = contactSnap.docs[0].id;
        
        // 🔍 LOGGING: Contacto encontrado
        if (process.env.LOG_MSG_WRITE === 'true') {
          logger.info('appendOutbound_contact_found', {
            event: 'contact_found_reusing_existing',
            direction: 'outbound',
            contactId: contactId,
            originalPhone: recipientPhone,
            normalizedPhone: normalizedPhone,
            requestId
          });
        }
      }

      // Transacción atómica: mensaje + conversación (solo en contacts/{contactId}/conversations)
      const result = await firestore.runTransaction(async (transaction) => {
        const conversationRef = firestore
          .collection('contacts').doc(contactId)
          .collection('conversations').doc(msg.conversationId);
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

        // Preparar actualización de conversación
        const lastMessage = {
          messageId: msg.messageId,
          content: msg.content || '',
          sender: msg.senderIdentifier,
          direction: 'outbound',
          timestamp: msg.timestamp || new Date()
        };

        const lastMessageAt = msg.timestamp || new Date();

        // Participants: todos los usuarios activos (ya obtenidos) + sender/agente + viewers por defecto
        const existingParticipants = conversationExists ? (conversationDoc.data().participants || []) : [];
        const participantsSet = new Set(existingParticipants.map(p => String(p || '').toLowerCase()));
        // agregar todos los usuarios activos
        for (const email of allUserEmails) participantsSet.add(email);
        // agregar sender si es email
        if (msg.senderIdentifier) participantsSet.add(String(msg.senderIdentifier).toLowerCase());
        if (msg.agentEmail) participantsSet.add(String(msg.agentEmail).toLowerCase());
        // viewers por defecto
        const viewers_out = getDefaultViewerEmails();
        for (const v of viewers_out) participantsSet.add(String(v || '').toLowerCase().trim());
        const participants = Array.from(participantsSet);
        if (process.env.LOG_MSG_WRITE === 'true') {
          logger.info({ event: 'participants.merge', source: 'outbound', allUsersCount: allUserEmails.length, totalParticipants: participants.length });
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
        
        // Extraer URLs de medios para envío con archivos (múltiples fuentes)
        let mediaUrls = null;
        
        // 1. Desde msg.mediaUrls (usado por sendMessageWithAttachments)
        if (msg.mediaUrls && Array.isArray(msg.mediaUrls) && msg.mediaUrls.length > 0) {
          mediaUrls = msg.mediaUrls.filter(url => url && typeof url === 'string' && url.startsWith('http'));
        }
        
        // 2. Desde metadata.attachments para envío con archivos
        if (!mediaUrls && msg.metadata?.attachments && Array.isArray(msg.metadata.attachments) && msg.metadata.attachments.length > 0) {
          mediaUrls = msg.metadata.attachments
            .filter(attachment => attachment && attachment.url)
            .map(attachment => attachment.url)
            .filter(url => url && typeof url === 'string' && url.startsWith('http'));
        }
        
        // 3. Fallback para compatibilidad con formato anterior
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

        // persiste actualización de twilioSid/status en Firestore (ruta anidada)
        const msgRef = firestore
          .collection('contacts').doc(contactId)
          .collection('conversations').doc(msg.conversationId)
          .collection('messages').doc(msg.messageId);
        await msgRef.update({ 
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
        
        // Persistir error en el documento de mensaje (ruta anidada)
        const msgRef = firestore
          .collection('contacts').doc(contactId)
          .collection('conversations').doc(msg.conversationId)
          .collection('messages').doc(msg.messageId);
        await msgRef.update({ 
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
      // 🚨 MANEJO ROBUSTO DE ERRORES - NO CRASHEAR EL SERVIDOR
      logger.error('Error en appendOutbound - manejo robusto', {
        requestId,
        conversationId: msg.conversationId?.substring(0, 20),
        messageId: msg.messageId?.substring(0, 20),
        errorName: error.name,
        errorMessage: error.message,
        duration: Date.now() - startTime
      });

      // Re-lanzar error de forma controlada
      const safeError = new Error(`Error en appendOutbound: ${error.message}`);
      safeError.code = error.code || 'APPEND_OUTBOUND_ERROR';
      safeError.statusCode = 500;
      throw safeError;
    }
  }

  /**
   * 🔧 MÉTODOS CRÍTICOS PARA FUNCIONALIDAD COMPLETA
   * Implementan las funcionalidades que se perdieron en la migración
   */

  /**
   * Actualizar último mensaje de una conversación
   */
  async updateLastMessage(conversationId, messageData) {
    try {
      // Buscar la conversación en todos los contactos
      const contactsSnapshot = await firestore.collection('contacts').get();
      
      for (const contactDoc of contactsSnapshot.docs) {
        const contactId = contactDoc.id;
        const conversationRef = firestore
          .collection('contacts')
          .doc(contactId)
          .collection('conversations')
          .doc(conversationId);
        
        const conversationDoc = await conversationRef.get();
        
        if (conversationDoc.exists) {
          const lastMessageData = {
            id: messageData.id,
            content: messageData.content,
            timestamp: messageData.timestamp,
            direction: messageData.direction,
            type: messageData.type,
            senderIdentifier: messageData.senderIdentifier
          };

          await conversationRef.update({
            lastMessage: lastMessageData,
            lastMessageAt: messageData.timestamp,
            updatedAt: FieldValue.serverTimestamp()
          });

          logger.info('✅ Último mensaje actualizado en conversación', {
            conversationId,
            contactId,
            messageId: messageData.id,
            structure: 'contacts/{contactId}/conversations'
          });
          
          return true;
        }
      }
      
      logger.warn('⚠️ Conversación no encontrada para actualizar último mensaje', {
        conversationId
      });
      
      return false;

    } catch (error) {
      logger.error('❌ Error actualizando último mensaje', {
        conversationId,
        messageId: messageData.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Actualizar contador de mensajes no leídos
   */
  async updateUnreadCount(conversationId, increment = true) {
    try {
      // Buscar la conversación en todos los contactos
      const contactsSnapshot = await firestore.collection('contacts').get();
      
      for (const contactDoc of contactsSnapshot.docs) {
        const contactId = contactDoc.id;
        const conversationRef = firestore
          .collection('contacts')
          .doc(contactId)
          .collection('conversations')
          .doc(conversationId);
        
        const conversationDoc = await conversationRef.get();
        
        if (conversationDoc.exists) {
          const currentData = conversationDoc.data();
          const currentUnreadCount = currentData.unreadCount || 0;
          const newUnreadCount = increment 
            ? currentUnreadCount + 1 
            : Math.max(0, currentUnreadCount - 1);

          await conversationRef.update({
            unreadCount: newUnreadCount,
            updatedAt: FieldValue.serverTimestamp()
          });

          logger.info('✅ Contador unread actualizado', {
            conversationId,
            contactId,
            before: currentUnreadCount,
            after: newUnreadCount,
            increment
          });
          
          return newUnreadCount;
        }
      }
      
      logger.warn('⚠️ Conversación no encontrada para actualizar unread count', {
        conversationId
      });
      
      return 0;

    } catch (error) {
      logger.error('❌ Error actualizando unread count', {
        conversationId,
        increment,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Actualizar contador de mensajes totales
   */
  async updateMessageCount(conversationId, increment = true) {
    try {
      // Buscar la conversación en todos los contactos
      const contactsSnapshot = await firestore.collection('contacts').get();
      
      for (const contactDoc of contactsSnapshot.docs) {
        const contactId = contactDoc.id;
        const conversationRef = firestore
          .collection('contacts')
          .doc(contactId)
          .collection('conversations')
          .doc(conversationId);
        
        const conversationDoc = await conversationRef.get();
        
        if (conversationDoc.exists) {
          const currentData = conversationDoc.data();
          const currentMessageCount = currentData.messageCount || 0;
          const newMessageCount = increment 
            ? currentMessageCount + 1 
            : Math.max(0, currentMessageCount - 1);

          await conversationRef.update({
            messageCount: newMessageCount,
            updatedAt: FieldValue.serverTimestamp()
          });

          logger.info('✅ Contador messages actualizado', {
            conversationId,
            contactId,
            before: currentMessageCount,
            after: newMessageCount,
            increment
          });
          
          return newMessageCount;
        }
      }
      
      logger.warn('⚠️ Conversación no encontrada para actualizar message count', {
        conversationId
      });
      
      return 0;

    } catch (error) {
      logger.error('❌ Error actualizando message count', {
        conversationId,
        increment,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Marcar conversación como leída por un usuario
   */
  async markAsRead(conversationId, userEmail) {
    try {
      // Buscar la conversación en todos los contactos
      const contactsSnapshot = await firestore.collection('contacts').get();
      
      for (const contactDoc of contactsSnapshot.docs) {
        const contactId = contactDoc.id;
        const conversationRef = firestore
          .collection('contacts')
          .doc(contactId)
          .collection('conversations')
          .doc(conversationId);
        
        const conversationDoc = await conversationRef.get();
        
        if (conversationDoc.exists) {
          await conversationRef.update({
            unreadCount: 0,
            lastReadBy: userEmail,
            lastReadAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });

          logger.info('✅ Conversación marcada como leída', {
            conversationId,
            contactId,
            userEmail,
            structure: 'contacts/{contactId}/conversations'
          });
          
          return true;
        }
      }
      
      logger.warn('⚠️ Conversación no encontrada para marcar como leída', {
        conversationId,
        userEmail
      });
      
      return false;

    } catch (error) {
      logger.error('❌ Error marcando conversación como leída', {
        conversationId,
        userEmail,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🔒 MÉTODOS ANTI-DUPLICADOS: Normalización robusta de teléfonos
   */
  normalizePhoneForContact(phone) {
    if (!phone) return phone;
    
    // Convertir a string y limpiar
    let normalized = String(phone).trim();
    
    // Remover prefijos de WhatsApp y limpiar caracteres especiales
    normalized = normalized.replace(/^whatsapp:/, '');
    normalized = normalized.replace(/[\s\-\(\)\.]/g, '');
    
    // Si empieza con + ya está internacionalizado
    if (normalized.startsWith('+')) {
      return normalized;
    }
    
    // Si empieza con 52 (México), agregar +
    if (normalized.startsWith('52') && normalized.length >= 12) {
      return '+' + normalized;
    }
    
    // Si no tiene código de país, asumir México
    if (normalized.length === 10) {
      return '+52' + normalized;
    }
    
    // Retornar como está si no se puede normalizar
    return normalized;
  }

  /**
   * 🔒 GENERAR VARIANTES DE TELÉFONO para búsqueda exhaustiva
   */
  generatePhoneVariants(originalPhone) {
    if (!originalPhone) return [];
    
    const variants = new Set();
    const cleaned = originalPhone.replace(/[\s\-\(\)\.]/g, '');
    
    // Variante 1: Original limpio
    variants.add(cleaned);
    
    // Variante 2: Sin prefijo whatsapp:
    if (originalPhone.startsWith('whatsapp:')) {
      variants.add(originalPhone.replace('whatsapp:', ''));
    }
    
    // Variante 3: Con whatsapp: si no lo tiene
    if (!originalPhone.startsWith('whatsapp:')) {
      variants.add('whatsapp:' + originalPhone);
    }
    
    // Variante 4: Con + si no lo tiene y parece internacional
    if (!cleaned.startsWith('+') && cleaned.length >= 10) {
      variants.add('+' + cleaned);
    }
    
    // Variante 5: Sin + si lo tiene
    if (cleaned.startsWith('+')) {
      variants.add(cleaned.substring(1));
    }
    
    // Variante 6: Con código México si parece local
    if (!cleaned.startsWith('+') && !cleaned.startsWith('52') && cleaned.length === 10) {
      variants.add('+52' + cleaned);
      variants.add('52' + cleaned);
    }
    
    // Variante 7: Sin código México si lo tiene
    if (cleaned.startsWith('+52') && cleaned.length === 13) {
      variants.add(cleaned.substring(3)); // Quitar +52
    }
    if (cleaned.startsWith('52') && cleaned.length === 12) {
      variants.add(cleaned.substring(2)); // Quitar 52
    }
    
    return Array.from(variants).filter(v => v && v !== originalPhone);
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