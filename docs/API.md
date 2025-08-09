# 🚀 UTalk Backend API Documentation

> **Versión**: 1.0.0  
> **Última actualización**: 2025-08-01  
> **Estado**: 🟢 Ready for Production – audited 2025-08-01

## 📋 Tabla de Contenidos

- [🔐 Autenticación](#-autenticación)
- [👥 Gestión de Usuarios](#-gestión-de-usuarios)
- [📞 Contactos y CRM](#-contactos-y-crm)
- [💬 Conversaciones](#-conversaciones)
- [📨 Mensajes](#-mensajes)
- [📢 Campañas](#-campañas)
- [👨‍💼 Equipos](#-equipos)
- [📚 Base de Conocimientos](#-base-de-conocimientos)
- [📊 Dashboard](#-dashboard)
- [📁 Media y Archivos](#-media-y-archivos)
- [📱 Twilio Webhooks](#-twilio-webhooks)
- [🔧 Utilidades](#-utilidades)

---

## 🔐 Autenticación

### POST /api/auth/login
**Descripción**: Autenticar usuario y obtener tokens de acceso

**Headers**:
```
Content-Type: application/json
```

**Body**:
```json
{
  "email": "usuario@utalk.com",
  "password": "contraseña123"
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "usuario@utalk.com",
      "name": "Usuario Ejemplo",
      "role": "agent",
      "isActive": true
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "refresh_token_here",
      "expiresIn": 900
    }
  },
  "message": "Login exitoso"
}
```

**Errores**:
- `400` - Credenciales inválidas
- `401` - Usuario inactivo
- `500` - Error interno del servidor

---

### POST /api/auth/refresh
**Descripción**: Renovar access token usando refresh token

**Headers**:
```
Content-Type: application/json
```

**Body**:
```json
{
  "refreshToken": "refresh_token_here"
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  },
  "message": "Token renovado exitosamente"
}
```

---

### GET /api/auth/profile
**Descripción**: Obtener perfil del usuario autenticado

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "usuario@utalk.com",
    "name": "Usuario Ejemplo",
    "role": "agent",
    "isActive": true,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "lastLoginAt": "2025-08-01T22:00:00.000Z"
  }
}
```

---

### PUT /api/auth/profile
**Descripción**: Actualizar perfil del usuario

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**:
```json
{
  "name": "Nuevo Nombre",
  "phone": "+1234567890"
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "name": "Nuevo Nombre",
    "phone": "+1234567890",
    "updatedAt": "2025-08-01T22:00:00.000Z"
  },
  "message": "Perfil actualizado exitosamente"
}
```

---

### POST /api/auth/change-password
**Descripción**: Cambiar contraseña del usuario

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**:
```json
{
  "currentPassword": "contraseña_actual",
  "newPassword": "nueva_contraseña123"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Contraseña cambiada exitosamente"
}
```

---

### POST /api/auth/logout
**Descripción**: Cerrar sesión e invalidar tokens

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**:
```json
{
  "refreshToken": "refresh_token_here"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Sesión cerrada exitosamente"
}
```

---

## 👥 Gestión de Usuarios

### GET /api/team
**Descripción**: Listar miembros del equipo

**Headers**:
```
Authorization: Bearer <access_token>
```

**Query Parameters**:
```
?page=1&limit=20&role=agent&status=active&search=nombre
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user_123",
        "email": "agente@utalk.com",
        "name": "Agente Ejemplo",
        "role": "agent",
        "isActive": true,
        "kpis": {
          "totalMessages": 150,
          "responseTime": "2.5s",
          "satisfaction": 4.8
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5
    }
  }
}
```

---

### POST /api/team/invite
**Descripción**: Invitar nuevo miembro al equipo

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**:
```json
{
  "email": "nuevo@utalk.com",
  "name": "Nuevo Miembro",
  "role": "agent"
}
```

**Response (201)**:
```json
{
  "success": true,
  "data": {
    "id": "user_456",
    "email": "nuevo@utalk.com",
    "name": "Nuevo Miembro",
    "role": "agent",
    "invitationSent": true
  },
  "message": "Invitación enviada exitosamente"
}
```

---

### PUT /api/team/:id/role
**Descripción**: Cambiar rol de un miembro

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**:
```json
{
  "newRole": "admin",
  "reason": "Promoción a administrador"
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "previousRole": "agent",
    "newRole": "admin",
    "changedBy": "admin@utalk.com"
  },
  "message": "Rol cambiado exitosamente"
}
```

---

### PUT /api/team/:id/activate
**Descripción**: Activar miembro del equipo

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "isActive": true
  },
  "message": "Usuario activado exitosamente"
}
```

---

### PUT /api/team/:id/deactivate
**Descripción**: Desactivar miembro del equipo

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "isActive": false
  },
  "message": "Usuario desactivado exitosamente"
}
```

---

### DELETE /api/team/:id
**Descripción**: Eliminar miembro del equipo

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "user_123"
  },
  "message": "Usuario eliminado exitosamente"
}
```

---

## 📞 Contactos y CRM

### GET /api/contacts
**Descripción**: Listar contactos con filtros

**Headers**:
```
Authorization: Bearer <access_token>
```

**Query Parameters**:
```
?page=1&limit=20&search=nombre&tags=cliente&status=active
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "contacts": [
      {
        "id": "contact_123",
        "name": "Cliente Ejemplo",
        "phone": "+1234567890",
        "email": "cliente@ejemplo.com",
        "tags": ["cliente", "vip"],
        "totalMessages": 25,
        "lastContactAt": "2025-08-01T22:00:00.000Z",
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150
    }
  }
}
```

---

### POST /api/contacts
**Descripción**: Crear nuevo contacto

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**:
```json
{
  "name": "Nuevo Cliente",
  "phone": "+1234567890",
  "email": "cliente@ejemplo.com",
  "tags": ["cliente", "nuevo"],
  "customFields": {
    "empresa": "Empresa Ejemplo",
    "cargo": "Gerente"
  }
}
```

**Response (201)**:
```json
{
  "success": true,
  "data": {
    "id": "contact_456",
    "name": "Nuevo Cliente",
    "phone": "+1234567890",
    "email": "cliente@ejemplo.com",
    "tags": ["cliente", "nuevo"],
    "customFields": {
      "empresa": "Empresa Ejemplo",
      "cargo": "Gerente"
    },
    "createdAt": "2025-08-01T22:00:00.000Z"
  },
  "message": "Contacto creado exitosamente"
}
```

---

### GET /api/contacts/:id
**Descripción**: Obtener contacto específico

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "contact_123",
    "name": "Cliente Ejemplo",
    "phone": "+1234567890",
    "email": "cliente@ejemplo.com",
    "tags": ["cliente", "vip"],
    "totalMessages": 25,
    "lastContactAt": "2025-08-01T22:00:00.000Z",
    "customFields": {
      "empresa": "Empresa Ejemplo",
      "cargo": "Gerente"
    },
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-08-01T22:00:00.000Z"
  }
}
```

---

### PUT /api/contacts/:id
**Descripción**: Actualizar contacto

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**:
```json
{
  "name": "Cliente Actualizado",
  "tags": ["cliente", "vip", "activo"],
  "customFields": {
    "empresa": "Nueva Empresa",
    "cargo": "Director"
  }
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "contact_123",
    "name": "Cliente Actualizado",
    "tags": ["cliente", "vip", "activo"],
    "customFields": {
      "empresa": "Nueva Empresa",
      "cargo": "Director"
    },
    "updatedAt": "2025-08-01T22:00:00.000Z"
  },
  "message": "Contacto actualizado exitosamente"
}
```

---

### DELETE /api/contacts/:id
**Descripción**: Eliminar contacto

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "contact_123"
  },
  "message": "Contacto eliminado exitosamente"
}
```

---

## 💬 Conversaciones

### GET /api/conversations
**Descripción**: Listar conversaciones

**Headers**:
```
Authorization: Bearer <access_token>
```

**Query Parameters**:
```
?page=1&limit=20&status=active&contactId=contact_123&agentId=user_123
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "conv_123",
        "contactId": "contact_123",
        "contactName": "Cliente Ejemplo",
        "status": "active",
        "assignedAgent": "user_123",
        "agentName": "Agente Ejemplo",
        "lastMessageAt": "2025-08-01T22:00:00.000Z",
        "messageCount": 15,
        "createdAt": "2025-08-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50
    }
  }
}
```

---

### GET /api/conversations/:id
**Descripción**: Obtener conversación específica

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "conv_123",
    "contactId": "contact_123",
    "contactName": "Cliente Ejemplo",
    "status": "active",
    "assignedAgent": "user_123",
    "agentName": "Agente Ejemplo",
    "lastMessageAt": "2025-08-01T22:00:00.000Z",
    "messageCount": 15,
    "createdAt": "2025-08-01T10:00:00.000Z",
    "messages": [
      {
        "id": "msg_123",
        "content": "Hola, ¿cómo puedo ayudarte?",
        "type": "text",
        "direction": "outbound",
        "status": "delivered",
        "timestamp": "2025-08-01T22:00:00.000Z"
      }
    ]
  }
}
```

---

### POST /api/conversations/:id/assign
**Descripción**: Asignar conversación a un agente

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**:
```json
{
  "agentId": "user_123"
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "conversationId": "conv_123",
    "assignedAgent": "user_123",
    "assignedAt": "2025-08-01T22:00:00.000Z"
  },
  "message": "Conversación asignada exitosamente"
}
```

---

## 📨 Mensajes

### GET /api/messages
**Descripción**: Listar mensajes con filtros y paginación

**Headers**:
```
Authorization: Bearer <access_token>
```

**Query Parameters**:
```
conversationId: string (requerido)
limit: number (default: 50, max: 100)
cursor: string (opcional)
direction: inbound|outbound (opcional)
type: text|media|location|sticker (opcional)
status: received|sent|failed|pending (opcional)
search: string (opcional)
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "MSG_123",
        "conversationId": "conv_456",
        "content": "Hola, ¿cómo estás?",
        "type": "text",
        "direction": "inbound",
        "status": "received",
        "senderIdentifier": "+1234567890",
        "recipientIdentifier": "+0987654321",
        "timestamp": "2025-01-27T10:30:00.000Z",
        "metadata": {
          "twilioSid": "MG1234567890abcdef"
        }
      },
      {
        "id": "MSG_124",
        "conversationId": "conv_456",
        "content": "Ubicación compartida",
        "type": "location",
        "direction": "inbound",
        "status": "received",
        "senderIdentifier": "+1234567890",
        "recipientIdentifier": "+0987654321",
        "timestamp": "2025-01-27T10:31:00.000Z",
        "location": {
          "latitude": 19.4326,
          "longitude": -99.1332,
          "name": "Ciudad de México",
          "address": "Centro Histórico"
        },
        "metadata": {
          "twilioSid": "MG1234567890abcdef"
        }
      },
      {
        "id": "MSG_125",
        "conversationId": "conv_456",
        "content": "😀",
        "type": "sticker",
        "direction": "inbound",
        "status": "received",
        "senderIdentifier": "+1234567890",
        "recipientIdentifier": "+0987654321",
        "timestamp": "2025-01-27T10:32:00.000Z",
        "sticker": {
          "packId": "sticker_pack_123",
          "stickerId": "sticker_456",
          "emoji": "😀",
          "url": "https://..."
        },
        "metadata": {
          "twilioSid": "MG1234567890abcdef"
        }
      }
    ],
    "pagination": {
      "hasMore": true,
      "nextCursor": "cursor_123"
    }
  },
  "message": "Mensajes obtenidos exitosamente"
}
```

---

### POST /api/messages/send-location
**Descripción**: Enviar mensaje de ubicación

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**:
```json
{
  "to": "+1234567890",
  "latitude": 19.4326,
  "longitude": -99.1332,
  "name": "Ciudad de México",
  "address": "Centro Histórico",
  "conversationId": "conv_456"
}
```

**Response (201)**:
```json
{
  "success": true,
  "data": {
    "messageId": "MSG_123",
    "twilioSid": "MG1234567890abcdef",
    "location": {
      "latitude": 19.4326,
      "longitude": -99.1332,
      "name": "Ciudad de México",
      "address": "Centro Histórico"
    }
  },
  "message": "Mensaje de ubicación enviado exitosamente"
}
```

**Errores**:
- `400` - Campos requeridos faltantes o coordenadas inválidas
- `401` - No autorizado
- `500` - Error interno del servidor

---

### POST /api/messages/send-sticker
**Descripción**: Enviar mensaje de sticker

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**:
```json
{
  "to": "+1234567890",
  "stickerUrl": "https://example.com/sticker.webp",
  "conversationId": "conv_456"
}
```

**Response (201)**:
```json
{
  "success": true,
  "data": {
    "messageId": "MSG_123",
    "twilioSid": "MG1234567890abcdef",
    "sticker": {
      "url": "https://example.com/sticker.webp",
      "packId": null,
      "stickerId": null,
      "emoji": null
    }
  },
  "message": "Mensaje de sticker enviado exitosamente"
}
```

**Errores**:
- `400` - Campos requeridos faltantes o URL inválida
- `401` - No autorizado
- `500` - Error interno del servidor

---

## 📢 Campañas

### GET /api/campaigns
**Descripción**: Listar campañas

**Headers**:
```
Authorization: Bearer <access_token>
```

**Query Parameters**:
```
?page=1&limit=20&status=active&createdBy=user_123
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "id": "camp_123",
        "name": "Campaña de Bienvenida",
        "status": "active",
        "description": "Campaña para nuevos clientes",
        "targetAudience": ["nuevos", "clientes"],
        "scheduledAt": "2025-08-01T22:00:00.000Z",
        "messageTemplate": "¡Bienvenido a Utalk!",
        "createdBy": "user_123",
        "createdAt": "2025-08-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 25
    }
  }
}
```

---

### POST /api/campaigns
**Descripción**: Crear nueva campaña

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**:
```json
{
  "name": "Nueva Campaña",
  "status": "draft",
  "description": "Descripción de la campaña",
  "targetAudience": ["clientes", "activos"],
  "scheduledAt": "2025-08-01T22:00:00.000Z",
  "messageTemplate": "¡Hola! Tenemos una oferta especial para ti.",
  "contactList": ["contact_123", "contact_456"],
  "tags": ["marketing", "promocional"]
}
```

**Response (201)**:
```json
{
  "success": true,
  "data": {
    "id": "camp_456",
    "name": "Nueva Campaña",
    "status": "draft",
    "description": "Descripción de la campaña",
    "targetAudience": ["clientes", "activos"],
    "scheduledAt": "2025-08-01T22:00:00.000Z",
    "messageTemplate": "¡Hola! Tenemos una oferta especial para ti.",
    "contactList": ["contact_123", "contact_456"],
    "tags": ["marketing", "promocional"],
    "createdBy": "user_123",
    "createdAt": "2025-08-01T22:00:00.000Z"
  },
  "message": "Campaña creada exitosamente"
}
```

---

### POST /api/campaigns/:id/send
**Descripción**: Enviar campaña

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**:
```json
{
  "confirm": true
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "campaignId": "camp_123",
    "status": "sending",
    "totalRecipients": 150,
    "estimatedTime": "5 minutes"
  },
  "message": "Campaña iniciada exitosamente"
}
```

---

## 📚 Base de Conocimientos

### GET /api/knowledge
**Descripción**: Listar artículos de conocimiento

**Headers**:
```
Authorization: Bearer <access_token>
```

**Query Parameters**:
```
?page=1&limit=20&category=faq&status=published&search=ayuda
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "articles": [
      {
        "id": "art_123",
        "title": "Cómo usar Utalk",
        "content": "Guía completa de uso...",
        "category": "faq",
        "status": "published",
        "author": "user_123",
        "tags": ["ayuda", "tutorial"],
        "rating": 4.5,
        "views": 150,
        "createdAt": "2025-08-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50
    }
  }
}
```

---

### POST /api/knowledge
**Descripción**: Crear artículo de conocimiento

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**:
```json
{
  "title": "Nuevo Artículo",
  "content": "Contenido del artículo...",
  "category": "tutorial",
  "tags": ["ayuda", "nuevo"],
  "status": "draft"
}
```

**Response (201)**:
```json
{
  "success": true,
  "data": {
    "id": "art_456",
    "title": "Nuevo Artículo",
    "content": "Contenido del artículo...",
    "category": "tutorial",
    "tags": ["ayuda", "nuevo"],
    "status": "draft",
    "author": "user_123",
    "createdAt": "2025-08-01T22:00:00.000Z"
  },
  "message": "Artículo creado exitosamente"
}
```

---

### POST /api/knowledge/:id/vote
**Descripción**: Votar artículo (útil/no útil)

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**:
```json
{
  "voteType": "up"
}
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "articleId": "art_123",
    "voteType": "up",
    "totalUpvotes": 25,
    "totalDownvotes": 2
  },
  "message": "Voto registrado exitosamente"
}
```

---

## 📊 Dashboard

### GET /api/dashboard/stats
**Descripción**: Obtener estadísticas generales

**Headers**:
```
Authorization: Bearer <access_token>
```

**Query Parameters**:
```
?period=30d&startDate=2025-07-01&endDate=2025-08-01
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalContacts": 1500,
      "activeConversations": 45,
      "totalMessages": 2500,
      "responseTime": "2.3s"
    },
    "performance": {
      "messagesPerDay": 85,
      "satisfactionScore": 4.8,
      "resolutionRate": 95.2
    },
    "campaigns": {
      "active": 3,
      "totalSent": 500,
      "openRate": 78.5
    }
  }
}
```

---

### GET /api/dashboard/agent-stats
**Descripción**: Estadísticas por agente

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "agents": [
      {
        "id": "user_123",
        "name": "Agente Ejemplo",
        "conversationsHandled": 25,
        "messagesSent": 150,
        "responseTime": "1.8s",
        "satisfactionScore": 4.9
      }
    ]
  }
}
```

