const { v4: uuidv4 } = require('uuid');

/**
 * Utilidades para gestión de conversaciones
 */

/**
 * Genera un conversationId único y consistente para dos números de teléfono
 * @param {string} phone1 - Primer número de teléfono (ya validado)
 * @param {string} phone2 - Segundo número de teléfono (ya validado)
 * @returns {string} - conversationId único con formato conv_+phone1_+phone2
 */
function generateConversationId (phone1, phone2) {
  if (!phone1 || !phone2) {
    throw new Error('Se requieren ambos números de teléfono para generar conversationId');
  }
  
  const normalized1 = normalizePhoneNumber(phone1);
  const normalized2 = normalizePhoneNumber(phone2);
  
  if (!normalized1 || !normalized2) {
    throw new Error('Los números de teléfono deben tener al menos 10 dígitos');
  }
  
  // Ordenar los números para asegurar consistencia
  const sorted = [normalized1, normalized2].sort();
  
  // 🔧 CORRECCIÓN: Generar ID con formato conv_+phone1_+phone2 para mantener los símbolos +
  return `conv_+${sorted[0]}_+${sorted[1]}`;
}

/**
 * Extrae los participantes de un conversationId
 * @param {string} conversationId - ID de conversación
 * @returns {Object} - {phone1, phone2} números extraídos
 */
function extractParticipants (conversationId) {
  if (!conversationId || !conversationId.startsWith('conv_')) {
    throw new Error('conversationId inválido');
  }

  // 🔧 CORRECCIÓN: Manejar formato conv_+phone1_+phone2
  const phones = conversationId.replace('conv_', '').split('_');

  if (phones.length !== 2) {
    throw new Error('conversationId debe contener exactamente 2 números');
  }

  // Remover símbolos + si están presentes
  const phone1 = phones[0].replace('+', '');
  const phone2 = phones[1].replace('+', '');

  return {
    phone1: phone1,
    phone2: phone2,
  };
}

/**
 * Valida que un conversationId tenga el formato correcto
 * @param {string} conversationId - ID a validar
 * @returns {boolean} - true si es válido
 */
function isValidConversationId (conversationId) {
  try {
    if (!conversationId || typeof conversationId !== 'string') return false;
    
    // 🔧 CORRECCIÓN: Validar formato conv_+phone1_+phone2
    if (conversationId.startsWith('conv_')) {
      const parts = conversationId.replace('conv_', '').split('_');
      // Verificar que hay exactamente 2 partes y que cada una tenga al menos un dígito
      return parts.length === 2 && 
             parts.every(part => part.length > 0 && /^\+?\d+$/.test(part));
    }
    
    // También aceptar UUID por compatibilidad
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(conversationId);
  } catch {
    return false;
  }
}

/**
 * Normaliza un número de teléfono para consistency
 * @param {string} phone - Número a normalizar
 * @returns {string} - Número normalizado
 */
function normalizePhoneNumber (phone) {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  // 🔧 CORRECCIÓN: Mejorar normalización para manejar símbolos +
  let normalized = phone.trim();
  
  // Remover espacios y caracteres especiales excepto +
  normalized = normalized.replace(/[^\d+]/g, '');
  
  // Asegurar que tenga el formato correcto
  if (normalized.startsWith('+')) {
    // Formato internacional: +1234567890
    if (normalized.length < 11) {
      return null; // Muy corto para ser válido
    }
  } else {
    // Formato local: 1234567890
    if (normalized.length < 10) {
      return null; // Muy corto para ser válido
    }
    // Agregar + si no lo tiene
    normalized = '+' + normalized;
  }
  
  return normalized;
}

module.exports = {
  generateConversationId,
  extractParticipants,
  isValidConversationId,
  normalizePhoneNumber,
};
