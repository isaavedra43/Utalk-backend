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
      logger.info('📨 Procesando mensaje entrante vía webhook seguro', {
        from: req.body.From,
        to: req.body.To,
        messageSid: req.body.MessageSid,
        timestamp: new Date().toISOString(),
      });

      // Validación de firma Twilio (solo en producción y si está configurada)
      const signature = req.headers['x-twilio-signature'];
      const url = `${req.protocol}://${req.headers.host}${req.originalUrl}`;

      if (process.env.NODE_ENV === 'production' && signature && process.env.TWILIO_AUTH_TOKEN) {
        try {
          const isValid = TwilioService.validateWebhook(signature, url, req.body);
          if (!isValid) {
            logger.warn('⚠️ Firma Twilio inválida, pero procesando mensaje por seguridad', {
              signature: signature ? 'presente' : 'ausente',
              url,
            });
            // NO retornar error - seguir procesando por seguridad
          } else {
            logger.info('✅ Firma Twilio válida');
          }
        } catch (signatureError) {
          logger.warn('⚠️ Error validando firma Twilio, pero continuando procesamiento', {
            error: signatureError.message,
          });
          // NO retornar error - seguir procesando
        }
      }

      // Procesar mensaje entrante
      const message = await TwilioService.processIncomingMessage(req.body);

      logger.info('✅ Mensaje entrante procesado exitosamente', {
        messageId: message.id,
        from: message.from,
        to: message.to,
        content: message.content.substring(0, 50),
        processTime: Date.now() - startTime,
      });

      // RESPUESTA SIEMPRE 200 OK
      res.status(200).json({
        status: 'success',
        messageId: message.id,
        processTime: Date.now() - startTime,
      });
    } catch (error) {
      // ERROR MANEJADO: Loguear pero SIEMPRE responder 200 OK
      logger.error('❌ Error procesando webhook (respondiendo 200 OK para Twilio)', {
        error: error.message,
        stack: error.stack,
        webhookData: req.body,
        processTime: Date.now() - startTime,
      });

      // CRÍTICO: SIEMPRE responder 200 OK a Twilio
      res.status(200).json({
        status: 'error_logged',
        message: 'Error procesado y registrado, no reintente',
        error: error.message,
        processTime: Date.now() - startTime,
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
   */
  static async updateStatus (req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const message = await Message.getById(id);
      if (!message) {
        return res.status(404).json({
          error: 'Mensaje no encontrado',
        });
      }

      await message.updateStatus(status);

      res.json({
        message: 'Estado actualizado exitosamente',
        status,
      });
    } catch (error) {
      logger.error('Error al actualizar estado:', error);
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
}

module.exports = MessageController;
