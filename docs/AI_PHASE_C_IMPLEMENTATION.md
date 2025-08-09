# 🤖 **FASE C - ALMACENAMIENTO Y API DE SUGERENCIAS**

## 📋 **RESUMEN EJECUTIVO**

La **Fase C** implementa el almacenamiento completo de sugerencias en Firestore, un endpoint interno para generarlas bajo demanda, y prepara el evento de socket "suggestion:new". El sistema mantiene todas las protecciones de seguridad, validaciones y límites de las fases anteriores, sin tocar los webhooks productivos.

### ✅ **LOGROS COMPLETADOS**

- ✅ **Modelo de Sugerencia completo** con validaciones y sanitización
- ✅ **Repositorio de Sugerencias** con operaciones CRUD en Firestore
- ✅ **Endpoint de generación** POST `/api/ai/suggestions/generate`
- ✅ **Endpoints de gestión** GET, PUT para sugerencias
- ✅ **Detección de contenido sensible** (PII, lenguaje ofensivo)
- ✅ **Evento de socket** `suggestion:new` preparado
- ✅ **Rate limiting y límites** de seguridad
- ✅ **Logging y métricas** detalladas
- ✅ **Tests exhaustivos** para todas las funcionalidades

### 🎯 **OBJETIVOS CUMPLIDOS**

1. **Esquema de almacenamiento**: Colección `suggestions/{conversationId}/suggestions/{suggestionId}`
2. **Validadores y sanitización**: Campos requeridos, HTML peligroso, límites
3. **Endpoint interno**: Generación y guardado bajo demanda
4. **Socket event**: `suggestion:new` preparado
5. **Límites y protección**: Rate limiting, timeouts, circuit breaker
6. **Logging y auditoría**: Métricas completas de uso

---

## 🏗️ **ARQUITECTURA IMPLEMENTADA**

### **Estructura de Archivos**

```
src/
├── models/
│   └── Suggestion.js                    # Modelo con validaciones y sanitización
├── repositories/
│   └── SuggestionsRepository.js         # CRUD en Firestore con índices
├── services/
│   └── AIService.js                     # Orquestador con persistencia
├── controllers/
│   └── AIController.js                  # Endpoints de generación y gestión
├── routes/
│   └── ai.js                           # Rutas con validaciones extendidas
└── tests/
    └── ai/phase-c.test.js              # Tests exhaustivos
```

### **Flujo de Datos Completo**

```
1. Request POST /api/ai/suggestions/generate
   ↓
2. Validación de permisos y feature flags
   ↓
3. Orquestador IA (Fases A+B) → proveedor real/fake
   ↓
4. Modelo Suggestion con validaciones y sanitización
   ↓
5. Repositorio → Guardado en Firestore
   ↓
6. Evento Socket.IO "suggestion:new" (opcional)
   ↓
7. Respuesta con métricas y warnings
```

---

## 📊 **MODELO DE SUGERENCIA**

### **Esquema de Datos**

```javascript
{
  id: "uuid",
  conversationId: "conv_123",
  messageIdOrigen: "msg_456",
  texto: "string <= 1000 chars",
  confianza: "number (0..1)",
  fuentes: ["docId1", "docId2"],
  modelo: "gpt-4o-mini",
  tokensEstimados: {
    in: 150,
    out: 25
  },
  estado: "draft|sent|discarded",
  createdAt: "ISO timestamp",
  flagged: false,
  metadata: {
    riesgos: ["pii", "offensive"],
    latencyMs: 1200,
    costUsd: 0.001
  }
}
```

### **Validaciones Automáticas**

| Campo | Validación | Sanitización |
|-------|------------|--------------|
| `conversationId` | Requerido | - |
| `messageIdOrigen` | Requerido | - |
| `texto` | Requerido, ≤1000 chars | HTML peligroso removido |
| `confianza` | 0..1 | Clamp automático |
| `fuentes` | ≤10 elementos | Slice automático |
| `estado` | Valores válidos | Fallback a 'draft' |
| `metadata` | ≤1KB JSON | Truncate automático |

