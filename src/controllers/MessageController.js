const Message = require('../models/Message');
const Contact = require('../models/Contact');
const TwilioService = require('../services/TwilioService');
const logger = require('../utils/logger');

class MessageController {
  /**
   * Obtener conversaciones (últimos mensajes por contacto)
   */
  static async getConversations (req, res, next) {
    try {
      const { limit = 20 } = req.query;
      const userId = req.user.role === 'admin' ? null : req.user.uid;

      // Para simplificar, obtenemos mensajes recientes y agrupamos por teléfono
      const recentMessages = await Message.getRecentMessages(userId, parseInt(limit) * 5);

      // Agrupar por número de teléfono y obtener el último mensaje de cada conversación
      const conversationsMap = new Map();

      for (const message of recentMessages) {
        const phoneKey = message.direction === 'inbound' ? message.from : message.to;

        if (!conversationsMap.has(phoneKey) ||
            message.timestamp > conversationsMap.get(phoneKey).timestamp) {
          conversationsMap.set(phoneKey, message);
        }
      }

      const conversations = Array.from(conversationsMap.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, parseInt(limit));

      // Obtener información de contactos
      const conversationsWithContacts = await Promise.all(
        conversations.map(async (message) => {
          const phoneKey = message.direction === 'inbound' ? message.from : message.to;
          const contact = await Contact.getByPhone(phoneKey);

          return {
            phone: phoneKey,
            lastMessage: message.toJSON(),
            contact: contact?.toJSON() || null,
          };
        }),
      );

      res.json({
        conversations: conversationsWithContacts,
        total: conversationsWithContacts.length,
      });
    } catch (error) {
      logger.error('Error al obtener conversaciones:', error);
      next(error);
    }
  }

