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

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
const logger = require('../utils/logger');
const { validateAndNormalizePhone } = require('../utils/phoneValidation');
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
    try {
      const {
        limit = 20,
        cursor = null,
        assignedTo = 'me', // Por defecto: mis conversaciones
        status = null,
        priority = null,
        tags = null,
        search = null,
        sortBy = 'lastMessageAt',
        sortOrder = 'desc'
      } = req.query;

      // 🔍 LÓGICA DE FILTRADO INTELIGENTE
      let finalAssignedToFilter = assignedTo;
      
      if (assignedTo === 'me') {
        finalAssignedToFilter = req.user.email;
      } else if (assignedTo === 'unassigned') {
        finalAssignedToFilter = null;
      } else if (assignedTo && assignedTo !== 'all') {
        // Verificar que el agente exista
        const agent = await User.getByEmail(assignedTo);
        if (!agent) {
          throw CommonErrors.USER_NOT_AUTHORIZED('ver conversaciones de', assignedTo);
        }
      }

      // 🔒 CONTROL DE PERMISOS POR ROL
      if (req.user.role === 'viewer' && assignedTo !== 'me') {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver conversaciones de otros agentes', 'conversations');
      }

      // 🔍 OPCIONES DE BÚSQUEDA
      const searchOptions = {
        limit: Math.min(parseInt(limit), 100),
        cursor,
        assignedTo: finalAssignedToFilter,
        status,
        priority,
        tags: tags ? (Array.isArray(tags) ? tags : tags.split(',')) : null,
        search,
        sortBy,
        sortOrder
      };

      logger.info('Listando conversaciones', {
        userEmail: req.user.email,
        userRole: req.user.role,
        filters: searchOptions,
        ip: req.ip
      });

      // 📊 EJECUTAR BÚSQUEDA
      // 🔧 CORREGIDO: Pasar participantEmail para filtrar por participants
      const result = await Conversation.list({
        ...searchOptions,
        participantEmail: req.user.email // 🔧 CORREGIDO: Pasar el email del usuario logeado como participantEmail
      });
      
      // 🎯 AUTO-ASIGNACIÓN INTELIGENTE (solo para agentes sin conversaciones)
      if (result.conversations.length === 0 && assignedTo === 'me' && req.user.role === 'agent') {
        logger.info('Sin conversaciones asignadas, buscando auto-asignación', {
          userEmail: req.user.email
        });

        const unassignedResult = await Conversation.list({
          ...searchOptions,
          assignedTo: null,
          participantEmail: null, // 🔧 CORREGIDO: No filtrar por participantEmail para auto-asignación
          limit: 3 // Solo auto-asignar pocas
        });

        if (unassignedResult.conversations.length > 0) {
          for (const conv of unassignedResult.conversations) {
            try {
              await conv.assignTo(req.user.email, req.user.name);
              result.conversations.push(conv);
              
              // 📡 EMITIR EVENTO WEBSOCKET
              const socketManager = req.app.get('socketManager');
              if (socketManager) {
                socketManager.io.emit('conversation-assigned', {
                  conversationId: conv.id,
                  assignedTo: {
                    email: req.user.email,
                    name: req.user.name
                  },
                  timestamp: new Date().toISOString()
                });
              }
            } catch (assignError) {
              logger.error('Error en auto-asignación', {
                conversationId: conv.id,
                userEmail: req.user.email,
                error: assignError.message
              });
            }
          }
        }
      }

      // 📤 RESPUESTA ESTÁNDAR CON PAGINACIÓN
      return ResponseHandler.successPaginated(
        res,
        result.conversations.map(conv => conv.toJSON()),
        result.pagination,
        `${result.conversations.length} conversaciones encontradas`,
        200
      );

    } catch (error) {
      logger.error('Error listando conversaciones', {
        error: error.message,
        stack: error.stack,
        userEmail: req.user?.email,
        query: req.query
      });
      return ResponseHandler.error(res, error);
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

      const result = await Conversation.list({
        limit: Math.min(parseInt(limit), 100),
        cursor,
        assignedTo: null,
        participantEmail: null, // 🔧 CORREGIDO: No filtrar por participantEmail para conversaciones sin asignar
        status: 'open', // Solo abiertas sin asignar
        sortBy: 'createdAt',
        sortOrder: 'asc' // Más antiguas primero
      });

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

      const stats = await Conversation.getStats(targetAgent, period);

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

      const result = await Conversation.search(searchTerm, searchOptions);

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

      const conversation = await Conversation.getById(conversationId);
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

      // 🔍 VALIDAR TELÉFONO DEL CLIENTE
      const phoneValidation = validateAndNormalizePhone(customerPhone);
      if (!phoneValidation.isValid) {
        throw new ApiError(
          'INVALID_CUSTOMER_PHONE',
          `Número de teléfono inválido: ${phoneValidation.error}`,
          'Proporciona un número de teléfono válido en formato internacional (+1234567890)',
          400,
          { customerPhone, error: phoneValidation.error }
        );
      }

      // 🔍 VALIDAR AGENTE ASIGNADO
      let assignedAgent = null;
      if (assignedTo) {
        assignedAgent = await User.getByEmail(assignedTo);
        if (!assignedAgent) {
          throw CommonErrors.USER_NOT_AUTHORIZED('asignar conversación a', assignedTo);
        }
      }

      // 🆕 CREAR CONVERSACIÓN
      const conversationData = {
        customerPhone: phoneValidation.normalized,
        assignedTo: assignedAgent?.email || null,
        assignedToName: assignedAgent?.name || null,
        priority,
        tags,
        participants: [phoneValidation.normalized],
        createdBy: req.user.email
      };

      if (assignedAgent) {
        conversationData.participants.push(assignedAgent.email);
      }

      const conversation = await Conversation.create(conversationData);

      // 💬 CREAR MENSAJE INICIAL SI SE PROPORCIONA
      if (initialMessage) {
        const messageData = {
          conversationId: conversation.id,
          content: initialMessage,
          senderIdentifier: req.user.email,
          recipientIdentifier: phoneValidation.normalized,
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
        customerPhone: phoneValidation.normalized,
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

      const conversation = await Conversation.getById(id);
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

      const conversation = await Conversation.getById(id);
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

      const conversation = await Conversation.getById(id);
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

      const conversation = await Conversation.getById(id);
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

      const conversation = await Conversation.getById(id);
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

      const conversation = await Conversation.getById(id);
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
   * ✅ PUT /api/conversations/:conversationId/read-all
   * Marca toda la conversación como leída por el usuario actual
   */
  static async markConversationAsRead(req, res, next) {
    try {
      const { conversationId } = req.params;

      const conversation = await Conversation.getById(conversationId);
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
