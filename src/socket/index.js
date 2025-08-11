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
  if (_manager && typeof _manager.broadcastToConversation === 'function') {
    return _manager.broadcastToConversation(args);
  }
  return false;
}

function emitNewMessage(args) {
  if (_manager && typeof _manager.emitNewMessage === 'function') {
    return _manager.emitNewMessage(args);
  }
  return false;
}

function emitConversationUpdated(args) {
  if (_manager && typeof _manager.emitConversationUpdated === 'function') {
    return _manager.emitConversationUpdated(args);
  }
  return false;
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
  // Backward compatibility
  EnterpriseSocketManager: require('./enterpriseSocketManager')
};
