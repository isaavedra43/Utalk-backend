# 🔌 APIS, ENDPOINTS Y CONTRATOS - UTalk Backend

## 📋 PRINCIPIOS DE CONTRATO

### 🎯 Estándares de API
- **Content-Type**: `application/json` para todas las requests/responses
- **Encoding**: UTF-8
- **Compression**: Gzip para responses > 1KB
- **CORS**: Configurado para orígenes permitidos

### 📝 Formato de Respuesta
```javascript
// ✅ Success Response
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation completed successfully",
  "timestamp": "2025-08-20T10:00:00Z"
}

// ❌ Error Response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Campo 'email' es requerido",
    "details": {
      "path": "email",
      "value": null
    }
  },
  "timestamp": "2025-08-20T10:00:00Z"
}
```

### 🔢 Códigos de Estado HTTP
- **200**: Success
- **201**: Created
- **400**: Bad Request (validación)
- **401**: Unauthorized (no autenticado)
- **403**: Forbidden (no autorizado)
- **404**: Not Found
- **409**: Conflict (duplicado)
- **422**: Unprocessable Entity
- **429**: Too Many Requests (rate limit)
- **500**: Internal Server Error

---

## 🔐 AUTENTICACIÓN Y AUTORIZACIÓN

### 🎫 JWT Tokens
```javascript
// Request Header
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// Token Payload
{
  "sub": "user_uuid",
  "email": "user@example.com",
  "role": "admin|agent|bot|service",
  "workspaceId": "ws_123",
  "tenantId": "tenant_456",
  "iat": 1732089600,
  "exp": 1732090500
}
```

### 🔄 Refresh Token
```javascript
// POST /api/auth/refresh
{
  "refreshToken": "refresh_token_here"
}

// Response
{
  "success": true,
  "data": {
    "accessToken": "new_access_token",
    "refreshToken": "new_refresh_token",
    "expiresIn": 900 // 15 minutes
  }
}
```

### 🎭 Roles y Permisos
| Rol | Permisos | Acceso |
|-----|----------|--------|
| **admin** | Full access | Todo el workspace |
| **agent** | Conversation management | Conversaciones asignadas |
| **bot** | Message sending | Conversaciones con bot activo |
| **service** | System operations | Operaciones internas |

---

## 📚 CATÁLOGO DE ENDPOINTS (REST)

### 🔐 AUTHENTICATION

#### POST /api/auth/login
**Descripción**: Autenticación de usuario
**Auth**: No requerida
**Rate Limit**: 5 requests/minuto

```javascript
// Request Body
{
  "email": "user@example.com",
  "password": "secure_password",
  "deviceInfo": {
    "userAgent": "Mozilla/5.0...",
    "ip": "192.168.1.1"
  }
}

// Response (200)
{
  "success": true,
  "data": {
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token",
    "user": {
      "id": "user_uuid",
      "email": "user@example.com",
      "role": "admin",
      "workspaceId": "ws_123",
      "tenantId": "tenant_456",
      "status": "active",
      "lastLogin": "2025-08-20T10:00:00Z"
    },
    "expiresIn": 900
  }
}

// Error (401)
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email o contraseña incorrectos"
  }
}
```

#### POST /api/auth/logout
**Descripción**: Cerrar sesión e invalidar tokens
**Auth**: Bearer token requerido

```javascript
// Request Body
{
  "refreshToken": "refresh_token_here"
}

// Response (200)
{
  "success": true,
  "message": "Sesión cerrada exitosamente"
}
```

#### POST /api/auth/refresh
**Descripción**: Renovar access token
**Auth**: No requerida (usa refresh token)

```javascript
// Request Body
{
  "refreshToken": "refresh_token_here"
}

// Response (200)
{
  "success": true,
  "data": {
    "accessToken": "new_jwt_token",
    "refreshToken": "new_refresh_token",
    "expiresIn": 900
  }
}
```

### 👤 USUARIOS

#### GET /api/users/me
**Descripción**: Obtener perfil del usuario autenticado
**Auth**: Bearer token requerido

