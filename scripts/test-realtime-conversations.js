#!/usr/bin/env node

/**
 * 🧪 SCRIPT DE PRUEBA: Verificar tiempo real en conversaciones
 * 
 * Este script prueba:
 * 1. Conexión WebSocket
 * 2. Unirse a conversaciones existentes
 * 3. Verificar si se reciben eventos de nuevas conversaciones
 * 4. Simular un nuevo mensaje de WhatsApp
 */

const io = require('socket.io-client');
const axios = require('axios');

// Configuración
const TEST_CONFIG = {
  backendUrl: 'https://utalk-backend-production.up.railway.app',
  wsUrl: 'wss://utalk-backend-production.up.railway.app',
  testUser: {
    email: 'admin@company.com',
    password: 'admin123'
  },
  testConversationId: 'conv_+5214773790184_+5214793176502'
};

let authToken = null;

/**
 * Función auxiliar para obtener token de autenticación
 */
async function getAuthToken() {
  try {
    console.log('🔐 Obteniendo token de autenticación...');
    
    const response = await axios.post(`${TEST_CONFIG.backendUrl}/api/auth/login`, {
      email: TEST_CONFIG.testUser.email,
      password: TEST_CONFIG.testUser.password
    });

    if (response.data.success && response.data.data.accessToken) {
      authToken = response.data.data.accessToken;
      console.log('✅ Token obtenido exitosamente');
      return authToken;
    } else {
      throw new Error('No se pudo obtener el token de acceso');
    }
  } catch (error) {
    console.error('❌ Error obteniendo token:', error.message);
    throw error;
  }
}

/**
 * Función auxiliar para crear socket conectado
 */
function createTestSocket() {
  if (!authToken) {
    throw new Error('Token de autenticación requerido');
  }

  const socket = io(TEST_CONFIG.wsUrl, {
    auth: {
      token: authToken
    },
    transports: ['websocket'],
    timeout: 30000
  });

  return socket;
}

/**
 * Prueba 1: Conexión WebSocket
 */
async function testConnection() {
  console.log('\n🧪 PRUEBA 1: Conexión WebSocket');
  
  return new Promise((resolve) => {
    const socket = createTestSocket();
    
    socket.on('connect', () => {
      console.log('✅ WebSocket conectado exitosamente');
      console.log('  - Socket ID:', socket.id);
      console.log('  - URL:', TEST_CONFIG.wsUrl);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket desconectado:', reason);
    });

    socket.on('error', (error) => {
      console.log('❌ Error de WebSocket:', error);
    });

    setTimeout(() => {
      socket.disconnect();
      resolve(true);
    }, 3000);
  });
}

/**
 * Prueba 2: Unirse a conversación existente
 */
async function testJoinConversation() {
  console.log('\n🧪 PRUEBA 2: Unirse a conversación existente');
  
  return new Promise((resolve) => {
    const socket = createTestSocket();
    
    socket.on('connect', () => {
      console.log('✅ Conectado, uniéndose a conversación...');
      
      socket.emit('join-conversation', {
        conversationId: TEST_CONFIG.testConversationId
      });
    });

    socket.on('conversation-joined', (data) => {
      console.log('✅ Unido a conversación exitosamente');
      console.log('  - Conversation ID:', data.conversationId);
      console.log('  - Room ID:', data.roomId);
      console.log('  - Online Users:', data.onlineUsers);
    });

    socket.on('error', (error) => {
      console.log('❌ Error uniéndose a conversación:', error.message);
    });

    setTimeout(() => {
      socket.disconnect();
      resolve(true);
    }, 5000);
  });
}

/**
 * Prueba 3: Escuchar eventos de nuevas conversaciones
 */
async function testNewConversationEvents() {
  console.log('\n🧪 PRUEBA 3: Escuchar eventos de nuevas conversaciones');
  
  return new Promise((resolve) => {
    const socket = createTestSocket();
    
    socket.on('connect', () => {
      console.log('✅ Conectado, escuchando eventos de conversaciones...');
      
      // Unirse a conversación existente para estar en el workspace
      socket.emit('join-conversation', {
        conversationId: TEST_CONFIG.testConversationId
      });
    });

    socket.on('conversation-joined', (data) => {
      console.log('✅ Unido a conversación base');
      console.log('🔍 Ahora escuchando eventos de nuevas conversaciones...');
    });

    // Escuchar eventos de nuevas conversaciones
    socket.on('conversation-event', (data) => {
      console.log('🎉 EVENTO DE NUEVA CONVERSACIÓN RECIBIDO:');
      console.log('  - Conversation ID:', data.conversationId);
      console.log('  - Last Message:', data.lastMessage);
      console.log('  - Updated At:', data.updatedAt);
      console.log('  - Unread Count:', data.unreadCount);
    });

    socket.on('new-message', (data) => {
      console.log('📨 NUEVO MENSAJE RECIBIDO:');
      console.log('  - Conversation ID:', data.conversationId);
      console.log('  - Message ID:', data.message?.id);
      console.log('  - Content:', data.message?.content);
      console.log('  - Sender:', data.message?.sender);
    });

    socket.on('error', (error) => {
      console.log('❌ Error en eventos:', error.message);
    });

    console.log('⏰ Esperando 30 segundos para eventos...');
    console.log('💡 Envía un mensaje de WhatsApp durante este tiempo para probar');
    
    setTimeout(() => {
      socket.disconnect();
      resolve(true);
    }, 30000);
  });
}

