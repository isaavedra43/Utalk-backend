// Usar la configuración de Firebase del proyecto
const { firestore } = require('../src/config/firebase');

async function checkMediaUrls() {
  try {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔍 Verificando mensajes con media en la base de datos...' });
    
    // Buscar conversaciones
    const conversationsSnapshot = await firestore.collection('conversations').limit(3).get();
    
    for (const convDoc of conversationsSnapshot.docs) {
      const conversationId = convDoc.id;
      logger.info('\n� Conversación: ${conversationId}', { category: 'AUTO_MIGRATED' });
      
      // Buscar mensajes de media
      const messagesSnapshot = await firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .where('type', '==', 'media')
        .limit(5)
        .get();
      
      if (messagesSnapshot.empty) {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  ❌ No hay mensajes de media' });
        continue;
      }
      
      logger.info('Encontrados ${messagesSnapshot.size} mensajes de media', { category: 'AUTO_MIGRATED' });
      
      for (const msgDoc of messagesSnapshot.docs) {
        const data = msgDoc.data();
        logger.info('\n  � Mensaje ID: ${msgDoc.id}', { category: 'AUTO_MIGRATED' });
        logger.info('Tipo: ${data.type}', { category: 'AUTO_MIGRATED' });
        logger.info('Contenido: ${data.content || '(vacío)'}', { category: 'AUTO_MIGRATED' });
        logger.info('MediaUrl: ${data.mediaUrl || 'NULL'}', { category: 'AUTO_MIGRATED' });
        logger.info('Timestamp: ${data.timestamp}', { category: 'AUTO_MIGRATED' });
        logger.info('Direction: ${data.direction}', { category: 'AUTO_MIGRATED' });
        logger.info('Sender: ${data.senderIdentifier}', { category: 'AUTO_MIGRATED' });
        logger.info('Recipient: ${data.recipientIdentifier}', { category: 'AUTO_MIGRATED' });
        
        if (data.mediaUrl) {
          if (data.mediaUrl.includes('api.twilio.com')) {
            logger.info('URL de Twilio detectada', { category: 'AUTO_MIGRATED' });
          } else if (data.mediaUrl.includes('firebase')) {
            logger.info('URL de Firebase detectada', { category: 'AUTO_MIGRATED' });
          } else if (data.mediaUrl.includes('proxy-public')) {
            logger.info('URL de proxy público detectada', { category: 'AUTO_MIGRATED' });
          } else {
            logger.info('❓ URL desconocida: ${data.mediaUrl.substring(0, 50)}...', { category: 'AUTO_MIGRATED' });
          }
        } else {
          logger.info('❌ NO hay mediaUrl', { category: 'AUTO_MIGRATED' });
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkMediaUrls().then(() => {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n✅ Verificación completada' });
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
}); 