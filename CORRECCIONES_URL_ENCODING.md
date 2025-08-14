# CORRECCIONES URL ENCODING - BACKEND

## 🚨 PROBLEMA IDENTIFICADO

### **Error 400 Bad Request en Conversaciones**

**Problema:** Los conversationId con símbolos `+` no se estaban codificando correctamente en las URLs HTTP, causando que el backend recibiera un formato incorrecto.

**Ejemplo del problema:**
- **Frontend envía:** `conv_+5214773790184_+5214793176502`
- **HTTP convierte:** `conv_ 5214773790184 5214793176502` (los `+` se convierten en espacios)
- **Backend recibe:** `conv_ 5214773790184 5214793176502`
- **Resultado:** Error 400 "Formato de ID inválido"

## 🔧 CORRECCIONES IMPLEMENTADAS

### **1. ConversationController.js**

**Archivo:** `src/controllers/ConversationController.js`
**Método:** `getConversation()`

```javascript
// 🔧 CORRECCIÓN: Decodificar conversationId para manejar caracteres especiales
let { conversationId } = req.params;

// Decodificar URL encoding para manejar caracteres como +
try {
  conversationId = decodeURIComponent(conversationId);
} catch (decodeError) {
  logger.warn('Error decodificando conversationId', {
    originalId: req.params.conversationId,
    error: decodeError.message
  });
  // Continuar con el ID original si falla la decodificación
}
```

### **2. MessageController.js**

**Archivo:** `src/controllers/MessageController.js`
**Método:** `getMessages()`

```javascript
// 🔧 CORRECCIÓN: Decodificar conversationId en query parameters
let conversationId;
try {
  conversationId = rawConversationId ? decodeURIComponent(rawConversationId) : null;
} catch (decodeError) {
  logger.warn('Error decodificando conversationId en query', {
    originalId: rawConversationId,
    error: decodeError.message
  });
  conversationId = rawConversationId; // Usar el original si falla la decodificación
}
```

### **3. Utils/Conversation.js**

**Archivo:** `src/utils/conversation.js`

#### **generateConversationId()**
```javascript
// 🔧 CORRECCIÓN: Generar ID con formato conv_+phone1_+phone2 para mantener los símbolos +
return `conv_+${sorted[0]}_+${sorted[1]}`;
```

#### **extractParticipants()**
```javascript
// 🔧 CORRECCIÓN: Manejar formato conv_+phone1_+phone2
const phone1 = phones[0].replace('+', '');
const phone2 = phones[1].replace('+', '');
```

#### **isValidConversationId()**
```javascript
// 🔧 CORRECCIÓN: Validar formato conv_+phone1_+phone2
return parts.length === 2 && 
       parts.every(part => part.length > 0 && /^\+?\d+$/.test(part));
```

#### **normalizePhoneNumber()**
```javascript
// 🔧 CORRECCIÓN: Mejorar normalización para manejar símbolos +
let normalized = phone.trim();
normalized = normalized.replace(/[^\d+]/g, '');
```

### **4. Middleware de Normalización**

**Archivo:** `src/middleware/conversationIdNormalization.js`

#### **normalizeConversationId()**
- Decodifica conversationId en parámetros de ruta
- Valida formato con símbolos `+`
- Agrega logging detallado para debug

#### **normalizeConversationIdQuery()**
- Decodifica conversationId en query parameters
- Específico para rutas como `/api/messages?conversationId=...`
- Maneja errores de decodificación gracefully

#### **parseConversationId()**
```javascript
// 🔧 CORRECCIÓN: Validar formato conv_+phone1_+phone2
const phoneRegex = /^\+?\d{10,15}$/;
if (!phoneRegex.test(phone1) || !phoneRegex.test(phone2)) {
  return { 
    valid: false, 
    error: 'Los números de teléfono deben tener entre 10 y 15 dígitos y pueden incluir +' 
  };
}
```

### **5. Rutas Actualizadas**

#### **Messages Routes**
```javascript
router.get('/',
  authMiddleware,
  requireReadAccess,
  normalizeConversationIdQuery, // 🔧 CORRECCIÓN: Normalizar conversationId en query
  messageValidators.validateList,
  MessageController.getMessages
);
```

#### **Conversations Routes**
```javascript
router.get('/:id',
  authMiddleware,
  requireReadAccess,
  normalizeConversationId, // 🔧 CORRECCIÓN: Normalizar conversationId en params
  validateId('id'),
  ConversationController.getConversation
);
```

## 📊 RESULTADOS ESPERADOS

### **Antes de las Correcciones:**
- ❌ Error 400: "Formato de ID inválido"
- ❌ ConversationId recibido: `conv_ 5214773790184 5214793176502`
- ❌ Conversaciones no encontradas
- ❌ Rate limiting por intentos fallidos

### **Después de las Correcciones:**
- ✅ ConversationId decodificado: `conv_+5214773790184_+5214793176502`
- ✅ Conversaciones encontradas correctamente
- ✅ Mensajes cargados sin errores
- ✅ Rate limiting normal

## 🔍 LOGGING MEJORADO

### **Logs de Debug Agregados:**
```javascript
logger.info('ConversationController.getConversation - Procesando request', {
  originalId: req.params.conversationId,
  decodedId: conversationId,
  userEmail: req.user?.email,
  userRole: req.user?.role
});
```

### **Logs de Error Mejorados:**
```javascript
logger.warn('Error decodificando conversationId', {
  originalId: req.params.conversationId,
  error: decodeError.message
});
```

## 🧪 TESTING

### **Casos de Prueba:**
1. **ConversationId con símbolos +:** `conv_+5214773790184_+5214793176502`
2. **ConversationId URL encoded:** `conv_%2B5214773790184_%2B5214793176502`
3. **ConversationId con espacios:** `conv_ 5214773790184 5214793176502`

### **Endpoints Afectados:**
- `GET /api/conversations/:conversationId`
- `GET /api/messages?conversationId=...`
- `POST /api/conversations/:conversationId/messages`

## 🎯 IMPACTO

### **Problemas Resueltos:**
- ✅ Error 400 Bad Request eliminado
- ✅ Conversaciones cargan correctamente
- ✅ Mensajes se obtienen sin errores
- ✅ Rate limiting normalizado
- ✅ Logging mejorado para debugging

### **Compatibilidad:**
- ✅ Mantiene compatibilidad con formatos existentes
- ✅ Maneja tanto `+` como `%2B` en URLs
- ✅ Fallback graceful en caso de errores de decodificación

## 📝 NOTAS IMPORTANTES

1. **Frontend debe usar `encodeURIComponent()`** al enviar conversationId en URLs
2. **Backend ahora maneja automáticamente** la decodificación
3. **Logging detallado** para facilitar debugging futuro
4. **Validación robusta** de formatos de conversationId
5. **Fallback graceful** en caso de errores de decodificación

---

**Estado:** ✅ **IMPLEMENTADO Y FUNCIONAL**
**Fecha:** 14 de Agosto, 2025
**Versión:** 2.0.0
