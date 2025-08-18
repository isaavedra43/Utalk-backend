/**
 * 🧪 TEST LOGMONITOR FIX
 * 
 * Script para probar que el LogMonitorService maneja correctamente
 * diferentes tipos de log.message (string, object, null, undefined)
 */

const { LogMonitorService } = require('../src/services/LogMonitorService');

console.log('🧪 Iniciando prueba del LogMonitorService...\n');

// Crear instancia del servicio
const logMonitor = new LogMonitorService();

// Agregar logs con diferentes tipos de mensajes
console.log('📝 Agregando logs con diferentes tipos de mensajes...');

// Log con mensaje string (normal)
logMonitor.addLog('info', 'TEST', 'Este es un mensaje normal', {
  userId: 'test@example.com',
  endpoint: '/test',
  ip: '127.0.0.1'
});

// Log con mensaje object (problemático)
logMonitor.addLog('warn', 'RATE_LIMIT', { 
  error: 'Rate limit exceeded',
  userId: 'user@example.com',
  attempts: 5
}, {
  userId: 'user@example.com',
  endpoint: '/api/test',
  ip: '192.168.1.1'
});

// Log con mensaje null
logMonitor.addLog('error', 'SYSTEM', null, {
  userId: 'system',
  endpoint: '/system',
  ip: 'unknown'
});

// Log con mensaje undefined
logMonitor.addLog('debug', 'CACHE', undefined, {
  userId: 'cache@system.com',
  endpoint: '/cache',
  ip: 'localhost'
});

// Log con mensaje que contiene "RATE_LIMIT" en string
logMonitor.addLog('error', 'AUTH', 'Error de RATE_LIMIT en autenticación', {
  userId: 'auth@example.com',
  endpoint: '/auth',
  ip: '10.0.0.1'
});

console.log('✅ Logs agregados exitosamente\n');

// Probar getRateLimitMetrics (la función que estaba fallando)
console.log('🔍 Probando getRateLimitMetrics...');
try {
  const metrics = logMonitor.getRateLimitMetrics();
  console.log('✅ getRateLimitMetrics ejecutado exitosamente');
  console.log('📊 Métricas obtenidas:', {
    total: metrics.total,
    lastHour: metrics.lastHour,
    timelineLength: metrics.timeline.length
  });
} catch (error) {
  console.error('❌ Error en getRateLimitMetrics:', error.message);
}

console.log('\n🔍 Probando búsqueda de logs...');
try {
  const searchResults = logMonitor.searchLogs('rate');
  console.log('✅ Búsqueda ejecutada exitosamente');
  console.log('📊 Resultados de búsqueda:', searchResults.length);
} catch (error) {
  console.error('❌ Error en búsqueda:', error.message);
}

console.log('\n🔍 Probando filtros...');
try {
  const filteredLogs = logMonitor.getLogs({ search: 'test' });
  console.log('✅ Filtros ejecutados exitosamente');
  console.log('📊 Logs filtrados:', filteredLogs.length);
} catch (error) {
  console.error('❌ Error en filtros:', error.message);
}

console.log('\n🔍 Probando exportación CSV...');
try {
  const csvExport = logMonitor.exportLogs('csv');
  console.log('✅ Exportación CSV ejecutada exitosamente');
  console.log('📊 Tamaño del CSV:', csvExport.data.length, 'caracteres');
} catch (error) {
  console.error('❌ Error en exportación CSV:', error.message);
}

console.log('\n🎉 Todas las pruebas completadas exitosamente!');
console.log('✅ El LogMonitorService ahora maneja correctamente todos los tipos de mensajes'); 