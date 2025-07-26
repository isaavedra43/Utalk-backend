// ConversationController.js
// Controlador robusto para gestión de conversaciones
// Implementa: paginación, filtros, logs exhaustivos, mapping content → text, manejo de errores
// ✅ ACTUALIZADO: Manejo de UIDs reales y fechas como strings ISO

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const logger = require('../utils/logger');
const { validateAndNormalizePhone } = require('../utils/phoneValidation');
const { safeDateToISOString } = require('../utils/dateHelpers');
const { v4: uuidv4 } = require('uuid'); // Importar uuid
const User = require('../models/User'); // Para buscar UIDs

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
 * 
 * ✅ IMPORTANTE: assignedTo debe ser SIEMPRE un UID real del sistema de autenticación
 */
class ConversationController {
  /**
   * ✅ UID-FIRST: Listar conversaciones.
   * El filtro `assignedTo` ahora usa el UID del usuario logueado por defecto.
   */
  static async listConversations (req, res) {
    try {
      const {
        limit = 20,
        cursor = null,
        assignedTo = undefined, // Permitir `null` explícito para no asignadas
        status = null,
        customerPhone = null,
        sortBy = 'lastMessageAt',
        sortOrder = 'desc',
      } = req.query;

      let finalAssignedToFilter = assignedTo;

      if (assignedTo === undefined && req.user) {
        if (req.user.role === 'admin' || req.user.role === 'superadmin') {
          // Admins y superadmins, por defecto, ven todas las conversaciones.
          // Para ver las no asignadas, deben pasar `assignedTo=null`.
          finalAssignedToFilter = undefined; 
        } else {
          // Agentes solo ven sus conversaciones.
          finalAssignedToFilter = req.user.uid;
        }
      }

      logger.info('Listando conversaciones (UID-FIRST)', {
        limit: parseInt(limit),
        cursor: cursor ? 'presente' : 'ausente',
        filters: {
          assignedTo: finalAssignedToFilter,
          status: status || 'ninguno',
          customerPhone: customerPhone ? 'normalizado' : 'ninguno',
        },
        sortBy,
        sortOrder,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        currentUser: {
          uid: req.user ? req.user.uid : 'no_autenticado',
          role: req.user ? req.user.role : 'no_autenticado',
        },
      });

      const options = {
        limit: parseInt(limit),
        startAfter: cursor,
        assignedTo: finalAssignedToFilter,
        status,
        customerPhone,
        sortBy,
        sortOrder,
      };

      let conversations = await Conversation.list(options);
      
      // ✅ FEATURE: Si no hay conversaciones asignadas, buscar y asignar automáticamente
      if (conversations.length === 0 && finalAssignedToFilter && req.user.role !== 'admin') {
        logger.info('No se encontraron conversaciones asignadas, buscando sin asignar', {
          userUID: req.user.uid,
          userRole: req.user.role,
        });

        // Buscar conversaciones sin asignar
        const unassignedOptions = {
          ...options,
          assignedTo: null, // Buscar conversaciones sin asignar
        };
        
        const unassignedConversations = await Conversation.list(unassignedOptions);
        
        if (unassignedConversations.length > 0) {
          logger.info('Asignando conversaciones automáticamente', {
            userUID: req.user.uid,
            conversationsToAssign: unassignedConversations.length,
          });

          // Asignar automáticamente al usuario actual
          for (const conv of unassignedConversations) {
            try {
              await conv.assignTo(req.user.uid, req.user.name || req.user.email || 'Agent');
              conversations.push(conv); // Agregar a la lista de resultados
            } catch (assignError) {
              logger.error('Error asignando conversación automáticamente', {
                conversationId: conv.id,
                userUID: req.user.uid,
                error: assignError.message,
              });
            }
          }
        }
      }

      // ✅ SERIALIZACIÓN SEGURA: Asegurar que todas las conversaciones tengan estructura válida
      const serializedConversations = conversations.map(conv => {
        try {
          const serialized = conv.toJSON();
          
          // ✅ VALIDACIÓN CRÍTICA: Verificar campos obligatorios
          if (!serialized.customerPhone || !serialized.agentPhone) {
            logger.warn('Conversación con teléfonos faltantes', {
              conversationId: conv.id,
              hasCustomerPhone: !!serialized.customerPhone,
              hasAgentPhone: !!serialized.agentPhone,
            });
            return null; // Excluir conversaciones inválidas
          }

          return serialized;
        } catch (error) {
          logger.error('Error serializando conversación en lista', {
            conversationId: conv.id,
            error: error.message,
            stack: error.stack,
          });
          return null; // Excluir conversaciones que fallan serialización
        }
      }).filter(conv => conv !== null); // Remover conversaciones nulas

      // ✅ MONITOREO: Log de resultados
      logger.info('Conversaciones listadas exitosamente', {
        totalResults: serializedConversations.length,
        hasFilters: !!(finalAssignedToFilter || status || customerPhone),
        filtersApplied: {
          assignedTo: !!finalAssignedToFilter,
          status: !!status,
          customerPhone: !!customerPhone,
        },
        validConversations: serializedConversations.length,
        userRole: req.user.role,
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
            assignedTo: finalAssignedToFilter,
            status,
            customerPhone: customerPhone,
          },
          autoAssignment: {
            performed: conversations.length > 0 && finalAssignedToFilter && req.user.role !== 'admin',
            userUID: req.user.uid,
            userRole: req.user.role,
          },
          timestamp: safeDateToISOString(new Date()),
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
        userUID: req.user ? req.user.uid : 'no_autenticado',
      });

      // ✅ ESTRUCTURA GARANTIZADA: Error también en formato consistente
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: {
          message: process.env.NODE_ENV === 'development' ? error.message : 'Error interno',
          timestamp: safeDateToISOString(new Date()),
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
   * ✅ UID-FIRST: Obtener una conversación por su UUID.
   */
  static async getConversation (req, res) {
    try {
      const { conversationId } = req.params; // Ahora es un UUID

      if (!conversationId) {
        return res.status(400).json({ error: 'conversationId (UUID) es requerido' });
      }

      logger.info('Obteniendo conversación', { 
        conversationId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        currentUser: req.user ? req.user.uid : 'no_autenticado',
      });

      const conversation = await Conversation.getById(conversationId);

      if (!conversation) {
        logger.warn('Conversación no encontrada', { conversationId });
        return res.status(404).json({ error: 'Conversación no encontrada' });
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
            timestamp: safeDateToISOString(new Date()),
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
          timestamp: safeDateToISOString(new Date()),
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
          timestamp: safeDateToISOString(new Date()),
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
            timestamp: safeDateToISOString(new Date()),
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
          timestamp: safeDateToISOString(new Date()),
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
          timestamp: safeDateToISOString(new Date()),
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
   * ✅ UID-FIRST: Crear una nueva conversación.
   * Se enfoca en el `customerPhone` y opcionalmente en el `assignedTo` UID.
   */
  static async createConversation (req, res) {
    try {
      const { customerPhone, assignedTo = null } = req.body; // `assignedTo` es un UID

      if (!customerPhone) {
        return res.status(400).json({ error: 'customerPhone es requerido.' });
      }
      
      // La lógica ahora está en el modelo.
      const conversation = await Conversation.findOrCreate(customerPhone, assignedTo || req.user.uid);

      res.status(201).json({
        success: true,
        data: conversation.toJSON(),
        metadata: {
          created: true,
          timestamp: safeDateToISOString(new Date()),
          conversationId: conversation.id,
        },
      });

    } catch (error) {
      logger.error('Error creando conversación (UID-FIRST)', {
        customerPhone: req.body.customerPhone,
        assignedTo: req.body.assignedTo,
        error: error.message,
        stack: error.stack,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });
      res.status(500).json({ error: 'Error interno del servidor' });
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
            timestamp: safeDateToISOString(new Date()),
          },
        });
      }

      // ✅ VALIDACIÓN: Si se actualiza assignedTo, debe ser UID válido
      if (updates.assignedTo !== undefined) {
        if (updates.assignedTo !== null && (typeof updates.assignedTo !== 'string' || updates.assignedTo.trim() === '')) {
          return res.status(400).json({
            success: false,
            error: 'assignedTo debe ser un UID válido o null',
            details: {
              field: 'assignedTo',
              expectedType: 'string (UID del usuario) o null',
              receivedType: typeof updates.assignedTo,
              receivedValue: updates.assignedTo,
            },
          });
        }
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
        assignedToUpdate: updates.assignedTo !== undefined ? {
          value: updates.assignedTo,
          type: typeof updates.assignedTo,
        } : 'no_cambio',
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
            timestamp: safeDateToISOString(new Date()),
          },
        });
      }

