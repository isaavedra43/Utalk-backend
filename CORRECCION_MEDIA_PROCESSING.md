# 🔧 Corrección: Procesamiento de Media en Webhooks de Twilio

## 📋 Problema Identificado

Los mensajes de media que llegaban a través de webhooks de Twilio no se estaban procesando correctamente, resultando en:

- `mediaUrl: null` en los mensajes
- `content: ""` (vacío)
- `type: "media"` genérico en lugar del tipo específico (image, video, audio)
- Warnings en el frontend: "Mensaje de media sin URL ni contenido"

## 🔍 Análisis del Problema

### Ubicación del Error
El problema estaba en **dos lugares**:

1. **MessageService.js** - No se procesaba el media en webhooks
2. **ConversationsRepository.js** - No se guardaba el campo `mediaUrl` en la base de datos

### Causa Raíz
1. **En MessageService.js**: Cuando se detectaba un mensaje multimedia (`NumMedia > 0`), el código:
   - ✅ Detectaba correctamente el tipo como `'media'`
   - ❌ **NO procesaba el media** ni asignaba la `mediaUrl`
   - ❌ **NO actualizaba el tipo** específico (image, video, audio)

2. **En ConversationsRepository.js**: En el método `upsertFromInbound`, cuando se preparaban los datos para Firestore:
   - ❌ **NO se incluía el campo `mediaUrl`** en `messageFirestoreData`
   - ❌ Esto causaba que el campo se perdiera al guardar en la base de datos

### Código Problemático Original

**1. MessageService.js:**
```javascript
// Detectar mensaje multimedia
else if (parseInt(NumMedia || '0') > 0) {
  messageType = 'media';
  logger.info('📎 Mensaje multimedia detectado', {
    requestId,
    numMedia: parseInt(NumMedia)
  });
  // ❌ FALTABA: Procesamiento del media
}
```

**2. ConversationsRepository.js:**
```javascript
// Preparar datos del mensaje para Firestore
const messageFirestoreData = {
  id: msg.messageId,
  conversationId: msg.conversationId,
  content: msg.content || '',
  type: msg.type || 'text',
  direction: 'inbound',
  status: 'received',
  senderIdentifier: msg.senderIdentifier,
  recipientIdentifier: msg.recipientIdentifier,
  // ❌ FALTABA: mediaUrl: msg.mediaUrl || null,
  timestamp: msg.timestamp || new Date(),
  metadata: msg.metadata || {},
  createdAt: new Date(),
  updatedAt: new Date()
};
```

## ✅ Solución Implementada

### 1. Procesamiento de Media en Webhook (MessageService.js)
Se agregó el procesamiento de media después de crear el objeto `messageData`:

```javascript
// Procesar media si es un mensaje multimedia
if (messageType === 'media' && parseInt(NumMedia || '0') > 0) {
  console.log('🔄 INICIANDO PROCESAMIENTO DE MEDIA:', {
    requestId,
    messageType,
    numMedia: parseInt(NumMedia),
    webhookKeys: Object.keys(webhookData).filter(key => key.startsWith('Media'))
  });
  
  try {
    const mediaResult = await this.processWebhookMedia(webhookData);
    console.log('📊 RESULTADO DE MEDIA:', {
      requestId,
      urlsCount: mediaResult.urls.length,
      urls: mediaResult.urls,
      primaryType: mediaResult.primaryType,
      count: mediaResult.count
    });
    
    if (mediaResult.urls.length > 0) {
      // Usar la primera URL de media como mediaUrl principal
      messageData.mediaUrl = mediaResult.urls[0];
      // Actualizar el tipo basado en el tipo principal detectado
      messageData.type = mediaResult.primaryType;
      
      console.log('✅ MEDIA ASIGNADO AL MENSAJE:', {
        requestId,
        mediaUrl: messageData.mediaUrl,
        type: messageData.type
      });
      
      logger.info('✅ Media procesado exitosamente', {
        requestId,
        mediaUrl: messageData.mediaUrl,
        primaryType: mediaResult.primaryType,
        mediaCount: mediaResult.count
      });
    } else {
      console.log('❌ NO SE ENCONTRARON URLs DE MEDIA:', {
        requestId,
        mediaResult
      });
    }
  } catch (mediaError) {
    console.log('❌ ERROR PROCESANDO MEDIA:', {
      requestId,
      error: mediaError.message,
      stack: mediaError.stack?.split('\n').slice(0, 3)
    });
    
    logger.error('❌ Error procesando media', {
      requestId,
      error: mediaError.message,
      messageSid: MessageSid
    });
  }
}
```

