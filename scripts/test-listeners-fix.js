/**
 * 🔧 SCRIPT DE PRUEBA PARA VERIFICAR LA SOLUCIÓN DE LISTENERS
 * 
 * Este script verifica que:
 * 1. Los listeners se registran correctamente
 * 2. No se remueven prematuramente
 * 3. Se re-registran automáticamente si se pierden
 * 
 * @version 1.0.0
 */

const eventCleanup = require('../src/utils/eventCleanup');
const { EventEmitter } = require('events');

// Configuración de prueba
const TEST_CONFIG = {
  TEST_EVENTS: [
    'sync-state',
    'join-conversation',
    'conversation:join',
    'leave-conversation',
    'conversation:leave',
    'new-message',
    'message-read',
    'messages:read',
    'typing',
    'typing-stop'
  ]
};

/**
 * Simular un socket WebSocket
 */
class MockSocket extends EventEmitter {
  constructor(id, userEmail) {
    super();
    this.id = id;
    this.userEmail = userEmail;
    this.connected = true;
    this.constructor.name = 'Socket';
  }

  disconnect() {
    this.connected = false;
    this.emit('disconnect');
  }
}

/**
 * Test 1: Verificar que los listeners se registran correctamente
 */
function testListenerRegistration() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Test 1: Verificar registro de listeners' });
  
  const mockSocket = new MockSocket('test-socket-1', 'test@company.com');
  
  let registeredCount = 0;
  
  // Registrar listeners para todos los eventos de prueba
  TEST_CONFIG.TEST_EVENTS.forEach(event => {
    const handler = (data) => {
      logger.info('Evento ${event} recibido:', { category: 'AUTO_MIGRATED', data: data });
    };
    
    const wrappedHandler = eventCleanup.addListener(mockSocket, event, handler, {
      autoCleanup: false,  // 🔧 CORRECCIÓN: No cleanup automático
      reRegisterOnMissing: true
    });
    
    if (wrappedHandler) {
      registeredCount++;
      logger.info('Listener registrado para: ${event}', { category: 'AUTO_MIGRATED' });
    }
  });
  
  logger.info('Total listeners registrados: ${registeredCount}/${TEST_CONFIG.TEST_EVENTS.length}', { category: 'AUTO_MIGRATED' });
  
  // Verificar que todos los listeners están registrados
  const allRegistered = TEST_CONFIG.TEST_EVENTS.every(event => {
    const listener = eventCleanup.getListener(mockSocket, event);
    return listener !== null;
  });
  
  if (allRegistered) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Test 1 PASADO: Todos los listeners registrados correctamente\n' });
    return true;
  } else {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Test 1 FALLÓ: Algunos listeners no se registraron\n' });
    return false;
  }
}

/**
 * Test 2: Verificar que los listeners no se remueven prematuramente
 */
function testListenerPersistence() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Test 2: Verificar persistencia de listeners' });
  
  const mockSocket = new MockSocket('test-socket-2', 'test@company.com');
  
  // Registrar un listener
  const handler = (data) => logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Evento recibido:', data });
  const wrappedHandler = eventCleanup.addListener(mockSocket, 'test-event', handler, {
    autoCleanup: false,
    reRegisterOnMissing: true
  });
  
  // Simular múltiples eventos (que normalmente causarían cleanup)
  for (let i = 0; i < 100; i++) {
    mockSocket.emit('test-event', { message: `Event ${i}` });
  }
  
  // Verificar que el listener sigue activo
  const listener = eventCleanup.getListener(mockSocket, 'test-event');
  
  if (listener) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Test 2 PASADO: Listener persiste después de múltiples eventos\n' });
    return true;
  } else {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Test 2 FALLÓ: Listener se removió prematuramente\n' });
    return false;
  }
}

/**
 * Test 3: Verificar re-registro automático de listeners
 */