      logger.info('Conversación actualizada exitosamente', { 
        conversationId,
        updatedFields: Object.keys(updates),
        finalAssignedTo: serializedConversation.assignedTo?.id,
      });

      res.json({
        success: true,
        data: serializedConversation,
        metadata: {
          updated: true,
          timestamp: safeDateToISOString(new Date()),
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
          timestamp: safeDateToISOString(new Date()),
        },
      });
    }
  }

  /**
   * ✅ UID-FIRST: Asignar una conversación a un agente por su UID.
   */
  static async assignConversation (req, res) {
    try {
      const { conversationId } = req.params; // UUID
      const { assignedTo } = req.body; // UID del agente

      if (!assignedTo) {
        return res.status(400).json({ error: 'assignedTo (UID) es requerido' });
      }

      const conversation = await Conversation.getById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversación no encontrada' });
      }
      
      // Opcional: Validar que el UID del agente exista en la colección de usuarios.
      const agent = await User.getByUid(assignedTo);
      if(!agent) {
        return res.status(404).json({ error: 'Agente no encontrado con el UID proporcionado.' });
      }

      await conversation.assignTo(agent.uid, agent.displayName || agent.email);

      res.json({
        success: true,
        data: conversation.toJSON(),
        metadata: {
          assigned: true,
          timestamp: safeDateToISOString(new Date()),
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
          timestamp: safeDateToISOString(new Date()),
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
            timestamp: safeDateToISOString(new Date()),
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
            timestamp: safeDateToISOString(new Date()),
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
          timestamp: safeDateToISOString(new Date()),
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
          timestamp: safeDateToISOString(new Date()),
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
            timestamp: safeDateToISOString(new Date()),
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
        firstMessageAt: safeDateToISOString(stats.firstMessageAt),
        lastMessageAt: safeDateToISOString(stats.lastMessageAt),
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
          timestamp: safeDateToISOString(new Date()),
          generatedAt: safeDateToISOString(new Date()),
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
          timestamp: safeDateToISOString(new Date()),
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
          timestamp: safeDateToISOString(new Date()),
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
          timestamp: safeDateToISOString(new Date()),
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
