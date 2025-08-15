/**
 * Script de prueba para verificar la corrección del doble encoding en conversationId
 * 
 * Este script simula las peticiones que están fallando y verifica que la normalización funcione
 */

const { normalizeConversationId, normalizeConversationIdQuery, parseConversationId } = require('../src/middleware/conversationIdNormalization');

// Mock del logger para evitar logs durante las pruebas
const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {}
};

// Mock del request y response
function createMockRequest(conversationId, isQuery = false) {
  const req = {
    id: 'test-request-id',
    method: 'GET',
    originalUrl: isQuery ? `/api/messages?conversationId=${conversationId}` : `/api/conversations/${conversationId}`,
    headers: {
      'user-agent': 'test-agent'
    },
    ip: '127.0.0.1',
    params: {},
    query: {}
  };

  if (isQuery) {
    req.query.conversationId = conversationId;
  } else {
    req.params.conversationId = conversationId;
  }

  return req;
}

function createMockResponse() {
  const res = {
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.responseData = data;
      return this;
    }
  };
  return res;
}

// Casos de prueba
const testCases = [
  // Caso 1: ID normal con +
  {
    name: 'ID normal con +',
    input: 'conv_++5214773790184_++5214793176502',
    expected: 'conv_++5214773790184_++5214793176502',
    shouldPass: true
  },
  // Caso 2: ID con encoding simple
  {
    name: 'ID con encoding simple',
    input: 'conv_%2B%2B5214773790184_%2B%2B5214793176502',
    expected: 'conv_++5214773790184_++5214793176502',
    shouldPass: true
  },
  // Caso 3: ID con doble encoding
  {
    name: 'ID con doble encoding',
    input: 'conv_%252B%252B5214773790184_%252B%252B5214793176502',
    expected: 'conv_++5214773790184_++5214793176502',
    shouldPass: true
  },
  // Caso 4: ID inválido
  {
    name: 'ID inválido',
    input: 'invalid_id',
    expected: null,
    shouldPass: false
  }
];

console.log('🧪 Iniciando pruebas de normalización de conversationId...\n');

// Probar parseConversationId directamente
console.log('📋 Probando parseConversationId:');
testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.name}`);
  console.log(`   Input: ${testCase.input}`);
  
  const result = parseConversationId(testCase.input);
  
  if (result.valid) {
    console.log(`   ✅ Válido: ${result.participants.from} -> ${result.participants.to}`);
  } else {
    console.log(`   ❌ Inválido: ${result.error}`);
  }
});

// Probar middleware de normalización
console.log('\n🔧 Probando middleware de normalización:');

testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.name}`);
  console.log(`   Input: ${testCase.input}`);
  
  const req = createMockRequest(testCase.input);
  const res = createMockResponse();
  let nextCalled = false;
  
  const next = () => {
    nextCalled = true;
  };
  
  normalizeConversationId(req, res, next);
  
  if (nextCalled && !res.responseData) {
    console.log(`   ✅ Normalizado: ${req.normalizedConversationId}`);
    if (req.conversationParticipants) {
      console.log(`   📞 Participantes: ${req.conversationParticipants.from} -> ${req.conversationParticipants.to}`);
    }
  } else {
    console.log(`   ❌ Error: ${res.responseData?.error || 'Unknown error'}`);
  }
});

// Probar middleware de query parameters
console.log('\n🔍 Probando middleware de query parameters:');

testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.name}`);
  console.log(`   Input: ${testCase.input}`);
  
  const req = createMockRequest(testCase.input, true);
  const res = createMockResponse();
  let nextCalled = false;
  
  const next = () => {
    nextCalled = true;
  };
  
  normalizeConversationIdQuery(req, res, next);
  
  if (nextCalled && !res.responseData) {
    console.log(`   ✅ Normalizado: ${req.query.conversationId}`);
    if (req.conversationParticipants) {
      console.log(`   📞 Participantes: ${req.conversationParticipants.from} -> ${req.conversationParticipants.to}`);
    }
  } else {
    console.log(`   ❌ Error: ${res.responseData?.error || 'Unknown error'}`);
  }
});

console.log('\n✅ Pruebas completadas.'); 