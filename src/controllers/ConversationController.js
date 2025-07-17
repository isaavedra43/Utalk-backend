const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const logger = require('../utils/logger');
const { isValidConversationId } = require('../utils/conversation');

class ConversationController {
  /**
   * Listar todas las conversaciones con filtros y paginación
   * GET /api/conversations
   * 
   * ESTRUCTURA DE RESPUESTA:
   * {
   *   conversations:*   [object Object]*       id: string,              // ID único de la conversación
   *       customerPhone: string,    // Teléfono del cliente
   *       agentPhone: string,       // Teléfono del agente (si aplica)
   *       lastMessage: string,      // Último mensaje enviado
   *       lastMessageAt: timestamp, // Timestamp del último mensaje
   *       messageCount: number,     // Cantidad total de mensajes
   *       status: string,           // Estado de la conversación
   *       assignedTo: string,       // Usuario asignado
   *       createdAt: timestamp,     // Fecha de creación
   *       updatedAt: timestamp      // Fecha de última actualización
   *     }
   *   ],
   *   pagination: { page, limit, total, hasMore },
   *   filters: { assignedTo, status, customerPhone, search }
   * }
   */
  static async list (req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        assignedTo,
        status,
        customerPhone,
        sortBy = 'lastMessageAt',
        sortOrder = 'desc',
        search
      } = req.query;

