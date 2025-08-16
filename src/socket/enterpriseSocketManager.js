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
  
  // 🆕 File events
  FILE_UPLOADED: 'file-uploaded',
  FILE_PROCESSING: 'file-processing',
  FILE_READY: 'file-ready',
  FILE_ERROR: 'file-error',
  FILE_PROGRESS: 'file-progress',
  CONVERSATION_FILES_UPDATED: 'conversation-files-updated',
  FILE_RECEIVED: 'file-received',
  FILE_DELETED: 'file-deleted',
  
  // 🆕 Audio events
  AUDIO_PLAYING: 'audio-playing',
  AUDIO_STOPPED: 'audio-stopped',
  AUDIO_PAUSED: 'audio-paused',
  AUDIO_RECORDING: 'audio-recording',
  AUDIO_RECORDING_STOPPED: 'audio-recording-stopped',
  AUDIO_RECORDING_PROGRESS: 'audio-recording-progress',
  AUDIO_RECORDING_COMPLETED: 'audio-recording-completed',
  AUDIO_RECORDING_ERROR: 'audio-recording-error',
  
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

// Rate limiting configuration (per user per event) - OPTIMIZADO PARA REDUCIR RATE LIMIT
const RATE_LIMITS = {
  [SOCKET_EVENTS.MESSAGE_TYPING]: 500,        // 🔧 CORRECCIÓN: 0.5 seconds (más permisivo)
  [SOCKET_EVENTS.MESSAGE_TYPING_STOP]: 200,   // 🔧 CORRECCIÓN: 0.2 seconds (más permisivo)
  [SOCKET_EVENTS.JOIN_CONVERSATION]: 1000,    // 🔧 CORRECCIÓN: 1 second (más permisivo)
  [SOCKET_EVENTS.LEAVE_CONVERSATION]: 1000,   // 🔧 CORRECCIÓN: 1 second (más permisivo)
  [SOCKET_EVENTS.NEW_MESSAGE]: 200,           // 🔧 CORRECCIÓN: 0.2 seconds (más permisivo)
  [SOCKET_EVENTS.MESSAGE_READ]: 200,          // 🔧 CORRECCIÓN: 0.2 seconds (más permisivo)
  [SOCKET_EVENTS.USER_STATUS_CHANGE]: 2000,   // 🔧 CORRECCIÓN: 2 seconds (más permisivo)
  [SOCKET_EVENTS.SYNC_STATE]: 5000,           // 🔧 CORRECCIÓN: 5 seconds (más permisivo)
  
  // 🆕 File event rate limits
  [SOCKET_EVENTS.FILE_UPLOADED]: 1000,        // 1 second
  [SOCKET_EVENTS.FILE_PROCESSING]: 500,       // 0.5 seconds
  [SOCKET_EVENTS.FILE_READY]: 1000,           // 1 second
  [SOCKET_EVENTS.FILE_ERROR]: 2000,           // 2 seconds
  [SOCKET_EVENTS.FILE_PROGRESS]: 200,         // 0.2 seconds
  
  // 🆕 Audio event rate limits
  [SOCKET_EVENTS.AUDIO_PLAYING]: 500,         // 0.5 seconds
  [SOCKET_EVENTS.AUDIO_STOPPED]: 500,         // 0.5 seconds
  [SOCKET_EVENTS.AUDIO_PAUSED]: 500,          // 0.5 seconds
  [SOCKET_EVENTS.AUDIO_RECORDING]: 1000,      // 1 second
  [SOCKET_EVENTS.AUDIO_RECORDING_STOPPED]: 1000, // 1 second
  [SOCKET_EVENTS.AUDIO_RECORDING_PROGRESS]: 200, // 0.2 seconds
  [SOCKET_EVENTS.AUDIO_RECORDING_COMPLETED]: 1000, // 1 second
  [SOCKET_EVENTS.AUDIO_RECORDING_ERROR]: 2000 // 2 seconds
};

