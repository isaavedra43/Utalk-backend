// Script para arreglar URLs de media en producción
// Este script debe ejecutarse en el servidor de producción donde están las credenciales de Twilio

const { firestore } = require('../src/config/firebase');

async function fixMediaUrlsInProduction() {
  try {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔧 Arreglando URLs de media en producción...' });
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      console.error('❌ Credenciales de Twilio no configuradas');
      console.error('Asegúrate de que TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN estén configurados');
      return;
    }
    
    logger.info('� Account SID: ${accountSid}', { category: 'AUTO_MIGRATED' });
    
    // Procesar la conversación específica
    const conversationId = 'conv_+5214773790184_+5214793176502';
    logger.info('� Procesando conversación: ${conversationId}', { category: 'AUTO_MIGRATED' });
    
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
        
        logger.info('Mensaje de media sin URL: ${twilioSid}', { category: 'AUTO_MIGRATED' });
        
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
            
            logger.info('URL reconstruida para ${twilioSid}: ${reconstructedUrl}', { category: 'AUTO_MIGRATED' });
            totalMessagesFixed++;
          } else {
            logger.info('No se encontraron media para ${twilioSid}', { category: 'AUTO_MIGRATED' });
          }
        } catch (error) {
          console.error(`❌ Error procesando ${twilioSid}:`, error.message);
        }
      }
    }
    
    logger.info('\n Resumen:', { category: 'AUTO_MIGRATED' });
    logger.info('- Mensajes procesados: ${totalMessagesProcessed}', { category: 'AUTO_MIGRATED' });
    logger.info('- Mensajes arreglados: ${totalMessagesFixed}', { category: 'AUTO_MIGRATED' });
    
  } catch (error) {
    console.error('❌ Error en fixMediaUrlsInProduction:', error);
  }
}

// Ejecutar el script
fixMediaUrlsInProduction().then(() => {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Script completado' });
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
}); 