```javascript
// Response (200)
{
  "success": true,
  "data": {
    "id": "user_uuid",
    "email": "user@example.com",
    "role": "admin",
    "workspaceId": "ws_123",
    "tenantId": "tenant_456",
    "status": "active",
    "profile": {
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "https://...",
      "phone": "+1234567890"
    },
    "preferences": {
      "language": "es",
      "timezone": "America/Mexico_City",
      "notifications": {
        "email": true,
        "push": true
      }
    },
    "createdAt": "2025-08-20T10:00:00Z",
    "lastLogin": "2025-08-20T15:30:00Z"
  }
}
```

#### PUT /api/users/me
**Descripción**: Actualizar perfil del usuario
**Auth**: Bearer token requerido

```javascript
// Request Body
{
  "profile": {
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890"
  },
  "preferences": {
    "language": "es",
    "notifications": {
      "email": true,
      "push": false
    }
  }
}

// Response (200)
{
  "success": true,
  "data": {
    "id": "user_uuid",
    "profile": { /* updated profile */ },
    "preferences": { /* updated preferences */ },
    "updatedAt": "2025-08-20T16:00:00Z"
  }
}
```

### 💬 CONVERSACIONES

#### GET /api/conversations
**Descripción**: Listar conversaciones con paginación
**Auth**: Bearer token requerido
**Rate Limit**: 100 requests/minuto

```javascript
// Query Parameters
?cursor=conv_123&limit=20&status=open&channel=whatsapp&assignedTo=agent_uuid

// Response (200)
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "conv_+1234567890_+0987654321",
        "participants": ["+1234567890", "+0987654321"],
        "status": "open",
        "channel": "whatsapp",
        "assignedAgent": "agent_uuid",
        "botEnabled": true,
        "lastMessage": {
          "id": "msg_uuid",
          "text": "Hola, ¿cómo estás?",
          "sender": "+1234567890",
          "createdAt": "2025-08-20T15:30:00Z"
        },
        "unreadCount": 3,
        "createdAt": "2025-08-20T10:00:00Z",
        "updatedAt": "2025-08-20T15:30:00Z"
      }
    ],
    "pagination": {
      "nextCursor": "conv_456",
      "hasMore": true,
      "total": 150
    }
  }
}
```

#### GET /api/conversations/:id
**Descripción**: Obtener conversación específica
**Auth**: Bearer token requerido

```javascript
// Response (200)
{
  "success": true,
  "data": {
    "id": "conv_+1234567890_+0987654321",
    "participants": ["+1234567890", "+0987654321"],
    "status": "open",
    "channel": "whatsapp",
    "assignedAgent": "agent_uuid",
    "botEnabled": true,
    "metadata": {
      "customerName": "John Doe",
      "customerEmail": "john@example.com",
      "tags": ["support", "urgent"]
    },
    "createdAt": "2025-08-20T10:00:00Z",
    "updatedAt": "2025-08-20T15:30:00Z"
  }
}
```

#### POST /api/conversations/:id/assign
**Descripción**: Asignar conversación a agente
**Auth**: Bearer token requerido (admin/agent)

```javascript
// Request Body
{
  "agentId": "agent_uuid",
  "reason": "manual_assignment"
}

// Response (200)
{
  "success": true,
  "data": {
    "conversationId": "conv_+1234567890_+0987654321",
    "assignedAgent": "agent_uuid",
    "assignedAt": "2025-08-20T16:00:00Z"
  }
}
```

#### POST /api/conversations/:id/return-to-bot
**Descripción**: Devolver conversación al bot
**Auth**: Bearer token requerido (admin/agent)

```javascript
// Request Body
{
  "reason": "resolved|timeout|manual"
}

// Response (200)
{
  "success": true,
  "data": {
    "conversationId": "conv_+1234567890_+0987654321",
    "botEnabled": true,
    "assignedAgent": null,
    "returnedAt": "2025-08-20T16:00:00Z"
  }
}
```

### 📨 MENSAJES

#### GET /api/conversations/:id/messages
**Descripción**: Obtener mensajes de una conversación
**Auth**: Bearer token requerido
**Rate Limit**: 200 requests/minuto

