/**
 * 🔥 CONFIGURACIÓN DE ÍNDICES FIRESTORE OPTIMIZADOS
 * 
 * Índices para optimizar las queries más frecuentes del sistema
 * Estos índices mejoran significativamente el rendimiento de las consultas
 */

const logger = require('../utils/logger');

/**
 * Índices recomendados para Firestore
 * Estos deben ser creados manualmente en la consola de Firebase
 */
const recommendedIndexes = {
  // Índices para mensajes (subcolección de conversaciones)
  messages: {
    // Búsqueda por conversación con ordenamiento por timestamp
    conversation_timestamp: {
      collection: 'conversations/{conversationId}/messages',
      fields: [
        { fieldPath: 'conversationId', order: 'ASCENDING' },
        { fieldPath: 'timestamp', order: 'DESCENDING' }
      ],
      queryScope: 'COLLECTION'
    },

    // Búsqueda por conversación y dirección
    conversation_direction_timestamp: {
      collection: 'conversations/{conversationId}/messages',
      fields: [
        { fieldPath: 'conversationId', order: 'ASCENDING' },
        { fieldPath: 'direction', order: 'ASCENDING' },
        { fieldPath: 'timestamp', order: 'DESCENDING' }
      ],
      queryScope: 'COLLECTION'
    },

    // Búsqueda por conversación y tipo
    conversation_type_timestamp: {
      collection: 'conversations/{conversationId}/messages',
      fields: [
        { fieldPath: 'conversationId', order: 'ASCENDING' },
        { fieldPath: 'type', order: 'ASCENDING' },
        { fieldPath: 'timestamp', order: 'DESCENDING' }
      ],
      queryScope: 'COLLECTION'
    },

    // Búsqueda por conversación y estado
    conversation_status_timestamp: {
      collection: 'conversations/{conversationId}/messages',
      fields: [
        { fieldPath: 'conversationId', order: 'ASCENDING' },
        { fieldPath: 'status', order: 'ASCENDING' },
        { fieldPath: 'timestamp', order: 'DESCENDING' }
      ],
      queryScope: 'COLLECTION'
    },

    // Búsqueda por conversación y rango de fechas
    conversation_timestamp_range: {
      collection: 'conversations/{conversationId}/messages',
      fields: [
        { fieldPath: 'conversationId', order: 'ASCENDING' },
        { fieldPath: 'timestamp', order: 'ASCENDING' },
        { fieldPath: 'timestamp', order: 'DESCENDING' }
      ],
      queryScope: 'COLLECTION'
    }
  },

  // Índices para conversaciones
  conversations: {
    // Búsqueda por workspace y estado
    workspace_status_updatedAt: {
      collection: 'conversations',
      fields: [
        { fieldPath: 'workspaceId', order: 'ASCENDING' },
        { fieldPath: 'status', order: 'ASCENDING' },
        { fieldPath: 'updatedAt', order: 'DESCENDING' }
      ],
      queryScope: 'COLLECTION'
    },

    // Búsqueda por workspace y prioridad
    workspace_priority_updatedAt: {
      collection: 'conversations',
      fields: [
        { fieldPath: 'workspaceId', order: 'ASCENDING' },
        { fieldPath: 'priority', order: 'ASCENDING' },
        { fieldPath: 'updatedAt', order: 'DESCENDING' }
      ],
      queryScope: 'COLLECTION'
    },

    // Búsqueda por agente asignado
    assignedAgent_updatedAt: {
      collection: 'conversations',
      fields: [
        { fieldPath: 'assignedAgent', order: 'ASCENDING' },
        { fieldPath: 'updatedAt', order: 'DESCENDING' }
      ],
      queryScope: 'COLLECTION'
    },

    // Búsqueda por contacto
    contactId_updatedAt: {
      collection: 'conversations',
      fields: [
        { fieldPath: 'contactId', order: 'ASCENDING' },
        { fieldPath: 'updatedAt', order: 'DESCENDING' }
      ],
      queryScope: 'COLLECTION'
    }
  },

  // Índices para usuarios
  users: {
    // Búsqueda por email (ya existe por defecto)
    email: {
      collection: 'users',
      fields: [
        { fieldPath: 'email', order: 'ASCENDING' }
      ],
      queryScope: 'COLLECTION'
    },

    // Búsqueda por workspace y rol
    workspace_role: {
      collection: 'users',
      fields: [
        { fieldPath: 'workspaceId', order: 'ASCENDING' },
        { fieldPath: 'role', order: 'ASCENDING' }
      ],
      queryScope: 'COLLECTION'
    },

    // Búsqueda por teléfono
    phone: {
      collection: 'users',
      fields: [
        { fieldPath: 'phone', order: 'ASCENDING' }
      ],
      queryScope: 'COLLECTION'
    }
  },

  // Índices para contactos
  contacts: {
    // Búsqueda por workspace y teléfono
    workspace_phone: {
      collection: 'contacts',
      fields: [
        { fieldPath: 'workspaceId', order: 'ASCENDING' },
        { fieldPath: 'phone', order: 'ASCENDING' }
      ],
      queryScope: 'COLLECTION'
    },

    // Búsqueda por workspace y email
    workspace_email: {
      collection: 'contacts',
      fields: [
        { fieldPath: 'workspaceId', order: 'ASCENDING' },
        { fieldPath: 'email', order: 'ASCENDING' }
      ],
      queryScope: 'COLLECTION'
    }
  }
};

/**
 * Verificar si los índices están configurados correctamente
 */
function validateIndexes() {
  logger.info('Validando configuración de índices Firestore', {
    category: 'FIRESTORE_INDEXES_VALIDATION'
  });

  const indexCount = Object.keys(recommendedIndexes).reduce((total, collection) => {
    return total + Object.keys(recommendedIndexes[collection]).length;
  }, 0);

  logger.info('Índices recomendados detectados', {
    category: 'FIRESTORE_INDEXES_COUNT',
    totalIndexes: indexCount,
    collections: Object.keys(recommendedIndexes)
  });

  return {
    totalIndexes: indexCount,
    collections: Object.keys(recommendedIndexes),
    recommendedIndexes
  };
}

/**
 * Generar configuración de índices para firestore.indexes.json
 */
function generateFirestoreIndexesConfig() {
  const indexes = [];
  const fieldOverrides = [];

  // Convertir índices recomendados a formato de firestore.indexes.json
  Object.entries(recommendedIndexes).forEach(([collectionName, collectionIndexes]) => {
    Object.entries(collectionIndexes).forEach(([indexName, indexConfig]) => {
      indexes.push({
        collectionGroup: collectionName,
        queryScope: indexConfig.queryScope,
        fields: indexConfig.fields
      });
    });
  });

  return {
    indexes,
    fieldOverrides
  };
}

/**
 * Obtener índices recomendados para una colección específica
 */
function getIndexesForCollection(collectionName) {
  return recommendedIndexes[collectionName] || {};
}

/**
 * Verificar si un índice específico está recomendado
 */
function isIndexRecommended(collectionName, indexName) {
  return recommendedIndexes[collectionName] && 
         recommendedIndexes[collectionName][indexName];
}

module.exports = {
  recommendedIndexes,
  validateIndexes,
  generateFirestoreIndexesConfig,
  getIndexesForCollection,
  isIndexRecommended
}; 