# 🔍 ÍNDICES DE FIRESTORE - GUÍA DE DESPLIEGUE

## 📋 Descripción

Esta guía describe cómo desplegar y verificar los índices compuestos necesarios para optimizar las consultas del listado de conversaciones.

## 🎯 Qué Resuelven Estos Índices

Los índices implementados optimizan las siguientes consultas del `ConversationsRepository.list`:

### Índices Obligatorios

1. **`workspaceId + lastMessageAt`**
   - Consulta: `where('workspaceId', '==', workspaceId).orderBy('lastMessageAt', 'desc')`
   - Uso: Listado básico de conversaciones por workspace

2. **`workspaceId + status + lastMessageAt`**
   - Consulta: `where('workspaceId', '==', workspaceId).where('status', '==', status).orderBy('lastMessageAt', 'desc')`
   - Uso: Filtro por estado (open, closed, archived)

3. **`participants + lastMessageAt`**
   - Consulta: `where('participants', 'array-contains', userEmail).orderBy('lastMessageAt', 'desc')`
   - Uso: Conversaciones donde el usuario es participante

### Índices Opcionales

4. **`workspaceId + assignedTo + lastMessageAt`**
   - Consulta: `where('workspaceId', '==', workspaceId).where('assignedTo', '==', agentEmail).orderBy('lastMessageAt', 'desc')`
   - Uso: Conversaciones asignadas a un agente específico

5. **`workspaceId + priority + lastMessageAt`**
   - Consulta: `where('workspaceId', '==', workspaceId).where('priority', '==', priority).orderBy('lastMessageAt', 'desc')`
   - Uso: Filtro por prioridad (normal, high, urgent)

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

### Despliegue de Índices

```bash
# Desplegar solo índices (sin tocar reglas ni datos)
firebase deploy --only firestore:indexes
```

### Verificación del Despliegue

1. **En Firebase Console:**
   - Ir a Firestore Database → Índices → Compuestos
   - Verificar que todos los índices aparecen con estado "Ready"

2. **En logs de despliegue:**
   ```bash
   # Debería mostrar algo como:
   # ✔  firestore: indexes uploaded successfully
   ```

## ⏱️ Tiempo de Construcción

- **Duración:** 5-15 minutos (depende del tamaño de la colección)
- **Downtime:** Ninguno - las consultas siguen funcionando
- **Estado:** "In build" → "Ready"

## 🔧 Resolución de Problemas

### Error: "Index required"

Si aparece un error como:
```
FAILED_PRECONDITION: The query requires an index for collection conversations
```

**Solución:**

1. **Copiar la sugerencia de Firebase Console:**
   - Ir a Firestore → Índices → Compuestos
   - Buscar la sugerencia automática generada

2. **Agregar al `firestore.indexes.json`:**
   ```json
   {
     "collectionGroup": "conversations",
     "queryScope": "COLLECTION",
     "fields": [
       { "fieldPath": "workspaceId", "order": "ASCENDING" },
       { "fieldPath": "status", "order": "ASCENDING" },
       { "fieldPath": "lastMessageAt", "order": "DESCENDING" }
     ]
   }
   ```

3. **Redesplegar:**
   ```bash
   firebase deploy --only firestore:indexes
   ```

### Error: "Permission denied"

**Solución:**
```bash
# Verificar permisos
firebase projects:list

# Reautenticar si es necesario
firebase logout
firebase login
```

### Error: "Project not found"

**Solución:**
```bash
# Listar proyectos disponibles
firebase projects:list

# Seleccionar proyecto correcto
firebase use <projectId>
```

## 📊 Monitoreo

### Verificar Performance

1. **En Firebase Console:**
   - Firestore → Uso → Consultas
   - Verificar que no hay consultas sin índice

2. **En logs de aplicación:**
   ```bash
   # Buscar errores de índice
   grep "index required" /var/log/your-app.log
   ```

### Métricas a Observar

- **Tiempo de respuesta:** Consultas del listado
- **Errores de índice:** Frecuencia de "index required"
- **Uso de índices:** En Firebase Console → Uso

## 🔒 Buenas Prácticas

### Optimización de Índices

1. **No indexar campos voluminosos:**
   - `lastMessage.content` (desindexado)
   - `metadata` (desindexado)

2. **Usar `lastMessageAt` como campo canónico:**
   - No ordenar por `updatedAt` a menos que cambie la lógica
   - Mantener consistencia en el modelo

3. **Revisar consultas nuevas:**
   - Monitorear logs con "index required"
   - Agregar índices solo cuando sea necesario

### Seguridad

1. **No incluir PII en nombres de campos**
2. **Revisar índices periódicamente**
3. **Documentar cambios en índices**

## 🛠️ Comandos Útiles

### Verificar Estado de Índices

```bash
# Listar índices actuales
firebase firestore:indexes

# Ver detalles de un índice específico
firebase firestore:indexes:list
```

### Limpiar Índices No Utilizados

```bash
# Ver índices no utilizados (cuidado)
firebase firestore:indexes:list --unused
```

### Backup de Configuración

```bash
# Exportar configuración actual
firebase firestore:indexes:export firestore-indexes-backup.json
```

## 📞 Soporte

### Para Problemas Técnicos

1. **Revisar logs de despliegue**
2. **Verificar permisos de proyecto**
3. **Consultar Firebase Console**
4. **Contactar equipo de backend**

### Recursos Adicionales

- [Firestore Indexes Documentation](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Performance Best Practices](https://firebase.google.com/docs/firestore/best-practices)

---

**Versión:** 1.0.0  
**Última actualización:** Agosto 2025  
**Autor:** Backend Team 