```javascript
// Query Parameters
?cursor=msg_123&limit=50&type=text&direction=inbound

// Response (200)
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg_uuid-v4",
        "messageId": "uuid-v4",
        "conversationId": "conv_+1234567890_+0987654321",
        "type": "text",
        "text": "Hola, ¿cómo estás?",
        "sender": "+1234567890",
        "direction": "inbound",
        "status": "delivered",
        "mediaId": null,
        "metadata": {
          "clientTs": "2025-08-20T10:00:00Z",
          "twilioSid": "SM123456789"
        },
        "createdAt": "2025-08-20T10:00:00Z"
      }
    ],
    "pagination": {
      "nextCursor": "msg_456",
      "hasMore": true,
      "total": 150
    }
  }
}
```

#### POST /api/messages
**Descripción**: Enviar mensaje
**Auth**: Bearer token requerido
**Rate Limit**: 60 requests/minuto

```javascript
// Request Body
{
  "conversationId": "conv_+1234567890_+0987654321",
  "messageId": "uuid-v4", // Para deduplicación
  "type": "text|image|audio|file|location|sticker",
  "text": "Hola, ¿en qué puedo ayudarte?",
  "mediaId": null, // Para mensajes con media
  "metadata": {
    "clientTs": "2025-08-20T10:00:00Z",
    "botResponse": true
  }
}

// Response (201)
{
  "success": true,
  "data": {
    "id": "msg_uuid-v4",
    "messageId": "uuid-v4",
    "conversationId": "conv_+1234567890_+0987654321",
    "type": "text",
    "text": "Hola, ¿en qué puedo ayudarte?",
    "sender": "+0987654321", // Número del workspace
    "direction": "outbound",
    "status": "sent",
    "twilioSid": "SM123456789",
    "createdAt": "2025-08-20T10:00:00Z"
  }
}

// Error (409) - Duplicado
{
  "success": false,
  "error": {
    "code": "MESSAGE_DUPLICATE",
    "message": "Mensaje duplicado detectado",
    "details": {
      "messageId": "uuid-v4",
      "existingMessageId": "msg_uuid-v4"
    }
  }
}
```

#### PUT /api/messages/:id/status
**Descripción**: Actualizar estado de mensaje
**Auth**: Bearer token requerido

```javascript
// Request Body
{
  "status": "sent|delivered|read|failed",
  "metadata": {
    "twilioSid": "SM123456789",
    "deliveredAt": "2025-08-20T10:05:00Z"
  }
}

// Response (200)
{
  "success": true,
  "data": {
    "id": "msg_uuid-v4",
    "status": "delivered",
    "updatedAt": "2025-08-20T10:05:00Z"
  }
}
```

### 📎 MEDIA

#### POST /api/media/upload
**Descripción**: Subir archivo multimedia
**Auth**: Bearer token requerido
**Rate Limit**: 10 requests/minuto

```javascript
// Request (multipart/form-data)
Content-Type: multipart/form-data

{
  "file": File,
  "conversationId": "conv_+1234567890_+0987654321",
  "messageId": "msg_uuid-v4",
  "type": "image|audio|file|video"
}

// Response (201)
{
  "success": true,
  "data": {
    "id": "media_uuid-v4",
    "conversationId": "conv_+1234567890_+0987654321",
    "messageId": "msg_uuid-v4",
    "type": "image",
    "mimeType": "image/jpeg",
    "fileName": "photo.jpg",
    "sizeBytes": 1024000,
    "url": "https://storage.googleapis.com/utalk-media/...",
    "publicUrl": "https://utalk-backend.railway.app/media/...",
    "uploadedBy": "user_uuid",
    "createdAt": "2025-08-20T10:00:00Z"
  }
}
```

#### GET /api/media/:id
**Descripción**: Obtener información de media
**Auth**: Bearer token requerido

```javascript
// Response (200)
{
  "success": true,
  "data": {
    "id": "media_uuid-v4",
    "conversationId": "conv_+1234567890_+0987654321",
    "messageId": "msg_uuid-v4",
    "type": "image",
    "mimeType": "image/jpeg",
    "fileName": "photo.jpg",
    "sizeBytes": 1024000,
    "url": "https://storage.googleapis.com/utalk-media/...",
    "publicUrl": "https://utalk-backend.railway.app/media/...",
    "uploadedBy": "user_uuid",
    "createdAt": "2025-08-20T10:00:00Z"
  }
}
```

