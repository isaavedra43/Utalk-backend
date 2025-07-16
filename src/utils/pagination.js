/**
 * Utilidades para paginación optimizada en Firestore
 */

class PaginationHelper {
  /**
   * Crear query paginada para Firestore
   * @param {Object} collection - Referencia a colección de Firestore
   * @param {Object} options - Opciones de paginación
   * @returns {Object} Query configurada y metadatos
   */
  static async createPaginatedQuery(collection, options = {}) {
    const {
      limit = 20,
      startAfter = null,
      orderBy = 'createdAt',
      order = 'desc',
      filters = [],
      maxLimit = 100
    } = options;

    // Validar límite
    const validLimit = Math.min(Math.max(1, parseInt(limit)), maxLimit);

    // Construir query base
    let query = collection;

    // Aplicar filtros
    filters.forEach(filter => {
      if (filter.field && filter.operator && filter.value !== undefined) {
        query = query.where(filter.field, filter.operator, filter.value);
      }
    });

    // Aplicar ordenamiento
    query = query.orderBy(orderBy, order);

    // Aplicar paginación
    if (startAfter) {
      // Para paginación por cursor
      if (typeof startAfter === 'string') {
        // Si es ID de documento
        const startAfterDoc = await collection.doc(startAfter).get();
        if (startAfterDoc.exists) {
          query = query.startAfter(startAfterDoc);
        }
      } else {
        // Si es valor del campo de ordenamiento
        query = query.startAfter(startAfter);
      }
    }

    // Aplicar límite (+1 para saber si hay más páginas)
    query = query.limit(validLimit + 1);

    return {
      query,
      expectedLimit: validLimit,
      orderBy,
      order
    };
  }

  /**
   * Procesar resultados de query paginada
   * @param {Object} querySnapshot - Snapshot de Firestore
   * @param {number} expectedLimit - Límite esperado
   * @param {Function} mapFunction - Función para mapear documentos
   * @returns {Object} Resultados procesados con metadata de paginación
   */
  static processQueryResults(querySnapshot, expectedLimit, mapFunction = null) {
    const docs = querySnapshot.docs;
    const hasMore = docs.length > expectedLimit;
    
    // Remover el documento extra si existe
    const actualDocs = hasMore ? docs.slice(0, expectedLimit) : docs;
    
    // Mapear documentos
    const results = actualDocs.map(doc => {
      const data = { id: doc.id, ...doc.data() };
      return mapFunction ? mapFunction(data) : data;
    });

    // Obtener cursor para siguiente página
    const nextPageCursor = hasMore && actualDocs.length > 0 
      ? actualDocs[actualDocs.length - 1].id 
      : null;

    return {
      results,
      pagination: {
        hasMore,
        nextPageCursor,
        count: results.length,
        requestedLimit: expectedLimit
      }
    };
  }

