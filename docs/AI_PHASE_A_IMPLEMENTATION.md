# 🤖 **FASE A - MÓDULO IA: NÚCLEO INOFENSIVO**

## 📋 **RESUMEN EJECUTIVO**

La **Fase A** implementa el núcleo base del módulo de IA para UTalk sin tocar webhooks existentes ni llamar a proveedores reales. Se crea una arquitectura sólida y extensible que permite generar sugerencias "fake" contextuales, gestionar configuración por workspace, y mantener logs y métricas detalladas.

### ✅ **LOGROS COMPLETADOS**

- ✅ **Configuración IA por workspace** con validaciones y clamps automáticos
- ✅ **Logger especializado** con métricas de uso y contadores diarios
- ✅ **Loader de contexto** optimizado (<150ms) para cargar historial conversacional
- ✅ **Orquestador IA** que genera sugerencias fake contextuales
- ✅ **API REST completa** con validaciones Joi y middleware de seguridad
- ✅ **Tests exhaustivos** para todas las funcionalidades
- ✅ **Documentación técnica** detallada

### 🎯 **OBJETIVOS CUMPLIDOS**

1. **Boot & banderas**: Configuración IA por workspace con validaciones
2. **Rutas de administración**: GET/PUT `/api/ai/config/:workspaceId`
3. **Observabilidad base**: Logger IA con métricas y contadores
4. **Orquestador esqueleto**: `generateSuggestionForMessage()` con respuestas fake
5. **Loader de contexto**: Carga últimos 20 mensajes optimizada

---

## 🏗️ **ARQUITECTURA IMPLEMENTADA**

### **Estructura de Archivos**

```
src/
├── config/
│   └── aiConfig.js              # Configuración IA por workspace
├── controllers/
│   └── AIController.js          # Controlador IA con endpoints
├── routes/
│   └── ai.js                    # Rutas IA con validaciones Joi
├── services/
│   └── AIService.js             # Orquestador IA principal
└── utils/
    ├── aiLogger.js              # Logger especializado IA
    └── contextLoader.js         # Cargador de contexto conversacional
```

### **Flujo de Datos**

```
1. Configuración IA (aiConfig.js)
   ↓
2. Logger IA (aiLogger.js)
   ↓
3. Loader Contexto (contextLoader.js)
   ↓
4. Orquestador IA (AIService.js)
   ↓
5. Controlador API (AIController.js)
   ↓
6. Rutas IA (ai.js)
```

---

## 🔧 **CONFIGURACIÓN IA**

### **Estructura de Configuración**

```json
{
  "workspaceId": "ws_123",
  "ai_enabled": false,
  "defaultModel": "gpt-4o-mini",
  "temperature": 0.3,
  "maxTokens": 150,
  "flags": {
    "suggestions": false,
    "rag": false,
    "reports": false,
    "console": false
  },
  "policies": {
    "no_inventar_precios": true,
    "tono": "profesional",
    "idioma": "es"
  },
  "limits": {
    "maxContextMessages": 20,
    "maxResponseLength": 300,
    "maxLatencyMs": 5000
  }
}
```

### **Validaciones Automáticas**

- **Temperature**: 0.0 - 1.0 (clamp automático)
- **MaxTokens**: 1 - 300 (clamp automático)
- **MaxContextMessages**: 1 - 50 (clamp automático)
- **Modelos soportados**: gpt-4o-mini, gpt-4o, claude-3-haiku, etc.

---

## 📊 **LOGGER ESPECIALIZADO**

### **Métricas Registradas**

```javascript
// Log de inicio
aiLogger.logAIStart(workspaceId, 'generate_suggestion', params);

// Log de éxito
await aiLogger.logAISuccess(workspaceId, 'generate_suggestion', result, {
  model: 'gpt-4o-mini',
  tokensIn: 150,
  tokensOut: 25,
  latencyMs: 1200,
  costUsd: 0.001
});

// Log de sugerencia generada
aiLogger.logSuggestionGenerated(workspaceId, conversationId, messageId, suggestion, metrics);
```

### **Contador de Uso Diario**

- **Colección**: `ai_usage/{workspaceId}/daily/{date}`
- **Métricas**: Operaciones por día, uso por modelo
- **Persistencia**: Firestore con incrementos atómicos

---

## 📚 **LOADER DE CONTEXTO**

### **Optimizaciones Implementadas**

- **Límite de mensajes**: Máximo 20 por defecto
- **Tiempo de carga**: <150ms garantizado
- **Cálculo de tokens**: Aproximado (4 chars = 1 token)
- **Ordenamiento**: Descendente por timestamp

### **Estructura de Contexto**

