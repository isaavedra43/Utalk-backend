/**
 * 💬 CONTROLADOR DE CONVERSACIONES - VERSIÓN COMPLETA PRODUCTION-READY
 * 
 * Implementa todos los endpoints RESTful requeridos por el frontend
 * siguiendo las mejores prácticas de Vinay Sahni y compatibilidad total.
 * 
 * ENDPOINTS IMPLEMENTADOS:
 * - GET /api/conversations (lista con filtros y paginación)
 * - GET /api/conversations/unassigned (sin asignar)
 * - GET /api/conversations/stats (estadísticas)
 * - GET /api/conversations/search (búsqueda)
 * - GET /api/conversations/:id (obtener una)
 * - POST /api/conversations (crear nueva)
 * - PUT /api/conversations/:id (actualizar)
 * - PUT /api/conversations/:id/assign (asignar)
 * - PUT /api/conversations/:id/unassign (desasignar)
 * - POST /api/conversations/:id/transfer (transferir)
 * - PUT /api/conversations/:id/status (cambiar estado)
 * - PUT /api/conversations/:id/priority (cambiar prioridad)
 * - PUT /api/conversations/:id/read-all (marcar como leída)
 * - POST /api/conversations/:id/typing (indicar typing)
 * 
 * @version 2.0.0
 * @author Backend Team
 */

const logger = require('../utils/logger');
const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
const ConversationService = require('../services/ConversationService');
const { cacheService } = require('../services/CacheService');
const { logMonitor } = require('../services/LogMonitorService');
const Message = require('../models/Message');
const User = require('../models/User');
const { safeFirestoreToJSON, analyzeFirestoreDocument } = require('../utils/firestore');
const { getConversationsRepository } = require('../repositories/ConversationsRepository');
const { firestore } = require('../config/firebase');
const { redactPII } = require('../utils/redact');
const { safeDateToISOString } = require('../utils/dateHelpers');

