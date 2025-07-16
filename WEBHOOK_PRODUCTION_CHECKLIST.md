# 🎯 **CHECKLIST DE PRODUCCIÓN - WEBHOOK WHATSAPP TWILIO**

**Checklist definitivo para verificar que el flujo webhook esté 100% funcional en Railway**

---

## ✅ **FASE 1: VERIFICACIÓN DE INFRAESTRUCTURA**

### **1.1 Railway Environment**
- [ ] **Deploy exitoso**: Railway muestra "Deployed" en el dashboard
- [ ] **Sin errores de build**: No hay errores rojos en el log de deployment
- [ ] **Puerto asignado**: Railway asignó un puerto automáticamente
- [ ] **Dominio generado**: Existe URL pública `https://utalk-backend-production.up.railway.app`

### **1.2 Variables de Entorno**
- [ ] **FIREBASE_PROJECT_ID**: Configurado correctamente
- [ ] **FIREBASE_PRIVATE_KEY**: Configurado con saltos de línea `\n` escapados
- [ ] **FIREBASE_CLIENT_EMAIL**: Email del service account válido
- [ ] **TWILIO_ACCOUNT_SID**: SID de cuenta Twilio (comienza con AC...)
- [ ] **TWILIO_AUTH_TOKEN**: Token de autenticación Twilio
- [ ] **TWILIO_WHATSAPP_NUMBER**: Número en formato `whatsapp:+1234567890`
- [ ] **NODE_ENV**: Set a `production` 

### **1.3 Health Check**
```bash
curl https://utalk-backend-production.up.railway.app/health
```
- [ ] **Status Code**: 200 (no 503)
- [ ] **Firebase**: `"firebase": "connected"`
- [ ] **Twilio**: `"twilio": "configured"`
- [ ] **Status**: `"status": "OK"` (no "DEGRADED")

---

## ✅ **FASE 2: VERIFICACIÓN DE WEBHOOK**

### **2.1 Configuración Twilio Console**
- [ ] **URL Webhook**: `https://utalk-backend-production.up.railway.app/api/messages/webhook`
- [ ] **Método HTTP**: `POST`
- [ ] **Content-Type**: `application/x-www-form-urlencoded`
- [ ] **Status Webhook**: Habilitado/Activo

### **2.2 Test GET Webhook**
```bash
curl https://utalk-backend-production.up.railway.app/api/messages/webhook
```
- [ ] **Respuesta**: "Webhook endpoint activo y funcionando"
- [ ] **Status Code**: 200

### **2.3 Test POST Webhook Básico**
```bash
curl -X POST https://utalk-backend-production.up.railway.app/api/messages/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "MessageSid=SMtest123" \
  -d "AccountSid=ACtest123" \
  -d "From=whatsapp:+1234567890" \
  -d "To=whatsapp:+0987654321" \
  -d "Body=Test message"
```
- [ ] **Status Code**: 200 (CRÍTICO - nunca 4xx o 5xx)
- [ ] **Response JSON**: Contiene `"status": "success"` o similar
- [ ] **No errores**: No lanza excepciones

---

## ✅ **FASE 3: VERIFICACIÓN DE LOGS**

### **3.1 Railway Logs**
Acceder a: `Railway Dashboard > Project > Logs`

**Buscar estos logs al enviar test:**
- [ ] **`🔗 WEBHOOK TWILIO - Mensaje recibido`**: Visible en Railway console
- [ ] **`📨 PROCESANDO MENSAJE ENTRANTE`**: Muestra datos del mensaje
- [ ] **`✅ WEBHOOK - Validación exitosa`**: Joi validó correctamente
- [ ] **`💾 GUARDANDO MENSAJE EN FIREBASE`**: Intento de guardar
- [ ] **`✅ MENSAJE GUARDADO EXITOSAMENTE`**: Guardado exitoso
- [ ] **`🎉 WEBHOOK PROCESADO COMPLETAMENTE`**: Proceso completo

**No debe aparecer:**
- [ ] **❌ Errores de Firebase**: No `Firebase desconectado`
- [ ] **❌ Errores de validación**: No `Campos requeridos faltantes`
- [ ] **❌ Crashes**: No `process.exit(1)`

### **3.2 Firebase Console**
Acceder a: `Firebase Console > Firestore > Database`

- [ ] **Colección `messages`**: Existe y tiene documentos
- [ ] **Último mensaje**: Corresponde al test enviado
- [ ] **Campos completos**: `from`, `to`, `content`, `twilioSid`, `timestamp`
- [ ] **Metadata**: Incluye información del webhook original

---

## ✅ **FASE 4: TESTS DE DIFERENTES TIPOS DE MENSAJE**

