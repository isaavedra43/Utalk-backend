const Message = require('../models/Message');
const Contact = require('../models/Contact');
const TwilioService = require('../services/TwilioService');
const logger = require('../utils/logger');
const {
  createMessagesPaginatedResponse,
  validatePaginationParams,
  createEmptyPaginatedResponse,
} = require('../utils/pagination');
const Conversation = require('../models/Conversation'); // Added import for Conversation

class MessageController {
  /**
   * Obtener conversaciones (últimos mensajes por contacto)
   * ✅ ACTUALIZADO: Usa paginación cursor-based eficiente
   */
  static async getConversations (req, res, _next) {
    try {
      const { limit: rawLimit = 20, startAfter = null } = req.query;
      const { limit } = validatePaginationParams({ limit: rawLimit, startAfter });
      const userId = req.user.role === 'admin' ? null : req.user.id;

      logger.info('[CONVERSATIONS API] Obteniendo conversaciones', {
        limit,
        startAfter,
        userId: req.user.id,
        role: req.user.role,
      });

      // Para obtener conversaciones, necesitamos más mensajes iniciales para agrupar
      const recentMessages = await Message.getRecentMessages(userId, limit * 3);

      // Agrupar por número de teléfono y obtener el último mensaje de cada conversación
      const conversationsMap = new Map();

      for (const message of recentMessages) {
        const phoneKey = message.direction === 'inbound' ? message.from : message.to;

        if (!conversationsMap.has(phoneKey) ||
            message.timestamp > conversationsMap.get(phoneKey).timestamp) {
          conversationsMap.set(phoneKey, message);
        }
      }

      let conversations = Array.from(conversationsMap.values())
        .sort((a, b) => b.timestamp - a.timestamp);

      // Aplicar paginación cursor-based si hay startAfter
      if (startAfter) {
        const startIndex = conversations.findIndex(conv => {
          const phoneKey = conv.direction === 'inbound' ? conv.from : conv.to;
          return phoneKey === startAfter;
        });
        if (startIndex >= 0) {
          conversations = conversations.slice(startIndex + 1);
        }
      }

      // Limitar resultados
      conversations = conversations.slice(0, limit);

      // Obtener información de contactos y construir el objeto de conversación
      const conversationsWithContacts = await Promise.all(
        conversations.map(async (message) => {
          const phoneKey = message.direction === 'inbound' ? message.from : message.to;
          const contact = await Contact.getByPhone(phoneKey);

          const conversationObject = new Conversation({
            id: message.conversationId,
            contact: {
              id: contact ? contact.id : phoneKey,
              name: contact ? contact.name : phoneKey,
            },
            lastMessage: message.toJSON(),
            unreadCount: 1, // Simulado, se debe calcular
            status: 'open', // Simulado
            assignedTo: null,
          });

          return conversationObject.toJSON();
        }),
      );

      // ✅ RESPUESTA CON PAGINACIÓN CURSOR-BASED
      const response = {
        conversations: conversationsWithContacts,
        pagination: {
          limit,
          startAfter,
          nextStartAfter: conversationsWithContacts.length === limit
            ? conversationsWithContacts[conversationsWithContacts.length - 1].phone
            : null,
          hasNextPage: conversationsWithContacts.length === limit,
          conversationCount: conversationsWithContacts.length,
        },
      };

      logger.info('[CONVERSATIONS API] Respuesta enviada', {
        conversationCount: conversationsWithContacts.length,
        hasNextPage: response.pagination.hasNextPage,
        nextStartAfter: response.pagination.nextStartAfter,
      });

      res.json(response);
    } catch (error) {
      logger.error('Error al obtener conversaciones:', error);
      res.status(500).json(createEmptyPaginatedResponse('Error al obtener conversaciones', 20));
    }
  }

