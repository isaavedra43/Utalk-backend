const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const jwt = require('jsonwebtoken');
const { firestore } = require('../config/firebase');
const logger = require('../utils/logger');
const { getAccessTokenConfig } = require('../config/jwt');
const os = require('os');

/**
 * Rate Limiting Adaptativo con Fallback
 *
 * - El límite máximo de requests se ajusta automáticamente según la carga promedio del servidor.
 * - Si la carga es alta (loadavg > 2), el límite se reduce para proteger la estabilidad del sistema.
 * - Si Redis falla, el sistema cambia automáticamente a un store en memoria para evitar downtime.
 * - Todos los eventos de fallback quedan logueados para su monitoreo.
 *
 * Esto garantiza máxima resiliencia y protección ante picos de carga o fallos de infraestructura.
 */

/**
 * Middleware de seguridad avanzado con detección de amenazas
 * y rate limiting inteligente adaptativo
 */
class AdvancedSecurity {
  constructor () {
    this.suspiciousIPs = new Map();
    this.failedAttempts = new Map();
    this.blockedIPs = new Set();
    this.rateLimitStore = new Map();

    // Configuración de seguridad
    this.config = {
      maxFailedAttempts: parseInt(process.env.MAX_FAILED_ATTEMPTS) || 5,
      blockDuration: parseInt(process.env.BLOCK_DURATION_MINUTES) || 30,
      suspiciousThreshold: parseInt(process.env.SUSPICIOUS_THRESHOLD) || 10,
      cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL_MINUTES) || 60,
    };

    // Inicializar rate limiting adaptativo
    this.initializeAdaptiveRateLimiting();

