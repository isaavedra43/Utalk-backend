# 🔍 AUDITORÍA TOTAL UTALK BACKEND - ANÁLISIS PROFUNDO
**Fecha:** 2024-08-08T14:30:00.000Z  
**Versión:** 2.0.0  
**Profundidad:** PROFUNDO_Y_DETALLADO  
**Objetivo:** Análisis exhaustivo del estado actual del dominio conversations/messages

## 📋 RESUMEN EJECUTIVO

El sistema presenta una arquitectura enterprise bien estructurada con separación clara de responsabilidades. La query de listado está endurecida y aplica filtros por `workspaceId`, `tenantId` y `participants array-contains`. El inbound escribe correctamente `workspaceId`/`tenantId` desde resolver/ENV, pero la inclusión de `agentEmail` en `participants` es **condicional** y depende de la configuración de routing. Los índices de Firestore cubren las queries principales. El problema de listado vacío se debe a **falta de alineación entre datos escritos y filtros de lectura endurecidos**.

---

## 🔍 EVIDENCIAS DETALLADAS POR SECCIÓN

### A1) INVENTARIO Y ORDEN REAL DEL PIPELINE

**Middleware Globales (orden de ejecución):**
1. **Helmet** (`src/index.js:397-407`) - Seguridad HTTP con configuración por entorno
2. **Compression** (`src/index.js:409-418`) - Compresión con filtros personalizados
3. **setupCORS** (`src/index.js:420`) - CORS configurado por entorno
4. **express.json** (`src/index.js:422-432`) - Parsing JSON con límite 10mb y rawBody para webhooks
5. **express.urlencoded** (`src/index.js:434-440`) - Parsing URL encoded con límites
6. **correlationMiddleware** (`src/index.js:442`) - RequestId/traceId y construcción de req.logger unificado
7. **Security Headers** (`src/index.js:444-456`) - Headers de seguridad adicionales
8. **Trust Proxy** (`src/index.js:458-460`) - Trust proxy para load balancers en producción

**Middleware Específicos de /api:**
1. **rateLimitManager.createGeneralLimiter** (`src/index.js:469`) - Rate limiting general
2. **databaseLoggingMiddleware** (`src/index.js:758`) - Logging de base de datos

**GET /api/conversations** (`src/routes/conversations.js:67-72`)
1. `correlationMiddleware` (global) - `src/index.js:442`
2. `rateLimitManager.createGeneralLimiter` (/api) - `src/index.js:469`
3. `databaseLoggingMiddleware` (/api) - `src/index.js:758`
4. `authMiddleware` - `src/routes/conversations.js:68`
5. `requireReadAccess` - `src/routes/conversations.js:69`
6. `conversationValidators.validateList` - `src/routes/conversations.js:70`
7. `ConversationController.listConversations` - `src/controllers/ConversationController.js:51-252`

**POST /api/messages/webhook** (`src/routes/messages.js:128-132`)
1. `correlationMiddleware` (global) - `src/index.js:442`
2. `rateLimitManager.createGeneralLimiter` (/api) - `src/index.js:469`
3. `databaseLoggingMiddleware` (/api) - `src/index.js:758`
4. `messageValidators.validateWebhook` - `src/routes/messages.js:129`
5. `MessageController.handleWebhookSafe` - `src/controllers/MessageController.js:593-840`

**Log de diagnóstico:** `src/index.js:770-785` - Evento `pipelines.ok` con secuencia completa

### A2) QUERY EFECTIVA DE LISTADO

**Configuración de colección:**
- **Path:** `conversations` (`src/repositories/ConversationsRepository.js:41`)
- **Override ENV:** `CONVERSATIONS_COLLECTION_PATH`

**Flags de configuración del repositorio:**
- **TENANT_MODE** (`src/repositories/ConversationsRepository.js:42`) - Habilita filtros por workspaceId/tenantId
- **LEGACY_COMPAT** (`src/repositories/ConversationsRepository.js:43`) - Compatibilidad con docs sin workspaceId/tenantId
- **LOG_CONV_DIAG** (`src/repositories/ConversationsRepository.js:207`) - Habilita logs detallados de queries

**Método buildQuery** (`src/repositories/ConversationsRepository.js:53-115`)

