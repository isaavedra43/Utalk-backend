#!/usr/bin/env node

/**
 * 🧪 SCRIPT DE PRUEBA: Verificar solución de tiempo real
 * 
 * Este script prueba la solución implementada para el problema
 * de tiempo real en conversaciones.
 */

const io = require('socket.io-client');

// Configuración
const TEST_CONFIG = {
  wsUrl: 'wss://utalk-backend-production.up.railway.app',
  testToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQGNvbXBhbnkuY29tIiwicm9sZSI6ImFkbWluIiwibmFtZSI6IkFkbWluaXN0cmFkb3IgZGVsIFNpc3RlbWEiLCJ0eXBlIjoiYWNjZXNzIiwidXNlcklkIjoiYWRtaW5AY29tcGFueS5jb20iLCJ3b3Jrc3BhY2VJZCI6ImRlZmF1bHRfd29ya3NwYWNlIiwidGVuYW50SWQiOiJkZWZhdWx0X3RlbmFudCIsImlhdCI6MTc1NTQwMDgxMCwiZXhwIjoxNzU1NDAxNzEwLCJhdWQiOiJ1dGFsay1hcGkiLCJpc3MiOiJ1dGFsay1iYWNrZW5kIn0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8' // Token de ejemplo
};

/**
 * Función auxiliar para crear socket conectado
 */
function createTestSocket() {
  const socket = io(TEST_CONFIG.wsUrl, {
    auth: {
      token: TEST_CONFIG.testToken
    },
    transports: ['websocket'],
    timeout: 30000
  });

  return socket;
}

/**
 * Prueba principal
 */
async function testRealtimeFix() {
  console.log('🚀 PROBANDO SOLUCIÓN DE TIEMPO REAL');
  console.log('=' .repeat(50));
  
  return new Promise((resolve) => {
    const socket = createTestSocket();
    
    socket.on('connect', () => {
      console.log('✅ WebSocket conectado exitosamente');
      console.log('  - Socket ID:', socket.id);
      console.log('  - URL:', TEST_CONFIG.wsUrl);
      console.log('\n🔍 Escuchando eventos de nuevas conversaciones...');
      console.log('💡 Envía un mensaje de WhatsApp para probar');
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket desconectado:', reason);
    });

    socket.on('error', (error) => {
      console.log('❌ Error de WebSocket:', error);
    });

    // Escuchar eventos de nuevas conversaciones
    socket.on('conversation-event', (data) => {
      console.log('\n🎉 EVENTO DE CONVERSACIÓN RECIBIDO:');
      console.log('  - Conversation ID:', data.conversationId);
      console.log('  - Last Message:', data.lastMessage);
      console.log('  - Updated At:', data.updatedAt);
      console.log('  - Unread Count:', data.unreadCount);
      console.log('  - Is New Conversation:', data.isNewConversation);
    });

    socket.on('new-message', (data) => {
      console.log('\n📨 NUEVO MENSAJE RECIBIDO:');
      console.log('  - Conversation ID:', data.conversationId);
      console.log('  - Message ID:', data.message?.id);
      console.log('  - Content:', data.message?.content);
      console.log('  - Sender:', data.message?.sender);
      console.log('  - Is New Conversation:', data.isNewConversation);
    });

    console.log('⏰ Esperando 60 segundos para eventos...');
    console.log('💡 Envía un mensaje de WhatsApp durante este tiempo para probar');
    
    setTimeout(() => {
      socket.disconnect();
      console.log('\n✅ PRUEBA COMPLETADA');
      console.log('\n📋 RESULTADO:');
      console.log('- Si recibiste eventos de nuevas conversaciones,');
      console.log('  la solución está funcionando correctamente.');
      console.log('- Si no recibiste eventos, verifica que el backend');
      console.log('  esté procesando los mensajes de WhatsApp.');
      resolve(true);
    }, 60000);
  });
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  testRealtimeFix().catch(console.error);
}

module.exports = {
  testRealtimeFix
}; 