#### GET /api/media/:id/download
**Descripción**: Descargar archivo (redirect a URL firmada)
**Auth**: Bearer token requerido

```javascript
// Response (302)
Location: https://storage.googleapis.com/utalk-media/...?signature=...
```

### 🚨 ESCALAMIENTO

#### POST /api/escalate
**Descripción**: Escalar conversación a agente
**Auth**: Bearer token requerido

```javascript
// Request Body
{
  "conversationId": "conv_+1234567890_+0987654321",
  "reason": "manual|keyword|intent|timeout",
  "agentId": "agent_uuid", // Opcional, auto-assign si no se especifica
  "notes": "Cliente requiere atención especializada"
}

// Response (201)
{
  "success": true,
  "data": {
    "id": "escalation_uuid",
    "conversationId": "conv_+1234567890_+0987654321",
    "reason": "manual",
    "fromAgent": null,
    "toAgent": "agent_uuid",
    "status": "pending",
    "notes": "Cliente requiere atención especializada",
    "createdAt": "2025-08-20T16:00:00Z"
  }
}
```

#### POST /api/escalations/:id/accept
**Descripción**: Aceptar escalamiento
**Auth**: Bearer token requerido (agent)

```javascript
// Response (200)
{
  "success": true,
  "data": {
    "id": "escalation_uuid",
    "status": "accepted",
    "acceptedAt": "2025-08-20T16:05:00Z"
  }
}
```

### 📊 KPIs Y REPORTES

#### GET /api/kpis/conversations
**Descripción**: KPIs de conversaciones
**Auth**: Bearer token requerido (admin/agent)

```javascript
// Query Parameters
?startDate=2025-08-01&endDate=2025-08-20&channel=whatsapp

// Response (200)
{
  "success": true,
  "data": {
    "period": {
      "startDate": "2025-08-01T00:00:00Z",
      "endDate": "2025-08-20T23:59:59Z"
    },
    "metrics": {
      "totalConversations": 1250,
      "openConversations": 45,
      "resolvedConversations": 1205,
      "averageResolutionTime": 3600, // segundos
      "escalationRate": 0.15, // 15%
      "botSatisfaction": 0.85 // 85%
    },
    "byChannel": {
      "whatsapp": {
        "total": 800,
        "resolved": 760,
        "escalated": 40
      },
      "facebook": {
        "total": 450,
        "resolved": 445,
        "escalated": 5
      }
    }
  }
}
```

#### GET /api/kpis/agents
**Descripción**: KPIs de agentes
**Auth**: Bearer token requerido (admin)

```javascript
// Response (200)
{
  "success": true,
  "data": {
    "agents": [
      {
        "id": "agent_uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "status": "online",
        "metrics": {
          "conversationsHandled": 150,
          "averageResponseTime": 120, // segundos
          "resolutionRate": 0.95, // 95%
          "customerSatisfaction": 0.88 // 88%
        },
        "currentLoad": {
          "activeConversations": 3,
          "maxConversations": 10
        }
      }
    ]
  }
}
```

---

## 🔗 WEBHOOKS ENTRANTES

### 📱 Twilio WhatsApp

#### POST /webhooks/twilio/whatsapp
**Descripción**: Webhook para mensajes de WhatsApp
**Auth**: Verificación de firma Twilio
**Rate Limit**: No aplica

```javascript
// Request Body (Twilio)
{
  "MessageSid": "SM123456789",
  "From": "whatsapp:+1234567890",
  "To": "whatsapp:+0987654321",
  "Body": "Hola, ¿cómo estás?",
  "NumMedia": "0",
  "MediaUrl0": null,
  "Timestamp": "1732089600",
  "AccountSid": "AC123456789"
}

// Response (200)
{
  "success": true,
  "messageId": "msg_uuid-v4"
}
```

### 📘 Facebook Messenger

#### POST /webhooks/facebook/messages
**Descripción**: Webhook para mensajes de Facebook
**Auth**: Verificación de firma Facebook
**Rate Limit**: No aplica

