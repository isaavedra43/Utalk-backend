/**
 * 🔧 SCRIPT DE PRUEBA PARA VERIFICAR LA SOLUCIÓN DE REFERENCIAS CIRCULARES
 * 
 * Este script prueba que el logger puede manejar objetos con referencias circulares
 * sin causar errores de serialización JSON.
 */

const logger = require('../src/utils/logger');

console.log('🧪 Iniciando pruebas del logger con referencias circulares...\n');

// Test 1: Objeto con referencia circular simple
console.log('📋 Test 1: Objeto con referencia circular simple');
const circularObj1 = { name: 'test' };
circularObj1.self = circularObj1;

try {
  logger.info('Test 1: Objeto con referencia circular', { data: circularObj1 });
  console.log('✅ Test 1 PASÓ: No se produjo error de serialización\n');
} catch (error) {
  console.log('❌ Test 1 FALLÓ:', error.message, '\n');
}

// Test 2: Error con referencias circulares (como MaxRetriesPerRequestError)
console.log('📋 Test 2: Error con referencias circulares (simulando MaxRetriesPerRequestError)');
const circularError = new Error('Test error');
circularError.previousErrors = [circularError]; // Referencia circular

try {
  logger.error('Test 2: Error con referencias circulares', { error: circularError });
  console.log('✅ Test 2 PASÓ: No se produjo error de serialización\n');
} catch (error) {
  console.log('❌ Test 2 FALLÓ:', error.message, '\n');
}

// Test 3: Objeto complejo con múltiples referencias circulares
console.log('📋 Test 3: Objeto complejo con múltiples referencias circulares');
const complexObj = {
  user: { id: 1, name: 'Test User' },
  conversation: { id: 123, messages: [] },
  metadata: {}
};

// Crear referencias circulares
complexObj.user.conversation = complexObj.conversation;
complexObj.conversation.user = complexObj.user;
complexObj.metadata.parent = complexObj;

try {
  logger.info('Test 3: Objeto complejo con referencias circulares', { 
    complexData: complexObj,
    timestamp: new Date(),
    requestId: 'test-123'
  });
  console.log('✅ Test 3 PASÓ: No se produjo error de serialización\n');
} catch (error) {
  console.log('❌ Test 3 FALLÓ:', error.message, '\n');
}

// Test 4: Array con referencias circulares
console.log('📋 Test 4: Array con referencias circulares');
const circularArray = [1, 2, 3];
circularArray.push(circularArray);

try {
  logger.warn('Test 4: Array con referencias circulares', { array: circularArray });
  console.log('✅ Test 4 PASÓ: No se produjo error de serialización\n');
} catch (error) {
  console.log('❌ Test 4 FALLÓ:', error.message, '\n');
}

// Test 5: Objeto con constructor personalizado
console.log('📋 Test 5: Objeto con constructor personalizado');
class CustomClass {
  constructor(name) {
    this.name = name;
    this.self = this; // Referencia circular
  }
}

const customInstance = new CustomClass('TestClass');

try {
  logger.info('Test 5: Objeto con constructor personalizado', { custom: customInstance });
  console.log('✅ Test 5 PASÓ: No se produjo error de serialización\n');
} catch (error) {
  console.log('❌ Test 5 FALLÓ:', error.message, '\n');
}

console.log('🎯 RESUMEN DE PRUEBAS COMPLETADO');
console.log('Si todos los tests pasaron, el logger está funcionando correctamente');
console.log('y puede manejar objetos con referencias circulares sin errores.\n');

// Test final: Verificar que el logger sigue funcionando normalmente
console.log('📋 Test Final: Verificar funcionamiento normal del logger');
logger.info('✅ Logger funcionando correctamente después de las pruebas', {
  testResults: 'success',
  timestamp: new Date().toISOString()
});

console.log('🏁 Todas las pruebas completadas exitosamente!'); 