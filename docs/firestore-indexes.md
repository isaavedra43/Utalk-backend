# Índices de Firestore Necesarios para UTalk Backend

## Introducción

Este documento especifica todos los índices compuestos de Firestore necesarios para el funcionamiento óptimo de UTalk Backend. Los índices son cruciales para el rendimiento de las queries, especialmente después de la migración a subcolecciones.

## Estado Actual

**Fecha de última verificación:** [ACTUALIZAR_FECHA]
**Status:** ⚠️ PENDIENTE VERIFICACIÓN Y CREACIÓN

## Índices Requeridos

### 1. Índices para Mensajes (Subcolección)

#### 1.1 Ordenamiento por timestamp (principal)
```
Collection: conversations/{conversationId}/messages
Fields:
  - timestamp (descending)
```

#### 1.2 Ordenamiento por createdAt (fallback)
```
Collection: conversations/{conversationId}/messages
Fields:
  - createdAt (descending)
```

#### 1.3 Búsqueda por usuario y timestamp
```
Collection: conversations/{conversationId}/messages
Fields:
  - userId (ascending)
  - timestamp (descending)
```

#### 1.4 Búsqueda por dirección y timestamp
```
Collection: conversations/{conversationId}/messages
Fields:
  - direction (ascending)
  - timestamp (descending)
```

#### 1.5 Búsqueda por estado y timestamp
```
Collection: conversations/{conversationId}/messages
Fields:
  - status (ascending)
  - timestamp (descending)
```

### 2. Índices para Conversaciones

#### 2.1 Ordenamiento por último mensaje (principal)
```
Collection: conversations
Fields:
  - lastMessageAt (descending)
```

#### 2.2 Filtro por agente asignado + ordenamiento
```
Collection: conversations
Fields:
  - assignedTo (ascending)
  - lastMessageAt (descending)
```

#### 2.3 Filtro por estado + ordenamiento
```
Collection: conversations
Fields:
  - status (ascending)
  - lastMessageAt (descending)
```

#### 2.4 Filtro por teléfono del cliente + ordenamiento
```
Collection: conversations
Fields:
  - customerPhone (ascending)
  - lastMessageAt (descending)
```

#### 2.5 Búsqueda por fecha de creación
```
Collection: conversations
Fields:
  - createdAt (descending)
```

#### 2.6 Filtro combinado: asignado + estado
```
Collection: conversations
Fields:
  - assignedTo (ascending)
  - status (ascending)
  - lastMessageAt (descending)
```

### 3. Índices para Estadísticas

#### 3.1 Mensajes por fecha para estadísticas
```
Collection: conversations/{conversationId}/messages
Fields:
  - timestamp (ascending)
  - direction (ascending)
```

#### 3.2 Mensajes por usuario en rango de fechas
```
Collection: conversations/{conversationId}/messages
Fields:
  - userId (ascending)
  - timestamp (ascending)
```

## Comandos para Crear Índices

### Usando Firebase CLI

```bash
# Navegar al proyecto
cd /path/to/utalk-backend

# Crear firebase.indexes.json (si no existe)
firebase init firestore

# Agregar los índices al archivo firebase.indexes.json
# (Ver configuración JSON abajo)

# Deployar índices
firebase deploy --only firestore:indexes
```

### Configuración JSON (firebase.indexes.json)

```json
{
  "indexes": [
    {
      "collectionGroup": "messages",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "timestamp",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "messages",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "messages",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "timestamp",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "messages",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "direction",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "timestamp",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "messages",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "timestamp",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "conversations",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "assignedTo",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "lastMessageAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "conversations",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "lastMessageAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "conversations",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "customerPhone",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "lastMessageAt",
          "order": "DESCENDING"
        }
      ]
    }
  ]
}
```

## Verificación de Índices

### Script de Verificación

Crear `scripts/verify-firestore-indexes.js`:

```javascript
/**
 * Script para verificar que todos los índices necesarios estén creados
 */
const admin = require('firebase-admin');

async function verifyIndexes() {
  const queries = [
    // Test timestamp ordering
    {
      name: 'Messages by timestamp',
      query: () => db.collectionGroup('messages')
        .orderBy('timestamp', 'desc')
        .limit(1)
    },
    
    // Test createdAt fallback
    {
      name: 'Messages by createdAt',
      query: () => db.collectionGroup('messages')
        .orderBy('createdAt', 'desc')
        .limit(1)
    },
    
    // Test conversation filtering
    {
      name: 'Conversations by assignedTo',
      query: () => db.collection('conversations')
        .where('assignedTo', '==', 'test_user')
        .orderBy('lastMessageAt', 'desc')
        .limit(1)
    }
  ];

  for (const test of queries) {
    try {
      await test.query().get();
      console.log(`✅ ${test.name}: OK`);
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR - ${error.message}`);
    }
  }
}
```

## Monitoreo de Performance

### 1. Métricas a Vigilar
- Tiempo de respuesta de queries de mensajes
- Tiempo de respuesta de listado de conversaciones
- Uso de lectura de documentos

### 2. Alertas Recomendadas
- Query que toma > 2 segundos
- Más de 100 lecturas de documentos en una sola query
- Fallos de query por índices faltantes

## Mantenimiento

### 1. Revisión Periódica
- **Mensual:** Verificar performance de queries críticas
- **Trimestral:** Revisar si se necesitan nuevos índices
- **Anual:** Limpiar índices no utilizados

### 2. Cuando Agregar Nuevos Índices
- Al agregar nuevos filtros a las queries
- Al cambiar el ordenamiento por defecto
- Cuando una query toma > 2 segundos consistentemente

## Notas Importantes

1. **Costo:** Cada índice adicional incrementa el costo de escritura
2. **Tiempo de Creación:** Índices en colecciones grandes pueden tomar horas
3. **Límites:** Firestore tiene límites en el número de índices por proyecto
4. **Testing:** Siempre probar en ambiente de desarrollo primero

## Estado de Implementación

- [ ] Verificar índices existentes en consola de Firebase
- [ ] Crear firebase.indexes.json
- [ ] Deployar índices necesarios
- [ ] Ejecutar script de verificación
- [ ] Documentar tiempos de creación
- [ ] Configurar monitoreo de performance

---

**Última actualización:** [FECHA]
**Responsable:** Equipo de Backend
**Próxima revisión:** [FECHA + 1 MES] 