---

## 📁 Media y Archivos

### POST /api/media/upload
**Descripción**: Subir archivo multimedia

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Body** (form-data):
```
file: [archivo]
type: image|video|audio|document
```

**Response (201)**:
```json
{
  "success": true,
  "data": {
    "id": "media_123",
    "filename": "imagen.jpg",
    "url": "https://storage.utalk.com/media/imagen.jpg",
    "type": "image",
    "size": 1024000,
    "uploadedBy": "user_123",
    "uploadedAt": "2025-08-01T22:00:00.000Z"
  },
  "message": "Archivo subido exitosamente"
}
```

---

### GET /api/media/:id
**Descripción**: Obtener información de archivo

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "media_123",
    "filename": "imagen.jpg",
    "url": "https://storage.utalk.com/media/imagen.jpg",
    "type": "image",
    "size": 1024000,
    "uploadedBy": "user_123",
    "uploadedAt": "2025-08-01T22:00:00.000Z",
    "metadata": {
      "width": 1920,
      "height": 1080,
      "format": "jpeg"
    }
  }
}
```

---

## 📱 Twilio Webhooks

### POST /api/twilio/status-callback
**Descripción**: Callback de status de mensajes de Twilio

**Headers**:
```
Content-Type: application/json
X-Twilio-Signature: [firma_twilio]
```

**Body**:
```json
{
  "MessageSid": "MG1234567890abcdef",
  "From": "+1234567890",
  "To": "+0987654321",
  "Body": "Mensaje de prueba",
  "Status": "delivered",
  "ErrorCode": null,
  "ErrorMessage": null
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Status actualizado"
}
```

---

### GET /api/twilio/status/:messageId
**Descripción**: Obtener historial de status de un mensaje

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "messageId": "MG1234567890abcdef",
    "statusHistory": [
      {
        "status": "sent",
        "timestamp": "2025-08-01T22:00:00.000Z"
      },
      {
        "status": "delivered",
        "timestamp": "2025-08-01T22:00:05.000Z"
      }
    ]
  }
}
```