/**
 * UTILIDAD DE PAGINACIÓN BASADA EN CURSOR - UTalk Backend
 * 
 * Implementa paginación eficiente usando cursores de Firestore
 * Basado en: https://firebase.google.com/docs/firestore/query-data/query-cursors
 * y https://marckohler.medium.com/easy-pagination-with-firebase-sdk-7bcabb38bc93
 */

const logger = require('./logger');

/**
 * Opciones de paginación por defecto
 */
const DEFAULT_PAGINATION = {
  limit: 20,
  maxLimit: 100,
  defaultOrderBy: 'timestamp',
  defaultOrder: 'desc'
};

/**
 * Validar y sanitizar parámetros de paginación
 * @param {Object} params - Parámetros de paginación
 * @param {Object} options - Opciones de configuración
 * @returns {Object} - Parámetros sanitizados
 */
function validatePaginationParams(params = {}, options = {}) {
  const {
    limit = DEFAULT_PAGINATION.limit,
    maxLimit = DEFAULT_PAGINATION.maxLimit,
    defaultOrderBy = DEFAULT_PAGINATION.defaultOrderBy,
    defaultOrder = DEFAULT_PAGINATION.defaultOrder
  } = options;

  // Validar y sanitizar limit
  let sanitizedLimit = Math.max(1, parseInt(params.limit, 10) || limit);
  sanitizedLimit = Math.min(maxLimit, sanitizedLimit);

  // Validar orderBy
  const validOrderFields = ['timestamp', 'createdAt', 'updatedAt', 'lastMessageAt', 'messageCount'];
  const sanitizedOrderBy = validOrderFields.includes(params.orderBy) ? params.orderBy : defaultOrderBy;

  // Validar order
  const validOrders = ['asc', 'desc'];
  const sanitizedOrder = validOrders.includes(params.order) ? params.order : defaultOrder;

  // Validar cursor
  const cursor = params.cursor || null;
  const startAfter = params.startAfter || null;

  return {
    limit: sanitizedLimit,
    orderBy: sanitizedOrderBy,
    order: sanitizedOrder,
    cursor,
    startAfter,
    page: parseInt(params.page, 10) || 1
  };
}

/**
 * Construir query de Firestore con paginación
 * @param {Object} query - Query base de Firestore
 * @param {Object} paginationParams - Parámetros de paginación
 * @returns {Object} - Query con paginación aplicada
 */
function applyPaginationToQuery(query, paginationParams) {
  const { limit, orderBy, order, cursor, startAfter } = paginationParams;

  // Aplicar ordenamiento
  let paginatedQuery = query.orderBy(orderBy, order);

  // Aplicar cursor si existe
  if (cursor) {
    try {
      // Intentar parsear cursor como objeto
      const cursorData = typeof cursor === 'string' ? JSON.parse(cursor) : cursor;
      paginatedQuery = paginatedQuery.startAfter(cursorData);
    } catch (error) {
      logger.warn('Cursor inválido, ignorando', { cursor, error: error.message });
    }
  } else if (startAfter) {
    // Usar startAfter como fallback
    paginatedQuery = paginatedQuery.startAfter(startAfter);
  }

  // Aplicar límite
  paginatedQuery = paginatedQuery.limit(limit + 1); // +1 para detectar si hay más páginas

  return paginatedQuery;
}

/**
 * Procesar resultados de paginación
 * @param {Array} results - Resultados de la query
 * @param {Object} paginationParams - Parámetros de paginación
 * @returns {Object} - Resultados procesados con información de paginación
 */
function processPaginationResults(results, paginationParams) {
  const { limit } = paginationParams;
  
  // Verificar si hay más resultados
  const hasMore = results.length > limit;
  
  // Remover el elemento extra si existe
  const items = hasMore ? results.slice(0, limit) : results;
  
  // Generar cursor para la siguiente página
  let nextCursor = null;
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    try {
      nextCursor = JSON.stringify({
        [paginationParams.orderBy]: lastItem[paginationParams.orderBy],
        id: lastItem.id
      });
    } catch (error) {
      logger.warn('Error generando cursor', { error: error.message });
    }
  }

  return {
    items,
    pagination: {
      limit,
      hasMore,
      nextCursor,
      total: items.length,
      showing: items.length
    }
  };
}

/**
 * Generar respuesta de paginación estándar
 * @param {Array} items - Elementos de la página actual
 * @param {Object} pagination - Información de paginación
 * @param {Object} options - Opciones adicionales
 * @returns {Object} - Respuesta estándar
 */
function generatePaginationResponse(items, pagination, options = {}) {
  const {
    requestId = null,
    filters = {},
    executionTime = 0,
    errorOccurred = false
  } = options;

  return {
    items,
    pagination: {
      limit: pagination.limit,
      hasMore: pagination.hasMore,
      nextCursor: pagination.nextCursor,
      total: pagination.total,
      showing: pagination.showing
    },
    filters,
    meta: {
      executionTime,
      timestamp: new Date().toISOString(),
      requestId,
      errorOccurred
    }
  };
}

/**
 * Log detallado de paginación para debugging
 * @param {Object} params - Parámetros de paginación
 * @param {Object} results - Resultados procesados
 * @param {Object} options - Opciones de logging
 */
function logPaginationDetails(params, results, options = {}) {
  const {
    requestId = null,
    endpoint = 'unknown',
    filters = {},
    executionTime = 0
  } = options;

  logger.info(`[${endpoint.toUpperCase()} API] Paginación completada`, {
    requestId,
    pagination: {
      limit: params.limit,
      orderBy: params.orderBy,
      order: params.order,
      hasCursor: !!params.cursor,
      hasStartAfter: !!params.startAfter
    },
    results: {
      total: results.pagination.total,
      hasMore: results.pagination.hasMore,
      showing: results.pagination.showing,
      nextCursor: !!results.pagination.nextCursor
    },
    filters,
    performance: {
      executionTime,
      itemsPerSecond: executionTime > 0 ? Math.round(results.pagination.total / (executionTime / 1000)) : 0
    }
  });
}

/**
 * Validar y procesar cursor de entrada
 * @param {string|Object} cursor - Cursor de entrada
 * @returns {Object|null} - Cursor procesado o null
 */
function processInputCursor(cursor) {
  if (!cursor) return null;

  try {
    if (typeof cursor === 'string') {
      return JSON.parse(cursor);
    }
    return cursor;
  } catch (error) {
    logger.warn('Cursor inválido recibido', { cursor, error: error.message });
    return null;
  }
}

/**
 * Crear cursor para un documento específico
 * @param {Object} document - Documento de Firestore
 * @param {string} orderBy - Campo de ordenamiento
 * @returns {string} - Cursor serializado
 */
function createCursor(document, orderBy) {
  if (!document || !document[orderBy]) {
    return null;
  }

  try {
    return JSON.stringify({
      [orderBy]: document[orderBy],
      id: document.id
    });
  } catch (error) {
    logger.warn('Error creando cursor', { document, orderBy, error: error.message });
    return null;
  }
}

module.exports = {
  validatePaginationParams,
  applyPaginationToQuery,
  processPaginationResults,
  generatePaginationResponse,
  logPaginationDetails,
  processInputCursor,
  createCursor,
  DEFAULT_PAGINATION
};
