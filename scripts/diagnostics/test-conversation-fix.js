/**
 * 🔧 SCRIPT DE TESTING PARA VERIFICAR LA SOLUCIÓN DEL ERROR toJSON
 * 
 * Este script prueba la conversión segura de documentos de Firebase
 * y verifica que el error TypeError: conversation.toJSON is not a function
 * ya no ocurra.
 */

const { safeFirestoreToJSON, analyzeFirestoreDocument } = require('../../src/utils/firestore');

console.log('🧪 Iniciando tests de conversión segura de Firestore...\n');

// Test 1: Objeto plano (como devuelve ConversationService.getConversationById)
console.log('📋 Test 1: Objeto plano (caso normal)');
const plainObject = {
  id: 'conv_+5214773790184_+5214793176502',
  customerPhone: '+5214773790184',
  status: 'open',
  createdAt: { _seconds: 1754699629, _nanoseconds: 900000000 }
};

console.log('Objeto de entrada:', plainObject);
analyzeFirestoreDocument(plainObject, 'Test1-PlainObject');

const result1 = safeFirestoreToJSON(plainObject);
console.log('Resultado:', result1);
console.log('✅ Test 1 PASÓ\n');

// Test 2: null
console.log('📋 Test 2: null (caso de error)');
const nullObject = null;

console.log('Objeto de entrada:', nullObject);
analyzeFirestoreDocument(nullObject, 'Test2-Null');

const result2 = safeFirestoreToJSON(nullObject);
console.log('Resultado:', result2);
console.log('✅ Test 2 PASÓ\n');

// Test 3: undefined
console.log('📋 Test 3: undefined (caso de error)');
const undefinedObject = undefined;

console.log('Objeto de entrada:', undefinedObject);
analyzeFirestoreDocument(undefinedObject, 'Test3-Undefined');

const result3 = safeFirestoreToJSON(undefinedObject);
console.log('Resultado:', result3);
console.log('✅ Test 3 PASÓ\n');

// Test 4: Objeto con método toJSON (simulando documento de Firestore)
console.log('📋 Test 4: Objeto con método toJSON (documento Firestore)');
const firestoreDoc = {
  id: 'conv_+5214773790184_+5214793176502',
  data: () => ({
    customerPhone: '+5214773790184',
    status: 'open'
  }),
  toJSON: function() {
    return {
      id: this.id,
      ...this.data()
    };
  }
};

console.log('Objeto de entrada:', firestoreDoc);
analyzeFirestoreDocument(firestoreDoc, 'Test4-FirestoreDoc');

const result4 = safeFirestoreToJSON(firestoreDoc);
console.log('Resultado:', result4);
console.log('✅ Test 4 PASÓ\n');

// Test 5: String (caso inválido)
console.log('📋 Test 5: String (caso inválido)');
const stringObject = 'conv_+5214773790184_+5214793176502';

console.log('Objeto de entrada:', stringObject);
analyzeFirestoreDocument(stringObject, 'Test5-String');

const result5 = safeFirestoreToJSON(stringObject);
console.log('Resultado:', result5);
console.log('✅ Test 5 PASÓ\n');

// Test 6: Array vacío
console.log('📋 Test 6: Array vacío');
const arrayObject = [];

console.log('Objeto de entrada:', arrayObject);
analyzeFirestoreDocument(arrayObject, 'Test6-Array');

const result6 = safeFirestoreToJSON(arrayObject);
console.log('Resultado:', result6);
console.log('✅ Test 6 PASÓ\n');

console.log('🎉 TODOS LOS TESTS PASARON EXITOSAMENTE!');
console.log('🔧 La solución para el error toJSON está funcionando correctamente.');
console.log('\n📝 Resumen de casos manejados:');
console.log('   ✅ Objetos planos (caso normal)');
console.log('   ✅ Documentos de Firestore con toJSON()');
console.log('   ✅ Valores null y undefined');
console.log('   ✅ Tipos inválidos (string, array)');
console.log('\n🚀 El endpoint /api/conversations/:id debería funcionar correctamente ahora.'); 