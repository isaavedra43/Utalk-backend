/**
 * 🧪 SCRIPT DE PRUEBA: Nuevo endpoint send-with-file-ids
 * 
 * Este script prueba el nuevo endpoint que debería funcionar
 */

const axios = require('axios');

async function testNewEndpoint() {
  console.log('🧪 Probando nuevo endpoint /send-with-file-ids...\n');

  const BASE_URL = 'https://utalk-backend-production.up.railway.app';
  
  // Payload exacto que envía el frontend
  const payload = {
    "conversationId": "conv_+5214773790184_+5214793176502",
    "content": "",
    "attachments": [
      {
        "id": "84a3df11-78be-4e79-b690-b899c3fb295e",
        "type": "image"
      }
    ]
  };

  try {
    console.log('📤 Enviando payload al nuevo endpoint...');
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(
      `${BASE_URL}/api/messages/send-with-file-ids`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_TOKEN_HERE' // Reemplazar con token válido
        },
        timeout: 10000
      }
    );

    console.log('✅ ÉXITO - Respuesta del nuevo endpoint:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.log('❌ ERROR - Detalles del error:');
    console.log('Status:', error.response?.status);
    console.log('Data:', JSON.stringify(error.response?.data, null, 2));
    console.log('Message:', error.message);
  }
}

// Ejecutar la prueba
testNewEndpoint(); 