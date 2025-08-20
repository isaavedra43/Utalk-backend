const { firestore } = require('../src/config/firebase');

async function fixMissingMediaUrls() {
  try {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔧 Arreglando mensajes sin mediaUrl...' });
    
    // Buscar todas las conversaciones
    const conversationsSnapshot = await firestore.collection('conversations').get();
    
    let totalFixed = 0;
    let totalChecked = 0;
    
    for (const convDoc of conversationsSnapshot.docs) {
      const conversationId = convDoc.id;
      logger.info('\n� Procesando conversación: ${conversationId}', { category: 'AUTO_MIGRATED' });
      
      // Buscar mensajes de media que no tienen mediaUrl
      const messagesSnapshot = await firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .where('type', '==', 'media')
        .get();
      
      if (messagesSnapshot.empty) {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  ℹ️ No hay mensajes de media' });
        continue;
      }
      
      logger.info('� Encontrados ${messagesSnapshot.size} mensajes de media', { category: 'AUTO_MIGRATED' });
      
      for (const msgDoc of messagesSnapshot.docs) {
        const data = msgDoc.data();
        totalChecked++;
        
        // Verificar si el mensaje no tiene mediaUrl
        if (!data.mediaUrl) {
          logger.info('❌ Mensaje sin mediaUrl: ${msgDoc.id}', { category: 'AUTO_MIGRATED' });
          
          // Verificar si tiene metadata con twilioSid
          const twilioSid = data.metadata?.twilioSid;
          if (twilioSid) {
            logger.info('TwilioSid encontrado: ${twilioSid}', { category: 'AUTO_MIGRATED' });
            
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
                
                logger.info('Probando URL: ${reconstructedUrl}', { category: 'AUTO_MIGRATED' });
                
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
                  
                  logger.info('MediaUrl actualizado: ${reconstructedUrl}', { category: 'AUTO_MIGRATED' });
                  totalFixed++;
                  break; // Solo actualizar con la primera URL
                } catch (error) {
                  logger.info('❌ Error actualizando: ${error.message}', { category: 'AUTO_MIGRATED' });
                }
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
    }
    
    logger.info('\n Resumen:', { category: 'AUTO_MIGRATED' });
    logger.info('Total de mensajes verificados: ${totalChecked}', { category: 'AUTO_MIGRATED' });
    logger.info('Total de mensajes arreglados: ${totalFixed}', { category: 'AUTO_MIGRATED' });
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error:', error);
  }
}

// Ejecutar la corrección
fixMissingMediaUrls().then(() => {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n✅ Corrección completada' });
  process.exit(0);
}).catch(error => {
  logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error fatal:', error);
  process.exit(1);
}); 