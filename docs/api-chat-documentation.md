# 📡 **API DE CHAT/MENSAJERÍA - DOCUMENTACIÓN COMPLETA**

## **🎯 INTRODUCCIÓN**

Esta documentación describe la API RESTful completa del módulo de chat/mensajería del sistema UTalk, implementada siguiendo las mejores prácticas de diseño de APIs [[Vinay Sahni]](https://www.vinaysahni.com/best-practices-for-a-pragmatic-restful-api) y [[ReadMe]](https://blog.readme.com/how-to-write-good-api-errors/).

### **🔑 CARACTERÍSTICAS PRINCIPALES**
- **Arquitectura EMAIL-FIRST**: Todos los usuarios se identifican por email
- **Autenticación JWT**: Tokens internos seguros sin dependencia de Firebase Auth
- **WebSockets**: Comunicación en tiempo real para notificaciones
- **Webhooks**: Integración con Twilio para WhatsApp
- **Paginación cursor-based**: Rendimiento optimizado para grandes datasets
- **Manejo de errores estructurado**: Respuestas consistentes y descriptivas

---

## **🔐 AUTENTICACIÓN**

Todos los endpoints requieren autenticación via Bearer Token JWT, excepto los webhooks públicos.

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **🚪 LOGIN**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "usuario@ejemplo.com",
  "password": "password123"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "email": "usuario@ejemplo.com",
      "name": "Usuario Ejemplo",
      "role": "agent",
      "isActive": true
    }
  },
  "message": "Login exitoso",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## **💬 CONVERSACIONES**

### **📋 LISTAR CONVERSACIONES**
```http
GET /api/conversations?limit=20&assignedTo=me&status=open&priority=high
Authorization: Bearer {token}
```

**Parámetros de consulta:**
- `limit` (number): Número de resultados (default: 20, max: 100)
- `cursor` (string): Cursor de paginación
- `assignedTo` (string): `me` | `unassigned` | `all` | email del agente
- `status` (string): `open` | `closed` | `pending` | `archived`
- `priority` (string): `low` | `normal` | `high` | `urgent`
- `tags` (array): Array de etiquetas
- `search` (string): Búsqueda en teléfono/nombre (min: 2 caracteres)
- `sortBy` (string): `lastMessageAt` | `createdAt` | `priority`
- `sortOrder` (string): `asc` | `desc`

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "conv_uuid_123",
      "participants": ["+1234567890", "agente@ejemplo.com"],
      "customerPhone": "+1234567890",
      "contact": {
        "id": "+1234567890",
        "name": "Juan Pérez",
        "avatar": null,
        "channel": "whatsapp"
      },
      "assignedTo": {
        "email": "agente@ejemplo.com",
        "name": "Agente Ejemplo"
      },
      "status": "open",
      "priority": "normal",
      "tags": ["vip", "soporte"],
      "unreadCount": 3,
      "messageCount": 15,
      "lastMessage": "Último mensaje...",
      "lastMessageId": "msg_123",
      "lastMessageAt": "2024-01-15T10:25:00Z",
      "createdAt": "2024-01-15T09:00:00Z",
      "updatedAt": "2024-01-15T10:25:00Z"
    }
  ],
  "pagination": {
    "hasMore": true,
    "nextCursor": "eyJ0aW1lc3RhbXAi...",
    "totalResults": 25,
    "limit": 20
  },
  "message": "25 conversaciones encontradas",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### **👁️ OBTENER CONVERSACIÓN**
```http
GET /api/conversations/{conversationId}
Authorization: Bearer {token}
```

### **➕ CREAR CONVERSACIÓN**
```http
POST /api/conversations
Authorization: Bearer {token}
Content-Type: application/json

{
  "customerPhone": "+1234567890",
  "assignedTo": "agente@ejemplo.com",
  "initialMessage": "Mensaje inicial opcional",
  "priority": "normal",
  "tags": ["nuevo", "soporte"]
}
```

### **👤 ASIGNAR CONVERSACIÓN**
```http
PUT /api/conversations/{conversationId}/assign
Authorization: Bearer {token}
Content-Type: application/json

{
  "assignedTo": "agente@ejemplo.com"
}
```

### **🔄 TRANSFERIR CONVERSACIÓN**
```http
POST /api/conversations/{conversationId}/transfer
Authorization: Bearer {token}
Content-Type: application/json

{
  "fromAgent": "agente1@ejemplo.com",
  "toAgent": "agente2@ejemplo.com",
  "reason": "Especialista en el tema"
}
```

### **🚫 DESASIGNAR CONVERSACIÓN**
```http
PUT /api/conversations/{conversationId}/unassign
Authorization: Bearer {token}
```

