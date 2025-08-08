# 🔐 REGLAS DE SEGURIDAD DE FIRESTORE - GUÍA COMPLETA

## 📋 Descripción

Esta guía describe las reglas de seguridad de Firestore implementadas para garantizar acceso multi-tenant seguro a las colecciones `conversations` y `messages`.

## 🎯 Objetivo

Las reglas implementadas tienen como objetivo:

1. **Restringir lecturas** por `workspaceId` y `tenantId`
2. **Bloquear escrituras desde cliente** (el backend usa Admin SDK)
3. **Garantizar aislamiento** entre diferentes workspaces/tenants
4. **Preparar para futuras expansiones** con opciones controladas

## 🔒 Principios de Seguridad

### Lecturas Permitidas
- ✅ **Autenticación requerida:** Solo usuarios con JWT válido
- ✅ **Scoping por workspace:** `resource.workspaceId == token.workspaceId`
- ✅ **Scoping por tenant:** `resource.tenantId == token.tenantId` (si aplica)
- ✅ **Validación jerárquica:** Mensajes validan contra conversación padre

### Escrituras Bloqueadas
- ❌ **Cliente bloqueado:** Todas las escrituras desde cliente denegadas
- ✅ **Backend permitido:** Admin SDK omite reglas automáticamente
- 🔮 **Futuro opcional:** Claim `canClientWriteMessages` para outbound controlado

## 🚀 Despliegue

### Prerrequisitos

1. **Firebase CLI instalado:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Autenticado con Firebase:**
   ```bash
   firebase login
   ```

3. **Proyecto seleccionado:**
   ```bash
   firebase use <projectId>
   ```

### Despliegue de Reglas

```bash
# Desplegar solo reglas de seguridad
firebase deploy --only firestore:rules
```

### Verificación del Despliegue

1. **En Firebase Console:**
   - Ir a Firestore Database → Reglas
   - Verificar que las reglas están activas
   - Estado: "Publicado" o "Ready"

2. **En logs de despliegue:**
   ```bash
   # Debería mostrar algo como:
   # ✔  firestore: rules file firestore.rules published successfully
   ```

## 🧪 Verificación de Seguridad

### 1. Verificar Aislamiento por Workspace

**Prueba:** Usuario con `workspaceId: "A"` intenta leer documento con `workspaceId: "B"`

**Resultado esperado:** ❌ Acceso denegado

```javascript
// Cliente con workspaceId: "A"
const doc = await firebase.firestore()
  .collection('conversations')
  .doc('conversation-from-workspace-B')
  .get(); // Debería fallar
```

### 2. Verificar Bloqueo de Escrituras Cliente

**Prueba:** Intentar crear/editar documento desde cliente

**Resultado esperado:** ❌ Escritura denegada

```javascript
// Intentar crear conversación desde cliente
await firebase.firestore()
  .collection('conversations')
  .add({
    workspaceId: 'my-workspace',
    participants: ['user@example.com']
  }); // Debería fallar

// Intentar crear mensaje desde cliente
await firebase.firestore()
  .collection('conversations')
  .doc('conversation-id')
  .collection('messages')
  .add({
    content: 'Hello world',
    senderEmail: 'user@example.com'
  }); // Debería fallar
```

### 3. Verificar Backend Sigue Funcionando

**Prueba:** Enviar mensaje a través del backend (Twilio webhook)

**Resultado esperado:** ✅ Mensaje guardado correctamente

```bash
# El backend usa Admin SDK que omite reglas
# Los mensajes inbound/outbound siguen funcionando
```

## 🔧 Configuración de Claims

### Claims Requeridos en JWT

```javascript
{
  "workspaceId": "workspace-123",     // Obligatorio
  "tenantId": "tenant-456",           // Opcional
  "email": "user@example.com",        // Obligatorio
  "role": "agent",                    // Obligatorio
  "userId": "user-789"                // Opcional
}
```

### Claims Opcionales

```javascript
{
  "canClientWriteMessages": false     // Para futuras expansiones
}
```

## 🔍 Funciones de Seguridad

### Helpers de Autenticación