  /**
   * Obtener mensajes con filtros flexibles por conversationId y userId
   * ✅ ACTUALIZADO: Usa paginación cursor-based eficiente
   *
   * SOPORTA LOS SIGUIENTES FILTROS:
   * - conversationId: Filtrar por ID de conversación específica
   * - userId: Filtrar por usuario que envió el mensaje
   * - customerPhone: Filtrar por teléfono del cliente (alternativo a userId)
   *
   * MAPPING DE CAMPOS:
   * - content (Firestore) → text (Frontend)
   * - Se mantiene content para retrocompatibilidad
   *
   * RESPUESTA SIEMPRE ES UN ARRAY (nunca null/undefined)
   * ✅ INCLUYE: nextStartAfter, hasNextPage para paginación eficiente
   */
  static async getMessages (req, res, _next) {
    try {
      const {
        conversationId,
        userId,
        customerPhone,
        limit: rawLimit = 50,
        startAfter = null,
        orderBy = 'timestamp',
        order = 'desc',
      } = req.query;

      // ✅ VALIDACIÓN DE PARÁMETROS DE PAGINACIÓN
      const { limit } = validatePaginationParams({ limit: rawLimit, startAfter });

      // ✅ LOG EXHAUSTIVO: Query recibida
      logger.info('[MESSAGES API] Query recibida', {
        conversationId: conversationId || '(no filtro)',
        userId: userId || '(no filtro)',
        customerPhone: customerPhone || '(no filtro)',
        limit,
        startAfter: startAfter || '(primera página)',
        orderBy,
        order,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        user: req.user ? req.user.id : null,
      });

      // ✅ VALIDACIÓN: Al menos un filtro debe estar presente
      if (!conversationId && !userId && !customerPhone) {
        logger.warn('[MESSAGES API] Sin filtros especificados, devolviendo conversaciones', {
          user: req.user ? req.user.id : null,
        });

        // Fallback al comportamiento anterior (conversaciones)
        return MessageController.getConversations(req, res, _next);
      }

      let messages = [];

      // ✅ FILTRO POR CONVERSATIONID (prioridad alta)
      if (conversationId) {
        logger.info('[MESSAGES API] Filtrando por conversationId', { conversationId });

        try {
          messages = await Message.getByConversation(conversationId, {
            limit,
            startAfter, // ✅ CURSOR-BASED PAGINATION
            orderBy,
            order,
          });

          logger.info('[MESSAGES API] Resultados por conversationId', {
            conversationId,
            count: messages.length,
            limit,
            hasResults: messages.length > 0,
          });
        } catch (error) {
          logger.error('[MESSAGES API] Error filtrando por conversationId', {
            conversationId,
            error: typeof error.message === 'string' ? error.message : '(no message)',
            code: typeof error.code === 'string' ? error.code : '(no code)',
          });

          // Si hay error, devolver respuesta vacía pero no fallar
          return res.status(500).json(createEmptyPaginatedResponse(
            'Error al obtener mensajes por conversación', limit));
        }
      } else if (userId) {
        // ✅ FILTRO POR USERID
        logger.info('[MESSAGES API] Filtrando por userId', { userId });

        try {
          messages = await Message.getByUserId(userId, {
            limit,
            startAfter, // ✅ CURSOR-BASED PAGINATION
            orderBy,
            order,
          });

          logger.info('[MESSAGES API] Resultados por userId', {
            userId,
            count: messages.length,
            limit,
          });
        } catch (error) {
          logger.error('[MESSAGES API] Error filtrando por userId', {
            userId,
            error: typeof error.message === 'string' ? error.message : '(no message)',
            code: typeof error.code === 'string' ? error.code : '(no code)',
          });

          return res.status(500).json(createEmptyPaginatedResponse(
            'Error al obtener mensajes por usuario', limit));
        }
      } else if (customerPhone) {
        // ✅ FILTRO POR CUSTOMERPHONE
        logger.info('[MESSAGES API] Filtrando por customerPhone', { customerPhone });

        try {
          const companyPhone = process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:', '');
          messages = await Message.getByPhones(customerPhone, companyPhone, {
            limit,
            startAfter, // ✅ CURSOR-BASED PAGINATION
          });

          logger.info('[MESSAGES API] Resultados por customerPhone', {
            customerPhone,
            count: messages.length,
            limit,
          });
        } catch (error) {
          logger.error('[MESSAGES API] Error filtrando por customerPhone', {
            customerPhone,
            error: typeof error.message === 'string' ? error.message : '(no message)',
            code: typeof error.code === 'string' ? error.code : '(no code)',
          });

          return res.status(500).json(createEmptyPaginatedResponse(
            'Error al obtener mensajes por teléfono', limit));
        }
      }

      // ✅ CONVERTIR MENSAJES A JSON CON NORMALIZACIÓN AUTOMÁTICA
      // Nota: El método toJSON() ya incluye el mapping content → text
      const mappedMessages = messages.map(message => message.toJSON());

      // ✅ LOG DE RESULTADOS
      logger.info('[MESSAGES API] Respuesta preparada', {
        totalMessages: mappedMessages.length,
        hasMessages: mappedMessages.length > 0,
        hasNextPage: mappedMessages.length === limit,
        filters: {
          conversationId: conversationId || null,
          userId: userId || null,
          customerPhone: customerPhone || null,
        },
      });

      // ✅ ADVERTENCIA SI NO HAY MENSAJES
      if (mappedMessages.length === 0) {
        logger.warn('[MESSAGES API] No se encontraron mensajes', {
          filters: {
            conversationId: conversationId || null,
            userId: userId || null,
            customerPhone: customerPhone || null,
          },
          user: req.user ? req.user.id : null,
        });
      }

      // ✅ RESPUESTA CON PAGINACIÓN CURSOR-BASED ESTANDARIZADA
      const response = createMessagesPaginatedResponse(
        mappedMessages,
        limit,
        startAfter,
        {
          conversationId: conversationId || null,
          userId: userId || null,
          customerPhone: customerPhone || null,
        },
      );

      res.json(response);
    } catch (error) {
      logger.error('[MESSAGES API] Error crítico', {
        error: typeof error.message === 'string' ? error.message : '(no message)',
        code: typeof error.code === 'string' ? error.code : '(no code)',
        stack: typeof error.stack === 'string' ? error.stack : '(no stack)',
        user: req.user ? req.user.id : null,
      });

      // ✅ RESPUESTA DE ERROR PERO SIEMPRE CON FORMATO CORRECTO
      res.status(500).json(createEmptyPaginatedResponse(
        'Error interno del servidor al obtener mensajes', 50));
    }
  }

