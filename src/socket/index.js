const { Server } = require('socket.io');
const { auth } = require('../config/firebase');
const logger = require('../utils/logger');
const { isValidConversationId } = require('../utils/conversation');

class SocketManager {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.connectedUsers = new Map(); // userId -> socket.id
    this.userRoles = new Map(); // userId -> role
    this.conversationUsers = new Map(); // conversationId -> Set(userIds)

    this.setupMiddleware();
    this.setupEventHandlers();
    
    logger.info('🔌 Socket.IO server inicializado');
  }

  /**
   * Middleware de autenticación para Socket.IO
   */
  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          throw new Error('Token de autenticación requerido');
        }

        // Verificar token con Firebase
        const decodedToken = await auth.verifyIdToken(token);
        const userRecord = await auth.getUser(decodedToken.uid);

        // Agregar información del usuario al socket
        socket.userId = decodedToken.uid;
        socket.userEmail = decodedToken.email;
        socket.userRole = decodedToken.role || 'viewer';
        socket.displayName = userRecord.displayName || decodedToken.email;

        logger.info('🔐 Socket autenticado', {
          userId: socket.userId,
          email: socket.userEmail,
          role: socket.userRole,
          socketId: socket.id
        });

        next();
      } catch (error) {
        logger.error('❌ Error autenticando socket:', error);
        next(new Error('Autenticación fallida'));
      }
    });
  }

  /**
   * Configurar manejadores de eventos
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Manejar nueva conexión
   */
  handleConnection(socket) {
    const { userId, userRole, displayName } = socket;

    // Registrar usuario conectado
    this.connectedUsers.set(userId, socket.id);
    this.userRoles.set(userId, userRole);

    console.log('🔌 USUARIO CONECTADO:', {
      userId,
      role: userRole,
      displayName,
      socketId: socket.id,
      totalConnected: this.connectedUsers.size
    });

    // Unir a sala general por rol
    socket.join(`role-${userRole}`);
    if (userRole === 'admin') {
      socket.join('role-admin');
      socket.join('role-agent'); // Admins ven todo
    }

    // Eventos de conversaciones
    this.setupConversationEvents(socket);
    
    // Eventos de mensajes
    this.setupMessageEvents(socket);

    // Eventos de estado
    this.setupStatusEvents(socket);

    // Manejar desconexión
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    // Evento de prueba/ping
    socket.on('ping', (callback) => {
      callback({ success: true, timestamp: Date.now() });
    });

    // Emitir confirmación de conexión
    socket.emit('connected', {
      userId,
      role: userRole,
      displayName,
      timestamp: Date.now(),
      capabilities: this.getUserCapabilities(userRole)
    });
  }

  /**
   * Configurar eventos de conversaciones
   */
  setupConversationEvents(socket) {
    const { userId, userRole } = socket;

    // Unirse a una conversación específica
    socket.on('join-conversation', (conversationId, callback) => {
      try {
        if (!isValidConversationId(conversationId)) {
          throw new Error('conversationId inválido');
        }

        socket.join(`conversation-${conversationId}`);
        
        // Registrar usuario en la conversación
        if (!this.conversationUsers.has(conversationId)) {
          this.conversationUsers.set(conversationId, new Set());
        }
        this.conversationUsers.get(conversationId).add(userId);

        console.log('👥 USUARIO SE UNIÓ A CONVERSACIÓN:', {
          userId,
          conversationId,
          socketId: socket.id
        });

        logger.info('Usuario se unió a conversación', {
          userId,
          conversationId,
          role: userRole
        });

        if (callback) callback({ success: true, conversationId });
      } catch (error) {
        logger.error('Error uniéndose a conversación:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // Salir de una conversación
    socket.on('leave-conversation', (conversationId, callback) => {
      try {
        socket.leave(`conversation-${conversationId}`);
        
        if (this.conversationUsers.has(conversationId)) {
          this.conversationUsers.get(conversationId).delete(userId);
          
          // Limpiar si no hay usuarios
          if (this.conversationUsers.get(conversationId).size === 0) {
            this.conversationUsers.delete(conversationId);
          }
        }

        console.log('👤 USUARIO SALIÓ DE CONVERSACIÓN:', {
          userId,
          conversationId
        });

        if (callback) callback({ success: true });
      } catch (error) {
        logger.error('Error saliendo de conversación:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // Eventos de escritura (typing indicators)
    socket.on('typing-start', (conversationId) => {
      if (isValidConversationId(conversationId)) {
        socket.to(`conversation-${conversationId}`).emit('user-typing', {
          userId,
          conversationId,
          displayName: socket.displayName,
          timestamp: Date.now()
        });
      }
    });

    socket.on('typing-stop', (conversationId) => {
      if (isValidConversationId(conversationId)) {
        socket.to(`conversation-${conversationId}`).emit('user-stopped-typing', {
          userId,
          conversationId,
          timestamp: Date.now()
        });
      }
    });
  }

  /**
   * Configurar eventos de mensajes
   */
  setupMessageEvents(socket) {
    // El frontend puede solicitar reenvío de mensaje fallido
    socket.on('retry-message', async (messageId, callback) => {
      try {
        // Implementar lógica de reenvío
        logger.info('Solicitud de reenvío de mensaje', { messageId, userId: socket.userId });
        
        if (callback) callback({ success: true, messageId });
      } catch (error) {
        logger.error('Error reenviando mensaje:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });
  }

  /**
   * Configurar eventos de estado
   */
  setupStatusEvents(socket) {
    // Cambiar estado del usuario (online, away, busy)
    socket.on('status-change', (status) => {
      const validStatuses = ['online', 'away', 'busy', 'offline'];
      if (validStatuses.includes(status)) {
        socket.userStatus = status;
        
        // Notificar a otros usuarios relevantes
        this.io.to(`role-${socket.userRole}`).emit('user-status-changed', {
          userId: socket.userId,
          status,
          timestamp: Date.now()
        });

        logger.info('Estado de usuario cambiado', {
          userId: socket.userId,
          status
        });
      }
    });
  }

  /**
   * Manejar desconexión
   */
  handleDisconnection(socket) {
    const { userId, userRole } = socket;

    // Remover de usuarios conectados
    this.connectedUsers.delete(userId);
    this.userRoles.delete(userId);

    // Remover de todas las conversaciones
    for (const [conversationId, users] of this.conversationUsers.entries()) {
      users.delete(userId);
      if (users.size === 0) {
        this.conversationUsers.delete(conversationId);
      }
    }

    console.log('🔌 USUARIO DESCONECTADO:', {
      userId,
      role: userRole,
      socketId: socket.id,
      totalConnected: this.connectedUsers.size
    });

    // Notificar desconexión a usuarios relevantes
    this.io.to(`role-${userRole}`).emit('user-disconnected', {
      userId,
      timestamp: Date.now()
    });

    logger.info('Usuario desconectado', {
      userId,
      role: userRole,
      connectedTime: Date.now() - socket.handshake.time
    });
  }

  /**
   * Obtener capacidades del usuario según su rol
   */
  getUserCapabilities(role) {
    const capabilities = {
      viewer: ['view-conversations', 'view-messages'],
      agent: ['view-conversations', 'view-messages', 'send-messages', 'manage-conversations'],
      admin: ['view-conversations', 'view-messages', 'send-messages', 'manage-conversations', 'manage-users', 'view-all-conversations']
    };

    return capabilities[role] || capabilities.viewer;
  }

  // =============================================
  // MÉTODOS PÚBLICOS PARA EMITIR EVENTOS
  // =============================================

  /**
   * Emitir nuevo mensaje a conversación
   */
  emitNewMessage(conversationId, messageData) {
    if (!isValidConversationId(conversationId)) {
      logger.error('conversationId inválido para emitir mensaje', { conversationId });
      return;
    }

    const eventData = {
      type: 'new-message',
      conversationId,
      message: messageData,
      timestamp: Date.now()
    };

    // Emitir a todos los usuarios en la conversación
    this.io.to(`conversation-${conversationId}`).emit('new-message', eventData);

    // También emitir a admins si no están en la conversación
    this.io.to('role-admin').emit('message-notification', eventData);

    console.log('📨 NUEVO MENSAJE EMITIDO:', {
      conversationId,
      messageId: messageData.id,
      direction: messageData.direction,
      usersInConversation: this.conversationUsers.get(conversationId)?.size || 0
    });

    logger.info('Nuevo mensaje emitido via Socket.IO', {
      conversationId,
      messageId: messageData.id,
      direction: messageData.direction
    });
  }

  /**
   * Emitir mensaje leído
   */
  emitMessageRead(conversationId, messageId, userId) {
    if (!isValidConversationId(conversationId)) return;

    const eventData = {
      type: 'message-read',
      conversationId,
      messageId,
      readBy: userId,
      timestamp: Date.now()
    };

    this.io.to(`conversation-${conversationId}`).emit('message-read', eventData);

    logger.info('Mensaje marcado como leído via Socket.IO', {
      conversationId,
      messageId,
      readBy: userId
    });
  }

  /**
   * Emitir cambio de estado de conversación
   */
  emitConversationStatusChanged(conversationId, status, userId) {
    if (!isValidConversationId(conversationId)) return;

    const eventData = {
      type: 'conversation-status-changed',
      conversationId,
      status,
      changedBy: userId,
      timestamp: Date.now()
    };

    this.io.to(`conversation-${conversationId}`).emit('conversation-status-changed', eventData);
    this.io.to('role-admin').emit('conversation-update', eventData);

    logger.info('Estado de conversación cambiado via Socket.IO', {
      conversationId,
      status,
      changedBy: userId
    });
  }

  /**
   * Emitir conversación asignada
   */
  emitConversationAssigned(conversationId, assignedTo, assignedBy) {
    if (!isValidConversationId(conversationId)) return;

    const eventData = {
      type: 'conversation-assigned',
      conversationId,
      assignedTo,
      assignedBy,
      timestamp: Date.now()
    };

    // Notificar al agente asignado
    const assignedSocket = this.connectedUsers.get(assignedTo);
    if (assignedSocket) {
      this.io.to(assignedSocket).emit('conversation-assigned-to-you', eventData);
    }

    // Notificar a la conversación y admins
    this.io.to(`conversation-${conversationId}`).emit('conversation-assigned', eventData);
    this.io.to('role-admin').emit('conversation-update', eventData);

    logger.info('Conversación asignada via Socket.IO', {
      conversationId,
      assignedTo,
      assignedBy
    });
  }

  /**
   * Obtener estadísticas de conexiones
   */
  getStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      activeConversations: this.conversationUsers.size,
      usersByRole: {
        admin: Array.from(this.userRoles.values()).filter(role => role === 'admin').length,
        agent: Array.from(this.userRoles.values()).filter(role => role === 'agent').length,
        viewer: Array.from(this.userRoles.values()).filter(role => role === 'viewer').length
      }
    };
  }
}

module.exports = SocketManager; 