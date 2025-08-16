// Script para verificar y corregir la configuración del webhook de Twilio
const twilio = require('twilio');

async function checkTwilioWebhookConfig() {
  try {
    console.log('🔧 Verificando configuración del webhook de Twilio...');
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      console.error('❌ Credenciales de Twilio no configuradas');
      return;
    }
    
    const client = twilio(accountSid, authToken);
    
    // Obtener la configuración actual del webhook
    try {
      const webhookConfig = await client.messaging.v1.webhooks().fetch();
      console.log('📋 Configuración actual del webhook:');
      console.log(JSON.stringify(webhookConfig, null, 2));
    } catch (error) {
      console.log('⚠️ No se pudo obtener la configuración del webhook:', error.message);
    }
    
    // Verificar si hay un webhook configurado para el número
    try {
      const phoneNumbers = await client.incomingPhoneNumbers.list();
      console.log('\n📱 Números de teléfono configurados:');
      
      for (const phoneNumber of phoneNumbers) {
        console.log(`\n  Número: ${phoneNumber.phoneNumber}`);
        console.log(`  SID: ${phoneNumber.sid}`);
        console.log(`  Webhook URL: ${phoneNumber.webhookUrl || 'No configurado'}`);
        console.log(`  Webhook Method: ${phoneNumber.webhookMethod || 'No configurado'}`);
        
        if (phoneNumber.webhookUrl) {
          console.log(`  ✅ Webhook configurado`);
        } else {
          console.log(`  ❌ Webhook NO configurado`);
        }
      }
    } catch (error) {
      console.error('❌ Error obteniendo números de teléfono:', error.message);
    }
    
    console.log('\n🔧 Para corregir el problema:');
    console.log('1. Ve a la consola de Twilio');
    console.log('2. Navega a Messaging > Settings > Webhook Configuration');
    console.log('3. Configura la URL del webhook: https://utalk-backend-production.up.railway.app/webhook/twilio');
    console.log('4. Asegúrate de que esté configurado para recibir media');
    console.log('5. Guarda la configuración');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar la verificación
checkTwilioWebhookConfig().then(() => {
  console.log('\n✅ Verificación completada');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
}); 