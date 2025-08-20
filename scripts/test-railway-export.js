/**
 * 🧪 SCRIPT DE PRUEBA PARA EXPORTACIÓN DE RAILWAY
 * 
 * Este script prueba la funcionalidad de exportación de logs de Railway
 * sin necesidad de configurar las credenciales reales
 */

const axios = require('axios');

async function testRailwayExport() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 Probando exportación de Railway...' });
  
  try {
    // Probar el endpoint local primero
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📡 Probando endpoint local...' });
    const localResponse = await axios.get('http://localhost:3001/api/logs/export-railway?format=json&level=error&hours=1');
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Respuesta del servidor:', localResponse.status });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 Datos recibidos:', localResponse.data ? 'SÍ' : 'NO' });
    
    if (localResponse.data) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Información del archivo:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   - Total de logs:', localResponse.data.totalLogs || 'N/A' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   - Fecha de exportación:', localResponse.data.exportedAt || 'N/A' });
      console.log('   - Filtros aplicados:', JSON.stringify(localResponse.data.filters || {}, null, 2));
    }
    
    // Probar exportación CSV
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📡 Probando exportación CSV...' });
    const csvResponse = await axios.get('http://localhost:3001/api/logs/export-railway?format=csv&level=error&hours=1', {
      responseType: 'text'
    });
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Respuesta CSV:', csvResponse.status });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 Tamaño del CSV:', csvResponse.data.length, 'caracteres' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Primeras líneas del CSV:' });
    console.log(csvResponse.data.split('\n').slice(0, 5).join('\n'));
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎉 ¡Todas las pruebas pasaron exitosamente!' });
    
  } catch (error) {
    console.error('❌ Error en las pruebas:', error.message);
    
    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📋 Datos:', error.response.data);
    }
    
    // Verificar si el problema es de configuración
    if (error.message.includes('RAILWAY_TOKEN')) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n💡 SOLUCIÓN: Necesitas configurar las variables de Railway:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   1. Ejecuta: ./scripts/setup-railway-export.sh' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   2. Configura RAILWAY_TOKEN, RAILWAY_PROJECT_ID, RAILWAY_SERVICE_ID en .env' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   3. Reinicia el servidor' });
    }
  }
}

// Ejecutar la prueba
testRailwayExport(); 