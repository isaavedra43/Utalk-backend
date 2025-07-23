# ✅ UTalk Backend - API 100% Alineada con Frontend

## 🎯 **ALINEAMIENTO COMPLETO FRONTEND-BACKEND**

Este backend ha sido **completamente alineado** con las especificaciones exactas del frontend. Implementa autenticación exclusiva vía Firebase Auth y estructura canónica de datos sin margen de error.

### 🔒 **CAMBIOS DE ALINEAMIENTO IMPLEMENTADOS:**

- ✅ **Login exclusivo vía Firebase Auth**: Solo acepta `{ idToken }` de Firebase
- ✅ **Estructura canónica exacta**: Respuestas sin `data`, `result`, ni `pagination` anidada  
- ✅ **Campos sin null/undefined**: Valores por defecto en todas las respuestas
- ✅ **Timestamps ISO strings**: Todos los timestamps en formato ISO 8601
- ✅ **WebSockets alineados**: Eventos `message:new` con estructura consistente
- ✅ **Endpoints específicos**: GET `/conversations/:id/messages` y POST `/messages/send`

## 🎯 **ESTRUCTURA CANÓNICA DE DATOS**

Este backend está **100% alineado** con las expectativas del frontend React + TypeScript. Todas las respuestas siguen estructuras **exactas** y **consistentes**.

---

## 🔐 **LOGIN EXCLUSIVO VÍA FIREBASE AUTH**

### **POST** `/api/auth/login`

**IMPORTANTE:** Este endpoint SOLO acepta idToken de Firebase Auth. No hay login manual.

