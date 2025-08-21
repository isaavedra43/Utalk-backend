/**
 * 🧪 SCRIPT DE PRUEBA: Envío de mensajes con archivos adjuntos (FIX)
 * 
 * Este script prueba el flujo completo de envío de mensajes con archivos
 * usando IDs de archivos ya subidos (nuevo flujo)
 */

const axios = require('axios');

async function testSendMessageWithFileId() {
  console.log('🧪 Iniciando prueba de envío de mensaje con ID de archivo...\n');

  const BASE_URL = 'https://utalk-backend-production.up.railway.app';
  const conversationId = 'conv_+5214773790184_+5214793176502';
  
  // Token de autenticación (necesitarás obtener uno válido)
  const authToken = 'YOUR_AUTH_TOKEN_HERE'; // Reemplazar con token válido

  try {
    // Paso 1: Subir archivo
    console.log('📁 Paso 1: Subiendo archivo...');
    
    const formData = new FormData();
    formData.append('file', 'test-image.png'); // Archivo de prueba
    formData.append('conversationId', conversationId);
    
    const uploadResponse = await axios.post(`${BASE_URL}/api/media/upload`, formData, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'multipart/form-data'
      }
    });

    console.log('✅ Archivo subido exitosamente:', {
      status: uploadResponse.status,
      fileId: uploadResponse.data?.data?.attachments?.[0]?.id
    });

    // Paso 2: Enviar mensaje con ID de archivo (NUEVO FLUJO)
    console.log('\n📤 Paso 2: Enviando mensaje con ID de archivo...');
    
    const messageData = {
      conversationId: conversationId, // Ahora acepta conv_+phone_+phone
      content: 'Mensaje de prueba con archivo adjunto (usando ID)',
      attachments: [
        {
          id: uploadResponse.data?.data?.attachments?.[0]?.id, // ID del archivo subido
          type: 'image' // Tipo del archivo
        }
      ],
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      }
    };

    console.log('📤 Payload a enviar:', JSON.stringify(messageData, null, 2));

    const messageResponse = await axios.post(`${BASE_URL}/api/messages/send-with-attachments`, messageData, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Mensaje enviado exitosamente:', {
      status: messageResponse.status,
      messageId: messageResponse.data?.data?.messageId,
      twilioSid: messageResponse.data?.data?.twilioSid
    });

    console.log('\n🎉 Prueba completada exitosamente');

  } catch (error) {
    console.error('❌ Error en la prueba:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    if (error.response?.data) {
      console.error('📋 Detalles del error:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Función para obtener token de autenticación
async function getAuthToken() {
  console.log('🔐 Obteniendo token de autenticación...');
  
  try {
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@company.com',
      password: 'admin123' // Reemplazar con credenciales válidas
    });

    return loginResponse.data?.data?.accessToken;
  } catch (error) {
    console.error('❌ Error obteniendo token:', error.message);
    return null;
  }
}

// Ejecutar prueba
testSendMessageWithFileId().catch(console.error); 