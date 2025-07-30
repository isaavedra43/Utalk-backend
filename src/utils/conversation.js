/**
 * Utilidades para gestión de conversaciones
 */

/**
 * Genera un conversationId único y consistente para dos números de teléfono
 * @param {string} phone1 - Primer número de teléfono
 * @param {string} phone2 - Segundo número de teléfono
 * @returns {string} - conversationId único y consistente
 */
function generateConversationId (phone1, phone2) {
  if (!phone1 || !phone2) {
    throw new Error('Se requieren ambos números de teléfono para generar conversationId');
  }

  // NORMALIZAR NÚMEROS usando la función de phoneValidation
  const { validateAndNormalizePhone } = require('./phoneValidation');

  const phone1Validation = validateAndNormalizePhone(phone1);
  const phone2Validation = validateAndNormalizePhone(phone2);

  if (!phone1Validation.isValid) {
    throw new Error(`Primer número inválido: ${phone1Validation.error}`);
  }

  if (!phone2Validation.isValid) {
    throw new Error(`Segundo número inválido: ${phone2Validation.error}`);
  }

  const normalized1 = phone1Validation.normalized.replace(/[^\d]/g, '');
  const normalized2 = phone2Validation.normalized.replace(/[^\d]/g, '');

  // Validar que los números tengan formato válido
  if (normalized1.length < 10 || normalized2.length < 10) {
    throw new Error('Los números de teléfono deben tener al menos 10 dígitos');
  }

  // Ordenar consistentemente para que siempre genere el mismo ID
  const sorted = [normalized1, normalized2].sort();

  return `conv_${sorted.join('_')}`;
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
 * Valida que un conversationId tenga el formato correcto
 * @param {string} conversationId - ID a validar
 * @returns {boolean} - true si es válido
 */
function isValidConversationId (conversationId) {
  try {
    if (!conversationId || typeof conversationId !== 'string') return false;
    if (!conversationId.startsWith('conv_')) return false;

    extractParticipants(conversationId);
    return true;
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
  if (!phone) return '';

  // Remover prefijos de WhatsApp y otros caracteres
  let normalized = phone
    .replace('whatsapp:', '')
    .replace(/\D/g, ''); // Solo dígitos

  // Asegurar formato internacional (agregar 1 si es US y falta)
  if (normalized.length === 10 && !normalized.startsWith('1')) {
    normalized = '1' + normalized;
  }

  return '+' + normalized;
}

module.exports = {
  generateConversationId,
  extractParticipants,
  isValidConversationId,
  normalizePhoneNumber,
};
