// Script para probar el método processIncomingMessage
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 Probando método processIncomingMessage...\n' });

// Simular webhook data exactamente como llega de Twilio
const webhookData = {
  MessageSid: 'MMe60968c44ac4bb71105ebc3d1c4da65f',
  From: '+5214773790184',
  To: '+5214793176502',
  Body: '',
  MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/AC1ed6685660488369e7f0c3ab257f250c/Messages/MMe60968c44ac4bb71105ebc3d1c4da65f/Media/ME1234567890abcdef',
  MediaContentType0: 'image/jpeg',
  NumMedia: '1',
  ProfileName: 'Isra',
  WaId: '5214773790184',
  AccountSid: 'AC1ed6685660488369e7f0c3ab257f250c',
  ApiVersion: '2010-04-01'
};

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Webhook data de entrada:' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: JSON.stringify(webhookData, null, 2));
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n' });

// Simular el método processIncomingMessage paso a paso
async function simulateProcessIncomingMessage(webhookData) {
  const requestId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔄 Simulando processIncomingMessage...\n' });

  // PASO 1: Extraer datos del webhook
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

  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '1. ✅ Datos extraídos del webhook:' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- twilioSid:', twilioSid });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- rawFromPhone:', rawFromPhone });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- rawToPhone:', rawToPhone });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- content:', content });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- mediaUrl:', mediaUrl });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- mediaType:', mediaType });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- numMedia:', numMedia });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- profileName:', profileName });

  // PASO 2: Normalizar números de teléfono
  const normalizedFromPhone = rawFromPhone?.replace('whatsapp:', '') || '';
  const normalizedToPhone = rawToPhone?.replace('whatsapp:', '') || '';

  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n2. ✅ Números normalizados:' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- normalizedFromPhone:', normalizedFromPhone });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- normalizedToPhone:', normalizedToPhone });

  // PASO 3: Determinar tipo de mensaje y procesar medios
  let messageType = 'text';
  let mediaData = null;

  if (parseInt(numMedia) > 0) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n3. 📎 Procesando medios...' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- numMedia > 0:', parseInt(numMedia) > 0);
    
    // Simular processWebhookMedia
    const mediaInfo = {
      urls: [mediaUrl],
      processed: [{
        fileId: `webhook-${twilioSid}-0`,
        category: 'image',
        url: mediaUrl,
        mimetype: mediaType,
        processed: true
      }],
      count: 1,
      primaryType: 'image'
    };
    
    messageType = mediaInfo.primaryType;
    mediaData = {
      urls: mediaInfo.urls,
      processed: mediaInfo.processed,
      count: mediaInfo.count,
      primaryType: mediaInfo.primaryType
    };

    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Medios procesados:' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- mediaInfo:', mediaInfo });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- messageType:', messageType });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- mediaData:', mediaData });
  }

  // PASO 4: Generar ID de conversación
  const conversationId = `conv_${normalizedFromPhone}_${normalizedToPhone}`;

  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n4. ✅ ID de conversación generado:' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- conversationId:', conversationId });

  // PASO 5: Crear datos del mensaje
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
        accountSid: webhookData.AccountSid,
        apiVersion: webhookData.ApiVersion,
      },
      contact: {
        phoneNumber: normalizedFromPhone,
        profileName: profileName,
        waId: waId,
      },
      media: mediaData,
      webhookReceivedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n5. ✅ Datos del mensaje creados:' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- messageData.mediaUrl:', messageData.mediaUrl });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- messageData.type:', messageData.type });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- messageData.metadata.media:', messageData.metadata.media });

  // 🔍 DIAGNÓSTICO DE MEDIA
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🔍 DIAGNÓSTICO DE MEDIA:' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- mediaData:', mediaData });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- mediaData?.urls:', mediaData?.urls });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- mediaData?.url:', mediaData?.url });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- mediaUrlAssigned:', messageData.mediaUrl });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- messageType:', messageType });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- numMedia:', parseInt(numMedia) || 0);

  return {
    message: messageData,
    success: true
  };
}

// Ejecutar la simulación
simulateProcessIncomingMessage(webhookData).then((result) => {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📝 Resultado final:' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: JSON.stringify({
    success: result.success,
    messageId: result.message.id,
    conversationId: result.message.conversationId,
    type: result.message.type,
    content: result.message.content,
    mediaUrl: result.message.mediaUrl,
    hasMedia: !!result.message.mediaUrl,
    direction: result.message.direction,
    senderIdentifier: result.message.senderIdentifier,
    recipientIdentifier: result.message.recipientIdentifier
  }, null, 2));

  if (result.message.mediaUrl) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎉 SUCCESS: El mensaje tiene mediaUrl asignada' });
  } else {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n❌ FAILED: El mensaje no tiene mediaUrl' });
  }

  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🏁 Simulación completada' });
}).catch((error) => {
  logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en la simulación:', error);
}); 