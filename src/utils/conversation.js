const { v4: uuidv4 } = require('uuid');

/**
 * Utilidades para gestión de conversaciones
 */

/**
 * Genera un conversationId único y consistente para dos números de teléfono
 * @param {string} phone1 - Primer número de teléfono (ya validado)
 * @param {string} phone2 - Segundo número de teléfono (ya validado)
 * @returns {string} - conversationId único (UUID)
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
  
  // Generar ID determinístico basado en los números
  return `conv_${sorted[0]}_${sorted[1]}`;
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

  const phones = conversationId.replace('conv_', '').split('_');

  if (phones.length !== 2) {
    throw new Error('conversationId debe contener exactamente 2 números');
  }

  return {
    phone1: phones[0],
    phone2: phones[1],
  };
}

/**
 * Valida que un conversationId tenga el formato correcto (UUID)
 * @param {string} conversationId - ID a validar
 * @returns {boolean} - true si es válido
 */
function isValidConversationId (conversationId) {
  try {
    if (!conversationId || typeof conversationId !== 'string') return false;
    
    // NUEVO: Validar formato UUID
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
  if (!phone) return null;
  
  // Remover prefijo WhatsApp si existe
  let normalized = phone.replace(/^whatsapp:/, '');
  
  // Remover espacios, guiones, paréntesis y otros caracteres
  normalized = normalized.replace(/[\s\-()]/g, '');
  
  // Obtener solo dígitos para validación
  const digitsOnly = normalized.replace(/\D/g, '');
  
  // Validar que tenga al menos 7 dígitos (mínimo para números válidos)
  if (digitsOnly.length < 7) {
    return null;
  }
  
  // Asegurar que comience con +
  if (!normalized.startsWith('+')) {
    // Si no tiene código de país, asumir +1 (EEUU) solo para números de 10 dígitos
    if (digitsOnly.length === 10) {
      normalized = '+1' + digitsOnly;
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      normalized = '+' + digitsOnly;
    } else if (digitsOnly.length >= 7) {
      // Solo agregar + si tiene al menos 7 dígitos
      normalized = '+' + digitsOnly;
    } else {
      return null; // Rechazar números muy cortos
    }
  }
  
  return normalized;
}

module.exports = {
  generateConversationId,
  extractParticipants,
  isValidConversationId,
  normalizePhoneNumber,
};
