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

    const { status, assignedTo, search } = filters;
    const { limit = 20, cursor } = pagination;

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

    // Aplicar búsqueda (básica por customerPhone)
    if (search) {
      query = query.where('customerPhone', '>=', search)
                   .where('customerPhone', '<=', search + '\uf8ff');
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
    return ['workspaceId', 'tenantId', 'status', 'assignedTo', 'customerPhone'].filter(Boolean);
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

    try {
      // Construir query tenant-first
      const { query: tenantQuery, debug: tenantDebug } = this.buildQuery(params);
      
      if (this.verboseLogs) {
        logger.info('conversations_repo:query', {
          event: 'conversations_repo:query',
          collectionPath: this.collectionPath,
          wheres: tenantDebug.wheres,
          orderBy: tenantDebug.orderBy,
          limit: tenantDebug.limit,
          cursor: tenantDebug.cursor,
          tenantMode: this.tenantMode,
          legacyCompat: this.legacyCompat,
          user: { workspaceId, tenantId }
        });
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