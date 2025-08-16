// Simular exactamente el procesamiento de media del webhook
console.log('🧪 Probando extracción de URLs de media del webhook...\n');

// Simular webhook data con media (basado en el mensaje de la imagen)
const webhookData = {
  From: '+5214773790184',
  To: '+5214793176502',
  MessageSid: 'MMe60968c44ac4bb71105ebc3d1c4da65f',
  Body: '',
  NumMedia: '1',
  MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/AC1ed6685660488369e7f0c3ab257f250c/Messages/MMe60968c44ac4bb71105ebc3d1c4da65f/Media/ME1234567890abcdef',
  MediaContentType0: 'image/jpeg',
  ProfileName: 'Isra'
};

console.log('📋 Webhook data de entrada:');
console.log(JSON.stringify(webhookData, null, 2));
console.log('\n');

// Simular el método processWebhookMedia simplificado
function simulateProcessWebhookMedia(webhookData) {
  const mediaUrls = [];
  const processedMedia = [];
  const types = new Set();

  const numMedia = parseInt(webhookData.NumMedia || '0');

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

  return result;
}

// Simular el procesamiento completo del webhook
console.log('🔄 Simulando procesamiento completo...\n');

// 1. Detectar tipo de mensaje
let messageType = 'text';
if (parseInt(webhookData.NumMedia || '0') > 0) {
  messageType = 'media';
  console.log('📎 Mensaje multimedia detectado');
}

// 2. Crear messageData inicial
const messageData = {
  conversationId: 'conv_+5214773790184_+5214793176502',
  content: webhookData.Body || '',
  type: messageType,
  direction: 'inbound',
  senderIdentifier: webhookData.From,
  recipientIdentifier: webhookData.To,
  mediaUrl: null, // Se asignará después del procesamiento
  timestamp: new Date()
};

console.log('📝 MessageData inicial:', {
  type: messageData.type,
  content: messageData.content,
  mediaUrl: messageData.mediaUrl
});

// 3. Procesar media si es necesario
if (messageType === 'media' && parseInt(webhookData.NumMedia || '0') > 0) {
  console.log('\n🔄 Procesando media...');
  const mediaResult = simulateProcessWebhookMedia(webhookData);
  
  if (mediaResult.urls.length > 0) {
    // Usar la primera URL de media como mediaUrl principal
    messageData.mediaUrl = mediaResult.urls[0];
    // Actualizar el tipo basado en el tipo principal detectado
    messageData.type = mediaResult.primaryType;
    
    console.log('✅ Media aplicado al mensaje:');
    console.log('- mediaUrl:', messageData.mediaUrl);
    console.log('- type:', messageData.type);
  } else {
    console.log('❌ No se encontraron URLs de media');
  }
}

// 4. Resultado final
console.log('\n📝 Mensaje final:');
console.log(JSON.stringify({
  id: 'simulated-message-id',
  conversationId: messageData.conversationId,
  type: messageData.type,
  content: messageData.content,
  mediaUrl: messageData.mediaUrl,
  hasMedia: !!messageData.mediaUrl,
  direction: messageData.direction,
  senderIdentifier: messageData.senderIdentifier,
  recipientIdentifier: messageData.recipientIdentifier
}, null, 2));

console.log('\n🏁 Simulación completada');
if (messageData.mediaUrl) {
  console.log('✅ SUCCESS: El mensaje tiene mediaUrl asignada');
} else {
  console.log('❌ FAILED: El mensaje no tiene mediaUrl');
} 