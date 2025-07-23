# 🔥 **ÍNDICES REQUERIDOS EN FIRESTORE - UTalk Backend**

## **🎯 OBJETIVO**

Documentar todos los índices requeridos en Firestore para optimizar las queries del sistema UTalk y asegurar performance óptima.

## **📋 ÍNDICES CRÍTICOS REQUERIDOS**

### **1. COLECCIÓN: `conversations`**

#### **1.1. Índice para Filtro por Agente Asignado**
```javascript
// ✅ REQUERIDO: Filtro por assignedTo
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
}
```

#### **1.2. Índice para Filtro por Estado**
```javascript
// ✅ REQUERIDO: Filtro por status
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
}
```

#### **1.3. Índice para Filtro por Teléfono del Cliente**
```javascript
// ✅ REQUERIDO: Filtro por customerPhone
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
```

#### **1.4. Índice Compuesto para Múltiples Filtros**
```javascript
// ✅ REQUERIDO: Filtro por assignedTo + status
{
  "collectionGroup": "conversations",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "assignedTo",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "status",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "lastMessageAt",
      "order": "DESCENDING"
    }
  ]
}
```

#### **1.5. Índice para Búsqueda de Texto**
```javascript
// ✅ REQUERIDO: Búsqueda por contenido
{
  "collectionGroup": "conversations",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "lastMessage",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "lastMessageAt",
      "order": "DESCENDING"
    }
  ]
}
```

### **2. COLECCIÓN: `messages` (Subcolección)**

#### **2.1. Índice para Ordenamiento por Timestamp**
```javascript
// ✅ REQUERIDO: Ordenamiento por timestamp
{
  "collectionGroup": "messages",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    {
      "fieldPath": "timestamp",
      "order": "DESCENDING"
    }
  ]
}
```

#### **2.2. Índice para Filtro por Dirección**
```javascript
// ✅ REQUERIDO: Filtro por direction
{
  "collectionGroup": "messages",
  "queryScope": "COLLECTION_GROUP",
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
}
```

#### **2.3. Índice para Filtro por Tipo**
```javascript
// ✅ REQUERIDO: Filtro por type
{
  "collectionGroup": "messages",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    {
      "fieldPath": "type",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "timestamp",
      "order": "DESCENDING"
    }
  ]
}
```

#### **2.4. Índice para Filtro por Usuario**
```javascript
// ✅ REQUERIDO: Filtro por userId
{
  "collectionGroup": "messages",
  "queryScope": "COLLECTION_GROUP",
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
}
```

### **3. COLECCIÓN: `users`**

#### **3.1. Índice para Filtro por Rol**
```javascript
// ✅ REQUERIDO: Filtro por role
{
  "collectionGroup": "users",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "role",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "createdAt",
      "order": "DESCENDING"
    }
  ]
}
```

### **4. COLECCIÓN: `contacts`**

#### **4.1. Índice para Filtro por Teléfono**
```javascript
// ✅ REQUERIDO: Filtro por phone
{
  "collectionGroup": "contacts",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "phone",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "createdAt",
      "order": "DESCENDING"
    }
  ]
}
```

## **🚀 COMANDOS PARA CREAR ÍNDICES**

### **Usando Firebase CLI:**

```bash
# 1. Índices para conversations
firebase firestore:indexes --project=utalk-backend

# 2. Crear índices específicos
firebase firestore:indexes:create --project=utalk-backend --collection=conversations --fields=assignedTo,lastMessageAt

# 3. Verificar estado de índices
firebase firestore:indexes:list --project=utalk-backend
```

### **Usando Google Cloud Console:**

