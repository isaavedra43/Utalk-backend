// Script para probar múltiples endpoints
const axios = require('axios');

const BASE_URL = 'https://utalk-backend-production.up.railway.app';

async function testEndpoint(path, description) {
  console.log(`\n🧪 Probando: ${description}`);
  console.log(`📋 URL: ${BASE_URL}${path}`);
  
  try {
    const response = await axios.get(`${BASE_URL}${path}`, {
      timeout: 10000,
      validateStatus: (status) => true
    });
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📄 Response:`, response.data);
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    if (error.response) {
      console.log(`📄 Response:`, error.response.data);
    }
  }
}

async function runTests() {
  console.log('🚀 Iniciando pruebas de endpoints...\n');
  
  // Probar endpoints en orden
  await testEndpoint('/test-media', 'Endpoint de prueba simple');
  await testEndpoint('/media/proxy-public?messageSid=MM123&mediaSid=ME123', 'Endpoint proxy-public');
  await testEndpoint('/api/media/proxy-public?messageSid=MM123&mediaSid=ME123', 'Endpoint API proxy-public');
  await testEndpoint('/api/conversations', 'Endpoint de conversaciones (para verificar que la API funciona)');
}

runTests(); 