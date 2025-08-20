/**
 * 🧪 PRUEBA DE BOTONES DEL DASHBOARD
 * 
 * Este script prueba que todos los botones del dashboard funcionen correctamente
 */

const axios = require('axios');

async function testDashboardButtons() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 Probando botones del dashboard...' });
  
  const baseUrl = 'http://localhost:3001';
  
  try {
    // 1. Probar endpoint de prueba
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n1️⃣ Probando endpoint de prueba...' });
    const testResponse = await axios.get(`${baseUrl}/api/logs/test`);
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Test endpoint:', testResponse.data.success ? 'OK' : 'ERROR' });
    
    // 2. Probar dashboard
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n2️⃣ Probando dashboard...' });
    const dashboardResponse = await axios.get(`${baseUrl}/logs`);
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Dashboard:', dashboardResponse.status === 200 ? 'OK' : 'ERROR' });
    
    // 3. Probar generar logs de prueba
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n3️⃣ Probando generar logs de prueba...' });
    const generateResponse = await axios.post(`${baseUrl}/api/logs/generate-test`);
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Generar logs:', generateResponse.data.success ? 'OK' : 'ERROR' });
    
    // 4. Probar exportar logs locales
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n4️⃣ Probando exportar logs locales...' });
    const exportResponse = await axios.get(`${baseUrl}/api/logs/export?format=json&level=error`);
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Exportar logs:', exportResponse.status === 200 ? 'OK' : 'ERROR' });
    
    // 5. Probar test export
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n5️⃣ Probando test export...' });
    const testExportResponse = await axios.get(`${baseUrl}/api/logs/test-export?format=json`);
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Test export:', testExportResponse.status === 200 ? 'OK' : 'ERROR' });
    
    // 6. Probar limpiar logs
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n6️⃣ Probando limpiar logs...' });
    const clearResponse = await axios.post(`${baseUrl}/api/logs/clear`);
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Limpiar logs:', clearResponse.data.success ? 'OK' : 'ERROR' });
    
    // 7. Probar exportar logs de Railway (sin credenciales)
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n7️⃣ Probando exportar logs de Railway...' });
    try {
      const railwayResponse = await axios.get(`${baseUrl}/api/logs/export-railway?format=json&level=error`);
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Railway export:', railwayResponse.status === 200 ? 'OK' : 'ERROR' });
    } catch (error) {
      if (error.response?.status === 500 && error.response?.data?.message?.includes('RAILWAY_TOKEN')) {
        console.log('✅ Railway export: Error esperado (sin credenciales)');
      } else {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Railway export: Error inesperado:', error.message });
      }
    }
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎉 Todas las pruebas completadas!' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📋 Para probar los botones en el navegador:' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   1. Ve a: http://localhost:3001/logs' });
    console.log('   2. Abre la consola del navegador (F12)');
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   3. Haz clic en los botones y verifica que funcionen' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   4. Revisa los mensajes en la consola' });
    
  } catch (error) {
    console.error('❌ Error en las pruebas:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n💡 El servidor no está corriendo. Ejecuta: npm start' });
    }
  }
}

// Ejecutar las pruebas
testDashboardButtons(); 