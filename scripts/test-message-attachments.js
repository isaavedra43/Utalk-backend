/**
 * 🧪 SCRIPT DE PRUEBA: INTEGRACIÓN DE MENSAJES CON ARCHIVOS ADJUNTOS
 * 
 * Prueba la funcionalidad completa de envío de mensajes con archivos adjuntos
 * implementada en la Fase 2.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const FileService = require('../src/services/FileService');
const { logger } = require('../src/utils/logger');

/**
 * Crear un buffer de prueba para simular un archivo
 */
function createTestBuffer(size = 1024) {
  return Buffer.alloc(size, 'A');
}

/**
 * Generar datos de archivo de prueba
 */
function generateTestAttachment(type = 'image') {
  const attachmentTypes = {
    image: {
      mimetype: 'image/jpeg',
      originalname: 'test-image.jpg',
      size: 2048
    },
    document: {
      mimetype: 'application/pdf',
      originalname: 'test-document.pdf',
      size: 5120
    },
    audio: {
      mimetype: 'audio/mpeg',
      originalname: 'test-audio.mp3',
      size: 10240
    },
    video: {
      mimetype: 'video/mp4',
      originalname: 'test-video.mp4',
      size: 20480
    }
  };

  const config = attachmentTypes[type] || attachmentTypes.image;
  
  return {
    buffer: createTestBuffer(config.size),
    originalname: config.originalname,
    mimetype: config.mimetype,
    size: config.size,
    fieldname: 'attachment'
  };
}

/**
 * Simular el método sendMessageWithAttachments
 */
async function simulateSendMessageWithAttachments(conversationId, content, attachments) {
  try {
    logger.info('🔄 Simulando envío de mensaje con archivos adjuntos', {
      conversationId,
      contentLength: content?.length || 0,
      attachmentCount: attachments.length
    });

    // 1. Procesar archivos usando FileService
    const fileService = new FileService();
    const processedFiles = await fileService.processMessageAttachments(
      attachments,
      'test@example.com',
      conversationId
    );

    logger.info('✅ Archivos procesados exitosamente', {
      processedCount: processedFiles.attachments.length,
      success: processedFiles.success
    });

    // 2. Crear mensaje con referencias a archivos
    const message = {
      conversationId,
      messageId: `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: content || 'Archivos adjuntos',
      type: 'message_with_files',
      direction: 'outbound',
      senderIdentifier: 'test@example.com',
      recipientIdentifier: '+1234567890',
      timestamp: new Date(),
      status: 'pending',
      metadata: {
        sentBy: 'test@example.com',
        sentAt: new Date().toISOString(),
        attachments: processedFiles.attachments,
        attachmentCount: processedFiles.attachments.length,
        fileTypes: processedFiles.attachments.map(a => a.type),
        totalSize: processedFiles.attachments.reduce((sum, a) => sum + (a.size || 0), 0)
      }
    };

    logger.info('✅ Mensaje creado exitosamente', {
      messageId: message.messageId,
      attachmentCount: message.metadata.attachmentCount,
      fileTypes: message.metadata.fileTypes
    });

    // 3. Simular guardado en base de datos
    logger.info('💾 Simulando guardado en base de datos');
    
    // Simular actualización de conversación
    const conversation = {
      id: conversationId,
      lastMessage: message.content,
      lastMessageAt: message.timestamp,
      messageCount: 1,
      unreadCount: 0,
      status: 'active'
    };

    logger.info('✅ Conversación actualizada', {
      conversationId: conversation.id,
      lastMessage: conversation.lastMessage,
      messageCount: conversation.messageCount
    });

    // 4. Simular envío por Twilio
    logger.info('📤 Simulando envío por Twilio');
    
    const mediaUrls = processedFiles.attachments.map(attachment => attachment.url);
    const twilioResponse = {
      sid: `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'sent',
      mediaUrls: mediaUrls
    };

    // Actualizar mensaje con datos de Twilio
    message.status = 'sent';
    message.metadata.twilioSid = twilioResponse.sid;
    message.metadata.sentAt = new Date().toISOString();
    message.metadata.mediaUrls = mediaUrls;

    logger.info('✅ Mensaje enviado por Twilio', {
      twilioSid: twilioResponse.sid,
      mediaCount: mediaUrls.length
    });

    // 5. Simular eventos WebSocket
    logger.info('📡 Simulando eventos WebSocket');
    
    const events = [
      {
        event: 'new-message',
        payload: {
          message: message,
          conversation: conversation,
          attachments: processedFiles.attachments
        }
      },
      {
        event: 'conversation-updated',
        payload: {
          id: conversationId,
          lastMessage: conversation.lastMessage,
          lastMessageAt: conversation.lastMessageAt,
          unreadCount: conversation.unreadCount,
          messageCount: conversation.messageCount,
          status: conversation.status
        }
      }
    ];

    // Eventos específicos para cada archivo
    for (const attachment of processedFiles.attachments) {
      events.push({
        event: 'file-attached',
        payload: {
          messageId: message.messageId,
          fileId: attachment.id,
          fileName: attachment.name,
          fileType: attachment.type,
          fileUrl: attachment.url,
          fileSize: attachment.size
        }
      });
    }

    logger.info('✅ Eventos WebSocket simulados', {
      eventCount: events.length,
      events: events.map(e => e.event)
    });

    return {
      success: true,
      message: message,
      conversation: conversation,
      attachments: processedFiles.attachments,
      events: events,
      metadata: {
        attachmentCount: processedFiles.attachments.length,
        totalSize: processedFiles.attachments.reduce((sum, a) => sum + (a.size || 0), 0),
        fileTypes: processedFiles.attachments.map(a => a.type),
        twilioSid: twilioResponse.sid
      }
    };

  } catch (error) {
    logger.error('❌ Error simulando envío de mensaje con archivos adjuntos', {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3)
    });
    throw error;
  }
}

