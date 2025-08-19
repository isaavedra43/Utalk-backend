const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

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
  // Asegurar que no se agregue + extra si ya está presente
  const formattedPhone1 = sorted[0].startsWith('+') ? sorted[0] : `+${sorted[0]}`;
  const formattedPhone2 = sorted[1].startsWith('+') ? sorted[1] : `+${sorted[1]}`;
  const conversationId = `conv_${formattedPhone1}_${formattedPhone2}`;
  
  // 🔧 VALIDACIÓN CRÍTICA: Prevenir IDs con doble ++
  if (conversationId.includes('++')) {
    logger.error('🚨 ERROR CRÍTICO: Se intentó generar ID con doble ++', { category: '_ERROR_CR_TICO_SE_INTENT_GENER', 
      phone1: sorted[0],
      phone2: sorted[1],
      normalized1,
      normalized2,
      sorted,
      generatedId: conversationId,
      timestamp: new Date().toISOString()
     });
    
    // Normalizar el ID para evitar el doble ++
    const correctedId = conversationId.replace(/\+\+/g, '+');
    logger.warn('🔧 ID corregido automáticamente:', { category: '_ID_CORREGIDO_AUTOM_TICAMENTE_', 
      original: conversationId,
      corrected: correctedId
     });
    
    return correctedId;
  }
  
  // Log para debugging
  logger.info('ID de conversación generado correctamente:', { category: 'ID_DE_CONVERSACI_N_GENERADO_CO', 
    phone1: sorted[0],
    phone2: sorted[1],
    normalized1,
    normalized2,
    conversationId,
    hasDoublePlus: conversationId.includes('++')
   });
  
  return conversationId;
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
 * 🔧 VALIDACIÓN CRÍTICA: Verifica que un conversationId no contenga doble ++
 * @param {string} conversationId - ID a validar
 * @returns {Object} - {isValid: boolean, correctedId?: string, error?: string}
 */
function validateConversationIdForDatabase(conversationId) {
  try {
    if (!conversationId || typeof conversationId !== 'string') {
      return {
        isValid: false,
        error: 'ConversationId es requerido y debe ser string'
      };
    }

    // 🔧 DETECTAR DOBLE ++
    if (conversationId.includes('++')) {
      logger.error('🚨 ERROR CRÍTICO: ConversationId contiene doble ++', { category: '_ERROR_CR_TICO_CONVERSATIONID_', 
        conversationId,
        timestamp: new Date().toISOString()
       });

      // Corregir automáticamente
      const correctedId = conversationId.replace(/\+\+/g, '+');
      
      logger.warn('🔧 ConversationId corregido automáticamente:', { category: '_CONVERSATIONID_CORREGIDO_AUTO', 
        original: conversationId,
        corrected: correctedId
       });

      return {
        isValid: false,
        correctedId: correctedId,
        error: 'ConversationId contiene doble ++ (corregido automáticamente)'
      };
    }

    // Validar formato básico
    if (!isValidConversationId(conversationId)) {
      return {
        isValid: false,
        error: 'Formato de conversationId inválido'
      };
    }

    return {
      isValid: true
    };
  } catch (error) {
    logger.error('❌ Error validando conversationId:', { category: '_ERROR_VALIDANDO_CONVERSATIONI' }error);
    return {
      isValid: false,
      error: 'Error interno validando conversationId'
    };
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
  
  // 🔧 VALIDACIÓN CRÍTICA: Prevenir doble ++
  if (normalized.includes('++')) {
    logger.error('🚨 ERROR: Número de teléfono contiene doble ++', { category: '_ERROR_N_MERO_DE_TEL_FONO_CONT', 
      original: phone,
      normalized,
      timestamp: new Date().toISOString()
     });
    
    // Corregir automáticamente
    normalized = normalized.replace(/\+\+/g, '+');
    logger.warn('🔧 Número corregido automáticamente:', { category: '_N_MERO_CORREGIDO_AUTOM_TICAME', 
      original: phone,
      corrected: normalized
     });
  }
  
  // Asegurar que tenga el formato correcto
  if (normalized.startsWith('+')) {
    // Formato internacional: +1234567890
    if (normalized.length < 11) {
      logger.warn('⚠️ Número muy corto para formato internacional:', { category: '_N_MERO_MUY_CORTO_PARA_FORMATO', 
        phone,
        normalized,
        length: normalized.length
       });
      return null; // Muy corto para ser válido
    }
  } else {
    // Formato local: 1234567890
    if (normalized.length < 10) {
      logger.warn('⚠️ Número muy corto para formato local:', { category: '_N_MERO_MUY_CORTO_PARA_FORMATO', 
        phone,
        normalized,
        length: normalized.length
       });
      return null; // Muy corto para ser válido
    }
    // Agregar + si no lo tiene
    normalized = '+' + normalized;
  }
  
  // Validación final
  if (!/^\+\d{10,}$/.test(normalized)) {
    logger.error('❌ Número de teléfono inválido después de normalización:', { category: '_N_MERO_DE_TEL_FONO_INV_LIDO_D', 
      original: phone,
      normalized,
      pattern: /^\+\d{10, }$/
    });
    return null;
  }
  
  return normalized;
}

module.exports = {
  generateConversationId,
  extractParticipants,
  isValidConversationId,
  normalizePhoneNumber,
  validateConversationIdForDatabase,
};
