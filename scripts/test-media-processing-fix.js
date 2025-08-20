/**
 * 🧪 SCRIPT DE PRUEBA: Corrección de Procesamiento de Media
 * 
 * Prueba específicamente la corrección del error:
 * "Error procesando media individual: Cannot read properties of undefined (reading 'error')"
 * 
 * @author Backend Team
 * @version 1.0.0
 */

const MessageService = require('../src/services/MessageService');

async function testMediaProcessing() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 Probando procesamiento de media...\n' });

  // Simular webhook data con media
  const webhookData = {
    From: '+5214773790184',
    To: '+5214793176502',
    MessageSid: 'MM898d9f335c70efa325cc1308a7ac8e5c',
    Body: '',
    NumMedia: '1',
    MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/AC1ed6685660488369e7f0c3ab257f250c/Messages/MM898d9f335c70efa325cc1308a7ac8e5c/Media/ME1234567890abcdef',
    MediaContentType0: 'image/jpeg',
    ProfileName: 'Isra'
  };

  try {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Webhook data de prueba:' });
    console.log(JSON.stringify(webhookData, null, 2));
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n' });

    // Probar procesamiento de media
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔄 Procesando media...' });
    const mediaResult = await MessageService.processWebhookMedia(webhookData);
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Resultado del procesamiento de media:' });
    console.log(JSON.stringify(mediaResult, null, 2));
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n' });

    // Probar procesamiento completo del webhook
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔄 Procesando webhook completo...' });
    const webhookResult = await MessageService.processWebhook(webhookData, 'test-request-id');
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Resultado del procesamiento de webhook:' });
    console.log(JSON.stringify({
      success: webhookResult.success,
      messageId: webhookResult.message?.id,
      conversationId: webhookResult.message?.conversationId,
      type: webhookResult.message?.type,
      mediaUrl: webhookResult.message?.mediaUrl,
      content: webhookResult.message?.content,
      hasMedia: !!webhookResult.message?.mediaUrl
    }, null, 2));

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Ejecutar la prueba
testMediaProcessing().then(() => {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🏁 Prueba completada' });
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Error fatal:', error);
  process.exit(1);
}); 