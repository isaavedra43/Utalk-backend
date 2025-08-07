const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const logger = require('../utils/logger');
const { prepareForFirestore } = require('../utils/firestore');
// const { isValidConversationId } = require('../utils/conversation'); // DEPRECATED
const { createCursor, parseCursor } = require('../utils/pagination');
const { safeDateToISOString } = require('../utils/dateHelpers');

class Message {
  constructor (data) {
    const requestId = `msg_constructor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info('🔄 MESSAGE.CONSTRUCTOR - INICIANDO CONSTRUCCIÓN', {
        requestId,
        timestamp: new Date().toISOString(),
        dataKeys: Object.keys(data),
        dataValues: {
          id: data.id,
          messageId: data.messageId,
          conversationId: data.conversationId,
          senderIdentifier: data.senderIdentifier,
          recipientIdentifier: data.recipientIdentifier,
          content: data.content,
          mediaUrl: data.mediaUrl,
          direction: data.direction,
          type: data.type,
          status: data.status,
          hasMetadata: !!data.metadata,
          metadataKeys: data.metadata ? Object.keys(data.metadata) : []
        },
        step: 'constructor_start'
      });

      // ID y ConversationID (UUIDs) - ACEPTAR AMBOS FORMATOS
      logger.info('🔍 MESSAGE.CONSTRUCTOR - VALIDANDO ID', {
        requestId,
        hasId: !!data.id,
        hasMessageId: !!data.messageId,
        id: data.id,
        messageId: data.messageId,
        step: 'id_validation_start'
      });

      const messageId = data.id || data.messageId;
      if (!messageId) {
        logger.error('❌ MESSAGE.CONSTRUCTOR - ID FALTANTE', {
          requestId,
          data: {
            hasId: !!data.id,
            hasMessageId: !!data.messageId,
            id: data.id,
            messageId: data.messageId
          },
          step: 'validation_failed_id'
        });
        throw new Error('Message ID es requerido');
      }

      logger.info('✅ MESSAGE.CONSTRUCTOR - ID VÁLIDO', {
        requestId,
        messageId,
        step: 'id_validation_passed'
      });

      logger.info('🔍 MESSAGE.CONSTRUCTOR - VALIDANDO CONVERSATIONID', {
        requestId,
        hasConversationId: !!data.conversationId,
        conversationId: data.conversationId,
        step: 'conversation_id_validation_start'
      });

      if (!data.conversationId) {
        logger.error('❌ MESSAGE.CONSTRUCTOR - CONVERSATIONID FALTANTE', {
          requestId,
          conversationId: data.conversationId,
          step: 'validation_failed_conversation_id'
        });
        throw new Error('conversationId (UUID) es requerido');
      }

      logger.info('✅ MESSAGE.CONSTRUCTOR - CONVERSATIONID VÁLIDO', {
        requestId,
        conversationId: data.conversationId,
        step: 'conversation_id_validation_passed'
      });

      this.id = messageId;
      this.conversationId = data.conversationId;

      logger.info('✅ MESSAGE.CONSTRUCTOR - ID Y CONVERSATIONID ASIGNADOS', {
        requestId,
        id: this.id,
        conversationId: this.conversationId,
        step: 'id_assigned'
      });

      // Contenido
      logger.info('🔍 MESSAGE.CONSTRUCTOR - VALIDANDO CONTENIDO', {
        requestId,
        hasContent: !!data.content,
        hasMediaUrl: !!data.mediaUrl,
        content: data.content,
        mediaUrl: data.mediaUrl,
        contentType: typeof data.content,
        contentLength: data.content?.length || 0,
        step: 'content_validation_start'
      });

      // CORREGIDO: Permitir contenido vacío pero no null/undefined
      if (data.content === null || data.content === undefined) {
        logger.error('❌ MESSAGE.CONSTRUCTOR - CONTENIDO NULL/UNDEFINED', {
          requestId,
          hasContent: !!data.content,
          hasMediaUrl: !!data.mediaUrl,
          content: data.content,
          mediaUrl: data.mediaUrl,
          contentType: typeof data.content,
          step: 'validation_failed_content_null'
        });
        throw new Error('Message debe tener content (no puede ser null/undefined)');
      }

      // Si no hay contenido ni mediaUrl, entonces es un error
      if (!data.content && !data.mediaUrl) {
        logger.error('❌ MESSAGE.CONSTRUCTOR - CONTENIDO FALTANTE', {
          requestId,
          hasContent: !!data.content,
          hasMediaUrl: !!data.mediaUrl,
          content: data.content,
          mediaUrl: data.mediaUrl,
          contentType: typeof data.content,
          step: 'validation_failed_content_missing'
        });
        throw new Error('Message debe tener content o mediaUrl');
      }

      logger.info('✅ MESSAGE.CONSTRUCTOR - CONTENIDO VÁLIDO', {
        requestId,
        hasContent: !!data.content,
        hasMediaUrl: !!data.mediaUrl,
        contentLength: data.content?.length || 0,
        step: 'content_validation_passed'
      });

      // CORREGIDO: Asignar contenido como string (puede ser vacío)
      this.content = data.content || '';
      this.mediaUrl = data.mediaUrl || null;

      logger.info('✅ MESSAGE.CONSTRUCTOR - CONTENIDO ASIGNADO', {
        requestId,
        hasContent: !!this.content,
        hasMediaUrl: !!this.mediaUrl,
        step: 'content_assigned'
      });

      // EMAIL-FIRST: Identificadores de remitente y destinatario.
      logger.info('🔍 MESSAGE.CONSTRUCTOR - VALIDANDO IDENTIFICADORES', {
        requestId,
        hasSenderIdentifier: !!data.senderIdentifier,
        hasRecipientIdentifier: !!data.recipientIdentifier,
        senderIdentifier: data.senderIdentifier,
        recipientIdentifier: data.recipientIdentifier,
        step: 'identifiers_validation_start'
      });

      if (!data.senderIdentifier || !data.recipientIdentifier) {
        logger.error('❌ MESSAGE.CONSTRUCTOR - IDENTIFICADORES FALTANTES', {
          requestId,
          hasSenderIdentifier: !!data.senderIdentifier,
          hasRecipientIdentifier: !!data.recipientIdentifier,
          senderIdentifier: data.senderIdentifier,
          recipientIdentifier: data.recipientIdentifier,
          step: 'validation_failed_identifiers'
        });
        throw new Error('senderIdentifier y recipientIdentifier son requeridos');
      }

      logger.info('✅ MESSAGE.CONSTRUCTOR - IDENTIFICADORES VÁLIDOS', {
        requestId,
        senderIdentifier: data.senderIdentifier,
        recipientIdentifier: data.recipientIdentifier,
        step: 'identifiers_validation_passed'
      });

      this.senderIdentifier = data.senderIdentifier; // Puede ser EMAIL o teléfono.
      this.recipientIdentifier = data.recipientIdentifier; // Puede ser EMAIL o teléfono.

      logger.info('✅ MESSAGE.CONSTRUCTOR - IDENTIFICADORES ASIGNADOS', {
        requestId,
        senderIdentifier: this.senderIdentifier,
        recipientIdentifier: this.recipientIdentifier,
        step: 'identifiers_assigned'
      });

      // DEPRECATED: Se eliminan los campos específicos de teléfono. La lógica se basa en los identifiers.
      // this.senderPhone = ...
      // this.recipientPhone = ...

      // CAMPOS OBLIGATORIOS CON VALORES POR DEFECTO
      logger.info('🔍 MESSAGE.CONSTRUCTOR - ASIGNANDO CAMPOS OBLIGATORIOS', {
        requestId,
        direction: data.direction,
        type: data.type,
        status: data.status,
        hasTimestamp: !!data.timestamp,
        hasMetadata: !!data.metadata,
        hasCreatedAt: !!data.createdAt,
        hasUpdatedAt: !!data.updatedAt,
        step: 'required_fields_assignment_start'
      });

      this.direction = data.direction || 'inbound';
      this.type = data.type || (this.mediaUrl ? 'media' : 'text');
      this.status = data.status || 'sent';
      this.timestamp = data.timestamp || Timestamp.now();
      this.metadata = data.metadata || {};
      this.createdAt = data.createdAt || Timestamp.now();
      this.updatedAt = data.updatedAt || Timestamp.now();

      logger.info('✅ MESSAGE.CONSTRUCTOR - CAMPOS OBLIGATORIOS ASIGNADOS', {
        requestId,
        direction: this.direction,
        type: this.type,
        status: this.status,
        hasTimestamp: !!this.timestamp,
        hasMetadata: !!this.metadata,
        hasCreatedAt: !!this.createdAt,
        hasUpdatedAt: !!this.updatedAt,
        step: 'required_fields_assigned'
      });

      logger.info('✅ MESSAGE.CONSTRUCTOR - CONSTRUCCIÓN COMPLETADA', {
        requestId,
        messageId: this.id,
        conversationId: this.conversationId,
        senderIdentifier: this.senderIdentifier,
        recipientIdentifier: this.recipientIdentifier,
        content: this.content,
        type: this.type,
        direction: this.direction,
        step: 'constructor_complete'
      });

    } catch (error) {
      // === LOG EXTREMADAMENTE DETALLADO DEL ERROR DEL CONSTRUCTOR ===
      logger.error('❌ MESSAGE.CONSTRUCTOR - ERROR CRÍTICO', {
        requestId,
        error: error.message,
        errorType: error.constructor.name,
        stack: error.stack?.split('\n').slice(0, 20),
        data: {
          hasId: !!data.id,
          hasMessageId: !!data.messageId,
          hasConversationId: !!data.conversationId,
          hasSenderIdentifier: !!data.senderIdentifier,
          hasRecipientIdentifier: !!data.recipientIdentifier,
          hasContent: !!data.content,
          hasMediaUrl: !!data.mediaUrl,
          id: data.id,
          messageId: data.messageId,
          conversationId: data.conversationId,
          senderIdentifier: data.senderIdentifier,
          recipientIdentifier: data.recipientIdentifier,
          content: data.content,
          contentLength: data.content?.length || 0,
          mediaUrl: data.mediaUrl,
          type: data.type,
          direction: data.direction,
          status: data.status,
          hasMetadata: !!data.metadata,
          metadataKeys: data.metadata ? Object.keys(data.metadata) : []
        },
        step: 'constructor_error'
      });
      throw error;
    }
  }

  isPhone(identifier) {
    return typeof identifier === 'string' && identifier.startsWith('+');
  }

  /**
   * Crear mensaje en Firestore (EMAIL-FIRST)
   */
  static async create (messageData) {
    const requestId = `msg_create_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info('🔄 MESSAGE.CREATE - INICIANDO CREACIÓN', {
        requestId,
        timestamp: new Date().toISOString(),
        messageDataKeys: Object.keys(messageData),
        messageDataValues: {
          id: messageData.id,
          conversationId: messageData.conversationId,
          senderIdentifier: messageData.senderIdentifier,
          recipientIdentifier: messageData.recipientIdentifier,
          content: messageData.content,
          type: messageData.type,
          direction: messageData.direction,
          status: messageData.status,
          hasMetadata: !!messageData.metadata,
          metadataKeys: messageData.metadata ? Object.keys(messageData.metadata) : []
        },
        step: 'message_create_start'
      });

      logger.info('🔄 MESSAGE.CREATE - INICIANDO CONSTRUCCIÓN DE INSTANCIA', {
        requestId,
        step: 'constructor_start'
      });

      try {
        const message = new Message(messageData);

        logger.info('✅ MESSAGE.CREATE - INSTANCIA CREADA', {
          requestId,
          messageId: message.id,
          conversationId: message.conversationId,
          senderIdentifier: message.senderIdentifier,
          recipientIdentifier: message.recipientIdentifier,
          content: message.content,
          type: message.type,
          direction: message.direction,
          step: 'message_instance_created'
        });

        logger.info('🧹 MESSAGE.CREATE - INICIANDO PREPARACIÓN PARA FIRESTORE', {
          requestId,
          step: 'firestore_preparation_start'
        });

        const cleanData = prepareForFirestore({ ...message });

        logger.info('🧹 MESSAGE.CREATE - DATOS LIMPIOS PREPARADOS', {
          requestId,
          cleanDataKeys: Object.keys(cleanData),
          cleanDataValues: {
            id: cleanData.id,
            conversationId: cleanData.conversationId,
            senderIdentifier: cleanData.senderIdentifier,
            recipientIdentifier: cleanData.recipientIdentifier,
            content: cleanData.content,
            type: cleanData.type,
            direction: cleanData.direction,
            hasMetadata: !!cleanData.metadata,
            metadataKeys: cleanData.metadata ? Object.keys(cleanData.metadata) : []
          },
          step: 'firestore_preparation_complete'
        });

        // === DEBUG DETALLADO ANTES DE FIRESTORE ===
        logger.info('=== FIRESTORE DEBUG ===', {
          requestId,
          path: `conversations/${message.conversationId}/messages/${message.id}`,
          cleanData: JSON.stringify(cleanData, null, 2),
          messageData: {
            id: message.id,
            conversationId: message.conversationId,
            senderIdentifier: message.senderIdentifier,
            recipientIdentifier: message.recipientIdentifier,
            content: message.content,
            type: message.type,
            direction: message.direction,
            status: message.status
          }
        });

        // Guardar en la subcolección de la conversación
        logger.info('💾 MESSAGE.CREATE - INICIANDO GUARDADO EN FIRESTORE', {
          requestId,
          collection: 'conversations',
          documentId: message.conversationId,
          subcollection: 'messages',
          messageId: message.id,
          step: 'firestore_save_start'
        });

        try {
          logger.info('🔄 MESSAGE.CREATE - EJECUTANDO SET EN FIRESTORE', {
            requestId,
            path: `conversations/${message.conversationId}/messages/${message.id}`,
            step: 'firestore_set_execution'
          });

          // Asegurar que el documento padre de la conversación exista
          logger.info('🔄 MESSAGE.CREATE - VERIFICANDO DOCUMENTO PADRE DE CONVERSACIÓN', {
            requestId,
            conversationId: message.conversationId,
            step: 'parent_document_check'
          });

          const conversationRef = firestore.collection('conversations').doc(message.conversationId);
          const conversationDoc = await conversationRef.get();

          if (!conversationDoc.exists) {
            logger.info('❌ MESSAGE.CREATE - DOCUMENTO PADRE NO EXISTE, CREÁNDOLO', {
              requestId,
              conversationId: message.conversationId,
              step: 'parent_document_creation'
            });

            // Crear el documento padre de la conversación
            await conversationRef.set({
              id: message.conversationId,
              customerPhone: message.senderIdentifier,
              createdAt: new Date(),
              updatedAt: new Date(),
              lastMessage: {
                content: message.content,
                timestamp: new Date(),
                sender: message.senderIdentifier
              }
            });

            logger.info('✅ MESSAGE.CREATE - DOCUMENTO PADRE CREADO', {
              requestId,
              conversationId: message.conversationId,
              step: 'parent_document_created'
            });
          } else {
            logger.info('✅ MESSAGE.CREATE - DOCUMENTO PADRE EXISTE', {
              requestId,
              conversationId: message.conversationId,
              step: 'parent_document_exists'
            });
          }

          // === LOG EXTREMADAMENTE DETALLADO ANTES DEL SET EN FIRESTORE ===
          logger.info('🔍 MESSAGE.CREATE - ANTES DE EJECUTAR SET EN FIRESTORE', {
            requestId,
            path: `conversations/${message.conversationId}/messages/${message.id}`,
            cleanDataKeys: Object.keys(cleanData),
            cleanDataValues: {
              id: cleanData.id,
              conversationId: cleanData.conversationId,
              senderIdentifier: cleanData.senderIdentifier,
              recipientIdentifier: cleanData.recipientIdentifier,
              content: cleanData.content,
              type: cleanData.type,
              direction: cleanData.direction,
              status: cleanData.status,
              mediaUrl: cleanData.mediaUrl,
              hasMetadata: !!cleanData.metadata,
              metadataKeys: cleanData.metadata ? Object.keys(cleanData.metadata) : []
            },
            step: 'before_firestore_set'
          });

          // Ahora guardar el mensaje en la subcolección
          await firestore
            .collection('conversations')
            .doc(message.conversationId)
            .collection('messages')
            .doc(message.id)
            .set(cleanData);

          // === LOG EXTREMADAMENTE DETALLADO DESPUÉS DEL SET EN FIRESTORE ===
          logger.info('✅ MESSAGE.CREATE - DESPUÉS DE SET EN FIRESTORE EXITOSO', {
            requestId,
            messageId: message.id,
            conversationId: message.conversationId,
            path: `conversations/${message.conversationId}/messages/${message.id}`,
            step: 'after_firestore_set_success'
          });

          logger.info('✅ MESSAGE.CREATE - MENSAJE GUARDADO EN FIRESTORE', {
            requestId,
            messageId: message.id,
            conversationId: message.conversationId,
            sender: message.senderIdentifier,
            recipient: message.recipientIdentifier,
            step: 'firestore_save_complete'
          });

          // === LOG DE ÉXITO DETALLADO ===
          logger.info('=== MENSAJE GUARDADO CORRECTAMENTE ===', {
            requestId,
            messageId: message.id,
            conversationId: message.conversationId,
            content: message.content,
            type: message.type,
            direction: message.direction,
            timestamp: new Date().toISOString()
          });

        } catch (firestoreError) {
          // === LOG EXTREMADAMENTE DETALLADO DEL ERROR DE FIRESTORE ===
          logger.error('❌ MESSAGE.CREATE - ERROR EN FIRESTORE SET', {
            requestId,
            error: firestoreError.message,
            errorType: firestoreError.constructor.name,
            errorCode: firestoreError.code,
            errorDetails: firestoreError.details,
            stack: firestoreError.stack?.split('\n').slice(0, 20),
            path: `conversations/${message.conversationId}/messages/${message.id}`,
            cleanDataKeys: Object.keys(cleanData),
            cleanDataValues: {
              id: cleanData.id,
              conversationId: cleanData.conversationId,
              senderIdentifier: cleanData.senderIdentifier,
              recipientIdentifier: cleanData.recipientIdentifier,
              content: cleanData.content,
              type: cleanData.type,
              direction: cleanData.direction,
              status: cleanData.status,
              mediaUrl: cleanData.mediaUrl,
              hasMetadata: !!cleanData.metadata,
              metadataKeys: cleanData.metadata ? Object.keys(cleanData.metadata) : []
            },
            step: 'firestore_set_error'
          });

          // === ERROR DETALLADO ===
          logger.error('=== ERROR DETALLADO EN FIRESTORE ===', {
            requestId,
            errorMessage: firestoreError.message,
            errorCode: firestoreError.code,
            errorDetails: firestoreError.details,
            path: `conversations/${message.conversationId}/messages/${message.id}`,
            cleanData: JSON.stringify(cleanData, null, 2),
            messageData: {
              id: message.id,
              conversationId: message.conversationId,
              senderIdentifier: message.senderIdentifier,
              recipientIdentifier: message.recipientIdentifier,
              content: message.content,
              type: message.type,
              direction: message.direction,
              status: message.status,
              mediaUrl: message.mediaUrl
            }
          });

          throw firestoreError;
        }

        // Actualizar conversación
        logger.info('🔄 MESSAGE.CREATE - INICIANDO ACTUALIZACIÓN DE CONVERSACIÓN', {
          requestId,
          conversationId: message.conversationId,
          step: 'conversation_update_start'
        });

        try {
          logger.info('🔄 MESSAGE.CREATE - IMPORTANDO CONVERSATION MODEL', {
            requestId,
            step: 'conversation_import_start'
          });

          const Conversation = require('./Conversation');
          
          logger.info('✅ MESSAGE.CREATE - CONVERSATION MODEL IMPORTADO', {
            requestId,
            step: 'conversation_import_complete'
          });

          logger.info('🔄 MESSAGE.CREATE - LLAMANDO Conversation.getById', {
            requestId,
            conversationId: message.conversationId,
            step: 'calling_conversation_getById'
          });

          const conversation = await Conversation.getById(message.conversationId);
          
          if (conversation) {
            logger.info('✅ MESSAGE.CREATE - CONVERSACIÓN ENCONTRADA', {
              requestId,
              conversationId: message.conversationId,
              step: 'conversation_found'
            });

            logger.info('🔄 MESSAGE.CREATE - LLAMANDO conversation.updateLastMessage', {
              requestId,
              conversationId: message.conversationId,
              messageId: message.id,
              step: 'calling_updateLastMessage'
            });

            await conversation.updateLastMessage(message);

            logger.info('✅ MESSAGE.CREATE - CONVERSACIÓN ACTUALIZADA', {
              requestId,
              conversationId: message.conversationId,
              step: 'conversation_update_complete'
            });
          } else {
            logger.warn('⚠️ MESSAGE.CREATE - CONVERSACIÓN NO ENCONTRADA', {
              requestId,
              conversationId: message.conversationId,
              step: 'conversation_not_found'
            });
          }

        } catch (conversationError) {
          logger.error('❌ MESSAGE.CREATE - ERROR EN ACTUALIZACIÓN DE CONVERSACIÓN', {
            requestId,
            error: conversationError.message,
            stack: conversationError.stack?.split('\n').slice(0, 10),
            conversationId: message.conversationId,
            step: 'conversation_update_error'
          });
          // No lanzar error, es una operación secundaria
        }

        logger.info('✅ MESSAGE.CREATE - CREACIÓN COMPLETADA', {
          requestId,
          messageId: message.id,
          conversationId: message.conversationId,
          step: 'message_create_complete'
        });

        return message;

      } catch (constructorError) {
        // === LOG EXTREMADAMENTE DETALLADO DEL ERROR DEL CONSTRUCTOR ===
        logger.error('❌ MESSAGE.CREATE - ERROR EN CONSTRUCTOR', {
          requestId,
          error: constructorError.message,
          errorType: constructorError.constructor.name,
          stack: constructorError.stack?.split('\n').slice(0, 20),
          messageData: {
            id: messageData.id,
            conversationId: messageData.conversationId,
            senderIdentifier: messageData.senderIdentifier,
            recipientIdentifier: messageData.recipientIdentifier,
            content: messageData.content,
            contentLength: messageData.content?.length || 0,
            type: messageData.type,
            direction: messageData.direction,
            status: messageData.status,
            mediaUrl: messageData.mediaUrl,
            hasMetadata: !!messageData.metadata,
            metadataKeys: messageData.metadata ? Object.keys(messageData.metadata) : []
          },
          step: 'constructor_error'
        });
        throw constructorError;
      }

    } catch (error) {
      // === LOG EXTREMADAMENTE DETALLADO DEL ERROR CRÍTICO ===
      logger.error('❌ MESSAGE.CREATE - ERROR CRÍTICO', {
        requestId,
        error: error.message,
        errorType: error.constructor.name,
        stack: error.stack?.split('\n').slice(0, 20),
        messageData: {
          id: messageData.id,
          conversationId: messageData.conversationId,
          senderIdentifier: messageData.senderIdentifier,
          recipientIdentifier: messageData.recipientIdentifier,
          content: messageData.content,
          contentLength: messageData.content?.length || 0,
          type: messageData.type,
          direction: messageData.direction,
          status: messageData.status,
          mediaUrl: messageData.mediaUrl,
          hasMetadata: !!messageData.metadata,
          metadataKeys: messageData.metadata ? Object.keys(messageData.metadata) : []
        },
        step: 'message_create_error'
      });
      throw error;
    }
  }

  /**
   * Obtener mensaje por Twilio SID
   * @param {string} twilioSid - SID de Twilio del mensaje
   * @returns {Message|null} - Mensaje encontrado o null
   */
  static async getByTwilioSid(twilioSid) {
    try {
      logger.info('🔍 MESSAGE.GETBYTWILIOSID - BUSCANDO MENSAJE', {
        twilioSid,
        step: 'search_start'
      });

      // Buscar en todas las conversaciones
      const conversationsRef = firestore.collection('conversations');
      const conversationsSnapshot = await conversationsRef.get();

      logger.info('📋 MESSAGE.GETBYTWILIOSID - CONVERSACIONES ENCONTRADAS', {
        twilioSid,
        conversationsCount: conversationsSnapshot.size,
        step: 'conversations_loaded'
      });

      // Buscar en cada conversación
      for (const conversationDoc of conversationsSnapshot.docs) {
        const messagesRef = conversationDoc.ref.collection('messages');
        const messagesSnapshot = await messagesRef
          .where('metadata.twilioSid', '==', twilioSid)
          .limit(1)
          .get();

        if (!messagesSnapshot.empty) {
          const messageDoc = messagesSnapshot.docs[0];
          const message = new Message({ id: messageDoc.id, ...messageDoc.data() });

          logger.info('✅ MESSAGE.GETBYTWILIOSID - MENSAJE ENCONTRADO', {
            twilioSid,
            messageId: message.id,
            conversationId: message.conversationId,
            step: 'message_found'
          });

          return message;
        }
      }

      logger.info('❌ MESSAGE.GETBYTWILIOSID - MENSAJE NO ENCONTRADO', {
        twilioSid,
        step: 'message_not_found'
      });

      return null;

    } catch (error) {
      logger.error('❌ MESSAGE.GETBYTWILIOSID - ERROR CRÍTICO', {
        twilioSid,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 5),
        step: 'search_error'
      });
      throw error;
    }
  }

  /**
   * OPTIMIZADO: Obtener mensajes por conversación con paginación basada en cursor
   * @param {string} conversationId - ID de la conversación
   * @param {Object} options - Opciones de paginación y filtros
   * @returns {Object} - Resultado con mensajes y metadata de paginación
   */
  static async getByConversation (conversationId, options = {}) {
    // La validación isValidConversationId se elimina porque ahora son UUIDs.
    // ... el resto de la lógica de getByConversation permanece igual

    const {
      limit = 20,
      cursor = null,
      direction = null,
      status = null,
      type = null,
      startDate = null,
      endDate = null,
      orderBy = 'timestamp',
      order = 'desc',
    } = options;

    // VALIDACIÓN: Límites de paginación
    const validatedLimit = Math.min(Math.max(limit, 1), 100);
    const validatedOrder = ['asc', 'desc'].includes(order) ? order : 'desc';

    // MONITOREO: Log de parámetros de consulta
    logger.info('Consultando mensajes por conversación', {
      conversationId,
      limit: validatedLimit,
      cursor: cursor ? 'presente' : 'ausente',
      filters: {
        direction,
        status,
        type,
        startDate: startDate ? 'presente' : 'ausente',
        endDate: endDate ? 'presente' : 'ausente',
      },
      orderBy,
      order: validatedOrder,
    });

    let query = firestore
      .collection('conversations')
      .doc(conversationId)
      .collection('messages');

    // APLICAR FILTROS
    const appliedFilters = [];

    if (direction) {
      query = query.where('direction', '==', direction);
      appliedFilters.push(`direction: ${direction}`);
    }

    if (status) {
      query = query.where('status', '==', status);
      appliedFilters.push(`status: ${status}`);
    }

    if (type) {
      query = query.where('type', '==', type);
      appliedFilters.push(`type: ${type}`);
    }

    if (startDate) {
      const startTimestamp = startDate instanceof Date ? Timestamp.fromDate(startDate) : startDate;
      query = query.where('timestamp', '>=', startTimestamp);
      appliedFilters.push(`startDate: ${startDate}`);
    }

    if (endDate) {
      const endTimestamp = endDate instanceof Date ? Timestamp.fromDate(endDate) : endDate;
      query = query.where('timestamp', '<=', endTimestamp);
      appliedFilters.push(`endDate: ${endDate}`);
    }

    // ORDENAMIENTO
    query = query.orderBy(orderBy, validatedOrder);

    // PAGINACIÓN BASADA EN CURSOR
    if (cursor) {
      try {
        const cursorData = parseCursor(cursor);
        if (cursorData.conversationId === conversationId) {
          query = query.startAfter(cursorData.documentSnapshot);
        } else {
          logger.warn('Cursor de conversación diferente', {
            cursorConversationId: cursorData.conversationId,
            requestedConversationId: conversationId,
          });
        }
      } catch (error) {
        logger.error('Error parseando cursor', { cursor, error: error.message });
      }
    }

    // APLICAR LÍMITE
    query = query.limit(validatedLimit + 1); // +1 para determinar si hay más páginas

    // EJECUTAR CONSULTA
    const startTime = Date.now();
    const snapshot = await query.get();
    const queryTime = Date.now() - startTime;

    // PROCESAR RESULTADOS
    const messages = [];
    let hasMore = false;

    snapshot.docs.forEach((doc, index) => {
      if (index < validatedLimit) {
        messages.push(new Message({ id: doc.id, ...doc.data() }));
      } else {
        hasMore = true;
      }
    });

    // GENERAR CURSOR PARA SIGUIENTE PÁGINA
    let nextCursor = null;
    if (hasMore && messages.length > 0) {
      const lastDoc = snapshot.docs[validatedLimit - 1];
      nextCursor = createCursor({
        conversationId,
        documentSnapshot: lastDoc,
        timestamp: lastDoc.data().timestamp,
      });
    }

    // MONITOREO: Log de resultados
    logger.info('Consulta de mensajes completada', {
      conversationId,
      totalResults: messages.length,
      hasMore,
      queryTime: `${queryTime}ms`,
      appliedFilters: appliedFilters.length > 0 ? appliedFilters : ['ninguno'],
      nextCursor: nextCursor ? 'presente' : 'ausente',
    });

    return {
      messages,
      pagination: {
        hasMore,
        nextCursor,
        totalResults: messages.length,
        limit: validatedLimit,
        orderBy,
        order: validatedOrder,
      },
      metadata: {
        conversationId,
        appliedFilters,
        queryTime: `${queryTime}ms`,
      },
    };
  }

  /**
   * Obtener mensaje por ID
   */
  static async getById (conversationId, messageId) {
    // La validación isValidConversationId se elimina porque ahora son UUIDs.
    // ... el resto de la lógica de getById permanece igual

    const doc = await firestore
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .doc(messageId)
      .get();

    if (!doc.exists) {
      return null;
    }

    return new Message({ id: doc.id, ...doc.data() });
  }

  /**
   * Actualizar mensaje
   */
  async update (updates) {
    const cleanData = prepareForFirestore({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await firestore
      .collection('conversations')
      .doc(this.conversationId)
      .collection('messages')
      .doc(this.id)
      .update(cleanData);

    // Actualizar instancia local
    Object.assign(this, updates);
    this.updatedAt = Timestamp.now();
  }

  /**
   * Eliminar mensaje
   */
  async delete () {
    await firestore
      .collection('conversations')
      .doc(this.conversationId)
      .collection('messages')
      .doc(this.id)
      .delete();

    // Actualizar conversación
    const Conversation = require('./Conversation');
    const conversation = await Conversation.getById(this.conversationId);
    if (conversation) {
      await conversation.decrementMessageCount(this);
    }
  }

  /**
   * Marcar como leído
   */
  async markAsRead () {
    await this.update({
      status: 'read',
    });

    this.status = 'read';
  }

  /**
   * Obtener estadísticas de mensajes
   */
  static async getStats (conversationId, options = {}) {
    // La validación isValidConversationId se elimina porque ahora son UUIDs.
    // ... el resto de la lógica de getStats permanece igual

    const { startDate = null, endDate = null } = options;

    let query = firestore
      .collection('conversations')
      .doc(conversationId)
      .collection('messages');

    if (startDate) {
      const startTimestamp = startDate instanceof Date ? Timestamp.fromDate(startDate) : startDate;
      query = query.where('timestamp', '>=', startTimestamp);
    }

    if (endDate) {
      const endTimestamp = endDate instanceof Date ? Timestamp.fromDate(endDate) : endDate;
      query = query.where('timestamp', '<=', endTimestamp);
    }

    const snapshot = await query.get();

    const messages = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    }));

    // Calcular estadísticas
    const stats = {
      totalMessages: messages.length,
      inboundMessages: messages.filter(m => m.direction === 'inbound').length,
      outboundMessages: messages.filter(m => m.direction === 'outbound').length,
      readMessages: messages.filter(m => m.status === 'read').length,
      unreadMessages: messages.filter(m => m.status !== 'read').length,
      textMessages: messages.filter(m => m.type === 'text').length,
      mediaMessages: messages.filter(m => m.type !== 'text').length,
      firstMessageAt: messages.length > 0 ? messages[0].timestamp : null,
      lastMessageAt: messages.length > 0 ? messages[messages.length - 1].timestamp : null,
      averageResponseTime: this.calculateAverageResponseTime(messages),
    };

    return stats;
  }

  /**
   * Calcular tiempo promedio de respuesta
   */
  static calculateAverageResponseTime (messages) {
    const sortedMessages = messages.sort((a, b) => a.timestamp - b.timestamp);
    const responseTimes = [];

    for (let i = 1; i < sortedMessages.length; i++) {
      const current = sortedMessages[i];
      const previous = sortedMessages[i - 1];

      // Solo calcular si es respuesta del agente a cliente
      if (previous.direction === 'inbound' && current.direction === 'outbound') {
        responseTimes.push(current.timestamp - previous.timestamp);
      }
    }

    if (responseTimes.length === 0) return null;

    const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    return Math.round(average / 1000); // Retornar en segundos
  }

  /**
   * EMAIL-FIRST: Convertir a objeto plano para respuestas JSON
   */
  toJSON () {
      const normalizedTimestamp = safeDateToISOString(this.timestamp);
      const normalizedCreatedAt = safeDateToISOString(this.createdAt);
      const normalizedUpdatedAt = safeDateToISOString(this.updatedAt);

    return {
      id: this.id,
      conversationId: this.conversationId,
      content: this.content,
      mediaUrl: this.mediaUrl,
      
      // NUEVO: Campos planos para Socket.IO
      senderIdentifier: this.senderIdentifier,
      recipientIdentifier: this.recipientIdentifier,
      
      // Mantener estructura anidada para compatibilidad
      sender: {
        identifier: this.senderIdentifier,
        type: this.isPhone(this.senderIdentifier) ? 'customer' : 'agent',
      },
      recipient: {
        identifier: this.recipientIdentifier,
        type: this.isPhone(this.recipientIdentifier) ? 'customer' : 'agent',
      },

      direction: this.direction,
      type: this.type,
      status: this.status,
      timestamp: normalizedTimestamp,
      metadata: this.metadata,
      createdAt: normalizedCreatedAt,
      updatedAt: normalizedUpdatedAt,
    };
  }

  /**
   * Marcar mensaje como leído por un usuario específico
   */
  async markAsReadBy(userEmail, readTimestamp = new Date()) {
    await firestore
      .collection('conversations')
      .doc(this.conversationId)
      .collection('messages')
      .doc(this.id)
      .update({
        status: 'read',
        readBy: FieldValue.arrayUnion(userEmail),
        readAt: Timestamp.fromDate(readTimestamp),
        updatedAt: FieldValue.serverTimestamp()
      });

    this.status = 'read';
    this.readBy = this.readBy || [];
    if (!this.readBy.includes(userEmail)) {
      this.readBy.push(userEmail);
    }
    this.readAt = readTimestamp;

    logger.info('Mensaje marcado como leído por usuario', {
          messageId: this.id,
          conversationId: this.conversationId,
      userEmail,
      readAt: readTimestamp
    });
  }

  /**
   * 🗑️ Eliminación soft del mensaje
   */
  async softDelete(deletedBy) {
    await firestore
      .collection('conversations')
      .doc(this.conversationId)
      .collection('messages')
      .doc(this.id)
      .update({
        isDeleted: true,
        deletedBy,
        deletedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

    this.isDeleted = true;
    this.deletedBy = deletedBy;
    this.deletedAt = new Date();

    logger.info('Mensaje eliminado (soft delete)', {
          messageId: this.id,
          conversationId: this.conversationId,
      deletedBy
    });
  }

  /**
   * 📊 Obtener estadísticas de mensajes
   */
  static async getStats(agentEmail = null, period = '7d', conversationId = null) {
    const startDate = new Date();
    const daysToSubtract = period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 7;
    startDate.setDate(startDate.getDate() - daysToSubtract);

    // Obtener todas las conversaciones del agente o una específica
    let conversationsQuery = firestore.collection('conversations');
    
    if (agentEmail) {
      conversationsQuery = conversationsQuery.where('assignedTo', '==', agentEmail);
    }
    
    if (conversationId) {
      conversationsQuery = conversationsQuery.where(FieldPath.documentId(), '==', conversationId);
    }

    const conversationsSnapshot = await conversationsQuery.get();
    
    let totalMessages = 0;
    let inboundMessages = 0;
    let outboundMessages = 0;
    let readMessages = 0;
    let mediaMessages = 0;
    let responseTimes = [];

    // Procesar mensajes de cada conversación
    for (const convDoc of conversationsSnapshot.docs) {
      const messagesQuery = convDoc.ref
        .collection('messages')
        .where('timestamp', '>=', Timestamp.fromDate(startDate))
        .orderBy('timestamp', 'asc');
      
      const messagesSnapshot = await messagesQuery.get();
      const messages = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      totalMessages += messages.length;
      inboundMessages += messages.filter(m => m.direction === 'inbound').length;
      outboundMessages += messages.filter(m => m.direction === 'outbound').length;
      readMessages += messages.filter(m => m.status === 'read').length;
      mediaMessages += messages.filter(m => m.type !== 'text').length;

      // Calcular tiempos de respuesta
      for (let i = 1; i < messages.length; i++) {
        const current = messages[i];
        const previous = messages[i - 1];
        
        if (previous.direction === 'inbound' && current.direction === 'outbound') {
          const prevTime = previous.timestamp.toDate ? previous.timestamp.toDate() : new Date(previous.timestamp);
          const currTime = current.timestamp.toDate ? current.timestamp.toDate() : new Date(current.timestamp);
          responseTimes.push(currTime - prevTime);
        }
      }
    }

    const averageResponseTime = responseTimes.length > 0 
      ? Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length / (1000 * 60))
      : 0;

    return {
      total: totalMessages,
      inbound: inboundMessages,
      outbound: outboundMessages,
      read: readMessages,
      unread: totalMessages - readMessages,
      media: mediaMessages,
      text: totalMessages - mediaMessages,
      averageResponseTime, // en minutos
      period,
      agentEmail,
      conversationId
    };
  }

  /**
   * 🔍 Buscar mensajes en conversaciones del usuario
   */
  static async searchInUserConversations(options = {}) {
    const { searchTerm, limit = 20, userEmail = null } = options;
    
    // Obtener conversaciones del usuario
    let conversationsQuery = firestore.collection('conversations');
    
    if (userEmail) {
      conversationsQuery = conversationsQuery.where('assignedTo', '==', userEmail);
    }

    const conversationsSnapshot = await conversationsQuery.limit(50).get(); // Limitar conversaciones
    const results = [];

    // Buscar en mensajes de cada conversación
    for (const convDoc of conversationsSnapshot.docs) {
      if (results.length >= limit) break;

      const messagesQuery = convDoc.ref
        .collection('messages')
        .where('content', '>=', searchTerm)
        .where('content', '<=', searchTerm + '\uf8ff')
        .limit(limit - results.length);
      
      const messagesSnapshot = await messagesQuery.get();
      
      messagesSnapshot.docs.forEach(doc => {
        const messageData = doc.data();
        if (messageData.content?.toLowerCase().includes(searchTerm.toLowerCase())) {
          results.push(new Message({ id: doc.id, ...messageData }));
        }
      });
    }

    return results;
  }

  /**
   * Buscar mensajes en una conversación específica
   */
  static async search (conversationId, searchTerm, options = {}) {
    const messages = await this.getByConversation(conversationId, { ...options, limit: 1000 });
    return messages.messages.filter(message =>
      message.content?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }
}

module.exports = Message;
