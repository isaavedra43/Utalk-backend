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
const { getConversationsRepository } = require('../repositories/ConversationsRepository');

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
      const {
        updateConversation = true,
        updateContact = true,
        validateInput = true,
      } = options;

      // Validación estricta de entrada
      if (validateInput) {
        if (!messageData.conversationId) {
          throw new Error('conversationId es obligatorio');
        }

        if (!messageData.senderIdentifier || !messageData.recipientIdentifier) {
          throw new Error('senderIdentifier y recipientIdentifier son obligatorios');
        }

        if (!messageData.direction || !['inbound', 'outbound'].includes(messageData.direction)) {
          throw new Error('direction debe ser inbound o outbound');
        }

        // CORREGIDO: Validación que permite contenido vacío pero no null/undefined
        const noContent = messageData.content === null || messageData.content === undefined;
        const noMedia = !messageData.mediaUrl || messageData.mediaUrl === null || messageData.mediaUrl === undefined;
        
        if (noContent && noMedia) {
          throw new Error('El mensaje debe tener contenido o mediaUrl');
        }
      }

      // Crear el mensaje
      const message = await Message.create(messageData, messageData.id);

      // Efectos secundarios en paralelo
      const sideEffects = [];

      // ACTUALIZACIÓN DE CONVERSACIÓN DESHABILITADA (SE HACE EN Message.create)
      // if (updateConversation) {
      //   sideEffects.push(this.updateConversationWithMessage(message));
      // }

      if (updateContact) {
        sideEffects.push(ContactService.createOrUpdateFromMessage({
          from: message.senderIdentifier,
          to: message.recipientIdentifier,
          direction: message.direction,
          timestamp: message.timestamp || new Date().toISOString()
        }, {
          lastMessageAt: new Date(),
          lastMessageContent: message.content,
          lastMessageDirection: message.direction
        }));
      }

      // Ejecutar efectos secundarios en paralelo
      if (sideEffects.length > 0) {
        await Promise.all(sideEffects);
      }

      logger.info('✅ MENSAJE PROCESADO Y GUARDADO', {
        requestId,
        messageId: message.id,
        conversationId: message.conversationId,
        sender: message.senderIdentifier,
        recipient: message.recipientIdentifier,
        contentPreview: message.content?.substring(0, 50),
        type: message.type,
        direction: message.direction,
        hasMedia: !!message.mediaUrl,
        timestamp: message.timestamp
      });

      return message;

    } catch (error) {
      logger.error('❌ MESSAGE.CREATE - CRITICAL ERROR', {
        requestId,
        error: error.message,
        errorType: error.constructor.name,
        stack: error.stack?.split('\n').slice(0, 20),
        messageData: {
          id: messageData?.id,
          conversationId: messageData?.conversationId,
          senderIdentifier: messageData?.senderIdentifier,
          recipientIdentifier: messageData?.recipientIdentifier,
          content: messageData?.content,
          type: messageData?.type,
          direction: messageData?.direction,
          status: messageData?.status,
          mediaUrl: messageData?.mediaUrl
        },
        step: 'message_create_error'
      });
      throw error;
    }
  }

  /**
   * Enviar mensaje a través de Twilio
   */
  static async sendMessage (to, content, options = {}) {
    try {
      const {
        from = null,
        mediaUrl = null,
        metadata = {},
        conversationId = null,
      } = options;

      // Validar parámetros
      if (!to || !content) {
        throw new Error('to y content son requeridos');
      }

      // Normalizar número de teléfono
      const toPhone = normalizePhoneNumber(to);
      if (!toPhone) {
        throw new Error('Número de teléfono inválido');
      }

      // Generar conversationId si no se proporciona
      const finalConversationId = conversationId || generateConversationId(from || 'system', toPhone);

      // Preparar datos del mensaje
      const messageData = {
        conversationId: finalConversationId,
        senderIdentifier: from || 'system',
        recipientIdentifier: toPhone,
        content,
        type: mediaUrl ? 'media' : 'text',
        direction: 'outbound',
        status: 'pending',
        mediaUrl,
        metadata: {
          ...metadata,
          sentAt: new Date().toISOString(),
        },
      };

      // Crear mensaje en base de datos
      const message = await this.createMessage(messageData);

      // Enviar por Twilio
      try {
        const twilioResult = await TwilioService.sendMessage(toPhone, content, {
          mediaUrl,
          conversationId: finalConversationId,
        });

        // Actualizar mensaje con resultado de Twilio
        await message.update({
          status: 'sent',
          metadata: {
            ...message.metadata,
            twilioSid: twilioResult.twilioSid,
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
   * Procesar mensaje entrante desde webhook Twilio
   */
  static async processIncomingMessage (webhookData) {
    const requestId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const { From, To, Body, MessageSid, NumMedia } = webhookData;

      // Validar webhook data
      if (!From || !To || !MessageSid) {
        throw new Error('From, To y MessageSid son requeridos');
      }

      // Verificar si el mensaje ya existe (duplicados)
      const existingMessage = await Message.getByTwilioSid(MessageSid);
      if (existingMessage) {
        console.log('🚨 MESSAGE DUPLICATE DETECTED:', {
          requestId,
          messageSid: MessageSid,
          existingMessageId: existingMessage.id,
          step: 'duplicate_detected'
        });
        return { success: true, duplicate: true };
      }

      // Normalizar números de teléfono
      const fromPhone = normalizePhoneNumber(From);
      const toPhone = normalizePhoneNumber(To);

      if (!fromPhone || !toPhone) {
        throw new Error('Números de teléfono inválidos después de normalización');
      }

      // Generar conversationId
      const conversationId = generateConversationId(fromPhone, toPhone);

      // Preparar datos normalizados para el repositorio
      const messageData = {
        conversationId,
        messageId: `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: Body || '',
        type: 'text',
        direction: 'inbound',
        senderIdentifier: fromPhone,
        recipientIdentifier: toPhone,
        timestamp: new Date(),
        workspaceId: process.env.WORKSPACE_ID, // Obtener del contexto
        tenantId: process.env.TENANT_ID, // Si aplica
        metadata: {
          twilioSid: MessageSid,
          generatedId: true,
          timestamp: new Date().toISOString(),
          uniqueTimestamp: Date.now()
        }
      };

      // Usar el repositorio para escritura canónica
      const conversationsRepo = getConversationsRepository();
      const result = await conversationsRepo.upsertFromInbound(messageData);

      console.log('🚨 MESSAGE PROCESSED SUCCESSFULLY:', {
        requestId,
        messageId: result.message.id,
        conversationId: result.message.conversationId,
        sender: result.message.senderIdentifier,
        recipient: result.message.recipientIdentifier,
        content: result.message.content?.substring(0, 50) + (result.message.content?.length > 50 ? '...' : ''),
        type: result.message.type,
        direction: result.message.direction,
        hasMedia: !!result.message.mediaUrl,
        timestamp: result.message.timestamp,
        step: 'message_processed',
        idempotent: result.idempotent
      });

      return { success: true, message: result.message, conversation: result.conversation };

    } catch (error) {
      console.log('🚨 MESSAGESERVICE ERROR:', {
        requestId,
        error: error.message,
        errorType: error.constructor.name,
        webhookData: {
          From: webhookData?.From,
          To: webhookData?.To,
          MessageSid: webhookData?.MessageSid,
          hasBody: !!webhookData?.Body
        },
        step: 'process_incoming_error'
      });
      
      logger.error('❌ MESSAGESERVICE - ERROR CRÍTICO', {
        requestId,
        error: error.message,
        errorType: error.constructor.name,
        stack: error.stack?.split('\n').slice(0, 20),
        webhookData: {
          From: webhookData?.From,
          To: webhookData?.To,
          MessageSid: webhookData?.MessageSid,
          hasBody: !!webhookData?.Body
        },
        step: 'process_incoming_error'
      });
      
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
