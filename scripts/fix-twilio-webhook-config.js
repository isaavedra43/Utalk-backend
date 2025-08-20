// Script para verificar y corregir la configuración del webhook de Twilio
const twilio = require('twilio');

async function checkTwilioWebhookConfig() {
  try {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔧 Verificando configuración del webhook de Twilio...' });
    
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
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Configuración actual del webhook:' });
      console.log(JSON.stringify(webhookConfig, null, 2));
    } catch (error) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⚠️ No se pudo obtener la configuración del webhook:', error.message });
    }
    
    // Verificar si hay un webhook configurado para el número
    try {
      const phoneNumbers = await client.incomingPhoneNumbers.list();
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📱 Números de teléfono configurados:' });
      
      for (const phoneNumber of phoneNumbers) {
        logger.info('\n  Número: ${phoneNumber.phoneNumber}', { category: 'AUTO_MIGRATED' });
        logger.info('SID: ${phoneNumber.sid}', { category: 'AUTO_MIGRATED' });
        logger.info('Webhook URL: ${phoneNumber.webhookUrl || 'No configurado'}', { category: 'AUTO_MIGRATED' });
        logger.info('Webhook Method: ${phoneNumber.webhookMethod || 'No configurado'}', { category: 'AUTO_MIGRATED' });
        
        if (phoneNumber.webhookUrl) {
          logger.info('Webhook configurado', { category: 'AUTO_MIGRATED' });
        } else {
          logger.info('❌ Webhook NO configurado', { category: 'AUTO_MIGRATED' });
        }
      }
    } catch (error) {
      console.error('❌ Error obteniendo números de teléfono:', error.message);
    }
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🔧 Para corregir el problema:' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '1. Ve a la consola de Twilio' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '2. Navega a Messaging > Settings > Webhook Configuration' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '3. Configura la URL del webhook: https://utalk-backend-production.up.railway.app/webhook/twilio' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '4. Asegúrate de que esté configurado para recibir media' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '5. Guarda la configuración' });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar la verificación
checkTwilioWebhookConfig().then(() => {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n✅ Verificación completada' });
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
}); 