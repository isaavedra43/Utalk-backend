/**
 * UTILIDADES DE FECHA - UTalk Backend
 * Manejo robusto y seguro de fechas para evitar errores de serialización
 * Soporta Date, Timestamp de Firebase, strings ISO, null, undefined
 */

const logger = require('./logger');

/**
 * ✅ FUNCIÓN ESPECÍFICA PARA FIRESTORE - Convierte cualquier fecha a string ISO 8601
 * Maneja específicamente objetos Firestore con _seconds y _nanoseconds
 * @param {any} date - Valor de fecha en cualquier formato
 * @returns {string|null} - String ISO válido o null
 */
function safeDateToISOString(date) {
  if (!date) return null;
  
  try {
    // ✅ CASO 1: Objeto Firestore con _seconds y _nanoseconds
    if (typeof date === 'object' && '_seconds' in date) {
      try {
        const timestamp = date._seconds * 1000 + Math.floor((date._nanoseconds || 0) / 1000000);
        const jsDate = new Date(timestamp);
        if (!isNaN(jsDate.getTime())) {
          return jsDate.toISOString();
        }
      } catch {
        return null;
      }
    }
    
    // ✅ CASO 2: Date object de JavaScript
    if (date instanceof Date && !isNaN(date.getTime())) {
      return date.toISOString();
    }
    
    // ✅ CASO 3: String de fecha
    if (typeof date === 'string') {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
    
    // ✅ CASO 4: Número (timestamp)
    if (typeof date === 'number') {
      const jsDate = new Date(date);
      if (!isNaN(jsDate.getTime())) {
        return jsDate.toISOString();
      }
    }
    
    // ✅ CASO 5: Firebase Timestamp con método toDate
    if (date && typeof date.toDate === 'function') {
      try {
        const jsDate = date.toDate();
        if (!isNaN(jsDate.getTime())) {
          return jsDate.toISOString();
        }
      } catch {
        return null;
      }
    }
    
    // ✅ CASO 6: Objeto con propiedades seconds/nanoseconds (serializado)
    if (typeof date === 'object' && date.seconds !== undefined) {
      try {
        const timestamp = date.seconds * 1000 + (date.nanoseconds || 0) / 1000000;
        const jsDate = new Date(timestamp);
        if (!isNaN(jsDate.getTime())) {
          return jsDate.toISOString();
        }
      } catch {
        return null;
      }
    }
    
    return null;
    
  } catch (error) {
    // ✅ SAFETY NET: Nunca fallar por un error de fecha
    logger.warn('Error en safeDateToISOString', {
      originalDate: date,
      error: error.message,
      type: typeof date,
    });
    return null;
  }
}

/**
 * Normaliza cualquier tipo de fecha a string ISO o null de forma segura
 * @param {any} dateValue - Valor de fecha en cualquier formato
 * @param {string} fieldName - Nombre del campo para logging (opcional)
 * @returns {string|null} - String ISO válido o null
 */
function safeISOString(dateValue, fieldName = 'unknown') {
  try {
    // ✅ CASO 1: null o undefined - retornar null
    if (dateValue === null || dateValue === undefined) {
      return null;
    }

    // ✅ CASO 2: String vacío o inválido
    if (typeof dateValue === 'string') {
      if (dateValue.trim() === '') {
        return null;
      }
      
      // Intentar parsear string de fecha
      const parsed = new Date(dateValue);
      if (isNaN(parsed.getTime())) {
        logger.warn('String de fecha inválido detectado', {
          fieldName,
          originalValue: dateValue,
          type: typeof dateValue,
        });
        return null;
      }
      return parsed.toISOString();
    }

    // ✅ CASO 3: Date object de JavaScript
    if (dateValue instanceof Date) {
      if (isNaN(dateValue.getTime())) {
        logger.warn('Date object inválido detectado', {
          fieldName,
          originalValue: dateValue,
        });
        return null;
      }
      return dateValue.toISOString();
    }

    // ✅ CASO 4: Timestamp de Firebase (tiene método toDate)
    if (dateValue && typeof dateValue.toDate === 'function') {
      try {
        const jsDate = dateValue.toDate();
        if (isNaN(jsDate.getTime())) {
          logger.warn('Firebase Timestamp inválido detectado', {
            fieldName,
            originalValue: dateValue,
          });
          return null;
        }
        return jsDate.toISOString();
      } catch (error) {
        logger.error('Error convirtiendo Firebase Timestamp', {
          fieldName,
          error: error.message,
          originalValue: dateValue,
        });
        return null;
      }
    }

    // ✅ CASO 5: Número (timestamp Unix)
    if (typeof dateValue === 'number') {
      // Verificar si es timestamp en segundos o milisegundos
      let timestamp = dateValue;
      
      // Si el número es muy pequeño, asumir que está en segundos
      if (timestamp < 10000000000) {
        timestamp = timestamp * 1000;
      }
      
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        logger.warn('Timestamp numérico inválido detectado', {
          fieldName,
          originalValue: dateValue,
        });
        return null;
      }
      return date.toISOString();
    }

    // ✅ CASO 6: Objeto con propiedades de fecha (algunos ORMs)
    if (typeof dateValue === 'object' && dateValue.seconds !== undefined) {
      try {
        // Formato de Firebase Timestamp serializado
        const timestamp = dateValue.seconds * 1000 + (dateValue.nanoseconds || 0) / 1000000;
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
          logger.warn('Timestamp serializado inválido detectado', {
            fieldName,
            originalValue: dateValue,
          });
          return null;
        }
        return date.toISOString();
      } catch (error) {
        logger.error('Error procesando timestamp serializado', {
          fieldName,
          error: error.message,
          originalValue: dateValue,
        });
        return null;
      }
    }

    // ✅ CASO 7: Objeto Firestore con _seconds y _nanoseconds
    if (typeof dateValue === 'object' && dateValue._seconds !== undefined) {
      try {
        const timestamp = dateValue._seconds * 1000 + Math.floor((dateValue._nanoseconds || 0) / 1000000);
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
          logger.warn('Objeto Firestore inválido detectado', {
            fieldName,
            originalValue: dateValue,
          });
          return null;
        }
        return date.toISOString();
      } catch (error) {
        logger.error('Error procesando objeto Firestore', {
          fieldName,
          error: error.message,
          originalValue: dateValue,
        });
        return null;
      }
    }

    // ✅ CASO 8: Tipo no reconocido
    logger.warn('Tipo de fecha no reconocido detectado', {
      fieldName,
      originalValue: dateValue,
      type: typeof dateValue,
      constructor: dateValue?.constructor?.name,
    });
    return null;

  } catch (error) {
    // ✅ SAFETY NET: Nunca fallar por un error de fecha
    logger.error('Error crítico en normalización de fecha', {
      fieldName,
      error: error.message,
      stack: error.stack,
      originalValue: dateValue,
      type: typeof dateValue,
    });
    return null;
  }
}