/**
 * Prueba 4: Verificar conversaciones existentes
 */
async function testExistingConversations() {
  console.log('\n🧪 PRUEBA 4: Verificar conversaciones existentes');
  
  try {
    const response = await axios.get(`${TEST_CONFIG.backendUrl}/api/conversations`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      params: {
        limit: 10,
        status: 'all'
      }
    });

    if (response.data.success) {
      const conversations = response.data.data.conversations || [];
      console.log(`✅ Encontradas ${conversations.length} conversaciones:`);
      
      conversations.forEach((conv, index) => {
        console.log(`  ${index + 1}. ${conv.id}`);
        console.log(`     - Status: ${conv.status}`);
        console.log(`     - Last Message: ${conv.lastMessage?.content || 'N/A'}`);
        console.log(`     - Message Count: ${conv.messageCount || 0}`);
      });

      return conversations;
    } else {
      throw new Error('No se pudieron obtener las conversaciones');
    }
  } catch (error) {
    console.error('❌ Error obteniendo conversaciones:', error.message);
    throw error;
  }
}

/**
 * Prueba 5: Unirse a todas las conversaciones
 */
async function testJoinAllConversations() {
  console.log('\n🧪 PRUEBA 5: Unirse a todas las conversaciones');
  
  try {
    const conversations = await testExistingConversations();
    
    return new Promise((resolve) => {
      const socket = createTestSocket();
      
      socket.on('connect', () => {
        console.log('✅ Conectado, uniéndose a todas las conversaciones...');
        
        // Unirse a todas las conversaciones
        conversations.forEach((conv, index) => {
          setTimeout(() => {
            console.log(`🔗 Uniéndose a conversación ${index + 1}: ${conv.id}`);
            socket.emit('join-conversation', {
              conversationId: conv.id
            });
          }, index * 500); // Espaciar las uniones
        });
      });

      socket.on('conversation-joined', (data) => {
        console.log(`✅ Unido a: ${data.conversationId}`);
      });

      socket.on('error', (error) => {
        console.log('❌ Error uniéndose:', error.message);
      });

      // Escuchar eventos de nuevas conversaciones
      socket.on('conversation-event', (data) => {
        console.log('🎉 NUEVA CONVERSACIÓN DETECTADA:');
        console.log('  - ID:', data.conversationId);
        console.log('  - Last Message:', data.lastMessage);
      });

      socket.on('new-message', (data) => {
        console.log('📨 NUEVO MENSAJE:');
        console.log('  - Conversation:', data.conversationId);
        console.log('  - Content:', data.message?.content);
      });

      setTimeout(() => {
        socket.disconnect();
        resolve(true);
      }, 15000);
    });
  } catch (error) {
    console.error('❌ Error en prueba de unirse a todas:', error.message);
    throw error;
  }
}

/**
 * Función principal
 */
async function runTests() {
  console.log('🚀 INICIANDO PRUEBAS DE TIEMPO REAL EN CONVERSACIONES');
  console.log('=' .repeat(60));
  
  try {
    // Obtener token de autenticación
    await getAuthToken();
    
    // Ejecutar pruebas
    await testConnection();
    await testJoinConversation();
    await testNewConversationEvents();
    await testJoinAllConversations();
    
    console.log('\n✅ TODAS LAS PRUEBAS COMPLETADAS');
    console.log('\n📋 RESUMEN:');
    console.log('- Si no recibiste eventos de nuevas conversaciones,');
    console.log('  el problema está en que el frontend no se une automáticamente');
    console.log('  a todas las conversaciones cuando carga la lista.');
    console.log('\n🔧 SOLUCIÓN:');
    console.log('- El frontend debe emitir join-conversation para cada');
    console.log('  conversación en la lista cuando se conecta al WebSocket.');
    
  } catch (error) {
    console.error('\n❌ ERROR EN LAS PRUEBAS:', error.message);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runTests();
}

module.exports = {
  runTests,
  testConnection,
  testJoinConversation,
  testNewConversationEvents,
  testExistingConversations,
  testJoinAllConversations
}; 