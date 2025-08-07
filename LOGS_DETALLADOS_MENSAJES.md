# 📊 LOGS DETALLADOS PARA PROCESO DE MENSAJES

## 🎯 **OBJETIVO**

Agregar logs detallados en todo el flujo de procesamiento de mensajes para detectar exactamente dónde falla el proceso y poder resolver problemas específicos.

## 📋 **LOGS AGREGADOS**

### **1. WEBHOOK HANDLER (`MessageController.handleWebhookSafe`)**

#### **Logs de Inicio:**
- `🔗 WEBHOOK INICIADO` - Información del request (headers, IP, user-agent)
- `📥 PAYLOAD WEBHOOK RECIBIDO` - Datos del payload de Twilio
- `✅ WEBHOOK VALIDACIÓN BÁSICA PASADA` - Validación exitosa
- `📱 TELÉFONOS PROCESADOS` - Normalización de números

#### **Logs de Procesamiento:**
- `🔄 INICIANDO PROCESAMIENTO CON MESSAGESERVICE` - Inicio del procesamiento
- `✅ MESSAGESERVICE PROCESAMIENTO COMPLETADO` - Procesamiento exitoso
- `📤 ENVIANDO RESPUESTA EXITOSA A TWILIO` - Respuesta al webhook

#### **Logs de Error:**
- `❌ WEBHOOK DATOS FALTANTES` - Validación fallida
- `❌ ERROR CRÍTICO EN WEBHOOK` - Error general

### **2. MESSAGE SERVICE (`MessageService.processIncomingMessage`)**

#### **Logs de Inicio:**
- `🔄 MESSAGESERVICE - INICIANDO PROCESAMIENTO` - Inicio del servicio
- `📋 MESSAGESERVICE - DATOS EXTRAÍDOS` - Datos del webhook
- `✅ MESSAGESERVICE - VALIDACIÓN PASADA` - Validación exitosa

#### **Logs de Verificación:**
- `🔍 MESSAGESERVICE - VERIFICANDO DUPLICADOS` - Búsqueda de duplicados
- `✅ MESSAGESERVICE - SIN DUPLICADOS` - Sin duplicados encontrados
- `⚠️ MESSAGESERVICE - MENSAJE DUPLICADO DETECTADO` - Duplicado encontrado

#### **Logs de Normalización:**
- `📱 MESSAGESERVICE - NORMALIZANDO TELÉFONOS` - Proceso de normalización
- `✅ MESSAGESERVICE - TELÉFONOS NORMALIZADOS` - Normalización completa

#### **Logs de Tipo de Mensaje:**
- `📊 MESSAGESERVICE - TIPO DE MENSAJE DETERMINADO` - Tipo identificado
- `📝 MESSAGESERVICE - DATOS DE MENSAJE PREPARADOS` - Datos listos

#### **Logs de Media:**
- `🖼️ MESSAGESERVICE - PROCESANDO MEDIA` - Procesamiento de archivos
- `✅ MESSAGESERVICE - MEDIA PROCESADA EXITOSAMENTE` - Media procesada
- `⚠️ MESSAGESERVICE - ERROR PROCESANDO MEDIA` - Error en media

#### **Logs de Creación:**
- `💾 MESSAGESERVICE - CREANDO MENSAJE EN FIRESTORE` - Inicio de creación
- `✅ MESSAGESERVICE - MENSAJE CREADO EXITOSAMENTE` - Creación exitosa

### **3. CREATE MESSAGE (`MessageService.createMessage`)**

#### **Logs de Validación:**
- `🔍 CREATEMESSAGE - VALIDANDO ENTRADA` - Validación de datos
- `✅ CREATEMESSAGE - VALIDACIÓN PASADA` - Validación exitosa
- `❌ CREATEMESSAGE - CONVERSATIONID FALTANTE` - Error de validación
- `❌ CREATEMESSAGE - FROM/TO FALTANTES` - Error de validación
- `❌ CREATEMESSAGE - DIRECTION INVÁLIDO` - Error de validación

#### **Logs de Firestore:**
- `💾 CREATEMESSAGE - CREANDO EN FIRESTORE` - Inicio de guardado
- `✅ CREATEMESSAGE - MENSAJE CREADO EN FIRESTORE` - Guardado exitoso

#### **Logs de Efectos Secundarios:**
- `🔄 CREATEMESSAGE - AGREGANDO UPDATE CONVERSATION` - Efecto agregado
- `🔄 CREATEMESSAGE - AGREGANDO UPDATE CONTACT` - Efecto agregado
- `🔄 CREATEMESSAGE - EJECUTANDO EFECTOS SECUNDARIOS` - Ejecución
- `✅ CREATEMESSAGE - EFECTOS SECUNDARIOS COMPLETADOS` - Completado

### **4. MESSAGE MODEL (`Message.create`)**

#### **Logs de Instancia:**
- `🔄 MESSAGE.CREATE - INICIANDO CREACIÓN` - Inicio del modelo
- `✅ MESSAGE.CREATE - INSTANCIA CREADA` - Instancia creada
- `🧹 MESSAGE.CREATE - DATOS LIMPIOS PREPARADOS` - Datos limpios

