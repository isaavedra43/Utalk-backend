/**
 * 🐛 DEBUG - SOCKET MANAGER INICIALIZACIÓN
 * 
 * Script para debuggear por qué el socket manager no se inicializa
 */

console.log('🐛 DEBUG - SOCKET MANAGER INICIALIZACIÓN');
console.log('========================================');

// 1. Verificar que el módulo se puede cargar
console.log('1. Verificando carga del módulo...');
try {
  const { EnterpriseSocketManager } = require('./src/socket/enterpriseSocketManager');
  console.log('   ✅ EnterpriseSocketManager cargado:', typeof EnterpriseSocketManager);
  console.log('   ✅ Es función:', typeof EnterpriseSocketManager === 'function');
  console.log('   ✅ Nombre:', EnterpriseSocketManager.name);
} catch (error) {
  console.error('   ❌ Error cargando EnterpriseSocketManager:', error.message);
  process.exit(1);
}

// 2. Verificar que el socket index funciona
console.log('\n2. Verificando socket index...');
try {
  const socketIndex = require('./src/socket');
  console.log('   ✅ Socket index cargado');
  console.log('   ✅ getSocketManager:', typeof socketIndex.getSocketManager);
  console.log('   ✅ setSocketManager:', typeof socketIndex.setSocketManager);
} catch (error) {
  console.error('   ❌ Error cargando socket index:', error.message);
  process.exit(1);
}

// 3. Verificar que los modelos se pueden cargar
console.log('\n3. Verificando modelos...');
try {
  let User = null;
  let Conversation = null;
  let Message = null;
  
  try {
    User = require('./src/models/User');
    console.log('   ✅ User model cargado');
  } catch (error) {
    console.log('   ⚠️ User model no disponible (esperado en desarrollo):', error.message);
  }
  
  try {
    Conversation = require('./src/models/Conversation');
    console.log('   ✅ Conversation model cargado');
  } catch (error) {
    console.log('   ⚠️ Conversation model no disponible (esperado en desarrollo):', error.message);
  }
  
  try {
    Message = require('./src/models/Message');
    console.log('   ✅ Message model cargado');
  } catch (error) {
    console.log('   ⚠️ Message model no disponible (esperado en desarrollo):', error.message);
  }
} catch (error) {
  console.error('   ❌ Error verificando modelos:', error.message);
}

// 4. Simular la inicialización
console.log('\n4. Simulando inicialización...');
try {
  const { EnterpriseSocketManager } = require('./src/socket/enterpriseSocketManager');
  const socketIndex = require('./src/socket');
  
  // Crear un server mock
  const http = require('http');
  const mockServer = http.createServer();
  
  console.log('   ✅ Server mock creado');
  
  // Intentar crear el manager
  const mgr = new EnterpriseSocketManager(mockServer, { User: null, Conversation: null, Message: null });
  console.log('   ✅ Manager creado:', typeof mgr);
  console.log('   ✅ Constructor name:', mgr.constructor?.name);
  
  // Registrar el manager
  socketIndex.setSocketManager(mgr);
  console.log('   ✅ Manager registrado');
  
  // Verificar que se puede obtener
  const retrievedManager = socketIndex.getSocketManager();
  console.log('   ✅ Manager recuperado:', typeof retrievedManager);
  console.log('   ✅ Es el mismo:', retrievedManager === mgr);
  
  // Limpiar
  mockServer.close();
  
} catch (error) {
  console.error('   ❌ Error en simulación:', error.message);
  console.error('   Stack:', error.stack);
}

console.log('\n✅ DEBUG COMPLETADO'); 