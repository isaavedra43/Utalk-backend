// Script para probar webhook real con curl
const { exec } = require('child_process');

const webhookData = {
  MessageSid: 'MMe60968c44ac4bb71105ebc3d1c4da65f',
  From: '+5214773790184',
  To: '+5214793176502',
  Body: '',
  NumMedia: '1',
  MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/AC1ed6685660488369e7f0c3ab257f250c/Messages/MMe60968c44ac4bb71105ebc3d1c4da65f/Media/ME1234567890abcdef',
  MediaContentType0: 'image/jpeg',
  ProfileName: 'Isra',
  WaId: '5214773790184',
  AccountSid: 'AC1ed6685660488369e7f0c3ab257f250c',
  ApiVersion: '2010-04-01'
};

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 Probando webhook real con curl...\n' });

// Convertir el objeto a formato form-data para curl
const formData = Object.entries(webhookData)
  .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
  .join('&');

const curlCommand = `curl -X POST http://localhost:3002/webhook/test \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "${formData}"`;

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Comando curl:' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: curlCommand });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n' });

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Datos del webhook:' });
console.log(JSON.stringify(webhookData, null, 2));
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n' });

// Ejecutar el comando curl
exec(curlCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Error ejecutando curl:', error.message);
    return;
  }
  
  if (stderr) {
    console.error('⚠️ Stderr:', stderr);
  }
  
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Respuesta del webhook:' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: stdout });
  
  try {
    const response = JSON.parse(stdout);
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📊 Análisis de la respuesta:' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Success:', response.success });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Message:', response.message });
    
    if (response.data) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Message ID:', response.data.message.id });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Message Type:', response.data.message.type });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Media URL:', response.data.message.mediaUrl });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Has Media:', !!response.data.message.mediaUrl });
      
      if (response.data.media) {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Media URLs:', response.data.media.urls.length });
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Media Type:', response.data.media.primaryType });
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- URLs:', response.data.media.urls });
      }
    }
  } catch (parseError) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⚠️ No se pudo parsear la respuesta como JSON' });
  }
}); 