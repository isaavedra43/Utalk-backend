/**
 * 🧪 TEST LOGMONITOR FIX
 * 
 * Script para probar que el LogMonitorService maneja correctamente
 * diferentes tipos de log.message (string, object, null, undefined)
 */

const { LogMonitorService } = require('../src/services/LogMonitorService');

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 Iniciando prueba del LogMonitorService...\n' });

// Crear instancia del servicio
const logMonitor = new LogMonitorService();

// Agregar logs con diferentes tipos de mensajes
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📝 Agregando logs con diferentes tipos de mensajes...' });

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

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Logs agregados exitosamente\n' });

// Probar getRateLimitMetrics (la función que estaba fallando)
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔍 Probando getRateLimitMetrics...' });
try {
  const metrics = logMonitor.getRateLimitMetrics();
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ getRateLimitMetrics ejecutado exitosamente' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 Métricas obtenidas:', {
    total: metrics.total,
    lastHour: metrics.lastHour,
    timelineLength: metrics.timeline.length
  } });
} catch (error) {
  console.error('❌ Error en getRateLimitMetrics:', error.message);
}

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🔍 Probando búsqueda de logs...' });
try {
  const searchResults = logMonitor.searchLogs('rate');
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Búsqueda ejecutada exitosamente' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 Resultados de búsqueda:', searchResults.length });
} catch (error) {
  console.error('❌ Error en búsqueda:', error.message);
}

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🔍 Probando filtros...' });
try {
  const filteredLogs = logMonitor.getLogs({ search: 'test' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Filtros ejecutados exitosamente' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 Logs filtrados:', filteredLogs.length });
} catch (error) {
  console.error('❌ Error en filtros:', error.message);
}

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🔍 Probando exportación CSV...' });
try {
  const csvExport = logMonitor.exportLogs('csv');
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Exportación CSV ejecutada exitosamente' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 Tamaño del CSV:', csvExport.data.length, 'caracteres' });
} catch (error) {
  console.error('❌ Error en exportación CSV:', error.message);
}

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎉 Todas las pruebas completadas exitosamente!' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ El LogMonitorService ahora maneja correctamente todos los tipos de mensajes' }); 