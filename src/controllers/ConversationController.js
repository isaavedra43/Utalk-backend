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
const { getConversationsRepository } = require('../repositories/ConversationsRepository');
const { firestore } = require('../config/firebase');
const logger = require('../utils/logger');
const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
const { safeDateToISOString } = require('../utils/dateHelpers');
const { redactPII } = require('../utils/redact');

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
      req.logger?.info({
        event: 'conversations_list_start',
        requestId: req.requestId,
        traceId: req.traceId,
        loggerShape: { hasInfo, hasAuth, hasDatabase },
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
      const result = await conversationsRepo.list(repoParams);

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

          let fallbackQuery = firestore.collection('conversations');
          
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
              fallbackConversations.push(conversation.toJSON());
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

      // Eliminar conversación
      await firestore.collection('conversations').doc(id).delete();

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
}

module.exports = ConversationController;
