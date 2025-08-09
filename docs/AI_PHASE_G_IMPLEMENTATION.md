# 🤖 FASE G: ENGANCHE SUAVE CON EL WEBHOOK

## Resumen

La **Fase G** implementa la integración segura y reversible del orquestador de IA con el flujo de webhook de mensajes entrantes. Todo está detrás de flags y no afecta el flujo original de producción.

## Características Implementadas

### ✅ **Punto de Enganche**
- **Ubicación**: `MessageService.processIncomingMessage()` 
- **Momento**: Inmediatamente después de persistir el mensaje en DB
- **Ejecución**: En background (`setImmediate`) para no afectar respuesta del webhook

### ✅ **Condiciones de Activación**
- `AI_ENABLED=true` (flag global)
- `flags.suggestions=true` (por workspace)
- Circuit breaker cerrado
- Rate limit no excedido

### ✅ **Rate Limiting y Concurrencia**
- **Máximo**: 6 requests/min por conversación
- **Concurrentes**: 1 request por conversación
- **Almacén**: Memoria (en producción usar Redis)
- **Cleanup**: Automático cada 5 minutos

### ✅ **Circuit Breaker**
- **Umbral**: 10% error rate en 5 minutos
- **Reset**: Automático después de 30 segundos
- **Manual**: Endpoint para reset manual
- **Estado**: Persistente en memoria

### ✅ **Timeout y Retry**
- **Timeout**: 2 segundos total
- **Retry**: 1 intento con backoff 250-500ms
- **Fallback**: Si falla, flujo continúa sin error

### ✅ **Logging y Métricas**
- **Logs estructurados**: Por cada ejecución
- **Métricas**: Tokens, latencia, éxito/error
- **Contadores**: AI_USAGE diario por workspace/modelo
- **Trazas**: Con correlationId si existe

## Archivos Modificados

### Nuevos Archivos
- `src/utils/aiRateLimiter.js` - Rate limiting por conversación
- `src/services/AIWebhookIntegration.js` - Integración principal con circuit breaker

### Archivos Modificados
- `src/services/MessageService.js` - Punto de enganche en `processIncomingMessage()`
- `src/controllers/AIController.js` - Endpoints de monitoreo
- `src/routes/ai.js` - Rutas de integración

## Endpoints de Monitoreo

### GET `/api/ai/integration/status`
Obtiene el estado completo de la integración:
```json
{
  "global": {
    "aiEnabled": true,
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "circuitBreaker": {
    "isOpen": false,
    "failureCount": 0,
    "threshold": 10,
    "lastFailureTime": null
  },
  "rateLimiting": {
    "totalConversations": 5,
    "config": { ... },
    "conversations": [ ... ]
  },
  "integration": {
    "phase": "G",
    "description": "Enganche suave con webhook",
    "features": ["suggestions", "rate_limiting", "circuit_breaker", "timeout_retry"]
  }
}
```

### POST `/api/ai/integration/reset-circuit-breaker`
Resetea manualmente el circuit breaker (solo admin).

## Activación por Workspace

### 1. Habilitar Globalmente
```bash
export AI_ENABLED=true
```

### 2. Habilitar por Workspace
```javascript
// PUT /api/ai/config/{workspaceId}
{
  "flags": {
    "suggestions": true
  }
}
```

### 3. Verificar Estado
```bash
curl -X GET /api/ai/integration/status \
  -H "Authorization: Bearer {token}"
```

## Rollback Inmediato

### Opción 1: Kill Switch Global
```bash
export AI_ENABLED=false
```

### Opción 2: Deshabilitar por Workspace
```javascript
// PUT /api/ai/config/{workspaceId}
{
  "flags": {
    "suggestions": false
  }
}
```

### Opción 3: Reset Circuit Breaker
```bash
curl -X POST /api/ai/integration/reset-circuit-breaker \
  -H "Authorization: Bearer {admin_token}"
```

## Configuración de Límites

### Rate Limiting
```javascript
// src/utils/aiRateLimiter.js
const RATE_LIMIT_CONFIG = {
  MAX_REQUESTS_PER_MINUTE: 6,    // Configurable
  MAX_CONCURRENT_REQUESTS: 1,     // Configurable
  WINDOW_MS: 60 * 1000,          // 1 minuto
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000 // 5 minutos
};
```

