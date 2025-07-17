// ConversationController.js
// Controlador robusto para gestión de conversaciones
// Implementa: paginación, filtros, logs exhaustivos, mapping content → text, manejo de errores

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const logger = require('../utils/logger');
const { isValidConversationId } = require('../utils/conversation');

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
   * LISTAR CONVERSACIONES CON FILTROS Y PAGINACIÓN
   * GET /api/conversations
   */
  static async list (req, res) {
    const startTime = Date.now();
    const requestId = req.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // PASO 1: EXTRACCIÓN Y VALIDACIÓN DE PARÁMETROS
      const {
        page = 1,
        limit = 20,
        assignedTo,
        status,
        customerPhone,
        sortBy = 'lastMessageAt',
        sortOrder = 'desc',
        search,
      } = req.query;

      // Validar y sanitizar parámetros numéricos
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

      // Validar parámetros de ordenamiento
      const validSortFields = ['lastMessageAt', 'createdAt', 'updatedAt', 'messageCount'];
      const validSortOrders = ['asc', 'desc'];
      const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'lastMessageAt';
      const safeSortOrder = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';

      logger.info('[CONVERSATIONS API] Iniciando listado de conversaciones', {
        requestId,
        userId: req.user?.uid || 'anonymous',
        userRole: req.user?.role || 'unknown',
        parameters: {
          page: pageNum,
          limit: limitNum,
          assignedTo: assignedTo || null,
          status: status || null,
          customerPhone: customerPhone || null,
          sortBy: safeSortBy,
          sortOrder: safeSortOrder,
          search: search || null,
        },
        clientInfo: {
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          timestamp: new Date().toISOString(),
        },
      });

      // PASO 2: CONSTRUCCIÓN DE OPCIONES DE CONSULTA
      const userId = req.user?.uid;
      const userRole = req.user?.role;

      // Validar que el usuario esté autenticado
      if (!userId || !userRole) {
        logger.warn('[CONVERSATIONS API] Usuario no autenticado o sin rol', {
          requestId,
          userId,
          userRole,
        });
        return res.status(401).json({
          error: 'No autorizado',
          message: 'Debes estar autenticado para acceder a las conversaciones',
          conversations: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false, showing: 0 },
          filters: { assignedTo: null, status: null, customerPhone: null, search: null, sortBy: 'lastMessageAt', sortOrder: 'desc' },
          meta: { executionTime: Date.now() - startTime, timestamp: new Date().toISOString(), requestId, errorOccurred: true },
        });
      }

      const queryOptions = {
        page: pageNum,
        limit: limitNum,
        sortBy: safeSortBy,
        sortOrder: safeSortOrder,
      };

      // PASO 3: APLICACIÓN DE FILTROS CON LOGS DETALLADOS
      let hasFiltersApplied = false;

      if (assignedTo) {
        queryOptions.assignedTo = assignedTo;
        hasFiltersApplied = true;
        logger.info('[CONVERSATIONS API] Aplicando filtro por agente asignado', {
          requestId,
          assignedTo,
          appliedBy: userId,
        });
      } else if (userRole !== 'admin') {
        // Para agentes no-admin, mostrar solo sus conversaciones asignadas
        queryOptions.assignedTo = userId;
        hasFiltersApplied = true;
        logger.info('[CONVERSATIONS API] Aplicando filtro automático para agente no-admin', {
          requestId,
          userId,
          userRole,
          autoFilterApplied: true,
        });
      }

      if (status) {
        const validStatuses = ['open', 'closed', 'pending', 'assigned', 'archived'];
        if (validStatuses.includes(status)) {
          queryOptions.status = status;
          hasFiltersApplied = true;
          logger.info('[CONVERSATIONS API] Aplicando filtro por estado', {
            requestId,
            status,
            appliedBy: userId,
          });
        } else {
          logger.warn('[CONVERSATIONS API] Status inválido ignorado', {
            requestId,
            invalidStatus: status,
            validStatuses,
          });
        }
      }

      if (customerPhone) {
        const sanitizedPhone = customerPhone.replace(/[^\d+]/g, '');
        if (sanitizedPhone.length >= 10) {
          queryOptions.customerPhone = sanitizedPhone;
          hasFiltersApplied = true;
          logger.info('[CONVERSATIONS API] Aplicando filtro por teléfono del cliente', {
            requestId,
            customerPhone: sanitizedPhone,
            originalPhone: customerPhone,
          });
        } else {
          logger.warn('[CONVERSATIONS API] Número de teléfono inválido ignorado', {
            requestId,
            invalidPhone: customerPhone,
          });
        }
      }

      // Log si NO hay filtros aplicados
      if (!hasFiltersApplied && !search) {
        logger.info('[CONVERSATIONS API] SIN FILTROS APLICADOS - Obteniendo TODAS las conversaciones', {
          requestId,
          userId,
          userRole,
          note: 'Si el resultado es vacío, es porque no hay conversaciones en Firestore',
        });
      }

      // PASO 4: EJECUCIÓN DE CONSULTA CON MANEJO ROBUSTO DE ERRORES
      let conversations = [];
      let totalCount = 0;

      logger.info('[CONVERSATIONS API] Ejecutando consulta a Firestore', {
        requestId,
        queryOptions,
        hasSearch: !!search,
        searchTerm: search || null,
        hasFilters: hasFiltersApplied,
      });

      try {
        let rawResults = null;

        if (search && search.trim().length > 0) {
          const searchTerm = search.trim();
          logger.info('[CONVERSATIONS API] Realizando búsqueda con término', {
            requestId,
            searchTerm,
            searchLength: searchTerm.length,
          });

          rawResults = await Conversation.search(searchTerm, queryOptions);
        } else {
          logger.info('[CONVERSATIONS API] Listando conversaciones sin búsqueda', {
            requestId,
          });

          rawResults = await Conversation.list(queryOptions);
        }

        // Log datos RAW de Firestore
        logger.info('[CONVERSATIONS API] DATOS RAW de Firestore obtenidos:', {
          requestId,
          rawResultsType: typeof rawResults,
          rawResultsIsArray: Array.isArray(rawResults),
          rawResultsKeys: rawResults ? Object.keys(rawResults) : null,
          hasConversationsProperty: !!rawResults?.conversations,
          rawConversationsCount: rawResults?.conversations?.length || 0,
          rawTotal: rawResults?.total || 0,
        });

        // Validar respuesta del modelo
        if (rawResults && typeof rawResults === 'object') {
          conversations = Array.isArray(rawResults.conversations)
            ? rawResults.conversations
            : Array.isArray(rawResults) ? rawResults : [];
          totalCount = typeof rawResults.total === 'number' ? rawResults.total : conversations.length;

          // Log primera conversación RAW
          if (conversations.length > 0) {
            const firstRawConv = conversations[0];
            logger.info('[CONVERSATIONS API] Primera conversación RAW:', {
              requestId,
              conversationFields: Object.keys(firstRawConv),
              hasToJSON: typeof firstRawConv.toJSON === 'function',
              sampleData: {
                id: firstRawConv.id,
                customerPhone: firstRawConv.customerPhone || firstRawConv.phone,
                agentPhone: firstRawConv.agentPhone || firstRawConv.agent_phone,
                status: firstRawConv.status,
                lastMessage: firstRawConv.lastMessage || firstRawConv.last_message,
              },
            });
          }
        } else {
          conversations = [];
          totalCount = 0;
          logger.warn('[CONVERSATIONS API] Respuesta de Firestore inválida o vacía', {
            requestId,
            rawResults,
          });
        }
      } catch (queryError) {
        logger.error('[CONVERSATIONS API] Error en consulta a Firestore', {
          requestId,
          error: {
            message: typeof queryError.message === 'string' ? queryError.message : 'Error de consulta',
            code: typeof queryError.code === 'string' ? queryError.code : null,
            name: queryError.name || 'QueryError',
            stack: queryError.stack,
          },
          queryOptions,
        });
        conversations = [];
        totalCount = 0;
      }

      // Log resultados obtenidos de Firestore
      logger.info('[CONVERSATIONS API] Consulta a Firestore completada:', {
        requestId,
        conversationsFound: conversations.length,
        totalInDatabase: totalCount,
        userId,
        userRole,
        queryExecutionTime: Date.now() - startTime,
        isEmpty: conversations.length === 0,
      });

      // PASO 5: MAPPING ROBUSTO CON MANEJO DE ERRORES POR CONVERSACIÓN
      logger.info('[CONVERSATIONS API] Iniciando mapping de conversaciones...', {
        requestId,
        conversationsToMap: conversations.length,
      });

      const conversationsWithDetails = await Promise.all(
        conversations.map(async (conversation, index) => {
          try {
            // Validar que conversation sea un objeto válido
            if (!conversation || typeof conversation !== 'object') {
              logger.warn('[CONVERSATIONS API] Conversación inválida encontrada', {
                requestId,
                index,
                conversationType: typeof conversation,
              });
              return null;
            }

            // Extraer datos base de la conversación
            const conversationData = conversation.toJSON ? conversation.toJSON() : conversation;

            // Log datos antes del mapping (solo primera conversación)
            if (index === 0) {
              logger.info('[CONVERSATIONS API] Datos RAW de conversación ANTES del mapping:', {
                requestId,
                originalFields: Object.keys(conversationData),
                originalData: conversationData,
              });
            }

            // MAPPING EXPLÍCITO Y ROBUSTO DE CAMPOS REQUERIDOS
            const mappedConversation = {
              // ID - REQUERIDO
              id: conversationData.id || conversationData._id || `conv_unknown_${index}`,

              // TELÉFONOS - REQUERIDOS
              customerPhone: conversationData.customerPhone ||
                           conversationData.customer_phone ||
                           conversationData.phone ||
                           conversationData.from || '',

              agentPhone: conversationData.agentPhone ||
                        conversationData.agent_phone ||
                        conversationData.to ||
                        conversationData.businessPhone || '',

              // ÚLTIMO MENSAJE - REQUERIDO
              lastMessage: conversationData.lastMessage ||
                         conversationData.last_message ||
                         conversationData.lastMessageText ||
                         conversationData.message || '',

              // TIMESTAMP DEL ÚLTIMO MENSAJE - REQUERIDO
              lastMessageAt: conversationData.lastMessageAt ||
                           conversationData.last_message_at ||
                           conversationData.lastMessageTimestamp ||
                           conversationData.updatedAt ||
                           conversationData.updated_at ||
                           new Date().toISOString(),

              // CONTADORES - REQUERIDOS
              messageCount: parseInt(conversationData.messageCount ||
                                  conversationData.message_count ||
                                  conversationData.totalMessages || 0, 10),

              unreadCount: parseInt(conversationData.unreadCount ||
                                  conversationData.unread_count ||
                                  conversationData.unreadMessages || 0, 10),

              // ESTADO - REQUERIDO
              status: conversationData.status || 'open',

              // ASIGNACIÓN - PUEDE SER NULL
              assignedTo: conversationData.assignedTo ||
                        conversationData.assigned_to ||
                        conversationData.agentId || null,

              // TIMESTAMPS DE SISTEMA - REQUERIDOS
              createdAt: conversationData.createdAt ||
                       conversationData.created_at ||
                       conversationData.timestamp ||
                       new Date().toISOString(),

              updatedAt: conversationData.updatedAt ||
                       conversationData.updated_at ||
                       conversationData.lastModified ||
                       new Date().toISOString(),
            };

            // Log después del mapping (solo primera conversación)
            if (index === 0) {
              logger.info('[CONVERSATIONS API] Datos DESPUÉS del mapping:', {
                requestId,
                mappedFields: Object.keys(mappedConversation),
                mappedData: mappedConversation,
              });
            }

            // AGREGAR DETALLES DEL ÚLTIMO MENSAJE DE FORMA ROBUSTA
            if (conversation.lastMessageId || conversationData.lastMessageId) {
              const lastMessageId = conversation.lastMessageId || conversationData.lastMessageId;

              try {
                logger.debug('[CONVERSATIONS API] Obteniendo detalles del último mensaje', {
                  requestId,
                  conversationId: mappedConversation.id,
                  lastMessageId,
                });

                const lastMessage = await Message.getById(lastMessageId, mappedConversation.id);

                if (lastMessage && typeof lastMessage === 'object') {
                  const lastMessageData = lastMessage.toJSON ? lastMessage.toJSON() : lastMessage;

                  // MAPPING CRÍTICO: Asegurar que tanto 'text' como 'content' estén disponibles
                  const messageText = lastMessageData.content ||
                                    lastMessageData.text ||
                                    lastMessageData.message ||
                                    lastMessageData.body || '';

                  mappedConversation.lastMessageDetails = {
                    id: lastMessageData.id || lastMessageId,
                    text: messageText, // Campo requerido por frontend
                    content: messageText, // Mantener compatibilidad
                    type: lastMessageData.type || lastMessageData.messageType || 'text',
                    timestamp: lastMessageData.timestamp ||
                             lastMessageData.createdAt ||
                             lastMessageData.created_at ||
                             new Date().toISOString(),
                    from: lastMessageData.from || lastMessageData.sender || '',
                    to: lastMessageData.to || lastMessageData.recipient || '',
                    status: lastMessageData.status || lastMessageData.messageStatus || 'sent',
                  };

                  // Actualizar lastMessage en la conversación principal si estaba vacío
                  if (!mappedConversation.lastMessage) {
                    mappedConversation.lastMessage = messageText;
                  }
                } else {
                  logger.warn('[CONVERSATIONS API] Último mensaje no encontrado', {
                    requestId,
                    conversationId: mappedConversation.id,
                    lastMessageId,
                  });
                  mappedConversation.lastMessageDetails = null;
                }
              } catch (lastMessageError) {
                logger.warn('[CONVERSATIONS API] Error obteniendo detalles del último mensaje', {
                  requestId,
                  conversationId: mappedConversation.id,
                  lastMessageId,
                  error: {
                    message: typeof lastMessageError.message === 'string' ? lastMessageError.message : 'Error al obtener mensaje',
                    code: typeof lastMessageError.code === 'string' ? lastMessageError.code : null,
                    name: lastMessageError.name || 'MessageFetchError',
                  },
                });
                mappedConversation.lastMessageDetails = null;
              }
            } else {
              mappedConversation.lastMessageDetails = null;
            }

            return mappedConversation;
          } catch (mappingError) {
            logger.error('[CONVERSATIONS API] Error crítico mapeando conversación', {
              requestId,
              conversationId: conversation?.id || `unknown_${index}`,
              index,
              error: {
                message: typeof mappingError.message === 'string' ? mappingError.message : 'Error de mapeo',
                code: typeof mappingError.code === 'string' ? mappingError.code : null,
                stack: typeof mappingError.stack === 'string' ? mappingError.stack.substring(0, 300) : null,
              },
            });
            return null;
          }
        }),
      );

      // Filtrar conversaciones que fallaron en el mapeo
      const validConversations = conversationsWithDetails.filter(conv => conv !== null);

      // Log después del mapping completo
      logger.info('[CONVERSATIONS API] Mapping completado:', {
        requestId,
        originalCount: conversations.length,
        validAfterMapping: validConversations.length,
        failedMapping: conversations.length - validConversations.length,
      });

      // CÁLCULO DE PAGINACIÓN PRECISO
      const totalPages = Math.ceil(totalCount / limitNum);
      const hasMore = (pageNum * limitNum) < totalCount;

      // ADVERTENCIA SI NO HAY CONVERSACIONES
      if (validConversations.length === 0) {
        logger.warn('[CONVERSATIONS API] NO SE ENCONTRARON CONVERSACIONES', {
          requestId,
          filters: { assignedTo, status, customerPhone, search },
          user: userId,
          role: userRole,
          totalInDatabase: totalCount,
          queryOptions,
          possibleCauses: [
            'No hay conversaciones en Firestore',
            'Los filtros aplicados son muy restrictivos',
            'Error en el modelo Conversation.list()',
            'Error en el mapping de campos',
          ],
        });
      }

      // PREPARACIÓN DE RESPUESTA FINAL ESTRUCTURADA
      const responseData = {
        conversations: validConversations, // SIEMPRE array, nunca null/undefined
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages,
          hasMore,
          showing: validConversations.length,
        },
        filters: {
          assignedTo: assignedTo || null,
          status: status || null,
          customerPhone: customerPhone || null,
          search: search || null,
          sortBy: safeSortBy,
          sortOrder: safeSortOrder,
        },
        meta: {
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          requestId,
          userId,
          userRole,
        },
      };

      // Log respuesta final
      logger.info('[CONVERSATIONS API] Respuesta preparada exitosamente:', {
        requestId,
        totalConversations: validConversations.length,
        totalInDatabase: totalCount,
        hasConversations: validConversations.length > 0,
        hasMore,
        page: pageNum,
        totalPages,
        executionTime: Date.now() - startTime,
        filters: { assignedTo, status, customerPhone, search },
        firstConversationPreview: validConversations.length > 0
          ? {
            id: validConversations[0].id,
            customerPhone: validConversations[0].customerPhone,
            status: validConversations[0].status,
            lastMessage: validConversations[0].lastMessage?.substring(0, 50) + '...',
          }
          : null,
      });

      // ENVÍO DE RESPUESTA CON STATUS 200
      return res.status(200).json(responseData);
    } catch (error) {
      // MANEJO DE ERRORES EXHAUSTIVO CON LOGS DETALLADOS
      const errorDetails = {
        message: typeof error.message === 'string' ? error.message : 'Error interno desconocido',
        code: typeof error.code === 'string' ? error.code : null,
        stack: typeof error.stack === 'string' ? error.stack.substring(0, 500) : null,
        name: error.name || 'UnknownError',
      };

      logger.error('[CONVERSATIONS API] Error crítico en listado de conversaciones', {
        requestId,
        error: errorDetails,
        user: req.user?.uid,
        role: req.user?.role,
        parameters: req.query,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      // RESPUESTA DE ERROR CONSISTENTE - SIEMPRE LA MISMA ESTRUCTURA
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Ha ocurrido un error al obtener las conversaciones',
        conversations: [], // SIEMPRE array vacío en caso de error
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasMore: false,
          showing: 0,
        },
        filters: {
          assignedTo: null,
          status: null,
          customerPhone: null,
          search: null,
          sortBy: 'lastMessageAt',
          sortOrder: 'desc',
        },
        meta: {
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          requestId,
          errorOccurred: true,
        },
      });
    }
  }

  /**
   * OBTENER UNA CONVERSACIÓN ESPECÍFICA
   * GET /api/conversations/:id
   */
  static async getById (req, res, next) {
    const startTime = Date.now();
    const requestId = req.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const { id } = req.params;

      logger.info('[CONVERSATION DETAIL] Obteniendo conversación por ID', {
        requestId,
        conversationId: id,
        userId: req.user?.uid,
        userRole: req.user?.role,
      });

      if (!isValidConversationId(id)) {
        logger.warn('[CONVERSATION DETAIL] ID de conversación inválido', {
          requestId,
          invalidId: id,
          userId: req.user?.uid,
        });
        return res.status(400).json({
          error: 'ID de conversación inválido',
          message: 'El ID debe tener formato conv_XXXXXX_YYYYYY',
        });
      }

      const conversation = await Conversation.getById(id);

      if (!conversation) {
        logger.warn('[CONVERSATION DETAIL] Conversación no encontrada', {
          requestId,
          conversationId: id,
          userId: req.user?.uid,
        });
        return res.status(404).json({
          error: 'Conversación no encontrada',
          message: `No se encontró una conversación con ID ${id}`,
        });
      }

      // Verificar permisos
      if (req.user.role !== 'admin' &&
          conversation.assignedTo &&
          conversation.assignedTo !== req.user.uid) {
        logger.warn('[CONVERSATION DETAIL] Acceso denegado por permisos', {
          requestId,
          conversationId: id,
          userId: req.user?.uid,
          userRole: req.user?.role,
          assignedTo: conversation.assignedTo,
        });
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'No tienes permisos para ver esta conversación',
        });
      }

      const stats = await conversation.getStats().catch(statsError => {
        logger.warn('[CONVERSATION DETAIL] Error obteniendo estadísticas', {
          requestId,
          conversationId: id,
          error: statsError.message,
        });
        return null;
      });

      logger.info('[CONVERSATION DETAIL] Conversación obtenida exitosamente', {
        requestId,
        conversationId: id,
        userId: req.user.uid,
        role: req.user.role,
        executionTime: Date.now() - startTime,
      });

      res.json({
        conversation: conversation.toJSON(),
        stats,
        meta: {
          requestId,
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('[CONVERSATION DETAIL] Error obteniendo conversación', {
        requestId,
        conversationId: req.params.id,
        error: {
          message: error.message,
          stack: error.stack,
        },
      });
      next(error);
    }
  }

  /**
   * ✅ REFACTORIZADO: OBTENER MENSAJES DE UNA CONVERSACIÓN
   * Usa formato estandarizado y centraliza lógica en modelo Message
   * GET /api/conversations/:id/messages
   */
  static async getMessages (req, res, next) {
    const startTime = Date.now();
    const requestId = req.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const { id } = req.params;
      const {
        limit: rawLimit = 50,
        startAfter = null,
        orderBy = 'timestamp',
        order = 'desc',
      } = req.query;

      // ✅ CENTRALIZADO: Usar utilidad de validación estandarizada
      const { validatePaginationParams } = require('../utils/pagination');
      const { limit } = validatePaginationParams({ limit: rawLimit, startAfter });

      logger.info('[CONVERSATION MESSAGES] Obteniendo mensajes de conversación', {
        requestId,
        conversationId: id,
        userId: req.user?.uid,
        parameters: { limit, startAfter, orderBy, order },
      });

      if (!isValidConversationId(id)) {
        return res.status(400).json({
          error: 'ID de conversación inválido',
        });
      }

      const conversation = await Conversation.getById(id);
      if (!conversation) {
        return res.status(404).json({
          error: 'Conversación no encontrada',
        });
      }

      // Verificar permisos
      if (req.user.role !== 'admin' &&
          conversation.assignedTo &&
          conversation.assignedTo !== req.user.uid) {
        return res.status(403).json({
          error: 'Sin permisos',
        });
      }

      // ✅ CENTRALIZADO: Usar modelo Message con opciones estándar
      const messages = await Message.getByConversation(id, {
        limit,
        startAfter,
        orderBy,
        order,
      });

      logger.info('[CONVERSATION MESSAGES] Mensajes obtenidos exitosamente', {
        requestId,
        conversationId: id,
        userId: req.user.uid,
        messageCount: messages.length,
        executionTime: Date.now() - startTime,
      });

      // ✅ CENTRALIZADO: Usar formato estandarizado de respuesta
      const { createMessagesPaginatedResponse } = require('../utils/pagination');
      const response = createMessagesPaginatedResponse(
        messages, // Ya vienen con toJSON() aplicado desde Message.getByConversation
        limit,
        startAfter,
        {
          conversationId: id,
          requestId,
          executionTime: Date.now() - startTime,
        },
      );

      res.json(response);
    } catch (error) {
      logger.error('[CONVERSATION MESSAGES] Error obteniendo mensajes', {
        requestId,
        conversationId: req.params.id,
        userId: req.user?.uid,
        error: error.message,
        executionTime: Date.now() - startTime,
      });
      next(error);
    }
  }

  /**
   * MARCAR CONVERSACIÓN COMO LEÍDA
   * PUT /api/conversations/:id/read
   */
  static async markAsRead (req, res, next) {
    const startTime = Date.now();
    const requestId = req.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const { id } = req.params;
      const userId = req.user.uid;

      logger.info('[CONVERSATION READ] Marcando conversación como leída', {
        requestId,
        conversationId: id,
        userId,
      });

      if (!isValidConversationId(id)) {
        return res.status(400).json({
          error: 'ID de conversación inválido',
        });
      }

      const conversation = await Conversation.getById(id);
      if (!conversation) {
        return res.status(404).json({
          error: 'Conversación no encontrada',
        });
      }

      // Verificar permisos
      if (req.user.role !== 'admin' &&
          conversation.assignedTo &&
          conversation.assignedTo !== userId) {
        return res.status(403).json({
          error: 'Sin permisos',
        });
      }

      await conversation.markAsRead(userId);

      // Emitir evento Socket.IO si está disponible
      if (global.socketManager) {
        global.socketManager.emitMessageRead(id, null, userId);
      }

      logger.info('[CONVERSATION READ] Conversación marcada como leída exitosamente', {
        requestId,
        conversationId: id,
        userId,
        executionTime: Date.now() - startTime,
      });

      res.json({
        message: 'Conversación marcada como leída',
        conversationId: id,
        unreadCount: 0,
        meta: {
          requestId,
          executionTime: Date.now() - startTime,
        },
      });
    } catch (error) {
      logger.error('[CONVERSATION READ] Error marcando como leída', {
        requestId,
        conversationId: req.params.id,
        error: error.message,
      });
      next(error);
    }
  }

  /**
   * ASIGNAR CONVERSACIÓN A AGENTE
   * PUT /api/conversations/:id/assign
   */
  static async assign (req, res, next) {
    const startTime = Date.now();
    const requestId = req.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const { id } = req.params;
      const { assignedTo } = req.body;
      const assignedBy = req.user.uid;

      logger.info('[CONVERSATION ASSIGN] Asignando conversación', {
        requestId,
        conversationId: id,
        assignedTo,
        assignedBy,
      });

      if (!isValidConversationId(id)) {
        return res.status(400).json({
          error: 'ID de conversación inválido',
        });
      }

      if (!assignedTo) {
        return res.status(400).json({
          error: 'Campo requerido',
          message: 'assignedTo es requerido',
        });
      }

      const conversation = await Conversation.getById(id);
      if (!conversation) {
        return res.status(404).json({
          error: 'Conversación no encontrada',
        });
      }

      await conversation.assignTo(assignedTo);

      // Emitir evento Socket.IO si está disponible
      if (global.socketManager) {
        global.socketManager.emitConversationAssigned(id, assignedTo, assignedBy);
      }

      logger.info('[CONVERSATION ASSIGN] Conversación asignada exitosamente', {
        requestId,
        conversationId: id,
        assignedTo,
        assignedBy,
        executionTime: Date.now() - startTime,
      });

      res.json({
        message: 'Conversación asignada exitosamente',
        conversationId: id,
        assignedTo,
        status: 'assigned',
        meta: {
          requestId,
          executionTime: Date.now() - startTime,
        },
      });
    } catch (error) {
      logger.error('[CONVERSATION ASSIGN] Error asignando conversación', {
        requestId,
        conversationId: req.params.id,
        error: error.message,
      });
      next(error);
    }
  }

  /**
   * CAMBIAR ESTADO DE CONVERSACIÓN
   * PUT /api/conversations/:id/status
   */
  static async changeStatus (req, res, next) {
    const startTime = Date.now();
    const requestId = req.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.uid;

      logger.info('[CONVERSATION STATUS] Cambiando estado de conversación', {
        requestId,
        conversationId: id,
        newStatus: status,
        userId,
      });

      if (!isValidConversationId(id)) {
        return res.status(400).json({
          error: 'ID de conversación inválido',
        });
      }

      if (!status) {
        return res.status(400).json({
          error: 'Campo requerido',
          message: 'status es requerido',
        });
      }

      const conversation = await Conversation.getById(id);
      if (!conversation) {
        return res.status(404).json({
          error: 'Conversación no encontrada',
        });
      }

      // Verificar permisos
      if (req.user.role !== 'admin' && conversation.assignedTo !== userId) {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'Solo puedes cambiar el estado de conversaciones asignadas a ti',
        });
      }

      const previousStatus = conversation.status;
      await conversation.changeStatus(status, userId);

      // Emitir evento Socket.IO si está disponible
      if (global.socketManager) {
        global.socketManager.emitConversationStatusChanged(id, status, userId);
      }

      logger.info('[CONVERSATION STATUS] Estado cambiado exitosamente', {
        requestId,
        conversationId: id,
        newStatus: status,
        previousStatus,
        changedBy: userId,
        executionTime: Date.now() - startTime,
      });

      res.json({
        message: 'Estado de conversación actualizado',
        conversationId: id,
        status,
        previousStatus,
        meta: {
          requestId,
          executionTime: Date.now() - startTime,
        },
      });
    } catch (error) {
      logger.error('[CONVERSATION STATUS] Error cambiando estado', {
        requestId,
        conversationId: req.params.id,
        error: error.message,
      });
      next(error);
    }
  }

  /**
   * ARCHIVAR CONVERSACIÓN
   * DELETE /api/conversations/:id
   */
  static async archive (req, res, next) {
    const startTime = Date.now();
    const requestId = req.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const { id } = req.params;
      const userId = req.user.uid;

      logger.info('[CONVERSATION ARCHIVE] Archivando conversación', {
        requestId,
        conversationId: id,
        userId,
      });

      if (!isValidConversationId(id)) {
        return res.status(400).json({
          error: 'ID de conversación inválido',
        });
      }

      const conversation = await Conversation.getById(id);
      if (!conversation) {
        return res.status(404).json({
          error: 'Conversación no encontrada',
        });
      }

      // Verificar permisos
      if (req.user.role !== 'admin' && conversation.assignedTo !== userId) {
        return res.status(403).json({
          error: 'Sin permisos',
        });
      }

      await conversation.archive();

      logger.info('[CONVERSATION ARCHIVE] Conversación archivada exitosamente', {
        requestId,
        conversationId: id,
        archivedBy: userId,
        executionTime: Date.now() - startTime,
      });

      res.json({
        message: 'Conversación archivada exitosamente',
        conversationId: id,
        status: 'archived',
        meta: {
          requestId,
          executionTime: Date.now() - startTime,
        },
      });
    } catch (error) {
      logger.error('[CONVERSATION ARCHIVE] Error archivando conversación', {
        requestId,
        conversationId: req.params.id,
        error: error.message,
      });
      next(error);
    }
  }

  /**
   * OBTENER ESTADÍSTICAS DE CONVERSACIONES
   * GET /api/conversations/stats
   */
  static async getStats (req, res, next) {
    const startTime = Date.now();
    const requestId = req.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const {
        period = '7d',
        assignedTo,
        status,
      } = req.query;

      const userId = req.user.role === 'admin' ? null : req.user.uid;

      logger.info('[CONVERSATION STATS] Obteniendo estadísticas', {
        requestId,
        userId: req.user.uid,
        userRole: req.user.role,
        parameters: { period, assignedTo, status },
      });

      const options = {};
      if (assignedTo) {
        options.assignedTo = assignedTo;
      } else if (userId && req.user.role !== 'admin') {
        options.assignedTo = userId;
      }

      if (status) options.status = status;

      const conversationsData = await Conversation.list({ ...options, limit: 1000 });
      const conversations = Array.isArray(conversationsData.conversations)
        ? conversationsData.conversations
        : Array.isArray(conversationsData) ? conversationsData : [];

      const stats = {
        total: conversations.length,
        byStatus: {},
        byAssignment: {
          assigned: conversations.filter(c => c.assignedTo).length,
          unassigned: conversations.filter(c => !c.assignedTo).length,
        },
        responseTime: {
          average: 0,
          total: 0,
        },
        unreadMessages: conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
      };

      // Agrupar por estado
      conversations.forEach(conversation => {
        const status = conversation.status || 'unknown';
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      });

      logger.info('[CONVERSATION STATS] Estadísticas obtenidas exitosamente', {
        requestId,
        userId: req.user.uid,
        role: req.user.role,
        period,
        totalConversations: conversations.length,
        executionTime: Date.now() - startTime,
      });

      res.json({
        stats,
        period,
        filters: { assignedTo, status },
        meta: {
          requestId,
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('[CONVERSATION STATS] Error obteniendo estadísticas', {
        requestId,
        error: error.message,
      });
      next(error);
    }
  }
}

module.exports = ConversationController;
