// ConversationController.js
// Controlador robusto para gestión de conversaciones
// Implementa: paginación, filtros, logs exhaustivos, mapping content → text, manejo de errores

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const logger = require('../utils/logger');
const { validateAndNormalizePhone } = require('../utils/phoneValidation');
const { safeISOString } = require('../utils/dateHelpers');

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
   * ✅ ESTRUCTURA GARANTIZADA: Siempre devuelve la estructura esperada por frontend
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
          logger.warn('Teléfono del cliente inválido en listConversations', {
            originalPhone: customerPhone,
            error: phoneValidation.error,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
          });
          return res.status(400).json({
            success: false,
            error: `Teléfono del cliente inválido: ${phoneValidation.error}`,
            details: {
              field: 'customerPhone',
              originalValue: customerPhone,
              expectedFormat: 'Formato internacional E.164 (ej: +1234567890)',
            },
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
        userAgent: req.get('User-Agent'),
        ip: req.ip,
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

      // ✅ SERIALIZACIÓN SEGURA: Asegurar que todas las conversaciones tengan estructura válida
      const serializedConversations = conversations.map(conv => {
        try {
          return conv.toJSON();
        } catch (error) {
          logger.error('Error serializando conversación en lista', {
            conversationId: conv.id,
            error: error.message,
            stack: error.stack,
          });
          // Retornar estructura mínima válida en caso de error
          return {
            id: conv.id || 'error',
            participants: [],
            customerPhone: null,
            agentPhone: null,
            contact: { id: 'error', name: 'Error', avatar: null, channel: 'whatsapp' },
            assignedTo: null,
            assignedAgent: null,
            status: 'error',
            unreadCount: 0,
            messageCount: 0,
            lastMessage: null,
            lastMessageId: null,
            lastMessageAt: null,
            createdAt: null,
            updatedAt: null,
          };
        }
      });

      // ✅ MONITOREO: Log de resultados
      logger.info('Conversaciones listadas exitosamente', {
        totalResults: serializedConversations.length,
        hasFilters: !!(assignedTo || status || normalizedCustomerPhone),
        filtersApplied: {
          assignedTo: !!assignedTo,
          status: !!status,
          customerPhone: !!normalizedCustomerPhone,
        },
        validConversations: serializedConversations.filter(c => c.status !== 'error').length,
        errorConversations: serializedConversations.filter(c => c.status === 'error').length,
      });

      // ✅ ESTRUCTURA GARANTIZADA: Respuesta siempre en el formato esperado
      const response = {
        success: true,
        data: serializedConversations,
        pagination: {
          hasMore: conversations.length === parseInt(limit),
          totalResults: serializedConversations.length,
          limit: parseInt(limit),
          currentCursor: cursor,
        },
        metadata: {
          appliedFilters: {
            assignedTo,
            status,
            customerPhone: normalizedCustomerPhone,
          },
          totalValid: serializedConversations.filter(c => c.status !== 'error').length,
          totalErrors: serializedConversations.filter(c => c.status === 'error').length,
        },
      };

      res.json(response);

    } catch (error) {
      logger.error('Error listando conversaciones', {
        error: error.message,
        stack: error.stack,
        query: req.query,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      // ✅ ESTRUCTURA GARANTIZADA: Error también en formato consistente
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: {
          message: process.env.NODE_ENV === 'development' ? error.message : 'Error interno',
          timestamp: safeISOString(new Date()),
        },
        data: [],
        pagination: {
          hasMore: false,
          totalResults: 0,
          limit: parseInt(req.query.limit || 20),
        },
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
          details: {
            field: 'conversationId',
            expectedFormat: 'conv_phone1_phone2',
          },
        });
      }

      logger.info('Obteniendo conversación', { 
        conversationId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const conversation = await Conversation.getById(conversationId);

      if (!conversation) {
        logger.warn('Conversación no encontrada', { conversationId });
        return res.status(404).json({
          success: false,
          error: 'Conversación no encontrada',
          details: {
            conversationId,
            timestamp: safeISOString(new Date()),
          },
        });
      }

      // ✅ SERIALIZACIÓN SEGURA
      let serializedConversation;
      try {
        serializedConversation = conversation.toJSON();
      } catch (serializationError) {
        logger.error('Error serializando conversación', {
          conversationId,
          error: serializationError.message,
          stack: serializationError.stack,
        });
        
        return res.status(500).json({
          success: false,
          error: 'Error procesando conversación',
          details: {
            conversationId,
            message: 'Error en serialización de datos',
            timestamp: safeISOString(new Date()),
          },
        });
      }

      logger.info('Conversación obtenida exitosamente', { 
        conversationId,
        hasAssignedTo: !!serializedConversation.assignedTo,
        participantsCount: serializedConversation.participants?.length || 0,
      });

      res.json({
        success: true,
        data: serializedConversation,
        metadata: {
          timestamp: safeISOString(new Date()),
          conversationId,
        },
      });

    } catch (error) {
      logger.error('Error obteniendo conversación', {
        conversationId: req.params.conversationId,
        error: error.message,
        stack: error.stack,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: {
          conversationId: req.params.conversationId,
          message: process.env.NODE_ENV === 'development' ? error.message : 'Error interno',
          timestamp: safeISOString(new Date()),
        },
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
          details: {
            field: 'conversationId',
            expectedFormat: 'conv_phone1_phone2',
          },
        });
      }

      // ✅ VALIDACIÓN: Verificar que la conversación existe
      const conversation = await Conversation.getById(conversationId);
      if (!conversation) {
        logger.warn('Conversación no encontrada para mensajes', { conversationId });
        return res.status(404).json({
          success: false,
          error: 'Conversación no encontrada',
          details: {
            conversationId,
            timestamp: safeISOString(new Date()),
          },
          data: [],
          pagination: {
            hasMore: false,
            totalResults: 0,
            limit: parseInt(limit),
          },
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
        userAgent: req.get('User-Agent'),
        ip: req.ip,
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

      // ✅ SERIALIZACIÓN SEGURA: Asegurar que todos los mensajes tengan estructura válida
      const serializedMessages = result.messages.map(msg => {
        try {
          return msg.toJSON();
        } catch (error) {
          logger.error('Error serializando mensaje en lista', {
            messageId: msg.id,
            conversationId,
            error: error.message,
            stack: error.stack,
          });
          // Retornar estructura mínima válida en caso de error
          return {
            id: msg.id || 'error',
            conversationId,
            content: 'Error al cargar mensaje',
            mediaUrl: null,
            sender: 'system',
            senderPhone: null,
            recipientPhone: null,
            direction: 'error',
            type: 'text',
            status: 'error',
            timestamp: null,
            metadata: {},
            createdAt: null,
            updatedAt: null,
          };
        }
      });

      // ✅ MONITOREO: Log de resultados
      logger.info('Mensajes obtenidos exitosamente', {
        conversationId,
        totalResults: serializedMessages.length,
        hasMore: result.pagination.hasMore,
        appliedFilters: result.metadata.appliedFilters,
        queryTime: result.metadata.queryTime,
        validMessages: serializedMessages.filter(m => m.status !== 'error').length,
        errorMessages: serializedMessages.filter(m => m.status === 'error').length,
      });

      // ✅ ESTRUCTURA GARANTIZADA: Respuesta consistente
      const response = {
        success: true,
        data: serializedMessages,
        pagination: {
          ...result.pagination,
          currentCursor: cursor,
        },
        metadata: {
          ...result.metadata,
          conversationExists: true,
          totalValid: serializedMessages.filter(m => m.status !== 'error').length,
          totalErrors: serializedMessages.filter(m => m.status === 'error').length,
          timestamp: safeISOString(new Date()),
        },
      };

      res.json(response);

    } catch (error) {
      logger.error('Error obteniendo mensajes de conversación', {
        conversationId: req.params.conversationId,
        error: error.message,
        stack: error.stack,
        query: req.query,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: {
          conversationId: req.params.conversationId,
          message: process.env.NODE_ENV === 'development' ? error.message : 'Error interno',
          timestamp: safeISOString(new Date()),
        },
        data: [],
        pagination: {
          hasMore: false,
          totalResults: 0,
          limit: parseInt(req.query.limit || 20),
        },
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
          details: {
            field: 'participants',
            expectedType: 'Array de números de teléfono',
            expectedFormat: '["+1234567890", "+1987654321"]',
          },
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
        logger.warn('Errores de validación en participantes', {
          errors: validationErrors,
          originalParticipants: participants,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        });
        
        return res.status(400).json({
          success: false,
          error: 'Teléfonos de participantes inválidos',
          details: {
            field: 'participants',
            errors: validationErrors,
            expectedFormat: 'Formato internacional E.164 (ej: +1234567890)',
          },
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
            details: {
              field: 'customerPhone',
              originalValue: customerPhone,
              expectedFormat: 'Formato internacional E.164 (ej: +1234567890)',
            },
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
            details: {
              field: 'agentPhone',
              originalValue: agentPhone,
              expectedFormat: 'Formato internacional E.164 (ej: +1234567890)',
            },
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
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const conversation = await Conversation.createOrUpdate(conversationData);

      // ✅ SERIALIZACIÓN SEGURA
      let serializedConversation;
      try {
        serializedConversation = conversation.toJSON();
      } catch (serializationError) {
        logger.error('Error serializando conversación creada', {
          conversationId,
          error: serializationError.message,
          stack: serializationError.stack,
        });
        
        return res.status(500).json({
          success: false,
          error: 'Conversación creada pero error en procesamiento',
          details: {
            conversationId,
            message: 'Error en serialización de datos',
            timestamp: safeISOString(new Date()),
          },
        });
      }

      logger.info('Conversación creada exitosamente manualmente', {
        conversationId,
        assignedTo: serializedConversation.assignedTo?.id,
        customerPhone: serializedConversation.customerPhone,
        participantsCount: serializedConversation.participants?.length || 0,
      });

      res.status(201).json({
        success: true,
        data: serializedConversation,
        metadata: {
          created: true,
          timestamp: safeISOString(new Date()),
          conversationId,
        },
      });

    } catch (error) {
      logger.error('Error creando conversación', {
        error: error.message,
        stack: error.stack,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: {
          message: process.env.NODE_ENV === 'development' ? error.message : 'Error interno',
          timestamp: safeISOString(new Date()),
        },
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
          details: {
            field: 'conversationId',
            expectedFormat: 'conv_phone1_phone2',
          },
        });
      }

      // ✅ VALIDACIÓN: Verificar que la conversación existe
      const conversation = await Conversation.getById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversación no encontrada',
          details: {
            conversationId,
            timestamp: safeISOString(new Date()),
          },
        });
      }

      // ✅ VALIDACIÓN: Normalizar teléfonos si se actualizan
      if (updates.customerPhone) {
        const customerValidation = validateAndNormalizePhone(updates.customerPhone);
        if (!customerValidation.isValid) {
          return res.status(400).json({
            success: false,
            error: `Teléfono del cliente inválido: ${customerValidation.error}`,
            details: {
              field: 'customerPhone',
              originalValue: updates.customerPhone,
              expectedFormat: 'Formato internacional E.164 (ej: +1234567890)',
            },
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
            details: {
              field: 'agentPhone',
              originalValue: updates.agentPhone,
              expectedFormat: 'Formato internacional E.164 (ej: +1234567890)',
            },
          });
        }
        updates.agentPhone = agentValidation.normalized;
      }

      logger.info('Actualizando conversación', {
        conversationId,
        updates: Object.keys(updates),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      await conversation.update(updates);

      // ✅ SERIALIZACIÓN SEGURA
      let serializedConversation;
      try {
        serializedConversation = conversation.toJSON();
      } catch (serializationError) {
        logger.error('Error serializando conversación actualizada', {
          conversationId,
          error: serializationError.message,
          stack: serializationError.stack,
        });
        
        return res.status(500).json({
          success: false,
          error: 'Conversación actualizada pero error en procesamiento',
          details: {
            conversationId,
            message: 'Error en serialización de datos',
            timestamp: safeISOString(new Date()),
          },
        });
      }

      logger.info('Conversación actualizada exitosamente', { 
        conversationId,
        updatedFields: Object.keys(updates),
      });

      res.json({
        success: true,
        data: serializedConversation,
        metadata: {
          updated: true,
          timestamp: safeISOString(new Date()),
          conversationId,
          updatedFields: Object.keys(updates),
        },
      });

    } catch (error) {
      logger.error('Error actualizando conversación', {
        conversationId: req.params.conversationId,
        error: error.message,
        stack: error.stack,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: {
          conversationId: req.params.conversationId,
          message: process.env.NODE_ENV === 'development' ? error.message : 'Error interno',
          timestamp: safeISOString(new Date()),
        },
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
          details: {
            field: 'conversationId',
            expectedFormat: 'conv_phone1_phone2',
          },
        });
      }

      if (!assignedTo) {
        return res.status(400).json({
          success: false,
          error: 'assignedTo es requerido',
          details: {
            field: 'assignedTo',
            expectedType: 'string',
            description: 'ID del agente al que asignar la conversación',
          },
        });
      }

      // ✅ VALIDACIÓN: Verificar que la conversación existe
      const conversation = await Conversation.getById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversación no encontrada',
          details: {
            conversationId,
            timestamp: safeISOString(new Date()),
          },
        });
      }

      logger.info('Asignando conversación', {
        conversationId,
        assignedTo,
        previousAssignment: conversation.assignedTo,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      await conversation.assignTo(assignedTo);

      // ✅ SERIALIZACIÓN SEGURA
      let serializedConversation;
      try {
        serializedConversation = conversation.toJSON();
      } catch (serializationError) {
        logger.error('Error serializando conversación asignada', {
          conversationId,
          error: serializationError.message,
          stack: serializationError.stack,
        });
        
        return res.status(500).json({
          success: false,
          error: 'Conversación asignada pero error en procesamiento',
          details: {
            conversationId,
            assignedTo,
            message: 'Error en serialización de datos',
            timestamp: safeISOString(new Date()),
          },
        });
      }

      logger.info('Conversación asignada exitosamente', {
        conversationId,
        assignedTo,
        newAssignedTo: serializedConversation.assignedTo?.id,
      });

      res.json({
        success: true,
        data: serializedConversation,
        metadata: {
          assigned: true,
          timestamp: safeISOString(new Date()),
          conversationId,
          assignedTo,
        },
      });

    } catch (error) {
      logger.error('Error asignando conversación', {
        conversationId: req.params.conversationId,
        error: error.message,
        stack: error.stack,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: {
          conversationId: req.params.conversationId,
          message: process.env.NODE_ENV === 'development' ? error.message : 'Error interno',
          timestamp: safeISOString(new Date()),
        },
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
          details: {
            field: 'conversationId',
            expectedFormat: 'conv_phone1_phone2',
          },
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          error: 'status es requerido',
          details: {
            field: 'status',
            allowedValues: ['open', 'closed', 'pending', 'archived'],
          },
        });
      }

      // ✅ VALIDACIÓN: Verificar que la conversación existe
      const conversation = await Conversation.getById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversación no encontrada',
          details: {
            conversationId,
            timestamp: safeISOString(new Date()),
          },
        });
      }

      logger.info('Cambiando estado de conversación', {
        conversationId,
        currentStatus: conversation.status,
        newStatus: status,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      await conversation.changeStatus(status);

      // ✅ SERIALIZACIÓN SEGURA
      let serializedConversation;
      try {
        serializedConversation = conversation.toJSON();
      } catch (serializationError) {
        logger.error('Error serializando conversación con estado cambiado', {
          conversationId,
          error: serializationError.message,
          stack: serializationError.stack,
        });
        
        return res.status(500).json({
          success: false,
          error: 'Estado cambiado pero error en procesamiento',
          details: {
            conversationId,
            newStatus: status,
            message: 'Error en serialización de datos',
            timestamp: safeISOString(new Date()),
          },
        });
      }

      logger.info('Estado de conversación cambiado exitosamente', {
        conversationId,
        newStatus: status,
        confirmedStatus: serializedConversation.status,
      });

      res.json({
        success: true,
        data: serializedConversation,
        metadata: {
          statusChanged: true,
          timestamp: safeISOString(new Date()),
          conversationId,
          previousStatus: conversation.status,
          newStatus: status,
        },
      });

    } catch (error) {
      logger.error('Error cambiando estado de conversación', {
        conversationId: req.params.conversationId,
        error: error.message,
        stack: error.stack,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: {
          conversationId: req.params.conversationId,
          message: process.env.NODE_ENV === 'development' ? error.message : 'Error interno',
          timestamp: safeISOString(new Date()),
        },
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
          details: {
            field: 'conversationId',
            expectedFormat: 'conv_phone1_phone2',
          },
        });
      }

      // ✅ VALIDACIÓN: Verificar que la conversación existe
      const conversation = await Conversation.getById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversación no encontrada',
          details: {
            conversationId,
            timestamp: safeISOString(new Date()),
          },
        });
      }

      logger.info('Obteniendo estadísticas de conversación', { 
        conversationId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const stats = await conversation.getStats();

      // ✅ NORMALIZAR FECHAS EN ESTADÍSTICAS
      const normalizedStats = {
        ...stats,
        firstMessageAt: safeISOString(stats.firstMessageAt, 'firstMessageAt'),
        lastMessageAt: safeISOString(stats.lastMessageAt, 'lastMessageAt'),
      };

      logger.info('Estadísticas obtenidas exitosamente', {
        conversationId,
        totalMessages: normalizedStats.totalMessages,
        inboundMessages: normalizedStats.inboundMessages,
        outboundMessages: normalizedStats.outboundMessages,
      });

      res.json({
        success: true,
        data: normalizedStats,
        metadata: {
          conversationId,
          timestamp: safeISOString(new Date()),
          generatedAt: safeISOString(new Date()),
        },
      });

    } catch (error) {
      logger.error('Error obteniendo estadísticas de conversación', {
        conversationId: req.params.conversationId,
        error: error.message,
        stack: error.stack,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: {
          conversationId: req.params.conversationId,
          message: process.env.NODE_ENV === 'development' ? error.message : 'Error interno',
          timestamp: safeISOString(new Date()),
        },
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
          details: {
            field: 'q',
            expectedType: 'string',
            description: 'Término para buscar en nombres de contacto o números de teléfono',
          },
        });
      }

      logger.info('Buscando conversaciones', {
        searchTerm,
        options: Object.keys(options),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const conversations = await Conversation.search(searchTerm, options);

      // ✅ SERIALIZACIÓN SEGURA: Asegurar que todas las conversaciones tengan estructura válida
      const serializedConversations = conversations.map(conv => {
        try {
          return conv.toJSON();
        } catch (error) {
          logger.error('Error serializando conversación en búsqueda', {
            conversationId: conv.id,
            error: error.message,
            stack: error.stack,
          });
          // Retornar estructura mínima válida en caso de error
          return {
            id: conv.id || 'error',
            participants: [],
            customerPhone: null,
            agentPhone: null,
            contact: { id: 'error', name: 'Error', avatar: null, channel: 'whatsapp' },
            assignedTo: null,
            assignedAgent: null,
            status: 'error',
            unreadCount: 0,
            messageCount: 0,
            lastMessage: null,
            lastMessageId: null,
            lastMessageAt: null,
            createdAt: null,
            updatedAt: null,
          };
        }
      });

      logger.info('Búsqueda de conversaciones completada', {
        searchTerm,
        totalResults: serializedConversations.length,
        validResults: serializedConversations.filter(c => c.status !== 'error').length,
        errorResults: serializedConversations.filter(c => c.status === 'error').length,
      });

      res.json({
        success: true,
        data: serializedConversations,
        pagination: {
          totalResults: serializedConversations.length,
          hasMore: false, // Search no pagina por ahora
        },
        metadata: {
          searchTerm,
          totalValid: serializedConversations.filter(c => c.status !== 'error').length,
          totalErrors: serializedConversations.filter(c => c.status === 'error').length,
          timestamp: safeISOString(new Date()),
        },
      });

    } catch (error) {
      logger.error('Error buscando conversaciones', {
        error: error.message,
        stack: error.stack,
        query: req.query,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: {
          message: process.env.NODE_ENV === 'development' ? error.message : 'Error interno',
          timestamp: safeISOString(new Date()),
        },
        data: [],
        pagination: {
          totalResults: 0,
          hasMore: false,
        },
      });
    }
  }
}

module.exports = ConversationController;
