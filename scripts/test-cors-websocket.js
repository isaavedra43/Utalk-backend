/**
 * 🔧 SCRIPT DE PRUEBA PARA VERIFICAR LA SOLUCIÓN DE CORS WEBSOCKET
 * 
 * Este script verifica que:
 * 1. El CORS WebSocket maneja correctamente origin undefined
 * 2. Las conexiones WebSocket se establecen sin errores de CORS
 * 3. La configuración de CORS es consistente entre HTTP y WebSocket
 * 
 * @version 1.0.0
 */

const { createServer } = require('http');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');
const { corsOptions, socketCorsOptions, isOriginAllowed } = require('../src/config/cors');

// Configuración de prueba
const TEST_CONFIG = {
  PORT: 3002,
  TEST_ORIGINS: [
    'http://localhost:5173',
    'https://utalk-frontend.vercel.app',
    'undefined',
    null,
    ''
  ],
  ALLOWED_ORIGINS: [
    'http://localhost:5173',
    'https://utalk-frontend.vercel.app'
  ]
};

/**
 * Crear servidor de prueba con CORS configurado
 */
function createTestServer() {
  const httpServer = createServer();
  
  const io = new Server(httpServer, {
    cors: socketCorsOptions,
    allowEIO3: true,
    transports: ['websocket', 'polling']
  });
  
  // Configurar eventos básicos
  io.on('connection', (socket) => {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Cliente conectado:', socket.id });
    
    socket.on('test-event', (data) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Evento recibido:', data });
      socket.emit('test-response', { received: data, timestamp: new Date().toISOString() });
    });
    
    socket.on('disconnect', () => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Cliente desconectado:', socket.id });
    });
  });
  
  return { httpServer, io };
}

/**
 * Test 1: Verificar configuración de CORS HTTP
 */
function testHttpCors() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Test 1: Verificar configuración de CORS HTTP' });
  
  let passedTests = 0;
  let totalTests = 0;
  
  TEST_CONFIG.TEST_ORIGINS.forEach(origin => {
    totalTests++;
    
    const isAllowed = isOriginAllowed(origin);
    const expected = TEST_CONFIG.ALLOWED_ORIGINS.includes(origin);
    
    if (isAllowed === expected) {
      logger.info('Origin "${origin}": ${isAllowed ? 'PERMITIDO' : 'BLOQUEADO'} (correcto)', { category: 'AUTO_MIGRATED' });
      passedTests++;
    } else {
      logger.info('❌ Origin "${origin}": ${isAllowed ? 'PERMITIDO' : 'BLOQUEADO'} (esperado: ${expected ? 'PERMITIDO' : 'BLOQUEADO'})', { category: 'AUTO_MIGRATED' });
    }
  });
  
  logger.info('HTTP CORS: ${passedTests}/${totalTests} tests pasaron\n', { category: 'AUTO_MIGRATED' });
  return passedTests === totalTests;
}

/**
 * Test 2: Verificar configuración de CORS WebSocket
 */
function testWebSocketCors() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Test 2: Verificar configuración de CORS WebSocket' });
  
  const { socketCorsOptions } = require('../src/config/cors');
  
  let passedTests = 0;
  let totalTests = 0;
  
  TEST_CONFIG.TEST_ORIGINS.forEach(origin => {
    totalTests++;
    
    // Simular callback de CORS
    let result = null;
    socketCorsOptions.origin(origin, (err, allowed) => {
      result = allowed;
    });
    
    // Para WebSocket, undefined/null debería ser permitido
    const expected = !origin || origin === 'undefined' || origin === 'null' || TEST_CONFIG.ALLOWED_ORIGINS.includes(origin);
    
    if (result === expected) {
      logger.info('WebSocket Origin "${origin}": ${result ? 'PERMITIDO' : 'BLOQUEADO'} (correcto)', { category: 'AUTO_MIGRATED' });
      passedTests++;
    } else {
      logger.info('❌ WebSocket Origin "${origin}": ${result ? 'PERMITIDO' : 'BLOQUEADO'} (esperado: ${expected ? 'PERMITIDO' : 'BLOQUEADO'})', { category: 'AUTO_MIGRATED' });
    }
  });
  
  logger.info('WebSocket CORS: ${passedTests}/${totalTests} tests pasaron\n', { category: 'AUTO_MIGRATED' });
  return passedTests === totalTests;
}

/**
 * Test 3: Verificar conexión WebSocket con origin undefined
 */
async function testWebSocketConnection() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Test 3: Verificar conexión WebSocket con origin undefined' });
  
  const { httpServer, io } = createTestServer();
  
  return new Promise((resolve) => {
    httpServer.listen(TEST_CONFIG.PORT, () => {
      logger.info('Servidor de prueba iniciado en puerto ${TEST_CONFIG.PORT}', { category: 'AUTO_MIGRATED' });
      
      // Intentar conectar sin origin (simulando el problema)
      const socket = Client(`http://localhost:${TEST_CONFIG.PORT}`, {
        transports: ['websocket'],
        // No especificar origin para simular el problema
      });
      
      let connectionSuccess = false;
      let connectionError = null;
      
      socket.on('connect', () => {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Conexión WebSocket exitosa sin origin' });
        connectionSuccess = true;
        
        // Probar evento
        socket.emit('test-event', { message: 'test', origin: 'undefined' });
      });
      
      socket.on('test-response', (data) => {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Respuesta recibida:', data });
        socket.disconnect();
      });
      
      socket.on('connect_error', (error) => {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Error de conexión:', error.message });
        connectionError = error;
      });
      
      socket.on('disconnect', () => {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Cliente desconectado correctamente' });
        
        httpServer.close(() => {
          logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Servidor de prueba cerrado' });
          
          if (connectionSuccess && !connectionError) {
            logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Test 3 PASADO: Conexión WebSocket exitosa\n' });
            resolve(true);
          } else {
            logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Test 3 FALLÓ: Error en conexión WebSocket\n' });
            resolve(false);
          }
        });
      });
      
      // Timeout de seguridad
      setTimeout(() => {
        if (!connectionSuccess) {
          logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Test 3 FALLÓ: Timeout en conexión' });
          socket.disconnect();
          httpServer.close(() => resolve(false));
        }
      }, 5000);
    });
  });
}

