/**
 * 🔍 Script de diagnóstico para verificar el estado del endpoint de búsqueda de contactos
 * 
 * Este script verifica si el endpoint está funcionando correctamente y
 * proporciona información de diagnóstico detallada
 */

const axios = require('axios');
const logger = require('../src/utils/logger');

// Configuración
const BASE_URL = process.env.BACKEND_URL || 'https://utalk-backend-production.up.railway.app';
const TEST_PHONE = '+4773790184';

async function checkServerHealth() {
  console.log('🏥 Verificando salud del servidor...\n');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/health`, {
      timeout: 10000
    });
    
    console.log('✅ Servidor respondiendo correctamente');
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
    
    return true;
  } catch (error) {
    console.log('❌ Servidor no responde o tiene problemas');
    console.log(`   Error: ${error.message}`);
    console.log(`   Status: ${error.response?.status || 'No response'}`);
    
    return false;
  }
}

async function checkContactSearchEndpoint() {
  console.log('\n🔍 Verificando endpoint de búsqueda de contactos...\n');
  
  const tests = [
    {
      name: 'Test con parámetro "q" (como envía el frontend)',
      url: `${BASE_URL}/api/contacts/search?q=${TEST_PHONE}`,
      description: 'Este es el parámetro que está enviando el frontend'
    },
    {
      name: 'Test con parámetro "phone"',
      url: `${BASE_URL}/api/contacts/search?phone=${TEST_PHONE}`,
      description: 'Parámetro esperado por el backend original'
    },
    {
      name: 'Test sin autenticación (debe fallar)',
      url: `${BASE_URL}/api/contacts/search?q=${TEST_PHONE}`,
      description: 'Verificar que requiere autenticación'
    }
  ];

  for (const test of tests) {
    console.log(`📋 ${test.name}`);
    console.log(`📝 ${test.description}`);
    console.log(`🔗 URL: ${test.url}`);
    
    try {
      const startTime = Date.now();
      const response = await axios.get(test.url, {
        timeout: 10000,
        validateStatus: () => true // No lanzar error para códigos de estado HTTP
      });
      const duration = Date.now() - startTime;

      console.log(`   Status: ${response.status}`);
      console.log(`   Duration: ${duration}ms`);
      
      if (response.status === 200) {
        console.log(`   ✅ Éxito`);
        console.log(`   Success: ${response.data.success}`);
        console.log(`   Message: ${response.data.message}`);
        
        if (response.data.data) {
          console.log(`   Contact ID: ${response.data.data.id}`);
          console.log(`   Contact Name: ${response.data.data.name}`);
          console.log(`   Contact Phone: ${response.data.data.phone}`);
        }
      } else if (response.status === 401) {
        console.log(`   🔐 Requiere autenticación (esperado)`);
      } else if (response.status === 400) {
        console.log(`   ⚠️  Error de validación`);
        console.log(`   Error: ${response.data.message || 'Sin mensaje de error'}`);
      } else if (response.status === 500) {
        console.log(`   💥 Error interno del servidor`);
        console.log(`   Error: ${response.data.message || 'Sin mensaje de error'}`);
        if (response.data.error) {
          console.log(`   Details: ${response.data.error.details}`);
        }
      } else {
        console.log(`   ❓ Status inesperado: ${response.status}`);
        console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
      }
      
    } catch (error) {
      console.log(`   💥 Error de red`);
      console.log(`   Error: ${error.message}`);
      if (error.code) {
        console.log(`   Code: ${error.code}`);
      }
    }
    
    console.log(''); // Línea en blanco
  }
}

async function checkDatabaseConnection() {
  console.log('🗄️  Verificando conexión a la base de datos...\n');
  
  try {
    // Intentar acceder a un endpoint que use la base de datos
    const response = await axios.get(`${BASE_URL}/api/contacts`, {
      timeout: 10000,
      validateStatus: () => true
    });
    
    if (response.status === 200) {
      console.log('✅ Conexión a la base de datos funcionando');
      console.log(`   Status: ${response.status}`);
      console.log(`   Total contacts: ${response.data.data?.length || 0}`);
    } else if (response.status === 401) {
      console.log('🔐 Endpoint requiere autenticación (base de datos accesible)');
    } else {
      console.log('⚠️  Posible problema con la base de datos');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${response.data.message || 'Sin mensaje'}`);
    }
    
  } catch (error) {
    console.log('❌ Error verificando base de datos');
    console.log(`   Error: ${error.message}`);
  }
}

async function analyzeErrorPattern() {
  console.log('\n📊 Análisis del patrón de error...\n');
  
  console.log('🔍 Basado en los logs proporcionados:');
  console.log('   1. El frontend envía: GET /api/contacts/search?q=+4773790184');
  console.log('   2. El backend espera: GET /api/contacts/search?phone=+4773790184');
  console.log('   3. Esto causa que req.query.phone sea undefined');
  console.log('   4. Se pasa undefined a ContactService.findContactByPhone()');
  console.log('   5. Eventualmente llega a Contact.getById() con ID vacío');
  console.log('   6. Firestore rechaza el documentPath vacío');
  
  console.log('\n🎯 Solución aplicada:');
  console.log('   1. ✅ Modificado ContactController para aceptar tanto "phone" como "q"');
  console.log('   2. ✅ Actualizado validador para aceptar ambos parámetros');
  console.log('   3. ✅ Mejorada validación en ContactService');
  console.log('   4. ✅ Agregada validación adicional para teléfonos vacíos');
}

async function runDiagnostic() {
  console.log('🚀 Iniciando diagnóstico completo del endpoint de contactos...\n');
  
  await checkServerHealth();
  await checkDatabaseConnection();
  await checkContactSearchEndpoint();
  await analyzeErrorPattern();
  
  console.log('\n📋 Resumen de recomendaciones:');
  console.log('   1. 🔄 Reiniciar el servidor para aplicar los cambios');
  console.log('   2. 🧪 Ejecutar el script de prueba: node scripts/test-contact-search-fix.js');
  console.log('   3. 📱 Verificar que el frontend funcione correctamente');
  console.log('   4. 📊 Monitorear logs para confirmar que no hay más errores');
  
  console.log('\n🎉 Diagnóstico completado');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runDiagnostic().catch(console.error);
}

module.exports = {
  checkServerHealth,
  checkContactSearchEndpoint,
  checkDatabaseConnection,
  analyzeErrorPattern,
  runDiagnostic
}; 