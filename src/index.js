/**
 * 🚀 SERVIDOR CONSOLIDADO UTALK BACKEND - OPTIMIZADO
 * 
 * Características implementadas:
 * - Gestión de memoria adaptativa
 * - Error handling robusto
 * - Logging profesional con contexto
 * - CORS seguro por entorno
 * - Middleware de autenticación
 * - Socket.IO para tiempo real
 * - Rate Limiting persistente
 * - Health Checks enterprise
 * - Graceful shutdown
 * 
 * @version 4.2.0 OPTIMIZED STARTUP
 * @author Backend Team
 */

// Cargar variables de entorno
require('dotenv').config();

// 🔧 OPTIMIZACIÓN: Cargar optimizador de inicio PRIMERO
require('./config/startupOptimizer');

// Validar configuración de entorno
const { validateEnvironment, isEnvironmentValid } = require('./config/envValidator');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { createServer } = require('http');

// Configuración
const logger = require('./utils/logger');
const { cacheService } = require('./services/CacheService');
const { enhancedErrorHandler } = require('./middleware/enhancedErrorHandler');
const { rateLimitManager } = require('./middleware/persistentRateLimit');
const { getHealthCheckService } = require('./services/HealthCheckService');

// Middleware personalizado
const { authMiddleware } = require('./middleware/auth');
const { correlationMiddleware } = require('./middleware/correlation');

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
const aiRoutes = require('./routes/ai');
const reportRoutes = require('./routes/reports');
const ragRoutes = require('./routes/rag');
const aiOpsRoutes = require('./routes/aiOps');
const logRoutes = require('./routes/logs');

// Servicios
// SocketManager se importa dinámicamente en initializeSocketIO()

// Importar servicios de colas - LAZY LOADING
let campaignQueueService = null;

class ConsolidatedServer {
  constructor() {
    // Validar entorno antes de inicializar
    const envValidation = validateEnvironment();
    if (!envValidation.isValid) {
      logger.error('🚨 Configuración de entorno inválida - No se puede iniciar el servidor', {
        category: 'SERVER_INIT_ERROR',
        errors: envValidation.errors
      });
      process.exit(1);
    }

    this.app = express();
    this.server = null;
    this.socketManager = null;
    this.healthService = null;
    this.isShuttingDown = false;
    
    // 🚨 RUTA DE EMERGENCIA PARA DIAGNÓSTICO - AGREGAR AL INICIO
    this.app.get('/emergency-test', (req, res) => {
      logger.info('EMERGENCIA: Petición recibida en /emergency-test desde:', { category: 'EMERGENCIA_PETICI_N_RECIBIDA_E', ip: req.ip });
      res.status(200).json({
        status: 'EMERGENCY_ROUTE_WORKING',
        timestamp: new Date().toISOString(),
        message: 'El servidor Express SÍ está recibiendo peticiones',
        ip: req.ip,
        headers: req.headers
      });
    });

    // 🏥 RUTA DE HEALTH CHECK PARA RAILWAY
    this.app.get('/health', (req, res) => {
      logger.info('Health check solicitado desde Railway', { 
        category: 'HEALTH_CHECK',
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'unknown',
        version: '1.0.0',
        memoryUsage: process.memoryUsage(),
        server: 'utalk-backend'
      });
    });

    // ✅ CRÍTICO: Railway debe inyectar PORT - Debugging intensivo
    logger.info('Verificando configuración de puerto Railway', {
      category: 'RAILWAY_CONFIG',
      port: process.env.PORT,
      portType: typeof process.env.PORT
    });
    
    // Buscar puertos alternativos que Railway pueda usar
    const railwayPorts = Object.keys(process.env)
      .filter(key => key.toLowerCase().includes('port'))
      .reduce((acc, key) => {
        acc[key] = process.env[key];
        return acc;
      }, {});
    logger.debug('Variables de puerto detectadas', {
      category: 'RAILWAY_CONFIG',
      railwayPorts
    });
    
    // Usar PORT de Railway o fallback a 3000
    this.PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    
    // ⚠️ CRÍTICO: Log si Railway no inyecta PORT
    if (!process.env.PORT) {
      logger.error('Railway no está inyectando process.env.PORT', {
        category: 'RAILWAY_CONFIG_ERROR',
        severity: 'CRITICAL',
        availableVars: Object.keys(process.env).filter(k => k.includes('PORT') || k.includes('RAILWAY'))
      });
    } else {
      logger.info('Railway PORT configurado correctamente', {
        category: 'RAILWAY_CONFIG',
        port: process.env.PORT
      });
    }
    this.startTime = Date.now();
    
    // Configurar proceso
    this.setupProcess();
  }

