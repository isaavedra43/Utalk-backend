# 🎯 **SISTEMA DE LOGGING AVANZADO - UTALK BACKEND**

## **📋 RESUMEN**

Sistema completo de logs estructurado, visual y profesional que cubre todos los procesos críticos del backend. Perfecto para debugging, monitoreo y análisis de errores.

---

## **🎨 CATEGORÍAS DE LOGS**

### **🔐 AUTENTICACIÓN (AUTH)**
```javascript
req.logger.auth('login_attempt', { email, ip, userAgent });
req.logger.auth('login_success', { email, role, department });
req.logger.auth('login_failed', { reason: 'invalid_credentials', email });
req.logger.auth('token_generated', { email, expiresIn: '24h' });
req.logger.auth('token_validated', { email, role });
req.logger.auth('permission_denied', { operation, userEmail, userRole });
```

### **🔌 SOCKET.IO (SOCKET)**
```javascript
req.logger.socket('client_connected', { socketId, userEmail, connectedUsers });
req.logger.socket('room_joined', { socketId, conversationId, userEmail });
req.logger.socket('message_emitted', { messageId, conversationId });
req.logger.socket('rate_limit_exceeded', { event, timeSinceLastEvent });
```

### **💬 MENSAJES (MESSAGE)**
```javascript
req.logger.message('received_inbound', { messageId, conversationId, fromPhone });
req.logger.message('sent_outbound', { messageId, toPhone, senderEmail });
req.logger.message('processing_started', { conversationId, messageId, type });
req.logger.message('processing_completed', { messageId, successful: true });
```

### **🔗 WEBHOOKS (WEBHOOK)**
```javascript
req.logger.webhook('received', { source: 'twilio', event: 'message.received' });
req.logger.webhook('validated', { signature: 'valid', twilioSid });
req.logger.webhook('processed', { messageId, processingTime: '200ms' });
```

### **💾 BASE DE DATOS (DATABASE)**
```javascript
req.logger.database('query_started', { operation: 'user_by_email', email });
req.logger.database('query_completed', { duration: '45ms', documentsRead: 1 });
req.logger.database('document_created', { operation, documentId, collection });
req.logger.database('query_slow', { operation, duration: '2500ms' });
```

### **📎 MULTIMEDIA (MEDIA)**
```javascript
req.logger.media('upload_started', { filename, size, category });
req.logger.media('processing_completed', { filename, originalSize, compressedSize });
req.logger.media('whatsapp_compatible', { category, messageId });
req.logger.media('transcription_completed', { audioFile, transcription });
```

### **📞 TWILIO (TWILIO)**
```javascript
req.logger.twilio('message_sent', { twilioSid, toPhone, messageType });
req.logger.twilio('media_sent', { twilioSid, mediaType, mediaUrl });
req.logger.twilio('delivery_status', { twilioSid, status: 'delivered' });
```

### **🔥 FIREBASE (FIREBASE)**
```javascript
req.logger.firebase('storage_upload', { filename, storagePath, size });
req.logger.firebase('firestore_write', { collection, documentId, operation });
req.logger.firebase('bucket_access', { operation: 'file_upload' });
```

### **🛡️ SEGURIDAD (SECURITY)**
```javascript
req.logger.security('suspicious_activity', { type: 'multiple_failed_logins', ip });
req.logger.security('unauthorized_access', { operation, userEmail, userRole });
req.logger.security('ip_blocked', { ip, reason: 'brute_force_attempts' });
```

### **⚡ PERFORMANCE (PERFORMANCE)**
```javascript
req.logger.performance('request_slow', { path, method, duration: '3500ms' });
req.logger.performance('memory_high', { heapUsed: '245MB', threshold: '200MB' });
req.logger.performance('bottleneck_detected', { component: 'database_queries' });
```

---

## **🎯 MÉTODOS DE CONVENIENCIA**

### **Logs Básicos**
```javascript
req.logger.info('Operación completada', { data });
req.logger.warn('Configuración sospechosa', { setting, value });
req.logger.error('Error crítico', { error: error.message });
req.logger.success('Proceso exitoso', { result });
req.logger.debug('Info de debugging', { variables });
```

### **Timing de Performance**
```javascript
const startTime = Date.now();
// ... operación ...
req.logger.timing('database_query', startTime, { operation: 'user_search' });
```

---

## **🔧 USO EN CONTROLADORES**

