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

module.exports = {
  setSocketManager,
  getSocketManager,
  getConversationRoom,
  EV_NEW_MESSAGE,
  EV_CONV_EVENT,
  // Backward compatibility
  EnterpriseSocketManager: require('./enterpriseSocketManager')
};
