/**
 * Utilidades para paginación cursor-based eficiente con Firestore
 *
 * Esta implementación evita el uso de offset/page que es ineficiente en Firestore
 * y utiliza cursor-based pagination con startAfter para mejor performance.
 */

/**
 * Crear respuesta de paginación estandarizada
 * @param {Array} items - Array de elementos a paginar
 * @param {number} limit - Límite solicitado
 * @param {string|null} startAfter - Cursor de inicio (ID del último elemento de la página anterior)
 * @param {boolean} calculateTotal - Si calcular total (costoso, usar solo cuando sea necesario)
 * @returns {Object} Respuesta con paginación
 */
function createPaginatedResponse (items, limit, startAfter = null, calculateTotal = false) {
  const hasItems = items.length > 0;
  const hasNextPage = items.length === limit; // Si devolvió exactamente el límite, probablemente hay más
  const nextStartAfter = hasItems ? items[items.length - 1].id : null;

  const response = {
    items,
    pagination: {
      limit,
      startAfter,
      nextStartAfter: hasNextPage ? nextStartAfter : null,
      hasNextPage,
      itemCount: items.length,
    },
  };

  // Solo incluir total si se solicita explícitamente (operación costosa)
  if (calculateTotal) {
    response.pagination.total = '⚠️ Cálculo costoso - usar solo si es necesario';
  }

  return response;
}

/**
 * Crear respuesta de paginación para mensajes con campos específicos
 * @param {Array} messages - Array de mensajes
 * @param {number} limit - Límite solicitado
 * @param {string|null} startAfter - Cursor de inicio
 * @param {Object} filters - Filtros aplicados (para logging)
 * @returns {Object} Respuesta con formato específico para mensajes
 */
function createMessagesPaginatedResponse (messages, limit, startAfter = null, filters = {}) {
  const hasMessages = messages.length > 0;
  const hasNextPage = messages.length === limit;
  const nextStartAfter = hasMessages ? messages[messages.length - 1].id : null;

  return {
    messages, // Mantenemos el nombre 'messages' para compatibilidad con frontend
    pagination: {
      limit,
      startAfter,
      nextStartAfter: hasNextPage ? nextStartAfter : null,
      hasNextPage,
      messageCount: messages.length,
    },
    filters, // Para debugging y logs
  };
}

/**
 * Crear respuesta de paginación para conversaciones
 * @param {Array} conversations - Array de conversaciones
 * @param {number} limit - Límite solicitado
 * @param {string|null} startAfter - Cursor de inicio
 * @returns {Object} Respuesta con formato específico para conversaciones
 */
function createConversationsPaginatedResponse (conversations, limit, startAfter = null) {
  const hasConversations = conversations.length > 0;
  const hasNextPage = conversations.length === limit;
  const nextStartAfter = hasConversations ? conversations[conversations.length - 1].phone : null;

  return {
    conversations, // Mantenemos el nombre para compatibilidad
    pagination: {
      limit,
      startAfter,
      nextStartAfter: hasNextPage ? nextStartAfter : null,
      hasNextPage,
      conversationCount: conversations.length,
    },
  };
}

/**
 * Validar parámetros de paginación
 * @param {Object} params - Parámetros de la query
 * @returns {Object} Parámetros validados y normalizados
 */
function validatePaginationParams (params) {
  let { limit = 50, startAfter = null } = params;

  // Validar limit
  limit = parseInt(limit);
  if (isNaN(limit) || limit < 1) {
    limit = 50; // Default seguro
  }
  if (limit > 100) {
    limit = 100; // Máximo para evitar sobrecarga
  }

  // Validar startAfter (debe ser string válido o null)
  if (startAfter === '' || startAfter === 'null' || startAfter === 'undefined') {
    startAfter = null;
  }

  return { limit, startAfter };
}

/**
 * Crear respuesta de error con formato de paginación vacía
 * @param {string} error - Mensaje de error
 * @param {number} limit - Límite que se había solicitado
 * @returns {Object} Respuesta de error con paginación vacía
 */
function createEmptyPaginatedResponse (error, limit = 50) {
  return {
    items: [], // Array vacío siempre
    pagination: {
      limit,
      startAfter: null,
      nextStartAfter: null,
      hasNextPage: false,
      itemCount: 0,
    },
    error,
  };
}

module.exports = {
  createPaginatedResponse,
  createMessagesPaginatedResponse,
  createConversationsPaginatedResponse,
  validatePaginationParams,
  createEmptyPaginatedResponse,
};
