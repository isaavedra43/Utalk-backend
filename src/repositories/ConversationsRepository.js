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
   * Construir query de Firestore con filtros y paginación
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

    // Aplicar filtros tenant si está habilitado
    if (this.tenantMode && workspaceId) {
      query = query.where('workspaceId', '==', workspaceId);
    }

    if (this.tenantMode && tenantId) {
      query = query.where('tenantId', '==', tenantId);
    }

    // Aplicar filtros de estado
    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }

    // Aplicar filtro de asignación
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
      tenantMode: this.tenantMode,
      legacyCompat: this.legacyCompat
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
    
    // Reconstruir wheres basado en los parámetros típicos
    if (this.tenantMode) {
      wheres.push({ field: 'workspaceId', op: '==', value: 'masked' });
      wheres.push({ field: 'tenantId', op: '==', value: 'masked' });
    }
    
    // Filtros comunes
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
   * Listar conversaciones con soporte para tenant y legacy
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
      // Construir query tenant-first
      const { query: tenantQuery, debug: tenantDebug } = this.buildQuery(params);
      
      // --- LOGS DE DIAGNÓSTICO (solo si LOG_CONV_DIAG=true) ---
      if (process.env.LOG_CONV_DIAG === 'true') {
        const diagnosticLog = {
          event: 'conversations_repo:query',
          collectionPath: this.collectionPath,
          wheres: [
            ...(this.tenantMode && workspaceId ? [{ field: 'workspaceId', op: '==', value: 'masked' }] : []),
            ...(this.tenantMode && tenantId ? [{ field: 'tenantId', op: '==', value: 'masked' }] : []),
            ...(filters.status && filters.status !== 'all' ? [{ field: 'status', op: '==', value: filters.status }] : []),
            ...(filters.assignedTo ? [{ field: 'assignedTo', op: '==', value: maskEmail(filters.assignedTo) }] : []),
            ...(filters.participantsContains ? [{ field: 'participants', op: 'array-contains', value: maskEmail(filters.participantsContains) }] : [])
          ],
          orderBy: 'lastMessageAt desc',
          limit: pagination.limit || 50,
          cursor: pagination.cursor ? 'present' : 'none',
          tenantMode: this.tenantMode,
          legacyCompat: this.legacyCompat,
          user: {
            emailMasked: maskEmail(filters.participantsContains),
            workspaceId: workspaceId ? 'present' : 'none',
            tenantId: tenantId ? 'present' : 'none'
          },
          ts: new Date().toISOString()
        };

        logger.info('conversations_diag', diagnosticLog);
      }

      // Ejecutar query tenant
      const tenantSnapshot = await tenantQuery.get();
      let conversations = [];
      let source = 'tenant';

      // Si no hay resultados y legacy compat está habilitado, intentar query legacy
      if (tenantSnapshot.empty && this.legacyCompat) {
        if (this.verboseLogs) {
          logger.info('conversations_repo:legacy_fallback', {
            event: 'conversations_repo:legacy_fallback',
            reason: 'tenant_query_empty',
            collectionPath: this.collectionPath
          });
        }

        // Construir query legacy (sin filtros tenant)
        const legacyParams = {
          filters,
          pagination
        };
        const { query: legacyQuery, debug: legacyDebug } = this.buildQuery(legacyParams);
        
        const legacySnapshot = await legacyQuery.get();
        conversations = legacySnapshot.docs.map(doc => this.mapToConversationVM(doc));
        source = 'legacy';

        if (this.verboseLogs) {
          logger.info('conversations_repo:legacy_success', {
            event: 'conversations_repo:legacy_success',
            snapshotSize: legacySnapshot.docs.length,
            source: 'legacy'
          });
        }
      } else {
        // Usar resultados del query tenant
        conversations = tenantSnapshot.docs.map(doc => this.mapToConversationVM(doc));
        source = 'tenant';

        if (this.verboseLogs) {
          logger.info('conversations_repo:tenant_success', {
            event: 'conversations_repo:tenant_success',
            snapshotSize: tenantSnapshot.docs.length,
            source: 'tenant'
          });
        }
      }

      const duration = Date.now() - startTime;
      const hasNext = conversations.length === pagination.limit;
      const nextCursor = hasNext ? conversations[conversations.length - 1]?.id : null;

      // --- LOGS DE DIAGNÓSTICO POST-QUERY (solo si LOG_CONV_DIAG=true) ---
      if (process.env.LOG_CONV_DIAG === 'true') {
        const postQueryLog = {
          event: 'conversations_repo:post_query',
          snapshotSize: conversations.length,
          source,
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
          source,
          duration_ms: duration,
          collectionPath: this.collectionPath,
          tenantMode: this.tenantMode,
          legacyCompat: this.legacyCompat
        }
      };

      if (this.verboseLogs) {
        logger.info('conversations_repo:list_completed', {
          event: 'conversations_repo:list_completed',
          conversationsCount: conversations.length,
          hasNext,
          nextCursor,
          source,
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
          duration_ms: Date.now() - startTime
        });
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