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

  // Los números ya deben estar validados por el middleware
  const normalized1 = phone1.replace(/[^\d]/g, '');
  const normalized2 = phone2.replace(/[^\d]/g, '');

  // Validar que los números tengan formato válido
  if (normalized1.length < 10 || normalized2.length < 10) {
    throw new Error('Los números de teléfono deben tener al menos 10 dígitos');
  }

  // Generar UUID único para la conversación
  return uuidv4();
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
