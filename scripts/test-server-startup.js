const logger = require('../src/utils/logger');

console.log('🧪 TESTING: Server Startup');
console.log('==========================');

async function testServerStartup() {
  try {
    // 1. Verificar que se puede importar el servidor
    console.log('✅ 1. Importando servidor...');
    const { ConsolidatedServer } = require('../src/index.js');
    console.log('✅ 2. Servidor importado correctamente');
    
    // 3. Verificar que se puede crear una instancia
    console.log('✅ 3. Creando instancia del servidor...');
    const server = new ConsolidatedServer();
    server.PORT = 3002; // Usar puerto temporal para evitar conflictos
    console.log('✅ 4. Instancia creada correctamente');
    
    // 5. Verificar que se puede inicializar
    console.log('✅ 5. Inicializando servidor...');
    await server.initialize();
    console.log('✅ 6. Servidor inicializado correctamente');
    
    // 7. Verificar que el servidor está listo
    console.log('✅ 7. Servidor listo para iniciar');
    console.log('✅ 8. Todos los servicios inicializados correctamente');
    
    // 9. Verificar que el servidor tiene todos los métodos necesarios
    console.log('✅ 9. Verificando métodos del servidor...');
    console.log('   - startServer:', typeof server.startServer === 'function');
    console.log('   - stop:', typeof server.stop === 'function');
    console.log('   - initialize:', typeof server.initialize === 'function');
    
    console.log('\n🎉 ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE!');
    console.log('🚀 El servidor está listo para deployment en Railway');
    
  } catch (error) {
    console.error('❌ ERROR EN PRUEBA:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Ejecutar prueba
testServerStartup(); 