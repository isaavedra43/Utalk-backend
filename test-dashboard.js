/**
 * 🧪 SCRIPT DE PRUEBA PARA DASHBOARD DE LOGS
 * 
 * Este script genera logs de prueba y verifica que el dashboard funcione
 */

const logger = require('./src/utils/logger');

console.log('🧪 Iniciando prueba del dashboard de logs...');

// Generar logs de prueba
function generateTestLogs() {
  console.log('📝 Generando logs de prueba...');
  
  // Logs del sistema
  logger.info('Sistema iniciado correctamente', { 
    category: 'SYSTEM', 
    userId: 'system',
    endpoint: '/api/logs',
    ip: '127.0.0.1'
  });
  
  logger.info('Conexión a base de datos establecida', { 
    category: 'DATABASE', 
    userId: 'system',
    endpoint: '/api/logs',
    ip: '127.0.0.1'
  });
  
  // Logs de cache
  logger.warn('Cache miss en consulta de usuarios', { 
    category: 'CACHE', 
    userId: 'system',
    endpoint: '/api/users',
    ip: '127.0.0.1'
  });
  
  // Logs de WebSocket
  logger.info('Nueva conexión WebSocket establecida', { 
    category: 'WEBSOCKET', 
    userId: 'user_123',
    endpoint: '/socket.io',
    ip: '192.168.1.100'
  });
  
  // Logs de API
  logger.error('Error en endpoint de autenticación', { 
    category: 'API', 
    userId: 'user_456',
    endpoint: '/api/auth/login',
    ip: '10.0.0.50'
  });
  
  // Logs de mensajes
  logger.info('Mensaje enviado exitosamente', { 
    category: 'MESSAGE', 
    userId: 'user_789',
    endpoint: '/api/messages',
    ip: '172.16.0.25'
  });
  
  // Logs de rate limit
  logger.debug('Rate limit check completado', { 
    category: 'RATE_LIMIT', 
    userId: 'user_101',
    endpoint: '/api/auth',
    ip: '203.0.113.10'
  });
  
  // Logs de performance
  logger.warn('Tiempo de respuesta lento detectado', { 
    category: 'PERFORMANCE', 
    userId: 'system',
    endpoint: '/api/messages',
    ip: '127.0.0.1'
  });
  
  // Logs de servicios externos
  logger.error('Error de conexión a servicio externo', { 
    category: 'EXTERNAL_SERVICE', 
    userId: 'system',
    endpoint: '/api/twilio',
    ip: '127.0.0.1'
  });
  
  console.log('✅ Logs de prueba generados');
}

// Generar logs con intervalos
function generateLogsWithIntervals() {
  console.log('⏰ Generando logs con intervalos...');
  
  const intervals = [
    { delay: 1000, log: () => logger.info('Procesamiento de mensaje completado', { category: 'MESSAGE', userId: 'user_202' }) },
    { delay: 2000, log: () => logger.warn('Tiempo de respuesta lento detectado', { category: 'PERFORMANCE', userId: 'system' }) },
    { delay: 3000, log: () => logger.error('Error de conexión a servicio externo', { category: 'EXTERNAL_SERVICE', userId: 'system' }) },
    { delay: 4000, log: () => logger.info('Cache hit en consulta de contactos', { category: 'CACHE', userId: 'user_303' }) },
    { delay: 5000, log: () => logger.debug('Validación de token completada', { category: 'AUTH', userId: 'user_404' }) }
  ];
  
  intervals.forEach(({ delay, log }) => {
    setTimeout(() => {
      log();
    }, delay);
  });
  
  console.log('✅ Logs con intervalos programados');
}

// Ejecutar pruebas
async function runTests() {
  try {
    // Generar logs iniciales
    generateTestLogs();
    
    // Esperar un poco
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generar logs con intervalos
    generateLogsWithIntervals();
    
    console.log('🎉 Pruebas completadas. Revisa el dashboard en:');
    console.log('   - Dashboard HTML: http://localhost:3001/logs');
    console.log('   - API de logs: http://localhost:3001/api/logs');
    console.log('   - Estadísticas: http://localhost:3001/api/logs/dashboard');
    
  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runTests();
}

module.exports = { generateTestLogs, generateLogsWithIntervals }; 