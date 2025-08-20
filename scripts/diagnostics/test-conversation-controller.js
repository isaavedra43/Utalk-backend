// Simular contexto de ConversationController.listConversations
const logger = require('../../src/utils/logger');

// Simular req object como lo vería el controlador
const req = {
  user: {
    email: 'test@example.com',
    workspaceId: 'workspace1',
    tenantId: 'tenant1'
  },
  query: {
    status: 'open',
    search: '',
    limit: '20',
    page: '1'
  },
  method: 'GET',
  path: '/api/conversations',
  requestId: 'test-request-id',
  traceId: 'test-trace-id',
  logContext: {
    userCtx: {
      emailMasked: 'tes***@example.com',
      workspaceIdMasked: 'wor***1',
      tenantIdMasked: 'ten***1'
    }
  }
};

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '=== SIMULACIÓN DE CONVERSATIONCONTROLLER ===' });

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '1. Estado inicial de req.logger:' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger:', req.logger });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   typeof req.logger:', typeof req.logger });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger?.info:', req.logger?.info });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   typeof req.logger?.info:', typeof req.logger?.info });

// Simular lo que haría correlation.js
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n2. Después de correlation.js (simulado):');
if (req.logger?.child) {
  req.logger = req.logger.child({ requestId: req.requestId, traceId: req.traceId });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger asignado con child' });
} else {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger NO tiene child, NO se asigna' });
}

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger:', req.logger });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   typeof req.logger:', typeof req.logger });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger?.info:', req.logger?.info });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   typeof req.logger?.info:', typeof req.logger?.info });

// Simular el call site problemático
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n3. Intentando req.logger?.info():');
try {
  req.logger?.info({
    event: 'conversations_list_start',
    requestId: req.requestId,
    traceId: req.traceId,
    http: {
      method: req.method,
      path: req.path
    },
    user: req.logContext?.userCtx || null,
    filters: {
      status: 'open',
      search: '',
      limit: 20,
      page: 1
    }
  });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ✅ req.logger?.info() funcionó');
} catch (error) {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ❌ req.logger?.info() falló:', error.message);
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   Stack:', error.stack });
}

// Probar con logger directo
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n4. Comparación con logger directo:' });
try {
  logger.info({
    event: 'test_direct_logger',
    requestId: req.requestId,
    traceId: req.traceId
  });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ✅ logger.info() directo funciona');
} catch (error) {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ❌ logger.info() directo falla:', error.message);
} 