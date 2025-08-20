const logger = require('../../src/utils/logger');

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '=== DIAGNÓSTICO RUNTIME DEL LOGGER ===' });

// Simular el objeto req que llegaría a ConversationController
const req = {
  method: 'GET',
  path: '/api/conversations',
  originalUrl: '/api/conversations?page=1&limit=20',
  requestId: 'test-request-id',
  traceId: 'test-trace-id',
  user: {
    email: 'test@example.com',
    workspaceId: 'workspace-1',
    tenantId: 'tenant-1'
  }
};

// Simular lo que haría correlation.js
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '1. Estado inicial de req.logger:' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger:', req.logger }); // undefined

// Simular correlation.js
req.requestId = req.requestId || 'req-' + Date.now();
req.traceId = req.traceId || 'trace-' + Date.now();
req.logContext = { 
  requestId: req.requestId, 
  traceId: req.traceId, 
  userCtx: req.user 
};

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n2. Después de correlation.js (simulado):');
if (req.logger?.child) {
  req.logger = req.logger.child({ requestId: req.requestId, traceId: req.traceId });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger asignado con child' });
} else {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger NO tiene child, NO se asigna' });
}

// Simular databaseLoggingMiddleware (que se ejecuta ANTES que correlation.js)
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n3. Simulando databaseLoggingMiddleware (se ejecuta ANTES):');
req.logger = {
  database: (operation, data) => {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   [DATABASE]', operation, data });
  },
  auth: (operation, data) => {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   [AUTH]', operation, data });
  },
  message: (operation, data) => {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   [MESSAGE]', operation, data });
  },
  media: (operation, data) => {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   [MEDIA]', operation, data });
  },
  twilio: (operation, data) => {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   [TWILIO]', operation, data });
  },
  socket: (operation, data) => {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   [SOCKET]', operation, data });
  },
  security: (operation, data) => {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   [SECURITY]', operation, data });
  },
  error: (message, data) => {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   [ERROR]', message, data });
  },
  success: (operation, data) => {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   [SUCCESS]', operation, data });
  },
  debug: (operation, data) => {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   [DEBUG]', operation, data });
  }
};

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger asignado por databaseLoggingMiddleware' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger tiene métodos:', Object.keys(req.logger));

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n4. Ahora correlation.js intenta crear child:' });
if (req.logger?.child) {
  req.logger = req.logger.child({ requestId: req.requestId, traceId: req.traceId });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger.child() ejecutado');
} else {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger NO tiene child, NO se modifica' });
}

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n5. Estado final de req.logger:' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger:', req.logger });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger.info:', req.logger?.info });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   typeof req.logger?.info:', typeof req.logger?.info });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   req.logger.auth:', req.logger?.auth });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   typeof req.logger?.auth:', typeof req.logger?.auth });

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n6. Intentando req.logger?.info():');
try {
  req.logger?.info('test message');
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ✅ req.logger?.info() funcionó');
} catch (error) {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ❌ req.logger?.info() falló:', error.message);
}

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n7. Intentando req.logger?.auth():');
try {
  req.logger?.auth('test_auth', { test: true });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ✅ req.logger?.auth() funcionó');
} catch (error) {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   ❌ req.logger?.auth() falló:', error.message);
}

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n=== CONCLUSIÓN ===' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'El problema es que databaseLoggingMiddleware asigna req.logger con métodos' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'específicos (auth, database, etc.) pero NO con .info()');
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'Luego correlation.js intenta usar .child() pero req.logger no es un Winston logger');
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'Los controladores intentan usar .info() que no existe en este objeto'); 