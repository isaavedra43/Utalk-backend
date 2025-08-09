# 🤖 **FASE B - PROVEEDOR REAL Y SALUD**

## 📋 **RESUMEN EJECUTIVO**

La **Fase B** implementa la integración con proveedores reales de LLM (OpenAI por defecto) al orquestador de la Fase A, con healthchecks robustos, límites de seguridad, timeouts, reintentos, rate limiting y guardrails mínimos. El sistema mantiene fallback a modo fake y está completamente listo para pruebas internas sin afectar flujos productivos.

### ✅ **LOGROS COMPLETADOS**

- ✅ **Wrapper OpenAI completo** con timeouts, retries y rate limiting
- ✅ **Health check robusto** con verificación de proveedores
- ✅ **Clamps automáticos** en configuración con warnings
- ✅ **Circuit breaker** para manejo de errores
- ✅ **Rate limiting** por conversación (6 req/min)
- ✅ **Guardrails mínimos** en prompts y salida
- ✅ **Endpoint dry-run** para pruebas sin persistencia
- ✅ **Kill switch** global con AI_ENABLED
- ✅ **Logging detallado** con métricas de uso y costos
- ✅ **Tests exhaustivos** para todas las funcionalidades

### 🎯 **OBJETIVOS CUMPLIDOS**

1. **Wrapper de proveedor**: OpenAI con timeouts y retries
2. **Health check**: Verificación de proveedores y estado
3. **Clamps y validación**: Configuración automática con límites
4. **Timeouts y reintentos**: 2s timeout, 1 retry con backoff
5. **Rate limit**: 6 req/min por conversación
6. **Guardrails**: Prompts seguros y salida sanitizada
7. **Logging**: Métricas completas de uso y costos
8. **Dry-run**: Endpoint para pruebas sin persistencia
9. **Kill switch**: Control global con AI_ENABLED

---

## 🏗️ **ARQUITECTURA IMPLEMENTADA**

### **Estructura de Archivos**

```
src/
├── ai/
│   └── vendors/
│       ├── index.js              # Interfaz unificada de proveedores
│       └── openai.js             # Wrapper OpenAI con guardrails
├── config/
│   └── aiConfig.js               # Configuración con clamps mejorados
├── controllers/
│   └── AIController.js           # Health check y dry-run endpoints
├── routes/
│   └── ai.js                     # Rutas con validaciones extendidas
├── services/
│   └── AIService.js              # Orquestador con proveedor real
└── utils/
    ├── aiLogger.js               # Logger con métricas de proveedores
    └── contextLoader.js          # Loader optimizado (sin cambios)
```

### **Flujo de Datos Mejorado**

```
1. Configuración IA (aiConfig.js) con clamps
   ↓
2. Health Check (AIController.js) verifica proveedores
   ↓
3. Orquestador IA (AIService.js) decide real vs fake
   ↓
4. Wrapper OpenAI (openai.js) con guardrails
   ↓
5. Rate Limiter + Circuit Breaker
   ↓
6. Logging detallado (aiLogger.js)
   ↓
7. Respuesta sanitizada y validada
```

---

## 🔧 **WRAPPER OPENAI**

### **Características Implementadas**

#### **1. Timeouts y Retries**
```javascript
const OPENAI_CONFIG = {
  timeout: 2000,        // 2 segundos
  maxRetries: 1,        // 1 reintento
  backoffMs: 250,       // Backoff exponencial
  maxTokensOut: 150,    // Máximo tokens de salida
  rateLimitPerMinute: 6 // Rate limit por conversación
};
```

#### **2. Circuit Breaker**
- **Umbral**: 10% de error rate en 5 minutos
- **Ventana**: 5 minutos para reset automático
- **Estados**: Cerrado → Abierto → Semi-abierto
- **Logging**: Alertas cuando se abre/cierra

#### **3. Rate Limiting**
- **Límite**: 6 requests por minuto por conversación
- **Implementación**: Map en memoria con reset automático
- **Respuesta**: Error 429 con mensaje claro

#### **4. Guardrails de Seguridad**
```javascript
// Sanitización de salida
function sanitizeOutput(text) {
  // Recortar a 500 caracteres máximo
  // Remover HTML peligroso
  // Intentar parsear JSON si está presente
  // Validar contenido seguro
}
```

