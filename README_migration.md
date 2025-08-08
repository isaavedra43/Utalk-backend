# 🔄 MIGRACIÓN DE CONVERSACIONES V1

## 📋 Descripción

Este documento describe el proceso de migración para normalizar todos los documentos de `conversations` existentes al modelo canónico requerido por el listado de conversaciones.

## 🎯 Objetivos

- **Normalizar campos faltantes:** `workspaceId`, `tenantId`, `status`, `unreadCount`, `messageCount`, `lastMessageAt`, `participants`
- **Mantener compatibilidad:** No romper funcionalidad existente durante la migración
- **Proceso seguro:** DRY-RUN por defecto, migración idempotente
- **Documentación completa:** Reportes detallados y rollback plan

## 🚀 Preparación

### Variables de Entorno Requeridas

```bash
# Configuración de migración
MIGRATE_DRY_RUN=true                    # Solo generar reporte (default)
MIGRATION_BATCH_SIZE=200                # Tamaño del lote
MIGRATION_REPORT_DIR=/tmp               # Carpeta para reportes
DEFAULT_WORKSPACE_ID=default            # Fallback para workspaceId
DEFAULT_TENANT_ID=default               # Fallback para tenantId
MIGRATION_MAX_MSGS_TO_COUNT=0           # Contar mensajes (0 = no contar)
MIGRATION_INFER_PARTICIPANTS=true       # Inferir participants
MIGRATION_RESUME_CURSOR_FILE=/tmp/migrate_conversations_v1.cursor.json
MIGRATE_ALLOW_PROD=false                # Seguridad para producción
MIGRATION_LOG_VERBOSE=true              # Logs detallados
```

### Verificaciones Previas

1. **Backup de Firestore** (recomendado):
   ```bash
   # Exportar colección conversations
   firebase firestore:export --collection-ids conversations
   ```

2. **Verificar permisos**:
   ```bash
   # Asegurar que tienes permisos de escritura en Firestore
   ```

3. **Revisar configuración**:
   ```bash
   # Verificar variables de entorno
   echo "DRY_RUN: $MIGRATE_DRY_RUN"
   echo "BATCH_SIZE: $MIGRATION_BATCH_SIZE"
   echo "ALLOW_PROD: $MIGRATE_ALLOW_PROD"
   ```

## 📊 Ejecución

### Paso 1: DRY-RUN (Obligatorio)

```bash
# Configurar variables
export MIGRATE_DRY_RUN=true
export MIGRATION_BATCH_SIZE=200
export MIGRATION_REPORT_DIR=/tmp
export MIGRATION_LOG_VERBOSE=true

# Ejecutar migración en modo DRY-RUN
node scripts/migrate_conversations_v1.js
```

**Resultado esperado:**
- Reporte JSON en `/tmp/conversations_migration_report_<timestamp>.json`
- Reporte CSV en `/tmp/conversations_migration_changes_<timestamp>.csv`
- Logs detallados del proceso

### Paso 2: Revisar Reportes

#### Reporte JSON
```json
{
  "startedAt": "2025-08-08T02:30:00.000Z",
  "finishedAt": "2025-08-08T02:45:12.123Z",
  "dryRun": true,
  "batchSize": 200,
  "totals": {
    "scanned": 1543,
    "updated": 912,
    "skipped": 631,
    "errors": 0
  },
  "fieldsFilled": {
    "workspaceId": 880,
    "tenantId": 880,
    "status": 410,
    "unreadCount": 905,
    "messageCount": 0,
    "lastMessageAt": 765,
    "participants": 802,
    "createdAt": 12,
    "updatedAt": 12
  },
  "truncatedCounts": 44,
  "noMessagesUsedCreatedAt": 97,
  "emptyParticipantsAfterInference": 18,
  "resume": { "lastDocId": "conv_abc123" },
  "errorsList": []
}
```

#### Reporte CSV
```csv
docId,action,filledFields,skippedFields,truncatedCounts,usedLastMsg,usedCreatedAt,emptyParticipantsAfterInference,error
conv_abc123,would_update,workspaceId,tenantId,status,no,yes,no,no,
conv_def456,would_update,participants,lastMessageAt,no,yes,no,no,
```

### Paso 3: Ejecución Real (Opcional)

**⚠️ ADVERTENCIA:** Solo ejecutar después de revisar y validar el DRY-RUN.

```bash
# Configurar para ejecución real
export MIGRATE_DRY_RUN=false
export MIGRATE_ALLOW_PROD=true  # Requerido para producción
export MIGRATION_BATCH_SIZE=200

# Ejecutar migración real
node scripts/migrate_conversations_v1.js
```

## 🔄 Reanudación

Si la migración se interrumpe, se puede reanudar desde el último punto:

```bash
# El script automáticamente detecta el cursor guardado
node scripts/migrate_conversations_v1.js
```