```javascript
// Request Body (Facebook)
{
  "object": "page",
  "entry": [
    {
      "id": "page_id",
      "time": 1732089600,
      "messaging": [
        {
          "sender": {
            "id": "user_id"
          },
          "recipient": {
            "id": "page_id"
          },
          "timestamp": 1732089600,
          "message": {
            "mid": "message_id",
            "text": "Hola, ¿cómo estás?"
          }
        }
      ]
    }
  ]
}

// Response (200)
{
  "success": true,
  "messageId": "msg_uuid-v4"
}
```

#### GET /webhooks/facebook/verify
**Descripción**: Verificación de webhook Facebook
**Auth**: No requerida

```javascript
// Query Parameters
?hub.mode=subscribe&hub.challenge=123456789&hub.verify_token=your_verify_token

// Response (200)
123456789
```

---

## 📤 WEBHOOKS SALIENTES

### 🔔 Notificaciones a Terceros

#### POST /webhooks/outgoing/notifications
**Descripción**: Enviar notificaciones a sistemas externos
**Auth**: API Key requerida

```javascript
// Request Body
{
  "event": "message:new|conversation:escalated|agent:assigned",
  "data": {
    "conversationId": "conv_+1234567890_+0987654321",
    "messageId": "msg_uuid-v4",
    "timestamp": "2025-08-20T10:00:00Z"
  },
  "recipients": ["system1", "system2"]
}

// Response (200)
{
  "success": true,
  "delivered": ["system1"],
  "failed": ["system2"]
}
```

---

## 📄 PAGINACIÓN, FILTROS Y ORDEN

### 🔢 Paginación
```javascript
// Query Parameters
?cursor=item_id&limit=20&direction=forward|backward

// Response
{
  "data": [...],
  "pagination": {
    "nextCursor": "next_item_id",
    "prevCursor": "prev_item_id",
    "hasMore": true,
    "total": 150
  }
}
```

### 🔍 Filtros
```javascript
// Conversaciones
?status=open|pending|closed|escalated
?channel=whatsapp|facebook|web
?assignedTo=agent_uuid
?createdAfter=2025-08-01T00:00:00Z
?createdBefore=2025-08-20T23:59:59Z

// Mensajes
?type=text|image|audio|file|location|sticker
?direction=inbound|outbound
?sender=+1234567890
```

### 📊 Ordenamiento
```javascript
// Query Parameters
?sort=createdAt:desc|asc
?sort=updatedAt:desc|asc
?sort=status:asc|desc

// Múltiples campos
?sort=status:asc,createdAt:desc
```

### 🔄 Idempotencia
- **Message ID**: UUID v4 para deduplicación
- **Conversation ID**: Formato consistente
- **Media ID**: UUID v4 único por archivo

---

## 📦 VERSIONADO Y DEPRECACIONES

### 🏷️ Versionado de API
```javascript
// URLs versionadas
/api/v1/conversations
/api/v2/conversations

// Headers de versión
Accept: application/vnd.utalk.v1+json
X-API-Version: v1
```

### 🔄 Políticas de Cambios
- **Breaking Changes**: 6 meses de aviso
- **Deprecations**: Headers `X-Deprecated: true`
- **Migration Path**: Documentación obligatoria
- **Backward Compatibility**: 2 versiones anteriores

### 📋 Deprecación de Endpoints
```javascript
// Response con deprecación
{
  "success": true,
  "data": {...},
  "deprecation": {
    "warning": "Este endpoint será eliminado en v2.0.0",
    "sunsetDate": "2025-12-20T00:00:00Z",
    "migrationPath": "/api/v2/conversations"
  }
}
```

---

## 📋 ANEXOS - ESQUEMAS JSON

### 🔐 Auth Schemas

#### Login Request
```json
{
  "email": "user@example.com",
  "password": "secure_password",
  "deviceInfo": {
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "ip": "192.168.1.1"
  }
}
```

