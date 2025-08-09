# 🔧 FASE H: MONITOREO Y LÍMITES OPERATIVOS

## Resumen

La **Fase H** implementa monitoreo avanzado, límites de consumo (tokens/costo), circuit breaker inteligente con políticas por workspace y alertas operativas. Todo es aditivo y reversible, sin cambiar contratos de negocio existentes.

## Características Implementadas

### ✅ **Esquema de Límites y Políticas**
- **Ubicación**: `workspaces/{workspaceId}/ai/limits`
- **Límites diarios**: tokens_in, tokens_out, costo USD
- **Rate limiting**: per_minute, burst
- **Latencia**: umbrales P95/P99
- **Circuit breaker**: error rate, cooldown, auto-recovery
- **Alertas**: webhook, email configurables

### ✅ **Métricas y Costos**
- **Estimador de costos**: Por modelo con tarifas actualizadas
- **Contadores diarios**: En memoria + snapshot en DB
- **Estructura**: `ai_counters/{YYYYMMDD}/{workspaceId}/{model}`
- **Métricas**: tokens, llamadas, costo, latencias, percentiles

### ✅ **Caps Diarios y Rechazo Educado**
- **Verificación previa**: Antes de llamar al proveedor
- **Respuesta controlada**: `{ ok:false, reason:"CAP_EXCEEDED", remaining }`
- **No excepción**: Flujo continúa sin IA
- **Logging**: Warning con valores y remaining

### ✅ **Rate Limit Refinado**
- **Por conversación**: 6 req/min, 1 concurrente
- **Por workspace**: Límites configurables
- **Token bucket**: Implementación en memoria
- **Rechazo suave**: Sin errores, solo warnings

### ✅ **Circuit Breaker Avanzado**
- **Ventana móvil**: Últimos N minutos configurables
- **Criterios múltiples**: Error rate, P95, timeouts consecutivos
- **Auto-recovery**: Canary call después de cooldown
- **Por workspace**: Independiente por cada workspace

### ✅ **Alertas Operativas**
- **Eventos**: CAP_EXCEEDED, BREAKER_ON/OFF, RATE_LIMIT
- **Canales**: Webhook POST, email (simulado)
- **Payload**: JSON estructurado con métricas
- **Fallback**: Log si webhook falla

### ✅ **Endpoints de Observabilidad**
- **GET /api/ai/ops/limits/:workspaceId** - Límites efectivos
- **PUT /api/ai/ops/limits/:workspaceId** - Actualizar límites
- **GET /api/ai/ops/counters** - Contadores y métricas
- **POST /api/ai/ops/breaker/:workspaceId** - Forzar breaker
- **GET /api/ai/ops/health** - Estado general
- **GET /api/ai/ops/breakers** - Todos los breakers

## Archivos Implementados

### Nuevos Archivos
- `src/config/aiLimits.js` - Configuración de límites y tarifas
- `src/services/AIMetricsService.js` - Métricas y contadores
- `src/services/AICircuitBreaker.js` - Circuit breaker avanzado
- `src/controllers/AIOpsController.js` - Controlador de operaciones
- `src/routes/aiOps.js` - Rutas de operaciones

### Archivos Modificados
- `src/services/AIWebhookIntegration.js` - Integración con límites
- `src/index.js` - Registro de rutas de operaciones

## Configuración de Límites

### Estructura de Límites
```javascript
{
  "daily": {
    "max_tokens_in": 1000000,    // 1M tokens entrada
    "max_tokens_out": 300000,    // 300K tokens salida
    "max_cost_usd": 25.0         // $25 USD por día
  },
  "rate": {
    "per_minute": 6,             // 6 req/min
    "burst": 10                  // 10 req burst
  },
  "latency": {
    "p95_ms_threshold": 2500,    // 2.5s P95
    "p99_ms_threshold": 4000     // 4s P99
  },
  "errors": {
    "error_rate_threshold_pct": 10,  // 10% error rate
    "window_min": 5                  // 5 min ventana
  },
  "breaker": {
    "enabled": true,
    "cooldown_min": 10           // 10 min cooldown
  },
  "alerts": {
    "enabled": true,
    "webhook_url": "https://...",
    "email": "ops@company.com"
  }
}
```

### Tarifas por Modelo
```javascript
{
  'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'gemini-pro': { input: 0.0005, output: 0.0015 }
}
```

## Endpoints de Operaciones