### **Estructura Recomendada**
```javascript
static async miMetodo(req, res, next) {
  try {
    // 1. Log de inicio
    req.logger.info('Iniciando operación', { operation: 'mi_metodo' });
    
    // 2. Logs específicos de proceso
    req.logger.database('query_started', { operation: 'buscar_usuario' });
    
    const user = await User.getByEmail(email);
    
    req.logger.database('query_completed', { found: !!user });
    
    // 3. Log de éxito
    req.logger.success('Operación completada', { userId: user.id });
    
    return ResponseHandler.success(res, user);
  } catch (error) {
    // 4. Log de error
    req.logger.error('Error en operación', {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3)
    });
    next(error);
  }
}
```

---

## **🎨 FORMATO VISUAL**

### **En Desarrollo**
```
[2025-07-30T16:58:47.259Z] 🔐 AUTH[req_123]{user@company.com} Login exitoso
   📊 {
   "email": "user@company.com",
   "role": "admin",
   "department": "IT"
}
```

### **En Producción (JSON)**
```json
{
  "timestamp": "2025-07-30T16:58:47.259Z",
  "level": "INFO",
  "category": "AUTH",
  "message": "Login exitoso",
  "requestId": "req_123",
  "userEmail": "user@company.com",
  "email": "user@company.com",
  "role": "admin",
  "department": "IT"
}
```

---

## **🔍 CONTEXT TRACKING**

### **Request Context Automático**
```javascript
// Se crea automáticamente en cada request
{
  requestId: 'req_1753894727464_ciw7ew',
  method: 'POST',
  path: '/api/messages',
  userEmail: 'agent@company.com',
  userRole: 'admin',
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
}
```

### **Module Loggers**
```javascript
const { createLogger } = require('../middleware/logging');
const moduleLogger = createLogger('MY_SERVICE');

moduleLogger.info('Servicio iniciado', { version: '1.0.0' });
// Resultado: [MODULE: MY_SERVICE] Servicio iniciado
```

---

## **⚙️ CONFIGURACIÓN**

### **Variables de Entorno**
```bash
# Nivel de logs (ERROR=0, WARN=1, INFO=2, DEBUG=3)
LOG_LEVEL=INFO

# Modo de producción (JSON estructurado)
NODE_ENV=production
```

### **Niveles por Ambiente**
- **Desarrollo**: DEBUG (todos los logs visibles)
- **Testing**: INFO (logs importantes)
- **Producción**: WARN (solo warnings y errores)

---

## **🎯 MEJORES PRÁCTICAS**

### **✅ HACER**
```javascript
// Logs concisos pero informativos
req.logger.auth('login_success', { email: user.email, role: user.role });

// Context específico
req.logger.database('query_slow', { 
  operation: 'conversation_list',
  duration: '2500ms',
  documentsRead: 150 
});

// Stack traces limitados
req.logger.error('Error procesando', {
  error: error.message,
  stack: error.stack?.split('\n').slice(0, 3)
});
```

### **❌ EVITAR**
```javascript
// Demasiado verboso
logger.info('Iniciando función getUserById con parámetros...', { lots: 'of', unnecessary: 'data' });

// Sin contexto
logger.error('Error');

// Logs sensibles
logger.info('User password:', { password: 'secret123' });
```

---

## **🚀 BENEFICIOS**

### **🔍 DEBUGGING RÁPIDO**
- **Request tracking** con IDs únicos
- **Stack traces** resumidos y legibles
- **Context preservation** en toda la cadena

### **📊 MONITOREO PROACTIVO**
- **Performance alerts** automáticos
- **Security monitoring** incorporado
- **Error aggregation** por categorías

### **🎨 EXPERIENCIA DE DESARROLLO**
- **Visual feedback** con colores e iconos
- **Structured data** fácil de leer
- **Consistent format** en toda la aplicación

### **🏭 PRODUCTION READY**
- **JSON structured** para parsing automático
- **Log levels** configurables
- **Performance optimized** con lazy evaluation

---

## **📈 EJEMPLO COMPLETO**

### **Flujo de Mensaje Completo**
```javascript
// 1. Webhook recibido
req.logger.webhook('received', { source: 'twilio', messageId: 'tw_123' });

// 2. Validación
req.logger.webhook('validated', { signature: 'valid' });

// 3. Procesamiento iniciado
req.logger.message('processing_started', { messageId: 'msg_456', type: 'inbound' });

// 4. Base de datos
req.logger.database('query_started', { operation: 'conversation_lookup' });
req.logger.database('query_completed', { duration: '45ms', found: true });

// 5. Socket.IO
req.logger.socket('message_emitting', { conversationId: 'conv_789' });
req.logger.socket('message_emitted', { connectedUsers: 3 });

// 6. Completado
req.logger.message('processing_completed', { successful: true, duration: '150ms' });
```

**Resultado**: Tracking completo del flujo con contexto preservado y timing automático.

---

🎉 **¡Sistema de logging profesional implementado y listo para detectar errores de manera visual y eficiente!** 