class ConversationController {
  /**
   * 📋 GET /api/conversations
   * Lista conversaciones con filtros avanzados y paginación
   * 
   * QUERY PARAMS:
   * - limit: número de resultados (default: 20, max: 100)
   * - cursor: cursor de paginación
   * - assignedTo: email del agente | 'me' | 'unassigned'
   * - status: open|closed|pending|archived
   * - priority: low|normal|high|urgent
   * - tags: array de tags
   * - search: búsqueda en customerPhone, contact.name
   * - sortBy: lastMessageAt|createdAt|priority (default: lastMessageAt)
   * - sortOrder: asc|desc (default: desc)
   */
  static async listConversations(req, res, next) {
    const startTime = Date.now();
    
    try {
      // 🔍 DESESTRUCTURACIÓN AL INICIO PARA EVITAR TDZ
      const {
        status: statusFilter = 'all',
        search = '',
        limit = '20',
        page = '1'
      } = req.query || {};

      const userEmail = req.user.email;

      // Validar parámetros
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

      // 🔍 LOGGING ESTRUCTURADO CON CORRELACIÓN + shape
      const hasInfo = typeof req.logger?.info === 'function';
      const hasAuth = typeof req.logger?.auth === 'function';
      const hasDatabase = typeof req.logger?.database === 'function';
      const hasChild = typeof req.logger?.child === 'function';
      try {
        logger.info('logger.shape', { hasInfo, hasAuth, hasDatabase, hasChild });
      } catch (_) {}
      req.logger?.info({
        event: 'conversations_list_start',
        requestId: req.requestId,
        traceId: req.traceId,
        loggerShape: { hasInfo, hasAuth, hasDatabase, hasChild },
        http: {
          method: req.method,
          path: req.path
        },
        user: req.logContext?.userCtx || null,
        filters: {
          status: statusFilter && statusFilter !== 'all' ? statusFilter : undefined,
          search: search ? search.trim() : undefined,
          limit: limitNum,
          page: pageNum
        }
      });

      // 🔧 CACHE: Generar clave única para cache
      const cacheKey = `conversations:${userEmail}:${statusFilter}:${search}:${limitNum}:${pageNum}`;
      
      // 🔧 CACHE: Intentar obtener del cache primero
      let result = cacheService.get(cacheKey);
      
      if (!result) {
        // Usar el nuevo repositorio unificado
        const conversationsRepo = getConversationsRepository();
        
        // Preparar parámetros para el repositorio
        const repoParams = {
          workspaceId: req.user.workspaceId,
          tenantId: req.user.tenantId,
          filters: {
            status: statusFilter && statusFilter !== 'all' ? statusFilter : undefined,
            participantsContains: userEmail, // CRÍTICO: pasar el email del usuario
            search: search ? search.trim() : undefined
          },
          pagination: {
            limit: limitNum,
            cursor: req.query.cursor
          }
        };

        // Ejecutar query a través del repositorio
        result = await conversationsRepo.list(repoParams);
        
        // 🔧 CACHE: Guardar en cache por 2 minutos
        cacheService.set(cacheKey, result, 120);
        
        // 🔧 LOG CRÍTICO PARA RAILWAY: Llamada a base de datos
        logger.debug('DB call para conversaciones', {
          category: 'CONVERSATIONS_DB_CALL',
          userEmail,
          page: pageNum,
          limit: limitNum,
          hasSearch: !!search
        });
        
        // 🔧 CAPTURAR EN LOG MONITOR
        logMonitor.addLog('info', 'DB', `Database call: conversations`, {
          userId: userEmail,
          endpoint: '/api/conversations',
          page: pageNum,
          limit: limitNum,
          search: search ? 'yes' : 'no'
        });
        
        logger.info('Conversaciones obtenidas de base de datos', {
          category: 'CACHE_MISS',
          cacheKey: cacheKey.substring(0, 50) + '...'
        });
      } else {
        // 🔧 LOG PARA RAILWAY: Cache hit en conversaciones
        req.logger.info('CACHE_HIT', {
        category: 'CONVERSATIONS_CACHE',
        user: userEmail,
        page: pageNum,
        limit: limitNum,
        cacheType: 'conversations'
      });
        
        // 🔧 CAPTURAR EN LOG MONITOR
        logMonitor.addLog('info', 'CACHE', `Cache hit: conversations`, {
          userId: userEmail,
          endpoint: '/api/conversations',
          page: pageNum,
          limit: limitNum
        });
        
        logger.info('Conversaciones obtenidas de cache', {
          category: 'CACHE_HIT',
          cacheKey: cacheKey.substring(0, 50) + '...'
        });
      }

      // Aplicar filtro de búsqueda post-snapshot si es necesario
      let filteredConversations = result.conversations;
      if (search && search.trim()) {
        const searchTerm = search.toLowerCase().trim();

        filteredConversations = result.conversations.filter(conv => {
          try {
            const matchesContact = conv.contact?.name?.toLowerCase().includes(searchTerm) ||
                                  conv.contact?.phone?.toLowerCase().includes(searchTerm);
            
            const matchesParticipants = conv.participants?.some(p => 
              p.toLowerCase().includes(searchTerm)
            );
            
            const matchesCustomerPhone = conv.customerPhone?.toLowerCase().includes(searchTerm);
            
            return matchesContact || matchesParticipants || matchesCustomerPhone;
          } catch (filterError) {
            logger.error('search_filter_error', {
              convId: conv.id,
              error: filterError.message
            });
            return false;
          }
        });
      }

      // Helper para convertir timestamps a milisegundos
      function toMs(ts) {
        if (!ts) return null;
        if (typeof ts.toMillis === 'function') return ts.toMillis();
        if (ts._seconds) return ts._seconds * 1000 + Math.floor((ts._nanoseconds || 0) / 1e6);
        const d = new Date(ts); return isNaN(d) ? null : d.getTime();
      }

      // Agregar campos derivados de fechas (non-breaking)
      filteredConversations = filteredConversations.map(conv => {
        const ms = toMs(conv.lastMessageAt);
        conv.lastMessageAtMs = ms;
        conv.lastMessageAtISO = ms ? new Date(ms).toISOString() : null;

        // Si devuelves lastMessage.timestamp, aplica lo mismo
        if (conv.lastMessage?.timestamp) {
          const tms = toMs(conv.lastMessage.timestamp);
          conv.lastMessage.timestampMs = tms;
          conv.lastMessage.timestampISO = tms ? new Date(tms).toISOString() : null;
        }

        return conv;
      });

      // 🔍 LOGGING ESTRUCTURADO DE FINALIZACIÓN
      const durationMs = Date.now() - startTime;
      req.logger?.info({
        event: 'conversations_list_done',
        requestId: req.requestId,
        traceId: req.traceId,
        http: {
          method: req.method,
          path: req.path,
          status: 200,
          durationMs
        },
        user: req.logContext?.userCtx || null,
        result: {
          count: filteredConversations.length,
          totalCount: result.conversations.length,
          source: result.debug?.source || 'repository'
        }
      });

      // Retornar respuesta manteniendo el contrato HTTP existente
      return ResponseHandler.success(
        res,
        filteredConversations,
        `${filteredConversations.length} conversaciones encontradas`,
        200
      );

    } catch (error) {
      // 🆕 MANEJO ESPECÍFICO PARA ERRORES DE ÍNDICE EN CONSTRUCCIÓN
      if (error.message && error.message.includes('FAILED_PRECONDITION: The query requires an index')) {
        logger.error('FIRESTORE_INDEX_BUILDING_ERROR', {
          error: error.message,
          userEmail: req.user?.email,
          suggestion: 'El índice está en construcción. Esperar 5-10 minutos o usar query temporal',
          action: 'Crear query temporal sin ordenamiento'
        });

        // 🆕 QUERY TEMPORAL SIN ORDENAMIENTO
        try {
          logger.info('attempting_fallback_query', {
            userEmail: req.user?.email,
            message: 'Intentando query sin ordenamiento como fallback'
          });

          // 🗑️ OBSOLETO: No usar colección conversations antigua
          logger.warn('🗑️ OBSOLETO: Fallback a colección conversations antigua eliminado');
          throw new Error('Colección conversations antigua ELIMINADA');
          
          // Aplicar filtros básicos sin ordenamiento
          if (statusFilter && statusFilter !== 'all') {
            fallbackQuery = fallbackQuery.where('status', '==', statusFilter);
          }
          
          fallbackQuery = fallbackQuery.where('participants', 'array-contains', req.user.email);
          fallbackQuery = fallbackQuery.limit(limitNum);

          const fallbackSnapshot = await fallbackQuery.get();
          const fallbackConversations = [];

          for (const doc of fallbackSnapshot.docs) {
            try {
              const conversation = new Conversation(doc.id, doc.data());
              fallbackConversations.push(safeFirestoreToJSON(conversation));
            } catch (docError) {
              continue;
            }
          }

          // Ordenar en memoria como fallback
          fallbackConversations.sort((a, b) => {
            const aTime = a.lastMessageAt?._seconds || 0;
            const bTime = b.lastMessageAt?._seconds || 0;
            return bTime - aTime; // Descendente
          });

          logger.info('fallback_query_success', {
            userEmail: req.user?.email,
            message: 'Query temporal exitosa mientras se construye el índice'
          });

          return ResponseHandler.success(
            res,
            fallbackConversations,
            `${fallbackConversations.length} conversaciones encontradas (índice en construcción)`,
            200
          );

        } catch (fallbackError) {
          logger.error('fallback_query_failed', {
            error: fallbackError.message,
            userEmail: req.user?.email
          });
        }
      }

      logger.error('get_conversations_error', {
        error: error.message,
        stack: error.stack,
        userEmail: req.user?.email,
        query: req.query
      });

      next(error);
    }
  }

