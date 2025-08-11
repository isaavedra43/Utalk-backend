# 📚 API Documentation - Utalk Backend

## 🔄 Envío de Mensajes Salientes

### Contrato Canónico

**Endpoint Principal**: `POST /api/conversations/:conversationId/messages`

#### Path Parameters
- `conversationId` (string, required): Formato `conv_+<from>_+<to>`
  - Acepta tanto `+` como `%2B` (URL encoding)
  - Ejemplo: `conv_+5214775211021_+5214793176502` o `conv_%2B5214775211021_%2B5214793176502`

#### Request Body
```json
{
  "messageId": "uuid-v4",
  "type": "text",
  "content": "string (1..1000)",
  "senderIdentifier": "whatsapp:+1XXXXXXXXXX | agent:<id|email>",
  "recipientIdentifier": "whatsapp:+52XXXXXXXXXX",
  "metadata": {
    "source": "web",
    "agentId": "..."
  }
}
```

#### Campos Obligatorios
- `messageId`: UUID v4 único para el mensaje
- `type`: Tipo de mensaje (`text`, `image`, `audio`, `video`, `document`, `location`, `sticker`)
- `content`: Contenido del mensaje (1-1000 caracteres)
- `senderIdentifier`: Identificador del remitente
  - Formato E.164: `whatsapp:+1XXXXXXXXXX`
  - Formato agente: `agent:agent_id` o `agent:email@domain.com`
- `recipientIdentifier`: Identificador del destinatario
  - Formato E.164: `whatsapp:+52XXXXXXXXXX`

#### Response Codes
- `201/200`: Mensaje creado/enviado exitosamente
- `400`: Error de validación (con detalles por campo)
- `401/403`: Error de autenticación/autorización
- `404`: Conversación no encontrada
- `5xx`: Errores externos (Twilio, base de datos, etc.)

#### Ejemplo de Request
```bash
curl -X POST 'https://api.utalk.com/api/conversations/conv_%2B5214775211021_%2B5214793176502/messages' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{
    "messageId": "550e8400-e29b-41d4-a716-446655440000",
    "type": "text",
    "content": "Hola, ¿cómo estás?",
    "senderIdentifier": "whatsapp:+1234567890",
    "recipientIdentifier": "whatsapp:+5214775211021",
    "metadata": {
      "source": "web",
      "agentId": "agent_123"
    }
  }'
```

#### Ejemplo de Response (200/201)
```json
{
  "success": true,
  "message": "Mensaje enviado exitosamente",
  "data": {
    "message": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "conversationId": "conv_+5214775211021_+5214793176502",
      "content": "Hola, ¿cómo estás?",
      "type": "text",
      "direction": "outbound",
      "status": "sent",
      "senderIdentifier": "whatsapp:+1234567890",
      "recipientIdentifier": "whatsapp:+5214775211021",
      "timestamp": "2025-08-11T16:58:00.000Z",
      "metadata": {
        "source": "web",
        "agentId": "agent_123"
      }
    },
    "conversation": {
      "id": "conv_+5214775211021_+5214793176502",
      "lastMessage": "Hola, ¿cómo estás?",
      "updatedAt": "2025-08-11T16:58:00.000Z"
    }
  }
}
```

#### Ejemplo de Error de Validación (400)
```json
{
  "error": "validation_error",
  "details": [
    {
      "field": "senderIdentifier",
      "code": "required",
      "message": "senderIdentifier es obligatorio"
    },
    {
      "field": "messageId",
      "code": "string.guid",
      "message": "messageId debe ser un UUID válido"
    }
  ]
}
```

### Extensiones Opcionales

#### Autogeneración de MessageId
Si `messageId` está vacío o no se proporciona, el sistema lo autogenera automáticamente.

#### Fallback de SenderIdentifier
Si `AI_SAFE_FALLBACK=true` y `senderIdentifier` no se proporciona, el sistema usa el número configurado en `TWILIO_WHATSAPP_NUMBER`.

### Endpoint Deprecado

**Endpoint Legacy**: `POST /api/messages/send` (DEPRECATED)

```json
{
  "error": "deprecated_endpoint",
  "message": "Este endpoint está deprecado. Usa POST /api/conversations/:conversationId/messages",
  "details": {
    "newEndpoint": "/api/conversations/:conversationId/messages",
    "requiredFields": ["messageId", "type", "content", "senderIdentifier", "recipientIdentifier"],
    "conversationIdFormat": "conv_+<from>_+<to> (acepta + y %2B)"
  }
}
```

### Observabilidad

#### Logs Estructurados
Cada request genera logs con:
- `requestId`: ID único de la petición
- `conversationIdRaw`: ID original del request
- `conversationIdNormalized`: ID después de normalización
- `participants`: { from, to } extraídos del ID
- `messageId`: ID del mensaje
- `senderIdentifier`: Remitente
- `recipientIdentifier`: Destinatario
- `contentLength`: Longitud del contenido
- `type`: Tipo de mensaje

#### Métricas
- Contadores de 4xx por campo de validación
- Latencia de procesamiento
- Tasa de éxito/fallo

### Migración desde Frontend

#### Cambios Requeridos
1. **Enviar campos obligatorios**:
   - `messageId`: UUID v4
   - `senderIdentifier`: Formato E.164 o agent:
   - `recipientIdentifier`: Formato E.164

2. **Manejar URL encoding**:
   - Frontend puede enviar `%2B` o `+`
   - Backend normaliza automáticamente

3. **Usar endpoint canónico**:
   - Cambiar de `/api/messages/send` a `/api/conversations/:conversationId/messages`

#### Ejemplo de Migración
```javascript
// ANTES (legacy)
fetch('/api/messages/send', {
  method: 'POST',
  body: JSON.stringify({
    content: 'Hola',
    type: 'text'
  })
});

// DESPUÉS (canónico)
fetch('/api/conversations/conv_%2B5214775211021_%2B5214793176502/messages', {
  method: 'POST',
  body: JSON.stringify({
    messageId: uuidv4(),
    type: 'text',
    content: 'Hola',
    senderIdentifier: 'whatsapp:+1234567890',
    recipientIdentifier: 'whatsapp:+5214775211021'
  })
});
```