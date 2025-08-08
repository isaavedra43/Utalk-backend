const logger = require('../../src/utils/logger');

console.log('=== DIAGNÓSTICO RUNTIME DEL LOGGER ===');

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
console.log('1. Estado inicial de req.logger:');
console.log('   req.logger:', req.logger); // undefined

// Simular correlation.js
req.requestId = req.requestId || 'req-' + Date.now();
req.traceId = req.traceId || 'trace-' + Date.now();
req.logContext = { 
  requestId: req.requestId, 
  traceId: req.traceId, 
  userCtx: req.user 
};

console.log('\n2. Después de correlation.js (simulado):');
if (req.logger?.child) {
  req.logger = req.logger.child({ requestId: req.requestId, traceId: req.traceId });
  console.log('   req.logger asignado con child');
} else {
  console.log('   req.logger NO tiene child, NO se asigna');
}

// Simular databaseLoggingMiddleware (que se ejecuta ANTES que correlation.js)
console.log('\n3. Simulando databaseLoggingMiddleware (se ejecuta ANTES):');
req.logger = {
  database: (operation, data) => {
    console.log('   [DATABASE]', operation, data);
  },
  auth: (operation, data) => {
    console.log('   [AUTH]', operation, data);
  },
  message: (operation, data) => {
    console.log('   [MESSAGE]', operation, data);
  },
  media: (operation, data) => {
    console.log('   [MEDIA]', operation, data);
  },
  twilio: (operation, data) => {
    console.log('   [TWILIO]', operation, data);
  },
  socket: (operation, data) => {
    console.log('   [SOCKET]', operation, data);
  },
  security: (operation, data) => {
    console.log('   [SECURITY]', operation, data);
  },
  error: (message, data) => {
    console.log('   [ERROR]', message, data);
  },
  success: (operation, data) => {
    console.log('   [SUCCESS]', operation, data);
  },
  debug: (operation, data) => {
    console.log('   [DEBUG]', operation, data);
  }
};

console.log('   req.logger asignado por databaseLoggingMiddleware');
console.log('   req.logger tiene métodos:', Object.keys(req.logger));

console.log('\n4. Ahora correlation.js intenta crear child:');
if (req.logger?.child) {
  req.logger = req.logger.child({ requestId: req.requestId, traceId: req.traceId });
  console.log('   req.logger.child() ejecutado');
} else {
  console.log('   req.logger NO tiene child, NO se modifica');
}

console.log('\n5. Estado final de req.logger:');
console.log('   req.logger:', req.logger);
console.log('   req.logger.info:', req.logger?.info);
console.log('   typeof req.logger?.info:', typeof req.logger?.info);
console.log('   req.logger.auth:', req.logger?.auth);
console.log('   typeof req.logger?.auth:', typeof req.logger?.auth);

console.log('\n6. Intentando req.logger?.info():');
try {
  req.logger?.info('test message');
  console.log('   ✅ req.logger?.info() funcionó');
} catch (error) {
  console.log('   ❌ req.logger?.info() falló:', error.message);
}

console.log('\n7. Intentando req.logger?.auth():');
try {
  req.logger?.auth('test_auth', { test: true });
  console.log('   ✅ req.logger?.auth() funcionó');
} catch (error) {
  console.log('   ❌ req.logger?.auth() falló:', error.message);
}

console.log('\n=== CONCLUSIÓN ===');
console.log('El problema es que databaseLoggingMiddleware asigna req.logger con métodos');
console.log('específicos (auth, database, etc.) pero NO con .info()');
console.log('Luego correlation.js intenta usar .child() pero req.logger no es un Winston logger');
console.log('Los controladores intentan usar .info() que no existe en este objeto'); 