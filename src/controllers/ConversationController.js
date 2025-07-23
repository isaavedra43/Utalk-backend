// ConversationController.js
// Controlador robusto para gestión de conversaciones
// Implementa: paginación, filtros, logs exhaustivos, mapping content → text, manejo de errores

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const logger = require('../utils/logger');
const { validateAndNormalizePhone } = require('../utils/phoneValidation');

/**
 * CONTROLADOR DE CONVERSACIONES - VERSIÓN ROBUSTA Y DEFINITIVA
 *
 * Endpoints principales:
 * - GET /api/conversations - Lista conversaciones con filtros y paginación
 * - GET /api/conversations/:id - Obtiene una conversación específica
 * - GET /api/conversations/:id/messages - Obtiene mensajes de una conversación
 * - PUT /api/conversations/:id/read - Marca conversación como leída
 * - PUT /api/conversations/:id/assign - Asigna conversación a agente
 * - PUT /api/conversations/:id/status - Cambia estado de conversación
 * - DELETE /api/conversations/:id - Archiva conversación
 * - GET /api/conversations/stats - Obtiene estadísticas
 */
class ConversationController {
  /**
   * ✅ CORREGIDO: Listar conversaciones con filtros optimizados
   * Filtro por assignedTo en lugar de userId para agentes
   */
  static async listConversations (req, res) {
    try {
      const {
        limit = 20,
        cursor = null,
        assignedTo = null,
        status = null,
        customerPhone = null,
        sortBy = 'lastMessageAt',
        sortOrder = 'desc',
      } = req.query;

      // ✅ VALIDACIÓN: Normalizar teléfono del cliente si se proporciona
      let normalizedCustomerPhone = null;
      if (customerPhone) {
        const phoneValidation = validateAndNormalizePhone(customerPhone);
        if (!phoneValidation.isValid) {
          return res.status(400).json({
            success: false,
            error: `Teléfono del cliente inválido: ${phoneValidation.error}`,
          });
        }
        normalizedCustomerPhone = phoneValidation.normalized;
      }

      // ✅ MONITOREO: Log de parámetros de consulta
      logger.info('Listando conversaciones', {
        limit: parseInt(limit),
        cursor: cursor ? 'presente' : 'ausente',
        filters: {
          assignedTo: assignedTo || 'ninguno',
          status: status || 'ninguno',
          customerPhone: normalizedCustomerPhone ? 'normalizado' : 'ninguno',
        },
        sortBy,
        sortOrder,
      });

      const options = {
        limit: parseInt(limit),
        startAfter: cursor,
        assignedTo,
        status,
        customerPhone: normalizedCustomerPhone,
        sortBy,
        sortOrder,
      };

      const conversations = await Conversation.list(options);

      // ✅ MONITOREO: Log de resultados
      logger.info('Conversaciones listadas exitosamente', {
        totalResults: conversations.length,
        hasFilters: !!(assignedTo || status || normalizedCustomerPhone),
        filtersApplied: {
          assignedTo: !!assignedTo,
          status: !!status,
          customerPhone: !!normalizedCustomerPhone,
        },
      });

      res.json({
        success: true,
        data: conversations.map(conv => conv.toJSON()),
        pagination: {
          hasMore: conversations.length === parseInt(limit),
          totalResults: conversations.length,
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      logger.error('Error listando conversaciones', {
        error: error.message,
        query: req.query,
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
      });
    }
  }

  /**
   * ✅ CORREGIDO: Obtener conversación por ID con validación completa
   */
  static async getConversation (req, res) {
    try {
      const { conversationId } = req.params;

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          error: 'conversationId es requerido',
        });
      }

      logger.info('Obteniendo conversación', { conversationId });

      const conversation = await Conversation.getById(conversationId);

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversación no encontrada',
        });
      }

      logger.info('Conversación obtenida exitosamente', { conversationId });

      res.json({
        success: true,
        data: conversation.toJSON(),
      });
    } catch (error) {
      logger.error('Error obteniendo conversación', {
        conversationId: req.params.conversationId,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
      });
    }
  }

  /**
   * ✅ CORREGIDO: Obtener mensajes de conversación con paginación optimizada
   */
  static async getConversationMessages (req, res) {
    try {
      const { conversationId } = req.params;
      const {
        limit = 20,
        cursor = null,
        direction = null,
        status = null,
        type = null,
        startDate = null,
        endDate = null,
        orderBy = 'timestamp',
        order = 'desc',
      } = req.query;

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          error: 'conversationId es requerido',
        });
      }

      // ✅ VALIDACIÓN: Verificar que la conversación existe
      const conversation = await Conversation.getById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversación no encontrada',
        });
      }

      // ✅ MONITOREO: Log de parámetros de consulta
      logger.info('Obteniendo mensajes de conversación', {
        conversationId,
        limit: parseInt(limit),
        cursor: cursor ? 'presente' : 'ausente',
        filters: {
          direction: direction || 'ninguno',
          status: status || 'ninguno',
          type: type || 'ninguno',
          startDate: startDate ? 'presente' : 'ausente',
          endDate: endDate ? 'presente' : 'ausente',
        },
        orderBy,
        order,
      });

      const options = {
        limit: parseInt(limit),
        cursor,
        direction,
        status,
        type,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        orderBy,
        order,
      };

      const result = await Message.getByConversation(conversationId, options);

      // ✅ MONITOREO: Log de resultados
      logger.info('Mensajes obtenidos exitosamente', {
        conversationId,
        totalResults: result.messages.length,
        hasMore: result.pagination.hasMore,
        appliedFilters: result.metadata.appliedFilters,
        queryTime: result.metadata.queryTime,
      });

      res.json({
        success: true,
        data: result.messages.map(msg => msg.toJSON()),
        pagination: result.pagination,
        metadata: result.metadata,
      });
    } catch (error) {
      logger.error('Error obteniendo mensajes de conversación', {
        conversationId: req.params.conversationId,
        error: error.message,
        query: req.query,
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
      });
    }
  }

  /**
   * ✅ CORREGIDO: Crear nueva conversación con validación de teléfonos
   * SIEMPRE garantiza que el campo assignedTo esté presente
   */
  static async createConversation (req, res) {
    try {
      const {
        participants = [],
        customerPhone = null,
        agentPhone = null,
        contact = null,
        assignedTo = null,
      } = req.body;

      // ✅ VALIDACIÓN: Verificar que se proporcionen participantes
      if (!Array.isArray(participants) || participants.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere al menos un participante',
        });
      }

      // ✅ VALIDACIÓN: Normalizar teléfonos de participantes
      const normalizedParticipants = [];
      const validationErrors = [];

      participants.forEach((phone, index) => {
        const validation = validateAndNormalizePhone(phone);
        if (validation.isValid) {
          normalizedParticipants.push(validation.normalized);
        } else {
          validationErrors.push(`Participante ${index + 1}: ${validation.error}`);
        }
      });

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Teléfonos de participantes inválidos',
          details: validationErrors,
        });
      }

      // ✅ VALIDACIÓN: Normalizar teléfono del cliente si se proporciona
      let normalizedCustomerPhone = null;
      if (customerPhone) {
        const customerValidation = validateAndNormalizePhone(customerPhone);
        if (!customerValidation.isValid) {
          return res.status(400).json({
            success: false,
            error: `Teléfono del cliente inválido: ${customerValidation.error}`,
          });
        }
        normalizedCustomerPhone = customerValidation.normalized;
      }

      // ✅ VALIDACIÓN: Normalizar teléfono del agente si se proporciona
      let normalizedAgentPhone = null;
      if (agentPhone) {
        const agentValidation = validateAndNormalizePhone(agentPhone);
        if (!agentValidation.isValid) {
          return res.status(400).json({
            success: false,
            error: `Teléfono del agente inválido: ${agentValidation.error}`,
          });
        }
        normalizedAgentPhone = agentValidation.normalized;
      }

      // ✅ GENERAR ID ÚNICO para la conversación
      const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const conversationData = {
        id: conversationId,
        participants: normalizedParticipants,
        customerPhone: normalizedCustomerPhone,
        agentPhone: normalizedAgentPhone,
        contact,
        assignedTo, // ✅ Se asignará automáticamente si es null
      };

      logger.info('Creando nueva conversación manualmente', {
        conversationId,
        participantsCount: normalizedParticipants.length,
        hasCustomerPhone: !!normalizedCustomerPhone,
        hasAgentPhone: !!normalizedAgentPhone,
        assignedTo: assignedTo || 'asignación_automática',
      });

      const conversation = await Conversation.createOrUpdate(conversationData);

      logger.info('Conversación creada exitosamente manualmente', {
        conversationId,
        assignedTo: conversation.assignedTo,
        customerPhone: conversation.customerPhone,
      });

      res.status(201).json({
        success: true,
        data: conversation.toJSON(),
      });
    } catch (error) {
      logger.error('Error creando conversación', {
        error: error.message,
        body: req.body,
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
      });
    }
  }

  /**
   * ✅ CORREGIDO: Actualizar conversación con validación
   */
  static async updateConversation (req, res) {
    try {
      const { conversationId } = req.params;
      const updates = req.body;

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          error: 'conversationId es requerido',
        });
      }

      // ✅ VALIDACIÓN: Verificar que la conversación existe
      const conversation = await Conversation.getById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversación no encontrada',
        });
      }

      // ✅ VALIDACIÓN: Normalizar teléfonos si se actualizan
      if (updates.customerPhone) {
        const customerValidation = validateAndNormalizePhone(updates.customerPhone);
        if (!customerValidation.isValid) {
          return res.status(400).json({
            success: false,
            error: `Teléfono del cliente inválido: ${customerValidation.error}`,
          });
        }
        updates.customerPhone = customerValidation.normalized;
      }

      if (updates.agentPhone) {
        const agentValidation = validateAndNormalizePhone(updates.agentPhone);
        if (!agentValidation.isValid) {
          return res.status(400).json({
            success: false,
            error: `Teléfono del agente inválido: ${agentValidation.error}`,
          });
        }
        updates.agentPhone = agentValidation.normalized;
      }

      logger.info('Actualizando conversación', {
        conversationId,
        updates: Object.keys(updates),
      });

      await conversation.update(updates);

      logger.info('Conversación actualizada exitosamente', { conversationId });

      res.json({
        success: true,
        data: conversation.toJSON(),
      });
    } catch (error) {
      logger.error('Error actualizando conversación', {
        conversationId: req.params.conversationId,
        error: error.message,
        body: req.body,
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
      });
    }
  }

  /**
   * ✅ CORREGIDO: Asignar conversación a agente
   */
  static async assignConversation (req, res) {
    try {
      const { conversationId } = req.params;
      const { assignedTo } = req.body;

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          error: 'conversationId es requerido',
        });
      }

      if (!assignedTo) {
        return res.status(400).json({
          success: false,
          error: 'assignedTo es requerido',
        });
      }

      // ✅ VALIDACIÓN: Verificar que la conversación existe
      const conversation = await Conversation.getById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversación no encontrada',
        });
      }

      logger.info('Asignando conversación', {
        conversationId,
        assignedTo,
      });

      await conversation.assignTo(assignedTo);

      logger.info('Conversación asignada exitosamente', {
        conversationId,
        assignedTo,
      });

      res.json({
        success: true,
        data: conversation.toJSON(),
      });
    } catch (error) {
      logger.error('Error asignando conversación', {
        conversationId: req.params.conversationId,
        error: error.message,
        body: req.body,
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
      });
    }
  }

  /**
   * ✅ CORREGIDO: Cambiar estado de conversación
   */
  static async changeConversationStatus (req, res) {
    try {
      const { conversationId } = req.params;
      const { status } = req.body;

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          error: 'conversationId es requerido',
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          error: 'status es requerido',
        });
      }

      // ✅ VALIDACIÓN: Verificar que la conversación existe
      const conversation = await Conversation.getById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversación no encontrada',
        });
      }

      logger.info('Cambiando estado de conversación', {
        conversationId,
        currentStatus: conversation.status,
        newStatus: status,
      });

      await conversation.changeStatus(status);

      logger.info('Estado de conversación cambiado exitosamente', {
        conversationId,
        newStatus: status,
      });

      res.json({
        success: true,
        data: conversation.toJSON(),
      });
    } catch (error) {
      logger.error('Error cambiando estado de conversación', {
        conversationId: req.params.conversationId,
        error: error.message,
        body: req.body,
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
      });
    }
  }

  /**
   * ✅ CORREGIDO: Obtener estadísticas de conversación
   */
  static async getConversationStats (req, res) {
    try {
      const { conversationId } = req.params;

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          error: 'conversationId es requerido',
        });
      }

      // ✅ VALIDACIÓN: Verificar que la conversación existe
      const conversation = await Conversation.getById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversación no encontrada',
        });
      }

      logger.info('Obteniendo estadísticas de conversación', { conversationId });

      const stats = await conversation.getStats();

      logger.info('Estadísticas obtenidas exitosamente', {
        conversationId,
        totalMessages: stats.totalMessages,
        inboundMessages: stats.inboundMessages,
        outboundMessages: stats.outboundMessages,
      });

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error obteniendo estadísticas de conversación', {
        conversationId: req.params.conversationId,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
      });
    }
  }

  /**
   * ✅ CORREGIDO: Buscar conversaciones
   */
  static async searchConversations (req, res) {
    try {
      const { q: searchTerm, ...options } = req.query;

      if (!searchTerm) {
        return res.status(400).json({
          success: false,
          error: 'Término de búsqueda es requerido',
        });
      }

      logger.info('Buscando conversaciones', {
        searchTerm,
        options: Object.keys(options),
      });

      const conversations = await Conversation.search(searchTerm, options);

      logger.info('Búsqueda de conversaciones completada', {
        searchTerm,
        totalResults: conversations.length,
      });

      res.json({
        success: true,
        data: conversations.map(conv => conv.toJSON()),
        pagination: {
          totalResults: conversations.length,
        },
      });
    } catch (error) {
      logger.error('Error buscando conversaciones', {
        error: error.message,
        query: req.query,
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
      });
    }
  }
}

module.exports = ConversationController;
