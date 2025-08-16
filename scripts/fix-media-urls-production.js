// Script para arreglar URLs de media en producción
// Este script debe ejecutarse en el servidor de producción donde están las credenciales de Twilio

const { firestore } = require('../src/config/firebase');

async function fixMediaUrlsInProduction() {
  try {
    console.log('🔧 Arreglando URLs de media en producción...');
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      console.error('❌ Credenciales de Twilio no configuradas');
      console.error('Asegúrate de que TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN estén configurados');
      return;
    }
    
    console.log(`🔑 Account SID: ${accountSid}`);
    
    // Procesar la conversación específica
    const conversationId = 'conv_+5214773790184_+5214793176502';
    console.log(`📱 Procesando conversación: ${conversationId}`);
    
    // Obtener todos los mensajes de la conversación
    const messagesSnapshot = await firestore
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .get();
    
    let totalMessagesProcessed = 0;
    let totalMessagesFixed = 0;
    
    for (const messageDoc of messagesSnapshot.docs) {
      const messageData = messageDoc.data();
      totalMessagesProcessed++;
      
      // Verificar si es un mensaje de media sin URL
      if (messageData.type === 'media' && !messageData.mediaUrl && messageData.metadata?.twilio?.sid) {
        const twilioSid = messageData.metadata.twilio.sid;
        
        console.log(`🔍 Mensaje de media sin URL: ${twilioSid}`);
        
        try {
          // Usar la API de Twilio para obtener los media reales
          const twilio = require('twilio');
          const client = twilio(accountSid, authToken);
          
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
    
    console.log(`\n📊 Resumen:`);
    console.log(`- Mensajes procesados: ${totalMessagesProcessed}`);
    console.log(`- Mensajes arreglados: ${totalMessagesFixed}`);
    
  } catch (error) {
    console.error('❌ Error en fixMediaUrlsInProduction:', error);
  }
}

// Ejecutar el script
fixMediaUrlsInProduction().then(() => {
  console.log('✅ Script completado');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
}); 