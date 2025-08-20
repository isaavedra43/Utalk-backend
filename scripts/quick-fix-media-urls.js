const { firestore } = require('../src/config/firebase');

async function quickFixMediaUrls() {
  try {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔧 Arreglando mensajes sin mediaUrl...' });
    
    // Buscar mensajes de media específicos que sabemos que deberían tener mediaUrl
    // Basándome en los logs de Railway, vamos a buscar en la conversación específica
    const conversationId = 'conv_+5214773790184_+5214793176502';
    
    logger.info('� Procesando conversación: ${conversationId}', { category: 'AUTO_MIGRATED' });
    
    // Buscar mensajes de media que no tienen mediaUrl
    const messagesSnapshot = await firestore
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .where('type', '==', 'media')
      .get();
    
    if (messagesSnapshot.empty) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  ℹ️ No hay mensajes de media en esta conversación' });
      return;
    }
    
    logger.info('� Encontrados ${messagesSnapshot.size} mensajes de media', { category: 'AUTO_MIGRATED' });
    
    let fixed = 0;
    
    for (const msgDoc of messagesSnapshot.docs) {
      const data = msgDoc.data();
      
      // Verificar si el mensaje no tiene mediaUrl
      if (!data.mediaUrl) {
        logger.info('❌ Mensaje sin mediaUrl: ${msgDoc.id}', { category: 'AUTO_MIGRATED' });
        
        // Verificar si tiene metadata con twilioSid
        const twilioSid = data.metadata?.twilioSid;
        if (twilioSid) {
          logger.info('TwilioSid encontrado: ${twilioSid}', { category: 'AUTO_MIGRATED' });
          
          // Reconstruir la URL de Twilio
          const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
          
          if (accountSid) {
            // El formato más probable es reemplazar MM por ME
            const mediaSid = twilioSid.replace('MM', 'ME');
            const reconstructedUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${twilioSid}/Media/${mediaSid}`;
            
            logger.info('Reconstruyendo URL: ${reconstructedUrl}', { category: 'AUTO_MIGRATED' });
            
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
              
              logger.info('MediaUrl actualizado: ${reconstructedUrl}', { category: 'AUTO_MIGRATED' });
              fixed++;
            } catch (error) {
              logger.info('❌ Error actualizando: ${error.message}', { category: 'AUTO_MIGRATED' });
            }
          } else {
            logger.info('No se encontró TWILIO_ACCOUNT_SID', { category: 'AUTO_MIGRATED' });
          }
        } else {
          logger.info('No se encontró twilioSid en metadata', { category: 'AUTO_MIGRATED' });
        }
      } else {
        logger.info('Mensaje ya tiene mediaUrl: ${data.mediaUrl.substring(0, 50)}...', { category: 'AUTO_MIGRATED' });
      }
    }
    
    logger.info('\n Resumen:', { category: 'AUTO_MIGRATED' });
    logger.info('Total de mensajes verificados: ${messagesSnapshot.size}', { category: 'AUTO_MIGRATED' });
    logger.info('Total de mensajes arreglados: ${fixed}', { category: 'AUTO_MIGRATED' });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar la corrección
quickFixMediaUrls().then(() => {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n✅ Corrección completada' });
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
}); 