// 🔧 SOCKET ROBUSTO: Límites de configuración - OPTIMIZADOS PARA ESTABILIDAD
const SOCKET_LIMITS = {
  MAX_ROOMS_PER_SOCKET: parseInt(process.env.SOCKET_MAX_ROOMS_PER_SOCKET) || 50, // Reducido para estabilidad
  MAX_JOINS_PER_10S: 10, // Reducido para estabilidad
  HEARTBEAT_INTERVAL: 25000, // 🔧 CORRECCIÓN: Aumentado a 25s para estabilidad
  HEARTBEAT_TIMEOUT: 45000   // 🔧 CORRECCIÓN: Aumentado a 45s para evitar timeouts
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
    
    // Log de diagnóstico de dependencias
    logger.info('Socket.IO: Dependencies injected', {
      category: 'SOCKET_DEPS_INJECTION',
      userModelAvailable: !!this.User,
      conversationModelAvailable: !!this.Conversation,
      messageModelAvailable: !!this.Message,
      userModelType: this.User ? this.User.constructor.name : 'null'
    });
    
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

    // Usar la misma validación de CORS que Express
    const { socketCorsOptions } = require('../config/cors');

    this.io = new Server(this.server, {
      // CORS configuration unificada - CORREGIDO
      cors: socketCorsOptions,

      // Transport configuration
      transports: ['websocket', 'polling'],
      
      // 🔧 CORRECCIÓN CRÍTICA: Timeouts optimizados para evitar Status 0
      pingTimeout: 60000,     // 60s para evitar timeouts espurios
      pingInterval: 25000,    // 25s para mantener conexión
      
      // Connection limits
      maxHttpBufferSize: 1e6, // 🔧 CORRECCIÓN: Reducido de 2MB a 1MB
      
      // 🔧 CORRECCIÓN: Timeouts de conexión optimizados
      connectTimeout: 30000,  // 🔧 CORRECCIÓN: Aumentado a 30s para conexiones lentas
      upgradeTimeout: 10000,  // 🔧 CORRECCIÓN: Aumentado a 10s para upgrades
      allowUpgrades: true,
      perMessageDeflate: false,
      
      // Memory usage optimization
      connectionStateRecovery: true,
      
      // Additional settings
      allowEIO3: true,  // 🔧 CORRECCIÓN: Habilitar Engine.IO v3
      cookie: false,
      serveClient: false,
      
      // 🔧 CORRECCIÓN: Configuración adicional para CORS WebSocket
      allowRequest: (req, callback) => {
        const origin = req.headers.origin || req.headers.referer;
        
        // Permitir requests sin origin (común en WebSocket)
        if (!origin) {
          logger.debug('Socket.IO: Request sin origin permitido', {
            category: 'SOCKET_CORS_HANDSHAKE',
            headers: Object.keys(req.headers)
          });
          return callback(null, true);
        }
        
        // Validar origin si está presente
        const { isOriginAllowed } = require('../config/cors');
        if (isOriginAllowed(origin)) {
          return callback(null, true);
        }
        
        logger.warn('Socket.IO: Request bloqueado por CORS', {
          category: 'SOCKET_CORS_BLOCKED',
          origin,
          headers: req.headers
        });
        return callback(null, false);
      }
    });

    // Manejo de errores del engine
    this.io.engine.on("connection_error", (err) => {
      // 🔧 LOG CRÍTICO PARA RAILWAY: Error de conexión WebSocket
      console.log(`🚨 WEBSOCKET_ERROR: ${err.message} - Code: ${err.code} - Context: ${err.context || 'unknown'}`);
      
      logger.warn('Socket.IO engine connection error', {
        category: 'SOCKET_ENGINE_ERROR',
        error: err.message,
        code: err.code,
        context: err.context || 'unknown'
      });
    });

    logger.info('✅ Socket.IO server configured successfully', {
      category: 'SOCKET_CONFIG_SUCCESS',
      corsConfig: 'unified'
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
        const rawAuthToken = socket.handshake.auth?.token || socket.handshake.query?.token || socket.handshake.headers?.authorization;
        let token = rawAuthToken || '';
        if (typeof token === 'string' && token.startsWith('Bearer ')) {
          token = token.slice('Bearer '.length);
        }

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
            category: 'SOCKET_AUTH_CONFIG_ERROR',
            socketId: socket.id,
            jwtConfigAvailable: !!jwtConfig,
            hasSecret: !!jwtConfig.secret
          });
          return next(new Error('SERVER_CONFIGURATION_ERROR'));
        }
        
        logger.info('Socket.IO: JWT configuration validated', {
          category: 'SOCKET_AUTH_JWT_CONFIG',
          socketId: socket.id,
          hasSecret: !!jwtConfig.secret,
          issuer: jwtConfig.issuer,
          audience: jwtConfig.audience
        });

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

        // 🔧 CORRECCIÓN CRÍTICA: Extraer workspaceId y tenantId del JWT
            const workspaceId = decodedToken.workspaceId || 'default_workspace';
    const tenantId = decodedToken.tenantId || 'default_tenant';
        const userId = decodedToken.userId || email;

        logger.info('Socket.IO: JWT claims extracted successfully', {
          category: 'SOCKET_AUTH_CLAIMS_EXTRACTED',
          socketId: socket.id,
          email: email.substring(0, 20) + '...',
          workspaceId: workspaceId,
          tenantId: tenantId,
          userId: userId
        });

        // Get user role (simplificado)
        let userRole = this.userRoleCache.get(email);
        if (!userRole) {
          try {
            // Verificar si User está disponible
            if (!this.User) {
              logger.warn('Socket.IO: User model not available, using default role', {
                category: 'SOCKET_AUTH_USER_MODEL_UNAVAILABLE',
                email: email.substring(0, 20) + '...',
                socketId: socket.id,
                userModelAvailable: false
              });
              userRole = 'agent'; // Role por defecto
            } else {
              // Test de conectividad Firestore antes de intentar obtener usuario
              try {
                const { firestore } = require('../config/firebase');
                if (!firestore) {
                  throw new Error('Firestore not initialized');
                }
                
                logger.info('Socket.IO: Firestore connectivity test passed', {
                  category: 'SOCKET_AUTH_FIRESTORE_TEST',
                  email: email.substring(0, 20) + '...',
                  socketId: socket.id,
                  firestoreAvailable: !!firestore
                });
              } catch (firestoreError) {
                logger.error('Socket.IO: Firestore connectivity test failed', {
                  category: 'SOCKET_AUTH_FIRESTORE_ERROR',
                  error: firestoreError.message,
                  email: email.substring(0, 20) + '...',
                  socketId: socket.id
                });
                throw firestoreError;
              }
              logger.info('Socket.IO: Attempting to get user from database', {
                category: 'SOCKET_AUTH_DB_ATTEMPT',
                email: email.substring(0, 20) + '...',
                socketId: socket.id,
                userModelAvailable: true
              });
              
              const user = await this.User.getByEmail(email);
              
              if (!user || !user.isActive) {
                logger.warn('Socket.IO: User not found or inactive', {
                  category: 'SOCKET_AUTH_USER_NOT_FOUND',
                  email: email.substring(0, 20) + '...',
                  socketId: socket.id,
                  userFound: !!user,
                  userActive: user?.isActive
                });
                return next(new Error('AUTHENTICATION_FAILED: User not found or inactive'));
              }
              
              userRole = user.role;
              logger.info('Socket.IO: User retrieved successfully', {
                category: 'SOCKET_AUTH_USER_SUCCESS',
                email: email.substring(0, 20) + '...',
                socketId: socket.id,
                userRole: userRole
              });
            }
            this.userRoleCache.set(email, userRole);
          } catch (dbError) {
            logger.error('Socket.IO: Database error during auth', {
              category: 'SOCKET_AUTH_DB_ERROR',
              error: dbError.message,
              stack: dbError.stack,
              socketId: socket.id,
              email: email.substring(0, 20) + '...'
            });
            return next(new Error('AUTHENTICATION_FAILED: Database error'));
          }
        }

        // 🔧 CORRECCIÓN CRÍTICA: Attach authenticated user data to socket with workspaceId
        socket.userEmail = email;
        socket.userRole = userRole;
        socket.decodedToken = decodedToken;
        socket.connectedAt = Date.now();
        socket.lastActivity = Date.now();

        // 🔧 CORRECCIÓN CRÍTICA: Socket data with workspaceId and tenantId
        socket.data = {
          userId: userId,
          emailMasked: email.substring(0, 20) + '...',
          workspaceId: workspaceId,  // 🔧 CORRECCIÓN: Extraído del JWT
          tenantId: tenantId         // 🔧 CORRECCIÓN: Extraído del JWT
        };

        // 🔧 CORRECCIÓN CRÍTICA: Agregar workspaceId y tenantId directamente al socket
        socket.workspaceId = workspaceId;
        socket.tenantId = tenantId;

        logger.info('Socket.IO: Authentication successful with workspaceId', {
          category: 'SOCKET_AUTH_SUCCESS',
          email: email.substring(0, 20) + '...',
          role: userRole,
          socketId: socket.id,
          workspaceId: workspaceId,
          tenantId: tenantId
        });

        // 🔧 PRUEBA: Verificar que el workspaceId se extrajo correctamente
        const { testWorkspaceIdExtraction } = require('./index');
        const workspaceIdTest = testWorkspaceIdExtraction(socket);
        logger.info('Socket.IO: WorkspaceId extraction test', {
          category: 'SOCKET_AUTH_WORKSPACE_TEST',
          socketId: socket.id,
          testPassed: workspaceIdTest,
          workspaceId: workspaceId
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
   * 🔌 HANDLE NEW CONNECTION
   */
  async handleNewConnection(socket) {
    const { userEmail, userRole } = socket;
    const connectedAt = Date.now();

    try {
      // ✅ VALIDACIÓN: Verificar que userEmail sea válido
      if (!userEmail || typeof userEmail !== 'string') {
        logger.warn('Conexión sin userEmail válido', {
          category: 'SOCKET_CONNECTION_WARNING',
          userEmail: userEmail,
          userEmailType: typeof userEmail,
          socketId: socket.id
        });
        socket.disconnect(true);
        return;
      }

      // ✅ VALIDACIÓN: Verificar que userRole sea válido
      if (!userRole) {
        logger.warn('Conexión sin userRole válido', {
          category: 'SOCKET_CONNECTION_WARNING',
          userEmail: userEmail.substring(0, 20) + '...',
          userRole: userRole,
          socketId: socket.id
        });
        socket.disconnect(true);
        return;
      }

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

      // 🔧 CORRECCIÓN: Delay para asegurar que los listeners estén configurados
      await new Promise(resolve => setTimeout(resolve, 100));

      // ✅ VALIDACIÓN: Verificar que el socket esté conectado antes de configurar listeners
      if (!socket.connected) {
        logger.warn('Socket desconectado antes de configurar listeners', {
          category: 'SOCKET_LISTENERS_WARNING',
          userEmail: userEmail.substring(0, 20) + '...',
          socketId: socket.id
        });
        return;
      }

      // Setup socket event listeners with automatic cleanup
      this.setupSocketEventListeners(socket);

      // ✅ SOLUCIÓN INMEDIATA: Enviar sync inicial SIN delay para evitar desconexiones
      try {
        logger.info('🚀 ENVIANDO SYNC INICIAL INMEDIATO', {
          category: 'SOCKET_INITIAL_SYNC_IMMEDIATE',
          userEmail: userEmail.substring(0, 20) + '...',
          socketId: socket.id,
          socketConnected: socket.connected
        });

        // ✅ VALIDACIÓN: Verificar que el socket aún esté conectado
        if (!socket.connected) {
          logger.warn('Socket desconectado antes del sync inicial inmediato', {
            category: 'SOCKET_INITIAL_SYNC_WARNING',
            userEmail: userEmail.substring(0, 20) + '...',
            socketId: socket.id
          });
          return;
        }

        // Send initial state synchronization INMEDIATAMENTE
        await this.sendInitialStateSync(socket);

        // ✅ VALIDACIÓN: Verificar que el socket aún esté conectado después del sync
        if (!socket.connected) {
          logger.warn('Socket desconectado después del sync inicial inmediato', {
            category: 'SOCKET_INITIAL_SYNC_WARNING',
            userEmail: userEmail.substring(0, 20) + '...',
            socketId: socket.id
          });
          return;
        }

        // Notify other users about new user online
        this.broadcastUserPresence(userEmail, 'online', userRole);

        logger.info('✅ SYNC INICIAL INMEDIATO COMPLETADO', {
          category: 'SOCKET_INITIAL_SYNC_IMMEDIATE_SUCCESS',
          userEmail: userEmail.substring(0, 20) + '...',
          socketId: socket.id
        });

      } catch (syncError) {
        logger.error('Error en sync inicial inmediato', {
          category: 'SOCKET_INITIAL_SYNC_ERROR',
          error: syncError.message,
          userEmail: userEmail.substring(0, 20) + '...',
          socketId: socket.id,
          stack: syncError.stack?.split('\n').slice(0, 3)
        });
      }

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
    let listenersMap = this.eventListeners.get(socketId);
    
    // Ensure listenersMap exists
    if (!listenersMap) {
      logger.info('Creating new listenersMap for socket', {
        category: 'SOCKET_LISTENERS_CREATION',
        socketId,
        userEmail: userEmail?.substring(0, 20) + '...',
        eventListenersSize: this.eventListeners.size
      });
      listenersMap = new Map();
      this.eventListeners.set(socketId, listenersMap);
    }

    // Helper to register event with cleanup - CORREGIDO
    const registerEvent = (eventName, handler, options = {}) => {
      const wrappedHandler = this.wrapEventHandler(eventName, handler, socket, options);
      
      // 🔧 CORRECCIÓN: Usar configuración específica para WebSocket
      const eventCleanup = require('../utils/eventCleanup');
      eventCleanup.addListener(socket, eventName, wrappedHandler, {
        maxCalls: options.maxCalls || Infinity,
        timeout: options.timeout || null,
        autoCleanup: false,  // 🔧 CORRECCIÓN: No cleanup automático para WebSocket
        reRegisterOnMissing: true,  // 🔧 CORRECCIÓN: Re-registrar si falta
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

    // Alias helper: registra múltiples nombres apuntando al mismo handler
    const registerAliases = (names, handler, options = {}) => {
      names.forEach((n) => registerEvent(n, handler, options));
    };

    // Sync state
    registerEvent(SOCKET_EVENTS.SYNC_STATE, 
      this.handleSyncState.bind(this), 
      { rateLimited: true, maxCalls: 200, timeout: 30000 }
    );

    // Join conversation (alias)
    registerAliases([
      SOCKET_EVENTS.JOIN_CONVERSATION,
      'conversation:join'
    ], this.handleJoinConversation.bind(this), { rateLimited: true, maxCalls: 100, timeout: 15000 });

    // Leave conversation (alias)
    registerAliases([
      SOCKET_EVENTS.LEAVE_CONVERSATION,
      'conversation:leave'
    ], this.handleLeaveConversation.bind(this), { rateLimited: true, maxCalls: 100, timeout: 15000 });

    // New message (mantener principal)
    registerEvent(SOCKET_EVENTS.NEW_MESSAGE, 
      this.handleNewMessage.bind(this), 
      { rateLimited: true, maxCalls: 400, timeout: 30000 }
    );

    // Message read (alias)
    registerAliases([
      SOCKET_EVENTS.MESSAGE_READ,
      'messages:read'
    ], this.handleMessageRead.bind(this), { rateLimited: true, maxCalls: 200, timeout: 15000 });

    // Typing
    registerEvent(SOCKET_EVENTS.MESSAGE_TYPING, 
      this.handleTyping.bind(this), 
      { rateLimited: true, maxCalls: 600, timeout: 10000 }
    );

    // Typing stop
    registerEvent(SOCKET_EVENTS.MESSAGE_TYPING_STOP, 
      this.handleTypingStop.bind(this), 
      { rateLimited: true, maxCalls: 600, timeout: 10000 }
    );

    // Status change
    registerEvent(SOCKET_EVENTS.USER_STATUS_CHANGE, 
      this.handleStatusChange.bind(this), 
      { rateLimited: true, maxCalls: 100, timeout: 15000 }
    );

    // Disconnect
    registerEvent(SOCKET_EVENTS.DISCONNECT, 
      this.handleDisconnect.bind(this), 
      { maxCalls: 1, timeout: null }
    );

    // Error (de negocio): no desconectar
    registerEvent(SOCKET_EVENTS.ERROR, 
      (sock, payload) => {
        logger.warn('WS business error reported by client', {
          category: 'SOCKET_CLIENT_ERROR',
          payload: typeof payload === 'string' ? payload : (payload?.error || 'unknown'),
          socketId: sock.id
        });
        // No desconectar; sólo loggear
      }, 
      { maxCalls: 50, timeout: 5000 }
    );

    // 🆕 File events
    registerEvent(SOCKET_EVENTS.FILE_UPLOADED, 
      this.handleFileUploaded.bind(this), 
      { rateLimited: true, maxCalls: 100, timeout: 30000 }
    );

    registerEvent(SOCKET_EVENTS.FILE_PROCESSING, 
      this.handleFileProcessing.bind(this), 
      { rateLimited: true, maxCalls: 200, timeout: 15000 }
    );

    registerEvent(SOCKET_EVENTS.FILE_READY, 
      this.handleFileReady.bind(this), 
      { rateLimited: true, maxCalls: 100, timeout: 15000 }
    );

    registerEvent(SOCKET_EVENTS.FILE_ERROR, 
      this.handleFileError.bind(this), 
      { rateLimited: true, maxCalls: 50, timeout: 10000 }
    );

    registerEvent(SOCKET_EVENTS.FILE_PROGRESS, 
      this.handleFileProgress.bind(this), 
      { rateLimited: true, maxCalls: 300, timeout: 10000 }
    );

    // 🆕 Audio events
    registerEvent(SOCKET_EVENTS.AUDIO_PLAYING, 
      this.handleAudioPlaying.bind(this), 
      { rateLimited: true, maxCalls: 200, timeout: 10000 }
    );

    registerEvent(SOCKET_EVENTS.AUDIO_STOPPED, 
      this.handleAudioStopped.bind(this), 
      { rateLimited: true, maxCalls: 200, timeout: 10000 }
    );

    registerEvent(SOCKET_EVENTS.AUDIO_PAUSED, 
      this.handleAudioPaused.bind(this), 
      { rateLimited: true, maxCalls: 200, timeout: 10000 }
    );

    registerEvent(SOCKET_EVENTS.AUDIO_RECORDING, 
      this.handleAudioRecording.bind(this), 
      { rateLimited: true, maxCalls: 100, timeout: 30000 }
    );

    registerEvent(SOCKET_EVENTS.AUDIO_RECORDING_STOPPED, 
      this.handleAudioRecordingStopped.bind(this), 
      { rateLimited: true, maxCalls: 100, timeout: 10000 }
    );

    logger.info('Socket event listeners configurados con cleanup automático', {
      socketId,
      userEmail: userEmail?.substring(0, 20) + '...',
      totalEvents: listenersMap.size
    });

    // Heartbeat manual
    this.setupHeartbeat(socket, userEmail);
  }

  /**
   * 🔧 CORRECCIÓN: SETUP HEARTBEAT MANUAL
   */
  setupHeartbeat(socket, userEmail) {
    // Emitir heartbeat cada 15 segundos para mantener conexión activa
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat', {
          timestamp: new Date().toISOString(),
          serverTime: Date.now(),
          socketId: socket.id
        });
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 15000);

    // Limpiar intervalo cuando el socket se desconecte
    socket.on('disconnect', () => {
      clearInterval(heartbeatInterval);
    });

    // Log del heartbeat configurado
    logger.info('Heartbeat configurado para socket', {
      category: 'SOCKET_HEARTBEAT_SETUP',
      socketId: socket.id.substring(0, 8) + '...',
      userEmail: userEmail?.substring(0, 20) + '...',
      interval: '20s'
    });
  }

  /**
   * 🛡️ WRAP EVENT HANDLER (RATE LIMITING + ERROR HANDLING)
   */
  wrapEventHandler(eventName, handler, socket, options = {}) {
    const { userEmail } = socket;
    const { rateLimited = false, requiresAuth = false } = options;

    // ✅ CRÍTICO: Usar try-catch directo en lugar de asyncWrapper para Socket.IO
    return async (...args) => {
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
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required for this event',
            details: { eventName }
          });
          return;
        }

        // Apply rate limiting if enabled
        if (rateLimited && !this.checkRateLimit(userEmail, eventName)) {
          logger.warn('Rate limit exceeded for event', {
            category: 'SOCKET_RATE_LIMIT',
            email: userEmail?.substring(0, 20) + '...',
            eventName,
            socketId: socket.id
          });
          socket.emit(SOCKET_EVENTS.ERROR, {
            code: 'RATE_LIMITED',
            message: 'Too many events',
            details: { event: eventName, windowMs: RATE_LIMITS[eventName] || 1000 },
            retryAfter: Math.ceil((RATE_LIMITS[eventName] || 1000) / 1000)
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
        
        // ✅ CRÍTICO: Manejo robusto de errores para Socket.IO
        logger.error('Socket event handler error', {
          category: 'SOCKET_EVENT_ERROR',
          eventName,
          error: error?.message || 'Unknown error',
          stack: error?.stack || 'No stack trace',
          email: userEmail?.substring(0, 20) + '...',
          socketId: socket?.id || 'unknown',
          severity: 'HIGH'
        });

        // ✅ CRÍTICO: Verificar que socket existe antes de emitir
        if (socket && typeof socket.emit === 'function') {
          socket.emit(SOCKET_EVENTS.ERROR, {
            code: 'EVENT_HANDLER_ERROR',
            message: 'Error processing event',
            details: { eventName }
          });
        }
      }
    };
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
      // 🔧 LOG CRÍTICO PARA RAILWAY: Rate limit de Socket.IO alcanzado
      console.log(`🚨 SOCKET_RATE_LIMIT: ${userEmail} - ${eventName} - Interval: ${minInterval}ms - Last: ${now - lastTime}ms ago`);
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

      // Get user's conversations
      let conversations = await this.getUserConversations(userEmail, userRole);
      
      // ✅ VALIDACIÓN: Asegurar que conversations sea un array
      if (!Array.isArray(conversations)) {
        logger.warn('getUserConversations no devolvió un array', {
          category: 'SOCKET_INITIAL_SYNC_WARNING',
          userEmail: userEmail?.substring(0, 20) + '...',
          conversationsType: typeof conversations
        });
        conversations = [];
      }
      
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
    const { conversationId, roomId } = data;

    // 🔧 CORRECCIÓN CRÍTICA: Logging detallado para diagnosticar el problema
    logger.info('🎯 EVENTO JOIN-CONVERSATION RECIBIDO EN BACKEND', {
      category: 'SOCKET_JOIN_CONVERSATION_RECEIVED',
      userEmail: userEmail?.substring(0, 20) + '...',
      conversationId: conversationId?.substring(0, 30) + '...',
      roomId: roomId?.substring(0, 30) + '...',
      socketId: socket.id,
      timestamp: new Date().toISOString(),
      dataKeys: Object.keys(data || {}),
      hasUserEmail: !!userEmail,
      hasUserRole: !!userRole
    });

    try {
      if (!conversationId) {
        logger.error('❌ conversationId es requerido pero no se proporcionó', {
          category: 'SOCKET_JOIN_CONVERSATION_MISSING_ID',
          userEmail: userEmail?.substring(0, 20) + '...',
          data: data
        });
        throw new Error('conversationId is required');
      }

      // 🔧 CORRECCIÓN CRÍTICA: Decodificar conversationId del frontend
      let decodedConversationId = conversationId;
      try {
        // El frontend envía conversationId codificado (ej: conv_%2B5214773790184_%2B5214793176502)
        // Necesitamos decodificarlo para que coincida con el formato de la base de datos
        decodedConversationId = decodeURIComponent(conversationId);
        logger.info('ConversationId decodificado', {
          category: 'SOCKET_JOIN_CONVERSATION_DECODE',
          original: conversationId,
          decoded: decodedConversationId,
          userEmail: userEmail?.substring(0, 20) + '...'
        });
      } catch (decodeError) {
        logger.warn('Error decodificando conversationId, usando original', {
          category: 'SOCKET_JOIN_CONVERSATION_DECODE_ERROR',
          conversationId,
          error: decodeError.message,
          userEmail: userEmail?.substring(0, 20) + '...'
        });
        decodedConversationId = conversationId;
      }

      // 🔒 Room generado únicamente por el servidor (unificación)
      const { getConversationRoom } = require('./index');
      const targetRoomId = getConversationRoom({
        workspaceId: socket.decodedToken?.workspaceId || 'default_workspace',
        tenantId: socket.decodedToken?.tenantId || 'default_tenant',
        conversationId: decodedConversationId
      });

      // 🔧 CORRECCIÓN CRÍTICA: Verificar permisos con el conversationId decodificado
      const hasPermission = await this.verifyConversationPermission(userEmail, decodedConversationId, 'read');
      if (!hasPermission) {
        logger.warn('Permiso denegado para unirse a conversación', {
          category: 'SOCKET_JOIN_CONVERSATION_PERMISSION_DENIED',
          userEmail: userEmail?.substring(0, 20) + '...',
          conversationId: decodedConversationId,
          originalConversationId: conversationId
        });
        
        socket.emit(SOCKET_EVENTS.ERROR, {
          error: 'PERMISSION_DENIED',
          message: 'No permission to join this conversation',
          conversationId: decodedConversationId
        });
        return;
      }

      // 🔧 CORRECCIÓN: Inicializar estructuras si no existen
      if (!this.rooms.has(targetRoomId)) {
        this.rooms.set(targetRoomId, new Set());
      }
      if (!this.userSessions.has(userEmail)) {
        this.userSessions.set(userEmail, new Set());
      }
      if (!this.socketConversations.has(socket.id)) {
        this.socketConversations.set(socket.id, new Set());
      }

      // 🔧 CORRECCIÓN: Verificar límite de rooms por socket
      const socketRooms = this.socketConversations.get(socket.id);
      if (socketRooms && socketRooms.size >= SOCKET_LIMITS.MAX_ROOMS_PER_SOCKET) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          error: 'ROOM_LIMIT_EXCEEDED',
          message: `Maximum rooms per socket exceeded (${SOCKET_LIMITS.MAX_ROOMS_PER_SOCKET})`,
          conversationId: decodedConversationId
        });
        return;
      }

      // Join socket room
      socket.join(targetRoomId);

      // 🔧 CORRECCIÓN: Registrar en estructuras de tracking (DEFENSIVO)
      safeGetSet(this.rooms, targetRoomId).add(socket.id);
      safeGetSet(this.userSessions, userEmail).add(socket.id);
      safeGetSet(this.socketConversations, socket.id).add(targetRoomId);

      // Update user session
      const session = this.connectedUsers.get(userEmail);
      if (session) {
        session.conversations.add(decodedConversationId);
        this.connectedUsers.set(userEmail, session);
      }

      // Update conversation users mapping
      let conversationUsers = this.conversationUsers.get(decodedConversationId) || new Set();
      conversationUsers.add(userEmail);
      this.conversationUsers.set(decodedConversationId, conversationUsers);

      // Update user conversations mapping
      let userConversations = this.userConversations.get(userEmail) || new Set();
      userConversations.add(decodedConversationId);
      this.userConversations.set(userEmail, userConversations);

      // Notify other users in conversation
      socket.to(targetRoomId).emit(SOCKET_EVENTS.USER_ONLINE, {
        email: userEmail,
        conversationId: decodedConversationId,
        timestamp: new Date().toISOString()
      });

      // 🔧 CORRECCIÓN CRÍTICA: Confirmar join al usuario inmediatamente
      const confirmationData = {
        conversationId: decodedConversationId,
        roomId: targetRoomId,
        onlineUsers: Array.from(conversationUsers),
        success: true,
        timestamp: new Date().toISOString()
      };

      logger.info('📤 ENVIANDO CONFIRMACIÓN CONVERSATION_JOINED', {
        category: 'SOCKET_JOIN_CONVERSATION_CONFIRMATION_SENT',
        userEmail: userEmail?.substring(0, 20) + '...',
        conversationId: decodedConversationId,
        roomId: targetRoomId,
        socketId: socket.id,
        confirmationData: confirmationData,
        timestamp: new Date().toISOString()
      });

      socket.emit(SOCKET_EVENTS.CONVERSATION_JOINED, confirmationData);

      // 🔧 CORRECCIÓN: Emitir evento adicional para sincronización
      const syncData = {
        conversationId: decodedConversationId,
        roomId: targetRoomId,
        success: true,
        timestamp: new Date().toISOString()
      };

      logger.info('📤 ENVIANDO EVENTO WEBSOCKET:STATE-SYNCED', {
        category: 'SOCKET_JOIN_CONVERSATION_SYNC_SENT',
        userEmail: userEmail?.substring(0, 20) + '...',
        conversationId: decodedConversationId,
        roomId: targetRoomId,
        socketId: socket.id,
        syncData: syncData,
        timestamp: new Date().toISOString()
      });

      socket.emit('websocket:state-synced', syncData);

      logger.info('✅ USUARIO UNIDO EXITOSAMENTE A CONVERSACIÓN', {
        category: 'SOCKET_JOIN_CONVERSATION_SUCCESS',
        userEmail: userEmail?.substring(0, 20) + '...',
        conversationId: decodedConversationId,
        roomId: targetRoomId,
        socketId: socket.id,
        onlineUsersCount: conversationUsers.size,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error joining conversation', {
        category: 'SOCKET_JOIN_CONVERSATION_ERROR',
        error: error.message,
        userEmail: userEmail?.substring(0, 20) + '...',
        conversationId,
        stack: error.stack
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
      const workspaceId = socket.decodedToken?.workspaceId || 'default_workspace';
      const tenantId = socket.decodedToken?.tenantId || 'default_tenant';

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
        workspaceId: socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace',
        tenantId: socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant',
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
        code: 'MESSAGE_FAILED',
        message: 'Failed to send message',
        details: { conversationId: messageData?.conversationId }
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

      // Normalizar timestamp de lectura
      const readTimestamp = new Date();

      // Actualizar en BD en lote usando el modelo Message
      const Message = require('../models/Message');
      const result = await Message.markManyAsRead(conversationId, messageIds, userEmail, readTimestamp);

      // Determinar room unificado
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: socket.decodedToken?.workspaceId || 'default_workspace',
        tenantId: socket.decodedToken?.tenantId || 'default_tenant',
        conversationId
      });

      // Broadcast a otros usuarios
      socket.to(roomId).emit(SOCKET_EVENTS.MESSAGE_READ, {
        conversationId,
        messageIds,
        readBy: userEmail,
        timestamp: readTimestamp.toISOString()
      });

      // Ack al emisor (no rompe FE si lo ignora)
      socket.emit('message-read-ack', {
        ok: true,
        conversationId,
        messageIds,
        updated: result?.updated ?? messageIds.length,
        timestamp: readTimestamp.toISOString()
      });

      // Emitir actualización de conversación con unreadCount recalculado
      try {
        const workspaceId = socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace';
        const tenantId = socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant';
        const unreadCount = await Message.getUnreadCount(conversationId, userEmail);
        this.emitConversationUpdated({
          workspaceId,
          tenantId,
          conversationId,
          unreadCount,
          updatedAt: new Date().toISOString()
        });
      } catch (updateErr) {
        logger.warn('No se pudo emitir conversation updated tras read', {
          category: 'SOCKET_MESSAGE_READ_UPDATE_WARN',
          error: updateErr.message,
          conversationId
        });
      }

      logger.debug('Messages marked as read', {
        category: 'SOCKET_MESSAGE_READ',
        email: userEmail.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        messageCount: messageIds.length
      });

    } catch (error) {
      logger.error('Error marking messages as read', {
        category: 'SOCKET_MESSAGE_READ_ERROR',
        error: error.message,
        conversationId,
        messageCount: Array.isArray(messageIds) ? messageIds.length : 0
      });

      socket.emit(SOCKET_EVENTS.ERROR, {
        code: 'READ_FAILED',
        message: 'Failed to mark messages as read',
        details: {
          conversationId,
          count: Array.isArray(messageIds) ? messageIds.length : 0
        }
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
        workspaceId: socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace',
        tenantId: socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant',
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
        workspaceId: socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace',
        tenantId: socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant',
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
    // ✅ VALIDACIÓN: Extraer userEmail de manera segura
    const userEmail = socket?.userEmail;
    const socketId = socket?.id;
    const userRole = socket?.userRole;

    try {
      this.metrics.disconnectionsPerSecond++;

      // ✅ VALIDACIÓN: Verificar que socketId sea válido
      if (!socketId) {
        logger.warn('Socket desconectado sin socketId válido', {
          category: 'SOCKET_DISCONNECT_WARNING',
          reason,
          hasUserEmail: !!userEmail,
          userEmailType: typeof userEmail
        });
        return;
      }

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

      // 🔧 SOCKET ROBUSTO: Limpiar de userSessions solo si userEmail es válido
      if (userEmail && typeof userEmail === 'string') {
        const userSocketIds = this.userSessions.get(userEmail);
        if (userSocketIds) {
          userSocketIds.delete(socketId);
          if (userSocketIds.size === 0) {
            this.userSessions.delete(userEmail);
          }
        }
      }

      // Logging estructurado sin PII
      logger.info('RT:DISCONNECT', { 
        socketId: socketId.substring(0, 8) + '...', 
        email: userEmail && typeof userEmail === 'string' ? userEmail.substring(0, 20) + '...' : 'undefined',
        reason
      });
      
      if (process.env.SOCKET_LOG_VERBOSE === 'true') {
        logger.info('User disconnected from Socket.IO', {
          category: 'SOCKET_USER_DISCONNECTED',
          email: userEmail && typeof userEmail === 'string' ? userEmail.substring(0, 20) + '...' : 'undefined',
          socketId,
          reason,
          connectedDuration: socket?.connectedAt ? Date.now() - socket.connectedAt : 0,
          roomsCleaned: socketRooms?.size || 0
        });
      }

      // Clean up user session solo si userEmail es válido
      if (userEmail && typeof userEmail === 'string') {
        await this.cleanupUserSession(userEmail, socketId);
        
        // Broadcast user offline status solo si userEmail es válido
        this.broadcastUserPresence(userEmail, 'offline', userRole);
      } else {
        logger.warn('No se pudo limpiar sesión de usuario - userEmail inválido', {
          category: 'SOCKET_DISCONNECT_WARNING',
          socketId,
          reason,
          userEmail: userEmail,
          userEmailType: typeof userEmail
        });
      }

    } catch (error) {
      logger.error('Error handling disconnect', {
        category: 'SOCKET_DISCONNECT_ERROR',
        error: error.message,
        userEmail: userEmail && typeof userEmail === 'string' ? userEmail.substring(0, 20) + '...' : 'undefined',
        socketId: socketId || 'unknown',
        reason,
        stack: error.stack?.split('\n').slice(0, 3)
      });
    }
  }

  /**
   * 🔌 HANDLE SOCKET ERROR
   */
  async handleSocketError(socket, error) {
    // ✅ VALIDACIÓN: Extraer propiedades de manera segura
    const userEmail = socket?.userEmail;
    const socketId = socket?.id;

    logger.error('Socket error occurred', {
      category: 'SOCKET_ERROR',
      error: error.message || error,
      email: userEmail && typeof userEmail === 'string' ? userEmail.substring(0, 20) + '...' : 'undefined',
      socketId: socketId || 'unknown',
      severity: 'HIGH'
    });

    this.metrics.errorsPerSecond++;
  }

  /**
   * 🆕 📁 HANDLE FILE UPLOADED
   * Maneja el evento cuando se sube un archivo
   */
  async handleFileUploaded(socket, fileData) {
    const { userEmail } = socket;
    const { fileId, conversationId, fileName, fileType, fileSize } = fileData;

    try {
      if (!fileId || !conversationId) {
        throw new Error('fileId and conversationId are required');
      }

      // Verificar permisos para la conversación
      const hasPermission = await this.verifyConversationPermission(userEmail, conversationId, 'read');
      if (!hasPermission) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          error: 'PERMISSION_DENIED',
          message: 'No permission to access this conversation',
          conversationId
        });
        return;
      }

      // Broadcast a todos los usuarios en la conversación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace',
        tenantId: socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant',
        conversationId 
      });

      this.io.to(roomId).emit(SOCKET_EVENTS.FILE_UPLOADED, {
        fileId,
        conversationId,
        fileName,
        fileType,
        fileSize,
        uploadedBy: userEmail,
        timestamp: new Date().toISOString()
      });

      // 🔄 FASE 7: Actualizar lista de archivos en tiempo real
      await this.emitConversationFilesUpdated(
        conversationId,
        socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace',
        socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant'
      );

      logger.info('File uploaded notification sent', {
        category: 'SOCKET_FILE_UPLOADED',
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        uploadedBy: userEmail.substring(0, 20) + '...',
        fileType,
        fileSize
      });

    } catch (error) {
      logger.error('Error handling file uploaded', {
        category: 'SOCKET_FILE_UPLOADED_ERROR',
        error: error.message,
        fileId: fileData?.fileId?.substring(0, 20) + '...',
        conversationId: fileData?.conversationId?.substring(0, 20) + '...',
        userEmail: userEmail?.substring(0, 20) + '...'
      });

      socket.emit(SOCKET_EVENTS.ERROR, {
        error: 'FILE_UPLOADED_FAILED',
        message: 'Failed to process file uploaded notification'
      });
    }
  }

  /**
   * 🆕 ⚙️ HANDLE FILE PROCESSING
   * Maneja el evento cuando un archivo está siendo procesado
   */
  async handleFileProcessing(socket, fileData) {
    const { userEmail } = socket;
    const { fileId, conversationId, progress = 0, stage = 'processing' } = fileData;

    try {
      if (!fileId || !conversationId) {
        throw new Error('fileId and conversationId are required');
      }

      // Verificar permisos
      const hasPermission = await this.verifyConversationPermission(userEmail, conversationId, 'read');
      if (!hasPermission) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          error: 'PERMISSION_DENIED',
          message: 'No permission to access this conversation',
          conversationId
        });
        return;
      }

      // Broadcast progreso a la conversación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace',
        tenantId: socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant',
        conversationId 
      });

      this.io.to(roomId).emit(SOCKET_EVENTS.FILE_PROCESSING, {
        fileId,
        conversationId,
        progress,
        stage,
        processedBy: userEmail,
        timestamp: new Date().toISOString()
      });

      logger.debug('File processing progress sent', {
        category: 'SOCKET_FILE_PROCESSING',
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        progress,
        stage
      });

    } catch (error) {
      logger.error('Error handling file processing', {
        category: 'SOCKET_FILE_PROCESSING_ERROR',
        error: error.message,
        fileId: fileData?.fileId?.substring(0, 20) + '...',
        conversationId: fileData?.conversationId?.substring(0, 20) + '...'
      });
    }
  }

  /**
   * 🆕 ✅ HANDLE FILE READY
   * Maneja el evento cuando un archivo está listo para usar
   */
  async handleFileReady(socket, fileData) {
    const { userEmail } = socket;
    const { fileId, conversationId, fileUrl, metadata = {} } = fileData;

    try {
      if (!fileId || !conversationId || !fileUrl) {
        throw new Error('fileId, conversationId, and fileUrl are required');
      }

      // Verificar permisos
      const hasPermission = await this.verifyConversationPermission(userEmail, conversationId, 'read');
      if (!hasPermission) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          error: 'PERMISSION_DENIED',
          message: 'No permission to access this conversation',
          conversationId
        });
        return;
      }

      // Broadcast archivo listo a la conversación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace',
        tenantId: socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant',
        conversationId 
      });

      this.io.to(roomId).emit(SOCKET_EVENTS.FILE_READY, {
        fileId,
        conversationId,
        fileUrl,
        metadata,
        readyBy: userEmail,
        timestamp: new Date().toISOString()
      });

      logger.info('File ready notification sent', {
        category: 'SOCKET_FILE_READY',
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        readyBy: userEmail.substring(0, 20) + '...'
      });

    } catch (error) {
      logger.error('Error handling file ready', {
        category: 'SOCKET_FILE_READY_ERROR',
        error: error.message,
        fileId: fileData?.fileId?.substring(0, 20) + '...',
        conversationId: fileData?.conversationId?.substring(0, 20) + '...',
        userEmail: userEmail?.substring(0, 20) + '...'
      });

      socket.emit(SOCKET_EVENTS.ERROR, {
        error: 'FILE_READY_FAILED',
        message: 'Failed to process file ready notification'
      });
    }
  }

  /**
   * 🆕 ❌ HANDLE FILE ERROR
   * Maneja el evento cuando hay un error con un archivo
   */
  async handleFileError(socket, fileData) {
    const { userEmail } = socket;
    const { fileId, conversationId, error, errorCode } = fileData;

    try {
      if (!fileId || !conversationId || !error) {
        throw new Error('fileId, conversationId, and error are required');
      }

      // Verificar permisos
      const hasPermission = await this.verifyConversationPermission(userEmail, conversationId, 'read');
      if (!hasPermission) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          error: 'PERMISSION_DENIED',
          message: 'No permission to access this conversation',
          conversationId
        });
        return;
      }

      // Broadcast error a la conversación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace',
        tenantId: socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant',
        conversationId 
      });

      this.io.to(roomId).emit(SOCKET_EVENTS.FILE_ERROR, {
        fileId,
        conversationId,
        error,
        errorCode,
        errorBy: userEmail,
        timestamp: new Date().toISOString()
      });

      logger.error('File error notification sent', {
        category: 'SOCKET_FILE_ERROR',
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        error,
        errorCode,
        errorBy: userEmail.substring(0, 20) + '...'
      });

    } catch (error) {
      logger.error('Error handling file error', {
        category: 'SOCKET_FILE_ERROR_HANDLER_ERROR',
        error: error.message,
        fileId: fileData?.fileId?.substring(0, 20) + '...',
        conversationId: fileData?.conversationId?.substring(0, 20) + '...'
      });
    }
  }

  /**
   * 🆕 📊 HANDLE FILE PROGRESS
   * Maneja el evento de progreso detallado de archivos
   */
  async handleFileProgress(socket, fileData) {
    const { userEmail } = socket;
    const { fileId, conversationId, progress, stage, details = {} } = fileData;

    try {
      if (!fileId || !conversationId) {
        throw new Error('fileId and conversationId are required');
      }

      // Verificar permisos
      const hasPermission = await this.verifyConversationPermission(userEmail, conversationId, 'read');
      if (!hasPermission) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          error: 'PERMISSION_DENIED',
          message: 'No permission to access this conversation',
          conversationId
        });
        return;
      }

      // Broadcast progreso detallado a la conversación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace',
        tenantId: socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant',
        conversationId 
      });

      this.io.to(roomId).emit(SOCKET_EVENTS.FILE_PROGRESS, {
        fileId,
        conversationId,
        progress,
        stage,
        details,
        progressBy: userEmail,
        timestamp: new Date().toISOString()
      });

      logger.debug('File progress sent', {
        category: 'SOCKET_FILE_PROGRESS',
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        progress,
        stage
      });

    } catch (error) {
      logger.error('Error handling file progress', {
        category: 'SOCKET_FILE_PROGRESS_ERROR',
        error: error.message,
        fileId: fileData?.fileId?.substring(0, 20) + '...',
        conversationId: fileData?.conversationId?.substring(0, 20) + '...'
      });
    }
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
      // ✅ VALIDACIÓN: Verificar que userEmail sea válido
      if (!userEmail || typeof userEmail !== 'string') {
        logger.warn('userEmail inválido en broadcastUserPresence', {
          category: 'SOCKET_PRESENCE_WARNING',
          userEmail: userEmail,
          userEmailType: typeof userEmail,
          status,
          userRole
        });
        return;
      }

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
        userEmail: userEmail && typeof userEmail === 'string' ? userEmail.substring(0, 20) + '...' : 'invalid',
        status,
        userRole
      });
    }
  }

  /**
   * 🔍 GET USER CONVERSATIONS
   */
  async getUserConversations(userEmail, userRole) {
    try {
      // ✅ VALIDACIÓN: Verificar que userEmail sea válido
      if (!userEmail || typeof userEmail !== 'string') {
        logger.warn('userEmail inválido en getUserConversations', {
          category: 'SOCKET_CONVERSATIONS_WARNING',
          userEmail: userEmail,
          userEmailType: typeof userEmail
        });
        return [];
      }

      // ✅ VALIDACIÓN: Verificar que Conversation model esté disponible
      if (!this.Conversation) {
        logger.warn('Conversation model no disponible', {
          category: 'SOCKET_CONVERSATIONS_WARNING',
          userEmail: userEmail.substring(0, 20) + '...'
        });
        return [];
      }

      // Use existing Conversation model method
      logger.info('🔍 Llamando Conversation.list', {
        category: 'SOCKET_CONVERSATIONS_CALL',
        userEmail: userEmail.substring(0, 20) + '...',
        hasConversationModel: !!this.Conversation
      });
      
      const result = await this.Conversation.list({
        participantEmail: userEmail,
        limit: 100,
        includeMessages: false
      });
      
      logger.info('📋 Conversation.list completado', {
        category: 'SOCKET_CONVERSATIONS_CALL_SUCCESS',
        userEmail: userEmail.substring(0, 20) + '...',
        resultType: typeof result,
        isArray: Array.isArray(result),
        hasConversations: !!(result && result.conversations),
        resultKeys: result ? Object.keys(result) : 'null'
      });

      // ✅ VALIDACIÓN: Manejar diferentes formatos de respuesta
      let conversations = [];
      
      if (Array.isArray(result)) {
        // Si devuelve un array directamente
        conversations = result;
      } else if (result && typeof result === 'object' && Array.isArray(result.conversations)) {
        // Si devuelve un objeto con propiedad conversations
        conversations = result.conversations;
        logger.debug('Conversation.list devolvió objeto con propiedad conversations', {
          category: 'SOCKET_CONVERSATIONS_DEBUG',
          userEmail: userEmail.substring(0, 20) + '...',
          conversationsCount: conversations.length,
          hasPagination: !!result.pagination
        });
      } else {
        // Si no es ninguno de los formatos esperados
        logger.warn('Conversation.list devolvió formato inesperado', {
          category: 'SOCKET_CONVERSATIONS_WARNING',
          userEmail: userEmail.substring(0, 20) + '...',
          resultType: typeof result,
          isArray: Array.isArray(result),
          hasConversations: !!(result && result.conversations),
          resultKeys: result ? Object.keys(result) : 'null'
        });
        return [];
      }

      // ✅ VALIDACIÓN: Asegurar que cada conversación tenga las propiedades requeridas
      conversations = conversations.map(conv => {
        if (!conv || typeof conv !== 'object') {
          logger.warn('Conversación inválida en getUserConversations', {
            category: 'SOCKET_CONVERSATIONS_WARNING',
            convType: typeof conv,
            convValue: conv,
            userEmail: userEmail.substring(0, 20) + '...'
          });
          return null;
        }
        
        // Asegurar que tenga las propiedades básicas con valores por defecto
        return {
          id: conv.id || 'unknown',
          status: conv.status || 'open',
          customerPhone: conv.customerPhone || '',
          assignedTo: conv.assignedTo || null,
          lastMessage: conv.lastMessage || null,
          lastMessageAt: conv.lastMessageAt || null,
          unreadCount: conv.unreadCount || 0,
          messageCount: conv.messageCount || 0,
          participants: Array.isArray(conv.participants) ? conv.participants : [],
          createdAt: conv.createdAt || new Date(),
          updatedAt: conv.updatedAt || new Date()
        };
      }).filter(conv => conv !== null); // Remover conversaciones inválidas

      // ✅ VALIDACIÓN: Asegurar que conversations sea un array válido
      if (!Array.isArray(conversations)) {
        logger.warn('conversations no es un array válido después del procesamiento', {
          category: 'SOCKET_CONVERSATIONS_WARNING',
          userEmail: userEmail.substring(0, 20) + '...',
          conversationsType: typeof conversations,
          conversationsValue: conversations
        });
        return [];
      }

      logger.debug('User conversations retrieved successfully', {
        category: 'SOCKET_CONVERSATIONS_SUCCESS',
        userEmail: userEmail.substring(0, 20) + '...',
        conversationsCount: conversations.length
      });

      return conversations;

    } catch (error) {
      logger.error('Error getting user conversations', {
        category: 'SOCKET_CONVERSATIONS_ERROR',
        error: error.message,
        userEmail: userEmail?.substring(0, 20) + '...',
        stack: error.stack?.split('\n').slice(0, 3)
      });
      return [];
    }
  }

  /**
   * 📊 GET UNREAD MESSAGES COUNTS
   */
  async getUnreadMessagesCounts(userEmail, conversations) {
    try {
      // ✅ VALIDACIÓN: Asegurar que conversations sea un array iterable
      if (!conversations || !Array.isArray(conversations)) {
        logger.warn('Conversations no es un array válido en getUnreadMessagesCounts', {
          category: 'SOCKET_UNREAD_WARNING',
          conversationsType: typeof conversations,
          isArray: Array.isArray(conversations),
          conversationsValue: conversations
        });
        return {};
      }

      // ✅ VALIDACIÓN: Filtrar conversaciones válidas
      const validConversations = conversations.filter(conv => 
        conv && 
        typeof conv === 'object' && 
        conv.id && 
        typeof conv.id === 'string'
      );

      if (validConversations.length !== conversations.length) {
        logger.warn('Algunas conversaciones fueron filtradas por ser inválidas', {
          category: 'SOCKET_UNREAD_WARNING',
          originalCount: conversations.length,
          validCount: validConversations.length,
          userEmail: userEmail?.substring(0, 20) + '...'
        });
      }

      const unreadCounts = {};

      for (const conversation of validConversations) {
        // ✅ VALIDACIÓN: Asegurar que conversation tenga un id válido
        if (!conversation || !conversation.id) {
          logger.warn('Conversation inválida encontrada en getUnreadMessagesCounts', {
            category: 'SOCKET_UNREAD_WARNING',
            conversation: conversation
          });
          continue;
        }

        // ✅ VALIDACIÓN: Verificar que Message model esté disponible y tenga el método
        if (!this.Message || typeof this.Message.getUnreadCount !== 'function') {
          logger.warn('Message model no disponible o método getUnreadCount no existe', {
            category: 'SOCKET_UNREAD_WARNING',
            hasMessageModel: !!this.Message,
            hasGetUnreadCount: !!(this.Message && typeof this.Message.getUnreadCount === 'function'),
            conversationId: conversation.id
          });
          // Usar el unreadCount de la conversación como fallback
          if (conversation.unreadCount && conversation.unreadCount > 0) {
            unreadCounts[conversation.id] = conversation.unreadCount;
          }
          continue;
        }

        try {
          const unreadCount = await this.Message.getUnreadCount(conversation.id, userEmail);
          if (unreadCount > 0) {
            unreadCounts[conversation.id] = unreadCount;
          }
        } catch (messageError) {
          logger.warn('Error obteniendo unread count para conversación', {
            category: 'SOCKET_UNREAD_WARNING',
            conversationId: conversation.id,
            error: messageError.message
          });
          // Usar el unreadCount de la conversación como fallback
          if (conversation.unreadCount && conversation.unreadCount > 0) {
            unreadCounts[conversation.id] = conversation.unreadCount;
          }
        }
      }

      return unreadCounts;

    } catch (error) {
      logger.error('Error getting unread messages counts', {
        category: 'SOCKET_UNREAD_ERROR',
        error: error.message,
        userEmail: userEmail?.substring(0, 20) + '...',
        conversationsType: typeof conversations,
        isArray: Array.isArray(conversations)
      });
      return {};
    }
  }

  /**
   * 👥 GET ONLINE USERS IN CONVERSATIONS
   */
  getOnlineUsersInConversations(conversations) {
    try {
      // ✅ VALIDACIÓN: Asegurar que conversations sea un array iterable
      if (!conversations || !Array.isArray(conversations)) {
        logger.warn('Conversations no es un array válido', {
          category: 'SOCKET_ONLINE_USERS_WARNING',
          conversationsType: typeof conversations,
          isArray: Array.isArray(conversations),
          conversationsValue: conversations
        });
        return {};
      }

      // ✅ VALIDACIÓN: Filtrar conversaciones válidas
      const validConversations = conversations.filter(conv => 
        conv && 
        typeof conv === 'object' && 
        conv.id && 
        typeof conv.id === 'string'
      );

      if (validConversations.length !== conversations.length) {
        logger.warn('Algunas conversaciones fueron filtradas por ser inválidas en getOnlineUsersInConversations', {
          category: 'SOCKET_ONLINE_USERS_WARNING',
          originalCount: conversations.length,
          validCount: validConversations.length
        });
      }

      const onlineUsers = {};

      for (const conversation of validConversations) {
        // ✅ VALIDACIÓN: Asegurar que conversation tenga un id válido
        if (!conversation || !conversation.id) {
          logger.warn('Conversation inválida encontrada', {
            category: 'SOCKET_ONLINE_USERS_WARNING',
            conversation: conversation
          });
          continue;
        }

        const conversationUsers = this.conversationUsers.get(conversation.id);
        if (conversationUsers && conversationUsers.size > 0) {
          onlineUsers[conversation.id] = Array.from(conversationUsers);
        }
      }

      return onlineUsers;

    } catch (error) {
      logger.error('Error getting online users in conversations', {
        category: 'SOCKET_ONLINE_USERS_ERROR',
        error: error.message,
        conversationsType: typeof conversations,
        isArray: Array.isArray(conversations)
      });
      return {};
    }
  }

  /**
   * 🔐 VERIFY CONVERSATION PERMISSION
   */
  async verifyConversationPermission(userEmail, conversationId, action = 'read') {
    try {
      // 🔧 CORRECCIÓN: Validación más robusta de parámetros
      if (!userEmail || !conversationId) {
        logger.warn('Parámetros inválidos en verifyConversationPermission', {
          category: 'SOCKET_PERMISSION_INVALID_PARAMS',
          userEmail: userEmail ? 'present' : 'missing',
          conversationId: conversationId ? 'present' : 'missing'
        });
        return false;
      }

      // 🔧 CORRECCIÓN: Decodificar conversationId si está codificado
      let decodedConversationId = conversationId;
      try {
        decodedConversationId = decodeURIComponent(conversationId);
        if (decodedConversationId !== conversationId) {
          logger.info('ConversationId decodificado en verificación de permisos', {
            category: 'SOCKET_PERMISSION_DECODE',
            original: conversationId,
            decoded: decodedConversationId,
            userEmail: userEmail?.substring(0, 20) + '...'
          });
        }
      } catch (decodeError) {
        logger.warn('Error decodificando conversationId en verificación, usando original', {
          category: 'SOCKET_PERMISSION_DECODE_ERROR',
          conversationId,
          error: decodeError.message,
          userEmail: userEmail?.substring(0, 20) + '...'
        });
        decodedConversationId = conversationId;
      }

      // Si Conversation no está disponible, permitir acceso (modo desarrollo)
      if (!this.Conversation) {
        logger.warn('Conversation model not available, allowing access', {
          category: 'SOCKET_PERMISSION_MODEL_UNAVAILABLE',
          userEmail: userEmail?.substring(0, 20) + '...',
          conversationId: decodedConversationId?.substring(0, 20) + '...'
        });
        return true;
      }

      // Use existing Conversation model method if available
      const conversation = await this.Conversation.getById(decodedConversationId);
      if (!conversation) {
        logger.warn('Conversación no encontrada', {
          category: 'SOCKET_PERMISSION_CONVERSATION_NOT_FOUND',
          userEmail: userEmail?.substring(0, 20) + '...',
          conversationId: decodedConversationId?.substring(0, 20) + '...'
        });
        return false;
      }

      // 🔧 CORRECCIÓN: Verificación más robusta de participantes
      const participants = conversation.participants || [];
      
      // Verificar si el usuario es participante directo
      const isDirectParticipant = participants.some(p => 
        p === userEmail || 
        p.email === userEmail || 
        p.identifier === userEmail ||
        p.userId === userEmail ||
        p === `agent:${userEmail}` || // Verificar formato de agente
        p === `admin:${userEmail}`    // Verificar formato de admin
      );

      if (isDirectParticipant) {
        logger.info('Usuario es participante directo de la conversación', {
          category: 'SOCKET_PERMISSION_DIRECT_PARTICIPANT',
          userEmail: userEmail?.substring(0, 20) + '...',
          conversationId: decodedConversationId?.substring(0, 20) + '...',
          participantsCount: participants.length
        });
        return true;
      }

      // 🔧 CORRECCIÓN: Verificar si el usuario es agente/admin
      const userRole = this.userRoleCache.get(userEmail);
      const isAdminOrAgent = userRole === 'admin' || userRole === 'superadmin' || userRole === 'agent';
      
      if (isAdminOrAgent) {
        logger.info('Usuario es admin/agent con acceso a la conversación', {
          category: 'SOCKET_PERMISSION_ADMIN_ACCESS',
          userEmail: userEmail?.substring(0, 20) + '...',
          conversationId: decodedConversationId?.substring(0, 20) + '...',
          role: userRole
        });
        return true;
      }

      // 🔧 CORRECCIÓN: Verificar si el usuario está en el workspace/tenant correcto
      const workspaceId = conversation.workspaceId || 'default_workspace';
      const tenantId = conversation.tenantId || 'default_tenant';
      
      // Si la conversación es del workspace/tenant por defecto, permitir acceso
      if (workspaceId === 'default_workspace' && tenantId === 'default_tenant') {
        logger.info('Conversación del workspace por defecto, permitiendo acceso', {
          category: 'SOCKET_PERMISSION_DEFAULT_WORKSPACE',
          userEmail: userEmail?.substring(0, 20) + '...',
          conversationId: decodedConversationId?.substring(0, 20) + '...'
        });
        return true;
      }

      logger.warn('Usuario no tiene permisos para la conversación', {
        category: 'SOCKET_PERMISSION_DENIED',
        userEmail: userEmail?.substring(0, 20) + '...',
        conversationId: decodedConversationId?.substring(0, 20) + '...',
        participantsCount: participants.length,
        userRole: userRole || 'none',
        workspaceId,
        tenantId
      });

      return false;

    } catch (error) {
      logger.error('Error verifying conversation permission', {
        category: 'SOCKET_PERMISSION_ERROR',
        error: error.message,
        userEmail: userEmail?.substring(0, 20) + '...',
        conversationId: conversationId?.substring(0, 20) + '...',
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * 📈 SEND INITIAL STATE SYNC
   */
  async sendInitialStateSync(socket) {
    try {
      logger.info('🚀 INICIANDO sendInitialStateSync', {
        category: 'SOCKET_INITIAL_SYNC_START',
        socketId: socket?.id?.substring(0, 8) + '...',
        socketConnected: !!socket?.connected,
        userEmail: socket?.userEmail?.substring(0, 20) + '...'
      });

      // ✅ VALIDACIÓN: Verificar que el socket exista y esté conectado
      if (!socket || !socket.connected) {
        logger.warn('Socket no conectado durante sync inicial', {
          category: 'SOCKET_INITIAL_SYNC_WARNING',
          socketExists: !!socket,
          socketConnected: !!socket?.connected
        });
        return;
      }

      const { userEmail, userRole } = socket;

      // ✅ VALIDACIÓN: Verificar que userEmail sea válido
      if (!userEmail || typeof userEmail !== 'string') {
        logger.warn('userEmail inválido en sendInitialStateSync', {
          category: 'SOCKET_INITIAL_SYNC_WARNING',
          userEmail: userEmail,
          userEmailType: typeof userEmail
        });
        return;
      }

      // ✅ VALIDACIÓN: Verificar que el socket aún esté conectado antes de obtener conversaciones
      if (!socket.connected) {
        logger.warn('Socket desconectado antes de obtener conversaciones', {
          category: 'SOCKET_INITIAL_SYNC_WARNING',
          userEmail: userEmail.substring(0, 20) + '...'
        });
        return;
      }

      // Get user's conversations
      logger.info('📋 Obteniendo conversaciones del usuario', {
        category: 'SOCKET_INITIAL_SYNC_CONVERSATIONS',
        userEmail: userEmail.substring(0, 20) + '...'
      });
      
      let conversations = await this.getUserConversations(userEmail, userRole);
      
      logger.info('✅ Conversaciones obtenidas', {
        category: 'SOCKET_INITIAL_SYNC_CONVERSATIONS_SUCCESS',
        userEmail: userEmail.substring(0, 20) + '...',
        conversationsCount: conversations?.length || 0
      });
      
      // ✅ VALIDACIÓN: Verificar que el socket aún esté conectado después de obtener conversaciones
      if (!socket.connected) {
        logger.warn('Socket desconectado después de obtener conversaciones', {
          category: 'SOCKET_INITIAL_SYNC_WARNING',
          userEmail: userEmail.substring(0, 20) + '...',
          conversationsCount: conversations?.length || 0
        });
        return;
      }
      
      // ✅ VALIDACIÓN: Asegurar que conversations sea un array
      if (!Array.isArray(conversations)) {
        logger.warn('getUserConversations no devolvió un array', {
          category: 'SOCKET_INITIAL_SYNC_WARNING',
          userEmail: userEmail.substring(0, 20) + '...',
          conversationsType: typeof conversations
        });
        conversations = [];
      }
      
      // ✅ VALIDACIÓN: Asegurar que cada conversación tenga las propiedades requeridas
      conversations = conversations.map(conv => {
        if (!conv || typeof conv !== 'object') {
          logger.warn('Conversación inválida encontrada', {
            category: 'SOCKET_INITIAL_SYNC_WARNING',
            convType: typeof conv,
            convValue: conv
          });
          return null;
        }
        
        // Asegurar que tenga las propiedades básicas
        return {
          id: conv.id || 'unknown',
          status: conv.status || 'open',
          customerPhone: conv.customerPhone || '',
          assignedTo: conv.assignedTo || null,
          lastMessage: conv.lastMessage || null,
          lastMessageAt: conv.lastMessageAt || null,
          unreadCount: conv.unreadCount || 0,
          messageCount: conv.messageCount || 0,
          participants: Array.isArray(conv.participants) ? conv.participants : [],
          createdAt: conv.createdAt || new Date(),
          updatedAt: conv.updatedAt || new Date()
        };
      }).filter(conv => conv !== null); // Remover conversaciones inválidas
      
      // Get unread counts
      logger.info('📊 Obteniendo conteos de mensajes no leídos', {
        category: 'SOCKET_INITIAL_SYNC_UNREAD',
        userEmail: userEmail.substring(0, 20) + '...',
        conversationsCount: conversations.length
      });
      
      const unreadCounts = await this.getUnreadMessagesCounts(userEmail, conversations);
      
      logger.info('✅ Conteos de mensajes no leídos obtenidos', {
        category: 'SOCKET_INITIAL_SYNC_UNREAD_SUCCESS',
        userEmail: userEmail.substring(0, 20) + '...',
        unreadCountsKeys: Object.keys(unreadCounts).length
      });
      
      // ✅ VALIDACIÓN: Verificar que el socket aún esté conectado antes de obtener usuarios en línea
      if (!socket.connected) {
        logger.warn('Socket desconectado antes de obtener usuarios en línea', {
          category: 'SOCKET_INITIAL_SYNC_WARNING',
          userEmail: userEmail.substring(0, 20) + '...'
        });
        return;
      }
      
      // Get online users
      logger.info('👥 Obteniendo usuarios en línea', {
        category: 'SOCKET_INITIAL_SYNC_ONLINE_USERS',
        userEmail: userEmail.substring(0, 20) + '...',
        conversationsCount: conversations.length
      });
      
      const onlineUsers = this.getOnlineUsersInConversations(conversations);
      
      logger.info('✅ Usuarios en línea obtenidos', {
        category: 'SOCKET_INITIAL_SYNC_ONLINE_USERS_SUCCESS',
        userEmail: userEmail.substring(0, 20) + '...',
        onlineUsersKeys: Object.keys(onlineUsers).length
      });

      // ✅ VALIDACIÓN: Verificar que el socket aún esté conectado antes de enviar
      if (!socket.connected) {
        logger.warn('Socket desconectado antes de enviar sync', {
          category: 'SOCKET_INITIAL_SYNC_WARNING',
          userEmail: userEmail.substring(0, 20) + '...'
        });
        return;
      }

      // Send initial state
      logger.info('📤 Enviando estado inicial al frontend', {
        category: 'SOCKET_INITIAL_SYNC_SEND',
        userEmail: userEmail.substring(0, 20) + '...',
        conversationsCount: conversations.length,
        unreadCountsKeys: Object.keys(unreadCounts).length,
        onlineUsersKeys: Object.keys(onlineUsers).length
      });
      
      socket.emit(SOCKET_EVENTS.STATE_SYNCED, {
        conversations,
        unreadCounts,
        onlineUsers,
        serverTime: new Date().toISOString(),
        syncId: `initial_${Date.now()}`
      });

      logger.info('🎉 SYNC INICIAL COMPLETADO EXITOSAMENTE', {
        category: 'SOCKET_INITIAL_SYNC_COMPLETE',
        email: userEmail.substring(0, 20) + '...',
        conversationsCount: conversations.length,
        unreadCountsKeys: Object.keys(unreadCounts).length,
        onlineUsersKeys: Object.keys(onlineUsers).length,
        socketId: socket?.id?.substring(0, 8) + '...'
      });

    } catch (error) {
      logger.error('Error sending initial state sync', {
        category: 'SOCKET_INITIAL_SYNC_ERROR',
        error: error.message,
        userEmail: socket?.userEmail?.substring(0, 20) + '...',
        stack: error.stack?.split('\n').slice(0, 3)
      });
      
      // ✅ NO desconectar el socket, solo enviar error si aún está conectado
      if (socket && socket.connected) {
        try {
          socket.emit(SOCKET_EVENTS.ERROR, {
            error: 'INITIAL_SYNC_FAILED',
            message: 'Error loading initial state, but connection maintained'
          });
        } catch (emitError) {
          logger.warn('Error enviando error al socket', {
            category: 'SOCKET_EMIT_ERROR',
            error: emitError.message,
            userEmail: socket?.userEmail?.substring(0, 20) + '...'
          });
        }
      }
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
              workspaceId: socket.decodedToken?.workspaceId || 'default_workspace',
              tenantId: socket.decodedToken?.tenantId || 'default_tenant',
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
          workspaceId: 'default_workspace', // No tenemos contexto de workspace aquí
          tenantId: 'default_tenant',
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
   * 📊 SETUP MONITORING - CORREGIDO
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

    // 🔧 CORRECCIÓN: VERIFICACIÓN PERIÓDICA DE LISTENERS
    setInterval(() => {
      this.verifyAndReRegisterListeners();
    }, 10 * 1000); // Every 10 seconds

    logger.info('✅ Socket.IO monitoring configured', {
      category: 'SOCKET_MONITORING_SUCCESS',
      intervals: {
        metrics: '60s',
        memoryCleanup: '2min',
        memoryLeakDetection: '5min',
        rateLimitCleanup: '30s',
        listenerVerification: '10s'  // 🔧 CORRECCIÓN: Nueva verificación
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
  broadcastToConversation({ workspaceId, tenantId, conversationId, event, payload, socket = null }) {
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

      // 🔧 CORRECCIÓN CRÍTICA: Obtener workspaceId del socket si no se proporciona
      let finalWorkspaceId = workspaceId;
      let finalTenantId = tenantId;

      if (!finalWorkspaceId && socket) {
        finalWorkspaceId = socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace';
        finalTenantId = socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant';
        
        logger.info('broadcastToConversation: Obteniendo workspaceId del socket', {
          category: 'SOCKET_BROADCAST_WORKSPACE_FROM_SOCKET',
          conversationId: conversationId.substring(0, 20) + '...',
          event,
          workspaceIdFromSocket: finalWorkspaceId,
          tenantIdFromSocket: finalTenantId
        });
      }

      // Construir roomId con la convención establecida
      const roomId = `ws:${finalWorkspaceId || 'default_workspace'}:ten:${finalTenantId || 'default_tenant'}:conv:${conversationId}`;

      // Verificar autorización previa (si el repo pasa workspaceId/tenantId, confiamos)
      if (!finalWorkspaceId) {
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

  /**
   * 🔧 VERIFY AND RE-REGISTER LISTENERS
   * Verifica que todos los listeners estén activos y los re-registra si es necesario
   */
  verifyAndReRegisterListeners() {
    try {
      const eventCleanup = require('../utils/eventCleanup');
      let totalVerified = 0;
      let totalReRegistered = 0;

      // Verificar todos los sockets conectados
      for (const [socketId, socket] of this.io.sockets.sockets) {
        if (socket.connected && socket.userEmail) {
          totalVerified++;
          
          // Definir los handlers que deberían estar registrados
          const requiredHandlers = {
            [SOCKET_EVENTS.SYNC_STATE]: this.handleSyncState.bind(this),
            [SOCKET_EVENTS.JOIN_CONVERSATION]: this.handleJoinConversation.bind(this),
            [SOCKET_EVENTS.LEAVE_CONVERSATION]: this.handleLeaveConversation.bind(this),
            [SOCKET_EVENTS.NEW_MESSAGE]: this.handleNewMessage.bind(this),
            [SOCKET_EVENTS.MESSAGE_READ]: this.handleMessageRead.bind(this),
            [SOCKET_EVENTS.MESSAGE_TYPING]: this.handleTyping.bind(this),
            [SOCKET_EVENTS.MESSAGE_TYPING_STOP]: this.handleTypingStop.bind(this),
            [SOCKET_EVENTS.USER_STATUS_CHANGE]: this.handleStatusChange.bind(this),
            [SOCKET_EVENTS.DISCONNECT]: this.handleDisconnect.bind(this),
            [SOCKET_EVENTS.ERROR]: (sock, payload) => {
              logger.warn('WS business error reported by client', {
                category: 'SOCKET_CLIENT_ERROR',
                payload: typeof payload === 'string' ? payload : (payload?.error || 'unknown'),
                socketId: sock.id
              });
            },
                  // 🆕 File handlers
      [SOCKET_EVENTS.FILE_UPLOADED]: this.handleFileUploaded.bind(this),
      [SOCKET_EVENTS.FILE_PROCESSING]: this.handleFileProcessing.bind(this),
      [SOCKET_EVENTS.FILE_READY]: this.handleFileReady.bind(this),
      [SOCKET_EVENTS.FILE_ERROR]: this.handleFileError.bind(this),
      [SOCKET_EVENTS.FILE_PROGRESS]: this.handleFileProgress.bind(this),
      [SOCKET_EVENTS.FILE_RECEIVED]: this.handleFileReceived.bind(this),
      [SOCKET_EVENTS.FILE_DELETED]: this.handleFileDeleted.bind(this),
            // 🆕 Audio handlers
            [SOCKET_EVENTS.AUDIO_PLAYING]: this.handleAudioPlaying.bind(this),
            [SOCKET_EVENTS.AUDIO_STOPPED]: this.handleAudioStopped.bind(this),
            [SOCKET_EVENTS.AUDIO_PAUSED]: this.handleAudioPaused.bind(this),
            [SOCKET_EVENTS.AUDIO_RECORDING]: this.handleAudioRecording.bind(this),
            [SOCKET_EVENTS.AUDIO_RECORDING_STOPPED]: this.handleAudioRecordingStopped.bind(this)
          };

          // Re-registrar listeners faltantes
          const reRegisteredCount = eventCleanup.reRegisterMissingListeners(socket, requiredHandlers);
          if (reRegisteredCount > 0) {
            totalReRegistered += reRegisteredCount;
            logger.info('Listeners re-registrados para socket', {
              category: 'SOCKET_LISTENERS_RE_REGISTERED',
              socketId: socket.id.substring(0, 8) + '...',
              userEmail: socket.userEmail?.substring(0, 20) + '...',
              reRegisteredCount
            });
          }
        }
      }

      if (totalReRegistered > 0) {
        logger.info('Verificación de listeners completada', {
          category: 'SOCKET_LISTENERS_VERIFICATION',
          totalVerified,
          totalReRegistered
        });
      }

    } catch (error) {
      logger.error('Error en verificación de listeners', {
        category: 'SOCKET_LISTENERS_VERIFICATION_ERROR',
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 🔧 HELPER: Verificar si hay listeners antes de emitir eventos
   */
  hasListenersForEvent(eventName) {
    try {
      // Verificar si hay sockets conectados
      const connectedSockets = this.io.sockets.sockets.size;
      
      // Verificar si hay listeners registrados para este evento
      const eventListeners = this.io.sockets.adapter.rooms.get(eventName);
      const hasRoomListeners = eventListeners && eventListeners.size > 0;
      
      // Verificar si hay listeners en nuestros maps
      let hasCustomListeners = false;
      for (const [socketId, listenersMap] of this.eventListeners.entries()) {
        if (listenersMap.has(eventName)) {
          hasCustomListeners = true;
          break;
        }
      }
      
      return connectedSockets > 0 && (hasRoomListeners || hasCustomListeners);
    } catch (error) {
      logger.warn('Error checking listeners for event', {
        category: 'SOCKET_LISTENERS_CHECK_ERROR',
        eventName,
        error: error.message
      });
      return false;
    }
  }

  /**
   * 🔧 HELPER: Emitir evento solo si hay listeners
   */
  safeEmit(socket, eventName, data) {
    try {
      if (socket && socket.connected && this.hasListenersForEvent(eventName)) {
        socket.emit(eventName, data);
        return true;
      } else {
        logger.debug('Skipping event emission - no listeners or socket disconnected', {
          category: 'SOCKET_SAFE_EMIT_SKIP',
          eventName,
          socketConnected: socket?.connected,
          hasListeners: this.hasListenersForEvent(eventName)
        });
        return false;
      }
    } catch (error) {
      logger.warn('Error in safeEmit', {
        category: 'SOCKET_SAFE_EMIT_ERROR',
        eventName,
        error: error.message
      });
      return false;
    }
  }

  /**
   * 🔧 HELPER: Emitir evento a room solo si hay listeners
   */
  safeEmitToRoom(roomId, eventName, data) {
    try {
      if (this.hasListenersForEvent(eventName)) {
        this.io.to(roomId).emit(eventName, data);
        return true;
      } else {
        logger.debug('Skipping room event emission - no listeners', {
          category: 'SOCKET_SAFE_EMIT_ROOM_SKIP',
          eventName,
          roomId,
          hasListeners: this.hasListenersForEvent(eventName)
        });
        return false;
      }
    } catch (error) {
      logger.warn('Error in safeEmitToRoom', {
        category: 'SOCKET_SAFE_EMIT_ROOM_ERROR',
        eventName,
        roomId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * 🆕 📡 EMITIR EVENTO DE ARCHIVO SUBIDO
   * Método para ser llamado desde controladores HTTP
   */
  async emitFileUploaded(fileData) {
    try {
      const { fileId, conversationId, fileName, fileType, fileSize, uploadedBy } = fileData;

      if (!fileId || !conversationId) {
        logger.warn('Emitir archivo subido: datos incompletos', {
          category: 'SOCKET_EMIT_FILE_UPLOADED_WARNING',
          hasFileId: !!fileId,
          hasConversationId: !!conversationId
        });
        return false;
      }

      // Obtener room de la conversación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: 'default_workspace',
        tenantId: 'default_tenant',
        conversationId 
      });

      // Emitir evento a la room
      this.io.to(roomId).emit(SOCKET_EVENTS.FILE_UPLOADED, {
        fileId,
        conversationId,
        fileName,
        fileType,
        fileSize,
        uploadedBy,
        timestamp: new Date().toISOString()
      });

      // 🔄 FASE 7: Actualizar lista de archivos en tiempo real
      await this.emitConversationFilesUpdated(conversationId, 'default_workspace', 'default_tenant');

      logger.info('Evento de archivo subido emitido', {
        category: 'SOCKET_EMIT_FILE_UPLOADED',
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        uploadedBy: uploadedBy?.substring(0, 20) + '...',
        roomId
      });

      return true;

    } catch (error) {
      logger.error('Error emitiendo evento de archivo subido', {
        category: 'SOCKET_EMIT_FILE_UPLOADED_ERROR',
        error: error.message,
        fileData: {
          fileId: fileData?.fileId?.substring(0, 20) + '...',
          conversationId: fileData?.conversationId?.substring(0, 20) + '...'
        }
      });
      return false;
    }
  }

  /**
   * 🔄 FASE 7: OBTENER CONTEO DE ARCHIVOS DE CONVERSACIÓN
   * Función auxiliar para obtener el número de archivos en una conversación
   */
  async getFileCount(conversationId) {
    try {
      // Importar File model dinámicamente para evitar ciclos
      const File = require('../models/File');
      
      const count = await File.getCountByConversation(conversationId);
      
      logger.debug('Conteo de archivos obtenido', {
        category: 'SOCKET_FILE_COUNT',
        conversationId: conversationId.substring(0, 20) + '...',
        count
      });
      
      return count;
    } catch (error) {
      logger.error('Error obteniendo conteo de archivos', {
        category: 'SOCKET_FILE_COUNT_ERROR',
        conversationId: conversationId?.substring(0, 20) + '...',
        error: error.message
      });
      return 0;
    }
  }

  /**
   * 🔄 FASE 7: ACTUALIZAR LISTA DE ARCHIVOS EN TIEMPO REAL
   * Emite evento para actualizar la lista de archivos de una conversación
   */
  async emitConversationFilesUpdated(conversationId, workspaceId = 'default_workspace', tenantId = 'default_tenant') {
    try {
      if (!conversationId) {
        logger.warn('Actualizar archivos de conversación: conversationId faltante', {
          category: 'SOCKET_CONVERSATION_FILES_UPDATED_WARNING'
        });
        return false;
      }

      // Obtener conteo de archivos
      const fileCount = await this.getFileCount(conversationId);

      // Obtener room de la conversación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ workspaceId, tenantId, conversationId });

      // Emitir evento de actualización
      this.io.to(roomId).emit(SOCKET_EVENTS.CONVERSATION_FILES_UPDATED, {
        conversationId,
        fileCount,
        timestamp: new Date().toISOString()
      });

      logger.info('Lista de archivos de conversación actualizada', {
        category: 'SOCKET_CONVERSATION_FILES_UPDATED',
        conversationId: conversationId.substring(0, 20) + '...',
        fileCount,
        roomId
      });

      return true;

    } catch (error) {
      logger.error('Error actualizando lista de archivos de conversación', {
        category: 'SOCKET_CONVERSATION_FILES_UPDATED_ERROR',
        conversationId: conversationId?.substring(0, 20) + '...',
        error: error.message
      });
      return false;
    }
  }

  /**
   * 🔄 FASE 7: MANEJAR ARCHIVO RECIBIDO DE WHATSAPP
   * Maneja el evento cuando se recibe un archivo de WhatsApp
   */
  async handleFileReceived(socket, fileData) {
    const { userEmail } = socket;
    const { fileId, conversationId, fileName, fileType, fileSize, source = 'whatsapp' } = fileData;

    try {
      if (!fileId || !conversationId) {
        throw new Error('fileId and conversationId are required');
      }

      // Verificar permisos para la conversación
      const hasPermission = await this.verifyConversationPermission(userEmail, conversationId, 'read');
      if (!hasPermission) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          error: 'PERMISSION_DENIED',
          message: 'No permission to access this conversation',
          conversationId
        });
        return;
      }

      // Broadcast a todos los usuarios en la conversación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace',
        tenantId: socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant',
        conversationId 
      });

      this.io.to(roomId).emit(SOCKET_EVENTS.FILE_RECEIVED, {
        fileId,
        conversationId,
        fileName,
        fileType,
        fileSize,
        source,
        receivedBy: userEmail,
        timestamp: new Date().toISOString()
      });

      // Actualizar lista de archivos en tiempo real
      await this.emitConversationFilesUpdated(
        conversationId,
        socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace',
        socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant'
      );

      logger.info('Archivo recibido notificado', {
        category: 'SOCKET_FILE_RECEIVED',
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        source,
        receivedBy: userEmail.substring(0, 20) + '...'
      });

    } catch (error) {
      logger.error('Error manejando archivo recibido', {
        category: 'SOCKET_FILE_RECEIVED_ERROR',
        error: error.message,
        fileId: fileData?.fileId?.substring(0, 20) + '...',
        conversationId: fileData?.conversationId?.substring(0, 20) + '...',
        userEmail: userEmail?.substring(0, 20) + '...'
      });

      socket.emit(SOCKET_EVENTS.ERROR, {
        error: 'FILE_RECEIVED_FAILED',
        message: 'Failed to process file received notification'
      });
    }
  }

  /**
   * 🔄 FASE 7: MANEJAR ARCHIVO ELIMINADO
   * Maneja el evento cuando se elimina un archivo
   */
  async handleFileDeleted(socket, fileData) {
    const { userEmail } = socket;
    const { fileId, conversationId, fileName } = fileData;

    try {
      if (!fileId || !conversationId) {
        throw new Error('fileId and conversationId are required');
      }

      // Verificar permisos para la conversación
      const hasPermission = await this.verifyConversationPermission(userEmail, conversationId, 'write');
      if (!hasPermission) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          error: 'PERMISSION_DENIED',
          message: 'No permission to delete files in this conversation',
          conversationId
        });
        return;
      }

      // Broadcast a todos los usuarios en la conversación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace',
        tenantId: socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant',
        conversationId 
      });

      this.io.to(roomId).emit(SOCKET_EVENTS.FILE_DELETED, {
        fileId,
        conversationId,
        fileName,
        deletedBy: userEmail,
        timestamp: new Date().toISOString()
      });

      // Actualizar lista de archivos en tiempo real
      await this.emitConversationFilesUpdated(
        conversationId,
        socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace',
        socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant'
      );

      logger.info('Archivo eliminado notificado', {
        category: 'SOCKET_FILE_DELETED',
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        deletedBy: userEmail.substring(0, 20) + '...'
      });

    } catch (error) {
      logger.error('Error manejando archivo eliminado', {
        category: 'SOCKET_FILE_DELETED_ERROR',
        error: error.message,
        fileId: fileData?.fileId?.substring(0, 20) + '...',
        conversationId: fileData?.conversationId?.substring(0, 20) + '...',
        userEmail: userEmail?.substring(0, 20) + '...'
      });

      socket.emit(SOCKET_EVENTS.ERROR, {
        error: 'FILE_DELETED_FAILED',
        message: 'Failed to process file deleted notification'
      });
    }
  }

  /**
   * 🆕 ⚙️ EMITIR EVENTO DE ARCHIVO PROCESANDO
   * Método para ser llamado desde controladores HTTP
   */
  emitFileProcessing(fileData) {
    try {
      const { fileId, conversationId, progress = 0, stage = 'processing', processedBy } = fileData;

      if (!fileId || !conversationId) {
        logger.warn('Emitir archivo procesando: datos incompletos', {
          category: 'SOCKET_EMIT_FILE_PROCESSING_WARNING',
          hasFileId: !!fileId,
          hasConversationId: !!conversationId
        });
        return false;
      }

      // Obtener room de la conversación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: 'default_workspace',
        tenantId: 'default_tenant',
        conversationId 
      });

      // Emitir evento a la room
      this.io.to(roomId).emit(SOCKET_EVENTS.FILE_PROCESSING, {
        fileId,
        conversationId,
        progress,
        stage,
        processedBy,
        timestamp: new Date().toISOString()
      });

      logger.debug('Evento de archivo procesando emitido', {
        category: 'SOCKET_EMIT_FILE_PROCESSING',
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        progress,
        stage
      });

      return true;

    } catch (error) {
      logger.error('Error emitiendo evento de archivo procesando', {
        category: 'SOCKET_EMIT_FILE_PROCESSING_ERROR',
        error: error.message,
        fileData: {
          fileId: fileData?.fileId?.substring(0, 20) + '...',
          conversationId: fileData?.conversationId?.substring(0, 20) + '...'
        }
      });
      return false;
    }
  }

  /**
   * 🆕 ✅ EMITIR EVENTO DE ARCHIVO LISTO
   * Método para ser llamado desde controladores HTTP
   */
  emitFileReady(fileData) {
    try {
      const { fileId, conversationId, fileUrl, metadata = {}, readyBy } = fileData;

      if (!fileId || !conversationId || !fileUrl) {
        logger.warn('Emitir archivo listo: datos incompletos', {
          category: 'SOCKET_EMIT_FILE_READY_WARNING',
          hasFileId: !!fileId,
          hasConversationId: !!conversationId,
          hasFileUrl: !!fileUrl
        });
        return false;
      }

      // Obtener room de la conversación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: 'default_workspace',
        tenantId: 'default_tenant',
        conversationId 
      });

      // Emitir evento a la room
      this.io.to(roomId).emit(SOCKET_EVENTS.FILE_READY, {
        fileId,
        conversationId,
        fileUrl,
        metadata,
        readyBy,
        timestamp: new Date().toISOString()
      });

      logger.info('Evento de archivo listo emitido', {
        category: 'SOCKET_EMIT_FILE_READY',
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        readyBy: readyBy?.substring(0, 20) + '...',
        roomId
      });

      return true;

    } catch (error) {
      logger.error('Error emitiendo evento de archivo listo', {
        category: 'SOCKET_EMIT_FILE_READY_ERROR',
        error: error.message,
        fileData: {
          fileId: fileData?.fileId?.substring(0, 20) + '...',
          conversationId: fileData?.conversationId?.substring(0, 20) + '...'
        }
      });
      return false;
    }
  }

  /**
   * 🆕 ❌ EMITIR EVENTO DE ERROR DE ARCHIVO
   * Método para ser llamado desde controladores HTTP
   */
  emitFileError(fileData) {
    try {
      const { fileId, conversationId, error, errorCode, errorBy } = fileData;

      if (!fileId || !conversationId || !error) {
        logger.warn('Emitir error de archivo: datos incompletos', {
          category: 'SOCKET_EMIT_FILE_ERROR_WARNING',
          hasFileId: !!fileId,
          hasConversationId: !!conversationId,
          hasError: !!error
        });
        return false;
      }

      // Obtener room de la conversación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: 'default_workspace',
        tenantId: 'default_tenant',
        conversationId 
      });

      // Emitir evento a la room
      this.io.to(roomId).emit(SOCKET_EVENTS.FILE_ERROR, {
        fileId,
        conversationId,
        error,
        errorCode,
        errorBy,
        timestamp: new Date().toISOString()
      });

      logger.error('Evento de error de archivo emitido', {
        category: 'SOCKET_EMIT_FILE_ERROR',
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        error,
        errorCode,
        errorBy: errorBy?.substring(0, 20) + '...'
      });

      return true;

    } catch (error) {
      logger.error('Error emitiendo evento de error de archivo', {
        category: 'SOCKET_EMIT_FILE_ERROR_HANDLER_ERROR',
        error: error.message,
        fileData: {
          fileId: fileData?.fileId?.substring(0, 20) + '...',
          conversationId: fileData?.conversationId?.substring(0, 20) + '...'
        }
      });
      return false;
    }
  }

  /**
   * 🆕 📊 EMITIR EVENTO DE PROGRESO DE ARCHIVO
   * Método para ser llamado desde controladores HTTP
   */
  emitFileProgress(fileData) {
    try {
      const { fileId, conversationId, progress, stage, details = {}, progressBy } = fileData;

      if (!fileId || !conversationId) {
        logger.warn('Emitir progreso de archivo: datos incompletos', {
          category: 'SOCKET_EMIT_FILE_PROGRESS_WARNING',
          hasFileId: !!fileId,
          hasConversationId: !!conversationId
        });
        return false;
      }

      // Obtener room de la conversación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: 'default_workspace',
        tenantId: 'default_tenant',
        conversationId 
      });

      // Emitir evento a la room
      this.io.to(roomId).emit(SOCKET_EVENTS.FILE_PROGRESS, {
        fileId,
        conversationId,
        progress,
        stage,
        details,
        progressBy,
        timestamp: new Date().toISOString()
      });

      logger.debug('Evento de progreso de archivo emitido', {
        category: 'SOCKET_EMIT_FILE_PROGRESS',
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        progress,
        stage
      });

      return true;

    } catch (error) {
      logger.error('Error emitiendo evento de progreso de archivo', {
        category: 'SOCKET_EMIT_FILE_PROGRESS_ERROR',
        error: error.message,
        fileData: {
          fileId: fileData?.fileId?.substring(0, 20) + '...',
          conversationId: fileData?.conversationId?.substring(0, 20) + '...'
        }
      });
      return false;
    }
  }

  /**
   * 🆕 🎵 HANDLE AUDIO PLAYING
   * Maneja el evento cuando se reproduce audio
   */
  async handleAudioPlaying(socket, audioData) {
    const { userEmail } = socket;
    const { fileId, conversationId, currentTime = 0, duration = 0 } = audioData;

    try {
      if (!fileId || !conversationId) {
        throw new Error('fileId and conversationId are required');
      }

      // Verificar permisos
      const hasPermission = await this.verifyConversationPermission(userEmail, conversationId, 'read');
      if (!hasPermission) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          error: 'PERMISSION_DENIED',
          message: 'No permission to access this conversation',
          conversationId
        });
        return;
      }

      // Broadcast a la conversación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace',
        tenantId: socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant',
        conversationId 
      });

      this.io.to(roomId).emit(SOCKET_EVENTS.AUDIO_PLAYING, {
        fileId,
        conversationId,
        currentTime,
        duration,
        playedBy: userEmail,
        timestamp: new Date().toISOString()
      });

      logger.debug('Audio playing event sent', {
        category: 'SOCKET_AUDIO_PLAYING',
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        playedBy: userEmail.substring(0, 20) + '...',
        currentTime,
        duration
      });

    } catch (error) {
      logger.error('Error handling audio playing', {
        category: 'SOCKET_AUDIO_PLAYING_ERROR',
        error: error.message,
        fileId: audioData?.fileId?.substring(0, 20) + '...',
        conversationId: audioData?.conversationId?.substring(0, 20) + '...'
      });
    }
  }

  /**
   * 🆕 ⏹️ HANDLE AUDIO STOPPED
   * Maneja el evento cuando se detiene el audio
   */
  async handleAudioStopped(socket, audioData) {
    const { userEmail } = socket;
    const { fileId, conversationId, stoppedAt = 0 } = audioData;

    try {
      if (!fileId || !conversationId) {
        throw new Error('fileId and conversationId are required');
      }

      // Verificar permisos
      const hasPermission = await this.verifyConversationPermission(userEmail, conversationId, 'read');
      if (!hasPermission) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          error: 'PERMISSION_DENIED',
          message: 'No permission to access this conversation',
          conversationId
        });
        return;
      }

      // Broadcast a la conversación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace',
        tenantId: socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant',
        conversationId 
      });

      this.io.to(roomId).emit(SOCKET_EVENTS.AUDIO_STOPPED, {
        fileId,
        conversationId,
        stoppedAt,
        stoppedBy: userEmail,
        timestamp: new Date().toISOString()
      });

      logger.debug('Audio stopped event sent', {
        category: 'SOCKET_AUDIO_STOPPED',
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        stoppedBy: userEmail.substring(0, 20) + '...',
        stoppedAt
      });

    } catch (error) {
      logger.error('Error handling audio stopped', {
        category: 'SOCKET_AUDIO_STOPPED_ERROR',
        error: error.message,
        fileId: audioData?.fileId?.substring(0, 20) + '...',
        conversationId: audioData?.conversationId?.substring(0, 20) + '...'
      });
    }
  }

  /**
   * 🆕 ⏸️ HANDLE AUDIO PAUSED
   * Maneja el evento cuando se pausa el audio
   */
  async handleAudioPaused(socket, audioData) {
    const { userEmail } = socket;
    const { fileId, conversationId, pausedAt = 0 } = audioData;

    try {
      if (!fileId || !conversationId) {
        throw new Error('fileId and conversationId are required');
      }

      // Verificar permisos
      const hasPermission = await this.verifyConversationPermission(userEmail, conversationId, 'read');
      if (!hasPermission) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          error: 'PERMISSION_DENIED',
          message: 'No permission to access this conversation',
          conversationId
        });
        return;
      }

      // Broadcast a la conversación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace',
        tenantId: socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant',
        conversationId 
      });

      this.io.to(roomId).emit(SOCKET_EVENTS.AUDIO_PAUSED, {
        fileId,
        conversationId,
        pausedAt,
        pausedBy: userEmail,
        timestamp: new Date().toISOString()
      });

      logger.debug('Audio paused event sent', {
        category: 'SOCKET_AUDIO_PAUSED',
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        pausedBy: userEmail.substring(0, 20) + '...',
        pausedAt
      });

    } catch (error) {
      logger.error('Error handling audio paused', {
        category: 'SOCKET_AUDIO_PAUSED_ERROR',
        error: error.message,
        fileId: audioData?.fileId?.substring(0, 20) + '...',
        conversationId: audioData?.conversationId?.substring(0, 20) + '...'
      });
    }
  }

  /**
   * 🆕 🎙️ HANDLE AUDIO RECORDING
   * Maneja el evento cuando se inicia grabación de audio
   */
  async handleAudioRecording(socket, audioData) {
    const { userEmail } = socket;
    const { conversationId, duration = 60, format = 'mp3' } = audioData;

    try {
      if (!conversationId) {
        throw new Error('conversationId is required');
      }

      // Verificar permisos
      const hasPermission = await this.verifyConversationPermission(userEmail, conversationId, 'write');
      if (!hasPermission) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          error: 'PERMISSION_DENIED',
          message: 'No permission to record audio in this conversation',
          conversationId
        });
        return;
      }

      // Iniciar grabación usando AudioProcessor
      const AudioProcessor = require('../services/AudioProcessor');
      const audioProcessor = new AudioProcessor();
      
      const recording = await audioProcessor.recordAudio(socket, conversationId, {
        duration,
        format
      });

      // Broadcast inicio de grabación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace',
        tenantId: socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant',
        conversationId 
      });

      this.io.to(roomId).emit(SOCKET_EVENTS.AUDIO_RECORDING, {
        recordingId: recording.recordingId,
        conversationId,
        duration,
        format,
        recordedBy: userEmail,
        timestamp: new Date().toISOString()
      });

      logger.info('Audio recording started', {
        category: 'SOCKET_AUDIO_RECORDING',
        recordingId: recording.recordingId,
        conversationId: conversationId.substring(0, 20) + '...',
        recordedBy: userEmail.substring(0, 20) + '...',
        duration,
        format
      });

      // Guardar referencia de grabación activa
      socket.activeRecording = recording;

    } catch (error) {
      logger.error('Error handling audio recording', {
        category: 'SOCKET_AUDIO_RECORDING_ERROR',
        error: error.message,
        conversationId: audioData?.conversationId?.substring(0, 20) + '...',
        userEmail: userEmail?.substring(0, 20) + '...'
      });

      socket.emit(SOCKET_EVENTS.AUDIO_RECORDING_ERROR, {
        conversationId,
        error: error.message
      });
    }
  }

  /**
   * 🆕 ⏹️ HANDLE AUDIO RECORDING STOPPED
   * Maneja el evento cuando se detiene la grabación de audio
   */
  async handleAudioRecordingStopped(socket, audioData) {
    const { userEmail } = socket;
    const { conversationId } = audioData;

    try {
      if (!conversationId) {
        throw new Error('conversationId is required');
      }

      // Verificar permisos
      const hasPermission = await this.verifyConversationPermission(userEmail, conversationId, 'write');
      if (!hasPermission) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          error: 'PERMISSION_DENIED',
          message: 'No permission to stop recording in this conversation',
          conversationId
        });
        return;
      }

      // Detener grabación activa
      if (socket.activeRecording && socket.activeRecording.stop) {
        socket.activeRecording.stop();
        
        logger.info('Audio recording stopped', {
          category: 'SOCKET_AUDIO_RECORDING_STOPPED',
          recordingId: socket.activeRecording.recordingId,
          conversationId: conversationId.substring(0, 20) + '...',
          stoppedBy: userEmail.substring(0, 20) + '...'
        });

        // Limpiar referencia
        socket.activeRecording = null;
      }

      // Broadcast detención de grabación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: socket.workspaceId || socket.decodedToken?.workspaceId || 'default_workspace',
        tenantId: socket.tenantId || socket.decodedToken?.tenantId || 'default_tenant',
        conversationId 
      });

      this.io.to(roomId).emit(SOCKET_EVENTS.AUDIO_RECORDING_STOPPED, {
        conversationId,
        stoppedBy: userEmail,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error handling audio recording stopped', {
        category: 'SOCKET_AUDIO_RECORDING_STOPPED_ERROR',
        error: error.message,
        conversationId: audioData?.conversationId?.substring(0, 20) + '...',
        userEmail: userEmail?.substring(0, 20) + '...'
      });
    }
  }

  /**
   * 🔄 FASE 7: EMITIR EVENTO DE ARCHIVO RECIBIDO
   * Método para ser llamado desde controladores HTTP
   */
  async emitFileReceived(fileData) {
    try {
      const { fileId, conversationId, fileName, fileType, fileSize, source = 'whatsapp', receivedBy } = fileData;

      if (!fileId || !conversationId) {
        logger.warn('Emitir archivo recibido: datos incompletos', {
          category: 'SOCKET_EMIT_FILE_RECEIVED_WARNING',
          hasFileId: !!fileId,
          hasConversationId: !!conversationId
        });
        return false;
      }

      // Obtener room de la conversación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: 'default_workspace',
        tenantId: 'default_tenant',
        conversationId 
      });

      // Emitir evento a la room
      this.io.to(roomId).emit(SOCKET_EVENTS.FILE_RECEIVED, {
        fileId,
        conversationId,
        fileName,
        fileType,
        fileSize,
        source,
        receivedBy,
        timestamp: new Date().toISOString()
      });

      // Actualizar lista de archivos en tiempo real
      await this.emitConversationFilesUpdated(conversationId, 'default_workspace', 'default_tenant');

      logger.info('Evento de archivo recibido emitido', {
        category: 'SOCKET_EMIT_FILE_RECEIVED',
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        source,
        receivedBy: receivedBy?.substring(0, 20) + '...',
        roomId
      });

      return true;

    } catch (error) {
      logger.error('Error emitiendo evento de archivo recibido', {
        category: 'SOCKET_EMIT_FILE_RECEIVED_ERROR',
        error: error.message,
        fileData: {
          fileId: fileData?.fileId?.substring(0, 20) + '...',
          conversationId: fileData?.conversationId?.substring(0, 20) + '...'
        }
      });
      return false;
    }
  }

  /**
   * 🔄 FASE 7: EMITIR EVENTO DE ARCHIVO ELIMINADO
   * Método para ser llamado desde controladores HTTP
   */
  async emitFileDeleted(fileData) {
    try {
      const { fileId, conversationId, fileName, deletedBy } = fileData;

      if (!fileId || !conversationId) {
        logger.warn('Emitir archivo eliminado: datos incompletos', {
          category: 'SOCKET_EMIT_FILE_DELETED_WARNING',
          hasFileId: !!fileId,
          hasConversationId: !!conversationId
        });
        return false;
      }

      // Obtener room de la conversación
      const { getConversationRoom } = require('./index');
      const roomId = getConversationRoom({ 
        workspaceId: 'default_workspace',
        tenantId: 'default_tenant',
        conversationId 
      });

      // Emitir evento a la room
      this.io.to(roomId).emit(SOCKET_EVENTS.FILE_DELETED, {
        fileId,
        conversationId,
        fileName,
        deletedBy,
        timestamp: new Date().toISOString()
      });

      // Actualizar lista de archivos en tiempo real
      await this.emitConversationFilesUpdated(conversationId, 'default_workspace', 'default_tenant');

      logger.info('Evento de archivo eliminado emitido', {
        category: 'SOCKET_EMIT_FILE_DELETED',
        fileId: fileId.substring(0, 20) + '...',
        conversationId: conversationId.substring(0, 20) + '...',
        deletedBy: deletedBy?.substring(0, 20) + '...',
        roomId
      });

      return true;

    } catch (error) {
      logger.error('Error emitiendo evento de archivo eliminado', {
        category: 'SOCKET_EMIT_FILE_DELETED_ERROR',
        error: error.message,
        fileData: {
          fileId: fileData?.fileId?.substring(0, 20) + '...',
          conversationId: fileData?.conversationId?.substring(0, 20) + '...'
        }
      });
      return false;
    }
  }
}

// Export nombrado unificado
module.exports = { EnterpriseSocketManager }; 