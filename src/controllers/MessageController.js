const Message = require('../models/Message');
const Contact = require('../models/Contact');
const { processIncomingMessage, getTwilioService } = require('../services/TwilioService'); // ✅ IMPORTACIÓN CORREGIDA
const logger = require('../utils/logger');
const {
  createMessagesPaginatedResponse,
  validatePaginationParams,
} = require('../utils/pagination');

class MessageController {
  /**
   * Obtener conversaciones (últimos mensajes por contacto)
   * ✅ ACTUALIZADO: Usa estructura canónica para respuesta
   */
  static async getConversations (req, res, next) {
    try {
      // ✅ DEBUG: Logs para rastrear el flujo
      console.log('🔍 DEBUG - getConversations iniciado:', {
        query: req.query,
        user: {
          uid: req.user.id,
          role: req.user.role,
          email: req.user.email,
        },
        timestamp: new Date().toISOString(),
      });

      const { limit = 20 } = req.query;
      const userId = req.user.role === 'admin' ? null : req.user.id;

      console.log('🔍 DEBUG - Parámetros de consulta:', {
        limit: parseInt(limit),
        userId: userId || 'ADMIN (todos)',
        requestingUserRole: req.user.role,
      });

      // Para simplificar, obtenemos mensajes recientes y agrupamos por teléfono
      console.log('🔍 DEBUG - Ejecutando Message.getRecentMessages...');
      const recentMessages = await Message.getRecentMessages(parseInt(limit) * 5);

      console.log('🔍 DEBUG - Mensajes recientes obtenidos:', {
        totalMessages: recentMessages.length,
        firstMessage: recentMessages[0]
          ? {
            id: recentMessages[0].id,
            from: recentMessages[0].from,
            to: recentMessages[0].to,
            direction: recentMessages[0].direction,
            content: recentMessages[0].content?.substring(0, 50),
            timestamp: recentMessages[0].timestamp,
            conversationId: recentMessages[0].conversationId,
          }
          : 'NINGUNO',
      });

      if (!recentMessages || recentMessages.length === 0) {
        console.log('⚠️ DEBUG - No se encontraron mensajes para el usuario:', {
          userId: userId || 'ADMIN',
          role: req.user.role,
        });

        return res.json({
          conversations: [],
          total: 0,
          page: 1,
          limit: parseInt(limit),
        });
      }

      // Agrupar por número de teléfono y obtener el último mensaje de cada conversación
      const conversationsMap = new Map();

      for (const message of recentMessages) {
        const phoneKey = message.direction === 'inbound' ? message.from : message.to;

        if (!conversationsMap.has(phoneKey) ||
            message.timestamp > conversationsMap.get(phoneKey).timestamp) {
          conversationsMap.set(phoneKey, message);
        }
      }

      console.log('🔍 DEBUG - Conversaciones agrupadas:', {
        totalConversations: conversationsMap.size,
        phoneNumbers: Array.from(conversationsMap.keys()),
        lastMessages: Array.from(conversationsMap.values()).map(msg => ({
          from: msg.from,
          to: msg.to,
          direction: msg.direction,
          content: msg.content?.substring(0, 30),
        })),
      });

      const conversations = Array.from(conversationsMap.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, parseInt(limit));

      console.log('🔍 DEBUG - Conversaciones ordenadas y limitadas:', {
        count: conversations.length,
        limit: parseInt(limit),
      });

      // Obtener información de contactos
      console.log('🔍 DEBUG - Obteniendo información de contactos...');
      const conversationsWithContacts = await Promise.all(
        conversations.map(async (message) => {
          const phoneKey = message.direction === 'inbound' ? message.from : message.to;
          const contact = await Contact.getByPhone(phoneKey);

          console.log('🔍 DEBUG - Contacto obtenido para', phoneKey, ':', contact ? 'ENCONTRADO' : 'NO_ENCONTRADO');

          // ✅ ESTRUCTURA CANÓNICA: Crear conversación según especificación
          const conversationData = {
            id: message.conversationId || `conv_${phoneKey.replace(/\D/g, '')}_${Date.now()}`,
            contact: {
              id: phoneKey,
              name: contact?.name || phoneKey,
              avatar: contact?.avatar || null,
              channel: 'whatsapp',
            },
            lastMessage: message.toJSON(), // Usar estructura canónica del mensaje
            status: 'open', // Por defecto
            assignedTo: null, // Se puede extender después
            createdAt: message.timestamp,
            updatedAt: message.timestamp,
          };

          return conversationData;
        }),
      );

      console.log('🔍 DEBUG - Respuesta final preparada:', {
        conversationsCount: conversationsWithContacts.length,
        structureExample: conversationsWithContacts[0]
          ? {
            id: conversationsWithContacts[0].id,
            hasContact: !!conversationsWithContacts[0].contact,
            hasLastMessage: !!conversationsWithContacts[0].lastMessage,
            contactName: conversationsWithContacts[0].contact?.name,
            lastMessageFields: conversationsWithContacts[0].lastMessage
              ? Object.keys(conversationsWithContacts[0].lastMessage)
              : 'NONE',
          }
          : 'EMPTY',
      });

      // ✅ ESTRUCTURA CANÓNICA EXACTA según especificación del frontend
      const response = {
        conversations: conversationsWithContacts, // Array de conversaciones
        total: conversationsWithContacts.length, // Número total
        page: 1, // Página actual
        limit: parseInt(limit), // Límite por página
      };

      console.log('📤 RESPUESTA FINAL:', JSON.stringify({
        conversationsCount: response.conversations.length,
        structure: Object.keys(response),
        hasConversations: response.conversations.length > 0,
      }));

      res.json(response);
    } catch (error) {
      logger.error('Error en getConversations:', error);
      next(error);
    }
  }

