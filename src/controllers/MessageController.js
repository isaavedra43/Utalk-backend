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
const { getTwilioService } = require('../services/TwilioService');
const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
const logger = require('../utils/logger');
const { validateAndNormalizePhone } = require('../utils/phoneValidation');
const MediaUploadController = require('../controllers/MediaUploadController');
const { v4: uuidv4 } = require('uuid');

class MessageController {
  /**
   * 📋 GET /api/conversations/:conversationId/messages
   * Lista mensajes de una conversación con paginación y filtros
   * 
   * QUERY PARAMS:
   * - limit: número de resultados (default: 50, max: 100)
   * - cursor: cursor de paginación
   * - direction: inbound|outbound|system
   * - status: sent|delivered|read|failed
   * - type: text|image|audio|video|document|system
   * - startDate: fecha inicio (ISO)
   * - endDate: fecha fin (ISO)
   * - orderBy: timestamp|status (default: timestamp)
   * - order: asc|desc (default: desc)
   */
  static async getMessages(req, res, next) {
    try {
      const { conversationId } = req.params;
      const {
        limit = 50,
        cursor = null,
        direction = null,
        status = null,
        type = null,
        startDate = null,
        endDate = null,
        orderBy = 'timestamp',
        order = 'desc'
      } = req.query;

      // ✅ NUEVO: Log de inicio de búsqueda
      req.logger.message('search_executed', {
        conversationId,
        filters: {
          limit: Math.min(parseInt(limit), 100),
          direction,
          status,
          type,
          hasDateRange: !!(startDate && endDate)
        },
        userEmail: req.user.email
      });

      // 🔍 VERIFICAR QUE LA CONVERSACIÓN EXISTE
      req.logger.database('query_started', {
        operation: 'conversation_exists_check',
        conversationId
      });

      const conversation = await Conversation.getById(conversationId);
      if (!conversation) {
        req.logger.database('document_not_found', {
          operation: 'conversation_by_id',
          conversationId
        });
        throw CommonErrors.CONVERSATION_NOT_FOUND(conversationId);
      }

      // 🔒 VALIDAR PERMISOS DE ACCESO
      if (req.user.role === 'viewer' && conversation.assignedTo !== req.user.email) {
        req.logger.security('unauthorized_access', {
          operation: 'view_messages',
          conversationId,
          userEmail: req.user.email,
          userRole: req.user.role,
          conversationAssignedTo: conversation.assignedTo
        });
        throw CommonErrors.USER_NOT_AUTHORIZED('ver mensajes de esta conversación', conversationId);
      }

      // 🔍 OPCIONES DE BÚSQUEDA
      const searchOptions = {
        limit: Math.min(parseInt(limit), 100),
        cursor,
        direction,
        status,
        type,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        orderBy,
        order
      };

      req.logger.database('query_started', {
        operation: 'messages_by_conversation',
        conversationId,
        searchOptions
      });

      // 📊 EJECUTAR BÚSQUEDA
      const result = await Message.getByConversation(conversationId, searchOptions);

      req.logger.message('search_completed', {
        conversationId,
        messagesFound: result.messages.length,
        hasNextPage: !!result.pagination.nextCursor,
        userEmail: req.user.email
      });

      // 📤 RESPUESTA ESTÁNDAR CON PAGINACIÓN
      return ResponseHandler.successPaginated(
        res,
        result.messages.map(msg => msg.toJSON()),
        result.pagination,
        `${result.messages.length} mensajes encontrados`,
        200
      );
    } catch (error) {
      req.logger.error('Error obteniendo mensajes', {
        conversationId: req.params.conversationId,
        error: error.message,
        userEmail: req.user?.email,
        stack: error.stack?.split('\n').slice(0, 3)
      });
      next(error);
    }
  }