#### Login Response
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_token_here",
    "user": {
      "id": "user_uuid",
      "email": "user@example.com",
      "role": "admin",
      "workspaceId": "ws_123",
      "tenantId": "tenant_456",
      "status": "active",
      "lastLogin": "2025-08-20T10:00:00Z"
    },
    "expiresIn": 900
  }
}
```

### 💬 Conversation Schemas

#### Conversation Object
```json
{
  "id": "conv_+1234567890_+0987654321",
  "participants": ["+1234567890", "+0987654321"],
  "status": "open",
  "channel": "whatsapp",
  "assignedAgent": "agent_uuid",
  "botEnabled": true,
  "metadata": {
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "tags": ["support", "urgent"]
  },
  "lastMessage": {
    "id": "msg_uuid",
    "text": "Hola, ¿cómo estás?",
    "sender": "+1234567890",
    "createdAt": "2025-08-20T15:30:00Z"
  },
  "unreadCount": 3,
  "createdAt": "2025-08-20T10:00:00Z",
  "updatedAt": "2025-08-20T15:30:00Z"
}
```

### 📨 Message Schemas

#### Send Message Request
```json
{
  "conversationId": "conv_+1234567890_+0987654321",
  "messageId": "uuid-v4",
  "type": "text",
  "text": "Hola, ¿en qué puedo ayudarte?",
  "mediaId": null,
  "metadata": {
    "clientTs": "2025-08-20T10:00:00Z",
    "botResponse": true
  }
}
```

#### Message Object
```json
{
  "id": "msg_uuid-v4",
  "messageId": "uuid-v4",
  "conversationId": "conv_+1234567890_+0987654321",
  "type": "text",
  "text": "Hola, ¿cómo estás?",
  "sender": "+1234567890",
  "direction": "inbound",
  "status": "delivered",
  "mediaId": null,
  "metadata": {
    "clientTs": "2025-08-20T10:00:00Z",
    "twilioSid": "SM123456789"
  },
  "createdAt": "2025-08-20T10:00:00Z"
}
```

### 📎 Media Schemas

#### Upload Media Request
```json
{
  "conversationId": "conv_+1234567890_+0987654321",
  "messageId": "msg_uuid-v4",
  "type": "image"
}
```

#### Media Object
```json
{
  "id": "media_uuid-v4",
  "conversationId": "conv_+1234567890_+0987654321",
  "messageId": "msg_uuid-v4",
  "type": "image",
  "mimeType": "image/jpeg",
  "fileName": "photo.jpg",
  "sizeBytes": 1024000,
  "url": "https://storage.googleapis.com/utalk-media/...",
  "publicUrl": "https://utalk-backend.railway.app/media/...",
  "uploadedBy": "user_uuid",
  "createdAt": "2025-08-20T10:00:00Z"
}
```

### ❌ Error Schemas

#### Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Campo 'email' es requerido",
    "details": {
      "path": "email",
      "value": null,
      "constraints": ["required"]
    }
  },
  "timestamp": "2025-08-20T10:00:00Z"
}
```

#### Authentication Error
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token de acceso inválido o expirado",
    "details": {
      "expiredAt": "2025-08-20T10:15:00Z"
    }
  },
  "timestamp": "2025-08-20T10:16:00Z"
}
```

#### Rate Limit Error
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Límite de requests excedido",
    "details": {
      "limit": 100,
      "resetAt": "2025-08-20T11:00:00Z"
    }
  },
  "timestamp": "2025-08-20T10:30:00Z"
}
```

---

## 🧪 TESTS Y VALIDACIÓN

### 📋 Checklist de Testing
- [ ] **Happy Path**: Flujos exitosos completos
- [ ] **Error Cases**: Todos los códigos de error
- [ ] **Validation**: Campos requeridos y formatos
- [ ] **Authentication**: Tokens válidos/inválidos
- [ ] **Authorization**: Roles y permisos
- [ ] **Rate Limiting**: Límites por endpoint
- [ ] **Idempotency**: Requests duplicados
- [ ] **Pagination**: Cursors y límites
- [ ] **Webhooks**: Firmas y retries

### 🔧 Herramientas de Testing
```bash
# Test de endpoints
curl -X POST https://utalk-backend.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Test de webhooks
curl -X POST https://utalk-backend.railway.app/webhooks/twilio/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "MessageSid=SM123&From=whatsapp:+1234567890&Body=Test"
```

---

**📝 Nota**: Este documento es la fuente de verdad para todos los contratos de API. Cualquier cambio debe ser versionado y documentado aquí. 