  /**
   * ✅ REFACTORIZADO: Buscar mensajes con filtros flexibles
   * Maneja filtros múltiples: conversationId, userId, customerPhone, etc.
   */
  static async getMessages (req, res, next) {
    try {
      const {
        conversationId,
        userId,
        customerPhone,
        limit: rawLimit = 50,
        startAfter,
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
        logger.warn('[MESSAGES API] Sin filtros especificados, devolviendo error', {
          user: req.user ? req.user.id : null,
        });

        // ❌ ELIMINADO: Fallback problemático que redirigía a conversaciones
        // ✅ CORREGIDO: Devolver error claro indicando que se requieren filtros
        return res.status(400).json({
          error: 'Filtros requeridos',
          message: 'Debes especificar al menos un filtro: conversationId, userId, o customerPhone',
          availableFilters: {
            conversationId: 'ID de conversación específica',
            userId: 'ID de usuario que creó los mensajes',
            customerPhone: 'Número de teléfono del cliente',
          },
          example: '/api/messages?conversationId=conv_123_456',
        });
      }

      let messages = [];

      // ✅ RUTA 1: Filtro por conversationId (más común)
      if (conversationId) {
        try {
          messages = await Message.getByConversation(conversationId, {
            limit,
            startAfter,
            orderBy,
            order,
          });

          logger.info('[MESSAGES API] Mensajes obtenidos por conversationId', {
            conversationId,
            messageCount: messages.length,
            user: req.user.id,
          });
        } catch (error) {
          logger.error('[MESSAGES API] Error obteniendo mensajes por conversationId', {
            conversationId,
            error: error.message,
            user: req.user.id,
          });
          messages = [];
        }
      } else if (userId) {
        // ✅ RUTA 2: Filtro por userId
        try {
          messages = await Message.getByUserId(userId, {
            limit,
            startAfter,
            orderBy,
            order,
          });

          logger.info('[MESSAGES API] Mensajes obtenidos por userId', {
            userId,
            messageCount: messages.length,
            requestingUser: req.user.id,
          });
        } catch (error) {
          logger.error('[MESSAGES API] Error obteniendo mensajes por userId', {
            userId,
            error: error.message,
            requestingUser: req.user.id,
          });
          messages = [];
        }
      } else if (customerPhone) {
        // ✅ RUTA 3: Filtro por customerPhone
        try {
          messages = await Message.getByCustomerPhone(customerPhone, {
            limit,
            startAfter,
            orderBy,
            order,
          });

          logger.info('[MESSAGES API] Mensajes obtenidos por customerPhone', {
            customerPhone,
            messageCount: messages.length,
            user: req.user.id,
          });
        } catch (error) {
          logger.error('[MESSAGES API] Error obteniendo mensajes por customerPhone', {
            customerPhone,
            error: error.message,
            user: req.user.id,
          });
          messages = [];
        }
      }

      // ✅ PREPARAR RESPUESTA: Usar utilidad centralizada
      const response = createMessagesPaginatedResponse(
        messages,
        limit,
        startAfter,
        {
          conversationId,
          userId,
          customerPhone,
          orderBy,
          order,
        },
      );

      // ✅ LOG FINAL: Respuesta generada
      logger.info('[MESSAGES API] Respuesta generada exitosamente', {
        messageCount: response.messages.length,
        hasMessages: response.messages.length > 0,
        user: req.user.id,
      });

      res.json(response);
    } catch (error) {
      logger.error('[MESSAGES API] Error inesperado', {
        error: error.message,
        stack: error.stack,
        user: req.user ? req.user.id : null,
      });
      next(error);
    }
  }

