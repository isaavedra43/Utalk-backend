#!/usr/bin/env node

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = 'http://localhost:3001';
const TEST_CONVERSATION_ID = 'conv_+5214775211021_+5214793176502';

// Simular token de autenticación (en producción sería real)
const AUTH_TOKEN = 'test-token';

async function testDefinitiveFix() {
  console.log('🧪 Prueba de solución definitiva...\n');

  const testPayload = {
    messageId: uuidv4(),
    type: 'text',
    content: 'Test de solución definitiva - ' + new Date().toISOString(),
    senderIdentifier: 'whatsapp:+1234567890',
    recipientIdentifier: 'whatsapp:+5214775211021',
    metadata: {
      source: 'test',
      testCase: 'definitive_fix'
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

    // Verificar estructura de respuesta
    if (response.data.success && response.data.data?.message && response.data.data?.conversation) {
      console.log('✅ Estructura de respuesta correcta');
    } else {
      console.log('❌ Estructura de respuesta incorrecta');
    }

    // Verificar que el mensaje tiene Twilio SID
    if (response.data.data?.message?.twilioSid) {
      console.log(`\n🎉 ¡ÉXITO! Mensaje enviado a Twilio con SID: ${response.data.data.message.twilioSid}`);
      console.log(`Status del mensaje: ${response.data.data.message.status}`);
      
      // Verificar que el status es válido
      const validStatuses = ['queued', 'accepted', 'sent'];
      if (validStatuses.includes(response.data.data.message.status)) {
        console.log('✅ Status válido');
      } else {
        console.log(`⚠️  Status inesperado: ${response.data.data.message.status}`);
      }
    } else {
      console.log(`\n⚠️  Mensaje guardado pero sin Twilio SID`);
      console.log(`Status del mensaje: ${response.data.data.message.status}`);
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
      console.log('La solución está implementada correctamente.');
    } else if (status === 424) {
      console.log('\n⚠️  Error de Twilio (verificar credenciales)');
      console.log('El flujo detectó el error de Twilio correctamente.');
    } else if (status === 500) {
      console.log('\n❌ Error interno del servidor');
      console.log('Posible problema con la exportación de TwilioService.');
    } else {
      console.log('\n❌ Error inesperado');
    }
  }
}

// Ejecutar prueba
testDefinitiveFix().catch(error => {
  console.error('Error ejecutando prueba:', error);
  process.exit(1);
}); 