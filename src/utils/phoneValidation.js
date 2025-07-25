/**
 * UTILIDAD DE VALIDACIÓN DE TELÉFONOS - UTalk Backend
 *
 * Basado en estándares internacionales y Twilio Lookup API
 * Valida formatos de teléfono y normaliza números
 */

const logger = require('./logger');

/**
 * Regex para validación de teléfonos internacionales
 * Basado en estándares E.164 y compatibilidad con Twilio
 */
const PHONE_REGEX = {
  // Formato E.164: +[código país][número] (ej: +1234567890)
  E164: /^\+[1-9]\d{1,14}$/,

  // Formato nacional con espacios/guiones (ej: +1 (234) 567-8900)
  NATIONAL: /^\+[1-9]\d{0,3}[\s\-()]*\d{1,4}[\s\-()]*\d{1,4}[\s\-()]*\d{1,9}$/,

  // Formato WhatsApp: whatsapp:+[número]
  WHATSAPP: /^whatsapp:\+[1-9]\d{1,14}$/,

  // Formato básico (solo números y +)
  BASIC: /^\+?[1-9]\d{6,14}$/,
};

/**
 * Normalizar número de teléfono a formato E.164
 * @param {string} phone - Número de teléfono a normalizar
 * @returns {string|null} - Número normalizado o null si inválido
 */
function normalizePhoneNumber (phone) {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  // ✅ REMOVER PREFIJO WHATSAPP SI EXISTE
  let normalized = phone.replace(/^whatsapp:/, '');

  // Remover espacios, guiones, paréntesis y otros caracteres
  normalized = normalized.replace(/[\s\-()]/g, '');

  // ✅ VALIDACIÓN ESTRICTA: Rechazar números muy cortos antes de procesar
  const digitsOnly = normalized.replace(/\D/g, '');
  if (digitsOnly.length < 7) {
    return null; // Rechazar números con menos de 7 dígitos
  }

  // Asegurar que comience con +
  if (!normalized.startsWith('+')) {
    // Si no tiene código de país, asumir +1 (EEUU) solo para números de 10 dígitos
    if (normalized.length === 10) {
      normalized = '+1' + normalized;
    } else if (normalized.length === 11 && normalized.startsWith('1')) {
      normalized = '+' + normalized;
    } else if (normalized.length >= 7) {
      // Solo agregar + si tiene al menos 7 dígitos
      normalized = '+' + normalized;
    } else {
      return null; // Rechazar números muy cortos
    }
  }

  // Validar formato E.164
  if (!PHONE_REGEX.E164.test(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Validar formato de teléfono
 * @param {string} phone - Número de teléfono a validar
 * @param {string} format - Formato esperado ('E164', 'NATIONAL', 'WHATSAPP', 'BASIC')
 * @returns {boolean} - true si es válido
 */
function validatePhoneFormat (phone, format = 'E164') {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  const regex = PHONE_REGEX[format.toUpperCase()];
  if (!regex) {
    logger.warn('Formato de teléfono no reconocido', { format, phone });
    return false;
  }

  return regex.test(phone);
}

/**
 * Validar y normalizar número de teléfono
 * @param {string} phone - Número de teléfono
 * @param {Object} options - Opciones de validación
 * @returns {Object} - Resultado de validación
 */
function validateAndNormalizePhone (phone, options = {}) {
  const {
    allowWhatsapp = true,
    requireE164 = false,
    logErrors = true,
  } = options;

  if (!phone) {
    const error = 'Número de teléfono requerido';
    if (logErrors) {
      logger.warn('Validación de teléfono falló', { phone, error });
    }
    return { isValid: false, error, normalized: null };
  }

  // Normalizar primero
  const normalized = normalizePhoneNumber(phone);

  if (!normalized) {
    const error = 'Formato de teléfono inválido';
    if (logErrors) {
      logger.warn('Normalización de teléfono falló', { phone, error });
    }
    return { isValid: false, error, normalized: null };
  }

  // Validar formato según opciones
  let isValid = false;
  let format = '';

  if (validatePhoneFormat(normalized, 'E164')) {
    isValid = true;
    format = 'E164';
  } else if (allowWhatsapp && validatePhoneFormat(normalized, 'WHATSAPP')) {
    isValid = true;
    format = 'WHATSAPP';
  } else if (!requireE164 && validatePhoneFormat(normalized, 'BASIC')) {
    isValid = true;
    format = 'BASIC';
  }

  if (!isValid) {
    const error = `Formato de teléfono no válido. Esperado: ${requireE164 ? 'E.164' : 'formato internacional'}`;
    if (logErrors) {
      logger.warn('Validación de formato falló', { phone, normalized, error });
    }
    return { isValid: false, error, normalized: null };
  }

  return {
    isValid: true,
    normalized,
    format,
    original: phone,
  };
}

/**
 * Extraer información del número de teléfono
 * @param {string} phone - Número de teléfono
 * @returns {Object} - Información del teléfono
 */
function extractPhoneInfo (phone) {
  const validation = validateAndNormalizePhone(phone);

  if (!validation.isValid) {
    return null;
  }

  const normalized = validation.normalized;

  // Extraer código de país (primeros dígitos después del +)
  const countryCodeMatch = normalized.match(/^\+(\d{1,3})/);
  const countryCode = countryCodeMatch ? countryCodeMatch[1] : null;

  // Extraer número nacional (resto después del código de país)
  const nationalNumber = normalized.replace(/^\+(\d{1,3})/, '');

  // Determinar tipo de número
  let numberType = 'unknown';
  if (normalized.startsWith('whatsapp:')) {
    numberType = 'whatsapp';
  } else if (countryCode === '1' && nationalNumber.length === 10) {
    numberType = 'north_america';
  } else if (countryCode && nationalNumber.length >= 7) {
    numberType = 'international';
  }

  return {
    original: phone,
    normalized,
    countryCode,
    nationalNumber,
    numberType,
    format: validation.format,
    isValid: true,
  };
}

/**
 * Sanitizar número de teléfono para búsquedas
 * @param {string} phone - Número de teléfono
 * @returns {string} - Número sanitizado
 */
function sanitizePhoneForSearch (phone) {
  if (!phone) return '';

  // Remover todos los caracteres no numéricos excepto +
  return phone.replace(/[^\d+]/g, '');
}

/**
 * Validar múltiples números de teléfono
 * @param {Array} phones - Array de números de teléfono
 * @param {Object} options - Opciones de validación
 * @returns {Object} - Resultados de validación
 */
function validateMultiplePhones (phones, options = {}) {
  if (!Array.isArray(phones)) {
    return { valid: [], invalid: [], errors: ['Array de teléfonos requerido'] };
  }

  const valid = [];
  const invalid = [];
  const errors = [];

  phones.forEach((phone, index) => {
    const validation = validateAndNormalizePhone(phone, { ...options, logErrors: false });

    if (validation.isValid) {
      valid.push(validation.normalized);
    } else {
      invalid.push(phone);
      errors.push(`Teléfono ${index + 1}: ${validation.error}`);
    }
  });

  return { valid, invalid, errors };
}

module.exports = {
  normalizePhoneNumber,
  validatePhoneFormat,
  validateAndNormalizePhone,
  extractPhoneInfo,
  sanitizePhoneForSearch,
  validateMultiplePhones,
  PHONE_REGEX,
};