#### **Logs de Firestore:**
- `💾 MESSAGE.CREATE - GUARDANDO EN FIRESTORE` - Guardado en DB
- `✅ MESSAGE.CREATE - MENSAJE GUARDADO EN FIRESTORE` - Guardado exitoso

#### **Logs de Conversación:**
- `🔄 MESSAGE.CREATE - ACTUALIZANDO CONVERSACIÓN` - Actualización
- `✅ MESSAGE.CREATE - CONVERSACIÓN ENCONTRADA` - Conversación encontrada
- `✅ MESSAGE.CREATE - CONVERSACIÓN ACTUALIZADA` - Actualización exitosa
- `⚠️ MESSAGE.CREATE - CONVERSACIÓN NO ENCONTRADA` - Conversación no encontrada

### **5. TWILIO SERVICE (`TwilioService.processIncomingMessage`)**

#### **Logs de Extracción:**
- `📋 TWILIOSERVICE - DATOS EXTRAÍDOS` - Datos del webhook
- `🔍 TWILIOSERVICE - VALIDANDO CAMPOS OBLIGATORIOS` - Validación
- `✅ TWILIOSERVICE - VALIDACIÓN PASADA` - Validación exitosa

#### **Logs de Teléfonos:**
- `📱 TWILIOSERVICE - NORMALIZANDO TELÉFONOS` - Normalización
- `✅ TWILIOSERVICE - TELÉFONOS NORMALIZADOS` - Normalización completa

#### **Logs de Roles:**
- `🏢 TWILIOSERVICE - IDENTIFICANDO ROLES` - Identificación de roles
- `📤 TWILIOSERVICE - MENSAJE SALIENTE DETECTADO` - Mensaje saliente
- `📥 TWILIOSERVICE - MENSAJE ENTRANTE DETECTADO` - Mensaje entrante
- `✅ TWILIOSERVICE - ROLES IDENTIFICADOS` - Roles identificados

#### **Logs de Contacto:**
- `👤 TWILIOSERVICE - PROCESANDO INFORMACIÓN DE CONTACTO` - Procesamiento
- `✅ TWILIOSERVICE - INFORMACIÓN DE CONTACTO PROCESADA` - Procesado

#### **Logs de Estructura:**
- `📝 TWILIOSERVICE - CREANDO ESTRUCTURA DE MENSAJE` - Estructura
- `✅ TWILIOSERVICE - ESTRUCTURA DE MENSAJE CREADA` - Estructura creada

### **6. CONVERSATION UPDATE (`MessageService.updateConversationWithMessage`)**

#### **Logs de Búsqueda:**
- `🔍 UPDATECONVERSATION - BUSCANDO CONVERSACIÓN` - Búsqueda
- `✅ UPDATECONVERSATION - CONVERSACIÓN ENCONTRADA` - Encontrada
- `⚠️ UPDATECONVERSATION - CONVERSACIÓN NO ENCONTRADA` - No encontrada

#### **Logs de Actualización:**
- `📝 UPDATECONVERSATION - ACTUALIZANDO ÚLTIMO MENSAJE` - Actualización
- `✅ UPDATECONVERSATION - ÚLTIMO MENSAJE ACTUALIZADO` - Actualizado

#### **Logs de Tiempo Real:**
- `📡 UPDATECONVERSATION - EMITIENDO EVENTO TIEMPO REAL` - Emisión
- `✅ UPDATECONVERSATION - EVENTO EMITIDO` - Emitido

### **7. REAL-TIME EVENTS (`TwilioService.emitRealTimeEvent`)**

#### **Logs de Socket:**
- `🔄 EMITREALTIMEEVENT - IMPORTANDO SOCKET SERVICE` - Importación
- `✅ EMITREALTIMEEVENT - SOCKET SERVICE IMPORTADO` - Importado
- `📡 EMITREALTIMEEVENT - EMITIENDO MENSAJE` - Emisión
- `✅ EMITREALTIMEEVENT - EVENTO SOCKET.IO EMITIDO` - Emitido
- `⚠️ EMITREALTIMEEVENT - SOCKET.IO NO DISPONIBLE` - No disponible

## 🔍 **CÓMO USAR LOS LOGS**

### **1. Buscar por RequestId:**
Cada proceso tiene un `requestId` único que permite rastrear todo el flujo:
```
webhook_1234567890_abc123def
msg_1234567890_xyz789ghi
create_1234567890_def456jkl
```

### **2. Buscar por Step:**
Cada log tiene un `step` que indica la fase del proceso:
- `webhook_error_handling`
- `message_service_completed`
- `firestore_save_complete`
- `realtime_emit_complete`

### **3. Buscar por Emoji:**
- `🔄` - Proceso iniciando
- `✅` - Proceso exitoso
- `❌` - Error crítico
- `⚠️` - Advertencia
- `📡` - Eventos de tiempo real
- `💾` - Operaciones de base de datos

## 📊 **FLUJO COMPLETO DE LOGS**

