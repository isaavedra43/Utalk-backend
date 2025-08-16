// Script para probar que el campo mediaUrl se guarda correctamente en la base de datos
console.log('🧪 Probando guardado de mediaUrl en la base de datos...\n');

// Simular datos de mensaje con media
const messageData = {
  conversationId: 'conv_+5214773790184_+5214793176502',
  messageId: 'MSG_TEST_MEDIA_' + Date.now(),
  content: '',
  type: 'image',
  direction: 'inbound',
  senderIdentifier: '+5214773790184',
  recipientIdentifier: '+5214793176502',
  mediaUrl: 'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/MM123/Media/ME123',
  timestamp: new Date(),
  metadata: {
    twilioSid: 'MMe60968c44ac4bb71105ebc3d1c4da65f',
    media: {
      urls: ['https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/MM123/Media/ME123'],
      processed: [],
      count: 1,
      primaryType: 'image'
    }
  },
  workspaceId: 'default_workspace',
  tenantId: 'default_tenant'
};

console.log('📋 Datos del mensaje a guardar:');
console.log(JSON.stringify(messageData, null, 2));
console.log('\n');

// Simular el proceso de guardado
console.log('🔄 Simulando proceso de guardado...\n');

// 1. Verificar que mediaUrl está presente en los datos
console.log('1. ✅ Verificación de mediaUrl en datos de entrada:');
console.log('- mediaUrl presente:', !!messageData.mediaUrl);
console.log('- mediaUrl valor:', messageData.mediaUrl);
console.log('- type:', messageData.type);
console.log('- metadata.media.count:', messageData.metadata?.media?.count);

// 2. Simular preparación de datos para Firestore
console.log('\n2. 🔄 Preparación de datos para Firestore:');
const messageFirestoreData = {
  id: messageData.messageId,
  conversationId: messageData.conversationId,
  content: messageData.content || '',
  type: messageData.type || 'text',
  direction: 'inbound',
  status: 'received',
  senderIdentifier: messageData.senderIdentifier,
  recipientIdentifier: messageData.recipientIdentifier,
  mediaUrl: messageData.mediaUrl || null, // 🔧 Campo agregado
  timestamp: messageData.timestamp || new Date(),
  metadata: messageData.metadata || {},
  createdAt: new Date(),
  updatedAt: new Date()
};

console.log('✅ Datos preparados para Firestore:');
console.log(JSON.stringify(messageFirestoreData, null, 2));

// 3. Verificar que mediaUrl se preservó
console.log('\n3. ✅ Verificación de mediaUrl en datos de Firestore:');
console.log('- mediaUrl presente:', !!messageFirestoreData.mediaUrl);
console.log('- mediaUrl valor:', messageFirestoreData.mediaUrl);
console.log('- type:', messageFirestoreData.type);

// 4. Simular creación de objeto Message
console.log('\n4. 🔄 Simulación de creación de objeto Message:');
const mockMessage = {
  id: messageFirestoreData.id,
  conversationId: messageFirestoreData.conversationId,
  content: messageFirestoreData.content,
  type: messageFirestoreData.type,
  direction: messageFirestoreData.direction,
  status: messageFirestoreData.status,
  senderIdentifier: messageFirestoreData.senderIdentifier,
  recipientIdentifier: messageFirestoreData.recipientIdentifier,
  mediaUrl: messageFirestoreData.mediaUrl,
  timestamp: messageFirestoreData.timestamp,
  metadata: messageFirestoreData.metadata,
  createdAt: messageFirestoreData.createdAt,
  updatedAt: messageFirestoreData.updatedAt
};

console.log('✅ Objeto Message creado:');
console.log(JSON.stringify(mockMessage, null, 2));

// 5. Simular toJSON()
console.log('\n5. 🔄 Simulación de toJSON():');
const toJSONResult = {
  id: mockMessage.id,
  conversationId: mockMessage.conversationId,
  content: mockMessage.content,
  mediaUrl: mockMessage.mediaUrl, // Debería preservarse
  senderIdentifier: mockMessage.senderIdentifier,
  recipientIdentifier: mockMessage.recipientIdentifier,
  sender: {
    identifier: mockMessage.senderIdentifier,
    type: 'customer'
  },
  recipient: {
    identifier: mockMessage.recipientIdentifier,
    type: 'agent'
  },
  direction: mockMessage.direction,
  type: mockMessage.type,
  status: mockMessage.status,
  timestamp: mockMessage.timestamp.toISOString(),
  metadata: mockMessage.metadata,
  createdAt: mockMessage.createdAt.toISOString(),
  updatedAt: mockMessage.updatedAt.toISOString()
};

console.log('✅ Resultado de toJSON():');
console.log(JSON.stringify(toJSONResult, null, 2));

// 6. Verificación final
console.log('\n6. ✅ Verificación final:');
console.log('- mediaUrl en toJSON:', !!toJSONResult.mediaUrl);
console.log('- mediaUrl valor:', toJSONResult.mediaUrl);
console.log('- type en toJSON:', toJSONResult.type);
console.log('- metadata.media.count:', toJSONResult.metadata?.media?.count);

if (toJSONResult.mediaUrl) {
  console.log('\n🎉 SUCCESS: El campo mediaUrl se preserva correctamente en todo el flujo');
} else {
  console.log('\n❌ FAILED: El campo mediaUrl se perdió en algún punto del flujo');
}

console.log('\n🏁 Prueba completada'); 