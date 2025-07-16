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

      // ✅ RAILWAY LOGGING: Visible en Railway console
      console.log('📨 PROCESANDO MENSAJE ENTRANTE', {
        from: From,
        to: To,
        messageSid: MessageSid,
        hasBody: !!Body,
        numMedia: NumMedia || 0,
      });

      logger.info('Procesando mensaje entrante', {
        from: From,
        to: To,
        messageSid: MessageSid,
      });

      // ✅ VALIDACIÓN CRÍTICA: Verificar campos requeridos
      if (!From || !To || !MessageSid) {
        const error = new Error('Campos requeridos faltantes en webhook');
        console.error('❌ WEBHOOK - Campos requeridos faltantes:', {
          hasFrom: !!From,
          hasTo: !!To,
          hasMessageSid: !!MessageSid,
          receivedFields: Object.keys(webhookData),
        });
        throw error;
      }

      // Verificar que no sea un mensaje duplicado
      let existingMessage;
      try {
        existingMessage = await Message.getByTwilioSid(MessageSid);
      } catch (firebaseError) {
        console.error('❌ FIREBASE - Error verificando duplicado:', {
          error: firebaseError.message,
          messageSid: MessageSid,
        });
        // Continuar procesamiento aunque falle la verificación
      }

      if (existingMessage) {
        console.log('⚠️ MENSAJE DUPLICADO detectado:', { twilioSid: MessageSid });
        logger.warn('Mensaje duplicado recibido', { twilioSid: MessageSid });
        return existingMessage;
      }

      // Limpiar números de teléfono
      const fromPhone = From.replace('whatsapp:', '');
      const toPhone = To.replace('whatsapp:', '');

      console.log('📞 NÚMEROS PROCESADOS:', {
        originalFrom: From,
        cleanFrom: fromPhone,
        originalTo: To,
        cleanTo: toPhone,
      });

      // ✅ BUSCAR O CREAR CONTACTO con manejo robusto
      let contact;
      try {
        contact = await Contact.getByPhone(fromPhone);
        if (!contact) {
          console.log('👤 CREANDO NUEVO CONTACTO:', { phone: fromPhone });
          contact = await Contact.create({
            name: fromPhone, // Se puede actualizar después
            phone: fromPhone,
            userId: null, // Se asignará cuando un agente responda
          });
          console.log('✅ CONTACTO CREADO:', {
            contactId: contact.id,
            phone: fromPhone,
          });
          logger.info('Nuevo contacto creado automáticamente', {
            contactId: contact.id,
            phone: fromPhone,
          });
        } else {
          console.log('✅ CONTACTO EXISTENTE encontrado:', { contactId: contact.id });
        }
      } catch (contactError) {
        console.error('❌ ERROR EN CONTACTO:', {
          error: contactError.message,
          phone: fromPhone,
          action: 'create_or_find',
        });
        
        // Crear contacto básico como fallback
        contact = {
          id: `temp_${Date.now()}`,
          phone: fromPhone,
          name: fromPhone,
        };
        console.log('⚠️ CONTACTO TEMPORAL creado como fallback');
      }

      // ✅ PROCESAR MULTIMEDIA con manejo robusto
      const mediaUrls = [];
      const numMedia = parseInt(NumMedia) || 0;

      console.log('🎬 PROCESANDO MULTIMEDIA:', { numMedia });

      for (let i = 0; i < numMedia; i++) {
        try {
          const mediaUrl = webhookData[`MediaUrl${i}`];
          const mediaContentType = webhookData[`MediaContentType${i}`];

          if (mediaUrl) {
            mediaUrls.push({
              url: mediaUrl,
              contentType: mediaContentType,
              index: i,
            });
            console.log(`✅ MEDIA ${i} procesado:`, {
              url: mediaUrl.substring(0, 50) + '...',
              contentType: mediaContentType,
            });
          }
        } catch (mediaError) {
          console.error(`❌ ERROR procesando media ${i}:`, {
            error: mediaError.message,
            mediaUrl: webhookData[`MediaUrl${i}`],
          });
          // Continuar con siguiente media
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

      console.log('📝 TIPO DE MENSAJE determinado:', { 
        messageType, 
        hasText: !!Body,
        mediaCount: mediaUrls.length,
      });

      // ✅ CREAR MENSAJE con datos completos y manejo de errores
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

      console.log('💾 GUARDANDO MENSAJE EN FIREBASE:', {
        messageType,
        contentLength: messageData.content.length,
        mediaCount: mediaUrls.length,
        twilioSid: MessageSid,
      });

      // ✅ GUARDAR EN FIREBASE con manejo robusto
      let message;
      try {
        message = await Message.create(messageData);
        console.log('✅ MENSAJE GUARDADO EXITOSAMENTE:', {
          messageId: message.id,
          twilioSid: MessageSid,
          from: fromPhone,
          to: toPhone,
          type: messageType,
        });
      } catch (firebaseError) {
        console.error('❌ FIREBASE - Error guardando mensaje:', {
          error: firebaseError.message,
          stack: firebaseError.stack.split('\n')[0],
          messageData: {
            from: fromPhone,
            to: toPhone,
            twilioSid: MessageSid,
            type: messageType,
          },
        });
        throw new Error(`Firebase save failed: ${firebaseError.message}`);
      }

      // ✅ LOG FINAL DE ÉXITO
      console.log('🎉 WEBHOOK PROCESADO COMPLETAMENTE:', {
        messageId: message.id,
        contactId: contact.id,
        processedAt: new Date().toISOString(),
      });

      logger.info('Mensaje entrante procesado exitosamente', {
        messageId: message.id,
        from: fromPhone,
        contactId: contact.id,
      });

      return message;

    } catch (error) {
      // ❌ ERROR FINAL: Log completo pero no lanzar excepción
      console.error('❌ TWILIO SERVICE - Error procesando mensaje:', {
        error: error.message,
        stack: error.stack.split('\n').slice(0, 3), // Primeras 3 líneas del stack
        webhookData: {
          from: webhookData?.From,
          to: webhookData?.To,
          messageSid: webhookData?.MessageSid,
        },
        timestamp: new Date().toISOString(),
      });

      logger.error('Error procesando mensaje entrante', {
        error: error.message,
        stack: error.stack,
        webhookData,
      });

      // ✅ RE-LANZAR ERROR: Para que el controlador lo maneje
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