### **🔄 CAMBIAR ESTADO**
```http
PUT /api/conversations/{conversationId}/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "closed",
  "reason": "Problema resuelto"
}
```

### **🎯 CAMBIAR PRIORIDAD**
```http
PUT /api/conversations/{conversationId}/priority
Authorization: Bearer {token}
Content-Type: application/json

{
  "priority": "urgent",
  "reason": "Cliente VIP con problema crítico"
}
```

### **✅ MARCAR CONVERSACIÓN COMO LEÍDA**
```http
PUT /api/conversations/{conversationId}/read-all
Authorization: Bearer {token}
```

### **📊 SIN ASIGNAR**
```http
GET /api/conversations/unassigned?limit=20
Authorization: Bearer {token}
```

### **📈 ESTADÍSTICAS**
```http
GET /api/conversations/stats?period=7d&agentEmail=agente@ejemplo.com
Authorization: Bearer {token}
```

### **🔍 BÚSQUEDA**
```http
GET /api/conversations/search?q=Juan&limit=10
Authorization: Bearer {token}
```

### **⌨️ INDICAR TYPING**
```http
POST /api/conversations/{conversationId}/typing
Authorization: Bearer {token}
Content-Type: application/json

{
  "isTyping": true
}
```

---

## **📨 MENSAJES**

### **📋 LISTAR MENSAJES DE CONVERSACIÓN**
```http
GET /api/conversations/{conversationId}/messages?limit=50&order=desc
Authorization: Bearer {token}
```

**Parámetros de consulta:**
- `limit` (number): Número de mensajes (default: 50, max: 100)
- `cursor` (string): Cursor de paginación
- `direction` (string): `inbound` | `outbound` | `system`
- `status` (string): `sent` | `delivered` | `read` | `failed`
- `type` (string): `text` | `image` | `audio` | `video` | `document`
- `startDate` (string): Fecha inicio (ISO)
- `endDate` (string): Fecha fin (ISO)
- `orderBy` (string): `timestamp` | `status`
- `order` (string): `asc` | `desc`

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "msg_123",
      "conversationId": "conv_uuid_123",
      "content": "Hola, necesito ayuda con mi pedido",
      "mediaUrl": null,
      "sender": {
        "identifier": "+1234567890",
        "type": "customer"
      },
      "recipient": {
        "identifier": "agente@ejemplo.com",
        "type": "agent"
      },
      "direction": "inbound",
      "type": "text",
      "status": "received",
      "timestamp": "2024-01-15T10:20:00Z",
      "metadata": {
        "twilio": { "MessageSid": "SMxxx..." },
        "source": "webhook"
      },
      "createdAt": "2024-01-15T10:20:00Z",
      "updatedAt": "2024-01-15T10:20:00Z"
    }
  ],
  "pagination": {
    "hasMore": false,
    "nextCursor": null,
    "totalResults": 15,
    "limit": 50
  },
  "message": "15 mensajes encontrados",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### **➕ CREAR MENSAJE EN CONVERSACIÓN**
```http
POST /api/conversations/{conversationId}/messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "Respuesta del agente",
  "type": "text",
  "mediaUrl": "https://ejemplo.com/imagen.jpg",
  "replyToMessageId": "msg_123",
  "metadata": {
    "priority": "high"
  }
}
```

### **📤 ENVIAR MENSAJE INDEPENDIENTE**
```http
POST /api/messages/send
Authorization: Bearer {token}
Content-Type: application/json

{
  "to": "+1234567890",
  "content": "Mensaje proactivo",
  "type": "text",
  "attachments": [
    {
      "url": "https://ejemplo.com/documento.pdf",
      "type": "document",
      "name": "Manual.pdf"
    }
  ]
}
```

### **✅ MARCAR MENSAJE COMO LEÍDO**
```http
PUT /api/conversations/{conversationId}/messages/{messageId}/read
Authorization: Bearer {token}
Content-Type: application/json

{
  "markTimestamp": "2024-01-15T10:30:00Z"
}
```

### **🗑️ ELIMINAR MENSAJE**
```http
DELETE /api/conversations/{conversationId}/messages/{messageId}
Authorization: Bearer {token}
```

---

## **🔗 WEBHOOKS**

### **📨 WEBHOOK DE TWILIO (PÚBLICO)**
```http
POST /api/messages/webhook
Content-Type: application/x-www-form-urlencoded

From=%2B1234567890&To=%2B1987654321&Body=Mensaje%20entrante&MessageSid=SMxxx...
```

**Respuesta siempre 200 OK:**
```json
{
  "status": "success",
  "message": "Mensaje procesado exitosamente",
  "messageId": "SMxxx...",
  "conversationId": "conv_uuid_123",
  "processTime": "45ms"
}
```