  /**
   * Obtener mensajes de una conversación por teléfono
   */
  static async getConversationByPhone (req, res, next) {
    try {
      const { phone } = req.params;
      const { limit = 50, page = 1 } = req.query;

      const contact = await Contact.getByPhone(phone);
      if (!contact) {
        return res.status(404).json({ error: 'Contacto no encontrado' });
      }

      // Obtener mensajes
      const messages = await Message.getByContact(contact.id, {
        limit: parseInt(limit),
        page: parseInt(page),
      });

      const response = createMessagesPaginatedResponse(messages, parseInt(limit), null, {
        contact: contact.toJSON(),
      });

      res.json(response);
    } catch (error) {
      logger.error('Error obteniendo conversación por teléfono:', error);
      next(error);
    }
  }

  /**
   * 📨 ENVIAR MENSAJE - ALINEADO 100% CON FRONTEND
   * Acepta { conversationId, to, content, type, attachments }
   */
  static async sendMessage (req, res, next) {
    try {
      const { conversationId, to, content, type = 'text', attachments = [] } = req.body;
      const userId = req.user.id;

      // ✅ VALIDACIÓN: Al menos conversationId o 'to' debe estar presente
      if (!conversationId && !to) {
        return res.status(400).json({
          error: 'Datos insuficientes',
          message: 'Debes proporcionar conversationId o número de teléfono (to)',
        });
      }

      let targetPhone = to;

      // ✅ Si solo tenemos conversationId, obtener el número de teléfono destino
      if (conversationId && !to) {
        // El conversationId tiene formato: conv_phone1_phone2
        // Extraer el número que NO es nuestro número de Twilio
        const parts = conversationId.replace('conv_', '').split('_');
        const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:', '').replace('+', '') || '';

        // Encontrar cuál número NO es el de Twilio
        targetPhone = parts.find(part => part !== twilioNumber);

        if (!targetPhone) {
          return res.status(400).json({
            error: 'Conversación inválida',
            message: 'No se pudo determinar el número destino desde conversationId',
          });
        }

        // Agregar el + al número
        targetPhone = '+' + targetPhone;
      }

      // ✅ ENVIAR mensaje usando TwilioService
      let result;
      if (attachments && attachments.length > 0) {
        // Enviar mensaje con media
        const mediaUrl = attachments[0].url; // Por ahora solo el primer attachment
        const caption = content || '';
        result = await getTwilioService().sendMediaMessage(targetPhone, mediaUrl, caption, userId);
      } else {
        // Enviar mensaje de texto
        result = await getTwilioService().sendWhatsAppMessage(targetPhone, content, userId);
      }

      // ✅ OBTENER el mensaje guardado para devolver estructura canónica
      const savedMessage = await Message.getById(result.messageId);
      if (!savedMessage) {
        throw new Error('Mensaje enviado pero no se pudo obtener desde la base de datos');
      }

      // ✅ EMITIR evento de websocket con estructura canónica
      const socketManager = req.app.get('socketManager');
      if (socketManager && savedMessage.conversationId) {
        socketManager.emitNewMessage(savedMessage.conversationId, savedMessage);
      }

      logger.info('Mensaje enviado exitosamente via API', {
        userId,
        to: targetPhone,
        conversationId: savedMessage.conversationId,
        messageId: result.messageId,
        type,
        hasAttachments: attachments.length > 0,
      });

      // ✅ ESTRUCTURA CANÓNICA DE RESPUESTA
      res.status(201).json({
        message: savedMessage.toJSON(), // Usar estructura canónica del modelo
      });
    } catch (error) {
      logger.error('Error enviando mensaje via API', {
        userId: req.user?.id,
        error: error.message,
        stack: error.stack,
      });
      next(error);
    }
  }

