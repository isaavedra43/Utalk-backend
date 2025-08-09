# 🚀 Implementación: Soporte para Ubicación y Stickers en UTalk

## 📋 Resumen

Se ha implementado soporte completo para **mensajes de ubicación** y **stickers** en el sistema UTalk, incluyendo:

- ✅ **Recepción** de ubicación y stickers desde WhatsApp
- ✅ **Envío** de ubicación y stickers a WhatsApp
- ✅ **Almacenamiento** en Firebase con estructura optimizada
- ✅ **Validación** completa de datos
- ✅ **API REST** para envío programático
- ✅ **Webhooks** para recepción automática
- ✅ **Pruebas** unitarias y de integración

## 🏗️ Arquitectura Implementada

### 1. **Modelo de Datos Extendido**

#### **Estructura de Mensaje con Ubicación:**
```javascript
{
  id: "MSG_123",
  conversationId: "conv_456",
  content: "Ubicación compartida",
  type: "location",
  direction: "inbound",
  senderIdentifier: "+1234567890",
  recipientIdentifier: "+0987654321",
  timestamp: "2025-01-27T10:30:00.000Z",
  location: {
    latitude: 19.4326,
    longitude: -99.1332,
    name: "Ciudad de México",
    address: "Centro Histórico"
  },
  metadata: {
    twilioSid: "MG1234567890abcdef"
  }
}
```

#### **Estructura de Mensaje con Sticker:**
```javascript
{
  id: "MSG_124",
  conversationId: "conv_456",
  content: "😀",
  type: "sticker",
  direction: "inbound",
  senderIdentifier: "+1234567890",
  recipientIdentifier: "+0987654321",
  timestamp: "2025-01-27T10:31:00.000Z",
  sticker: {
    packId: "sticker_pack_123",
    stickerId: "sticker_456",
    emoji: "😀",
    url: "https://example.com/sticker.webp"
  },
  mediaUrl: "https://example.com/sticker.webp",
  metadata: {
    twilioSid: "MG1234567890abcdef"
  }
}
```

### 2. **Flujo de Procesamiento**

#### **Recepción (Inbound):**
```
WhatsApp → Twilio Webhook → MessageController.handleWebhookSafe()
→ MessageService.processIncomingMessage() → Detección de tipo
→ ConversationsRepository.upsertFromInbound() → Firebase
```

#### **Envío (Outbound):**
```
Frontend/API → MessageController.sendLocationMessage/sendStickerMessage()
→ MessageService.sendLocationMessage/sendStickerMessage()
→ TwilioService.sendWhatsAppLocation/sendWhatsAppSticker()
→ Twilio API → WhatsApp
```

## 🔧 Componentes Implementados

### 1. **Modelo Message Extendido**
- **Archivo**: `src/models/Message.js`
- **Cambios**: Agregados campos `location` y `sticker`
- **Validación**: Validación específica para tipos de mensaje

### 2. **FileService Extendido**
- **Archivo**: `src/services/FileService.js`
- **Cambios**: Soporte para stickers (WebP, PNG)
- **Límites**: 5MB para stickers

### 3. **TwilioService Extendido**
- **Archivo**: `src/services/TwilioService.js`
- **Métodos nuevos**:
  - `sendWhatsAppLocation()`
  - `sendWhatsAppSticker()`

### 4. **MessageService Extendido**
- **Archivo**: `src/services/MessageService.js`
- **Cambios**: Detección automática de tipos de mensaje
- **Métodos nuevos**:
  - `sendLocationMessage()`
  - `sendStickerMessage()`

### 5. **MessageController Extendido**
- **Archivo**: `src/controllers/MessageController.js`
- **Endpoints nuevos**:
  - `POST /api/messages/send-location`
  - `POST /api/messages/send-sticker`

### 6. **Rutas Extendidas**
- **Archivo**: `src/routes/messages.js`
- **Validación**: Validadores específicos para ubicación y stickers

## 📡 API Endpoints

### **Enviar Ubicación**
```http
POST /api/messages/send-location
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": "+1234567890",
  "latitude": 19.4326,
  "longitude": -99.1332,
  "name": "Ciudad de México",
  "address": "Centro Histórico",
  "conversationId": "conv_456"
}
```

### **Enviar Sticker**
```http
POST /api/messages/send-sticker
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": "+1234567890",
  "stickerUrl": "https://example.com/sticker.webp",
  "conversationId": "conv_456"
}
```

## 🔄 Webhooks de Twilio

### **Webhook de Ubicación:**
```javascript
{
  From: "whatsapp:+1234567890",
  To: "whatsapp:+0987654321",
  MessageSid: "MG1234567890abcdef",
  Latitude: "19.4326",
  Longitude: "-99.1332",
  LocationName: "Ciudad de México",
  LocationAddress: "Centro Histórico"
}
```

### **Webhook de Sticker:**
```javascript
{
  From: "whatsapp:+1234567890",
  To: "whatsapp:+0987654321",
  MessageSid: "MG1234567890abcdef",
  StickerId: "sticker_123",
  StickerPackId: "pack_456",
  StickerEmoji: "😀",
  MediaUrl0: "https://example.com/sticker.webp"
}
```

## 🗄️ Almacenamiento en Firebase

