const logger = require('../../src/utils/logger');

function describe(name, obj) {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: name, {
    isObject: !!obj && typeof obj === 'object',
    keys: obj ? Object.keys(obj) : null,
    types: obj ? Object.fromEntries(Object.keys(obj).slice(0, 10).map(k => [k, typeof obj[k]])) : null,
    hasChild: !!obj?.child,
    infoType: typeof obj?.info,
    warnType: typeof obj?.warn,
    errorType: typeof obj?.error,
  });
}

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '=== DIAGNÓSTICO DEL LOGGER ===' });
describe('logger', logger);

if (logger?.child) {
  const child = logger.child({ probe: true });
  describe('logger.child({})', child);
}

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n=== PRUEBA DE INVOCACIÓN ===' });
try {
  logger.info('Test message', { test: true });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ logger.info() funciona');
} catch (error) {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ logger.info() falla:', error.message);
}

if (logger?.child) {
  try {
    const child = logger.child({ requestId: 'test' });
    child.info('Child test message');
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ logger.child().info() funciona');
  } catch (error) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ logger.child().info() falla:', error.message);
  }
} 