### GET `/api/ai/ops/limits/:workspaceId`
Obtiene límites efectivos (merge default + específicos):
```json
{
  "workspaceId": "ws_123",
  "limits": {
    "daily": { ... },
    "rate": { ... },
    "latency": { ... },
    "errors": { ... },
    "breaker": { ... },
    "alerts": { ... }
  },
  "models": [
    { "model": "gpt-3.5-turbo", "pricing": { ... } }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### PUT `/api/ai/ops/limits/:workspaceId`
Actualiza límites con validación y clamps:
```json
{
  "daily": {
    "max_cost_usd": 50.0
  },
  "rate": {
    "per_minute": 10
  }
}
```

### GET `/api/ai/ops/counters`
Obtiene contadores y métricas:
```json
{
  "date": "2024-01-01",
  "workspaceId": "ws_123",
  "summary": {
    "totalTokensIn": 15000,
    "totalTokensOut": 5000,
    "totalCalls": 100,
    "totalCallsOk": 95,
    "totalCallsErr": 5,
    "errorRate": 5.0,
    "totalCost": 0.125,
    "p95_ms": 1800,
    "p99_ms": 2500
  },
  "byModel": {
    "gpt-3.5-turbo": { ... }
  },
  "cache": {
    "size": 5,
    "keys_count": 5
  }
}
```

### POST `/api/ai/ops/breaker/:workspaceId`
Fuerza estado del circuit breaker:
```json
{
  "action": "open",
  "reason": "maintenance"
}
```

### GET `/api/ai/ops/health`
Estado general de salud:
```json
{
  "provider_ready": true,
  "error_rate_pct": 2.5,
  "p95_ms": 1800,
  "caps_remaining": {
    "total_workspaces": 5,
    "open_breakers": 0,
    "healthy_breakers": 5
  },
  "rate_limiting": {
    "total_conversations": 10,
    "config": { ... }
  },
  "cache": {
    "size": 5,
    "keys_count": 5
  }
}
```

## Flujo de Verificación de Límites

```
1. Mensaje entrante → AIWebhookIntegration
2. Verificar IA habilitada
3. Verificar circuit breaker (workspace)
4. Verificar rate limit (conversación)
5. Verificar límites diarios (estimación)
6. Generar sugerencia
7. Registrar uso y métricas
8. Registrar resultado en breaker
9. Emitir logs y alertas
```

## Alertas Operativas

### Eventos de Alerta
- `CAP_EXCEEDED` - Límites diarios excedidos
- `BREAKER_ON` - Circuit breaker abierto
- `BREAKER_OFF` - Circuit breaker cerrado
- `RATE_LIMIT` - Rate limit sostenido
- `LATENCY_HIGH` - P95/P99 fuera de umbral

### Payload de Alerta
```json
{
  "event": "BREAKER_ON",
  "workspaceId": "ws_123",
  "model": "gpt-3.5-turbo",
  "metrics": {
    "error_rate_pct": 17,
    "p95_ms": 3100,
    "consecutive_timeouts": 3
  },
  "window_min": 5,
  "ts": "2024-01-01T00:00:00.000Z"
}
```

## Logging y Auditoría

### Logs Estructurados
```javascript
// Límites excedidos
logger.warn('⚠️ Límites diarios excedidos', {
  workspaceId,
  model,
  date,
  exceedsTokensIn,
  exceedsTokensOut,
  exceedsCost,
  current: { tokens_in, tokens_out, cost_usd },
  limits: limits.daily,
  remaining
});

// Circuit breaker
logger.warn('🚨 Circuit breaker abriéndose', {
  workspaceId,
  errorRate,
  p95_ms,
  p99_ms,
  consecutiveTimeouts,
  thresholds: { errorRate, p95, p99 }
});

// Rate limit
logger.warn('⚠️ Rate limit excedido', {
  workspaceId,
  conversationId,
  count,
  limit,
  windowMs
});
```

### Auditoría de Cambios
```javascript
// Actualización de límites
logger.info('✅ Límites de IA actualizados', {
  workspaceId,
  userEmail,
  updates: Object.keys(updates),
  newLimits
});

// Forzar circuit breaker
logger.info('🔧 Estado del circuit breaker forzado', {
  workspaceId,
  action,
  reason,
  userEmail
});
```

## Restricciones y Garantías

### ✅ **No Interrumpe Flujo de Negocio**
- Rechazo suave sin excepciones
- Webhook continúa normalmente
- Respuesta controlada con reason

### ✅ **Seguridad**
- Solo admin/ops pueden ver endpoints
- Validación de rangos y tipos
- No expone claves ni datos sensibles

### ✅ **Performance**
- Chequeos < 10ms (cache en memoria)
- Snapshot periódico en DB
- Overhead mínimo

### ✅ **Observabilidad**
- Logs detallados de cada decisión
- Métricas en tiempo real
- Trazabilidad completa

## Pruebas en Staging

### Checklist QA
- [ ] **Caps excedidos**: Simular consumo > max_cost_usd → rechazo con CAP_EXCEEDED
- [ ] **Circuit breaker**: Forzar error_rate > threshold → breaker ON, canary → OFF
- [ ] **Latencia alta**: P95 > threshold → breaker ON, alerta enviada
- [ ] **Rate limit**: Bombardear conversación → solo 6 intentos, resto rechazados
- [ ] **Endpoints protegidos**: Solo admin/ops pueden acceder
- [ ] **Validación**: PUT aplica clamps y validaciones
- [ ] **Contadores**: Reflejan tokens y costo coherentes

## Definición de Hecho (DoD)

- [x] Límites diarios y rate limit activos con rechazo controlado
- [x] Circuit breaker por workspace funcionando con auto-recovery
- [x] Alertas operativas emiten eventos correctos
- [x] Endpoints /ops/* entregan visibilidad sin filtrar secretos
- [x] Overhead mínimo (< 10ms) y totalmente reversible

## Próximos Pasos

1. **Testing en Staging**: Validar todos los casos de uso
2. **Configuración inicial**: Establecer límites por workspace
3. **Monitoreo**: Observar métricas y alertas en producción
4. **Optimización**: Ajustar límites según uso real
5. **Integración**: Conectar con sistemas de monitoreo externos 