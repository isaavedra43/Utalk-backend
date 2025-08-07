/**
 * Utilidades para Firestore
 */

/**
 * Preparar objeto para guardar en Firestore
 * Remueve campos undefined/null y aplica limpieza específica
 */
function prepareForFirestore (obj) {
  const cleaned = cleanFirestoreObject(obj);
  return cleaned;
}

/**
 * Limpiar objeto para Firestore
 * Protege campos críticos y remueve valores problemáticos
 */
function cleanFirestoreObject (obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const cleaned = {};
  const criticalFields = [
    'id', 'conversationId', 'senderIdentifier', 'recipientIdentifier',
    'content', 'type', 'direction', 'status', 'mediaUrl', 'timestamp', 'metadata'
  ];

  for (const [key, value] of Object.entries(obj)) {
    // Para campos críticos, incluir siempre si no es undefined/null
    if (criticalFields.includes(key)) {
      if (value !== undefined && value !== null) {
        cleaned[key] = value;
      }
    } else {
      // Para campos no críticos, saltar undefined/null
      if (value !== undefined && value !== null) {
        cleaned[key] = value;
      }
    }
  }

  return cleaned;
}

module.exports = {
  cleanFirestoreObject,
  prepareForFirestore,
};
