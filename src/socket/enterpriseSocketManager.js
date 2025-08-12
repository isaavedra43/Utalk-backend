/**
 * 🚀 ENTERPRISE SOCKET MANAGER - NIVEL WHATSAPP/SLACK/DISCORD
 * 
 * Basado en mejores prácticas de:
 * - https://socket.io/docs/v4/memory-usage
 * - https://stackoverflow.com/questions/31689098/socket-io-disconnect-events-and-garbage-collection-for-related-closure
 * - https://github.com/socketio/socket.io/issues/2427
 * 
 * Características implementadas:
 * ✅ Autenticación segura durante handshake
 * ✅ Memory leak prevention (listeners automáticamente removidos)
 * ✅ Garbage collection friendly
 * ✅ Reconexión con sincronización de estado
 * ✅ Event listeners con cleanup automático
 * ✅ Rate limiting inteligente por usuario/evento
 * ✅ Real-time presence tracking
 * ✅ Conversation state synchronization
 * ✅ Error handling enterprise
 * ✅ Performance monitoring
 * 
 * @version 4.0.0 ENTERPRISE
 * @author Real-time Architecture Team
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
// Los modelos se inyectan como dependencias para romper ciclos
const { memoryManager } = require('../utils/memoryManager');
const logger = require('../utils/logger');
const { asyncWrapper, externalServiceWrapper } = require('../utils/errorWrapper');
const { getAccessTokenConfig } = require('../config/jwt');

// Helper defensivo para evitar "Cannot read properties of undefined (reading 'set')"
function safeGetSet(map, key) {
  if (!map.has(key)) map.set(key, new Set());
  return map.get(key);
}

// Event definitions con metadata
const SOCKET_EVENTS = {
  // Connection lifecycle
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  
  // Authentication & sync
  AUTHENTICATE: 'authenticate',
  SYNC_STATE: 'sync-state',
  STATE_SYNCED: 'state-synced',
  
  // Conversation management
  JOIN_CONVERSATION: 'join-conversation',
  LEAVE_CONVERSATION: 'leave-conversation',
  CONVERSATION_JOINED: 'conversation-joined',
  CONVERSATION_LEFT: 'conversation-left',
  
  // Message events
  NEW_MESSAGE: 'new-message',
  MESSAGE_SENT: 'message-sent',
  MESSAGE_READ: 'message-read',
  MESSAGE_DELIVERED: 'message-delivered',
  MESSAGE_TYPING: 'typing',
  MESSAGE_TYPING_STOP: 'typing-stop',
  
  // Presence events
  USER_ONLINE: 'user-online',
  USER_OFFLINE: 'user-offline',
  USER_STATUS_CHANGE: 'user-status-change',
  PRESENCE_UPDATE: 'presence-update',
  
  // System events
  SERVER_SHUTDOWN: 'server-shutdown',
  CONVERSATION_CLEANUP: 'conversation-cleanup',
  SYNC_REQUIRED: 'sync-required',
  
  // Admin events
  ADMIN_BROADCAST: 'admin-broadcast',
  ADMIN_USER_STATUS: 'admin-user-status'
};

// Rate limiting configuration (per user per event)
const RATE_LIMITS = {
  [SOCKET_EVENTS.MESSAGE_TYPING]: 500,        // 0.5 seconds
  [SOCKET_EVENTS.MESSAGE_TYPING_STOP]: 100,   // 0.1 seconds
  [SOCKET_EVENTS.JOIN_CONVERSATION]: 1000,    // 1 second
  [SOCKET_EVENTS.LEAVE_CONVERSATION]: 1000,   // 1 second
  [SOCKET_EVENTS.NEW_MESSAGE]: 100,           // 0.1 seconds
  [SOCKET_EVENTS.MESSAGE_READ]: 100,          // 0.1 seconds
  [SOCKET_EVENTS.USER_STATUS_CHANGE]: 2000,   // 2 seconds
  [SOCKET_EVENTS.SYNC_STATE]: 5000            // 5 seconds
};

// 🔧 SOCKET ROBUSTO: Límites de configuración
const SOCKET_LIMITS = {
  MAX_ROOMS_PER_SOCKET: parseInt(process.env.SOCKET_MAX_ROOMS_PER_SOCKET) || 50,
  MAX_JOINS_PER_10S: 10,
  HEARTBEAT_INTERVAL: 25000,
  HEARTBEAT_TIMEOUT: 60000
};

class EnterpriseSocketManager {
  constructor(server, deps = {}) {
    this.server = server;
    this.io = null;
    this.isShuttingDown = false;
    
    // Inyectar dependencias para romper ciclos
    this.User = deps.User || null;
    this.Conversation = deps.Conversation || null;
    this.Message = deps.Message || null;
    
    // Managed maps for enterprise memory management
    this.connectedUsers = null;       // email -> UserSession
    this.userConversations = null;    // email -> Set(conversationIds)
    this.conversationUsers = null;    // conversationId -> Set(emails)
    this.userRoleCache = null;        // email -> role (TTL cache)
    this.rateLimitTracker = null;     // email:event -> lastTimestamp
    this.typingUsers = null;          // conversationId -> Set(emails)
    this.eventListeners = null;       // socketId -> Map(event -> cleanupFunction)
    
    // Performance tracking
    this.metrics = {
      connectionsPerSecond: 0,
      messagesPerSecond: 0,
      disconnectionsPerSecond: 0,
      errorsPerSecond: 0,
      lastResetTime: Date.now()
    };
    
    this.initialize();
  }

  /**
   * 🚀 INITIALIZE ENTERPRISE SOCKET SERVER
   */
  async initialize() {
    try {
      logger.info('🚀 Initializing Enterprise Socket.IO Manager...', {
        category: 'SOCKET_INIT',
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      });

      // Initialize managed memory maps
      this.initializeMemoryMaps();
      
      // Configure Socket.IO server
      this.configureSocketServer();
      
      // Setup authentication middleware
      this.setupAuthenticationMiddleware();
      
      // Setup event handlers
      this.setupEventHandlers();
      
      // Setup monitoring and health checks
      this.setupMonitoring();
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();

      logger.info('✅ Enterprise Socket.IO Manager initialized successfully', {
        category: 'SOCKET_SUCCESS',
        features: {
          authenticationMiddleware: true,
          memoryManagement: true,
          rateLimiting: true,
          presenceTracking: true,
          stateSync: true,
          errorHandling: true,
          monitoring: true,
          gracefulShutdown: true
        }
      });

      // Log de diagnóstico (sin PII) al conectar
      logger.socket?.info({
        event: 'socket.init_ok',
        rooms: this.rooms.size,
        sessions: this.userSessions.size,
        sockets: this.socketConversations.size
      });

    } catch (error) {
      logger.error('💥 Failed to initialize Enterprise Socket.IO Manager', {
        category: 'SOCKET_INIT_ERROR',
        error: error.message,
        stack: error.stack,
        severity: 'CRITICAL'
      });
      throw error;
    }
  }

  /**
   * 🧠 INITIALIZE MANAGED MEMORY MAPS
   */
  initializeMemoryMaps() {
    logger.info('🧠 Initializing managed memory maps...', {
      category: 'SOCKET_MEMORY_INIT'
    });

    // Connected users with full session data
    this.connectedUsers = memoryManager.createManagedMap('socket_connectedUsers', {
      maxEntries: 100000,
      defaultTTL: 4 * 60 * 60 * 1000, // 4 hours
      onEviction: (email, session, reason) => {
        this.handleUserSessionEviction(email, session, reason);
      },
      onWarning: (message, data) => {
        logger.warn('Warning in connectedUsers map', { 
          category: 'SOCKET_MEMORY_WARNING',
          message, 
          data 
        });
      }
    });

    // User conversations mapping
    this.userConversations = memoryManager.createManagedMap('socket_userConversations', {
      maxEntries: 100000,
      defaultTTL: 2 * 60 * 60 * 1000, // 2 hours
      onEviction: (email, conversationSet, reason) => {
        this.handleUserConversationsEviction(email, conversationSet, reason);
      }
    });

    // Conversation users mapping
    this.conversationUsers = memoryManager.createManagedMap('socket_conversationUsers', {
      maxEntries: 50000,
      defaultTTL: 2 * 60 * 60 * 1000, // 2 hours
      onEviction: (conversationId, userSet, reason) => {
        this.handleConversationUsersEviction(conversationId, userSet, reason);
      }
    });

    // User role cache
    this.userRoleCache = memoryManager.createManagedMap('socket_userRoles', {
      maxEntries: 200000,
      defaultTTL: 6 * 60 * 60 * 1000, // 6 hours
      onEviction: (email, role, reason) => {
        // Log removido para reducir ruido en producción
      }
    });

    // Rate limiting tracker
    this.rateLimitTracker = memoryManager.createManagedMap('socket_rateLimits', {
      maxEntries: 1000000,
      defaultTTL: 30 * 60 * 1000, // 30 minutes
      onEviction: (key, timestamp, reason) => {
        // Log removido para reducir ruido en producción
      }
    });

    // Typing users tracker
    this.typingUsers = memoryManager.createManagedMap('socket_typingUsers', {
      maxEntries: 10000,
      defaultTTL: 30 * 1000, // 30 seconds
      onEviction: (conversationId, typingSet, reason) => {
        this.handleTypingEviction(conversationId, typingSet, reason);
      }
    });

    // Event listeners tracker (para cleanup automático)
    this.eventListeners = memoryManager.createManagedMap('socket_eventListeners', {
      maxEntries: 100000,
      defaultTTL: 8 * 60 * 60 * 1000, // 8 hours
      onEviction: (socketId, listenersMap, reason) => {
        this.handleEventListenersEviction(socketId, listenersMap, reason);
      }
    });

    // 🔧 SOCKET ROBUSTO: Estructuras adicionales para rooms y sesiones
    this.rooms = new Map(); // roomId -> Set<socketId>
    this.userSessions = new Map(); // userId/email -> Set<socketId>
    this.socketConversations = new Map(); // socketId -> Set<roomId>

    logger.info('✅ Managed memory maps initialized successfully', {
      category: 'SOCKET_MEMORY_SUCCESS',
      mapsCount: 9, // Actualizado para incluir las nuevas estructuras
      totalMaxEntries: 1460000
    });
  }

  /**
   * 🔧 CONFIGURE SOCKET.IO SERVER
   */
  configureSocketServer() {
    logger.info('🔧 Configuring Socket.IO server...', {
      category: 'SOCKET_CONFIG'
    });

    // Simplificar CORS para evitar errores
    const corsOrigins = process.env.CORS_ORIGINS 
      ? process.env.CORS_ORIGINS.split(',').map(url => url.trim())
      : ['http://localhost:3000', 'http://localhost:3001'];

    this.io = new Server(this.server, {
      // CORS configuration simplificada
      cors: {
        origin: corsOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['Authorization', 'Content-Type']
      },

      // Transport configuration
      transports: ['websocket', 'polling'],
      
      // Timeouts and intervals
      pingTimeout: SOCKET_LIMITS.HEARTBEAT_TIMEOUT,     // 60 seconds
      pingInterval: SOCKET_LIMITS.HEARTBEAT_INTERVAL,   // 25 seconds
      
      // Connection limits
      maxHttpBufferSize: 2e6, // 2MB
      
      // Performance optimizations
      connectTimeout: 30000,
      upgradeTimeout: 10000,
      allowUpgrades: true,
      perMessageDeflate: false,
      
      // Memory usage optimization
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
        skipMiddlewares: false,
      },
      
      // Additional settings
      allowEIO3: false,
      cookie: false,
      serveClient: false
    });

    // Manejo de errores del engine
    this.io.engine.on("connection_error", (err) => {
      logger.warn('Socket.IO engine connection error', {
        category: 'SOCKET_ENGINE_ERROR',
        error: err.message,
        code: err.code,
        context: err.context || 'unknown'
      });
    });

    logger.info('✅ Socket.IO server configured successfully', {
      category: 'SOCKET_CONFIG_SUCCESS',
      corsOrigins: corsOrigins.length
    });
  }

  /**
   * 🔐 SETUP AUTHENTICATION MIDDLEWARE (HANDSHAKE LEVEL)
   */
  setupAuthenticationMiddleware() {
    logger.info('🔐 Setting up authentication middleware...', {
      category: 'SOCKET_AUTH_SETUP'
    });

    this.io.use(async (socket, next) => {
      try {
        // Extract JWT token from handshake
        const token = socket.handshake.auth?.token || 
                     socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
                     socket.handshake.query?.token;

        if (!token) {
          logger.warn('Socket.IO: Connection attempt without JWT token', {
            category: 'SOCKET_AUTH_FAILURE',
            socketId: socket.id,
            ip: socket.handshake.address
          });
          return next(new Error('AUTHENTICATION_REQUIRED: JWT token required'));
        }

        // Verify JWT token
        const jwtConfig = getAccessTokenConfig();
        if (!jwtConfig.secret) {
          logger.error('Socket.IO: JWT_SECRET not configured', {
            category: 'SOCKET_AUTH_CONFIG_ERROR'
          });
          return next(new Error('SERVER_CONFIGURATION_ERROR'));
        }

        let decodedToken;
        try {
          decodedToken = jwt.verify(token, jwtConfig.secret, {
            issuer: jwtConfig.issuer,
            audience: jwtConfig.audience,
            clockTolerance: 60
          });
        } catch (jwtError) {
          logger.warn('Socket.IO: Invalid JWT token', {
            category: 'SOCKET_AUTH_INVALID_TOKEN',
            error: jwtError.message,
            socketId: socket.id
          });
          return next(new Error('AUTHENTICATION_FAILED: Invalid or expired token'));
        }

        // Extract and validate email
        const email = decodedToken.email;
        if (!email || !email.includes('@')) {
          logger.error('Socket.IO: Token without valid email', {
            category: 'SOCKET_AUTH_INVALID_EMAIL',
            socketId: socket.id
          });
          return next(new Error('AUTHENTICATION_FAILED: Valid email required'));
        }

        // Get user role (simplificado)
        let userRole = this.userRoleCache.get(email);
        if (!userRole) {
          try {
            // Verificar si User está disponible
            if (!User) {
              logger.warn('Socket.IO: User model not available, using default role', {
                category: 'SOCKET_AUTH_USER_MODEL_UNAVAILABLE',
                email: email.substring(0, 20) + '...',
                socketId: socket.id
              });
              userRole = 'agent'; // Role por defecto
            } else {
                          const user = await this.User?.getByEmail(email);
            if (!user || !user.isActive) {
              logger.warn('Socket.IO: User not found or inactive', {
                category: 'SOCKET_AUTH_USER_NOT_FOUND',
                email: email.substring(0, 20) + '...',
                socketId: socket.id
              });
              return next(new Error('AUTHENTICATION_FAILED: User not found or inactive'));
            }
            userRole = user.role;
            }
            this.userRoleCache.set(email, userRole);
          } catch (dbError) {
            logger.error('Socket.IO: Database error during auth', {
              category: 'SOCKET_AUTH_DB_ERROR',
              error: dbError.message,
              socketId: socket.id
            });
            return next(new Error('AUTHENTICATION_FAILED: Database error'));
          }
        }

        // Attach authenticated user data to socket
        socket.userEmail = email;
        socket.userRole = userRole;
        socket.decodedToken = decodedToken;
        socket.connectedAt = Date.now();
        socket.lastActivity = Date.now();

        // Socket data
        socket.data = {
          userId: decodedToken.userId || email,
          emailMasked: email.substring(0, 20) + '...',
          workspaceId: decodedToken.workspaceId || 'default',
          tenantId: decodedToken.tenantId || 'na'
        };

        logger.info('Socket.IO: Authentication successful', {
          category: 'SOCKET_AUTH_SUCCESS',
          email: email.substring(0, 20) + '...',
          role: userRole,
          socketId: socket.id
        });

        next(); // Authentication successful

      } catch (error) {
        logger.error('Socket.IO: Authentication middleware error', {
          category: 'SOCKET_AUTH_ERROR',
          error: error.message,
          socketId: socket.id
        });
        next(new Error('AUTHENTICATION_ERROR: Internal authentication error'));
      }
    });

    logger.info('✅ Authentication middleware configured successfully', {
      category: 'SOCKET_AUTH_SUCCESS'
    });
  }

  /**
   * 🔄 HANDLE EXISTING CONNECTION (PREVENT DUPLICATES)
   */
  async handleExistingConnection(email, newSocket) {
    const existingSession = this.connectedUsers.get(email);
    
    if (existingSession?.socketId) {
      const existingSocket = this.io.sockets.sockets.get(existingSession.socketId);
      
      if (existingSocket && existingSocket.connected) {
        logger.info('Socket.IO: Disconnecting existing session for user', {
          category: 'SOCKET_DUPLICATE_CONNECTION',
          email: email.substring(0, 20) + '...',
          existingSocketId: existingSession.socketId,
          newSocketId: newSocket.id,
          action: 'disconnect_existing'
        });

        // Notify existing socket about new connection
        existingSocket.emit(SOCKET_EVENTS.SYNC_REQUIRED, {
          reason: 'new_session_detected',
          message: 'Nueva sesión detectada en otro dispositivo',
          timestamp: new Date().toISOString()
        });

        // Gracefully disconnect existing socket
        existingSocket.disconnect(true);
        
        // Clean up existing session
        await this.cleanupUserSession(email, existingSession.socketId);
      }
    }
  }

  /**
   * 📡 SETUP EVENT HANDLERS
   */
  setupEventHandlers() {
    logger.info('📡 Setting up event handlers...', {
      category: 'SOCKET_EVENTS_SETUP'
    });

    this.io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
      this.handleNewConnection(socket);
    });

    logger.info('✅ Event handlers configured successfully', {
      category: 'SOCKET_EVENTS_SUCCESS'
    });
  }

  /**
   * 🤝 HANDLE NEW CONNECTION (AFTER AUTHENTICATION)
   */
  handleNewConnection(socket) {
    const { userEmail, userRole, connectedAt } = socket;

    try {
      // Update metrics
      this.metrics.connectionsPerSecond++;

      // Create user session
      const session = {
        socketId: socket.id,
        email: userEmail,
        role: userRole,
        connectedAt,
        lastActivity: connectedAt,
        conversations: new Set(),
        isTyping: false,
        status: 'online'
      };

      // Register connected user
      this.connectedUsers.set(userEmail, session);

      // Initialize event listeners map for this socket
      this.eventListeners.set(socket.id, new Map());

      logger.info('RT:CONNECT', { 
        socketId: socket.id.substring(0, 8) + '...', 
        email: userEmail.substring(0, 20) + '...',
        role: userRole
      });
      
      logger.info('New user connected via Socket.IO', {
        category: 'SOCKET_USER_CONNECTED',
        email: userEmail.substring(0, 20) + '...',
        role: userRole,
        socketId: socket.id,
        totalConnected: this.connectedUsers.size,
        connectedAt: new Date(connectedAt).toISOString()
      });

      // Join role-based rooms
      this.joinRoleBasedRooms(socket, userRole);

      // Setup socket event listeners with automatic cleanup
      this.setupSocketEventListeners(socket);

      // Send initial state synchronization
      this.sendInitialStateSync(socket);

      // Notify other users about new user online
      this.broadcastUserPresence(userEmail, 'online', userRole);

    } catch (error) {
      logger.error('Error handling new connection', {
        category: 'SOCKET_CONNECTION_ERROR',
        error: error.message,
        stack: error.stack,
        userEmail: userEmail?.substring(0, 20) + '...',
        socketId: socket.id,
        severity: 'HIGH'
      });

      // Disconnect socket on error
      socket.disconnect(true);
    }
  }

  /**
   * 🏠 JOIN ROLE-BASED ROOMS
   */
  joinRoleBasedRooms(socket, userRole) {
    const { userEmail } = socket;

    try {
      // Join role-specific room
      socket.join(`role-${userRole}`);

      // Admin privileges
      if (userRole === 'admin' || userRole === 'superadmin') {
        socket.join('role-admin');
        socket.join('role-agent'); // Admins see everything
      }

      // Log removido para reducir ruido en producción

    } catch (error) {
      logger.error('Error joining role-based rooms', {
        category: 'SOCKET_ROOM_ERROR',
        error: error.message,
        userEmail: userEmail?.substring(0, 20) + '...',
        userRole
      });
    }
  }

  /**
   * 🎯 SETUP SOCKET EVENT LISTENERS (WITH AUTOMATIC CLEANUP)
   */
  setupSocketEventListeners(socket) {
    const { userEmail, socketId } = socket;
    const listenersMap = this.eventListeners.get(socketId);

    // Helper to register event with cleanup
    const registerEvent = (eventName, handler, options = {}) => {
      const wrappedHandler = this.wrapEventHandler(eventName, handler, socket, options);
      
      // Usar el sistema de cleanup centralizado
      const eventCleanup = require('../utils/eventCleanup');
      eventCleanup.addListener(socket, eventName, wrappedHandler, {
        maxCalls: options.maxCalls || Infinity,
        timeout: options.timeout || null,
        metadata: { 
          socketId, 
          userEmail: userEmail?.substring(0, 20) + '...',
          eventName 
        }
      });
      
      // Store cleanup function
      listenersMap.set(eventName, () => {
        eventCleanup.removeListener(socket, eventName, wrappedHandler);
      });
    };

    // Sync state event
    registerEvent(SOCKET_EVENTS.SYNC_STATE, 
      this.handleSyncState.bind(this), 
      { rateLimited: true, maxCalls: 100, timeout: 30000 }
    );

    // Join conversation event
    registerEvent(SOCKET_EVENTS.JOIN_CONVERSATION, 
      this.handleJoinConversation.bind(this), 
      { rateLimited: true, maxCalls: 50, timeout: 15000 }
    );

    // Leave conversation event
    registerEvent(SOCKET_EVENTS.LEAVE_CONVERSATION, 
      this.handleLeaveConversation.bind(this), 
      { rateLimited: true, maxCalls: 50, timeout: 15000 }
    );

    // New message event
    registerEvent(SOCKET_EVENTS.NEW_MESSAGE, 
      this.handleNewMessage.bind(this), 
      { rateLimited: true, maxCalls: 200, timeout: 30000 }
    );

    // Message read event
    registerEvent(SOCKET_EVENTS.MESSAGE_READ, 
      this.handleMessageRead.bind(this), 
      { rateLimited: true, maxCalls: 100, timeout: 15000 }
    );

    // Typing event
    registerEvent(SOCKET_EVENTS.MESSAGE_TYPING, 
      this.handleTyping.bind(this), 
      { rateLimited: true, maxCalls: 300, timeout: 10000 }
    );

    // Typing stop event
    registerEvent(SOCKET_EVENTS.MESSAGE_TYPING_STOP, 
      this.handleTypingStop.bind(this), 
      { rateLimited: true, maxCalls: 300, timeout: 10000 }
    );

    // Status change event
    registerEvent(SOCKET_EVENTS.USER_STATUS_CHANGE, 
      this.handleStatusChange.bind(this), 
      { rateLimited: true, maxCalls: 50, timeout: 15000 }
    );

    // Disconnect event
    registerEvent(SOCKET_EVENTS.DISCONNECT, 
      this.handleDisconnect.bind(this), 
      { maxCalls: 1, timeout: null }
    );

    // Error event
    registerEvent(SOCKET_EVENTS.ERROR, 
      this.handleSocketError.bind(this), 
      { maxCalls: 10, timeout: 5000 }
    );

    logger.info('Socket event listeners configurados con cleanup automático', {
      socketId,
      userEmail: userEmail?.substring(0, 20) + '...',
      totalEvents: listenersMap.size
    });
  }

  /**
   * 🛡️ WRAP EVENT HANDLER (RATE LIMITING + ERROR HANDLING)
   */
  wrapEventHandler(eventName, handler, socket, options = {}) {
    const { userEmail } = socket;
    const { rateLimited = false, requiresAuth = false } = options;

    return asyncWrapper(async (...args) => {
      try {
        // Update user activity
        this.updateUserActivity(userEmail);

        // Check authentication if required
        if (requiresAuth && !userEmail) {
          logger.warn('Unauthenticated event attempt', {
            category: 'SOCKET_EVENT_UNAUTH',
            eventName,
            socketId: socket.id
          });
          socket.emit(SOCKET_EVENTS.ERROR, {
            error: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required for this event',
            eventName
          });
          return;
        }

        // Apply rate limiting if enabled
        if (rateLimited && !this.checkRateLimit(userEmail, eventName)) {
          logger.warn('Rate limit exceeded for event', {
            category: 'SOCKET_RATE_LIMIT',
            email: userEmail.substring(0, 20) + '...',
            eventName,
            socketId: socket.id
          });
          socket.emit(SOCKET_EVENTS.ERROR, {
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please slow down.',
            eventName,
            retryAfter: RATE_LIMITS[eventName] || 1000
          });
          return;
        }

        // Execute handler
        await handler(socket, ...args);

        // Update metrics
        if (eventName === SOCKET_EVENTS.NEW_MESSAGE) {
          this.metrics.messagesPerSecond++;
        }

      } catch (error) {
        this.metrics.errorsPerSecond++;
        
        logger.error('Socket event handler error', {
          category: 'SOCKET_EVENT_ERROR',
          eventName,
          error: error.message,
          stack: error.stack,
          email: userEmail?.substring(0, 20) + '...',
          socketId: socket.id,
          severity: 'HIGH'
        });

        socket.emit(SOCKET_EVENTS.ERROR, {
          error: 'EVENT_HANDLER_ERROR',
          message: 'Error processing event',
          eventName
        });
      }
    }, {
      operationName: `socket_${eventName}`,
      timeoutMs: 30000
    });
  }

  /**
   * 🚦 CHECK RATE LIMIT
   */
  checkRateLimit(userEmail, eventName) {
    const rateLimitKey = `${userEmail}:${eventName}`;
    const now = Date.now();
    const lastTime = this.rateLimitTracker.get(rateLimitKey) || 0;
    const minInterval = RATE_LIMITS[eventName] || 1000;

    if (now - lastTime < minInterval) {
      return false; // Rate limited
    }

    // 🔧 MEMORY OPTIMIZATION: Auto-cleanup old rate limit entries
    if (this.rateLimitTracker.size > 50000) { // Limit to 50k entries
      this.cleanupOldRateLimitEntries();
    }

    this.rateLimitTracker.set(rateLimitKey, now);
    return true; // Allowed
  }

  /**
   * 🧹 CLEANUP OLD RATE LIMIT ENTRIES
   * Limpia entradas antiguas del rate limiting para optimizar memoria
   */
  cleanupOldRateLimitEntries() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutos
    let cleanedCount = 0;

    for (const [key, timestamp] of this.rateLimitTracker.entries()) {
      if (now - timestamp > maxAge) {
        this.rateLimitTracker.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Rate limit entries cleaned up', {
        category: 'SOCKET_RATE_LIMIT_CLEANUP',
        cleanedCount,
        remainingEntries: this.rateLimitTracker.size
      });
    }
  }

  /**
   * ⚡ UPDATE USER ACTIVITY
   */
  updateUserActivity(userEmail) {
    const session = this.connectedUsers.get(userEmail);
    if (session) {
      session.lastActivity = Date.now();
      this.connectedUsers.set(userEmail, session);
    }
  }

  // EVENT HANDLERS IMPLEMENTATION

  /**
   * 🔄 HANDLE SYNC STATE
   */
  async handleSyncState(socket, data) {
    const { userEmail, userRole } = socket;

    try {
      logger.info('User requesting state sync', {
        category: 'SOCKET_SYNC_STATE',
        email: userEmail.substring(0, 20) + '...',
        socketId: socket.id
      });

      // Get user conversations
      const conversations = await this.getUserConversations(userEmail, userRole);
      
      // Get unread messages count
      const unreadCounts = await this.getUnreadMessagesCounts(userEmail, conversations);
      
      // Get online users in conversations
      const onlineUsers = this.getOnlineUsersInConversations(conversations);

      // Send state to client
      socket.emit(SOCKET_EVENTS.STATE_SYNCED, {
        conversations,
        unreadCounts,
        onlineUsers,
        serverTime: new Date().toISOString(),
        syncId: data?.syncId || Date.now()
      });

      logger.debug('State sync completed', {
        category: 'SOCKET_SYNC_COMPLETE',
        email: userEmail.substring(0, 20) + '...',
        conversationsCount: conversations.length
      });

    } catch (error) {
      logger.error('Error in sync state', {
        category: 'SOCKET_SYNC_ERROR',
        error: error.message,
        email: userEmail?.substring(0, 20) + '...'
      });
      
      socket.emit(SOCKET_EVENTS.ERROR, {
        error: 'SYNC_FAILED',
        message: 'Failed to sync state'
      });
    }
  }

  /**
   * 👥 HANDLE JOIN CONVERSATION
   */
  async handleJoinConversation(socket, data) {
    const { userEmail, userRole } = socket;
    const { conversationId } = data;

    try {
      if (!conversationId) {
        throw new Error('conversationId is required');
      }

      // 🔧 SOCKET ROBUSTO: Obtener workspaceId y tenantId del socket
      const workspaceId = socket.decodedToken?.workspaceId || 'default';
      const tenantId = socket.decodedToken?.tenantId || 'na';

      // Verify user has permission to join conversation
      const hasPermission = await this.verifyConversationPermission(userEmail, conversationId, 'read');
      if (!hasPermission) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          error: 'PERMISSION_DENIED',
          message: 'No permission to join this conversation',
          conversationId
        });
        return;
      }

      // 🔧 SOCKET ROBUSTO: Construir roomId con convención establecida
      const roomId = `ws:${workspaceId}:ten:${tenantId}:conv:${conversationId}`;

      // 🔧 SOCKET ROBUSTO: Inicializar estructuras si no existen
      if (!this.rooms.has(roomId)) {
        this.rooms.set(roomId, new Set());
      }
      if (!this.userSessions.has(userEmail)) {
        this.userSessions.set(userEmail, new Set());
      }
      if (!this.socketConversations.has(socket.id)) {
        this.socketConversations.set(socket.id, new Set());
      }

      // 🔧 SOCKET ROBUSTO: Verificar límite de rooms por socket
      const socketRooms = this.socketConversations.get(socket.id);
      if (socketRooms && socketRooms.size >= SOCKET_LIMITS.MAX_ROOMS_PER_SOCKET) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          error: 'ROOM_LIMIT_EXCEEDED',
          message: `Maximum rooms per socket exceeded (${SOCKET_LIMITS.MAX_ROOMS_PER_SOCKET})`,
          conversationId
        });
        return;
      }

      // Join socket room
      socket.join(roomId);

      // 🔧 SOCKET ROBUSTO: Registrar en estructuras de tracking (DEFENSIVO)
      safeGetSet(this.rooms, roomId).add(socket.id);
      safeGetSet(this.userSessions, userEmail).add(socket.id);
      safeGetSet(this.socketConversations, socket.id).add(roomId);

      // Update user session
      const session = this.connectedUsers.get(userEmail);
      if (session) {
        session.conversations.add(conversationId);
        this.connectedUsers.set(userEmail, session);
      }

      // Update conversation users mapping
      let conversationUsers = this.conversationUsers.get(conversationId) || new Set();
      conversationUsers.add(userEmail);
      this.conversationUsers.set(conversationId, conversationUsers);

      // Update user conversations mapping
      let userConversations = this.userConversations.get(userEmail) || new Set();
      userConversations.add(conversationId);
      this.userConversations.set(userEmail, userConversations);

      // Notify other users in conversation
      socket.to(roomId).emit(SOCKET_EVENTS.USER_ONLINE, {
        email: userEmail,
        conversationId,
        timestamp: new Date().toISOString()
      });

      // Confirm join to user
      socket.emit(SOCKET_EVENTS.CONVERSATION_JOINED, {
        conversationId,
        roomId,
        onlineUsers: Array.from(conversationUsers),
        timestamp: new Date().toISOString()
      });

      // Logging estructurado sin PII
      logger.info('RT:JOIN', { 
        room: roomId.substring(0, 30) + '...', 
        conversationId: conversationId.substring(0, 20) + '...',
        userEmail: userEmail.substring(0, 20) + '...',
        socketId: socket.id.substring(0, 8) + '...'
      });
      
      if (process.env.SOCKET_LOG_VERBOSE === 'true') {
        logger.info('User joined conversation', {
          category: 'SOCKET_CONVERSATION_JOIN',
          email: userEmail.substring(0, 20) + '...',
          conversationId: conversationId.substring(0, 20) + '...',
          roomId: roomId.substring(0, 30) + '...',
          onlineUsersCount: conversationUsers.size,
          workspaceId: workspaceId ? 'present' : 'none',
          tenantId: tenantId ? 'present' : 'none'
        });
      }

    } catch (error) {
      logger.error('Error joining conversation', {
        category: 'SOCKET_JOIN_ERROR',
        error: error.message,
        email: userEmail?.substring(0, 20) + '...',
        conversationId: conversationId?.substring(0, 20) + '...'
      });

      socket.emit(SOCKET_EVENTS.ERROR, {
        error: 'JOIN_FAILED',
        message: 'Failed to join conversation',
        conversationId
      });
    }
  }

  /**
   * 🚪 HANDLE LEAVE CONVERSATION
   */
  async handleLeaveConversation(socket, data) {
    const { userEmail } = socket;
    const { conversationId } = data;

    try {
      if (!conversationId) {
        throw new Error('conversationId is required');
      }

      // 🔧 SOCKET ROBUSTO: Obtener workspaceId y tenantId del socket
      const workspaceId = socket.decodedToken?.workspaceId || 'default';
      const tenantId = socket.decodedToken?.tenantId || 'na';

      // 🔧 SOCKET ROBUSTO: Construir roomId con convención establecida
      const roomId = `ws:${workspaceId}:ten:${tenantId}:conv:${conversationId}`;

      // Leave socket room
      socket.leave(roomId);

      // 🔧 SOCKET ROBUSTO: Limpiar estructuras de tracking
      const roomSockets = this.rooms.get(roomId);
      if (roomSockets) {
        roomSockets.delete(socket.id);
        if (roomSockets.size === 0) {
          this.rooms.delete(roomId);
        }
      }

      const userSocketIds = this.userSessions.get(userEmail);
      if (userSocketIds) {
        userSocketIds.delete(socket.id);
        if (userSocketIds.size === 0) {
          this.userSessions.delete(userEmail);
        }
      }

      const socketRooms = this.socketConversations.get(socket.id);
      if (socketRooms) {
        socketRooms.delete(roomId);
        if (socketRooms.size === 0) {
          this.socketConversations.delete(socket.id);
        }
      }

      // Update user session
      const session = this.connectedUsers.get(userEmail);
      if (session) {
        session.conversations.delete(conversationId);
        this.connectedUsers.set(userEmail, session);
      }

      // Update conversation users mapping
      const conversationUsers = this.conversationUsers.get(conversationId);
      if (conversationUsers) {
        conversationUsers.delete(userEmail);
        if (conversationUsers.size === 0) {
          this.conversationUsers.delete(conversationId);
        } else {
          this.conversationUsers.set(conversationId, conversationUsers);
        }
      }

      // Update user conversations mapping
      const userConversations = this.userConversations.get(userEmail);
      if (userConversations) {
        userConversations.delete(conversationId);
        if (userConversations.size === 0) {
          this.userConversations.delete(userEmail);
        } else {
          this.userConversations.set(userEmail, userConversations);
        }
      }

      // Stop typing if user was typing
      await this.handleTypingStop(socket, { conversationId });

      // Notify other users in conversation
      socket.to(roomId).emit(SOCKET_EVENTS.USER_OFFLINE, {
        email: userEmail,
        conversationId,
        timestamp: new Date().toISOString()
      });

      // Confirm leave to user
      socket.emit(SOCKET_EVENTS.CONVERSATION_LEFT, {
        conversationId,
        roomId,
        timestamp: new Date().toISOString()
      });

      // Logging estructurado sin PII
      logger.info('RT:LEAVE', { 
        room: roomId.substring(0, 30) + '...', 
        conversationId: conversationId.substring(0, 20) + '...',
        userEmail: userEmail.substring(0, 20) + '...',
        socketId: socket.id.substring(0, 8) + '...'
      });
      
      if (process.env.SOCKET_LOG_VERBOSE === 'true') {
        logger.info('User left conversation', {
          category: 'SOCKET_CONVERSATION_LEAVE',
          email: userEmail.substring(0, 20) + '...',
          conversationId: conversationId.substring(0, 20) + '...',
          roomId: roomId.substring(0, 30) + '...',
          workspaceId: workspaceId ? 'present' : 'none',
          tenantId: tenantId ? 'present' : 'none'
        });
      }

    } catch (error) {
      logger.error('Error leaving conversation', {
        category: 'SOCKET_LEAVE_ERROR',
        error: error.message,
        email: userEmail?.substring(0, 20) + '...',
        conversationId: conversationId?.substring(0, 20) + '...'
      });

      socket.emit(SOCKET_EVENTS.ERROR, {
        error: 'LEAVE_FAILED',
        message: 'Failed to leave conversation',
        conversationId
      });
    }
  }

  /**
   * 💬 HANDLE NEW MESSAGE
   */
  async handleNewMessage(socket, messageData) {
    const { userEmail, userRole } = socket;

    try {
      const { conversationId, content, type = 'text', metadata = {} } = messageData;

      if (!conversationId || !content) {
        throw new Error('conversationId and content are required');
      }

      // Verify permission to send message
      const hasPermission = await this.verifyConversationPermission(userEmail, conversationId, 'write');
      if (!hasPermission) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          error: 'PERMISSION_DENIED',
          message: 'No permission to send message to this conversation',
          conversationId
        });
        return;
      }

      // Create message object
      const messageObj = {
        conversationId,
        content,
        type,
        senderEmail: userEmail,
        direction: 'outbound',
        status: 'sent',
        timestamp: new Date().toISOString(),
        metadata: {
          ...metadata,
          sentViaSocket: true,
          socketId: socket.id
        }
      };

      // Save message to database
              const savedMessage = await this.Message?.create(messageObj);

      // Stop typing for this user
      await this.handleTypingStop(socket, { conversationId });

      // Emit to all users in conversation (including sender for confirmation)
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: socket.decodedToken?.workspaceId || 'default',
        tenantId: socket.decodedToken?.tenantId || 'na',
        conversationId 
      });
      this.io.to(roomId).emit(SOCKET_EVENTS.MESSAGE_SENT, {
        message: savedMessage,
        conversationId,
        timestamp: new Date().toISOString()
      });

      logger.info('New message sent via Socket.IO', {
        category: 'SOCKET_MESSAGE_SENT',
        email: userEmail.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        messageId: savedMessage.id,
        type,
        contentLength: content.length
      });

    } catch (error) {
      logger.error('Error handling new message', {
        category: 'SOCKET_MESSAGE_ERROR',
        error: error.message,
        email: userEmail?.substring(0, 20) + '...',
        conversationId: messageData?.conversationId?.substring(0, 20) + '...'
      });

      socket.emit(SOCKET_EVENTS.ERROR, {
        error: 'MESSAGE_FAILED',
        message: 'Failed to send message',
        conversationId: messageData?.conversationId
      });
    }
  }

  /**
   * 👁️ HANDLE MESSAGE READ
   */
  async handleMessageRead(socket, data) {
    const { userEmail } = socket;
    const { conversationId, messageIds } = data;

    try {
      if (!conversationId || !messageIds || !Array.isArray(messageIds)) {
        throw new Error('conversationId and messageIds array are required');
      }

      // Update read status in database
      await this.Message?.markAsRead(messageIds, userEmail);

      // Notify other users in conversation
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: socket.decodedToken?.workspaceId || 'default',
        tenantId: socket.decodedToken?.tenantId || 'na',
        conversationId 
      });
      socket.to(roomId).emit(SOCKET_EVENTS.MESSAGE_READ, {
        conversationId,
        messageIds,
        readBy: userEmail,
        timestamp: new Date().toISOString()
      });

      logger.debug('Messages marked as read', {
        category: 'SOCKET_MESSAGE_READ',
        email: userEmail.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        messageCount: messageIds.length
      });

    } catch (error) {
      logger.error('Error marking messages as read', {
        category: 'SOCKET_READ_ERROR',
        error: error.message,
        email: userEmail?.substring(0, 20) + '...',
        conversationId: data?.conversationId?.substring(0, 20) + '...'
      });

      socket.emit(SOCKET_EVENTS.ERROR, {
        error: 'READ_FAILED',
        message: 'Failed to mark messages as read',
        conversationId
      });
    }
  }

  /**
   * ⌨️ HANDLE TYPING
   */
  async handleTyping(socket, data) {
    const { userEmail } = socket;
    const { conversationId } = data;

    try {
      if (!conversationId) {
        throw new Error('conversationId is required');
      }

      // Update typing users map
      let typingUsers = this.typingUsers.get(conversationId) || new Set();
      typingUsers.add(userEmail);
      this.typingUsers.set(conversationId, typingUsers);

      // Update user session
      const session = this.connectedUsers.get(userEmail);
      if (session) {
        session.isTyping = true;
        this.connectedUsers.set(userEmail, session);
      }

      // Notify other users in conversation (exclude sender)
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: socket.decodedToken?.workspaceId || 'default',
        tenantId: socket.decodedToken?.tenantId || 'na',
        conversationId 
      });
      socket.to(roomId).emit(SOCKET_EVENTS.MESSAGE_TYPING, {
        conversationId,
        userEmail,
        timestamp: new Date().toISOString()
      });

      // Auto-stop typing after 10 seconds
      setTimeout(() => {
        this.handleTypingStop(socket, { conversationId });
      }, 10000);

      logger.debug('User started typing', {
        category: 'SOCKET_TYPING_START',
        email: userEmail.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...'
      });

    } catch (error) {
      logger.error('Error handling typing', {
        category: 'SOCKET_TYPING_ERROR',
        error: error.message,
        email: userEmail?.substring(0, 20) + '...',
        conversationId: data?.conversationId?.substring(0, 20) + '...'
      });
    }
  }

  /**
   * ⌨️❌ HANDLE TYPING STOP
   */
  async handleTypingStop(socket, data) {
    const { userEmail } = socket;
    const { conversationId } = data;

    try {
      if (!conversationId) {
        throw new Error('conversationId is required');
      }

      // Update typing users map
      const typingUsers = this.typingUsers.get(conversationId);
      if (typingUsers) {
        typingUsers.delete(userEmail);
        if (typingUsers.size === 0) {
          this.typingUsers.delete(conversationId);
        } else {
          this.typingUsers.set(conversationId, typingUsers);
        }
      }

      // Update user session
      const session = this.connectedUsers.get(userEmail);
      if (session) {
        session.isTyping = false;
        this.connectedUsers.set(userEmail, session);
      }

      // Notify other users in conversation (exclude sender)
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: socket.decodedToken?.workspaceId || 'default',
        tenantId: socket.decodedToken?.tenantId || 'na',
        conversationId 
      });
      socket.to(roomId).emit(SOCKET_EVENTS.MESSAGE_TYPING_STOP, {
        conversationId,
        userEmail,
        timestamp: new Date().toISOString()
      });

      logger.debug('User stopped typing', {
        category: 'SOCKET_TYPING_STOP',
        email: userEmail.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...'
      });

    } catch (error) {
      logger.error('Error handling typing stop', {
        category: 'SOCKET_TYPING_STOP_ERROR',
        error: error.message,
        email: userEmail?.substring(0, 20) + '...',
        conversationId: data?.conversationId?.substring(0, 20) + '...'
      });
    }
  }

  /**
   * 📊 HANDLE STATUS CHANGE
   */
  async handleStatusChange(socket, data) {
    const { userEmail } = socket;
    const { status } = data;

    try {
      if (!status || !['online', 'away', 'busy', 'invisible'].includes(status)) {
        throw new Error('Valid status is required (online, away, busy, invisible)');
      }

      // Update user session
      const session = this.connectedUsers.get(userEmail);
      if (session) {
        session.status = status;
        this.connectedUsers.set(userEmail, session);
      }

      // Broadcast status change to relevant users
      this.broadcastUserPresence(userEmail, status, socket.userRole);

      logger.info('User status changed', {
        category: 'SOCKET_STATUS_CHANGE',
        email: userEmail.substring(0, 20) + '...',
        status
      });

    } catch (error) {
      logger.error('Error handling status change', {
        category: 'SOCKET_STATUS_ERROR',
        error: error.message,
        email: userEmail?.substring(0, 20) + '...'
      });

      socket.emit(SOCKET_EVENTS.ERROR, {
        error: 'STATUS_CHANGE_FAILED',
        message: 'Failed to change status'
      });
    }
  }

  /**
   * 🔌 HANDLE DISCONNECT
   */
  async handleDisconnect(socket, reason) {
    const { userEmail, socketId } = socket;

    try {
      this.metrics.disconnectionsPerSecond++;

      // 🔧 SOCKET ROBUSTO: Limpiar todas las rooms del socket
      const socketRooms = this.socketConversations.get(socketId);
      if (socketRooms) {
        for (const roomId of socketRooms) {
          // Salir de la room
          socket.leave(roomId);
          
          // Limpiar de la estructura rooms
          const roomSockets = this.rooms.get(roomId);
          if (roomSockets) {
            roomSockets.delete(socketId);
            if (roomSockets.size === 0) {
              this.rooms.delete(roomId);
            }
          }
        }
        // Limpiar el tracking del socket
        this.socketConversations.delete(socketId);
      }

      // 🔧 SOCKET ROBUSTO: Limpiar de userSessions
      const userSocketIds = this.userSessions.get(userEmail);
      if (userSocketIds) {
        userSocketIds.delete(socketId);
        if (userSocketIds.size === 0) {
          this.userSessions.delete(userEmail);
        }
      }

      // Logging estructurado sin PII
      logger.info('RT:DISCONNECT', { 
        socketId: socketId.substring(0, 8) + '...', 
        email: userEmail?.substring(0, 20) + '...',
        reason
      });
      
      if (process.env.SOCKET_LOG_VERBOSE === 'true') {
        logger.info('User disconnected from Socket.IO', {
          category: 'SOCKET_USER_DISCONNECTED',
          email: userEmail?.substring(0, 20) + '...',
          socketId,
          reason,
          connectedDuration: socket.connectedAt ? Date.now() - socket.connectedAt : 0,
          roomsCleaned: socketRooms?.size || 0
        });
      }

      // Clean up user session
      await this.cleanupUserSession(userEmail, socketId);

      // Broadcast user offline status
      this.broadcastUserPresence(userEmail, 'offline', socket.userRole);

    } catch (error) {
      logger.error('Error handling disconnect', {
        category: 'SOCKET_DISCONNECT_ERROR',
        error: error.message,
        userEmail: userEmail?.substring(0, 20) + '...',
        socketId,
        reason
      });
    }
  }

  /**
   * ❌ HANDLE SOCKET ERROR
   */
  async handleSocketError(socket, error) {
    const { userEmail, socketId } = socket;

    logger.error('Socket error occurred', {
      category: 'SOCKET_ERROR',
      error: error.message || error,
      email: userEmail?.substring(0, 20) + '...',
      socketId,
      severity: 'HIGH'
    });

    this.metrics.errorsPerSecond++;
  }

  // UTILITY METHODS

  /**
   * 🧹 CLEANUP USER SESSION
   */
  async cleanupUserSession(userEmail, socketId) {
    try {
      if (!userEmail) return;

      logger.debug('Iniciando cleanup de sesión de usuario', {
        category: 'SOCKET_CLEANUP_START',
        email: userEmail.substring(0, 20) + '...',
        socketId
      });

      // 1. Remove from connected users
      this.connectedUsers.delete(userEmail);

      // 2. Clean up event listeners - IMPROVED CLEANUP
      const listenersMap = this.eventListeners.get(socketId);
      if (listenersMap) {
        let cleanedListeners = 0;
        
        for (const [eventName, cleanupFn] of listenersMap.entries()) {
          try {
            cleanupFn();
            cleanedListeners++;
          } catch (cleanupError) {
            logger.warn('Error cleaning up event listener', {
              category: 'SOCKET_CLEANUP_WARNING',
              eventName,
              error: cleanupError.message
            });
          }
        }
        
        // Force clear the listeners map
        listenersMap.clear();
        this.eventListeners.delete(socketId);
        
        logger.debug('Event listeners cleaned up', {
          category: 'SOCKET_CLEANUP_LISTENERS',
          cleanedListeners,
          socketId
        });
      }

      // 3. Clean up user from all conversations
      const userConversations = this.userConversations.get(userEmail);
      if (userConversations) {
        for (const conversationId of userConversations) {
          // Remove from conversation users
          const conversationUsers = this.conversationUsers.get(conversationId);
          if (conversationUsers) {
            conversationUsers.delete(userEmail);
            if (conversationUsers.size === 0) {
              this.conversationUsers.delete(conversationId);
            } else {
              this.conversationUsers.set(conversationId, conversationUsers);
            }
          }

          // Stop typing in this conversation
          const typingUsers = this.typingUsers.get(conversationId);
          if (typingUsers) {
            typingUsers.delete(userEmail);
            if (typingUsers.size === 0) {
              this.typingUsers.delete(conversationId);
            } else {
              this.typingUsers.set(conversationId, typingUsers);
            }
          }
        }
        this.userConversations.delete(userEmail);
      }

      // 4. 🔧 MEMORY LEAK PREVENTION: Clean up rate limiting entries for this user
      this.cleanupUserRateLimitEntries(userEmail);

      // 5. 🔧 FORCE GARBAGE COLLECTION HINT
      if (global.gc && this.connectedUsers.size % 100 === 0) {
        // Trigger GC every 100 disconnections
        setImmediate(() => {
          global.gc();
          logger.debug('Garbage collection triggered after user cleanup', {
            category: 'SOCKET_GC_TRIGGER',
            connectedUsers: this.connectedUsers.size
          });
        });
      }

      logger.info('User session cleaned up successfully', {
        category: 'SOCKET_CLEANUP_SUCCESS',
        email: userEmail.substring(0, 20) + '...',
        socketId,
        remainingConnections: this.connectedUsers.size,
        memoryMaps: {
          connectedUsers: this.connectedUsers.size,
          userConversations: this.userConversations.size,
          conversationUsers: this.conversationUsers.size,
          eventListeners: this.eventListeners.size,
          rateLimitTracker: this.rateLimitTracker.size
        }
      });

    } catch (error) {
      logger.error('Error during user session cleanup', {
        category: 'SOCKET_CLEANUP_ERROR',
        error: error.message,
        stack: error.stack,
        userEmail: userEmail?.substring(0, 20) + '...',
        socketId
      });
    }
  }

  /**
   * 🧹 CLEANUP USER RATE LIMIT ENTRIES
   * Limpia entradas de rate limiting específicas del usuario
   */
  cleanupUserRateLimitEntries(userEmail) {
    let cleanedCount = 0;
    const userPrefix = `${userEmail}:`;

    for (const key of this.rateLimitTracker.keys()) {
      if (key.startsWith(userPrefix)) {
        this.rateLimitTracker.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('User rate limit entries cleaned', {
        category: 'SOCKET_USER_RATE_LIMIT_CLEANUP',
        email: userEmail.substring(0, 20) + '...',
        cleanedCount
      });
    }
  }

  /**
   * 📡 BROADCAST USER PRESENCE
   */
  broadcastUserPresence(userEmail, status, userRole) {
    try {
      if (!userEmail) return;

      const presenceData = {
        email: userEmail,
        status,
        role: userRole,
        timestamp: new Date().toISOString()
      };

      // Broadcast to all users in same role
      this.io.to(`role-${userRole}`).emit(SOCKET_EVENTS.PRESENCE_UPDATE, presenceData);

      // Broadcast to admins if user is not admin
      if (userRole !== 'admin' && userRole !== 'superadmin') {
        this.io.to('role-admin').emit(SOCKET_EVENTS.PRESENCE_UPDATE, presenceData);
      }

      logger.debug('User presence broadcasted', {
        category: 'SOCKET_PRESENCE_BROADCAST',
        email: userEmail.substring(0, 20) + '...',
        status,
        role: userRole
      });

    } catch (error) {
      logger.error('Error broadcasting user presence', {
        category: 'SOCKET_PRESENCE_ERROR',
        error: error.message,
        userEmail: userEmail?.substring(0, 20) + '...',
        status
      });
    }
  }

  /**
   * 🔍 GET USER CONVERSATIONS
   */
  async getUserConversations(userEmail, userRole) {
    try {
      // Use existing Conversation model method
      const conversations = await this.Conversation?.list({
        participantEmail: userEmail,
        limit: 100,
        includeMessages: false
      });

      return conversations;

    } catch (error) {
      logger.error('Error getting user conversations', {
        category: 'SOCKET_CONVERSATIONS_ERROR',
        error: error.message,
        userEmail: userEmail?.substring(0, 20) + '...'
      });
      return [];
    }
  }

  /**
   * 📊 GET UNREAD MESSAGES COUNTS
   */
  async getUnreadMessagesCounts(userEmail, conversations) {
    try {
      const unreadCounts = {};

      for (const conversation of conversations) {
        // Use existing Message model method if available
        const unreadCount = await this.Message?.getUnreadCount(conversation.id, userEmail);
        if (unreadCount > 0) {
          unreadCounts[conversation.id] = unreadCount;
        }
      }

      return unreadCounts;

    } catch (error) {
      logger.error('Error getting unread messages counts', {
        category: 'SOCKET_UNREAD_ERROR',
        error: error.message,
        userEmail: userEmail?.substring(0, 20) + '...'
      });
      return {};
    }
  }

  /**
   * 👥 GET ONLINE USERS IN CONVERSATIONS
   */
  getOnlineUsersInConversations(conversations) {
    try {
      const onlineUsers = {};

      for (const conversation of conversations) {
        const conversationUsers = this.conversationUsers.get(conversation.id);
        if (conversationUsers && conversationUsers.size > 0) {
          onlineUsers[conversation.id] = Array.from(conversationUsers);
        }
      }

      return onlineUsers;

    } catch (error) {
      logger.error('Error getting online users in conversations', {
        category: 'SOCKET_ONLINE_USERS_ERROR',
        error: error.message
      });
      return {};
    }
  }

  /**
   * 🔐 VERIFY CONVERSATION PERMISSION
   */
  async verifyConversationPermission(userEmail, conversationId, action = 'read') {
    try {
      // Si Conversation no está disponible, permitir acceso (modo desarrollo)
      if (!this.Conversation) {
        logger.warn('Conversation model not available, allowing access', {
          category: 'SOCKET_PERMISSION_MODEL_UNAVAILABLE',
          userEmail: userEmail?.substring(0, 20) + '...',
          conversationId: conversationId?.substring(0, 20) + '...'
        });
        return true;
      }

      // Use existing Conversation model method if available
      const conversation = await this.Conversation.getById(conversationId);
      if (!conversation) {
        return false;
      }

      // Check if user is participant
      const isParticipant = conversation.participants?.some(p => 
        p.email === userEmail || p.identifier === userEmail
      );

      if (!isParticipant) {
        // Check if user is admin/agent with access
        const userRole = this.userRoleCache.get(userEmail);
        return userRole === 'admin' || userRole === 'superadmin' || userRole === 'agent';
      }

      return true;

    } catch (error) {
      logger.error('Error verifying conversation permission', {
        category: 'SOCKET_PERMISSION_ERROR',
        error: error.message,
        userEmail: userEmail?.substring(0, 20) + '...',
        conversationId: conversationId?.substring(0, 20) + '...'
      });
      return false;
    }
  }

  /**
   * 📈 SEND INITIAL STATE SYNC
   */
  async sendInitialStateSync(socket) {
    try {
      const { userEmail, userRole } = socket;

      // Get user's conversations
      const conversations = await this.getUserConversations(userEmail, userRole);
      
      // Get unread counts
      const unreadCounts = await this.getUnreadMessagesCounts(userEmail, conversations);
      
      // Get online users
      const onlineUsers = this.getOnlineUsersInConversations(conversations);

      // Send initial state
      socket.emit(SOCKET_EVENTS.STATE_SYNCED, {
        conversations,
        unreadCounts,
        onlineUsers,
        serverTime: new Date().toISOString(),
        syncId: `initial_${Date.now()}`
      });

      logger.debug('Initial state sync sent', {
        category: 'SOCKET_INITIAL_SYNC',
        email: userEmail.substring(0, 20) + '...',
        conversationsCount: conversations.length
      });

    } catch (error) {
      logger.error('Error sending initial state sync', {
        category: 'SOCKET_INITIAL_SYNC_ERROR',
        error: error.message,
        userEmail: socket.userEmail?.substring(0, 20) + '...'
      });
    }
  }

  // MEMORY MANAGEMENT EVENT HANDLERS

  /**
   * 🧹 HANDLE USER SESSION EVICTION
   */
  handleUserSessionEviction(email, session, reason) {
    logger.info('User session evicted from memory', {
      category: 'SOCKET_SESSION_EVICTED',
      email: email?.substring(0, 20) + '...',
      reason,
      socketId: session?.socketId,
      lastActivity: session?.lastActivity ? new Date(session.lastActivity).toISOString() : null
    });

    // Force disconnect if socket still exists
    if (session?.socketId && this.io?.sockets?.sockets?.has(session.socketId)) {
      try {
        const socket = this.io.sockets.sockets.get(session.socketId);
        socket.emit(SOCKET_EVENTS.SYNC_REQUIRED, {
          reason: 'session_expired',
          message: 'Session expired, please reconnect'
        });
        socket.disconnect(true);
      } catch (error) {
        logger.warn('Error disconnecting evicted socket', {
          category: 'SOCKET_EVICTION_ERROR',
          error: error.message,
          socketId: session?.socketId
        });
      }
    }
  }

  /**
   * 🧹 HANDLE USER CONVERSATIONS EVICTION
   */
  handleUserConversationsEviction(email, conversationSet, reason) {
    logger.debug('User conversations evicted from memory', {
      category: 'SOCKET_USER_CONVERSATIONS_EVICTED',
      email: email?.substring(0, 20) + '...',
      conversationsCount: conversationSet?.size || 0,
      reason
    });
  }

  /**
   * 🧹 HANDLE CONVERSATION USERS EVICTION
   */
  handleConversationUsersEviction(conversationId, userSet, reason) {
    logger.debug('Conversation users evicted from memory', {
      category: 'SOCKET_CONVERSATION_USERS_EVICTED',
      conversationId: conversationId?.substring(0, 20) + '...',
      usersCount: userSet?.size || 0,
      reason
    });

    // Notify remaining users about conversation cleanup
    if (userSet && userSet.size > 0) {
      for (const email of userSet) {
        const session = this.connectedUsers.get(email);
        if (session?.socketId) {
          const socket = this.io.sockets.sockets.get(session.socketId);
          if (socket) {
            const { getConversationRoom } = require('./index');
            const roomId = getConversationRoom({ 
              workspaceId: socket.decodedToken?.workspaceId || 'default',
              tenantId: socket.decodedToken?.tenantId || 'na',
              conversationId 
            });
            socket.leave(roomId);
            socket.emit(SOCKET_EVENTS.CONVERSATION_CLEANUP, {
              conversationId,
              reason: 'memory_cleanup',
              action: 'rejoin_required'
            });
          }
        }
      }
    }
  }

  /**
   * 🧹 HANDLE TYPING EVICTION
   */
  handleTypingEviction(conversationId, typingSet, reason) {
    logger.debug('Typing users evicted from memory', {
      category: 'SOCKET_TYPING_EVICTED',
      conversationId: conversationId?.substring(0, 20) + '...',
      typingUsersCount: typingSet?.size || 0,
      reason
    });

    // Notify users that typing stopped
    if (typingSet && typingSet.size > 0) {
      for (const email of typingSet) {
        const { getConversationRoom } = require('./index');
        const roomId = getConversationRoom({ 
          workspaceId: 'default', // No tenemos contexto de workspace aquí
          tenantId: 'na',
          conversationId 
        });
        this.io.to(roomId).emit(SOCKET_EVENTS.MESSAGE_TYPING_STOP, {
          conversationId,
          userEmail: email,
          timestamp: new Date().toISOString(),
          reason: 'auto_cleanup'
        });
      }
    }
  }

  /**
   * 🧹 HANDLE EVENT LISTENERS EVICTION
   */
  handleEventListenersEviction(socketId, listenersMap, reason) {
    logger.debug('Event listeners evicted from memory', {
      category: 'SOCKET_LISTENERS_EVICTED',
      socketId,
      listenersCount: listenersMap?.size || 0,
      reason
    });

    // Execute cleanup functions
    if (listenersMap && listenersMap.size > 0) {
      for (const [eventName, cleanupFn] of listenersMap.entries()) {
        try {
          cleanupFn();
        } catch (error) {
          logger.warn('Error during evicted listener cleanup', {
            category: 'SOCKET_EVICTED_CLEANUP_ERROR',
            eventName,
            error: error.message
          });
        }
      }
    }
  }

  /**
   * 📊 SETUP MONITORING
   */
  setupMonitoring() {
    // Reset metrics every minute
    setInterval(() => {
      const now = Date.now();
      const duration = now - this.metrics.lastResetTime;
      
      logger.info('Socket.IO Performance Metrics', {
        category: 'SOCKET_METRICS',
        metrics: {
          connectionsPerSecond: this.metrics.connectionsPerSecond,
          messagesPerSecond: this.metrics.messagesPerSecond,
          disconnectionsPerSecond: this.metrics.disconnectionsPerSecond,
          errorsPerSecond: this.metrics.errorsPerSecond,
          currentConnections: this.connectedUsers.size,
          activeConversations: this.conversationUsers.size,
          typingUsers: this.typingUsers.size,
          rateLimitEntries: this.rateLimitTracker.size
        },
        period: `${duration}ms`,
        memoryUsage: process.memoryUsage()
      });

      // Reset counters
      this.metrics.connectionsPerSecond = 0;
      this.metrics.messagesPerSecond = 0;
      this.metrics.disconnectionsPerSecond = 0;
      this.metrics.errorsPerSecond = 0;
      this.metrics.lastResetTime = now;

    }, 60000); // Every minute

    // 🔧 ENHANCED MEMORY CLEANUP - More frequent cleanup for better memory management
    setInterval(() => {
      this.performMemoryCleanup();
    }, 2 * 60 * 1000); // Every 2 minutes (increased frequency)

    // 🔧 MEMORY LEAK DETECTION - Monitor memory growth
    setInterval(() => {
      this.performMemoryLeakDetection();
    }, 5 * 60 * 1000); // Every 5 minutes

    // 🔧 RATE LIMIT CLEANUP - Dedicated cleanup for rate limiting
    setInterval(() => {
      this.cleanupOldRateLimitEntries();
    }, 30 * 1000); // Every 30 seconds

    logger.info('✅ Socket.IO monitoring configured', {
      category: 'SOCKET_MONITORING_SUCCESS',
      intervals: {
        metrics: '60s',
        memoryCleanup: '2min',
        memoryLeakDetection: '5min',
        rateLimitCleanup: '30s'
      }
    });
  }

  /**
   * 🔍 PERFORM MEMORY LEAK DETECTION
   * Sistema de detección proactiva de memory leaks
   */
  performMemoryLeakDetection() {
    try {
      const memoryUsage = process.memoryUsage();
      const currentTime = Date.now();
      
      // Store previous memory readings for trend analysis
      if (!this.memoryHistory) {
        this.memoryHistory = [];
      }
      
      this.memoryHistory.push({
        timestamp: currentTime,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        connections: this.connectedUsers.size
      });
      
      // Keep only last 12 readings (1 hour of data)
      if (this.memoryHistory.length > 12) {
        this.memoryHistory = this.memoryHistory.slice(-12);
      }
      
      // Analyze memory trends if we have enough data
      if (this.memoryHistory.length >= 3) {
        const recent = this.memoryHistory.slice(-3);
        const isMemoryGrowing = recent.every((reading, index) => {
          if (index === 0) return true;
          return reading.heapUsed > recent[index - 1].heapUsed;
        });
        
        const memoryGrowthRate = recent[recent.length - 1].heapUsed - recent[0].heapUsed;
        const connectionsRatio = this.connectedUsers.size > 0 ? memoryUsage.heapUsed / this.connectedUsers.size : 0;
        
        if (isMemoryGrowing && memoryGrowthRate > 50 * 1024 * 1024) { // 50MB growth
          logger.warn('Potential memory leak detected', {
            category: 'SOCKET_MEMORY_LEAK_DETECTED',
            memoryGrowthMB: Math.round(memoryGrowthRate / 1024 / 1024),
            connectionsRatio: Math.round(connectionsRatio / 1024),
            currentStats: {
              heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
              connections: this.connectedUsers.size,
              eventListeners: this.eventListeners.size,
              rateLimitEntries: this.rateLimitTracker.size
            },
            recommendation: 'Consider performing aggressive cleanup'
          });
          
          // Trigger aggressive cleanup if memory leak detected
          this.performAggressiveCleanup();
        }
      }
      
      // Alert on high memory usage per connection
      const memoryPerConnection = this.connectedUsers.size > 0 
        ? memoryUsage.heapUsed / this.connectedUsers.size 
        : 0;
        
      if (memoryPerConnection > 10 * 1024 * 1024) { // 10MB per connection
        logger.warn('High memory usage per connection detected', {
          category: 'SOCKET_HIGH_MEMORY_PER_CONNECTION',
          memoryPerConnectionMB: Math.round(memoryPerConnection / 1024 / 1024),
          totalConnections: this.connectedUsers.size,
          totalMemoryMB: Math.round(memoryUsage.heapUsed / 1024 / 1024)
        });
      }
      
      logger.debug('Memory leak detection completed', {
        category: 'SOCKET_MEMORY_LEAK_CHECK',
        memoryTrend: this.memoryHistory.length >= 3 ? 'analyzed' : 'insufficient_data',
        historySize: this.memoryHistory.length,
        memoryPerConnectionKB: Math.round(memoryPerConnection / 1024)
      });
      
    } catch (error) {
      logger.error('Error in memory leak detection', {
        category: 'SOCKET_MEMORY_LEAK_ERROR',
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 🧹 PERFORM MEMORY CLEANUP
   */
  performMemoryCleanup() {
    try {
      logger.info('Performing Socket.IO memory cleanup...', {
        category: 'SOCKET_MEMORY_CLEANUP'
      });

      let cleanedSockets = 0;
      let cleanedConversations = 0;
      let cleanedEventListeners = 0;
      let cleanedRateLimit = 0;

      // 1. Clean up orphaned sockets
      for (const [email, session] of this.connectedUsers.entries()) {
        if (!session?.socketId || !this.io.sockets.sockets.has(session.socketId)) {
          this.connectedUsers.delete(email);
          cleanedSockets++;
        }
      }

      // 2. Clean up empty conversations
      for (const [conversationId, userSet] of this.conversationUsers.entries()) {
        if (!userSet || userSet.size === 0) {
          this.conversationUsers.delete(conversationId);
          cleanedConversations++;
        }
      }

      // 3. 🔧 MEMORY LEAK PREVENTION: Clean up orphaned event listeners
      for (const [socketId, listenersMap] of this.eventListeners.entries()) {
        if (!this.io.sockets.sockets.has(socketId)) {
          // Socket no longer exists, cleanup all its listeners
          if (listenersMap && listenersMap.size > 0) {
            for (const [eventName, cleanupFn] of listenersMap.entries()) {
              try {
                cleanupFn();
              } catch (error) {
                logger.warn('Error cleaning orphaned listener', {
                  category: 'SOCKET_ORPHANED_LISTENER_ERROR',
                  eventName,
                  error: error.message
                });
              }
            }
            listenersMap.clear();
          }
          this.eventListeners.delete(socketId);
          cleanedEventListeners++;
        }
      }

      // 4. 🔧 AGGRESSIVE RATE LIMIT CLEANUP
      this.cleanupOldRateLimitEntries();
      
      // Count cleaned rate limit entries
      const rateLimitSizeBefore = this.rateLimitTracker.size;
      this.cleanupOldRateLimitEntries();
      cleanedRateLimit = rateLimitSizeBefore - this.rateLimitTracker.size;

      // 5. 🔧 TYPING USERS CLEANUP (stale typing states)
      const now = Date.now();
      for (const [conversationId, typingSet] of this.typingUsers.entries()) {
        if (!typingSet || typingSet.size === 0) {
          this.typingUsers.delete(conversationId);
        }
      }

      // 6. 🔧 MEMORY PRESSURE CHECK
      const memoryUsage = process.memoryUsage();
      const memoryPressure = memoryUsage.heapUsed / memoryUsage.heapTotal;
      
      if (memoryPressure > 0.85) { // 85% memory usage
        // DESACTIVADO: Log excesivo de memoria
        // logger.warn('High memory pressure detected, performing aggressive cleanup', {
        //   category: 'SOCKET_MEMORY_PRESSURE',
        //   memoryPressure: (memoryPressure * 100).toFixed(2) + '%',
        //   heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        //   heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
        // });

        // Aggressive cleanup under memory pressure
        this.performAggressiveCleanup();
      }

      // 7. Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      logger.info('Socket.IO memory cleanup completed', {
        category: 'SOCKET_MEMORY_CLEANUP_COMPLETE',
        cleanedSockets,
        cleanedConversations,
        cleanedEventListeners,
        cleanedRateLimit,
        memoryPressure: (memoryPressure * 100).toFixed(2) + '%',
        currentStats: {
          connectedUsers: this.connectedUsers.size,
          activeConversations: this.conversationUsers.size,
          eventListeners: this.eventListeners.size,
          rateLimitEntries: this.rateLimitTracker.size,
          typingUsers: this.typingUsers.size
        },
        memoryUsage: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
          external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB'
        }
      });

    } catch (error) {
      logger.error('Error during Socket.IO memory cleanup', {
        category: 'SOCKET_MEMORY_CLEANUP_ERROR',
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 🔥 PERFORM AGGRESSIVE CLEANUP
   * Cleanup agresivo para situaciones de alta presión de memoria
   */
  performAggressiveCleanup() {
    // DESACTIVADO: Log excesivo de cleanup
    // logger.warn('Performing aggressive memory cleanup due to memory pressure', {
    //   category: 'SOCKET_AGGRESSIVE_CLEANUP'
    // });

    // 1. Clear old user role cache entries
    if (this.userRoleCache.size > 10000) {
      const entries = Array.from(this.userRoleCache.entries());
      const toDelete = entries.slice(0, Math.floor(entries.length * 0.3)); // Delete 30%
      
      for (const [key] of toDelete) {
        this.userRoleCache.delete(key);
      }
      
      // DESACTIVADO: Log de cleanup de cache
      // logger.info('Aggressive cleanup: User role cache reduced', {
      //   category: 'SOCKET_AGGRESSIVE_CACHE_CLEANUP',
      //   deletedEntries: toDelete.length,
      //   remainingEntries: this.userRoleCache.size
      // });
    }

    // 2. Clear all rate limiting entries older than 5 minutes
    const now = Date.now();
    const aggressiveMaxAge = 5 * 60 * 1000; // 5 minutes
    let cleanedCount = 0;

    for (const [key, timestamp] of this.rateLimitTracker.entries()) {
      if (now - timestamp > aggressiveMaxAge) {
        this.rateLimitTracker.delete(key);
        cleanedCount++;
      }
    }

    // DESACTIVADO: Log de cleanup de rate limit
    // logger.info('Aggressive cleanup: Rate limit entries cleared', {
    //   category: 'SOCKET_AGGRESSIVE_RATE_CLEANUP',
    //   cleanedCount,
    //   remainingEntries: this.rateLimitTracker.size
    // });

    // 3. Force immediate garbage collection
    if (global.gc) {
      global.gc();
      logger.info('Aggressive cleanup: Forced garbage collection', {
        category: 'SOCKET_AGGRESSIVE_GC'
      });
    }
  }

  /**
   * 🛑 SETUP GRACEFUL SHUTDOWN
   */
  setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      logger.info('🛑 Socket.IO graceful shutdown initiated...', {
        category: 'SOCKET_SHUTDOWN_START',
        signal,
        connectedUsers: this.connectedUsers.size
      });

      try {
        // Notify all connected users
        const connectedSockets = Array.from(this.io.sockets.sockets.values());
        
        for (const socket of connectedSockets) {
          try {
            socket.emit(SOCKET_EVENTS.SERVER_SHUTDOWN, {
              message: 'Server is restarting. You will be reconnected automatically.',
              timestamp: new Date().toISOString(),
              reason: signal
            });
          } catch (error) {
            logger.warn('Error notifying socket during shutdown', {
              category: 'SOCKET_SHUTDOWN_NOTIFY_ERROR',
              socketId: socket.id,
              error: error.message
            });
          }
        }

        // Wait a moment for notifications to be sent
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Close all connections
        this.io.close();

        logger.info('✅ Socket.IO graceful shutdown completed', {
          category: 'SOCKET_SHUTDOWN_COMPLETE',
          signal,
          duration: Date.now()
        });

      } catch (error) {
        logger.error('Error during Socket.IO graceful shutdown', {
          category: 'SOCKET_SHUTDOWN_ERROR',
          error: error.message,
          stack: error.stack
        });
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

    logger.info('✅ Socket.IO graceful shutdown configured', {
      category: 'SOCKET_SHUTDOWN_SETUP'
    });
  }

  /**
   * 📊 GET DETAILED STATS
   */
  getDetailedStats() {
    try {
      return {
        connections: {
          total: this.connectedUsers.size,
          byRole: this.getConnectionsByRole()
        },
        conversations: {
          active: this.conversationUsers.size,
          totalParticipants: this.getTotalParticipants()
        },
        memory: {
          connectedUsers: this.connectedUsers.size,
          userConversations: this.userConversations.size,
          conversationUsers: this.conversationUsers.size,
          userRoleCache: this.userRoleCache.size,
          rateLimitTracker: this.rateLimitTracker.size,
          typingUsers: this.typingUsers.size,
          eventListeners: this.eventListeners.size
        },
        performance: {
          ...this.metrics
        },
        serverInfo: {
          isShuttingDown: this.isShuttingDown,
          nodeEnv: process.env.NODE_ENV,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Error getting detailed stats', {
        category: 'SOCKET_STATS_ERROR',
        error: error.message
      });
      return null;
    }
  }

  /**
   * 📊 GET CONNECTIONS BY ROLE
   */
  getConnectionsByRole() {
    const roleStats = {};
    
    for (const [email, session] of this.connectedUsers.entries()) {
      const role = session.role || 'unknown';
      roleStats[role] = (roleStats[role] || 0) + 1;
    }
    
    return roleStats;
  }

  /**
   * 📊 GET TOTAL PARTICIPANTS
   */
  getTotalParticipants() {
    let total = 0;
    
    for (const [conversationId, userSet] of this.conversationUsers.entries()) {
      total += userSet.size;
    }
    
    return total;
  }

  /**
   * 👥 GET CONNECTED USERS (PUBLIC METHOD)
   */
  getConnectedUsers() {
    try {
      const users = [];
      
      for (const [email, session] of this.connectedUsers.entries()) {
        users.push({
          email: email.substring(0, 20) + '...',
          role: session.role,
          connectedAt: new Date(session.connectedAt).toISOString(),
          lastActivity: new Date(session.lastActivity).toISOString(),
          status: session.status || 'online',
          conversationsCount: session.conversations?.size || 0
        });
      }
      
      return users;
    } catch (error) {
      logger.error('Error getting connected users', {
        category: 'SOCKET_GET_USERS_ERROR',
        error: error.message
      });
      return [];
    }
  }

  /**
   * 📡 BROADCAST TO CONVERSATION (MÉTODO PÚBLICO PARA REPOSITORIO)
   * Emite eventos a una conversación específica con autorización
   */
  broadcastToConversation({ workspaceId, tenantId, conversationId, event, payload }) {
    try {
      // Validar parámetros requeridos
      if (!conversationId || !event) {
        logger.error('broadcastToConversation: Parámetros requeridos faltantes', {
          category: 'SOCKET_BROADCAST_ERROR',
          conversationId: conversationId?.substring(0, 20) + '...',
          event,
          hasWorkspaceId: !!workspaceId,
          hasTenantId: !!tenantId
        });
        return false;
      }

      // Construir roomId con la convención establecida
      const roomId = `ws:${workspaceId || 'default'}:ten:${tenantId || 'na'}:conv:${conversationId}`;

      // Verificar autorización previa (si el repo pasa workspaceId/tenantId, confiamos)
      if (!workspaceId) {
        logger.warn('broadcastToConversation: Sin workspaceId, omitiendo broadcast', {
          category: 'SOCKET_BROADCAST_AUTH_WARNING',
          conversationId: conversationId.substring(0, 20) + '...',
          event
        });
        return false;
      }

      // Emitir solo a la room específica (nunca a todos)
      this.io.to(roomId).emit(event, payload);

      // 🔍 LOGGING ESTRUCTURADO DE BROADCAST
      if (process.env.SOCKET_LOG_VERBOSE === 'true') {
        logger.info({
          event: 'broadcast',
          requestId: payload.requestId || null,
          rt: { 
            eventName: event, 
            roomId: roomId.substring(0, 30) + '...' 
          },
          conv: { conversationId: conversationId.substring(0, 20) + '...' },
          msg: { messageId: payload.messageId || null },
          payloadSize: JSON.stringify(payload).length,
          workspaceId: workspaceId ? 'present' : 'none',
          tenantId: tenantId ? 'present' : 'none'
        });
      }

      return true;

    } catch (error) {
      logger.error('Error en broadcastToConversation', {
        category: 'SOCKET_BROADCAST_ERROR',
        error: error.message,
        stack: error.stack,
        conversationId: conversationId?.substring(0, 20) + '...',
        event
      });
      return false;
    }
  }

  /**
   * 🔧 REGISTER EVENT (MÉTODO SEGURO PARA REGISTRAR EVENTOS)
   * Garantiza que las estructuras Map/Set estén inicializadas antes de usar
   */
  registerEvent(socketId, eventName, handler) {
    try {
      // 🔧 SOCKET ROBUSTO: Inicializar estructuras si no existen
      if (!this.rooms) this.rooms = new Map();
      if (!this.userSessions) this.userSessions = new Map();
      if (!this.socketConversations) this.socketConversations = new Map();

      // Inicializar Set para socketId si no existe
      if (!this.socketConversations.has(socketId)) {
        this.socketConversations.set(socketId, new Set());
      }

      // Registrar el evento
      const listenersMap = this.eventListeners.get(socketId);
      if (listenersMap) {
        listenersMap.set(eventName, handler);
      }

      if (process.env.SOCKET_LOG_VERBOSE === 'true') {
        logger.debug('Evento registrado exitosamente', {
          category: 'SOCKET_EVENT_REGISTER',
          socketId,
          eventName,
          totalEvents: listenersMap?.size || 0
        });
      }

    } catch (error) {
      logger.error('Error registrando evento', {
        category: 'SOCKET_EVENT_REGISTER_ERROR',
        error: error.message,
        socketId,
        eventName
      });
    }
  }

  /**
   * 📡 EMIT NEW MESSAGE (FACADE PARA MENSAJES NUEVOS)
   * Emite eventos para mensajes entrantes y salientes
   */
  emitNewMessage({ workspaceId, tenantId, conversationId, message, correlationId }) {
    try {
      // Emitir evento principal (compatibilidad frontend)
      this.broadcastToConversation({
        workspaceId, tenantId, conversationId,
        event: 'new-message',
        payload: { 
          conversationId, 
          message, 
          correlationId 
        }
      });

      // Emitir alias para compatibilidad futura
      this.broadcastToConversation({
        workspaceId, tenantId, conversationId,
        event: 'message.created',
        payload: { 
          conversationId, 
          message, 
          correlationId 
        }
      });

      logger.info('RT:BROADCAST new-message', { 
        event: 'new-message', 
        conversationId: conversationId?.substring(0, 20) + '...', 
        messageId: message?.id,
        correlationId 
      });

    } catch (error) {
      logger.error('RT:ERROR emitNewMessage', { 
        where: 'emitNewMessage', 
        err: error.message,
        conversationId: conversationId?.substring(0, 20) + '...'
      });
    }
  }

  /**
   * 📡 EMIT CONVERSATION UPDATED (FACADE PARA ACTUALIZACIONES DE CONVERSACIÓN)
   * Emite eventos cuando se actualiza una conversación
   */
  emitConversationUpdated({ workspaceId, tenantId, conversationId, lastMessage, updatedAt, unreadCount, correlationId }) {
    try {
      // Emitir evento principal (compatibilidad frontend)
      this.broadcastToConversation({
        workspaceId, tenantId, conversationId,
        event: 'conversation-event',
        payload: { 
          conversationId, 
          lastMessage, 
          updatedAt, 
          unreadCount, 
          correlationId 
        }
      });

      // Emitir alias para compatibilidad futura
      this.broadcastToConversation({
        workspaceId, tenantId, conversationId,
        event: 'conversation.updated',
        payload: { 
          conversationId, 
          lastMessage, 
          updatedAt, 
          unreadCount, 
          correlationId 
        }
      });

      logger.info('RT:BROADCAST conversation-event', { 
        event: 'conversation-event', 
        conversationId: conversationId?.substring(0, 20) + '...', 
        correlationId 
      });

    } catch (error) {
      logger.error('RT:ERROR emitConversationUpdated', { 
        where: 'emitConversationUpdated', 
        err: error.message,
        conversationId: conversationId?.substring(0, 20) + '...'
      });
    }
  }
}

// Export nombrado unificado
module.exports = { EnterpriseSocketManager }; 