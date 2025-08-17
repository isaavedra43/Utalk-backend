/**
 * 🧪 SCRIPT DE PRUEBA PARA EXPORTACIÓN DE RAILWAY
 * 
 * Este script prueba la funcionalidad de exportación de logs de Railway
 * sin necesidad de configurar las credenciales reales
 */

const axios = require('axios');

async function testRailwayExport() {
  console.log('🧪 Probando exportación de Railway...');
  
  try {
    // Probar el endpoint local primero
    console.log('📡 Probando endpoint local...');
    const localResponse = await axios.get('http://localhost:3001/api/logs/export-railway?format=json&level=error&hours=1');
    
    console.log('✅ Respuesta del servidor:', localResponse.status);
    console.log('📊 Datos recibidos:', localResponse.data ? 'SÍ' : 'NO');
    
    if (localResponse.data) {
      console.log('📋 Información del archivo:');
      console.log('   - Total de logs:', localResponse.data.totalLogs || 'N/A');
      console.log('   - Fecha de exportación:', localResponse.data.exportedAt || 'N/A');
      console.log('   - Filtros aplicados:', JSON.stringify(localResponse.data.filters || {}, null, 2));
    }
    
    // Probar exportación CSV
    console.log('\n📡 Probando exportación CSV...');
    const csvResponse = await axios.get('http://localhost:3001/api/logs/export-railway?format=csv&level=error&hours=1', {
      responseType: 'text'
    });
    
    console.log('✅ Respuesta CSV:', csvResponse.status);
    console.log('📊 Tamaño del CSV:', csvResponse.data.length, 'caracteres');
    console.log('📋 Primeras líneas del CSV:');
    console.log(csvResponse.data.split('\n').slice(0, 5).join('\n'));
    
    console.log('\n🎉 ¡Todas las pruebas pasaron exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en las pruebas:', error.message);
    
    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📋 Datos:', error.response.data);
    }
    
    // Verificar si el problema es de configuración
    if (error.message.includes('RAILWAY_TOKEN')) {
      console.log('\n💡 SOLUCIÓN: Necesitas configurar las variables de Railway:');
      console.log('   1. Ejecuta: ./scripts/setup-railway-export.sh');
      console.log('   2. Configura RAILWAY_TOKEN, RAILWAY_PROJECT_ID, RAILWAY_SERVICE_ID en .env');
      console.log('   3. Reinicia el servidor');
    }
  }
}

// Ejecutar la prueba
testRailwayExport(); 