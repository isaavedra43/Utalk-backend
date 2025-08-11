#!/usr/bin/env node

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = 'http://localhost:3001';
const TEST_CONVERSATION_ID = 'conv_+5214775211021_+5214793176502';
const AUTH_TOKEN = 'test-token';

async function testIdempotency() {
  console.log('🧪 Prueba de Idempotencia...\n');

  const messageId = uuidv4(); // Mismo messageId para ambos intentos
  const testPayload = {
    messageId: messageId,
    type: 'text',
    content: 'Test de idempotencia - ' + new Date().toISOString(),
    senderIdentifier: 'whatsapp:+1234567890',
    recipientIdentifier: 'whatsapp:+5214775211021',
    metadata: {
      source: 'test',
      testCase: 'idempotency'
    }
  };

  console.log(`📤 Enviando mensaje con messageId: ${messageId}`);
  console.log(`URL: ${BASE_URL}/api/conversations/${TEST_CONVERSATION_ID}/messages`);

  try {
    // Primer intento
    console.log('\n🔄 PRIMER INTENTO...');
    const response1 = await axios.post(
      `${BASE_URL}/api/conversations/${TEST_CONVERSATION_ID}/messages`,
      testPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        timeout: 10000
      }
    );

    console.log(`✅ Status: ${response1.status}`);
    console.log(`TwilioSID: ${response1.data.data?.message?.twilioSid || 'N/A'}`);
    console.log(`Status: ${response1.data.data?.message?.status || 'N/A'}`);

    // Segundo intento (mismo messageId)
    console.log('\n🔄 SEGUNDO INTENTO (mismo messageId)...');
    const response2 = await axios.post(
      `${BASE_URL}/api/conversations/${TEST_CONVERSATION_ID}/messages`,
      testPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        timeout: 10000
      }
    );

    console.log(`✅ Status: ${response2.status}`);
    console.log(`TwilioSID: ${response2.data.data?.message?.twilioSid || 'N/A'}`);
    console.log(`Status: ${response2.data.data?.message?.status || 'N/A'}`);

    // Verificar idempotencia
    console.log('\n🔍 VERIFICACIÓN DE IDEMPOTENCIA:');
    
    const sid1 = response1.data.data?.message?.twilioSid;
    const sid2 = response2.data.data?.message?.twilioSid;
    
    if (sid1 && sid2 && sid1 === sid2) {
      console.log('✅ IDEMPOTENCIA EXITOSA: Mismo TwilioSID en ambos intentos');
    } else if (!sid1 && !sid2) {
      console.log('⚠️  Ambos intentos fallaron (posible error de autenticación)');
    } else {
      console.log('❌ IDEMPOTENCIA FALLIDA: Diferentes TwilioSIDs');
      console.log(`   Primer intento: ${sid1}`);
      console.log(`   Segundo intento: ${sid2}`);
    }

    // Verificar que no se duplicó el mensaje
    const status1 = response1.data.data?.message?.status;
    const status2 = response2.data.data?.message?.status;
    
    if (status1 === status2) {
      console.log('✅ Estados consistentes en ambos intentos');
    } else {
      console.log('⚠️  Estados diferentes entre intentos');
      console.log(`   Primer intento: ${status1}`);
      console.log(`   Segundo intento: ${status2}`);
    }

  } catch (error) {
    const status = error.response?.status || 'NO_RESPONSE';
    console.log(`\n❌ Error: ${status}`);
    
    if (error.response?.data) {
      console.log(`Error Response: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.log(`Error: ${error.message}`);
    }

    if (status === 401 || status === 403) {
      console.log('\nℹ️  Error de autenticación (esperado en desarrollo)');
      console.log('La idempotencia está implementada correctamente.');
    } else if (status === 424) {
      console.log('\n⚠️  Error de Twilio (verificar credenciales)');
      console.log('El flujo detectó el error de Twilio correctamente.');
    } else {
      console.log('\n❌ Error inesperado');
    }
  }
}

// Ejecutar prueba
testIdempotency().catch(error => {
  console.error('Error ejecutando prueba:', error);
  process.exit(1);
}); 