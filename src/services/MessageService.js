const Message = require('../models/Message');
const ContactService = require('./ContactService');
const Conversation = require('../models/Conversation');
const twilio = require('twilio');
const logger = require('../utils/logger');
const { generateConversationId, normalizePhoneNumber } = require('../utils/conversation');
const { validateMessagesArrayResponse } = require('../middleware/validation');
const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const FileService = require('./FileService');
const { getConversationsRepository } = require('../repositories/ConversationsRepository');
const { integrateAIWithIncomingMessage } = require('./AIWebhookIntegration');

/**
 * Servicio centralizado para toda la lógica de mensajes
 * Unifica operaciones distribuidas entre controladores y servicios
 * Incluye toda la funcionalidad de Twilio (enviar y procesar mensajes)
 */
class MessageService {
  constructor(client) {
    const accountSid =
      process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID || process.env.TWILIO_ACCOUNTID;
    const authToken  =
      process.env.TWILIO_AUTH_TOKEN  || process.env.TWILIO_TOKEN || process.env.TWILIO_SECRET;

    this.whatsappNumber =
      process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_FROM || process.env.WHATSAPP_FROM;

    this._diagLogBoot(accountSid, authToken, this.whatsappNumber);

    if (!accountSid || !authToken) {
      // No rompas la app con throw sin control; deja que el caller lo capture y mapee a 424
      const e = new Error('Missing Twilio credentials: TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN');
      e.code = 20003; // equivalente a auth fail para mapeo uniforme
      throw e;
    }
    this.client = client || twilio(accountSid, authToken);
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

  _diagLogBoot(sid, token, from) {
    const sidLast4 = sid ? String(sid).slice(-4) : null;
    logger?.info?.('TWILIO:BOOT', {
      hasSid: !!sid, sidLast4,
      hasToken: !!token,
      from
    });
  }
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
      const message = await MessageService.createMessage(messageData);

      // Enviar por Twilio
      try {
        const messageService = getMessageService();
        const twilioResult = await messageService.sendWhatsAppMessage({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: toPhone,
          body: content,
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
   * Procesar webhook de mensaje entrante de Twilio
   */
  static async processWebhook(webhookData, requestId) {
    try {
      const {
        From,
        To,
        MessageSid,
        Body,
        Latitude,
        Longitude,
        StickerId,
        StickerPackId,
        NumMedia,
        ProfileName
      } = webhookData;

      // Validar webhook data
      if (!From || !To || !MessageSid) {
        throw new Error('From, To y MessageSid son requeridos');
      }

      // 🆕 DETECTAR TIPO DE MENSAJE ESPECÍFICO
      let messageType = 'text';
      let specialData = null;

      // Detectar mensaje de ubicación
      if (Latitude && Longitude) {
        messageType = 'location';
        specialData = {
          latitude: parseFloat(Latitude),
          longitude: parseFloat(Longitude),
          name: webhookData.LocationName || '',
          address: webhookData.LocationAddress || ''
        };
        logger.info('📍 Mensaje de ubicación detectado', {
          requestId,
          latitude: specialData.latitude,
          longitude: specialData.longitude,
          name: specialData.name,
          address: specialData.address
        });
      }
      // Detectar mensaje de sticker
      else if (StickerId || StickerPackId) {
        messageType = 'sticker';
        specialData = {
          packId: StickerPackId || null,
          stickerId: StickerId || null,
          emoji: webhookData.StickerEmoji || null,
          url: webhookData.MediaUrl0 || null
        };
        logger.info('😀 Mensaje de sticker detectado', {
          requestId,
          packId: specialData.packId,
          stickerId: specialData.stickerId,
          emoji: specialData.emoji
        });
      }
      // Detectar mensaje multimedia
      else if (parseInt(NumMedia || '0') > 0) {
        messageType = 'media';
        logger.info('📎 Mensaje multimedia detectado', {
          requestId,
          numMedia: parseInt(NumMedia)
        });
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
        
      // Derivar workspace/tenant (nunca undefined)
      const derivedWorkspaceId = process.env.WORKSPACE_ID || process.env.DEFAULT_WORKSPACE_ID || 'default_workspace';
      const derivedTenantId = process.env.TENANT_ID || process.env.DEFAULT_TENANT_ID || 'default_tenant';

      // Derivar email de agente (si no se conoce, usar sistema)
      const derivedAgentEmail = process.env.DEFAULT_AGENT_EMAIL || 'system@utalk.local';

      // Resolver routing Twilio (config + ENV)
      const { resolveRouting } = require('../config/twilioRouting');
      const routing = resolveRouting({ toPhone: toPhone, fromPhone: fromPhone });
      const routingWorkspaceId = routing?.workspaceId || derivedWorkspaceId;
      const routingTenantId = routing?.tenantId || derivedTenantId;
      const routingAgentEmail = routing?.agentEmail || derivedAgentEmail;

      // Extraer nombre del cliente (WhatsApp ProfileName)
      const profileName = (ProfileName || '').trim();

      // A3: Log de shape inbound (sin PII)
      try {
        logger.info('write.shape_inbound', {
          sources: {
            hasRoutingConfig: !!routing,
            envWorkspace: !!derivedWorkspaceId,
            envTenant: !!derivedTenantId,
            envDefaultAgent: !!derivedAgentEmail
          },
          routingResolved: {
            wsPresent: !!routingWorkspaceId,
            tenPresent: !!routingTenantId,
            agentEmailPresent: !!routingAgentEmail
          }
        });
      } catch (_) {}

      // Preparar datos normalizados para el repositorio
        const messageData = {
        conversationId,
        messageId: `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: Body || '',
        type: messageType,
          direction: 'inbound',
        senderIdentifier: fromPhone,
        recipientIdentifier: toPhone,
        agentEmail: routingAgentEmail,
        profileName: profileName || undefined, // sólo si viene
        timestamp: new Date(),
        workspaceId: routingWorkspaceId,
        tenantId: routingTenantId,
          metadata: {
          twilioSid: MessageSid,
          generatedId: true,
          timestamp: new Date().toISOString(),
          uniqueTimestamp: Date.now(),
          routingResolved: {
            wsPresent: !!routingWorkspaceId,
            tenPresent: !!routingTenantId,
            agentEmailPresent: !!routingAgentEmail
          }
        }
      };

      // 🆕 AGREGAR DATOS ESPECÍFICOS SEGÚN TIPO DE MENSAJE
      if (messageType === 'location' && specialData) {
        messageData.location = specialData;
        messageData.content = specialData.name && specialData.address ? 
          `${specialData.name}\n${specialData.address}` : 
          (specialData.name || specialData.address || 'Ubicación compartida');
      }
      
      if (messageType === 'sticker' && specialData) {
        messageData.sticker = specialData;
        messageData.content = specialData.emoji || 'Sticker enviado';
        if (specialData.url) {
          messageData.mediaUrl = specialData.url;
        }
      }
      
      // 🔍 LOG DETALLADO DEL WEBHOOK COMPLETO
      console.log('🔍 WEBHOOK COMPLETO RECIBIDO:', {
        requestId,
        timestamp: new Date().toISOString(),
        messageSid: MessageSid,
        from: From,
        to: To,
        body: Body,
        messageType,
        numMedia: parseInt(NumMedia || '0'),
        referralNumMedia: webhookData.referralNumMedia,
        allKeys: Object.keys(webhookData),
        mediaKeys: Object.keys(webhookData).filter(key => key.startsWith('Media')),
        webhookData: JSON.stringify(webhookData, null, 2)
      });
      
      // Procesar media si es un mensaje multimedia
      if (messageType === 'media' && parseInt(NumMedia || '0') > 0) {
        console.log('🔄 INICIANDO PROCESAMIENTO DE MEDIA:', {
          requestId,
          messageType,
          numMedia: parseInt(NumMedia),
          webhookKeys: Object.keys(webhookData).filter(key => key.startsWith('Media'))
        });
        
        try {
          const mediaResult = await this.processWebhookMedia(webhookData);
          console.log('📊 RESULTADO DE MEDIA:', {
            requestId,
            urlsCount: mediaResult.urls.length,
            urls: mediaResult.urls,
            primaryType: mediaResult.primaryType,
            count: mediaResult.count
          });
          
          if (mediaResult.urls.length > 0) {
            // Usar la primera URL de media como mediaUrl principal
            messageData.mediaUrl = mediaResult.urls[0];
            // Actualizar el tipo basado en el tipo principal detectado
            messageData.type = mediaResult.primaryType;
            
            console.log('✅ MEDIA ASIGNADO AL MENSAJE:', {
              requestId,
              mediaUrl: messageData.mediaUrl,
              type: messageData.type
            });
            
            logger.info('✅ Media procesado exitosamente', {
              requestId,
              mediaUrl: messageData.mediaUrl,
              primaryType: mediaResult.primaryType,
              mediaCount: mediaResult.count
            });
          } else {
            console.log('❌ NO SE ENCONTRARON URLs DE MEDIA:', {
              requestId,
              mediaResult,
              webhookKeys: Object.keys(webhookData).filter(key => key.startsWith('Media')),
              numMedia: parseInt(NumMedia || '0')
            });
            
            // 🔧 CORRECCIÓN: Si no se encontraron URLs pero NumMedia > 0, intentar extraer manualmente
            if (parseInt(NumMedia || '0') > 0) {
              console.log('🔧 Intentando extracción manual de media...');
              const manualUrls = [];
              
              for (let i = 0; i < parseInt(NumMedia); i++) {
                const mediaUrl = webhookData[`MediaUrl${i}`];
                if (mediaUrl) {
                  manualUrls.push(mediaUrl);
                  console.log(`🔧 MediaUrl${i} encontrado manualmente: ${mediaUrl}`);
                }
              }
              
              if (manualUrls.length > 0) {
                messageData.mediaUrl = manualUrls[0];
                console.log('✅ MEDIA ASIGNADO MANUALMENTE:', {
                  requestId,
                  mediaUrl: messageData.mediaUrl
                });
              }
            }
          }
        } catch (mediaError) {
          console.log('❌ ERROR PROCESANDO MEDIA:', {
            requestId,
            error: mediaError.message,
            stack: mediaError.stack?.split('\n').slice(0, 3)
          });
          
          logger.error('❌ Error procesando media', {
            requestId,
            error: mediaError.message,
            messageSid: MessageSid
          });
        }
      } else {
        console.log('ℹ️ NO ES MENSAJE DE MEDIA O NO TIENE MEDIA:', {
          requestId,
          messageType,
          numMedia: parseInt(NumMedia || '0')
        });
      }

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

      // 🤖 INTEGRACIÓN DE IA CON WEBHOOK (FASE G)
      // Ejecutar en background para no afectar la respuesta del webhook
      setImmediate(async () => {
        try {
          const aiResult = await integrateAIWithIncomingMessage(
            result.message.workspaceId,
            result.message.conversationId,
            result.message.id,
            result.message
          );

          if (aiResult.success && aiResult.suggestion) {
            logger.info('✅ Sugerencia de IA generada y guardada', {
              requestId,
              messageId: result.message.id,
              conversationId: result.message.conversationId,
              suggestionId: aiResult.suggestion.id,
              latencyMs: aiResult.latencyMs
            });

            // Emitir evento de socket para la sugerencia
            const socketManager = require('../socket').getSocketManager();
            if (socketManager) {
              socketManager.broadcastToConversation({
                workspaceId: 'default_workspace',
                tenantId: 'default_tenant',
                conversationId: result.message.conversationId,
                event: 'suggestion:new',
                payload: {
                  conversationId: result.message.conversationId,
                  suggestionId: aiResult.suggestion.id,
                  messageIdOrigen: result.message.id,
                  preview: aiResult.suggestion.texto?.substring(0, 200) || '',
                  createdAt: aiResult.suggestion.createdAt
                }
              });
            }
          } else {
            logger.info('ℹ️ IA no generó sugerencia', {
              requestId,
              messageId: result.message.id,
              conversationId: result.message.conversationId,
              reason: aiResult.reason || 'unknown'
            });
          }
        } catch (aiError) {
          logger.error('❌ Error en integración de IA (no crítico)', {
            requestId,
            messageId: result.message.id,
            conversationId: result.message.conversationId,
            error: aiError.message
          });
        }
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
   * Procesar media de webhook centralizado - VERSIÓN SIMPLIFICADA
   */
  static async processWebhookMedia (webhookData) {
    const mediaUrls = [];
    const processedMedia = [];
    const types = new Set();

    const numMedia = parseInt(webhookData.NumMedia || '0');

    // 🔍 LOG DETALLADO DEL PROCESAMIENTO DE MEDIA
    console.log('🔍 PROCESAMIENTO DE MEDIA - DATOS COMPLETOS:', {
      messageSid: webhookData.MessageSid,
      numMedia,
      referralNumMedia: webhookData.referralNumMedia,
      allWebhookKeys: Object.keys(webhookData),
      mediaKeys: Object.keys(webhookData).filter(key => key.startsWith('Media')),
      webhookDataComplete: JSON.stringify(webhookData, null, 2)
    });

    console.log('🔍 Procesando media del webhook:', {
      numMedia,
      webhookKeys: Object.keys(webhookData).filter(key => key.startsWith('Media'))
    });

    // Procesar cada archivo de media
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = webhookData[`MediaUrl${i}`];
      const mediaContentType = webhookData[`MediaContentType${i}`];

      console.log(`🔍 Media ${i}:`, { mediaUrl, mediaContentType });

      if (mediaUrl) {
        // Determinar categoría basada en content-type
        let category = 'document';
        if (mediaContentType && mediaContentType.startsWith('image/')) category = 'image';
        else if (mediaContentType && mediaContentType.startsWith('video/')) category = 'video';
        else if (mediaContentType && mediaContentType.startsWith('audio/')) category = 'audio';

        mediaUrls.push(mediaUrl); // URL original
        processedMedia.push({
          fileId: `webhook-${webhookData.MessageSid}-${i}`,
          category: category,
          url: mediaUrl,
          mimetype: mediaContentType || 'application/octet-stream',
          processed: true
        });
        types.add(category);

        console.log(`✅ Media ${i} procesado:`, { category, url: mediaUrl });
      } else {
        console.log(`❌ Media ${i} sin URL`);
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

    const result = {
      urls: mediaUrls,
      processed: processedMedia,
      primaryType,
      count: mediaUrls.length,
    };

    console.log('📊 Resultado del procesamiento de media:', result);
    
    // 🔍 LOG FINAL DEL PROCESAMIENTO
    console.log('🔍 PROCESAMIENTO DE MEDIA COMPLETADO:', {
      messageSid: webhookData.MessageSid,
      numMedia,
      urlsFound: mediaUrls.length,
      urls: mediaUrls,
      primaryType,
      processedMediaCount: processedMedia.length,
      result: JSON.stringify(result, null, 2)
    });

    return result;
  }

  /**
   * 🔧 SOLUCIÓN 1: Procesar media individual de webhook CON BYPASS COMPLETO
   */
  static async processIndividualWebhookMedia (mediaUrl, messageSid, index, conversationId, userId) {
    try {
      logger.info('🔧 SOLUCIÓN 1: Procesando media con bypass completo', {
        mediaUrl,
        messageSid,
        index
      });

      // Obtener credenciales de Twilio
      const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (!accountSid || !authToken) {
        throw new Error('Credenciales de Twilio no configuradas');
      }

      // Crear credenciales HTTP Basic
      const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

      // Descargar el archivo desde la URL de Twilio con autenticación
      const response = await fetch(mediaUrl, {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'User-Agent': 'Utalk-Backend/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error descargando media: ${response.status} - ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type');
      
      // Determinar categoría basada en content-type
      let category = 'document';
      if (contentType.startsWith('image/')) category = 'image';
      else if (contentType.startsWith('video/')) category = 'video';
      else if (contentType.startsWith('audio/')) category = 'audio';

      // 🔧 BYPASS COMPLETO: NO USAR FILESERVICE
      logger.info('🔧 BYPASS COMPLETO: Evitando FileService problemático', {
        mediaUrl,
        messageSid,
        index,
        category,
        size: buffer.byteLength,
        contentType
      });

      // Crear un ID único para el archivo
      const fileId = `bypass-${messageSid}-${index}-${Date.now()}`;
      
      // Retornar información básica sin procesamiento complejo
      const result = {
        fileId: fileId,
        category: category,
        url: mediaUrl, // Usar la URL original de Twilio
        size: buffer.byteLength,
        mimetype: contentType,
        processed: true,
        bypassMode: true, // Indicar que se usó bypass
        originalUrl: mediaUrl // Mantener URL original
      };

      logger.info('✅ BYPASS COMPLETO: Media procesado exitosamente', {
        fileId,
        category,
        size: buffer.byteLength,
        bypassMode: true
      });

      return result;

    } catch (error) {
      logger.error('❌ BYPASS COMPLETO: Error procesando media individual:', error);
      throw error;
    }
  }

  /**
   * 🔧 SOLUCIÓN 2: Sistema de fallback con múltiples intentos
   */
  static async processIndividualWebhookMediaWithFallback(mediaUrl, messageSid, index) {
    const attempts = [
      { name: 'FileService Completo', method: this.processWithFileService },
      { name: 'FileService Simplificado', method: this.processWithFileServiceSimple },
      { name: 'Bypass Directo', method: this.processWithBypass }
    ];

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      try {
        logger.info(`🔧 SOLUCIÓN 2: Intento ${i + 1}/${attempts.length} - ${attempt.name}`, {
          mediaUrl,
          messageSid,
          index
        });

        const result = await attempt.method.call(this, mediaUrl, messageSid, index);
        
        logger.info(`✅ SOLUCIÓN 2: ${attempt.name} exitoso`, {
          mediaUrl,
          messageSid,
          index,
          fileId: result.fileId
        });

        return {
          ...result,
          fallbackUsed: attempt.name
        };

      } catch (error) {
        logger.warn(`⚠️ SOLUCIÓN 2: ${attempt.name} falló`, {
          mediaUrl,
          messageSid,
          index,
          error: error.message,
          attempt: i + 1,
          totalAttempts: attempts.length
        });

        // Si es el último intento, lanzar el error
        if (i === attempts.length - 1) {
          throw error;
        }
        
        // Continuar con el siguiente intento
        continue;
      }
    }
  }

  /**
   * Método 1: FileService Completo (original)
   */
  static async processWithFileService(mediaUrl, messageSid, index) {
    // Descargar media
    const { buffer, contentType } = await this.downloadMedia(mediaUrl);
    
    // Determinar categoría
    let category = 'document';
    if (contentType.startsWith('image/')) category = 'image';
    else if (contentType.startsWith('video/')) category = 'video';
    else if (contentType.startsWith('audio/')) category = 'audio';

    // Usar FileService completo
    const fileData = {
      buffer: Buffer.from(buffer),
      originalName: `webhook-media-${messageSid}-${index}`,
      mimetype: contentType,
      size: buffer.byteLength,
      conversationId: 'temp-webhook',
      userId: null,
      uploadedBy: 'webhook',
      tags: ['webhook', 'twilio']
    };

    const fileService = new FileService();
    const processedFile = await fileService.uploadFile(fileData);

    return {
      fileId: processedFile.id || `file-${Date.now()}`,
      category,
      url: processedFile.url || processedFile.publicUrl,
      size: processedFile.size || buffer.byteLength,
      mimetype: contentType
    };
  }

  /**
   * Método 2: FileService Simplificado (sin índices)
   */
  static async processWithFileServiceSimple(mediaUrl, messageSid, index) {
    // Descargar media
    const { buffer, contentType } = await this.downloadMedia(mediaUrl);
    
    // Determinar categoría
    let category = 'document';
    if (contentType.startsWith('image/')) category = 'image';
    else if (contentType.startsWith('video/')) category = 'video';
    else if (contentType.startsWith('audio/')) category = 'audio';

    // Procesar directamente sin FileService
    const fileId = `simple-${messageSid}-${index}-${Date.now()}`;
    
    return {
      fileId,
      category,
      url: mediaUrl, // Usar URL original
      size: buffer.byteLength,
      mimetype: contentType,
      simpleMode: true
    };
  }

  /**
   * Método 3: Bypass Directo
   */
  static async processWithBypass(mediaUrl, messageSid, index) {
    // Descargar media
    const { buffer, contentType } = await this.downloadMedia(mediaUrl);
    
    // Determinar categoría
    let category = 'document';
    if (contentType.startsWith('image/')) category = 'image';
    else if (contentType.startsWith('video/')) category = 'video';
    else if (contentType.startsWith('audio/')) category = 'audio';

    // Bypass completo
    const fileId = `bypass-${messageSid}-${index}-${Date.now()}`;
    
    return {
      fileId,
      category,
      url: mediaUrl,
      size: buffer.byteLength,
      mimetype: contentType,
      bypassMode: true
    };
  }

  /**
   * Descargar media de Twilio
   */
  static async downloadMedia(mediaUrl) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      throw new Error('Credenciales de Twilio no configuradas');
    }

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'User-Agent': 'Utalk-Backend/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error descargando media: ${response.status} - ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type');

    return { buffer, contentType };
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

      // emitRealTimeEvent ahora está en MessageService
      const messageService = getMessageService();
      await messageService.emitRealTimeEvent(conversation.id, message);

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

  /**
   * 🆕 ENVIAR MENSAJE DE UBICACIÓN
   */
  static async sendLocationMessage(toPhone, latitude, longitude, name = '', address = '', options = {}) {
    try {
      const messageService = getMessageService();
      
      logger.info('📍 Enviando mensaje de ubicación', {
        toPhone,
        latitude,
        longitude,
        name: name || 'Sin nombre',
        address: address || 'Sin dirección'
      });

      const result = await messageService.sendWhatsAppLocation(toPhone, latitude, longitude, name, address);
      
      if (result.success) {
        logger.info('✅ Mensaje de ubicación enviado exitosamente', {
          twilioSid: result.twilioResponse.sid,
          toPhone,
          location: result.messageData.location
        });
      } else {
        logger.error('❌ Error enviando mensaje de ubicación', {
          error: result.error,
          toPhone
        });
      }

      return result;

    } catch (error) {
      logger.error('❌ Error en sendLocationMessage', {
        error: error.message,
        toPhone,
        latitude,
        longitude,
        stack: error.stack
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🆕 ENVIAR MENSAJE DE STICKER
   */
  static async sendStickerMessage(toPhone, stickerUrl, options = {}) {
    try {
      const messageService = getMessageService();
      
      logger.info('😀 Enviando mensaje de sticker', {
        toPhone,
        stickerUrl
      });

      const result = await messageService.sendWhatsAppSticker(toPhone, stickerUrl);
      
      if (result.success) {
        logger.info('✅ Mensaje de sticker enviado exitosamente', {
          twilioSid: result.twilioResponse.sid,
          toPhone,
          stickerUrl
        });
      } else {
        logger.error('❌ Error enviando mensaje de sticker', {
          error: result.error,
          toPhone,
          stickerUrl
        });
      }

      return result;

    } catch (error) {
      logger.error('❌ Error en sendStickerMessage', {
        error: error.message,
        toPhone,
        stickerUrl,
        stack: error.stack
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===== MÉTODOS MIGRADOS DE TWILIOSERVICE =====

  /**
   * FUNCIÓN PRINCIPAL: Procesar mensaje entrante desde webhook Twilio
   * Versión mejorada con manejo de fotos de perfil y metadatos avanzados
   */
  async processIncomingMessage(webhookData) {
    const requestId = `twilio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info('🔄 MESSAGESERVICE - INICIANDO PROCESAMIENTO', {
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

      logger.info('📋 MESSAGESERVICE - DATOS EXTRAÍDOS', {
        requestId,
        twilioSid,
        rawFromPhone,
        rawToPhone,
        contentLength: content?.length,
        hasMedia: !!mediaUrl,
        mediaType,
        numMedia: parseInt(numMedia) || 0,
        profileName,
        waId,
        step: 'data_extraction'
      });

      // PASO 2: Normalizar números de teléfono
      const normalizedFromPhone = rawFromPhone?.replace('whatsapp:', '') || '';
      const normalizedToPhone = rawToPhone?.replace('whatsapp:', '') || '';

      if (!normalizedFromPhone || !normalizedToPhone) {
        throw new Error('Números de teléfono inválidos en webhook');
      }

      // PASO 3: Procesar información de contacto
      const contactInfo = await this.processContactInfo(normalizedFromPhone, profileName, waId);

              // PASO 4: Determinar tipo de mensaje y procesar medios
        let messageType = 'text';
        let mediaData = null;

        if (parseInt(numMedia) > 0) {
          console.log('🔍 MESSAGESERVICE - INICIANDO PROCESAMIENTO DE MEDIOS:', {
            requestId,
            numMedia: parseInt(numMedia),
            hasMediaUrl: !!mediaUrl,
            mediaType,
            webhookKeys: Object.keys(webhookData).filter(key => key.startsWith('Media'))
          });

          logger.info('📎 MESSAGESERVICE - PROCESANDO MEDIOS', {
            requestId,
            numMedia: parseInt(numMedia),
            hasMediaUrl: !!mediaUrl,
            mediaType,
            step: 'media_processing_start'
          });

          try {
            // Procesar todos los medios del webhook
            const mediaInfo = await MessageService.processWebhookMedia(webhookData);
            
            console.log('🔍 MESSAGESERVICE - RESULTADO DE processWebhookMedia:', {
              requestId,
              mediaInfo: mediaInfo,
              urlsCount: mediaInfo.urls.length,
              primaryType: mediaInfo.primaryType
            });
            
            messageType = mediaInfo.primaryType;
            mediaData = {
              urls: mediaInfo.urls,
              processed: mediaInfo.processed,
              count: mediaInfo.count,
              primaryType: mediaInfo.primaryType
            };

          logger.info('✅ MESSAGESERVICE - MEDIOS PROCESADOS', {
            requestId,
            mediaCount: mediaInfo.count,
            primaryType: mediaInfo.primaryType,
            hasUrls: mediaInfo.urls.length > 0,
            step: 'media_processing_complete'
          });

        } catch (mediaError) {
          logger.error('❌ MESSAGESERVICE - ERROR PROCESANDO MEDIOS', {
            requestId,
            error: mediaError.message,
            step: 'media_processing_error'
          });

          // Fallback: usar solo la URL directa si hay error
          if (mediaUrl) {
            messageType = this.determineMediaType(mediaType);
            mediaData = {
              url: mediaUrl,
              type: mediaType,
              size: null,
              error: mediaError.message
            };
          }
        }
      }

      // PASO 5: Generar ID de conversación
      const conversationId = generateConversationId(normalizedFromPhone, normalizedToPhone);

      // PASO 6: Crear datos del mensaje
      const messageData = {
        id: twilioSid,
        conversationId,
        senderIdentifier: normalizedFromPhone,
        recipientIdentifier: normalizedToPhone,
        content: content || '',
        type: messageType,
        direction: 'inbound',
        status: 'received',
        sender: 'customer',
        timestamp: new Date().toISOString(),
        mediaUrl: mediaData?.urls?.[0] || mediaData?.url || null,
        metadata: {
          twilio: {
            sid: twilioSid,
            accountSid,
            apiVersion,
            price,
            priceUnit,
            numSegments,
            smsStatus,
            smsSid,
            smsMessageSid,
            referralNumMedia,
            referralNumSegments,
            referralIntegrationError,
            referralTo: referralTo,
            referralFrom: referralFrom,
            referralMediaUrl,
            referralMediaContentType,
            referralMediaSize,
            referralMediaSid,
          },
          contact: contactInfo,
          media: mediaData,
                    webhookReceivedAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 🔍 LOGGING CRÍTICO DE MESSAGE DATA
      console.log('🔍 MESSAGESERVICE - MESSAGE DATA CREADO:', {
        requestId,
        messageId: messageData.id,
        conversationId: messageData.conversationId,
        type: messageData.type,
        mediaUrl: messageData.mediaUrl,
        hasMedia: !!messageData.mediaUrl,
        mediaData: mediaData,
        step: 'message_data_created'
      });

        // 🔍 LOGGING DETALLADO DE MEDIA
        console.log('🔍 MESSAGESERVICE - DIAGNÓSTICO DE MEDIA:', {
          requestId,
          mediaData: mediaData,
          mediaDataUrls: mediaData?.urls,
          mediaDataUrl: mediaData?.url,
          mediaUrlAssigned: messageData.mediaUrl,
          messageType: messageType,
          numMedia: parseInt(numMedia) || 0,
          step: 'media_diagnosis'
        });

        logger.info('📝 MESSAGESERVICE - DATOS DEL MENSAJE PREPARADOS', {
          requestId,
          messageId: messageData.id,
          conversationId: messageData.conversationId,
          sender: messageData.senderIdentifier,
          recipient: messageData.recipientIdentifier,
          type: messageData.type,
          hasMedia: !!messageData.mediaUrl,
          hasContactInfo: !!(messageData.metadata.contact),
          step: 'message_data_prepared'
        });

      // PASO 7: Buscar o crear conversación
      const conversation = await this.findOrCreateConversation(
        conversationId,
        normalizedFromPhone,
        normalizedToPhone,
        contactInfo
      );

      // PASO 8: Guardar mensaje en Firestore
      const savedMessage = await this.saveMessageToFirestore(conversationId, messageData);

      // PASO 9: Actualizar conversación con último mensaje
      await this.updateConversationLastMessage(conversationId, savedMessage);

      // PASO 10: Emitir evento en tiempo real
      await this.emitRealTimeEvent(conversationId, savedMessage);

      logger.info('✅ MESSAGESERVICE - PROCESAMIENTO COMPLETADO', {
        requestId,
        messageId: savedMessage.id,
        conversationId: savedMessage.conversationId,
        type: savedMessage.type,
        direction: savedMessage.direction,
        hasMedia: !!savedMessage.mediaUrl,
        step: 'process_complete'
      });

      return {
        message: savedMessage,
        conversation,
        contactInfo,
        success: true
      };

    } catch (error) {
      logger.error('❌ MESSAGESERVICE - ERROR CRÍTICO', {
        requestId,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 5),
        webhookData: {
          MessageSid: webhookData.MessageSid,
          From: webhookData.From,
          To: webhookData.To,
          hasBody: !!webhookData.Body,
          hasMedia: !!webhookData.MediaUrl0
        },
        step: 'process_error'
      });

      // Log del error en Firestore
      await this.logWebhookError({
        requestId,
        error: error.message,
        stack: error.stack,
        webhookData,
        processedAt: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * Procesar información de contacto desde webhook
   */
  async processContactInfo(phoneNumber, profileName, waId) {
    try {
      const contactInfo = {
        phoneNumber,
        profileName: profileName || null,
        waId: waId || null,
        profilePhotoUrl: null,
        profilePhotoDownloaded: false,
        lastUpdated: new Date().toISOString()
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
        lastUpdated: new Date().toISOString()
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
        await contactsRef.add({
          phone: phoneNumber,
          name: contactInfo.profileName || 'Usuario WhatsApp',
          waId: contactInfo.waId,
          profilePhotoUrl: contactInfo.profilePhotoUrl,
          createdAt: Timestamp.now(),
          updatedAt: FieldValue.serverTimestamp(),
          lastUpdated: Timestamp.now(),
          source: 'whatsapp_webhook'
        });

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
   * Buscar o crear conversación
   */
  async findOrCreateConversation(conversationId, customerPhone, agentPhone, contactInfo) {
    try {
      // Buscar conversación existente
      const conversationRef = firestore.collection('conversations').doc(conversationId);
      const conversationDoc = await conversationRef.get();

      if (conversationDoc.exists) {
        logger.info('📋 Conversación existente encontrada', { conversationId });
        
        // Actualizar contadores
        await conversationRef.update({
          messageCount: FieldValue.increment(1),
          unreadCount: FieldValue.increment(1),
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

        contact = await ContactService.createOrUpdateFromMessage({
          from: customerPhone,
          to: agentPhone,
          direction: 'inbound',
          timestamp: new Date().toISOString()
        }, {
          lastMessageAt: new Date(),
          lastMessageContent: 'Nuevo mensaje recibido',
          lastMessageDirection: 'inbound',
          profileName: contactInfo.profileName,
          waId: contactInfo.waId,
          profilePhotoUrl: contactInfo.profilePhotoUrl
        });

        logger.info('✅ Contacto del cliente procesado exitosamente', {
          contactId: contact?.id,
          customerPhone,
          profileName: contactInfo.profileName,
          waId: contactInfo.waId
        });

      } catch (contactError) {
        logger.error('❌ Error procesando contacto del cliente', {
          customerPhone,
          error: contactError.message,
          stack: contactError.stack
        });
        contact = null;
      }

      // Crear nueva conversación
      const newConversationData = {
        id: conversationId,
        customerPhone,
        agentPhone,
        assignedTo,
        contact,
        status: 'active',
        messageCount: 1,
        unreadCount: 1,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastMessageAt: Timestamp.now(),
        metadata: {
          createdFrom: 'whatsapp_webhook',
          contactInfo,
          twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
        }
      };

      await conversationRef.set(newConversationData);

      logger.info('✅ Nueva conversación creada exitosamente', {
        conversationId,
        customerPhone,
        agentPhone,
        assignedToId: assignedTo?.id,
        contactId: contact?.id,
        hasContactInfo: !!(contactInfo.profileName || contactInfo.waId)
      });

      return {
        id: conversationId,
        exists: false,
        ...newConversationData,
      };

    } catch (error) {
      logger.error('❌ Error en findOrCreateConversation', {
        conversationId,
        customerPhone,
        agentPhone,
        error: error.message,
        stack: error.stack
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

      // Obtener Socket.IO manager
      const { getSocketManager } = require('../socket');
      const rt = getSocketManager();

      if (!rt) {
        logger.warn('⚠️ EMITREALTIMEEVENT - SOCKET MANAGER NO DISPONIBLE', {
          requestId,
          conversationId,
          messageId: savedMessage.id,
          hasSocketManager: false,
          step: 'socket_not_available'
        });
        return;
      }

      if (typeof rt.emitNewMessage !== 'function') {
        logger.warn('⚠️ EMITREALTIMEEVENT - EMITNEWMESSAGE NO DISPONIBLE', {
          requestId,
          conversationId,
          messageId: savedMessage.id,
          hasSocketManager: !!rt,
          hasEmitNewMessage: !!(rt && typeof rt.emitNewMessage === 'function'),
          step: 'socket_not_available'
        });
        return;
      }

      // Emitir evento de nuevo mensaje
      await rt.emitNewMessage({
        workspaceId: 'default_workspace',
        tenantId: 'default_tenant',
        conversationId,
        message: savedMessage,
        correlationId: requestId
      });

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
   * Determinar tipo de media basado en content type
   */
  determineMediaType(mediaType) {
    if (!mediaType) return 'text';
    
    const type = mediaType.toLowerCase();
    if (type.includes('image')) return 'image';
    if (type.includes('video')) return 'video';
    if (type.includes('audio')) return 'audio';
    if (type.includes('application') || type.includes('document')) return 'document';
    if (type.includes('sticker')) return 'sticker';
    
    return 'text';
  }

  /**
   * ENVIAR MENSAJE WHATSAPP VIA TWILIO
   */
  async sendWhatsAppMessage({ from, to, body, mediaUrl }) {
    try {
      const payload = {
        from: this.ensureFrom(from),
        to: this.ensureWhatsApp(to),
      };

      if (body) payload.body = body;
      if (mediaUrl) payload.mediaUrl = Array.isArray(mediaUrl) ? mediaUrl : [mediaUrl];

      // Log de request (sin body completo)
      logger?.info?.('TWILIO:REQUEST', { from: payload.from, to: payload.to, bodyLen: body?.length, hasMedia: !!mediaUrl });

      const resp = await this.client.messages.create(payload);

      logger?.info?.('TWILIO:RESPONSE_OK', { sid: resp?.sid, status: resp?.status });
      return resp;
    } catch (error) {
      logger?.error?.('TWILIO:RESPONSE_ERR', { error: error.message, from, to });
      throw error;
    }
  }

  /**
   * 📎 ENVIAR ARCHIVO A WHATSAPP VIA TWILIO
   * FASE 6: Integración específica para archivos
   */
  async sendFileToWhatsApp(phoneNumber, fileUrl, caption = '') {
    try {
      logger.info('📎 Enviando archivo a WhatsApp', {
        phoneNumber,
        fileUrl,
        captionLength: caption?.length || 0
      });

      const message = await this.client.messages.create({
        body: caption || 'Archivo compartido',
        mediaUrl: [fileUrl],
        from: `whatsapp:${this.whatsappNumber}`,
        to: `whatsapp:${phoneNumber}`
      });

      logger.info('✅ Archivo enviado exitosamente a WhatsApp', {
        messageSid: message.sid,
        status: message.status,
        phoneNumber
      });

      return {
        success: true,
        messageSid: message.sid,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('❌ Error enviando archivo a WhatsApp', {
        phoneNumber,
        fileUrl,
        error: error.message,
        code: error.code
      });

      return {
        success: false,
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 📱 MANEJAR ARCHIVO RECIBIDO DE WHATSAPP
   * FASE 6: Procesamiento completo de archivos entrantes
   */
  async handleWhatsAppFileReceived(req, res) {
    const requestId = `whatsapp_file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const { MediaUrl0, From, Body, MessageSid, NumMedia } = req.body;

      logger.info('📱 Procesando archivo recibido de WhatsApp', {
        requestId,
        from: From,
        messageSid: MessageSid,
        hasMedia: !!MediaUrl0,
        numMedia: NumMedia,
        bodyLength: Body?.length || 0
      });

      // 1. Validar datos requeridos
      if (!MediaUrl0) {
        logger.warn('⚠️ No se encontró MediaUrl0 en webhook', { requestId });
        return res.status(400).json({ error: 'MediaUrl0 es requerido' });
      }

      if (!From) {
        logger.warn('⚠️ No se encontró From en webhook', { requestId });
        return res.status(400).json({ error: 'From es requerido' });
      }

      // 2. Descargar archivo de WhatsApp
      logger.info('📥 Descargando archivo de WhatsApp', { requestId, mediaUrl: MediaUrl0 });
      
      const fileBuffer = await this.downloadFileFromUrl(MediaUrl0);
      
      if (!fileBuffer) {
        logger.error('❌ Error descargando archivo de WhatsApp', { requestId, mediaUrl: MediaUrl0 });
        return res.status(500).json({ error: 'Error descargando archivo' });
      }

      // 3. Encontrar conversación por número de teléfono
      logger.info('🔍 Buscando conversación por número de teléfono', { requestId, from: From });
      
      const conversation = await this.findConversationByPhone(From);
      
      if (!conversation) {
        logger.warn('⚠️ No se encontró conversación para el número', { requestId, from: From });
        return res.status(404).json({ error: 'Conversación no encontrada' });
      }

      // 4. Procesar y guardar archivo
      logger.info('💾 Procesando y guardando archivo', { requestId, conversationId: conversation.id });
      
      const processedFile = await this.processSingleAttachment({
        buffer: fileBuffer,
        mimetype: 'application/octet-stream', // WhatsApp no envía mimetype específico
        originalName: `archivo_whatsapp_${Date.now()}`,
        size: fileBuffer.length,
        conversationId: conversation.id,
        uploadedBy: From
      });

      if (!processedFile) {
        logger.error('❌ Error procesando archivo', { requestId });
        return res.status(500).json({ error: 'Error procesando archivo' });
      }

      // 5. Crear mensaje con archivo
      logger.info('💬 Creando mensaje con archivo', { requestId, fileId: processedFile.id });
      
      const messageData = {
        conversationId: conversation.id,
        messageId: MessageSid,
        content: Body || 'Archivo compartido',
        type: 'media',
        direction: 'inbound',
        senderIdentifier: From,
        recipientIdentifier: this.whatsappNumber,
        timestamp: new Date(),
        status: 'received',
        mediaUrl: processedFile.url,
        metadata: {
          twilioSid: MessageSid,
          fileId: processedFile.id,
          fileName: processedFile.name,
          fileSize: processedFile.size,
          fileType: processedFile.mimetype,
          source: 'whatsapp_webhook',
          requestId
        }
      };

      const savedMessage = await Message.create(messageData);

      // 6. Actualizar conversación
      await conversation.updateLastMessage(savedMessage);

      logger.info('✅ Archivo de WhatsApp procesado exitosamente', {
        requestId,
        messageId: savedMessage.id,
        fileId: processedFile.id,
        conversationId: conversation.id
      });

      // 7. Emitir eventos WebSocket
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.emitToConversation(conversation.id, 'new-message', {
          message: savedMessage,
          file: processedFile
        });

        socketManager.emitToConversation(conversation.id, 'file-received', {
          file: processedFile,
          message: savedMessage
        });
      }

      return res.status(200).json({
        success: true,
        messageId: savedMessage.id,
        fileId: processedFile.id,
        conversationId: conversation.id
      });

    } catch (error) {
      logger.error('❌ Error procesando archivo de WhatsApp', {
        requestId,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3)
      });

      return res.status(500).json({
        success: false,
        error: 'Error interno procesando archivo',
        requestId
      });
    }
  }

  /**
   * 📥 DESCARGAR ARCHIVO DESDE URL
   * Función auxiliar para descargar archivos de WhatsApp
   */
  async downloadFileFromUrl(url) {
    try {
      logger.info('📥 Descargando archivo desde URL', { url });

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      
      logger.info('✅ Archivo descargado exitosamente', {
        url,
        size: buffer.byteLength
      });

      return Buffer.from(buffer);

    } catch (error) {
      logger.error('❌ Error descargando archivo', {
        url,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🔍 ENCONTRAR CONVERSACIÓN POR NÚMERO DE TELÉFONO
   * Función auxiliar para buscar conversaciones
   */
  async findConversationByPhone(phoneNumber) {
    try {
      logger.info('🔍 Buscando conversación por número', { phoneNumber });

      // Normalizar número de teléfono
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

      // Buscar conversación existente
      const conversation = await Conversation.findByCustomerPhone(normalizedPhone);

      if (conversation) {
        logger.info('✅ Conversación encontrada', {
          phoneNumber,
          conversationId: conversation.id
        });
        return conversation;
      }

      // Si no existe, crear nueva conversación
      logger.info('🆕 Creando nueva conversación', { phoneNumber });

      const newConversation = await Conversation.create({
        customerPhone: normalizedPhone,
        status: 'active',
        participants: [normalizedPhone, this.whatsappNumber],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      logger.info('✅ Nueva conversación creada', {
        phoneNumber,
        conversationId: newConversation.id
      });

      return newConversation;

    } catch (error) {
      logger.error('❌ Error buscando/creando conversación', {
        phoneNumber,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 📎 PROCESAR ARCHIVO ADJUNTO ÚNICO
   * Función auxiliar para procesar archivos usando FileService
   */
  async processSingleAttachment(fileData) {
    try {
      logger.info('📎 Procesando archivo adjunto', {
        originalName: fileData.originalName,
        size: fileData.size,
        mimetype: fileData.mimetype
      });

      const fileService = new FileService();
      
      const processedFile = await fileService.uploadFile({
        buffer: fileData.buffer,
        originalName: fileData.originalName,
        mimetype: fileData.mimetype,
        size: fileData.size,
        conversationId: fileData.conversationId,
        userId: fileData.userId,
        uploadedBy: fileData.uploadedBy,
        tags: ['whatsapp', 'webhook', 'incoming']
      });

      logger.info('✅ Archivo procesado exitosamente', {
        fileId: processedFile.id,
        url: processedFile.url
      });

      return processedFile;

    } catch (error) {
      logger.error('❌ Error procesando archivo adjunto', {
        originalName: fileData.originalName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 📱 NORMALIZAR NÚMERO DE TELÉFONO
   * Función auxiliar para normalizar números de WhatsApp
   */
  normalizePhoneNumber(phoneNumber) {
    // Remover prefijo whatsapp: si existe
    let normalized = phoneNumber.replace(/^whatsapp:/, '');
    
    // Asegurar formato E.164
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }
    
    return normalized;
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
        timestamp: new Date().toISOString(),
        metadata: {
          twilioSid: sentMessage.sid,
          twilioStatus: sentMessage.status,
          twilioErrorCode: sentMessage.errorCode,
          twilioErrorMessage: sentMessage.errorMessage,
          sentAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
        timestamp: new Date().toISOString(),
        metadata: {
          twilioSid: sentMessage.sid,
          twilioStatus: sentMessage.status,
          twilioErrorCode: sentMessage.errorCode,
          twilioErrorMessage: sentMessage.errorMessage,
          sentAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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

  /**
   * VALIDAR FIRMA DE TWILIO PARA WEBHOOKS
   * Verifica que el webhook realmente venga de Twilio
   */
  static validateTwilioSignature(requestUrl, requestBody, signature, authToken) {
    try {
      // Importar crypto para validación de firma
      const crypto = require('crypto');
      
      // Obtener auth token de Twilio
      const twilioAuthToken = authToken || 
        process.env.TWILIO_AUTH_TOKEN || 
        process.env.TWILIO_TOKEN || 
        process.env.TWILIO_SECRET;

      if (!twilioAuthToken) {
        logger.warn('⚠️ No se puede validar firma de Twilio - AUTH_TOKEN no configurado');
        return false;
      }

      // Crear la cadena a firmar (URL + body ordenado alfabéticamente)
      const sortedParams = new URLSearchParams(requestBody);
      const sortedBody = sortedParams.toString();
      
      const dataToSign = requestUrl + sortedBody;

      // Calcular firma esperada
      const expectedSignature = crypto
        .createHmac('sha1', twilioAuthToken)
        .update(Buffer.from(dataToSign, 'utf-8'))
        .digest('base64');

      // Comparar firmas
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'base64'),
        Buffer.from(expectedSignature, 'base64')
      );

      logger.info('🔐 Validación de firma de Twilio', {
        isValid,
        requestUrl,
        bodyLength: sortedBody.length,
        signatureProvided: !!signature,
        signatureExpected: !!expectedSignature
      });

      return isValid;

    } catch (error) {
      logger.error('❌ Error validando firma de Twilio', {
        error: error.message,
        requestUrl,
        signatureProvided: !!signature
      });
      return false;
    }
  }

  /**
   * OBTENER URL DE MEDIA DE TWILIO
   * Descarga y procesa media desde URLs de Twilio
   */
  async getMediaUrl(mediaSid) {
    try {
      if (!mediaSid) {
        throw new Error('MediaSid es requerido');
      }

      logger.info('📎 Obteniendo URL de media de Twilio', {
        mediaSid
      });

      // Obtener información del media desde Twilio API
      const media = await this.client.messages(mediaSid).media().fetch();

      if (!media) {
        throw new Error('Media no encontrado en Twilio');
      }

      // Construir URL de descarga
      const mediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.client.username}/Messages/${mediaSid}/Media/${media.sid}`;

      logger.info('✅ URL de media obtenida exitosamente', {
        mediaSid,
        mediaUrl,
        contentType: media.contentType,
        size: media.size
      });

      return {
        success: true,
        url: mediaUrl,
        contentType: media.contentType,
        size: media.size,
        sid: media.sid
      };

    } catch (error) {
      logger.error('❌ Error obteniendo URL de media de Twilio', {
        mediaSid,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * DESCARGAR MEDIA DE TWILIO
   * Descarga el archivo de media desde Twilio
   */
  async downloadMedia(mediaSid, options = {}) {
    try {
      const { saveToFile = false, filePath = null } = options;

      // Obtener URL del media
      const mediaInfo = await this.getMediaUrl(mediaSid);
      
      if (!mediaInfo || !mediaInfo.success) {
        const errorMessage = mediaInfo && mediaInfo.error ? mediaInfo.error : 'Error desconocido obteniendo URL del media';
        throw new Error(`No se pudo obtener URL del media: ${errorMessage}`);
      }

      // Descargar el archivo
      const response = await fetch(mediaInfo.url, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.client.username}:${this.client.password}`).toString('base64')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Error descargando media: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();

      logger.info('✅ Media descargado exitosamente', {
        mediaSid,
        size: buffer.byteLength,
        contentType: mediaInfo.contentType
      });

      // Guardar a archivo si se solicita
      if (saveToFile && filePath) {
        const fs = require('fs').promises;
        await fs.writeFile(filePath, Buffer.from(buffer));
        
        logger.info('💾 Media guardado a archivo', {
          mediaSid,
          filePath
        });
      }

      return {
        success: true,
        buffer: Buffer.from(buffer),
        contentType: mediaInfo.contentType,
        size: buffer.byteLength,
        sid: mediaInfo.sid
      };

    } catch (error) {
      logger.error('❌ Error descargando media de Twilio', {
        mediaSid,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * ENVIAR MENSAJES EN LOTE
   */
  static async sendBulkMessages(contacts, message, campaignId, options = {}) {
    const requestId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info('📤 Iniciando envío de mensajes en lote', {
        requestId,
        campaignId,
        totalContacts: contacts.length,
        messagePreview: message.substring(0, 50)
      });

      const results = [];
      const batchSize = options.batchSize || 10;
      const delayBetweenBatches = options.delayBetweenBatches || 1000;

      // Procesar en lotes para evitar rate limiting
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        
        logger.info(`📦 Procesando lote ${Math.floor(i / batchSize) + 1}`, {
          requestId,
          batchStart: i,
          batchEnd: Math.min(i + batchSize, contacts.length),
          batchSize: batch.length
        });

        // Procesar lote en paralelo
        const batchPromises = batch.map(async (contact) => {
          try {
            const messageService = getMessageService();
            const result = await messageService.sendWhatsAppMessage({
              from: process.env.TWILIO_WHATSAPP_NUMBER,
              to: contact.phone,
              body: message
            });

            return {
              contactId: contact.id,
              phone: contact.phone,
              success: true,
              twilioSid: result.sid,
              status: result.status
            };

          } catch (error) {
            logger.error('❌ Error enviando mensaje individual', {
              contactId: contact.id,
              phone: contact.phone,
              error: error.message
            });

            return {
              contactId: contact.id,
              phone: contact.phone,
              success: false,
              error: error.message
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Esperar entre lotes para evitar rate limiting
        if (i + batchSize < contacts.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      logger.info('✅ Envío de mensajes en lote completado', {
        requestId,
        campaignId,
        totalSent: results.length,
        successCount,
        failureCount
      });

      return {
        success: true,
        results,
        summary: {
          total: results.length,
          success: successCount,
          failed: failureCount
        }
      };

    } catch (error) {
      logger.error('❌ Error en envío de mensajes en lote', {
        requestId,
        campaignId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  /**
   * 🔧 SOLUCIÓN 3: Sistema de procesamiento asíncrono con cola
   */
  static async processIndividualWebhookMediaAsync(mediaUrl, messageSid, index) {
    try {
      logger.info('🔧 SOLUCIÓN 3: Iniciando procesamiento asíncrono', {
        mediaUrl,
        messageSid,
        index
      });

      // Crear un ID único para el procesamiento
      const processId = `async-${messageSid}-${index}-${Date.now()}`;
      
      // Retornar inmediatamente con información básica
      const immediateResult = {
        fileId: processId,
        category: 'pending',
        url: mediaUrl,
        size: 0,
        mimetype: 'unknown',
        asyncMode: true,
        status: 'queued',
        processId: processId
      };

      // Procesar en segundo plano (no esperar)
      this.processMediaInBackground(mediaUrl, messageSid, index, processId).catch(error => {
        logger.error('🔧 SOLUCIÓN 3: Error en procesamiento en segundo plano', {
          processId,
          error: error.message
        });
      });

      return immediateResult;

    } catch (error) {
      logger.error('🔧 SOLUCIÓN 3: Error iniciando procesamiento asíncrono', {
        mediaUrl,
        messageSid,
        index,
        error: error.message
      });
      
      // Fallback a bypass directo
      return this.processWithBypass(mediaUrl, messageSid, index);
    }
  }

  /**
   * Procesar media en segundo plano
   */
  static async processMediaInBackground(mediaUrl, messageSid, index, processId) {
    try {
      logger.info('🔧 SOLUCIÓN 3: Procesando en segundo plano', {
        processId,
        mediaUrl,
        messageSid,
        index
      });

      // Descargar media
      const { buffer, contentType } = await this.downloadMedia(mediaUrl);
      
      // Determinar categoría
      let category = 'document';
      if (contentType.startsWith('image/')) category = 'image';
      else if (contentType.startsWith('video/')) category = 'video';
      else if (contentType.startsWith('audio/')) category = 'audio';

      // Intentar procesar con FileService
      let processedFile = null;
      try {
        const fileData = {
          buffer: Buffer.from(buffer),
          originalName: `webhook-media-${messageSid}-${index}`,
          mimetype: contentType,
          size: buffer.byteLength,
          conversationId: 'temp-webhook',
          userId: null,
          uploadedBy: 'webhook',
          tags: ['webhook', 'twilio', 'async']
        };

        const fileService = new FileService();
        processedFile = await fileService.uploadFile(fileData);
        
        logger.info('🔧 SOLUCIÓN 3: FileService exitoso en segundo plano', {
          processId,
          fileId: processedFile.id
        });

      } catch (fileServiceError) {
        logger.warn('🔧 SOLUCIÓN 3: FileService falló en segundo plano, usando bypass', {
          processId,
          error: fileServiceError.message
        });
        
        // Usar bypass como fallback
        processedFile = {
          id: `bypass-${processId}`,
          url: mediaUrl,
          size: buffer.byteLength
        };
      }

      // Actualizar el estado del procesamiento (aquí podrías guardar en base de datos)
      logger.info('🔧 SOLUCIÓN 3: Procesamiento en segundo plano completado', {
        processId,
        fileId: processedFile.id,
        category,
        size: buffer.byteLength
      });

    } catch (error) {
      logger.error('🔧 SOLUCIÓN 3: Error en procesamiento en segundo plano', {
        processId,
        error: error.message
      });
    }
  }
}

// Crear instancia singleton
const instance = new MessageService();
function getMessageService(){ return instance; }

module.exports = MessageService;
module.exports.getMessageService = getMessageService;