### **✅ VERIFICACIÓN DE WEBHOOK**
```http
GET /api/messages/webhook
```

---

## **🌐 WEBSOCKETS**

### **🔌 CONEXIÓN**
```javascript
const socket = io('wss://api.ejemplo.com', {
  auth: {
    token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
});
```

### **📡 EVENTOS DEL CLIENTE → SERVIDOR**

#### **Unirse a conversación**
```javascript
socket.emit('join-conversation', conversationId, (response) => {
  console.log(response); // { success: true, conversationId: "..." }
});
```

#### **Salir de conversación**
```javascript
socket.emit('leave-conversation', conversationId, (response) => {
  console.log(response); // { success: true }
});
```

#### **Indicar que está escribiendo**
```javascript
socket.emit('typing-start', conversationId, (response) => {
  console.log(response); // { success: true }
});

socket.emit('typing-stop', conversationId, (response) => {
  console.log(response); // { success: true }
});
```

#### **Marcar mensaje como leído**
```javascript
socket.emit('message-read', {
  conversationId: 'conv_123',
  messageId: 'msg_456'
}, (response) => {
  console.log(response); // { success: true }
});
```

### **📡 EVENTOS DEL SERVIDOR → CLIENTE**

#### **Conexión establecida**
```javascript
socket.on('connected', (data) => {
  // data: { email, role, displayName, capabilities, timestamp }
});
```

#### **Nuevo mensaje**
```javascript
socket.on('new-message', (data) => {
  // data: { type, conversationId, message, timestamp }
});
```

#### **Usuario escribiendo**
```javascript
socket.on('user-typing', (data) => {
  // data: { email, displayName, conversationId, isTyping, timestamp }
});
```

#### **Conversación asignada**
```javascript
socket.on('conversation-assigned', (data) => {
  // data: { conversationId, assignedTo, assignedBy, timestamp }
});
```

#### **Estado de conversación cambiado**
```javascript
socket.on('conversation-status-changed', (data) => {
  // data: { conversationId, previousStatus, newStatus, changedBy, timestamp }
});
```

#### **Prioridad cambiada**
```javascript
socket.on('conversation-priority-changed', (data) => {
  // data: { conversationId, previousPriority, newPriority, changedBy, timestamp }
});
```

#### **Mensaje leído por usuario**
```javascript
socket.on('message-read-by-user', (data) => {
  // data: { messageId, conversationId, readBy, readAt, timestamp }
});
```

---

## **❌ MANEJO DE ERRORES**

Todos los errores siguen un formato estándar estructurado:

