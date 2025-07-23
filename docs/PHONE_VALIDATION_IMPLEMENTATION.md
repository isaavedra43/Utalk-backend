# 📞 **VALIDACIÓN DE TELÉFONOS - IMPLEMENTACIÓN COMPLETA**

## **🎯 OBJETIVO**

Implementar validación robusta de números de teléfono en el backend UTalk siguiendo estándares internacionales y compatibilidad con [Twilio Lookup API](https://www.twilio.com/en-us/blog/how-to-validate-phone-numbers-in-nodejavascript-with-the-twilio-lookup-api-html).

## **✅ IMPLEMENTACIONES REALIZADAS**

### **1. UTILIDAD DE VALIDACIÓN (`src/utils/phoneValidation.js`)**

#### **Funciones Principales:**
- `validateAndNormalizePhone()` - Validación y normalización completa
- `normalizePhoneNumber()` - Conversión a formato E.164
- `validatePhoneFormat()` - Validación por formato específico
- `extractPhoneInfo()` - Extracción de información del teléfono
- `sanitizePhoneForSearch()` - Sanitización para búsquedas
- `validateMultiplePhones()` - Validación de arrays de teléfonos

#### **Formatos Soportados:**
```javascript
// E.164: +[código país][número] (ej: +1234567890)
E164: /^\+[1-9]\d{1,14}$/

// Nacional con espacios: +1 (234) 567-8900
NATIONAL: /^\+[1-9]\d{0,3}[\s\-()]*\d{1,4}[\s\-()]*\d{1,4}[\s\-()]*\d{1,9}$/

// WhatsApp: whatsapp:+[número]
WHATSAPP: /^whatsapp:\+[1-9]\d{1,14}$/

// Básico: +?[1-9]\d{6,14}
BASIC: /^\+?[1-9]\d{6,14}$/
```

### **2. MODELO CONVERSATION ACTUALIZADO**

#### **Nuevos Campos:**
```javascript
// ✅ Campo participants (array de teléfonos)
this.participants = this.validateAndNormalizeParticipants(data.participants || []);

// ✅ Validación de teléfonos individuales
this.customerPhone = customerValidation.normalized;
this.agentPhone = agentValidation.normalized;
```

#### **Validación en Constructor:**
```javascript
// ✅ Validación de participantes
validateAndNormalizeParticipants(participants) {
  // Valida y normaliza cada teléfono en el array
  // Retorna array de números normalizados
}

// ✅ Validación de teléfonos individuales
if (data.customerPhone) {
  const customerValidation = validateAndNormalizePhone(data.customerPhone);
  if (!customerValidation.isValid) {
    throw new Error(`Teléfono del cliente inválido: ${customerValidation.error}`);
  }
  this.customerPhone = customerValidation.normalized;
}
```

#### **Método toJSON() Mejorado:**
```javascript
// ✅ Asegurar que participants siempre sea un array
const participants = Array.isArray(this.participants) ? this.participants : [];

// ✅ Validación de campos críticos
const missingFields = [];
if (!result.id) missingFields.push('id');
if (!Array.isArray(result.participants)) missingFields.push('participants');
if (!result.status) missingFields.push('status');
```

### **3. MODELO MESSAGE ACTUALIZADO**

#### **Validación en Constructor:**
```javascript
// ✅ Validación de teléfonos de origen y destino
if (data.from) {
  const fromValidation = validateAndNormalizePhone(data.from);
  if (!fromValidation.isValid) {
    throw new Error(`Teléfono de origen inválido: ${fromValidation.error}`);
  }
  this.from = fromValidation.normalized;
}

if (data.to) {
  const toValidation = validateAndNormalizePhone(data.to);
  if (!toValidation.isValid) {
    throw new Error(`Teléfono de destino inválido: ${toValidation.error}`);
  }
  this.to = toValidation.normalized;
}
```

### **4. CONVERSATION CONTROLLER ACTUALIZADO**

#### **Validación en Endpoints:**
```javascript
// ✅ Validación de teléfono del cliente en filtros
if (customerPhone) {
  const phoneValidation = validateAndNormalizePhone(customerPhone);
  if (!phoneValidation.isValid) {
    return res.status(400).json({
      error: 'Parámetro inválido',
      message: `Teléfono de cliente inválido: ${phoneValidation.error}`,
      // ... resto de respuesta
    });
  }
  normalizedCustomerPhone = phoneValidation.normalized;
}
```

## **🔧 CAMPOS CRÍTICOS VALIDADOS**

### **Conversation Model:**
- ✅ `id` - Requerido
- ✅ `participants` - Array de teléfonos normalizados
- ✅ `customerPhone` - Formato E.164
- ✅ `agentPhone` - Formato E.164
- ✅ `status` - Valor por defecto 'open'
- ✅ `unreadCount` - Valor por defecto 0
- ✅ `messageCount` - Valor por defecto 0

### **Message Model:**
- ✅ `id` - Generado automáticamente si no se proporciona
- ✅ `conversationId` - Requerido
- ✅ `from` - Teléfono normalizado
- ✅ `to` - Teléfono normalizado
- ✅ `content` - Valor por defecto ''
- ✅ `type` - Valor por defecto 'text'
- ✅ `status` - Valor por defecto 'sent'

## **📋 ESTRUCTURA CANÓNICA GARANTIZADA**

### **Conversation.toJSON():**
```javascript
{
  id: string,                    // ✅ Requerido
  participants: string[],         // ✅ NUEVO: Array de teléfonos
  customerPhone: string|null,     // ✅ Normalizado E.164
  agentPhone: string|null,        // ✅ Normalizado E.164
  contact: object,               // ✅ Estructura completa
  assignedTo: object|null,       // ✅ Información del agente
  status: string,                // ✅ 'open' por defecto
  unreadCount: number,           // ✅ 0 por defecto
  messageCount: number,          // ✅ 0 por defecto
  lastMessage: object|null,      // ✅ Último mensaje
  lastMessageId: string|null,    // ✅ ID del último mensaje
  lastMessageAt: string|null,    // ✅ ISO timestamp
  createdAt: string,             // ✅ ISO timestamp
  updatedAt: string              // ✅ ISO timestamp
}
```

## **🚨 MANEJO DE ERRORES**

### **Errores de Validación:**
```javascript
// Teléfono inválido
throw new Error(`Teléfono del cliente inválido: ${validation.error}`);

// Campo requerido faltante
throw new Error('Conversation ID es requerido');

// Array inválido
logger.warn('Participants debe ser un array', { participants });
```

### **Logs de Debugging:**
```javascript
// Validación fallida
logger.warn('Validación de teléfono falló', { phone, error });

// Campos críticos faltantes
logger.warn('Campos críticos faltantes en Conversation.toJSON()', {
  conversationId: this.id,
  missingFields,
});
```

## **🎯 BENEFICIOS IMPLEMENTADOS**

### **1. Prevención de Errores:**
- ✅ Validación temprana de teléfonos inválidos
- ✅ Normalización automática a formato E.164
- ✅ Detección de campos críticos faltantes

### **2. Compatibilidad con Twilio:**
- ✅ Formato E.164 estándar
- ✅ Soporte para WhatsApp Business API
- ✅ Validación de códigos de país

### **3. Consistencia de Datos:**
- ✅ Arrays nunca nulos (siempre `[]`)
- ✅ Timestamps en formato ISO
- ✅ Campos obligatorios con valores por defecto

### **4. Debugging Mejorado:**
- ✅ Logs detallados de validación
- ✅ Identificación de campos faltantes
- ✅ Trazabilidad de errores

## **📝 PRÓXIMOS PASOS**

### **Pendientes:**
1. **Validación en Contact Model** - Agregar validación de teléfonos
2. **Validación en User Model** - Validar teléfonos de agentes
3. **Tests Unitarios** - Crear tests para validación de teléfonos
4. **Documentación API** - Actualizar Swagger con ejemplos de teléfonos válidos

### **Recomendaciones:**
- Implementar validación en tiempo real en el frontend
- Agregar validación de teléfonos en webhooks de Twilio
- Crear utilidad para formateo de teléfonos en respuestas
- Implementar cache de validación para mejorar performance

---

**✅ IMPLEMENTACIÓN COMPLETADA** - Validación robusta de teléfonos implementada en todos los modelos críticos del sistema UTalk. 