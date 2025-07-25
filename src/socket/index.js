const { Server } = require('socket.io');
const logger = require('../utils/logger');
const { isValidConversationId } = require('../utils/conversation');

class SocketManager {
  constructor (server) {
    // ✅ CONFIGURACIÓN MEJORADA DE SOCKET.IO CON CORS ESPECÍFICO
    const corsOrigins = process.env.FRONTEND_URL 
      ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
      : ['http://localhost:3000', 'https://localhost:3000'];

    this.io = new Server(server, {
      cors: {
        origin: (origin, callback) => {
          // ✅ PERMITIR CONEXIONES SIN ORIGIN (como apps móviles)
          if (!origin) return callback(null, true);
          
          // ✅ VERIFICAR ORÍGENES PERMITIDOS
          const allowedOrigins = [
            ...corsOrigins,
            'http://localhost:3000',
            'https://localhost:3000',
            'http://127.0.0.1:3000',
            'https://127.0.0.1:3000',
          ];
          
          if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            callback(null, true);
          } else {
            logger.warn('CORS: Origen no permitido para Socket.IO', { origin, allowedOrigins });
            callback(null, false);
          }
        },
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['Authorization', 'Content-Type'],
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e6, // 1MB
      allowEIO3: true, // Compatibilidad
    });

    this.connectedUsers = new Map(); // userId -> socket.id
    this.userRoles = new Map(); // userId -> role
    this.conversationUsers = new Map(); // conversationId -> Set(userIds)

    // ✅ NUEVO: Rate limiting para prevenir spam
    this.eventRateLimits = new Map(); // socketId -> Map(event -> lastTime)
    this.rateLimitConfig = {
      'typing-start': 1000, // 1 segundo
      'typing-stop': 1000,
      'join-conversation': 5000, // 5 segundos
      'status-change': 10000, // 10 segundos
    };

    this.setupMiddleware();
    this.setupEventHandlers();

    // ✅ NUEVO: Limpieza periódica de rate limits
    setInterval(() => this.cleanupRateLimits(), 300000); // 5 minutos

    logger.info('Socket.IO server inicializado con configuración avanzada', {
      corsOrigins: corsOrigins,
      allowedTransports: ['websocket', 'polling'],
      rateLimit: 'habilitado',
      authentication: 'Firebase Auth',
      environment: process.env.NODE_ENV || 'development',
    });
  }