#### **5. Prompts con Guardrails**
```javascript
const prompt = `Eres un asistente de atención al cliente profesional.

GUARDRAILS IMPORTANTES:
- NO inventes precios, productos o servicios específicos
- Si falta información importante, pide UN SOLO dato específico
- Mantén un tono profesional
- No uses lenguaje técnico complejo
- Sé conciso pero completo

Contexto: ${context}
Respuesta sugerida:`;
```

---

## 🏥 **HEALTH CHECK ROBUSTO**

### **Endpoint: GET /api/ai/health**

#### **Respuesta Completa**
```json
{
  "success": true,
  "data": {
    "status": "healthy|degraded|disabled",
    "timestamp": "2025-01-27T10:30:00.000Z",
    "version": "1.0.0",
    "phase": "B",
    "features": {
      "config": true,
      "suggestions": true,
      "contextLoader": true,
      "logging": true,
      "fakeMode": true,
      "provider_ready": true
    },
    "providers": {
      "openai": {
        "ok": true,
        "provider": "openai",
        "model": "gpt-4o-mini",
        "limits": {
          "maxTokensOut": 150,
          "timeout": 2000,
          "maxRetries": 1
        }
      }
    },
    "environment": {
      "nodeEnv": "development",
      "aiEnabled": true,
      "openaiKey": true
    }
  }
}
```

#### **Estados de Salud**
- **healthy**: Todo funcionando correctamente
- **degraded**: IA habilitada pero proveedor con problemas
- **disabled**: AI_ENABLED=false

---

## 🔒 **CLAMPS Y VALIDACIÓN**

### **Validaciones Automáticas**

| Parámetro | Rango | Clamp Automático |
|-----------|-------|------------------|
| temperature | 0.0 - 1.0 | Math.max(0, Math.min(1, value)) |
| maxTokens | 1 - 300 | Math.max(1, Math.min(300, value)) |
| maxContextMessages | 1 - 50 | Math.max(1, Math.min(50, value)) |
| maxTokensOut | 1 - 150 | Math.max(1, Math.min(150, value)) |
| timeout | 500 - 10000ms | Math.max(500, Math.min(10000, value)) |
| maxRetries | 0 - 3 | Math.max(0, Math.min(3, value)) |

### **Warnings Automáticos**
```javascript
// Ejemplo de warnings generados
[
  "Temperature ajustada de 2.0 a 1.0",
  "maxTokens ajustado de 500 a 300",
  "Modelo invalid-model no soportado, usando gpt-4o-mini",
  "Proveedor invalid-provider no soportado, usando openai"
]
```

---

## 🧪 **ENDPOINT DRY-RUN**

### **Endpoint: POST /api/ai/dry-run/suggest**

#### **Request**
```json
{
  "workspaceId": "ws_123",
  "conversationId": "conv_456",
  "messageId": "msg_789"
}
```

#### **Response**
```json
{
  "success": true,
  "data": {
    "ok": true,
    "suggestion_preview": "Hola, ¿en qué puedo ayudarte hoy?",
    "usage": {
      "in": 150,
      "out": 25,
      "latencyMs": 1200
    },
    "warnings": [
      "Usando modo fake (proveedor no disponible)"
    ],
    "provider": "openai",
    "isReal": false
  }
}
```

#### **Warnings Detectados**
- **Latencia alta**: >2500ms
- **Modo fake**: Proveedor no disponible
- **Sugerencia larga**: >300 caracteres

---

## 📊 **MÉTRICAS Y LOGGING**

### **Logs Estructurados**

#### **Request de IA**
```javascript
{
  "level": "info",
  "message": "🤖 IA - Iniciando operación",
  "workspaceId": "ws_123",
  "operation": "openai_generate",
  "params": {
    "model": "gpt-4o-mini",
    "temperature": 0.3,
    "maxTokens": 150,
    "conversationId": "conv_456"
  }
}
```

#### **Respuesta Exitosa**
```javascript
{
  "level": "info",
  "message": "✅ IA - Operación exitosa",
  "workspaceId": "ws_123",
  "operation": "openai_generate",
  "success": true,
  "model": "gpt-4o-mini",
  "tokensIn": 150,
  "tokensOut": 25,
  "latencyMs": 1200,
  "costUsd": 0.001
}
```

