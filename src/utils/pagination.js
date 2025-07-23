/**
 * UTILIDAD DE PAGINACIÓN BASADA EN CURSOR - UTalk Backend
 *
 * Implementa paginación eficiente usando cursores de Firestore
 * Basado en: https://firebase.google.com/docs/firestore/query-data/query-cursors
 */

const logger = require('./logger');

/**
 * Crear cursor para paginación
 * @param {Object} params - Parámetros del cursor
 * @returns {string} - Cursor codificado en base64
 */
function createCursor (params) {
  try {
    const cursorData = {
      conversationId: params.conversationId,
      documentSnapshot: params.documentSnapshot,
      timestamp: params.timestamp,
      createdAt: new Date().toISOString(),
    };

    const cursorString = JSON.stringify(cursorData);
    return Buffer.from(cursorString).toString('base64');
  } catch (error) {
    logger.error('Error creando cursor', { error: error.message, params });
    return null;
  }
}

/**
 * Parsear cursor para paginación
 * @param {string} cursor - Cursor codificado en base64
 * @returns {Object|null} - Datos del cursor o null si inválido
 */
function parseCursor (cursor) {
  try {
    if (!cursor || typeof cursor !== 'string') {
      return null;
    }

    const cursorString = Buffer.from(cursor, 'base64').toString();
    const cursorData = JSON.parse(cursorString);

    // Validar estructura del cursor
    if (!cursorData.conversationId || !cursorData.documentSnapshot) {
      logger.warn('Cursor inválido - faltan campos requeridos', { cursor });
      return null;
    }

    return cursorData;
  } catch (error) {
    logger.error('Error parseando cursor', { error: error.message, cursor });
    return null;
  }
}

/**
 * Validar parámetros de paginación
 * @param {Object} options - Opciones de paginación
 * @param {Object} defaults - Valores por defecto
 * @returns {Object} - Parámetros validados
 */
function validatePaginationParams (options, defaults = {}) {
  const {
    limit = 20,
    maxLimit = 100,
    defaultOrderBy = 'timestamp',
    defaultOrder = 'desc',
  } = defaults;

  // Validar límite
  let validatedLimit = parseInt(limit) || 20;
  validatedLimit = Math.min(Math.max(validatedLimit, 1), maxLimit);

  // Validar ordenamiento
  const validatedOrder = ['asc', 'desc'].includes(options.order) ? options.order : defaultOrder;
  const validatedOrderBy = options.orderBy || defaultOrderBy;

  return {
    limit: validatedLimit,
    order: validatedOrder,
    orderBy: validatedOrderBy,
    cursor: options.cursor || null,
  };
}

/**
 * Aplicar paginación a query de Firestore
 * @param {Object} query - Query de Firestore
 * @param {Object} paginationParams - Parámetros de paginación
 * @returns {Object} - Query con paginación aplicada
 */
function applyPaginationToQuery (query, paginationParams) {
  const { limit, order, orderBy, cursor } = paginationParams;

  // Aplicar ordenamiento
  query = query.orderBy(orderBy, order);

  // Aplicar cursor si existe
  if (cursor) {
    const cursorData = parseCursor(cursor);
    if (cursorData && cursorData.documentSnapshot) {
      query = query.startAfter(cursorData.documentSnapshot);
    }
  }

  // Aplicar límite (+1 para determinar si hay más páginas)
  query = query.limit(limit + 1);

  return query;
}

/**
 * Procesar resultados de paginación
 * @param {Array} items - Items de la consulta
 * @param {Object} paginationParams - Parámetros de paginación
 * @returns {Object} - Resultados procesados con metadata
 */
function processPaginationResults (items, paginationParams) {
  const { limit } = paginationParams;

  // Determinar si hay más páginas
  const hasMore = items.length > limit;
  const processedItems = hasMore ? items.slice(0, limit) : items;

  // Generar cursor para siguiente página
  let nextCursor = null;
  if (hasMore && processedItems.length > 0) {
    const lastItem = processedItems[processedItems.length - 1];
    nextCursor = createCursor({
      conversationId: lastItem.conversationId,
      documentSnapshot: lastItem._docRef || null,
      timestamp: lastItem.timestamp,
    });
  }

  return {
    items: processedItems,
    pagination: {
      hasMore,
      nextCursor,
      total: processedItems.length,
      limit,
      showing: processedItems.length,
    },
  };
}

/**
 * Log detallado de paginación para debugging
 * @param {Object} paginationParams - Parámetros de paginación
 * @param {Object} results - Resultados procesados
 * @param {Object} metadata - Metadata adicional
 */
function logPaginationDetails (paginationParams, results, metadata = {}) {
  const { limit, order, orderBy, cursor } = paginationParams;
  const { hasMore, nextCursor, total, showing } = results.pagination;

  logger.info('Paginación completada', {
    params: {
      limit,
      order,
      orderBy,
      hasCursor: !!cursor,
    },
    results: {
      total,
      showing,
      hasMore,
      hasNextCursor: !!nextCursor,
    },
    metadata: {
      requestId: metadata.requestId,
      endpoint: metadata.endpoint,
      filters: metadata.filters,
      executionTime: metadata.executionTime,
    },
  });
}

/**
 * Crear metadata de paginación para respuestas API
 * @param {Object} paginationParams - Parámetros de paginación
 * @param {Object} results - Resultados procesados
 * @returns {Object} - Metadata de paginación
 */
function createPaginationMetadata (paginationParams, results) {
  const { limit, order, orderBy } = paginationParams;
  const { hasMore, nextCursor, total, showing } = results.pagination;

  return {
    pagination: {
      hasMore,
      nextCursor,
      totalResults: total,
      limit,
      orderBy,
      order,
      showing,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  };
}

/**
 * Validar cursor para una conversación específica
 * @param {string} cursor - Cursor a validar
 * @param {string} conversationId - ID de la conversación
 * @returns {boolean} - true si el cursor es válido para la conversación
 */
function validateCursorForConversation (cursor, conversationId) {
  if (!cursor || !conversationId) {
    return false;
  }

  const cursorData = parseCursor(cursor);
  if (!cursorData) {
    return false;
  }

  return cursorData.conversationId === conversationId;
}

/**
 * Crear cursor simple para testing
 * @param {string} conversationId - ID de la conversación
 * @param {Object} documentSnapshot - DocumentSnapshot de Firestore
 * @returns {string} - Cursor simple
 */
function createSimpleCursor (conversationId, documentSnapshot) {
  return createCursor({
    conversationId,
    documentSnapshot,
    timestamp: documentSnapshot.data().timestamp || new Date(),
  });
}

/**
 * Obtener información del cursor sin parsearlo completamente
 * @param {string} cursor - Cursor codificado
 * @returns {Object|null} - Información básica del cursor
 */
function getCursorInfo (cursor) {
  try {
    const cursorString = Buffer.from(cursor, 'base64').toString();
    const cursorData = JSON.parse(cursorString);

    return {
      conversationId: cursorData.conversationId,
      createdAt: cursorData.createdAt,
      hasDocumentSnapshot: !!cursorData.documentSnapshot,
    };
  } catch (error) {
    return null;
  }
}

module.exports = {
  createCursor,
  parseCursor,
  validatePaginationParams,
  applyPaginationToQuery,
  processPaginationResults,
  logPaginationDetails,
  createPaginationMetadata,
  validateCursorForConversation,
  createSimpleCursor,
  getCursorInfo,
};
