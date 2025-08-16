// Script para reconstruir todas las URLs de media basándose en los SIDs de Twilio
const { firestore } = require('../src/config/firebase');

async function fixAllMediaUrls() {
  try {
    console.log('🔧 Reconstruyendo todas las URLs de media...');
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
    
    if (!accountSid) {
      console.error('❌ TWILIO_ACCOUNT_SID no configurado');
      return;
    }
    
    console.log(`🔑 Account SID: ${accountSid}`);
    
    // Obtener todas las conversaciones
    const conversationsSnapshot = await firestore.collection('conversations').get();
    
    let totalMessagesProcessed = 0;
    let totalMessagesFixed = 0;
    
    for (const conversationDoc of conversationsSnapshot.docs) {
      const conversationId = conversationDoc.id;
      console.log(`📱 Procesando conversación: ${conversationId}`);
      
      // Obtener todos los mensajes de la conversación
      const messagesSnapshot = await firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .get();
      
      for (const messageDoc of messagesSnapshot.docs) {
        const messageData = messageDoc.data();
        totalMessagesProcessed++;
        
        // Verificar si es un mensaje de media sin URL
        if (messageData.type === 'media' && !messageData.mediaUrl && messageData.metadata?.twilio?.sid) {
          const twilioSid = messageData.metadata.twilio.sid;
          
          // Extraer el MediaSid del SID del mensaje (esto es una aproximación)
          // En realidad necesitamos obtener el MediaSid real de Twilio
          console.log(`🔍 Mensaje de media sin URL: ${twilioSid}`);
          
          try {
            // Intentar obtener el MediaSid real de Twilio
            const twilio = require('twilio');
            const client = twilio(accountSid, process.env.TWILIO_AUTH_TOKEN);
            
            // Obtener los media asociados al mensaje
            const mediaList = await client.messages(twilioSid).media.list();
            
            if (mediaList.length > 0) {
              const mediaSid = mediaList[0].sid;
              const reconstructedUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${twilioSid}/Media/${mediaSid}`;
              
              // Actualizar el mensaje con la URL reconstruida
              await messageDoc.ref.update({
                mediaUrl: reconstructedUrl,
                'metadata.media.urls': [reconstructedUrl],
                'metadata.media.count': mediaList.length,
                'metadata.media.processed': mediaList.map(m => ({
                  sid: m.sid,
                  contentType: m.contentType,
                  url: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${twilioSid}/Media/${m.sid}`
                }))
              });
              
              console.log(`✅ URL reconstruida para ${twilioSid}: ${reconstructedUrl}`);
              totalMessagesFixed++;
            } else {
              console.log(`⚠️ No se encontraron media para ${twilioSid}`);
            }
          } catch (error) {
            console.error(`❌ Error procesando ${twilioSid}:`, error.message);
          }
        }
      }
    }
    
    console.log(`\n📊 Resumen:`);
    console.log(`- Mensajes procesados: ${totalMessagesProcessed}`);
    console.log(`- Mensajes arreglados: ${totalMessagesFixed}`);
    console.log(`- Conversaciones procesadas: ${conversationsSnapshot.docs.length}`);
    
  } catch (error) {
    console.error('❌ Error en fixAllMediaUrls:', error);
  }
}

// Ejecutar el script
fixAllMediaUrls().then(() => {
  console.log('✅ Script completado');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
}); 