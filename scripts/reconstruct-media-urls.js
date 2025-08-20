// Script para reconstruir las URLs de media basándose en los SIDs de Twilio
const { firestore } = require('../src/config/firebase');

async function reconstructMediaUrls() {
  try {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔧 Reconstruyendo URLs de media...' });
    
    const conversationId = 'conv_+5214773790184_+5214793176502';
    const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
    
    if (!accountSid) {
      logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ TWILIO_ACCOUNT_SID no configurado');
      return;
    }
    
    logger.info('� Procesando conversación: ${conversationId}', { category: 'AUTO_MIGRATED' });
    logger.info('� Account SID: ${accountSid}', { category: 'AUTO_MIGRATED' });
    
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
        
        // Obtener el SID de Twilio
        const twilioSid = data.metadata?.twilio?.sid || data.metadata?.twilioSid;
        
        if (twilioSid) {
          logger.info('Twilio SID encontrado: ${twilioSid}', { category: 'AUTO_MIGRATED' });
          
          // Reconstruir la URL de Twilio
          // Formato: https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/MM123/Media/ME123
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
          logger.info('No se encontró twilioSid en metadata', { category: 'AUTO_MIGRATED' });
        }
      } else {
        logger.info('Mensaje ya tiene mediaUrl: ${data.mediaUrl.substring(0, 50)}...', { category: 'AUTO_MIGRATED' });
      }
    }
    
    logger.info('\n Resumen:', { category: 'AUTO_MIGRATED' });
    logger.info('Total de mensajes verificados: ${messagesSnapshot.size}', { category: 'AUTO_MIGRATED' });
    logger.info('Total de mensajes arreglados: ${fixed}', { category: 'AUTO_MIGRATED' });
    
    if (fixed > 0) {
      logger.info('\n� ¡${fixed} mensajes han sido arreglados!', { category: 'AUTO_MIGRATED' });
      logger.info('Ahora deberías poder ver las imágenes en el frontend.', { category: 'AUTO_MIGRATED' });
    }
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error:', error);
  }
}

// Ejecutar la reconstrucción
reconstructMediaUrls().then(() => {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n✅ Reconstrucción completada' });
  process.exit(0);
}).catch(error => {
  logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error fatal:', error);
  process.exit(1);
}); 