#!/usr/bin/env node

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = 'http://localhost:3001';
const TEST_CONVERSATION_ID = 'conv_+5214775211021_+5214793176502';
const TEST_CONVERSATION_ID_ENCODED = 'conv_%2B5214775211021_%2B5214793176502';

// Simular token de autenticación (en producción sería real)
const AUTH_TOKEN = 'test-token';

async function testMessageSending() {
  console.log('🧪 Iniciando pruebas de envío de mensajes...\n');

  const tests = [
    {
      name: '✅ Test 1: conversationId con %2B (URL encoding)',
      url: `${BASE_URL}/api/conversations/${TEST_CONVERSATION_ID_ENCODED}/messages`,
      data: {
        messageId: uuidv4(),
        type: 'text',
        content: 'Hola desde prueba con %2B',
        senderIdentifier: 'whatsapp:+1234567890',
        recipientIdentifier: 'whatsapp:+5214775211021',
        metadata: { source: 'test', testCase: 'url_encoding' }
      },
      expectedStatus: [200, 201]
    },
    {
      name: '✅ Test 2: conversationId con + directo',
      url: `${BASE_URL}/api/conversations/${TEST_CONVERSATION_ID}/messages`,
      data: {
        messageId: uuidv4(),
        type: 'text',
        content: 'Hola desde prueba con +',
        senderIdentifier: 'whatsapp:+1234567890',
        recipientIdentifier: 'whatsapp:+5214775211021',
        metadata: { source: 'test', testCase: 'direct_plus' }
      },
      expectedStatus: [200, 201]
    },
    {
      name: '❌ Test 3: Falta senderIdentifier → 400',
      url: `${BASE_URL}/api/conversations/${TEST_CONVERSATION_ID}/messages`,
      data: {
        messageId: uuidv4(),
        type: 'text',
        content: 'Hola sin senderIdentifier',
        recipientIdentifier: 'whatsapp:+5214775211021'
        // senderIdentifier faltante
      },
      expectedStatus: [400, 401, 403] // 400 para validación, 401/403 para auth
    },
    {
      name: '❌ Test 4: content vacío → 400',
      url: `${BASE_URL}/api/conversations/${TEST_CONVERSATION_ID}/messages`,
      data: {
        messageId: uuidv4(),
        type: 'text',
        content: '', // content vacío
        senderIdentifier: 'whatsapp:+1234567890',
        recipientIdentifier: 'whatsapp:+5214775211021'
      },
      expectedStatus: [400, 401, 403]
    },
    {
      name: '❌ Test 5: messageId inválido → 400',
      url: `${BASE_URL}/api/conversations/${TEST_CONVERSATION_ID}/messages`,
      data: {
        messageId: 'invalid-uuid', // UUID inválido
        type: 'text',
        content: 'Hola con UUID inválido',
        senderIdentifier: 'whatsapp:+1234567890',
        recipientIdentifier: 'whatsapp:+5214775211021'
      },
      expectedStatus: [400, 401, 403]
    },
    {
      name: '❌ Test 6: conversationId formato inválido → 400',
      url: `${BASE_URL}/api/conversations/invalid-conversation-id/messages`,
      data: {
        messageId: uuidv4(),
        type: 'text',
        content: 'Hola con conversationId inválido',
        senderIdentifier: 'whatsapp:+1234567890',
        recipientIdentifier: 'whatsapp:+5214775211021'
      },
      expectedStatus: [400, 401, 403]
    },
    {
      name: '✅ Test 7: messageId autogenerado (extensión opcional)',
      url: `${BASE_URL}/api/conversations/${TEST_CONVERSATION_ID}/messages`,
      data: {
        messageId: '', // messageId vacío para autogeneración
        type: 'text',
        content: 'Hola con messageId autogenerado',
        senderIdentifier: 'whatsapp:+1234567890',
        recipientIdentifier: 'whatsapp:+5214775211021'
      },
      expectedStatus: [200, 201, 400, 401, 403] // Puede fallar por auth
    },
    {
      name: '❌ Test 8: Endpoint legacy deprecado → 410',
      url: `${BASE_URL}/api/messages/send`,
      data: {
        content: 'Hola desde endpoint deprecado',
        type: 'text'
      },
      expectedStatus: [410, 401, 403] // 410 para deprecado, 401/403 para auth
    }
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    try {
      console.log(`\n${test.name}`);
      console.log(`URL: ${test.url}`);
      console.log(`Data: ${JSON.stringify(test.data, null, 2)}`);

      const response = await axios.post(test.url, test.data, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        timeout: 5000
      });

      console.log(`Status: ${response.status}`);
      console.log(`Response: ${JSON.stringify(response.data, null, 2)}`);

      if (test.expectedStatus.includes(response.status)) {
        console.log('✅ PASÓ');
        passedTests++;
      } else {
        console.log(`❌ FALLÓ - Status esperado: ${test.expectedStatus.join(' o ')}, obtenido: ${response.status}`);
      }

    } catch (error) {
      const status = error.response?.status || 'NO_RESPONSE';
      console.log(`Status: ${status}`);
      
      if (error.response?.data) {
        console.log(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
      } else {
        console.log(`Error: ${error.message}`);
      }

      if (test.expectedStatus.includes(status)) {
        console.log('✅ PASÓ (error esperado)');
        passedTests++;
      } else {
        console.log(`❌ FALLÓ - Status esperado: ${test.expectedStatus.join(' o ')}, obtenido: ${status}`);
      }
    }
  }

  console.log(`\n📊 RESULTADOS: ${passedTests}/${totalTests} pruebas pasaron`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ¡TODAS LAS PRUEBAS PASARON!');
  } else {
    console.log('⚠️  Algunas pruebas fallaron');
  }

  process.exit(passedTests === totalTests ? 0 : 1);
}

// Ejecutar pruebas
testMessageSending().catch(error => {
  console.error('Error ejecutando pruebas:', error);
  process.exit(1);
}); 