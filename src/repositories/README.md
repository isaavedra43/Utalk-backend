# Repositorios - UTalk Backend

## Descripción

Los repositorios actúan como capa de abstracción entre los servicios/controladores y los modelos de datos. Inicialmente implementados como cascarones que delegan a los modelos existentes, están preparados para futuras optimizaciones.

## Repositorios Implementados

### MessageRepository

**Ubicación**: `src/repositories/MessageRepository.js`

**Métodos disponibles**:
- `create(messageData, uniqueMessageId)` - Crear mensaje
- `getByTwilioSid(twilioSid)` - Obtener por Twilio SID
- `getByConversation(conversationId, options)` - Obtener mensajes de conversación
- `getById(conversationId, messageId)` - Obtener mensaje por ID
- `getStats(conversationId, options)` - Estadísticas de conversación
- `markManyAsRead(conversationId, messageIds, userEmail, readTimestamp)` - Marcar como leídos
- `searchInUserConversations(options)` - Buscar en conversaciones de usuario
- `search(conversationId, searchTerm, options)` - Buscar mensajes
- `getUnreadCount(conversationId, userEmail)` - Conteo de no leídos

**Estado actual**: Cascarón que delega a `Message.js`
**Migración en progreso**: `MessageService.js` usa `MessageRepository` para operaciones de lectura

### UserRepository

**Ubicación**: `src/repositories/UserRepository.js`

**Métodos disponibles**:
- `getByEmail(email)` - Obtener usuario por email
- `validatePassword(email, passwordInput)` - Validar contraseña
- `create(userData)` - Crear usuario
- `list(options)` - Listar usuarios
- `findEmailByPhone(phone)` - Encontrar email por teléfono

**Estado actual**: Cascarón que delega a `User.js`
**Migración en progreso**: Pendiente de adopción en servicios

## Plan de Migración

### Fase 2.3 (Actual)
- ✅ Crear cascarones de repositorios
- ✅ Introducir `MessageRepository` en `MessageService` (operaciones de lectura)
- 🔄 Documentar interfaces y contratos

### Fase 3 (Futuro)
- Implementar paginación optimizada en `MessageRepository.getByConversation`
- Agregar índices Firestore para queries frecuentes
- Implementar caché en `UserRepository.getByEmail`
- Optimizar `MessageRepository.search` con índices de texto
- Agregar métricas de rendimiento en repositorios

## Puntos de Extensión

### MessageRepository
```javascript
// Futuras optimizaciones
static async getByConversation(conversationId, options = {}) {
  // 1. Verificar caché
  // 2. Query optimizada con índices
  // 3. Paginación con cursor
  // 4. Métricas de rendimiento
}
```

### UserRepository
```javascript
// Futuras optimizaciones
static async getByEmail(email) {
  // 1. Verificar caché Redis/Memory
  // 2. Query optimizada
  // 3. Métricas de acceso
}
```

## Convenciones

### Logging
Todos los repositorios incluyen logging de delegación:
```javascript
logger.debug('MessageRepository.method delegando a Message.method', {
  category: 'REPOSITORY_DELEGATION',
  // parámetros relevantes
});
```

### Manejo de Errores
Los repositorios propagan errores del modelo sin modificar:
```javascript
static async method(params) {
  // Log de delegación
  return Model.method(params); // Propaga errores tal cual
}
```

### Contratos
Los repositorios mantienen la misma interfaz que los modelos:
- Mismos parámetros de entrada
- Misma estructura de respuesta
- Mismos tipos de error

## Testing

### Verificación de Delegación
```javascript
// Verificar que los repositorios devuelven lo mismo que los modelos
const modelResult = await Message.getByConversation(convId);
const repoResult = await MessageRepository.getByConversation(convId);
assert.deepEqual(modelResult, repoResult);
```

### Verificación de Logs
```javascript
// Verificar que se generan logs de delegación
const logs = captureLogs();
await MessageRepository.getByConversation(convId);
assert(logs.some(log => log.category === 'REPOSITORY_DELEGATION'));
``` 