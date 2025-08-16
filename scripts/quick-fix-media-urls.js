const { firestore } = require('../src/config/firebase');

async function quickFixMediaUrls() {
  try {
    console.log('🔧 Arreglando mensajes sin mediaUrl...');
    
    // Buscar mensajes de media específicos que sabemos que deberían tener mediaUrl
    // Basándome en los logs de Railway, vamos a buscar en la conversación específica
    const conversationId = 'conv_+5214773790184_+5214793176502';
    
    console.log(`📱 Procesando conversación: ${conversationId}`);
    
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
        
        // Verificar si tiene metadata con twilioSid
        const twilioSid = data.metadata?.twilioSid;
        if (twilioSid) {
          console.log(`  🔍 TwilioSid encontrado: ${twilioSid}`);
          
          // Reconstruir la URL de Twilio
          const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
          
          if (accountSid) {
            // El formato más probable es reemplazar MM por ME
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
            console.log(`  ⚠️ No se encontró TWILIO_ACCOUNT_SID`);
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
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar la corrección
quickFixMediaUrls().then(() => {
  console.log('\n✅ Corrección completada');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
}); 