const Message = require('../models/Message');
const ContactService = require('./ContactService');
const Conversation = require('../models/Conversation');
const TwilioService = require('./TwilioService');
// MediaService eliminado - usar FileService en su lugar
const logger = require('../utils/logger');
const { generateConversationId, normalizePhoneNumber } = require('../utils/conversation');
const { validateMessagesArrayResponse } = require('../middleware/validation');
const { firestore } = require('../config/firebase');
const FileService = require('./FileService');

/**
 * Servicio centralizado para toda la lógica de mensajes
 * Unifica operaciones distribuidas entre controladores y servicios
 */
class MessageService {
  /**
   * Crear mensaje con validación completa y efectos secundarios
   */
  static async createMessage (messageData, options = {}) {
    const requestId = `create_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info('🔄 CREATEMESSAGE - INICIANDO CREACIÓN', {
        requestId,
        timestamp: new Date().toISOString(),
        conversationId: messageData.conversationId,
        from: messageData.from,
        to: messageData.to,
        type: messageData.type,
        direction: messageData.direction,
        options,
        step: 'create_message_start'
      });

      const {
        updateConversation = true,
        updateContact = true,
        validateInput = true,
      } = options;

      // Validación estricta de entrada
      if (validateInput) {
        logger.info('🔍 CREATEMESSAGE - VALIDANDO ENTRADA', {
          requestId,
          hasConversationId: !!messageData.conversationId,
          hasFrom: !!messageData.from,
          hasTo: !!messageData.to,
          hasDirection: !!messageData.direction,
          direction: messageData.direction,
          step: 'input_validation_start'
        });

        if (!messageData.conversationId) {
          logger.error('❌ CREATEMESSAGE - CONVERSATIONID FALTANTE', {
            requestId,
            step: 'validation_failed_conversation_id'
          });
          throw new Error('conversationId es obligatorio');
        }
        if (!messageData.from || !messageData.to) {
          logger.error('❌ CREATEMESSAGE - FROM/TO FALTANTES', {
            requestId,
            hasFrom: !!messageData.from,
            hasTo: !!messageData.to,
            step: 'validation_failed_from_to'
          });
          throw new Error('from y to son obligatorios');
        }
        if (!messageData.direction || !['inbound', 'outbound'].includes(messageData.direction)) {
          logger.error('❌ CREATEMESSAGE - DIRECTION INVÁLIDO', {
            requestId,
            direction: messageData.direction,
            validDirections: ['inbound', 'outbound'],
            step: 'validation_failed_direction'
          });
          throw new Error('direction debe ser inbound o outbound');
        }

        logger.info('✅ CREATEMESSAGE - VALIDACIÓN PASADA', {
          requestId,
          step: 'input_validation_passed'
        });
      }

      // Crear mensaje en Firestore
      logger.info('💾 CREATEMESSAGE - CREANDO EN FIRESTORE', {
        requestId,
        conversationId: messageData.conversationId,
        step: 'firestore_creation_start'
      });

      const message = await Message.create(messageData);

      logger.info('✅ CREATEMESSAGE - MENSAJE CREADO EN FIRESTORE', {
        requestId,
        messageId: message.id,
        conversationId: message.conversationId,
        step: 'firestore_creation_complete'
      });

      // Efectos secundarios en paralelo
      const sideEffects = [];

      if (updateConversation) {
        logger.info('🔄 CREATEMESSAGE - AGREGANDO UPDATE CONVERSATION', {
          requestId,
          conversationId: message.conversationId,
          step: 'side_effects_conversation_added'
        });
        sideEffects.push(this.updateConversationWithMessage(message));
      }

      if (updateContact) {
        logger.info('🔄 CREATEMESSAGE - AGREGANDO UPDATE CONTACT', {
          requestId,
          conversationId: message.conversationId,
          step: 'side_effects_contact_added'
        });
        sideEffects.push(this.updateContactFromMessage(message));
      }

      logger.info('🔄 CREATEMESSAGE - EJECUTANDO EFECTOS SECUNDARIOS', {
        requestId,
        sideEffectsCount: sideEffects.length,
        updateConversation,
        updateContact,
        step: 'side_effects_execution_start'
      });

      // Ejecutar efectos secundarios sin bloquear
      const sideEffectsResults = await Promise.allSettled(sideEffects);

      logger.info('✅ CREATEMESSAGE - EFECTOS SECUNDARIOS COMPLETADOS', {
        requestId,
        results: sideEffectsResults.map((result, index) => ({
          index,
          status: result.status,
          value: result.value,
          reason: result.reason?.message
        })),
        step: 'side_effects_execution_complete'
      });

      logger.info('✅ CREATEMESSAGE - MENSAJE CREADO EXITOSAMENTE', {
        requestId,
        messageId: message.id,
        conversationId: message.conversationId,
        direction: message.direction,
        type: message.type,
        step: 'create_message_complete'
      });

      return message;
    } catch (error) {
      logger.error('❌ CREATEMESSAGE - ERROR CRÍTICO', {
        requestId,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 5),
        messageData: {
          conversationId: messageData.conversationId,
          from: messageData.from,
          to: messageData.to,
          type: messageData.type,
          direction: messageData.direction
        },
        options,
        step: 'create_message_error'
      });
      throw error;
    }
  }

  /**
   * Enviar mensaje a través de Twilio con lógica centralizada
   */
  static async sendMessage (to, content, options = {}) {
    try {
      const {
        type = 'text',
        mediaUrl = null,
        userId = null,
        metadata = {},
      } = options;

      // Normalizar números
      const fromPhone = normalizePhoneNumber(process.env.TWILIO_WHATSAPP_NUMBER);
      const toPhone = normalizePhoneNumber(to);
      const conversationId = generateConversationId(fromPhone, toPhone);

      // Preparar datos del mensaje
      const messageData = {
        conversationId,
        from: fromPhone,
        to: toPhone,
        content,
        type,
        direction: 'outbound',
        status: 'pending',
        userId,
        metadata: {
          ...metadata,
          sendAttempt: 1,
          lastAttemptAt: new Date().toISOString(),
        },
      };

      // Crear mensaje en BD primero
      const message = await this.createMessage(messageData);

      try {
        // Enviar a través de Twilio
        let twilioResult;
        if (type === 'text') {
          twilioResult = await TwilioService.sendWhatsAppMessage(toPhone, content, userId);
        } else if (mediaUrl && ['image', 'document', 'audio', 'video'].includes(type)) {
          twilioResult = await TwilioService.sendMediaMessage(toPhone, mediaUrl, content, userId);
        } else {
          throw new Error(`Tipo de mensaje no soportado: ${type}`);
        }

        // Actualizar mensaje con datos de Twilio
        await message.update({
          status: 'sent',
          twilioSid: twilioResult.twilioSid,
          metadata: {
            ...message.metadata,
            twilioStatus: twilioResult.status,
            sentAt: new Date().toISOString(),
          },
        });

        logger.info('Mensaje enviado exitosamente', {
          messageId: message.id,
          twilioSid: twilioResult.twilioSid,
          to: toPhone,
        });

        return {
          success: true,
          message,
          twilioResult,
        };
      } catch (twilioError) {
        // Marcar mensaje como fallido
        await message.update({
          status: 'failed',
          metadata: {
            ...message.metadata,
            error: twilioError.message,
            failedAt: new Date().toISOString(),
          },
        });

        logger.error('Error enviando mensaje por Twilio:', {
          messageId: message.id,
          error: twilioError.message,
          to: toPhone,
        });

        throw twilioError;
      }
    } catch (error) {
      logger.error('Error en sendMessage:', error);
      throw error;
    }
  }

  /**
   * Procesar mensaje entrante de webhook con lógica centralizada
   */
  static async processIncomingMessage (webhookData) {
    const requestId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info('🔄 MESSAGESERVICE - INICIANDO PROCESAMIENTO', {
        requestId,
        timestamp: new Date().toISOString(),
        webhookDataKeys: Object.keys(webhookData),
        step: 'process_incoming_start'
      });

      const { From, To, Body, MessageSid, NumMedia } = webhookData;

      logger.info('📋 MESSAGESERVICE - DATOS EXTRAÍDOS', {
        requestId,
        from: From,
        to: To,
        messageSid: MessageSid,
        hasBody: !!Body,
        bodyLength: Body?.length || 0,
        numMedia: NumMedia,
        step: 'data_extraction'
      });

      // Validar webhook data
      if (!From || !To || !MessageSid) {
        logger.error('❌ MESSAGESERVICE - DATOS INCOMPLETOS', {
          requestId,
          hasFrom: !!From,
          hasTo: !!To,
          hasMessageSid: !!MessageSid,
          webhookData,
          step: 'validation_failed'
        });
        throw new Error('Datos de webhook incompletos');
      }

      logger.info('✅ MESSAGESERVICE - VALIDACIÓN PASADA', {
        requestId,
        step: 'validation_passed'
      });

      // Verificar duplicados
      logger.info('🔍 MESSAGESERVICE - VERIFICANDO DUPLICADOS', {
        requestId,
        messageSid: MessageSid,
        step: 'duplicate_check_start'
      });

      const existingMessage = await Message.getByTwilioSid(MessageSid);
      
      if (existingMessage) {
        logger.warn('⚠️ MESSAGESERVICE - MENSAJE DUPLICADO DETECTADO', {
          requestId,
          twilioSid: MessageSid,
          existingMessageId: existingMessage.id,
          step: 'duplicate_found'
        });
        return existingMessage;
      }

      logger.info('✅ MESSAGESERVICE - SIN DUPLICADOS', {
        requestId,
        messageSid: MessageSid,
        step: 'duplicate_check_passed'
      });

      // Procesar datos del mensaje
      logger.info('📱 MESSAGESERVICE - NORMALIZANDO TELÉFONOS', {
        requestId,
        originalFrom: From,
        originalTo: To,
        step: 'phone_normalization_start'
      });

      const fromPhone = normalizePhoneNumber(From);
      const toPhone = normalizePhoneNumber(To);
      const conversationId = generateConversationId(fromPhone, toPhone);

      logger.info('✅ MESSAGESERVICE - TELÉFONOS NORMALIZADOS', {
        requestId,
        originalFrom: From,
        normalizedFrom: fromPhone,
        originalTo: To,
        normalizedTo: toPhone,
        conversationId,
        step: 'phone_normalization_complete'
      });

      // Determinar tipo de mensaje
      const hasMedia = parseInt(NumMedia || '0') > 0;
      const messageType = hasMedia ? 'media' : 'text';

      logger.info('📊 MESSAGESERVICE - TIPO DE MENSAJE DETERMINADO', {
        requestId,
        hasMedia,
        messageType,
        numMedia: parseInt(NumMedia || '0'),
        step: 'message_type_determined'
      });

      // Preparar datos básicos del mensaje
      const messageData = {
        conversationId,
        from: fromPhone,
        to: toPhone,
        content: Body || '',
        type: messageType,
        direction: 'inbound',
        status: 'received',
        metadata: {
          twilioSid: MessageSid, // MOVIDO AQUÍ
          webhookProcessedAt: new Date().toISOString(),
          hasMedia,
          numMedia: parseInt(NumMedia || '0'),
        },
      };

      logger.info('📝 MESSAGESERVICE - DATOS DE MENSAJE PREPARADOS', {
        requestId,
        conversationId,
        from: fromPhone,
        to: toPhone,
        contentLength: messageData.content.length,
        type: messageType,
        direction: 'inbound',
        step: 'message_data_prepared'
      });

      // Procesar media si existe
      if (hasMedia) {
        logger.info('🖼️ MESSAGESERVICE - PROCESANDO MEDIA', {
          requestId,
          numMedia: parseInt(NumMedia || '0'),
          step: 'media_processing_start'
        });

        try {
          const mediaData = await this.processWebhookMedia(webhookData);
          messageData.mediaUrls = mediaData.urls;
          messageData.metadata.media = mediaData.processed;
          messageData.type = mediaData.primaryType || 'media';

          logger.info('✅ MESSAGESERVICE - MEDIA PROCESADA EXITOSAMENTE', {
            requestId,
            mediaUrlsCount: mediaData.urls?.length || 0,
            primaryType: mediaData.primaryType,
            step: 'media_processing_complete'
          });
        } catch (mediaError) {
          logger.warn('⚠️ MESSAGESERVICE - ERROR PROCESANDO MEDIA', {
            requestId,
            error: mediaError.message,
            step: 'media_processing_error'
          });
          messageData.metadata.mediaProcessingError = mediaError.message;
        }
      }

      // Crear mensaje con efectos secundarios
      logger.info('💾 MESSAGESERVICE - CREANDO MENSAJE EN FIRESTORE', {
        requestId,
        conversationId,
        step: 'message_creation_start'
      });

      const message = await this.createMessage(messageData, {
        updateConversation: true,
        updateContact: true,
        validateInput: true,
      });

      logger.info('✅ MESSAGESERVICE - MENSAJE CREADO EXITOSAMENTE', {
        requestId,
        messageId: message.id,
        conversationId,
        from: fromPhone,
        hasMedia,
        step: 'message_creation_complete'
      });

      return message;
    } catch (error) {
      logger.error('❌ MESSAGESERVICE - ERROR CRÍTICO', {
        requestId,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 5),
        webhookData: {
          From: webhookData.From,
          To: webhookData.To,
          MessageSid: webhookData.MessageSid,
          hasBody: !!webhookData.Body
        },
        step: 'process_incoming_error'
      });
      logger.error('Error procesando mensaje entrante:', error);
      throw error;
    }
  }

  /**
   * Procesar media de webhook centralizado
   */
  static async processWebhookMedia (webhookData) {
    const mediaUrls = [];
    const processedMedia = [];
    const types = new Set();

    const numMedia = parseInt(webhookData.NumMedia || '0');

    // Procesar cada archivo de media
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = webhookData[`MediaUrl${i}`];

      if (mediaUrl) {
        try {
          // Procesar y guardar permanentemente usando FileService
          const processedInfo = await this.processIndividualWebhookMedia(
            mediaUrl,
            webhookData.MessageSid,
            i,
          );

          mediaUrls.push(mediaUrl); // URL original
          processedMedia.push(processedInfo); // Info procesada
          types.add(processedInfo.category);
        } catch (mediaError) {
          logger.warn(`Error procesando media ${i}:`, mediaError);
          // Continuar con el siguiente archivo
        }
      }
    }

    // Determinar tipo principal
    const primaryType = types.has('image')
      ? 'image'
      : types.has('video')
        ? 'video'
        : types.has('audio')
          ? 'audio'
          : types.has('document') ? 'document' : 'media';

    return {
      urls: mediaUrls,
      processed: processedMedia,
      primaryType,
      count: mediaUrls.length,
    };
  }

  /**
   * Procesar media individual de webhook usando FileService
   */
  static async processIndividualWebhookMedia (mediaUrl, messageSid, index) {
    try {
      logger.info('Procesando media individual de webhook', {
        mediaUrl,
        messageSid,
        index
      });

      // Descargar el archivo desde la URL de Twilio
      const response = await fetch(mediaUrl);
      if (!response.ok) {
        throw new Error(`Error descargando media: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type');
      
      // Determinar categoría basada en content-type
      let category = 'document';
      if (contentType.startsWith('image/')) category = 'image';
      else if (contentType.startsWith('video/')) category = 'video';
      else if (contentType.startsWith('audio/')) category = 'audio';

      // Crear datos del archivo para FileService
      const fileData = {
        buffer: Buffer.from(buffer),
        originalName: `webhook-media-${messageSid}-${index}`,
        mimetype: contentType,
        size: buffer.byteLength,
        conversationId: null, // Se asignará después
        userId: null,
        uploadedBy: 'webhook',
        tags: ['webhook', 'twilio']
      };

      // Usar FileService para procesar el archivo
      const fileService = new FileService();
      const processedFile = await fileService.uploadFile(fileData);

      return {
        fileId: processedFile.id,
        category,
        url: processedFile.url,
        size: processedFile.size,
        mimetype: contentType
      };

    } catch (error) {
      logger.error('Error procesando media individual:', error);
      throw error;
    }
  }

  /**
   * Obtener mensajes con filtros y validación centralizada
   */
  static async getMessages (filters = {}, pagination = {}) {
    try {
      const {
        conversationId,
        userId,
        direction,
        status,
        type,
        startDate,
        endDate,
      } = filters;

      const {
        limit = 50,
        startAfter = null,
        orderBy = 'timestamp',
        order = 'desc',
      } = pagination;

      // Construir query con filtros
      let query = Message.getCollection();

      if (conversationId) {
        query = query.where('conversationId', '==', conversationId);
      }

      if (userId) {
        query = query.where('userId', '==', userId);
      }

      if (direction) {
        query = query.where('direction', '==', direction);
      }

      if (status) {
        query = query.where('status', '==', status);
      }

      if (type) {
        query = query.where('type', '==', type);
      }

      // Filtros de fecha
      if (startDate) {
        query = query.where('timestamp', '>=', new Date(startDate));
      }
      if (endDate) {
        query = query.where('timestamp', '<=', new Date(endDate));
      }

      // Paginación y ordenamiento
      query = query.orderBy(orderBy, order);

      if (startAfter) {
        const startDoc = await Message.getById(startAfter);
        if (startDoc) {
          query = query.startAfter(startDoc.getFirestoreDoc());
        }
      }

      query = query.limit(parseInt(limit));

      // Ejecutar query
      const snapshot = await query.get();
      const messages = snapshot.docs.map(doc => new Message({ id: doc.id, ...doc.data() }));

      // Validar respuesta
      const validatedMessages = validateMessagesArrayResponse(
        messages.map(m => m.toJSON()),
      );

      // Información de paginación
      const hasMore = messages.length === parseInt(limit);
      const nextStartAfter = hasMore && messages.length > 0 ? messages[messages.length - 1].id : null;

      logger.info('Mensajes obtenidos', {
        count: messages.length,
        filters: Object.keys(filters).filter(k => filters[k]).length,
        hasMore,
      });

      return {
        messages: validatedMessages,
        pagination: {
          limit: parseInt(limit),
          startAfter,
          nextStartAfter,
          hasMore,
          count: messages.length,
        },
      };
    } catch (error) {
      logger.error('Error obteniendo mensajes:', error);
      throw error;
    }
  }

  /**
   * Marcar mensajes como leídos con lógica centralizada
   */
  static async markMessagesAsRead (messageIds, userId = null) {
    try {
      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        throw new Error('Se requiere un array de messageIds no vacío');
      }

      const results = [];
      const conversationsToUpdate = new Set();

      // Procesar mensajes en lotes para mejor rendimiento
      const batchSize = 10;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);

        const batchPromises = batch.map(async (messageId) => {
          try {
            const message = await Message.getById(messageId);
            if (!message) {
              return { messageId, success: false, error: 'Mensaje no encontrado' };
            }

            // Solo marcar como leído si no está ya leído
            if (message.status !== 'read') {
              await message.update({
                status: 'read',
                readAt: new Date().toISOString(),
                readBy: userId,
              });

              // Registrar conversación para actualizar
              conversationsToUpdate.add(message.conversationId);
            }

            return { messageId, success: true };
          } catch (error) {
            logger.error(`Error marcando mensaje ${messageId} como leído:`, error);
            return { messageId, success: false, error: error.message };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults.map(r => r.value || r.reason));
      }

      // Actualizar contadores de conversaciones
      for (const conversationId of conversationsToUpdate) {
        try {
          const conversation = await Conversation.getById(conversationId);
          if (conversation) {
            await conversation.updateUnreadCount();
          }
        } catch (error) {
          logger.warn(`Error actualizando contador de conversación ${conversationId}:`, error);
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      logger.info('Mensajes marcados como leídos', {
        total: messageIds.length,
        success: successCount,
        failures: failureCount,
        conversationsUpdated: conversationsToUpdate.size,
      });

      return {
        success: true,
        results,
        summary: {
          total: messageIds.length,
          success: successCount,
          failures: failureCount,
        },
      };
    } catch (error) {
      logger.error('Error marcando mensajes como leídos:', error);
      throw error;
    }
  }

  /**
   * Actualizar conversación con nuevo mensaje
   */
  static async updateConversationWithMessage (message) {
    const requestId = `conv_update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info('🔄 UPDATECONVERSATION - INICIANDO ACTUALIZACIÓN', {
        requestId,
        timestamp: new Date().toISOString(),
        messageId: message.id,
        conversationId: message.conversationId,
        direction: message.direction,
        type: message.type,
        step: 'conversation_update_start'
      });

      // Obtener conversación
      logger.info('🔍 UPDATECONVERSATION - BUSCANDO CONVERSACIÓN', {
        requestId,
        conversationId: message.conversationId,
        step: 'conversation_lookup_start'
      });

      const conversation = await Conversation.getById(message.conversationId);
      
      if (!conversation) {
        logger.warn('⚠️ UPDATECONVERSATION - CONVERSACIÓN NO ENCONTRADA', {
          requestId,
          conversationId: message.conversationId,
          step: 'conversation_not_found'
        });
        return;
      }

      logger.info('✅ UPDATECONVERSATION - CONVERSACIÓN ENCONTRADA', {
        requestId,
        conversationId: conversation.id,
        lastMessageAt: conversation.lastMessageAt,
        messageCount: conversation.messageCount,
        step: 'conversation_found'
      });

      // Actualizar último mensaje
      logger.info('📝 UPDATECONVERSATION - ACTUALIZANDO ÚLTIMO MENSAJE', {
        requestId,
        conversationId: conversation.id,
        messageId: message.id,
        messageTimestamp: message.timestamp,
        step: 'last_message_update_start'
      });

      await conversation.updateLastMessage(message);

      logger.info('✅ UPDATECONVERSATION - ÚLTIMO MENSAJE ACTUALIZADO', {
        requestId,
        conversationId: conversation.id,
        messageId: message.id,
        step: 'last_message_update_complete'
      });

      // Emitir evento en tiempo real
      logger.info('📡 UPDATECONVERSATION - EMITIENDO EVENTO TIEMPO REAL', {
        requestId,
        conversationId: conversation.id,
        messageId: message.id,
        step: 'realtime_emit_start'
      });

      const { emitRealTimeEvent } = require('./TwilioService');
      await emitRealTimeEvent(conversation.id, message);

      logger.info('✅ UPDATECONVERSATION - EVENTO EMITIDO', {
        requestId,
        conversationId: conversation.id,
        messageId: message.id,
        step: 'realtime_emit_complete'
      });

      logger.info('✅ UPDATECONVERSATION - ACTUALIZACIÓN COMPLETADA', {
        requestId,
        conversationId: conversation.id,
        messageId: message.id,
        step: 'conversation_update_complete'
      });

    } catch (error) {
      logger.error('❌ UPDATECONVERSATION - ERROR CRÍTICO', {
        requestId,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 5),
        messageId: message.id,
        conversationId: message.conversationId,
        step: 'conversation_update_error'
      });
      throw error;
    }
  }

  /**
   * Actualizar contacto desde mensaje usando ContactService centralizado
   */
  static async updateContactFromMessage (message) {
    try {
      logger.info('🔄 Iniciando actualización de contacto desde mensaje', {
        messageId: message.id,
        conversationId: message.conversationId,
        direction: message.direction,
        from: message.from,
        to: message.to
      });

      // Usar ContactService centralizado
      const contact = await ContactService.createOrUpdateFromMessage(message, {
        conversationId: message.conversationId,
        userId: message.userId || null
      });

      logger.info('✅ Contacto actualizado exitosamente desde mensaje', {
        messageId: message.id,
        contactId: contact.id,
        contactPhone: contact.phone,
        contactName: contact.name,
        isActive: contact.isActive
      });

      return contact;
    } catch (error) {
      logger.error('❌ Error actualizando contacto desde mensaje:', {
        messageId: message.id,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3)
      });
      throw error;
    }
  }

  /**
   * Obtener estadísticas de mensajes centralizadas
   */
  static async getMessageStats (filters = {}) {
    try {
      const {
        userId,
        conversationId,
        startDate,
        endDate,
        period = '7d',
      } = filters;

      // Calcular fechas del período si no se especifican
      let start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : new Date();

      if (!start) {
        const days = period === '24h' ? 1 : parseInt(period.replace('d', ''));
        start = new Date(end.getTime() - (days * 24 * 60 * 60 * 1000));
      }

      // Obtener mensajes del período
      const messages = await this.getMessages({
        userId,
        conversationId,
        startDate: start,
        endDate: end,
      }, { limit: 10000 }); // Límite alto para estadísticas

      // Calcular métricas
      const stats = {
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
          type: period,
        },
        total: messages.messages.length,
        byDirection: {
          inbound: messages.messages.filter(m => m.direction === 'inbound').length,
          outbound: messages.messages.filter(m => m.direction === 'outbound').length,
        },
        byStatus: {},
        byType: {},
        responseTime: {
          average: 0,
          median: 0,
          min: 0,
          max: 0,
        },
      };

      // Contar por status
      for (const status of ['pending', 'sent', 'delivered', 'read', 'failed']) {
        stats.byStatus[status] = messages.messages.filter(m => m.status === status).length;
      }

      // Contar por tipo
      for (const type of ['text', 'image', 'document', 'audio', 'video']) {
        stats.byType[type] = messages.messages.filter(m => m.type === type).length;
      }

      // Calcular tiempos de respuesta (simplificado)
      const responseTimes = this.calculateResponseTimes(messages.messages);
      if (responseTimes.length > 0) {
        stats.responseTime.average = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        stats.responseTime.median = responseTimes.sort()[Math.floor(responseTimes.length / 2)];
        stats.responseTime.min = Math.min(...responseTimes);
        stats.responseTime.max = Math.max(...responseTimes);
      }

      logger.info('Estadísticas de mensajes calculadas', {
        total: stats.total,
        period,
        userId: userId || 'all',
      });

      return stats;
    } catch (error) {
      logger.error('Error calculando estadísticas:', error);
      throw error;
    }
  }

  /**
   * Calcular tiempos de respuesta entre mensajes
   */
  static calculateResponseTimes (messages) {
    const responseTimes = [];

    // Agrupar por conversación
    const byConversation = {};
    messages.forEach(msg => {
      if (!byConversation[msg.conversationId]) {
        byConversation[msg.conversationId] = [];
      }
      byConversation[msg.conversationId].push(msg);
    });

    // Calcular tiempos para cada conversación
    Object.values(byConversation).forEach(conversationMessages => {
      const sorted = conversationMessages.sort((a, b) =>
        new Date(a.timestamp) - new Date(b.timestamp),
      );

      for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const previous = sorted[i - 1];

        // Solo calcular si hay cambio de dirección (respuesta)
        if (current.direction !== previous.direction) {
          const responseTime = new Date(current.timestamp) - new Date(previous.timestamp);
          if (responseTime > 0 && responseTime < 24 * 60 * 60 * 1000) { // Menos de 24 horas
            responseTimes.push(responseTime / 1000 / 60); // En minutos
          }
        }
      }
    });

    return responseTimes;
  }

  /**
   * Eliminar mensaje con efectos secundarios
   */
  static async deleteMessage (messageId, userId = null) {
    try {
      const message = await Message.getById(messageId);
      if (!message) {
        throw new Error('Mensaje no encontrado');
      }

      // Verificar permisos si se especifica usuario
      if (userId && message.userId && message.userId !== userId) {
        throw new Error('Sin permisos para eliminar este mensaje');
      }

      const conversationId = message.conversationId;

      // Eliminar mensaje
      await message.delete();

      // Actualizar contador de conversación
      try {
        const conversation = await Conversation.getById(conversationId);
        if (conversation) {
          await conversation.decrementMessageCount();
        }
      } catch (error) {
        logger.warn('Error actualizando contador al eliminar mensaje:', error);
      }

      logger.info('Mensaje eliminado', {
        messageId,
        conversationId,
        deletedBy: userId,
      });

      return { success: true, messageId };
    } catch (error) {
      logger.error('Error eliminando mensaje:', error);
      throw error;
    }
  }

  /**
   * 🚀 OPTIMIZED BATCH GET MESSAGE TYPES
   * Optimiza la obtención de tipos de mensajes usando batch operations
   */
  static async getMessageTypesOptimized(messages) {
    try {
      if (!messages || messages.length === 0) {
        return new Set();
      }

      const BatchOptimizer = require('./BatchOptimizer');
      const messageIds = messages.map(m => m.id);
      
      const documents = await BatchOptimizer.batchGet('messages', messageIds, {
        batchSize: 500,
        timeout: 30000
      });

      const types = new Set();
      documents.forEach(doc => {
        if (doc.exists && doc.data?.type) {
          types.add(doc.data.type);
        }
      });

      logger.info('Message types obtenidos con batch optimization', {
        totalMessages: messages.length,
        uniqueTypes: types.size,
        types: Array.from(types)
      });

      return types;

    } catch (error) {
      logger.error('Error obteniendo message types optimizados', {
        error: error.message,
        stack: error.stack
      });
      return new Set();
    }
  }

  /**
   * 📊 OPTIMIZED BATCH MESSAGE STATS
   * Optimiza la obtención de estadísticas de mensajes usando batch operations
   */
  static async getMessageStatsOptimized(conversationIds, options = {}) {
    try {
      const { startDate, endDate, userId } = options;
      
      const BatchOptimizer = require('./BatchOptimizer');
      
      // Crear queries de batch para cada conversación
      const queries = conversationIds.map(conversationId => {
        let query = firestore.collection('messages')
          .where('conversationId', '==', conversationId);
        
        if (userId) {
          query = query.where('userId', '==', userId);
        }
        
        if (startDate) {
          query = query.where('timestamp', '>=', new Date(startDate));
        }
        
        if (endDate) {
          query = query.where('timestamp', '<=', new Date(endDate));
        }
        
        return query;
      });

      const results = await BatchOptimizer.batchQuery(queries, {
        maxConcurrent: 10,
        timeout: 30000
      });

      // Procesar resultados
      const stats = {
        totalMessages: 0,
        messagesByType: {},
        messagesByStatus: {},
        messagesByDirection: {},
        conversations: {}
      };

      results.forEach((snapshot, index) => {
        const conversationId = conversationIds[index];
        const messages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        stats.conversations[conversationId] = {
          count: messages.length,
          messages
        };

        stats.totalMessages += messages.length;

        messages.forEach(message => {
          // Contar por tipo
          const type = message.type || 'unknown';
          stats.messagesByType[type] = (stats.messagesByType[type] || 0) + 1;

          // Contar por status
          const status = message.status || 'unknown';
          stats.messagesByStatus[status] = (stats.messagesByStatus[status] || 0) + 1;

          // Contar por dirección
          const direction = message.direction || 'unknown';
          stats.messagesByDirection[direction] = (stats.messagesByDirection[direction] || 0) + 1;
        });
      });

      logger.info('Message stats obtenidos con batch optimization', {
        totalConversations: conversationIds.length,
        totalMessages: stats.totalMessages,
        uniqueTypes: Object.keys(stats.messagesByType).length,
        uniqueStatuses: Object.keys(stats.messagesByStatus).length
      });

      return stats;

    } catch (error) {
      logger.error('Error obteniendo message stats optimizados', {
        error: error.message,
        stack: error.stack
      });
      return {
        totalMessages: 0,
        messagesByType: {},
        messagesByStatus: {},
        messagesByDirection: {},
        conversations: {}
      };
    }
  }
}

module.exports = MessageService;
