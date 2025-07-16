#!/usr/bin/env node

/**
 * SCRIPT DE TESTING - Webhook de Producción
 * Simula exactamente lo que Twilio envía al webhook
 */

const axios = require('axios');

const WEBHOOK_URL = 'https://utalk-backend-production.up.railway.app/api/messages/webhook';

// Datos de prueba que simula exactamente Twilio
const twilioWebhookData = {
  MessageSid: 'SM1234567890abcdef1234567890abcdef',
  AccountSid: 'AC1234567890abcdef1234567890abcdef',
  From: 'whatsapp:+1234567890',
  To: 'whatsapp:+0987654321',
  Body: 'Hola, este es un mensaje de prueba desde el script',
  NumMedia: '0',
  MessageStatus: 'received',
  ApiVersion: '2010-04-01',
  ProfileName: 'Usuario Test',
  WaId: '1234567890',
};

async function testWebhook () {
  console.log('🔍 TESTING WEBHOOK DE PRODUCCIÓN');
  console.log('================================');
  console.log(`📡 URL: ${WEBHOOK_URL}`);
  console.log('📋 Datos enviados:', twilioWebhookData);
  console.log('');

  try {
    const response = await axios.post(WEBHOOK_URL, twilioWebhookData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'TwilioProxy/1.1',
        'X-Twilio-Signature': 'test-signature', // Opcional para testing
      },
      timeout: 10000,
    });

    console.log('✅ WEBHOOK FUNCIONANDO CORRECTAMENTE');
    console.log(`📊 Status: ${response.status}`);
    console.log('📄 Response:', response.data);
    console.log('');
    console.log('🎉 El webhook está listo para recibir mensajes de Twilio');
  } catch (error) {
    console.log('❌ ERROR EN WEBHOOK');
    console.log(`📊 Status: ${error.response?.status || 'Sin respuesta'}`);
    console.log(`📄 Error: ${error.message}`);

    if (error.response?.status === 502) {
      console.log('');
      console.log('🚨 ERROR 502 - POSIBLES CAUSAS:');
      console.log('1. URL del webhook incorrecta en Twilio Console');
      console.log('2. Servidor Railway no respondiendo');
      console.log('3. Problema de configuración de middleware');
      console.log('');
      console.log('🔧 SOLUCIÓN:');
      console.log('Verificar que la URL en Twilio Console sea exactamente:');
      console.log(`   ${WEBHOOK_URL}`);
    }

    if (error.response?.data) {
      console.log('📄 Response data:', error.response.data);
    }
  }
}

// Ejecutar test
testWebhook().catch(console.error); 