**Archivo de cursor:** `/tmp/migrate_conversations_v1.cursor.json`

## 📋 Reglas de Normalización

### Campos Procesados

| Campo | Regla | Ejemplo |
|-------|-------|---------|
| `workspaceId` | Si falta → `DEFAULT_WORKSPACE_ID` | `"default"` |
| `tenantId` | Si falta → `DEFAULT_TENANT_ID` | `"default"` |
| `status` | Si falta → `"open"` | `"open"` |
| `unreadCount` | Si falta → `0` | `0` |
| `messageCount` | Si `MAX_MSGS_TO_COUNT > 0` → contar hasta N | `150` |
| `lastMessageAt` | Si falta → último mensaje o `createdAt` | `Timestamp` |
| `participants` | Si falta → inferir desde mensajes | `["+1234567890", "user@email.com"]` |
| `createdAt` | Si falta → `now()` | `Timestamp` |
| `updatedAt` | Si falta → `now()` | `Timestamp` |

### Inferencia de Participants

1. **Desde último mensaje:**
   - Agregar `senderIdentifier`
   - Agregar `recipientIdentifier`

2. **Desde customerPhone:**
   - Normalizar a formato E.164
   - Solo agregar `+` si ya existe

3. **Deduplicación:**
   - Remover duplicados automáticamente

### Conteo de Mensajes

- **Si `MAX_MSGS_TO_COUNT = 0`:** No contar, setear `0`
- **Si `MAX_MSGS_TO_COUNT > 0`:** Contar hasta N mensajes
- **Truncado:** Si hay más de N mensajes, marcar como truncado

## 🔍 Validación Post-Migración

### 1. Verificar en Firestore

```javascript
// Ejemplo de documento normalizado
{
  "id": "conv_abc123",
  "workspaceId": "default",
  "tenantId": "default",
  "status": "open",
  "unreadCount": 5,
  "messageCount": 150,
  "lastMessageAt": "2025-08-08T02:30:00.000Z",
  "participants": ["+1234567890", "user@email.com"],
  "customerPhone": "+1234567890",
  "createdAt": "2025-08-08T02:30:00.000Z",
  "updatedAt": "2025-08-08T02:30:00.000Z"
}
```

### 2. Probar Listado

```bash
# Verificar que el endpoint funciona
curl -X GET "https://your-api.com/api/conversations" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Probar Escritura

```bash
# Enviar mensaje de prueba
curl -X POST "https://your-api.com/api/conversations/CONV_ID/messages" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message"}'
```

## 🚨 Troubleshooting

### Error: "MIGRATE_ALLOW_PROD=true es requerido"

**Solución:**
```bash
export MIGRATE_ALLOW_PROD=true
node scripts/migrate_conversations_v1.js
```

### Error: Rate Limiting

**Solución:**
```bash
# Reducir batch size
export MIGRATION_BATCH_SIZE=50
node scripts/migrate_conversations_v1.js
```

### Error: Permisos de Firestore

**Solución:**
```bash
# Verificar credenciales
firebase auth:login
firebase projects:list
```

### Reanudación Manual

Si el cursor se corrompe:

```bash
# Eliminar cursor
rm /tmp/migrate_conversations_v1.cursor.json

# Reiniciar migración
node scripts/migrate_conversations_v1.js
```

## 📊 Monitoreo

### Logs Importantes

```bash
# Ver logs en tiempo real
tail -f /var/log/your-app.log | grep "migration"
```

### Métricas a Monitorear

- **Tasa de éxito:** `updated / scanned`
- **Errores:** `errors` en reporte JSON
- **Campos faltantes:** `fieldsFilled` en reporte JSON
- **Performance:** Tiempo por batch

## 🔒 Seguridad

### Variables Críticas

- `MIGRATE_DRY_RUN=true` (default)
- `MIGRATE_ALLOW_PROD=false` (default)
- `NODE_ENV=production` (requiere `MIGRATE_ALLOW_PROD=true`)

### Backup Recomendado

```bash
# Antes de ejecutar
firebase firestore:export --collection-ids conversations
```

## 📝 Rollback Plan

Si algo sale mal:

1. **Restaurar desde backup:**
   ```bash
   firebase firestore:import --collection-ids conversations backup.json
   ```

2. **Verificar integridad:**
   ```bash
   # Revisar algunos documentos manualmente
   ```

3. **Reintentar migración:**
   ```bash
   # Con configuración más conservadora
   export MIGRATION_BATCH_SIZE=50
   node scripts/migrate_conversations_v1.js
   ```

## 📞 Soporte

Para problemas técnicos:

1. **Revisar logs:** Buscar errores específicos
2. **Verificar reportes:** JSON y CSV generados
3. **Consultar documentación:** Este README
4. **Contactar equipo:** Backend team

---

**Versión:** 1.0.0  
**Última actualización:** Agosto 2025  
**Autor:** Backend Team 