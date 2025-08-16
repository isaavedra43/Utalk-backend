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
    console.log('✅ Cliente conectado:', socket.id);
    
    socket.on('test-event', (data) => {
      console.log('✅ Evento recibido:', data);
      socket.emit('test-response', { received: data, timestamp: new Date().toISOString() });
    });
    
    socket.on('disconnect', () => {
      console.log('✅ Cliente desconectado:', socket.id);
    });
  });
  
  return { httpServer, io };
}

/**
 * Test 1: Verificar configuración de CORS HTTP
 */
function testHttpCors() {
  console.log('📋 Test 1: Verificar configuración de CORS HTTP');
  
  let passedTests = 0;
  let totalTests = 0;
  
  TEST_CONFIG.TEST_ORIGINS.forEach(origin => {
    totalTests++;
    
    const isAllowed = isOriginAllowed(origin);
    const expected = TEST_CONFIG.ALLOWED_ORIGINS.includes(origin);
    
    if (isAllowed === expected) {
      console.log(`✅ Origin "${origin}": ${isAllowed ? 'PERMITIDO' : 'BLOQUEADO'} (correcto)`);
      passedTests++;
    } else {
      console.log(`❌ Origin "${origin}": ${isAllowed ? 'PERMITIDO' : 'BLOQUEADO'} (esperado: ${expected ? 'PERMITIDO' : 'BLOQUEADO'})`);
    }
  });
  
  console.log(`📊 HTTP CORS: ${passedTests}/${totalTests} tests pasaron\n`);
  return passedTests === totalTests;
}

/**
 * Test 2: Verificar configuración de CORS WebSocket
 */
function testWebSocketCors() {
  console.log('📋 Test 2: Verificar configuración de CORS WebSocket');
  
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
      console.log(`✅ WebSocket Origin "${origin}": ${result ? 'PERMITIDO' : 'BLOQUEADO'} (correcto)`);
      passedTests++;
    } else {
      console.log(`❌ WebSocket Origin "${origin}": ${result ? 'PERMITIDO' : 'BLOQUEADO'} (esperado: ${expected ? 'PERMITIDO' : 'BLOQUEADO'})`);
    }
  });
  
  console.log(`📊 WebSocket CORS: ${passedTests}/${totalTests} tests pasaron\n`);
  return passedTests === totalTests;
}

/**
 * Test 3: Verificar conexión WebSocket con origin undefined
 */
async function testWebSocketConnection() {
  console.log('📋 Test 3: Verificar conexión WebSocket con origin undefined');
  
  const { httpServer, io } = createTestServer();
  
  return new Promise((resolve) => {
    httpServer.listen(TEST_CONFIG.PORT, () => {
      console.log(`✅ Servidor de prueba iniciado en puerto ${TEST_CONFIG.PORT}`);
      
      // Intentar conectar sin origin (simulando el problema)
      const socket = Client(`http://localhost:${TEST_CONFIG.PORT}`, {
        transports: ['websocket'],
        // No especificar origin para simular el problema
      });
      
      let connectionSuccess = false;
      let connectionError = null;
      
      socket.on('connect', () => {
        console.log('✅ Conexión WebSocket exitosa sin origin');
        connectionSuccess = true;
        
        // Probar evento
        socket.emit('test-event', { message: 'test', origin: 'undefined' });
      });
      
      socket.on('test-response', (data) => {
        console.log('✅ Respuesta recibida:', data);
        socket.disconnect();
      });
      
      socket.on('connect_error', (error) => {
        console.log('❌ Error de conexión:', error.message);
        connectionError = error;
      });
      
      socket.on('disconnect', () => {
        console.log('✅ Cliente desconectado correctamente');
        
        httpServer.close(() => {
          console.log('✅ Servidor de prueba cerrado');
          
          if (connectionSuccess && !connectionError) {
            console.log('✅ Test 3 PASADO: Conexión WebSocket exitosa\n');
            resolve(true);
          } else {
            console.log('❌ Test 3 FALLÓ: Error en conexión WebSocket\n');
            resolve(false);
          }
        });
      });
      
      // Timeout de seguridad
      setTimeout(() => {
        if (!connectionSuccess) {
          console.log('❌ Test 3 FALLÓ: Timeout en conexión');
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
  console.log('📋 Test 4: Verificar configuración de allowRequest');
  
  const { socketCorsOptions } = require('../src/config/cors');
  
  if (!socketCorsOptions.allowRequest) {
    console.log('❌ Test 4 FALLÓ: allowRequest no configurado\n');
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
      console.log(`✅ Request ${index + 1}: ${result ? 'PERMITIDO' : 'BLOQUEADO'} (correcto)`);
      passedTests++;
    } else {
      console.log(`❌ Request ${index + 1}: ${result ? 'PERMITIDO' : 'BLOQUEADO'} (esperado: ${expected ? 'PERMITIDO' : 'BLOQUEADO'})`);
    }
  });
  
  console.log(`📊 allowRequest: ${passedTests}/${totalTests} tests pasaron\n`);
  return passedTests === totalTests;
}

/**
 * Test 5: Verificar consistencia entre HTTP y WebSocket CORS
 */
function testCorsConsistency() {
  console.log('📋 Test 5: Verificar consistencia entre HTTP y WebSocket CORS');
  
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
      console.log(`✅ Origin "${origin}": HTTP=${httpAllowed}, WebSocket=${wsAllowed} (consistente)`);
      passedTests++;
    } else {
      console.log(`❌ Origin "${origin}": HTTP=${httpAllowed}, WebSocket=${wsAllowed} (inconsistente)`);
    }
  });
  
  console.log(`📊 Consistencia CORS: ${passedTests}/${totalTests} tests pasaron\n`);
  return passedTests === totalTests;
}

/**
 * Ejecutar todas las pruebas
 */
async function runAllTests() {
  console.log('🚀 Iniciando pruebas de CORS WebSocket...\n');
  
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
      console.error(`❌ Error en test: ${error.message}`);
    }
  }
  
  console.log('📊 RESULTADOS FINALES:');
  console.log(`✅ Tests pasados: ${passedTests}/${totalTests}`);
  console.log(`❌ Tests fallidos: ${totalTests - passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 ¡TODAS LAS PRUEBAS PASARON!');
    console.log('✅ El problema de CORS WebSocket está RESUELTO');
    console.log('✅ Origin undefined se maneja correctamente');
    console.log('✅ Las conexiones WebSocket no tienen errores de CORS');
    console.log('✅ La configuración es consistente entre HTTP y WebSocket');
    console.log('✅ El sistema allowRequest funciona correctamente');
  } else {
    console.log('\n⚠️ Algunas pruebas fallaron');
    console.log('🔧 Revisa la configuración de CORS WebSocket');
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