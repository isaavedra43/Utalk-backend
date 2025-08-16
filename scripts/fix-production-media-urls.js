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
    console.log('🔧 Arreglando mensajes sin mediaUrl en producción...');
    
    // Buscar en la conversación específica que está fallando
    const conversationId = 'conv_+5214773790184_+5214793176502';
    
    console.log(`📱 Procesando conversación: ${conversationId}`);
    
    // Buscar mensajes de media que no tienen mediaUrl
    const messagesSnapshot = await db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .where('type', '==', 'media')
      .get();
    
    if (messagesSnapshot.empty) {
      console.log('  ℹ️ No hay mensajes de media en esta conversación');
      return;
    }
    
    console.log(`  📄 Encontrados ${messagesSnapshot.size} mensajes de media`);
    
    let fixed = 0;
    
    for (const msgDoc of messagesSnapshot.docs) {
      const data = msgDoc.data();
      
      // Verificar si el mensaje no tiene mediaUrl
      if (!data.mediaUrl) {
        console.log(`  ❌ Mensaje sin mediaUrl: ${msgDoc.id}`);
        
        // Verificar si tiene metadata con twilioSid
        const twilioSid = data.metadata?.twilioSid;
        if (twilioSid) {
          console.log(`  🔍 TwilioSid encontrado: ${twilioSid}`);
          
          // Reconstruir la URL de Twilio
          const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
          
          if (accountSid) {
            // El formato más probable es reemplazar MM por ME
            const mediaSid = twilioSid.replace('MM', 'ME');
            const reconstructedUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${twilioSid}/Media/${mediaSid}`;
            
            console.log(`  🔧 Reconstruyendo URL: ${reconstructedUrl}`);
            
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
              
              console.log(`  ✅ MediaUrl actualizado: ${reconstructedUrl}`);
              fixed++;
            } catch (error) {
              console.log(`  ❌ Error actualizando: ${error.message}`);
            }
          } else {
            console.log(`  ⚠️ No se encontró TWILIO_ACCOUNT_SID`);
          }
        } else {
          console.log(`  ⚠️ No se encontró twilioSid en metadata`);
        }
      } else {
        console.log(`  ✅ Mensaje ya tiene mediaUrl: ${data.mediaUrl.substring(0, 50)}...`);
      }
    }
    
    console.log(`\n📊 Resumen:`);
    console.log(`  Total de mensajes verificados: ${messagesSnapshot.size}`);
    console.log(`  Total de mensajes arreglados: ${fixed}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar la corrección
fixProductionMediaUrls().then(() => {
  console.log('\n✅ Corrección completada');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
}); 