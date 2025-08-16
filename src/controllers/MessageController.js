/**
 * 💬 CONTROLADOR DE MENSAJES - VERSIÓN COMPLETA PRODUCTION-READY
 * 
 * Implementa todos los endpoints RESTful requeridos por el frontend
 * siguiendo las mejores prácticas de Vinay Sahni y compatibilidad total.
 * 
 * ENDPOINTS IMPLEMENTADOS:
 * - GET /api/conversations/:conversationId/messages (listar mensajes)
 * - POST /api/conversations/:conversationId/messages (crear mensaje en conversación)
 * - POST /api/messages/send (enviar mensaje independiente)
 * - PUT /api/conversations/:conversationId/messages/:messageId/read (marcar como leído)
 * - DELETE /api/conversations/:conversationId/messages/:messageId (eliminar mensaje)
 * - POST /api/messages/webhook (webhook Twilio)
 * 
 * @version 2.0.0
 * @author Backend Team
 */

const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { getMessageService } = require('../services/MessageService');
const { getConversationsRepository } = require('../repositories/ConversationsRepository');
const logger = require('../utils/logger');
const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
const { validatePhoneNumber } = require('../middleware/phoneValidation');
const FileService = require('../services/FileService');
const MessageService = require('../services/MessageService');

class MessageController {
  /**
   * 📋 GET /api/messages
   * Lista mensajes con filtros y paginación
   * 
   * QUERY PARAMS:
   * - conversationId: ID de conversación (requerido)
   * - limit: número de resultados (default: 50, max: 100)
   * - cursor: cursor de paginación
   * - direction: inbound|outbound (opcional)
   * - type: text|image|audio|video|document (opcional)
   * - status: received|sent|failed|pending (opcional)
   * - search: texto libre para buscar en content (opcional)
   * 
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {function} next - Express next middleware function
   */
  static async getMessages(req, res, next) {
    try {
      const {
        limit = 50,
        cursor,
        direction,
        type,
        status,
        search
      } = req.query;

      // 🔧 CORRECCIÓN CRÍTICA: Usar el conversationId ya normalizado por el middleware
      const conversationId = req.query.conversationId;

      // Validar conversationId (requerido)
      if (!conversationId) {
        throw new ApiError(
          'MISSING_CONVERSATION_ID',
          'conversationId es requerido',
          'Proporciona el ID de la conversación',
          400
        );
      }

      // 🔍 LOGGING MEJORADO PARA DEBUG
      logger.info('MessageController.getMessages - Procesando request', {
        conversationId,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        method: req.method,
        url: req.originalUrl
      });

      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

      // Verificar que el usuario tenga acceso a la conversación
      const conversation = await Conversation.getById(conversationId);
      if (!conversation) {
        throw CommonErrors.CONVERSATION_NOT_FOUND(conversationId);
      }

      // Verificar permisos: usuario debe estar en participants
      const userEmail = req.user.email;
      const participants = conversation.participants || [];
      if (!participants.includes(userEmail)) {
        throw new ApiError(
          'ACCESS_DENIED',
          'No tienes acceso a esta conversación',
          'Solo los participantes pueden ver los mensajes',
          403
        );
      }

      // Construir opciones para el modelo
      const options = {
        limit: limitNum,
        cursor,
        direction,
        type,
        status,
        orderBy: 'timestamp',
        order: 'desc'
      };

      // Obtener mensajes usando el modelo
      const result = await Message.getByConversation(conversationId, options);

      // Transformar mensajes a JSON
      const messages = result.messages.map(msg => msg.toJSON());

      // Log de éxito
      logger.info('Mensajes obtenidos exitosamente', {
        conversationId,
        count: messages.length,
        userEmail: req.user?.email,
        hasMore: result.pagination.hasMore,
        queryTime: result.metadata.queryTime
      });

      // Retornar respuesta con paginación
      return ResponseHandler.success(
        res,
        {
          messages,
          pagination: result.pagination,
          metadata: {
            conversationId,
            totalResults: messages.length,
            queryTime: result.metadata.queryTime
          }
        },
        `${messages.length} mensajes encontrados`,
        200
      );

    } catch (error) {
      logger.error('Error obteniendo mensajes', {
        error: error.message,
        conversationId: req.query?.conversationId,
        userEmail: req.user?.email
      });
      next(error);
    }
  }