### **Estructura de Error**
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Descripción detallada del error",
  "suggestion": "Cómo solucionar el problema",
  "docs": "https://api.ejemplo.com/docs/error-code",
  "help": "Si necesitas ayuda, contacta soporte@ejemplo.com",
  "details": {
    "campo": "valor",
    "contexto": "adicional"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### **Códigos de Error Comunes**

| Código | Status | Descripción |
|--------|--------|-------------|
| `CONVERSATION_NOT_FOUND` | 404 | Conversación no encontrada |
| `MESSAGE_NOT_FOUND` | 404 | Mensaje no encontrado |
| `USER_NOT_AUTHORIZED` | 403 | Sin permisos para la acción |
| `VALIDATION_FAILED` | 400 | Datos de entrada inválidos |
| `CONVERSATION_ALREADY_ASSIGNED` | 409 | Conversación ya asignada |
| `MESSAGE_SEND_FAILED` | 500 | Error enviando mensaje |
| `RATE_LIMIT_EXCEEDED` | 429 | Límite de solicitudes excedido |
| `SEARCH_TERM_TOO_SHORT` | 400 | Término de búsqueda muy corto |
| `AGENT_NOT_FOUND` | 404 | Agente no encontrado |
| `AGENT_INACTIVE` | 400 | Agente inactivo |

### **Ejemplos de Errores**

#### **Conversación no encontrada**
```json
{
  "success": false,
  "error": "CONVERSATION_NOT_FOUND",
  "message": "No se pudo encontrar la conversación con ID: conv-123",
  "suggestion": "Verifica que el ID sea correcto y que tengas permisos",
  "docs": "https://api.ejemplo.com/docs/conversations/get",
  "help": "Si necesitas ayuda, contacta soporte@ejemplo.com y menciona 'CONVERSATION_NOT_FOUND'",
  "details": {
    "conversationId": "conv-123"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### **Validación fallida**
```json
{
  "success": false,
  "error": "VALIDATION_FAILED",
  "message": "Los datos enviados no cumplen con el formato requerido",
  "suggestion": "Revisa los campos marcados como inválidos y corrige el formato",
  "docs": "https://api.ejemplo.com/docs/validation",
  "help": "Si necesitas ayuda, contacta soporte@ejemplo.com",
  "details": {
    "validationErrors": [
      {
        "field": "email",
        "message": "Debe ser un email válido",
        "value": "email-invalido"
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## **📊 CÓDIGOS DE ESTADO HTTP**

| Código | Descripción | Uso |
|--------|-------------|-----|
| 200 | OK | Operación exitosa |
| 201 | Created | Recurso creado exitosamente |
| 204 | No Content | Operación exitosa sin contenido |
| 400 | Bad Request | Datos de entrada inválidos |
| 401 | Unauthorized | Autenticación requerida o inválida |
| 403 | Forbidden | Sin permisos para la operación |
| 404 | Not Found | Recurso no encontrado |
| 409 | Conflict | Conflicto con estado actual |
| 422 | Unprocessable Entity | Error de validación |
| 429 | Too Many Requests | Límite de velocidad excedido |
| 500 | Internal Server Error | Error interno del servidor |

---

## **🔧 EJEMPLOS DE INTEGRACIÓN**

### **JavaScript/React**
```javascript
// Configurar cliente HTTP
const apiClient = axios.create({
  baseURL: 'https://api.ejemplo.com',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Listar conversaciones
const getConversations = async (filters = {}) => {
  try {
    const response = await apiClient.get('/api/conversations', {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error('Error:', error.response.data);
    throw error;
  }
};

// Enviar mensaje
const sendMessage = async (conversationId, content) => {
  try {
    const response = await apiClient.post(`/api/conversations/${conversationId}/messages`, {
      content,
      type: 'text'
    });
    return response.data;
  } catch (error) {
    console.error('Error:', error.response.data);
    throw error;
  }
};

// Conectar WebSocket
const connectSocket = (token) => {
  const socket = io('wss://api.ejemplo.com', {
    auth: { token }
  });

  socket.on('connected', (data) => {
    console.log('Conectado como:', data.email);
  });

  socket.on('new-message', (data) => {
    console.log('Nuevo mensaje:', data.message);
    // Actualizar UI
  });

  return socket;
};
```

### **cURL**
```bash
# Listar conversaciones
curl -X GET "https://api.ejemplo.com/api/conversations?limit=10&assignedTo=me" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"

# Enviar mensaje
curl -X POST "https://api.ejemplo.com/api/conversations/conv_123/messages" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hola, ¿en qué puedo ayudarte?",
    "type": "text"
  }'
```

---

## **📈 LÍMITES Y CONSIDERACIONES**

### **Rate Limiting**
- **General**: 1000 requests/hora por usuario
- **WebSocket events**: 60 eventos/minuto
- **Webhook**: Sin límite (origen Twilio verificado)

### **Paginación**
- **Límite máximo**: 100 elementos por página
- **Cursor válido**: 24 horas
- **Recomendado**: 20-50 elementos por página

### **WebSockets**
- **Conexiones concurrentes**: 1 por usuario
- **Timeout**: 60 segundos de inactividad
- **Reconexión automática**: Recomendada

### **Archivos**
- **Tamaño máximo**: 10MB por archivo
- **Tipos soportados**: Imágenes, documentos, audio, video
- **Storage**: URLs temporales de Twilio

---

## **🔒 SEGURIDAD**

### **Autenticación**
- **JWT**: HS256, expiración 24 horas
- **Refresh**: Manual via re-login
- **Revocación**: Cambio de JWT_SECRET

### **Autorización**
- **Roles**: `viewer`, `agent`, `admin`, `superadmin`
- **Permisos**: Granulares por endpoint
- **Conversaciones**: Solo asignadas o admin

### **Validación**
- **Input**: Joi schemas estrictos
- **Sanitización**: Automática
- **Rate limiting**: Por IP y usuario

### **Comunicación**
- **HTTPS**: Obligatorio en producción
- **WSS**: WebSockets seguros
- **CORS**: Configurado por dominio

---

## **🚀 ENTORNOS**

### **Desarrollo**
```
Base URL: http://localhost:3001
WebSocket: ws://localhost:3001
```

### **Staging**
```
Base URL: https://api-staging.ejemplo.com
WebSocket: wss://api-staging.ejemplo.com
```

### **Producción**
```
Base URL: https://api.ejemplo.com
WebSocket: wss://api.ejemplo.com
```

---

## **📞 SOPORTE**

- **Email**: soporte@ejemplo.com
- **Slack**: #api-support
- **Documentación**: https://docs.ejemplo.com
- **Status**: https://status.ejemplo.com

---

*Documentación generada automáticamente v2.0.0 - Última actualización: 2024-01-15* 