#### **Error de Proveedor**
```javascript
{
  "level": "error",
  "message": "❌ IA - Error en operación",
  "workspaceId": "ws_123",
  "operation": "openai_generate",
  "success": false,
  "error": "Rate limit exceeded",
  "errorType": "OpenAIError",
  "latencyMs": 500
}
```

### **Contador de Uso Diario**
```javascript
// Colección: ai_usage/{workspaceId}/daily/{date}
{
  "openai_generate": 15,
  "openai_generate_gpt-4o-mini": 15,
  "lastUpdated": "2025-01-27T10:30:00.000Z"
}
```

---

## 🌐 **API REST EXTENDIDA**

### **Endpoints Nuevos/Mejorados**

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/api/ai/health` | Health check con proveedores | No |
| PUT | `/api/ai/config/:workspaceId` | Config con clamps automáticos | Admin |
| POST | `/api/ai/dry-run/suggest` | **NUEVO** - Prueba sin persistencia | Agent |

### **Configuración Extendida**
```json
{
  "workspaceId": "ws_123",
  "ai_enabled": true,
  "provider": "openai",
  "defaultModel": "gpt-4o-mini",
  "escalationModel": "gpt-4o",
  "temperature": 0.3,
  "maxTokens": 150,
  "flags": {
    "suggestions": true,
    "rag": false,
    "reports": false,
    "console": false,
    "provider_ready": true
  },
  "policies": {
    "no_inventar_precios": true,
    "tono": "profesional",
    "idioma": "es"
  },
  "limits": {
    "maxContextMessages": 20,
    "maxResponseLength": 300,
    "maxLatencyMs": 5000,
    "maxTokensOut": 150,
    "timeout": 2000,
    "maxRetries": 1
  }
}
```

---

## 🧪 **TESTS IMPLEMENTADOS**

### **Cobertura de Tests**

- ✅ **Health Check**: Verificación de proveedores y estados
- ✅ **Configuración**: Clamps automáticos y validaciones
- ✅ **Dry Run**: Generación sin persistencia
- ✅ **Rate Limiting**: Límites por conversación
- ✅ **Circuit Breaker**: Manejo de errores
- ✅ **Fallback**: Modo fake cuando proveedor falla
- ✅ **Métricas**: Logging y contadores
- ✅ **Seguridad**: Autenticación y autorización

### **Casos de Prueba Específicos**

1. **Health check sin OPENAI_API_KEY** → ok=false
2. **Health check con clave válida** → ok=true
3. **Dry-run con conversación real** → suggestion_preview + usage
4. **Simulación de timeout** → retry + fallback
5. **Config fuera de rango** → clamps aplicados + warnings
6. **Rate limit excedido** → error 429
7. **Circuit breaker abierto** → fallback a fake

---

## 🔒 **SEGURIDAD Y RESILIENCIA**

### **Kill Switch Global**
```bash
# Deshabilitar completamente el módulo IA
AI_ENABLED=false
```

### **Circuit Breaker**
- **Umbral**: 10% error rate en 5 minutos
- **Auto-reset**: Después de 5 minutos
- **Fallback**: Modo fake automático
- **Logging**: Alertas cuando se activa

### **Rate Limiting**
- **Por conversación**: 6 req/min
- **Implementación**: Memoria con reset automático
- **Respuesta**: Error controlado sin excepción

### **Guardrails de Contenido**
- **Sanitización**: HTML peligroso removido
- **Longitud**: Máximo 500 caracteres
- **JSON**: Parseo seguro con fallback
- **Prompts**: Reglas de seguridad integradas

---

## 🚀 **VARIABLES DE ENTORNO**

### **Configuración Requerida**

```bash
# Habilitar módulo IA
AI_ENABLED=true

# Proveedor OpenAI
OPENAI_API_KEY=sk-...

