// Probar diferentes formas de req.logger que podrían causar el error
const logger = require('../../src/utils/logger');

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '=== PRUEBA DE DIFERENTES FORMAS DE REQ.LOGGER ===' });

// Caso 1: req.logger es undefined
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n1. req.logger = undefined' });
let req = { logger: undefined };
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger?.info:', req.logger?.info });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   typeof req.logger?.info:', typeof req.logger?.info });
try {
  req.logger?.info('test');
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ✅ No lanza error (retorna undefined)');
} catch (error) {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ❌ Lanza error:', error.message });
}

// Caso 2: req.logger es un string
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n2. req.logger = "some string"' });
req = { logger: 'some string' };
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger?.info:', req.logger?.info });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   typeof req.logger?.info:', typeof req.logger?.info });
try {
  req.logger?.info('test');
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ✅ No lanza error (retorna undefined)');
} catch (error) {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ❌ Lanza error:', error.message });
}

// Caso 3: req.logger es un objeto con info como string
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n3. req.logger = { info: "not a function" }' });
req = { logger: { info: 'not a function' } };
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger?.info:', req.logger?.info });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   typeof req.logger?.info:', typeof req.logger?.info });
try {
  req.logger?.info('test');
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ✅ No lanza error (retorna undefined)');
} catch (error) {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ❌ Lanza error:', error.message });
}

// Caso 4: req.logger es un objeto con info como objeto
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n4. req.logger = { info: {} }' });
req = { logger: { info: {} } };
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger?.info:', req.logger?.info });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   typeof req.logger?.info:', typeof req.logger?.info });
try {
  req.logger?.info('test');
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ✅ No lanza error (retorna undefined)');
} catch (error) {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ❌ Lanza error:', error.message });
}

// Caso 5: req.logger es un objeto con info como función
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n5. req.logger = { info: function() {} }');
req = { logger: { info: function() { logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'info called' }); } } };
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger?.info:', req.logger?.info });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   typeof req.logger?.info:', typeof req.logger?.info });
try {
  req.logger?.info('test');
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ✅ Funciona correctamente' });
} catch (error) {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ❌ Lanza error:', error.message });
}

// Caso 6: req.logger es el logger real
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n6. req.logger = logger (real)');
req = { logger: logger };
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger?.info:', req.logger?.info });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   typeof req.logger?.info:', typeof req.logger?.info });
try {
  req.logger?.info('test');
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ✅ Funciona correctamente' });
} catch (error) {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ❌ Lanza error:', error.message });
}

// Caso 7: req.logger es un child logger
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n7. req.logger = logger.child()');
req = { logger: logger.child({ test: true }) };
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger?.info:', req.logger?.info });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   typeof req.logger?.info:', typeof req.logger?.info });
try {
  req.logger?.info('test');
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ✅ Funciona correctamente' });
} catch (error) {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ❌ Lanza error:', error.message });
} 