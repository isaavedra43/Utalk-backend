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

const ConversationService = require('../services/ConversationService');
const logger = require('../utils/logger');
const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
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
      req.logger.info('get_conversations_start', {
        userEmail: req.user.email,
        userId: req.user.uid,
        query: req.query
      });

      // ✅ NUEVO: Debug logging exhaustivo
      logger.logObject('req.user', req.user, 'get_conversations_start');
      logger.logObject('req.query', req.query, 'get_conversations_start');

      const { page = 1, limit = 50, status, search } = req.query;
      const userEmail = req.user.email;

      // Validar parámetros
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

      req.logger.debug('get_conversations_params', {
        pageNum,
        limitNum,
        status,
        search,
        userEmail
      });

      // ✅ NUEVO: Debug logging para parámetros
      logger.logObject('pagination_params', { pageNum, limitNum, status, search, userEmail }, 'after_validation');

      // Construir query base
      let query = firestore.collection('conversations');

      // ✅ NUEVO: Debug logging para query inicial
      logger.logObject('initial_query', query, 'before_filters');

      // Aplicar filtros
      if (status && status !== 'all') {
        query = query.where('status', '==', status);
        req.logger.debug('applied_status_filter', { status });
      }

      // Filtro por participante
      query = query.where('participants', 'array-contains', userEmail);
      req.logger.debug('applied_participant_filter', { userEmail });

      // ✅ NUEVO: Debug logging para query con filtros
      logger.logObject('filtered_query', query, 'after_filters');

      // Ordenar por última actividad
      query = query.orderBy('lastMessageAt', 'desc');

      // Aplicar paginación
      const offset = (pageNum - 1) * limitNum;
      if (offset > 0) {
        query = query.offset(offset);
      }
      query = query.limit(limitNum);

      req.logger.debug('final_query_params', {
        offset,
        limit: limitNum,
        orderBy: 'lastMessageAt desc'
      });

      // ✅ NUEVO: Debug logging para query final
      logger.logObject('final_query', query, 'before_execution');

      // Ejecutar query
      req.logger.database('executing_conversations_query', {
        userEmail,
        pageNum,
        limitNum,
        hasStatusFilter: !!status,
        hasSearchFilter: !!search
      });

      const snapshot = await query.get();

      // ✅ NUEVO: Debug logging para snapshot
      logger.logObject('firestore_snapshot', snapshot, 'after_query_execution');
      logger.logArray('snapshot.docs', snapshot.docs, 'after_query_execution');

      req.logger.database('conversations_query_executed', {
        docsCount: snapshot.docs.length,
        isEmpty: snapshot.empty,
        userEmail
      });

      // ✅ NUEVO: Validación exhaustiva del snapshot
      logger.validateArrayAccess('snapshot.docs', snapshot.docs, 'before_processing');

      // Procesar conversaciones
      const conversations = [];
      
      // ✅ NUEVO: Debug logging antes del procesamiento
      logger.logArray('conversations_before_processing', conversations, 'initial_empty_array');

      for (const doc of snapshot.docs) {
        try {
          // ✅ NUEVO: Debug logging para cada documento
          logger.logObject('doc_data', doc.data(), `processing_doc_${doc.id}`);

          const conversationData = doc.data();

          // ✅ NUEVO: Validación de datos de conversación
          logger.logObject('conversationData', conversationData, `before_processing_${doc.id}`);
          logger.validateArrayAccess('conversationData.participants', conversationData.participants, `doc_${doc.id}`);

          const conversation = new Conversation({
            id: doc.id,
            ...conversationData
          });

          // ✅ NUEVO: Debug logging después de crear la conversación
          logger.logObject('created_conversation', conversation, `after_creation_${doc.id}`);

          const conversationJSON = conversation.toJSON();

          // ✅ NUEVO: Debug logging del JSON
          logger.logObject('conversation_json', conversationJSON, `after_toJSON_${doc.id}`);
          logger.validateArrayAccess('conversationJSON.participants', conversationJSON.participants, `json_${doc.id}`);

          conversations.push(conversationJSON);

          // ✅ NUEVO: Debug logging después de push
          logger.logArray('conversations_after_push', conversations, `after_push_${doc.id}`);

          req.logger.debug('conversation_processed', {
            conversationId: doc.id,
            participantsCount: conversationJSON.participants?.length || 0,
            status: conversationJSON.status,
            lastMessageAt: conversationJSON.lastMessageAt
          });

        } catch (docError) {
          req.logger.error('error_processing_conversation_doc', {
            docId: doc.id,
            error: docError.message,
            stack: docError.stack
          });

          // ✅ NUEVO: Debug logging del error
          logger.logObject('doc_processing_error', {
            docId: doc.id,
            error: docError.message,
            docData: doc.data()
          }, 'doc_processing_error');
          
          continue;
        }
      }

      // ✅ NUEVO: Validación final exhaustiva
      logger.validateArrayAccess('final_conversations', conversations, 'before_response');
      logger.logConversationData(conversations, 'final_processed_conversations');

      // Aplicar filtro de búsqueda si existe
      let filteredConversations = conversations;
      if (search && search.trim()) {
        const searchTerm = search.toLowerCase().trim();
        
        // ✅ NUEVO: Debug logging antes del filtro de búsqueda
        logger.logArray('before_search_filter', filteredConversations, 'before_search');
        logger.validateArrayAccess('filteredConversations', filteredConversations, 'before_search_filter');

        filteredConversations = conversations.filter(conv => {
          // ✅ NUEVO: Debug logging para cada conversación en el filtro
          logger.logObject('conversation_for_search', conv, `search_filter_${conv.id}`);

          try {
            const matchesContact = conv.contact?.name?.toLowerCase().includes(searchTerm) ||
                                  conv.contact?.identifier?.toLowerCase().includes(searchTerm);
            
            const matchesParticipants = conv.participants?.some(p => 
              p.toLowerCase().includes(searchTerm)
            );

            const matchesLastMessage = conv.lastMessage?.content?.toLowerCase().includes(searchTerm);

            return matchesContact || matchesParticipants || matchesLastMessage;
          } catch (filterError) {
            req.logger.error('search_filter_error', {
              conversationId: conv.id,
              error: filterError.message,
              conv
            });

            // ✅ NUEVO: Debug logging del error de filtro
            logger.logObject('search_filter_error', {
              conversationId: conv.id,
              error: filterError.message,
              conv
            }, 'search_filter_error');

            return false;
          }
        });

        // ✅ NUEVO: Debug logging después del filtro de búsqueda
        logger.logArray('after_search_filter', filteredConversations, 'after_search');
        logger.validateArrayAccess('filteredConversations_after_search', filteredConversations, 'after_search_filter');

        req.logger.debug('search_filter_applied', {
          searchTerm,
          originalCount: conversations.length,
          filteredCount: filteredConversations.length
        });
      }

      // ✅ NUEVO: Validación final antes de respuesta
      logger.validateArrayAccess('final_filtered_conversations', filteredConversations, 'before_final_response');

      const responseTime = Date.now() - startTime;

      req.logger.success('get_conversations_success', {
        conversationsCount: filteredConversations.length,
        userEmail,
        pageNum,
        limitNum,
        responseTime: `${responseTime}ms`,
        hasSearchFilter: !!search,
        searchTerm: search || null
      });

      // ✅ NUEVO: Debug logging de la respuesta final
      logger.logApiResponse('/conversations', filteredConversations, 'final_response');

      ResponseHandler.success(res, filteredConversations, 'Conversaciones obtenidas exitosamente', {
        page: pageNum,
        limit: limitNum,
        total: filteredConversations.length,
        hasMore: filteredConversations.length === limitNum
      });

    } catch (error) {
      req.logger.error('get_conversations_error', {
        error: error.message,
        stack: error.stack,
        userEmail: req.user?.email,
        query: req.query
      });

      // ✅ NUEVO: Debug logging del error general
      logger.logObject('general_error', {
        error: error.message,
        stack: error.stack,
        userEmail: req.user?.email,
        query: req.query
      }, 'get_conversations_error');

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
        result.conversations.map(conv => conv.toJSON()),
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
        result.map(conv => conv.toJSON()),
        `${result.length} conversaciones encontradas para: "${searchTerm}"`
      );

    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 👁️ GET /api/conversations/:conversationId
   * Obtiene una conversación específica con validación de permisos
   */
  static async getConversation(req, res, next) {
    try {
      const { conversationId } = req.params;

      const conversation = await ConversationService.getConversationById(conversationId);
      if (!conversation) {
        throw CommonErrors.CONVERSATION_NOT_FOUND(conversationId);
      }

      // 🔒 VALIDAR PERMISOS DE ACCESO
      if (req.user.role === 'viewer' && conversation.assignedTo !== req.user.email) {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver esta conversación', conversationId);
      }

      logger.info('Conversación obtenida', {
        conversationId,
        userEmail: req.user.email,
        assignedTo: conversation.assignedTo
      });

      return ResponseHandler.success(res, conversation.toJSON(), 'Conversación obtenida exitosamente');

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
      const { customerPhone, assignedTo, initialMessage, priority = 'normal', tags = [] } = req.body;

      // 🔍 VALIDAR AGENTE ASIGNADO
      let assignedAgent = null;
      if (assignedTo) {
        assignedAgent = await User.getByEmail(assignedTo);
        if (!assignedAgent) {
          throw CommonErrors.USER_NOT_AUTHORIZED('asignar conversación a', assignedTo);
        }
      }

      // 🆕 CREAR CONVERSACIÓN
      // 🔧 CORREGIDO: Usar ensureParticipantsArray para garantizar participants correcto
      const participants = ConversationService.ensureParticipantsArray(
        customerPhone,
        assignedAgent?.email || null
      );
      
      const conversationData = {
        customerPhone: customerPhone,
        assignedTo: assignedAgent?.email || null,
        assignedToName: assignedAgent?.name || null,
        priority,
        tags,
        participants: participants, // 🔧 CORREGIDO: Array completo con cliente y agente
        createdBy: req.user.email
      };

      const conversation = await ConversationService.createConversation(conversationData);

      // �� CREAR MENSAJE INICIAL SI SE PROPORCIONA
      if (initialMessage) {
        const messageData = {
          conversationId: conversation.id,
          content: initialMessage,
          senderIdentifier: req.user.email,
          recipientIdentifier: customerPhone,
          direction: 'outbound',
          type: 'text',
          status: 'sent',
          metadata: { createdWithConversation: true }
        };

        await Message.create(messageData);
      }

      // 📡 EMITIR EVENTOS WEBSOCKET
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.io.emit('conversation-created', {
          conversation: conversation.toJSON(),
          createdBy: req.user.email,
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
        createdBy: req.user.email,
        hasInitialMessage: !!initialMessage
      });

      return ResponseHandler.created(res, conversation.toJSON(), 'Conversación creada exitosamente');

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

      // 📡 EMITIR EVENTO WEBSOCKET
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.io.to(`conversation-${id}`).emit('conversation-updated', {
          conversationId: id,
          updates,
          updatedBy: req.user.email,
          timestamp: new Date().toISOString()
        });
      }

      logger.info('Conversación actualizada', {
        conversationId: id,
        updates: Object.keys(updates),
        updatedBy: req.user.email
      });

      return ResponseHandler.success(res, conversation.toJSON(), 'Conversación actualizada exitosamente');

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

      return ResponseHandler.success(res, conversation.toJSON(), `Conversación asignada a ${agent.name}`);

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

      return ResponseHandler.success(res, conversation.toJSON(), 'Conversación desasignada exitosamente');

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
      await conversation.assignTo(targetAgent.email, targetAgent.name);

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

      return ResponseHandler.success(res, conversation.toJSON(), `Conversación transferida a ${targetAgent.name}`);

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

      // 📡 EMITIR EVENTO WEBSOCKET
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.io.to(`conversation-${id}`).emit('conversation-status-changed', {
          conversationId: id,
          previousStatus,
          newStatus: status,
          reason,
          changedBy: req.user.email,
          timestamp: new Date().toISOString()
        });
      }

      logger.info('Estado de conversación cambiado', {
        conversationId: id,
        previousStatus,
        newStatus: status,
        changedBy: req.user.email
      });

      return ResponseHandler.success(res, conversation.toJSON(), `Estado cambiado a ${status}`);

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

      return ResponseHandler.success(res, conversation.toJSON(), `Prioridad cambiada a ${priority}`);

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
      const markedCount = await conversation.markAllAsRead(req.user.email);

      // 📡 EMITIR EVENTO WEBSOCKET
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.io.to(`conversation-${conversationId}`).emit('conversation-marked-read', {
        conversationId,
          readBy: req.user.email,
          markedCount,
          timestamp: new Date().toISOString()
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

      // 📡 EMITIR EVENTO WEBSOCKET INMEDIATAMENTE
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.io.to(`conversation-${id}`).emit('user-typing', {
          conversationId: id,
          email: req.user.email,
          displayName: req.user.name,
          isTyping,
          timestamp: new Date().toISOString()
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
}

module.exports = ConversationController;
