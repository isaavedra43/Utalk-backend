const { Server } = require('socket.io');
const logger = require('../utils/logger');
const { isValidConversationId } = require('../utils/conversation');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

class SocketManager {
  constructor (server) {
    // CONFIGURACIÓN MEJORADA DE SOCKET.IO CON CORS ESPECÍFICO
    const corsOrigins = process.env.FRONTEND_URL 
      ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
      : ['http://localhost:3000', 'https://localhost:3000'];

    this.io = new Server(server, {
      cors: {
        origin: (origin, callback) => {
          // PERMITIR CONEXIONES SIN ORIGIN (como apps móviles)
          if (!origin) return callback(null, true);
          
          // VERIFICAR ORÍGENES PERMITIDOS
          const allowedOrigins = [
            ...corsOrigins,
            'http://localhost:3000',
            'http://localhost:3001',
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
      // NUEVO: Configuración mejorada para reconexión
      connectTimeout: 45000,
      upgradeTimeout: 10000,
      allowUpgrades: true,
      perMessageDeflate: false, // Mejor rendimiento
      // NUEVO: Configuración para reconexión automática
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.connectedUsers = new Map(); // email -> socket.id
    this.userRoles = new Map(); // email -> role
    this.conversationUsers = new Map(); // conversationId -> Set(emails)

    // NUEVO: Rate limiting para prevenir spam (AJUSTADO PARA SER MÁS PERMISIVO)
    this.eventRateLimits = new Map();
    this.rateLimitConfig = {
      'typing-start': 200, // 0.2 segundos (muy permisivo)
      'typing-stop': 200,
      'join-conversation': 500, // 0.5 segundos (muy permisivo)
      'status-change': 1000, // 1 segundo (muy permisivo)
      'new-message': 50, // 0.05 segundos para mensajes (muy permisivo)
      'message-notification': 50, // 0.05 segundos para notificaciones (muy permisivo)
    };

    this.setupMiddleware();
    this.setupEventHandlers();

    // NUEVO: Limpieza periódica de rate limits
    setInterval(() => this.cleanupRateLimits(), 300000); // 5 minutos

    logger.info('Socket.IO server inicializado con configuración EMAIL-FIRST', {
      corsOrigins: corsOrigins,
      allowedTransports: ['websocket', 'polling'],
      rateLimit: 'habilitado',
      authentication: 'JWT Interno',
      environment: process.env.NODE_ENV || 'development',
    });
  }

  /**
   * MIDDLEWARE DE AUTENTICACIÓN JWT INTERNO (NO más Firebase Auth)
   */
  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        // EXTRAER TOKEN JWT del handshake
        const token = socket.handshake.auth?.token || 
                     socket.handshake.headers?.authorization?.replace('Bearer ', '');

        if (!token) {
          logger.warn('Socket.IO: Conexión sin token JWT', {
            socketId: socket.id,
            ip: socket.handshake.address,
          });
          return next(new Error('Token JWT requerido para conectar'));
        }

        // VERIFICAR JWT INTERNO con JWT_SECRET
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          logger.error('Socket.IO: JWT_SECRET no configurado');
          return next(new Error('Error de configuración del servidor'));
        }

        let decodedToken;
        try {
          decodedToken = jwt.verify(token, jwtSecret, {
            issuer: 'utalk-backend',
            audience: 'utalk-frontend',
          });
        } catch (jwtError) {
          logger.warn('Socket.IO: Token JWT inválido', {
            error: jwtError.message,
            tokenPrefix: token.substring(0, 20) + '...',
            socketId: socket.id,
          });
          return next(new Error('Token JWT inválido o expirado'));
        }

        // EXTRAER EMAIL del token (NO más UID)
        const email = decodedToken.email;
        if (!email) {
          logger.error('Socket.IO: Token sin email válido', {
            tokenPayload: decodedToken,
            socketId: socket.id,
          });
          return next(new Error('Token JWT debe contener email válido'));
        }

        // OBTENER USUARIO desde Firestore por EMAIL
        const user = await User.getByEmail(email);
        if (!user) {
          logger.error('Socket.IO: Usuario no encontrado en Firestore', {
            email,
            socketId: socket.id,
          });
          return next(new Error('Usuario no encontrado'));
        }

        // VERIFICAR que el usuario esté activo
        if (!user.isActive) {
          logger.warn('Socket.IO: Intento de conexión de usuario inactivo', {
            email: user.email,
            name: user.name,
            socketId: socket.id,
          });
          return next(new Error('Usuario inactivo'));
        }

        // ADJUNTAR información del usuario al socket
        socket.email = user.email; // EMAIL como identificador principal
        socket.userRole = user.role;
        socket.displayName = user.name;
        socket.user = user; // Usuario completo disponible

        // VERIFICAR conexión duplicada por email
        const existingSocketId = this.connectedUsers.get(user.email);
        if (existingSocketId && this.io.sockets.sockets.has(existingSocketId)) {
          logger.info('Socket.IO: Desconectando sesión anterior del usuario', {
            email: user.email,
            previousSocketId: existingSocketId,
            newSocketId: socket.id,
          });
          this.io.sockets.sockets.get(existingSocketId).disconnect(true);
        }

        logger.info('Socket.IO: Middleware de autenticación exitoso', {
          email: user.email,
          role: user.role,
          name: user.name,
          socketId: socket.id,
        });

        next();
      } catch (error) {
        logger.error('Socket.IO: Error en middleware de autenticación', {
          error: error.message,
          stack: error.stack,
          socketId: socket.id,
        });
        next(new Error('Error de autenticación interno'));
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
   * MANEJAR NUEVA CONEXIÓN (EMAIL-FIRST)
   */
  handleConnection(socket) {
    const { email, userRole, displayName } = socket;

    // REGISTRAR usuario conectado por EMAIL
    this.connectedUsers.set(email, socket.id);
    this.userRoles.set(email, userRole);

    logger.info('Usuario conectado via Socket.IO', {
      email, // EMAIL como identificador principal
      role: userRole,
      displayName,
      socketId: socket.id,
      totalConnected: this.connectedUsers.size,
    });

    // UNIR a sala general por rol
    socket.join(`role-${userRole}`);
    if (userRole === 'admin' || userRole === 'superadmin') {
      socket.join('role-admin');
      socket.join('role-agent'); // Admins ven todo
    }

    // CONFIGURAR eventos específicos
    this.setupConversationEvents(socket);
    this.setupMessageEvents(socket);
    this.setupStatusEvents(socket);

    // MANEJAR desconexión
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    // EVENTO de prueba/ping
    socket.on('ping', (callback) => {
      callback({ success: true, timestamp: Date.now() });
    });

    // EMITIR confirmación de conexión
    socket.emit('connected', {
      email, // EMAIL como identificador
      role: userRole,
      displayName,
      timestamp: Date.now(),
      capabilities: this.getUserCapabilities(userRole),
    });
  }

  /**
   * EVENTOS DE CONVERSACIONES (EMAIL-FIRST)
   */
  setupConversationEvents(socket) {
    const { email, userRole } = socket;

    socket.on('join-conversation', (conversationId, callback) => {
      if (!this.checkRateLimit(socket, 'join-conversation')) {
        return callback?.({ error: 'Rate limit exceeded' });
      }

      if (!isValidConversationId(conversationId)) {
        logger.warn('Socket.IO: Intento de unirse a conversación con ID inválido', {
          email, // EMAIL como identificador
          conversationId,
        });
        return callback?.({ error: 'ID de conversación inválido' });
      }

      // UNIRSE a la sala de conversación
      socket.join(`conversation-${conversationId}`);
      
      // REGISTRAR usuario en conversación (por EMAIL)
      if (!this.conversationUsers.has(conversationId)) {
        this.conversationUsers.set(conversationId, new Set());
      }
      this.conversationUsers.get(conversationId).add(email);

      logger.info('Usuario unido a conversación', {
        email, // EMAIL como identificador
        conversationId,
        totalInConversation: this.conversationUsers.get(conversationId).size,
      });

      callback?.({ success: true, conversationId });

      // NOTIFICAR a otros usuarios en la conversación
      socket.to(`conversation-${conversationId}`).emit('user-joined-conversation', {
        email, // EMAIL como identificador
        displayName: socket.displayName,
        role: userRole,
        conversationId,
        timestamp: Date.now(),
      });
    });

    socket.on('leave-conversation', (conversationId, callback) => {
      this.leaveConversation(socket, conversationId);
      callback?.({ success: true });
    });

    socket.on('typing-start', (conversationId, callback) => {
      if (!this.checkRateLimit(socket, 'typing-start')) {
        return callback?.({ error: 'Rate limit exceeded' });
      }

      if (isValidConversationId(conversationId)) {
        socket.to(`conversation-${conversationId}`).emit('user-typing', {
          email, // EMAIL como identificador
          displayName: socket.displayName,
          conversationId,
          isTyping: true,
          timestamp: Date.now(),
        });
      }
      callback?.({ success: true });
    });

    socket.on('typing-stop', (conversationId, callback) => {
      if (!this.checkRateLimit(socket, 'typing-stop')) {
        return callback?.({ error: 'Rate limit exceeded' });
      }

      if (isValidConversationId(conversationId)) {
        socket.to(`conversation-${conversationId}`).emit('user-typing', {
          email, // EMAIL como identificador
          displayName: socket.displayName,
          conversationId,
          isTyping: false,
          timestamp: Date.now(),
        });
      }
      callback?.({ success: true });
    });
  }

  /**
   * EVENTOS DE MENSAJES (EMAIL-FIRST)
   */
  setupMessageEvents(socket) {
    const { email } = socket;

    socket.on('message-read', (data, callback) => {
      const { conversationId, messageId } = data;

      if (!isValidConversationId(conversationId)) {
        return callback?.({ error: 'ID de conversación inválido' });
      }

      // EMITIR evento de mensaje leído usando EMAIL
      socket.to(`conversation-${conversationId}`).emit('message-read-by-user', {
        messageId,
        conversationId,
        readBy: email, // EMAIL como identificador
        displayName: socket.displayName,
        timestamp: Date.now(),
      });

      callback?.({ success: true });
    });

    socket.on('conversation-status-change', (data, callback) => {
      if (!this.checkRateLimit(socket, 'status-change')) {
        return callback?.({ error: 'Rate limit exceeded' });
      }

      const { conversationId, newStatus } = data;

      if (!isValidConversationId(conversationId)) {
        return callback?.({ error: 'ID de conversación inválido' });
      }

      // EMITIR cambio de estado usando EMAIL
      this.io.to(`conversation-${conversationId}`).emit('conversation-status-changed', {
        conversationId,
        newStatus,
        changedBy: email, // EMAIL como identificador
        displayName: socket.displayName,
        timestamp: Date.now(),
      });

      callback?.({ success: true });
    });
  }

  /**
   * EVENTOS DE ESTADO (EMAIL-FIRST)
   */
  setupStatusEvents(socket) {
    const { email } = socket;

    socket.on('update-status', (status, callback) => {
      const validStatuses = ['online', 'away', 'busy', 'offline'];
      if (!validStatuses.includes(status)) {
        return callback?.({ error: 'Estado inválido' });
      }

      // EMITIR cambio de estado usando EMAIL
      socket.broadcast.emit('user-status-changed', {
        email, // EMAIL como identificador
        displayName: socket.displayName,
        status,
        timestamp: Date.now(),
      });

      callback?.({ success: true, status });
    });
  }

  /**
   * MANEJAR DESCONEXIÓN (EMAIL-FIRST)
   */
  handleDisconnection(socket) {
    const { email, displayName } = socket;

    // REMOVER de usuarios conectados por EMAIL
    this.connectedUsers.delete(email);
    this.userRoles.delete(email);

    // REMOVER de todas las conversaciones
    for (const [conversationId, users] of this.conversationUsers.entries()) {
      if (users.has(email)) {
        users.delete(email);
        
        // NOTIFICAR salida de conversación usando EMAIL
        socket.to(`conversation-${conversationId}`).emit('user-left-conversation', {
          email, // EMAIL como identificador
          displayName,
          conversationId,
          timestamp: Date.now(),
        });

        // LIMPIAR conversación vacía
        if (users.size === 0) {
          this.conversationUsers.delete(conversationId);
        }
      }
    }

    logger.info('Usuario desconectado de Socket.IO', {
      email, // EMAIL como identificador
      displayName,
      socketId: socket.id,
      totalConnected: this.connectedUsers.size,
    });

    // EMITIR estado offline usando EMAIL
    socket.broadcast.emit('user-status-changed', {
      email, // EMAIL como identificador
      displayName,
      status: 'offline',
      timestamp: Date.now(),
    });
  }

  /**
   * SALIR DE CONVERSACIÓN (EMAIL-FIRST)
   */
  leaveConversation(socket, conversationId) {
    const { email, displayName } = socket;

    socket.leave(`conversation-${conversationId}`);

    if (this.conversationUsers.has(conversationId)) {
      this.conversationUsers.get(conversationId).delete(email);

      // NOTIFICAR salida usando EMAIL
      socket.to(`conversation-${conversationId}`).emit('user-left-conversation', {
        email, // EMAIL como identificador
        displayName,
        conversationId,
        timestamp: Date.now(),
      });

      if (this.conversationUsers.get(conversationId).size === 0) {
        this.conversationUsers.delete(conversationId);
      }
    }
  }

  /**
   * EMITIR NUEVO MENSAJE (EMAIL-FIRST)
   */
  emitNewMessage(conversationIdOrMessage, messageData = null) {
    let conversationId, message;
    
    if (typeof conversationIdOrMessage === 'string') {
      conversationId = conversationIdOrMessage;
      message = messageData;
    } else {
      message = conversationIdOrMessage;
      conversationId = message?.conversationId;
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

    // ASEGURAR estructura canónica del mensaje
    const canonicalMessage = message.toJSON ? message.toJSON() : message;

    // NUEVO: Validación más permisiva y logging detallado
    const hasRequiredFields = canonicalMessage.id && 
                             (canonicalMessage.senderIdentifier || canonicalMessage.sender) &&
                             (canonicalMessage.recipientIdentifier || canonicalMessage.recipient);

    if (!hasRequiredFields) {
      logger.warn('Mensaje con estructura incompleta para Socket.IO', {
        conversationId,
        messageId: canonicalMessage.id,
        hasSenderIdentifier: !!canonicalMessage.senderIdentifier,
        hasRecipientIdentifier: !!canonicalMessage.recipientIdentifier,
        hasSender: !!canonicalMessage.sender,
        hasRecipient: !!canonicalMessage.recipient,
        hasDirection: !!canonicalMessage.direction,
        messageKeys: Object.keys(canonicalMessage),
      });
      
      // NUEVO: Intentar reparar la estructura si es posible
      if (canonicalMessage.id) {
        // Si al menos tenemos el ID, intentar emitir con estructura mínima
        const minimalMessage = {
          id: canonicalMessage.id,
          conversationId: conversationId,
          content: canonicalMessage.content || '',
          type: canonicalMessage.type || 'text',
          direction: canonicalMessage.direction || 'outbound',
          timestamp: canonicalMessage.timestamp || new Date().toISOString(),
          sender: canonicalMessage.sender || canonicalMessage.senderIdentifier || 'unknown',
          recipient: canonicalMessage.recipient || canonicalMessage.recipientIdentifier || 'unknown',
        };
        
        logger.info('Intentando emitir con estructura mínima reparada', {
          messageId: minimalMessage.id,
          conversationId,
        });
        
        const eventData = {
          type: 'new-message',
          conversationId,
          message: minimalMessage,
          timestamp: Date.now(),
        };

        // EMISIÓN: A usuarios en la conversación específica
        const conversationRoom = `conversation-${conversationId}`;
        this.io.to(conversationRoom).emit('new-message', eventData);

        // EMISIÓN: Notificación a admins
        this.io.to('role-admin').emit('message-notification', eventData);

        logger.info('Mensaje emitido con estructura reparada via Socket.IO', {
          conversationId,
          messageId: minimalMessage.id,
          usersInConversation: this.conversationUsers.get(conversationId)?.size || 0,
        });
        
        return;
      }
    }

    const eventData = {
      type: 'new-message',
      conversationId,
      message: canonicalMessage, // Usar estructura canónica
      timestamp: Date.now(),
    };

    // EMISIÓN: A usuarios en la conversación específica
    const conversationRoom = `conversation-${conversationId}`;
    this.io.to(conversationRoom).emit('new-message', eventData);

    // EMISIÓN: Notificación a admins (incluso si no están en la conversación)
    this.io.to('role-admin').emit('message-notification', eventData);

    // EMISIÓN: A agentes asignados (si hay assignedTo en el mensaje o conversación)
    if (canonicalMessage.assignedTo || message.assignedTo) {
      const assignedUserEmail = canonicalMessage.assignedTo || message.assignedTo;
      const assignedSocketId = this.connectedUsers.get(assignedUserEmail);
      if (assignedSocketId) {
        this.io.to(assignedSocketId).emit('assigned-message-notification', eventData);
      }
    }

    logger.info('Mensaje emitido via Socket.IO', {
      conversationId,
      messageId: canonicalMessage.id,
      senderIdentifier: canonicalMessage.senderIdentifier,
      usersInConversation: this.conversationUsers.get(conversationId)?.size || 0,
    });
  }

  /**
   * Rate limiting check
   */
  checkRateLimit(socket, eventType) {
    const email = socket.email;
    const key = `${email}:${eventType}`;
    const now = Date.now();
    const limit = this.rateLimitConfig[eventType];

    if (!limit) return true;

    const lastEvent = this.eventRateLimits.get(key);
    if (lastEvent && (now - lastEvent) < limit) {
      logger.warn('Socket.IO: Rate limit exceeded', {
        email,
        eventType,
        timeSinceLastEvent: now - lastEvent,
        limit,
      });
      return false;
    }

    this.eventRateLimits.set(key, now);
    return true;
  }

  /**
   * Cleanup rate limits
   */
  cleanupRateLimits() {
    const now = Date.now();
    const maxAge = 600000; // 10 minutos

    for (const [key, timestamp] of this.eventRateLimits.entries()) {
      if (now - timestamp > maxAge) {
        this.eventRateLimits.delete(key);
      }
    }
  }

  /**
   * Get user capabilities based on role
   */
  getUserCapabilities(role) {
    const capabilities = {
      viewer: ['read-conversations', 'read-messages'],
      agent: ['read-conversations', 'read-messages', 'send-messages', 'assign-conversations'],
      admin: ['read-conversations', 'read-messages', 'send-messages', 'assign-conversations', 'manage-users', 'view-reports'],
      superadmin: ['all'],
    };

    return capabilities[role] || capabilities.viewer;
  }

  /**
   * OBTENER USUARIOS CONECTADOS (EMAIL-FIRST)
   */
  getConnectedUsers() {
    const users = [];
    for (const [email, socketId] of this.connectedUsers.entries()) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        users.push({
          email, // EMAIL como identificador
          displayName: socket.displayName,
          role: socket.userRole,
          socketId,
          connectedAt: socket.handshake.time,
        });
      }
    }
    return users;
  }
}

module.exports = SocketManager;
