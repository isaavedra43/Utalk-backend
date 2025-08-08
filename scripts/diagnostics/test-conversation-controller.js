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

console.log('=== SIMULACIÓN DE CONVERSATIONCONTROLLER ===');

console.log('1. Estado inicial de req.logger:');
console.log('   req.logger:', req.logger);
console.log('   typeof req.logger:', typeof req.logger);
console.log('   req.logger?.info:', req.logger?.info);
console.log('   typeof req.logger?.info:', typeof req.logger?.info);

// Simular lo que haría correlation.js
console.log('\n2. Después de correlation.js (simulado):');
if (req.logger?.child) {
  req.logger = req.logger.child({ requestId: req.requestId, traceId: req.traceId });
  console.log('   req.logger asignado con child');
} else {
  console.log('   req.logger NO tiene child, NO se asigna');
}

console.log('   req.logger:', req.logger);
console.log('   typeof req.logger:', typeof req.logger);
console.log('   req.logger?.info:', req.logger?.info);
console.log('   typeof req.logger?.info:', typeof req.logger?.info);

// Simular el call site problemático
console.log('\n3. Intentando req.logger?.info():');
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
  console.log('   ✅ req.logger?.info() funcionó');
} catch (error) {
  console.log('   ❌ req.logger?.info() falló:', error.message);
  console.log('   Stack:', error.stack);
}

// Probar con logger directo
console.log('\n4. Comparación con logger directo:');
try {
  logger.info({
    event: 'test_direct_logger',
    requestId: req.requestId,
    traceId: req.traceId
  });
  console.log('   ✅ logger.info() directo funciona');
} catch (error) {
  console.log('   ❌ logger.info() directo falla:', error.message);
} 