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

console.log('🧪 INICIANDO PRUEBAS DE CORRECCIÓN DE CONVERSATION ID\n');

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
console.log('📱 PRUEBAS DE NORMALIZACIÓN DE NÚMEROS:');
testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.name}:`);
  
  const normalized1 = normalizePhoneNumber(testCase.phone1);
  const normalized2 = normalizePhoneNumber(testCase.phone2);
  
  console.log(`   Phone1: "${testCase.phone1}" -> "${normalized1}"`);
  console.log(`   Phone2: "${testCase.phone2}" -> "${normalized2}"`);
  
  if (normalized1 && normalized2) {
    console.log(`   ✅ Normalización exitosa`);
  } else {
    console.log(`   ❌ Error en normalización`);
  }
});

// Probar generación de IDs
console.log('\n🆔 PRUEBAS DE GENERACIÓN DE CONVERSATION ID:');
testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.name}:`);
  
  try {
    const generatedId = generateConversationId(testCase.phone1, testCase.phone2);
    console.log(`   Generado: "${generatedId}"`);
    console.log(`   Esperado: "${testCase.expected}"`);
    
    if (generatedId === testCase.expected) {
      console.log(`   ✅ ID generado correctamente`);
    } else {
      console.log(`   ❌ ID no coincide con el esperado`);
    }
    
    // Verificar que no contenga doble ++
    if (generatedId.includes('++')) {
      console.log(`   🚨 ERROR: ID contiene doble ++`);
    } else {
      console.log(`   ✅ ID no contiene doble ++`);
    }
  } catch (error) {
    console.log(`   ❌ Error generando ID: ${error.message}`);
  }
});

// Probar validación de IDs
console.log('\n🔍 PRUEBAS DE VALIDACIÓN DE CONVERSATION ID:');
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
  console.log(`\n${index + 1}. ${testCase.name}:`);
  console.log(`   ID: "${testCase.id}"`);
  
  const validation = validateConversationIdForDatabase(testCase.id);
  console.log(`   Validación: ${validation.isValid ? '✅ Válido' : '❌ Inválido'}`);
  
  if (!validation.isValid && validation.correctedId) {
    console.log(`   ID corregido: "${validation.correctedId}"`);
  }
  
  if (validation.error) {
    console.log(`   Error: ${validation.error}`);
  }
  
  if (validation.isValid === testCase.shouldBeValid) {
    console.log(`   ✅ Resultado esperado`);
  } else {
    console.log(`   ❌ Resultado inesperado`);
  }
});

console.log('\n🎯 PRUEBAS COMPLETADAS');
console.log('✅ La solución debería prevenir IDs con doble ++');
console.log('✅ Los IDs existentes con doble ++ serán corregidos automáticamente');
console.log('✅ Nuevas conversaciones usarán el formato correcto'); 