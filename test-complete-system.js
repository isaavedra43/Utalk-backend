/**
 * 🧪 SCRIPT DE PRUEBA COMPLETA DEL SISTEMA UTalk
 * 
 * Este script prueba:
 * 1. Endpoint GET /api/conversations (con token real)
 * 2. Conexión Socket.IO con autenticación Firebase
 * 3. Simulación de webhook de Twilio
 * 4. Verificación de tiempo real
 */

const axios = require('axios');
const io = require('socket.io-client');

// ✅ CONFIGURACIÓN DE PRUEBA
const CONFIG = {
  // Cambiar por tu URL real
  API_BASE_URL: process.env.API_URL || 'http://localhost:3000',
  
  // TODO: Reemplazar con un token JWT real de Firebase
  // Para obtenerlo, iniciar sesión en el frontend y copiar el token
  FIREBASE_TOKEN: process.env.TEST_FIREBASE_TOKEN || 'REEMPLAZAR_CON_TOKEN_REAL',
  
  // Usuario de prueba
  TEST_USER: {
    uid: 'test-user-uid-123',
    email: 'test@utalk.com',
    role: 'agent',
  },
};

/**
 * ✅ PRUEBA 1: Endpoint GET /api/conversations
 */
async function testConversationsEndpoint() {
  console.log('\n📋 PRUEBA 1: Endpoint GET /api/conversations');
  console.log('==============================================');

  try {
    const response = await axios.get(`${CONFIG.API_BASE_URL}/api/conversations`, {
      headers: {
        'Authorization': `Bearer ${CONFIG.FIREBASE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      params: {
        limit: 10,
      },
    });

    console.log('✅ Endpoint respondió exitosamente');
    console.log('Status:', response.status);
    console.log('Datos recibidos:', {
      success: response.data.success,
      totalConversations: response.data.data?.length || 0,
      hasData: !!response.data.data,
      metadata: response.data.metadata,
    });

    if (response.data.data && response.data.data.length > 0) {
      console.log('\n📨 Estructura de la primera conversación:');
      const firstConv = response.data.data[0];
      console.log({
        id: firstConv.id,
        customerPhone: firstConv.customerPhone,
        agentPhone: firstConv.agentPhone,
        assignedTo: firstConv.assignedTo,
        status: firstConv.status,
        messageCount: firstConv.messageCount,
        lastMessageAt: firstConv.lastMessageAt,
        createdAt: firstConv.createdAt,
        hasParticipants: !!firstConv.participants,
        hasContact: !!firstConv.contact,
      });

      // Verificar estructura de fechas
      const dateFields = ['createdAt', 'updatedAt', 'lastMessageAt'];
      dateFields.forEach(field => {
        const value = firstConv[field];
        if (value) {
          const isISOString = typeof value === 'string' && value.includes('T') && value.includes('Z');
          console.log(`${field}: ${isISOString ? '✅' : '❌'} ${typeof value} - ${value}`);
        }
      });
    } else {
      console.log('⚠️ No se encontraron conversaciones');
      console.log('Posibles causas:');
      console.log('- No hay conversaciones asignadas a este usuario');
      console.log('- El usuario no tiene permisos');
      console.log('- Las conversaciones no tienen assignedTo válido');
    }

    return { success: true, data: response.data };

  } catch (error) {
    console.error('❌ Error en endpoint /api/conversations:');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n🔑 TOKEN ISSUE:');
      console.log('- Verifica que FIREBASE_TOKEN sea válido');
      console.log('- Inicia sesión en el frontend y copia el token');
      console.log('- Asegúrate de que el token no haya expirado');
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * ✅ PRUEBA 2: Conexión Socket.IO con Firebase Auth
 */
async function testSocketIOConnection() {
  console.log('\n🔌 PRUEBA 2: Conexión Socket.IO');
  console.log('====================================');

  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log('❌ Timeout: Socket.IO no se conectó en 10 segundos');
        resolve({ success: false, error: 'Connection timeout' });
      }
    }, 10000);

    try {
      const socket = io(CONFIG.API_BASE_URL, {
        auth: {
          token: CONFIG.FIREBASE_TOKEN, // Enviar token en auth
        },
        query: {
          token: CONFIG.FIREBASE_TOKEN, // También en query por compatibilidad
        },
        transports: ['websocket', 'polling'],
        timeout: 5000,
      });

      socket.on('connect', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          console.log('✅ Socket.IO conectado exitosamente');
          console.log('Socket ID:', socket.id);
          
          // Probar evento de prueba
          socket.emit('ping', (response) => {
            console.log('✅ Ping recibido:', response);
          });

          socket.disconnect();
          resolve({ success: true, socketId: socket.id });
        }
      });

      socket.on('connect_error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          console.error('❌ Error de conexión Socket.IO:', error.message);
          
          if (error.message.includes('authentication') || error.message.includes('Token')) {
            console.log('\n🔑 AUTHENTICATION ISSUE:');
            console.log('- Verifica que el token Firebase sea válido');
            console.log('- El backend debe validar tokens con Firebase Admin SDK');
            console.log('- Revisa logs del servidor para más detalles');
          }
          
          resolve({ success: false, error: error.message });
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('🔌 Socket desconectado:', reason);
      });

    } catch (error) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.error('❌ Error creando socket:', error.message);
        resolve({ success: false, error: error.message });
      }
    }
  });
}

/**
 * ✅ PRUEBA 3: Simular webhook de Twilio
 */
async function testTwilioWebhook() {
  console.log('\n📨 PRUEBA 3: Webhook de Twilio');
  console.log('===============================');

  const webhookData = {
    MessageSid: `SMtest${Date.now()}`,
    From: 'whatsapp:+5214773790184',
    To: 'whatsapp:+5214793176502',
    Body: `Mensaje de prueba desde script - ${new Date().toISOString()}`,
    NumMedia: '0',
    ProfileName: 'Test Usuario',
    WaId: '5214773790184',
  };

  try {
    console.log('📤 Enviando webhook simulado...');
    
    const response = await axios.post(
      `${CONFIG.API_BASE_URL}/api/messages/webhook`,
      new URLSearchParams(webhookData).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'TwilioProxy/1.1',
        },
        timeout: 30000,
      }
    );

    console.log('✅ Webhook procesado exitosamente');
    console.log('Status:', response.status);
    console.log('Respuesta:', response.data);

    // Esperar un poco para que se procese
    console.log('⏳ Esperando procesamiento...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    return { 
      success: true, 
      data: response.data,
      webhookData: webhookData,
    };

  } catch (error) {
    console.error('❌ Error en webhook:');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
    
    return { success: false, error: error.message };
  }
}

/**
 * ✅ PRUEBA 4: Verificar que la conversación aparezca después del webhook
 */
async function testConversationAfterWebhook() {
  console.log('\n🔄 PRUEBA 4: Verificar conversación después del webhook');
  console.log('=====================================================');

  // Esperar un poco más para asegurar procesamiento
  await new Promise(resolve => setTimeout(resolve, 3000));

  return await testConversationsEndpoint();
}

/**
 * ✅ FUNCIÓN PRINCIPAL
 */
async function runCompleteTest() {
  console.log('🧪 INICIANDO PRUEBA COMPLETA DEL SISTEMA UTalk');
  console.log('==============================================');
  console.log('API Base URL:', CONFIG.API_BASE_URL);
  console.log('Token configurado:', CONFIG.FIREBASE_TOKEN ? 'SI' : 'NO');
  
  if (CONFIG.FIREBASE_TOKEN === 'REEMPLAZAR_CON_TOKEN_REAL') {
    console.log('\n⚠️ ADVERTENCIA: Usando token de prueba');
    console.log('Para pruebas reales, configura FIREBASE_TOKEN con un token válido');
    console.log('Ejemplo: TEST_FIREBASE_TOKEN=eyJhbGciOiJSUzI1NiIs... node test-complete-system.js');
  }

  const results = {
    conversations: null,
    socket: null,
    webhook: null,
    conversationsAfter: null,
  };

  try {
    // ✅ PRUEBA 1: Endpoint de conversaciones ANTES del webhook
    console.log('\n🔍 Estado inicial del sistema...');
    results.conversations = await testConversationsEndpoint();

    // ✅ PRUEBA 2: Socket.IO
    results.socket = await testSocketIOConnection();

    // ✅ PRUEBA 3: Webhook
    results.webhook = await testTwilioWebhook();

    // ✅ PRUEBA 4: Conversaciones DESPUÉS del webhook
    if (results.webhook.success) {
      results.conversationsAfter = await testConversationAfterWebhook();
    }

    // ✅ RESUMEN FINAL
    console.log('\n🎯 RESUMEN DE RESULTADOS');
    console.log('========================');
    console.log(`Endpoint inicial: ${results.conversations.success ? '✅' : '❌'}`);
    console.log(`Socket.IO: ${results.socket.success ? '✅' : '❌'}`);
    console.log(`Webhook: ${results.webhook.success ? '✅' : '❌'}`);
    console.log(`Endpoint final: ${results.conversationsAfter?.success ? '✅' : '❌'}`);

    const allSuccess = results.conversations.success && 
                      results.socket.success && 
                      results.webhook.success && 
                      results.conversationsAfter?.success;

    if (allSuccess) {
      console.log('\n🎉 ¡TODAS LAS PRUEBAS EXITOSAS!');
      console.log('El sistema UTalk funciona correctamente');
      
      // Verificar que el webhook generó una nueva conversación
      const initialCount = results.conversations.data?.data?.length || 0;
      const finalCount = results.conversationsAfter.data?.data?.length || 0;
      
      if (finalCount > initialCount) {
        console.log(`✅ Nueva conversación creada: ${finalCount - initialCount} conversación(es)`);
      }
    } else {
      console.log('\n❌ ALGUNAS PRUEBAS FALLARON');
      console.log('Revisa los errores arriba y corrige los problemas');
    }

    console.log('\n📝 SIGUIENTES PASOS:');
    if (!results.conversations.success) {
      console.log('- Corregir endpoint /api/conversations');
      console.log('- Verificar autenticación y filtros assignedTo');
    }
    if (!results.socket.success) {
      console.log('- Corregir autenticación Socket.IO');
      console.log('- Verificar configuración CORS');
    }
    if (!results.webhook.success) {
      console.log('- Corregir procesamiento de webhook');
      console.log('- Verificar TwilioService.processIncomingMessage');
    }

  } catch (error) {
    console.error('\n💥 ERROR CRÍTICO:', error.message);
    console.error(error.stack);
  }
}

// ✅ EJECUTAR SI SE LLAMA DIRECTAMENTE
if (require.main === module) {
  runCompleteTest();
}

module.exports = {
  testConversationsEndpoint,
  testSocketIOConnection,
  testTwilioWebhook,
  runCompleteTest,
}; 