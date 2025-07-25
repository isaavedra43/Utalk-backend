const { client, twilioConfig } = require('../config/twilio');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const MediaService = require('./MediaService');
const logger = require('../utils/logger');
const { generateConversationId, normalizePhoneNumber } = require('../utils/conversation');

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

      // Normalizar números de teléfono
      const fromPhone = normalizePhoneNumber(twilioConfig.whatsappNumber);
      const toPhone = normalizePhoneNumber(to);

      // Generar conversationId consistente
      const conversationId = generateConversationId(fromPhone, toPhone);

      // Guardar mensaje en Firestore
      const messageData = {
        id: message.sid, // ✅ ASIGNAR ID usando twilioSid
        conversationId, // CRÍTICO: Siempre asignar
        senderPhone: fromPhone, // ✅ CAMPO CORRECTO: senderPhone
        recipientPhone: toPhone, // ✅ CAMPO CORRECTO: recipientPhone
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
        const fromPhone = normalizePhoneNumber(twilioConfig.whatsappNumber);
        const toPhone = normalizePhoneNumber(to);
        const conversationId = generateConversationId(fromPhone, toPhone);

        await Message.create({
          id: `failed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // ✅ ID para mensaje fallido
          conversationId, // CRÍTICO: Siempre asignar
          senderPhone: fromPhone, // ✅ CAMPO CORRECTO: senderPhone
          recipientPhone: toPhone, // ✅ CAMPO CORRECTO: recipientPhone
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

      // Normalizar números de teléfono
      const fromPhone = normalizePhoneNumber(twilioConfig.whatsappNumber);
      const toPhone = normalizePhoneNumber(to);

      // Generar conversationId consistente
      const conversationId = generateConversationId(fromPhone, toPhone);

      const messageData = {
        id: message.sid, // ✅ ASIGNAR ID usando twilioSid
        conversationId, // CRÍTICO: Siempre asignar
        senderPhone: fromPhone, // ✅ CAMPO CORRECTO: senderPhone
        recipientPhone: toPhone, // ✅ CAMPO CORRECTO: recipientPhone
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

      // ✅ LOG CENTRALIZADO: Información del mensaje entrante
      logger.info('Procesando mensaje entrante', {
        from: From,
        to: To,
        messageSid: MessageSid,
        hasBody: !!Body,
        numMedia: NumMedia || 0,
      });

      // ✅ VALIDACIÓN CRÍTICA: Verificar campos requeridos
      if (!From || !To || !MessageSid) {
        const error = new Error('Campos requeridos faltantes en webhook');
        logger.error('Webhook - Campos requeridos faltantes', {
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
        logger.error('Firebase - Error verificando duplicado', {
          error: firebaseError.message,
          messageSid: MessageSid,
        });
        // Continuar procesamiento aunque falle la verificación
      }

      if (existingMessage) {
        logger.warn('Mensaje duplicado recibido', { twilioSid: MessageSid });
        return existingMessage;
      }

      // ✅ NORMALIZAR NÚMEROS usando utilidad consistente
      const fromPhone = normalizePhoneNumber(From);
      const toPhone = normalizePhoneNumber(To);

      // ✅ VALIDACIÓN: Verificar que los números se normalizaron correctamente
      if (!fromPhone) {
        logger.error('No se pudo normalizar número del remitente', { original: From });
        throw new Error('Número del remitente inválido');
      }

      if (!toPhone) {
        logger.error('No se pudo normalizar número del destinatario', { original: To });
        throw new Error('Número del destinatario inválido');
      }

      // ✅ LOG DE NÚMEROS NORMALIZADOS
      logger.info('Números normalizados', {
        originalFrom: From,
        normalizedFrom: fromPhone,
        originalTo: To,
        normalizedTo: toPhone,
      });

      // ✅ GENERAR conversationId CONSISTENTE (CRÍTICO)
      const conversationId = generateConversationId(fromPhone, toPhone);

      // ✅ BUSCAR O CREAR CONTACTO con manejo robusto
      let contact;
      try {
        contact = await Contact.getByPhone(fromPhone);
        if (!contact) {
          logger.info('Nuevo contacto creado automáticamente', {
            contactId: contact.id,
            phone: fromPhone,
          });
          contact = await Contact.create({
            name: fromPhone, // Se puede actualizar después
            phone: fromPhone,
            userId: null, // Se asignará cuando un agente responda
          });
          logger.info('Contacto creado', {
            contactId: contact.id,
            phone: fromPhone,
          });
        } else {
          logger.info('Contacto existente encontrado', { contactId: contact.id });
        }
      } catch (contactError) {
        logger.error('Error en Contacto', {
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
        logger.warn('Contacto temporal creado como fallback');
      }

      // ✅ PROCESAR MULTIMEDIA con manejo robusto y almacenamiento permanente
      const mediaUrls = [];
      const processedMedia = [];
      const numMedia = parseInt(NumMedia) || 0;

      for (let i = 0; i < numMedia; i++) {
        try {
          const mediaUrl = webhookData[`MediaUrl${i}`];
          const mediaContentType = webhookData[`MediaContentType${i}`];

          if (mediaUrl) {
            // Guardar URL original para compatibilidad
            mediaUrls.push({
              url: mediaUrl,
              contentType: mediaContentType,
              index: i,
            });

            // ✅ PROCESAR Y GUARDAR MULTIMEDIA PERMANENTEMENTE
            try {
              const processedMediaInfo = await MediaService.processWebhookMedia(
                mediaUrl,
                MessageSid,
                i,
              );

              processedMedia.push(processedMediaInfo);
            } catch (mediaProcessError) {
              logger.error(`Error procesando media ${i}`, {
                error: mediaProcessError.message,
                stack: mediaProcessError.stack,
                mediaUrl,
                messageSid: MessageSid,
              });

              // Continuar con URL original si falla el procesamiento
              // El mensaje se guardará con la URL de Twilio como fallback
            }
          }
        } catch (mediaError) {
          logger.error(`Error general procesando media ${i}`, {
            error: mediaError.message,
            messageSid: MessageSid,
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

      // ✅ CREAR MENSAJE con datos completos y manejo de errores
      const messageData = {
        id: MessageSid, // ✅ ASIGNAR ID INMEDIATAMENTE usando twilioSid
        conversationId, // CRÍTICO: SIEMPRE asignar conversationId
        senderPhone: fromPhone, // ✅ CAMPO CORRECTO: senderPhone
        recipientPhone: toPhone, // ✅ CAMPO CORRECTO: recipientPhone
        content: Body || '',
        type: messageType,
        direction: 'inbound',
        status: 'received',
        twilioSid: MessageSid,
        mediaUrls: mediaUrls.map(m => m.url),
        metadata: {
          numMedia,
          mediaInfo: mediaUrls,
          processedMedia, // URLs permanentes y metadata
          profileName: webhookData.ProfileName,
          waId: webhookData.WaId,
          originalWebhookData: {
            AccountSid: webhookData.AccountSid,
            ApiVersion: webhookData.ApiVersion,
            MessageStatus: webhookData.MessageStatus,
          },
        },
      };

      // ✅ LOG DE DATOS DEL MENSAJE ANTES DE GUARDAR
      logger.info('Preparando mensaje para guardar', {
        messageId: messageData.id,
        conversationId: messageData.conversationId,
        senderPhone: messageData.senderPhone,
        recipientPhone: messageData.recipientPhone,
        type: messageData.type,
        hasContent: !!messageData.content,
        mediaCount: messageData.mediaUrls.length,
      });

      // ✅ GUARDAR EN FIREBASE con manejo robusto
      let message;
      try {
        message = await Message.create(messageData);

        // ✅ CREAR O ACTUALIZAR CONVERSACIÓN (CRÍTICO)
        try {
          await this.createOrUpdateConversation(conversationId, message, contact);
        } catch (conversationError) {
          logger.error('Error actualizando conversación', {
            conversationId,
            messageId: message.id,
            error: conversationError.message,
          });
        }

        // ✅ EMITIR EVENTO DE TIEMPO REAL (CRÍTICO)
        try {
          if (global.socketManager) {
            global.socketManager.emitNewMessage(conversationId, message.toJSON());
          } else {
            logger.warn('Socket.IO no disponible - mensaje guardado sin tiempo real');
          }
        } catch (socketError) {
          logger.error('Error emitiendo evento Socket.IO', {
            conversationId,
            messageId: message.id,
            error: socketError.message,
          });
        }
      } catch (firebaseError) {
        logger.error('Firebase - Error guardando mensaje', {
          error: firebaseError.message,
          stack: firebaseError.stack.split('\n')[0],
          messageData: {
            senderPhone: fromPhone,
            recipientPhone: toPhone,
            twilioSid: MessageSid,
            type: messageType,
          },
        });
        throw new Error(`Firebase save failed: ${firebaseError.message}`);
      }

      // ✅ LOG FINAL DE ÉXITO
      logger.info('Mensaje entrante procesado exitosamente', {
        messageId: message.id,
        senderPhone: fromPhone,
        recipientPhone: toPhone,
        contactId: contact.id,
      });

      return message;
    } catch (error) {
      // ❌ ERROR FINAL: Log completo pero no lanzar excepción
      logger.error('Twilio Service - Error procesando mensaje', {
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
   * ✅ CORREGIDO: Logs detallados para debugging de firma
   */
  static validateWebhook (signature, url, params) {
    try {
      // ✅ LOG DETALLADO para debugging
      console.log('🔐 TwilioService.validateWebhook - Iniciando validación:', {
        hasSignature: !!signature,
        url,
        authTokenConfigured: !!twilioConfig.authToken,
        environment: process.env.NODE_ENV,
        paramCount: Object.keys(params).length,
        sampleParams: Object.keys(params).slice(0, 5),
      });

      if (!twilioConfig.authToken) {
        console.log('⚠️ TWILIO_AUTH_TOKEN no configurado - saltando validación');
        logger.warn('TWILIO_AUTH_TOKEN no configurado - validación de firma deshabilitada');
        return true; // En desarrollo, permitir sin validación
      }

      if (!signature) {
        console.log('⚠️ X-Twilio-Signature ausente - saltando validación en desarrollo');
        logger.warn('Cabecera X-Twilio-Signature ausente en la solicitud');
        return process.env.NODE_ENV !== 'production'; // Solo permitir en desarrollo
      }

      const twilio = require('twilio');

      // ✅ LOG URL COMPLETA para verificar exactitud
      console.log('🔗 URL completa para validación:', url);

      // Convertir params a el formato esperado por Twilio
      const formattedParams = {};
      Object.keys(params).forEach(key => {
        // Twilio espera que todos los valores sean strings
        formattedParams[key] = String(params[key] || '');
      });

      // ✅ LOG PARÁMETROS FORMATEADOS
      console.log('📋 Parámetros formateados para Twilio:', {
        originalParamCount: Object.keys(params).length,
        formattedParamCount: Object.keys(formattedParams).length,
        sampleFormatted: Object.fromEntries(
          Object.entries(formattedParams).slice(0, 3),
        ),
      });

      // ✅ VALIDACIÓN TWILIO con firma
      const isValid = twilio.validateRequest(
        twilioConfig.authToken,
        signature,
        url,
        formattedParams,
      );

      if (!isValid) {
        console.log('❌ Validación de firma Twilio FALLÓ');
        logger.error('Validación de firma Twilio falló', {
          url,
          signaturePresent: !!signature,
          paramKeys: Object.keys(formattedParams),
          environment: process.env.NODE_ENV,
        });
      } else {
        console.log('✅ Validación de firma Twilio EXITOSA');
        logger.info('Validación de firma Twilio exitosa');
      }

      return isValid;
    } catch (error) {
      console.error('❌ Error validando firma de webhook Twilio:', {
        error: error.message,
        stack: error.stack?.split('\n')[0],
        url,
        hasSignature: !!signature,
      });

      logger.error('Error validando firma de webhook Twilio', {
        error: error.message,
        stack: error.stack,
        url,
        signaturePresent: !!signature,
      });

      // En caso de error, permitir en desarrollo, rechazar en producción
      const allowOnError = process.env.NODE_ENV !== 'production';
      console.log(allowOnError ? '⚠️ Permitiendo por error en desarrollo' : '❌ Rechazando por error en producción');
      return allowOnError;
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
   * ✅ CORREGIDO: Crear o actualizar conversación cuando llega un mensaje
   * SIEMPRE garantiza que el campo assignedTo esté presente
   */
  static async createOrUpdateConversation (conversationId, message, contact) {
    try {
      // Intentar obtener conversación existente
      let conversation = await Conversation.getById(conversationId);

      if (conversation) {
        // Actualizar conversación existente
        await conversation.updateLastMessage(message);
      } else {
        // ✅ CREAR NUEVA CONVERSACIÓN CON ASIGNACIÓN AUTOMÁTICA
        const customerPhone = contact?.phone || message.senderPhone;
        const agentPhone = message.recipientPhone;

        const conversationData = {
          id: conversationId,
          participants: [customerPhone, agentPhone],
          lastMessage: message.content || '[Multimedia]',
          lastMessageAt: message.timestamp,
          lastMessageId: message.id,
          messageCount: 1,
          unreadCount: message.direction === 'inbound' ? 1 : 0,
          customerPhone,
          agentPhone,
          status: 'open',
          priority: 'normal',
          tags: contact?.tags || [],
          metadata: {
            contactId: contact?.id,
            firstMessageId: message.id,
            createdFromWebhook: true,
            twilioSid: message.twilioSid,
          },
          // ✅ NOTA: assignedTo se asignará automáticamente en Conversation.createOrUpdate()
        };

        logger.info('Creando nueva conversación desde webhook', {
          conversationId,
          customerPhone,
          agentPhone,
          messageId: message.id,
          direction: message.direction,
        });

        conversation = await Conversation.createOrUpdate(conversationData);

        logger.info('Conversación creada exitosamente desde webhook', {
          conversationId,
          assignedTo: conversation.assignedTo,
          customerPhone,
        });
      }

      return conversation;
    } catch (error) {
      logger.error('Error en createOrUpdateConversation', {
        error: error.message,
        conversationId,
        messageId: message.id,
      });
      throw error;
    }
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