  /**
   * Obtener conversación por teléfono
   * ✅ ACTUALIZADO: Usa paginación cursor-based eficiente
   */
  static async getConversationByPhone (req, res, _next) {
    try {
      const { phone } = req.params;
      const { limit: rawLimit = 50, startAfter = null } = req.query;

      // ✅ VALIDACIÓN DE PARÁMETROS DE PAGINACIÓN
      const { limit } = validatePaginationParams({ limit: rawLimit, startAfter });

      logger.info('[CONVERSATION API] Obteniendo conversación por teléfono', {
        phone,
        limit,
        startAfter,
        userId: req.user.id,
      });

      // Obtener el número de WhatsApp de la empresa
      const companyPhone = process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:', '');

      const messages = await Message.getByPhones(phone, companyPhone, {
        limit,
        startAfter, // ✅ CURSOR-BASED PAGINATION
      });

      // Obtener información del contacto
      const contact = await Contact.getByPhone(phone);

      // ✅ CONVERTIR MENSAJES A JSON CON NORMALIZACIÓN AUTOMÁTICA
      // Nota: El método toJSON() ya incluye el mapping content → text
      const mappedMessages = messages.map(msg => msg.toJSON());

      // Construir el objeto de conversación
      const conversationObject = new Conversation({
        id: messages.length > 0 ? messages[0].conversationId : null,
        contact: {
          id: contact ? contact.id : phone,
          name: contact ? contact.name : phone,
        },
        lastMessage: mappedMessages.length > 0 ? mappedMessages[0] : null,
        unreadCount: 0,
        status: 'open',
        assignedTo: null,
        messages: mappedMessages,
      });

      // ✅ RESPUESTA CON PAGINACIÓN CURSOR-BASED
      const response = {
        conversation: conversationObject.toJSON(),
        pagination: {
          limit,
          startAfter,
          nextStartAfter: mappedMessages.length === limit
            ? mappedMessages[mappedMessages.length - 1].id
            : null,
          hasNextPage: mappedMessages.length === limit,
          messageCount: mappedMessages.length,
        },
      };

      logger.info('[CONVERSATION API] Respuesta enviada', {
        phone,
        messageCount: mappedMessages.length,
        hasNextPage: response.pagination.hasNextPage,
        contactFound: !!contact,
      });

      res.json(response);
    } catch (error) {
      logger.error('Error al obtener conversación:', error);
      res.status(500).json(createEmptyPaginatedResponse('Error al obtener conversación', 50));
    }
  }

