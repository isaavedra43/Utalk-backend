// Script para reconstruir las URLs de media basándose en los SIDs de Twilio
const { firestore } = require('../src/config/firebase');

async function reconstructMediaUrls() {
  try {
    console.log('🔧 Reconstruyendo URLs de media...');
    
    const conversationId = 'conv_+5214773790184_+5214793176502';
    const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
    
    if (!accountSid) {
      console.error('❌ TWILIO_ACCOUNT_SID no configurado');
      return;
    }
    
    console.log(`📱 Procesando conversación: ${conversationId}`);
    console.log(`🔑 Account SID: ${accountSid}`);
    
    // Buscar mensajes de media que no tienen mediaUrl
    const messagesSnapshot = await firestore
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .where('type', '==', 'media')
      .get();
    
    if (messagesSnapshot.empty) {
      console.log('  ℹ️ No hay mensajes de media en esta conversación');
      return;
    }
    
    console.log(`  📄 Encontrados ${messagesSnapshot.size} mensajes de media`);
    
    let fixed = 0;
    
    for (const msgDoc of messagesSnapshot.docs) {
      const data = msgDoc.data();
      
      // Verificar si el mensaje no tiene mediaUrl
      if (!data.mediaUrl) {
        console.log(`  ❌ Mensaje sin mediaUrl: ${msgDoc.id}`);
        
        // Obtener el SID de Twilio
        const twilioSid = data.metadata?.twilio?.sid || data.metadata?.twilioSid;
        
        if (twilioSid) {
          console.log(`  🔍 Twilio SID encontrado: ${twilioSid}`);
          
          // Reconstruir la URL de Twilio
          // Formato: https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/MM123/Media/ME123
          const mediaSid = twilioSid.replace('MM', 'ME');
          const reconstructedUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${twilioSid}/Media/${mediaSid}`;
          
          console.log(`  🔧 Reconstruyendo URL: ${reconstructedUrl}`);
          
          try {
            await firestore
              .collection('conversations')
              .doc(conversationId)
              .collection('messages')
              .doc(msgDoc.id)
              .update({
                mediaUrl: reconstructedUrl,
                updatedAt: new Date()
              });
            
            console.log(`  ✅ MediaUrl actualizado: ${reconstructedUrl}`);
            fixed++;
          } catch (error) {
            console.log(`  ❌ Error actualizando: ${error.message}`);
          }
        } else {
          console.log(`  ⚠️ No se encontró twilioSid en metadata`);
        }
      } else {
        console.log(`  ✅ Mensaje ya tiene mediaUrl: ${data.mediaUrl.substring(0, 50)}...`);
      }
    }
    
    console.log(`\n📊 Resumen:`);
    console.log(`  Total de mensajes verificados: ${messagesSnapshot.size}`);
    console.log(`  Total de mensajes arreglados: ${fixed}`);
    
    if (fixed > 0) {
      console.log(`\n🎉 ¡${fixed} mensajes han sido arreglados!`);
      console.log(`   Ahora deberías poder ver las imágenes en el frontend.`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar la reconstrucción
reconstructMediaUrls().then(() => {
  console.log('\n✅ Reconstrucción completada');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
}); 