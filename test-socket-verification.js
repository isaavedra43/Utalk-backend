/**
 * 🧪 VERIFICACIÓN DE SOCKET MANAGER
 * 
 * Script para verificar que getSocketManager() retorna una instancia válida
 * con todos los métodos necesarios.
 */

const socketIndex = require('./src/socket');

console.log('🔍 VERIFICACIÓN DE SOCKET MANAGER');
console.log('================================');

// 1. Verificar que getSocketManager existe
console.log('1. getSocketManager existe:', typeof socketIndex.getSocketManager === 'function');

// 2. Obtener instancia
const manager = socketIndex.getSocketManager();
console.log('2. getSocketManager() retorna:', typeof manager);
console.log('   Es null:', manager === null);

if (manager) {
  console.log('3. Métodos disponibles:');
  console.log('   - broadcastToConversation:', typeof manager.broadcastToConversation);
  console.log('   - emitNewMessage:', typeof manager.emitNewMessage);
  console.log('   - emitConversationUpdated:', typeof manager.emitConversationUpdated);
  console.log('   - io:', typeof manager.io);
  
  // 4. Probar delegadores
  console.log('\n4. Probando delegadores:');
  
  const testResult = socketIndex.broadcastToConversation({
    workspaceId: 'default',
    tenantId: 'na',
    conversationId: 'conv_TEST',
    event: 'diagnostic.ping',
    payload: { ok: true, ts: new Date().toISOString() }
  });
  
  console.log('   broadcastToConversation result:', testResult);
  
  // 5. Verificar que es una instancia de EnterpriseSocketManager
  console.log('\n5. Verificando tipo de instancia:');
  console.log('   Constructor name:', manager.constructor?.name);
  console.log('   Es EnterpriseSocketManager:', manager.constructor?.name === 'EnterpriseSocketManager');
  
} else {
  console.log('❌ Socket manager no está inicializado');
  console.log('   Esto puede ser normal si el servidor no ha arrancado completamente');
}

console.log('\n✅ Verificación completada'); 