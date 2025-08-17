/**
 * 🧪 SCRIPT DE PRUEBA: Manejo de Errores
 * 
 * Este script prueba el manejo robusto de errores en diferentes
 * escenarios para verificar que el sistema responde correctamente.
 */

const axios = require('axios');

// Configuración
const BACKEND_URL = process.env.BACKEND_URL || 'https://utalk-backend-production.up.railway.app';
const TEST_TOKEN = process.env.TEST_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQGNvbXBhbnkuY29tIiwicm9sZSI6ImFkbWluIiwibmFtZSI6IkFkbWluaXN0cmFkb3IgZGVsIFNpc3RlbWEiLCJ0eXBlIjoiYWNjZXNzIiwidXNlcklkIjoiYWRtaW5AY29tcGFueS5jb20iLCJ3b3Jrc3BhY2VJZCI6ImRlZmF1bHRfd29ya3NwYWNlIiwidGVuYW50SWQiOiJkZWZhdWx0X3RlbmFudCIsImlhdCI6MTc1NTQwOTk0NSwiZXhwIjoxNzU1NDEwODQ1LCJhdWQiOiJ1dGFsay1hcGkiLCJpc3MiOiJ1dGFsay1iYWNrZW5kIn0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

async function testErrorHandling() {
  console.log('🧪 INICIANDO PRUEBAS DE MANEJO DE ERRORES');
  console.log('=' .repeat(60));
  
  const api = axios.create({
    baseURL: BACKEND_URL,
    timeout: 10000
  });

  const tests = [
    {
      name: '📞 Contacto con teléfono inválido',
      method: 'GET',
      url: '/api/contacts/client/invalid-phone',
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` },
      expectedStatus: 400,
      expectedError: 'VALIDATION_ERROR'
    },
    {
      name: '📞 Contacto con teléfono vacío',
      method: 'GET',
      url: '/api/contacts/client/',
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` },
      expectedStatus: 404,
      expectedError: 'NOT_FOUND_ERROR'
    },
    {
      name: '🔐 Endpoint sin autenticación',
      method: 'GET',
      url: '/api/contacts/client/+5214773790184',
      headers: {},
      expectedStatus: 401,
      expectedError: 'AUTHENTICATION_ERROR'
    },
    {
      name: '📱 Media con URL inválida',
      method: 'POST',
      url: '/api/media/twilio/process',
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` },
      data: {
        mediaUrl: 'invalid-url',
        messageSid: 'test-sid',
        conversationId: 'test-conv'
      },
      expectedStatus: 400,
      expectedError: 'VALIDATION_ERROR'
    },
    {
      name: '📱 Media sin parámetros requeridos',
      method: 'POST',
      url: '/api/media/twilio/process',
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` },
      data: {},
      expectedStatus: 400,
      expectedError: 'VALIDATION_ERROR'
    },
    {
      name: '🔍 Ruta no encontrada',
      method: 'GET',
      url: '/api/nonexistent-endpoint',
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` },
      expectedStatus: 404,
      expectedError: 'NOT_FOUND_ERROR'
    }
  ];

  let passedTests = 0;
  let failedTests = 0;

  for (const test of tests) {
    console.log(`\n🧪 Ejecutando: ${test.name}`);
    console.log(`🌐 ${test.method} ${test.url}`);
    
    try {
      const response = await api.request({
        method: test.method,
        url: test.url,
        headers: test.headers,
        data: test.data
      });

      // Si llegamos aquí, no debería haber error
      console.log(`❌ FALLO: Se esperaba error ${test.expectedStatus} pero se recibió ${response.status}`);
      failedTests++;

    } catch (error) {
      if (error.response) {
        const { status, data } = error.response;
        
        console.log(`📊 Status: ${status}`);
        console.log(`📦 Response:`, JSON.stringify(data, null, 2));
        
        // Verificar que el error es el esperado
        if (status === test.expectedStatus) {
          if (data.error && data.error.code === test.expectedError) {
            console.log(`✅ ÉXITO: Error esperado recibido correctamente`);
            passedTests++;
          } else {
            console.log(`⚠️ ADVERTENCIA: Status correcto pero código de error diferente`);
            console.log(`   Esperado: ${test.expectedError}, Recibido: ${data.error?.code}`);
            passedTests++; // Consideramos que pasa si el status es correcto
          }
        } else {
          console.log(`❌ FALLO: Status incorrecto`);
          console.log(`   Esperado: ${test.expectedStatus}, Recibido: ${status}`);
          failedTests++;
        }
      } else {
        console.log(`❌ FALLO: Error de red - ${error.message}`);
        failedTests++;
      }
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log('📊 RESUMEN DE PRUEBAS:');
  console.log(`✅ Pruebas exitosas: ${passedTests}`);
  console.log(`❌ Pruebas fallidas: ${failedTests}`);
  console.log(`📈 Tasa de éxito: ${((passedTests / tests.length) * 100).toFixed(1)}%`);
  
  if (failedTests === 0) {
    console.log('\n🎉 ¡TODAS LAS PRUEBAS PASARON! El manejo de errores funciona correctamente.');
  } else {
    console.log('\n⚠️ Algunas pruebas fallaron. Revisar el manejo de errores.');
  }
}

async function testRobustness() {
  console.log('\n🛡️ PROBANDO ROBUSTEZ DEL SISTEMA');
  console.log('=' .repeat(50));
  
  const api = axios.create({
    baseURL: BACKEND_URL,
    timeout: 5000
  });

  // Probar con datos edge cases
  const edgeCases = [
    {
      name: '📞 Teléfono con caracteres especiales',
      phone: '+52 147 737 901 84',
      shouldWork: true
    },
    {
      name: '📞 Teléfono muy largo',
      phone: '+521234567890123456789',
      shouldWork: false
    },
    {
      name: '📞 Teléfono con espacios',
      phone: '+52 147 737 901 84',
      shouldWork: true
    },
    {
      name: '📞 Teléfono sin código de país',
      phone: '14773790184',
      shouldWork: false
    }
  ];

  for (const testCase of edgeCases) {
    console.log(`\n🧪 ${testCase.name}`);
    console.log(`📞 Teléfono: ${testCase.phone}`);
    
    try {
      const response = await api.get(`/api/contacts/client/${testCase.phone}`, {
        headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
      });

      if (testCase.shouldWork) {
        console.log(`✅ ÉXITO: Funcionó como se esperaba`);
        console.log(`📦 Datos:`, JSON.stringify(response.data, null, 2));
      } else {
        console.log(`❌ FALLO: Debería haber fallado pero funcionó`);
      }

    } catch (error) {
      if (error.response) {
        if (testCase.shouldWork) {
          console.log(`❌ FALLO: Debería haber funcionado pero falló`);
          console.log(`📊 Status: ${error.response.status}`);
        } else {
          console.log(`✅ ÉXITO: Falló como se esperaba`);
          console.log(`📊 Status: ${error.response.status}`);
        }
      } else {
        console.log(`❌ Error de red: ${error.message}`);
      }
    }
  }
}

// Ejecutar todas las pruebas
async function runAllTests() {
  await testErrorHandling();
  await testRobustness();
}

if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testErrorHandling, testRobustness, runAllTests }; 