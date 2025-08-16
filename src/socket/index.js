/**
 * 🔄 SOCKET MANAGER ACCESSOR
 * 
 * Accessor centralizado para el EnterpriseSocketManager
 * que evita ciclos de import y proporciona acceso global.
 */

let _manager = null;

function setSocketManager(manager) {
  _manager = manager;
  console.log('✅ Socket manager registrado globalmente');
}

function getSocketManager() {
  if (!_manager) {
    console.warn('⚠️ Socket manager no inicializado, retornando null');
    return null;
  }
  return _manager;
}

// Helper para rooms unificadas
function getConversationRoom({ workspaceId, tenantId, conversationId }) {
  return `ws:${workspaceId || 'default'}:ten:${tenantId || 'na'}:conv:${conversationId}`;
}

// Constantes de eventos para compatibilidad
const EV_NEW_MESSAGE = 'new-message';
const EV_CONV_EVENT = 'conversation-event';

// Delegadores seguros para compatibilidad
function broadcastToConversation(args) {
  return _manager?.broadcastToConversation?.(args) ?? false;
}

function emitNewMessage(args) {
  return _manager?.emitNewMessage?.(args) ?? false;
}

function emitConversationUpdated(args) {
  return _manager?.emitConversationUpdated?.(args) ?? false;
}

// 🔧 FUNCIÓN DE PRUEBA: Verificar que el workspaceId se extrae correctamente
function testWorkspaceIdExtraction(socket) {
  if (!socket) {
    console.log('❌ Socket no proporcionado para prueba de workspaceId');
    return false;
  }

  const workspaceId = socket.workspaceId || socket.decodedToken?.workspaceId || 'default';
  const tenantId = socket.tenantId || socket.decodedToken?.tenantId || 'na';
  const userId = socket.userEmail || socket.decodedToken?.email || 'unknown';

  console.log('🔍 PRUEBA WORKSPACEID:', {
    socketId: socket.id,
    userId: userId,
    workspaceId: workspaceId,
    tenantId: tenantId,
    hasWorkspaceId: !!workspaceId,
    hasTenantId: !!tenantId,
    workspaceIdSource: socket.workspaceId ? 'socket.workspaceId' : 
                      socket.decodedToken?.workspaceId ? 'socket.decodedToken.workspaceId' : 'default'
  });

  return workspaceId && workspaceId !== 'default';
}

module.exports = {
  setSocketManager,
  getSocketManager,
  getConversationRoom,
  EV_NEW_MESSAGE,
  EV_CONV_EVENT,
  // Delegadores seguros
  broadcastToConversation,
  emitNewMessage,
  emitConversationUpdated,
  // 🔧 Función de prueba
  testWorkspaceIdExtraction
};
