/**
 * 🧪 PRUEBA DE BOTONES DEL DASHBOARD
 * 
 * Este script prueba que todos los botones del dashboard funcionen correctamente
 */

const axios = require('axios');

async function testDashboardButtons() {
  console.log('🧪 Probando botones del dashboard...');
  
  const baseUrl = 'http://localhost:3001';
  
  try {
    // 1. Probar endpoint de prueba
    console.log('\n1️⃣ Probando endpoint de prueba...');
    const testResponse = await axios.get(`${baseUrl}/api/logs/test`);
    console.log('✅ Test endpoint:', testResponse.data.success ? 'OK' : 'ERROR');
    
    // 2. Probar dashboard
    console.log('\n2️⃣ Probando dashboard...');
    const dashboardResponse = await axios.get(`${baseUrl}/logs`);
    console.log('✅ Dashboard:', dashboardResponse.status === 200 ? 'OK' : 'ERROR');
    
    // 3. Probar generar logs de prueba
    console.log('\n3️⃣ Probando generar logs de prueba...');
    const generateResponse = await axios.post(`${baseUrl}/api/logs/generate-test`);
    console.log('✅ Generar logs:', generateResponse.data.success ? 'OK' : 'ERROR');
    
    // 4. Probar exportar logs locales
    console.log('\n4️⃣ Probando exportar logs locales...');
    const exportResponse = await axios.get(`${baseUrl}/api/logs/export?format=json&level=error`);
    console.log('✅ Exportar logs:', exportResponse.status === 200 ? 'OK' : 'ERROR');
    
    // 5. Probar test export
    console.log('\n5️⃣ Probando test export...');
    const testExportResponse = await axios.get(`${baseUrl}/api/logs/test-export?format=json`);
    console.log('✅ Test export:', testExportResponse.status === 200 ? 'OK' : 'ERROR');
    
    // 6. Probar limpiar logs
    console.log('\n6️⃣ Probando limpiar logs...');
    const clearResponse = await axios.post(`${baseUrl}/api/logs/clear`);
    console.log('✅ Limpiar logs:', clearResponse.data.success ? 'OK' : 'ERROR');
    
    // 7. Probar exportar logs de Railway (sin credenciales)
    console.log('\n7️⃣ Probando exportar logs de Railway...');
    try {
      const railwayResponse = await axios.get(`${baseUrl}/api/logs/export-railway?format=json&level=error`);
      console.log('✅ Railway export:', railwayResponse.status === 200 ? 'OK' : 'ERROR');
    } catch (error) {
      if (error.response?.status === 500 && error.response?.data?.message?.includes('RAILWAY_TOKEN')) {
        console.log('✅ Railway export: Error esperado (sin credenciales)');
      } else {
        console.log('❌ Railway export: Error inesperado:', error.message);
      }
    }
    
    console.log('\n🎉 Todas las pruebas completadas!');
    console.log('\n📋 Para probar los botones en el navegador:');
    console.log('   1. Ve a: http://localhost:3001/logs');
    console.log('   2. Abre la consola del navegador (F12)');
    console.log('   3. Haz clic en los botones y verifica que funcionen');
    console.log('   4. Revisa los mensajes en la consola');
    
  } catch (error) {
    console.error('❌ Error en las pruebas:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 El servidor no está corriendo. Ejecuta: npm start');
    }
  }
}

// Ejecutar las pruebas
testDashboardButtons(); 