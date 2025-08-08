# ADR-001: Repositorio Unificado de Conversaciones

## 📋 Información

- **Fecha:** Agosto 2025
- **Estado:** Aceptado
- **Decisor:** Backend Team
- **Participantes:** Senior Backend Architect, Team Lead, Product Manager

## 🎯 Contexto

El endpoint `/api/conversations` devuelve resultados vacíos aunque existen conversaciones en Firestore. El problema radica en que:

1. **Filtros incompatibles:** El query filtra por `participants` array-contains `userEmail`, pero los documentos existentes no contienen este campo
2. **Estructura inconsistente:** Los documentos legacy no tienen `workspaceId`/`tenantId` requeridos para multi-tenancy
3. **Falta de compatibilidad:** No hay mecanismo para manejar documentos legacy durante la transición

## 🚨 Problema

- **Frontend no puede mostrar conversaciones** debido a queries que devuelven 0 resultados
- **Imposibilidad de migración gradual** sin romper funcionalidad existente
- **Falta de estandarización** en el acceso a datos de conversaciones

## 💡 Solución Propuesta

### A) Repositorio Unificado `ConversationsRepository`

**Características:**
- **Singleton pattern** para acceso centralizado
- **Query builder** con soporte para tenant y legacy
- **Compatibilidad retroactiva** con flags de configuración
- **Logging detallado** para diagnóstico

**Firma del método principal:**
```typescript
async list({
  workspaceId?: string,
  tenantId?: string,
  filters?: {
    status?: string,
    assignedTo?: string,
    search?: string
  },
  pagination?: {
    limit?: number,
    cursor?: string
  }
}): Promise<{
  conversations: ConversationVM[],
  hasNext: boolean,
  nextCursor: string | null,
  debug?: object
}>
```

### B) ViewModel Canónico `ConversationVM`

**Campos estándar:**
- `id`: Identificador único (derivado de `doc.id`)
- `customerPhone`: Teléfono del cliente
- `lastMessage`: Detalles del último mensaje
- `status`: Estado de la conversación
- `workspaceId`/`tenantId`: Campos opcionales para multi-tenancy
- `participants`: Array de participantes (opcional)

**Defaults seguros:**
- `unreadCount: 0` si falta
- `status: 'open'` si falta
- `lastMessageAt` derivado de `lastMessage.timestamp`

### C) Flags de Configuración

```bash
# Modo tenant (filtros por workspaceId/tenantId)
TENANT_MODE=true|false

# Compatibilidad legacy (fallback sin filtros tenant)
LEGACY_COMPAT=true|false

# Ruta de colección
CONVERSATIONS_COLLECTION_PATH=conversations

# Logs detallados
LOG_VERBOSE_CONVERSATIONS=true|false
```

### D) Migración Idempotente

**Script:** `scripts/migrate_conversations_v1.js`

**Campos migrados:**
- `workspaceId`/`tenantId`: Inferidos desde configuración o lógica
- `status`: Default `'open'`
- `unreadCount`: Default `0`
- `participants`: Inferidos desde `customerPhone` y `assignedTo`

**Seguridad:**
- **DRY-RUN por defecto** (`MIGRATE_DRY_RUN=true`)
- **Procesamiento en lotes** (`MIGRATION_BATCH_SIZE=200`)
- **Reportes detallados** (JSON + CSV)

## 🔄 Flujo de Implementación

### Fase 1: Compatibilidad Legacy
```bash
TENANT_MODE=false
LEGACY_COMPAT=true
```
- Query sin filtros tenant
- Mantiene funcionalidad existente

### Fase 2: Tenant Mode con Legacy
```bash
TENANT_MODE=true
LEGACY_COMPAT=true
```
- Query tenant-first, legacy fallback
- Migración gradual de datos

### Fase 3: Tenant Mode Puro
```bash
TENANT_MODE=true
LEGACY_COMPAT=false
```
- Solo queries tenant
- Optimización de performance

## ✅ Criterios de Aceptación