  /**
   * 📝 POST /api/conversations/:conversationId/messages
   * Crear mensaje en una conversación específica
   * 
   * BODY:
   * - content: texto del mensaje (requerido)
   * - type: text|image|audio|video|document (default: text)
   * - attachments: array de archivos (opcional)
   * - metadata: objeto con datos adicionales (opcional)
   */
  static async createMessageInConversation(req, res, next) {
    try {
      const { conversationId } = req.params;
      const { content, type = 'text', attachments = [], metadata = {} } = req.body;

      // Validar contenido
      if (!content || content.trim().length === 0) {
        throw new ApiError(
          'MISSING_CONTENT',
          'El contenido del mensaje es requerido',
          'Proporciona el texto del mensaje',
          400
        );
      }

      // Obtener conversación
      const conversation = await Conversation.getById(conversationId);
      if (!conversation) {
        throw CommonErrors.CONVERSATION_NOT_FOUND(conversationId);
      }

      // Validar permisos
      if (req.user.role === 'viewer') {
        throw CommonErrors.USER_NOT_AUTHORIZED('enviar mensajes', conversationId);
      }

      // Procesar archivos adjuntos por ID
      let attachmentsData = [];

      if (attachments.length > 0) {
        try {
          const fileService = new FileService();
          attachmentsData = await fileService.getAttachmentsByIds(attachments.map(a => a.id));
        } catch (fileError) {
          logger.error('Error obteniendo archivos adjuntos', {
            conversationId,
            error: fileError.message,
            userEmail: req.user.email
          });
          // Continuar sin archivos adjuntos
        }
      }

      // Preparar datos del mensaje
      const messageData = {
        conversationId,
        content: content.trim(),
        type: attachmentsData.length > 0 ? 'file' : type,
        senderIdentifier: req.user.email,
        recipientIdentifier: conversation.customerPhone,
        direction: 'outbound',
        status: 'pending',
        mediaUrl: attachmentsData.length > 0 ? attachmentsData[0].url : null,
        metadata: {
          ...metadata,
          sentBy: req.user.email,
          sentAt: new Date().toISOString(),
          attachments: attachmentsData
        }
      };

      // Usar el repositorio para escritura canónica
      const conversationsRepo = getConversationsRepository();
      const result = await conversationsRepo.appendOutbound({
        ...messageData,
        messageId: `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workspaceId: req.user.workspaceId,
        tenantId: req.user.tenantId
      });

      // Enviar por Twilio
      try {
        const messageService = getMessageService();
        
        let sentMessage;
        if (attachmentsData.length > 0) {
          // Enviar con archivos adjuntos
          const mediaUrls = attachmentsData.map(a => a.url);
          sentMessage = await messageService.sendWhatsAppMessage({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: conversation.customerPhone,
            body: content,
            mediaUrl: mediaUrls
          });
        } else {
          // Enviar solo texto
          sentMessage = await messageService.sendWhatsAppMessage({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: conversation.customerPhone,
            body: content
          });
        }

        // Actualizar mensaje con datos de Twilio
        await Message.getById(conversationId, result.message.id).then(msg => {
          if (msg) {
            msg.update({
              status: 'sent',
              metadata: {
                ...msg.metadata,
                twilioSid: sentMessage.sid,
                sentAt: new Date().toISOString()
              }
            });
          }
        });

      } catch (twilioError) {
        logger.error('Error enviando mensaje por Twilio', {
          conversationId,
          error: twilioError.message,
          userEmail: req.user.email
        });

        // Actualizar mensaje como fallido
        await Message.getById(conversationId, result.message.id).then(msg => {
          if (msg) {
            msg.update({
              status: 'failed',
              metadata: {
                ...msg.metadata,
                failureReason: twilioError.message,
                failedAt: new Date().toISOString()
              }
            });
          }
        });
      }

      // Emitir eventos websocket
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.broadcastToConversation({
          workspaceId: req.user.workspaceId || 'default_workspace',
          tenantId: req.user.tenantId || 'default_tenant',
          conversationId,
          event: 'new-message',
          payload: {
            message: result.message,
            conversation: result.conversation
          }
        });

        socketManager.broadcastToConversation({
          workspaceId: req.user.workspaceId || 'default_workspace',
          tenantId: req.user.tenantId || 'default_tenant',
          conversationId,
          event: 'conversation-updated',
          payload: {
            id: conversationId,
            lastMessage: result.conversation.lastMessage,
            lastMessageAt: result.conversation.lastMessageAt,
            unreadCount: result.conversation.unreadCount,
            messageCount: result.conversation.messageCount,
            status: result.conversation.status
          }
        });
      }

      logger.message('processing_completed', {
        messageId: result.message.id,
        conversationId,
        type: messageData.type,
        senderEmail: req.user.email,
        recipientPhone: conversation.customerPhone,
        hasMedia: !!mediaUrl,
        mediaCategory: fileMetadata?.category || null,
        successful: true
      });

      // 📤 RESPUESTA EXITOSA
      return ResponseHandler.success(res, result.message, 'Mensaje creado exitosamente', 201);
    } catch (error) {
      logger.error('Error creando mensaje en conversación', {
        conversationId: req.params?.conversationId,
        error: error.message,
        senderEmail: req.user?.email,
        stack: error.stack?.split('\n').slice(0, 3)
      });
      next(error);
    }
  }

  /**
   * 📤 POST /api/messages/send
   * Envía mensaje independiente (puede crear conversación si no existe)
   * 
   * BODY:
   * - conversationId: ID de conversación existente (opcional)
   * - to: número de teléfono del destinatario (opcional si hay conversationId)
   * - content: texto del mensaje (requerido)
   * - type: text|image|audio|video|document (default: text)
   * - attachments: array de archivos (opcional)
   * - metadata: objeto con datos adicionales (opcional)
   */
  static async sendMessage(req, res, next) {
    try {
      const { conversationId, to, content, type = 'text', attachments = [], metadata = {} } = req.body;

      let conversation;
      let targetPhone;

      // 🔍 DETERMINAR CONVERSACIÓN Y DESTINATARIO
      if (conversationId) {
        conversation = await Conversation.getById(conversationId);
        if (!conversation) {
          throw CommonErrors.CONVERSATION_NOT_FOUND(conversationId);
        }
        targetPhone = conversation.customerPhone;
      } else if (to) {
        // 🔧 CORREGIDO: Usar middleware de validación centralizada
        // La validación de teléfono debe realizarse en las rutas usando middleware
        targetPhone = to;
        
        // Buscar o crear conversación
        conversation = await Conversation.findOrCreate(targetPhone, req.user.email);
      } else {
        throw new ApiError(
          'MISSING_DESTINATION',
          'Debes proporcionar conversationId o to (número de teléfono)',
          'Especifica el destino del mensaje usando conversationId o to',
          400
        );
      }

      // 🔒 VALIDAR PERMISOS
      if (req.user.role === 'viewer') {
        throw CommonErrors.USER_NOT_AUTHORIZED('enviar mensajes', conversation.id);
      }

      // Procesar archivos adjuntos si existen
      let mediaUrl = null;
      let fileMetadata = null;

      if (attachments.length > 0) {
        try {
          const fileService = new FileService();
          fileMetadata = await fileService.processMessageAttachments(attachments, req.user.email);
          mediaUrl = fileMetadata.url;
        } catch (fileError) {
          logger.error('Error procesando archivos adjuntos', {
            conversationId: conversation.id,
            error: fileError.message,
            userEmail: req.user.email
          });
          // Continuar sin archivos adjuntos
        }
      }

      // Preparar datos del mensaje para el repositorio
      const messageData = {
        conversationId: conversation.id,
        messageId: `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: content.trim(),
        type: mediaUrl ? 'media' : type,
        direction: 'outbound',
        senderIdentifier: req.user.email,
        recipientIdentifier: targetPhone,
        timestamp: new Date(),
        workspaceId: req.user.workspaceId,
        tenantId: req.user.tenantId,
        metadata: {
          ...metadata,
          sentBy: req.user.email,
          sentAt: new Date().toISOString(),
          attachments: fileMetadata ? [fileMetadata] : []
        }
      };

      // Usar el repositorio para escritura canónica
      const conversationsRepo = getConversationsRepository();
      const result = await conversationsRepo.appendOutbound(messageData);

      // 📤 ENVIAR A TRAVÉS DE TWILIO
      try {
        const messageService = getMessageService();
        
        let sentMessage;
        if (mediaUrl) {
          // Enviar con archivos adjuntos
          sentMessage = await messageService.sendWhatsAppMessage({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: targetPhone,
            body: content,
            mediaUrl: mediaUrl
          });
        } else {
          // Enviar solo texto
          sentMessage = await messageService.sendWhatsAppMessage({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: targetPhone,
            body: content
          });
        }

        // Actualizar mensaje con datos de Twilio
        await Message.getById(conversation.id, result.message.id).then(msg => {
          if (msg) {
            msg.update({
              status: 'sent',
              metadata: {
                ...msg.metadata,
                twilioSid: sentMessage.sid,
                sentAt: new Date().toISOString()
              }
            });
          }
        });
        
      } catch (twilioError) {
        logger.error('Error enviando mensaje por Twilio', {
          conversationId: conversation.id,
          error: twilioError.message,
          userEmail: req.user.email
        });
        
        // Actualizar mensaje como fallido
        await Message.getById(conversation.id, result.message.id).then(msg => {
          if (msg) {
            msg.update({
              status: 'failed',
              metadata: {
                ...msg.metadata,
                failureReason: twilioError.message,
                failedAt: new Date().toISOString()
              }
            });
          }
        });
      }

      // 📡 EMITIR EVENTOS WEBSOCKET
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.broadcastToConversation({
          workspaceId: req.user.workspaceId || 'default_workspace',
          tenantId: req.user.tenantId || 'default_tenant',
          conversationId: conversation.id,
          event: 'new-message',
          payload: {
            message: result.message,
            conversation: result.conversation
          }
        });

        socketManager.broadcastToConversation({
          workspaceId: req.user.workspaceId || 'default_workspace',
          tenantId: req.user.tenantId || 'default_tenant',
          conversationId: conversation.id,
          event: 'conversation-updated',
          payload: {
            id: conversation.id,
            lastMessage: result.conversation.lastMessage,
            lastMessageAt: result.conversation.lastMessageAt,
            unreadCount: result.conversation.unreadCount,
            messageCount: result.conversation.messageCount,
            status: result.conversation.status
          }
        });
      }

      logger.info('Mensaje enviado independiente', {
        messageId: result.message.id,
        conversationId: conversation.id,
        targetPhone,
        senderEmail: req.user.email,
        status: result.message.status,
        hasAttachments: attachments.length > 0
      });

      return ResponseHandler.created(res, {
        message: result.message,
        conversation: result.conversation
      }, 'Mensaje enviado exitosamente');

    } catch (error) {
      logger.error('Error enviando mensaje independiente', {
        error: error.message,
        stack: error.stack,
        userEmail: req.user?.email,
        body: req.body
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * PUT /api/conversations/:conversationId/messages/:messageId/read
   * Marca un mensaje específico como leído por el usuario actual
   */
  static async markMessageAsRead(req, res, next) {
    try {
      const { conversationId, messageId } = req.params;
      const { markTimestamp = new Date() } = req.body;

      // 🔍 VERIFICAR QUE EL MENSAJE EXISTE
      const message = await Message.getById(conversationId, messageId);
      if (!message) {
        throw CommonErrors.MESSAGE_NOT_FOUND(messageId, conversationId);
      }

      // 🔍 VERIFICAR QUE LA CONVERSACIÓN EXISTE
      const conversation = await Conversation.getById(conversationId);
      if (!conversation) {
        throw CommonErrors.CONVERSATION_NOT_FOUND(conversationId);
      }

      // 📝 MARCAR COMO LEÍDO
      await message.markAsReadBy(req.user.email, markTimestamp);

      // 📡 EMITIR EVENTO WEBSOCKET usando facade
      const { getSocketManager } = require('../socket');
      const rt = getSocketManager();
      if (rt) {
        rt.broadcastToConversation({
          workspaceId: req.user.workspaceId,
          tenantId: req.user.tenantId,
          conversationId,
          event: 'message-read-by-user',
          payload: {
            messageId,
            conversationId,
            readBy: req.user.email,
            readAt: markTimestamp,
            timestamp: new Date().toISOString()
          }
        });
      }

      logger.info('Mensaje marcado como leído', {
        messageId,
        conversationId,
        readBy: req.user.email
      });

      return ResponseHandler.success(res, {
        messageId,
        conversationId,
        readBy: req.user.email,
        readAt: markTimestamp
      }, 'Mensaje marcado como leído');

    } catch (error) {
      logger.error('Error marcando mensaje como leído', {
        error: error.message,
        stack: error.stack,
        messageId: req.params.messageId,
        conversationId: req.params.conversationId,
        userEmail: req.user?.email
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🗑️ DELETE /api/conversations/:conversationId/messages/:messageId
   * Elimina mensaje específico (soft delete)
   */
  static async deleteMessage(req, res, next) {
    try {
      const { conversationId, messageId } = req.params;

      // 🔍 VERIFICAR QUE EL MENSAJE EXISTE
      const message = await Message.getById(conversationId, messageId);
      if (!message) {
        throw CommonErrors.MESSAGE_NOT_FOUND(messageId, conversationId);
      }

      // 🔒 VALIDAR PERMISOS (solo el remitente o admin pueden eliminar)
      const canDelete = req.user.role === 'admin' || 
                       req.user.role === 'superadmin' || 
                       message.senderIdentifier === req.user.email;

      if (!canDelete) {
        throw CommonErrors.USER_NOT_AUTHORIZED('eliminar este mensaje', messageId);
      }

      // 🗑️ ELIMINACIÓN SOFT (marcar como eliminado)
      await message.softDelete(req.user.email);

      // 📡 EMITIR EVENTO WEBSOCKET usando facade
      const { getSocketManager } = require('../socket');
      const rt = getSocketManager();
      if (rt) {
        rt.broadcastToConversation({
          workspaceId: req.user.workspaceId,
          tenantId: req.user.tenantId,
          conversationId,
          event: 'message-deleted',
          payload: {
            messageId,
            conversationId,
            deletedBy: req.user.email,
            timestamp: new Date().toISOString()
          }
        });
      }

      logger.info('Mensaje eliminado (soft delete)', {
        messageId,
        conversationId,
        deletedBy: req.user.email,
        originalSender: message.senderIdentifier
      });

      return ResponseHandler.success(res, {
        messageId,
        conversationId,
        deletedBy: req.user.email,
        deletedAt: new Date().toISOString()
      }, 'Mensaje eliminado exitosamente');

    } catch (error) {
      logger.error('Error eliminando mensaje', {
        error: error.message,
        stack: error.stack,
        messageId: req.params.messageId,
        conversationId: req.params.conversationId,
        userEmail: req.user?.email
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 📥 POST /api/messages/webhook
   * Webhook seguro de Twilio para mensajes entrantes
   * 
   * BODY: Datos del webhook de Twilio
   * RESPONSE: Siempre 200 OK para Twilio
   */
  static async handleWebhookSafe(req, res) {
    const startTime = Date.now();
    const requestId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // === LOG DE EMERGENCIA CRÍTICO AL INICIO ===
    console.log('🚨 EMERGENCY WEBHOOK RECEIVED:', {
      requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for']
      },
      body: req.body,
      bodyKeys: Object.keys(req.body || {}),
      step: 'webhook_received'
    });
    
    try {
      logger.info('🔗 WEBHOOK INICIADO', {
        requestId,
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        method: req.method,
        path: req.path,
        headers: {
          'content-type': req.headers['content-type'],
          'x-forwarded-for': req.headers['x-forwarded-for'],
          'x-real-ip': req.headers['x-real-ip']
        }
      });

      const { From: fromPhone, To: twilioPhone, Body: content, MessageSid: messageSid, NumMedia: numMedia } = req.body;

      // === LOG DE EMERGENCIA DESPUÉS DE DESTRUCTURACIÓN ===
      console.log('🚨 EMERGENCY WEBHOOK DATA EXTRACTED:', {
        requestId,
        fromPhone,
        twilioPhone,
        messageSid,
        hasContent: !!content,
        contentLength: content?.length || 0,
        contentPreview: content?.substring(0, 100) || null,
        numMedia: parseInt(numMedia) || 0,
        step: 'data_extracted'
      });

      logger.info('📥 PAYLOAD WEBHOOK RECIBIDO', {
        requestId,
        fromPhone,
        twilioPhone,
        messageSid,
        hasContent: !!content,
        contentLength: content?.length || 0,
        contentPreview: content?.substring(0, 100) || null,
        mediaCount: parseInt(numMedia) || 0,
        fullBody: req.body
      });

      // 🔍 VALIDACIÓN BÁSICA - CORREGIDA PARA MULTIMEDIA
      const hasMedia = parseInt(numMedia || '0') > 0;
      const hasContent = content && content.trim().length > 0;
      
      // === LOG DE EMERGENCIA ANTES DE VALIDACIÓN ===
      console.log('🚨 EMERGENCY BEFORE VALIDATION:', {
        requestId,
        hasFrom: !!fromPhone,
        hasContent: !!content,
        hasMedia,
        numMedia: parseInt(numMedia || '0'),
        step: 'before_validation'
      });
      
      // Permitir mensajes multimedia sin contenido de texto
      if (!fromPhone || (!hasContent && !hasMedia)) {
        // === LOG DE EMERGENCIA PARA VALIDACIÓN FALLIDA ===
        console.log('🚨 EMERGENCY VALIDATION FAILED:', {
          requestId,
          hasFrom: !!fromPhone,
          hasContent: !!content,
          hasMedia,
          numMedia: parseInt(numMedia || '0'),
          messageSid,
          step: 'validation_failed'
        });
        
        logger.warn('❌ WEBHOOK DATOS FALTANTES', {
          requestId,
          hasFrom: !!fromPhone,
          hasContent: !!content,
          hasMedia,
          numMedia: parseInt(numMedia || '0'),
          messageSid,
          body: req.body,
          validationFailed: true
        });
        
        // RESPONDER 200 OK SIEMPRE A TWILIO
        return ResponseHandler.success(res, {
          status: 'warning',
          message: 'Datos incompletos procesados',
          processTime: Date.now() - startTime
        }, 'Datos incompletos procesados', 200);
      }

      // === LOG DE EMERGENCIA DESPUÉS DE VALIDACIÓN ===
      console.log('🚨 EMERGENCY VALIDATION PASSED:', {
        requestId,
        fromPhone,
        twilioPhone,
        messageSid,
        hasContent: !!content,
        hasMedia,
        step: 'validation_passed'
      });

      logger.info('✅ WEBHOOK VALIDACIÓN BÁSICA PASADA', {
        requestId,
        fromPhone,
        twilioPhone,
        messageSid,
        hasContent: !!content
      });

      // 🔍 NORMALIZAR TELÉFONO
      const normalizedPhone = fromPhone;
      
      logger.info('📱 TELÉFONOS PROCESADOS', {
        requestId,
        originalFrom: fromPhone,
        normalizedFrom: normalizedPhone,
        to: twilioPhone,
        messageSid
      });

      // 🎯 USAR MESSAGESERVICE CENTRALIZADO (INCLUYE SOCKET.IO)
      logger.info('🔄 INICIANDO PROCESAMIENTO CON MESSAGESERVICE', {
        requestId,
        messageSid,
        fromPhone: normalizedPhone,
        hasContent: !!content,
        hasMedia: parseInt(numMedia) > 0,
        step: 'before_twilio_service'
      });

      // === LOG INMEDIATO ANTES DE LLAMAR MESSAGESERVICE ===
      logger.info('🚨 MESSAGECONTROLLER - ANTES DE LLAMAR MESSAGESERVICE', {
        requestId,
        messageSid,
        fromPhone: normalizedPhone,
        hasContent: !!content,
        hasMedia: parseInt(numMedia) > 0,
        reqBodyKeys: Object.keys(req.body),
        reqBodyValues: {
          From: req.body.From,
          To: req.body.To,
          Body: req.body.Body,
          MessageSid: req.body.MessageSid,
          NumMedia: req.body.NumMedia
        },
        step: 'before_twilio_service_call'
      });

      // === LOG DE EMERGENCIA ANTES DE MESSAGESERVICE ===
      console.log('🚨 EMERGENCY BEFORE MESSAGESERVICE:', {
        requestId,
        messageSid,
        fromPhone: normalizedPhone,
        hasContent: !!content,
        hasMedia: parseInt(numMedia) > 0,
        step: 'before_twilio_service_call'
      });

      // Procesar mensaje usando MessageService (que incluye Socket.IO events)
      const MessageService = require('../services/MessageService');
      const messageService = new MessageService();
      const { message, conversation } = await messageService.processIncomingMessage(req.body);

      // === LOG DE EMERGENCIA DESPUÉS DE MESSAGESERVICE ===
      console.log('🚨 EMERGENCY AFTER MESSAGESERVICE:', {
        requestId,
        messageId: message?.id,
        conversationId: conversation?.id || message?.conversationId,
        success: !!message,
        step: 'after_twilio_service'
      });

      logger.info('✅ MESSAGESERVICE PROCESAMIENTO COMPLETADO', {
        requestId,
        messageId: message.id,
        conversationId: conversation?.id || message.conversationId,
        contactUpdated: true,
        processTime: Date.now() - startTime,
        step: 'twilio_service_completed'
      });

      // 📤 RESPUESTA EXITOSA A TWILIO
      logger.info('📤 ENVIANDO RESPUESTA EXITOSA A TWILIO', {
        requestId,
        messageId: message.id,
        conversationId: conversation?.id || message.conversationId,
        processTime: Date.now() - startTime,
        step: 'sending_success_response'
      });

      return ResponseHandler.success(res, {
        status: 'success',
        message: 'Mensaje procesado correctamente',
        messageId: message.id,
        conversationId: conversation?.id || message.conversationId,
        processTime: Date.now() - startTime
      }, 'Mensaje procesado correctamente', 200);

    } catch (error) {
      // === LOG DE EMERGENCIA CRÍTICO EN CATCH PRINCIPAL ===
      console.log('🚨 EMERGENCY WEBHOOK CRITICAL ERROR:', {
        requestId,
        error: error.message,
        errorType: error.constructor.name,
        errorStack: error.stack?.split('\n').slice(0, 10),
        timestamp: new Date().toISOString(),
        step: 'critical_error'
      });
      
      logger.error('❌ ERROR CRÍTICO EN WEBHOOK', {
        requestId,
        error: error.message,
        errorType: error.constructor.name,
        stack: error.stack?.split('\n').slice(0, 20),
        processTime: Date.now() - startTime,
        step: 'webhook_error'
      });

      // RESPONDER 200 OK SIEMPRE A TWILIO (IMPORTANTE)
      return ResponseHandler.success(res, {
        status: 'error',
        message: 'Error procesado',
        processTime: Date.now() - startTime
      }, 'Error procesado', 200);
    }
  }

  /**
   * 📊 GET /api/messages/stats
   * Estadísticas de mensajes (para admins o del usuario actual)
   */
  static async getStats(req, res, next) {
    try {
      const { period = '7d', agentEmail = null, conversationId = null } = req.query;

      // 🔒 CONTROL DE PERMISOS
      let targetAgent = req.user.email;
      if (agentEmail && req.user.role === 'admin') {
        targetAgent = agentEmail;
      } else if (agentEmail && req.user.role !== 'admin') {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver estadísticas de otros agentes', 'stats');
      }

      const stats = await Message.getStats(targetAgent, period, conversationId);

      logger.info('Estadísticas de mensajes obtenidas', {
        userEmail: req.user.email,
        targetAgent,
        period,
        conversationId
      });

      return ResponseHandler.success(res, stats, 'Estadísticas generadas exitosamente');

    } catch (error) {
      logger.error('Error obteniendo estadísticas de mensajes', {
        error: error.message,
        stack: error.stack,
        userEmail: req.user?.email,
        query: req.query
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🔍 GET /api/messages/search
   * Búsqueda de mensajes en todas las conversaciones del usuario
   */
  static async searchMessages(req, res, next) {
    try {
      const { q: searchTerm, limit = 20, conversationId = null } = req.query;

      if (!searchTerm || searchTerm.length < 2) {
        throw new ApiError(
          'SEARCH_TERM_TOO_SHORT',
          'El término de búsqueda debe tener al menos 2 caracteres',
          'Proporciona un término de búsqueda más específico',
          400
        );
      }

      const searchOptions = {
        limit: Math.min(parseInt(limit), 100),
        searchTerm,
        conversationId,
        userEmail: req.user.role === 'viewer' ? req.user.email : null
      };

      const results = await Message.searchInUserConversations(searchOptions);

      logger.info('Búsqueda de mensajes ejecutada', {
        userEmail: req.user.email,
        searchTerm,
        conversationId,
        resultsCount: results.length
      });

      return ResponseHandler.success(
        res,
        results.map(msg => msg.toJSON()),
        `${results.length} mensajes encontrados para: "${searchTerm}"`
      );

    } catch (error) {
      logger.error('Error buscando mensajes', {
        error: error.message,
        stack: error.stack,
        userEmail: req.user?.email,
        query: req.query
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🆕 POST /api/messages/send-location
   * Envía mensaje de ubicación a un número específico
   */
  static async sendLocationMessage(req, res, next) {
    try {
      const { to, latitude, longitude, name, address, conversationId } = req.body;

      // Validar campos requeridos
      if (!to || !latitude || !longitude) {
        throw new ApiError(
          'MISSING_REQUIRED_FIELDS',
          'to, latitude y longitude son campos requeridos',
          'Proporciona todos los campos obligatorios',
          400
        );
      }

      // Validar coordenadas
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      
      if (isNaN(lat) || isNaN(lng)) {
        throw new ApiError(
          'INVALID_COORDINATES',
          'Las coordenadas deben ser números válidos',
          'Proporciona coordenadas numéricas válidas',
          400
        );
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new ApiError(
          'COORDINATES_OUT_OF_RANGE',
          'Las coordenadas están fuera del rango válido',
          'Latitud debe estar entre -90 y 90, longitud entre -180 y 180',
          400
        );
      }

      // Enviar mensaje de ubicación
      const result = await MessageService.sendLocationMessage(to, lat, lng, name || '', address || '');

      if (!result.success) {
        throw new ApiError(
          'LOCATION_SEND_FAILED',
          'Error enviando mensaje de ubicación',
          result.error,
          500
        );
      }

      // Si se proporciona conversationId, guardar en la conversación
      if (conversationId) {
        const messageData = {
          conversationId,
          messageId: result.messageData.id,
          content: result.messageData.content,
          type: 'location',
          direction: 'outbound',
          status: 'sent',
          senderIdentifier: req.user.email,
          recipientIdentifier: to,
          location: result.messageData.location,
          timestamp: new Date(),
          metadata: {
            sentBy: req.user.email,
            sentAt: new Date().toISOString(),
            twilioSid: result.messageData.metadata.twilioSid
          }
        };

        const conversationsRepo = getConversationsRepository();
        await conversationsRepo.appendOutbound(messageData);
      }

      logger.info('Mensaje de ubicación enviado exitosamente', {
        userEmail: req.user.email,
        to,
        latitude: lat,
        longitude: lng,
        conversationId: conversationId || 'none'
      });

      return ResponseHandler.success(res, {
        messageId: result.messageData.id,
        twilioSid: result.messageData.metadata.twilioSid,
        location: result.messageData.location
      }, 'Mensaje de ubicación enviado exitosamente', 201);

    } catch (error) {
      logger.error('Error enviando mensaje de ubicación', {
        error: error.message,
        stack: error.stack,
        userEmail: req.user?.email,
        body: req.body
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🆕 POST /api/messages/send-sticker
   * Envía mensaje de sticker a un número específico
   */
  static async sendStickerMessage(req, res, next) {
    try {
      const { to, stickerUrl, conversationId } = req.body;

      // Validar campos requeridos
      if (!to || !stickerUrl) {
        throw new ApiError(
          'MISSING_REQUIRED_FIELDS',
          'to y stickerUrl son campos requeridos',
          'Proporciona todos los campos obligatorios',
          400
        );
      }

      // Validar URL del sticker
      try {
        new URL(stickerUrl);
      } catch (urlError) {
        throw new ApiError(
          'INVALID_STICKER_URL',
          'La URL del sticker no es válida',
          'Proporciona una URL válida para el sticker',
          400
        );
      }

      // Enviar mensaje de sticker
      const result = await MessageService.sendStickerMessage(to, stickerUrl);

      if (!result.success) {
        throw new ApiError(
          'STICKER_SEND_FAILED',
          'Error enviando mensaje de sticker',
          result.error,
          500
        );
      }

      // Si se proporciona conversationId, guardar en la conversación
      if (conversationId) {
        const messageData = {
          conversationId,
          messageId: result.messageData.id,
          content: result.messageData.content,
          type: 'sticker',
          direction: 'outbound',
          status: 'sent',
          senderIdentifier: req.user.email,
          recipientIdentifier: to,
          sticker: result.messageData.sticker,
          mediaUrl: stickerUrl,
          timestamp: new Date(),
          metadata: {
            sentBy: req.user.email,
            sentAt: new Date().toISOString(),
            twilioSid: result.messageData.metadata.twilioSid
          }
        };

        const conversationsRepo = getConversationsRepository();
        await conversationsRepo.appendOutbound(messageData);
      }

      logger.info('Mensaje de sticker enviado exitosamente', {
        userEmail: req.user.email,
        to,
        stickerUrl,
        conversationId: conversationId || 'none'
      });

      return ResponseHandler.success(res, {
        messageId: result.messageData.id,
        twilioSid: result.messageData.metadata.twilioSid,
        sticker: result.messageData.sticker
      }, 'Mensaje de sticker enviado exitosamente', 201);

    } catch (error) {
      logger.error('Error enviando mensaje de sticker', {
        error: error.message,
        stack: error.stack,
        userEmail: req.user?.email,
        body: req.body
      });
      return ResponseHandler.error(res, error);
    }
  }
}

module.exports = MessageController;