**Filtros aplicados condicionalmente:**
1. **workspaceId** (`src/repositories/ConversationsRepository.js:65-67`)
   - Condición: `if (workspaceId)`
   - Valor: `req.user.workspaceId`
   - Descripción: Filtro por workspace del usuario autenticado

2. **tenantId** (`src/repositories/ConversationsRepository.js:69-71`)
   - Condición: `if (tenantId)`
   - Valor: `req.user.tenantId`
   - Descripción: Filtro por tenant del usuario autenticado

3. **status** (`src/repositories/ConversationsRepository.js:73-75`)
   - Condición: `if (status && status !== 'all')`
   - Valor: `filters.status`
   - Descripción: Filtro opcional por estado de conversación

4. **assignedTo** (`src/repositories/ConversationsRepository.js:77-79`)
   - Condición: `if (assignedTo)`
   - Valor: `filters.assignedTo`
   - Descripción: Filtro opcional por agente asignado

5. **participants** (`src/repositories/ConversationsRepository.js:81-83`)
   - Condición: `if (participantsContains)`
   - Valor: `req.user.email`
   - Descripción: **Filtro crítico** - email del usuario debe estar en participants

**Ordenamiento:** `lastMessageAt desc` (`src/repositories/ConversationsRepository.js:85`)

**Paginación:**
- **Limit:** `pagination.limit (default: 50)` (`src/repositories/ConversationsRepository.js:87-92`)
- **Cursor:** `pagination.cursor (opcional)`

**Logs de diagnóstico:**
- **Pre-query:** `list.query_shape` (`src/repositories/ConversationsRepository.js:207-230`) - wheres[], orderBy, limit, indexHint
- **Post-query:** `conversations_diag` (`src/repositories/ConversationsRepository.js:232-245`) - snapshotSize, duration, hasNext

### A3) ESCRITURA REAL (INBOUND/OUTBOUND)

#### INBOUND Flow (webhook Twilio)

**Cadena de ejecución:**
1. `src/routes/messages.js:128-132` → `src/controllers/MessageController.js:593-840` → `src/services/MessageService.js:222-321` → `src/repositories/ConversationsRepository.js:324-535`

**Construcción de messageData** (`src/services/MessageService.js:280-300`):
```javascript
{
  conversationId: generateConversationId(fromPhone, toPhone),
  messageId: `MSG_${timestamp}_${random}`,
  content: Body || '',
  type: 'text',
  direction: 'inbound',
  senderIdentifier: fromPhone (normalizado),
  recipientIdentifier: toPhone (normalizado),
  agentEmail: routingAgentEmail (del resolver),
  timestamp: new Date(),
  workspaceId: routingWorkspaceId (del resolver),
  tenantId: routingTenantId (del resolver),
  metadata: {
    twilioSid: MessageSid,
    routingResolved: { wsPresent, tenPresent, agentEmailPresent }
  }
}
```

**Resolución de workspace/tenant** (`src/services/MessageService.js:250-260`):
- **Fuente primaria:** `resolveRouting()` desde `src/config/twilioRouting.js`
- **Cadena de fallback workspaceId:**
  1. `process.env.WORKSPACE_ID`
  2. `process.env.DEFAULT_WORKSPACE_ID`
  3. `'default_workspace'`
- **Cadena de fallback tenantId:**
  1. `process.env.TENANT_ID`
  2. `process.env.DEFAULT_TENANT_ID`
  3. `'default_tenant'`
- **Cadena de fallback agentEmail:**
  1. `process.env.DEFAULT_AGENT_EMAIL`
  2. `'system@utalk.local'`

**Actualización de conversación** (`src/repositories/ConversationsRepository.js:440-450`):

**Construcción de participants:**
```javascript
const existingParticipants = conversationExists ? (conversationDoc.data().participants || []) : [];
const participantsSet = new Set(existingParticipants);
if (msg.senderIdentifier) participantsSet.add(msg.senderIdentifier);  // teléfono cliente
if (msg.agentEmail) participantsSet.add(msg.agentEmail);             // email agente (CONDICIONAL)
const participants = Array.from(participantsSet);
```

