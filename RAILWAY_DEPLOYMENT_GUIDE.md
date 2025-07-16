# 🚀 **GUÍA COMPLETA DE DEPLOYMENT Y MONITOREO - RAILWAY**

**Guía paso a paso para desplegar y monitorear el backend UTalk en Railway con webhook WhatsApp**

---

## 📋 **PREREQUISITOS**

- ✅ Proyecto desplegado en Railway
- ✅ Variables de entorno configuradas
- ✅ Twilio WhatsApp Business API configurada
- ✅ Firebase proyecto configurado

---

## 🔧 **PASO 1: CONFIGURAR VARIABLES DE ENTORNO EN RAILWAY**

### **Acceder a Railway Dashboard**
1. Ir a [https://railway.app/dashboard](https://railway.app/dashboard)
2. Seleccionar tu proyecto
3. Ir a pestaña **"Variables"**

### **Variables Firebase (OBLIGATORIAS)**
```bash
FIREBASE_PROJECT_ID=tu-proyecto-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ntu-clave-privada-aqui\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-proyecto.iam.gserviceaccount.com
```

### **Variables Twilio (OBLIGATORIAS)**
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890
```

### **Variables de Entorno (OPCIONALES)**
```bash
NODE_ENV=production
PORT=3000
WEBHOOK_SECRET=tu-secreto-opcional
```

---

## 🏥 **PASO 2: VERIFICAR HEALTH CHECK**

### **Comando de Verificación**
```bash
curl https://tu-proyecto.railway.app/health
```

### **Respuesta Esperada**
```json
{
  "status": "OK",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "environment": "production",
  "uptime": 123.45,
  "checks": {
    "firebase": {
      "status": "connected",
      "details": {
        "canRead": true,
        "canWrite": true,
        "projectId": "tu-proyecto-id"
      }
    },
    "twilio": {
      "status": "configured",
      "details": {
        "accountSid": "ACxxxxxxxx...",
        "whatsappNumber": "whatsapp:+1234567890",
        "hasAuthToken": true
      }
    },
    "webhook": {
      "status": "configured",
      "url": "https://tu-proyecto.railway.app/api/messages/webhook"
    }
  },
  "responseTime": 150
}
```

### **Si Status = DEGRADED**
1. **Revisar logs Railway**: `Railway Dashboard > Logs`
2. **Verificar variables**: Comprobar que todas estén configuradas
3. **Firebase**: Verificar permisos del service account
4. **Twilio**: Verificar formato de variables

---

## 🔗 **PASO 3: CONFIGURAR WEBHOOK EN TWILIO CONSOLE**

### **URL Correcta del Webhook**
```
https://tu-proyecto.railway.app/api/messages/webhook
```

### **Configuración en Twilio Console**
1. Ir a [Twilio Console > WhatsApp Senders](https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders)
2. Seleccionar tu número WhatsApp Business
3. En **"Webhook URL"** introducir la URL exacta arriba
4. **Método HTTP**: `POST`
5. **Guardar cambios**

### **Verificar Configuración**
```bash
curl https://tu-proyecto.railway.app/api/messages/webhook
# Debe responder: "Webhook endpoint activo y funcionando"
```

---

## 🧪 **PASO 4: EJECUTAR TESTS DE VERIFICACIÓN**

### **Test Automático con Script**
```bash
node test-railway-webhook.js
```

### **Test Manual con cURL**
```bash
# Test básico
curl -X POST https://tu-proyecto.railway.app/api/messages/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "User-Agent: TwilioProxy/1.1" \
  -d "MessageSid=SMtest123456" \
  -d "AccountSid=ACtest123456" \
  -d "From=whatsapp:+1234567890" \
  -d "To=whatsapp:+0987654321" \
  -d "Body=Test message from Railway"
```

### **Resultado Esperado**
- **Status Code**: `200` (CRÍTICO)
- **Response JSON**: Contiene `"status": "success"` o similar
- **Logs Railway**: Mensajes visibles de procesamiento

---

## 📊 **PASO 5: MONITOREAR LOGS EN RAILWAY**

### **Acceder a Logs**
1. `Railway Dashboard > Tu Proyecto > Logs`
2. Filtrar por **"webhook"**, **"firebase"**, **"twilio"**

### **Logs Esperados al Recibir Mensaje**
```bash
🔗 WEBHOOK TWILIO - Mensaje recibido
📨 PROCESANDO MENSAJE ENTRANTE
✅ WEBHOOK - Validación exitosa, procesando mensaje
📞 NÚMEROS PROCESADOS
👤 CREANDO NUEVO CONTACTO (o ✅ CONTACTO EXISTENTE encontrado)
💾 GUARDANDO MENSAJE EN FIREBASE
✅ MENSAJE GUARDADO EXITOSAMENTE
🎉 WEBHOOK PROCESADO COMPLETAMENTE
📤 CONTROLLER - Respondiendo 200 OK a Twilio
```

### **Logs de Error (No deseados)**
```bash
❌ FIREBASE - Error crítico en inicialización
❌ TWILIO - El webhook NO funcionará sin estas variables
❌ WEBHOOK - Campos requeridos faltantes
❌ FIREBASE - Error guardando mensaje
```

---

## 🔍 **PASO 6: DEBUGGING DE PROBLEMAS COMUNES**

### **Error 502 "Application failed to respond"**

**Causa**: Variables de entorno mal configuradas o app no inicia

**Solución**:
1. Revisar logs Railway para errores de inicialización
2. Verificar variables Firebase están correctas
3. Comprobar formato de `FIREBASE_PRIVATE_KEY` con `\n` escapados

### **Twilio reporta error en webhook**

**Causa**: URL incorrecta o webhook no responde 200

**Solución**:
1. Verificar URL exacta: `/api/messages/webhook`
2. Comprobar que webhook siempre responde 200 OK
3. Revisar logs Railway para excepciones

### **Firebase desconectado**

**Causa**: Credenciales o permisos incorrectos

**Solución**:
1. Verificar service account tiene permisos
2. Comprobar `FIREBASE_PRIVATE_KEY` incluye headers completos
3. Validar `FIREBASE_PROJECT_ID` es correcto

### **Mensajes no se guardan en Firestore**

**Causa**: Reglas Firestore o permisos service account

**Solución**:
1. Revisar Firestore Rules permiten escritura
2. Verificar service account tiene rol "Firebase Admin"
3. Comprobar logs específicos de guardado

---

## 📈 **PASO 7: VERIFICACIÓN DE PRODUCCIÓN**

### **Test con WhatsApp Real**
1. **Enviar mensaje**: Desde WhatsApp a tu número Twilio
2. **Verificar Twilio Logs**: Mensaje aparece en Console
3. **Verificar Railway Logs**: Webhook procesado correctamente
4. **Verificar Firestore**: Mensaje guardado en colección `messages`

### **Monitoreo Continuo**
```bash
# Health check cada 5 minutos
*/5 * * * * curl -s https://tu-proyecto.railway.app/health | jq '.status'
```

### **Métricas de Éxito**
- ✅ **Health check**: Siempre 200 OK
- ✅ **Webhook response**: 100% código 200
- ✅ **Firebase writes**: Sin errores de permisos
- ✅ **Twilio delivery**: Sin reintentos por error

---

## 🚨 **PASO 8: SOLUCIÓN DE PROBLEMAS AVANZADOS**

### **Webhook recibe pero no procesa**

**Logs a buscar**:
```bash
grep "WEBHOOK TWILIO - Mensaje recibido" logs
grep "Error procesando webhook" logs
```

**Acciones**:
1. Verificar validación Joi no rechaza campos
2. Comprobar TwilioService no lanza excepciones
3. Revisar conectividad Firebase

### **Duplicados en Firestore**

**Causa**: MessageSid duplicado no detectado

**Solución**:
1. Verificar query `getByTwilioSid` funciona
2. Comprobar índices Firestore en campo `twilioSid`

### **Performance lento**

**Causas**: Consultas Firebase ineficientes

**Solución**:
1. Optimizar queries con índices
2. Reducir campos guardados innecesarios
3. Implementar cache para contactos frecuentes

---

## ✅ **CHECKLIST FINAL DE DEPLOYMENT**

### **Pre-deployment**
- [ ] Variables de entorno configuradas en Railway
- [ ] Service account Firebase con permisos correctos
- [ ] Número Twilio WhatsApp configurado
- [ ] Firestore rules permiten escritura

### **Post-deployment**
- [ ] Health check responde 200 OK
- [ ] Webhook URL configurada en Twilio Console
- [ ] Test manual con cURL funciona
- [ ] Test automático con script pasa
- [ ] Logs Railway muestran flujo completo
- [ ] Mensaje test aparece en Firestore

### **Monitoreo Continuo**
- [ ] Alertas configuradas para health check
- [ ] Logs Railway monitoreados
- [ ] Métricas Twilio dashboard revisadas
- [ ] Firestore usage monitoreado

---

## 🎯 **COMANDOS RÁPIDOS DE VERIFICACIÓN**

```bash
# Health check
curl -s https://tu-proyecto.railway.app/health | jq '.status'

# Test webhook
curl -X POST https://tu-proyecto.railway.app/api/messages/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "MessageSid=SMtest$(date +%s)" \
  -d "AccountSid=ACtest123" \
  -d "From=whatsapp:+1234567890" \
  -d "To=whatsapp:+0987654321" \
  -d "Body=Test"

# Verificar logs en Railway
echo "Revisar logs en: https://railway.app/dashboard"

# Test completo automatizado
node test-railway-webhook.js
```

---

## 📞 **CONTACTO Y SOPORTE**

### **Logs Útiles para Debugging**
- Railway Logs: `https://railway.app/dashboard > Logs`
- Twilio Console: `https://console.twilio.com/us1/monitor/logs`
- Firebase Console: `https://console.firebase.google.com`

### **Recursos Adicionales**
- [Railway Variables Guide](https://docs.railway.app/guides/variables)
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp/api)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

---

**✅ Con esta guía, el webhook WhatsApp debería estar 100% funcional en Railway** 