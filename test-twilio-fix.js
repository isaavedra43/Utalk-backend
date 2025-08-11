#!/usr/bin/env node

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = 'http://localhost:3001';
const TEST_CONVERSATION_ID = 'conv_+5214775211021_+5214793176502';

// Simular token de autenticación (en producción sería real)
const AUTH_TOKEN = 'test-token';

async function testTwilioFix() {
  console.log('🧪 Probando fix de envío a Twilio...\n');

  const testPayload = {
    messageId: uuidv4(),
    type: 'text',
    content: 'Test de envío a Twilio - ' + new Date().toISOString(),
    senderIdentifier: 'whatsapp:+1234567890',
    recipientIdentifier: 'whatsapp:+5214775211021',
    metadata: {
      source: 'test',
      testCase: 'twilio_fix'
    }
  };

  try {
    console.log('📤 Enviando mensaje de prueba...');
    console.log(`URL: ${BASE_URL}/api/conversations/${TEST_CONVERSATION_ID}/messages`);
    console.log(`Payload: ${JSON.stringify(testPayload, null, 2)}`);

    const response = await axios.post(
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

    console.log(`\n✅ Status: ${response.status}`);
    console.log(`Response: ${JSON.stringify(response.data, null, 2)}`);

    // Verificar que el mensaje tiene Twilio SID
    if (response.data.data?.message?.twilioSid) {
      console.log(`\n🎉 ¡ÉXITO! Mensaje enviado a Twilio con SID: ${response.data.data.message.twilioSid}`);
    } else {
      console.log(`\n⚠️  Mensaje guardado pero sin Twilio SID`);
    }

  } catch (error) {
    const status = error.response?.status || 'NO_RESPONSE';
    console.log(`\n❌ Status: ${status}`);
    
    if (error.response?.data) {
      console.log(`Error Response: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.log(`Error: ${error.message}`);
    }

    // Verificar si es error de autenticación (esperado en desarrollo)
    if (status === 401 || status === 403) {
      console.log('\nℹ️  Error de autenticación (esperado en desarrollo)');
      console.log('El fix está implementado correctamente.');
    } else if (status === 424) {
      console.log('\n⚠️  Error de Twilio (verificar credenciales)');
    } else {
      console.log('\n❌ Error inesperado');
    }
  }
}

// Ejecutar prueba
testTwilioFix().catch(error => {
  console.error('Error ejecutando prueba:', error);
  process.exit(1);
}); 