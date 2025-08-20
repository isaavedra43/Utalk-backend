// Script para probar múltiples endpoints
const axios = require('axios');

const BASE_URL = 'https://utalk-backend-production.up.railway.app';

async function testEndpoint(path, description) {
  logger.info('\n🧪 Probando: ${description}', { category: 'AUTO_MIGRATED' });
  logger.info('URL: ${BASE_URL}${path}', { category: 'AUTO_MIGRATED' });
  
  try {
    const response = await axios.get(`${BASE_URL}${path}`, {
      timeout: 10000,
      validateStatus: (status) => true
    });
    
    logger.info('Status: ${response.status}', { category: 'AUTO_MIGRATED' });
    logger.info('� Response:', { category: 'AUTO_MIGRATED', data: response.data });
    
  } catch (error) {
    logger.info('❌ Error: ${error.message}', { category: 'AUTO_MIGRATED' });
    if (error.response) {
      logger.info('� Response:', { category: 'AUTO_MIGRATED', data: error.response.data });
    }
  }
}

async function runTests() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🚀 Iniciando pruebas de endpoints...\n' });
  
  // Probar endpoints en orden
  await testEndpoint('/test-media', 'Endpoint de prueba simple');
  await testEndpoint('/media/proxy-public?messageSid=MM123&mediaSid=ME123', 'Endpoint proxy-public');
  await testEndpoint('/api/media/proxy-public?messageSid=MM123&mediaSid=ME123', 'Endpoint API proxy-public');
  await testEndpoint('/api/conversations', 'Endpoint de conversaciones (para verificar que la API funciona)');
}

runTests(); 