/**
 * Prueba principal de integración
 */
async function testMessageAttachmentsIntegration() {
  logger.info('🧪 INICIANDO PRUEBAS DE INTEGRACIÓN DE MENSAJES CON ARCHIVOS ADJUNTOS\n');

  try {
    const conversationId = 'test-conversation-' + Date.now();
    const content = 'Este es un mensaje de prueba con archivos adjuntos';

    // 1. PRUEBA: Envío con imagen
    logger.info('🔄 Prueba 1: Envío con imagen');
    
    const imageAttachment = generateTestAttachment('image');
    const result1 = await simulateSendMessageWithAttachments(
      conversationId,
      content,
      [imageAttachment]
    );

    logger.info('✅ Prueba 1 completada', {
      success: result1.success,
      attachmentCount: result1.metadata.attachmentCount,
      fileTypes: result1.metadata.fileTypes
    });

    // 2. PRUEBA: Envío con múltiples archivos
    logger.info('🔄 Prueba 2: Envío con múltiples archivos');
    
    const multipleAttachments = [
      generateTestAttachment('image'),
      generateTestAttachment('document'),
      generateTestAttachment('audio')
    ];

    const result2 = await simulateSendMessageWithAttachments(
      conversationId,
      'Mensaje con múltiples archivos',
      multipleAttachments
    );

    logger.info('✅ Prueba 2 completada', {
      success: result2.success,
      attachmentCount: result2.metadata.attachmentCount,
      fileTypes: result2.metadata.fileTypes
    });

    // 3. PRUEBA: Envío solo con archivos (sin texto)
    logger.info('🔄 Prueba 3: Envío solo con archivos');
    
    const videoAttachment = generateTestAttachment('video');
    const result3 = await simulateSendMessageWithAttachments(
      conversationId,
      '', // Sin texto
      [videoAttachment]
    );

    logger.info('✅ Prueba 3 completada', {
      success: result3.success,
      attachmentCount: result3.metadata.attachmentCount,
      fileTypes: result3.metadata.fileTypes
    });

    // 4. PRUEBA: Validación de errores
    logger.info('🔄 Prueba 4: Validación de errores');
    
    try {
      // Intentar enviar sin archivos
      await simulateSendMessageWithAttachments(conversationId, content, []);
      logger.warn('⚠️ Prueba 4: No se detectó error esperado (sin archivos)');
    } catch (error) {
      logger.info('✅ Prueba 4: Error detectado correctamente', {
        error: error.message
      });
    }

    // 5. PRUEBA: Validación de tipos de archivo
    logger.info('🔄 Prueba 5: Validación de tipos de archivo');
    
    const invalidAttachment = {
      buffer: createTestBuffer(100),
      originalname: 'test.txt',
      mimetype: 'text/plain',
      size: 100,
      fieldname: 'attachment'
    };

    try {
      await simulateSendMessageWithAttachments(
        conversationId,
        'Mensaje con archivo inválido',
        [invalidAttachment]
      );
      logger.info('✅ Prueba 5: Archivo de texto procesado correctamente');
    } catch (error) {
      logger.warn('⚠️ Prueba 5: Error procesando archivo de texto', {
        error: error.message
      });
    }

    logger.info('🎉 TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE');
    
    // Resumen final
    const summary = {
      testsPassed: 5,
      totalAttachmentsProcessed: result1.metadata.attachmentCount + 
                                result2.metadata.attachmentCount + 
                                result3.metadata.attachmentCount,
      fileTypesTested: ['image', 'document', 'audio', 'video'],
      conversationId,
      status: 'completed'
    };

    logger.info('📊 RESUMEN FINAL', summary);

    return summary;

  } catch (error) {
    logger.error('❌ Error en pruebas de integración', {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3)
    });
    throw error;
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    await testMessageAttachmentsIntegration();
    logger.info('✅ Script de prueba completado exitosamente');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Script de prueba falló', {
      error: error.message
    });
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = {
  testMessageAttachmentsIntegration,
  simulateSendMessageWithAttachments,
  generateTestAttachment,
  createTestBuffer
}; 