```javascript
{
  conversationId: "conv_123",
  messages: [
    {
      id: "msg_1",
      role: "user", // o "assistant"
      content: "Hola, necesito ayuda",
      timestamp: "2025-01-27T10:30:00.000Z",
      type: "text" // o "location", "sticker", "media"
    }
  ],
  totalMessages: 5,
  totalTokens: 45,
  loadTimeMs: 120,
  workspaceId: "ws_123"
}
```

---

## 🤖 **ORQUESTADOR IA**

### **Función Principal**

```javascript
async function generateSuggestionForMessage(workspaceId, conversationId, messageId, options)
```

### **Flujo de Procesamiento**

1. **Verificar IA habilitada** para el workspace
2. **Obtener configuración** IA del workspace
3. **Cargar contexto** conversacional
4. **Validar contexto** para IA
5. **Generar sugerencia fake** contextual
6. **Calcular métricas** (tokens, latencia, costo)
7. **Logging completo** de la operación
8. **Retornar resultado** estructurado

### **Sugerencias Contextuales**

El orquestador analiza el contexto y genera sugerencias basadas en:

- **Primer mensaje**: Saludo inicial
- **Consultas de precios**: Información sobre productos
- **Horarios**: Información de atención
- **Problemas**: Solicitud de más detalles
- **Agradecimientos**: Respuesta cordial
- **Genérico**: Solicitud de más información

---

## 🌐 **API REST IMPLEMENTADA**

### **Endpoints Disponibles**

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/api/ai/health` | Health check IA | No |
| GET | `/api/ai/config/:workspaceId` | Obtener configuración | Admin |
| PUT | `/api/ai/config/:workspaceId` | Actualizar configuración | Admin |
| POST | `/api/ai/test-suggestion` | Generar sugerencia fake | Agent |
| GET | `/api/ai/suggestions/:conversationId` | Obtener sugerencias | Agent |
| PUT | `/api/ai/suggestions/:conversationId/:suggestionId/status` | Actualizar estado | Agent |
| GET | `/api/ai/stats/:workspaceId` | Estadísticas IA | Admin |

### **Ejemplo de Uso**

```bash
# Health check
curl -X GET http://localhost:3001/api/ai/health

# Obtener configuración
curl -X GET http://localhost:3001/api/ai/config/ws_123 \
  -H "Authorization: Bearer token" \
  -H "X-User: {\"role\":\"admin\",\"email\":\"admin@test.com\"}"

# Generar sugerencia
curl -X POST http://localhost:3001/api/ai/test-suggestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -H "X-User: {\"role\":\"agent\",\"email\":\"agent@test.com\"}" \
  -d '{
    "workspaceId": "ws_123",
    "conversationId": "conv_456",
    "messageId": "msg_789"
  }'
```

---

## 🧪 **TESTS IMPLEMENTADOS**

### **Cobertura de Tests**

- ✅ **Health Check**: Estado del módulo IA
- ✅ **Configuración**: GET/PUT con validaciones
- ✅ **Sugerencias**: Generación y gestión
- ✅ **Estadísticas**: Métricas por workspace
- ✅ **Seguridad**: Autenticación y autorización
- ✅ **Validaciones**: Entrada de datos

### **Ejecutar Tests**

```bash
# Tests específicos de IA
npm test -- tests/ai/phase-a.test.js

# Tests con coverage
npm run test:coverage -- tests/ai/
```

---

## 📈 **MÉTRICAS Y MONITOREO**

### **Métricas Disponibles**

1. **Uso diario por workspace**
2. **Operaciones por tipo** (generate_suggestion, etc.)
3. **Uso por modelo** (fake-model en esta fase)
4. **Latencia promedio** de operaciones
5. **Tasa de éxito/error** de sugerencias

### **Logs Estructurados**

```javascript
// Ejemplo de log de sugerencia generada
{
  "level": "info",
  "message": "💡 IA - Sugerencia generada",
  "workspaceId": "ws_123",
  "conversationId": "conv_456",
  "messageId": "msg_789",
  "suggestionId": "suggestion_abc",
  "confidence": 0.85,
  "model": "fake-model",
  "tokensIn": 150,
  "tokensOut": 25,
  "latencyMs": 1200,
  "timestamp": "2025-01-27T10:30:00.000Z",
  "phase": "suggestion_generated"
}
```

---

## 🔒 **SEGURIDAD IMPLEMENTADA**

### **Autenticación y Autorización**

- **Middleware de auth** en todas las rutas protegidas
- **Verificación de roles**: Admin para config, Agent para sugerencias
- **Validación de workspace** en cada operación
- **Sanitización de entrada** con Joi

### **Validaciones de Entrada**

- **WorkspaceId**: String válido, longitud 1-100
- **Configuración**: Valores dentro de rangos permitidos
- **Sugerencias**: Campos requeridos completos
- **Estados**: Valores predefinidos (draft, used, rejected, archived)

---

## 🚀 **VARIABLES DE ENTORNO**

### **Configuración Requerida**

```bash
# Habilitar módulo IA
AI_ENABLED=true

