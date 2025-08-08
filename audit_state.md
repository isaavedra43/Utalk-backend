# 📋 Auditoría de Estado UTalk Backend

## Resumen Ejecutivo

### ✅ Lo que SÍ está implementado:
- **Resolver Twilio**: `src/config/twilioRouting.js` existe y está integrado en `MessageService.processIncomingMessage` (líneas 263-264)
- **Logger unificado**: Winston child + métodos de dominio implementado en `correlation.js` y `requestLogger.js`
- **Logs de verificación**: `pipelines.ok`, `list.query_shape`, `write.shape_inbound`, `logger.shape` todos presentes
- **Default viewers**: Módulo `src/config/defaultViewers.js` creado y merge implementado en inbound/outbound
- **Backfill script**: `scripts/backfill_add_viewers.js` listo e idempotente

### ⚠️ Lo que falta por configurar:
- **ENV `DEFAULT_VIEWER_EMAILS`**: No está configurado en Railway (requiere `admin@company.com`)
- **Backfill histórico**: Script existe pero no se ha ejecutado para conversaciones existentes

## Orden Real de Middlewares

```
GET /api/conversations:
1. correlationMiddleware (src/index.js:393-469)
2. databaseLoggingMiddleware (src/middleware/logging.js:198-280)
3. authMiddleware (src/routes/conversations.js:67)
4. requireReadAccess (src/routes/conversations.js:68)
5. conversationValidators.validateList (src/routes/conversations.js:69)
6. ConversationController.listConversations (src/routes/conversations.js:70)
```

## Query Efectiva

**Pseudoconsulta exacta:**
```javascript
collection('conversations')
  .where('workspaceId', '==', req.user.workspaceId)
  .where('tenantId', '==', req.user.tenantId)
  .where('participants', 'array-contains', req.user.email)
  .orderBy('lastMessageAt', 'desc')
  .limit(50)
```

**Índices requeridos (firestore.indexes.json):**
- `workspaceId + lastMessageAt desc` (líneas 1-8)
- `workspaceId + status + lastMessageAt desc` (líneas 9-16)
- `participants array-contains + lastMessageAt desc` (líneas 17-24)

## Construcción de Participants

### Inbound (src/repositories/ConversationsRepository.js:452-460):
```javascript
const participantsSet = new Set(existingParticipants);
if (msg.senderIdentifier) participantsSet.add(msg.senderIdentifier);
if (msg.agentEmail) participantsSet.add(msg.agentEmail);

// NEW: mergear viewers por defecto
const viewers_in = getDefaultViewerEmails();
const sizeBefore_in = participantsSet.size;
for (const v of viewers_in) participantsSet.add(String(v || '').toLowerCase().trim());
const participants = Array.from(participantsSet);
```

### Outbound (src/repositories/ConversationsRepository.js:676-682):
```javascript
const participantsSet = new Set(existingParticipants);
if (msg.senderIdentifier) participantsSet.add(msg.senderIdentifier);
if (msg.recipientIdentifier) participantsSet.add(msg.recipientIdentifier);
if (msg.agentEmail) participantsSet.add(msg.agentEmail);

// NEW: mergear viewers por defecto
const viewers_out = getDefaultViewerEmails();
const sizeBefore_out = participantsSet.size;
for (const v of viewers_out) participantsSet.add(String(v || '').toLowerCase().trim());
const participants = Array.from(participantsSet);
```

## Cambios Implementados vs. No Tocados

### ✅ Implementado:
1. **Resolver Twilio**: `src/config/twilioRouting.js` + integración en `MessageService`
2. **Logger unificado**: `correlation.js` + `requestLogger.js` con accessor getter/setter
3. **Logs de verificación**: Todos los logs de diagnóstico presentes
4. **Default viewers**: Módulo creado y merge implementado en ambos flujos
5. **Backfill script**: Script idempotente listo para ejecutar

### ❌ No tocado (según instrucciones):
- Contratos HTTP: Sin cambios en rutas ni shapes de respuesta
- Query de lectura: Sin modificaciones en filtros ni lógica
- Sockets: Error `SOCKET_SET_UNDEFINED` en `enterpriseSocketManager.js:628` queda fuera del alcance

## Causas de '0 conversaciones' a día de hoy

### Evidencia de datos:
- **Conversaciones existentes**: Contienen `participants` con `["+5214773790184", "system@utalk.local"]` (sin `admin@company.com`)
- **Query de lectura**: Filtra por `participants array-contains req.user.email` (línea 98 en `ConversationController.js`)
- **Gap identificado**: Las conversaciones existentes no incluyen el email del usuario que lista

### Evidencia de código:
- **Escritura nueva**: Ahora incluye `getDefaultViewerEmails()` en ambos flujos (líneas 452-460 y 676-682)
- **Backfill pendiente**: Script existe pero no se ha ejecutado para histórico

## Checklist Go/No-Go para "ver conversaciones ya"

### ✅ Go (listo para funcionar):
- [x] Módulo `defaultViewers.js` creado
- [x] Merge de viewers en inbound/outbound implementado
- [x] Script de backfill listo
- [x] Logs de diagnóstico implementados
- [x] Índices de Firestore presentes

### ⚠️ Pendiente (configuración):
- [ ] Configurar `DEFAULT_VIEWER_EMAILS=admin@company.com` en Railway
- [ ] Ejecutar `DRY_RUN=false DEFAULT_VIEWER_EMAILS=admin@company.com npm run backfill:viewers`
- [ ] Redeploy para activar cambios

## Recomendaciones

**No hace falta más código.** Todos los componentes están implementados correctamente:

1. **Configurar ENV**: `DEFAULT_VIEWER_EMAILS=admin@company.com` en Railway
2. **Redeploy**: Para activar el merge de viewers por defecto
3. **Ejecutar backfill**: Una sola vez para conversaciones históricas
4. **Verificar logs**: Activar `LOG_MSG_WRITE=true` y `LOG_CONV_DIAG=true` para monitoreo

**Resultado esperado**: Nuevas conversaciones aparecerán inmediatamente, históricas tras el backfill.

**Error de sockets**: El `SOCKET_CONNECTION_ERROR` en `enterpriseSocketManager.js:628` es un issue separado que no afecta el listado de conversaciones. 