      // ✅ LOG EXHAUSTIVO: Query recibida
      logger.info('CONVERSATIONS API] Query recibida, {    page: parseInt(page),
        limit: parseInt(limit),
        assignedTo: assignedTo || '(no filtro),    status: status || '(no filtro)',
        customerPhone: customerPhone || '(no filtro),    search: search ||(no búsqueda)',
        sortBy,
        sortOrder,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        user: req.user ? req.user.uid : null,
        role: req.user ? req.user.role : null,
      });

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const userId = req.user.role === 'admin' ? null : req.user.uid;

      let options = {
        limit: parseInt(limit),
        sortBy,
        sortOrder
      };

      // ✅ FILTROS OPCIONALES: Solo aplicar si se especifican
      if (assignedTo) {
        options.assignedTo = assignedTo;
        logger.info('CONVERSATIONS API] Aplicando filtro por agente', { assignedTo });
      } else if (userId && req.user.role !== 'admin') {
        // Para agentes no-admin, mostrar solo sus conversaciones asignadas
        options.assignedTo = userId;
        logger.info('CONVERSATIONS API] Filtro automático para agente', { userId });
      }

      if (status) {
        options.status = status;
        logger.info('CONVERSATIONS API] Aplicando filtro por status', { status });
      }

      if (customerPhone) {
        options.customerPhone = customerPhone;
        logger.info('CONVERSATIONS API] Aplicando filtro por teléfono, {customerPhone });
      }

      let conversations;
      
      if (search) {
        logger.info('CONVERSATIONS API] Realizando búsqueda', { search });
        conversations = await Conversation.search(search, options);
      } else {
        logger.info('CONVERSATIONS API] Listando conversaciones sin búsqueda');
        conversations = await Conversation.list(options);
      }

      // ✅ LOG DE RESULTADOS
      logger.info('CONVERSATIONS API] Conversaciones obtenidas, {
        count: conversations.length,
        userId: req.user.uid,
        role: req.user.role,
        filters: { assignedTo, status, customerPhone, search }
      });

      // ✅ Obtener estadísticas adicionales por conversación
      const conversationsWithStats = await Promise.all(
        conversations.map(async (conversation) => {
          const conversationData = conversation.toJSON();
          
          // ✅ Agregar información del último mensaje si existe
          if (conversation.lastMessageId) {
            try {
              const lastMessage = await Message.getById(conversation.lastMessageId);
              if (lastMessage) {
                const lastMessageJson = lastMessage.toJSON();
                // ✅ MAPPING: content → text para compatibilidad con frontend
                if (lastMessageJson.content && !lastMessageJson.text) {
                  lastMessageJson.text = lastMessageJson.content;
                }
                conversationData.lastMessageDetails = lastMessageJson;
              } else {
                conversationData.lastMessageDetails = null;
              }
            } catch (error) {
              logger.warn('CONVERSATIONS API] Error obteniendo último mensaje', { 
                conversationId: conversation.id, 
                error: typeof error.message === 'string' ? error.message : '(no message)',              code: typeof error.code === 'string' ? error.code : '(no code)',
              });
              conversationData.lastMessageDetails = null;
            }
          }

          return conversationData;
        })
      );

      // ✅ ADVERTENCIA SI NO HAY CONVERSACIONES
      if (conversationsWithStats.length === 0) {
        logger.warn('CONVERSATIONS API] No se encontraron conversaciones', {
          filters: { assignedTo, status, customerPhone, search },
          user: req.user ? req.user.uid : null,
          role: req.user.role : null,
        });
      }

      // ✅ LOG DE RESPUESTA PREPARADA
      logger.info('CONVERSATIONS API] Respuesta preparada, {      totalConversations: conversationsWithStats.length,
        hasConversations: conversationsWithStats.length > 0,
        filters: { assignedTo, status, customerPhone, search }
      });

      // ✅ RESPUESTA SIEMPRE ES UN ARRAY
      res.json({
        conversations: conversationsWithStats, // SIEMPRE array, nunca null/undefined
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: conversationsWithStats.length,
          hasMore: conversationsWithStats.length === parseInt(limit)
        },
        filters: { assignedTo, status, customerPhone, search }
      });

    } catch (error) {
      logger.error('CONVERSATIONS API] Error crítico, {
        error: typeof error.message === 'string' ? error.message : '(no message)',
        code: typeof error.code === 'string' ? error.code : '(no code)',
        stack: typeof error.stack === 'string' ? error.stack : '(no stack)',
        user: req.user ? req.user.uid : null,
      });
      
      // ✅ RESPUESTA DE ERROR PERO SIEMPRE ARRAY
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Ha ocurrido un error al obtener las conversaciones',
        conversations: [], // SIEMPRE array vacío en caso de error
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          hasMore: false
        }
      });
    }
  }

  /**
   * Obtener una conversación específica
   * GET /api/conversations/:id
   */
  static async getById (req, res, next) {
    try {
      const { id } = req.params;

      if (!isValidConversationId(id)) {
        return res.status(400).json({
          error: 'ID de conversación inválido',
          message: 'El ID debe tener formato conv_XXXXXX_YYYYYY'
        });
      }

      const conversation = await Conversation.getById(id);
      
      if (!conversation) {
        return res.status(404).json({
          error: 'Conversación no encontrada',
          message: `No se encontró una conversación con ID ${id}`
        });
      }

      // Verificar permisos (agentes solo ven sus conversaciones asignadas)
      if (req.user.role !== 'admin' && 
          conversation.assignedTo && 
          conversation.assignedTo !== req.user.uid) {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'No tienes permisos para ver esta conversación'
        });
      }

      // Obtener estadísticas
      const stats = await conversation.getStats();

      logger.info('Conversación obtenida', {
        conversationId: id,
        userId: req.user.uid,
        role: req.user.role
      });

      res.json({
        conversation: conversation.toJSON(),
        stats
      });
    } catch (error) {
      logger.error('Error al obtener conversación:', error);
      next(error);
    }
  }

  /**
   * Obtener mensajes de una conversación con paginación
   * GET /api/conversations/:id/messages
   */
  static async getMessages (req, res, next) {
    try {
      const { id } = req.params;
      const { 
        limit = 50, 
        startAfter = null,
        orderBy = 'timestamp',
        order = 'desc'
      } = req.query;

      if (!isValidConversationId(id)) {
        return res.status(400).json({
          error: 'ID de conversación inválido'
        });
      }

      // Verificar que la conversación existe
      const conversation = await Conversation.getById(id);
      if (!conversation) {
        return res.status(404).json({
          error: 'Conversación no encontrada'
        });
      }

      // Verificar permisos
      if (req.user.role !== 'admin' && 
          conversation.assignedTo && 
          conversation.assignedTo !== req.user.uid) {
        return res.status(403).json({
          error: 'Sin permisos'
        });
      }

      // Obtener mensajes
      const messages = await Message.getByConversation(id, {
        limit: parseInt(limit),
        startAfter,
        orderBy,
        order
      });

      logger.info('Mensajes de conversación obtenidos', {
        conversationId: id,
        userId: req.user.uid,
        messageCount: messages.length
      });

      res.json({
        conversationId: id,
        messages: messages.map(msg => msg.toJSON()),
        pagination: {
          limit: parseInt(limit),
          hasMore: messages.length === parseInt(limit),
          lastMessageId: messages.length > 0 ? messages[messages.length - 1].id : null
        }
      });
    } catch (error) {
      logger.error('Error al obtener mensajes de conversación:', error);
      next(error);
    }
  }

  /**
   * Marcar conversación como leída
   * PUT /api/conversations/:id/read
   */
  static async markAsRead (req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;

      if (!isValidConversationId(id)) {
        return res.status(400).json({
          error: 'ID de conversación inválido'
        });
      }

      const conversation = await Conversation.getById(id);
      if (!conversation) {
        return res.status(404).json({
          error: 'Conversación no encontrada'
        });
      }

      // Verificar permisos
      if (req.user.role !== 'admin' && 
          conversation.assignedTo && 
          conversation.assignedTo !== userId) {
        return res.status(403).json({
          error: 'Sin permisos'
        });
      }

      await conversation.markAsRead(userId);

      // ✅ EMITIR EVENTO SOCKET.IO
      if (global.socketManager) {
        global.socketManager.emitMessageRead(id, null, userId);
      }

      logger.info('Conversación marcada como leída', {
        conversationId: id,
        userId
      });

      res.json({
        message: 'Conversación marcada como leída',
        conversationId: id,
        unreadCount: 0
      });
    } catch (error) {
      logger.error('Error al marcar conversación como leída:', error);
      next(error);
    }
  }

  /**
   * Asignar conversación a agente
   * PUT /api/conversations/:id/assign
   */
  static async assign (req, res, next) {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;
      const assignedBy = req.user.uid;

      if (!isValidConversationId(id)) {
        return res.status(400).json({
          error: 'ID de conversación inválido'
        });
      }

      if (!assignedTo) {
        return res.status(400).json({
          error: 'Campo requerido',
          message: 'assignedTo es requerido'
        });
      }

      const conversation = await Conversation.getById(id);
      if (!conversation) {
        return res.status(404).json({
          error: 'Conversación no encontrada'
        });
      }

      await conversation.assignTo(assignedTo);

      // ✅ EMITIR EVENTO SOCKET.IO
      if (global.socketManager) {
        global.socketManager.emitConversationAssigned(id, assignedTo, assignedBy);
      }

      logger.info('Conversación asignada', {
        conversationId: id,
        assignedTo,
        assignedBy
      });

      res.json({
        message: 'Conversación asignada exitosamente',
        conversationId: id,
        assignedTo,
        status: 'assigned'
      });
    } catch (error) {
      logger.error('Error al asignar conversación:', error);
      next(error);
    }
  }

  /**
   * Cambiar estado de conversación
   * PUT /api/conversations/:id/status
   */
  static async changeStatus (req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.uid;

      if (!isValidConversationId(id)) {
        return res.status(400).json({
          error: 'ID de conversación inválido'
        });
      }

      if (!status) {
        return res.status(400).json({
          error: 'Campo requerido',
          message: 'status es requerido'
        });
      }

      const conversation = await Conversation.getById(id);
      if (!conversation) {
        return res.status(404).json({
          error: 'Conversación no encontrada'
        });
      }

      // Verificar permisos para cambiar estado
      if (req.user.role !== 'admin' && conversation.assignedTo !== userId) {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'Solo puedes cambiar el estado de conversaciones asignadas a ti'
        });
      }

      const previousStatus = conversation.status;
      await conversation.changeStatus(status, userId);

      // ✅ EMITIR EVENTO SOCKET.IO
      if (global.socketManager) {
        global.socketManager.emitConversationStatusChanged(id, status, userId);
      }

      logger.info('Estado de conversación cambiado', {
        conversationId: id,
        newStatus: status,
        previousStatus,
        changedBy: userId
      });

      res.json({
        message: 'Estado de conversación actualizado',
        conversationId: id,
        status,
        previousStatus
      });
    } catch (error) {
      logger.error('Error al cambiar estado de conversación:', error);
      next(error);
    }
  }

  /**
   * Archivar conversación
   * DELETE /api/conversations/:id
   */
  static async archive (req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;

      if (!isValidConversationId(id)) {
        return res.status(400).json({
          error: 'ID de conversación inválido'
        });
      }

      const conversation = await Conversation.getById(id);
      if (!conversation) {
        return res.status(404).json({
          error: 'Conversación no encontrada'
        });
      }

      // Solo admins o el agente asignado pueden archivar
      if (req.user.role !== 'admin' && conversation.assignedTo !== userId) {
        return res.status(403).json({
          error: 'Sin permisos'
        });
      }

      await conversation.archive();

      logger.info('Conversación archivada', {
        conversationId: id,
        archivedBy: userId
      });

      res.json({
        message: 'Conversación archivada exitosamente',
        conversationId: id,
        status: 'archived'
      });
    } catch (error) {
      logger.error('Error al archivar conversación:', error);
      next(error);
    }
  }

  /**
   * Obtener estadísticas de conversaciones
   * GET /api/conversations/stats
   */
  static async getStats (req, res, next) {
    try {
      const { 
        period = '7d',
        assignedTo,
        status 
      } = req.query;
      
      const userId = req.user.role === 'admin' ? null : req.user.uid;

      // Filtros base
      let options = {};
      if (assignedTo) {
        options.assignedTo = assignedTo;
      } else if (userId && req.user.role !== 'admin') {
        options.assignedTo = userId;
      }

      if (status) options.status = status;

      // Obtener todas las conversaciones para estadísticas
      const conversations = await Conversation.list({ ...options, limit: 1000 });

      // Calcular estadísticas
      const stats = {
        total: conversations.length,
        byStatus: {},
        byAssignment: {
          assigned: conversations.filter(c => c.assignedTo).length,
          unassigned: conversations.filter(c => !c.assignedTo).length
        },
        responseTime: {
          average: 0,
          total: 0
        },
        unreadMessages: conversations.reduce((sum, c) => sum + c.unreadCount, 0)
      };

      // Agrupar por estado
      conversations.forEach(conversation => {
        const status = conversation.status;
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      });

      logger.info('Estadísticas de conversaciones obtenidas', {
        userId: req.user.uid,
        role: req.user.role,
        period,
        totalConversations: conversations.length
      });

      res.json({
        stats,
        period,
        filters: { assignedTo, status }
      });
    } catch (error) {
      logger.error('Error al obtener estadísticas de conversaciones:', error);
      next(error);
    }
  }
}

module.exports = ConversationController; 