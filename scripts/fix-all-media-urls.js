// Script para reconstruir todas las URLs de media basándose en los SIDs de Twilio
const { firestore } = require('../src/config/firebase');

async function fixAllMediaUrls() {
  try {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔧 Reconstruyendo todas las URLs de media...' });
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
    
    if (!accountSid) {
      logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ TWILIO_ACCOUNT_SID no configurado');
      return;
    }
    
    logger.info('� Account SID: ${accountSid}', { category: 'AUTO_MIGRATED' });
    
    // Obtener todas las conversaciones
    const conversationsSnapshot = await firestore.collection('conversations').get();
    
    let totalMessagesProcessed = 0;
    let totalMessagesFixed = 0;
    
    for (const conversationDoc of conversationsSnapshot.docs) {
      const conversationId = conversationDoc.id;
      logger.info('� Procesando conversación: ${conversationId}', { category: 'AUTO_MIGRATED' });
      
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
          logger.info('Mensaje de media sin URL: ${twilioSid}', { category: 'AUTO_MIGRATED' });
          
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
              
              logger.info('URL reconstruida para ${twilioSid}: ${reconstructedUrl}', { category: 'AUTO_MIGRATED' });
              totalMessagesFixed++;
            } else {
              logger.info('No se encontraron media para ${twilioSid}', { category: 'AUTO_MIGRATED' });
            }
          } catch (error) {
            logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: `❌ Error procesando ${twilioSid}:`, error.message);
          }
        }
      }
    }
    
    logger.info('\n Resumen:', { category: 'AUTO_MIGRATED' });
    logger.info('- Mensajes procesados: ${totalMessagesProcessed}', { category: 'AUTO_MIGRATED' });
    logger.info('- Mensajes arreglados: ${totalMessagesFixed}', { category: 'AUTO_MIGRATED' });
    logger.info('- Conversaciones procesadas: ${conversationsSnapshot.docs.length}', { category: 'AUTO_MIGRATED' });
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en fixAllMediaUrls:', error);
  }
}

// Ejecutar el script
fixAllMediaUrls().then(() => {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Script completado' });
  process.exit(0);
}).catch((error) => {
  logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error:', error);
  process.exit(1);
}); 