  /**
   * 🚀 INICIALIZACIÓN ORQUESTADA DEL SERVIDOR - OPTIMIZADA
   * Método requerido por el entrypoint. Crea el servidor HTTP,
   * configura middlewares, rutas, servicios y health checks.
   */
  async initialize() {
    logger.info('🚀 Iniciando servidor optimizado...', {
      category: 'SERVER_INIT',
      startTime: this.startTime
    });

    // 1) Validar entorno
    this.validateEnvironmentVariables();

    // 2) Configuración base de middlewares y CORS
    this.setupBasicMiddleware();

    // 3) Rutas de la aplicación
    this.setupRoutes();

    // 4) Manejo global de errores
    this.setupErrorHandling();

    // 5) Crear servidor HTTP sobre Express (requerido por startServer)
    if (!this.server) {
      this.server = (require('http')).createServer(this.app);
    }

    // 6) Arrancar servidor HTTP PRIMERO (crítico para Railway)
    await this.startServer();

    // 7) Inicializar servicios en segundo plano (NO BLOQUEANTE)
    this.initializeServicesBackground();

    // 8) Iniciar monitoreo de salud
    await this.startHealthMonitoring();

    const startupTime = Date.now() - this.startTime;
    logger.info('🎉 Servidor iniciado exitosamente', {
      category: 'SERVER_STARTED',
      startupTime: `${startupTime}ms`,
      port: this.PORT,
      environment: process.env.NODE_ENV || 'development'
    });

    return true;
  }