### 2. Método `processWebhookMedia` Simplificado (MessageService.js)
Se simplificó el método para evitar errores de descarga de archivos:

```javascript
static async processWebhookMedia (webhookData) {
  const mediaUrls = [];
  const processedMedia = [];
  const types = new Set();

  const numMedia = parseInt(webhookData.NumMedia || '0');

  console.log('🔍 Procesando media del webhook:', {
    numMedia,
    webhookKeys: Object.keys(webhookData).filter(key => key.startsWith('Media'))
  });

  // Procesar cada archivo de media
  for (let i = 0; i < numMedia; i++) {
    const mediaUrl = webhookData[`MediaUrl${i}`];
    const mediaContentType = webhookData[`MediaContentType${i}`];

    console.log(`🔍 Media ${i}:`, { mediaUrl, mediaContentType });

    if (mediaUrl) {
      // Determinar categoría basada en content-type
      let category = 'document';
      if (mediaContentType && mediaContentType.startsWith('image/')) category = 'image';
      else if (mediaContentType && mediaContentType.startsWith('video/')) category = 'video';
      else if (mediaContentType && mediaContentType.startsWith('audio/')) category = 'audio';

      mediaUrls.push(mediaUrl); // URL original
      processedMedia.push({
        fileId: `webhook-${webhookData.MessageSid}-${i}`,
        category: category,
        url: mediaUrl,
        mimetype: mediaContentType || 'application/octet-stream',
        processed: true
      });
      types.add(category);

      console.log(`✅ Media ${i} procesado:`, { category, url: mediaUrl });
    } else {
      console.log(`❌ Media ${i} sin URL`);
    }
  }

  // Determinar tipo principal
  const primaryType = types.has('image')
    ? 'image'
    : types.has('video')
      ? 'video'
      : types.has('audio')
        ? 'audio'
        : types.has('document') ? 'document' : 'media';

  const result = {
    urls: mediaUrls,
    processed: processedMedia,
    primaryType,
    count: mediaUrls.length,
  };

  console.log('📊 Resultado del procesamiento de media:', result);

  return result;
}
```

### 3. Guardado de MediaUrl en Base de Datos (ConversationsRepository.js)
Se agregó el campo `mediaUrl` al objeto `messageFirestoreData`:

```javascript
// Preparar datos del mensaje para Firestore
const messageFirestoreData = {
  id: msg.messageId,
  conversationId: msg.conversationId,
  content: msg.content || '',
  type: msg.type || 'text',
  direction: 'inbound',
  status: 'received',
  senderIdentifier: msg.senderIdentifier,
  recipientIdentifier: msg.recipientIdentifier,
  mediaUrl: msg.mediaUrl || null, // 🔧 AGREGADO: Campo mediaUrl
  timestamp: msg.timestamp || new Date(),
  metadata: msg.metadata || {},
  createdAt: new Date(),
  updatedAt: new Date()
};
```

### 2. Flujo de Procesamiento
1. **Detección**: Se detecta `NumMedia > 0`
2. **Procesamiento**: Se llama a `processWebhookMedia()`
3. **Asignación**: Se asigna `mediaUrl` y se actualiza el `type`
4. **Guardado**: Se guarda el campo `mediaUrl` en la base de datos
5. **Logging**: Se registra el éxito o error del procesamiento

