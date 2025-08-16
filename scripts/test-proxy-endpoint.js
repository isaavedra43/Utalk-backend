// Script para probar el endpoint proxy-public
const axios = require('axios');

const BASE_URL = 'https://utalk-backend-production.up.railway.app';

async function testProxyEndpoint() {
  console.log('🧪 Probando endpoint proxy-public...\n');
  
  const testUrl = `${BASE_URL}/media/proxy-public?messageSid=MMa4e6b8ea9a2da0e405b7d7244174e350&mediaSid=ME29ecf51d959860aa1c78acee75de38d2`;
  
  console.log('📋 URL de prueba:');
  console.log(testUrl);
  console.log('\n');
  
  try {
    console.log('📡 Enviando petición...');
    const response = await axios.get(testUrl, {
      timeout: 10000,
      validateStatus: (status) => true // Aceptar cualquier status
    });
    
    console.log('✅ Respuesta recibida:');
    console.log('- Status:', response.status);
    console.log('- Status Text:', response.statusText);
    console.log('- Headers:', Object.keys(response.headers));
    
    if (response.status === 200) {
      console.log('🎉 ¡El endpoint funciona correctamente!');
      console.log('- Content-Type:', response.headers['content-type']);
      console.log('- Content-Length:', response.headers['content-length']);
    } else if (response.status === 400) {
      console.log('⚠️ Error de validación:');
      console.log('- Response:', response.data);
    } else if (response.status === 404) {
      console.log('❌ Endpoint no encontrado');
      console.log('- Response:', response.data);
    } else {
      console.log('❓ Respuesta inesperada:');
      console.log('- Response:', response.data);
    }
    
  } catch (error) {
    console.error('❌ Error en la petición:');
    if (error.response) {
      console.log('- Status:', error.response.status);
      console.log('- Data:', error.response.data);
    } else if (error.request) {
      console.log('- Error de red:', error.message);
    } else {
      console.log('- Error:', error.message);
    }
  }
}

// Ejecutar la prueba
testProxyEndpoint(); 