```
1. 🔗 WEBHOOK INICIADO
2. 📥 PAYLOAD WEBHOOK RECIBIDO
3. ✅ WEBHOOK VALIDACIÓN BÁSICA PASADA
4. 📱 TELÉFONOS PROCESADOS
5. 🔄 INICIANDO PROCESAMIENTO CON MESSAGESERVICE
6. 📋 MESSAGESERVICE - DATOS EXTRAÍDOS
7. ✅ MESSAGESERVICE - VALIDACIÓN PASADA
8. 🔍 MESSAGESERVICE - VERIFICANDO DUPLICADOS
9. ✅ MESSAGESERVICE - SIN DUPLICADOS
10. 📱 MESSAGESERVICE - NORMALIZANDO TELÉFONOS
11. ✅ MESSAGESERVICE - TELÉFONOS NORMALIZADOS
12. 📊 MESSAGESERVICE - TIPO DE MENSAJE DETERMINADO
13. 📝 MESSAGESERVICE - DATOS DE MENSAJE PREPARADOS
14. 💾 MESSAGESERVICE - CREANDO MENSAJE EN FIRESTORE
15. 🔄 CREATEMESSAGE - INICIANDO CREACIÓN
16. 🔍 CREATEMESSAGE - VALIDANDO ENTRADA
17. ✅ CREATEMESSAGE - VALIDACIÓN PASADA
18. 💾 CREATEMESSAGE - CREANDO EN FIRESTORE
19. 🔄 MESSAGE.CREATE - INICIANDO CREACIÓN
20. ✅ MESSAGE.CREATE - INSTANCIA CREADA
21. 🧹 MESSAGE.CREATE - DATOS LIMPIOS PREPARADOS
22. 💾 MESSAGE.CREATE - GUARDANDO EN FIRESTORE
23. ✅ MESSAGE.CREATE - MENSAJE GUARDADO EN FIRESTORE
24. 🔄 MESSAGE.CREATE - ACTUALIZANDO CONVERSACIÓN
25. ✅ MESSAGE.CREATE - CONVERSACIÓN ENCONTRADA
26. ✅ MESSAGE.CREATE - CONVERSACIÓN ACTUALIZADA
27. ✅ MESSAGE.CREATE - CREACIÓN COMPLETADA
28. ✅ CREATEMESSAGE - MENSAJE CREADO EN FIRESTORE
29. 🔄 CREATEMESSAGE - AGREGANDO UPDATE CONVERSATION
30. 🔄 CREATEMESSAGE - AGREGANDO UPDATE CONTACT
31. 🔄 CREATEMESSAGE - EJECUTANDO EFECTOS SECUNDARIOS
32. 🔄 UPDATECONVERSATION - INICIANDO ACTUALIZACIÓN
33. 🔍 UPDATECONVERSATION - BUSCANDO CONVERSACIÓN
34. ✅ UPDATECONVERSATION - CONVERSACIÓN ENCONTRADA
35. 📝 UPDATECONVERSATION - ACTUALIZANDO ÚLTIMO MENSAJE
36. ✅ UPDATECONVERSATION - ÚLTIMO MENSAJE ACTUALIZADO
37. 📡 UPDATECONVERSATION - EMITIENDO EVENTO TIEMPO REAL
38. 📡 EMITREALTIMEEVENT - INICIANDO EMISIÓN
39. 🔄 EMITREALTIMEEVENT - IMPORTANDO SOCKET SERVICE
40. ✅ EMITREALTIMEEVENT - SOCKET SERVICE IMPORTADO
41. 📡 EMITREALTIMEEVENT - EMITIENDO MENSAJE
42. ✅ EMITREALTIMEEVENT - EVENTO SOCKET.IO EMITIDO
43. ✅ EMITREALTIMEEVENT - PROCESO COMPLETADO
44. ✅ UPDATECONVERSATION - EVENTO EMITIDO
45. ✅ UPDATECONVERSATION - ACTUALIZACIÓN COMPLETADA
46. ✅ CREATEMESSAGE - EFECTOS SECUNDARIOS COMPLETADOS
47. ✅ CREATEMESSAGE - MENSAJE CREADO EXITOSAMENTE
48. ✅ MESSAGESERVICE - MENSAJE CREADO EXITOSAMENTE
49. ✅ MESSAGESERVICE - PROCESAMIENTO COMPLETADO
50. ✅ MESSAGESERVICE - MENSAJE CREADO EXITOSAMENTE
51. 📤 ENVIANDO RESPUESTA EXITOSA A TWILIO
```

## ✅ **BENEFICIOS**

1. **Trazabilidad Completa:** Cada mensaje tiene un `requestId` único
2. **Detección Precisa:** Logs específicos para cada paso del proceso
3. **Debugging Rápido:** Identificación inmediata de dónde falla
4. **Monitoreo en Tiempo Real:** Logs con timestamps precisos
5. **Información Detallada:** Datos completos en cada paso

## 🎯 **RESULTADO**

Ahora puedes rastrear exactamente dónde falla el proceso de mensajes y resolver problemas específicos con información detallada de cada paso. 