const { firestore } = require('../src/config/firebase');
const Message = require('../src/models/Message');

async function debugMediaUrl() {
  try {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔍 DEBUG: Verificando mensajes con media...' });
    
    // Verificar que firestore esté disponible
    if (!firestore) {
      logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Firestore no está disponible');
      return;
    }
    
    // Buscar una conversación con mensajes de media
    const conversationsSnapshot = await firestore.collection('conversations').limit(5).get();
    
    for (const convDoc of conversationsSnapshot.docs) {
      const conversationId = convDoc.id;
      logger.info('\n� Conversación: ${conversationId}', { category: 'AUTO_MIGRATED' });
      
      // Buscar mensajes de media en esta conversación
      const messagesSnapshot = await firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .where('type', '==', 'media')
        .limit(3)
        .get();
      
      if (messagesSnapshot.empty) {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  ❌ No hay mensajes de media' });
        continue;
      }
      
      logger.info('Encontrados ${messagesSnapshot.size} mensajes de media', { category: 'AUTO_MIGRATED' });
      
      for (const msgDoc of messagesSnapshot.docs) {
        const rawData = msgDoc.data();
        logger.info('\n  � Mensaje ID: ${msgDoc.id}', { category: 'AUTO_MIGRATED' });
        logger.info('Tipo: ${rawData.type}', { category: 'AUTO_MIGRATED' });
        logger.info('Contenido: ${rawData.content || '(vacío)'}', { category: 'AUTO_MIGRATED' });
        logger.info('MediaUrl (raw): ${rawData.mediaUrl || 'NULL'}', { category: 'AUTO_MIGRATED' });
        logger.info('Timestamp: ${rawData.timestamp}', { category: 'AUTO_MIGRATED' });
        
        // Crear instancia de Message y verificar toJSON()
        const message = new Message({ id: msgDoc.id, ...rawData });
        const jsonData = message.toJSON();
        
        logger.info('MediaUrl (toJSON): ${jsonData.mediaUrl || 'NULL'}', { category: 'AUTO_MIGRATED' });
        logger.info('Dirección: ${jsonData.direction}', { category: 'AUTO_MIGRATED' });
        logger.info('Sender: ${jsonData.senderIdentifier}', { category: 'AUTO_MIGRATED' });
        logger.info('Recipient: ${jsonData.recipientIdentifier}', { category: 'AUTO_MIGRATED' });
        
        // Verificar si la URL original es de Twilio
        if (rawData.mediaUrl && rawData.mediaUrl.includes('api.twilio.com')) {
          logger.info('URL de Twilio detectada', { category: 'AUTO_MIGRATED' });
          
          // Verificar si se está convirtiendo correctamente
          if (jsonData.mediaUrl && jsonData.mediaUrl.includes('proxy-public')) {
            logger.info('URL convertida a proxy público', { category: 'AUTO_MIGRATED' });
          } else {
            logger.info('❌ URL NO convertida a proxy público', { category: 'AUTO_MIGRATED' });
          }
        } else if (rawData.mediaUrl && rawData.mediaUrl.includes('firebase')) {
          logger.info('URL de Firebase detectada', { category: 'AUTO_MIGRATED' });
          
          if (jsonData.mediaUrl && jsonData.mediaUrl.includes('proxy-file-public')) {
            logger.info('URL convertida a proxy público', { category: 'AUTO_MIGRATED' });
          } else {
            logger.info('❌ URL NO convertida a proxy público', { category: 'AUTO_MIGRATED' });
          }
        } else if (!rawData.mediaUrl) {
          logger.info('❌ NO hay mediaUrl en la base de datos', { category: 'AUTO_MIGRATED' });
        }
      }
    }
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en debug:', error);
  }
}

// Ejecutar debug
debugMediaUrl().then(() => {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n✅ Debug completado' });
  process.exit(0);
}).catch(error => {
  logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error fatal:', error);
  process.exit(1);
}); 