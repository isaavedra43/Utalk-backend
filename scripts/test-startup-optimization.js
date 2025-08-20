/**
 * 🚀 TEST DE OPTIMIZACIÓN DE INICIO
 * 
 * Script para medir y verificar las optimizaciones de inicio del servidor
 */

const { performance } = require('perf_hooks');
const logger = require('../src/utils/logger');

async function testStartupOptimization() {
  console.log('🚀 Iniciando test de optimización de inicio...\n');
  
  const startTime = performance.now();
  
  try {
    // 1. Test de carga del optimizador
    console.log('📦 1. Cargando optimizador de inicio...');
    const optimizerStart = performance.now();
    const { startupOptimizer } = require('../src/config/startupOptimizer');
    const optimizerTime = performance.now() - optimizerStart;
    console.log(`✅ Optimizador cargado en ${optimizerTime.toFixed(2)}ms\n`);
    
    // 2. Test de aplicación de optimizaciones
    console.log('⚙️ 2. Aplicando optimizaciones...');
    const optimizationStart = performance.now();
    await startupOptimizer.applyOptimizations();
    const optimizationTime = performance.now() - optimizationStart;
    console.log(`✅ Optimizaciones aplicadas en ${optimizationTime.toFixed(2)}ms\n`);
    
    // 3. Test de carga del servidor (sin inicializar)
    console.log('🏗️ 3. Cargando servidor (sin inicializar)...');
    const serverLoadStart = performance.now();
    const { ConsolidatedServer } = require('../src/index');
    const serverLoadTime = performance.now() - serverLoadStart;
    console.log(`✅ Servidor cargado en ${serverLoadTime.toFixed(2)}ms\n`);
    
    // 4. Test de inicialización del servidor
    console.log('🚀 4. Inicializando servidor...');
    const serverInitStart = performance.now();
    const server = new ConsolidatedServer();
    await server.initialize();
    const serverInitTime = performance.now() - serverInitStart;
    console.log(`✅ Servidor inicializado en ${serverInitTime.toFixed(2)}ms\n`);
    
    // 5. Verificar optimizaciones
    console.log('🔍 5. Verificando optimizaciones...');
    const metrics = startupOptimizer.getOptimizationMetrics();
    const verification = startupOptimizer.verifyOptimizations();
    console.log(`✅ Verificación completada: ${verification ? 'PASÓ' : 'FALLÓ'}\n`);
    
    // 6. Métricas finales
    const totalTime = performance.now() - startTime;
    
    console.log('📊 MÉTRICAS DE OPTIMIZACIÓN:');
    console.log('='.repeat(50));
    console.log(`⏱️  Tiempo total: ${totalTime.toFixed(2)}ms`);
    console.log(`📦  Carga optimizador: ${optimizerTime.toFixed(2)}ms`);
    console.log(`⚙️  Aplicación optimizaciones: ${optimizationTime.toFixed(2)}ms`);
    console.log(`🏗️  Carga servidor: ${serverLoadTime.toFixed(2)}ms`);
    console.log(`🚀  Inicialización servidor: ${serverInitTime.toFixed(2)}ms`);
    console.log(`🔍  Optimizaciones aplicadas: ${metrics.optimizationCount}`);
    console.log(`✅  Optimizaciones: ${metrics.optimizationsApplied.join(', ')}`);
    console.log('='.repeat(50));
    
    // 7. Análisis de performance
    console.log('\n📈 ANÁLISIS DE PERFORMANCE:');
    if (totalTime < 5000) {
      console.log('🟢 EXCELENTE: Tiempo de inicio < 5 segundos');
    } else if (totalTime < 10000) {
      console.log('🟡 BUENO: Tiempo de inicio < 10 segundos');
    } else if (totalTime < 15000) {
      console.log('🟠 ACEPTABLE: Tiempo de inicio < 15 segundos');
    } else {
      console.log('🔴 LENTO: Tiempo de inicio > 15 segundos');
    }
    
    // 8. Recomendaciones
    console.log('\n💡 RECOMENDACIONES:');
    if (serverInitTime > 5000) {
      console.log('⚠️  La inicialización del servidor es lenta, considerar más optimizaciones');
    }
    if (optimizationTime > 1000) {
      console.log('⚠️  Las optimizaciones tardan mucho, revisar configuración');
    }
    if (!verification) {
      console.log('⚠️  Algunas optimizaciones no se aplicaron correctamente');
    }
    
    // 9. Limpiar y cerrar
    console.log('\n🧹 Limpiando recursos...');
    if (server && typeof server.gracefulShutdown === 'function') {
      await server.gracefulShutdown('test-completion');
    }
    
    console.log('\n✅ Test de optimización completado exitosamente');
    
  } catch (error) {
    console.error('\n❌ Error durante el test de optimización:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Ejecutar test si es el archivo principal
if (require.main === module) {
  testStartupOptimization().catch(error => {
    console.error('Error fatal en test de optimización:', error);
    process.exit(1);
  });
}

module.exports = { testStartupOptimization }; 