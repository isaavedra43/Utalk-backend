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
**Descripción**: Listar mensajes

**Headers**:
```
Authorization: Bearer <access_token>
```

**Query Parameters**:
```
?page=1&limit=20&conversationId=conv_123&direction=inbound&status=delivered
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg_123",
        "conversationId": "conv_123",
        "content": "Hola, necesito ayuda",
        "type": "text",
        "direction": "inbound",
        "status": "delivered",
        "timestamp": "2025-08-01T22:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100
    }
  }
}
```

---

### POST /api/messages
**Descripción**: Enviar mensaje

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**:
```json
{
  "conversationId": "conv_123",
  "content": "Hola, ¿cómo puedo ayudarte?",
  "type": "text"
}
```

**Response (201)**:
```json
{
  "success": true,
  "data": {
    "id": "msg_456",
    "conversationId": "conv_123",
    "content": "Hola, ¿cómo puedo ayudarte?",
    "type": "text",
    "direction": "outbound",
    "status": "sent",
    "timestamp": "2025-08-01T22:00:00.000Z"
  },
  "message": "Mensaje enviado exitosamente"
}
```

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

---

## 🔧 Utilidades

### GET /health
**Descripción**: Health check del servidor

**Headers**: Ninguno requerido

**Response (200)**:
```json
{
  "status": "healthy",
  "timestamp": "2025-08-01T22:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "server": {
      "status": "healthy",
      "message": "Server is running"
    },
    "memory": {
      "status": "healthy",
      "usage": {
        "heapUsed": "48MB",
        "heapTotal": "74MB"
      }
    },
    "process": {
      "status": "healthy",
      "pid": 12345,
      "uptime": 3600
    }
  },
  "summary": {
    "total": 3,
    "healthy": 3,
    "failed": 0
  }
}
```

---

## 🔐 Códigos de Error

### Errores de Autenticación
- `401 Unauthorized` - Token inválido o expirado
- `403 Forbidden` - Permisos insuficientes
- `404 Not Found` - Recurso no encontrado

### Errores de Validación
- `400 Bad Request` - Datos de entrada inválidos
- `422 Unprocessable Entity` - Datos no procesables

### Errores del Servidor
- `500 Internal Server Error` - Error interno del servidor
- `503 Service Unavailable` - Servicio no disponible

### Errores de CORS
- `CORS_BLOCKED` - Origen no permitido en producción

---

## 📋 Headers Comunes

### Autenticación
```
Authorization: Bearer <access_token>
```

### Content-Type
```
Content-Type: application/json
Content-Type: multipart/form-data
```

### CORS
```
Origin: https://utalk.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Authorization, Content-Type
```

---

## 🚀 Rate Limiting

El API implementa rate limiting para prevenir abuso:

- **Límite por IP**: 100 requests por minuto
- **Límite por usuario**: 1000 requests por hora
- **Límite por endpoint**: Varía según el endpoint

### Headers de Rate Limiting
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## 📝 Notas Importantes

1. **Autenticación**: Todas las rutas (excepto `/auth/login` y `/health`) requieren token JWT válido
2. **Roles**: Algunas rutas requieren roles específicos (admin, agent, viewer)
3. **CORS**: En producción, solo dominios autorizados pueden acceder al API
4. **Logging**: Todas las operaciones son registradas para auditoría
5. **Compresión**: Las respuestas están comprimidas con gzip
6. **Cache**: Algunas respuestas están cacheadas para mejorar performance

---

*Última actualización: 2025-08-01* 