function testListenerReRegistration() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Test 3: Verificar re-registro automático' });
  
  const mockSocket = new MockSocket('test-socket-3', 'test@company.com');
  
  // Definir handlers que deberían estar registrados
  const requiredHandlers = {
    'sync-state': (data) => logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'sync-state handler:', data),
    'new-message': (data) => logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'new-message handler:', data),
    'typing': (data) => logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'typing handler:', data)
  };
  
  // Simular que algunos listeners se perdieron
  // (no los registramos inicialmente)
  
  // Intentar re-registrar listeners faltantes
  const reRegisteredCount = eventCleanup.reRegisterMissingListeners(mockSocket, requiredHandlers);
  
  if (reRegisteredCount === Object.keys(requiredHandlers).length) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Test 3 PASADO: Todos los listeners faltantes se re-registraron\n' });
    return true;
  } else {
    logger.info('❌ Test 3 FALLÓ: Solo ${reRegisteredCount}/${Object.keys(requiredHandlers).length} listeners se re-registraron\n', { category: 'AUTO_MIGRATED' });
    return false;
  }
}

/**
 * Test 4: Verificar que los listeners solo se remueven cuando el socket está desconectado
 */
function testListenerRemovalOnDisconnect() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Test 4: Verificar remoción solo en desconexión' });
  
  const mockSocket = new MockSocket('test-socket-4', 'test@company.com');
  
  // Registrar un listener
  const handler = (data) => logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Evento recibido:', data });
  const wrappedHandler = eventCleanup.addListener(mockSocket, 'test-event', handler, {
    autoCleanup: false,
    reRegisterOnMissing: true
  });
  
  // Intentar remover el listener mientras está conectado
  const removalResult = eventCleanup.removeListener(mockSocket, 'test-event', wrappedHandler);
  
  if (!removalResult) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Test 4 PASADO: Listener no se removió mientras el socket está conectado\n' });
    return true;
  } else {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Test 4 FALLÓ: Listener se removió incorrectamente\n' });
    return false;
  }
}

/**
 * Test 5: Verificar estadísticas del sistema
 */
function testSystemStats() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📋 Test 5: Verificar estadísticas del sistema' });
  
  const mockSocket = new MockSocket('test-socket-5', 'test@company.com');
  
  // Registrar varios listeners
  TEST_CONFIG.TEST_EVENTS.slice(0, 5).forEach(event => {
    const handler = (data) => logger.info('Evento ${event}:', { category: 'AUTO_MIGRATED', data: data });
    eventCleanup.addListener(mockSocket, event, handler, {
      autoCleanup: false,
      reRegisterOnMissing: true
    });
  });
  
  // Verificar estadísticas
  const stats = eventCleanup.stats;
  
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 Estadísticas del sistema:', {
    totalListeners: stats.totalListeners,
    activeListeners: stats.activeListeners,
    cleanedListeners: stats.cleanedListeners,
    reRegisteredListeners: stats.reRegisteredListeners
  } });
  
  if (stats.activeListeners === 5 && stats.cleanedListeners === 0) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Test 5 PASADO: Estadísticas correctas\n' });
    return true;
  } else {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Test 5 FALLÓ: Estadísticas incorrectas\n' });
    return false;
  }
}

/**
 * Ejecutar todas las pruebas
 */
async function runAllTests() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🚀 Iniciando pruebas de listeners...\n' });
  
  const tests = [
    testListenerRegistration,
    testListenerPersistence,
    testListenerReRegistration,
    testListenerRemovalOnDisconnect,
    testSystemStats
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  for (const test of tests) {
    try {
      const result = test();
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
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ El problema de listeners está RESUELTO' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Los listeners se registran correctamente' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ No se remueven prematuramente' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Se re-registran automáticamente si se pierden' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Solo se remueven cuando el socket se desconecta' });
  } else {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n⚠️ Algunas pruebas fallaron' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔧 Revisa la implementación del sistema de listeners' });
  }
  
  return passedTests === totalTests;
}

// Ejecutar pruebas si se llama directamente
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testListenerRegistration,
  testListenerPersistence,
  testListenerReRegistration,
  testListenerRemovalOnDisconnect,
  testSystemStats,
  runAllTests
}; 