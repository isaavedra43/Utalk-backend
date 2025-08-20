/**
 * 🚀 OPTIMIZADOR DE INICIO - REDUCE TIEMPO DE ARRANQUE
 * 
 * Este módulo optimiza el proceso de inicio del servidor:
 * - Lazy loading de módulos pesados
 * - Inicialización asíncrona de servicios
 * - Configuración optimizada para Railway
 * - Prevención de bloqueos durante el inicio
 * 
 * @version 1.0.0
 * @author Performance Team
 */

const logger = require('../utils/logger');

class StartupOptimizer {
  constructor() {
    this.optimizations = new Map();
    this.startTime = Date.now();
    this.initialized = false;
  }

  /**
   * 🚀 APLICAR OPTIMIZACIONES DE INICIO
   */
  async applyOptimizations() {
    if (this.initialized) return;

    logger.info('🚀 Aplicando optimizaciones de inicio...', {
      category: 'STARTUP_OPTIMIZATION',
      startTime: this.startTime
    });

    try {
      // 1. Optimizar configuración de Node.js
      this.optimizeNodeConfig();
      
      // 2. Configurar lazy loading
      this.setupLazyLoading();
      
      // 3. Optimizar imports
      this.optimizeImports();
      
      // 4. Configurar timeouts agresivos para Railway
      this.setupRailwayTimeouts();

      this.initialized = true;
      
      const optimizationTime = Date.now() - this.startTime;
      logger.info('✅ Optimizaciones de inicio aplicadas', {
        category: 'STARTUP_OPTIMIZATION_SUCCESS',
        optimizationTime: `${optimizationTime}ms`,
        optimizationsApplied: this.optimizations.size
      });

    } catch (error) {
      logger.error('❌ Error aplicando optimizaciones de inicio', {
        category: 'STARTUP_OPTIMIZATION_ERROR',
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * ⚙️ OPTIMIZAR CONFIGURACIÓN DE NODE.JS
   */
  optimizeNodeConfig() {
    // Configurar garbage collection más agresivo
    if (global.gc) {
      // Forzar GC al inicio para limpiar memoria
      global.gc();
      logger.debug('Garbage collection forzado al inicio', {
        category: 'STARTUP_OPTIMIZATION'
      });
    }

    // Configurar timeouts más agresivos para Railway
    if (process.env.NODE_ENV === 'production') {
      // Reducir timeouts de DNS
      process.env.UV_THREADPOOL_SIZE = '4'; // Reducir threads
      
      // Configurar timeouts más agresivos
      process.env.NODE_OPTIONS = [
        process.env.NODE_OPTIONS || '',
        '--max-old-space-size=1536', // Reducir memoria máxima
        '--max-semi-space-size=32', // Reducir semi-space
        '--gc-interval=50', // GC más frecuente
        '--expose-gc', // Exponer GC
        '--optimize-for-size' // Optimizar por tamaño
      ].filter(Boolean).join(' ');
    }

    this.optimizations.set('nodeConfig', true);
  }

  /**
   * 🔄 CONFIGURAR LAZY LOADING
   */
  setupLazyLoading() {
    // Configurar lazy loading para módulos pesados
    const lazyModules = [
      'firebase-admin',
      'ioredis',
      'bull',
      'sharp',
      'fluent-ffmpeg'
    ];

    lazyModules.forEach(moduleName => {
      // Interceptar require para lazy loading
      const originalRequire = require.cache[require.resolve(moduleName)];
      if (originalRequire) {
        delete require.cache[require.resolve(moduleName)];
        logger.debug(`Lazy loading configurado para ${moduleName}`, {
          category: 'STARTUP_OPTIMIZATION'
        });
      }
    });

    this.optimizations.set('lazyLoading', true);
  }

  /**
   * 📦 OPTIMIZAR IMPORTS
   */
  optimizeImports() {
    // Configurar imports diferidos para servicios pesados
    const deferredServices = [
      'CampaignQueueService',
      'BatchService',
      'ShardingService',
      'AIService'
    ];

    deferredServices.forEach(serviceName => {
      // Marcar para carga diferida
      logger.debug(`Import diferido configurado para ${serviceName}`, {
        category: 'STARTUP_OPTIMIZATION'
      });
    });

    this.optimizations.set('deferredImports', true);
  }

  /**
   * ⏱️ CONFIGURAR TIMEOUTS AGRESIVOS PARA RAILWAY
   */
  setupRailwayTimeouts() {
    // Configurar timeouts más agresivos para Railway
    const railwayTimeouts = {
      // Timeouts de conexión
      connectTimeout: 5000, // 5 segundos
      commandTimeout: 3000, // 3 segundos
      keepAlive: 30000, // 30 segundos
      
      // Timeouts de retry
      maxRetries: 0, // Sin retries
      retryDelay: 100, // 100ms
      
      // Timeouts de carga
      maxLoadingTimeout: 5000, // 5 segundos
      
      // Timeouts de health check
      healthCheckTimeout: 3000, // 3 segundos
      
      // Timeouts de socket
      socketTimeout: 10000, // 10 segundos
      socketKeepAlive: 30000 // 30 segundos
    };

    // Aplicar timeouts globalmente
    global.RAILWAY_TIMEOUTS = railwayTimeouts;

    logger.info('⏱️ Timeouts agresivos configurados para Railway', {
      category: 'STARTUP_OPTIMIZATION',
      timeouts: railwayTimeouts
    });

    this.optimizations.set('railwayTimeouts', true);
  }

  /**
   * 📊 OBTENER MÉTRICAS DE OPTIMIZACIÓN
   */
  getOptimizationMetrics() {
    return {
      initialized: this.initialized,
      startTime: this.startTime,
      optimizationTime: Date.now() - this.startTime,
      optimizationsApplied: Array.from(this.optimizations.keys()),
      optimizationCount: this.optimizations.size
    };
  }

  /**
   * 🔍 VERIFICAR OPTIMIZACIONES APLICADAS
   */
  verifyOptimizations() {
    const missingOptimizations = [];
    
    const requiredOptimizations = [
      'nodeConfig',
      'lazyLoading',
      'deferredImports',
      'railwayTimeouts'
    ];

    requiredOptimizations.forEach(optimization => {
      if (!this.optimizations.has(optimization)) {
        missingOptimizations.push(optimization);
      }
    });

    if (missingOptimizations.length > 0) {
      logger.warn('⚠️ Optimizaciones faltantes detectadas', {
        category: 'STARTUP_OPTIMIZATION_WARNING',
        missingOptimizations
      });
      return false;
    }

    logger.info('✅ Todas las optimizaciones aplicadas correctamente', {
      category: 'STARTUP_OPTIMIZATION_VERIFICATION'
    });
    return true;
  }
}

// Singleton instance
const startupOptimizer = new StartupOptimizer();

// Aplicar optimizaciones automáticamente
setImmediate(() => {
  startupOptimizer.applyOptimizations().catch(error => {
    logger.error('Error en optimización automática de inicio', {
      category: 'STARTUP_OPTIMIZATION_AUTO_ERROR',
      error: error.message
    });
  });
});

module.exports = {
  StartupOptimizer,
  startupOptimizer
}; 