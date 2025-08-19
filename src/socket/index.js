const logger = require('../utils/logger');
/**
 * 🔄 SOCKET MANAGER ACCESSOR
 * 
 * Accessor centralizado para el EnterpriseSocketManager
 * que evita ciclos de import y proporciona acceso global.
 */

let _manager = null;

function setSocketManager(manager) {
  _manager = manager;
  logger.info('Socket manager registrado globalmente', { category: 'SOCKET_MANAGER_REGISTRADO_GLOB' });
}

function getSocketManager() {
  if (!_manager) {
    logger.warn('⚠️ Socket manager no inicializado, retornando null', { category: '_SOCKET_MANAGER_NO_INICIALIZAD' });
    return null;
  }
  return _manager;
}

// Helper para rooms unificadas
function getConversationRoom({ workspaceId, tenantId, conversationId }) {
  return `ws:${workspaceId || 'default_workspace'}:ten:${tenantId || 'default_tenant'}:conv:${conversationId}`;
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
    logger.error('Socket no proporcionado para prueba de workspaceId', { category: 'SOCKET_NO_PROPORCIONADO_PARA_P' });
    return false;
  }

  const workspaceId = socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace';
  const tenantId = socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant';
  const userId = socket.userEmail || socket.decodedToken?.email || 'unknown';

  logger.debug('PRUEBA WORKSPACEID:', { category: 'PRUEBA_WORKSPACEID_', 
    socketId: socket.id,
    userId: userId,
    workspaceId: workspaceId,
    tenantId: tenantId,
    hasWorkspaceId: !!workspaceId,
    hasTenantId: !!tenantId,
    workspaceIdSource: socket.workspaceId ? 'socket.workspaceId' : 
                      socket.decodedToken?.workspaceId ? 'socket.decodedToken.workspaceId' : 'default_workspace'
   });

  return workspaceId && workspaceId !== 'default_workspace';
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