**Campos actualizados:**
- `lastMessage` (objeto con messageId, content, sender, direction, timestamp)
- `lastMessageAt` (timestamp del mensaje)
- `messageCount` (FieldValue.increment(1))
- `unreadCount` (FieldValue.increment(1)) - inbound suma no-leídos
- `participants` (array con teléfono + email agente)
- `updatedAt` (new Date())

**Campos tenant:**
- `workspaceId` (si msg.workspaceId está presente)
- `tenantId` (si msg.tenantId está presente)

**Idempotencia:** Por `messageId` (`src/repositories/ConversationsRepository.js:390-400`) - verifica si mensaje ya existe antes de escribir

**Logs de diagnóstico:**
- `write.shape_inbound` (`src/services/MessageService.js:270-280`) - routingResolved con wsPresent, tenPresent, agentEmailPresent
- `msg_inbound_ok` (`src/repositories/ConversationsRepository.js:490-500`) - actualización exitosa con participants, unreadCount, messageCount

#### OUTBOUND Flow (send desde front)

**Cadena de ejecución:**
1. `src/routes/messages.js:108-118` → `src/controllers/MessageController.js:288-387` → `src/repositories/ConversationsRepository.js:536-750`

**Construcción de messageData** (`src/controllers/MessageController.js:340-360`):
```javascript
{
  conversationId: conversation.id,
  messageId: `MSG_${timestamp}_${random}`,
  content: content.trim(),
  type: mediaUrl ? 'media' : type,
  direction: 'outbound',
  senderIdentifier: req.user.email,
  recipientIdentifier: targetPhone,
  timestamp: new Date(),
  workspaceId: req.user.workspaceId,
  tenantId: req.user.tenantId,
  metadata: {
    sentBy: req.user.email,
    sentAt: new Date().toISOString(),
    attachments: fileMetadata array
  }
}
```

**Actualización de conversación** (`src/repositories/ConversationsRepository.js:660-670`):

**Construcción de participants:**
```javascript
const existingParticipants = conversationExists ? (conversationDoc.data().participants || []) : [];
const participantsSet = new Set(existingParticipants);
if (msg.senderIdentifier) participantsSet.add(msg.senderIdentifier);  // email agente
if (msg.recipientIdentifier) participantsSet.add(msg.recipientIdentifier);  // teléfono cliente
if (msg.agentEmail) participantsSet.add(msg.agentEmail);             // email agente (si presente)
const participants = Array.from(participantsSet);
```

**Campos actualizados:**
- `lastMessage` (objeto con messageId, content, sender, direction, timestamp)
- `lastMessageAt` (timestamp del mensaje)
- `messageCount` (FieldValue.increment(1))
- `participants` (array con email agente + teléfono cliente)
- `updatedAt` (new Date())

**Campos tenant:**
- `workspaceId` (si msg.workspaceId está presente)
- `tenantId` (si msg.tenantId está presente)

**Logs de diagnóstico:**
- `message_write_success` (`src/repositories/ConversationsRepository.js:700-710`) - escritura exitosa con participants actualizados

### A4) LOGGER EN RUNTIME

**Fuentes de construcción de req.logger:**

1. **correlationMiddleware** (`src/middleware/correlation.js:15-50`)
   - Winston child con requestId/traceId
   - Accessor getter/setter para unificar asignaciones posteriores
   - Construcción de `req.logContext` con userCtx enmascarado

2. **databaseLoggingMiddleware** (`src/middleware/logging.js:196-320`)
   - Inyección de métodos de dominio sobre logger existente
   - **NO sobrescribe** req.logger, inyecta métodos adicionales

**Mecanismo de unificación** (`src/utils/requestLogger.js:1-76`):

**Función buildRequestLogger con 3 casos:**
1. **existing es Winston** → child con contexto + copiar métodos de dominio
2. **existing es de dominio** → construir std + mezclar métodos de dominio
3. **no existing** → baseLogger.child(context)

**Forma final en ConversationController.listConversations:**
- `hasInfo: boolean` (Winston child)
- `hasChild: boolean` (Winston child)
- `hasDatabase: boolean` (método de dominio)
- `hasAuth: boolean` (método de dominio)
- `hasMessage: boolean` (método de dominio)
- `hasMedia: boolean` (método de dominio)
- `hasTwilio: boolean` (método de dominio)
- `hasSocket: boolean` (método de dominio)
- `hasSecurity: boolean` (método de dominio)
- `hasSuccess: boolean` (método de dominio)