  /**
   * 📝 POST /api/conversations/:conversationId/messages
   * Crear nuevo mensaje en una conversación específica
   */
  static async createMessageInConversation(req, res, next) {
    try {
      const { conversationId } = req.params;
      const { 
        messageId,          // ✅ AGREGAR: Extraer messageId del frontend
        content, 
        type = 'text', 
        mediaUrl = null, 
        fileMetadata = {},
        replyToMessageId = null, 
        metadata = {} 
      } = req.body;

      // ✅ NUEVO: Log de inicio de creación
      req.logger.message('processing_started', {
        conversationId,
        messageId: messageId || 'auto-generated',
        type,
        hasContent: !!content,
        hasMedia: !!mediaUrl,
        senderEmail: req.user.email
      });

      // 🔍 VERIFICAR QUE LA CONVERSACIÓN EXISTE
      req.logger.database('query_started', {
        operation: 'conversation_validation',
        conversationId
      });

      const conversation = await Conversation.getById(conversationId);
      if (!conversation) {
        req.logger.database('document_not_found', {
          operation: 'conversation_by_id_for_message',
          conversationId
        });
        throw CommonErrors.CONVERSATION_NOT_FOUND(conversationId);
      }

      // 🔒 VALIDAR PERMISOS DE ESCRITURA
      if (req.user.role === 'viewer') {
        req.logger.security('unauthorized_access', {
          operation: 'create_message',
          conversationId,
          userEmail: req.user.email,
          userRole: req.user.role
        });
        throw CommonErrors.USER_NOT_AUTHORIZED('enviar mensajes', conversationId);
      }

      // VALIDAR QUE HAY CONTENIDO O MEDIA
      if (!content && !mediaUrl) {
        req.logger.message('validation_failed', {
          reason: 'missing_content_and_media',
          conversationId,
          senderEmail: req.user.email
        });
        throw new ApiError('MISSING_CONTENT', 'Debes proporcionar contenido o un archivo multimedia', 'Agrega texto o sube un archivo', 400);
      }

      // 🆔 VALIDAR O GENERAR messageId
      let finalMessageId = messageId;
      if (!finalMessageId) {
        // Generar UUID si el frontend no lo envía
        finalMessageId = uuidv4();
        req.logger.message('id_generated', {
          conversationId,
          generatedMessageId: finalMessageId,
          senderEmail: req.user.email
        });
      }

      // VALIDAR URL DE FIREBASE STORAGE SI EXISTE
      if (mediaUrl) {
        const isValidFirebaseUrl = mediaUrl.includes('firebasestorage.googleapis.com') || 
                                  mediaUrl.includes('storage.googleapis.com');
        
        if (!isValidFirebaseUrl) {
          req.logger.media('invalid_format', {
            reason: 'non_firebase_storage_url',
            providedUrl: mediaUrl.substring(0, 100),
            conversationId
          });
          throw new ApiError('INVALID_MEDIA_URL', 'URL de media inválida', 'Usa solo URLs de Firebase Storage', 400);
        }

        req.logger.media('url_validated', {
          mediaUrl: mediaUrl.substring(0, 100) + '...',
          conversationId,
          messageId: finalMessageId
        });
      }

      // 📝 PREPARAR DATOS DEL MENSAJE
      const messageData = {
        id: finalMessageId,              // ✅ CORREGIDO: Usar messageId del frontend como id
        conversationId,
        content: content || null,
        type: mediaUrl ? 'media' : 'text',
        mediaUrl,
        senderIdentifier: req.user.email,
        recipientIdentifier: conversation.customerPhone,
        direction: 'outbound',
        status: 'sent',
        replyToMessageId,
        metadata: {
          ...metadata,
          sentBy: req.user.email,
          sentAt: new Date().toISOString(),
          // AGREGAR METADATOS DE ARCHIVO SI EXISTE
          ...(mediaUrl && fileMetadata && {
            fileInfo: {
              category: fileMetadata.category,
              size: fileMetadata.size,
              originalName: fileMetadata.originalName,
              duration: fileMetadata.duration,
              transcription: fileMetadata.transcription,
              ...fileMetadata
            }
          })
        }
      };

      // 📤 ENVIAR A TRAVÉS DE TWILIO
      if (type === 'text' && !mediaUrl) {
        // Enviar mensaje de texto
        try {
          req.logger.twilio('message_sending', {
            conversationId,
            messageId: finalMessageId,
            recipientPhone: conversation.customerPhone,
            contentLength: content?.length || 0
          });

          const twilioService = getTwilioService();
          const sentMessage = await twilioService.sendWhatsAppMessage(
            conversation.customerPhone,
            content
          );
          // ✅ MANTENER EL UUID DEL FRONTEND COMO ID PRINCIPAL
          messageData.metadata.twilioSid = sentMessage.sid;
          messageData.metadata.sentViaWhatsApp = true;

          req.logger.twilio('message_sent', {
            conversationId,
            messageId: finalMessageId,
            twilioSid: sentMessage.sid,
            recipientPhone: conversation.customerPhone
          });

        } catch (twilioError) {
          req.logger.twilio('message_failed', {
            conversationId,
            messageId: finalMessageId,
            error: twilioError.message,
            recipientPhone: conversation.customerPhone
          });
          
          // Continuar guardando el mensaje aunque Twilio falle
          messageData.status = 'failed';
          messageData.metadata.failureReason = twilioError.message;
        }
      } else if (mediaUrl) {
        // MENSAJE CON ARCHIVO MULTIMEDIA
        try {
          req.logger.media('whatsapp_compatibility_check', {
            category: fileMetadata.category,
            conversationId,
            messageId: finalMessageId
          });

          const twilioService = getTwilioService();
          
          // Determinar si el archivo es válido para WhatsApp
          const isWhatsAppCompatible = MediaUploadController.isWhatsAppCompatible(fileMetadata.category, fileMetadata);
          
          if (isWhatsAppCompatible) {
            req.logger.media('whatsapp_compatible', {
              category: fileMetadata.category,
              messageId: finalMessageId
            });

            // Enviar con media a través de Twilio
            const sentMessage = await twilioService.sendWhatsAppMessage(
              conversation.customerPhone,
              content || `📎 ${fileMetadata.originalName || 'Archivo adjunto'}`,
              mediaUrl
            );
            // ✅ MANTENER EL UUID DEL FRONTEND COMO ID PRINCIPAL
            messageData.metadata.twilioSid = sentMessage.sid;
            messageData.metadata.sentViaWhatsApp = true;

            req.logger.twilio('media_sent', {
              conversationId,
              messageId: finalMessageId,
              twilioSid: sentMessage.sid,
              mediaType: fileMetadata.category
            });

          } else {
            // Solo guardar en base de datos (no enviar por WhatsApp)
            messageData.metadata.sentViaWhatsApp = false;
            messageData.metadata.reason = 'Tipo de archivo no compatible con WhatsApp';
            
            req.logger.media('whatsapp_incompatible', {
              category: fileMetadata.category,
              messageId: finalMessageId,
              reason: 'file_type_not_supported'
            });
          }
        } catch (twilioError) {
          req.logger.twilio('media_failed', {
            conversationId,
            messageId: finalMessageId,
            error: twilioError.message,
            mediaUrl: mediaUrl.substring(0, 100) + '...'
          });
          
          messageData.status = 'failed';
          messageData.metadata.failureReason = twilioError.message;
        }
      }

      // 💾 GUARDAR EN BASE DE DATOS
      req.logger.message('creating', {
        messageId: messageData.id,
        conversationId,
        senderEmail: req.user.email,
        hasContent: !!content,
        hasMedia: !!mediaUrl,
        direction: 'outbound'
      });

      const message = await Message.create(messageData);

      req.logger.message('created', {
        messageId: message.id,
        conversationId,
        status: 'success',
        direction: 'outbound'
      });

      // 📡 EMITIR EVENTOS WEBSOCKET
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        try {
          req.logger.socket('message_emitting', {
            messageId: message.id,
            conversationId,
            connectedUsers: socketManager.getConnectedUsers().length,
            messageStructure: {
              hasId: !!message.id,
              hasContent: !!message.content,
              hasSender: !!message.senderIdentifier,
              hasRecipient: !!message.recipientIdentifier,
            }
          });
          
          socketManager.emitNewMessage(conversationId, message);
          
          // Notificar a agente asignado si es diferente al remitente
          if (conversation.assignedTo && conversation.assignedTo !== req.user.email) {
            socketManager.io.emit('message-notification', {
              type: 'new-message',
              conversationId,
              message: message.toJSON(),
              targetAgent: conversation.assignedTo,
              timestamp: new Date().toISOString()
            });
          }
          
          req.logger.socket('message_emitted', {
            messageId: message.id,
            conversationId,
            connectedUsers: socketManager.getConnectedUsers().length,
            status: 'success'
          });

        } catch (socketError) {
          req.logger.socket('message_emit_failed', {
            error: socketError.message,
            messageId: message.id,
            conversationId,
            stack: socketError.stack?.split('\n').slice(0, 3)
          });
          // Continuar aunque falle Socket.IO
        }
      } else {
        req.logger.socket('manager_unavailable', {
          messageId: message.id,
          conversationId,
          operation: 'message_emit'
        });
      }

      req.logger.message('processing_completed', {
        messageId: message.id,
        conversationId,
        type: messageData.type,
        senderEmail: req.user.email,
        recipientPhone: conversation.customerPhone,
        hasMedia: !!mediaUrl,
        mediaCategory: fileMetadata.category || null,
        successful: true
      });

      // 📤 RESPUESTA EXITOSA
      return ResponseHandler.success(res, message.toJSON(), 'Mensaje creado exitosamente', 201);
    } catch (error) {
      req.logger.error('Error creando mensaje en conversación', {
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
        // Validar y normalizar teléfono
        const phoneValidation = validateAndNormalizePhone(to);
        if (!phoneValidation.isValid) {
          throw new ApiError(
            'INVALID_PHONE_NUMBER',
            `Número de teléfono inválido: ${phoneValidation.error}`,
            'Proporciona un número de teléfono válido en formato internacional',
            400,
            { to, error: phoneValidation.error }
          );
        }

        targetPhone = phoneValidation.normalized;
        
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

      // 📝 PREPARAR DATOS DEL MENSAJE
      const messageData = {
        conversationId: conversation.id,
        content,
        type,
        senderIdentifier: req.user.email,
        recipientIdentifier: targetPhone,
        direction: 'outbound',
        status: 'pending',
        metadata: {
          ...metadata,
          sentBy: req.user.email,
          sentAt: new Date().toISOString(),
          attachments
        }
      };

      // 📤 ENVIAR A TRAVÉS DE TWILIO
      try {
        const twilioService = getTwilioService();
        
        let sentMessage;
        if (attachments.length > 0) {
          // Enviar con archivos adjuntos
          sentMessage = await twilioService.sendWhatsAppMessageWithMedia(
            targetPhone,
            content,
            attachments[0].url // Por ahora solo el primer archivo
          );
        } else {
          // Enviar solo texto
          sentMessage = await twilioService.sendWhatsAppMessage(targetPhone, content);
        }

        messageData.id = sentMessage.sid;
        messageData.status = 'sent';
        messageData.metadata.twilioSid = sentMessage.sid;
        
      } catch (twilioError) {
        logger.error('Error enviando mensaje por Twilio', {
          conversationId: conversation.id,
          error: twilioError.message,
          userEmail: req.user.email
        });
        
        messageData.status = 'failed';
        messageData.metadata.failureReason = twilioError.message;
      }

      // 💾 GUARDAR EN BASE DE DATOS
      const message = await Message.create(messageData);

      // 📡 EMITIR EVENTOS WEBSOCKET
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.emitNewMessage(conversation.id, message);
      }

      logger.info('Mensaje enviado independiente', {
        messageId: message.id,
        conversationId: conversation.id,
        targetPhone,
        senderEmail: req.user.email,
        status: messageData.status,
        hasAttachments: attachments.length > 0
      });

      return ResponseHandler.created(res, {
        message: message.toJSON(),
        conversation: conversation.toJSON()
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

      // 📡 EMITIR EVENTO WEBSOCKET
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.io.to(`conversation-${conversationId}`).emit('message-read-by-user', {
          messageId,
          conversationId,
          readBy: req.user.email,
          readAt: markTimestamp,
          timestamp: new Date().toISOString()
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

      // 📡 EMITIR EVENTO WEBSOCKET
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.io.to(`conversation-${conversationId}`).emit('message-deleted', {
          messageId,
          conversationId,
          deletedBy: req.user.email,
          timestamp: new Date().toISOString()
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
   * 🔗 POST /api/messages/webhook
   * Webhook PÚBLICO para recibir mensajes de Twilio WhatsApp
   * Siguiendo las mejores prácticas de Vinay Sahni para webhooks
   */
  static async handleWebhookSafe(req, res) {
    const startTime = Date.now();
    
    try {
      const { From: fromPhone, To: twilioPhone, Body: content, MessageSid: messageSid, NumMedia: numMedia } = req.body;

      // 📝 LOG CRÍTICO PARA RAILWAY
      console.log('🔗 WEBHOOK TWILIO - Mensaje recibido', {
        timestamp: new Date().toISOString(),
        from: fromPhone,
        to: twilioPhone,
        messageSid,
        hasContent: !!content,
        mediaCount: parseInt(numMedia) || 0,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });

      // 🔍 VALIDACIÓN BÁSICA
      if (!fromPhone || !content) {
        logger.warn('Webhook con datos faltantes', {
          hasFrom: !!fromPhone,
          hasContent: !!content,
          messageSid,
          body: req.body
        });
        
        // RESPONDER 200 OK SIEMPRE A TWILIO
        return ResponseHandler.success(res, {
          status: 'warning',
          message: 'Datos incompletos procesados',
          processTime: Date.now() - startTime
        }, 'Datos incompletos procesados', 200);
      }

      // 🔍 NORMALIZAR TELÉFONO
      const phoneValidation = validateAndNormalizePhone(fromPhone);
      if (!phoneValidation.isValid) {
        logger.error('Teléfono inválido en webhook', {
          fromPhone,
          error: phoneValidation.error,
          messageSid
        });
        
        return ResponseHandler.success(res, {
          status: 'error',
          message: 'Teléfono inválido procesado',
          processTime: Date.now() - startTime
        }, 'Teléfono inválido procesado', 200);
      }

      // 🔍 ENCONTRAR O CREAR CONVERSACIÓN
      const conversation = await Conversation.findOrCreate(phoneValidation.normalized);

      // 📝 PREPARAR DATOS DEL MENSAJE
      const messageData = {
        id: messageSid,
        conversationId: conversation.id,
        content,
        senderIdentifier: phoneValidation.normalized,
        recipientIdentifier: conversation.assignedTo || twilioPhone,
        direction: 'inbound',
        status: 'received',
        type: parseInt(numMedia) > 0 ? 'media' : 'text',
        metadata: {
          twilio: req.body,
          receivedAt: new Date().toISOString(),
          source: 'webhook'
        }
      };

      // 📎 PROCESAR MEDIA SI EXISTE
      if (parseInt(numMedia) > 0) {
        messageData.mediaUrl = `${process.env.TWILIO_MEDIA_BASE_URL || 'https://api.twilio.com'}/media/${messageSid}`;
        messageData.metadata.mediaCount = parseInt(numMedia);
      }

      // 💾 GUARDAR MENSAJE EN BASE DE DATOS
      logger.info('[BACKEND][WEBHOOK][GUARDANDO] Intentando guardar mensaje de cliente', {
        messageId: messageData.id,
        conversationId: conversation.id,
        fromPhone: phoneValidation.normalized,
        hasContent: !!content,
        hasMedia: parseInt(numMedia) > 0,
        direction: 'inbound'
      });

      const message = await Message.create(messageData);

      logger.info('[BACKEND][WEBHOOK][GUARDADO] Mensaje de cliente guardado exitosamente', {
        messageId: message.id,
        conversationId: conversation.id,
        status: 'success'
      });

      // 📡 EMITIR EVENTOS WEBSOCKET
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        try {
          // NUEVO: Logging detallado antes de emitir mensaje entrante
          logger.info('[BACKEND][WEBHOOK][SOCKET][PRE-EMIT] Preparando emisión de mensaje entrante', {
            messageId: message.id,
            conversationId: conversation.id,
            socketManagerAvailable: true,
            connectedUsers: socketManager.getConnectedUsers().length,
            messageStructure: {
              hasId: !!message.id,
              hasContent: !!message.content,
              hasSender: !!message.senderIdentifier,
              hasRecipient: !!message.recipientIdentifier,
            }
          });
          
          socketManager.emitNewMessage(conversation.id, message);
          
          // Notificación especial para mensajes entrantes
          socketManager.io.emit('incoming-message-notification', {
            type: 'incoming-message',
            conversationId: conversation.id,
            message: message.toJSON(),
            customer: {
              phone: phoneValidation.normalized,
              name: conversation.contact?.name || phoneValidation.normalized
            },
            assignedTo: conversation.assignedTo,
            timestamp: new Date().toISOString()
          });
          
          logger.info('[BACKEND][WEBHOOK][SOCKET][EMITIDO] Mensaje entrante emitido exitosamente via Socket.IO', {
            messageId: message.id,
            conversationId: conversation.id,
            socketManagerAvailable: true,
            connectedUsers: socketManager.getConnectedUsers().length,
            status: 'success'
          });
        } catch (socketError) {
          logger.error('[BACKEND][WEBHOOK][SOCKET][ERROR] Error emitiendo mensaje entrante via Socket.IO', {
            error: socketError.message,
            stack: socketError.stack,
            messageId: message.id,
            conversationId: conversation.id
          });
          // Continuar aunque falle Socket.IO
        }
      } else {
        logger.warn('[BACKEND][WEBHOOK][SOCKET][NO_DISPONIBLE] SocketManager no disponible para mensaje entrante', {
          messageId: message.id,
          conversationId: conversation.id
        });
      }

      logger.info('Webhook procesado exitosamente', {
        messageId: message.id,
        conversationId: conversation.id,
        fromPhone: phoneValidation.normalized,
        assignedTo: conversation.assignedTo,
        hasMedia: !!messageData.mediaUrl,
        processTime: Date.now() - startTime
      });

      // RESPUESTA EXITOSA A TWILIO
      return ResponseHandler.success(res, {
        status: 'success',
        message: 'Mensaje procesado exitosamente',
        messageId: message.id,
        conversationId: conversation.id,
        processTime: Date.now() - startTime
      }, 'Mensaje procesado exitosamente', 200);

    } catch (error) {
      // ERROR CRÍTICO: Log pero responder 200 OK
      console.error('WEBHOOK - Error crítico:', {
        error: error.message,
        stack: error.stack.split('\n')[0],
        body: req.body,
        processTime: Date.now() - startTime
      });

      logger.error('Error crítico en webhook', {
        error: error.message,
        stack: error.stack,
        body: req.body,
        processTime: Date.now() - startTime
      });

      // RESPONDER SIEMPRE 200 OK A TWILIO
      return ResponseHandler.success(res, {
        status: 'error_handled',
        message: 'Error procesado, reintento no requerido',
        error: error.message,
        processTime: Date.now() - startTime
      }, 'Error procesado, reintento no requerido', 200);
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
}

module.exports = MessageController;
