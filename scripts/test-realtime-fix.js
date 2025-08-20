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
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🚀 PROBANDO SOLUCIÓN DE TIEMPO REAL' });
  console.log('=' .repeat(50));
  
  return new Promise((resolve) => {
    const socket = createTestSocket();
    
    socket.on('connect', () => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ WebSocket conectado exitosamente' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Socket ID:', socket.id });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - URL:', TEST_CONFIG.wsUrl });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🔍 Escuchando eventos de nuevas conversaciones...' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '💡 Envía un mensaje de WhatsApp para probar' });
    });

    socket.on('disconnect', (reason) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔌 WebSocket desconectado:', reason });
    });

    socket.on('error', (error) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '❌ Error de WebSocket:', error });
    });

    // Escuchar eventos de nuevas conversaciones
    socket.on('conversation-event', (data) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n🎉 EVENTO DE CONVERSACIÓN RECIBIDO:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Conversation ID:', data.conversationId });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Last Message:', data.lastMessage });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Updated At:', data.updatedAt });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Unread Count:', data.unreadCount });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Is New Conversation:', data.isNewConversation });
    });

    socket.on('new-message', (data) => {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📨 NUEVO MENSAJE RECIBIDO:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Conversation ID:', data.conversationId });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Message ID:', data.message?.id });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Content:', data.message?.content });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Sender:', data.message?.sender });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  - Is New Conversation:', data.isNewConversation });
    });

    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⏰ Esperando 60 segundos para eventos...' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '💡 Envía un mensaje de WhatsApp durante este tiempo para probar' });
    
    setTimeout(() => {
      socket.disconnect();
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n✅ PRUEBA COMPLETADA' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '\n📋 RESULTADO:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Si recibiste eventos de nuevas conversaciones,' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  la solución está funcionando correctamente.' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '- Si no recibiste eventos, verifica que el backend' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '  esté procesando los mensajes de WhatsApp.' });
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