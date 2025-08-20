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
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔐 Obteniendo token de autenticación...' });
    
    const response = await axios.post(`${TEST_CONFIG.backendUrl}/api/auth/login`, {
      email: TEST_CONFIG.testUser.email,
      password: TEST_CONFIG.testUser.password
    });

    if (response.data.success && response.data.data.accessToken) {
      authToken = response.data.data.accessToken;
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Token obtenido exitosamente' });
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
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 1: Conexión WebSocket' });
  
  return new Promise((resolve) => {
    const socket = createTestSocket();
    
    socket.on('connect', () => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ WebSocket conectado exitosamente' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Socket ID:', socket.id });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - URL:', TEST_CONFIG.wsUrl });
    });

    socket.on('disconnect', (reason) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔌 WebSocket desconectado:', reason });
    });

    socket.on('error', (error) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Error de WebSocket:', error });
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
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 2: Unirse a conversación existente' });
  
  return new Promise((resolve) => {
    const socket = createTestSocket();
    
    socket.on('connect', () => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Conectado, uniéndose a conversación...' });
      
      socket.emit('join-conversation', {
        conversationId: TEST_CONFIG.testConversationId
      });
    });

    socket.on('conversation-joined', (data) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Unido a conversación exitosamente' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Conversation ID:', data.conversationId });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Room ID:', data.roomId });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Online Users:', data.onlineUsers });
    });

    socket.on('error', (error) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Error uniéndose a conversación:', error.message });
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
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 3: Escuchar eventos de nuevas conversaciones' });
  
  return new Promise((resolve) => {
    const socket = createTestSocket();
    
    socket.on('connect', () => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Conectado, escuchando eventos de conversaciones...' });
      
      // Unirse a conversación existente para estar en el workspace
      socket.emit('join-conversation', {
        conversationId: TEST_CONFIG.testConversationId
      });
    });

    socket.on('conversation-joined', (data) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Unido a conversación base' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔍 Ahora escuchando eventos de nuevas conversaciones...' });
    });

    // Escuchar eventos de nuevas conversaciones
    socket.on('conversation-event', (data) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🎉 EVENTO DE NUEVA CONVERSACIÓN RECIBIDO:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Conversation ID:', data.conversationId });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Last Message:', data.lastMessage });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Updated At:', data.updatedAt });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Unread Count:', data.unreadCount });
    });

    socket.on('new-message', (data) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📨 NUEVO MENSAJE RECIBIDO:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Conversation ID:', data.conversationId });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Message ID:', data.message?.id });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Content:', data.message?.content });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Sender:', data.message?.sender });
    });

    socket.on('error', (error) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en eventos:', error.message });
    });

    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⏰ Esperando 30 segundos para eventos...' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '💡 Envía un mensaje de WhatsApp durante este tiempo para probar' });
    
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
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 4: Verificar conversaciones existentes' });
  
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
      logger.info('Encontradas ${conversations.length} conversaciones:', { category: 'AUTO_MIGRATED' });
      
      conversations.forEach((conv, index) => {
        logger.info('${index + 1}. ${conv.id}', { category: 'AUTO_MIGRATED' });
        logger.info('- Status: ${conv.status}', { category: 'AUTO_MIGRATED' });
        logger.info('- Last Message: ${conv.lastMessage?.content || 'N/A'}', { category: 'AUTO_MIGRATED' });
        logger.info('- Message Count: ${conv.messageCount || 0}', { category: 'AUTO_MIGRATED' });
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
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 5: Unirse a todas las conversaciones' });
  
  try {
    const conversations = await testExistingConversations();
    
    return new Promise((resolve) => {
      const socket = createTestSocket();
      
      socket.on('connect', () => {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Conectado, uniéndose a todas las conversaciones...' });
        
        // Unirse a todas las conversaciones
        conversations.forEach((conv, index) => {
          setTimeout(() => {
            logger.info('� Uniéndose a conversación ${index + 1}: ${conv.id}', { category: 'AUTO_MIGRATED' });
            socket.emit('join-conversation', {
              conversationId: conv.id
            });
          }, index * 500); // Espaciar las uniones
        });
      });

      socket.on('conversation-joined', (data) => {
        logger.info('Unido a: ${data.conversationId}', { category: 'AUTO_MIGRATED' });
      });

      socket.on('error', (error) => {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Error uniéndose:', error.message });
      });

      // Escuchar eventos de nuevas conversaciones
      socket.on('conversation-event', (data) => {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🎉 NUEVA CONVERSACIÓN DETECTADA:' });
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - ID:', data.conversationId });
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Last Message:', data.lastMessage });
      });

      socket.on('new-message', (data) => {
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📨 NUEVO MENSAJE:' });
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Conversation:', data.conversationId });
        logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Content:', data.message?.content });
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
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🚀 INICIANDO PRUEBAS DE TIEMPO REAL EN CONVERSACIONES' });
  console.log('=' .repeat(60));
  
  try {
    // Obtener token de autenticación
    await getAuthToken();
    
    // Ejecutar pruebas
    await testConnection();
    await testJoinConversation();
    await testNewConversationEvents();
    await testJoinAllConversations();
    
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n✅ TODAS LAS PRUEBAS COMPLETADAS' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📋 RESUMEN:' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Si no recibiste eventos de nuevas conversaciones,' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  el problema está en que el frontend no se une automáticamente' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  a todas las conversaciones cuando carga la lista.' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🔧 SOLUCIÓN:' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- El frontend debe emitir join-conversation para cada' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  conversación en la lista cuando se conecta al WebSocket.' });
    
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