  /**
   * ✅ WEBHOOK DE TWILIO COMPLETAMENTE RECONSTRUIDO
   * Webhook de Twilio SEGURO - SIEMPRE responde 200 OK
   * ✅ ROBUSTO: Maneja errores sin fallar
   * ✅ PRODUCCIÓN: Nunca devuelve 4xx/5xx que podrían causar reenvíos
   */
  static async handleWebhookSafe (req, res) {
    const startTime = Date.now();
    
    try {
      // ✅ LOG INICIAL DETALLADO
      logger.info('🔗 Webhook Twilio recibido', {
        messageSid: req.body.MessageSid,
        from: req.body.From,
        to: req.body.To,
        hasBody: !!req.body.Body,
        numMedia: req.body.NumMedia || 0,
        userAgent: req.get('User-Agent'),
        twilioSignature: !!req.headers['x-twilio-signature'],
        timestamp: new Date().toISOString(),
      });

      // ✅ VALIDACIÓN CRÍTICA: Verificar datos mínimos de Twilio
      const requiredFields = ['From', 'To', 'MessageSid'];
      const missingFields = requiredFields.filter(field => !req.body[field]);

      if (missingFields.length > 0) {
        logger.error('❌ Webhook - Datos críticos faltantes', {
          missingFields,
          receivedFields: Object.keys(req.body),
          bodyReceived: req.body,
        });
        
        // ✅ RESPUESTA 200 SIEMPRE (Twilio spec) - incluso con errores
        return res.status(200).json({
          status: 'received_with_errors',
          message: 'Webhook recibido pero datos insuficientes',
          missingFields,
          processTime: Date.now() - startTime,
        });
      }

      // ✅ PROCESAMIENTO PRINCIPAL: Usar nueva función processIncomingMessage
      logger.info('🔄 Iniciando procesamiento del mensaje...');
      
      const result = await processIncomingMessage(req.body);

      // ✅ VERIFICAR RESULTADO DEL PROCESAMIENTO
      if (result.success) {
        logger.info('✅ Mensaje procesado exitosamente', {
          conversationId: result.conversation?.id,
          messageId: result.message?.id,
          senderPhone: result.message?.senderPhone,
          recipientPhone: result.message?.recipientPhone,
          direction: result.message?.direction,
          type: result.message?.type,
          processTime: Date.now() - startTime,
        });

        // ✅ RESPUESTA EXITOSA: SIEMPRE 200 OK
        return res.status(200).json({
          status: 'success',
          message: 'Webhook procesado exitosamente',
          data: {
            conversationId: result.conversation?.id,
            messageId: result.message?.id,
            direction: result.message?.direction,
            type: result.message?.type,
          },
          processTime: Date.now() - startTime,
          timestamp: result.timestamp,
        });
      } else {
        // ✅ ERROR EN PROCESAMIENTO PERO RESPONDER 200 OK
        logger.warn('⚠️ Webhook procesado con errores', {
          error: result.error,
          webhookData: req.body,
          processTime: Date.now() - startTime,
        });

        return res.status(200).json({
          status: 'processed_with_errors',
          message: 'Webhook recibido pero procesamiento falló',
          error: result.error,
          processTime: Date.now() - startTime,
          timestamp: result.timestamp,
        });
      }

    } catch (error) {
      // ✅ SAFETY NET CRÍTICO: Nunca fallar el webhook
      logger.error('❌ Error crítico en webhook (respondiendo 200 OK)', {
        error: error.message,
        stack: error.stack,
        webhookData: {
          MessageSid: req.body.MessageSid,
          From: req.body.From,
          To: req.body.To,
          Body: req.body.Body ? 'presente' : 'ausente',
        },
        processTime: Date.now() - startTime,
      });

      // ✅ SIEMPRE RESPONDER 200 OK para evitar reenvíos infinitos de Twilio
      res.status(200).json({
        status: 'error_handled',
        message: 'Webhook recibido con error crítico (no reintento)',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
        processTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Obtener estadísticas de mensajes
   */
  static async getStats (req, res, next) {
    try {
      const { period = '7d', userId = null } = req.query;

      // Permitir que admins vean stats de todos, otros solo las suyas
      const targetUserId = req.user.role === 'admin' ? userId : req.user.id;

      const stats = await Message.getStats(period, targetUserId);

      res.json(stats);
    } catch (error) {
      logger.error('Error obteniendo estadísticas:', error);
      next(error);
    }
  }

  /**
   * Actualizar estado de mensaje
   */
  static async updateStatus (req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const message = await Message.getById(id);
      if (!message) {
        return res.status(404).json({ error: 'Mensaje no encontrado' });
      }

      await message.updateStatus(status);

      logger.info('Estado de mensaje actualizado', {
        messageId: id,
        newStatus: status,
        updatedBy: req.user.id,
      });

      res.json({
        message: 'Estado actualizado exitosamente',
        messageRecord: message.toJSON(),
      });
    } catch (error) {
      logger.error('Error actualizando estado de mensaje:', error);
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