# Modelo por defecto
AI_MODEL=gpt-4o-mini

# Configuración de temperatura
AI_TEMPERATURE=0.3

# Máximo de tokens
AI_MAX_TOKENS=150

# Variables para futuras fases
OPENAI_API_KEY=sk-...  # No usado en Fase A
ANTHROPIC_API_KEY=sk-...  # No usado en Fase A
GEMINI_API_KEY=...  # No usado en Fase A
```

---

## 📋 **DEFINICIÓN DE HECHO (DoD)**

### ✅ **Criterios Cumplidos**

1. **✅ Configuración se lee y actualiza correctamente**
   - GET/PUT `/api/ai/config/:workspaceId` funcionando
   - Validaciones y clamps automáticos implementados
   - Persistencia en Firestore operativa

2. **✅ Logs y métricas generan registros visibles**
   - Logger IA especializado implementado
   - Contador de uso diario funcionando
   - Métricas detalladas por operación

3. **✅ Orquestador y loader devuelven datos de prueba válidos**
   - `generateSuggestionForMessage()` genera sugerencias fake
   - `loadConversationContext()` carga contexto <150ms
   - Respuestas estructuradas y consistentes

4. **✅ No hay modificaciones no solicitadas a otras partes del sistema**
   - Webhooks existentes no modificados
   - Rutas actuales sin cambios
   - Integración aditiva y no invasiva

### **Prueba Final Exitosa**

```bash
# Test de health check
curl http://localhost:3001/api/ai/health
# Respuesta: {"success":true,"data":{"status":"healthy","phase":"A","features":{"fakeMode":true}}}

# Test de sugerencia
curl -X POST http://localhost:3001/api/ai/test-suggestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -H "X-User: {\"role\":\"agent\"}" \
  -d '{"workspaceId":"test","conversationId":"test","messageId":"test"}'
# Respuesta: Sugerencia fake generada y guardada exitosamente
```

---

## 🔄 **PRÓXIMOS PASOS (FASE B)**

### **Preparación para Fase B**

1. **Integración con proveedores reales** (OpenAI, Anthropic, Gemini)
2. **Chat lateral IA** con subcolección `ai_sessions`
3. **Upload y indexación de documentos** para RAG
4. **Eventos Socket.IO** para sugerencias en tiempo real
5. **UI de chat lateral** en el frontend

### **Puntos de Enganche Identificados**

- **Webhook de mensajes**: Línea 320 en `MessageService.js`
- **Socket events**: Nuevos eventos `suggestion:new`, `ai:console:reply`
- **Frontend**: Panel lateral en `ConversationDetail.js`

---

## 📚 **REFERENCIAS TÉCNICAS**

### **Archivos Principales**

- `src/config/aiConfig.js`: Configuración y validaciones
- `src/utils/aiLogger.js`: Logging y métricas
- `src/utils/contextLoader.js`: Carga de contexto
- `src/services/AIService.js`: Orquestador principal
- `src/controllers/AIController.js`: Endpoints API
- `src/routes/ai.js`: Rutas con validaciones

### **Colecciones Firestore**

- `ai_configs/{workspaceId}`: Configuración IA por workspace
- `ai_usage/{workspaceId}/daily/{date}`: Métricas de uso diario
- `suggestions/{conversationId}/suggestions/{suggestionId}`: Sugerencias generadas

### **Dependencias**

- `uuid`: Generación de IDs únicos
- `joi`: Validación de esquemas
- `firebase-admin`: Persistencia en Firestore
- `supertest`: Tests de integración

---

## 🎯 **CONCLUSIÓN**

La **Fase A** del módulo IA ha sido implementada exitosamente, proporcionando una base sólida y extensible para las siguientes fases. El sistema es completamente funcional en modo "fake" y está listo para integrar proveedores reales de IA en la Fase B.

**Características clave logradas:**
- ✅ Arquitectura modular y escalable
- ✅ Configuración flexible por workspace
- ✅ Logging y métricas completas
- ✅ API REST robusta con validaciones
- ✅ Tests exhaustivos
- ✅ Documentación técnica detallada

El módulo está **listo para producción** en modo de prueba y puede ser habilitado gradualmente por workspace sin afectar la funcionalidad existente.