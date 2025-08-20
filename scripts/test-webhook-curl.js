// Script para probar el webhook con curl
const { exec } = require('child_process');

const webhookData = {
  From: '+5214773790184',
  To: '+5214793176502',
  MessageSid: 'MMe60968c44ac4bb71105ebc3d1c4da65f',
  Body: '',
  NumMedia: '1',
  MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/AC1ed6685660488369e7f0c3ab257f250c/Messages/MMe60968c44ac4bb71105ebc3d1c4da65f/Media/ME1234567890abcdef',
  MediaContentType0: 'image/jpeg',
  ProfileName: 'Isra'
};

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 Probando webhook con curl...\n' });

// Convertir el objeto a formato form-data para curl
const formData = Object.entries(webhookData)
  .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
  .join('&');

const curlCommand = `curl -X POST http://localhost:3001/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "${formData}"`;

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Comando curl:' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: curlCommand });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n' });

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Datos del webhook:' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: JSON.stringify(webhookData, null, 2));
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n' });

// Ejecutar el comando curl
exec(curlCommand, (error, stdout, stderr) => {
  if (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error ejecutando curl:', error.message);
    return;
  }
  
  if (stderr) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '⚠️ Stderr:', stderr);
  }
  
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Respuesta del webhook:' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: stdout });
  
  try {
    const response = JSON.parse(stdout);
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📊 Análisis de la respuesta:' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Success:', response.success });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Message:', response.message });
    
    if (response.media) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Media URLs:', response.media.urls.length });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Media Type:', response.media.primaryType });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- URLs:', response.media.urls });
    }
  } catch (parseError) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⚠️ No se pudo parsear la respuesta como JSON' });
  }
}); 