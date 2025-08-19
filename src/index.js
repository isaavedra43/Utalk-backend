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
 * - Rate Limiting persistente
 * - Health Checks enterprise
 * - Graceful shutdown
 * 
 * @version 4.1.0 ENTERPRISE RESTORED
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
const { rateLimitManager } = require('./middleware/persistentRateLimit');
const { getHealthCheckService } = require('./services/HealthCheckService'); // Ahora importa la nueva versión

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

// Importar servicios de colas
const campaignQueueService = require('./services/CampaignQueueService');

class ConsolidatedServer {
  constructor() {
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
    
    // Usar PORT de Railway o fallback a 3001
    this.PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
    
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
   * 🚀 INICIALIZACIÓN ORQUESTADA DEL SERVIDOR
   * Método requerido por el entrypoint. Crea el servidor HTTP,
   * configura middlewares, rutas, servicios y health checks.
   */
  async initialize() {
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

    // 6) Inicializar servicios (Socket, Health, Colas, etc.)
    await this.initializeServices();

    // 7) Arrancar servidor HTTP
    await this.startServer();

    // 8) Iniciar monitoreo de salud
    await this.startHealthMonitoring();

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
   * 🚀 INICIALIZAR SERVICIOS
   */
  async initializeServices() {
    try {
      logger.info('Inicializando servicios del servidor', {
        category: 'SERVICE_INIT'
      });
      
      // Inicializar servicios de colas
      await this.initializeQueueServices();
      
      // Inicializar otros servicios existentes
      await this.initializeSocketIO();
      await this.initializeHealthChecks();
      
      logger.info('Todos los servicios inicializados correctamente', {
        category: 'SERVICE_INIT',
        status: 'success'
      });
    } catch (error) {
      logger.error('Error inicializando servicios', {
        category: 'SERVICE_INIT_ERROR',
        error: error.message,
        stack: error.stack
      });
      // No fallar la aplicación si algunos servicios no están disponibles
    }
  }

  /**
   * 🗄️ INICIALIZAR SERVICIOS DE COLAS
   */
  async initializeQueueServices() {
    try {
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

    // 🔍 MIDDLEWARE DE CORRELACIÓN (requestId/traceId)
    this.app.use(correlationMiddleware);

    // Headers de seguridad adicionales
    this.app.use((req, res, next) => {
      res.set({
        'X-Powered-By': 'UTalk-Backend-v4.1-Enterprise',
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
    const { corsOptions } = require('./config/cors');
    
    // ✅ CRÍTICO: CORS global (ANTES de rutas) - SOLO Express CORS
    this.app.use(cors(corsOptions));
    
    // ✅ CRÍTICO: Respuesta a preflight para cualquier ruta - SOLO Express CORS
    this.app.options('*', cors(corsOptions));
    
    logger.info('✅ CORS configurado con Express CORS robusto', {
      category: 'CORS_SETUP_SUCCESS',
      environment: process.env.NODE_ENV || 'development'
    });
  }



  /**
   * 🛣️ CONFIGURAR RUTAS
   */
  setupRoutes() {
    logger.info('🛣️ Configurando rutas de la aplicación...', {
      category: 'ROUTES_SETUP'
    });

    try {
      // ✅ TIP 1: Endpoint de diagnósticos de servicios
      this.app.get('/diagnostics', (req, res) => {
        const healthService = getHealthCheckService();
        const diagnostics = {
          server: 'running',
          timestamp: new Date().toISOString(),
          services: {
            memoryManager: !!memoryManager,
            healthService: !!this.healthService,
            rateLimiting: 'disabled',
            socketManager: !!this.socketManager
          },
          environment: process.env.NODE_ENV || 'development',
          port: this.PORT,
          uptime: process.uptime(),
          healthStatus: healthService.getHealthStatus() // Estado detallado
        };
        res.json(diagnostics);
      });
      logger.debug('Endpoint configurado', {
        category: 'ENDPOINT_SETUP',
        endpoint: '/diagnostics'
      });

      // ✅ TIP 1: Endpoint para verificar variables de entorno (seguro)
      this.app.get('/env-check', (req, res) => {
        const envStatus = {
          PORT: !!process.env.PORT,
          NODE_ENV: process.env.NODE_ENV || 'not_set',
          JWT_SECRET: !!process.env.JWT_SECRET,
          CORS_ORIGINS: !!process.env.CORS_ORIGINS,
          // Variables obsoletas
          deprecated: {
            REDIS_URL: !!process.env.REDIS_URL,
            REDISCLOUD_URL: !!process.env.REDISCLOUD_URL
          }
        };
        res.json(envStatus);
      });
      logger.debug('Endpoint configurado', {
        category: 'ENDPOINT_SETUP',
        endpoint: '/env-check'
      });

      // HEALTH CHECK MEJORADO - Para liveness/readiness probes
      this.app.get('/health', (req, res) => {
        const healthService = getHealthCheckService();
        const health = healthService.getSimpleHealthCheck();
        
        // Log para Railway diagnostics
        logger.debug('Health check solicitado', {
          category: 'HEALTH_CHECK',
          clientIp: req.ip,
          status: health.status
        });
        
        res.status(health.statusCode).json(health);
      });
      logger.debug('Endpoint configurado', {
        category: 'ENDPOINT_SETUP',
        endpoint: '/health'
      });

      // ✅ TIP 1: Endpoint específico para verificar conectividad desde Vercel
      this.app.get('/ping', (req, res) => {
        logger.debug('Ping recibido', {
          category: 'PING_REQUEST',
          clientIp: req.ip,
          origin: req.headers.origin
        });
        res.status(200).json({
          pong: true,
          timestamp: new Date().toISOString(),
          from: req.ip,
          origin: req.headers.origin
        });
      });
      logger.debug('Endpoint configurado', {
        category: 'ENDPOINT_SETUP',
        endpoint: '/ping'
      });

      // ✅ CRÍTICO: Endpoint específico para probar CORS
      this.app.get('/cors-test', (req, res) => {
        logger.debug('CORS Test solicitado', {
          category: 'CORS_TEST',
          clientIp: req.ip,
          origin: req.headers.origin
        });
        res.status(200).json({
          corsTest: true,
          timestamp: new Date().toISOString(),
          origin: req.headers.origin,
          headers: req.headers,
          message: 'CORS está funcionando correctamente',
          serverInfo: {
            environment: process.env.NODE_ENV || 'development',
            corsConfigured: true,
            staticWhitelist: require('./config/cors').STATIC_WHITELIST,
            regexWhitelist: require('./config/cors').REGEX_WHITELIST.map(r => r.toString())
          }
        });
      });
      logger.debug('Endpoint configurado', {
        category: 'ENDPOINT_SETUP',
        endpoint: '/cors-test'
      });

      // ✅ SUPER ROBUSTO: Endpoint para probar OPTIONS preflight
      this.app.options('/cors-test', (req, res) => {
        logger.debug('OPTIONS preflight test', {
          category: 'CORS_PREFLIGHT',
          endpoint: '/cors-test'
        });
        res.status(204).end();
      });
      logger.debug('Endpoint configurado', {
        category: 'ENDPOINT_SETUP',
        endpoint: 'OPTIONS /cors-test'
      });

      // ✅ CRÍTICO: Endpoint específico para login test
      this.app.get('/login-test', (req, res) => {
        logger.debug('Login Test solicitado', {
          category: 'LOGIN_TEST',
          clientIp: req.ip,
          origin: req.headers.origin
        });
        res.status(200).json({
          loginTest: true,
          timestamp: new Date().toISOString(),
          origin: req.headers.origin,
          message: 'Login endpoint está accesible',
          serverStatus: 'healthy'
        });
      });
      logger.debug('Endpoint configurado', {
        category: 'ENDPOINT_SETUP',
        endpoint: '/login-test'
      });

      // ✅ CRÍTICO: Endpoint OPTIONS para login
      this.app.options('/api/auth/login', (req, res) => {
        logger.debug('OPTIONS preflight para login', {
          category: 'AUTH_PREFLIGHT',
          origin: req.headers.origin
        });
        res.status(204).end();
      });
      logger.debug('Endpoint configurado', {
        category: 'ENDPOINT_SETUP',
        endpoint: 'OPTIONS /api/auth/login'
      });

      // Health check detallado enterprise
      this.app.get('/health/detailed', async (req, res) => {
        try {
          logger.info('🔍 Iniciando health check detallado enterprise', {
            category: 'HEALTH_CHECK_DETAILED',
            requestId: req.requestId
          });

          if (this.healthService) {
            const healthData = await this.healthService.performFullHealthCheck();
            res.json(healthData);
          } else {
            // Fallback si health service no está disponible
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
          }

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
      logger.debug('Endpoint configurado', {
        category: 'ENDPOINT_SETUP',
        endpoint: '/health/detailed'
      });

      // Readiness probe para Kubernetes
      this.app.get('/ready', (req, res) => {
        const isReady = this.socketManager && memoryManager && rateLimitManager.isInitialized;
        
        if (isReady) {
          res.status(200).json({ 
            status: 'ready',
            timestamp: new Date().toISOString(),
            services: {
              socketManager: !!this.socketManager,
              memoryManager: !!memoryManager,
              rateLimiting: rateLimitManager.isInitialized,
              healthService: !!this.healthService
            }
          });
        } else {
          res.status(503).json({ 
            status: 'not_ready',
            timestamp: new Date().toISOString(),
            services: {
              socketManager: !!this.socketManager,
              memoryManager: !!memoryManager,
              rateLimiting: rateLimitManager.isInitialized,
              healthService: !!this.healthService
            }
          });
        }
      });
      logger.debug('Endpoint configurado', {
        category: 'ENDPOINT_SETUP',
        endpoint: '/ready'
      });

      // Liveness probe para Kubernetes
      this.app.get('/live', (req, res) => {
        res.status(200).json({ 
          status: 'alive',
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        });
      });
      logger.debug('Endpoint configurado', {
        category: 'ENDPOINT_SETUP',
        endpoint: '/live'
      });

      // Métricas endpoint enterprise (protegido)
      this.app.get('/api/internal/metrics', authMiddleware, async (req, res) => {
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
            rateLimiting: await rateLimitManager.getStats(),
            healthService: this.healthService ? this.healthService.getDetailedMetrics() : null,
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
      logger.debug('Endpoint configurado', {
        category: 'ENDPOINT_SETUP',
        endpoint: '/api/internal/metrics'
      });

      // ✅ TIP 2: Endpoint root informativo
      this.app.get('/', (req, res) => {
        logger.debug('Root endpoint solicitado', {
          category: 'ROOT_ENDPOINT',
          clientIp: req.ip
        });
        res.json({
          service: 'UTalk Backend API',
          status: 'running',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          endpoints: {
            health: '/health',
            ping: '/ping',
            diagnostics: '/diagnostics',
            api: '/api/*'
          }
        });
      });
      logger.debug('Endpoint configurado', {
        category: 'ENDPOINT_SETUP',
        endpoint: '/ (root)'
      });

      // 🚨 INTENTAR CONFIGURAR RUTAS PRINCIPALES CON MANEJO DE ERRORES
      logger.info('Configurando rutas principales de la API', {
        category: 'ROUTES_CONFIG'
      });

      // ✅ CRÍTICO: Agregar middleware de logging ANTES de todas las rutas /api
      const loggingMiddleware = require('./middleware/logging');
      this.app.use('/api', loggingMiddleware);
      logger.debug('Middleware configurado', {
        category: 'MIDDLEWARE_SETUP',
        middleware: 'logging',
        path: '/api'
      });

      try {
        logger.debug('Configurando ruta', {
          category: 'ROUTE_SETUP',
          route: '/api/auth'
        });
        this.app.use('/api/auth', authRoutes);
        logger.info('Ruta configurada exitosamente', {
          category: 'ROUTE_SETUP',
          route: '/api/auth'
        });
      } catch (error) {
        logger.error('Error configurando ruta', {
          category: 'ROUTE_SETUP_ERROR',
          route: '/api/auth',
          error: error.message
        });
      }

      // Log único de pipelines (A1)
      try {
        logger.info('pipelines.ok', {
          routes: {
            list_conversations: [
              'correlationMiddleware',
              'loggingMiddleware(/api)',
              'authMiddleware',
              'requireReadAccess',
              'conversationValidators.validateList',
              'ConversationController.listConversations'
            ],
            webhook_inbound: [
              'correlationMiddleware',
              'loggingMiddleware(/api)',
              'messageValidators.validateWebhook',
              'MessageController.handleWebhookSafe'
            ]
          }
        });
      } catch (_) {}

      try {
        logger.debug('Configurando ruta', {
          category: 'ROUTE_SETUP',
          route: '/api/contacts'
        });
        this.app.use('/api/contacts', contactRoutes);
        logger.info('Ruta configurada exitosamente', {
          category: 'ROUTE_SETUP',
          route: '/api/contacts'
        });
      } catch (error) {
        logger.error('Error configurando ruta', {
          category: 'ROUTE_SETUP_ERROR',
          route: '/api/contacts',
          error: error.message
        });
      }

      try {
        logger.debug('Configurando ruta', {
          category: 'ROUTE_SETUP',
          route: '/api/conversations'
        });
        this.app.use('/api/conversations', conversationRoutes);
        logger.info('Ruta configurada exitosamente', {
          category: 'ROUTE_SETUP',
          route: '/api/conversations'
        });
      } catch (error) {
        logger.error('Error configurando ruta', {
          category: 'ROUTE_SETUP_ERROR',
          route: '/api/conversations',
          error: error.message
        });
      }

      try {
        logger.debug('Configurando ruta', {
          category: 'ROUTE_SETUP',
          route: '/api/messages'
        });
        this.app.use('/api/messages', messageRoutes);
        logger.info('Ruta configurada exitosamente', {
          category: 'ROUTE_SETUP',
          route: '/api/messages'
        });
      } catch (error) {
        logger.error('Error configurando ruta', {
          category: 'ROUTE_SETUP_ERROR',
          route: '/api/messages',
          error: error.message
        });
      }

      try {
        logger.debug('Configurando ruta', {
          category: 'ROUTE_SETUP',
          route: '/api/campaigns'
        });
        this.app.use('/api/campaigns', campaignRoutes);
        logger.info('Ruta configurada exitosamente', {
          category: 'ROUTE_SETUP',
          route: '/api/campaigns'
        });
      } catch (error) {
        logger.error('Error configurando ruta', {
          category: 'ROUTE_SETUP_ERROR',
          route: '/api/campaigns',
          error: error.message
        });
      }

      try {
        logger.debug('Configurando ruta', {
          category: 'ROUTE_SETUP',
          route: '/api/team'
        });
        this.app.use('/api/team', teamRoutes);
        logger.info('Ruta configurada exitosamente', {
          category: 'ROUTE_SETUP',
          route: '/api/team'
        });
      } catch (error) {
        logger.error('Error configurando ruta', {
          category: 'ROUTE_SETUP_ERROR',
          route: '/api/team',
          error: error.message
        });
      }

      try {
        logger.info('🧠 Intentando configurar /api/knowledge...', { category: '_INTENTANDO_CONFIGURAR_API_KNO' });
        this.app.use('/api/knowledge', knowledgeRoutes);
        logger.info('/api/knowledge configurado exitosamente', { category: '_API_KNOWLEDGE_CONFIGURADO_EXI' });
      } catch (error) {
        logger.error('❌ Error configurando /api/knowledge:', { category: '_ERROR_CONFIGURANDO_API_KNOWLE', error: error.message });
      }

      try {
        logger.info('📁 Intentando configurar /api/media...', { category: '_INTENTANDO_CONFIGURAR_API_MED' });
        this.app.use('/api/media', mediaRoutes);
        logger.info('/api/media configurado exitosamente', { category: '_API_MEDIA_CONFIGURADO_EXITOSA' });
      } catch (error) {
        logger.error('❌ Error configurando /api/media:', { category: '_ERROR_CONFIGURANDO_API_MEDIA_' , error: error.message });
      }

      // 🔧 CORRECCIÓN: Rutas para /media/proxy (sin autenticación)
      try {
        logger.info('🖼️ Configurando rutas /media/proxy...', { category: '_CONFIGURANDO_RUTAS_MEDIA_PROX' });
        
        // Ruta para proxy de Twilio
        this.app.get('/media/proxy', (req, res) => {
          logger.debug('Redireccionando ruta de media', {
            category: 'MEDIA_PROXY',
            from: '/media/proxy',
            to: '/api/media/proxy-public'
          });
          req.url = '/api/media/proxy-public' + req.url.replace('/media/proxy', '');
          this.app._router.handle(req, res);
        });
        
        // Ruta de prueba simple
        this.app.get('/test-media', (req, res) => {
          logger.debug('Test media endpoint solicitado', {
            category: 'TEST_ENDPOINT',
            endpoint: '/test-media'
          });
          res.status(200).json({
            success: true,
            message: 'Test endpoint funcionando',
            timestamp: new Date().toISOString()
          });
        });
        
        // Ruta para proxy de Twilio (pública) - ENDPOINT DIRECTO
        this.app.get('/media/proxy-public', async (req, res) => {
          logger.info('Proxy público de media solicitado', {
            category: 'MEDIA_PROXY_PUBLIC',
            messageSid: req.query.messageSid,
            mediaSid: req.query.mediaSid,
            url: req.url,
            method: req.method
          });
          
          try {
            // Validación básica
            const messageSid = req.query.messageSid;
            const mediaSid = req.query.mediaSid;
            
            if (!messageSid || !mediaSid) {
              return res.status(400).json({
                error: 'messageSid y mediaSid son requeridos'
              });
            }
            
            // Llamar al controlador de media
            const MediaUploadController = require('./controllers/MediaUploadController');
            return await MediaUploadController.proxyTwilioMedia(req, res);
            
          } catch (error) {
            logger.error('Error en proxy público de media', {
              category: 'MEDIA_PROXY_ERROR',
              error: error.message,
              stack: error.stack
            });
            res.status(500).json({
              error: 'Error interno del servidor',
              message: error.message
            });
          }
        });
        
        // Ruta para proxy de archivos almacenados
        this.app.get('/media/proxy-file-public/:fileId', (req, res) => {
          logger.info('🔄 Redirigiendo /media/proxy-file-public a /api/media/proxy-file-public', { category: '_REDIRIGIENDO_MEDIA_PROXY_FILE' });
          req.url = req.url.replace('/media/proxy-file-public', '/api/media/proxy-file-public');
          this.app._router.handle(req, res);
        });
        
        logger.info('Rutas /media/proxy configuradas exitosamente', { category: 'RUTAS_MEDIA_PROXY_CONFIGURADAS' });
      } catch (error) {
        logger.error('❌ Error configurando /media/proxy:', { category: '_ERROR_CONFIGURANDO_MEDIA_PROX' , error: error.message });
      }

      try {
        logger.info('📊 Intentando configurar /api/dashboard...', { category: '_INTENTANDO_CONFIGURAR_API_DAS' });
        this.app.use('/api/dashboard', dashboardRoutes);
        logger.info('/api/dashboard configurado exitosamente', { category: '_API_DASHBOARD_CONFIGURADO_EXI' });
      } catch (error) {
        logger.error('❌ Error configurando /api/dashboard:', { category: '_ERROR_CONFIGURANDO_API_DASHBO' , error: error.message });
      }

      try {
        logger.info('📞 Intentando configurar /api/twilio...', { category: '_INTENTANDO_CONFIGURAR_API_TWI' });
        this.app.use('/api/twilio', twilioRoutes);
        logger.info('/api/twilio configurado exitosamente', { category: '_API_TWILIO_CONFIGURADO_EXITOS' });
      } catch (error) {
        logger.error('❌ Error configurando /api/twilio:', { category: '_ERROR_CONFIGURANDO_API_TWILIO', error: error.message });
      }

      try {
        logger.info('🤖 Intentando configurar /api/ai...', { category: '_INTENTANDO_CONFIGURAR_API_AI_' });
        this.app.use('/api/ai', aiRoutes.router);
        logger.info('/api/ai configurado exitosamente', { category: '_API_AI_CONFIGURADO_EXITOSAMEN' });
      } catch (error) {
        logger.error('❌ Error configurando /api/ai:', { category: '_ERROR_CONFIGURANDO_API_AI_' , error: error.message });
      }

      try {
        logger.info('📊 Intentando configurar /api/ai/reports...', { category: '_INTENTANDO_CONFIGURAR_API_AI_' });
        this.app.use('/api/ai/reports', reportRoutes.router);
        logger.info('/api/ai/reports configurado exitosamente', { category: '_API_AI_REPORTS_CONFIGURADO_EX' });
      } catch (error) {
        logger.error('❌ Error configurando /api/ai/reports:', { category: '_ERROR_CONFIGURANDO_API_AI_REP' , error: error.message });
      }

      try {
        logger.debug('Intentando configurar /api/ai/rag...', { category: 'INTENTANDO_CONFIGURAR_API_AI_R' });
        this.app.use('/api/ai/rag', ragRoutes.router);
        logger.info('/api/ai/rag configurado exitosamente', { category: '_API_AI_RAG_CONFIGURADO_EXITOS' });
      } catch (error) {
        logger.error('❌ Error configurando /api/ai/rag:', { category: '_ERROR_CONFIGURANDO_API_AI_RAG' , error: error.message });
      }

      try {
        logger.info('⚙️ Intentando configurar /api/ai/ops...', { category: '_INTENTANDO_CONFIGURAR_API_AI_' });
        this.app.use('/api/ai/ops', aiOpsRoutes.router);
        logger.info('/api/ai/ops configurado exitosamente', { category: '_API_AI_OPS_CONFIGURADO_EXITOS' });
      } catch (error) {
        logger.error('❌ Error configurando /api/ai/ops:', { category: '_ERROR_CONFIGURANDO_API_AI_OPS' , error: error.message });
      }

      // 🔧 DASHBOARD DE LOGS
      try {
        logger.info('⚙️ Intentando configurar /logs...', { category: '_INTENTANDO_CONFIGURAR_LOGS_' });
        
        // Ruta para API de logs (debe ir primero)
        this.app.use('/api/logs', logRoutes);
        
        // Ruta para dashboard HTML (debe ir después y ser más específica)
        this.app.get('/logs', (req, res) => {
          logger.info('📊 Dashboard HTML solicitado desde:', { category: '_DASHBOARD_HTML_SOLICITADO_DES', ip: req.ip });
          const LogDashboardController = require('./controllers/LogDashboardController');
          return LogDashboardController.getDashboardHTML(req, res);
        });
        
        logger.info('Dashboard de logs configurado exitosamente', { category: 'DASHBOARD_DE_LOGS_CONFIGURADO_' });
      } catch (error) {
        logger.error('❌ Error configurando dashboard de logs:', { category: '_ERROR_CONFIGURANDO_DASHBOARD_' , error: error.message });
      }

      // 📊 ANALYTICS Y MÉTRICAS
      try {
        logger.info('📊 Intentando configurar /api/analytics...', { category: '_INTENTANDO_CONFIGURAR_API_ANA' });
        const analyticsRoutes = require('./routes/analytics');
        this.app.use('/api/analytics', analyticsRoutes);
        logger.info('/api/analytics configurado exitosamente', { category: '_API_ANALYTICS_CONFIGURADO_EXI' });
      } catch (error) {
        logger.error('❌ Error configurando /api/analytics:', { category: '_ERROR_CONFIGURANDO_API_ANALYT' , error: error.message });
      }

      // 🔧 CORRECCIÓN: Redirecciones de compatibilidad para rutas sin /api
      this.app.use('/conversations', (req, res) => {
        logger.info('🔄 Redirigiendo /conversations a /api/conversations', { category: '_REDIRIGIENDO_CONVERSATIONS_A_' });
        req.url = req.url.replace('/conversations', '/api/conversations');
        this.app._router.handle(req, res);
      });

      this.app.use('/contacts', (req, res) => {
        logger.info('🔄 Redirigiendo /contacts a /api/contacts', { category: '_REDIRIGIENDO_CONTACTS_A_API_C' });
        req.url = req.url.replace('/contacts', '/api/contacts');
        this.app._router.handle(req, res);
      });

      this.app.use('/messages', (req, res) => {
        logger.info('🔄 Redirigiendo /messages a /api/messages', { category: '_REDIRIGIENDO_MESSAGES_A_API_M' });
        req.url = req.url.replace('/messages', '/api/messages');
        this.app._router.handle(req, res);
      });

      // Ruta catch-all para 404
      this.app.use('*', (req, res) => {
        logger.info('🚫 Ruta no encontrada:', { category: '_RUTA_NO_ENCONTRADA_', method: req.method, url: req.originalUrl, ip: req.ip });
        
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
      logger.info('Catch-all 404 configurado', { category: 'CATCH_ALL_404_CONFIGURADO' });

      // ✅ CONTAR RUTAS REGISTRADAS
      const routeCount = this.app._router ? this.app._router.stack.length : 0;
      console.log(`📊 TOTAL RUTAS REGISTRADAS: ${routeCount}`);

      logger.info('✅ Rutas configuradas exitosamente', {
        category: 'ROUTES_SUCCESS',
        totalRoutes: routeCount
      });

    } catch (error) {
      logger.error('💥 ERROR CRÍTICO en setupRoutes:', { category: '_ERROR_CR_TICO_EN_SETUPROUTES_' , error: error.message });
      logger.error('ERROR CRÍTICO configurando rutas', {
        category: 'ROUTES_ERROR_CRITICAL',
        error: error.message,
        stack: error.stack
      });
      
      // En lugar de lanzar el error, configurar rutas mínimas de emergencia
      this.app.get('/emergency', (req, res) => {
        res.status(200).json({ 
          status: 'emergency_mode', 
          error: 'Route configuration failed',
          timestamp: new Date().toISOString()
        });
      });
      
      throw error; // Re-lanzar para que se maneje a nivel superior
    }
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

      // 5. Limpiar memory manager
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