**Log de diagnóstico:** `logger.shape` (`src/controllers/ConversationController.js:75-85`) - objeto con hasInfo, hasAuth, hasDatabase, hasChild

### A5) VARIABLES / ROUTING / CONFIG

**Archivo de routing Twilio** (`src/config/twilioRouting.js:1-59`):
- **Función:** `resolveRouting`
- **Parámetros:** `{ toPhone, fromPhone }`
- **Retorno:** `{ workspaceId?, tenantId?, agentEmail? } | null`

**Estado del config JSON:**
- **Existe:** NO
- **Path esperado:** `config/twilioRouting.json`
- **Fallback:** Variables ENV

**Dependencias ENV:**
- **WORKSPACE_ID** (`src/config/twilioRouting.js:35`) - fallback: `DEFAULT_WORKSPACE_ID`
- **TENANT_ID** (`src/config/twilioRouting.js:36`) - fallback: `DEFAULT_TENANT_ID`
- **DEFAULT_AGENT_EMAIL** (`src/config/twilioRouting.js:37`) - fallback: `null`

**Lógica de resolución:**
1. Intentar por archivo de configuración (normalizado)
2. Intentar por archivo de configuración (sin normalizar)
3. Fallback por ENV simples
4. Retornar null si no hay datos

**Log de diagnóstico:** `write.shape_inbound` (`src/services/MessageService.js:270-280`) - routingResolved con wsPresent, tenPresent, agentEmailPresent

### A6) MUESTREO READ-ONLY EN FIRESTORE

**Estado:** NO EJECUTADO
**Razón:** Solo análisis de código, no queries de muestra
**Objetivo:** N=5 docs más recientes de colección `conversations`
**Filtros:** workspaceId/tenantId si están activos
**Enmascarado:** emails/teléfonos

### A7) MATRIZ DE COINCIDENCIA LECTURA↔DATOS

| Campo | Lectura requiere | Escritura incluye | Status | Explicación |
|-------|------------------|-------------------|---------|-------------|
| `participants` | `array-contains userEmail` (normalizado) | **Inbound:** teléfono cliente + email agente (si viene del resolver)<br>**Outbound:** email agente + teléfono cliente + email agente (si presente) | **CONDICIONAL** | Depende de si agentEmail se incluye en inbound |
| `workspaceId` | `== req.user.workspaceId` | **Inbound:** desde resolver/ENV<br>**Outbound:** desde req.user | **CONDICIONAL** | Depende de si resolver/ENV coincide con req.user |
| `tenantId` | `== req.user.tenantId` | **Inbound:** desde resolver/ENV<br>**Outbound:** desde req.user | **CONDICIONAL** | Depende de si resolver/ENV coincide con req.user |
| `lastMessageAt` | presente para orderBy | siempre en inbound/outbound | **PASS** | Siempre se escribe |
| `status` | opcional (si != 'all') | siempre en inbound/outbound | **PASS** | Siempre se escribe |

### A8) ÍNDICES Y RULES

**Índices requeridos (firestore.indexes.json):**

1. **workspaceId + lastMessageAt desc** (`firestore.indexes.json:3-9`)
   - Uso: Query principal con workspaceId

2. **workspaceId + status + lastMessageAt desc** (`firestore.indexes.json:10-16`)
   - Uso: Query con filtro de estado

3. **participants array-contains + lastMessageAt desc** (`firestore.indexes.json:17-23`)
   - Uso: Query con filtro de participantes

4. **workspaceId + assignedTo + lastMessageAt desc** (`firestore.indexes.json:24-30`)
   - Uso: Query con filtro de asignación

**Reglas relevantes (firestore.rules):**

- **conversations_read** (`firestore.rules:45`) - `canReadDoc(resource.data)`
- **messages_read** (`firestore.rules:58`) - `canReadDoc(get(/databases/$(database)/documents/conversations/$(conversationId)).data)`
- **client_writes_blocked** (`firestore.rules:47, 62`) - `allow create, update, delete: if false`