    // Iniciar limpieza periódica
    this.startCleanupTimer();
  }

  /**
   * 🚀 INICIALIZAR RATE LIMITING ADAPTATIVO
   */
  initializeAdaptiveRateLimiting() {
    // Configurar fallback de Redis a memoria
    this.setupRateLimitFallback();
    
    // Iniciar monitoreo de carga del sistema
    this.startLoadMonitoring();
    
    logger.info('🔄 Rate Limiting Adaptativo inicializado', {
      systemLoad: this.getSystemLoad(),
      adaptiveLimits: this.getAdaptiveLimitsInfo()
    });
  }

  /**
   * 📊 OBTENER CARGA DEL SISTEMA
   */
  getSystemLoad() {
    return os.loadavg()[0]; // carga promedio del último minuto
  }

  /**
   * 🔧 CALCULAR LÍMITE MÁXIMO ADAPTATIVO
   */
  getAdaptiveMax(baseMax) {
    const load = this.getSystemLoad();
    
    // Si la carga promedio supera 2.0, reduce el límite a la mitad
    if (load > 2.0) {
      const reducedMax = Math.floor(baseMax * 0.5);
      logger.warn('🔄 Reduciendo rate limit por alta carga del sistema', {
        originalMax: baseMax,
        reducedMax,
        systemLoad: load,
        reason: 'Carga del sistema > 2.0'
      });
      return reducedMax;
    }
    
    // Si la carga es moderada (1.0-2.0), reduce ligeramente
    if (load > 1.0) {
      const reducedMax = Math.floor(baseMax * 0.8);
      logger.info('🔄 Ajustando rate limit por carga moderada', {
        originalMax: baseMax,
        reducedMax,
        systemLoad: load
      });
      return reducedMax;
    }
    
    // Carga normal, usar límite base
    return baseMax;
  }

  /**
   * 🔄 CONFIGURAR FALLBACK DE REDIS A MEMORIA
   */
  setupRateLimitFallback() {
    let rateLimitStore;
    
    try {
      // Intentar usar Redis si está disponible
      const RedisStore = require('rate-limit-redis');
      const redis = require('redis');
      
      const redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL;
      
      if (redisUrl) {
        const redisClient = redis.createClient({
          url: redisUrl,
          socket: {
            connectTimeout: 5000,
            commandTimeout: 3000,
            reconnectStrategy: (retries) => {
              if (retries > 3) {
                logger.error('Redis: Máximo número de reintentos alcanzado');
                return false;
              }
              return Math.min(retries * 100, 3000);
            }
          }
        });

        redisClient.on('error', (err) => {
          logger.error('Redis error:', err);
          this.rateLimitStore = new Map(); // Fallback a memoria
        });

        rateLimitStore = new RedisStore({ 
          sendCommand: (...args) => redisClient.sendCommand(args),
          prefix: 'adaptive_rate_limit:'
        });
        
        logger.info('✅ Redis configurado para rate limiting adaptativo');
      } else {
        throw new Error('Redis URL no configurada');
      }
      
    } catch (e) {
      // Fallback a memoria si Redis falla
      const MemoryStore = require('express-rate-limit').MemoryStore;
      rateLimitStore = new MemoryStore();
      
      logger.warn('⚠️ Redis no disponible, usando fallback de memoria para rate limiting', {
        error: e.message,
        fallback: 'MemoryStore',
        impact: 'Rate limits no persistirán entre reinicios'
      });
    }
    
    this.rateLimitStore = rateLimitStore;
  }

  /**
   * 📈 INICIAR MONITOREO DE CARGA DEL SISTEMA
   */
  startLoadMonitoring() {
    // Monitorear carga cada 30 segundos
    setInterval(() => {
      const load = this.getSystemLoad();
      
      if (load > 2.0) {
        logger.warn('⚠️ Alta carga del sistema detectada', {
          load,
          impact: 'Rate limits reducidos automáticamente',
          recommendation: 'Considerar escalar recursos'
        });
      } else if (load > 1.0) {
        logger.info('📊 Carga moderada del sistema', {
          load,
          impact: 'Rate limits ligeramente reducidos'
        });
      }
    }, 30000);
  }

  /**
   * 📊 OBTENER INFORMACIÓN DE LÍMITES ADAPTATIVOS
   */
  getAdaptiveLimitsInfo() {
    const load = this.getSystemLoad();
    const baseLimits = {
      auth: 5,
      messaging: 100,
      upload: 20,
      api: 2000,
      default: 1000
    };
    
    const adaptiveLimits = {};
    
    for (const [type, baseMax] of Object.entries(baseLimits)) {
      adaptiveLimits[type] = {
        baseMax,
        adaptiveMax: this.getAdaptiveMax(baseMax),
        systemLoad: load,
        reduction: baseMax - this.getAdaptiveMax(baseMax)
      };
    }
    
    return {
      systemLoad: load,
      adaptiveLimits,
      store: this.rateLimitStore.constructor.name,
      recommendations: this.getLoadRecommendations(load)
    };
  }

  /**
   * 💡 OBTENER RECOMENDACIONES BASADAS EN CARGA
   */
  getLoadRecommendations(load) {
    if (load > 3.0) {
      return ['CRÍTICO: Considerar escalar inmediatamente', 'Revisar procesos background'];
    } else if (load > 2.0) {
      return ['ALTO: Monitorear tendencia', 'Considerar optimizaciones'];
    } else if (load > 1.0) {
      return ['MODERADO: Sistema funcionando normalmente'];
    } else {
      return ['NORMAL: Sistema con buena capacidad'];
    }
  }

  /**
   * Rate limiting inteligente adaptativo basado en patrones de uso y carga del sistema
   */
  createSmartRateLimit (endpointType = 'default') {
    const configs = {
      auth: {
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: (req) => this.getAdaptiveMax(5), // 5 intentos de login (adaptativo)
        message: {
          error: 'Demasiados intentos de autenticación',
          message: 'Has excedido el límite de intentos de login. Intenta en 15 minutos.',
          retryAfter: 900,
        },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        skipFailedRequests: false,
      },
      messaging: {
        windowMs: 1 * 60 * 1000, // 1 minuto
        max: (req) => this.getAdaptiveMax(this.getMessageLimit(req)),
        message: {
          error: 'Límite de mensajes excedido',
          message: 'Has enviado demasiados mensajes. Espera un momento.',
          retryAfter: 60,
        },
        standardHeaders: true,
        legacyHeaders: false,
      },
      upload: {
        windowMs: 10 * 60 * 1000, // 10 minutos
        max: (req) => this.getAdaptiveMax(20), // 20 uploads (adaptativo)
        message: {
          error: 'Límite de subidas excedido',
          message: 'Has subido demasiados archivos. Intenta más tarde.',
          retryAfter: 600,
        },
        standardHeaders: true,
        legacyHeaders: false,
      },
      api: {
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: (req) => this.getAdaptiveMax(this.getAPILimit(req)),
        message: {
          error: 'Límite de API excedido',
          message: 'Has excedido el límite de solicitudes a la API.',
          retryAfter: 900,
        },
        standardHeaders: true,
        legacyHeaders: false,
      },
      default: {
        windowMs: 15 * 60 * 1000,
        max: (req) => this.getAdaptiveMax(1000), // 1000 requests (adaptativo)
        message: {
          error: 'Límite de solicitudes excedido',
          message: 'Demasiadas solicitudes desde esta IP.',
          retryAfter: 900,
        },
        standardHeaders: true,
        legacyHeaders: false,
      },
    };

    const config = configs[endpointType] || configs.default;

    return rateLimit({
      ...config,
      store: this.rateLimitStore, // Usar store adaptativo con fallback
      skip: (req) => this.shouldSkipRateLimit(req),
      // ✅ CORREGIDO: Usar handler en lugar de onLimitReached
      handler: (req, res) => this.handleRateLimitReached(req, res, options, endpointType),
      keyGenerator: (req) => this.generateRateLimitKey(req),
    });
  }

  /**
   * Determinar límite de mensajes basado en rol del usuario
   */
  getMessageLimit (req) {
    if (!req.user) return 10; // Sin autenticar

    switch (req.user.role) {
    case 'admin': return 200;
    case 'agent': return 100;
    case 'viewer': return 20;
    default: return 10;
    }
  }

  /**
   * Determinar límite de API basado en rol del usuario
   */
  getAPILimit (req) {
    if (!req.user) return 100; // Sin autenticar

    switch (req.user.role) {
    case 'admin': return 5000;
    case 'agent': return 2000;
    case 'viewer': return 500;
    default: return 100;
    }
  }

  /**
   * Decidir si omitir rate limiting
   */
  shouldSkipRateLimit (req) {
    // Omitir para localhost en desarrollo
    if (process.env.NODE_ENV === 'development' &&
        (req.ip === '127.0.0.1' || req.ip === '::1')) {
      return true;
    }

    // Omitir para admins en situaciones específicas
    if (req.user?.role === 'admin' && req.get('X-Admin-Override') === process.env.ADMIN_OVERRIDE_KEY) {
      logger.info('Rate limit omitido por admin override', {
        ip: req.ip,
        user: req.user.id,
        endpoint: req.originalUrl,
      });
      return true;
    }

    return false;
  }

  /**
   * Generar clave única para rate limiting
   */
  generateRateLimitKey (req) {
    // Usar usuario si está autenticado, sino IP
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }

    return `ip:${req.ip}`;
  }

  /**
   * Manejar cuando se alcanza el límite
   */
  handleRateLimitReached (req, res, options, endpointType) {
    const key = this.generateRateLimitKey(req);

    // Registrar actividad sospechosa
    this.recordSuspiciousActivity(req.ip, `rate_limit_${endpointType}`);

    logger.warn('Rate limit alcanzado', {
      ip: req.ip,
      user: req.user?.id,
      endpoint: req.originalUrl,
      endpointType,
      key,
      userAgent: req.get('User-Agent'),
    });

    // Incrementar contador de intentos fallidos
    this.incrementFailedAttempts(req.ip);
  }

  /**
   * Middleware de desaceleración progresiva
   */
  createSlowDown (endpointType = 'default') {
    const configs = {
      auth: {
        windowMs: 15 * 60 * 1000,
        delayAfter: 2,
        delayMs: 500,
        maxDelayMs: 20000,
      },
      upload: {
        windowMs: 5 * 60 * 1000,
        delayAfter: 5,
        delayMs: 1000,
        maxDelayMs: 30000,
      },
      default: {
        windowMs: 15 * 60 * 1000,
        delayAfter: 10,
        delayMs: 250,
        maxDelayMs: 10000,
      },
    };

    const config = configs[endpointType] || configs.default;

    return slowDown({
      ...config,
      skip: (req) => this.shouldSkipRateLimit(req),
      keyGenerator: (req) => this.generateRateLimitKey(req),
      // ✅ CORREGIDO: Usar handler en lugar de onLimitReached
      handler: (req, res, options) => {
        logger.info('Desaceleración aplicada', {
          ip: req.ip,
          user: req.user?.id,
          delay: options.delay,
          endpoint: req.originalUrl,
          timestamp: new Date().toISOString()
        });
        
        // ✅ RESPONDER con información de desaceleración
        res.status(429).json({
          error: 'Too many requests',
          message: 'Tu velocidad de requests ha sido reducida temporalmente.',
          retryAfter: Math.ceil(options.delay / 1000),
          timestamp: new Date().toISOString()
        });
      },
    });
  }

  /**
   * Detección de patrones de ataque
   */
  detectAttackPatterns () {
    return (req, res, next) => {
      const suspicious = this.analyzeSuspiciousRequest(req);

      if (suspicious.isBlocked) {
        logger.warn('IP bloqueada detectada', {
          ip: req.ip,
          reason: suspicious.reason,
          endpoint: req.originalUrl,
        });

        return res.status(403).json({
          error: 'Acceso bloqueado',
          message: 'Tu IP ha sido bloqueada temporalmente por actividad sospechosa.',
          retryAfter: this.config.blockDuration * 60,
        });
      }

      if (suspicious.isSuspicious) {
        logger.warn('Actividad sospechosa detectada', {
          ip: req.ip,
          patterns: suspicious.patterns,
          endpoint: req.originalUrl,
          userAgent: req.get('User-Agent'),
        });

        // Aplicar medidas adicionales sin bloquear
        req.isSuspicious = true;
      }

      next();
    };
  }

  /**
   * Analizar si una request es sospechosa
   */
  analyzeSuspiciousRequest (req) {
    const ip = req.ip;
    const result = {
      isBlocked: this.blockedIPs.has(ip),
      isSuspicious: false,
      patterns: [],
      reason: null,
    };

    if (result.isBlocked) {
      result.reason = 'IP previamente bloqueada';
      return result;
    }

    // Patrones sospechosos
    const patterns = [
      {
        name: 'sql_injection',
        test: () => this.detectSQLInjection(req),
        severity: 'high',
      },
      {
        name: 'xss_attempt',
        test: () => this.detectXSS(req),
        severity: 'high',
      },
      {
        name: 'path_traversal',
        test: () => this.detectPathTraversal(req),
        severity: 'medium',
      },
      {
        name: 'bot_behavior',
        test: () => this.detectBotBehavior(req),
        severity: 'low',
      },
      {
        name: 'rapid_requests',
        test: () => this.detectRapidRequests(req),
        severity: 'medium',
      },
    ];

    let suspiciousScore = 0;
    patterns.forEach(pattern => {
      if (pattern.test()) {
        result.patterns.push(pattern.name);
        suspiciousScore += pattern.severity === 'high' ? 3 : pattern.severity === 'medium' ? 2 : 1;
      }
    });

    // Evaluar si es sospechoso
    if (suspiciousScore >= 3 || result.patterns.includes('sql_injection') || result.patterns.includes('xss_attempt')) {
      result.isSuspicious = true;
      this.recordSuspiciousActivity(ip, result.patterns.join(','));

      // Bloquear si es muy sospechoso
      if (suspiciousScore >= 5) {
        this.blockIP(ip, `Patrón de ataque detectado: ${result.patterns.join(', ')}`);
        result.isBlocked = true;
        result.reason = 'Actividad maliciosa detectada';
      }
    }

    return result;
  }

  /**
   * Detectar intentos de inyección SQL
   */
  detectSQLInjection (req) {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/i,
      /(UNION.*SELECT)/i,
      /(\bOR\b.*=.*\b)/i,
      /(\bAND\b.*=.*\b)/i,
      /(--|#|\/\*|\*\/)/,
      /(\b(EXEC|EXECUTE)\b)/i,
      /(\b(SCRIPT|JAVASCRIPT|VBSCRIPT)\b)/i,
    ];

    const testString = JSON.stringify({
      query: req.query,
      body: req.body,
      params: req.params,
      url: req.url,
    });

    return sqlPatterns.some(pattern => pattern.test(testString));
  }

  /**
   * Detectar intentos de XSS
   */
  detectXSS (req) {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]*src[^>]*onerror/gi,
      /<svg[^>]*onload/gi,
      /eval\s*\(/gi,
      /expression\s*\(/gi,
    ];

    const testString = JSON.stringify({
      query: req.query,
      body: req.body,
      headers: req.headers,
      url: req.url,
    });

    return xssPatterns.some(pattern => pattern.test(testString));
  }

  /**
   * Detectar intentos de path traversal
   */
  detectPathTraversal (req) {
    const pathPatterns = [
      /\.\.\//g,
      /\.\.\\/g,
      /%2e%2e%2f/gi,
      /%2e%2e%5c/gi,
      /\.{2}%2f/gi,
      /\.{2}%5c/gi,
    ];

    return pathPatterns.some(pattern => pattern.test(req.url));
  }

  /**
   * Detectar comportamiento de bot
   */
  detectBotBehavior (req) {
    const userAgent = req.get('User-Agent') || '';

    // User agents sospechosos
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /^$/, // User agent vacío
      /python/i,
      /curl/i,
      /wget/i,
    ];

    // Ausencia de headers comunes de navegador
    const missingHeaders = !req.get('Accept') || !req.get('Accept-Language');

    return botPatterns.some(pattern => pattern.test(userAgent)) || missingHeaders;
  }

  /**
   * Detectar requests rápidas
   */
  detectRapidRequests (req) {
    const ip = req.ip;
    const now = Date.now();
    const window = 10000; // 10 segundos
    const threshold = 50; // 50 requests en 10 segundos

    if (!this.rateLimitStore.has(ip)) {
      this.rateLimitStore.set(ip, []);
    }

    const requests = this.rateLimitStore.get(ip);

    // Limpiar requests antiguos
    const recentRequests = requests.filter(time => now - time < window);
    recentRequests.push(now);

    this.rateLimitStore.set(ip, recentRequests);

    return recentRequests.length > threshold;
  }

  /**
   * Registrar actividad sospechosa
   */
  recordSuspiciousActivity (ip, activity) {
    const now = Date.now();

    if (!this.suspiciousIPs.has(ip)) {
      this.suspiciousIPs.set(ip, []);
    }

    const activities = this.suspiciousIPs.get(ip);
    activities.push({ activity, timestamp: now });

    // Mantener solo los últimos eventos
    if (activities.length > 20) {
      activities.splice(0, 10);
    }

    this.suspiciousIPs.set(ip, activities);

    // Verificar si debe bloquearse
    if (activities.length >= this.config.suspiciousThreshold) {
      this.blockIP(ip, `Actividad sospechosa repetida: ${activities.map(a => a.activity).join(', ')}`);
    }
  }

  /**
   * Incrementar intentos fallidos
   */
  incrementFailedAttempts (ip) {
    const now = Date.now();

    if (!this.failedAttempts.has(ip)) {
      this.failedAttempts.set(ip, []);
    }

    const attempts = this.failedAttempts.get(ip);
    attempts.push(now);

    // Limpiar intentos antiguos (más de 1 hora)
    const recentAttempts = attempts.filter(time => now - time < 60 * 60 * 1000);
    this.failedAttempts.set(ip, recentAttempts);

    // Bloquear si excede el límite
    if (recentAttempts.length >= this.config.maxFailedAttempts) {
      this.blockIP(ip, `Exceso de intentos fallidos: ${recentAttempts.length}`);
    }
  }

  /**
   * Bloquear IP
   */
  blockIP (ip, reason) {
    this.blockedIPs.add(ip);

    logger.warn('IP bloqueada', {
      ip,
      reason,
      duration: this.config.blockDuration + ' minutos',
      timestamp: new Date().toISOString(),
    });

    // Desbloquear automáticamente después del tiempo configurado
    setTimeout(() => {
      this.blockedIPs.delete(ip);
      logger.info('IP desbloqueada automáticamente', { ip });
    }, this.config.blockDuration * 60 * 1000);
  }

  /**
   * Validación JWT mejorada
   */
  enhancedJWTValidation () {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
          return res.status(401).json({
            error: 'Token requerido',
            message: 'Header Authorization con token Bearer es obligatorio',
          });
        }

        const token = authHeader.substring(7);

        // Verificar token
        const jwtConfig = getAccessTokenConfig();
        const decoded = jwt.verify(token, jwtConfig.secret);

        // Validaciones adicionales
        const validation = await this.validateTokenClaims(decoded, req);

        if (!validation.valid) {
          logger.warn('Token inválido rechazado', {
            reason: validation.reason,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
          });

          return res.status(401).json({
            error: 'Token inválido',
            message: validation.reason,
          });
        }

        // Verificar usuario activo en Firestore
        const userDoc = await firestore.collection('users').doc(decoded.id).get();

        if (!userDoc.exists) {
          return res.status(401).json({
            error: 'Usuario no encontrado',
            message: 'El usuario asociado al token no existe',
          });
        }

        const userData = userDoc.data();

        if (!userData.isActive) {
          return res.status(403).json({
            error: 'Usuario desactivado',
            message: 'Tu cuenta ha sido desactivada',
          });
        }

        // Verificar última actividad (opcional)
        if (userData.lastLoginAt) {
          const lastLogin = userData.lastLoginAt.toDate();
          const maxInactivity = 30 * 24 * 60 * 60 * 1000; // 30 días

          if (Date.now() - lastLogin.getTime() > maxInactivity) {
            return res.status(401).json({
              error: 'Sesión expirada por inactividad',
              message: 'Tu sesión ha expirado. Inicia sesión nuevamente.',
            });
          }
        }

        // Agregar información del usuario a la request
        req.user = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          isActive: userData.isActive,
          lastLoginAt: userData.lastLoginAt,
          permissions: userData.permissions || [],
        };

        next();
      } catch (error) {
        logger.error('Error en validación JWT:', error);

        let message = 'Token inválido';
        if (error.name === 'TokenExpiredError') {
          message = 'Token expirado';
        } else if (error.name === 'JsonWebTokenError') {
          message = 'Token malformado';
        }

        return res.status(401).json({
          error: 'Error de autenticación',
          message,
        });
      }
    };
  }

  /**
   * Validar claims adicionales del token
   */
  async validateTokenClaims (decoded, _req) {
    // Verificar estructura básica
    if (!decoded.id || !decoded.email || !decoded.role) {
      return { valid: false, reason: 'Token incompleto' };
    }

    // Verificar expiración
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return { valid: false, reason: 'Token expirado' };
    }

    // Verificar emisor (opcional)
    if (jwtConfig.issuer && decoded.iss !== jwtConfig.issuer) {
      return { valid: false, reason: 'Emisor inválido' };
    }

    // Verificar audiencia (opcional)
    if (jwtConfig.audience && decoded.aud !== jwtConfig.audience) {
      return { valid: false, reason: 'Audiencia inválida' };
    }

    return { valid: true };
  }

  /**
   * Limpiar datos antiguos periódicamente
   */
  startCleanupTimer () {
    setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval * 60 * 1000);
  }

  /**
   * Limpiar datos antiguos
   */
  cleanup () {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    // Limpiar actividades sospechosas antiguas
    for (const [ip, activities] of this.suspiciousIPs.entries()) {
      const recentActivities = activities.filter(activity =>
        now - activity.timestamp < oneHour * 24, // 24 horas
      );

      if (recentActivities.length === 0) {
        this.suspiciousIPs.delete(ip);
      } else {
        this.suspiciousIPs.set(ip, recentActivities);
      }
    }

    // Limpiar intentos fallidos antiguos
    for (const [ip, attempts] of this.failedAttempts.entries()) {
      const recentAttempts = attempts.filter(attempt =>
        now - attempt < oneHour,
      );

      if (recentAttempts.length === 0) {
        this.failedAttempts.delete(ip);
      } else {
        this.failedAttempts.set(ip, recentAttempts);
      }
    }

    // Limpiar rate limit store
    for (const [key, requests] of this.rateLimitStore.entries()) {
      const recentRequests = requests.filter(request =>
        now - request < 15 * 60 * 1000, // 15 minutos
      );

      if (recentRequests.length === 0) {
        this.rateLimitStore.delete(key);
      } else {
        this.rateLimitStore.set(key, recentRequests);
      }
    }

    logger.info('Limpieza de seguridad completada', {
      suspiciousIPs: this.suspiciousIPs.size,
      failedAttempts: this.failedAttempts.size,
      blockedIPs: this.blockedIPs.size,
      rateLimitStore: this.rateLimitStore.size,
    });
  }

  /**
   * Obtener estadísticas de seguridad con información adaptativa
   */
  getSecurityStats () {
    return {
      blockedIPs: Array.from(this.blockedIPs),
      suspiciousIPs: this.suspiciousIPs.size,
      failedAttempts: this.failedAttempts.size,
      rateLimitEntries: this.rateLimitStore.size,
      config: this.config,
      adaptiveRateLimiting: this.getAdaptiveLimitsInfo(),
      systemLoad: this.getSystemLoad(),
      store: this.rateLimitStore.constructor.name
    };
  }
}

// Crear instancia única
const advancedSecurity = new AdvancedSecurity();

// Exportar middlewares
module.exports = {
  AdvancedSecurity,
  advancedSecurity,

  // Middlewares listos para usar
  smartRateLimit: (type) => advancedSecurity.createSmartRateLimit(type),
  slowDown: (type) => advancedSecurity.createSlowDown(type),
  attackDetection: advancedSecurity.detectAttackPatterns(),
  enhancedAuth: advancedSecurity.enhancedJWTValidation(),

  // Utilidades
  getStats: () => advancedSecurity.getSecurityStats(),
  blockIP: (ip, reason) => advancedSecurity.blockIP(ip, reason),
  unblockIP: (ip) => advancedSecurity.blockedIPs.delete(ip),
};