### **Detección de Contenido Sensible**

#### **Patrones PII**
- Tarjetas de crédito: `\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b`
- Números de teléfono: `\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b`
- Emails: `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z\|a-z]{2,}`
- IPs: `\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b`
- IBAN: `\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b`
- DNI español: `\b\d{2}[-.\s]?\d{2}[-.\s]?\d{2}[-.\s]?\d{2}[-.\s]?\d{2}[-.\s]?\d{2}\b`

#### **Lenguaje Ofensivo**
- Palabras ofensivas: `puta`, `mierda`, `cabrón`, `gilipollas`
- Insultos: `estúpido`, `idiota`, `imbécil`, `tonto`
- Violencia: `odio`, `matar`, `muerte`, `suicidio`

#### **Contenido Inapropiado**
- Drogas: `droga`, `marihuana`, `cocaína`, `heroína`
- Contenido sexual: `sexo`, `pornograf`, `prostitut`
- Terrorismo: `terrorismo`, `bomba`, `explosivo`, `armas`

---

## 🗄️ **REPOSITORIO DE SUGERENCIAS**

### **Operaciones CRUD**

#### **Guardar Sugerencia**
```javascript
const repository = new SuggestionsRepository();
const suggestion = new Suggestion(data);
const result = await repository.saveSuggestion(suggestion);
// Result: { success: true, suggestionId: "uuid", conversationId: "conv_123" }
```

#### **Obtener por Conversación**
```javascript
const suggestions = await repository.getSuggestionsByConversation(conversationId, {
  limit: 20,
  estado: 'draft',
  flagged: false
});
```

#### **Obtener por Mensaje Origen**
```javascript
const suggestions = await repository.getSuggestionsByMessage(conversationId, messageId);
```

#### **Actualizar Estado**
```javascript
const result = await repository.updateSuggestionStatus(conversationId, suggestionId, 'sent');
```

#### **Estadísticas**
```javascript
const stats = await repository.getSuggestionStats(conversationId);
// Result: { total: 15, draft: 10, sent: 3, discarded: 2, flagged: 1, byType: {...}, byModel: {...} }
```

### **Índices Recomendados en Firestore**

1. **Por conversación y fecha**:
   ```
   suggestions/{conversationId}/suggestions
   - conversationId (ascending)
   - createdAt (descending)
   ```

2. **Por mensaje origen**:
   ```
   suggestions/{conversationId}/suggestions
   - messageIdOrigen (ascending)
   - createdAt (descending)
   ```

3. **Por estado**:
   ```
   suggestions/{conversationId}/suggestions
   - estado (ascending)
   - createdAt (descending)
   ```

4. **Por contenido sensible**:
   ```
   suggestions/{conversationId}/suggestions
   - flagged (ascending)
   - createdAt (descending)
   ```

---

## 🌐 **API REST COMPLETA**

### **Endpoints Implementados**

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/api/ai/suggestions/generate` | **NUEVO** - Generar y guardar sugerencia | Agent |
| GET | `/api/ai/suggestions/:conversationId` | **MEJORADO** - Obtener sugerencias con filtros | Agent |
| PUT | `/api/ai/suggestions/:conversationId/:suggestionId/status` | **NUEVO** - Actualizar estado | Agent |
| GET | `/api/ai/suggestions/:conversationId/stats` | **NUEVO** - Estadísticas de sugerencias | Agent |

### **POST /api/ai/suggestions/generate**

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
    "suggestionId": "suggestion_abc123",
    "conversationId": "conv_456",
    "messageIdOrigen": "msg_789",
    "preview": "Hola, ¿en qué puedo ayudarte hoy?",
    "usage": {
      "in": 150,
      "out": 25,
      "latencyMs": 1200
    },
    "flagged": false,
    "warnings": []
  }
}
```

