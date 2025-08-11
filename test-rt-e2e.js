/**
 * 🧪 PRUEBAS E2E - CAPA DE TIEMPO REAL
 * 
 * Script para validar que la emisión RT funciona correctamente
 * tanto en outbound como inbound sin necesidad de GUI.
 */

const axios = require('axios');
const io = require('socket.io-client');

// Configuración
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'your-jwt-token-here';
const CONVERSATION_ID = process.env.TEST_CONVERSATION_ID || 'conv_+1234567890_+0987654321';

// Cliente Socket.IO
let socket = null;

async function connectSocket() {
  console.log('🔌 Conectando Socket.IO...');
  
  socket = io(BASE_URL, {
    auth: { token: AUTH_TOKEN },
    transports: ['websocket']
  });

  return new Promise((resolve, reject) => {
    socket.on('connect', () => {
      console.log('✅ Socket conectado:', socket.id);
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Error conectando socket:', error.message);
      reject(error);
    });

    // Timeout
    setTimeout(() => reject(new Error('Timeout conectando socket')), 10000);
  });
}

async function joinConversation(conversationId) {
  console.log('🚪 Uniéndose a conversación:', conversationId);
  
  return new Promise((resolve, reject) => {
    socket.emit('join-conversation', { conversationId }, (response) => {
      if (response && response.conversationId) {
        console.log('✅ Unido a conversación:', response.roomId);
        resolve(response);
      } else {
        reject(new Error('Error uniéndose a conversación'));
      }
    });

    // Timeout
    setTimeout(() => reject(new Error('Timeout uniéndose a conversación')), 5000);
  });
}

function setupEventListeners() {
  console.log('👂 Configurando listeners de eventos...');
  
  // new-message
  socket.on('new-message', (data) => {
    console.log('📨 EVENTO: new-message recibido');
    console.log('   conversationId:', data.conversationId);
    console.log('   message.id:', data.message?.id);
    console.log('   message.status:', data.message?.status);
    console.log('   correlationId:', data.correlationId);
  });

  // message.created (alias)
  socket.on('message.created', (data) => {
    console.log('📨 EVENTO: message.created recibido');
    console.log('   conversationId:', data.conversationId);
    console.log('   message.id:', data.message?.id);
  });

  // conversation-event
  socket.on('conversation-event', (data) => {
    console.log('💬 EVENTO: conversation-event recibido');
    console.log('   conversationId:', data.conversationId);
    console.log('   lastMessage:', data.lastMessage);
    console.log('   updatedAt:', data.updatedAt);
    console.log('   unreadCount:', data.unreadCount);
  });

  // conversation.updated (alias)
  socket.on('conversation.updated', (data) => {
    console.log('💬 EVENTO: conversation.updated recibido');
    console.log('   conversationId:', data.conversationId);
  });

  // Otros eventos
  socket.on('user-typing', (data) => {
    console.log('⌨️ EVENTO: user-typing recibido');
    console.log('   conversationId:', data.conversationId);
    console.log('   email:', data.email);
  });

  socket.on('message-read-by-user', (data) => {
    console.log('👁️ EVENTO: message-read-by-user recibido');
    console.log('   messageId:', data.messageId);
    console.log('   readBy:', data.readBy);
  });
}

