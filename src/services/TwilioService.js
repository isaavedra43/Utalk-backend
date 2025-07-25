const twilio = require('twilio');
const logger = require('../utils/logger');
const { validateAndNormalizePhone } = require('../utils/phoneValidation');
const { safeDateToISOString } = require('../utils/dateHelpers');
const { firestore, FieldValue, Timestamp } = require('../config/firebase');

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
   * ✅ FUNCIÓN PRINCIPAL: Procesar mensaje entrante desde webhook Twilio
   * Esta es la función que faltaba y causaba el error
   * @param {Object} webhookData - Datos del webhook de Twilio
   * @returns {Object} - Resultado del procesamiento
   */
  async processIncomingMessage(webhookData) {
    try {
      logger.info('🔄 INICIANDO procesamiento de mensaje entrante', {
        messageSid: webhookData.MessageSid,
        from: webhookData.From,
        to: webhookData.To,
        hasBody: !!webhookData.Body,
        timestamp: safeDateToISOString(new Date()),
      });

      // ✅ PASO 1: Extraer y validar datos del webhook
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
      } = webhookData;

      // ✅ VALIDACIÓN: Campos obligatorios
      if (!twilioSid) {
        throw new Error('MessageSid es requerido del webhook');
      }

      if (!rawFromPhone) {
        throw new Error('From es requerido del webhook');
      }

      if (!rawToPhone) {
        throw new Error('To es requerido del webhook');
      }

      // ✅ PASO 2: Normalizar números de teléfono
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

      // ✅ PASO 3: Determinar quién es cliente y quién es agente
      const businessPhone = this.whatsappNumber.replace('whatsapp:', '');
      const normalizedBusinessPhone = validateAndNormalizePhone(businessPhone).normalized;

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

      // ✅ PASO 4: Crear estructura del mensaje
      const hasMedia = parseInt(numMedia || 0) > 0;
      const messageType = hasMedia ? 'media' : 'text';
      const direction = fromPhone === normalizedBusinessPhone ? 'outbound' : 'inbound';
      const sender = direction === 'inbound' ? 'customer' : 'agent';

      const messageData = {
        id: twilioSid,
        senderPhone: fromPhone, // ✅ CAMPO CORRECTO
        recipientPhone: toPhone, // ✅ CAMPO CORRECTO
        content: content || (hasMedia ? '[Media]' : ''),
        mediaUrl: mediaUrl || null,
        direction,
        type: messageType,
        status: 'received',
        sender,
        timestamp: safeDateToISOString(new Date()), // ✅ FECHA COMO STRING ISO
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
        },
        createdAt: safeDateToISOString(new Date()), // ✅ FECHA COMO STRING ISO
        updatedAt: safeDateToISOString(new Date()), // ✅ FECHA COMO STRING ISO
      };

      logger.info('📨 Estructura del mensaje preparada', {
        messageId: messageData.id,
        senderPhone: messageData.senderPhone,
        recipientPhone: messageData.recipientPhone,
        direction: messageData.direction,
        type: messageData.type,
        hasContent: !!messageData.content,
        hasMedia: !!messageData.mediaUrl,
      });

      // ✅ PASO 5: Crear o actualizar conversación
      const conversation = await this.createOrUpdateConversation(customerPhone, agentPhone, messageData);

      // ✅ PASO 6: Guardar mensaje en Firestore
      const savedMessage = await this.saveMessageToFirestore(conversation.id, messageData);

      // ✅ PASO 7: Actualizar conversación con último mensaje
      await this.updateConversationLastMessage(conversation.id, savedMessage);

      // ✅ PASO 8: Emitir evento en tiempo real (Socket.IO)
      await this.emitRealTimeEvent(conversation.id, savedMessage);

      logger.info('✅ Mensaje procesado exitosamente', {
        conversationId: conversation.id,
        messageId: savedMessage.id,
        customerPhone,
        agentPhone,
        direction: savedMessage.direction,
        timestamp: savedMessage.timestamp,
      });

      return {
        success: true,
        conversation: conversation,
        message: savedMessage,
        webhookProcessed: true,
        timestamp: safeDateToISOString(new Date()),
      };

    } catch (error) {
      logger.error('❌ Error procesando mensaje entrante', {
        error: error.message,
        stack: error.stack,
        webhookData: {
          MessageSid: webhookData.MessageSid,
          From: webhookData.From,
          To: webhookData.To,
          Body: webhookData.Body ? 'presente' : 'ausente',
        },
        timestamp: safeDateToISOString(new Date()),
      });

      // ✅ Guardar error para debugging pero NO fallar el webhook
      await this.logWebhookError({
        error: error.message,
        webhookData,
        processedAt: safeDateToISOString(new Date()),
      });

      // ✅ Retornar error pero permitir que el webhook continue
      return {
        success: false,
        error: error.message,
        webhookProcessed: false,
        timestamp: safeDateToISOString(new Date()),
      };
    }
  }

  /**
   * ✅ CREAR O ACTUALIZAR CONVERSACIÓN EN FIRESTORE CON ASIGNACIÓN AUTOMÁTICA
   */
  async createOrUpdateConversation(customerPhone, agentPhone, messageData) {
    try {
      // ✅ Generar ID de conversación consistente
      const conversationId = `conv_${customerPhone.replace('+', '')}_${agentPhone.replace('+', '')}`;

      logger.info('🔍 Buscando conversación existente', { conversationId });

      // ✅ Buscar conversación existente
      const conversationRef = firestore.collection('conversations').doc(conversationId);
      const conversationDoc = await conversationRef.get();

      if (conversationDoc.exists) {
        logger.info('📋 Conversación existente encontrada', { conversationId });
        
        // ✅ Actualizar contadores
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

      // ✅ Crear nueva conversación con asignación automática de agente
      logger.info('🆕 Creando nueva conversación', { conversationId, customerPhone, agentPhone });

      // ✅ BUSCAR AGENTES DISPONIBLES PARA ASIGNACIÓN AUTOMÁTICA
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
            id: agentData.uid || agentByPhoneQuery.docs[0].id, // ✅ UID REAL
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
            // ✅ ESTRATEGIA: Asignar al primer agente disponible
            // TODO: Implementar estrategias más sofisticadas (round-robin, carga balanceada, etc.)
            const firstAvailableAgent = availableAgentsQuery.docs[0].data();
            
            assignedTo = {
              id: firstAvailableAgent.uid || availableAgentsQuery.docs[0].id,
              name: firstAvailableAgent.name || firstAvailableAgent.displayName || firstAvailableAgent.email || 'Agent',
            };
            
            logger.info('👤 Agente asignado automáticamente (primer disponible)', {
              assignedToId: assignedTo.id,
              assignedToName: assignedTo.name,
              totalAvailableAgents: availableAgentsQuery.size,
            });
          } else {
            // ✅ FALLBACK: Sin agentes disponibles, dejar sin asignar
            logger.warn('⚠️ No se encontraron agentes disponibles - conversación sin asignar', { 
              conversationId,
              agentPhone,
              customerPhone,
            });
            assignedTo = null;
          }
        }
      } catch (userError) {
        logger.error('❌ Error buscando agentes para asignación', { 
          agentPhone, 
          error: userError.message,
          stack: userError.stack,
        });
        assignedTo = null;
      }

      // ✅ Buscar o crear contacto para el cliente
      let contact;
      try {
        const contactQuery = await firestore.collection('contacts')
          .where('phone', '==', customerPhone)
          .limit(1)
          .get();
        
        if (!contactQuery.empty) {
          contact = contactQuery.docs[0].data();
        } else {
          // Crear contacto básico
          contact = {
            id: customerPhone,
            name: customerPhone, // Se puede actualizar después
            phone: customerPhone,
            avatar: null,
            channel: 'whatsapp',
            isActive: true,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
          
          await firestore.collection('contacts').doc(customerPhone).set(contact);
          logger.info('📇 Nuevo contacto creado', { customerPhone });
        }
      } catch (contactError) {
        logger.error('❌ Error gestionando contacto', {
          customerPhone,
          error: contactError.message,
        });
        
        // Fallback: Contacto básico
        contact = {
          id: customerPhone,
          name: customerPhone,
          avatar: null,
          channel: 'whatsapp',
        };
      }

      // ✅ Estructura completa de la conversación según especificación
      const conversationData = {
        id: conversationId,
        participants: [customerPhone, agentPhone], // ✅ Array de teléfonos únicos
        customerPhone, // ✅ Campo obligatorio
        agentPhone, // ✅ Campo obligatorio
        assignedTo, // ✅ UID real o null
        status: 'open',
        contact,
        messageCount: 1,
        unreadCount: messageData.direction === 'inbound' ? 1 : 0,
        lastMessage: null, // Se actualizará después
        lastMessageId: null, // Se actualizará después
        lastMessageAt: null, // Se actualizará después
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // ✅ Guardar en Firestore
      await conversationRef.set(conversationData);

      logger.info('✅ Nueva conversación creada exitosamente', {
        conversationId,
        customerPhone,
        agentPhone,
        assignedToId: assignedTo?.id || 'null',
        assignedToName: assignedTo?.name || 'sin_asignar',
        messageCount: conversationData.messageCount,
        contactName: contact.name,
      });

      return {
        id: conversationId,
        exists: false,
        ...conversationData,
      };

    } catch (error) {
      logger.error('❌ Error creando/actualizando conversación', {
        error: error.message,
        stack: error.stack,
        customerPhone,
        agentPhone,
      });
      throw error;
    }
  }

  /**
   * ✅ GUARDAR MENSAJE EN FIRESTORE COMO SUBCOLECCIÓN
   */
  async saveMessageToFirestore(conversationId, messageData) {
    try {
      logger.info('💾 Guardando mensaje en Firestore', {
        conversationId,
        messageId: messageData.id,
      });

      // ✅ Referencia a la subcolección de mensajes
      const messageRef = firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .doc(messageData.id);

      // ✅ Agregar conversationId al mensaje
      const messageToSave = {
        ...messageData,
        conversationId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // ✅ Guardar en Firestore
      await messageRef.set(messageToSave);

      logger.info('✅ Mensaje guardado exitosamente', {
        conversationId,
        messageId: messageData.id,
        direction: messageData.direction,
        type: messageData.type,
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
   * ✅ ACTUALIZAR CONVERSACIÓN CON ÚLTIMO MENSAJE
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
      // ✅ No lanzar error, es una operación secundaria
    }
  }

  /**
   * ✅ EMITIR EVENTO EN TIEMPO REAL (SOCKET.IO)
   */
  async emitRealTimeEvent(conversationId, savedMessage) {
    try {
      // ✅ Importar dinámicamente para evitar dependencias circulares
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
      // ✅ No lanzar error, es una operación secundaria
    }
  }

  /**
   * ✅ ENVIAR MENSAJE DE WHATSAPP
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

      logger.info('📤 Enviando mensaje WhatsApp via Twilio', {
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
   * ✅ LOG DE ERRORES DE WEBHOOK
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

// ✅ INSTANCIA SINGLETON
let twilioServiceInstance = null;

/**
 * ✅ FUNCIÓN PARA OBTENER INSTANCIA SINGLETON
 */
function getTwilioService() {
  if (!twilioServiceInstance) {
    try {
      twilioServiceInstance = new TwilioService();
    } catch (error) {
      logger.error('❌ Error inicializando TwilioService', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
  return twilioServiceInstance;
}

/**
 * ✅ FUNCIÓN ESTÁTICA PARA COMPATIBILIDAD
 * Esta es la función que faltaba y causaba el error
 */
async function processIncomingMessage(webhookData) {
  const service = getTwilioService();
  return await service.processIncomingMessage(webhookData);
}

// ✅ EXPORTACIÓN COMPLETA CON TODAS LAS FUNCIONES
module.exports = {
  TwilioService,
  getTwilioService,
  processIncomingMessage, // ✅ FUNCIÓN PRINCIPAL QUE FALTABA
};
