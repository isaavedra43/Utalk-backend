const twilio = require('twilio');
const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const { safeDateToISOString } = require('../utils/dateHelpers');
const { logger } = require('../utils/logger');
const ContactService = require('./ContactService');
const MessageStatus = require('../models/MessageStatus');
const axios = require('axios');
const admin = require('firebase-admin');

class TwilioService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    // VALIDACIÓN: Verificar configuración
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
   * FUNCIÓN PRINCIPAL: Procesar mensaje entrante desde webhook Twilio
   * Versión mejorada con manejo de fotos de perfil y metadatos avanzados
   */
  async processIncomingMessage(webhookData) {
    try {
      logger.info('🔄 INICIANDO procesamiento de mensaje entrante mejorado', {
        messageSid: webhookData.MessageSid,
        from: webhookData.From,
        to: webhookData.To,
        hasBody: !!webhookData.Body,
        hasProfileName: !!webhookData.ProfileName,
        hasWaId: !!webhookData.WaId,
        timestamp: safeDateToISOString(new Date()),
      });

      // PASO 1: Extraer y validar datos del webhook
      const {
        MessageSid: twilioSid,
        From: rawFromPhone,
        To: rawToPhone,
        Body: content,
        MediaUrl0: mediaUrl,
        MediaContentType0: mediaType,
        NumMedia: numMedia,
        ProfileName: profileName,
        WaId: waId,
        // Campos adicionales de Twilio
        AccountSid: accountSid,
        ApiVersion: apiVersion,
        Price: price,
        PriceUnit: priceUnit,
        NumSegments: numSegments,
        SmsStatus: smsStatus,
        SmsSid: smsSid,
        SmsMessageSid: smsMessageSid,
        ReferralNumMedia: referralNumMedia,
        ReferralNumSegments: referralNumSegments,
        ReferralIntegrationError: referralIntegrationError,
        ReferralTo: referralTo,
        ReferralFrom: referralFrom,
        ReferralMediaUrl: referralMediaUrl,
        ReferralMediaContentType: referralMediaContentType,
        ReferralMediaSize: referralMediaSize,
        ReferralMediaSid: referralMediaSid,
      } = webhookData;

      // VALIDACIÓN: Campos obligatorios
      if (!twilioSid) {
        throw new Error('MessageSid es requerido del webhook');
      }

      if (!rawFromPhone) {
        throw new Error('From es requerido del webhook');
      }

      if (!rawToPhone) {
        throw new Error('To es requerido del webhook');
      }

      // PASO 2: Normalizar números de teléfono
      const fromPhone = rawFromPhone;
      const toPhone = rawToPhone;

      // PASO 3: Determinar quién es cliente y quién es agente
      const businessPhone = this.whatsappNumber.replace('whatsapp:', '');
      const normalizedBusinessPhone = businessPhone;

      let customerPhone, agentPhone;
      
      if (fromPhone === normalizedBusinessPhone) {
        // Mensaje saliente del negocio al cliente
        customerPhone = toPhone;
        agentPhone = fromPhone;
      } else {
        // Mensaje entrante del cliente al negocio
        customerPhone = fromPhone;
        agentPhone = toPhone;
      }

      logger.info('📱 Teléfonos identificados', {
        customerPhone,
        agentPhone,
        businessPhone: normalizedBusinessPhone,
        direction: fromPhone === normalizedBusinessPhone ? 'outbound' : 'inbound',
      });

      // PASO 4: Procesar información de contacto (foto de perfil, etc.)
      const contactInfo = await this.processContactInfo(customerPhone, {
        profileName,
        waId,
        fromPhone,
        toPhone
      });

      // PASO 5: Crear estructura del mensaje con metadatos avanzados
      const hasMedia = parseInt(numMedia || 0) > 0;
      const messageType = hasMedia ? 'media' : 'text';
      const direction = fromPhone === normalizedBusinessPhone ? 'outbound' : 'inbound';
      const sender = direction === 'inbound' ? 'customer' : 'agent';

      const messageData = {
        id: twilioSid,
        senderPhone: fromPhone,
        recipientPhone: toPhone,
        content: content || (hasMedia ? '[Media]' : ''),
        mediaUrl: mediaUrl || null,
        direction,
        type: messageType,
        status: 'received',
        sender,
        timestamp: safeDateToISOString(new Date()),
        metadata: {
          twilioSid,
          mediaType: mediaType || null,
          numMedia: parseInt(numMedia || 0),
          profileName: profileName || null,
          waId: waId || null,
          receivedAt: safeDateToISOString(new Date()),
          webhook: {
            from: rawFromPhone,
            to: rawToPhone,
            processedAt: safeDateToISOString(new Date()),
          },
          // Metadatos avanzados de Twilio
          twilio: {
            accountSid,
            apiVersion,
            price: parseFloat(price) || null,
            priceUnit,
            numSegments: parseInt(numSegments) || null,
            smsStatus,
            smsSid,
            smsMessageSid,
            referralNumMedia: parseInt(referralNumMedia) || null,
            referralNumSegments: parseInt(referralNumSegments) || null,
            referralIntegrationError,
            referralTo,
            referralFrom,
            referralMediaUrl,
            referralMediaContentType,
            referralMediaSize: parseInt(referralMediaSize) || null,
            referralMediaSid
          },
          contact: contactInfo
        },
        createdAt: safeDateToISOString(new Date()),
        updatedAt: safeDateToISOString(new Date()),
      };

      logger.info('📨 Estructura del mensaje preparada con metadatos avanzados', {
        messageId: messageData.id,
        senderPhone: messageData.senderPhone,
        recipientPhone: messageData.recipientPhone,
        direction: messageData.direction,
        type: messageData.type,
        hasContent: !!messageData.content,
        hasMedia: !!messageData.mediaUrl,
        hasContactInfo: !!(profileName || waId),
        hasProfilePhoto: !!contactInfo.profilePhotoUrl
      });

      // PASO 6: Crear o actualizar conversación
      const conversation = await this.createOrUpdateConversation(customerPhone, agentPhone, messageData, contactInfo);

      // PASO 7: Guardar mensaje en Firestore
      const savedMessage = await this.saveMessageToFirestore(conversation.id, messageData);

      // PASO 8: Actualizar conversación con último mensaje
      await this.updateConversationLastMessage(conversation.id, savedMessage);

      // PASO 9: Crear status inicial del mensaje
      await this.createInitialMessageStatus(savedMessage, webhookData);

      // PASO 10: Emitir evento en tiempo real (Socket.IO)
      await this.emitRealTimeEvent(conversation.id, savedMessage);

      logger.info('✅ Mensaje procesado exitosamente con metadatos avanzados', {
        conversationId: conversation.id,
        messageId: savedMessage.id,
        customerPhone,
        agentPhone,
        direction: savedMessage.direction,
        timestamp: savedMessage.timestamp,
        hasContactInfo: !!(profileName || waId),
        hasProfilePhoto: !!contactInfo.profilePhotoUrl
      });

      return {
        success: true,
        conversation: conversation,
        message: savedMessage,
        contactInfo,
        webhookProcessed: true,
        timestamp: safeDateToISOString(new Date()),
      };

    } catch (error) {
      logger.error('❌ Error procesando mensaje entrante mejorado', {
        error: error.message,
        stack: error.stack,
        webhookData: {
          MessageSid: webhookData.MessageSid,
          From: webhookData.From,
          To: webhookData.To,
          Body: webhookData.Body ? 'presente' : 'ausente',
          ProfileName: webhookData.ProfileName ? 'presente' : 'ausente',
          WaId: webhookData.WaId ? 'presente' : 'ausente',
        },
        timestamp: safeDateToISOString(new Date()),
      });

      // Guardar error para debugging pero NO fallar el webhook
      await this.logWebhookError({
        error: error.message,
        webhookData,
        processedAt: safeDateToISOString(new Date()),
      });

      // Retornar error pero permitir que el webhook continue
      return {
        success: false,
        error: error.message,
        webhookProcessed: false,
        timestamp: safeDateToISOString(new Date()),
      };
    }
  }

  /**
   * Procesar información de contacto (foto de perfil, etc.)
   */
  async processContactInfo(phoneNumber, contactData) {
    try {
      const { profileName, waId, fromPhone, toPhone } = contactData;

      logger.info('👤 Procesando información de contacto', {
        phoneNumber,
        hasProfileName: !!profileName,
        hasWaId: !!waId
      });

      const contactInfo = {
        phoneNumber,
        profileName: profileName || null,
        waId: waId || null,
        profilePhotoUrl: null,
        profilePhotoDownloaded: false,
        lastUpdated: safeDateToISOString(new Date())
      };

      // Intentar descargar foto de perfil si está disponible
      if (profileName || waId) {
        try {
          const profilePhotoUrl = await this.getProfilePhotoUrl(phoneNumber);
          if (profilePhotoUrl) {
            contactInfo.profilePhotoUrl = profilePhotoUrl;
            contactInfo.profilePhotoDownloaded = true;
            
            logger.info('📸 Foto de perfil obtenida', {
              phoneNumber,
              profilePhotoUrl
            });
          }
        } catch (photoError) {
          logger.warn('⚠️ Error obteniendo foto de perfil', {
            phoneNumber,
            error: photoError.message
          });
        }
      }

      // Actualizar contacto en la base de datos
      await this.updateContactInDatabase(phoneNumber, contactInfo);

      return contactInfo;

    } catch (error) {
      logger.error('❌ Error procesando información de contacto', {
        phoneNumber,
        error: error.message
      });

      return {
        phoneNumber,
        profileName: null,
        waId: null,
        profilePhotoUrl: null,
        profilePhotoDownloaded: false,
        lastUpdated: safeDateToISOString(new Date())
      };
    }
  }

  /**
   * Obtener URL de foto de perfil de WhatsApp
   */
  async getProfilePhotoUrl(phoneNumber) {
    try {
      // Nota: Twilio no proporciona API directa para fotos de perfil de WhatsApp
      // Esta es una implementación de ejemplo que podría expandirse
      // con APIs de WhatsApp Business o servicios de terceros
      
      logger.info('🔍 Intentando obtener foto de perfil', { phoneNumber });

      // Por ahora, retornamos null ya que Twilio no expone esta funcionalidad
      // En el futuro, se podría integrar con WhatsApp Business API
      return null;

    } catch (error) {
      logger.error('Error obteniendo foto de perfil', {
        phoneNumber,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Actualizar contacto en la base de datos
   */
  async updateContactInDatabase(phoneNumber, contactInfo) {
    try {
      const contactsRef = firestore.collection('contacts');
      const contactQuery = await contactsRef.where('phone', '==', phoneNumber).limit(1).get();

      if (!contactQuery.empty) {
        // Actualizar contacto existente
        const contactDoc = contactQuery.docs[0];
        await contactDoc.ref.update({
          name: contactInfo.profileName || contactDoc.data().name,
          waId: contactInfo.waId || contactDoc.data().waId,
          profilePhotoUrl: contactInfo.profilePhotoUrl || contactDoc.data().profilePhotoUrl,
          lastUpdated: Timestamp.now(),
          updatedAt: FieldValue.serverTimestamp()
        });

        logger.info('✅ Contacto actualizado en base de datos', {
          phoneNumber,
          profileName: contactInfo.profileName,
          waId: contactInfo.waId,
          hasProfilePhoto: !!contactInfo.profilePhotoUrl
        });
      } else {
        // Crear nuevo contacto
        const newContact = {
          phone: phoneNumber,
          name: contactInfo.profileName || phoneNumber,
          waId: contactInfo.waId,
          profilePhotoUrl: contactInfo.profilePhotoUrl,
          channel: 'whatsapp',
          isActive: true,
          createdAt: Timestamp.now(),
          updatedAt: FieldValue.serverTimestamp(),
          lastContactAt: Timestamp.now()
        };

        await contactsRef.add(newContact);

        logger.info('✅ Nuevo contacto creado en base de datos', {
          phoneNumber,
          profileName: contactInfo.profileName,
          waId: contactInfo.waId,
          hasProfilePhoto: !!contactInfo.profilePhotoUrl
        });
      }

    } catch (error) {
      logger.error('❌ Error actualizando contacto en base de datos', {
        phoneNumber,
        error: error.message
      });
    }
  }

  /**
   * Crear status inicial del mensaje
   */
  async createInitialMessageStatus(message, webhookData) {
    try {
      const statusData = {
        messageId: message.id,
        twilioSid: message.metadata.twilioSid,
        status: 'received',
        metadata: {
          twilio: webhookData,
          webhook: {
            receivedAt: safeDateToISOString(new Date()),
            processedAt: safeDateToISOString(new Date())
          }
        },
        timestamp: Timestamp.now()
      };

      await MessageStatus.create(statusData);

      logger.info('📊 Status inicial creado', {
        messageId: message.id,
        twilioSid: message.metadata.twilioSid,
        status: 'received'
      });

    } catch (error) {
      logger.error('❌ Error creando status inicial', {
        messageId: message.id,
        error: error.message
      });
    }
  }

  /**
   * CREAR O ACTUALIZAR CONVERSACIÓN EN FIRESTORE CON ASIGNACIÓN AUTOMÁTICA
   * Versión mejorada con información de contacto
   */
  async createOrUpdateConversation(customerPhone, agentPhone, messageData, contactInfo) {
    try {
      // Generar ID de conversación consistente
      const conversationId = `conv_${customerPhone.replace('+', '')}_${agentPhone.replace('+', '')}`;

      logger.info('🔍 Buscando conversación existente', { conversationId });

      // Buscar conversación existente
      const conversationRef = firestore.collection('conversations').doc(conversationId);
      const conversationDoc = await conversationRef.get();

      if (conversationDoc.exists) {
        logger.info('📋 Conversación existente encontrada', { conversationId });
        
        // Actualizar contadores
        await conversationRef.update({
          messageCount: FieldValue.increment(1),
          unreadCount: messageData.direction === 'inbound' ? FieldValue.increment(1) : FieldValue.increment(0),
          updatedAt: Timestamp.now(),
        });

        return {
          id: conversationId,
          exists: true,
          ...conversationDoc.data(),
        };
      }

      // Crear nueva conversación con asignación automática de agente
      logger.info('🆕 Creando nueva conversación con información de contacto', { 
        conversationId, 
        customerPhone, 
        agentPhone,
        hasContactInfo: !!(contactInfo.profileName || contactInfo.waId)
      });

      // BUSCAR AGENTES DISPONIBLES PARA ASIGNACIÓN AUTOMÁTICA
      let assignedTo = null;
      try {
        // Primero, buscar agente por teléfono específico
        const agentByPhoneQuery = await firestore.collection('users')
          .where('phone', '==', agentPhone)
          .where('role', 'in', ['agent', 'admin'])
          .limit(1)
          .get();
        
        if (!agentByPhoneQuery.empty) {
          const agentData = agentByPhoneQuery.docs[0].data();
          assignedTo = {
            id: agentData.email || agentByPhoneQuery.docs[0].id,
            name: agentData.name || agentData.displayName || agentData.email || 'Agent',
          };
          
          logger.info('👤 Agente encontrado por teléfono específico', { 
            agentPhone, 
            assignedToId: assignedTo.id,
            assignedToName: assignedTo.name,
          });
        } else {
          // Si no hay agente con ese teléfono, buscar cualquier agente disponible
          logger.info('🔍 No se encontró agente específico, buscando agentes disponibles');
          
          const availableAgentsQuery = await firestore.collection('users')
            .where('role', 'in', ['agent', 'admin'])
            .where('isActive', '==', true)
            .limit(5)
            .get();
          
          if (!availableAgentsQuery.empty) {
            const firstAvailableAgent = availableAgentsQuery.docs[0].data();
            
            assignedTo = {
              id: firstAvailableAgent.email || availableAgentsQuery.docs[0].id,
              name: firstAvailableAgent.name || firstAvailableAgent.displayName || firstAvailableAgent.email || 'Agent',
            };
            
            logger.info('👤 Agente asignado automáticamente (primer disponible)', {
              assignedToId: assignedTo.id,
              assignedToName: assignedTo.name,
              totalAvailableAgents: availableAgentsQuery.size,
            });
          } else {
            logger.warn('⚠️ No se encontraron agentes disponibles - conversación sin asignar', { 
              conversationId,
              agentPhone,
              customerPhone,
            });
            assignedTo = null;
          }
        }
      } catch (userError) {
        logger.error('Error buscando agentes para asignación', { 
          agentPhone, 
          error: userError.message,
          stack: userError.stack,
        });
        assignedTo = null;
      }

      // Buscar o crear contacto para el cliente usando ContactService
      let contact;
      try {
        logger.info('🔄 Procesando contacto del cliente con información avanzada', { 
          customerPhone,
          hasProfileName: !!contactInfo.profileName,
          hasWaId: !!contactInfo.waId,
          hasProfilePhoto: !!contactInfo.profilePhotoUrl
        });
        
        // Preparar datos del mensaje para ContactService
        const messageDataForContact = {
          from: customerPhone,
          to: agentPhone,
          direction: 'inbound',
          timestamp: messageData.timestamp,
          metadata: {
            twilio: webhookData,
            profileName: contactInfo.profileName,
            waId: contactInfo.waId,
            profilePhotoUrl: contactInfo.profilePhotoUrl
          }
        };

        // Usar ContactService centralizado
        contact = await ContactService.createOrUpdateFromMessage(messageDataForContact, {
          conversationId: conversationId,
          userId: 'system'
        });

        logger.info('✅ Contacto procesado exitosamente con información avanzada', {
          contactId: contact.id,
          contactName: contact.name,
          contactPhone: contact.phone,
          isActive: contact.isActive,
          hasProfilePhoto: !!contactInfo.profilePhotoUrl
        });

      } catch (contactError) {
        logger.error('❌ Error procesando contacto del cliente', {
          customerPhone,
          error: contactError.message,
          stack: contactError.stack?.split('\n').slice(0, 3)
        });
        
        // Fallback: Contacto básico para evitar errores
        contact = {
          id: customerPhone,
          name: contactInfo.profileName || customerPhone,
          phone: customerPhone,
          avatar: contactInfo.profilePhotoUrl || null,
          channel: 'whatsapp',
          isActive: true,
          lastContactAt: messageData.timestamp,
          waId: contactInfo.waId
        };
      }

      // Estructura completa de la conversación según especificación
      const conversationData = {
        id: conversationId,
        participants: [customerPhone, agentPhone],
        customerPhone,
        agentPhone,
        assignedTo,
        status: 'open',
        contact,
        messageCount: 1,
        unreadCount: messageData.direction === 'inbound' ? 1 : 0,
        lastMessage: null,
        lastMessageId: null,
        lastMessageAt: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Guardar en Firestore
      await conversationRef.set(conversationData);

      logger.info('✅ Nueva conversación creada exitosamente con información avanzada', {
        conversationId,
        customerPhone,
        agentPhone,
        assignedToId: assignedTo?.id || 'null',
        assignedToName: assignedTo?.name || 'sin_asignar',
        messageCount: conversationData.messageCount,
        contactName: contact.name,
        hasProfilePhoto: !!contactInfo.profilePhotoUrl
      });

      return {
        id: conversationId,
        exists: false,
        ...conversationData,
      };

    } catch (error) {
      logger.error('Error creando/actualizando conversación', {
        error: error.message,
        stack: error.stack,
        customerPhone,
        agentPhone,
      });
      throw error;
    }
  }

  /**
   * GUARDAR MENSAJE EN FIRESTORE COMO SUBCOLECCIÓN
   * Versión mejorada con metadatos avanzados
   */
  async saveMessageToFirestore(conversationId, messageData) {
    try {
      logger.info('💾 Guardando mensaje en Firestore con metadatos avanzados', {
        conversationId,
        messageId: messageData.id,
        hasContactInfo: !!(messageData.metadata.contact),
        hasTwilioMetadata: !!(messageData.metadata.twilio)
      });

      // Referencia a la subcolección de mensajes
      const messageRef = firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .doc(messageData.id);

      // Agregar conversationId al mensaje
      const messageToSave = {
        ...messageData,
        conversationId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Guardar en Firestore
      await messageRef.set(messageToSave);

      logger.info('✅ Mensaje guardado exitosamente con metadatos avanzados', {
        conversationId,
        messageId: messageData.id,
        direction: messageData.direction,
        type: messageData.type,
        hasContactInfo: !!(messageData.metadata.contact),
        hasTwilioMetadata: !!(messageData.metadata.twilio)
      });

      return messageToSave;

    } catch (error) {
      logger.error('❌ Error guardando mensaje en Firestore', {
        error: error.message,
        stack: error.stack,
        conversationId,
        messageId: messageData.id,
      });
      throw error;
    }
  }

  /**
   * ACTUALIZAR CONVERSACIÓN CON ÚLTIMO MENSAJE
   */
  async updateConversationLastMessage(conversationId, savedMessage) {
    try {
      const conversationRef = firestore.collection('conversations').doc(conversationId);

      const lastMessageData = {
        id: savedMessage.id,
        content: savedMessage.content,
        timestamp: savedMessage.timestamp,
        sender: savedMessage.sender,
        type: savedMessage.type,
      };

      await conversationRef.update({
        lastMessage: lastMessageData,
        lastMessageId: savedMessage.id,
        lastMessageAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      logger.info('✅ Conversación actualizada con último mensaje', {
        conversationId,
        lastMessageId: savedMessage.id,
      });

    } catch (error) {
      logger.error('❌ Error actualizando último mensaje de conversación', {
        error: error.message,
        conversationId,
        messageId: savedMessage.id,
      });
      // No lanzar error, es una operación secundaria
    }
  }

  /**
   * EMITIR EVENTO EN TIEMPO REAL (SOCKET.IO)
   */
  async emitRealTimeEvent(conversationId, savedMessage) {
    try {
      // Importar dinámicamente para evitar dependencias circulares
      const socketService = require('../socket');
      
      if (socketService && typeof socketService.emitNewMessage === 'function') {
        socketService.emitNewMessage(savedMessage);
        
        logger.info('📡 Evento Socket.IO emitido', {
          conversationId,
          messageId: savedMessage.id,
          direction: savedMessage.direction,
        });
      } else {
        logger.warn('⚠️ Socket.IO no disponible - mensaje guardado sin tiempo real');
      }

    } catch (socketError) {
      logger.error('❌ Error emitiendo evento Socket.IO', {
        error: socketError.message,
        conversationId,
        messageId: savedMessage.id,
      });
      // No lanzar error, es una operación secundaria
    }
  }

  /**
   * ENVIAR MENSAJE DE WHATSAPP
   * Versión mejorada con tracking de status
   */
  async sendWhatsAppMessage(toPhone, message, mediaUrl = null) {
    try {
      // VALIDACIÓN: Normalizar números de teléfono
      const toValidation = { isValid: true, normalized: toPhone };
      if (!toValidation.isValid) {
        throw new Error(`Número de destino inválido: ${toValidation.error}`);
      }

      const fromValidation = { isValid: true, normalized: this.whatsappNumber };
      if (!fromValidation.isValid) {
        throw new Error(`Número de Twilio inválido: ${fromValidation.error}`);
      }

      const normalizedToPhone = toValidation.normalized;
      const normalizedFromPhone = fromValidation.normalized;

      // CONSTRUIR MENSAJE PARA TWILIO
      const twilioMessage = {
        from: `whatsapp:${normalizedFromPhone}`,
        to: `whatsapp:${normalizedToPhone}`,
        body: message,
      };

      // AGREGAR MEDIA SI EXISTE
      if (mediaUrl) {
        twilioMessage.mediaUrl = [mediaUrl];
      }

      logger.info('📤 Enviando mensaje WhatsApp via Twilio', {
        to: normalizedToPhone,
        from: normalizedFromPhone,
        hasMedia: !!mediaUrl,
        messageLength: message.length,
      });

      // ENVIAR MENSAJE
      const sentMessage = await this.client.messages.create(twilioMessage);

      // ESTRUCTURA CORRECTA: Usar senderPhone/recipientPhone
      const messageData = {
        id: sentMessage.sid,
        senderPhone: normalizedFromPhone,
        recipientPhone: normalizedToPhone,
        content: message,
        mediaUrl: mediaUrl,
        direction: 'outbound',
        type: mediaUrl ? 'media' : 'text',
        status: 'sent',
        sender: 'agent',
        timestamp: safeDateToISOString(new Date()),
        metadata: {
          twilioSid: sentMessage.sid,
          twilioStatus: sentMessage.status,
          twilioErrorCode: sentMessage.errorCode,
          twilioErrorMessage: sentMessage.errorMessage,
          sentAt: safeDateToISOString(new Date()),
        },
        createdAt: safeDateToISOString(new Date()),
        updatedAt: safeDateToISOString(new Date()),
      };

      logger.info('✅ Mensaje WhatsApp enviado exitosamente', {
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
      logger.error('❌ Error enviando mensaje WhatsApp', {
        error: error.message,
        toPhone,
        mediaUrl: !!mediaUrl,
        stack: error.stack,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * LOG DE ERRORES DE WEBHOOK
   */
  async logWebhookError(errorData) {
    try {
      const logData = {
        ...errorData,
        loggedAt: Timestamp.now(),
        source: 'twilio_webhook',
        environment: process.env.NODE_ENV || 'unknown',
      };

      await firestore
        .collection('webhook_errors')
        .add(logData);

      logger.info('📝 Error de webhook guardado en Firestore', {
        errorMessage: errorData.error,
        timestamp: errorData.processedAt,
      });

    } catch (error) {
      logger.error('❌ Error guardando log de webhook en Firestore', {
        error: error.message,
        originalErrorData: errorData,
      });
    }
  }
}

// INSTANCIA SINGLETON
let twilioServiceInstance = null;

/**
 * FUNCIÓN PARA OBTENER INSTANCIA SINGLETON
 */
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

/**
 * FUNCIÓN ESTÁTICA PARA COMPATIBILIDAD
 */
async function processIncomingMessage(webhookData) {
  const service = getTwilioService();
  return await service.processIncomingMessage(webhookData);
}

// EXPORTACIÓN COMPLETA CON TODAS LAS FUNCIONES
module.exports = {
  TwilioService,
  getTwilioService,
  processIncomingMessage,
};