  /**
   * ✅ VALIDAR VARIABLES DE ENTORNO CRÍTICAS
   */
  validateEnvironmentVariables() {
    const criticalVars = {
      PORT: process.env.PORT,
      NODE_ENV: process.env.NODE_ENV,
      JWT_SECRET: process.env.JWT_SECRET ? '***SET***' : undefined
    };

    logger.info('Validación de variables de entorno críticas', {
      category: 'ENV_VALIDATION',
      criticalVars
    });

    // ⚠️ Advertencias por variables faltantes
    if (!process.env.JWT_SECRET) {
      logger.warn('JWT_SECRET no configurado', {
        category: 'ENV_VALIDATION',
        severity: 'HIGH',
        impact: 'Autenticación no funcionará'
      });
    }

    // ❌ Variables que YA NO necesitamos (para limpiar Railway)
    const deprecatedVars = ['REDIS_URL', 'REDISCLOUD_URL', 'RATE_LIMIT_REDIS'];
    deprecatedVars.forEach(varName => {
      if (process.env[varName]) {
        logger.warn('Variable obsoleta detectada', {
          category: 'ENV_VALIDATION',
          variableName: varName,
          recommendation: 'Se puede eliminar de Railway'
        });
      }
    });

    // ✅ Variables que SÍ necesitamos
    logger.info('Variables Railway requeridas validadas', {
      category: 'ENV_VALIDATION',
      requiredVars: ['PORT', 'NODE_ENV']
    });
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
   * 🚀 INICIALIZAR SERVICIOS EN SEGUNDO PLANO (NO BLOQUEANTE)
   */
  initializeServicesBackground() {
    // Inicializar servicios de forma asíncrona sin bloquear el servidor
    setImmediate(async () => {
      try {
        logger.info('🔄 Inicializando servicios en segundo plano...', {
          category: 'SERVICE_INIT_BACKGROUND'
        });
        
        // Inicializar servicios de colas (lazy loading)
        await this.initializeQueueServices();
        
        // Inicializar otros servicios existentes
        await this.initializeSocketIO();
        await this.initializeHealthChecks();
        
        logger.info('✅ Todos los servicios inicializados correctamente', {
          category: 'SERVICE_INIT_BACKGROUND_SUCCESS'
        });
      } catch (error) {
        logger.error('Error inicializando servicios en segundo plano', {
          category: 'SERVICE_INIT_BACKGROUND_ERROR',
          error: error.message,
          stack: error.stack
        });
        // No fallar la aplicación si algunos servicios no están disponibles
      }
    });
  }

  /**
   * 🗄️ INICIALIZAR SERVICIOS DE COLAS - LAZY LOADING
   */
  async initializeQueueServices() {
    try {
      // Lazy loading del servicio de colas
      if (!campaignQueueService) {
        campaignQueueService = require('./services/CampaignQueueService');
      }
      
      await campaignQueueService.initialize();
      logger.info('Servicios de colas inicializados correctamente', {
        category: 'QUEUE_SERVICE_INIT'
      });
    } catch (error) {
      logger.error('Error inicializando servicios de colas', {
        category: 'QUEUE_SERVICE_ERROR',
        error: error.message
      });
      // No fallar la aplicación si las colas no están disponibles
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
    cacheService.on('critical-alert', (alert) => {
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

    cacheService.on('warning-alert', (alert) => {
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
   * 🛡️ INICIALIZAR RATE LIMITING
   */
  async initializeRateLimit() {
    logger.info('🛡️ Inicializando sistema de rate limiting...', {
      category: 'RATE_LIMIT_INIT'
    });

    try {
      // Esperar a que el rate limit manager se inicialice
      await new Promise((resolve) => {
        if (rateLimitManager.isInitialized) {
          resolve();
        } else {
          const checkInterval = setInterval(() => {
            if (rateLimitManager.isInitialized) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        }
      });

      logger.info('✅ Sistema de rate limiting inicializado', {
        category: 'RATE_LIMIT_SUCCESS',
        store: rateLimitManager.usingRedis ? 'Redis' : 'Memory'
      });

    } catch (error) {
      logger.error('Error inicializando rate limiting', {
        category: 'RATE_LIMIT_ERROR',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🏥 INICIALIZAR HEALTH CHECKS
   */
  async initializeHealthChecks() {
    logger.info('🏥 Inicializando health checks con Circuit Breaker...', {
        category: 'HEALTH_INIT'
    });
    // El nuevo servicio no necesita await aquí, se inicializa en segundo plano
    this.healthService = getHealthCheckService();
    this.healthService.initialize();
}

  /**
   * 🛡️ CONFIGURAR MIDDLEWARES BÁSICOS
   */
  setupBasicMiddleware() {
    const { applyBasicMiddlewares } = require('./config/middleware');
    applyBasicMiddlewares(this.app);
  }

  /**
   * 🛡️ CONFIGURAR RATE LIMITING EN RUTAS
   */
  setupRateLimiting() {
    logger.info('🛡️ Configurando rate limiting en rutas...', {
      category: 'RATE_LIMIT_SETUP'
    });

    // Importar el nuevo middleware de rate limiting de conversaciones
    const { applyConversationRateLimiting } = require('./middleware/conversationRateLimit');

    // Rate limiting general para todas las rutas
    this.app.use('/api', rateLimitManager.createGeneralLimiter());

    // Rate limiting específico para conversaciones (más inteligente)
    this.app.use('/api/conversations', applyConversationRateLimiting);
    this.app.use('/api/messages', applyConversationRateLimiting);

    // Rate limiting específico para login
    this.app.use('/api/auth/login', rateLimitManager.createLoginLimiter());

    // Slow down para endpoints pesados
    this.app.use('/api/media', rateLimitManager.createSlowDown());
    this.app.use('/api/campaigns', rateLimitManager.createSlowDown());

    logger.info('✅ Rate limiting configurado en rutas', {
      category: 'RATE_LIMIT_SETUP_SUCCESS',
      protectedRoutes: ['/api/*', '/api/conversations', '/api/messages', '/api/auth/login', '/api/media', '/api/campaigns']
    });
  }

  /**
   * 🔒 CONFIGURACIÓN CORS SEGURA Y CENTRALIZADA
   */
  setupCORS() {
    // CORS ya configurado en config/middleware.js
    logger.info('✅ CORS configurado en middleware centralizado', {
      category: 'CORS_SETUP_SUCCESS',
      environment: process.env.NODE_ENV || 'development'
    });
  }

  /**
   * 🛣️ CONFIGURAR RUTAS
   */
  setupRoutes() {
    const { registerRoutes } = require('./config/routes');
    registerRoutes(this.app, { PORT: this.PORT, socketManager: this.socketManager, healthService: this.healthService });
  }

  /**
   * 🛡️ CONFIGURAR MANEJO DE ERRORES MEJORADO
   */
  setupErrorHandling() {
    try {
      // Importar el middleware de manejo de errores mejorado
      const EnhancedErrorHandler = require('./middleware/enhancedErrorHandler');

      // Configurar manejo de promesas rechazadas
      process.on('unhandledRejection', (reason, promise) => {
        logger.error('❌ Promesa rechazada no manejada', {
          category: 'UNHANDLED_REJECTION',
          reason: reason?.message || reason,
          stack: reason?.stack,
          promise: promise?.toString()
        });
      });

      // Middleware de manejo de errores mejorado
      this.app.use(EnhancedErrorHandler.handleError);

      // Middleware para rutas no encontradas
      this.app.use('*', EnhancedErrorHandler.handleNotFound);

      logger.info('✅ Manejo de errores mejorado configurado', {
        category: 'ERROR_HANDLING_SETUP_SUCCESS'
      });
    } catch (error) {
      logger.error('❌ Error configurando manejo de errores', {
        category: 'ERROR_HANDLING_SETUP_FAILURE',
        error: error.message,
        stack: error.stack
      });
      
      // Fallback: middleware de errores básico
      this.app.use((err, req, res, next) => {
        if (!res.headersSent) {
          return res.status(500).json({
            success: false,
            error: {
              type: 'INTERNAL_SERVER_ERROR',
              message: 'Error interno del servidor'
            }
          });
        }
      });
    }
  }

  /**
   * 🔌 INICIALIZAR SOCKET.IO
   */
  initializeSocketIO() {
    if (this.socketManager) {
      // Ya inicializado (idempotente)
      logger.info('🔌 Socket.IO ya inicializado, reutilizando...', {
        category: 'SOCKET_REUSE'
      });
      return this.socketManager;
    }

    logger.info('🔌 Inicializando Socket.IO enterprise...', {
      category: 'SOCKET_INIT'
    });

    // Importar clase y accessor
    const { EnterpriseSocketManager } = require('./socket/enterpriseSocketManager');
    const socketIndex = require('./socket');
    
    // Log de diagnóstico de imports
    logger.debug('Socket exports detectados', {
      category: 'SOCKET_BOOT',
      exports: Object.keys(require('./socket/enterpriseSocketManager'))
    });

    // Verificar que el server esté creado
    if (!this.server) {
      throw new Error('HTTP server must be created before initializing Socket.IO');
    }

    // Inyectar dependencias para romper ciclos
    let User = null;
    let Conversation = null;
    let Message = null;
    
    try {
      User = require('./models/User');
      Conversation = require('./models/Conversation');
      Message = require('./models/Message');
    } catch (error) {
      logger.warn('Models no disponibles para Socket.IO', {
        category: 'SOCKET_MODELS_WARNING',
        reason: 'Firebase no configurado',
        error: error.message
      });
    }

    // Instanciar el manager con dependencias inyectadas
    const mgr = new EnterpriseSocketManager(this.server, { User, Conversation, Message });

    // Registrar para accesos globales (MessageService, controllers, etc.)
    socketIndex.setSocketManager(mgr);
    this.app.set('socketManager', mgr);
    this.socketManager = mgr;

    // Log claro de éxito
    logger.info('SOCKETS:READY', {
      hasServer: !!this.server,
      hasManager: !!this.socketManager,
      category: 'SOCKET_SUCCESS',
      memoryManaged: true,
      maxConnections: 50000
    });

    // Log de diagnóstico
    logger.debug('Socket manager configurado', {
      category: 'SOCKET_BOOT',
      managerType: typeof this.socketManager,
      managerName: this.socketManager?.constructor?.name
    });

    return this.socketManager;
  }

  /**
   * 🎯 INICIAR SERVIDOR
   */
  async startServer() {
    return new Promise((resolve, reject) => {
      // ✅ CRÍTICO: Railway requiere '0.0.0.0' para enrutamiento externo
      this.server.listen(this.PORT, '0.0.0.0', (error) => {
        if (error) {
          logger.error('Error iniciando servidor HTTP', {
            category: 'SERVER_START_ERROR',
            error: error.message,
            stack: error.stack,
            port: this.PORT,
            host: '0.0.0.0'
          });
          reject(error);
          return;
        }

        // ✅ LOG CRÍTICO: Confirmar binding correcto
        logger.info('🎉 Servidor HTTP iniciado en 0.0.0.0 - RAILWAY READY', {
          category: 'SERVER_STARTED',
          port: this.PORT,
          host: '0.0.0.0',
          environment: process.env.NODE_ENV || 'development',
          startupTime: Date.now() - this.startTime + 'ms',
          memoryUsage: process.memoryUsage(),
          pid: process.pid,
          address: this.server.address(),
          railwayReady: true
        });

        // 🕐 Tarea programada de asistencia automática removida - sistema de asistencia eliminado


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
   * 🏥 INICIAR MONITOREO DE SALUD
   */
  async startHealthMonitoring() {
    logger.info('🏥 Iniciando monitoreo de salud enterprise...', {
      category: 'HEALTH_MONITORING_START'
    });

    // El HealthCheckService ya tiene su propio monitoreo automático
    // Aquí podemos agregar métricas adicionales o alertas

    logger.info('✅ Monitoreo de salud enterprise iniciado', {
      category: 'HEALTH_MONITORING_SUCCESS'
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

    logger.info('🛑 Iniciando graceful shutdown enterprise...', {
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

      // 3. Persistir datos de rate limiting
      if (rateLimitManager) {
        try {
          await rateLimitManager.persistMemoryStore();
          await rateLimitManager.close();
          logger.info('✅ Rate limiting persistido y cerrado', {
            category: 'SHUTDOWN_RATE_LIMIT_CLOSED'
          });
        } catch (rateLimitError) {
          logger.error('Error cerrando rate limiting', {
            category: 'SHUTDOWN_RATE_LIMIT_ERROR',
            error: rateLimitError.message
          });
        }
      }

      // 4. Detener HealthCheckService
      if (this.healthService) {
        this.healthService.shutdown();
        logger.info('✅ Health service detenido', { category: 'SHUTDOWN_HEALTH_STOPPED' });
      }

      // 5. Limpiar cache service
      if (cacheService) {
        try {
          logger.info('✅ Cache service cleanup iniciado', {
            category: 'SHUTDOWN_CACHE_CLEANUP'
          });
          await cacheService.shutdown();
          logger.info('✅ Cache service cerrado exitosamente', {
            category: 'SHUTDOWN_CACHE_CLOSED'
          });
        } catch (cacheError) {
          logger.error('Error cerrando cache service', {
            category: 'SHUTDOWN_CACHE_ERROR',
            error: cacheError.message
          });
        }
      }

      // 6. Forzar garbage collection final
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

      logger.info('✅ Graceful shutdown enterprise completado exitosamente', {
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

// Solo inicializar si no estamos en test
if (require.main === module) {
  const server = new ConsolidatedServer();
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

module.exports = { ConsolidatedServer };
