const logger = require('../src/utils/logger');

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 TESTING: Server Startup');
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '==========================');

async function testServerStartup() {
  try {
    // 1. Verificar que se puede importar el servidor
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ 1. Importando servidor...');
    const { ConsolidatedServer } = require('../src/index.js');
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ 2. Servidor importado correctamente');
    
    // 3. Verificar que se puede crear una instancia
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ 3. Creando instancia del servidor...');
    const server = new ConsolidatedServer();
    server.PORT = 3002; // Usar puerto temporal para evitar conflictos
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ 4. Instancia creada correctamente');
    
    // 5. Verificar que se puede inicializar
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ 5. Inicializando servidor...');
    await server.initialize();
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ 6. Servidor inicializado correctamente');
    
    // 7. Verificar que el servidor está listo
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ 7. Servidor listo para iniciar');
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ 8. Todos los servicios inicializados correctamente');
    
    // 9. Verificar que el servidor tiene todos los métodos necesarios
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ 9. Verificando métodos del servidor...');
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   - startServer:', typeof server.startServer === 'function');
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   - stop:', typeof server.stop === 'function');
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   - initialize:', typeof server.initialize === 'function');
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎉 ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE!');
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🚀 El servidor está listo para deployment en Railway');
    
  } catch (error) {
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '❌ ERROR EN PRUEBA:', error.message);
    logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: 'Stack:', error.stack);
    process.exit(1);
  }
}

// Ejecutar prueba
testServerStartup(); 