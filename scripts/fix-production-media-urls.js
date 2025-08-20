// Script para arreglar mensajes sin mediaUrl en producción
// Este script debe ejecutarse en el servidor de producción

const admin = require('firebase-admin');

// Configuración para producción
const serviceAccount = {
  "type": "service_account",
  "project_id": process.env.FIREBASE_PROJECT_ID,
  "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
  "private_key": process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  "client_email": process.env.FIREBASE_CLIENT_EMAIL,
  "client_id": process.env.FIREBASE_CLIENT_ID,
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": process.env.FIREBASE_CLIENT_CERT_URL
};

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixProductionMediaUrls() {
  try {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔧 Arreglando mensajes sin mediaUrl en producción...' });
    
    // Buscar en la conversación específica que está fallando
    const conversationId = 'conv_+5214773790184_+5214793176502';
    
    logger.info('� Procesando conversación: ${conversationId}', { category: 'AUTO_MIGRATED' });
    
    // Buscar mensajes de media que no tienen mediaUrl
    const messagesSnapshot = await db
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
              await db
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
fixProductionMediaUrls().then(() => {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n✅ Corrección completada' });
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
}); 