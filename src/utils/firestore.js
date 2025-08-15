const logger = require('./logger');

/**
 * 🔧 UTILIDADES PARA MANEJO SEGURO DE DOCUMENTOS DE FIREBASE
 */

/**
 * Convierte un documento de Firestore a JSON de forma segura
 * @param {Object} doc - Documento de Firestore o objeto plano
 * @returns {Object|null} - Objeto JSON o null si no es válido
 */
const safeFirestoreToJSON = (doc) => {
  if (!doc) {
    logger.debug('safeFirestoreToJSON: Documento es null o undefined');
    return null;
  }
  
  // Si es un documento de Firestore con toJSON
  if (typeof doc.toJSON === 'function') {
    logger.debug('safeFirestoreToJSON: Usando método toJSON() del documento');
    return doc.toJSON();
  }
  
  // Si es un objeto plano, devolver directamente
  if (typeof doc === 'object' && doc !== null) {
    logger.debug('safeFirestoreToJSON: Usando objeto plano directamente');
    return doc;
  }
  
  logger.warn('safeFirestoreToJSON: Tipo de documento no reconocido', {
    docType: typeof doc,
    hasToJSON: typeof doc?.toJSON === 'function'
  });
  
  return null;
};

/**
 * Valida un documento de Firestore
 * @param {Object} doc - Documento de Firestore
 * @param {string} documentType - Tipo de documento para mensajes de error
 * @returns {Object} - Resultado de validación
 */
const validateFirestoreDocument = (doc, documentType = 'documento') => {
  if (!doc) {
    return {
      isValid: false,
      error: {
        success: false,
        error: "DOCUMENT_NOT_FOUND",
        message: `El ${documentType} no fue encontrado`,
        suggestion: "Verifica que el ID sea correcto y que el documento exista"
      }
    };
  }

  // Si es un documento de Firestore con método exists
  if (typeof doc.exists === 'boolean' && !doc.exists) {
    return {
      isValid: false,
      error: {
        success: false,
        error: "DOCUMENT_NOT_FOUND",
        message: `El ${documentType} no existe en la base de datos`,
        suggestion: "Verifica que el ID sea correcto"
      }
    };
  }

  return {
    isValid: true,
    data: doc
  };
};

/**
 * Obtiene datos de un documento de Firestore de forma segura
 * @param {Object} doc - Documento de Firestore
 * @returns {Object|null} - Datos del documento o null
 */
const safeGetFirestoreData = (doc) => {
  if (!doc) return null;
  
  // Si tiene método data()
  if (typeof doc.data === 'function') {
    return doc.data();
  }
  
  // Si es un objeto plano
  if (typeof doc === 'object' && doc !== null) {
    return doc;
  }
  
  return null;
};

/**
 * Analiza un documento de Firestore para debugging
 * @param {Object} doc - Documento de Firestore
 * @param {string} context - Contexto para el logging
 */
const analyzeFirestoreDocument = (doc, context = 'unknown') => {
  logger.debug(`Análisis de documento Firestore [${context}]`, {
    docType: typeof doc,
    isNull: doc === null,
    isUndefined: doc === undefined,
    hasToJSON: typeof doc?.toJSON === 'function',
    hasData: typeof doc?.data === 'function',
    hasExists: typeof doc?.exists === 'boolean',
    exists: doc?.exists,
    keys: doc ? Object.keys(doc) : [],
    id: doc?.id
  });
};

module.exports = {
  safeFirestoreToJSON,
  validateFirestoreDocument,
  safeGetFirestoreData,
  analyzeFirestoreDocument
};