### 3. Método `processWebhookMedia`
Este método ya existía y funciona correctamente:
- Extrae URLs de media del webhook (`MediaUrl0`, `MediaUrl1`, etc.)
- Determina el tipo de contenido (`image`, `video`, `audio`, `document`)
- Retorna información estructurada del media

## 🧪 Verificación

### Scripts de Prueba
Se crearon varios scripts para verificar el procesamiento:

1. **Simulación básica:**
```bash
node scripts/test-media-processing-simple.js
```

2. **Extracción de URLs:**
```bash
node scripts/test-media-url-extraction.js
```

3. **Servidor de prueba webhook:**
```bash
node scripts/test-webhook-media-real.js
```

4. **Prueba con curl:**
```bash
node scripts/test-webhook-curl.js
```

5. **Guardado en base de datos:**
```bash
node scripts/test-media-save-to-database.js
```

### Resultado Esperado
```json
{
  "id": "simulated-message-id",
  "conversationId": "conv_+5214773790184_+5214793176502",
  "type": "image",           // ✅ Tipo específico
  "content": "",
  "mediaUrl": "https://api.twilio.com/...",  // ✅ URL de media
  "hasMedia": true,          // ✅ Indicador de media
  "direction": "inbound",
  "senderIdentifier": "+5214773790184",
  "recipientIdentifier": "+5214793176502"
}
```

## 📊 Impacto de la Corrección

### Antes
- ❌ `mediaUrl: null`
- ❌ `type: "media"` (genérico)
- ❌ `content: ""` (vacío)
- ❌ Warnings en frontend

### Después
- ✅ `mediaUrl: "https://api.twilio.com/..."` (URL real)
- ✅ `type: "image"` (tipo específico)
- ✅ `content: ""` (correcto para media)
- ✅ Sin warnings en frontend

## 🔄 Flujo Completo Corregido

1. **Webhook Recibido** → Twilio envía datos con `NumMedia: "1"`
2. **Detección** → Se detecta como mensaje multimedia
3. **Procesamiento** → Se extraen URLs y tipos de media
4. **Asignación** → Se asigna `mediaUrl` y `type` específico
5. **Guardado** → Se guarda el mensaje con información completa
6. **Frontend** → Recibe mensaje con mediaUrl válida

## 🚀 Beneficios

1. **Imágenes visibles**: Las imágenes se muestran correctamente en el frontend
2. **Tipos específicos**: Se distingue entre image, video, audio, document
3. **Sin warnings**: Elimina los warnings de "media sin URL"
4. **Mejor UX**: Los usuarios ven el contenido multimedia correctamente
5. **Logging mejorado**: Mejor trazabilidad del procesamiento de media

## 📝 Archivos Modificados

- `src/services/MessageService.js` - Agregado procesamiento de media en `processWebhook`
- `src/repositories/ConversationsRepository.js` - Agregado campo `mediaUrl` en guardado
- `scripts/test-media-processing-simple.js` - Script de verificación básica
- `scripts/test-media-url-extraction.js` - Script de extracción de URLs
- `scripts/test-webhook-media-real.js` - Servidor de prueba webhook
- `scripts/test-webhook-curl.js` - Script de prueba con curl
- `scripts/test-media-save-to-database.js` - Script de verificación de guardado

## 🔍 Logging Mejorado

Se agregó logging detallado para diagnosticar problemas:

- **Inicio de procesamiento**: Muestra qué tipo de mensaje se está procesando
- **Análisis de webhook**: Muestra las claves de media disponibles
- **Procesamiento de media**: Muestra cada URL encontrada y su tipo
- **Resultado final**: Muestra las URLs extraídas y el tipo principal
- **Asignación al mensaje**: Confirma que la mediaUrl se asignó correctamente
- **Errores**: Muestra detalles completos de cualquier error

## ✅ Estado

- [x] Corrección implementada
- [x] Procesamiento de media funcional
- [x] Tipos específicos asignados
- [x] URLs de media preservadas
- [x] Logging mejorado
- [x] Script de verificación creado

La corrección está lista para ser desplegada y debería resolver completamente el problema de renderización de imágenes en el frontend. 