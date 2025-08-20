const axios = require('axios');

console.log('🧪 TESTING: Health Check Endpoints');
console.log('==================================');

async function testHealthEndpoints() {
  const baseUrl = 'http://localhost:3001';
  
  const endpoints = [
    '/health',
    '/emergency-test',
    '/api/ai/health'
  ];

  console.log('🔍 Probando endpoints en:', baseUrl);
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n📍 Testing: ${endpoint}`);
      
      const response = await axios.get(`${baseUrl}${endpoint}`, {
        timeout: 5000,
        validateStatus: () => true // No lanzar error por status codes
      });
      
      console.log(`   Status: ${response.status}`);
      console.log(`   Response:`, JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
      
      if (response.status === 200) {
        console.log('   ✅ Endpoint funcionando correctamente');
      } else {
        console.log('   ⚠️ Endpoint devolvió status no-200');
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n🎯 RESUMEN:');
  console.log('- /health: Requerido por Railway para health checks');
  console.log('- /emergency-test: Ruta de diagnóstico interno');
  console.log('- /api/ai/health: Health check específico de IA');
  
  console.log('\n✅ Verificación de health endpoints completada');
}

// Ejecutar si el servidor está corriendo
testHealthEndpoints().catch(error => {
  console.error('❌ Error ejecutando pruebas:', error.message);
  console.log('\n💡 Asegúrate de que el servidor esté corriendo en puerto 3001');
}); 