  /**
   * ✅ CORREGIDO: Middleware de autenticación con Firebase Admin SDK
   */
  setupMiddleware () {
    this.io.use(async (socket, next) => {
      try {
        // ✅ MÚLTIPLES FORMAS DE OBTENER EL TOKEN
        const token = socket.handshake.auth?.token || 
                      socket.handshake.query?.token || 
                      socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
                      socket.handshake.headers?.authorization;

        if (!token) {
          logger.warn('Socket connection rejected - No token provided', {
            socketId: socket.id,
            ip: socket.handshake.address,
            authData: {
              hasAuth: !!socket.handshake.auth,
              authKeys: socket.handshake.auth ? Object.keys(socket.handshake.auth) : [],
              hasQuery: !!socket.handshake.query,
              queryKeys: socket.handshake.query ? Object.keys(socket.handshake.query) : [],
              hasHeaders: !!socket.handshake.headers,
              authHeader: socket.handshake.headers?.authorization ? 'presente' : 'ausente',
            },
          });
          throw new Error('Token de autenticación requerido');
        }

        // ✅ CORREGIDO: Usar Firebase Admin SDK para validar token
        const admin = require('firebase-admin');
        let decodedToken;
        
        try {
          decodedToken = await admin.auth().verifyIdToken(token);
        } catch (firebaseError) {
          logger.error('Firebase token verification failed', {
            error: firebaseError.message,
            errorCode: firebaseError.code,
            socketId: socket.id,
            tokenLength: token ? token.length : 0,
            tokenStart: token ? token.substring(0, 20) + '...' : 'no_token',
          });
          throw new Error(`Token de Firebase inválido: ${firebaseError.message}`);
        }

        // ✅ VALIDACIÓN ADICIONAL: Verificar campos obligatorios de Firebase
        if (!decodedToken.uid || !decodedToken.email) {
          throw new Error('Token incompleto - faltan campos obligatorios de Firebase');
        }

        // ✅ OBTENER INFORMACIÓN ADICIONAL DEL USUARIO
        let userRole = 'agent'; // Por defecto
        let displayName = decodedToken.email;

        // ✅ BUSCAR DATOS ADICIONALES EN FIRESTORE (usuarios)
        try {
          const { firestore } = require('../config/firebase');
          const userDoc = await firestore.collection('users').doc(decodedToken.uid).get();
          
          if (userDoc.exists) {
            const userData = userDoc.data();
            userRole = userData.role || 'agent';
            displayName = userData.name || userData.displayName || decodedToken.email;
            
            logger.info('Datos de usuario encontrados en Firestore', {
              uid: decodedToken.uid,
              role: userRole,
              name: displayName,
            });
          } else {
            logger.warn('Usuario no encontrado en Firestore, usando datos de Firebase Auth', {
              uid: decodedToken.uid,
              email: decodedToken.email,
            });
          }
        } catch (firestoreError) {
          logger.warn('Error buscando usuario en Firestore, usando datos de Firebase Auth', {
            uid: decodedToken.uid,
            error: firestoreError.message,
          });
        }

        // ✅ VALIDACIÓN DE ROL: Solo roles válidos
        const validRoles = ['admin', 'agent', 'viewer'];
        if (!validRoles.includes(userRole)) {
          logger.warn('Rol no autorizado, asignando rol por defecto', {
            uid: decodedToken.uid,
            invalidRole: userRole,
            assignedRole: 'agent',
          });
          userRole = 'agent'; // Por defecto si el rol es inválido
        }

        // ✅ PREVENIR DOBLE CONEXIÓN del mismo usuario
        const existingSocketId = this.connectedUsers.get(decodedToken.uid);
        if (existingSocketId && this.io.sockets.sockets.has(existingSocketId)) {
          logger.info('Desconectando socket anterior del mismo usuario', {
            userId: decodedToken.uid,
            oldSocketId: existingSocketId,
            newSocketId: socket.id,
          });
          this.io.sockets.sockets.get(existingSocketId).disconnect(true);
        }

        // ✅ AGREGAR INFORMACIÓN DEL USUARIO AL SOCKET
        socket.userId = decodedToken.uid;
        socket.userEmail = decodedToken.email;
        socket.userRole = userRole;
        socket.displayName = displayName;
        socket.authenticatedAt = Date.now();
        socket.firebaseUser = decodedToken; // Datos completos de Firebase

        logger.info('Socket autenticado exitosamente con Firebase Auth', {
          userId: socket.userId,
          email: socket.userEmail,
          role: socket.userRole,
          displayName: socket.displayName,
          socketId: socket.id,
          firebaseProvider: decodedToken.firebase?.sign_in_provider || 'unknown',
        });

        next();
      } catch (error) {
        logger.error('Socket authentication failed', {
          error: error.message,
          stack: error.stack,
          socketId: socket.id,
          ip: socket.handshake.address,
          userAgent: socket.handshake.headers?.['user-agent'],
        });
        next(new Error('Autenticación fallida: ' + error.message));
      }
    });
  }

  /**
   * ✅ NUEVO: Rate limiting para eventos
   */
  checkRateLimit (socketId, eventType) {
    if (!this.rateLimitConfig[eventType]) return true; // Sin límite

    const now = Date.now();
    const userLimits = this.eventRateLimits.get(socketId) || new Map();
    const lastTime = userLimits.get(eventType) || 0;
    const minInterval = this.rateLimitConfig[eventType];

    if (now - lastTime < minInterval) {
      return false; // Rate limit exceeded
    }

    userLimits.set(eventType, now);
    this.eventRateLimits.set(socketId, userLimits);
    return true;
  }

  /**
   * ✅ NUEVO: Limpiar rate limits antiguos
   */
  cleanupRateLimits () {
    const now = Date.now();
    const maxAge = 600000; // 10 minutos

    this.eventRateLimits.forEach((userLimits, socketId) => {
      const cleanedLimits = new Map();
      userLimits.forEach((lastTime, eventType) => {
        if (now - lastTime < maxAge) {
          cleanedLimits.set(eventType, lastTime);
        }
      });

      if (cleanedLimits.size > 0) {
        this.eventRateLimits.set(socketId, cleanedLimits);
      } else {
        this.eventRateLimits.delete(socketId);
      }
    });
  }

  /**
   * ✅ NUEVO: Validar permisos para operaciones específicas
   */
  hasPermission (userRole, operation) {
    const permissions = {
      'view-conversations': ['admin', 'agent', 'viewer'],
      'send-messages': ['admin', 'agent'],
      'manage-conversations': ['admin', 'agent'],
      'assign-conversations': ['admin'],
      'view-all-conversations': ['admin'],
    };

    return permissions[operation]?.includes(userRole) || false;
  }

