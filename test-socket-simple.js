/**
 * 🧪 VERIFICACIÓN SIMPLE DE SOCKET MANAGER
 * 
 * Script que solo verifica la estructura del socket sin cargar Firebase
 */

console.log('🔍 VERIFICACIÓN SIMPLE DE SOCKET MANAGER');
console.log('========================================');

try {
  // Solo verificar la estructura del módulo socket
  const socketIndex = require('./src/socket');
  
  console.log('✅ Módulo socket cargado correctamente');
  console.log('1. getSocketManager existe:', typeof socketIndex.getSocketManager === 'function');
  console.log('2. setSocketManager existe:', typeof socketIndex.setSocketManager === 'function');
  console.log('3. broadcastToConversation existe:', typeof socketIndex.broadcastToConversation === 'function');
  console.log('4. emitNewMessage existe:', typeof socketIndex.emitNewMessage === 'function');
  console.log('5. emitConversationUpdated existe:', typeof socketIndex.emitConversationUpdated === 'function');
  console.log('6. EnterpriseSocketManager existe:', typeof socketIndex.EnterpriseSocketManager === 'function');
  
  // Verificar que EnterpriseSocketManager es una clase
  if (socketIndex.EnterpriseSocketManager) {
    console.log('7. EnterpriseSocketManager es constructor:', typeof socketIndex.EnterpriseSocketManager === 'function');
    console.log('8. EnterpriseSocketManager name:', socketIndex.EnterpriseSocketManager.name);
  }
  
  // Probar getSocketManager (debería ser null si el servidor no está corriendo)
  const manager = socketIndex.getSocketManager();
  console.log('9. getSocketManager() retorna:', typeof manager);
  console.log('10. Es null (esperado si servidor no corre):', manager === null);
  
  console.log('\n✅ Verificación de estructura completada');
  
} catch (error) {
  console.error('❌ Error cargando módulo socket:', error.message);
  console.error('Stack:', error.stack);
} 