### Funcionalidad
- [ ] `/conversations` devuelve conversaciones en los 3 escenarios
- [ ] Contrato HTTP intacto (`{ success, data, message }`)
- [ ] Sin descartes por falta de `workspaceId` durante migración
- [ ] Logs detallados para diagnóstico

### Performance
- [ ] Tiempo de respuesta < 500ms para queries normales
- [ ] Fallback legacy < 1s para datasets grandes
- [ ] Logs solo cuando `LOG_VERBOSE_CONVERSATIONS=true`

### Seguridad
- [ ] Migración idempotente (puede ejecutarse múltiples veces)
- [ ] DRY-RUN por defecto
- [ ] Rollback plan documentado

## 🚨 Alternativas Consideradas

### A) Parche Rápido (Rechazado)
```javascript
// Quitar filtro participants temporalmente
query = query.where('participants', 'array-contains', userEmail);
```
**Problemas:** No resuelve el problema de fondo, rompe multi-tenancy

### B) Migración Forzada (Rechazado)
```javascript
// Forzar todos los docs a tener workspaceId
```
**Problemas:** Riesgo de pérdida de datos, downtime

### C) Nuevo Endpoint (Rechazado)
```javascript
// GET /api/conversations/v2
```
**Problemas:** Duplicación de código, confusión en frontend

## 📊 Impacto

### Positivo
- ✅ **Solución definitiva** al problema de listado vacío
- ✅ **Compatibilidad retroactiva** sin downtime
- ✅ **Estandarización** del acceso a datos
- ✅ **Soporte multi-tenant** preparado
- ✅ **Observabilidad** mejorada con logs detallados

### Riesgos
- ⚠️ **Complejidad inicial** en configuración de flags
- ⚠️ **Performance** temporal durante legacy fallback
- ⚠️ **Dependencia** de migración exitosa

### Mitigaciones
- 📋 **Documentación completa** con README_migration.md
- 🔧 **Scripts automatizados** para migración
- 📊 **Monitoreo detallado** con logs y métricas
- 🛠️ **Rollback plan** documentado

## 🔧 Implementación

### Archivos Creados/Modificados

**Nuevos:**
- `src/repositories/ConversationsRepository.js`
- `scripts/migrate_conversations_v1.js`
- `README_migration.md`
- `docs/ADR_conversations.md`

**Modificados:**
- `src/controllers/ConversationController.js` (refactorizado para usar repo)

### Variables de Entorno

```bash
# Repositorio
TENANT_MODE=true|false
LEGACY_COMPAT=true|false
CONVERSATIONS_COLLECTION_PATH=conversations
LOG_VERBOSE_CONVERSATIONS=true|false

# Migración
MIGRATE_DRY_RUN=true|false
MIGRATION_BATCH_SIZE=200
DEFAULT_WORKSPACE_ID=default
DEFAULT_TENANT_ID=default
```

## 📈 Métricas de Éxito

### Técnicas
- **Conversaciones devueltas:** > 0 en todos los escenarios
- **Tiempo de respuesta:** < 500ms promedio
- **Errores de query:** < 1% de requests
- **Logs legacy fallback:** < 10% de requests

### Negocio
- **Frontend funcional:** Usuarios pueden ver conversaciones
- **Downtime:** 0 durante migración
- **Adopción:** 100% de conversaciones migradas en 1 semana

## 🔄 Revisión y Mantenimiento

### Revisión Programada
- **1 semana:** Verificar métricas de performance
- **1 mes:** Evaluar necesidad de optimizaciones
- **3 meses:** Planificar desactivación de `LEGACY_COMPAT`

### Criterios de Desactivación Legacy
- [ ] 100% de documentos con `workspaceId`/`tenantId`
- [ ] Performance estable sin fallback
- [ ] Logs de legacy fallback < 1%

## 📞 Referencias

- **Documentación:** README_migration.md
- **Scripts:** scripts/migrate_conversations_v1.js
- **Código:** src/repositories/ConversationsRepository.js
- **Logs:** Railway Dashboard

---

**Aprobado por:** Backend Team
**Fecha de aprobación:** Agosto 2025
**Próxima revisión:** Septiembre 2025 