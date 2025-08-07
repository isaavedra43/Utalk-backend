/**
 * Utilidades para Firestore
 */

/**
 * Limpia un objeto removiendo propiedades con valores undefined, null o cadenas vacías
 * @param {Object} obj - Objeto a limpiar
 * @returns {Object} - Objeto limpio sin valores undefined, null o cadenas vacías
 */
function cleanFirestoreObject (obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Si es un array, limpiar cada elemento
  if (Array.isArray(obj)) {
    return obj.map(item => cleanFirestoreObject(item)).filter(item =>
      item !== undefined && item !== null && item !== '',
    );
  }

  // Para objetos, filtrar propiedades válidas
  const cleaned = {};

  for (const [key, value] of Object.entries(obj)) {
    // Saltar valores undefined o null, pero PERMITIR cadenas vacías para mensajes
    if (value === undefined || value === null) {
      continue;
    }

    // Si es un objeto anidado, limpiarlo recursivamente
    if (typeof value === 'object' && value !== null) {
      const cleanedValue = cleanFirestoreObject(value);
      // Solo agregar si el objeto limpio no está vacío
      if (Array.isArray(cleanedValue) ? cleanedValue.length > 0 : Object.keys(cleanedValue).length > 0) {
        cleaned[key] = cleanedValue;
      }
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

/**
 * Prepara un objeto para ser guardado en Firestore
 * Limpia valores inválidos y convierte tipos si es necesario
 * @param {Object} obj - Objeto a preparar
 * @returns {Object} - Objeto listo para Firestore
 */
function prepareForFirestore (obj) {
  const cleaned = cleanFirestoreObject(obj);

  // Log para debugging en desarrollo
  if (process.env.NODE_ENV !== 'production') {
    const removedFields = [];
    for (const key in obj) {
      if (!(key in cleaned)) {
        removedFields.push(key);
      }
    }
    if (removedFields.length > 0) {
      logger.info(`🧹 Campos removidos de Firestore: ${removedFields.join(', ')}`);
    }
  }

  return cleaned;
}

module.exports = {
  cleanFirestoreObject,
  prepareForFirestore,
};