async function testOutboundMessage() {
  console.log('\n🧪 PRUEBA: Envío de mensaje outbound');
  
  const messageData = {
    messageId: `test-msg-${Date.now()}`,
    type: 'text',
    content: 'Mensaje de prueba E2E - ' + new Date().toISOString(),
    senderIdentifier: 'agent:test@example.com',
    recipientIdentifier: 'whatsapp:+1234567890',
    metadata: { source: 'e2e-test' }
  };

  try {
    console.log('📤 Enviando mensaje...');
    const response = await axios.post(
      `${BASE_URL}/api/conversations/${CONVERSATION_ID}/messages`,
      messageData,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Respuesta HTTP:', response.status);
    console.log('   message.id:', response.data?.data?.message?.id);
    console.log('   message.status:', response.data?.data?.message?.status);
    console.log('   twilioSid:', response.data?.data?.message?.twilioSid);

    // Criterios de aceptación
    if (response.status === 201) {
      console.log('✅ CRITERIO: HTTP 201 OK');
    } else {
      console.log('❌ CRITERIO: HTTP 201 esperado, recibido', response.status);
    }

    if (response.data?.data?.message?.status === 'queued' || response.data?.data?.message?.status === 'sent') {
      console.log('✅ CRITERIO: Status queued/sent');
    } else {
      console.log('❌ CRITERIO: Status queued/sent esperado, recibido', response.data?.data?.message?.status);
    }

    return response.data?.data?.message;

  } catch (error) {
    console.error('❌ Error enviando mensaje:', error.response?.data || error.message);
    throw error;
  }
}

async function testInboundWebhook() {
  console.log('\n🧪 PRUEBA: Simulación de webhook inbound');
  
  // Simular webhook de Twilio
  const webhookData = {
    MessageSid: `MG${Date.now()}`,
    From: 'whatsapp:+1234567890',
    To: 'whatsapp:+0987654321',
    Body: 'Mensaje entrante de prueba E2E - ' + new Date().toISOString(),
    ProfileName: 'Usuario Test',
    WaId: '1234567890',
    AccountSid: 'AC1234567890',
    ApiVersion: '2010-04-01'
  };

  try {
    console.log('📥 Enviando webhook...');
    const response = await axios.post(
      `${BASE_URL}/api/webhook/twilio`,
      webhookData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('✅ Respuesta webhook:', response.status);
    console.log('   success:', response.data?.success);
    console.log('   webhookProcessed:', response.data?.webhookProcessed);

    // Criterios de aceptación
    if (response.status === 200) {
      console.log('✅ CRITERIO: HTTP 200 OK');
    } else {
      console.log('❌ CRITERIO: HTTP 200 esperado, recibido', response.status);
    }

    if (response.data?.success === true) {
      console.log('✅ CRITERIO: Webhook procesado exitosamente');
    } else {
      console.log('❌ CRITERIO: Webhook falló');
    }

  } catch (error) {
    console.error('❌ Error en webhook:', error.response?.data || error.message);
    throw error;
  }
}

async function waitForEvents(timeoutMs = 10000) {
  console.log(`⏳ Esperando eventos RT (${timeoutMs}ms)...`);
  
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.log('⏰ Timeout esperando eventos');
      resolve();
    }, timeoutMs);

    // Los eventos se manejan en setupEventListeners()
    // Aquí solo esperamos el timeout
  });
}

async function runTests() {
  console.log('🚀 INICIANDO PRUEBAS E2E - CAPA DE TIEMPO REAL');
  console.log('==============================================');
  
  try {
    // 1. Conectar Socket.IO
    await connectSocket();
    
    // 2. Configurar listeners
    setupEventListeners();
    
    // 3. Unirse a conversación
    await joinConversation(CONVERSATION_ID);
    
    // 4. Esperar un poco para estabilizar
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 5. Probar outbound
    const sentMessage = await testOutboundMessage();
    await waitForEvents(5000);
    
    // 6. Probar inbound (webhook)
    await testInboundWebhook();
    await waitForEvents(5000);
    
    console.log('\n✅ PRUEBAS COMPLETADAS');
    console.log('📊 RESUMEN:');
    console.log('   - Socket conectado:', !!socket);
    console.log('   - Unido a conversación:', CONVERSATION_ID);
    console.log('   - Mensaje outbound enviado:', !!sentMessage);
    console.log('   - Webhook inbound simulado');
    console.log('   - Eventos RT escuchados (ver logs arriba)');
    
  } catch (error) {
    console.error('\n❌ PRUEBAS FALLARON:', error.message);
    process.exit(1);
  } finally {
    if (socket) {
      socket.disconnect();
      console.log('🔌 Socket desconectado');
    }
    process.exit(0);
  }
}

// Ejecutar si es el script principal
if (require.main === module) {
  runTests();
}

module.exports = {
  connectSocket,
  joinConversation,
  testOutboundMessage,
  testInboundWebhook
}; 