# Configuración opcional
AI_MODEL=gpt-4o-mini
AI_TEMPERATURE=0.3
AI_MAX_TOKENS=150
```

### **Configuración por Workspace**
```javascript
// Habilitar proveedor real
{
  "ai_enabled": true,
  "provider": "openai",
  "flags": {
    "provider_ready": true,
    "suggestions": true
  }
}
```

---

## 📋 **DEFINICIÓN DE HECHO (DoD)**

### ✅ **Criterios Cumplidos**

1. **✅ /api/ai/health y /api/ai/dry-run/suggest operativos y seguros**
   - Health check verifica proveedores
   - Dry-run genera sugerencias sin persistencia
   - Ambos endpoints seguros y validados

2. **✅ Clamps, timeouts, retries y rate limit verificados**
   - Configuración con clamps automáticos
   - Timeout 2s con 1 retry
   - Rate limit 6 req/min por conversación
   - Tests exhaustivos implementados

3. **✅ Guardrails activos y salida saneada**
   - Prompts con reglas de seguridad
   - Sanitización de salida automática
   - Validación de contenido
   - Logging de warnings

4. **✅ Provider listo para integrarse en Fase C**
   - Wrapper OpenAI completo
   - Interfaz extensible para otros proveedores
   - Fallback robusto a modo fake
   - Sin deuda técnica crítica

### **Pruebas de Verificación**

```bash
# Health check sin API key
curl http://localhost:3001/api/ai/health
# Respuesta: provider_ready=false, ok=false

# Health check con API key
curl http://localhost:3001/api/ai/health
# Respuesta: provider_ready=true, ok=true

# Dry-run con conversación real
curl -X POST http://localhost:3001/api/ai/dry-run/suggest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -H "X-User: {\"role\":\"agent\"}" \
  -d '{"workspaceId":"test","conversationId":"test","messageId":"test"}'
# Respuesta: suggestion_preview + usage + warnings

# Config con clamps
curl -X PUT http://localhost:3001/api/ai/config/test-workspace \
  -H "Authorization: Bearer token" \
  -H "X-User: {\"role\":\"admin\"}" \
  -d '{"temperature":2.0,"maxTokens":500}'
# Respuesta: temperature=1.0, maxTokens=300 (clamps aplicados)
```

---

## 🔄 **PRÓXIMOS PASOS (FASE C)**

### **Preparación para Fase C**

1. **Integración con webhooks** (opcional, solo si se requiere)
2. **Chat lateral IA** con subcolección `ai_sessions`
3. **Upload y indexación de documentos** para RAG
4. **Eventos Socket.IO** para sugerencias en tiempo real
5. **UI de chat lateral** en el frontend
6. **Proveedores adicionales** (Anthropic, Gemini)

### **Puntos de Enganche Identificados**

- **Webhook de mensajes**: Línea 320 en `MessageService.js`
- **Socket events**: Nuevos eventos `suggestion:new`, `ai:console:reply`
- **Frontend**: Panel lateral en `ConversationDetail.js`
- **Proveedores**: Interfaz en `src/ai/vendors/index.js`

---

## 📚 **REFERENCIAS TÉCNICAS**

### **Archivos Principales**

- `src/ai/vendors/openai.js`: Wrapper OpenAI con guardrails
- `src/ai/vendors/index.js`: Interfaz unificada de proveedores
- `src/config/aiConfig.js`: Configuración con clamps mejorados
- `src/controllers/AIController.js`: Health check y dry-run
- `src/services/AIService.js`: Orquestador con proveedor real
- `src/routes/ai.js`: Rutas con validaciones extendidas

### **Colecciones Firestore**

- `ai_configs/{workspaceId}`: Configuración IA por workspace
- `ai_usage/{workspaceId}/daily/{date}`: Métricas de uso diario
- `suggestions/{conversationId}/suggestions/{suggestionId}`: Sugerencias (solo test-suggestion)

### **Dependencias**

- `openai`: Cliente oficial de OpenAI
- `uuid`: Generación de IDs únicos
- `joi`: Validación de esquemas
- `firebase-admin`: Persistencia en Firestore
- `supertest`: Tests de integración

---

## 🎯 **CONCLUSIÓN**

La **Fase B** del módulo IA ha sido implementada exitosamente, proporcionando una integración robusta y segura con proveedores reales de LLM. El sistema mantiene fallback completo a modo fake y está listo para pruebas internas sin afectar flujos productivos.

**Características clave logradas:**
- ✅ Integración completa con OpenAI
- ✅ Health check robusto con verificación de proveedores
- ✅ Clamps automáticos con warnings
- ✅ Circuit breaker y rate limiting
- ✅ Guardrails de seguridad
- ✅ Endpoint dry-run para pruebas
- ✅ Logging detallado con métricas
- ✅ Tests exhaustivos
- ✅ Fallback robusto a modo fake

El módulo está **listo para pruebas internas** y puede ser habilitado gradualmente por workspace. La arquitectura es extensible para futuros proveedores y está preparada para la Fase C.