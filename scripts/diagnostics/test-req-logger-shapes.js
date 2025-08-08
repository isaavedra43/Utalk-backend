// Probar diferentes formas de req.logger que podrían causar el error
const logger = require('../../src/utils/logger');

console.log('=== PRUEBA DE DIFERENTES FORMAS DE REQ.LOGGER ===');

// Caso 1: req.logger es undefined
console.log('\n1. req.logger = undefined');
let req = { logger: undefined };
console.log('   req.logger?.info:', req.logger?.info);
console.log('   typeof req.logger?.info:', typeof req.logger?.info);
try {
  req.logger?.info('test');
  console.log('   ✅ No lanza error (retorna undefined)');
} catch (error) {
  console.log('   ❌ Lanza error:', error.message);
}

// Caso 2: req.logger es un string
console.log('\n2. req.logger = "some string"');
req = { logger: 'some string' };
console.log('   req.logger?.info:', req.logger?.info);
console.log('   typeof req.logger?.info:', typeof req.logger?.info);
try {
  req.logger?.info('test');
  console.log('   ✅ No lanza error (retorna undefined)');
} catch (error) {
  console.log('   ❌ Lanza error:', error.message);
}

// Caso 3: req.logger es un objeto con info como string
console.log('\n3. req.logger = { info: "not a function" }');
req = { logger: { info: 'not a function' } };
console.log('   req.logger?.info:', req.logger?.info);
console.log('   typeof req.logger?.info:', typeof req.logger?.info);
try {
  req.logger?.info('test');
  console.log('   ✅ No lanza error (retorna undefined)');
} catch (error) {
  console.log('   ❌ Lanza error:', error.message);
}

// Caso 4: req.logger es un objeto con info como objeto
console.log('\n4. req.logger = { info: {} }');
req = { logger: { info: {} } };
console.log('   req.logger?.info:', req.logger?.info);
console.log('   typeof req.logger?.info:', typeof req.logger?.info);
try {
  req.logger?.info('test');
  console.log('   ✅ No lanza error (retorna undefined)');
} catch (error) {
  console.log('   ❌ Lanza error:', error.message);
}

// Caso 5: req.logger es un objeto con info como función
console.log('\n5. req.logger = { info: function() {} }');
req = { logger: { info: function() { console.log('info called'); } } };
console.log('   req.logger?.info:', req.logger?.info);
console.log('   typeof req.logger?.info:', typeof req.logger?.info);
try {
  req.logger?.info('test');
  console.log('   ✅ Funciona correctamente');
} catch (error) {
  console.log('   ❌ Lanza error:', error.message);
}

// Caso 6: req.logger es el logger real
console.log('\n6. req.logger = logger (real)');
req = { logger: logger };
console.log('   req.logger?.info:', req.logger?.info);
console.log('   typeof req.logger?.info:', typeof req.logger?.info);
try {
  req.logger?.info('test');
  console.log('   ✅ Funciona correctamente');
} catch (error) {
  console.log('   ❌ Lanza error:', error.message);
}

// Caso 7: req.logger es un child logger
console.log('\n7. req.logger = logger.child()');
req = { logger: logger.child({ test: true }) };
console.log('   req.logger?.info:', req.logger?.info);
console.log('   typeof req.logger?.info:', typeof req.logger?.info);
try {
  req.logger?.info('test');
  console.log('   ✅ Funciona correctamente');
} catch (error) {
  console.log('   ❌ Lanza error:', error.message);
} 