  /**
   * Configurar manejadores de eventos
   */
  setupEventHandlers () {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Manejar nueva conexión
   */
  handleConnection (socket) {
    const { userId, userRole, displayName } = socket;

    // Registrar usuario conectado
    this.connectedUsers.set(userId, socket.id);
    this.userRoles.set(userId, userRole);

    logger.info('Usuario conectado', {
      userId,
      role: userRole,
      displayName,
      socketId: socket.id,
      totalConnected: this.connectedUsers.size,
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
      capabilities: this.getUserCapabilities(userRole),
    });
  }

  /**
   * ✅ MEJORADO: Configurar eventos de conversaciones con validación robusta
   */
  setupConversationEvents (socket) {
    const { userId, userRole } = socket;

    // ✅ MEJORADO: Unirse a conversación con validación y rate limiting
    socket.on('join-conversation', (conversationId, callback) => {
      try {
        // ✅ RATE LIMITING: Prevenir spam
        if (!this.checkRateLimit(socket.id, 'join-conversation')) {
          logger.warn('Rate limit exceeded for join-conversation', {
            userId,
            socketId: socket.id,
          });
          if (callback) {
            callback({
              success: false,
              error: 'Rate limit exceeded - intenta en unos segundos',
            });
          }
          return;
        }

        // ✅ VALIDACIÓN: conversationId válido
        if (!isValidConversationId(conversationId)) {
          logger.warn('Intento de unirse a conversación con ID inválido', {
            userId,
            conversationId,
          });
          if (callback) {
            callback({
              success: false,
              error: 'ID de conversación inválido',
            });
          }
          return;
        }

        // ✅ PERMISOS: Verificar que puede ver conversaciones
        if (!this.hasPermission(userRole, 'view-conversations')) {
          logger.warn('Usuario sin permisos intentó unirse a conversación', {
            userId,
            userRole,
            conversationId,
          });
          if (callback) {
            callback({
              success: false,
              error: 'Sin permisos para ver conversaciones',
            });
          }
          return;
        }

        // ✅ UNIRSE A SALA
        socket.join(`conversation-${conversationId}`);

        // Registrar usuario en la conversación
        if (!this.conversationUsers.has(conversationId)) {
          this.conversationUsers.set(conversationId, new Set());
        }
        this.conversationUsers.get(conversationId).add(userId);

        logger.info('Usuario se unió a conversación', {
          userId,
          conversationId,
          userRole,
          socketId: socket.id,
        });

        if (callback) callback({ success: true, conversationId });
      } catch (error) {
        logger.error('Error uniéndose a conversación', {
          userId,
          conversationId,
          error: error.message,
        });
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ✅ MEJORADO: Salir de conversación con limpieza robusta
    socket.on('leave-conversation', (conversationId, callback) => {
      try {
        if (!isValidConversationId(conversationId)) {
          if (callback) callback({ success: false, error: 'ID inválido' });
          return;
        }

        socket.leave(`conversation-${conversationId}`);

        // ✅ LIMPIEZA ROBUSTA: Remover usuario de tracking
        if (this.conversationUsers.has(conversationId)) {
          this.conversationUsers.get(conversationId).delete(userId);

          // Limpiar si no hay usuarios
          if (this.conversationUsers.get(conversationId).size === 0) {
            this.conversationUsers.delete(conversationId);
          }
        }

        logger.info('Usuario salió de conversación', {
          userId,
          conversationId,
        });

        if (callback) callback({ success: true });
      } catch (error) {
        logger.error('Error saliendo de conversación', {
          userId,
          conversationId,
          error: error.message,
        });
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ✅ MEJORADO: Typing indicators con rate limiting
    socket.on('typing-start', (conversationId) => {
      if (!this.checkRateLimit(socket.id, 'typing-start')) return;
      if (!isValidConversationId(conversationId)) return;
      if (!this.hasPermission(userRole, 'view-conversations')) return;

      socket.to(`conversation-${conversationId}`).emit('user-typing', {
        userId,
        conversationId,
        displayName: socket.displayName,
        timestamp: Date.now(),
      });
    });

    socket.on('typing-stop', (conversationId) => {
      if (!this.checkRateLimit(socket.id, 'typing-stop')) return;
      if (!isValidConversationId(conversationId)) return;
      if (!this.hasPermission(userRole, 'view-conversations')) return;

      socket.to(`conversation-${conversationId}`).emit('user-stopped-typing', {
        userId,
        conversationId,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Configurar eventos de mensajes
   */
  setupMessageEvents (socket) {
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
  setupStatusEvents (socket) {
    // Cambiar estado del usuario (online, away, busy)
    socket.on('status-change', (status) => {
      const validStatuses = ['online', 'away', 'busy', 'offline'];
      if (validStatuses.includes(status)) {
        socket.userStatus = status;

        // Notificar a otros usuarios relevantes
        this.io.to(`role-${socket.userRole}`).emit('user-status-changed', {
          userId: socket.userId,
          status,
          timestamp: Date.now(),
        });

        logger.info('Estado de usuario cambiado', {
          userId: socket.userId,
          status,
        });
      }
    });
  }

  /**
   * Manejar desconexión
   */
  handleDisconnection (socket) {
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

    logger.info('Usuario desconectado', {
      userId,
      role: userRole,
      connectedTime: Date.now() - socket.handshake.time,
    });

    // Notificar desconexión a usuarios relevantes
    this.io.to(`role-${userRole}`).emit('user-disconnected', {
      userId,
      timestamp: Date.now(),
    });
  }

  /**
   * Obtener capacidades del usuario según su rol
   */
  getUserCapabilities (role) {
    const capabilities = {
      viewer: ['view-conversations', 'view-messages'],
      agent: ['view-conversations', 'view-messages', 'send-messages', 'manage-conversations'],
      admin: ['view-conversations', 'view-messages', 'send-messages', 'manage-conversations', 'manage-users', 'view-all-conversations'],
    };

    return capabilities[role] || capabilities.viewer;
  }

  // =============================================
  // MÉTODOS PÚBLICOS PARA EMITIR EVENTOS
  // =============================================

  /**
   * ✅ CORREGIDO: Emitir nuevo mensaje a conversación (flexible)
   * Puede recibir: emitNewMessage(messageObject) o emitNewMessage(conversationId, messageData)
   */
  emitNewMessage (conversationIdOrMessage, messageData = null) {
    let conversationId, message;

    // ✅ FLEXIBILIDAD: Manejar diferentes formas de llamar la función
    if (typeof conversationIdOrMessage === 'object' && conversationIdOrMessage !== null) {
      // Caso: emitNewMessage(messageObject)
      message = conversationIdOrMessage;
      conversationId = message.conversationId || message.id?.split('_')[1] + '_' + message.id?.split('_')[2];
      
      if (!conversationId && (message.senderPhone && message.recipientPhone)) {
        // Generar conversationId desde los teléfonos
        const customerPhone = message.direction === 'inbound' ? message.senderPhone : message.recipientPhone;
        const agentPhone = message.direction === 'inbound' ? message.recipientPhone : message.senderPhone;
        conversationId = `conv_${customerPhone.replace('+', '')}_${agentPhone.replace('+', '')}`;
      }
    } else {
      // Caso: emitNewMessage(conversationId, messageData)
      conversationId = conversationIdOrMessage;
      message = messageData;
    }

    // ✅ VALIDACIÓN: Verificar que tenemos los datos necesarios
    if (!conversationId) {
      logger.error('No se pudo determinar conversationId para emitir mensaje', {
        receivedParams: {
          first: typeof conversationIdOrMessage,
          second: typeof messageData,
        },
        messageData: message ? {
          id: message.id,
          conversationId: message.conversationId,
          hasPhones: !!(message.senderPhone && message.recipientPhone),
          direction: message.direction,
        } : 'null',
      });
      return;
    }

    if (!isValidConversationId(conversationId)) {
      logger.error('conversationId inválido para emitir mensaje', { 
        conversationId,
        messageId: message?.id,
      });
      return;
    }

    if (!message) {
      logger.error('Datos de mensaje faltantes para emitir evento', { conversationId });
      return;
    }

    // ✅ ASEGURAR estructura canónica del mensaje
    const canonicalMessage = message.toJSON ? message.toJSON() : message;

    // ✅ VALIDACIÓN: Verificar estructura mínima requerida
    if (!canonicalMessage.id || !canonicalMessage.senderPhone || !canonicalMessage.recipientPhone) {
      logger.warn('Mensaje con estructura incompleta para Socket.IO', {
        conversationId,
        messageId: canonicalMessage.id,
        hasSenderPhone: !!canonicalMessage.senderPhone,
        hasRecipientPhone: !!canonicalMessage.recipientPhone,
        hasDirection: !!canonicalMessage.direction,
      });
    }

    const eventData = {
      type: 'new-message',
      conversationId,
      message: canonicalMessage, // ✅ Usar estructura canónica
      timestamp: Date.now(),
    };

    // ✅ EMISIÓN: A usuarios en la conversación específica
    const conversationRoom = `conversation-${conversationId}`;
    this.io.to(conversationRoom).emit('new-message', eventData);

    // ✅ EMISIÓN: Notificación a admins (incluso si no están en la conversación)
    this.io.to('role-admin').emit('message-notification', eventData);

    // ✅ EMISIÓN: A agentes asignados (si hay assignedTo en el mensaje o conversación)
    if (canonicalMessage.assignedTo || message.assignedTo) {
      const assignedUserId = canonicalMessage.assignedTo || message.assignedTo;
      const assignedSocketId = this.connectedUsers.get(assignedUserId);
      if (assignedSocketId) {
        this.io.to(assignedSocketId).emit('assigned-message-notification', eventData);
      }
    }

    // ✅ MONITOREO: Log detallado
    console.log('📨 NUEVO MENSAJE EMITIDO VIA SOCKET.IO:', {
      conversationId,
      messageId: canonicalMessage.id,
      direction: canonicalMessage.direction,
      type: canonicalMessage.type,
      hasCanonicalStructure: !!(canonicalMessage.senderPhone && canonicalMessage.recipientPhone && canonicalMessage.timestamp),
      usersInConversation: this.conversationUsers.get(conversationId)?.size || 0,
      emittedTo: {
        conversationRoom: `conversation-${conversationId}`,
        admins: 'role-admin',
        assignedAgent: canonicalMessage.assignedTo ? 'si' : 'no',
      },
    });

    logger.info('Nuevo mensaje emitido exitosamente via Socket.IO', {
      conversationId,
      messageId: canonicalMessage.id,
      direction: canonicalMessage.direction,
      timestamp: canonicalMessage.timestamp,
      senderPhone: canonicalMessage.senderPhone,
      recipientPhone: canonicalMessage.recipientPhone,
    });
  }

  /**
   * Emitir mensaje leído
   */
  emitMessageRead (conversationId, messageId, userId) {
    if (!isValidConversationId(conversationId)) return;

    const eventData = {
      type: 'message-read',
      conversationId,
      messageId,
      readBy: userId,
      timestamp: Date.now(),
    };

    this.io.to(`conversation-${conversationId}`).emit('message-read', eventData);

    logger.info('Mensaje marcado como leído via Socket.IO', {
      conversationId,
      messageId,
      readBy: userId,
    });
  }

  /**
   * Emitir cambio de estado de conversación
   */
  emitConversationStatusChanged (conversationId, status, userId) {
    if (!isValidConversationId(conversationId)) return;

    const eventData = {
      type: 'conversation-status-changed',
      conversationId,
      status,
      changedBy: userId,
      timestamp: Date.now(),
    };

    this.io.to(`conversation-${conversationId}`).emit('conversation-status-changed', eventData);
    this.io.to('role-admin').emit('conversation-update', eventData);

    logger.info('Estado de conversación cambiado via Socket.IO', {
      conversationId,
      status,
      changedBy: userId,
    });
  }

  /**
   * Emitir conversación asignada
   */
  emitConversationAssigned (conversationId, assignedTo, assignedBy) {
    if (!isValidConversationId(conversationId)) return;

    const eventData = {
      type: 'conversation-assigned',
      conversationId,
      assignedTo,
      assignedBy,
      timestamp: Date.now(),
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
      assignedBy,
    });
  }

  /**
   * Emitir actualización de conversación
   */
  emitConversationUpdate (io, conversationId, updateData = {}) {
    try {
      logger.info('Emitiendo actualización de conversación', { conversationId });

      const updatePayload = {
        conversationId,
        timestamp: new Date().toISOString(),
        ...updateData,
      };

      // ✅ Usar estructura canónica
      io.emit('conversation:update', updatePayload);

      logger.info('Actualización de conversación emitida exitosamente', {
        conversationId,
        hasData: Object.keys(updateData).length > 0,
      });
    } catch (error) {
      logger.error('Error emitiendo actualización de conversación:', error);
    }
  }

  /**
   * Obtener estadísticas de conexiones
   */
  getStats () {
    return {
      connectedUsers: this.connectedUsers.size,
      activeConversations: this.conversationUsers.size,
      usersByRole: {
        admin: Array.from(this.userRoles.values()).filter(role => role === 'admin').length,
        agent: Array.from(this.userRoles.values()).filter(role => role === 'agent').length,
        viewer: Array.from(this.userRoles.values()).filter(role => role === 'viewer').length,
      },
    };
  }
}

module.exports = SocketManager;