  /**
   * 📊 GET /api/conversations/unassigned  
   * Obtiene conversaciones sin asignar (solo agentes/admins)
   */
  static async getUnassignedConversations(req, res, next) {
    try {
      if (!['agent', 'admin', 'superadmin'].includes(req.user.role)) {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver conversaciones sin asignar', 'conversations');
      }

      const { limit = 20, cursor = null } = req.query;

      const result = await ConversationService.listUnassignedConversations(
        req.user.email,
        Math.min(parseInt(limit), 100),
        cursor
      );

      logger.info('Conversaciones sin asignar obtenidas', {
        userEmail: req.user.email,
        count: result.conversations.length
      });

      return ResponseHandler.successPaginated(
        res,
        result.map(conv => safeFirestoreToJSON(conv)),
        result.pagination,
        `${result.conversations.length} conversaciones sin asignar`
      );

    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 📈 GET /api/conversations/stats
   * Estadísticas de conversaciones del usuario o globales (admins)
   */
  static async getConversationStats(req, res, next) {
    try {
      const { period = '7d', agentEmail = null } = req.query;
      
      // 🔒 CONTROL DE PERMISOS
      let targetAgent = req.user.email;
      if (agentEmail && req.user.role === 'admin') {
        targetAgent = agentEmail;
      } else if (agentEmail && req.user.role !== 'admin') {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver estadísticas de otros agentes', 'stats');
      }

      const stats = await ConversationService.getStats(targetAgent, period);

      logger.info('Estadísticas de conversaciones obtenidas', {
        userEmail: req.user.email,
        targetAgent,
        period
      });

      return ResponseHandler.success(res, stats, 'Estadísticas generadas exitosamente');

    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🔍 GET /api/conversations/search
   * Búsqueda avanzada de conversaciones
   */
  static async searchConversations(req, res, next) {
    try {
      const { q: searchTerm, limit = 20, ...filters } = req.query;

      if (!searchTerm || searchTerm.length < 2) {
        throw new ApiError(
          'SEARCH_TERM_TOO_SHORT',
          'El término de búsqueda debe tener al menos 2 caracteres',
          'Proporciona un término de búsqueda más específico',
          400
        );
      }

      const searchOptions = {
        limit: Math.min(parseInt(limit), 100),
        search: searchTerm,
        assignedTo: req.user.role === 'viewer' ? req.user.email : filters.assignedTo,
        ...filters
      };

      const result = await ConversationService.searchConversations(searchTerm, searchOptions);

      logger.info('Búsqueda de conversaciones ejecutada', {
        userEmail: req.user.email,
        searchTerm,
        resultsCount: result.length
      });

      return ResponseHandler.success(
        res,
        result.map(conv => safeFirestoreToJSON(conv)),
        `${result.length} conversaciones encontradas para: "${searchTerm}"`
      );

    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 📋 GET /api/conversations/:id
   * Obtiene una conversación específica por ID
   */
  static async getConversation(req, res, next) {
    try {
      // 🔧 CORRECCIÓN CRÍTICA: Usar el conversationId ya normalizado por el middleware
      const conversationId = req.normalizedConversationId || req.params.conversationId || req.params.id;
      
      if (!conversationId) {
        throw CommonErrors.CONVERSATION_NOT_FOUND('undefined');
      }

      // 🔍 LOGGING MEJORADO PARA DEBUG
      logger.info('ConversationController.getConversation - Procesando request', {
        originalId: req.params.conversationId,
        normalizedId: req.normalizedConversationId,
        finalId: conversationId,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        method: req.method,
        url: req.originalUrl
      });

      const conversation = await ConversationService.getConversationById(conversationId);
      
      // 🔧 SOLUCIÓN SEGURA: Verificación completa del objeto conversation
      if (!conversation) {
        logger.warn('Conversación no encontrada', { conversationId });
        throw CommonErrors.CONVERSATION_NOT_FOUND(conversationId);
      }

      // 🔍 DEBUGGING TEMPORAL: Logging para diagnóstico
      logger.debug('Conversation object analysis', {
        conversationId,
        conversationType: typeof conversation,
        hasToJSON: typeof conversation.toJSON === 'function',
        conversationKeys: Object.keys(conversation || {}),
        conversationExists: !!conversation
      });

      // 🔧 SOLUCIÓN SEGURA: Análisis detallado del documento
      analyzeFirestoreDocument(conversation, 'getConversation');

      // 🔒 VALIDAR PERMISOS DE ACCESO
      if (req.user.role === 'viewer' && conversation.assignedTo !== req.user.email) {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver esta conversación', conversationId);
      }

      logger.info('Conversación obtenida exitosamente', {
        conversationId,
        userEmail: req.user.email,
        assignedTo: conversation.assignedTo
      });

      // 🔧 SOLUCIÓN SEGURA: Usar utilidad de conversión segura
      const conversationData = safeFirestoreToJSON(conversation);
      
      if (!conversationData) {
        logger.error('Error al convertir conversación a JSON', {
          conversationId,
          conversationType: typeof conversation
        });
        throw CommonErrors.INTERNAL_SERVER_ERROR('Error al procesar la conversación');
      }

      return ResponseHandler.success(res, conversationData, 'Conversación obtenida exitosamente');

    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * ➕ POST /api/conversations
   * Crea nueva conversación con mensaje inicial opcional
   */
  static async createConversation(req, res, next) {
    try {
      // 🔧 EXPANDIDO: Extraer todos los campos que puede enviar el frontend
      const { 
        customerPhone, 
        customerName,
        assignedTo, 
        initialMessage, 
        priority = 'medium', 
        tags = [],
        // Campos adicionales del frontend
        id: frontendId,
        status = 'open',
        participants: frontendParticipants,
        createdBy: frontendCreatedBy,
        assignedToName,
        createdAt: frontendCreatedAt,
        updatedAt: frontendUpdatedAt,
        lastMessageAt: frontendLastMessageAt,
        unreadCount = 0,
        messageCount = 0,
        tenantId,
        workspaceId,
        messages = [],
        lastMessage,
        metadata: frontendMetadata,
        subject,
        channel,
        source,
        externalId,
        notes,
        customFields
      } = req.body;

      // 🔍 VALIDAR AGENTE ASIGNADO
      let assignedAgent = null;
      if (assignedTo) {
        assignedAgent = await User.getByEmail(assignedTo);
        if (!assignedAgent) {
          throw CommonErrors.USER_NOT_AUTHORIZED('asignar conversación a', assignedTo);
        }
      }

      // 🆕 GENERAR CONVERSATION ID CORRECTO
      const { generateConversationId } = require('../utils/conversation');
      const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_FROM || process.env.WHATSAPP_FROM;
      
      if (!whatsappNumber) {
        throw new Error('TWILIO_WHATSAPP_NUMBER no configurado');
      }

      // ⚠️ IGNORAR ID DEL FRONTEND: siempre generar ID canónico cliente-primero
      const conversationId = generateConversationId(whatsappNumber, customerPhone);
      
      logger.info('🔧 Conversation ID procesado', {
        frontendId,
        generatedId: conversationId,
        customerPhone,
        generatedBy: 'ConversationController.createConversation'
      });

      // 🆕 CREAR CONVERSACIÓN CON ID CORRECTO
      const Conversation = require('../models/Conversation');
      const { getDefaultViewerEmails } = require('../config/defaultViewers');
      
      // 🔧 CRÍTICO: Asegurar que el usuario creador esté en participants
      const creatorEmail = frontendCreatedBy || req.user.email;
      
      // 🔧 PARTICIPANTS EMAIL-ONLY: incluir creador y asignado; agregar viewers por defecto
      const participantsSet = new Set();
      if (creatorEmail) participantsSet.add(String(creatorEmail).toLowerCase());
      if (assignedAgent?.email) participantsSet.add(String(assignedAgent.email).toLowerCase());
      const defaultViewers = getDefaultViewerEmails();
      if (Array.isArray(defaultViewers)) {
        for (const v of defaultViewers) {
          if (v) participantsSet.add(String(v).toLowerCase());
        }
      }
      const participants = Array.from(participantsSet);
      
      // 🔧 EXPANDIDO: Construir objeto de conversación con todos los campos
      const conversationData = {
        id: conversationId,
        customerPhone: customerPhone,
        customerName: customerName || '',
        assignedTo: assignedAgent?.email || assignedTo || null,
        assignedToName: assignedToName || assignedAgent?.name || null,
        priority,
        tags,
        participants: participants,
        createdBy: creatorEmail,
        status,
        unreadCount,
        messageCount,
        workspaceId: workspaceId || req.user.workspaceId || 'default_workspace',
        tenantId: tenantId || req.user.tenantId || 'default_tenant',
        createdAt: frontendCreatedAt ? new Date(frontendCreatedAt) : new Date(),
        updatedAt: frontendUpdatedAt ? new Date(frontendUpdatedAt) : new Date(),
        lastMessageAt: frontendLastMessageAt ? new Date(frontendLastMessageAt) : new Date(),
        // Campos adicionales
        subject,
        channel: channel || 'whatsapp',
        source: source || 'manual',
        externalId,
        notes,
        customFields,
        // Metadata expandida
        metadata: {
          ...frontendMetadata,
          channel: channel || 'whatsapp',
          createdVia: source || 'manual',
          frontendData: true
        }
      };

      logger.info('🔧 Datos de conversación preparados', {
        conversationId,
        customerPhone,
        participantsCount: participants.length,
        hasMetadata: !!frontendMetadata,
        timestamp: new Date().toISOString()
      });

      let conversation;
      try {
        conversation = await ConversationService.createConversation(conversationData);
      } catch (createError) {
        if (createError.message && createError.message.startsWith('CONVERSATION_EXISTS:')) {
          const existingConversationId = createError.message.split(':')[1];
          
          logger.warn('⚠️ Conversación ya existe - recuperando conversación existente', {
            requestedId: conversationId,
            existingId: existingConversationId,
            customerPhone
          });
          
          // Obtener la conversación existente
          conversation = await ConversationService.getConversationById(existingConversationId);
          
          if (!conversation) {
            throw CommonErrors.CONVERSATION_NOT_FOUND(existingConversationId);
          }
        } else {
          throw createError;
        }
      }

      // 🔧 CREAR MENSAJE INICIAL SI SE PROPORCIONA
      if (initialMessage) {
        try {
          logger.info('🆕 Procesando mensaje inicial', {
            conversationId: conversation.id,
            customerPhone,
            initialMessage,
            creatorEmail,
            timestamp: new Date().toISOString()
          });

          // 🔧 USAR CONVERSATIONSREPOSITORY PARA ENVÍO COMPLETO (BD + WHATSAPP)
          const { getConversationsRepository } = require('../repositories/ConversationsRepository');
          const conversationsRepo = getConversationsRepository();
          
          const messageData = {
            conversationId: conversation.id,
            messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: initialMessage,
            senderIdentifier: creatorEmail,
            recipientIdentifier: customerPhone,
            direction: 'outbound',
            type: 'text',
            workspaceId: req.user.workspaceId || 'default_workspace',
            tenantId: req.user.tenantId || 'default_tenant',
            metadata: { 
              createdWithConversation: true,
              source: 'conversation_form'
            }
          };

          logger.info('📤 Enviando mensaje inicial usando ConversationsRepository', {
            conversationId: conversation.id,
            customerPhone,
            initialMessage,
            messageId: messageData.messageId,
            timestamp: new Date().toISOString()
          });

          const sendResult = await conversationsRepo.appendOutbound(messageData);

          logger.info('✅ Mensaje inicial enviado completamente', {
            conversationId: conversation.id,
            customerPhone,
            messageContent: initialMessage,
            messageId: sendResult.message?.id,
            twilioSid: sendResult.message?.twilioSid,
            status: sendResult.message?.status,
            success: !!sendResult.success,
            timestamp: new Date().toISOString()
          });

        } catch (whatsappError) {
          logger.error('❌ Error enviando mensaje inicial por WhatsApp', {
            conversationId: conversation.id,
            customerPhone,
            initialMessage,
            error: whatsappError.message,
            errorCode: whatsappError.code,
            stack: whatsappError.stack?.split('\n').slice(0, 3),
            timestamp: new Date().toISOString()
          });
          
          // No fallar la creación de conversación si falla el envío de WhatsApp
          // Pero registrar el error para debugging
        }
      } else {
        logger.info('ℹ️ No hay mensaje inicial para enviar', {
          conversationId: conversation.id,
          customerPhone,
          timestamp: new Date().toISOString()
        });
      }

      // 📡 EMITIR EVENTOS WEBSOCKET
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.io.emit('conversation-created', {
          conversation: safeFirestoreToJSON(conversation),
          createdBy: creatorEmail,
          timestamp: new Date().toISOString()
        });

        if (assignedAgent) {
          socketManager.io.emit('conversation-assigned', {
            conversationId: conversation.id,
            assignedTo: {
              email: assignedAgent.email,
              name: assignedAgent.name
            },
            timestamp: new Date().toISOString()
          });
        }
      }

      logger.info('Nueva conversación creada', {
        conversationId: conversation.id,
        customerPhone: customerPhone,
        assignedTo: assignedAgent?.email,
        createdBy: creatorEmail,
        participants: participants,
        hasInitialMessage: !!initialMessage
      });

      return ResponseHandler.created(res, safeFirestoreToJSON(conversation), 'Conversación creada exitosamente');

    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * ✏️ PUT /api/conversations/:id
   * Actualiza conversación (status, priority, tags)
   */
  static async updateConversation(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const conversation = await ConversationService.getConversationById(id);
      if (!conversation) {
        throw CommonErrors.CONVERSATION_NOT_FOUND(id);
      }

      // 🔒 VALIDAR PERMISOS
      if (req.user.role === 'viewer') {
        throw CommonErrors.USER_NOT_AUTHORIZED('actualizar conversaciones', id);
      }

      // 📝 APLICAR ACTUALIZACIONES
      await conversation.update(updates);

      // 📡 EMITIR EVENTO WEBSOCKET usando facade
      const { getSocketManager } = require('../socket');
      const rt = getSocketManager();
      if (rt) {
        rt.broadcastToConversation({
          workspaceId: req.user.workspaceId,
          tenantId: req.user.tenantId,
          conversationId: id,
          event: 'conversation-updated',
          payload: {
            conversationId: id,
            updates,
            updatedBy: req.user.email,
            timestamp: new Date().toISOString()
          }
        });
      }

      logger.info('Conversación actualizada', {
        conversationId: id,
        updates: Object.keys(updates),
        updatedBy: req.user.email
      });

      return ResponseHandler.success(res, safeFirestoreToJSON(conversation), 'Conversación actualizada exitosamente');

    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 👤 PUT /api/conversations/:id/assign
   * Asigna conversación a un agente
   */
  static async assignConversation(req, res, next) {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;

      const conversation = await ConversationService.getConversationById(id);
      if (!conversation) {
        throw CommonErrors.CONVERSATION_NOT_FOUND(id);
      }

      // 🔍 VALIDAR AGENTE
      const agent = await User.getByEmail(assignedTo);
      if (!agent) {
        throw new ApiError(
          'AGENT_NOT_FOUND',
          `No se encontró el agente con email: ${assignedTo}`,
          'Verifica que el email del agente sea correcto y que el usuario exista',
          404,
          { assignedTo }
        );
      }

      if (!agent.isActive) {
        throw new ApiError(
          'AGENT_INACTIVE',
          `El agente ${assignedTo} está inactivo`,
          'Asigna la conversación a un agente activo',
          400,
          { assignedTo, isActive: agent.isActive }
        );
      }

      // 🔄 VERIFICAR SI YA ESTÁ ASIGNADA
      if (conversation.assignedTo === assignedTo) {
        throw CommonErrors.CONVERSATION_ALREADY_ASSIGNED(id, assignedTo);
      }

      // 📋 ASIGNAR
      await conversation.assignTo(agent.email, agent.name);

      // 📡 EMITIR EVENTOS WEBSOCKET
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.io.emit('conversation-assigned', {
          conversationId: id,
          assignedTo: {
            email: agent.email,
            name: agent.name
          },
          previousAssignedTo: conversation.assignedTo,
          assignedBy: req.user.email,
          timestamp: new Date().toISOString()
        });
      }

      logger.info('Conversación asignada', {
        conversationId: id,
        assignedTo: agent.email,
        assignedBy: req.user.email,
        previousAssignedTo: conversation.assignedTo
      });

      return ResponseHandler.success(res, safeFirestoreToJSON(conversation), `Conversación asignada a ${agent.name}`);

    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🚫 PUT /api/conversations/:id/unassign
   * Desasigna conversación (quita agente)
   */
  static async unassignConversation(req, res, next) {
    try {
      const { id } = req.params;

      const conversation = await ConversationService.getConversationById(id);
      if (!conversation) {
        throw CommonErrors.CONVERSATION_NOT_FOUND(id);
      }

      if (!conversation.assignedTo) {
        throw new ApiError(
          'CONVERSATION_NOT_ASSIGNED',
          'La conversación no tiene agente asignado',
          'Solo puedes desasignar conversaciones que tengan un agente asignado',
          400,
          { conversationId: id }
        );
      }

      const previousAgent = conversation.assignedTo;
      await conversation.unassign();

      // 📡 EMITIR EVENTO WEBSOCKET
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.io.emit('conversation-unassigned', {
          conversationId: id,
          previousAssignedTo: previousAgent,
          unassignedBy: req.user.email,
          timestamp: new Date().toISOString()
        });
      }

      logger.info('Conversación desasignada', {
        conversationId: id,
        previousAssignedTo: previousAgent,
        unassignedBy: req.user.email
      });

      return ResponseHandler.success(res, safeFirestoreToJSON(conversation), 'Conversación desasignada exitosamente');

    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🔄 POST /api/conversations/:id/transfer
   * Transfiere conversación de un agente a otro
   */
  static async transferConversation(req, res, next) {
    try {
      const { id } = req.params;
      const { fromAgent, toAgent, reason = '' } = req.body;

      const conversation = await ConversationService.getConversationById(id);
      if (!conversation) {
        throw CommonErrors.CONVERSATION_NOT_FOUND(id);
      }

      // 🔍 VALIDAR AGENTES
      const sourceAgent = await User.getByEmail(fromAgent);
      const targetAgent = await User.getByEmail(toAgent);

      if (!sourceAgent) {
        throw new ApiError('AGENT_NOT_FOUND', `Agente origen no encontrado: ${fromAgent}`, 'Verifica el email del agente origen', 404);
      }

      if (!targetAgent) {
        throw new ApiError('AGENT_NOT_FOUND', `Agente destino no encontrado: ${toAgent}`, 'Verifica el email del agente destino', 404);
      }

      if (!targetAgent.isActive) {
        throw new ApiError('AGENT_INACTIVE', `El agente destino está inactivo: ${toAgent}`, 'Transfiere a un agente activo', 400);
      }

      // 🔄 TRANSFERIR
      // Obtener la conversación como instancia de Conversation
      const Conversation = require('../models/Conversation');
      const conversationInstance = new Conversation(conversation);
      await conversationInstance.assignTo(targetAgent.email, targetAgent.name);

      // 💬 CREAR MENSAJE DE TRANSFERENCIA
      const transferMessage = {
        conversationId: id,
        content: `Conversación transferida de ${sourceAgent.name} a ${targetAgent.name}${reason ? `. Motivo: ${reason}` : ''}`,
        senderIdentifier: 'system',
        recipientIdentifier: conversation.customerPhone,
        direction: 'system',
        type: 'system',
        status: 'sent',
        metadata: {
          type: 'transfer',
          fromAgent: fromAgent,
          toAgent: toAgent,
          reason,
          transferredBy: req.user.email
        }
      };

      await Message.create(transferMessage);

      // 📡 EMITIR EVENTOS WEBSOCKET
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.io.emit('conversation-transferred', {
          conversationId: id,
          fromAgent: {
            email: fromAgent,
            name: sourceAgent.name
          },
          toAgent: {
            email: toAgent,
            name: targetAgent.name
          },
          reason,
          transferredBy: req.user.email,
          timestamp: new Date().toISOString()
        });
      }

      logger.info('Conversación transferida', {
        conversationId: id,
        fromAgent,
        toAgent,
        reason,
        transferredBy: req.user.email
      });

      return ResponseHandler.success(res, safeFirestoreToJSON(conversation), `Conversación transferida a ${targetAgent.name}`);

    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🔄 PUT /api/conversations/:id/status
   * Cambia estado de conversación
   */
  static async changeConversationStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, reason = '' } = req.body;

      const conversation = await ConversationService.getConversationById(id);
      if (!conversation) {
        throw CommonErrors.CONVERSATION_NOT_FOUND(id);
      }

      const previousStatus = conversation.status;
      await conversation.changeStatus(status);

      // 💬 CREAR MENSAJE DE CAMBIO DE ESTADO
      if (status !== previousStatus) {
        const statusMessage = {
          conversationId: id,
          content: `Estado cambiado de ${previousStatus} a ${status}${reason ? `. Motivo: ${reason}` : ''}`,
          senderIdentifier: 'system',
          recipientIdentifier: conversation.customerPhone,
          direction: 'system',
          type: 'system',
          status: 'sent',
          metadata: {
            type: 'status_change',
            previousStatus,
            newStatus: status,
            reason,
            changedBy: req.user.email
          }
        };

        await Message.create(statusMessage);
      }

      // 📡 EMITIR EVENTO WEBSOCKET usando facade
      const { getSocketManager } = require('../socket');
      const rt = getSocketManager();
      if (rt) {
        rt.broadcastToConversation({
          workspaceId: req.user.workspaceId,
          tenantId: req.user.tenantId,
          conversationId: id,
          event: 'conversation-status-changed',
          payload: {
            conversationId: id,
            previousStatus,
            newStatus: status,
            reason,
            changedBy: req.user.email,
            timestamp: new Date().toISOString()
          }
        });
      }

      logger.info('Estado de conversación cambiado', {
        conversationId: id,
        previousStatus,
        newStatus: status,
        changedBy: req.user.email
      });

      return ResponseHandler.success(res, safeFirestoreToJSON(conversation), `Estado cambiado a ${status}`);

    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🎯 PUT /api/conversations/:id/priority
   * Cambia prioridad de conversación
   */
  static async changeConversationPriority(req, res, next) {
    try {
      const { id } = req.params;
      const { priority, reason = '' } = req.body;

      const conversation = await ConversationService.getConversationById(id);
      if (!conversation) {
        throw CommonErrors.CONVERSATION_NOT_FOUND(id);
      }

      const previousPriority = conversation.priority;
      await conversation.changePriority(priority);

      // 📡 EMITIR EVENTO WEBSOCKET
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.io.emit('conversation-priority-changed', {
          conversationId: id,
          previousPriority,
          newPriority: priority,
          reason,
          changedBy: req.user.email,
          timestamp: new Date().toISOString()
        });
      }

      logger.info('Prioridad de conversación cambiada', {
        conversationId: id,
        previousPriority,
        newPriority: priority,
        changedBy: req.user.email
      });

      return ResponseHandler.success(res, safeFirestoreToJSON(conversation), `Prioridad cambiada a ${priority}`);

    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * PUT /api/conversations/:conversationId/read-all
   * Marca toda la conversación como leída por el usuario actual
   */
  static async markConversationAsRead(req, res, next) {
    try {
      const { conversationId } = req.params;

      const conversation = await ConversationService.getConversationById(conversationId);
      if (!conversation) {
        throw CommonErrors.CONVERSATION_NOT_FOUND(conversationId);
      }

      // 📝 MARCAR MENSAJES COMO LEÍDOS
      // Primero obtener la conversación como instancia de Conversation
      const Conversation = require('../models/Conversation');
      const conversationInstance = new Conversation(conversation);
      const markedCount = await conversationInstance.markAllAsRead(req.user.email);

      // 📡 EMITIR EVENTO WEBSOCKET usando facade
      const { getSocketManager } = require('../socket');
      const rt = getSocketManager();
      if (rt) {
        rt.broadcastToConversation({
          workspaceId: req.user.workspaceId,
          tenantId: req.user.tenantId,
          conversationId,
          event: 'conversation-marked-read',
          payload: {
            conversationId,
            readBy: req.user.email,
            markedCount,
            timestamp: new Date().toISOString()
          }
        });
      }

      logger.info('Conversación marcada como leída', {
        conversationId,
        readBy: req.user.email,
        markedCount
      });

      return ResponseHandler.success(res, {
          conversationId,
        markedCount,
        readBy: req.user.email
      }, `${markedCount} mensajes marcados como leídos`);

    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * ⌨️ POST /api/conversations/:id/typing
   * Indica que el usuario está escribiendo
   */
  static async indicateTyping(req, res, next) {
    try {
      const { id } = req.params;
      const { isTyping = true } = req.body;

      // 📡 EMITIR EVENTO WEBSOCKET INMEDIATAMENTE usando facade
      const { getSocketManager } = require('../socket');
      const rt = getSocketManager();
      if (rt) {
        rt.broadcastToConversation({
          workspaceId: req.user.workspaceId,
          tenantId: req.user.tenantId,
          conversationId: id,
          event: 'user-typing',
          payload: {
            conversationId: id,
            email: req.user.email,
            displayName: req.user.name,
            isTyping,
            timestamp: new Date().toISOString()
          }
        });
      }

      return ResponseHandler.success(res, {
        conversationId: id,
        isTyping,
        user: req.user.email
      }, `Indicador de escritura ${isTyping ? 'activado' : 'desactivado'}`);

        } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * DELETE /api/conversations/:id
   * Eliminar conversación
   */
  static async deleteConversation(req, res, next) {
    try {
      const { id } = req.params;
      const userEmail = req.user.email;

      // Verificar que la conversación existe
      const conversation = await ConversationService.getConversationById(id);
      
      if (!conversation) {
        return ResponseHandler.error(res, new ApiError(
          'CONVERSATION_NOT_FOUND',
          'Conversación no encontrada',
          'Verifica el ID e intenta nuevamente',
          404
        ));
      }

      // 🗑️ OBSOLETO: No usar colección conversations antigua
      logger.warn('🗑️ OBSOLETO: Eliminación en colección conversations antigua prohibida');
      throw new Error('Eliminación en colección conversations antigua PROHIBIDA - usar ConversationService');

      logger.info('Conversación eliminada', {
        conversationId: id,
        deletedBy: userEmail
      });

      return ResponseHandler.success(
        res,
        null,
        'Conversación eliminada exitosamente'
      );

    } catch (error) {
      logger.error('Error eliminando conversación:', error);
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 💬 POST /api/conversations/:id/messages
   * Enviar mensaje en conversación específica
   */
  static async sendMessageInConversation(req, res, next) {
    try {
      // Usar conversationId normalizado del middleware
      const conversationId = req.normalizedConversationId;
      const validatedMessage = req.validatedMessage;
      const userEmail = req.user.email;

      // Verificar que la conversación existe
      const conversation = await ConversationService.getConversationById(conversationId);
      
      if (!conversation) {
        return ResponseHandler.error(res, new ApiError(
          'CONVERSATION_NOT_FOUND',
          'Conversación no encontrada',
          'Verifica el ID de la conversación',
          404
        ));
      }

      // Verificar que el usuario tiene acceso a la conversación
      const participants = conversation.participants || [];
      if (!participants.includes(userEmail)) {
        return ResponseHandler.error(res, new ApiError(
          'ACCESS_DENIED',
          'No tienes acceso a esta conversación',
          'Solo los participantes pueden enviar mensajes',
          403
        ));
      }

      // Preparar datos del mensaje usando validación centralizada
      const messageData = {
        conversationId,
        messageId: validatedMessage.messageId,
        content: validatedMessage.content,
        type: validatedMessage.type,
        direction: 'outbound',
        senderIdentifier: validatedMessage.senderIdentifier,
        recipientIdentifier: validatedMessage.recipientIdentifier,
        agentEmail: userEmail,
        workspaceId: req.user.workspaceId,
        tenantId: req.user.tenantId,
        metadata: {
          ...validatedMessage.metadata,
          sentBy: userEmail,
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          requestId: req.id || 'unknown'
        },
        timestamp: new Date()
      };

      // Usar el repositorio para enviar el mensaje
      const conversationsRepo = getConversationsRepository();
      const result = await conversationsRepo.appendOutbound(messageData);

      // Emitir evento de socket para tiempo real usando el facade
      const { getSocketManager } = require('../socket');
      const rt = getSocketManager();
      if (rt) {
        rt.emitNewMessage({
          workspaceId: req.user.workspaceId,
          tenantId: req.user.tenantId,
          conversationId,
          message: result.message,
          correlationId: req.id || 'unknown'
        });
        
        rt.emitConversationUpdated({
          workspaceId: req.user.workspaceId,
          tenantId: req.user.tenantId,
          conversationId,
          lastMessage: { 
            text: validatedMessage.content, 
            type: validatedMessage.type, 
            direction: 'outbound' 
          },
          updatedAt: new Date().toISOString(),
          unreadCount: 0,
          correlationId: req.id || 'unknown'
        });
      }

      logger.info('Mensaje enviado exitosamente', {
        requestId: req.id || 'unknown',
        conversationId,
        messageId: result.message.id,
        sender: userEmail,
        contentLength: validatedMessage.content.length,
        type: validatedMessage.type,
        senderIdentifier: validatedMessage.senderIdentifier,
        recipientIdentifier: validatedMessage.recipientIdentifier
      });

      // Si appendOutbound lanzó error → captúralo y responde 424
      // En éxito, acepta queued/accepted/sent como OK (201)
      if (!['queued','accepted','sent'].includes(result.message.status)) {
        return ResponseHandler.error(res, new ApiError(
          'MESSAGE_NOT_SENT',
          'El mensaje no se pudo enviar',
          `Estado: ${result.message.status}`,
          424
        ));
      }
      
      return res.status(201).json({ 
        success: true, 
        data: { 
          message: result.message, 
          conversation: result.conversation 
        } 
      });

    } catch (error) {
      logger.error('Error enviando mensaje:', {
        requestId: req.id || 'unknown',
        conversationId: req.normalizedConversationId,
        error: error.message,
        stack: error.stack
      });
      
      // Mapear errores Twilio específicos
      if (error?.code === 20003) {
        return ResponseHandler.error(res, new ApiError(
          'TWILIO_AUTH_FAILED',
          'Credenciales de Twilio inválidas (code 20003)',
          'Verifica TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN',
          424
        ));
      }
      if (error?.code === 63016 || error?.code === 63051) {
        return ResponseHandler.error(res, new ApiError(
          'WHATSAPP_WINDOW_CLOSED',
          'La ventana de 24h está cerrada o falta plantilla aprobada',
          'Envía plantilla o reabre la sesión',
          424
        ));
      }
      
      // fallback original
      return ResponseHandler.error(res, error);
    }
  }
}

module.exports = ConversationController;
