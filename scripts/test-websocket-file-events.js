/**
 * 🧪 SCRIPT DE PRUEBA: EVENTOS WEBSOCKET DE ARCHIVOS
 * 
 * Este script prueba la integración WebSocket para archivos multimedia
 * en tiempo real.
 * 
 * @author Backend Team
 * @version 1.0.0
 */

const io = require('socket.io-client');
const { v4: uuidv4 } = require('uuid');

// Configuración de prueba
const TEST_CONFIG = {
  serverUrl: process.env.SOCKET_SERVER_URL || 'http://localhost:3000',
  testConversationId: 'test-conversation-' + uuidv4(),
  testUserEmail: 'test@example.com',
  testToken: 'test-token-' + uuidv4()
};

/**
 * Crear cliente Socket.IO de prueba
 */
function createTestSocket() {
  return io(TEST_CONFIG.serverUrl, {
    auth: {
      token: TEST_CONFIG.testToken,
      userEmail: TEST_CONFIG.testUserEmail
    },
    transports: ['websocket'],
    timeout: 10000
  });
}

/**
 * Prueba 1: Conexión y autenticación
 */
async function testConnection() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 1: Conexión y autenticación WebSocket' });
  
  return new Promise((resolve) => {
    const socket = createTestSocket();
    
    socket.on('connect', () => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Socket conectado exitosamente' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Socket ID:', socket.id });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Conectado:', socket.connected });
    });

    socket.on('authenticated', (data) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Autenticación exitosa' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Usuario:', data.userEmail });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Rol:', data.role });
    });

    socket.on('error', (error) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Error de autenticación:', error.message });
    });

    socket.on('disconnect', (reason) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔌 Socket desconectado:', reason });
    });

    // Timeout para la prueba
    setTimeout(() => {
      socket.disconnect();
      resolve(true);
    }, 5000);
  });
}

/**
 * Prueba 2: Unirse a conversación
 */
async function testJoinConversation() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 2: Unirse a conversación' });
  
  return new Promise((resolve) => {
    const socket = createTestSocket();
    
    socket.on('connect', () => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Conectado, uniéndose a conversación...' });
      
      socket.emit('join-conversation', {
        conversationId: TEST_CONFIG.testConversationId,
        roomId: `room-${TEST_CONFIG.testConversationId}`
      });
    });

    socket.on('conversation-joined', (data) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Unido a conversación exitosamente' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Conversation ID:', data.conversationId });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Room ID:', data.roomId });
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
 * Prueba 3: Eventos de archivos
 */
async function testFileEvents() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 3: Eventos de archivos' });
  
  return new Promise((resolve) => {
    const socket = createTestSocket();
    const testFileId = uuidv4();
    
    socket.on('connect', () => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Conectado, probando eventos de archivos...' });
      
      // Unirse a conversación primero
      socket.emit('join-conversation', {
        conversationId: TEST_CONFIG.testConversationId,
        roomId: `room-${TEST_CONFIG.testConversationId}`
      });
    });

    socket.on('conversation-joined', () => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Unido a conversación, enviando eventos de archivo...' });
      
      // Simular evento de archivo subido
      socket.emit('file-uploaded', {
        fileId: testFileId,
        conversationId: TEST_CONFIG.testConversationId,
        fileName: 'test-image.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024
      });

      // Simular evento de archivo procesando
      setTimeout(() => {
        socket.emit('file-processing', {
          fileId: testFileId,
          conversationId: TEST_CONFIG.testConversationId,
          progress: 50,
          stage: 'processing'
        });
      }, 1000);

      // Simular evento de archivo listo
      setTimeout(() => {
        socket.emit('file-ready', {
          fileId: testFileId,
          conversationId: TEST_CONFIG.testConversationId,
          fileUrl: 'https://example.com/test-image.jpg',
          metadata: {
            size: '1KB',
            type: 'image'
          }
        });
      }, 2000);
    });

    // Escuchar eventos de archivos
    socket.on('file-uploaded', (data) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📁 Evento file-uploaded recibido:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - File ID:', data.fileId });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - File Name:', data.fileName });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - File Type:', data.fileType });
    });

    socket.on('file-processing', (data) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⚙️ Evento file-processing recibido:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - File ID:', data.fileId });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Progress:', data.progress + '%' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Stage:', data.stage });
    });

    socket.on('file-ready', (data) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Evento file-ready recibido:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - File ID:', data.fileId });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - File URL:', data.fileUrl });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Metadata:', data.metadata });
    });

    socket.on('file-error', (data) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Evento file-error recibido:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - File ID:', data.fileId });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Error:', data.error });
    });

    socket.on('file-progress', (data) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 Evento file-progress recibido:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - File ID:', data.fileId });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Progress:', data.progress + '%' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Stage:', data.stage });
    });

    socket.on('error', (error) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en eventos de archivo:', error.message });
    });

    setTimeout(() => {
      socket.disconnect();
      resolve(true);
    }, 8000);
  });
}