### **Estructura en Firestore:**
```
conversations/{conversationId}/messages/{messageId}
├── id: "MSG_123"
├── conversationId: "conv_456"
├── content: "Ubicación compartida"
├── type: "location" | "sticker"
├── direction: "inbound" | "outbound"
├── senderIdentifier: "+1234567890"
├── recipientIdentifier: "+0987654321"
├── timestamp: "2025-01-27T10:30:00.000Z"
├── location: {  // Solo para type: "location"
│   ├── latitude: 19.4326
│   ├── longitude: -99.1332
│   ├── name: "Ciudad de México"
│   └── address: "Centro Histórico"
│ }
├── sticker: {   // Solo para type: "sticker"
│   ├── packId: "pack_123"
│   ├── stickerId: "sticker_456"
│   ├── emoji: "😀"
│   └── url: "https://..."
│ }
├── mediaUrl: "https://..."  // Para stickers
└── metadata: {
    ├── twilioSid: "MG123..."
    ├── sentBy: "user@email.com"
    └── sentAt: "2025-01-27T10:30:00.000Z"
  }
```

## ✅ Validaciones Implementadas

### **Ubicación:**
- ✅ Coordenadas requeridas (latitude, longitude)
- ✅ Rango válido: lat [-90, 90], lng [-180, 180]
- ✅ Formato numérico válido
- ✅ Número de teléfono válido

### **Stickers:**
- ✅ URL requerida y válida
- ✅ Formato de archivo soportado (WebP, PNG)
- ✅ Tamaño máximo 5MB
- ✅ Número de teléfono válido

## 🧪 Pruebas Implementadas

### **Archivo**: `tests/messages/location-sticker.test.js`

#### **Pruebas de Envío:**
- ✅ Envío exitoso de ubicación
- ✅ Envío exitoso de sticker
- ✅ Validación de campos requeridos
- ✅ Validación de rangos de coordenadas
- ✅ Validación de formato de URL

#### **Pruebas de Webhook:**
- ✅ Procesamiento de webhook de ubicación
- ✅ Procesamiento de webhook de sticker

#### **Pruebas de Modelo:**
- ✅ Validación de estructura de ubicación
- ✅ Validación de estructura de sticker
- ✅ Validación de tipos sin datos requeridos

## 🚀 Uso en Producción

### **1. Configuración de Twilio**
Asegúrate de que tu cuenta de Twilio tenga habilitado:
- ✅ WhatsApp Business API
- ✅ Soporte para mensajes de ubicación
- ✅ Soporte para stickers

### **2. Variables de Entorno**
```bash
# Ya configuradas en tu sistema
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=tu-auth-token-twilio
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890
```

### **3. Ejemplo de Uso**

#### **Enviar Ubicación desde Frontend:**
```javascript
const response = await fetch('/api/messages/send-location', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    to: '+1234567890',
    latitude: 19.4326,
    longitude: -99.1332,
    name: 'Ciudad de México',
    address: 'Centro Histórico',
    conversationId: 'conv_456'
  })
});

const result = await response.json();
console.log('Ubicación enviada:', result.data);
```

#### **Enviar Sticker desde Frontend:**
```javascript
const response = await fetch('/api/messages/send-sticker', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    to: '+1234567890',
    stickerUrl: 'https://example.com/sticker.webp',
    conversationId: 'conv_456'
  })
});

const result = await response.json();
console.log('Sticker enviado:', result.data);
```

## 📊 Monitoreo y Logs

### **Logs de Ubicación:**
```
📍 Enviando ubicación WhatsApp via Twilio
📍 Mensaje de ubicación detectado
✅ Ubicación WhatsApp enviada exitosamente
```

### **Logs de Stickers:**
```
😀 Enviando sticker WhatsApp via Twilio
😀 Mensaje de sticker detectado
✅ Sticker WhatsApp enviado exitosamente
```

## 🔒 Consideraciones de Seguridad

### **Ubicación:**
- ✅ Validación de rangos de coordenadas
- ✅ Sanitización de nombres y direcciones
- ✅ Límite de precisión opcional para privacidad

### **Stickers:**
- ✅ Validación de URLs
- ✅ Verificación de tipos de archivo
- ✅ Límite de tamaño (5MB)

## 🎯 Próximos Pasos

### **Mejoras Futuras:**
1. **Visualización de Mapas**: Integrar con Google Maps/OpenStreetMap
2. **Geocodificación**: Convertir direcciones a coordenadas
3. **Stickers Personalizados**: Subir stickers propios
4. **Análisis de Ubicación**: Estadísticas de ubicaciones compartidas
5. **Notificaciones Push**: Alertas por proximidad

### **Optimizaciones:**
1. **Cache de Ubicaciones**: Cachear ubicaciones frecuentes
2. **Compresión de Stickers**: Optimizar tamaño de archivos
3. **CDN para Stickers**: Distribución global de contenido

## 📝 Notas de Implementación

- ✅ **Compatibilidad**: No afecta funcionalidad existente
- ✅ **Escalabilidad**: Diseñado para alto volumen
- ✅ **Mantenibilidad**: Código bien documentado y testeado
- ✅ **Performance**: Procesamiento optimizado
- ✅ **Seguridad**: Validaciones robustas

---

**Estado**: ✅ **IMPLEMENTADO Y LISTO PARA PRODUCCIÓN**

**Fecha de Implementación**: 2025-01-27

**Versión**: 1.0.0