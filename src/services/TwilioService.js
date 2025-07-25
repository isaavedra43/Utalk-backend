const twilio = require('twilio');
const logger = require('../utils/logger');
const { validateAndNormalizePhone } = require('../utils/phoneValidation');
const { safeDateToISOString } = require('../utils/dateHelpers');

class TwilioService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    // ✅ VALIDACIÓN: Verificar configuración
    if (!this.accountSid || !this.authToken || !this.whatsappNumber) {
      logger.error('Configuración de Twilio incompleta', {
        hasAccountSid: !!this.accountSid,
        hasAuthToken: !!this.authToken,
        hasWhatsappNumber: !!this.whatsappNumber,
      });
      throw new Error('Configuración de Twilio incompleta');
    }

    this.client = twilio(this.accountSid, this.authToken);
    
    logger.info('TwilioService inicializado correctamente', {
      whatsappNumber: this.whatsappNumber,
    });
  }

  /**
   * ✅ CORREGIDO: Enviar mensaje de WhatsApp con estructura correcta
   * Usa senderPhone/recipientPhone en lugar de from/to para consistencia
   */
  async sendWhatsAppMessage(toPhone, message, mediaUrl = null) {
    try {
      // ✅ VALIDACIÓN: Normalizar números de teléfono
      const toValidation = validateAndNormalizePhone(toPhone);
      if (!toValidation.isValid) {
        throw new Error(`Número de destino inválido: ${toValidation.error}`);
      }

      const fromValidation = validateAndNormalizePhone(this.whatsappNumber);
      if (!fromValidation.isValid) {
        throw new Error(`Número de Twilio inválido: ${fromValidation.error}`);
      }

      const normalizedToPhone = toValidation.normalized;
      const normalizedFromPhone = fromValidation.normalized;

      // ✅ CONSTRUIR MENSAJE PARA TWILIO
      const twilioMessage = {
        from: `whatsapp:${normalizedFromPhone}`,
        to: `whatsapp:${normalizedToPhone}`,
        body: message,
      };

      // ✅ AGREGAR MEDIA SI EXISTE
      if (mediaUrl) {
        twilioMessage.mediaUrl = [mediaUrl];
      }

      logger.info('Enviando mensaje WhatsApp via Twilio', {
        to: normalizedToPhone,
        from: normalizedFromPhone,
        hasMedia: !!mediaUrl,
        messageLength: message.length,
      });

      // ✅ ENVIAR MENSAJE
      const sentMessage = await this.client.messages.create(twilioMessage);

      // ✅ ESTRUCTURA CORRECTA: Usar senderPhone/recipientPhone
      const messageData = {
        id: sentMessage.sid,
        senderPhone: normalizedFromPhone, // ✅ CAMPO CORRECTO
        recipientPhone: normalizedToPhone, // ✅ CAMPO CORRECTO
        content: message,
        mediaUrl: mediaUrl,
        direction: 'outbound',
        type: mediaUrl ? 'media' : 'text',
        status: 'sent',
        sender: 'agent',
        timestamp: safeDateToISOString(new Date()), // ✅ FECHA COMO STRING ISO
        metadata: {
          twilioSid: sentMessage.sid,
          twilioStatus: sentMessage.status,
          twilioErrorCode: sentMessage.errorCode,
          twilioErrorMessage: sentMessage.errorMessage,
          sentAt: safeDateToISOString(new Date()), // ✅ FECHA COMO STRING ISO
        },
      };

      logger.info('Mensaje WhatsApp enviado exitosamente', {
        twilioSid: sentMessage.sid,
        senderPhone: messageData.senderPhone,
        recipientPhone: messageData.recipientPhone,
        status: sentMessage.status,
        direction: messageData.direction,
      });

      return {
        success: true,
        messageData,
        twilioResponse: sentMessage,
      };

    } catch (error) {
      logger.error('Error enviando mensaje WhatsApp', {
        error: error.message,
        toPhone,
        mediaUrl: !!mediaUrl,
        stack: error.stack,
      });

      // ✅ ESTRUCTURA DE ERROR CONSISTENTE
      const errorMessageData = {
        senderPhone: this.whatsappNumber?.replace('whatsapp:', ''),
        recipientPhone: toPhone,
        content: message,
        mediaUrl: mediaUrl,
        direction: 'outbound',
        type: 'text',
        status: 'failed',
        sender: 'agent',
        timestamp: safeDateToISOString(new Date()), // ✅ FECHA COMO STRING ISO
        metadata: {
          error: error.message,
          failedAt: safeDateToISOString(new Date()), // ✅ FECHA COMO STRING ISO
        },
      };

      return {
        success: false,
        error: error.message,
        messageData: errorMessageData,
      };
    }
  }

  /**
   * ✅ CORREGIDO: Enviar mensaje multimedia con estructura correcta
   */
  async sendMediaMessage(toPhone, caption, mediaUrl) {
    try {
      return await this.sendWhatsAppMessage(toPhone, caption, mediaUrl);
    } catch (error) {
      logger.error('Error enviando mensaje multimedia', {
        error: error.message,
        toPhone,
        mediaUrl,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * ✅ CORREGIDO: Procesar mensaje entrante con estructura correcta
   * Maneja webhooks de Twilio y convierte a estructura estándar
   */
  async processIncomingMessage(webhookData) {
    try {
      // ✅ EXTRAER DATOS DEL WEBHOOK
      const {
        MessageSid: twilioSid,
        From: rawFromPhone,
        To: rawToPhone,
        Body: content,
        MediaUrl0: mediaUrl,
        MediaContentType0: mediaType,
        NumMedia: numMedia,
      } = webhookData;

      // ✅ VALIDACIÓN: Campos requeridos
      if (!twilioSid || !rawFromPhone || !rawToPhone) {
        throw new Error('Datos de webhook incompletos');
      }

      // ✅ NORMALIZAR NÚMEROS DE TELÉFONO
      const fromValidation = validateAndNormalizePhone(rawFromPhone);
      const toValidation = validateAndNormalizePhone(rawToPhone);

      if (!fromValidation.isValid) {
        throw new Error(`Número remitente inválido: ${fromValidation.error}`);
      }

      if (!toValidation.isValid) {
        throw new Error(`Número destinatario inválido: ${toValidation.error}`);
      }

      const fromPhone = fromValidation.normalized;
      const toPhone = toValidation.normalized;

      // ✅ DETERMINAR TIPO DE MENSAJE
      const hasMedia = parseInt(numMedia) > 0;
      const messageType = hasMedia ? 'media' : 'text';

      // ✅ ESTRUCTURA CORRECTA: Usar senderPhone/recipientPhone
      const messageData = {
        id: twilioSid,
        senderPhone: fromPhone, // ✅ CAMPO CORRECTO
        recipientPhone: toPhone, // ✅ CAMPO CORRECTO
        content: content || (hasMedia ? '[Media]' : ''),
        mediaUrl: mediaUrl || null,
        direction: 'inbound',
        type: messageType,
        status: 'received',
        sender: 'customer',
        timestamp: safeDateToISOString(new Date()), // ✅ FECHA COMO STRING ISO
        metadata: {
          twilioSid,
          mediaType: mediaType || null,
          numMedia: parseInt(numMedia) || 0,
          receivedAt: safeDateToISOString(new Date()), // ✅ FECHA COMO STRING ISO
          webhook: {
            from: rawFromPhone,
            to: rawToPhone,
            processedAt: safeDateToISOString(new Date()), // ✅ FECHA COMO STRING ISO
          },
        },
      };

      logger.info('Preparando mensaje entrante para guardar', {
        twilioSid,
        senderPhone: messageData.senderPhone, // ✅ LOGGING CORRECTO
        recipientPhone: messageData.recipientPhone, // ✅ LOGGING CORRECTO
        direction: messageData.direction,
        type: messageData.type,
        hasMedia,
      });

      // ✅ CREAR O ACTUALIZAR CONVERSACIÓN
      await this.createOrUpdateConversation(messageData);

      // ✅ GUARDAR MENSAJE
      const Message = require('../models/Message');
      const savedMessage = await Message.create(messageData);

      logger.info('Mensaje entrante procesado exitosamente', {
        messageId: savedMessage.id,
        conversationId: savedMessage.conversationId,
        senderPhone: savedMessage.senderPhone, // ✅ LOGGING CORRECTO
        recipientPhone: savedMessage.recipientPhone, // ✅ LOGGING CORRECTO
        direction: savedMessage.direction,
        timestamp: savedMessage.timestamp,
      });

      // ✅ EMITIR EVENTO EN TIEMPO REAL
      const socketService = require('../socket');
      socketService.emitNewMessage(savedMessage);

      return {
        success: true,
        message: savedMessage,
        conversation: savedMessage.conversationId,
      };

    } catch (error) {
      logger.error('Error procesando mensaje entrante', {
        error: error.message,
        webhookData,
        stack: error.stack,
      });

      // ✅ MENSAJE DE ERROR CON ESTRUCTURA CORRECTA
      const errorData = {
        error: error.message,
        webhookData,
        processedAt: safeDateToISOString(new Date()), // ✅ FECHA COMO STRING ISO
        senderPhone: webhookData.From ? validateAndNormalizePhone(webhookData.From).normalized : null,
        recipientPhone: webhookData.To ? validateAndNormalizePhone(webhookData.To).normalized : null,
      };

      // Guardar error en logs para debugging
      try {
        await this.logWebhookError(errorData);
      } catch (logError) {
        logger.error('Error guardando log de webhook', {
          originalError: error.message,
          logError: logError.message,
        });
      }

      throw error;
    }
  }

  /**
   * ✅ CORREGIDO: Crear o actualizar conversación desde mensaje
   * Usa senderPhone/recipientPhone para determinar participantes
   */
  async createOrUpdateConversation(message) {
    try {
      const Conversation = require('../models/Conversation');
      const Contact = require('../models/Contact');

      // ✅ DETERMINAR TELÉFONOS USANDO CAMPOS CORRECTOS
      const customerPhone = message.senderPhone; // ✅ CAMPO CORRECTO
      const agentPhone = message.recipientPhone; // ✅ CAMPO CORRECTO

      // ✅ GENERAR ID DE CONVERSACIÓN
      const conversationId = `conv_${customerPhone.replace('+', '')}_${agentPhone.replace('+', '')}`;

      // ✅ BUSCAR CONTACTO EXISTENTE
      let contact = null;
      try {
        contact = await Contact.getByPhone(customerPhone);
        logger.info('Contacto encontrado', {
          phone: customerPhone,
          contactId: contact?.id,
          contactName: contact?.name,
        });
      } catch (contactError) {
        logger.warn('Error buscando contacto o contacto no encontrado', {
          phone: customerPhone,
          error: contactError.message,
        });
        
        // ✅ CREAR CONTACTO BÁSICO SI NO EXISTE
        contact = {
          id: customerPhone,
          name: customerPhone,
          phone: customerPhone,
          avatar: null,
          channel: 'whatsapp',
        };
      }

      // ✅ BUSCAR CONVERSACIÓN EXISTENTE
      let conversation = await Conversation.getById(conversationId);

      if (conversation) {
        // ✅ ACTUALIZAR ÚLTIMA ACTIVIDAD
        await conversation.updateLastMessage(message);
        logger.info('Conversación existente actualizada', {
          conversationId,
          messageId: message.id,
        });
      } else {
        // ✅ CREAR NUEVA CONVERSACIÓN
        const conversationData = {
          id: conversationId,
          participants: [customerPhone, agentPhone],
          customerPhone,
          agentPhone,
          contact,
          status: 'open',
          // ✅ IMPORTANTE: NO asignar automáticamente, dejar para asignación manual
          assignedTo: null, // Se asignará manualmente por un admin
        };

        logger.info('Creando nueva conversación desde mensaje entrante', {
          conversationId,
          customerPhone,
          agentPhone,
          assignedTo: 'null (asignación_manual_requerida)',
        });

        conversation = await Conversation.createOrUpdate(conversationData);
        
        logger.info('Nueva conversación creada exitosamente', {
          conversationId: conversation.id,
          customerPhone: conversation.customerPhone,
          agentPhone: conversation.agentPhone,
          assignedTo: conversation.assignedTo,
        });
      }

      return conversation;

    } catch (error) {
      logger.error('Error creando/actualizando conversación', {
        error: error.message,
        messageData: {
          senderPhone: message.senderPhone, // ✅ LOGGING CORRECTO
          recipientPhone: message.recipientPhone, // ✅ LOGGING CORRECTO
          id: message.id,
        },
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * ✅ MEJORADO: Log de errores de webhook
   */
  async logWebhookError(errorData) {
    try {
      const { firestore } = require('../config/firebase');
      
      const logData = {
        ...errorData,
        loggedAt: safeDateToISOString(new Date()), // ✅ FECHA COMO STRING ISO
        source: 'twilio_webhook',
        environment: process.env.NODE_ENV || 'unknown',
      };

      await firestore
        .collection('webhook_errors')
        .add(logData);

      logger.info('Error de webhook guardado en Firestore', {
        errorMessage: errorData.error,
        twilioSid: errorData.webhookData?.MessageSid,
        timestamp: logData.loggedAt,
      });

    } catch (error) {
      logger.error('Error guardando log de webhook en Firestore', {
        error: error.message,
        originalErrorData: errorData,
      });
    }
  }

  /**
   * ✅ NUEVO: Validar configuración de Twilio
   */
  async validateConfiguration() {
    try {
      // ✅ VERIFICAR CREDENCIALES
      const account = await this.client.api.accounts(this.accountSid).fetch();
      
      logger.info('Configuración de Twilio validada', {
        accountSid: this.accountSid,
        accountStatus: account.status,
        friendlyName: account.friendlyName,
      });

      return {
        valid: true,
        account: {
          sid: account.sid,
          status: account.status,
          friendlyName: account.friendlyName,
        },
      };

    } catch (error) {
      logger.error('Error validando configuración de Twilio', {
        error: error.message,
        accountSid: this.accountSid,
      });

      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * ✅ NUEVO: Obtener estado de mensaje por SID
   */
  async getMessageStatus(messageSid) {
    try {
      const message = await this.client.messages(messageSid).fetch();
      
      return {
        sid: message.sid,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateCreated: safeDateToISOString(message.dateCreated), // ✅ FECHA COMO STRING ISO
        dateSent: safeDateToISOString(message.dateSent), // ✅ FECHA COMO STRING ISO
        dateUpdated: safeDateToISOString(message.dateUpdated), // ✅ FECHA COMO STRING ISO
      };

    } catch (error) {
      logger.error('Error obteniendo estado de mensaje', {
        messageSid,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * ✅ NUEVO: Listar mensajes recientes
   */
  async getRecentMessages(limit = 20) {
    try {
      const messages = await this.client.messages.list({
        limit,
        dateSentAfter: new Date(Date.now() - 24 * 60 * 60 * 1000), // Últimas 24 horas
      });

      return messages.map(msg => ({
        sid: msg.sid,
        from: msg.from,
        to: msg.to,
        body: msg.body,
        status: msg.status,
        direction: msg.direction,
        dateCreated: safeDateToISOString(msg.dateCreated), // ✅ FECHA COMO STRING ISO
        dateSent: safeDateToISOString(msg.dateSent), // ✅ FECHA COMO STRING ISO
        dateUpdated: safeDateToISOString(msg.dateUpdated), // ✅ FECHA COMO STRING ISO
      }));

    } catch (error) {
      logger.error('Error obteniendo mensajes recientes', {
        error: error.message,
        limit,
      });
      throw error;
    }
  }
}

// ✅ INSTANCIA SINGLETON
let twilioServiceInstance = null;

function getTwilioService() {
  if (!twilioServiceInstance) {
    try {
      twilioServiceInstance = new TwilioService();
    } catch (error) {
      logger.error('Error inicializando TwilioService', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
  return twilioServiceInstance;
}

module.exports = {
  TwilioService,
  getTwilioService,
};