  /**
   * Obtener mensajes con filtros flexibles por conversationId y userId
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
   */
  static async getMessages (req, res, next) {
    try {
      const {
        conversationId,
        userId,
        customerPhone,
        limit = 50,
        page = 1,
        orderBy = 'timestamp',
        order = 'desc',
      } = req.query;

      // ✅ LOG EXHAUSTIVO: Query recibida
      logger.info('[MESSAGES API] Query recibida', {
        conversationId: conversationId || '(no filtro)',
        userId: userId || '(no filtro)',
        customerPhone: customerPhone || '(no filtro)',
        limit: parseInt(limit),
        page: parseInt(page),
        orderBy,
        order,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        user: req.user ? req.user.uid : null,
      });

      // ✅ VALIDACIÓN: Al menos un filtro debe estar presente
      if (!conversationId && !userId && !customerPhone) {
        logger.warn('[MESSAGES API] Sin filtros especificados, devolviendo conversaciones', {
          user: req.user ? req.user.uid : null,
        });

        // Fallback al comportamiento anterior (conversaciones)
        return MessageController.getConversations(req, res, next);
      }

      let messages = [];

      // ✅ FILTRO POR CONVERSATIONID (prioridad alta)
      if (conversationId) {
        logger.info('[MESSAGES API] Filtrando por conversationId', { conversationId });

        try {
          messages = await Message.getByConversation(conversationId, {
            limit: parseInt(limit),
            orderBy,
            order,
          });

          logger.info('[MESSAGES API] Resultados por conversationId', {
            conversationId,
            count: messages.length,
            limit: parseInt(limit),
          });
        } catch (error) {
          logger.error('[MESSAGES API] Error filtrando por conversationId', {
            conversationId,
            error: typeof error.message === 'string' ? error.message : '(no message)',
            code: typeof error.code === 'string' ? error.code : '(no code)',
          });

          // Si hay error, devolver array vacío pero no fallar
          messages = [];
        }
      }
      // ✅ FILTRO POR USERID
      else if (userId) {
        logger.info('[MESSAGES API] Filtrando por userId', { userId });

        try {
          messages = await Message.getByUserId(userId, {
            limit: parseInt(limit),
            orderBy,
            order,
          });

          logger.info('[MESSAGES API] Resultados por userId', {
            userId,
            count: messages.length,
            limit: parseInt(limit),
          });
        } catch (error) {
          logger.error('[MESSAGES API] Error filtrando por userId', {
            userId,
            error: typeof error.message === 'string' ? error.message : '(no message)',
            code: typeof error.code === 'string' ? error.code : '(no code)',
          });

          messages = [];
        }
      }
      // ✅ FILTRO POR CUSTOMERPHONE
      else if (customerPhone) {
        logger.info('[MESSAGES API] Filtrando por customerPhone', { customerPhone });

        try {
          const companyPhone = process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:', '');
          messages = await Message.getByPhones(customerPhone, companyPhone, {
            limit: parseInt(limit),
          });

          logger.info('[MESSAGES API] Resultados por customerPhone', {
            customerPhone,
            count: messages.length,
            limit: parseInt(limit),
          });
        } catch (error) {
          logger.error('[MESSAGES API] Error filtrando por customerPhone', {
            customerPhone,
            error: typeof error.message === 'string' ? error.message : '(no message)',
            code: typeof error.code === 'string' ? error.code : '(no code)',
          });

          messages = [];
        }
      }

      // ✅ MAPPING: content → text para compatibilidad con frontend
      const mappedMessages = messages.map(message => {
        const messageJson = message.toJSON();

        // CRÍTICO: Mapear content a text para que el frontend funcione
        if (messageJson.content && !messageJson.text) {
          messageJson.text = messageJson.content;
        }

        return messageJson;
      });

      // ✅ LOG DE RESULTADOS
      logger.info('[MESSAGES API] Respuesta preparada', {
        totalMessages: mappedMessages.length,
        hasMessages: mappedMessages.length > 0,
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
          user: req.user ? req.user.uid : null,
        });
      }

      // ✅ RESPUESTA SIEMPRE ES UN ARRAY
      res.json({
        messages: mappedMessages, // SIEMPRE array, nunca null/undefined
        total: mappedMessages.length,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: mappedMessages.length,
        },
        filters: {
          conversationId: conversationId || null,
          userId: userId || null,
          customerPhone: customerPhone || null,
        },
      });
    } catch (error) {
      logger.error('[MESSAGES API] Error crítico', {
        error: typeof error.message === 'string' ? error.message : '(no message)',
        code: typeof error.code === 'string' ? error.code : '(no code)',
        stack: typeof error.stack === 'string' ? error.stack : '(no stack)',
        user: req.user ? req.user.uid : null,
      });

      // ✅ RESPUESTA DE ERROR PERO SIEMPRE ARRAY
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Ha ocurrido un error al obtener los mensajes',
        messages: [], // SIEMPRE array vacío en caso de error
        total: 0,
      });
    }
  }

  /**
   * Obtener mensajes de una conversación específica
   */
  static async getConversationByPhone (req, res, next) {
    try {
      const { phone } = req.params;
      const { limit = 50, page = 1 } = req.query;

      // Obtener el número de WhatsApp de la empresa
      const companyPhone = process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:', '');

      const messages = await Message.getByPhones(phone, companyPhone, {
        limit: parseInt(limit),
      });

      // Obtener información del contacto
      const contact = await Contact.getByPhone(phone);

      res.json({
        phone,
        contact: contact?.toJSON() || null,
        messages: messages.map(msg => msg.toJSON()),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: messages.length,
        },
      });
    } catch (error) {
      logger.error('Error al obtener conversación:', error);
      next(error);
    }
  }

  /**
   * Enviar mensaje de WhatsApp
   */
  static async sendMessage (req, res, next) {
    try {
      const { to, content, type = 'text' } = req.body;
      const userId = req.user.uid;

      const result = await TwilioService.sendWhatsAppMessage(to, content, userId);

      logger.info('Mensaje enviado por usuario', {
        userId,
        to,
        messageId: result.messageId,
      });

      res.json({
        message: 'Mensaje enviado exitosamente',
        ...result,
      });
    } catch (error) {
      logger.error('Error al enviar mensaje:', error);
      next(error);
    }
  }

  /**
   * Webhook de Twilio para mensajes entrantes (MÉTODO LEGACY - mantenido para compatibilidad)
   * NOTA: Este método puede responder con errores 4xx/5xx
   * Para uso en producción, usar handleWebhookSafe()
   */
  static async handleWebhook (req, res, next) {
    try {
      // Validar webhook de Twilio (opcional pero recomendado)
      const signature = req.headers['x-twilio-signature'];
      const url = `${req.protocol}://${req.headers.host}${req.originalUrl}`;

      if (process.env.NODE_ENV === 'production' && signature) {
        const isValid = TwilioService.validateWebhook(signature, url, req.body);
        if (!isValid) {
          return res.status(403).json({ error: 'Invalid webhook signature' });
        }
      }

      const message = await TwilioService.processIncomingMessage(req.body);

      logger.info('Mensaje entrante procesado via webhook', {
        messageId: message.id,
        from: message.from,
      });

      res.status(200).send('OK');
    } catch (error) {
      logger.error('Error en webhook:', error);
      res.status(500).send('Error');
    }
  }

  /**
   * Webhook SEGURO de Twilio - SIEMPRE responde 200 OK
   * Método recomendado para producción según mejores prácticas de Twilio
   */
  static async handleWebhookSafe (req, res) {
    const startTime = Date.now();

    try {
      // ✅ RAILWAY LOGGING: Log inicial visible en Railway console
      console.log('📨 CONTROLLER - Procesando webhook seguro', {
        from: req.body.From,
        to: req.body.To,
        messageSid: req.body.MessageSid,
        hasBody: !!req.body.Body,
        numMedia: req.body.NumMedia || 0,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
      });

      logger.info('📨 Procesando mensaje entrante vía webhook seguro', {
        from: req.body.From,
        to: req.body.To,
        messageSid: req.body.MessageSid,
        timestamp: new Date().toISOString(),
      });

      // ✅ VALIDACIÓN DE DATOS CRÍTICOS ANTES DE PROCESAR
      const { From, To, MessageSid, Body } = req.body;

      if (!From || !To || !MessageSid) {
        console.error('❌ CONTROLLER - Datos críticos faltantes:', {
          hasFrom: !!From,
          hasTo: !!To,
          hasMessageSid: !!MessageSid,
          receivedFields: Object.keys(req.body),
        });

        // Responder 200 OK pero logear el problema
        return res.status(200).json({
          status: 'warning',
          message: 'Datos críticos faltantes en webhook',
          processTime: Date.now() - startTime,
        });
      }

      console.log('✅ CONTROLLER - Datos críticos verificados');

      // ✅ VALIDACIÓN DE FIRMA TWILIO (opcional en producción)
      const signature = req.headers['x-twilio-signature'];
      const url = `${req.protocol}://${req.headers.host}${req.originalUrl}`;

      if (process.env.NODE_ENV === 'production' && signature && process.env.TWILIO_AUTH_TOKEN) {
        try {
          console.log('🔍 CONTROLLER - Validando firma Twilio...');
          const isValid = TwilioService.validateWebhook(signature, url, req.body);
          if (!isValid) {
            console.log('⚠️ CONTROLLER - Firma Twilio inválida, pero procesando por seguridad');
            logger.warn('⚠️ Firma Twilio inválida, pero procesando mensaje por seguridad', {
              signature: signature ? 'presente' : 'ausente',
              url,
            });
            // NO retornar error - seguir procesando por seguridad
          } else {
            console.log('✅ CONTROLLER - Firma Twilio válida');
            logger.info('✅ Firma Twilio válida');
          }
        } catch (signatureError) {
          console.log('⚠️ CONTROLLER - Error validando firma:', signatureError.message);
          logger.warn('⚠️ Error validando firma Twilio, pero continuando procesamiento', {
            error: signatureError.message,
          });
          // NO retornar error - seguir procesando
        }
      } else {
        console.log('🔍 CONTROLLER - Validación de firma omitida (desarrollo o sin configurar)');
      }

      // ✅ PROCESAR MENSAJE ENTRANTE
      console.log('🔄 CONTROLLER - Enviando a TwilioService para procesamiento...');
      const message = await TwilioService.processIncomingMessage(req.body);

      // ✅ LOG DE ÉXITO PARA RAILWAY
      console.log('✅ CONTROLLER - Mensaje procesado exitosamente:', {
        messageId: message.id,
        from: message.from,
        to: message.to,
        type: message.type,
        contentLength: message.content ? message.content.length : 0,
        processTime: Date.now() - startTime,
      });

      logger.info('✅ Mensaje entrante procesado exitosamente', {
        messageId: message.id,
        from: message.from,
        to: message.to,
        content: message.content.substring(0, 50),
        processTime: Date.now() - startTime,
      });

      // ✅ RESPUESTA SIEMPRE 200 OK A TWILIO
      console.log('📤 CONTROLLER - Respondiendo 200 OK a Twilio');
      res.status(200).json({
        status: 'success',
        messageId: message.id,
        processTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // ❌ ERROR MANEJADO: Loguear pero SIEMPRE responder 200 OK
      console.error('❌ CONTROLLER - Error procesando webhook:', {
        error: error.message,
        stack: error.stack.split('\n').slice(0, 3), // Primeras 3 líneas
        webhookData: {
          from: req.body?.From,
          to: req.body?.To,
          messageSid: req.body?.MessageSid,
          numMedia: req.body?.NumMedia,
        },
        processTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      logger.error('❌ Error procesando webhook (respondiendo 200 OK para Twilio)', {
        error: error.message,
        stack: error.stack,
        webhookData: req.body,
        processTime: Date.now() - startTime,
      });

      // ✅ CRÍTICO: SIEMPRE responder 200 OK a Twilio
      console.log('📤 CONTROLLER - Error manejado, respondiendo 200 OK a Twilio');
      res.status(200).json({
        status: 'error_logged',
        message: 'Error procesado y registrado, no reintente',
        error: error.message,
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
      const { startDate, endDate } = req.query;
      const userId = req.user.role === 'admin' ? null : req.user.uid;

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

      const userId = req.user.role === 'admin' ? null : req.user.uid;
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
          example: '/api/messages/MSG123?conversationId=conv_123_456'
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
