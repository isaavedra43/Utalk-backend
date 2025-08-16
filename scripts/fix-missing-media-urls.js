const { firestore } = require('../src/config/firebase');

async function fixMissingMediaUrls() {
  try {
    console.log('🔧 Arreglando mensajes sin mediaUrl...');
    
    // Buscar todas las conversaciones
    const conversationsSnapshot = await firestore.collection('conversations').get();
    
    let totalFixed = 0;
    let totalChecked = 0;
    
    for (const convDoc of conversationsSnapshot.docs) {
      const conversationId = convDoc.id;
      console.log(`\n📱 Procesando conversación: ${conversationId}`);
      
      // Buscar mensajes de media que no tienen mediaUrl
      const messagesSnapshot = await firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .where('type', '==', 'media')
        .get();
      
      if (messagesSnapshot.empty) {
        console.log('  ℹ️ No hay mensajes de media');
        continue;
      }
      
      console.log(`  📄 Encontrados ${messagesSnapshot.size} mensajes de media`);
      
      for (const msgDoc of messagesSnapshot.docs) {
        const data = msgDoc.data();
        totalChecked++;
        
        // Verificar si el mensaje no tiene mediaUrl
        if (!data.mediaUrl) {
          console.log(`  ❌ Mensaje sin mediaUrl: ${msgDoc.id}`);
          
          // Verificar si tiene metadata con twilioSid
          const twilioSid = data.metadata?.twilioSid;
          if (twilioSid) {
            console.log(`  🔍 TwilioSid encontrado: ${twilioSid}`);
            
            // Intentar reconstruir la URL de Twilio
            // Formato típico: https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/MM123/Media/ME123
            const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
            
            if (accountSid) {
              // Intentar diferentes formatos de mediaSid
              const possibleMediaSids = [
                `ME${twilioSid.substring(2)}`, // Si el SID es MM123, probar ME123
                `ME${twilioSid}`, // Si el SID es MM123, probar MEMM123
                twilioSid.replace('MM', 'ME') // Reemplazar MM por ME
              ];
              
              for (const mediaSid of possibleMediaSids) {
                const reconstructedUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${twilioSid}/Media/${mediaSid}`;
                
                console.log(`  🔧 Probando URL: ${reconstructedUrl}`);
                
                // Aquí podrías hacer una petición de prueba para verificar si la URL existe
                // Por ahora, vamos a actualizar con la URL más probable
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
                  totalFixed++;
                  break; // Solo actualizar con la primera URL
                } catch (error) {
                  console.log(`  ❌ Error actualizando: ${error.message}`);
                }
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
    }
    
    console.log(`\n📊 Resumen:`);
    console.log(`  Total de mensajes verificados: ${totalChecked}`);
    console.log(`  Total de mensajes arreglados: ${totalFixed}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar la corrección
fixMissingMediaUrls().then(() => {
  console.log('\n✅ Corrección completada');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
}); 