# 🔄 MIGRACIÓN DE CONVERSACIONES V1

## 📋 Descripción

Este documento describe el proceso de migración para agregar campos faltantes a las conversaciones existentes en Firestore, habilitando el soporte completo para multi-tenancy y compatibilidad con el nuevo repositorio unificado.

## 🎯 Objetivos

- **Agregar campos faltantes:** `workspaceId`, `tenantId`, `status`, `unreadCount`, `participants`
- **Mantener compatibilidad:** No romper funcionalidad existente durante la migración
- **Proceso seguro:** DRY-RUN por defecto, migración idempotente
- **Documentación completa:** Reportes detallados y rollback plan

## 🚀 Preparación

### Variables de Entorno Requeridas

```bash
# Configuración de migración
MIGRATE_DRY_RUN=true                    # Solo generar reporte (default)
MIGRATION_BATCH_SIZE=200                # Tamaño del lote
CONVERSATIONS_COLLECTION_PATH=conversations  # Ruta de la colección

# Configuración de workspace/tenant (para inferencia)
DEFAULT_WORKSPACE_ID=default            # Workspace por defecto
DEFAULT_TENANT_ID=default               # Tenant por defecto

# Configuración del repositorio
TENANT_MODE=true                        # Habilitar filtros tenant
LEGACY_COMPAT=true                      # Habilitar compatibilidad legacy
LOG_VERBOSE_CONVERSATIONS=true          # Logs detallados
```

### Verificación Previa

1. **Backup de datos:**
   ```bash
   # Exportar conversaciones actuales (opcional)
   firebase firestore:export --collection-ids conversations
   ```

2. **Verificar conectividad:**
   ```bash
   # Probar conexión a Firestore
   node -e "require('./src/config/firebase'); console.log('✅ Firebase conectado')"
   ```

## 🔧 Ejecución

### Paso 1: DRY-RUN (Recomendado)

```bash
# Configurar para solo generar reporte
export MIGRATE_DRY_RUN=true
export MIGRATION_BATCH_SIZE=100

# Ejecutar migración en modo DRY-RUN
node scripts/migrate_conversations_v1.js
```

**Resultado esperado:**
```
🚀 Iniciando migración de conversaciones V1
📊 Total de conversaciones encontradas: X
🔄 Procesando lote 1/Y (X conversaciones)
✅ Migración completada
📄 Reporte generado: /tmp/conversations_migration_report_1234567890.json
```

### Paso 2: Revisar Reporte

El reporte incluye:
- **Metadata:** Configuración y duración
- **Stats:** Total procesado, cambiado, omitido, errores
- **Summary:** Resumen ejecutivo
- **Detalles:** Por conversación (en CSV)

### Paso 3: Ejecutar Migración Real

```bash
# Configurar para aplicar cambios
export MIGRATE_DRY_RUN=false
export MIGRATION_BATCH_SIZE=200

# Ejecutar migración real
node scripts/migrate_conversations_v1.js
```

### Paso 4: Verificación Post-Migración

```bash
# Verificar que las conversaciones tienen los campos requeridos
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://your-backend.com/api/conversations?limit=5"
```

## 🔍 Campos Migrados

### 1. workspaceId y tenantId
- **Propósito:** Soporte multi-tenant
- **Inferencia:** Desde `DEFAULT_WORKSPACE_ID`/`DEFAULT_TENANT_ID` o lógica basada en `customerPhone`
- **Valor por defecto:** `'default'`

### 2. status
- **Propósito:** Estado de la conversación
- **Valor por defecto:** `'open'`
- **Valores válidos:** `'open'`, `'closed'`, `'archived'`

### 3. unreadCount
- **Propósito:** Contador de mensajes no leídos
- **Valor por defecto:** `0`

### 4. participants
- **Propósito:** Array de participantes
- **Inferencia:** `[customerPhone, assignedTo]` (si existen)
- **Valor por defecto:** `[]`

### 5. lastMessageAt
- **Propósito:** Timestamp del último mensaje
- **Inferencia:** Desde `lastMessage.timestamp` si existe
- **Valor por defecto:** `null`

## 🛠️ Rollback Plan