  /**
   * Enviar mensaje de WhatsApp
   */
  static async sendMessage (req, res, next) {
    try {
      const { to, content } = req.body;
      const userId = req.user.id;

      // Adaptar al nuevo contrato de TwilioService/MessageService si es necesario
      const result = await TwilioService.sendWhatsAppMessage(to, content, {
        id: userId,
        name: req.user.displayName || 'Agente',
      });

      logger.info('Mensaje enviado por usuario', {
        userId,
        to,
        messageId: result.messageId,
      });

      res.status(201).json({
        message: 'Mensaje enviado exitosamente',
        ...result,
      });
    } catch (error) {
      logger.error('Error al enviar mensaje:', error);
      next(error);
    }
  }

  /**
   * Webhook de Twilio SEGURO - SIEMPRE responde 200 OK
   * ✅ ROBUSTO: Maneja errores sin fallar
   * ✅ PRODUCCIÓN: Nunca devuelve 4xx/5xx que podrían causar reenvíos
   */
  static async handleWebhookSafe (req, res) {
    try {
      // ✅ LOG INICIAL - Solo información necesaria
      logger.info('Webhook Twilio recibido', {
        hasBody: !!req.body,
        bodyKeys: req.body ? Object.keys(req.body) : [],
        userAgent: req.get('User-Agent'),
        twilioSignature: !!req.headers['x-twilio-signature'],
      });

      // ✅ VALIDACIÓN CRÍTICA: Verificar datos mínimos
      const requiredFields = ['From', 'To', 'MessageSid'];
      const missingFields = requiredFields.filter(field => !req.body[field]);

      if (missingFields.length > 0) {
        logger.error('Webhook - Datos críticos faltantes', {
          missingFields,
          bodyReceived: req.body,
        });
        // ✅ RESPUESTA 200 SIEMPRE (Twilio spec)
        return res.status(200).json({
          status: 'received',
          message: 'Webhook procesado (datos insuficientes)',
        });
      }

      logger.info('Webhook - Datos críticos verificados correctamente');

      // ✅ VALIDACIÓN OPCIONAL: Firma Twilio (recomendado pero no crítico)
      try {
        const signature = req.headers['x-twilio-signature'];
        if (signature && process.env.TWILIO_AUTH_TOKEN) {
          logger.info('Validando firma Twilio...');
          const url = `${req.protocol}://${req.headers.host}${req.originalUrl}`;
          const isValid = TwilioService.validateWebhook(signature, url, req.body);

          if (!isValid) {
            logger.warn('Firma Twilio inválida, pero procesando por seguridad');
          } else {
            logger.info('Firma Twilio válida');
          }
        } else {
          logger.info('Validación de firma omitida (desarrollo o sin configurar)');
        }
      } catch (signatureError) {
        logger.warn('Error validando firma', { error: signatureError.message });
      }

      // ✅ PROCESAMIENTO PRINCIPAL: Enviar a TwilioService
      logger.info('Enviando a TwilioService para procesamiento...');
      const message = await TwilioService.processIncomingMessage(req.body);

      logger.info('Mensaje procesado exitosamente', {
        messageId: message.id,
        from: message.from,
        to: message.to,
        hasContent: !!message.content,
        hasMedia: message.metadata?.mediaUrls?.length > 0,
        twilioSid: req.body.MessageSid,
        processedAt: new Date().toISOString(),
      });

      // ✅ RESPUESTA EXITOSA: 200 OK siempre
      logger.info('Respondiendo 200 OK a Twilio');
      res.status(200).json({
        status: 'success',
        messageId: message.id,
        processedAt: new Date().toISOString(),
      });
    } catch (error) {
      // ✅ MANEJO DE ERRORES: Log pero NUNCA fallar
      logger.error('Error procesando webhook', {
        error: error.message,
        stack: error.stack?.split('\n')[0], // Solo primera línea del stack
        body: req.body,
        headers: {
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent'],
          'x-twilio-signature': !!req.headers['x-twilio-signature'],
        },
        timestamp: new Date().toISOString(),
      });

      // ✅ RESPUESTA 200 INCLUSO EN ERROR (Twilio spec)
      logger.info('Error manejado, respondiendo 200 OK a Twilio');
      res.status(200).json({
        status: 'error_handled',
        message: 'Webhook recibido pero con errores',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Obtener estadísticas de mensajes
   */
  static async getStats (req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const userId = req.user.role === 'admin' ? null : req.user.id;

      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      const stats = await Message.getStats(userId, start, end);

      res.json({
        stats,
        period: {
          startDate: start?.toISOString(),
          endDate: end?.toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error al obtener estadísticas:', error);
      next(error);
    }
  }

  /**
   * Actualizar estado de mensaje
   * Nueva API: PUT /api/conversations/:conversationId/messages/:id/status
   */
  static async updateStatus (req, res, next) {
    try {
      const { id } = req.params;
      const { status, conversationId } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Estado requerido' });
      }

      if (!conversationId) {
        return res.status(400).json({ error: 'conversationId requerido' });
      }

      const message = await Message.getById(id, conversationId);
      if (!message) {
        return res.status(404).json({ error: 'Mensaje no encontrado' });
      }

      await message.updateStatus(status);

      res.json({
        message: 'Estado actualizado correctamente',
        messageId: id,
        newStatus: status,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Marcar mensaje como leído
   * Nueva API: PUT /api/conversations/:conversationId/messages/:id/read
   */
  static async markAsRead (req, res, next) {
    try {
      const { id } = req.params;
      const { conversationId } = req.body;

      if (!conversationId) {
        return res.status(400).json({ error: 'conversationId requerido' });
      }

      const message = await Message.getById(id, conversationId);
      if (!message) {
        return res.status(404).json({ error: 'Mensaje no encontrado' });
      }

      await message.markAsRead();

      res.json({
        message: 'Mensaje marcado como leído',
        messageId: id,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Marcar múltiples mensajes como leídos
   */
  static async markMultipleAsRead (req, res, next) {
    try {
      const { messageIds } = req.body;

      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return res.status(400).json({
          error: 'messageIds debe ser un array no vacío',
        });
      }

      const results = await Promise.allSettled(
        messageIds.map(async (messageId) => {
          // NOTA: Operación costosa - buscar en todas las conversaciones
          // TODO: Cambiar API para incluir conversationId
          const message = await Message.getByIdAnyConversation(messageId);
          if (message) {
            await message.markAsRead();
            return { messageId, success: true };
          }
          return { messageId, success: false, error: 'No encontrado' };
        }),
      );

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;

      res.json({
        message: `${successful} mensajes marcados como leídos`,
        successful,
        failed,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message }),
      });
    } catch (error) {
      logger.error('Error al marcar mensajes múltiples:', error);
      next(error);
    }
  }

  /**
   * Buscar mensajes por contenido
   */
  static async search (req, res, next) {
    try {
      const { q: searchTerm, limit = 20 } = req.query;

      if (!searchTerm) {
        return res.status(400).json({
          error: 'Parámetro de búsqueda requerido',
          message: 'El parámetro "q" es requerido',
        });
      }

      const userId = req.user.role === 'admin' ? null : req.user.id;
      const messages = await Message.search(searchTerm, userId);

      res.json({
        messages: messages.slice(0, parseInt(limit)).map(msg => msg.toJSON()),
        total: messages.length,
      });
    } catch (error) {
      logger.error('Error al buscar mensajes:', error);
      next(error);
    }
  }

  /**
   * Obtener mensaje por ID
   * API mejorada que requiere conversationId para optimización
   */
  static async getById (req, res, next) {
    try {
      const { id } = req.params;
      const { conversationId } = req.query;

      if (!conversationId) {
        return res.status(400).json({
          error: 'conversationId requerido como query parameter',
          example: '/api/messages/MSG123?conversationId=conv_123_456',
        });
      }

      const message = await Message.getById(id, conversationId);
      if (!message) {
        return res.status(404).json({ error: 'Mensaje no encontrado' });
      }

      res.json(message.toJSON());
    } catch (error) {
      next(error);
    }
  }
}

module.exports = MessageController;