1. Ir a [Firebase Console](https://console.firebase.google.com)
2. Seleccionar proyecto UTalk
3. Ir a Firestore Database > Índices
4. Crear índices manualmente según la documentación anterior

## **📊 MONITOREO DE PERFORMANCE**

### **Métricas a Monitorear:**

```javascript
// ✅ LOGS DE PERFORMANCE
logger.info('[QUERY PERFORMANCE]', {
  collection: 'conversations',
  filters: { assignedTo: 'user123', status: 'open' },
  executionTime: 150, // ms
  documentsRead: 25,
  indexUsed: 'assignedTo_status_lastMessageAt',
  hasMore: true
});
```

### **Alertas Recomendadas:**

1. **Query sin índice**: > 1000ms
2. **Query con índice**: > 500ms
3. **Documentos leídos**: > 1000 por query
4. **Índices faltantes**: Cualquier error de índice

## **🔧 CONFIGURACIÓN DE ÍNDICES EN CÓDIGO**

### **Verificación de Índices:**

```javascript
// ✅ VERIFICAR ÍNDICES ANTES DE QUERIES CRÍTICAS
async function verifyIndexes() {
  try {
    // Test query que requiere índice
    const testQuery = firestore.collection('conversations')
      .where('assignedTo', '==', 'test')
      .where('status', '==', 'open')
      .orderBy('lastMessageAt', 'desc')
      .limit(1);
    
    await testQuery.get();
    logger.info('Índices verificados correctamente');
  } catch (error) {
    if (error.code === 'failed-precondition') {
      logger.error('Índices faltantes detectados', { error: error.message });
      // Notificar al equipo de desarrollo
    }
  }
}
```

### **Fallbacks para Índices Faltantes:**

```javascript
// ✅ FALLBACK: Query simplificada si falta índice
async function getConversationsWithFallback(filters) {
  try {
    // Intentar query completa
    return await Conversation.list(filters);
  } catch (error) {
    if (error.code === 'failed-precondition') {
      logger.warn('Índice faltante, usando fallback', { filters });
      // Query simplificada sin filtros complejos
      return await Conversation.list({ limit: 20 });
    }
    throw error;
  }
}
```

## **📋 CHECKLIST DE IMPLEMENTACIÓN**

### **✅ Índices Críticos (Requeridos para Producción):**

- [ ] `conversations.assignedTo_lastMessageAt`
- [ ] `conversations.status_lastMessageAt`
- [ ] `conversations.customerPhone_lastMessageAt`
- [ ] `conversations.assignedTo_status_lastMessageAt`
- [ ] `messages.timestamp` (Collection Group)
- [ ] `messages.direction_timestamp` (Collection Group)
- [ ] `messages.type_timestamp` (Collection Group)
- [ ] `messages.userId_timestamp` (Collection Group)
- [ ] `users.role_createdAt`
- [ ] `contacts.phone_createdAt`

### **✅ Índices Opcionales (Para Optimización):**

- [ ] `conversations.lastMessage_lastMessageAt`
- [ ] `conversations.createdAt`
- [ ] `conversations.updatedAt`
- [ ] `messages.status_timestamp` (Collection Group)
- [ ] `messages.from_timestamp` (Collection Group)
- [ ] `messages.to_timestamp` (Collection Group)

## **🚨 TROUBLESHOOTING**

### **Error: "The query requires an index"**

**Solución:**
1. Verificar que el índice existe en Firebase Console
2. Esperar a que el índice se construya (puede tomar minutos)
3. Usar fallback temporal mientras se construye el índice

### **Error: "Index not ready"**

**Solución:**
1. Verificar estado del índice en Firebase Console
2. Esperar a que termine la construcción
3. Usar query simplificada temporalmente

### **Performance Lenta**

**Solución:**
1. Verificar que se están usando los índices correctos
2. Optimizar queries para usar menos filtros
3. Implementar paginación cursor-based
4. Usar `limit()` en todas las queries

## **📈 BENCHMARKS ESPERADOS**

### **Con Índices Optimizados:**

- **Query de conversaciones**: < 200ms
- **Query de mensajes**: < 100ms
- **Paginación**: < 50ms por página
- **Búsqueda**: < 300ms

### **Sin Índices (Fallback):**

- **Query de conversaciones**: < 1000ms
- **Query de mensajes**: < 500ms
- **Paginación**: < 200ms por página
- **Búsqueda**: < 2000ms

---

**✅ DOCUMENTACIÓN COMPLETADA** - Todos los índices requeridos documentados para optimizar el performance del sistema UTalk. 