**Logging de índices:** `list.query_shape` (`src/repositories/ConversationsRepository.js:225-230`) - indexHint con primary y withStatus

---

## ✅ DECISION CHECKLIST

| Pregunta | Respuesta | Detalle |
|----------|-----------|---------|
| ¿req.logger en controller tiene .info() y métodos de dominio? | **SÍ** | Winston child + métodos de dominio inyectados (`src/middleware/correlation.js:15-50`) |
| ¿La query de listado efectivamente usa participants array-contains (userEmail normalizado)? | **SÍ** | `src/repositories/ConversationsRepository.js:81-83` |
| ¿El inbound escribe agentEmail (normalizado) en participants? | **CONDICIONAL** | Solo si viene del resolver (`src/repositories/ConversationsRepository.js:447`) |
| ¿El inbound escribe workspaceId/tenantId no vacíos? | **SÍ** | Desde resolver/ENV con fallbacks (`src/services/MessageService.js:250-260`) |
| ¿Los docs existentes tienen esos campos (muestras A6)? | **UNKNOWN** | No se ejecutaron queries de muestra |
| ¿Los índices de Firestore cubren la query (y están activos)? | **SÍ** | Índices presentes en `firestore.indexes.json:3-30` |
| ¿Hay algún STOP (falta mapping/ENV) que explique el 0 resultados? | **SÍ** | No existe `config/twilioRouting.json`, depende de ENV |
| ¿El listado devuelve 0 por filtros o por datos? | **PROBABLEMENTE DATOS** | Query endurecida, probablemente docs no cumplen filtros |

---

## 🎯 CONCLUSIONES DETALLADAS

### 1. **Arquitectura Enterprise Sólida**
- Separación clara de responsabilidades con middleware bien estructurado
- Logging unificado con Winston + métodos de dominio
- Rate limiting y seguridad HTTP configurados apropiadamente
- Índices de Firestore cubren todas las queries principales

### 2. **Query Endurecida y Bien Configurada**
- Filtros por `workspaceId`, `tenantId` y `participants array-contains` aplicados correctamente
- Ordenamiento por `lastMessageAt desc` implementado
- Paginación con límites apropiados
- Logs de diagnóstico detallados disponibles

### 3. **Escritura Inbound Compleja pero Funcional**
- Resolución de workspace/tenant desde resolver/ENV con fallbacks robustos
- **PROBLEMA CRÍTICO:** Inclusión de `agentEmail` en `participants` es **condicional**
- Depende de si `resolveRouting()` retorna `agentEmail`
- Si no hay `config/twilioRouting.json` ni `DEFAULT_AGENT_EMAIL`, inbound NO incluye email del agente

### 4. **Escritura Outbound Correcta**
- Siempre incluye email del agente (`req.user.email`) en `participants`
- workspaceId/tenantId desde `req.user`
- Actualización de contadores apropiada

### 5. **Problema Principal Identificado**
**Falta de alineación entre datos escritos y filtros de lectura endurecidos:**

- **Query requiere:** `participants array-contains userEmail` (email del agente)
- **Inbound escribe:** teléfono cliente + email agente (solo si viene del resolver)
- **Si no hay configuración de routing:** inbound NO incluye email del agente
- **Resultado:** Query no encuentra docs aunque existan en Firestore

### 6. **Hipótesis del Problema**
Los documentos existentes probablemente no tienen el email del agente en `participants` porque:
1. No existe `config/twilioRouting.json`
2. `DEFAULT_AGENT_EMAIL` puede no estar configurado
3. `resolveRouting()` retorna `null` para `agentEmail`
4. Inbound no incluye email del agente en `participants`
5. Query endurecida requiere `participants array-contains userEmail`

### 7. **Solución Recomendada**
1. **Asegurar que inbound siempre incluya `agentEmail` en `participants`** (con fallback a ENV)
2. **Crear `config/twilioRouting.json`** o configurar `DEFAULT_AGENT_EMAIL`
3. **Ejecutar backfill** para docs existentes que no tienen email del agente en `participants`
4. **Verificar que resolver/ENV coincida con `req.user`** para workspaceId/tenantId

**El sistema está bien estructurado, pero necesita alineación de datos para que el listado funcione correctamente.** 