/**
 * Test 4: Verificar configuración de allowRequest
 */
function testAllowRequest() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Test 4: Verificar configuración de allowRequest' });
  
  const { socketCorsOptions } = require('../src/config/cors');
  
  if (!socketCorsOptions.allowRequest) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Test 4 FALLÓ: allowRequest no configurado\n' });
    return false;
  }
  
  let passedTests = 0;
  let totalTests = 0;
  
  // Simular requests con diferentes headers
  const testRequests = [
    { headers: {} },  // Sin origin
    { headers: { origin: 'http://localhost:5173' } },  // Origin válido
    { headers: { origin: 'https://malicious.com' } },  // Origin inválido
    { headers: { referer: 'http://localhost:5173' } },  // Referer válido
  ];
  
  testRequests.forEach((req, index) => {
    totalTests++;
    
    let result = null;
    socketCorsOptions.allowRequest(req, (err, allowed) => {
      result = allowed;
    });
    
    const origin = req.headers.origin || req.headers.referer;
    const expected = !origin || isOriginAllowed(origin);
    
    if (result === expected) {
      logger.info('Request ${index + 1}: ${result ? 'PERMITIDO' : 'BLOQUEADO'} (correcto)', { category: 'AUTO_MIGRATED' });
      passedTests++;
    } else {
      logger.info('❌ Request ${index + 1}: ${result ? 'PERMITIDO' : 'BLOQUEADO'} (esperado: ${expected ? 'PERMITIDO' : 'BLOQUEADO'})', { category: 'AUTO_MIGRATED' });
    }
  });
  
  logger.info('allowRequest: ${passedTests}/${totalTests} tests pasaron\n', { category: 'AUTO_MIGRATED' });
  return passedTests === totalTests;
}

/**
 * Test 5: Verificar consistencia entre HTTP y WebSocket CORS
 */
function testCorsConsistency() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Test 5: Verificar consistencia entre HTTP y WebSocket CORS' });
  
  let passedTests = 0;
  let totalTests = 0;
  
  TEST_CONFIG.ALLOWED_ORIGINS.forEach(origin => {
    totalTests++;
    
    const httpAllowed = isOriginAllowed(origin);
    let wsAllowed = null;
    
    const { socketCorsOptions } = require('../src/config/cors');
    socketCorsOptions.origin(origin, (err, allowed) => {
      wsAllowed = allowed;
    });
    
    if (httpAllowed === wsAllowed) {
      logger.info('Origin "${origin}": HTTP=${httpAllowed}, WebSocket=${wsAllowed} (consistente)', { category: 'AUTO_MIGRATED' });
      passedTests++;
    } else {
      logger.info('❌ Origin "${origin}": HTTP=${httpAllowed}, WebSocket=${wsAllowed} (inconsistente)', { category: 'AUTO_MIGRATED' });
    }
  });
  
  logger.info('Consistencia CORS: ${passedTests}/${totalTests} tests pasaron\n', { category: 'AUTO_MIGRATED' });
  return passedTests === totalTests;
}

/**
 * Ejecutar todas las pruebas
 */
async function runAllTests() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🚀 Iniciando pruebas de CORS WebSocket...\n' });
  
  const tests = [
    testHttpCors,
    testWebSocketCors,
    testWebSocketConnection,
    testAllowRequest,
    testCorsConsistency
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  for (const test of tests) {
    try {
      const result = await test();
      if (result) passedTests++;
    } catch (error) {
      logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: `❌ Error en test: ${error.message}`);
    }
  }
  
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 RESULTADOS FINALES:' });
  logger.info('Tests pasados: ${passedTests}/${totalTests}', { category: 'AUTO_MIGRATED' });
  logger.info('❌ Tests fallidos: ${totalTests - passedTests}/${totalTests}', { category: 'AUTO_MIGRATED' });
  
  if (passedTests === totalTests) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎉 ¡TODAS LAS PRUEBAS PASARON!' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ El problema de CORS WebSocket está RESUELTO' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Origin undefined se maneja correctamente' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Las conexiones WebSocket no tienen errores de CORS' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ La configuración es consistente entre HTTP y WebSocket' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ El sistema allowRequest funciona correctamente' });
  } else {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n⚠️ Algunas pruebas fallaron' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔧 Revisa la configuración de CORS WebSocket' });
  }
  
  return passedTests === totalTests;
}

// Ejecutar pruebas si se llama directamente
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testHttpCors,
  testWebSocketCors,
  testWebSocketConnection,
  testAllowRequest,
  testCorsConsistency,
  runAllTests
}; 