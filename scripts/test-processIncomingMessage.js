// Script para probar el método processIncomingMessage
console.log('🧪 Probando método processIncomingMessage...\n');

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

console.log('📋 Webhook data de entrada:');
console.log(JSON.stringify(webhookData, null, 2));
console.log('\n');

// Simular el método processIncomingMessage paso a paso
async function simulateProcessIncomingMessage(webhookData) {
  const requestId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log('🔄 Simulando processIncomingMessage...\n');

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

  console.log('1. ✅ Datos extraídos del webhook:');
  console.log('- twilioSid:', twilioSid);
  console.log('- rawFromPhone:', rawFromPhone);
  console.log('- rawToPhone:', rawToPhone);
  console.log('- content:', content);
  console.log('- mediaUrl:', mediaUrl);
  console.log('- mediaType:', mediaType);
  console.log('- numMedia:', numMedia);
  console.log('- profileName:', profileName);

  // PASO 2: Normalizar números de teléfono
  const normalizedFromPhone = rawFromPhone?.replace('whatsapp:', '') || '';
  const normalizedToPhone = rawToPhone?.replace('whatsapp:', '') || '';

  console.log('\n2. ✅ Números normalizados:');
  console.log('- normalizedFromPhone:', normalizedFromPhone);
  console.log('- normalizedToPhone:', normalizedToPhone);

  // PASO 3: Determinar tipo de mensaje y procesar medios
  let messageType = 'text';
  let mediaData = null;

  if (parseInt(numMedia) > 0) {
    console.log('\n3. 📎 Procesando medios...');
    console.log('- numMedia > 0:', parseInt(numMedia) > 0);
    
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

    console.log('✅ Medios procesados:');
    console.log('- mediaInfo:', mediaInfo);
    console.log('- messageType:', messageType);
    console.log('- mediaData:', mediaData);
  }

  // PASO 4: Generar ID de conversación
  const conversationId = `conv_${normalizedFromPhone}_${normalizedToPhone}`;

  console.log('\n4. ✅ ID de conversación generado:');
  console.log('- conversationId:', conversationId);

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

  console.log('\n5. ✅ Datos del mensaje creados:');
  console.log('- messageData.mediaUrl:', messageData.mediaUrl);
  console.log('- messageData.type:', messageData.type);
  console.log('- messageData.metadata.media:', messageData.metadata.media);

  // 🔍 DIAGNÓSTICO DE MEDIA
  console.log('\n🔍 DIAGNÓSTICO DE MEDIA:');
  console.log('- mediaData:', mediaData);
  console.log('- mediaData?.urls:', mediaData?.urls);
  console.log('- mediaData?.url:', mediaData?.url);
  console.log('- mediaUrlAssigned:', messageData.mediaUrl);
  console.log('- messageType:', messageType);
  console.log('- numMedia:', parseInt(numMedia) || 0);

  return {
    message: messageData,
    success: true
  };
}

// Ejecutar la simulación
simulateProcessIncomingMessage(webhookData).then((result) => {
  console.log('\n📝 Resultado final:');
  console.log(JSON.stringify({
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
    console.log('\n🎉 SUCCESS: El mensaje tiene mediaUrl asignada');
  } else {
    console.log('\n❌ FAILED: El mensaje no tiene mediaUrl');
  }

  console.log('\n🏁 Simulación completada');
}).catch((error) => {
  console.error('❌ Error en la simulación:', error);
}); 