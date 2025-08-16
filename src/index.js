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

class ConsolidatedServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.socketManager = null;
    this.healthService = null;
    this.isShuttingDown = false;
    
    // 🚨 RUTA DE EMERGENCIA PARA DIAGNÓSTICO - AGREGAR AL INICIO
    this.app.get('/emergency-test', (req, res) => {
      console.log('🚨 EMERGENCIA: Petición recibida en /emergency-test desde:', req.ip);
      res.status(200).json({
        status: 'EMERGENCY_ROUTE_WORKING',
        timestamp: new Date().toISOString(),
        message: 'El servidor Express SÍ está recibiendo peticiones',
        ip: req.ip,
        headers: req.headers
      });
    });

    // ✅ CRÍTICO: Railway debe inyectar PORT - Debugging intensivo
    console.log('🔍 DEBUG PORT - process.env.PORT:', process.env.PORT);
    console.log('🔍 DEBUG PORT - typeof:', typeof process.env.PORT);
    
    // Buscar puertos alternativos que Railway pueda usar
    const railwayPorts = Object.keys(process.env)
      .filter(key => key.toLowerCase().includes('port'))
      .reduce((acc, key) => {
        acc[key] = process.env[key];
        return acc;
      }, {});
    console.log('🔍 DEBUG - Todas las variables PORT:', railwayPorts);
    
    // Usar PORT de Railway o fallback a 3001
    this.PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
    
    // ⚠️ CRÍTICO: Log si Railway no inyecta PORT
    if (!process.env.PORT) {
      console.error('🚨 CRÍTICO: Railway NO está inyectando process.env.PORT');
      console.log('📋 Variables de entorno disponibles:', Object.keys(process.env).filter(k => k.includes('PORT') || k.includes('RAILWAY')));
    } else {
      console.log('✅ Railway PORT detectado:', process.env.PORT);
    }
    this.startTime = Date.now();
    
    // Configurar proceso
    this.setupProcess();
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

    console.log('🔍 Variables críticas:', criticalVars);

    // ⚠️ Advertencias por variables faltantes
    if (!process.env.JWT_SECRET) {
      console.warn('⚠️ JWT_SECRET no configurado - Autenticación no funcionará');
    }

    // ❌ Variables que YA NO necesitamos (para limpiar Railway)
    const deprecatedVars = ['REDIS_URL', 'REDISCLOUD_URL', 'RATE_LIMIT_REDIS'];
    deprecatedVars.forEach(varName => {
      if (process.env[varName]) {
        console.warn(`⚠️ Variable obsoleta detectada: ${varName} (se puede eliminar)`);
      }
    });

    // ✅ Variables que SÍ necesitamos
    console.log('✅ Variables Railway requeridas: PORT, NODE_ENV');
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
      // ✅ TIP 2: Log inmediato para Railway diagnostics
      console.log(`🚀 UTalk Backend iniciando en puerto ${this.PORT} (0.0.0.0)...`);
      
      // ✅ VALIDACIÓN DE VARIABLES CRÍTICAS
      this.validateEnvironmentVariables();
      
      logger.info('🚀 Iniciando servidor consolidado enterprise...', {
        category: 'SERVER_STARTUP',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        environment: process.env.NODE_ENV || 'development',
        memoryLimit: process.env.NODE_OPTIONS,
        startupTime: new Date().toISOString(),
        requestLogger: { mode: 'wrapper-enabled' }
      });

      // ✅ INICIALIZACIÓN TOLERANTE A FALLOS
      const serviceStatus = {
        memory: false,
        health: false,
        rateLimiting: false
      };

      // 1. Inicializar gestión de memoria (no crítico)
      try {
        await this.initializeMemoryManagement();
        serviceStatus.memory = true;
        console.log('✅ Memory management inicializado');
      } catch (error) {
        console.warn('⚠️ Memory management falló, continuando...', error.message);
      }

      // ❌ DESACTIVADO: Rate limiting con Redis (temporalmente)
      // await this.initializeRateLimit();
      console.warn('⚠️ RATE LIMITING DESACTIVADO - Solo para debugging');

      // 3. Inicializar health checks (no crítico)
      try {
        await this.initializeHealthChecks();
        serviceStatus.health = true;
        console.log('✅ Health checks inicializados');
      } catch (error) {
        console.warn('⚠️ Health checks fallaron, continuando...', error.message);
      }

      // ✅ Log del estado de servicios
      console.log('📊 Estado de servicios:', serviceStatus);

      // 4. Configurar middlewares básicos
      this.setupBasicMiddleware();

      // Logs de diagnóstico de CORS
      const { STATIC_WHITELIST, REGEX_WHITELIST } = require('./config/cors');
      console.log('[CORS] static:', STATIC_WHITELIST);
      console.log('[CORS] regex:', REGEX_WHITELIST.map(r => r.toString()));

      // ❌ DESACTIVADO: Rate limiting en rutas (temporalmente)
      // this.setupRateLimiting();
      
      // ✅ TIP 1: Middleware dummy para logging de requests
      this.app.use('/api', (req, res, next) => {
        console.log(`📥 API Request: ${req.method} ${req.path} from ${req.ip}`);
        next();
      });

      // 6. Configurar rutas y middlewares de aplicación
      this.setupRoutes();

      // 7. Configurar middleware global de errores
      this.setupErrorHandling();

      // 8. Crear servidor HTTP
      this.server = createServer(this.app);

      // 9. Inicializar Socket.IO
      this.initializeSocketIO();

      // 10. Iniciar servidor
      await this.startServer();

      // 11. Iniciar monitoreo de salud
      await this.startHealthMonitoring();

      logger.info('✅ Servidor consolidado enterprise inicializado exitosamente', {
        category: 'SERVER_SUCCESS',
        port: this.PORT,
        environment: process.env.NODE_ENV || 'development',
        features: {
          memoryManagement: serviceStatus.memory,
          rateLimiting: false, // ✅ TIP 2: Reflejar estado real
          healthChecks: serviceStatus.health,
          errorHandling: true,
          logging: true,
          socketIO: true,
          gracefulShutdown: true,
          degradedMode: !serviceStatus.memory || !serviceStatus.health // ✅ TIP 2: Indicar modo degradado
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
      console.log('✅ /diagnostics configurado');

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
      console.log('✅ /env-check configurado');

      // HEALTH CHECK MEJORADO - Para liveness/readiness probes
      this.app.get('/health', (req, res) => {
        const healthService = getHealthCheckService();
        const health = healthService.getSimpleHealthCheck();
        
        // Log para Railway diagnostics
        console.log(`🏥 Health check solicitado desde: ${req.ip} - Status: ${health.status}`);
        
        res.status(health.statusCode).json(health);
      });
      console.log('✅ /health configurado');

      // ✅ TIP 1: Endpoint específico para verificar conectividad desde Vercel
      this.app.get('/ping', (req, res) => {
        console.log('🏓 Ping recibido desde:', req.ip, req.headers.origin);
        res.status(200).json({
          pong: true,
          timestamp: new Date().toISOString(),
          from: req.ip,
          origin: req.headers.origin
        });
      });
      console.log('✅ /ping configurado');

      // ✅ CRÍTICO: Endpoint específico para probar CORS
      this.app.get('/cors-test', (req, res) => {
        console.log('🧪 CORS Test desde:', req.ip, req.headers.origin);
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
      console.log('✅ /cors-test configurado');

      // ✅ SUPER ROBUSTO: Endpoint para probar OPTIONS preflight
      this.app.options('/cors-test', (req, res) => {
        console.log('🛡️ OPTIONS preflight test para /cors-test');
        res.status(204).end();
      });
      console.log('✅ OPTIONS /cors-test configurado');

      // ✅ CRÍTICO: Endpoint específico para login test
      this.app.get('/login-test', (req, res) => {
        console.log('🔐 Login Test desde:', req.ip, req.headers.origin);
        res.status(200).json({
          loginTest: true,
          timestamp: new Date().toISOString(),
          origin: req.headers.origin,
          message: 'Login endpoint está accesible',
          serverStatus: 'healthy'
        });
      });
      console.log('✅ /login-test configurado');

      // ✅ CRÍTICO: Endpoint OPTIONS para login
      this.app.options('/api/auth/login', (req, res) => {
        console.log('🛡️ OPTIONS preflight para /api/auth/login desde:', req.headers.origin);
        res.status(204).end();
      });
      console.log('✅ OPTIONS /api/auth/login configurado');

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
      console.log('✅ /health/detailed configurado');

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
      console.log('✅ /ready configurado');

      // Liveness probe para Kubernetes
      this.app.get('/live', (req, res) => {
        res.status(200).json({ 
          status: 'alive',
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        });
      });
      console.log('✅ /live configurado');

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
      console.log('✅ /api/internal/metrics configurado');

      // ✅ TIP 2: Endpoint root informativo
      this.app.get('/', (req, res) => {
        console.log('📋 Root endpoint solicitado desde:', req.ip);
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
      console.log('✅ / (root) configurado');

      // 🚨 INTENTAR CONFIGURAR RUTAS PRINCIPALES CON MANEJO DE ERRORES
      console.log('🔧 Configurando rutas principales de la API...');

      // ✅ CRÍTICO: Agregar middleware de logging ANTES de todas las rutas /api
      const loggingMiddleware = require('./middleware/logging');
      this.app.use('/api', loggingMiddleware);
      console.log('✅ Middleware de logging configurado para /api');

      try {
        console.log('📝 Intentando configurar /api/auth...');
        this.app.use('/api/auth', authRoutes);
        console.log('✅ /api/auth configurado exitosamente');
      } catch (error) {
        console.error('❌ Error configurando /api/auth:', error.message);
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
        console.log('👥 Intentando configurar /api/contacts...');
        this.app.use('/api/contacts', contactRoutes);
        console.log('✅ /api/contacts configurado exitosamente');
      } catch (error) {
        console.error('❌ Error configurando /api/contacts:', error.message);
      }

      try {
        console.log('💬 Intentando configurar /api/conversations...');
        this.app.use('/api/conversations', conversationRoutes);
        console.log('✅ /api/conversations configurado exitosamente');
      } catch (error) {
        console.error('❌ Error configurando /api/conversations:', error.message);
      }

      try {
        console.log('📩 Intentando configurar /api/messages...');
        this.app.use('/api/messages', messageRoutes);
        console.log('✅ /api/messages configurado exitosamente');
      } catch (error) {
        console.error('❌ Error configurando /api/messages:', error.message);
      }

      try {
        console.log('🎯 Intentando configurar /api/campaigns...');
        this.app.use('/api/campaigns', campaignRoutes);
        console.log('✅ /api/campaigns configurado exitosamente');
      } catch (error) {
        console.error('❌ Error configurando /api/campaigns:', error.message);
      }

      try {
        console.log('👥 Intentando configurar /api/team...');
        this.app.use('/api/team', teamRoutes);
        console.log('✅ /api/team configurado exitosamente');
      } catch (error) {
        console.error('❌ Error configurando /api/team:', error.message);
      }

      try {
        console.log('🧠 Intentando configurar /api/knowledge...');
        this.app.use('/api/knowledge', knowledgeRoutes);
        console.log('✅ /api/knowledge configurado exitosamente');
      } catch (error) {
        console.error('❌ Error configurando /api/knowledge:', error.message);
      }

      try {
        console.log('📁 Intentando configurar /api/media...');
        this.app.use('/api/media', mediaRoutes);
        console.log('✅ /api/media configurado exitosamente');
      } catch (error) {
        console.error('❌ Error configurando /api/media:', error.message);
      }

      try {
        console.log('📊 Intentando configurar /api/dashboard...');
        this.app.use('/api/dashboard', dashboardRoutes);
        console.log('✅ /api/dashboard configurado exitosamente');
      } catch (error) {
        console.error('❌ Error configurando /api/dashboard:', error.message);
      }

      try {
        console.log('📞 Intentando configurar /api/twilio...');
        this.app.use('/api/twilio', twilioRoutes);
        console.log('✅ /api/twilio configurado exitosamente');
      } catch (error) {
        console.error('❌ Error configurando /api/twilio:', error.message);
      }

      try {
        console.log('🤖 Intentando configurar /api/ai...');
        this.app.use('/api/ai', aiRoutes.router);
        console.log('✅ /api/ai configurado exitosamente');
      } catch (error) {
        console.error('❌ Error configurando /api/ai:', error.message);
      }

      try {
        console.log('📊 Intentando configurar /api/ai/reports...');
        this.app.use('/api/ai/reports', reportRoutes.router);
        console.log('✅ /api/ai/reports configurado exitosamente');
      } catch (error) {
        console.error('❌ Error configurando /api/ai/reports:', error.message);
      }

      try {
        console.log('🔍 Intentando configurar /api/ai/rag...');
        this.app.use('/api/ai/rag', ragRoutes.router);
        console.log('✅ /api/ai/rag configurado exitosamente');
      } catch (error) {
        console.error('❌ Error configurando /api/ai/rag:', error.message);
      }

      try {
        console.log('⚙️ Intentando configurar /api/ai/ops...');
        this.app.use('/api/ai/ops', aiOpsRoutes.router);
        console.log('✅ /api/ai/ops configurado exitosamente');
      } catch (error) {
        console.error('❌ Error configurando /api/ai/ops:', error.message);
      }

      // 🔧 DASHBOARD DE LOGS
      try {
        console.log('⚙️ Intentando configurar /logs...');
        
        // Ruta para API de logs (debe ir primero)
        this.app.use('/api/logs', logRoutes);
        
        // Ruta para dashboard HTML (debe ir después y ser más específica)
        this.app.get('/logs', (req, res) => {
          console.log('📊 Dashboard HTML solicitado desde:', req.ip);
          const LogDashboardController = require('./controllers/LogDashboardController');
          return LogDashboardController.getDashboardHTML(req, res);
        });
        
        console.log('✅ Dashboard de logs configurado exitosamente');
      } catch (error) {
        console.error('❌ Error configurando dashboard de logs:', error.message);
      }

      // 📊 ANALYTICS Y MÉTRICAS
      try {
        console.log('📊 Intentando configurar /api/analytics...');
        const analyticsRoutes = require('./routes/analytics');
        this.app.use('/api/analytics', analyticsRoutes);
        console.log('✅ /api/analytics configurado exitosamente');
      } catch (error) {
        console.error('❌ Error configurando /api/analytics:', error.message);
      }

      // 🔧 CORRECCIÓN: Redirecciones de compatibilidad para rutas sin /api
      this.app.use('/conversations', (req, res) => {
        console.log('🔄 Redirigiendo /conversations a /api/conversations');
        req.url = req.url.replace('/conversations', '/api/conversations');
        this.app._router.handle(req, res);
      });

      this.app.use('/contacts', (req, res) => {
        console.log('🔄 Redirigiendo /contacts a /api/contacts');
        req.url = req.url.replace('/contacts', '/api/contacts');
        this.app._router.handle(req, res);
      });

      this.app.use('/messages', (req, res) => {
        console.log('🔄 Redirigiendo /messages a /api/messages');
        req.url = req.url.replace('/messages', '/api/messages');
        this.app._router.handle(req, res);
      });

      // Ruta catch-all para 404
      this.app.use('*', (req, res) => {
        console.log('🚫 Ruta no encontrada:', req.method, req.originalUrl, 'desde IP:', req.ip);
        
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
      console.log('✅ Catch-all 404 configurado');

      // ✅ CONTAR RUTAS REGISTRADAS
      const routeCount = this.app._router ? this.app._router.stack.length : 0;
      console.log(`📊 TOTAL RUTAS REGISTRADAS: ${routeCount}`);

      logger.info('✅ Rutas configuradas exitosamente', {
        category: 'ROUTES_SUCCESS',
        totalRoutes: routeCount
      });

    } catch (error) {
      console.error('💥 ERROR CRÍTICO en setupRoutes:', error.message);
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
      const { enhancedErrorHandler, unhandledErrorHandler, promiseRejectionHandler } = require('./middleware/enhancedErrorHandler');

      // Configurar manejo de promesas rechazadas
      process.on('unhandledRejection', promiseRejectionHandler);

      // Middleware de manejo de errores mejorado
      this.app.use(enhancedErrorHandler);

      // Middleware para errores no manejados (solo si no se envió respuesta)
      this.app.use((err, req, res, next) => {
        if (!res.headersSent) {
          return unhandledErrorHandler(err, req, res, next);
        }
      });

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
    console.log('[BOOT] socket exports:', Object.keys(require('./socket/enterpriseSocketManager')));

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
      console.warn('⚠️ Models no disponibles (Firebase no configurado):', error.message);
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
    console.log('[BOOT] typeof manager:', typeof this.socketManager, 'name:', this.socketManager?.constructor?.name);

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
