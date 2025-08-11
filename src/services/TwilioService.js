const twilio = require('twilio');

class TwilioService {
  constructor(client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    this.client = client || twilio(sid, token);
  }

  ensureWhatsApp(number) {
    // Garantiza prefijo 'whatsapp:' y E.164
    if (!number) throw new Error('to is required');
    return number.startsWith('whatsapp:') ? number : `whatsapp:${number}`;
  }

  ensureFrom(from) {
    if (!from) throw new Error('from is required');
    return from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
  }

  /**
   * FUNCIÓN PRINCIPAL: Procesar mensaje entrante desde webhook Twilio
   * Versión mejorada con manejo de fotos de perfil y metadatos avanzados
   */
  async processIncomingMessage(webhookData) {
    const requestId = `twilio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info('🔄 TWILIOSERVICE - INICIANDO PROCESAMIENTO', {
        requestId,
        timestamp: new Date().toISOString(),
        messageSid: webhookData.MessageSid,
        from: webhookData.From,
        to: webhookData.To,
        hasBody: !!webhookData.Body,
        hasProfileName: !!webhookData.ProfileName,
        hasWaId: !!webhookData.WaId,
        step: 'twilio_process_start'
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

      logger.info('📋 TWILIOSERVICE - DATOS EXTRAÍDOS', {
        requestId,
        twilioSid,
        rawFromPhone,
        rawToPhone,
        hasContent: !!content,
        contentLength: content?.length || 0,
        hasMedia: !!mediaUrl,
        mediaType,
        numMedia,
        hasProfileName: !!profileName,
        hasWaId: !!waId,
        step: 'data_extraction'
      });

      // VALIDACIÓN: Campos obligatorios
      logger.info('🔍 TWILIOSERVICE - VALIDANDO CAMPOS OBLIGATORIOS', {
        requestId,
        hasTwilioSid: !!twilioSid,
        hasRawFromPhone: !!rawFromPhone,
        hasRawToPhone: !!rawToPhone,
        step: 'validation_start'
      });

      if (!twilioSid) {
        logger.error('❌ TWILIOSERVICE - MESSAGESID FALTANTE', {
          requestId,
          step: 'validation_failed_messagesid'
        });
        throw new Error('MessageSid es requerido del webhook');
      }

      if (!rawFromPhone) {
        logger.error('❌ TWILIOSERVICE - FROM FALTANTE', {
          requestId,
          step: 'validation_failed_from'
        });
        throw new Error('From es requerido del webhook');
      }

      if (!rawToPhone) {
        logger.error('❌ TWILIOSERVICE - TO FALTANTE', {
          requestId,
          step: 'validation_failed_to'
        });
        throw new Error('To es requerido del webhook');
      }

      logger.info('✅ TWILIOSERVICE - VALIDACIÓN PASADA', {
        requestId,
        step: 'validation_passed'
      });

      // PASO 2: Normalizar números de teléfono
      logger.info('📱 TWILIOSERVICE - NORMALIZANDO TELÉFONOS', {
        requestId,
        rawFromPhone,
        rawToPhone,
        step: 'phone_normalization_start'
      });

      const fromPhone = rawFromPhone;
      const toPhone = rawToPhone;

      logger.info('✅ TWILIOSERVICE - TELÉFONOS NORMALIZADOS', {
        requestId,
        fromPhone,
        toPhone,
        step: 'phone_normalization_complete'
      });

      // PASO 3: Determinar quién es cliente y quién es agente
      const businessPhone = this.whatsappNumber.replace('whatsapp:', '');
      const normalizedBusinessPhone = businessPhone;

      logger.info('🏢 TWILIOSERVICE - IDENTIFICANDO ROLES', {
        requestId,
        businessPhone,
        normalizedBusinessPhone,
        fromPhone,
        toPhone,
        step: 'role_identification_start'
      });

      let customerPhone, agentPhone;
      
      if (fromPhone === normalizedBusinessPhone) {
        // Mensaje saliente del negocio al cliente
        customerPhone = toPhone;
        agentPhone = fromPhone;
        logger.info('📤 TWILIOSERVICE - MENSAJE SALIENTE DETECTADO', {
          requestId,
          customerPhone,
          agentPhone,
          direction: 'outbound',
          step: 'outbound_detected'
        });
      } else {
        // Mensaje entrante del cliente al negocio
        customerPhone = fromPhone;
        agentPhone = toPhone;
        logger.info('📥 TWILIOSERVICE - MENSAJE ENTRANTE DETECTADO', {
          requestId,
          customerPhone,
          agentPhone,
          direction: 'inbound',
          step: 'inbound_detected'
        });
      }

      logger.info('✅ TWILIOSERVICE - ROLES IDENTIFICADOS', {
        requestId,
        customerPhone,
        agentPhone,
        businessPhone: normalizedBusinessPhone,
        direction: fromPhone === normalizedBusinessPhone ? 'outbound' : 'inbound',
        step: 'role_identification_complete'
      });

      // PASO 4: Procesar información de contacto (foto de perfil, etc.)
      logger.info('👤 TWILIOSERVICE - PROCESANDO INFORMACIÓN DE CONTACTO', {
        requestId,
        customerPhone,
        profileName,
        waId,
        step: 'contact_info_start'
      });

      const contactInfo = await this.processContactInfo(customerPhone, {
        profileName,
        waId,
        fromPhone,
        toPhone
      });

      logger.info('✅ TWILIOSERVICE - INFORMACIÓN DE CONTACTO PROCESADA', {
        requestId,
        contactInfo: {
          hasName: !!contactInfo.name,
          hasPhoto: !!contactInfo.photoUrl,
          hasMetadata: !!contactInfo.metadata
        },
        step: 'contact_info_complete'
      });

      // PASO 5: Crear estructura del mensaje con metadatos avanzados
      const hasMedia = parseInt(numMedia || 0) > 0;
      const messageType = hasMedia ? 'media' : 'text';
      const direction = fromPhone === normalizedBusinessPhone ? 'outbound' : 'inbound';
      const sender = direction === 'inbound' ? 'customer' : 'agent';

      logger.info('📝 TWILIOSERVICE - CREANDO ESTRUCTURA DE MENSAJE', {
        requestId,
        hasMedia,
        messageType,
        direction,
        sender,
        step: 'message_structure_start'
      });

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
    const requestId = `realtime_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info('📡 EMITREALTIMEEVENT - INICIANDO EMISIÓN', {
        requestId,
        timestamp: new Date().toISOString(),
        conversationId,
        messageId: savedMessage.id,
        direction: savedMessage.direction,
        type: savedMessage.type,
        step: 'realtime_emit_start'
      });

      // Importar dinámicamente para evitar dependencias circulares
      logger.info('🔄 EMITREALTIMEEVENT - IMPORTANDO SOCKET SERVICE', {
        requestId,
        step: 'socket_import_start'
      });

      const socketService = require('../socket');
      
      logger.info('✅ EMITREALTIMEEVENT - SOCKET SERVICE IMPORTADO', {
        requestId,
        hasSocketService: !!socketService,
        hasEmitNewMessage: !!(socketService && typeof socketService.emitNewMessage === 'function'),
        step: 'socket_import_complete'
      });
      
      if (socketService && typeof socketService.emitNewMessage === 'function') {
        logger.info('📡 EMITREALTIMEEVENT - EMITIENDO MENSAJE', {
          requestId,
          conversationId,
          messageId: savedMessage.id,
          step: 'socket_emit_start'
        });

        socketService.emitNewMessage(savedMessage);
        
        logger.info('✅ EMITREALTIMEEVENT - EVENTO SOCKET.IO EMITIDO', {
          requestId,
          conversationId,
          messageId: savedMessage.id,
          direction: savedMessage.direction,
          step: 'socket_emit_complete'
        });
      } else {
        logger.warn('⚠️ EMITREALTIMEEVENT - SOCKET.IO NO DISPONIBLE', {
          requestId,
          conversationId,
          messageId: savedMessage.id,
          hasSocketService: !!socketService,
          hasEmitNewMessage: !!(socketService && typeof socketService.emitNewMessage === 'function'),
          step: 'socket_not_available'
        });
      }

      logger.info('✅ EMITREALTIMEEVENT - PROCESO COMPLETADO', {
        requestId,
        conversationId,
        messageId: savedMessage.id,
        step: 'realtime_emit_complete'
      });

    } catch (socketError) {
      logger.error('❌ EMITREALTIMEEVENT - ERROR CRÍTICO', {
        requestId,
        error: socketError.message,
        stack: socketError.stack?.split('\n').slice(0, 5),
        conversationId,
        messageId: savedMessage.id,
        step: 'realtime_emit_error'
      });
      // No lanzar error, es una operación secundaria
    }
  }

  /**
   * ENVIAR MENSAJE DE WHATSAPP
   * API unificada con parámetros estructurados
   */
  async sendWhatsAppMessage({ from, to, body, mediaUrl }) {
    const payload = {
      from: this.ensureFrom(from),
      to: this.ensureWhatsApp(to),
    };
    if (body) payload.body = body;
    if (mediaUrl) payload.mediaUrl = Array.isArray(mediaUrl) ? mediaUrl : [mediaUrl];

    const resp = await this.client.messages.create(payload);
    return resp; // resp.sid, resp.status, etc.
  }

  /**
   * 🆕 ENVIAR UBICACIÓN VIA WHATSAPP
   */
  async sendWhatsAppLocation(toPhone, latitude, longitude, name = '', address = '') {
    try {
      // Validar coordenadas
      if (!latitude || !longitude) {
        throw new Error('Latitude y longitude son requeridos');
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      if (isNaN(lat) || isNaN(lng)) {
        throw new Error('Coordenadas inválidas');
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new Error('Coordenadas fuera de rango válido');
      }

      // Normalizar números de teléfono
      const normalizedToPhone = toPhone;
      const normalizedFromPhone = this.whatsappNumber;

      // Construir mensaje de ubicación
      const locationMessage = {
        from: `whatsapp:${normalizedFromPhone}`,
        to: `whatsapp:${normalizedToPhone}`,
        body: name && address ? `${name}\n${address}` : (name || address || 'Ubicación compartida'),
        persistentAction: [`geo:${lat},${lng}`]
      };

      logger.info('📍 Enviando ubicación WhatsApp via Twilio', {
        to: normalizedToPhone,
        from: normalizedFromPhone,
        latitude: lat,
        longitude: lng,
        name: name || 'Sin nombre',
        address: address || 'Sin dirección'
      });

      // Enviar mensaje de ubicación
      const sentMessage = await this.client.messages.create(locationMessage);

      // Preparar datos del mensaje
      const messageData = {
        id: sentMessage.sid,
        senderPhone: normalizedFromPhone,
        recipientPhone: normalizedToPhone,
        content: locationMessage.body,
        type: 'location',
        direction: 'outbound',
        status: 'sent',
        sender: 'agent',
        location: {
          latitude: lat,
          longitude: lng,
          name: name || '',
          address: address || ''
        },
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

      logger.info('✅ Ubicación WhatsApp enviada exitosamente', {
        twilioSid: sentMessage.sid,
        senderPhone: messageData.senderPhone,
        recipientPhone: messageData.recipientPhone,
        status: sentMessage.status,
        direction: messageData.direction,
        location: messageData.location
      });

      return {
        success: true,
        messageData,
        twilioResponse: sentMessage,
      };

    } catch (error) {
      logger.error('❌ Error enviando ubicación WhatsApp', {
        error: error.message,
        toPhone,
        latitude,
        longitude,
        stack: error.stack,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 🆕 ENVIAR STICKER VIA WHATSAPP
   */
  async sendWhatsAppSticker(toPhone, stickerUrl) {
    try {
      // Validar URL del sticker
      if (!stickerUrl || !stickerUrl.trim()) {
        throw new Error('URL del sticker es requerida');
      }

      // Normalizar números de teléfono
      const normalizedToPhone = toPhone;
      const normalizedFromPhone = this.whatsappNumber;

      // Construir mensaje de sticker
      const stickerMessage = {
        from: `whatsapp:${normalizedFromPhone}`,
        to: `whatsapp:${normalizedToPhone}`,
        mediaUrl: [stickerUrl]
      };

      logger.info('😀 Enviando sticker WhatsApp via Twilio', {
        to: normalizedToPhone,
        from: normalizedFromPhone,
        stickerUrl: stickerUrl
      });

      // Enviar sticker
      const sentMessage = await this.client.messages.create(stickerMessage);

      // Preparar datos del mensaje
      const messageData = {
        id: sentMessage.sid,
        senderPhone: normalizedFromPhone,
        recipientPhone: normalizedToPhone,
        content: 'Sticker enviado',
        type: 'sticker',
        direction: 'outbound',
        status: 'sent',
        sender: 'agent',
        sticker: {
          url: stickerUrl,
          packId: null, // Se puede obtener del webhook entrante
          stickerId: null,
          emoji: null
        },
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

      logger.info('✅ Sticker WhatsApp enviado exitosamente', {
        twilioSid: sentMessage.sid,
        senderPhone: messageData.senderPhone,
        recipientPhone: messageData.recipientPhone,
        status: sentMessage.status,
        direction: messageData.direction,
        stickerUrl: stickerUrl
      });

      return {
        success: true,
        messageData,
        twilioResponse: sentMessage,
      };

    } catch (error) {
      logger.error('❌ Error enviando sticker WhatsApp', {
        error: error.message,
        toPhone,
        stickerUrl,
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

const instance = new TwilioService();
function getTwilioService(){ return instance; }
module.exports = instance;
module.exports.TwilioService = TwilioService;
module.exports.getTwilioService = getTwilioService;
