/**
 * 🧪 Script de prueba para verificar la corrección del endpoint de búsqueda de contactos
 * 
 * Este script prueba que el endpoint /api/contacts/search funciona correctamente
 * con ambos parámetros: 'phone' y 'q'
 */

const axios = require('axios');
const logger = require('../src/utils/logger');

// Configuración
const BASE_URL = process.env.BACKEND_URL || 'https://utalk-backend-production.up.railway.app';
const TEST_PHONE = '+4773790184';

// Token de prueba (necesitarás reemplazar con un token válido)
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your-auth-token-here';

async function testContactSearch() {
  console.log('🧪 Iniciando pruebas de búsqueda de contactos...\n');

  const headers = {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  };

  const tests = [
    {
      name: 'Test con parámetro "phone"',
      url: `${BASE_URL}/api/contacts/search?phone=${TEST_PHONE}`,
      expectedParam: 'phone'
    },
    {
      name: 'Test con parámetro "q"',
      url: `${BASE_URL}/api/contacts/search?q=${TEST_PHONE}`,
      expectedParam: 'q'
    },
    {
      name: 'Test sin parámetros (debe fallar)',
      url: `${BASE_URL}/api/contacts/search`,
      expectedParam: 'none',
      shouldFail: true
    },
    {
      name: 'Test con teléfono inválido',
      url: `${BASE_URL}/api/contacts/search?q=invalid-phone`,
      expectedParam: 'q',
      shouldFail: true
    }
  ];

  for (const test of tests) {
    console.log(`📋 ${test.name}`);
    console.log(`🔗 URL: ${test.url}`);
    
    try {
      const startTime = Date.now();
      const response = await axios.get(test.url, { headers });
      const duration = Date.now() - startTime;

      if (test.shouldFail) {
        console.log(`❌ Test falló - Se esperaba un error pero se obtuvo éxito`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
      } else {
        console.log(`✅ Test exitoso`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Duration: ${duration}ms`);
        console.log(`   Success: ${response.data.success}`);
        console.log(`   Message: ${response.data.message}`);
        
        if (response.data.data) {
          console.log(`   Contact ID: ${response.data.data.id}`);
          console.log(`   Contact Name: ${response.data.data.name}`);
          console.log(`   Contact Phone: ${response.data.data.phone}`);
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (test.shouldFail) {
        console.log(`✅ Test exitoso - Error esperado`);
        console.log(`   Status: ${error.response?.status || 'Network Error'}`);
        console.log(`   Error: ${error.response?.data?.message || error.message}`);
      } else {
        console.log(`❌ Test falló - Error inesperado`);
        console.log(`   Status: ${error.response?.status || 'Network Error'}`);
        console.log(`   Error: ${error.response?.data?.message || error.message}`);
        console.log(`   Stack: ${error.stack?.split('\n').slice(0, 3).join('\n')}`);
      }
    }
    
    console.log(''); // Línea en blanco para separar tests
  }

  console.log('🏁 Pruebas completadas');
}

// Función para probar la creación de conversación
async function testConversationCreation() {
  console.log('🧪 Probando creación de conversación...\n');

  const headers = {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  };

  const conversationData = {
    customerName: 'ISRA',
    customerPhone: TEST_PHONE,
    initialMessage: 'HOLA',
    email: 'cliente@ejemplo.com'
  };

  try {
    console.log(`📋 Creando conversación con: ${JSON.stringify(conversationData, null, 2)}`);
    
    const startTime = Date.now();
    const response = await axios.post(`${BASE_URL}/api/conversations`, conversationData, { headers });
    const duration = Date.now() - startTime;

    console.log(`✅ Conversación creada exitosamente`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Success: ${response.data.success}`);
    console.log(`   Message: ${response.data.message}`);
    
    if (response.data.data) {
      console.log(`   Conversation ID: ${response.data.data.id}`);
      console.log(`   Customer Phone: ${response.data.data.customerPhone}`);
      console.log(`   Status: ${response.data.data.status}`);
    }

  } catch (error) {
    console.log(`❌ Error creando conversación`);
    console.log(`   Status: ${error.response?.status || 'Network Error'}`);
    console.log(`   Error: ${error.response?.data?.message || error.message}`);
    
    if (error.response?.data?.error) {
      console.log(`   Details: ${error.response.data.error.details}`);
    }
  }
}

// Ejecutar pruebas
async function runTests() {
  console.log('🚀 Iniciando pruebas de corrección de contactos...\n');
  
  if (!AUTH_TOKEN || AUTH_TOKEN === 'your-auth-token-here') {
    console.log('⚠️  ADVERTENCIA: No se ha configurado un token de autenticación válido');
    console.log('   Configura la variable de entorno AUTH_TOKEN o modifica el script');
    console.log('   Las pruebas pueden fallar por falta de autenticación\n');
  }

  await testContactSearch();
  console.log('='.repeat(60));
  await testConversationCreation();
  
  console.log('\n🎉 Todas las pruebas completadas');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testContactSearch,
  testConversationCreation,
  runTests
}; 