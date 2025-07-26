const { v4: uuidv4 } = require('uuid');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { getTwilioService } = require('../services/TwilioService');
const logger = require('../utils/logger');
const {
  createMessagesPaginatedResponse,
  validatePaginationParams,
} = require('../utils/pagination');

class MessageController {
  /**
   * ✅ EMAIL-FIRST: Maneja el webhook de Twilio.
   * Mapea el teléfono entrante a una conversación y guarda el mensaje.
   */
  static async handleWebhookSafe (req, res) {
    const { From: fromPhone, To: twilioPhone, Body: content, MessageSid: messageSid, NumMedia: numMedia } = req.body;
    
    try {
      // 1. Encontrar o crear la conversación basada en el teléfono del cliente.
      const conversation = await Conversation.findOrCreate(fromPhone);
      
      // 2. Preparar los datos del mensaje.
      const messageData = {
        id: messageSid,
        conversationId: conversation.id,
        content: content,
        senderIdentifier: fromPhone,
        recipientIdentifier: conversation.assignedTo || twilioPhone, // EMAIL del agente o número de Twilio
        direction: 'inbound',
        status: 'received',
        metadata: { twilio: req.body },
      };

      // Si hay media, añadir la URL (esto requiere lógica adicional en TwilioService para construir la URL)
      if (parseInt(numMedia) > 0) {
          messageData.mediaUrl = `URL_DE_MEDIA_PARA_${messageSid}`; // Placeholder
          messageData.type = 'media';
      }

      // 3. Crear el mensaje en la base de datos.
      const message = await Message.create(messageData);

      // 4. Emitir por WebSocket (si está implementado)
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.emitNewMessage(conversation.id, message.toJSON());
      }
      
      logger.info('Webhook procesado exitosamente (EMAIL-FIRST)', { conversationId: conversation.id, messageId: message.id });

    } catch (error) {
      logger.error('Error crítico en webhook (EMAIL-FIRST)', { error: error.message, stack: error.stack });
    }
    
    // 5. Responder SIEMPRE 200 OK a Twilio.
    res.status(200).send('<Response/>');
  }
  
  /**
   * ✅ EMAIL-FIRST: Enviar un mensaje saliente.
   */
  static async sendMessage (req, res, next) {
    try {
      const { conversationId, content, mediaUrl } = req.body;
      const senderEmail = req.user.email;

      if (!conversationId || !content) {
        return res.status(400).json({ error: 'conversationId y content son requeridos.' });
      }

      // 1. Obtener la conversación.
      const conversation = await Conversation.getById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversación no encontrada.' });
      }

      // 2. Enviar el mensaje a través de Twilio.
      const twilioService = getTwilioService();
      const sentMessage = await twilioService.sendWhatsAppMessage(
        conversation.customerPhone,
        content
      );

      // 3. Guardar el mensaje en nuestra base de datos.
      const messageData = {
        id: sentMessage.sid,
        conversationId: conversation.id,
        content: content,
        senderIdentifier: senderEmail, // Email del agente
        recipientIdentifier: conversation.customerPhone, // Teléfono del cliente
        direction: 'outbound',
        status: 'sent',
        metadata: { sentBy: senderEmail },
      };
      
      const message = await Message.create(messageData);
      
      // 4. Emitir por WebSocket
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
          socketManager.emitNewMessage(conversation.id, message.toJSON());
      }

      res.status(201).json({ success: true, data: message.toJSON() });

    } catch (error) {
      logger.error('Error enviando mensaje (EMAIL-FIRST)', { error: error.message, stack: error.stack });
      next(error);
    }
  }

  /**
   * ✅ EMAIL-FIRST: Obtener mensajes de una conversación.
   */
  static async getMessages (req, res, next) {
    try {
        const { conversationId } = req.params;
        const { limit = 50, cursor = null } = req.query;

        if(!conversationId) {
            return res.status(400).json({ error: "conversationId es requerido." });
        }
        
        const result = await Message.getByConversation(conversationId, {
            limit: parseInt(limit),
            cursor,
        });

        res.json({
            success: true,
            data: result.messages.map(m => m.toJSON()),
            pagination: result.pagination,
        });

    } catch (error) {
        logger.error('Error obteniendo mensajes (EMAIL-FIRST)', { error: error.message });
        next(error);
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
