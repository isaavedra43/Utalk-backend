/**
 * 🧪 PRUEBA RÁPIDA DE EXPORTACIÓN
 * 
 * Este script prueba la funcionalidad de exportación directamente
 * sin necesidad del servidor corriendo
 */

const RailwayLogExporter = require('./export-railway-logs');

async function quickTest() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 Prueba rápida de exportación...' });
  
  try {
    // Crear una instancia del exportador
    const exporter = new RailwayLogExporter();
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Exportador creado correctamente' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Configuración:' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   - Railway Token:', process.env.RAILWAY_TOKEN ? '✅ Configurado' : '❌ No configurado' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   - Project ID:', process.env.RAILWAY_PROJECT_ID ? '✅ Configurado' : '❌ No configurado' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   - Service ID:', process.env.RAILWAY_SERVICE_ID ? '✅ Configurado' : '❌ No configurado' });
    
    if (!process.env.RAILWAY_TOKEN) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n💡 Para probar con datos reales, configura las variables:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   export RAILWAY_TOKEN=tu_token_aqui' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   export RAILWAY_PROJECT_ID=tu_project_id_aqui' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   export RAILWAY_SERVICE_ID=tu_service_id_aqui' });
      
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎯 Por ahora, el dashboard debería funcionar con logs locales' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   - Los botones "Exportar JSON" y "Exportar CSV" exportan logs locales' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   - Los botones "🚀 Railway JSON" y "🚀 Railway CSV" exportan logs de Railway' });
      
      return;
    }
    
    // Probar exportación de errores
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📊 Probando exportación de errores...' });
    const result = await exporter.exportErrors('./test-errors.json');
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Exportación completada:' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   - Archivo:', './test-errors.json' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   - Total logs:', result.totalLogs });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   - Fecha:', result.exportedAt });
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en la prueba:', error.message);
    
    if (error.message.includes('RAILWAY_TOKEN')) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n💡 SOLUCIÓN: Configura las variables de Railway' });
    }
  }
}

quickTest(); 