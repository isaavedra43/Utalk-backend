const { client, twilioConfig } = require('../config/twilio');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const logger = require('../utils/logger');

class TwilioService {
  /**
   * Enviar mensaje de WhatsApp
   */
  static async sendWhatsAppMessage (to, content, userId = null) {
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
        to,
        content,
        type: 'text',
        direction: 'outbound',
        status: 'sent',
        twilioSid: message.sid,
        userId,
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
        messageId: savedMessage.id,
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
          to,
          content,
          type: 'text',
          direction: 'outbound',
          status: 'failed',
          userId,
          metadata: { error: error.message },
        });
      }

      throw error;
    }
  }

  /**
   * Enviar mensaje con media (imagen, documento)
   */
  static async sendMediaMessage (to, mediaUrl, caption = '', userId = null) {
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
        to,
        content: caption,
        type,
        direction: 'outbound',
        status: 'sent',
        twilioSid: message.sid,
        mediaUrls: [mediaUrl],
        userId,
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
        messageId: savedMessage.id,
      });

      return {
        success: true,
        messageId: savedMessage.id,
        twilioSid: message.sid,
        status: message.status,
        type,
      };
    } catch (error) {
      logger.error('Error al enviar mensaje con media:', error);
      throw error;
    }
  }

  /**
   * Procesar webhook de mensaje entrante
   */
  static async processIncomingMessage (webhookData) {
    try {
      const { From, To, Body, MessageSid, NumMedia } = webhookData;

      logger.info('Procesando mensaje entrante', {
        from: From,
        to: To,
        messageSid: MessageSid,
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
          phone: fromPhone,
        });
      }

      // Procesar archivos multimedia si existen
      const mediaUrls = [];
      const numMedia = parseInt(NumMedia) || 0;

      for (let i = 0; i < numMedia; i++) {
        const mediaUrl = webhookData[`MediaUrl${i}`];
        const mediaContentType = webhookData[`MediaContentType${i}`];

        if (mediaUrl) {
          mediaUrls.push({
            url: mediaUrl,
            contentType: mediaContentType,
            index: i,
          });
        }
      }

      // Determinar tipo de mensaje basado en contenido
      let messageType = 'text';
      if (numMedia > 0) {
        const firstMedia = webhookData.MediaContentType0 || '';
        if (firstMedia.startsWith('image/')) {
          messageType = 'image';
        } else if (firstMedia.startsWith('audio/')) {
          messageType = 'audio';
        } else if (firstMedia.startsWith('video/')) {
          messageType = 'video';
        } else {
          messageType = 'document';
        }
      }

      // Crear mensaje con todos los campos requeridos
      const messageData = {
        from: fromPhone,
        to: toPhone,
        content: Body || '',
        type: messageType,
        direction: 'inbound',
        status: 'received',
        twilioSid: MessageSid,
        mediaUrls: mediaUrls.map(m => m.url),
        metadata: {
          numMedia,
          mediaInfo: mediaUrls,
          profileName: webhookData.ProfileName,
          waId: webhookData.WaId,
          originalWebhookData: {
            AccountSid: webhookData.AccountSid,
            ApiVersion: webhookData.ApiVersion,
            MessageStatus: webhookData.MessageStatus,
          },
        },
      };

      const message = await Message.create(messageData);

      // Actualizar último contacto
      await contact.updateLastContact();

      logger.info('Mensaje entrante procesado', {
        messageId: message.id,
        contactId: contact.id,
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
  static async getMessageStatus (twilioSid) {
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
  static async updateMessageStatus (twilioSid, status) {
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
   * Validar webhook de Twilio con manejo robusto de errores
   */
  static validateWebhook (signature, url, params) {
    try {
      if (!twilioConfig.authToken) {
        logger.warn('TWILIO_AUTH_TOKEN no configurado - validación de firma deshabilitada');
        return true; // En desarrollo, permitir sin validación
      }

      if (!signature) {
        logger.warn('Cabecera X-Twilio-Signature ausente en la solicitud');
        return process.env.NODE_ENV !== 'production'; // Solo permitir en desarrollo
      }

      const twilio = require('twilio');

      // Convertir params a el formato esperado por Twilio
      const formattedParams = {};
      Object.keys(params).forEach(key => {
        // Twilio espera que todos los valores sean strings
        formattedParams[key] = String(params[key] || '');
      });

      const isValid = twilio.validateRequest(
        twilioConfig.authToken,
        signature,
        url,
        formattedParams,
      );

      if (!isValid) {
        logger.error('Validación de firma Twilio falló', {
          url,
          signaturePresent: !!signature,
          paramKeys: Object.keys(formattedParams),
          environment: process.env.NODE_ENV,
        });
      } else {
        logger.info('Validación de firma Twilio exitosa');
      }

      return isValid;
    } catch (error) {
      logger.error('Error validando firma de webhook Twilio', {
        error: error.message,
        stack: error.stack,
        url,
        signaturePresent: !!signature,
      });

      // En caso de error, fallar seguro en producción
      return process.env.NODE_ENV !== 'production';
    }
  }

  /**
   * Generar firma Twilio para testing
   */
  static generateTestSignature (url, params) {
    try {
      if (!twilioConfig.authToken) {
        throw new Error('TWILIO_AUTH_TOKEN no configurado');
      }

      const twilio = require('twilio');
      return twilio.webhook.generateSignature(twilioConfig.authToken, url, params);
    } catch (error) {
      logger.error('Error generando firma de test', { error: error.message });
      throw error;
    }
  }

  /**
   * Determinar tipo de media por URL
   */
  static getMediaType (mediaUrl) {
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
  static async sendBulkMessages (contacts, message, userId) {
    const results = [];
    const delay = 1000; // 1 segundo entre mensajes para evitar rate limiting

    for (const contact of contacts) {
      try {
        await new Promise(resolve => setTimeout(resolve, delay));

        const result = await this.sendWhatsAppMessage(
          contact.phone,
          message,
          userId,
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
  static async getAccountInfo () {
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