#### **Warnings Detectados**
- **Latencia alta**: >2500ms
- **Modo fake**: Proveedor no disponible
- **Contenido sensible**: PII o lenguaje ofensivo detectado
- **Error de guardado**: No se pudo persistir en Firestore

### **GET /api/ai/suggestions/:conversationId**

#### **Query Parameters**
- `limit`: Número máximo de sugerencias (default: 20)
- `estado`: Filtrar por estado (`draft`, `sent`, `discarded`)
- `flagged`: Filtrar por contenido sensible (`true`, `false`)

#### **Response**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "id": "suggestion_123",
        "conversationId": "conv_456",
        "messageIdOrigen": "msg_789",
        "texto": "Hola, ¿en qué puedo ayudarte?",
        "confianza": 0.8,
        "estado": "draft",
        "flagged": false,
        "modelo": "gpt-4o-mini",
        "createdAt": "2025-01-27T10:30:00.000Z",
        "preview": "Hola, ¿en qué puedo ayudarte?",
        "tipo": "saludo"
      }
    ],
    "count": 1
  }
}
```

### **PUT /api/ai/suggestions/:conversationId/:suggestionId/status**

#### **Request**
```json
{
  "status": "sent"
}
```

#### **Response**
```json
{
  "success": true,
  "data": {
    "success": true,
    "suggestionId": "suggestion_123",
    "newStatus": "sent"
  }
}
```

### **GET /api/ai/suggestions/:conversationId/stats**

#### **Response**
```json
{
  "success": true,
  "data": {
    "total": 15,
    "draft": 10,
    "sent": 3,
    "discarded": 2,
    "flagged": 1,
    "byType": {
      "saludo": 5,
      "consulta_precios": 3,
      "soporte_tecnico": 2,
      "respuesta_general": 5
    },
    "byModel": {
      "gpt-4o-mini": 12,
      "gpt-4o": 3
    }
  }
}
```

---

## 📡 **EVENTO DE SOCKET**

### **Evento: suggestion:new**

#### **Payload**
```json
{
  "conversationId": "conv_456",
  "suggestionId": "suggestion_abc123",
  "messageIdOrigen": "msg_789",
  "preview": "Hola, ¿en qué puedo ayudarte hoy?",
  "createdAt": "2025-01-27T10:30:00.000Z"
}
```

#### **Implementación**
```javascript
// En AIService.js
if (global.io && !options.dryRun) {
  global.io.to(conversationId).emit('suggestion:new', {
    conversationId: suggestion.conversationId,
    suggestionId: suggestion.id,
    messageIdOrigen: suggestion.messageIdOrigen,
    preview: suggestionModel.getPreview(),
    createdAt: suggestion.createdAt
  });
}
```

#### **Escucha en Frontend**
```javascript
// En el frontend
socket.on('suggestion:new', (data) => {
  console.log('Nueva sugerencia recibida:', data);
  // Mostrar notificación o actualizar UI
});
```

---

## 🔒 **SEGURIDAD Y LÍMITES**

### **Rate Limiting**
- **Por conversación**: 6 requests por minuto
- **Concurrente**: 1 request simultáneo por conversación
- **Implementación**: Map en memoria con reset automático

### **Timeouts y Retries**
- **Timeout total**: 2 segundos
- **Retries**: 1 con backoff exponencial (250-500ms)
- **Fallback**: Modo fake si proveedor falla

### **Validaciones de Contenido**
- **Longitud máxima**: 1000 caracteres
- **Sanitización**: HTML peligroso removido
- **Detección PII**: Patrones automáticos
- **Lenguaje ofensivo**: Lista de palabras prohibidas

### **Permisos y Autorización**
- **Generación**: Solo `admin`, `agent`, `qa`
- **Consulta**: Solo `admin`, `agent`
- **Actualización**: Solo `admin`, `agent`
- **Workspace**: Validación por workspace

---

## 📊 **MÉTRICAS Y LOGGING**

### **Logs Estructurados**

#### **Generación de Sugerencia**
```javascript
{
  "level": "info",
  "message": "🚀 Iniciando generación de sugerencia IA",
  "workspaceId": "ws_123",
  "conversationId": "conv_456",
  "messageId": "msg_789",
  "userEmail": "agent@example.com",
  "userRole": "agent"
}
```

#### **Sugerencia Guardada**
```javascript
{
  "level": "info",
  "message": "✅ Sugerencia guardada en Firestore",
  "suggestionId": "suggestion_abc123",
  "conversationId": "conv_456",
  "messageIdOrigen": "msg_789",
  "estado": "draft",
  "flagged": false
}
```

#### **Contenido Sensible Detectado**
```javascript
{
  "level": "warn",
  "message": "⚠️ Sugerencia con warnings",
  "suggestionId": "suggestion_abc123",
  "conversationId": "conv_456",
  "warnings": ["Contenido sensible detectado: pii"]
}
```

### **Contador de Uso Diario**
```javascript
// Colección: ai_usage/{workspaceId}/daily/{date}
{
  "suggestions_generated": 25,
  "suggestions_saved": 23,
  "suggestions_flagged": 2,
  "lastUpdated": "2025-01-27T10:30:00.000Z"
}
```

---

## 🧪 **TESTS IMPLEMENTADOS**

### **Cobertura de Tests**

- ✅ **Modelo de Sugerencia**: Validaciones, sanitización, detección de contenido sensible
- ✅ **Endpoint de Generación**: Éxito, fallos, permisos, campos faltantes
- ✅ **Endpoints de Gestión**: CRUD, filtros, estadísticas
- ✅ **Validaciones de Seguridad**: Autenticación, autorización
- ✅ **Rate Limiting**: Límites por conversación
- ✅ **Detección de Contenido**: PII, lenguaje ofensivo
- ✅ **Persistencia**: Guardado y recuperación de Firestore
- ✅ **Eventos de Socket**: Emisión de eventos
- ✅ **Métricas**: Logging y contadores

### **Casos de Prueba Específicos**

1. **Crear sugerencia válida** → Campos correctos, estado draft
2. **Validar campos requeridos** → Error si faltan campos obligatorios
3. **Sanitizar HTML peligroso** → Scripts y tags removidos
4. **Detectar PII** → Tarjetas, emails, teléfonos marcados como flagged
5. **Generar y guardar** → Endpoint completo con persistencia
6. **Filtrar por estado** → Query parameters funcionando
7. **Actualizar estado** → Cambio de draft a sent/discarded
8. **Obtener estadísticas** → Conteos por tipo y modelo
9. **Rate limit excedido** → Error 429 con mensaje claro
10. **Contenido sensible** → Warnings y flagged automático

---

## 📋 **DEFINICIÓN DE HECHO (DoD)**

### ✅ **Criterios Cumplidos**

1. **✅ Esquema e índices creados; validadores y sanitización activos**
   - Modelo Suggestion con validaciones completas
   - Repositorio con operaciones CRUD
   - Índices recomendados documentados
   - Sanitización automática de contenido

2. **✅ Endpoint /api/ai/suggestions/generate funcional, seguro y con rate limit**
   - Generación y guardado bajo demanda
   - Validaciones de permisos y feature flags
   - Rate limiting por conversación
   - Manejo de errores controlado

3. **✅ Documento guardado correctamente y evento emitido**
   - Persistencia en Firestore verificada
   - Evento Socket.IO "suggestion:new" preparado
   - Métricas de guardado registradas
   - Fallback si guardado falla

4. **✅ Logs y métricas registran tokens, latencia y estado**
   - Logging estructurado por operación
   - Contador de uso diario actualizado
   - Métricas de latencia y tokens
   - Warnings y errores registrados

5. **✅ Ningún impacto en producción (webhooks intactos)**
   - No se modificaron webhooks existentes
   - Endpoints internos solo para testing
   - Feature flags controlan activación
   - Fallback robusto a modo fake

### **Pruebas de Verificación**

```bash
# Generar y guardar sugerencia
curl -X POST http://localhost:3001/api/ai/suggestions/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -H "X-User: {\"role\":\"agent\"}" \
  -d '{"workspaceId":"test","conversationId":"test","messageId":"test"}'