**Request Body:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." 
}
```

**Response (ESTRUCTURA EXACTA):**
```json
{
  "user": {
    "id": "firebase_uid_123",
    "email": "usuario@example.com", 
    "name": "Usuario Test",
    "role": "viewer"
  },
  "token": "jwt_token_backend_para_api"
}
```

**Flujo de Autenticación:**
1. Frontend autentica con Firebase Auth
2. Frontend obtiene `idToken` de Firebase  
3. Frontend envía `idToken` al backend
4. Backend valida con Firebase Admin SDK
5. Backend crea/sincroniza usuario en Firestore
6. Backend genera JWT propio para la API
7. Frontend usa JWT del backend para todas las requests

---

## 📨 **ENDPOINT PRINCIPAL: MENSAJES DE CONVERSACIÓN**

### **GET** `/api/conversations/:id/messages`

**Descripción:** Obtiene mensajes de una conversación específica con paginación basada en cursor.

**Parámetros de Query:**
```javascript
{
  limit: 50,           // Número de mensajes por página (máx: 100)
  cursor: "string",    // Cursor para paginación (opcional)
  orderBy: "timestamp", // Campo de ordenamiento
  order: "desc"        // Orden: "asc" o "desc"
}
```

**Estructura de Respuesta (EXACTA):**
```json
{
  "messages": [
    {
      "id": "msg_12345",
      "conversationId": "conv_1234567890_0987654321",
      "content": "Hola, necesito ayuda con mi pedido",
      "type": "text",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "sender": {
        "id": "+1234567890",
        "name": "Juan Pérez",
        "type": "contact",
        "avatar": null
      },
      "direction": "inbound",
      "attachments": [
        {
          "id": "media_001",
          "name": "foto.jpg",
          "url": "https://storage.example.com/media/foto.jpg",
          "type": "image/jpeg",
          "size": 12345
        }
      ],
      "isRead": true,
      "isDelivered": true,
      "metadata": {
        "twilioSid": "SM1234567890abcdef",
        "userId": null,
        "from": "+1234567890",
        "to": "+0987654321",
        "status": "delivered"
      }
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 50
}
```

**Campos NUNCA devueltos:** `data`, `result`, `items`, `pagination` anidada.

---

## 💬 **ENDPOINT: LISTA DE CONVERSACIONES**

### **GET** `/api/conversations`

**Estructura de Respuesta (EXACTA):**
```json
{
  "conversations": [
    {
      "id": "conv_001_002",
      "contact": {
        "id": "+1234567890",
        "name": "Cliente X",
        "avatar": null,
        "channel": "whatsapp"
      },
      "lastMessage": {
        "id": "msg_12345",
        "content": "Gracias por la ayuda",
        "type": "text",
        "timestamp": "2024-01-15T11:00:00.000Z",
        "sender": {
          "id": "+1234567890",
          "name": "Cliente X", 
          "type": "contact",
          "avatar": null
        },
        "direction": "inbound",
        "attachments": [],
        "isRead": false,
        "isDelivered": true,
        "metadata": {
          "twilioSid": "SM1234567890abcdef",
          "userId": null,
          "from": "+1234567890",
          "to": "+0987654321",
          "status": "delivered"
        }
      },
      "status": "open",
      "assignedTo": {
        "id": "user_123",
        "name": "Agente 1"
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T11:00:00.000Z"
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 20
}
```

---

## 📤 **ENVÍO DE MENSAJES ALINEADO**

### **POST** `/api/messages/send`

**ESTRUCTURA ALINEADA CON FRONTEND:**

**Request Body:**
```json
{
  "conversationId": "conv_1234567890_0987654321",  // Opcional si se envía 'to'
  "to": "+1234567890",                             // Opcional si se envía 'conversationId'  
  "content": "Mensaje desde backend alineado",
  "type": "text",                                  // "text", "image", "audio", etc.
  "attachments": [],                               // Array de attachments opcionales
  "metadata": {}                                   // Metadata opcional
}
```

**Response (ESTRUCTURA CANÓNICA):**
```json
{
  "message": {
    "id": "msg_12345",
    "conversationId": "conv_1234567890_0987654321",
    "content": "Mensaje desde backend alineado",
    "type": "text",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "sender": {
      "id": "agent_123",
      "name": "Usuario Test", 
      "type": "agent"
    },
    "direction": "outbound",
    "attachments": [],
    "isRead": false,
    "isDelivered": true,
    "metadata": {
      "twilioSid": "SM_123",
      "userId": "agent_123",
      "from": "+0987654321",
      "to": "+1234567890", 
      "status": "sent"
    }
  }
}
```

**Comportamiento:**
- Si solo se envía `conversationId`, extrae el número destino
- Si solo se envía `to`, crea/obtiene la conversación automáticamente
- Envía via Twilio WhatsApp API
- Guarda en Firestore con estructura canónica
- Emite evento WebSocket `message:new` inmediatamente
- Devuelve mensaje con estructura exacta del modelo

---

## 🔄 **WEBSOCKET EVENTS**

### **Evento:** `new-message`
```json
{
  "type": "new-message",
  "conversationId": "conv_1234567890_0987654321",
  "message": {
    // ✅ MISMA estructura exacta que REST API
    "id": "msg_12345",
    "conversationId": "conv_1234567890_0987654321",
    "content": "Nuevo mensaje",
    "type": "text",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "sender": {
      "id": "+1234567890",
      "name": "Cliente",
      "type": "contact", 
      "avatar": null
    },
    "direction": "inbound",
    "attachments": [],
    "isRead": false,
    "isDelivered": true,
    "metadata": {
      "twilioSid": "SM1234567890abcdef",
      "userId": null,
      "from": "+1234567890",
      "to": "+0987654321",
      "status": "delivered"
    }
  },
  "timestamp": 1705320600000
}
```

---

## 🔐 **AUTENTICACIÓN**

**Header requerido:**
```
Authorization: Bearer <jwt-token>
```

**Estructura del token:** JWT firmado con `process.env.JWT_SECRET`

**Campos en `req.user`:**
```json
{
  "id": "user_12345",
  "email": "usuario@example.com", 
  "role": "admin|agent|viewer"
}
```

---

## 📋 **TIPOS DE DATOS GARANTIZADOS**

### **Mensaje (Message):**
- ✅ `id`: string (NUNCA null/undefined)
- ✅ `conversationId`: string (formato: `conv_XXXXXX_YYYYYY`)
- ✅ `content`: string (puede ser string vacío `""`)
- ✅ `type`: string (`text|image|file|audio|video|document`)
- ✅ `timestamp`: string ISO 8601 (NUNCA Firestore timestamp object)
- ✅ `sender`: object (NUNCA null, siempre con `id`, `name`, `type`)
- ✅ `direction`: string (`inbound|outbound`)
- ✅ `attachments`: array (NUNCA null, puede ser `[]`)
- ✅ `isRead`: boolean (NUNCA string)
- ✅ `isDelivered`: boolean (NUNCA string)
- ✅ `metadata`: object (NUNCA null)

### **Conversación (Conversation):**
- ✅ `id`: string (NUNCA null/undefined)
- ✅ `contact`: object (NUNCA null, siempre con `id`, `name`, `channel`)
- ✅ `lastMessage`: Message object o `null`
- ✅ `status`: string (`open|closed|pending|archived`)
- ✅ `assignedTo`: object con `{id, name}` o `null`
- ✅ `createdAt`: string ISO 8601
- ✅ `updatedAt`: string ISO 8601

---

## 🚨 **LOGS DE VERIFICACIÓN**

El backend incluye logs automáticos para verificar la estructura:

```bash
🔍 PRIMER MENSAJE FORMATEADO: {"id":"msg_12345","hasAllFields":{"id":true,"conversationId":true,"content":true,"type":true,"timestamp":true,"sender":true,"direction":true,"isRead":true,"isDelivered":true},"senderType":"contact","attachmentsCount":0}

📤 ENVIANDO RESPUESTA FINAL: {"responseStructure":["messages","total","page","limit"],"messagesCount":1,"hasMessages":true,"firstMessageStructure":["id","conversationId","content","type","timestamp","sender","direction","attachments","isRead","isDelivered","metadata"],"total":1,"limit":50,"page":1}

RESPONSE_FINAL: {"messagesCount":1,"hasMessages":true,"structure":["messages","total","page","limit"],"sampleMessage":["id","conversationId","content","type","timestamp","sender","direction","attachments","isRead","isDelivered","metadata"]}
```

---

## ✅ **GARANTÍAS DEL BACKEND**

1. **NUNCA devuelve:** `data`, `result`, `items`, `pagination` anidada
2. **SIEMPRE devuelve:** Arrays con nombres específicos (`messages`, `conversations`)
3. **TODOS los timestamps:** Convertidos a ISO 8601 strings
4. **TODOS los objetos:** Limpiados de `undefined`/`null` donde no corresponde
5. **ESTRUCTURA IDÉNTICA:** REST y WebSocket usan la misma estructura
6. **COMPATIBILIDAD:** 100% alineado con interfaces TypeScript del frontend

---

## 🔧 **TESTING CON FRONTEND**

### **Test rápido:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/conversations/conv_123_456/messages?limit=10"
```

**Debe devolver EXACTAMENTE:**
```json
{
  "messages": [...],
  "total": N,
  "page": 1, 
  "limit": 10
}
```

### **Verificación de estructura:**
- ✅ Campo `messages` presente (no `data`)
- ✅ Cada mensaje tiene `sender` object
- ✅ Cada mensaje tiene `isRead` boolean
- ✅ Timestamps son strings ISO 8601
- ✅ Arrays nunca son `null`

---

## 📚 **DOCUMENTACIÓN ADICIONAL**

- **Swagger/OpenAPI:** `/docs/swagger.yaml`
- **Esquemas de validación:** `/src/utils/validation.js`
- **Modelos de datos:** `/src/models/`
- **Guía de integración:** `/docs/integration-checklist.md`

---

## 🔥 **ÍNDICES REQUERIDOS EN FIRESTORE**

### **Índices Críticos (Requeridos para Producción):**

#### **Colección `conversations`:**
```javascript
// Filtro por agente asignado
conversations.assignedTo_lastMessageAt

// Filtro por estado
conversations.status_lastMessageAt

// Filtro por teléfono del cliente
conversations.customerPhone_lastMessageAt

// Filtro compuesto
conversations.assignedTo_status_lastMessageAt
```

#### **Colección `messages` (Collection Group):**
```javascript
// Ordenamiento por timestamp
messages.timestamp

// Filtro por dirección
messages.direction_timestamp

// Filtro por tipo
messages.type_timestamp

// Filtro por usuario
messages.userId_timestamp
```

### **Comandos para Crear Índices:**

```bash
# Verificar índices existentes
firebase firestore:indexes:list --project=utalk-backend

# Crear índices específicos
firebase firestore:indexes:create --project=utalk-backend --collection=conversations --fields=assignedTo,lastMessageAt

# Ver documentación completa
cat docs/FIRESTORE_INDEXES.md
```

---

## ⚡ **OPTIMIZACIÓN DE PERFORMANCE**

### **Paginación Basada en Cursor:**

El sistema implementa paginación eficiente usando cursores de Firestore:

```javascript
// Primera página
GET /api/conversations/conv_123/messages?limit=50

// Página siguiente (usando cursor)
GET /api/conversations/conv_123/messages?limit=50&cursor=eyJ0aW1lc3RhbXAiOiIyMDI0LTAxLTE1VDEwOjMwOjAwLjAwMFoiLCJpZCI6Im1zZ18xMjM0NSJ9
```

### **Métricas de Performance Esperadas:**

- **Query de conversaciones**: < 200ms
- **Query de mensajes**: < 100ms
- **Paginación**: < 50ms por página
- **Búsqueda**: < 300ms

### **Logs de Debugging:**

El sistema incluye logs detallados para monitoreo:

```javascript
// Log de paginación
[CONVERSATIONS API PAGINATION] Detalles de paginación {
  pagination: { limit: 50, orderBy: 'timestamp', order: 'desc' },
  results: { total: 25, hasMore: false, showing: 25 },
  performance: { executionTime: 45, itemsPerSecond: 556 }
}

// Log de filtros aplicados
[CONVERSATIONS API FILTERS] Filtros aplicados {
  activeFilters: { assignedTo: 'user123', status: 'open' },
  totalFilters: 3,
  activeFiltersCount: 2
}
```

### **Monitoreo de Índices:**

```javascript
// Verificar uso de índices
[CONVERSATIONS API INDEX] Uso de índice {
  collection: 'conversations',
  filters: { assignedTo: 'user123', status: 'open' },
  indexUsed: 'assignedTo_status_lastMessageAt',
  performance: { executionTime: 150, indexEfficiency: 'excellent' }
}
```

---

## 📊 **MONITOREO Y DEBUGGING**

### **Logs Automáticos:**

- ✅ **Conteo de resultados** por query
- ✅ **Filtros aplicados** con razones
- ✅ **Performance de endpoints** con métricas
- ✅ **Uso de índices** con eficiencia
- ✅ **Errores de validación** detallados

### **Métricas de Performance:**

```javascript
// Ejemplo de log de performance
[CONVERSATIONS API PERFORMANCE] Métricas de endpoint {
  metrics: {
    executionTime: 245,
    queriesExecuted: 2,
    documentsRead: 50
  },
  performance: {
    queriesPerSecond: 8,
    documentsPerSecond: 204
  }
}
```

### **Alertas Recomendadas:**

1. **Query sin índice**: > 1000ms
2. **Query con índice**: > 500ms
3. **Documentos leídos**: > 1000 por query
4. **Índices faltantes**: Cualquier error de índice

---

## 🚨 **TROUBLESHOOTING**

### **Error: "The query requires an index"**

**Solución:**
1. Verificar que el índice existe en Firebase Console
2. Esperar a que el índice se construya (puede tomar minutos)
3. Usar fallback temporal mientras se construye el índice

### **Performance Lenta**

**Solución:**
1. Verificar que se están usando los índices correctos
2. Optimizar queries para usar menos filtros
3. Implementar paginación cursor-based
4. Usar `limit()` en todas las queries

### **Logs de Debugging:**

```bash
# Ver logs detallados
npm run dev

# Monitorear queries específicas
grep "QUERY MONITOR" logs/app.log

# Verificar performance
grep "PERFORMANCE" logs/app.log
``` 