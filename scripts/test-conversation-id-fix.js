/**
 * 🧪 SCRIPT DE PRUEBA: Verificar corrección de IDs de conversación con doble ++
 * 
 * Este script prueba la solución para prevenir IDs con doble ++
 */

const { 
  generateConversationId, 
  normalizePhoneNumber, 
  validateConversationIdForDatabase 
} = require('../src/utils/conversation');

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🧪 INICIANDO PRUEBAS DE CORRECCIÓN DE CONVERSATION ID\n' });

// Casos de prueba
const testCases = [
  {
    name: 'Números normales',
    phone1: '+5214773790184',
    phone2: '+5214793176502',
    expected: 'conv_+5214773790184_+5214793176502'
  },
  {
    name: 'Números sin +',
    phone1: '5214773790184',
    phone2: '5214793176502',
    expected: 'conv_+5214773790184_+5214793176502'
  },
  {
    name: 'Números con doble ++ (caso problemático)',
    phone1: '++5214773790184',
    phone2: '++5214793176502',
    expected: 'conv_+5214773790184_+5214793176502'
  },
  {
    name: 'Números mixtos',
    phone1: '+5214773790184',
    phone2: '++5214793176502',
    expected: 'conv_+5214773790184_+5214793176502'
  }
];

// Probar normalización de números
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📱 PRUEBAS DE NORMALIZACIÓN DE NÚMEROS:' });
testCases.forEach((testCase, index) => {
  logger.info('\n${index + 1}. ${testCase.name}:', { category: 'AUTO_MIGRATED' });
  
  const normalized1 = normalizePhoneNumber(testCase.phone1);
  const normalized2 = normalizePhoneNumber(testCase.phone2);
  
  logger.info('Phone1: "${testCase.phone1}" -> "${normalized1}"', { category: 'AUTO_MIGRATED' });
  logger.info('Phone2: "${testCase.phone2}" -> "${normalized2}"', { category: 'AUTO_MIGRATED' });
  
  if (normalized1 && normalized2) {
    logger.info('Normalización exitosa', { category: 'AUTO_MIGRATED' });
  } else {
    logger.info('❌ Error en normalización', { category: 'AUTO_MIGRATED' });
  }
});

// Probar generación de IDs
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🆔 PRUEBAS DE GENERACIÓN DE CONVERSATION ID:' });
testCases.forEach((testCase, index) => {
  logger.info('\n${index + 1}. ${testCase.name}:', { category: 'AUTO_MIGRATED' });
  
  try {
    const generatedId = generateConversationId(testCase.phone1, testCase.phone2);
    logger.info('Generado: "${generatedId}"', { category: 'AUTO_MIGRATED' });
    logger.info('Esperado: "${testCase.expected}"', { category: 'AUTO_MIGRATED' });
    
    if (generatedId === testCase.expected) {
      logger.info('ID generado correctamente', { category: 'AUTO_MIGRATED' });
    } else {
      logger.info('❌ ID no coincide con el esperado', { category: 'AUTO_MIGRATED' });
    }
    
    // Verificar que no contenga doble ++
    if (generatedId.includes('++')) {
      logger.info('ERROR: ID contiene doble ++', { category: 'AUTO_MIGRATED' });
    } else {
      logger.info('ID no contiene doble ++', { category: 'AUTO_MIGRATED' });
    }
  } catch (error) {
    logger.info('❌ Error generando ID: ${error.message}', { category: 'AUTO_MIGRATED' });
  }
});

// Probar validación de IDs
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🔍 PRUEBAS DE VALIDACIÓN DE CONVERSATION ID:' });
const validationTests = [
  {
    id: 'conv_+5214773790184_+5214793176502',
    name: 'ID válido',
    shouldBeValid: true
  },
  {
    id: 'conv_++5214773790184_++5214793176502',
    name: 'ID con doble ++ (problemático)',
    shouldBeValid: false
  },
  {
    id: 'conv_5214773790184_5214793176502',
    name: 'ID sin +',
    shouldBeValid: true
  },
  {
    id: 'invalid_id',
    name: 'ID inválido',
    shouldBeValid: false
  }
];

validationTests.forEach((testCase, index) => {
  logger.info('\n${index + 1}. ${testCase.name}:', { category: 'AUTO_MIGRATED' });
  logger.info('ID: "${testCase.id}"', { category: 'AUTO_MIGRATED' });
  
  const validation = validateConversationIdForDatabase(testCase.id);
  logger.info('Validación: ${validation.isValid ? ' Válido' : '❌ Inválido'}', { category: 'AUTO_MIGRATED' });
  
  if (!validation.isValid && validation.correctedId) {
    logger.info('ID corregido: "${validation.correctedId}"', { category: 'AUTO_MIGRATED' });
  }
  
  if (validation.error) {
    logger.info('Error: ${validation.error}', { category: 'AUTO_MIGRATED' });
  }
  
  if (validation.isValid === testCase.shouldBeValid) {
    logger.info('Resultado esperado', { category: 'AUTO_MIGRATED' });
  } else {
    logger.info('❌ Resultado inesperado', { category: 'AUTO_MIGRATED' });
  }
});

logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎯 PRUEBAS COMPLETADAS' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ La solución debería prevenir IDs con doble ++' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Los IDs existentes con doble ++ serán corregidos automáticamente' });
logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Nuevas conversaciones usarán el formato correcto' }); 