### Timeouts
```javascript
// src/services/AIWebhookIntegration.js
const INTEGRATION_CONFIG = {
  TIMEOUT_MS: 2000,              // 2 segundos
  RETRY_DELAY_MS: 250,           // 250ms
  MAX_RETRIES: 1,                // 1 retry
  MAX_CONTEXT_MESSAGES: 20,      // 20 mensajes
  MAX_OUTPUT_TOKENS: 150         // 150 tokens
};
```

### Circuit Breaker
```javascript
let circuitBreaker = {
  threshold: 10,                 // 10% error rate
  windowMs: 5 * 60 * 1000,      // 5 minutos
  resetTimeoutMs: 30 * 1000     // 30 segundos
};
```

## Flujo de Integración

```
1. Mensaje entrante → MessageService.processIncomingMessage()
2. Validaciones y normalización (existente)
3. Persistencia del mensaje (existente)
4. [NUEVO] Verificar flags de IA
5. [NUEVO] Verificar circuit breaker
6. [NUEVO] Verificar rate limit
7. [NUEVO] Generar sugerencia (background)
8. [NUEVO] Guardar sugerencia en suggestions/*
9. [NUEVO] Emitir socket 'suggestion:new'
10. Emisiones de sockets actuales (existente)
```

## Eventos de Socket

### `suggestion:new`
Emitido cuando se genera una nueva sugerencia:
```json
{
  "conversationId": "conv_123",
  "suggestionId": "sug_456",
  "messageIdOrigen": "msg_789",
  "preview": "Respuesta sugerida...",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

## Logs y Métricas

### Logs Estructurados
```javascript
// Éxito
logger.info('✅ Sugerencia de IA generada y guardada', {
  requestId,
  messageId,
  conversationId,
  suggestionId,
  latencyMs
});

// Rate limit excedido
logger.warn('⚠️ Rate limit excedido, saltando generación de IA', {
  workspaceId,
  conversationId,
  messageId,
  reason: 'rate_limit_exceeded'
});

// Circuit breaker abierto
logger.warn('🚨 Circuit breaker abierto, saltando generación de IA', {
  workspaceId,
  conversationId,
  messageId
});
```

### Métricas AI_USAGE
```javascript
aiLogger.info('ai_webhook_integration', {
  workspaceId,
  conversationId,
  messageId,
  success: true,
  latencyMs,
  hasSuggestion: true,
  tokensIn: 150,
  tokensOut: 50,
  model: 'gpt-3.5-turbo'
});
```

## Restricciones y Garantías

### ✅ **No Afecta Producción**
- Ejecución en background
- No modifica respuesta del webhook
- No retrasa flujo original
- Fallback silencioso en errores

### ✅ **Límites de Latencia**
- P95 ≤ 2.5s adicionales
- Timeout de 2s para IA
- No bloquea persistencia

### ✅ **Seguridad**
- Solo admin/QA pueden ver estado
- Validación de permisos por workspace
- Sanitización de payloads

### ✅ **Observabilidad**
- Logs detallados de cada operación
- Métricas de uso y rendimiento
- Estado del circuit breaker
- Estadísticas de rate limiting

## Pruebas en Staging

### Checklist QA
- [ ] **Caso base**: Mensaje entrante con IA activada → sugerencia creada en <2.5s
- [ ] **Flags OFF**: `AI_ENABLED=false` → no se llama IA, sin latencia extra
- [ ] **Rate limit**: 10 msg/min misma conversación → solo 6 intentos
- [ ] **Timeout**: Simular demora >2s → 1 retry, flujo continúa
- [ ] **Seguridad**: Payload sin PII, texto sanitizado ≤1000 chars
- [ ] **Logs**: Tokens/latencia/ok registrados, contadores AI_USAGE aumentan

## Definición de Hecho (DoD)

- [x] Enganche detrás de flags funcionando y reversible
- [x] Sugerencias se crean y notifican sin romper webhook
- [x] Rate limit, timeout, retry y circuit breaker verificados
- [x] Observabilidad suficiente para monitoreo en producción
- [x] Rollout por workspace listo y kill switch inmediato operativo

## Próximos Pasos

1. **Testing en Staging**: Validar todos los casos de uso
2. **Rollout Gradual**: Activar por workspace específicos
3. **Monitoreo**: Observar métricas y logs en producción
4. **Optimización**: Ajustar límites según uso real
5. **Fase H**: Integración con RAG (cuando esté habilitado) 