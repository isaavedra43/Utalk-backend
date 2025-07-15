const { client, twilioConfig } = require('../config/twilio');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const logger = require('../utils/logger');

class TwilioService {
  /**
   * Enviar mensaje de WhatsApp
   */
  static async sendWhatsAppMessage(to, content, userId = null) {
    try {
      logger.info('Enviando mensaje WhatsApp', { to, content: content.substring(0, 50) });

      const message = await client.messages.create({
        from: twilioConfig.whatsappNumber,
        to: `whatsapp:${to}`,
        body: content,
      });

      // Guardar mensaje en Firestore
      const messageData = {
        from: twilioConfig.whatsappNumber.replace('whatsapp:', ''),
        to: to,
        content: content,
        type: 'text',
        direction: 'outbound',
        status: 'sent',
        twilioSid: message.sid,
        userId: userId,
      };

      const savedMessage = await Message.create(messageData);

      // Actualizar último contacto del contacto
      const contact = await Contact.getByPhone(to);
      if (contact) {
        await contact.updateLastContact();
      }

      logger.info('Mensaje enviado exitosamente', { 
        twilioSid: message.sid,
        to,
        messageId: savedMessage.id 
      });

      return {
        success: true,
        messageId: savedMessage.id,
        twilioSid: message.sid,
        status: message.status,
      };
    } catch (error) {
      logger.error('Error al enviar mensaje WhatsApp:', error);
      
      // Guardar mensaje fallido
      if (userId) {
        await Message.create({
          from: twilioConfig.whatsappNumber.replace('whatsapp:', ''),
          to: to,
          content: content,
          type: 'text',
          direction: 'outbound',
          status: 'failed',
          userId: userId,
          metadata: { error: error.message },
        });
      }

      throw error;
    }
  }

  /**
   * Enviar mensaje con media (imagen, documento)
   */
  static async sendMediaMessage(to, mediaUrl, caption = '', userId = null) {
    try {
      logger.info('Enviando mensaje con media', { to, mediaUrl, caption });

      const message = await client.messages.create({
        from: twilioConfig.whatsappNumber,
        to: `whatsapp:${to}`,
        body: caption,
        mediaUrl: [mediaUrl],
      });

      // Determinar tipo de media
      const type = this.getMediaType(mediaUrl);

      const messageData = {
        from: twilioConfig.whatsappNumber.replace('whatsapp:', ''),
        to: to,
        content: caption,
        type: type,
        direction: 'outbound',
        status: 'sent',
        twilioSid: message.sid,
        mediaUrls: [mediaUrl],
        userId: userId,
      };

      const savedMessage = await Message.create(messageData);

      // Actualizar contacto
      const contact = await Contact.getByPhone(to);
      if (contact) {
        await contact.updateLastContact();
      }

      logger.info('Mensaje con media enviado', { 
        twilioSid: message.sid,
        type,
        messageId: savedMessage.id 
      });

      return {
        success: true,
        messageId: savedMessage.id,
        twilioSid: message.sid,
        status: message.status,
        type: type,
      };
    } catch (error) {
      logger.error('Error al enviar mensaje con media:', error);
      throw error;
    }
  }

  /**
   * Procesar webhook de mensaje entrante
   */
  static async processIncomingMessage(webhookData) {
    try {
      const { From, To, Body, MessageSid, NumMedia } = webhookData;
      
      logger.info('Procesando mensaje entrante', { 
        from: From, 
        to: To, 
        messageSid: MessageSid 
      });

      // Verificar que no sea un mensaje duplicado
      const existingMessage = await Message.getByTwilioSid(MessageSid);
      if (existingMessage) {
        logger.warn('Mensaje duplicado recibido', { twilioSid: MessageSid });
        return existingMessage;
      }

      // Limpiar números de teléfono
      const fromPhone = From.replace('whatsapp:', '');
      const toPhone = To.replace('whatsapp:', '');

      // Buscar o crear contacto
      let contact = await Contact.getByPhone(fromPhone);
      if (!contact) {
        contact = await Contact.create({
          name: fromPhone, // Se puede actualizar después
          phone: fromPhone,
          userId: null, // Se asignará cuando un agente responda
        });
        logger.info('Nuevo contacto creado automáticamente', { 
          contactId: contact.id, 
          phone: fromPhone 
        });
      }

      // Crear mensaje
      const messageData = {
        from: fromPhone,
        to: toPhone,
        content: Body || '',
        type: parseInt(NumMedia) > 0 ? 'image' : 'text', // Simplificado
        direction: 'inbound',
        status: 'received',
        twilioSid: MessageSid,
      };

      const message = await Message.create(messageData);

      // Actualizar último contacto
      await contact.updateLastContact();

      logger.info('Mensaje entrante procesado', { 
        messageId: message.id,
        contactId: contact.id 
      });

      return message;
    } catch (error) {
      logger.error('Error al procesar mensaje entrante:', error);
      throw error;
    }
  }

  /**
   * Obtener estado de un mensaje
   */
  static async getMessageStatus(twilioSid) {
    try {
      const message = await client.messages(twilioSid).fetch();
      return {
        sid: message.sid,
        status: message.status,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
      };
    } catch (error) {
      logger.error('Error al obtener estado del mensaje:', error);
      throw error;
    }
  }

  /**
   * Actualizar estado de mensaje desde webhook
   */
  static async updateMessageStatus(twilioSid, status) {
    try {
      const message = await Message.getByTwilioSid(twilioSid);
      if (message) {
        await message.updateStatus(status);
        logger.info('Estado de mensaje actualizado', { twilioSid, status });
      }
    } catch (error) {
      logger.error('Error al actualizar estado del mensaje:', error);
    }
  }

  /**
   * Validar webhook de Twilio
   */
  static validateWebhook(signature, url, params) {
    const twilio = require('twilio');
    return twilio.validateRequest(
      twilioConfig.authToken,
      signature,
      url,
      params
    );
  }

  /**
   * Determinar tipo de media por URL
   */
  static getMediaType(mediaUrl) {
    const url = mediaUrl.toLowerCase();
    if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.gif')) {
      return 'image';
    }
    if (url.includes('.pdf') || url.includes('.doc') || url.includes('.docx')) {
      return 'document';
    }
    if (url.includes('.mp3') || url.includes('.wav') || url.includes('.ogg')) {
      return 'audio';
    }
    if (url.includes('.mp4') || url.includes('.mov') || url.includes('.avi')) {
      return 'video';
    }
    return 'document'; // Por defecto
  }

  /**
   * Enviar mensaje masivo (para campañas)
   */
  static async sendBulkMessages(contacts, message, userId) {
    const results = [];
    const delay = 1000; // 1 segundo entre mensajes para evitar rate limiting

    for (const contact of contacts) {
      try {
        await new Promise(resolve => setTimeout(resolve, delay));
        
        const result = await this.sendWhatsAppMessage(
          contact.phone,
          message,
          userId
        );
        
        results.push({
          contactId: contact.id,
          phone: contact.phone,
          success: true,
          messageId: result.messageId,
        });
      } catch (error) {
        results.push({
          contactId: contact.id,
          phone: contact.phone,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Obtener información de la cuenta Twilio
   */
  static async getAccountInfo() {
    try {
      const account = await client.api.accounts(twilioConfig.accountSid).fetch();
      return {
        friendlyName: account.friendlyName,
        status: account.status,
        type: account.type,
        dateCreated: account.dateCreated,
      };
    } catch (error) {
      logger.error('Error al obtener información de la cuenta:', error);
      throw error;
    }
  }
}

module.exports = TwilioService; 