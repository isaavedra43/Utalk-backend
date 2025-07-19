# ✅ UTalk Backend - API Alineada con Frontend

## 🎯 **ESTRUCTURA CANÓNICA DE DATOS**

Este backend está **100% alineado** con las expectativas del frontend React + TypeScript. Todas las respuestas siguen estructuras **exactas** y **consistentes**.

---

## 📨 **ENDPOINT PRINCIPAL: MENSAJES DE CONVERSACIÓN**

### **GET** `/api/conversations/:id/messages`

**Descripción:** Obtiene mensajes de una conversación específica.

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