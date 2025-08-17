/**
 * 🧪 PRUEBA RÁPIDA DE EXPORTACIÓN
 * 
 * Este script prueba la funcionalidad de exportación directamente
 * sin necesidad del servidor corriendo
 */

const RailwayLogExporter = require('./export-railway-logs');

async function quickTest() {
  console.log('🧪 Prueba rápida de exportación...');
  
  try {
    // Crear una instancia del exportador
    const exporter = new RailwayLogExporter();
    
    console.log('✅ Exportador creado correctamente');
    console.log('📋 Configuración:');
    console.log('   - Railway Token:', process.env.RAILWAY_TOKEN ? '✅ Configurado' : '❌ No configurado');
    console.log('   - Project ID:', process.env.RAILWAY_PROJECT_ID ? '✅ Configurado' : '❌ No configurado');
    console.log('   - Service ID:', process.env.RAILWAY_SERVICE_ID ? '✅ Configurado' : '❌ No configurado');
    
    if (!process.env.RAILWAY_TOKEN) {
      console.log('\n💡 Para probar con datos reales, configura las variables:');
      console.log('   export RAILWAY_TOKEN=tu_token_aqui');
      console.log('   export RAILWAY_PROJECT_ID=tu_project_id_aqui');
      console.log('   export RAILWAY_SERVICE_ID=tu_service_id_aqui');
      
      console.log('\n🎯 Por ahora, el dashboard debería funcionar con logs locales');
      console.log('   - Los botones "Exportar JSON" y "Exportar CSV" exportan logs locales');
      console.log('   - Los botones "🚀 Railway JSON" y "🚀 Railway CSV" exportan logs de Railway');
      
      return;
    }
    
    // Probar exportación de errores
    console.log('\n📊 Probando exportación de errores...');
    const result = await exporter.exportErrors('./test-errors.json');
    
    console.log('✅ Exportación completada:');
    console.log('   - Archivo:', './test-errors.json');
    console.log('   - Total logs:', result.totalLogs);
    console.log('   - Fecha:', result.exportedAt);
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    
    if (error.message.includes('RAILWAY_TOKEN')) {
      console.log('\n💡 SOLUCIÓN: Configura las variables de Railway');
    }
  }
}

quickTest(); 