  /**
   * Crear respuesta paginada estándar
   * @param {Array} results - Resultados
   * @param {Object} pagination - Metadata de paginación
   * @param {Object} additionalMeta - Metadata adicional
   * @returns {Object} Respuesta formateada
   */
  static createPaginatedResponse(results, pagination, additionalMeta = {}) {
    return {
      data: results,
      pagination: {
        count: results.length,
        hasMore: pagination.hasMore,
        nextPageCursor: pagination.nextPageCursor,
        ...additionalMeta
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validar parámetros de paginación
   * @param {Object} queryParams - Parámetros de query
   * @returns {Object} Parámetros validados
   */
  static validatePaginationParams(queryParams) {
    const {
      limit = 20,
      cursor = null,
      orderBy = 'createdAt',
      order = 'desc',
      page = 1
    } = queryParams;

    return {
      limit: Math.min(Math.max(1, parseInt(limit) || 20), 100),
      cursor,
      orderBy: this.validateOrderByField(orderBy),
      order: ['asc', 'desc'].includes(order) ? order : 'desc',
      page: Math.max(1, parseInt(page) || 1)
    };
  }

  /**
   * Validar campo de ordenamiento
   * @param {string} field - Campo a validar
   * @returns {string} Campo validado
   */
  static validateOrderByField(field) {
    const allowedFields = [
      'createdAt', 'updatedAt', 'timestamp', 'lastMessageAt',
      'messageCount', 'name', 'phone', 'email', 'status'
    ];
    
    return allowedFields.includes(field) ? field : 'createdAt';
  }

  /**
   * Crear filtros para queries complejas
   * @param {Object} filters - Filtros raw
   * @returns {Array} Filtros validados
   */
  static createFilters(filters) {
    const validFilters = [];

    if (filters.status) {
      validFilters.push({
        field: 'status',
        operator: '==',
        value: filters.status
      });
    }

    if (filters.userId) {
      validFilters.push({
        field: 'userId',
        operator: '==',
        value: filters.userId
      });
    }

    if (filters.assignedTo) {
      validFilters.push({
        field: 'assignedTo',
        operator: '==',
        value: filters.assignedTo
      });
    }

    if (filters.isActive !== undefined) {
      validFilters.push({
        field: 'isActive',
        operator: '==',
        value: filters.isActive === 'true' || filters.isActive === true
      });
    }

    if (filters.type) {
      validFilters.push({
        field: 'type',
        operator: '==',
        value: filters.type
      });
    }

    if (filters.direction) {
      validFilters.push({
        field: 'direction',
        operator: '==',
        value: filters.direction
      });
    }

    // Filtros de fecha
    if (filters.startDate) {
      try {
        const startDate = new Date(filters.startDate);
        validFilters.push({
          field: 'createdAt',
          operator: '>=',
          value: startDate
        });
      } catch (error) {
        // Ignorar fecha inválida
      }
    }

    if (filters.endDate) {
      try {
        const endDate = new Date(filters.endDate);
        validFilters.push({
          field: 'createdAt',
          operator: '<=',
          value: endDate
        });
      } catch (error) {
        // Ignorar fecha inválida
      }
    }

    return validFilters;
  }

  /**
   * Optimizar query para múltiples filtros
   * @param {Object} baseQuery - Query base
   * @param {Array} filters - Filtros a aplicar
   * @returns {Object} Query optimizada
   */
  static optimizeQueryForFilters(baseQuery, filters) {
    // Ordenar filtros por selectividad (más selectivos primero)
    const sortedFilters = filters.sort((a, b) => {
      const selectivityOrder = {
        '==': 1,
        '!=': 2,
        'in': 3,
        'not-in': 4,
        '<': 5,
        '<=': 6,
        '>': 7,
        '>=': 8,
        'array-contains': 9,
        'array-contains-any': 10
      };

      return (selectivityOrder[a.operator] || 99) - (selectivityOrder[b.operator] || 99);
    });

    // Aplicar filtros ordenados
    let optimizedQuery = baseQuery;
    sortedFilters.forEach(filter => {
      optimizedQuery = optimizedQuery.where(filter.field, filter.operator, filter.value);
    });

    return optimizedQuery;
  }

  /**
   * Crear metadata de performance para logging
   * @param {number} startTime - Timestamp de inicio
   * @param {number} resultCount - Número de resultados
   * @param {Array} filters - Filtros aplicados
   * @returns {Object} Metadata de performance
   */
  static createPerformanceMetadata(startTime, resultCount, filters = []) {
    return {
      executionTime: Date.now() - startTime,
      resultCount,
      filtersApplied: filters.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Crear índices recomendados para una query
   * @param {string} collection - Nombre de colección
   * @param {Array} filters - Filtros
   * @param {string} orderBy - Campo de ordenamiento
   * @returns {Object} Recomendaciones de índices
   */
  static getIndexRecommendations(collection, filters, orderBy) {
    const filterFields = filters.map(f => f.field);
    const uniqueFields = [...new Set(filterFields)];

    // Crear recomendación de índice compuesto
    const indexFields = [];
    
    // Agregar campos de igualdad primero
    filters.forEach(filter => {
      if (filter.operator === '==' && !indexFields.includes(filter.field)) {
        indexFields.push(filter.field);
      }
    });

    // Agregar campo de ordenamiento si no está incluido
    if (!indexFields.includes(orderBy)) {
      indexFields.push(orderBy);
    }

    return {
      collection,
      recommendedIndex: {
        fields: indexFields,
        type: 'composite'
      },
      singleFieldIndexes: uniqueFields.map(field => ({
        field,
        type: 'ascending'
      }))
    };
  }
}

module.exports = PaginationHelper; 