```javascript
// Verificar si usuario está autenticado
function isSignedIn() {
  return request.auth != null;
}

// Verificar si token tiene campo específico
function has(field) {
  return request.auth != null && field in request.auth.token;
}

// Obtener valor de campo del token
function token(field) {
  return request.auth.token[field];
}
```

### Helpers de Scoping

```javascript
// Verificar mismo workspace
function sameWorkspace(resourceData) {
  return has('workspaceId') && resourceData.workspaceId == token('workspaceId');
}

// Verificar mismo tenant (opcional)
function sameTenant(resourceData) {
  return !has('tenantId') || resourceData.tenantId == token('tenantId');
}

// Verificar acceso completo
function canReadDoc(resourceData) {
  return isSignedIn() && sameWorkspace(resourceData) && sameTenant(resourceData);
}
```

### Helpers de Roles

```javascript
// Verificar si es admin
function isAdmin() {
  return has('role') && (token('role') == 'admin' || token('role') == 'owner');
}

// Verificar si es agente o superior
function isAgent() {
  return has('role') && (token('role') == 'agent' || isAdmin());
}
```

## 🔮 Expansiones Futuras

### Escritura Controlada de Mensajes Outbound

Si en el futuro necesitas permitir escritura de mensajes outbound desde cliente:

1. **Habilitar claim:** `canClientWriteMessages: true`
2. **Descomentar regla:** En `firestore.rules`
3. **Validar condiciones:**
   - Usuario es agente o superior
   - Mensaje es outbound
   - No incluye workspaceId/tenantId (evita spoof)
   - Timestamp reciente

```javascript
// Regla opcional (actualmente comentada)
allow create: if clientMessageWriteEnabled()
  && isAgent()
  && canReadDoc(get(/databases/$(database)/documents/conversations/$(conversationId)).data)
  && request.resource.data.conversationId == conversationId
  && request.resource.data.direction == 'outbound'
  && !('workspaceId' in request.resource.data)
  && !('tenantId' in request.resource.data)
  && request.resource.data.timestamp <= request.time + duration.value(5, 'minutes');
```

## 🛠️ Troubleshooting

### Error: "Missing or insufficient permissions"

**Causa:** Usuario no autenticado o workspace/tenant incorrecto

**Solución:**
1. Verificar JWT válido
2. Verificar claims `workspaceId` y `tenantId`
3. Verificar que documento tiene `workspaceId` correcto

### Error: "Permission denied"

**Causa:** Intentando escribir desde cliente

**Solución:**
1. Usar backend para escrituras
2. Verificar que Admin SDK está configurado correctamente
3. Si necesitas escritura cliente, habilitar claim opcional

### Error: "Resource not found"

**Causa:** Documento no existe o reglas muy restrictivas

**Solución:**
1. Verificar que documento existe
2. Verificar claims del usuario
3. Verificar estructura de datos (workspaceId, tenantId)

## 📊 Monitoreo

### Logs de Seguridad

```bash
# En Firebase Console
# Firestore → Uso → Reglas
# Verificar intentos de acceso denegados
```

### Métricas a Observar

- **Accesos denegados:** Frecuencia y patrones
- **Intentos de escritura cliente:** Deberían ser 0
- **Errores de autenticación:** Indicadores de problemas de JWT

## 🔒 Buenas Prácticas

### Seguridad

1. **Nunca confiar en cliente:** Todas las escrituras críticas por backend
2. **Validar claims:** Verificar workspaceId/tenantId en cada request
3. **Principio de menor privilegio:** Solo permisos necesarios
4. **Auditoría regular:** Revisar logs de acceso

### Mantenimiento

1. **Versionar reglas:** Control de versiones para cambios
2. **Testing:** Probar reglas antes de producción
3. **Documentación:** Mantener guías actualizadas
4. **Backup:** Guardar versiones anteriores

## 📞 Soporte

### Para Problemas Técnicos

1. **Revisar logs de Firestore**
2. **Verificar claims de JWT**
3. **Probar con Firebase Emulator**
4. **Contactar equipo de backend**

### Recursos Adicionales

- [Firestore Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [JWT Claims Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)

---

**Versión:** 1.0.0  
**Última actualización:** Agosto 2025  
**Autor:** Backend Team 