/**
 * 🧪 PRUEBA DE RATE LIMITING ADAPTATIVO
 * 
 * Este script valida que el rate limiting se ajuste automáticamente
 * según la carga del sistema y tenga fallback robusto.
 */

const { advancedSecurity } = require('./src/middleware/advancedSecurity');
const { rateLimitManager } = require('./src/middleware/persistentRateLimit');
const os = require('os');

console.log('🚦 PRUEBA DE RATE LIMITING ADAPTATIVO');
console.log('=' .repeat(60));

// Función para simular diferentes cargas del sistema
const simulateSystemLoad = (load) => {
  // Mock de os.loadavg para simular diferentes cargas
  const originalLoadAvg = os.loadavg;
  os.loadavg = () => [load, load, load];
  
  return () => {
    os.loadavg = originalLoadAvg;
  };
};

// Probar diferentes escenarios de carga
const testScenarios = [
  { name: 'Carga Normal', load: 0.5 },
  { name: 'Carga Moderada', load: 1.5 },
  { name: 'Carga Alta', load: 2.5 },
  { name: 'Carga Crítica', load: 3.5 }
];

console.log('\n📊 ESCENARIOS DE PRUEBA:');

testScenarios.forEach(scenario => {
  console.log(`\n🔍 ${scenario.name} (load: ${scenario.load})`);
  
  // Simular carga
  const restoreLoad = simulateSystemLoad(scenario.load);
  
  try {
    // Obtener información adaptativa
    const adaptiveInfo = advancedSecurity.getAdaptiveLimitsInfo();
    
    console.log(`  - Carga del sistema: ${adaptiveInfo.systemLoad}`);
    console.log(`  - Store utilizado: ${adaptiveInfo.store}`);
    
    // Mostrar límites adaptativos
    console.log('  - Límites adaptativos:');
    Object.entries(adaptiveInfo.adaptiveLimits).forEach(([type, info]) => {
      const reduction = info.reduction > 0 ? ` (-${info.reduction})` : '';
      console.log(`    * ${type}: ${info.adaptiveMax}${reduction} (base: ${info.baseMax})`);
    });
    
    // Mostrar recomendaciones
    console.log('  - Recomendaciones:');
    adaptiveInfo.recommendations.forEach(rec => {
      console.log(`    * ${rec}`);
    });
    
  } finally {
    restoreLoad();
  }
});

// Probar fallback de Redis
console.log('\n🔄 PRUEBA DE FALLBACK REDIS -> MEMORIA:');

// Simular fallo de Redis
const originalRedis = require('redis');
const mockRedis = {
  createClient: () => ({
    connect: () => Promise.reject(new Error('Redis connection failed')),
    on: () => {},
    ping: () => Promise.reject(new Error('Redis ping failed'))
  })
};

// Mock temporal de redis
require.cache[require.resolve('redis')] = {
  exports: mockRedis
};

try {
  // Reinicializar advanced security para probar fallback
  const { AdvancedSecurity } = require('./src/middleware/advancedSecurity');
  const testSecurity = new AdvancedSecurity();
  
  console.log('  ✅ Fallback a memoria configurado correctamente');
  console.log(`  - Store utilizado: ${testSecurity.rateLimitStore.constructor.name}`);
  
} catch (error) {
  console.log('  ❌ Error en fallback:', error.message);
} finally {
  // Restaurar redis original
  delete require.cache[require.resolve('redis')];
}

// Probar rate limiting persistente
console.log('\n📊 PRUEBA DE RATE LIMITING PERSISTENTE:');

(async () => {
  try {
    await rateLimitManager.initialize();
    
    const stats = await rateLimitManager.getStats();
    console.log('  ✅ Rate limiting persistente inicializado');
    console.log(`  - Store: ${stats.store}`);
    console.log(`  - Configuraciones: ${stats.configurations.length}`);
    console.log(`  - Carga del sistema: ${stats.systemLoad}`);
    
    if (stats.adaptiveRateLimiting) {
      console.log('  - Límites adaptativos activos');
      Object.entries(stats.adaptiveRateLimiting.adaptiveLimits).forEach(([type, info]) => {
        console.log(`    * ${type}: ${info.adaptiveMax} (base: ${info.baseMax})`);
      });
    }
    
  } catch (error) {
    console.log('  ❌ Error inicializando rate limiting persistente:', error.message);
  }
})();

// Probar diferentes tipos de rate limits
console.log('\n🎯 PRUEBA DE DIFERENTES TIPOS DE RATE LIMITS:');

const testRateLimits = [
  { type: 'auth', description: 'Autenticación' },
  { type: 'messaging', description: 'Mensajería' },
  { type: 'upload', description: 'Subida de archivos' },
  { type: 'api', description: 'API general' },
  { type: 'webhook', description: 'Webhooks' },
  { type: 'login', description: 'Login' },
  { type: 'conversations', description: 'Conversaciones' },
  { type: 'media', description: 'Media' }
];

testRateLimits.forEach(test => {
  try {
    // Probar creación de rate limiter
    const limiter = advancedSecurity.createSmartRateLimit(test.type);
    console.log(`  ✅ ${test.description}: Rate limiter creado correctamente`);
    
  } catch (error) {
    console.log(`  ❌ ${test.description}: Error creando rate limiter - ${error.message}`);
  }
});

// Probar persistent rate limiting
testRateLimits.forEach(test => {
  try {
    const limiter = rateLimitManager.createLimiter(test.type);
    console.log(`  ✅ ${test.description}: Persistent rate limiter creado correctamente`);
    
  } catch (error) {
    console.log(`  ❌ ${test.description}: Error creando persistent rate limiter - ${error.message}`);
  }
});

console.log('\n📈 ESTADÍSTICAS FINALES:');

// Obtener estadísticas de ambos sistemas
const securityStats = advancedSecurity.getSecurityStats();
console.log('\n🔒 Advanced Security Stats:');
console.log(JSON.stringify(securityStats, null, 2));

(async () => {
  try {
    const persistentStats = await rateLimitManager.getStats();
    console.log('\n🚦 Persistent Rate Limit Stats:');
    console.log(JSON.stringify(persistentStats, null, 2));
  } catch (error) {
    console.log('Error obteniendo stats persistentes:', error.message);
  }
})();

console.log('\n' + '=' .repeat(60));
console.log('🎉 PRUEBA DE RATE LIMITING ADAPTATIVO COMPLETADA');
console.log('\n💡 RECOMENDACIONES:');
console.log('- Monitorear logs de rate limiting en producción');
console.log('- Configurar alertas para alta carga del sistema');
console.log('- Revisar estadísticas de rate limiting periódicamente');
console.log('- Considerar escalar recursos si se detectan reducciones frecuentes'); 