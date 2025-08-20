// Script para probar el endpoint proxy-public
const axios = require('axios');

const BASE_URL = 'https://utalk-backend-production.up.railway.app';

async function testProxyEndpoint() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 Probando endpoint proxy-public...\n' });
  
  const testUrl = `${BASE_URL}/media/proxy-public?messageSid=MMa4e6b8ea9a2da0e405b7d7244174e350&mediaSid=ME29ecf51d959860aa1c78acee75de38d2`;
  
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 URL de prueba:' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: testUrl });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n' });
  
  try {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📡 Enviando petición...' });
    const response = await axios.get(testUrl, {
      timeout: 10000,
      validateStatus: (status) => true // Aceptar cualquier status
    });
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Respuesta recibida:' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Status:', response.status });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Status Text:', response.statusText });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Headers:', Object.keys(response.headers));
    
    if (response.status === 200) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🎉 ¡El endpoint funciona correctamente!' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Content-Type:', response.headers['content-type'] });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Content-Length:', response.headers['content-length'] });
    } else if (response.status === 400) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⚠️ Error de validación:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Response:', response.data });
    } else if (response.status === 404) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Endpoint no encontrado' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Response:', response.data });
    } else {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❓ Respuesta inesperada:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Response:', response.data });
    }
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en la petición:');
    if (error.response) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Status:', error.response.status });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Data:', error.response.data });
    } else if (error.request) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Error de red:', error.message });
    } else {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Error:', error.message });
    }
  }
}

// Ejecutar la prueba
testProxyEndpoint(); 