### **4.1 Mensaje de Texto**
```bash
bash test-webhook-complete.sh
```
- [ ] **Test texto**: Status 200, guardado en Firebase
- [ ] **Logs visibles**: Aparecen en Railway console
- [ ] **Contacto creado**: Nuevo contacto si no existía

### **4.2 Mensaje con Media**
- [ ] **Test imagen**: Status 200, tipo `image` detectado
- [ ] **Test audio**: Status 200, tipo `audio` detectado
- [ ] **MediaUrls**: URLs guardadas correctamente
- [ ] **Metadata**: Información de media preservada

### **4.3 Mensaje con Datos Faltantes**
- [ ] **Campos faltantes**: Responde 200 OK, no crash
- [ ] **Warning logs**: Aparece advertencia pero sigue procesando
- [ ] **Graceful degradation**: Sistema no falla

---

## ✅ **FASE 5: VERIFICACIÓN TWILIO REAL**

### **5.1 Test con WhatsApp Real**
- [ ] **Enviar mensaje**: Desde WhatsApp Business a tu número Twilio
- [ ] **Twilio recibe**: Aparece en Twilio Console > Monitor > Logs
- [ ] **Webhook triggered**: Twilio llama a tu webhook
- [ ] **Status 200**: Twilio recibe respuesta exitosa
- [ ] **No reintentos**: Twilio no marca error ni reintenta

### **5.2 Verificación Firebase**
- [ ] **Mensaje real**: Aparece en Firestore
- [ ] **Datos correctos**: Número, contenido, timestamp
- [ ] **Contacto**: Creado automáticamente si es nuevo

---

## ✅ **FASE 6: MONITOREO Y ALERTAS**

### **6.1 Railway Monitoring**
- [ ] **CPU/Memory**: Uso normal, no picos anómalos
- [ ] **Response time**: < 2 segundos promedio
- [ ] **Error rate**: 0% (todos 200 OK)
- [ ] **Uptime**: 100% últimas 24h

### **6.2 Twilio Monitoring**
- [ ] **Webhook success rate**: 100%
- [ ] **No error codes**: No 4xx, 5xx, timeouts
- [ ] **Response time**: < 5 segundos
- [ ] **Queue empty**: No mensajes pendientes

---

## ✅ **FASE 7: VERIFICACIÓN DE SEGURIDAD**

### **7.1 Validación Twilio**
- [ ] **Signature validation**: Funciona en producción (opcional)
- [ ] **User-Agent**: Verifica `TwilioProxy/1.1`
- [ ] **Content-Type**: Acepta `application/x-www-form-urlencoded`
- [ ] **Rate limiting**: No bloquea Twilio

### **7.2 Protecciones**
- [ ] **No auth required**: Webhook es público
- [ ] **CORS configurado**: Permite Twilio origins
- [ ] **Error handling**: Siempre responde 200 OK
- [ ] **Input validation**: Joi acepta todos los campos

---

## 🎯 **CRITERIOS DE ÉXITO FINAL**

### ✅ **FLUJO COMPLETO FUNCIONAL:**
1. **Twilio → Webhook**: Mensaje llega correctamente
2. **Webhook → Validation**: Joi valida sin rechazar
3. **Validation → Processing**: TwilioService procesa datos
4. **Processing → Firebase**: Mensaje se guarda en Firestore
5. **Firebase → Response**: Webhook responde 200 OK a Twilio
6. **Response → Twilio**: Twilio marca como entregado exitosamente

### ✅ **INDICADORES CLAVE:**
- **🟢 Status Code**: SIEMPRE 200 OK a Twilio
- **🟢 Firebase**: Mensajes aparecen en tiempo real
- **🟢 Logs**: Visibles y detallados en Railway
- **🟢 No errores**: Sin crashes ni excepciones
- **🟢 Performance**: < 2 segundos response time
- **🟢 Reliability**: 100% success rate

---

## 🚨 **TROUBLESHOOTING RÁPIDO**

### **Si Status Code ≠ 200:**
1. Revisar Railway logs para errores
2. Verificar variables de entorno Firebase
3. Comprobar conectividad Firestore
4. Validar schema Joi

### **Si Firebase no guarda:**
1. Verificar permisos service account
2. Comprobar Firestore rules
3. Validar estructura de datos
4. Revisar errores en Railway logs

### **Si Twilio reintenta:**
1. Verificar URL del webhook es exacta
2. Comprobar que siempre responde 200
3. Reducir tiempo de procesamiento
4. Verificar certificado SSL

---

## ✅ **CHECKLIST COMPLETADO**

**Fecha de verificación**: ___________  
**Verificado por**: ___________  
**Ambiente**: Railway Production  
**Status**: ✅ APROBADO / ❌ REQUIERE CORRECCIÓN  

**Notas adicionales:**
_________________________________________________
_________________________________________________

---

*Este checklist asegura que el webhook está 100% funcional y listo para recibir mensajes de WhatsApp en producción.* 