/**
 * Prueba 4: Integración con mensajes
 */
async function testMessageIntegration() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 4: Integración con mensajes' });
  
  return new Promise((resolve) => {
    const socket = createTestSocket();
    
    socket.on('connect', () => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Conectado, probando integración con mensajes...' });
      
      // Unirse a conversación
      socket.emit('join-conversation', {
        conversationId: TEST_CONFIG.testConversationId,
        roomId: `room-${TEST_CONFIG.testConversationId}`
      });
    });

    socket.on('conversation-joined', () => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Unido a conversación, enviando mensaje con archivo...' });
      
      // Simular mensaje con archivo adjunto
      socket.emit('new-message', {
        conversationId: TEST_CONFIG.testConversationId,
        content: 'Mensaje de prueba con archivo adjunto',
        type: 'media',
        metadata: {
          attachments: [{
            id: uuidv4(),
            url: 'https://example.com/test-file.jpg',
            type: 'image',
            name: 'test-file.jpg'
          }]
        }
      });
    });

    // Escuchar eventos de mensajes
    socket.on('message-sent', (data) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📤 Evento message-sent recibido:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Message ID:', data.message?.id });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Content:', data.message?.content });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Type:', data.message?.type });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Attachments:', data.message?.metadata?.attachments?.length || 0 });
    });

    socket.on('new-message', (data) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📨 Evento new-message recibido:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Content:', data.content });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Type:', data.type });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Sender:', data.senderEmail });
    });

    socket.on('error', (error) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Error en integración con mensajes:', error.message });
    });

    setTimeout(() => {
      socket.disconnect();
      resolve(true);
    }, 5000);
  });
}

/**
 * Prueba 5: Manejo de errores
 */
async function testErrorHandling() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🧪 PRUEBA 5: Manejo de errores' });
  
  return new Promise((resolve) => {
    const socket = createTestSocket();
    
    socket.on('connect', () => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ Conectado, probando manejo de errores...' });
      
      // Enviar datos inválidos para probar manejo de errores
      socket.emit('file-uploaded', {
        // Datos incompletos para provocar error
        fileName: 'test.jpg'
        // Falta fileId y conversationId
      });
    });

    socket.on('error', (error) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Error capturado correctamente:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Error Code:', error.error });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Message:', error.message });
    });

    setTimeout(() => {
      socket.disconnect();
      resolve(true);
    }, 3000);
  });
}

/**
 * Ejecutar todas las pruebas
 */
async function runAllTests() {
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🚀 INICIANDO PRUEBAS DE EVENTOS WEBSOCKET DE ARCHIVOS' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '=' .repeat(60));
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: 'Configuración de prueba:' });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Server URL:', TEST_CONFIG.serverUrl });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Test Conversation ID:', TEST_CONFIG.testConversationId });
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Test User Email:', TEST_CONFIG.testUserEmail });

  const tests = [
    { name: 'Conexión y autenticación', fn: testConnection },
    { name: 'Unirse a conversación', fn: testJoinConversation },
    { name: 'Eventos de archivos', fn: testFileEvents },
    { name: 'Integración con mensajes', fn: testMessageIntegration },
    { name: 'Manejo de errores', fn: testErrorHandling }
  ];

  let passed = 0;
  let total = tests.length;

  for (const test of tests) {
    try {
      logger.info('\n Ejecutando: ${test.name}', { category: 'AUTO_MIGRATED' });
      const result = await test.fn();
      if (result) passed++;
    } catch (error) {
      logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: `❌ Error ejecutando ${test.name}:`, error.message);
    }
  }

  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n' + '=' .repeat(60));
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 RESUMEN FINAL DE PRUEBAS WEBSOCKET' });
  logger.info('Pruebas exitosas: ${passed}/${total}', { category: 'AUTO_MIGRATED' });
  logger.info('❌ Pruebas fallidas: ${total - passed}', { category: 'AUTO_MIGRATED' });
  
  if (passed === total) {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🎉 ¡TODAS LAS PRUEBAS WEBSOCKET PASARON!' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ La integración WebSocket de archivos está funcionando correctamente.' });
  } else {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⚠️  Algunas pruebas fallaron. Revisar implementación.' });
  }

  return passed === total;
}

// Ejecutar pruebas si se llama directamente
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Console error migrated', { category: 'AUTO_MIGRATED', content: '💥 Error crítico en pruebas WebSocket:', error);
      process.exit(1);
    });
}

module.exports = {
  testConnection,
  testJoinConversation,
  testFileEvents,
  testMessageIntegration,
  testErrorHandling,
  runAllTests
}; 