const { firestore } = require('../src/config/firebase');
const Message = require('../src/models/Message');

async function debugMediaUrl() {
  try {
    console.log('🔍 DEBUG: Verificando mensajes con media...');
    
    // Verificar que firestore esté disponible
    if (!firestore) {
      console.error('❌ Firestore no está disponible');
      return;
    }
    
    // Buscar una conversación con mensajes de media
    const conversationsSnapshot = await firestore.collection('conversations').limit(5).get();
    
    for (const convDoc of conversationsSnapshot.docs) {
      const conversationId = convDoc.id;
      console.log(`\n📱 Conversación: ${conversationId}`);
      
      // Buscar mensajes de media en esta conversación
      const messagesSnapshot = await firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .where('type', '==', 'media')
        .limit(3)
        .get();
      
      if (messagesSnapshot.empty) {
        console.log('  ❌ No hay mensajes de media');
        continue;
      }
      
      console.log(`  ✅ Encontrados ${messagesSnapshot.size} mensajes de media`);
      
      for (const msgDoc of messagesSnapshot.docs) {
        const rawData = msgDoc.data();
        console.log(`\n  📄 Mensaje ID: ${msgDoc.id}`);
        console.log(`     Tipo: ${rawData.type}`);
        console.log(`     Contenido: ${rawData.content || '(vacío)'}`);
        console.log(`     MediaUrl (raw): ${rawData.mediaUrl || 'NULL'}`);
        console.log(`     Timestamp: ${rawData.timestamp}`);
        
        // Crear instancia de Message y verificar toJSON()
        const message = new Message({ id: msgDoc.id, ...rawData });
        const jsonData = message.toJSON();
        
        console.log(`     MediaUrl (toJSON): ${jsonData.mediaUrl || 'NULL'}`);
        console.log(`     Dirección: ${jsonData.direction}`);
        console.log(`     Sender: ${jsonData.senderIdentifier}`);
        console.log(`     Recipient: ${jsonData.recipientIdentifier}`);
        
        // Verificar si la URL original es de Twilio
        if (rawData.mediaUrl && rawData.mediaUrl.includes('api.twilio.com')) {
          console.log(`     ✅ URL de Twilio detectada`);
          
          // Verificar si se está convirtiendo correctamente
          if (jsonData.mediaUrl && jsonData.mediaUrl.includes('proxy-public')) {
            console.log(`     ✅ URL convertida a proxy público`);
          } else {
            console.log(`     ❌ URL NO convertida a proxy público`);
          }
        } else if (rawData.mediaUrl && rawData.mediaUrl.includes('firebase')) {
          console.log(`     ✅ URL de Firebase detectada`);
          
          if (jsonData.mediaUrl && jsonData.mediaUrl.includes('proxy-file-public')) {
            console.log(`     ✅ URL convertida a proxy público`);
          } else {
            console.log(`     ❌ URL NO convertida a proxy público`);
          }
        } else if (!rawData.mediaUrl) {
          console.log(`     ❌ NO hay mediaUrl en la base de datos`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error en debug:', error);
  }
}

// Ejecutar debug
debugMediaUrl().then(() => {
  console.log('\n✅ Debug completado');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
}); 