### Opción 1: Rollback Manual
```bash
# Script de rollback (crear si es necesario)
node scripts/rollback_conversations_v1.js
```

### Opción 2: Desactivar Flags
```bash
# Desactivar tenant mode temporalmente
export TENANT_MODE=false
export LEGACY_COMPAT=true

# Reiniciar aplicación
```

### Opción 3: Restaurar desde Backup
```bash
# Restaurar desde export previo
firebase firestore:import --collection-ids conversations backup.json
```

## 🔧 Configuración del Repositorio

### Activación Gradual

1. **Fase 1: Compatibilidad Legacy**
   ```bash
   export TENANT_MODE=false
   export LEGACY_COMPAT=true
   ```

2. **Fase 2: Tenant Mode con Legacy**
   ```bash
   export TENANT_MODE=true
   export LEGACY_COMPAT=true
   ```

3. **Fase 3: Tenant Mode Puro**
   ```bash
   export TENANT_MODE=true
   export LEGACY_COMPAT=false
   ```

### Logs de Diagnóstico

```bash
# Habilitar logs detallados
export LOG_VERBOSE_CONVERSATIONS=true

# Ver logs en tiempo real
railway logs --follow
```

## 📊 Monitoreo

### Métricas a Observar

1. **Performance:**
   - Tiempo de respuesta del endpoint `/conversations`
   - Número de queries ejecutados
   - Tamaño de snapshots

2. **Funcionalidad:**
   - Conversaciones devueltas vs esperadas
   - Errores de query
   - Logs de legacy fallback

3. **Datos:**
   - Campos faltantes en documentos
   - Inconsistencias en workspaceId/tenantId
   - Errores de mapeo

### Alertas Recomendadas

```javascript
// Ejemplo de alerta para queries legacy
if (source === 'legacy' && conversations.length > 0) {
  logger.warn('Legacy fallback activo', {
    conversationsCount: conversations.length,
    userEmail: req.user.email
  });
}
```

## 🚨 Troubleshooting

### Problema: "No conversations found"

**Causas posibles:**
1. `participants` array no contiene el email del usuario
2. `workspaceId`/`tenantId` no coinciden
3. Query falla por índices faltantes

**Soluciones:**
```bash
# 1. Verificar configuración
echo $TENANT_MODE $LEGACY_COMPAT

# 2. Habilitar logs detallados
export LOG_VERBOSE_CONVERSATIONS=true

# 3. Verificar índices en Firestore Console
```

### Problema: "Index building required"

**Solución:**
```bash
# Esperar 5-10 minutos para que se construyan los índices
# O usar query temporal sin ordenamiento
```

### Problema: "Migration failed"

**Verificar:**
1. Permisos de Firestore
2. Variables de entorno
3. Conectividad de red
4. Logs detallados

## 📝 Checklist de Despliegue

### Pre-Migración
- [ ] Backup de datos actuales
- [ ] Variables de entorno configuradas
- [ ] DRY-RUN ejecutado y revisado
- [ ] Equipo notificado

### Migración
- [ ] `MIGRATE_DRY_RUN=false`
- [ ] Script ejecutado exitosamente
- [ ] Reporte generado y revisado
- [ ] Verificación post-migración

### Post-Migración
- [ ] `TENANT_MODE=true`
- [ ] `LEGACY_COMPAT=true`
- [ ] Endpoint `/conversations` probado
- [ ] Logs monitoreados
- [ ] Performance verificada

### Desactivación Legacy (Futuro)
- [ ] 100% de docs con `workspaceId`/`tenantId`
- [ ] `LEGACY_COMPAT=false`
- [ ] Performance optimizada
- [ ] Documentación actualizada

## 📞 Soporte

### Contactos
- **Desarrollo:** Backend Team
- **DevOps:** Infrastructure Team
- **Producto:** Product Manager

### Recursos
- **Documentación:** Este README
- **Logs:** Railway Dashboard
- **Firestore:** Firebase Console
- **Monitoreo:** Métricas personalizadas

---

**Última actualización:** Agosto 2025
**Versión:** 1.0.0
**Autor:** Backend Team 