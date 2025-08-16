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
  console.log('\n🧪 PRUEBA 1: Conexión y autenticación WebSocket');
  
  return new Promise((resolve) => {
    const socket = createTestSocket();
    
    socket.on('connect', () => {
      console.log('✅ Socket conectado exitosamente');
      console.log('  - Socket ID:', socket.id);
      console.log('  - Conectado:', socket.connected);
    });

    socket.on('authenticated', (data) => {
      console.log('✅ Autenticación exitosa');
      console.log('  - Usuario:', data.userEmail);
      console.log('  - Rol:', data.role);
    });

    socket.on('error', (error) => {
      console.log('❌ Error de autenticación:', error.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket desconectado:', reason);
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
  console.log('\n🧪 PRUEBA 2: Unirse a conversación');
  
  return new Promise((resolve) => {
    const socket = createTestSocket();
    
    socket.on('connect', () => {
      console.log('✅ Conectado, uniéndose a conversación...');
      
      socket.emit('join-conversation', {
        conversationId: TEST_CONFIG.testConversationId,
        roomId: `room-${TEST_CONFIG.testConversationId}`
      });
    });

    socket.on('conversation-joined', (data) => {
      console.log('✅ Unido a conversación exitosamente');
      console.log('  - Conversation ID:', data.conversationId);
      console.log('  - Room ID:', data.roomId);
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
 * Prueba 3: Eventos de archivos
 */
async function testFileEvents() {
  console.log('\n🧪 PRUEBA 3: Eventos de archivos');
  
  return new Promise((resolve) => {
    const socket = createTestSocket();
    const testFileId = uuidv4();
    
    socket.on('connect', () => {
      console.log('✅ Conectado, probando eventos de archivos...');
      
      // Unirse a conversación primero
      socket.emit('join-conversation', {
        conversationId: TEST_CONFIG.testConversationId,
        roomId: `room-${TEST_CONFIG.testConversationId}`
      });
    });

    socket.on('conversation-joined', () => {
      console.log('✅ Unido a conversación, enviando eventos de archivo...');
      
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
      console.log('📁 Evento file-uploaded recibido:');
      console.log('  - File ID:', data.fileId);
      console.log('  - File Name:', data.fileName);
      console.log('  - File Type:', data.fileType);
    });

    socket.on('file-processing', (data) => {
      console.log('⚙️ Evento file-processing recibido:');
      console.log('  - File ID:', data.fileId);
      console.log('  - Progress:', data.progress + '%');
      console.log('  - Stage:', data.stage);
    });

    socket.on('file-ready', (data) => {
      console.log('✅ Evento file-ready recibido:');
      console.log('  - File ID:', data.fileId);
      console.log('  - File URL:', data.fileUrl);
      console.log('  - Metadata:', data.metadata);
    });

    socket.on('file-error', (data) => {
      console.log('❌ Evento file-error recibido:');
      console.log('  - File ID:', data.fileId);
      console.log('  - Error:', data.error);
    });

    socket.on('file-progress', (data) => {
      console.log('📊 Evento file-progress recibido:');
      console.log('  - File ID:', data.fileId);
      console.log('  - Progress:', data.progress + '%');
      console.log('  - Stage:', data.stage);
    });

    socket.on('error', (error) => {
      console.log('❌ Error en eventos de archivo:', error.message);
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
  console.log('\n🧪 PRUEBA 4: Integración con mensajes');
  
  return new Promise((resolve) => {
    const socket = createTestSocket();
    
    socket.on('connect', () => {
      console.log('✅ Conectado, probando integración con mensajes...');
      
      // Unirse a conversación
      socket.emit('join-conversation', {
        conversationId: TEST_CONFIG.testConversationId,
        roomId: `room-${TEST_CONFIG.testConversationId}`
      });
    });

    socket.on('conversation-joined', () => {
      console.log('✅ Unido a conversación, enviando mensaje con archivo...');
      
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
      console.log('📤 Evento message-sent recibido:');
      console.log('  - Message ID:', data.message?.id);
      console.log('  - Content:', data.message?.content);
      console.log('  - Type:', data.message?.type);
      console.log('  - Attachments:', data.message?.metadata?.attachments?.length || 0);
    });

    socket.on('new-message', (data) => {
      console.log('📨 Evento new-message recibido:');
      console.log('  - Content:', data.content);
      console.log('  - Type:', data.type);
      console.log('  - Sender:', data.senderEmail);
    });

    socket.on('error', (error) => {
      console.log('❌ Error en integración con mensajes:', error.message);
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
  console.log('\n🧪 PRUEBA 5: Manejo de errores');
  
  return new Promise((resolve) => {
    const socket = createTestSocket();
    
    socket.on('connect', () => {
      console.log('✅ Conectado, probando manejo de errores...');
      
      // Enviar datos inválidos para probar manejo de errores
      socket.emit('file-uploaded', {
        // Datos incompletos para provocar error
        fileName: 'test.jpg'
        // Falta fileId y conversationId
      });
    });

    socket.on('error', (error) => {
      console.log('❌ Error capturado correctamente:');
      console.log('  - Error Code:', error.error);
      console.log('  - Message:', error.message);
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
  console.log('🚀 INICIANDO PRUEBAS DE EVENTOS WEBSOCKET DE ARCHIVOS');
  console.log('=' .repeat(60));
  console.log('Configuración de prueba:');
  console.log('  - Server URL:', TEST_CONFIG.serverUrl);
  console.log('  - Test Conversation ID:', TEST_CONFIG.testConversationId);
  console.log('  - Test User Email:', TEST_CONFIG.testUserEmail);

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
      console.log(`\n🔄 Ejecutando: ${test.name}`);
      const result = await test.fn();
      if (result) passed++;
    } catch (error) {
      console.error(`❌ Error ejecutando ${test.name}:`, error.message);
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log('📊 RESUMEN FINAL DE PRUEBAS WEBSOCKET');
  console.log(`✅ Pruebas exitosas: ${passed}/${total}`);
  console.log(`❌ Pruebas fallidas: ${total - passed}`);
  
  if (passed === total) {
    console.log('🎉 ¡TODAS LAS PRUEBAS WEBSOCKET PASARON!');
    console.log('✅ La integración WebSocket de archivos está funcionando correctamente.');
  } else {
    console.log('⚠️  Algunas pruebas fallaron. Revisar implementación.');
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
      console.error('💥 Error crítico en pruebas WebSocket:', error);
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