# Respuesta: suggestionId + preview + usage + warnings

# Obtener sugerencias
curl http://localhost:3001/api/ai/suggestions/test-conversation \
  -H "Authorization: Bearer token" \
  -H "X-User: {\"role\":\"agent\"}"
# Respuesta: lista de sugerencias con filtros

# Actualizar estado
curl -X PUT http://localhost:3001/api/ai/suggestions/test-conversation/test-suggestion/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -H "X-User: {\"role\":\"agent\"}" \
  -d '{"status":"sent"}'
# Respuesta: estado actualizado

# Estadísticas
curl http://localhost:3001/api/ai/suggestions/test-conversation/stats \
  -H "Authorization: Bearer token" \
  -H "X-User: {\"role\":\"agent\"}"
# Respuesta: conteos por estado, tipo y modelo
```

---

## 🔄 **PRÓXIMOS PASOS (FASE D)**

### **Preparación para Fase D**

1. **Integración con webhooks** (opcional, solo si se requiere)
2. **Chat lateral IA** con subcolección `ai_sessions`
3. **Upload y indexación de documentos** para RAG
4. **UI de chat lateral** en el frontend
5. **Proveedores adicionales** (Anthropic, Gemini)
6. **Reportes y KPIs** avanzados

### **Puntos de Enganche Identificados**

- **Webhook de mensajes**: Línea 320 en `MessageService.js`
- **Socket events**: Evento `suggestion:new` ya preparado
- **Frontend**: Panel lateral en `ConversationDetail.js`
- **Proveedores**: Interfaz en `src/ai/vendors/index.js`
- **RAG**: Estructura preparada para documentos

---

## 📚 **REFERENCIAS TÉCNICAS**

### **Archivos Principales**

- `src/models/Suggestion.js`: Modelo con validaciones y sanitización
- `src/repositories/SuggestionsRepository.js`: CRUD en Firestore
- `src/services/AIService.js`: Orquestador con persistencia
- `src/controllers/AIController.js`: Endpoints de generación y gestión
- `src/routes/ai.js`: Rutas con validaciones extendidas

### **Colecciones Firestore**

- `suggestions/{conversationId}/suggestions/{suggestionId}`: Sugerencias IA
- `ai_configs/{workspaceId}`: Configuración IA por workspace
- `ai_usage/{workspaceId}/daily/{date}`: Métricas de uso diario

### **Dependencias**

- `uuid`: Generación de IDs únicos
- `joi`: Validación de esquemas
- `firebase-admin`: Persistencia en Firestore
- `supertest`: Tests de integración

---

## 🎯 **CONCLUSIÓN**

La **Fase C** del módulo IA ha sido implementada exitosamente, proporcionando un sistema completo de almacenamiento y gestión de sugerencias con todas las protecciones de seguridad y validaciones necesarias.

**Características clave logradas:**
- ✅ Modelo de sugerencia robusto con validaciones
- ✅ Repositorio completo con operaciones CRUD
- ✅ Endpoint de generación y guardado bajo demanda
- ✅ Endpoints de gestión con filtros y estadísticas
- ✅ Detección automática de contenido sensible
- ✅ Evento de socket preparado
- ✅ Rate limiting y límites de seguridad
- ✅ Logging y métricas detalladas
- ✅ Tests exhaustivos
- ✅ Sin impacto en webhooks productivos

El módulo está **listo para integración con webhooks** y puede ser habilitado gradualmente por workspace. La arquitectura es extensible para futuras funcionalidades como RAG y chat lateral IA.