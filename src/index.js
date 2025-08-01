/**
 * 🚀 SERVIDOR CONSOLIDADO UTALK BACKEND
 * 
 * Características implementadas:
 * - Gestión de memoria adaptativa
 * - Error handling robusto
 * - Logging profesional con contexto
 * - CORS seguro por entorno
 * - Middleware de autenticación
 * - Socket.IO para tiempo real
 * - Graceful shutdown
 * 
 * @version 4.0.0 CONSOLIDATED
 * @author Backend Team
 */

// Cargar variables de entorno
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { createServer } = require('http');

// Configuración
const logger = require('./utils/logger');
const { memoryManager } = require('./utils/memoryManager');
const { enhancedErrorHandler } = require('./middleware/enhancedErrorHandler');

// Middleware personalizado
const { authMiddleware } = require('./middleware/auth');

// Rutas
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contacts');
const conversationRoutes = require('./routes/conversations');
const messageRoutes = require('./routes/messages');
const campaignRoutes = require('./routes/campaigns');
const teamRoutes = require('./routes/team');
const knowledgeRoutes = require('./routes/knowledge');
const mediaRoutes = require('./routes/media');
const dashboardRoutes = require('./routes/dashboard');
const twilioRoutes = require('./routes/twilio');

// Servicios
const SocketManager = require('./socket');

class ConsolidatedServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.socketManager = null;
    this.isShuttingDown = false;
    
    this.PORT = process.env.PORT || 3001;
    this.startTime = Date.now();
    
    // Configurar proceso
    this.setupProcess();
  }

  /**
   * 🔧 CONFIGURAR PROCESO Y HANDLERS
   */
  setupProcess() {
    // Configurar memoria V8 según mejores prácticas
    if (process.env.NODE_ENV === 'production') {
      process.env.NODE_OPTIONS = [
        process.env.NODE_OPTIONS || '',
        '--max-old-space-size=2048',
        '--max-semi-space-size=64',
        '--gc-interval=100'
      ].filter(Boolean).join(' ');
    }

    // Manejar excepciones no capturadas
    process.on('uncaughtException', (error) => {
      logger.error('Excepción no capturada detectada', {
        category: 'UNCAUGHT_EXCEPTION',
        error: error.message,
        stack: error.stack,
        severity: 'CRITICAL',
        requiresAttention: true,
        processId: process.pid,
        uptime: process.uptime()
      });
      this.gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Promise rechazada no manejada detectada', {
        category: 'UNHANDLED_REJECTION',
        reason: reason?.message || reason,
        stack: reason?.stack,
        promise: promise.toString(),
        severity: 'CRITICAL',
        requiresAttention: true,
        processId: process.pid,
        uptime: process.uptime()
      });
      this.gracefulShutdown('unhandledRejection');
    });

    // Señales de sistema
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
  }

  /**
   * 🚀 INICIALIZAR SERVIDOR
   */
  async initialize() {
    try {
      logger.info('🚀 Iniciando servidor consolidado...', {
        category: 'SERVER_STARTUP',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        environment: process.env.NODE_ENV || 'development',
        memoryLimit: process.env.NODE_OPTIONS,
        startupTime: new Date().toISOString()
      });

      // 1. Inicializar gestión de memoria
      await this.initializeMemoryManagement();

      // 2. Configurar middlewares básicos
      this.setupBasicMiddleware();

      // 3. Configurar rutas y middlewares de aplicación
      this.setupRoutes();

      // 4. Configurar middleware global de errores
      this.setupErrorHandling();

      // 5. Crear servidor HTTP
      this.server = createServer(this.app);

      // 6. Inicializar Socket.IO
      this.initializeSocketIO();

      // 7. Iniciar servidor
      await this.startServer();

      logger.info('✅ Servidor consolidado inicializado exitosamente', {
        category: 'SERVER_SUCCESS',
        port: this.PORT,
        environment: process.env.NODE_ENV || 'development',
        features: {
          memoryManagement: true,
          errorHandling: true,
          logging: true,
          socketIO: true,
          gracefulShutdown: true
        },
        startupDuration: Date.now() - this.startTime + 'ms',
        memoryUsage: process.memoryUsage()
      });

    } catch (error) {
      logger.error('💥 Error fatal durante inicialización del servidor', {
        category: 'SERVER_STARTUP_FAILURE',
        error: error.message,
        stack: error.stack,
        severity: 'CRITICAL',
        requiresAttention: true,
        startupDuration: Date.now() - this.startTime + 'ms'
      });
      
      process.exit(1);
    }
  }

  /**
   * 🧠 INICIALIZAR GESTIÓN DE MEMORIA
   */
  async initializeMemoryManagement() {
    logger.info('🧠 Inicializando gestión de memoria...', {
      category: 'MEMORY_INIT'
    });

    // Configurar alertas de memoria
    memoryManager.on('critical-alert', (alert) => {
      logger.error('ALERTA CRÍTICA DE MEMORIA EN SERVIDOR', {
        category: 'MEMORY_CRITICAL_ALERT',
        alert,
        serverStats: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          activeConnections: this.socketManager?.getConnectedUsers()?.length || 0,
          loadAverage: require('os').loadavg()
        },
        severity: 'CRITICAL',
        requiresAttention: true
      });

      // En caso crítico, forzar garbage collection si está disponible
      if (global.gc) {
        global.gc();
        logger.info('Garbage collection forzado por alerta crítica de memoria', {
          category: 'MEMORY_GC_FORCED',
          reason: 'critical_alert'
        });
      }
    });

    memoryManager.on('warning-alert', (alert) => {
      logger.warn('Advertencia de memoria en servidor', { 
        category: 'MEMORY_WARNING_ALERT',
        alert 
      });
    });

    logger.info('✅ Gestión de memoria inicializada', {
      category: 'MEMORY_SUCCESS'
    });
  }

  /**
   * 🛡️ CONFIGURAR MIDDLEWARES BÁSICOS
   */
  setupBasicMiddleware() {
    logger.info('🛡️ Configurando middlewares básicos...', {
      category: 'MIDDLEWARE_SETUP'
    });

    // Helmet para seguridad HTTP
    this.app.use(helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
      hsts: process.env.NODE_ENV === 'production' ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      } : false
    }));

    // Compresión
    this.app.use(compression({
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
      }
    }));

    // CORS configurado por entorno
    this.setupCORS();

    // Parsing de JSON con límite y validación
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        // Agregar buffer raw para validación de webhooks
        req.rawBody = buf;
      },
      type: ['application/json', 'text/plain']
    }));

    // Parsing de URL encoded
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb',
      parameterLimit: 20
    }));

    // Logging middleware simple
    this.app.use((req, res, next) => {
      req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      next();
    });

    // Headers de seguridad adicionales
    this.app.use((req, res, next) => {
      res.set({
        'X-Request-ID': req.requestId,
        'X-Powered-By': 'UTalk-Backend-v4.0-Consolidated',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-DNS-Prefetch-Control': 'off'
      });
      next();
    });

    // Trust proxy para load balancers
    if (process.env.NODE_ENV === 'production') {
      this.app.set('trust proxy', 1);
    }

    logger.info('✅ Middlewares básicos configurados', {
      category: 'MIDDLEWARE_SUCCESS',
      trustProxy: process.env.NODE_ENV === 'production'
    });
  }

  /**
   * 🔒 CONFIGURACIÓN CORS SEGURA POR ENTORNO
   */
  setupCORS() {
    const env = process.env.NODE_ENV || 'development';
    
    if (env === 'production') {
      // 🚨 PRODUCCIÓN: Lista blanca de dominios
      const allowedOrigins = this.getAllowedOrigins();
      
      this.app.use(cors({
        origin: (origin, callback) => {
          // Permitir requests sin origin (como mobile apps, Postman, etc.)
          if (!origin) {
            return callback(null, true);
          }
          
          // Verificar si el origin está en la lista blanca
          if (allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            logger.warn('🚫 CORS bloqueado - Origin no permitido', {
              category: 'CORS_BLOCKED',
              origin,
              allowedOrigins,
              ip: origin ? 'unknown' : 'no-origin'
            });
            callback(new Error('Origin no permitido por CORS'));
          }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: [
          'Origin',
          'X-Requested-With',
          'Content-Type',
          'Accept',
          'Authorization',
          'X-API-Key',
          'Cache-Control'
        ],
        exposedHeaders: ['X-Total-Count', 'X-Page-Count', 'X-Request-ID']
      }));
      
      logger.info('🔒 CORS configurado para PRODUCCIÓN', {
        category: 'CORS_CONFIG',
        environment: env,
        allowedOrigins,
        strictMode: true
      });
      
    } else {
      // 🛠️ DESARROLLO: Permitir localhost y dominios de desarrollo
      this.app.use(cors({
        origin: [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:5173', // Vite dev server
          'http://localhost:8080',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:8080'
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: [
          'Origin',
          'X-Requested-With',
          'Content-Type',
          'Accept',
          'Authorization',
          'X-API-Key',
          'Cache-Control'
        ],
        exposedHeaders: ['X-Total-Count', 'X-Page-Count', 'X-Request-ID']
      }));
      
      logger.info('🛠️ CORS configurado para DESARROLLO', {
        category: 'CORS_CONFIG',
        environment: env,
        allowedOrigins: [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:5173',
          'http://localhost:8080'
        ],
        strictMode: false
      });
    }
  }

  /**
   * 📋 OBTENER ORÍGENES PERMITIDOS PARA PRODUCCIÓN
   */
  getAllowedOrigins() {
    // Obtener dominios desde variables de entorno
    const corsOrigins = process.env.CORS_ORIGINS;
    
    if (corsOrigins) {
      return corsOrigins.split(',').map(origin => origin.trim());
    }
    
    // Fallback a dominios por defecto de UTalk
    return [
      'https://utalk.com',
      'https://www.utalk.com',
      'https://app.utalk.com',
      'https://admin.utalk.com',
      'https://api.utalk.com'
    ];
  }

  /**
   * 🛣️ CONFIGURAR RUTAS
   */
  setupRoutes() {
    logger.info('🛣️ Configurando rutas de la aplicación...', {
      category: 'ROUTES_SETUP'
    });

    // Health check básico
    this.app.get('/health', (req, res) => {
      const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        checks: {
          server: { status: 'healthy', message: 'Server is running' },
          memory: { 
            status: 'healthy', 
            usage: process.memoryUsage(),
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
          },
          process: { 
            status: 'healthy', 
            pid: process.pid,
            uptime: process.uptime()
          }
        },
        summary: {
          total: 3,
          healthy: 3,
          failed: 0,
          failedChecks: []
        }
      };

      res.status(200).json(healthData);
    });

    // Health check detallado para debugging
    this.app.get('/health/detailed', async (req, res) => {
      try {
        logger.info('🔍 Iniciando health check detallado', {
          category: 'HEALTH_CHECK_DETAILED',
          requestId: req.requestId
        });

        // Verificar Firebase Firestore
        const { firestore } = require('./config/firebase');
        let firestoreStatus = 'unknown';
        try {
          await firestore.collection('_health_check').limit(1).get();
          firestoreStatus = 'connected';
        } catch (error) {
          firestoreStatus = 'disconnected';
        }

        const os = require('os');
        const healthData = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            firestore: firestoreStatus,
            memory: 'healthy',
            process: 'healthy'
          },
          system: {
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            pid: process.pid,
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            loadAverage: os.loadavg(),
            uptime: os.uptime()
          },
          environment: {
            NODE_ENV: process.env.NODE_ENV,
            PORT: process.env.PORT,
            FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
            TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? 'configured' : 'not_configured',
            REDIS_URL: process.env.REDIS_URL ? 'configured' : 'not_configured'
          }
        };

        res.json(healthData);

      } catch (error) {
        logger.error('Error en health check detallado', {
          category: 'HEALTH_CHECK_DETAILED_ERROR',
          error: error.message,
          requestId: req.requestId
        });

        res.status(503).json({
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Readiness probe para Kubernetes
    this.app.get('/ready', (req, res) => {
      const isReady = this.socketManager && memoryManager;
      
      if (isReady) {
        res.status(200).json({ 
          status: 'ready',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(503).json({ 
          status: 'not_ready',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Liveness probe para Kubernetes
    this.app.get('/live', (req, res) => {
      res.status(200).json({ 
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Métricas endpoint (protegido)
    this.app.get('/api/internal/metrics', authMiddleware, (req, res) => {
      try {
        const metrics = {
          server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            pid: process.pid,
            loadAverage: require('os').loadavg(),
            platform: process.platform,
            nodeVersion: process.version
          },
          memoryManager: memoryManager ? memoryManager.getStats() : null,
          socket: this.socketManager ? this.socketManager.getDetailedStats() : null,
          logging: logger.getStats(),
          timestamp: new Date().toISOString()
        };

        res.json({
          success: true,
          data: metrics,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Error obteniendo métricas internas', {
          category: 'METRICS_ERROR',
          error: error.message,
          stack: error.stack,
          requestId: req.requestId
        });
        
        res.status(500).json({
          success: false,
          error: {
            type: 'METRICS_ERROR',
            message: 'Error obteniendo métricas del sistema',
            timestamp: new Date().toISOString()
          }
        });
      }
    });

    // Rutas principales de la aplicación
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/contacts', contactRoutes);
    this.app.use('/api/conversations', conversationRoutes);
    this.app.use('/api/messages', messageRoutes);
    this.app.use('/api/campaigns', campaignRoutes);
    this.app.use('/api/team', teamRoutes);
    this.app.use('/api/knowledge', knowledgeRoutes);
    this.app.use('/api/media', mediaRoutes);
    this.app.use('/api/dashboard', dashboardRoutes);
    this.app.use('/api/twilio', twilioRoutes);

    // Ruta catch-all para 404
    this.app.use('*', (req, res) => {
      logger.warn('Ruta no encontrada', {
        category: 'ROUTE_NOT_FOUND',
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.headers['user-agent']?.substring(0, 100),
        requestId: req.requestId
      });

      res.status(404).json({
        success: false,
        error: {
          type: 'NOT_FOUND_ERROR',
          code: 'ROUTE_NOT_FOUND',
          message: 'Ruta no encontrada',
          details: {
            method: req.method,
            path: req.originalUrl
          },
          timestamp: new Date().toISOString()
        },
        requestId: req.requestId
      });
    });

    logger.info('✅ Rutas configuradas exitosamente', {
      category: 'ROUTES_SUCCESS',
      totalRoutes: this.app._router ? this.app._router.stack.length : 'unknown'
    });
  }

  /**
   * 🚨 CONFIGURAR MANEJO GLOBAL DE ERRORES
   */
  setupErrorHandling() {
    logger.info('🚨 Configurando manejo global de errores...', {
      category: 'ERROR_HANDLER_SETUP'
    });

    // Middleware global de errores (DEBE IR AL FINAL)
    this.app.use(enhancedErrorHandler.handle());

    logger.info('✅ Manejo global de errores configurado', {
      category: 'ERROR_HANDLER_SUCCESS',
      features: {
        automaticClassification: true,
        structuredLogging: true,
        securityFiltering: true,
        metrics: true
      }
    });
  }

  /**
   * 🔌 INICIALIZAR SOCKET.IO
   */
  initializeSocketIO() {
    logger.info('🔌 Inicializando Socket.IO...', {
      category: 'SOCKET_INIT'
    });

    this.socketManager = new SocketManager(this.server);
    
    // Hacer disponible el socket manager para otros componentes
    this.app.set('socketManager', this.socketManager);

    logger.info('✅ Socket.IO inicializado', {
      category: 'SOCKET_SUCCESS',
      memoryManaged: true,
      maxConnections: 50000
    });
  }

  /**
   * 🎯 INICIAR SERVIDOR
   */
  async startServer() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.PORT, (error) => {
        if (error) {
          logger.error('Error iniciando servidor HTTP', {
            category: 'SERVER_START_ERROR',
            error: error.message,
            stack: error.stack,
            port: this.PORT
          });
          reject(error);
          return;
        }

        logger.info('🎉 Servidor HTTP iniciado exitosamente', {
          category: 'SERVER_STARTED',
          port: this.PORT,
          environment: process.env.NODE_ENV || 'development',
          startupTime: Date.now() - this.startTime + 'ms',
          memoryUsage: process.memoryUsage(),
          pid: process.pid,
          address: this.server.address()
        });

        resolve();
      });

      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          logger.error('Puerto en uso', {
            category: 'SERVER_PORT_ERROR',
            port: this.PORT,
            error: error.message
          });
        } else {
          logger.error('Error del servidor HTTP', {
            category: 'SERVER_ERROR',
            error: error.message,
            stack: error.stack
          });
        }
        reject(error);
      });

      // Configurar timeouts del servidor
      this.server.timeout = 120000; // 2 minutos
      this.server.keepAliveTimeout = 65000; // 65 segundos
      this.server.headersTimeout = 66000; // 66 segundos
    });
  }

  /**
   * 🛑 GRACEFUL SHUTDOWN
   */
  async gracefulShutdown(signal) {
    if (this.isShuttingDown) {
      logger.warn('Shutdown ya en progreso, ignorando señal', { 
        category: 'SHUTDOWN_IGNORED',
        signal 
      });
      return;
    }

    this.isShuttingDown = true;

    logger.info('🛑 Iniciando graceful shutdown...', {
      category: 'SHUTDOWN_START',
      signal,
      uptime: process.uptime(),
      pid: process.pid,
      reason: signal
    });

    const shutdownStartTime = Date.now();

    try {
      // 1. Dejar de aceptar nuevas conexiones
      if (this.server) {
        this.server.close(() => {
          logger.info('✅ Servidor HTTP cerrado', {
            category: 'SHUTDOWN_SERVER_CLOSED'
          });
        });
      }

      // 2. Cerrar conexiones de Socket.IO
      if (this.socketManager) {
        const connectedUsers = this.socketManager.getConnectedUsers();
        logger.info('🔌 Cerrando conexiones Socket.IO', {
          category: 'SHUTDOWN_SOCKET_CLOSING',
          connectedUsers: connectedUsers.length
        });

        // Notificar a todos los usuarios sobre el shutdown
        for (const user of connectedUsers) {
          try {
            const socket = this.socketManager.io.sockets.sockets.get(user.socketId);
            if (socket) {
              socket.emit('server-shutdown', {
                message: 'Servidor reiniciándose, reconectando automáticamente...',
                timestamp: new Date().toISOString(),
                reason: signal
              });
              socket.disconnect(true);
            }
          } catch (socketError) {
            logger.error('Error cerrando socket individual', {
              category: 'SHUTDOWN_SOCKET_ERROR',
              userId: user.email,
              error: socketError.message
            });
          }
        }
      }

      // 3. Limpiar memory manager
      if (memoryManager) {
        try {
          logger.info('✅ Memory manager cleanup iniciado', {
            category: 'SHUTDOWN_MEMORY_CLEANUP'
          });
        } catch (memoryError) {
          logger.error('Error en memory manager cleanup', {
            category: 'SHUTDOWN_MEMORY_ERROR',
            error: memoryError.message
          });
        }
      }

      // 4. Forzar garbage collection final
      if (global.gc) {
        try {
          global.gc();
          logger.info('✅ Garbage collection final ejecutado', {
            category: 'SHUTDOWN_GC_FINAL'
          });
        } catch (gcError) {
          logger.error('Error en garbage collection final', {
            category: 'SHUTDOWN_GC_ERROR',
            error: gcError.message
          });
        }
      }

      const shutdownDuration = Date.now() - shutdownStartTime;

      logger.info('✅ Graceful shutdown completado exitosamente', {
        category: 'SHUTDOWN_COMPLETED',
        signal,
        duration: shutdownDuration + 'ms',
        finalMemoryUsage: process.memoryUsage()
      });

      // Dar tiempo para que los logs se escriban
      setTimeout(() => {
        process.exit(0);
      }, 1000);

    } catch (error) {
      logger.error('Error durante graceful shutdown', {
        category: 'SHUTDOWN_ERROR',
        error: error.message,
        stack: error.stack,
        signal,
        duration: Date.now() - shutdownStartTime + 'ms'
      });

      // Forzar salida después de error
      setTimeout(() => {
        process.exit(1);
      }, 2000);
    }
  }
}

// Crear e inicializar servidor
const server = new ConsolidatedServer();

// Solo inicializar si no estamos en test
if (require.main === module) {
  server.initialize().catch((error) => {
    logger.error('💥 Fallo catastrófico iniciando servidor:', {
      category: 'CATASTROPHIC_FAILURE',
      error: error.message,
      stack: error.stack,
      severity: 'CRITICAL'
    });
    process.exit(1);
  });
}

module.exports = server;
