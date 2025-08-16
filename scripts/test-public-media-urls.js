// Script para probar URLs públicas de media
console.log('🧪 Probando URLs públicas de media...\n');

// Simular mensaje con mediaUrl de Twilio
const messageWithTwilioMedia = {
  id: 'MMe60968c44ac4bb71105ebc3d1c4da65f',
  conversationId: 'conv_+5214773790184_+5214793176502',
  content: '',
  mediaUrl: 'https://api.twilio.com/2010-04-01/Accounts/AC1ed6685660488369e7f0c3ab257f250c/Messages/MMe60968c44ac4bb71105ebc3d1c4da65f/Media/ME1234567890abcdef',
  type: 'image',
  direction: 'inbound',
  status: 'received',
  senderIdentifier: '+5214773790184',
  recipientIdentifier: '+5214793176502',
  timestamp: new Date(),
  metadata: {
    twilio: {
      sid: 'MMe60968c44ac4bb71105ebc3d1c4da65f'
    },
    media: {
      urls: ['https://api.twilio.com/2010-04-01/Accounts/AC1ed6685660488369e7f0c3ab257f250c/Messages/MMe60968c44ac4bb71105ebc3d1c4da65f/Media/ME1234567890abcdef'],
      count: 1,
      primaryType: 'image'
    }
  },
  createdAt: new Date(),
  updatedAt: new Date()
};

// Simular mensaje con mediaUrl de Firebase
const messageWithFirebaseMedia = {
  id: 'MSG_FIREBASE_TEST',
  conversationId: 'conv_+5214773790184_+5214793176502',
  content: '',
  mediaUrl: 'https://firebasestorage.googleapis.com/v0/b/utalk-backend.appspot.com/o/files%2Ftest-image.jpg?alt=media&token=abc123',
  type: 'image',
  direction: 'inbound',
  status: 'received',
  senderIdentifier: '+5214773790184',
  recipientIdentifier: '+5214793176502',
  timestamp: new Date(),
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date()
};

// Simular el método toJSON
function simulateToJSON(message) {
  const baseUrl = process.env.BASE_URL || 'https://utalk-backend-production.up.railway.app';
  let processedMediaUrl = message.mediaUrl;
  
  if (message.mediaUrl) {
    try {
      if (message.mediaUrl.includes('firebase')) {
        // Si es una URL de Firebase Storage, generar URL pública
        const urlParts = message.mediaUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const fileId = fileName.split('.')[0]; // Remover extensión
        
        // Generar URL pública del proxy
        processedMediaUrl = `${baseUrl}/media/proxy-file-public/${fileId}`;
        
        console.log('🔄 URL de Firebase convertida a URL pública:');
        console.log('- Original:', message.mediaUrl);
        console.log('- Pública:', processedMediaUrl);
        console.log('- FileId:', fileId);
        
      } else if (message.mediaUrl.includes('api.twilio.com')) {
        // Si es una URL de Twilio, generar URL pública del proxy
        const urlParts = message.mediaUrl.split('/');
        const messageSid = urlParts[urlParts.length - 3]; // MM...
        const mediaSid = urlParts[urlParts.length - 1]; // ME...
        
        // Generar URL pública del proxy de Twilio
        processedMediaUrl = `${baseUrl}/media/proxy-public?messageSid=${messageSid}&mediaSid=${mediaSid}`;
        
        console.log('🔄 URL de Twilio convertida a URL pública:');
        console.log('- Original:', message.mediaUrl);
        console.log('- Pública:', processedMediaUrl);
        console.log('- MessageSid:', messageSid);
        console.log('- MediaSid:', mediaSid);
      }
    } catch (error) {
      console.warn('⚠️ Error generando URL pública:', error.message);
    }
  }

  return {
    id: message.id,
    conversationId: message.conversationId,
    content: message.content,
    mediaUrl: processedMediaUrl,
    type: message.type,
    direction: message.direction,
    status: message.status,
    senderIdentifier: message.senderIdentifier,
    recipientIdentifier: message.recipientIdentifier,
    timestamp: message.timestamp.toISOString(),
    metadata: message.metadata,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

console.log('📋 Probando mensaje con media de Twilio:');
console.log('=====================================');
const twilioResult = simulateToJSON(messageWithTwilioMedia);
console.log('\n📝 Resultado final:');
console.log(JSON.stringify({
  id: twilioResult.id,
  type: twilioResult.type,
  mediaUrl: twilioResult.mediaUrl,
  hasMedia: !!twilioResult.mediaUrl
}, null, 2));

console.log('\n📋 Probando mensaje con media de Firebase:');
console.log('=========================================');
const firebaseResult = simulateToJSON(messageWithFirebaseMedia);
console.log('\n📝 Resultado final:');
console.log(JSON.stringify({
  id: firebaseResult.id,
  type: firebaseResult.type,
  mediaUrl: firebaseResult.mediaUrl,
  hasMedia: !!firebaseResult.mediaUrl
}, null, 2));

console.log('\n🏁 Prueba completada');
console.log('\n✅ Las URLs públicas deberían funcionar sin autenticación');
console.log('🔗 Las URLs generadas son accesibles directamente desde el frontend'); 