/**
 * Normaliza múltiples campos de fecha en un objeto
 * @param {Object} obj - Objeto con campos de fecha
 * @param {Array<string>} dateFields - Array de nombres de campos que son fechas
 * @returns {Object} - Objeto con fechas normalizadas
 */
function normalizeDateFields(obj, dateFields = []) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const normalized = { ...obj };
  
  dateFields.forEach(fieldName => {
    if (normalized.hasOwnProperty(fieldName)) {
      normalized[fieldName] = safeDateToISOString(normalized[fieldName]);
    }
  });

  return normalized;
}

/**
 * Lista de campos de fecha comunes en el sistema UTalk
 */
const COMMON_DATE_FIELDS = [
  'createdAt',
  'updatedAt',
  'timestamp',
  'lastMessageAt',
  'lastContactAt',
  'dateCreated',
  'dateSent',
  'dateUpdated',
  'sentAt',
  'receivedAt',
  'readAt',
  'deliveredAt',
];

/**
 * Normaliza automáticamente todos los campos de fecha comunes en un objeto
 * @param {Object} obj - Objeto a normalizar
 * @param {Array<string>} additionalFields - Campos adicionales a normalizar
 * @returns {Object} - Objeto con fechas normalizadas
 */
function autoNormalizeDates(obj, additionalFields = []) {
  const allDateFields = [...COMMON_DATE_FIELDS, ...additionalFields];
  return normalizeDateFields(obj, allDateFields);
}

/**
 * Valida si un valor representa una fecha válida
 * @param {any} dateValue - Valor a validar
 * @returns {boolean} - true si es una fecha válida
 */
function isValidDate(dateValue) {
  try {
    const normalized = safeDateToISOString(dateValue);
    return normalized !== null;
  } catch {
    return false;
  }
}

/**
 * Convierte una fecha a timestamp Unix (segundos)
 * @param {any} dateValue - Valor de fecha
 * @returns {number|null} - Timestamp en segundos o null
 */
function toUnixTimestamp(dateValue) {
  try {
    const isoString = safeDateToISOString(dateValue);
    if (!isoString) return null;
    
    return Math.floor(new Date(isoString).getTime() / 1000);
  } catch {
    return null;
  }
}

module.exports = {
  safeDateToISOString, // ✅ FUNCIÓN PRINCIPAL PARA FIRESTORE
  safeISOString,
  normalizeDateFields,
  autoNormalizeDates,
  isValidDate,
  toUnixTimestamp,
  COMMON_DATE_FIELDS,
}; 