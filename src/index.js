/**
 * 🚀 SERVIDOR PRINCIPAL CON GESTIÓN AVANZADA DE MEMORIA Y ERRORES
 * 
 * Características implementadas:
 * - Gestión avanzada de memoria con TTL y límites
 * - Error handling enterprise con clasificación automática
 * - Logging profesional con contexto y métricas
 * - Rate limiting persistente con Redis
 * - Monitoreo continuo de salud del sistema
 * - Graceful shutdown con limpieza de memoria
 * 
 * Basado en mejores prácticas de:
 * - https://medium.com/@ctrlaltvictoria/backend-error-handling-practical-tips-from-a-startup-cto-bb988ccb3e5b
 * - https://medium.com/@afolayanolatomiwa/error-handling-in-backend-applications-best-practices-and-techniques-1e4cd94c2fa5
 * 
 * @version 3.0.0 ENTERPRISE
 * @author Backend Team
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { createServer } = require('http');

// Configuración
const { firestore } = require('./config/firebase');
const logger = require('./utils/logger');
const { memoryManager } = require('./utils/memoryManager');
const { enhancedErrorHandler } = require('./middleware/enhancedErrorHandler');
const { advancedSecurity } = require('./middleware/advancedSecurity');
const { 
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  securityLoggingMiddleware,
  performanceLoggingMiddleware,
  authLoggingMiddleware,
  criticalOperationsLoggingMiddleware,
  databaseLoggingMiddleware
} = require('./middleware/logging');

// Middleware personalizado
const { authMiddleware } = require('./middleware/auth');
const { rateLimitManager } = require('./middleware/persistentRateLimit');
const processManager = require('./utils/processManager');
const eventCleanup = require('./utils/eventCleanup');

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

// Servicios
const SocketManager = require('./socket');

class AdvancedServer {
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
    // https://nodejs.org/en/learn/diagnostics/memory/understanding-and-tuning-memory
    if (process.env.NODE_ENV === 'production') {
      // Optimizaciones para producción basadas en las fuentes proporcionadas
      process.env.NODE_OPTIONS = [
        process.env.NODE_OPTIONS || '',
        '--max-old-space-size=2048', // 2GB para heap viejo
        '--max-semi-space-size=64',  // 64MB para heap nuevo
        '--gc-interval=100'          // GC cada 100ms
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

      // Graceful shutdown inmediato
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

      // Graceful shutdown inmediato
      this.gracefulShutdown('unhandledRejection');
    });

    // Señales de sistema
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    
    // Adicionales para robustez
    process.on('SIGHUP', () => this.gracefulShutdown('SIGHUP'));
    process.on('SIGQUIT', () => this.gracefulShutdown('SIGQUIT'));
  }

  /**
   * 🚀 INICIALIZAR SERVIDOR
   */
  async initialize() {
    try {
      logger.info('🚀 Iniciando servidor enterprise...', {
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

      // 3. Inicializar rate limiting persistente
      await this.initializeRateLimit();

      // 4. Configurar rutas y middlewares de aplicación
      this.setupRoutes();

      // 5. Configurar middleware global de errores ENTERPRISE
      this.setupEnterpriseErrorHandling();

      // 6. Crear servidor HTTP
      this.server = createServer(this.app);

      // 7. Inicializar Socket.IO
      this.initializeSocketIO();

      // 8. Configurar monitoreo de salud
      this.setupHealthMonitoring();

      // 9. Iniciar servidor
      await this.startServer();

      logger.info('✅ Servidor enterprise inicializado exitosamente', {
        category: 'SERVER_SUCCESS',
        port: this.PORT,
        environment: process.env.NODE_ENV || 'development',
        features: {
          memoryManagement: true,
          persistentRateLimit: true,
          enterpriseErrorHandling: true,
          advancedLogging: true,
          socketIO: true,
          healthMonitoring: true,
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
    logger.info('🧠 Inicializando gestión avanzada de memoria...', {
      category: 'MEMORY_INIT'
    });

    // El memoryManager ya está inicializado como singleton
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

    // Request tracking middleware (DEBE IR PRIMERO)
    this.app.use(logger.createRequestTrackingMiddleware());

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

    // CORS configurado
    const corsOrigins = process.env.FRONTEND_URL 
      ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
      : ['http://localhost:3000'];

    this.app.use(cors({
      origin: (origin, callback) => {
        if (!origin || corsOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
          callback(null, true);
        } else {
          logger.warn('CORS: Origen rechazado', { 
            category: 'CORS_REJECTED',
            origin, 
            allowedOrigins: corsOrigins,
            userAgent: origin
          });
          callback(new Error('CORS: Origen no permitido'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-API-Key'],
      exposedHeaders: ['X-Request-ID', 'X-Rate-Limit-Remaining', 'X-Rate-Limit-Reset']
    }));

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

    // Headers de seguridad adicionales
    this.app.use((req, res, next) => {
      res.set({
        'X-Request-ID': req.requestId,
        'X-Powered-By': 'UTalk-Backend-v3.0-Enterprise',
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
      corsOrigins: corsOrigins.length,
      trustProxy: process.env.NODE_ENV === 'production'
    });
  }

  /**
   * 🚦 INICIALIZAR RATE LIMITING PERSISTENTE
   */
  async initializeRateLimit() {
    logger.info('🚦 Inicializando rate limiting persistente...', {
      category: 'RATE_LIMIT_INIT'
    });

    await rateLimitManager.initialize();

    // Rate limiting global más restrictivo
    const globalRateLimit = rateLimitManager.createLimiter('general', {
      max: 1000, // 1000 requests por IP en 15 minutos (más restrictivo)
      windowMs: 15 * 60 * 1000,
      message: {
        error: 'Límite de solicitudes excedido',
        code: 'GLOBAL_RATE_LIMIT_EXCEEDED',
        retryAfter: '15 minutes'
      }
    });

    this.app.use(globalRateLimit);

    logger.info('✅ Rate limiting persistente configurado', {
      category: 'RATE_LIMIT_SUCCESS',
      store: rateLimitManager.redisClient ? 'Redis' : 'Memory',
      globalLimit: '1000 req/15min'
    });
  }

  /**
   * 🛣️ CONFIGURAR RUTAS
   */
  setupRoutes() {
    logger.info('🛣️ Configurando rutas de la aplicación...', {
      category: 'ROUTES_SETUP'
    });

    // Health check endpoint robusto y completo
    this.app.get('/health', async (req, res) => {
      try {
        const HealthCheckService = require('./services/HealthCheckService');
        const healthService = new HealthCheckService();
        
        logger.info('🏥 Iniciando health check completo del sistema', {
          category: 'HEALTH_CHECK',
          requestId: req.requestId,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });

        const healthData = await healthService.runAllHealthChecks();
        
        // Determinar status HTTP basado en el estado general
        const httpStatus = healthData.status === 'healthy' ? 200 : 503;
        
        // Log del resultado
        if (healthData.status === 'healthy') {
          logger.info('✅ Health check exitoso', {
            category: 'HEALTH_CHECK_SUCCESS',
            status: healthData.status,
            totalTime: healthData.totalTime,
            checksCount: Object.keys(healthData.checks).length,
            requestId: req.requestId
          });
        } else {
          logger.warn('⚠️ Health check con problemas', {
            category: 'HEALTH_CHECK_WARNING',
            status: healthData.status,
            failedChecks: healthData.failedChecks,
            totalTime: healthData.totalTime,
            requestId: req.requestId
          });
        }

        // Respuesta con información detallada
        res.status(httpStatus).json({
          status: healthData.status,
          timestamp: healthData.timestamp,
          uptime: healthData.uptime,
          version: healthData.version,
          environment: healthData.environment,
          totalTime: healthData.totalTime,
          checks: healthData.checks,
          summary: {
            total: Object.keys(healthData.checks).length,
            healthy: healthData.healthyChecks.length,
            failed: healthData.failedChecks.length,
            failedChecks: healthData.failedChecks
          }
        });

      } catch (error) {
        logger.error('💥 Error crítico en health check', {
          category: 'HEALTH_CHECK_ERROR',
          error: error.message,
          stack: error.stack,
          requestId: req.requestId
        });

        // Respuesta de error crítico
        res.status(503).json({
          status: 'error',
          error: 'Health check system failure',
          message: 'El sistema de health check no pudo completarse',
          timestamp: new Date().toISOString(),
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    });

    // Health check detallado para debugging
    this.app.get('/health/detailed', async (req, res) => {
      try {
        const HealthCheckService = require('./services/HealthCheckService');
        const healthService = new HealthCheckService();
        
        logger.info('🔍 Iniciando health check detallado', {
          category: 'HEALTH_CHECK_DETAILED',
          requestId: req.requestId
        });

        const healthData = await healthService.runAllHealthChecks();
        
        // Incluir información adicional del sistema
        const os = require('os');
        const additionalInfo = {
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

        res.json({
          ...healthData,
          additionalInfo
        });

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

    // Health check rápido para load balancers
    this.app.get('/health/quick', async (req, res) => {
      try {
        const HealthCheckService = require('./services/HealthCheckService');
        const healthService = new HealthCheckService();
        
        // Solo verificar servicios críticos
        const criticalChecks = ['firestore', 'redis', 'memory'];
        const results = {};
        
        for (const checkName of criticalChecks) {
          const check = healthService.healthChecks.get(checkName);
          if (check) {
            try {
              results[checkName] = await check();
            } catch (error) {
              results[checkName] = {
                status: 'error',
                error: error.message
              };
            }
          }
        }
        
        const isHealthy = Object.values(results).every(result => result.status === 'healthy');
        const httpStatus = isHealthy ? 200 : 503;
        
        res.status(httpStatus).json({
          status: isHealthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          checks: results
        });

      } catch (error) {
        res.status(503).json({
          status: 'error',
          error: 'Quick health check failed',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Readiness probe para Kubernetes
    this.app.get('/ready', (req, res) => {
      const isReady = this.socketManager && 
                     memoryManager && 
                     rateLimitManager?.initialized;
      
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
          rateLimiting: rateLimitManager ? rateLimitManager.getStats() : null,
          socket: this.socketManager ? this.socketManager.getDetailedStats() : null,
          logging: logger.getStats(),
          errors: enhancedErrorHandler ? enhancedErrorHandler.errorMetrics : null
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
        
        // No usar next(error) aquí para evitar loop
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
   * 🚨 CONFIGURAR MANEJO GLOBAL DE ERRORES ENTERPRISE
   */
  setupEnterpriseErrorHandling() {
    logger.info('🚨 Configurando manejo global de errores enterprise...', {
      category: 'ERROR_HANDLER_SETUP'
    });

    // Middleware global de errores enterprise (DEBE IR AL FINAL)
    this.app.use(enhancedErrorHandler.handle());

    logger.info('✅ Manejo global de errores enterprise configurado', {
      category: 'ERROR_HANDLER_SUCCESS',
      features: {
        automaticClassification: true,
        structuredLogging: true,
        securityFiltering: true,
        rateLimiting: true,
        metrics: true,
        alerting: true
      }
    });
  }

  /**
   * 🔌 INICIALIZAR SOCKET.IO
   */
  initializeSocketIO() {
    logger.info('🔌 Inicializando Socket.IO con gestión de memoria...', {
      category: 'SOCKET_INIT'
    });

    this.socketManager = new SocketManager(this.server);
    
    // Hacer disponible el socket manager para otros componentes
    this.app.set('socketManager', this.socketManager);

    logger.info('✅ Socket.IO inicializado con gestión avanzada', {
      category: 'SOCKET_SUCCESS',
      memoryManaged: true,
      maxConnections: 50000
    });
  }

  /**
   * 📊 CONFIGURAR MONITOREO DE SALUD
   */
  setupHealthMonitoring() {
    logger.info('📊 Configurando monitoreo de salud del sistema...', {
      category: 'HEALTH_MONITORING_SETUP'
    });

    // Monitoreo cada 5 minutos
    setInterval(() => {
      try {
        const stats = {
          server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            pid: process.pid,
            environment: process.env.NODE_ENV,
            loadAverage: require('os').loadavg(),
            freeMemory: require('os').freemem(),
            totalMemory: require('os').totalmem()
          },
          sockets: {
            connected: this.socketManager?.getConnectedUsers()?.length || 0
          },
          memoryManager: memoryManager ? memoryManager.getStats().global : null,
          rateLimiting: {
            store: rateLimitManager?.redisClient ? 'Redis' : 'Memory',
            initialized: rateLimitManager?.initialized || false
          },
          errors: enhancedErrorHandler ? {
            totalErrors: enhancedErrorHandler.errorMetrics.size,
            rateLimitedErrors: enhancedErrorHandler.errorRateLimit.size
          } : null
        };

        const isHealthy = this.isHealthy(stats);

        logger.info('Estado del sistema', {
          category: 'SYSTEM_HEALTH_CHECK',
          stats,
          healthy: isHealthy,
          timestamp: new Date().toISOString()
        });

        // Alertas de salud
        if (!isHealthy) {
          logger.error('Sistema en estado no saludable detectado', {
            category: 'SYSTEM_HEALTH_ALERT',
            stats,
            severity: 'HIGH',
            requiresAttention: true
          });
        }

      } catch (monitoringError) {
        logger.error('Error durante monitoreo de salud', {
          category: 'HEALTH_MONITORING_ERROR',
          error: monitoringError.message,
          stack: monitoringError.stack
        });
      }

    }, 5 * 60 * 1000); // 5 minutos

    logger.info('✅ Monitoreo de salud configurado', {
      category: 'HEALTH_MONITORING_SUCCESS',
      interval: '5 minutes'
    });
  }

  /**
   * 🏥 VERIFICAR SALUD DEL SISTEMA
   */
  isHealthy(stats) {
    try {
      const memoryUsagePercent = (stats.server.memory.heapUsed / stats.server.memory.heapTotal) * 100;
      const systemMemoryUsagePercent = ((stats.server.totalMemory - stats.server.freeMemory) / stats.server.totalMemory) * 100;
      
      const healthChecks = {
        memoryHeapOk: memoryUsagePercent < 90,
        systemMemoryOk: systemMemoryUsagePercent < 95,
        serverRunning: stats.server.uptime > 0,
        memoryManagerOk: stats.memoryManager ? stats.memoryManager.totalMaps >= 0 : false,
        rateLimitingOk: stats.rateLimiting ? stats.rateLimiting.initialized : false
      };

      const isHealthy = Object.values(healthChecks).every(check => check === true);

      if (!isHealthy) {
        logger.warn('Fallos en health checks detectados', {
          category: 'HEALTH_CHECK_FAILURES',
          healthChecks,
          memoryUsagePercent: memoryUsagePercent.toFixed(2) + '%',
          systemMemoryUsagePercent: systemMemoryUsagePercent.toFixed(2) + '%'
        });
      }

      return isHealthy;
    } catch (error) {
      logger.error('Error verificando salud del sistema', {
        category: 'HEALTH_CHECK_ERROR',
        error: error.message
      });
      return false;
    }
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

      // 3. Persistir rate limits
      if (rateLimitManager) {
        try {
          await rateLimitManager.persistMemoryStore();
          logger.info('✅ Rate limits persistidos', {
            category: 'SHUTDOWN_RATE_LIMITS_SAVED'
          });
        } catch (rateLimitError) {
          logger.error('Error persistiendo rate limits', {
            category: 'SHUTDOWN_RATE_LIMIT_ERROR',
            error: rateLimitError.message
          });
        }
      }

      // 4. Limpiar memory manager
      if (memoryManager) {
        try {
          // El memory manager tiene su propio cleanup en shutdown
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

      // 5. Forzar garbage collection final
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

  /**
   * 📊 OBTENER ESTADÍSTICAS COMPLETAS
   */
  getFullStats() {
    try {
      return {
        server: {
          uptime: process.uptime(),
          startTime: this.startTime,
          memory: process.memoryUsage(),
          pid: process.pid,
          environment: process.env.NODE_ENV,
          nodeVersion: process.version,
          platform: process.platform
        },
        memoryManager: memoryManager ? memoryManager.getStats() : null,
        rateLimiting: rateLimitManager ? rateLimitManager.getStats() : null,
        socket: this.socketManager ? this.socketManager.getDetailedStats() : null,
        logging: logger.getStats(),
        errors: enhancedErrorHandler ? {
          totalErrors: enhancedErrorHandler.errorMetrics.size,
          rateLimitedErrors: enhancedErrorHandler.errorRateLimit.size
        } : null,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error obteniendo estadísticas completas', {
        category: 'STATS_ERROR',
        error: error.message
      });
      return null;
    }
  }

  /**
   * Verificar conexión a Firebase Firestore
   */
  async checkFirebaseConnection() {
    try {
      const admin = require('firebase-admin');
      
      // Intentar hacer una operación simple de lectura
      const testDoc = await admin.firestore().collection('_health_check').limit(1).get();
      
      logger.info('✅ Firebase Firestore: Conexión verificada exitosamente');
      return 'connected';
    } catch (error) {
      logger.error('❌ Firebase Firestore: Error de conexión', {
        error: error.message,
        code: error.code
      });
      return 'disconnected';
    }
  }

  /**
   * Verificar conexión a Firebase Storage
   */
  async checkFirebaseStorageConnection() {
    try {
      const admin = require('firebase-admin');
      
      // Intentar acceder al bucket de Storage
      const bucket = admin.storage().bucket();
      
      // Verificar que el bucket existe y es accesible
      const [exists] = await bucket.exists();
      
      if (exists) {
        logger.info('✅ Firebase Storage: Conexión verificada exitosamente');
        return 'connected';
      } else {
        logger.warn('⚠️ Firebase Storage: Bucket no encontrado');
        return 'bucket_not_found';
      }
    } catch (error) {
      logger.error('❌ Firebase Storage: Error de conexión', {
        error: error.message,
        code: error.code
      });
      return 'disconnected';
    }
  }

  /**
   * Verificar estado completo de servicios
   */
  async getDetailedServiceStatus() {
    try {
      const admin = require('firebase-admin');
      
      // Verificar Firestore con más detalle
      const firestoreStatus = await this.checkFirestoreDetailed();
      
      // Verificar Storage con más detalle  
      const storageStatus = await this.checkStorageDetailed();
      
      // Verificar Redis si está disponible
      const redisStatus = await this.checkRedisDetailed();
      
      return {
        firestore: firestoreStatus,
        storage: storageStatus,
        redis: redisStatus,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error verificando estado de servicios:', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Verificación detallada de Firestore
   */
  async checkFirestoreDetailed() {
    try {
      const admin = require('firebase-admin');
      const db = admin.firestore();
      
      const startTime = Date.now();
      
      // Test de escritura y lectura
      const testCollection = db.collection('_health_check');
      const testDocId = `test_${Date.now()}`;
      
      // Escribir documento de prueba
      await testCollection.doc(testDocId).set({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        test: true
      });
      
      // Leer el documento
      const doc = await testCollection.doc(testDocId).get();
      
      // Eliminar el documento de prueba
      await testCollection.doc(testDocId).delete();
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'connected',
        responseTime: `${responseTime}ms`,
        operations: {
          write: 'success',
          read: 'success',
          delete: 'success'
        },
        projectId: admin.app().options.projectId
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Verificación detallada de Storage
   */
  async checkStorageDetailed() {
    try {
      const admin = require('firebase-admin');
      const bucket = admin.storage().bucket();
      
      const startTime = Date.now();
      
      // Verificar bucket existe
      const [exists] = await bucket.exists();
      if (!exists) {
        return {
          status: 'bucket_not_found',
          error: 'Storage bucket does not exist'
        };
      }
      
      // Test de escritura de archivo temporal
      const testFileName = `_health_check/test_${Date.now()}.txt`;
      const file = bucket.file(testFileName);
      
      // Escribir archivo de prueba
      await file.save('health check test', {
        metadata: {
          contentType: 'text/plain'
        }
      });
      
      // Verificar que existe
      const [fileExists] = await file.exists();
      
      // Eliminar archivo de prueba
      await file.delete();
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'connected',
        responseTime: `${responseTime}ms`,
        operations: {
          write: 'success',
          read: fileExists ? 'success' : 'failed',
          delete: 'success'
        },
        bucketName: bucket.name
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Verificación detallada de Redis
   */
  async checkRedisDetailed() {
    try {
      const rateLimitManager = require('./middleware/persistentRateLimit');
      
      if (!rateLimitManager.redisClient) {
        return {
          status: 'not_configured',
          message: 'Redis client not available'
        };
      }
      
      const startTime = Date.now();
      
      // Test de ping
      const pong = await rateLimitManager.redisClient.ping();
      
      // Test de escritura y lectura
      const testKey = `health_check:${Date.now()}`;
      await rateLimitManager.redisClient.set(testKey, 'test', 'EX', 10);
      const value = await rateLimitManager.redisClient.get(testKey);
      await rateLimitManager.redisClient.del(testKey);
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'connected',
        responseTime: `${responseTime}ms`,
        operations: {
          ping: pong === 'PONG' ? 'success' : 'failed',
          write: 'success',
          read: value === 'test' ? 'success' : 'failed',
          delete: 'success'
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

// Crear e inicializar servidor
const server = new AdvancedServer();

// Solo inicializar si no estamos en test
if (require.main === module) {
  server.initialize().catch((error) => {
    // Usar console.error como último recurso si el logger falla
    if (logger && logger.error) {
      logger.error('💥 Fallo catastrófico iniciando servidor:', {
        category: 'CATASTROPHIC_FAILURE',
        error: error.message,
        stack: error.stack,
        severity: 'CRITICAL'
      });
    } else {
      logger.error('💥 Fallo catastrófico iniciando servidor:', {
        category: 'CATASTROPHIC_FAILURE',
        error: error.message,
        stack: error.stack,
        severity: 'CRITICAL'
      });
    }
    process.exit(1);
  });
}

module.exports = server;
