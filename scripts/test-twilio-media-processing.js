/**
 * 🧪 SCRIPT DE PRUEBA: Procesamiento de Medios de Twilio
 * 
 * Este script prueba el servicio TwilioMediaService para verificar
 * que puede descargar y procesar medios de WhatsApp correctamente.
 */

const axios = require('axios');

// Configuración
const BACKEND_URL = process.env.BACKEND_URL || 'https://utalk-backend-production.up.railway.app';
const TEST_TOKEN = process.env.TEST_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQGNvbXBhbnkuY29tIiwicm9sZSI6ImFkbWluIiwibmFtZSI6IkFkbWluaXN0cmFkb3IgZGVsIFNpc3RlbWEiLCJ0eXBlIjoiYWNjZXNzIiwidXNlcklkIjoiYWRtaW5AY29tcGFueS5jb20iLCJ3b3Jrc3BhY2VJZCI6ImRlZmF1bHRfd29ya3NwYWNlIiwidGVuYW50SWQiOiJkZWZhdWx0X3RlbmFudCIsImlhdCI6MTc1NTQwOTk0NSwiZXhwIjoxNzU1NDEwODQ1LCJhdWQiOiJ1dGFsay1hcGkiLCJpc3MiOiJ1dGFsay1iYWNrZW5kIn0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

// URL de ejemplo de Twilio (reemplazar con una URL real)
const TEST_MEDIA_URL = process.env.TEST_MEDIA_URL || 'https://api.twilio.com/2010-04-01/Accounts/AC1234567890abcdef/Messages/SM1234567890abcdef/Media/ME1234567890abcdef';
const TEST_MESSAGE_SID = process.env.TEST_MESSAGE_SID || 'SM1234567890abcdef';
const TEST_CONVERSATION_ID = process.env.TEST_CONVERSATION_ID || 'conv_test_123';

async function testTwilioMediaProcessing() {
  console.log('🧪 INICIANDO PRUEBA DE PROCESAMIENTO DE MEDIOS DE TWILIO');
  console.log('=' .repeat(70));
  
  try {
    // Configurar axios con headers
    const api = axios.create({
      baseURL: BACKEND_URL,
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log(`📱 Probando endpoint: POST /api/media/twilio/process`);
    console.log(`🌐 URL completa: ${BACKEND_URL}/api/media/twilio/process`);
    console.log(`📎 Media URL: ${TEST_MEDIA_URL}`);
    console.log(`💬 Message SID: ${TEST_MESSAGE_SID}`);
    console.log(`🗣️ Conversation ID: ${TEST_CONVERSATION_ID}`);
    
    // Hacer la petición
    const response = await api.post('/api/media/twilio/process', {
      mediaUrl: TEST_MEDIA_URL,
      messageSid: TEST_MESSAGE_SID,
      conversationId: TEST_CONVERSATION_ID,
      index: 0
    });
    
    console.log('\n✅ RESPUESTA EXITOSA:');
    console.log('📊 Status:', response.status);
    console.log('📋 Headers:', JSON.stringify(response.headers, null, 2));
    
    console.log('\n📦 DATOS DEL MEDIO PROCESADO:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Verificar estructura de respuesta
    if (response.data.success && response.data.data) {
      const mediaData = response.data.data;
      
      console.log('\n🔍 VERIFICACIÓN DE CAMPOS:');
      console.log(`✅ fileId: ${mediaData.fileId}`);
      console.log(`✅ category: ${mediaData.category}`);
      console.log(`✅ url: ${mediaData.url}`);
      console.log(`✅ size: ${mediaData.size}`);
      console.log(`✅ mimetype: ${mediaData.mimetype}`);
      console.log(`✅ processed: ${mediaData.processed}`);
      console.log(`✅ storedLocally: ${mediaData.storedLocally}`);
      
      // Verificar que el medio fue procesado correctamente
      if (mediaData.processed && mediaData.storedLocally) {
        console.log('\n🎉 ¡ÉXITO! El medio fue procesado y almacenado localmente');
        console.log(`🔗 URL pública: ${mediaData.url}`);
      } else {
        console.log('\n⚠️ ADVERTENCIA: El medio no fue procesado completamente');
      }
      
    } else {
      console.log('\n❌ ERROR: La respuesta no tiene la estructura esperada');
    }
    
  } catch (error) {
    console.log('\n❌ ERROR EN LA PRUEBA:');
    
    if (error.response) {
      console.log('📊 Status:', error.response.status);
      console.log('📋 Headers:', JSON.stringify(error.response.headers, null, 2));
      console.log('📦 Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log('🌐 Error de red:', error.message);
    } else {
      console.log('💻 Error:', error.message);
    }
  }
  
  console.log('\n' + '=' .repeat(70));
  console.log('🏁 PRUEBA COMPLETADA');
}

async function testMediaInfo() {
  console.log('\n🔍 PROBANDO OBTENCIÓN DE INFORMACIÓN DE MEDIO');
  console.log('=' .repeat(50));
  
  try {
    const api = axios.create({
      baseURL: BACKEND_URL,
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log(`📱 Probando endpoint: GET /api/media/twilio/info`);
    console.log(`🌐 URL completa: ${BACKEND_URL}/api/media/twilio/info?mediaUrl=${encodeURIComponent(TEST_MEDIA_URL)}`);
    
    // Hacer la petición
    const response = await api.get(`/api/media/twilio/info?mediaUrl=${encodeURIComponent(TEST_MEDIA_URL)}`);
    
    console.log('\n✅ INFORMACIÓN DEL MEDIO:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('\n❌ ERROR OBTENIENDO INFORMACIÓN:');
    
    if (error.response) {
      console.log('📊 Status:', error.response.status);
      console.log('📦 Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('💻 Error:', error.message);
    }
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('🏁 PRUEBA DE INFORMACIÓN COMPLETADA');
}

// Ejecutar las pruebas
async function runAllTests() {
  await testTwilioMediaProcessing();
  await testMediaInfo();
}

if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testTwilioMediaProcessing, testMediaInfo, runAllTests }; 