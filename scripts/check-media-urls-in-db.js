// Usar la configuración de Firebase del proyecto
const { firestore } = require('../src/config/firebase');

async function checkMediaUrls() {
  try {
    console.log('🔍 Verificando mensajes con media en la base de datos...');
    
    // Buscar conversaciones
    const conversationsSnapshot = await firestore.collection('conversations').limit(3).get();
    
    for (const convDoc of conversationsSnapshot.docs) {
      const conversationId = convDoc.id;
      console.log(`\n📱 Conversación: ${conversationId}`);
      
      // Buscar mensajes de media
      const messagesSnapshot = await firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .where('type', '==', 'media')
        .limit(5)
        .get();
      
      if (messagesSnapshot.empty) {
        console.log('  ❌ No hay mensajes de media');
        continue;
      }
      
      console.log(`  ✅ Encontrados ${messagesSnapshot.size} mensajes de media`);
      
      for (const msgDoc of messagesSnapshot.docs) {
        const data = msgDoc.data();
        console.log(`\n  📄 Mensaje ID: ${msgDoc.id}`);
        console.log(`     Tipo: ${data.type}`);
        console.log(`     Contenido: ${data.content || '(vacío)'}`);
        console.log(`     MediaUrl: ${data.mediaUrl || 'NULL'}`);
        console.log(`     Timestamp: ${data.timestamp}`);
        console.log(`     Direction: ${data.direction}`);
        console.log(`     Sender: ${data.senderIdentifier}`);
        console.log(`     Recipient: ${data.recipientIdentifier}`);
        
        if (data.mediaUrl) {
          if (data.mediaUrl.includes('api.twilio.com')) {
            console.log(`     ✅ URL de Twilio detectada`);
          } else if (data.mediaUrl.includes('firebase')) {
            console.log(`     ✅ URL de Firebase detectada`);
          } else if (data.mediaUrl.includes('proxy-public')) {
            console.log(`     ✅ URL de proxy público detectada`);
          } else {
            console.log(`     ❓ URL desconocida: ${data.mediaUrl.substring(0, 50)}...`);
          }
        } else {
          console.log(`     ❌ NO hay mediaUrl`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkMediaUrls().then(() => {
  console.log('\n✅ Verificación completada');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
}); 