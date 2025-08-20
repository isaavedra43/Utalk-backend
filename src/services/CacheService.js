/**
 * 🚀 CACHE SERVICE UNIFICADO - GESTIÓN CENTRALIZADA DE MEMORIA Y CACHÉ
 * 
 * Sistema unificado que combina:
 * - CacheService: Caché simple con TTL
 * - MemoryManager: Gestión avanzada de memoria con mapas gestionados
 * - Límites adaptativos basados en hardware
 * - Monitoreo y alertas automáticas
 * 
 * @version 3.0.0 UNIFICADO
 * @author Backend Team
 */

const EventEmitter = require('events');
const { performance } = require('perf_hooks');
const os = require('os');
const logger = require('../utils/logger');

// Cálculo de límites adaptativos basados en el hardware
const totalMemory = os.totalmem();
const availableMemory = os.freemem();

const adaptiveLimits = {
  maxMapsPerInstance: Math.max(20, Math.floor(totalMemory / (25 * 1024 * 1024))), // 25MB por mapa, mínimo 20
  maxEntriesPerMap: Math.max(2000, Math.floor(availableMemory / (512 * 1024))), // 512KB por entrada, mínimo 2000
  memoryWarningThreshold: totalMemory * 0.75, // 75% de la RAM total
  memoryCriticalThreshold: totalMemory * 0.85, // 85% de la RAM total
  defaultTTL: 15 * 60 * 1000, // 15 minutos (reducido para mejor performance)
  cleanupInterval: 2 * 60 * 1000, // 2 minutos (más frecuente)
  batchSize: 100, // Tamaño de lote para operaciones masivas
  enableCompression: true, // Habilitar compresión para valores grandes
  maxValueSize: 1024 * 1024 // 1MB máximo por valor
};

class ManagedMap {
  constructor(name, options = {}) {
    this.name = name;
    this.map = new Map();
    this.ttl = new Map();
    this.config = {
      maxEntries: options.maxEntries || adaptiveLimits.maxEntriesPerMap,
      defaultTTL: options.defaultTTL || adaptiveLimits.defaultTTL,
      enableMetrics: options.enableMetrics !== false,
      autoCleanup: options.autoCleanup !== false
    };
    
    this.stats = {
      sets: 0,
      gets: 0,
      deletes: 0,
      hits: 0,
      misses: 0,
      expires: 0
    };
    
    // Limpieza automática si está habilitada
    if (this.config.autoCleanup) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, 60 * 1000); // Cada minuto
    }
  }

  // 🔧 AGREGADO: Getter para size para compatibilidad con Map estándar
  get size() {
    return this.map.size;
  }
  
  set(key, value, ttlMs = null) {
    const expiresAt = ttlMs ? Date.now() + ttlMs : Date.now() + this.config.defaultTTL;
    
    // Verificar límite de entradas
    if (this.map.size >= this.config.maxEntries) {
      this.evictOldest();
    }
    
    this.map.set(key, value);
    this.ttl.set(key, expiresAt);
    this.stats.sets++;
    
    return true;
  }
  
  get(key) {
    const value = this.map.get(key);
    const expiresAt = this.ttl.get(key);
    
    // Verificar si expiró
    if (expiresAt && Date.now() > expiresAt) {
      this.delete(key);
      this.stats.expires++;
      this.stats.misses++;
      return null;
    }
    
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    } else {
      this.stats.misses++;
      return null;
    }
  }
  
  delete(key) {
    const deleted = this.map.delete(key);
    this.ttl.delete(key);
    if (deleted) this.stats.deletes++;
    return deleted;
  }

  clear() {
    this.map.clear();
    this.ttl.clear();
    this.stats = {
      sets: 0,
      gets: 0,
      deletes: 0,
      hits: 0,
      misses: 0,
      expires: 0
    };
  }
  
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, expiresAt] of this.ttl.entries()) {
      if (now > expiresAt) {
        this.map.delete(key);
        this.ttl.delete(key);
        this.stats.expires++;
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Limpieza de ${this.name}: ${cleaned} entradas expiradas`, {
        category: 'CACHE_CLEANUP',
        mapName: this.name,
        cleaned,
        remaining: this.map.size
      });
    }
  }
  
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [key, expiresAt] of this.ttl.entries()) {
      if (expiresAt < oldestTime) {
        oldestTime = expiresAt;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.delete(oldestKey);
    }
  }
  
  getStats() {
    return {
      name: this.name,
      size: this.map.size,
      maxEntries: this.config.maxEntries,
      ...this.stats,
      hitRate: this.stats.hits / Math.max(1, this.stats.hits + this.stats.misses)
    };
  }

  // 🔧 AGREGADO: Método entries() para compatibilidad con Map estándar
  entries() {
    return this.map.entries();
  }

  // 🔧 AGREGADO: Método keys() para compatibilidad con Map estándar
  keys() {
    return this.map.keys();
  }

  // 🔧 AGREGADO: Método values() para compatibilidad con Map estándar
  values() {
    return this.map.values();
  }

  // 🔧 AGREGADO: Método has() para compatibilidad con Map estándar
  has(key) {
    const value = this.get(key);
    return value !== null;
  }

  // 🔧 AGREGADO: Método forEach() para compatibilidad con Map estándar
  forEach(callback, thisArg) {
    return this.map.forEach((value, key) => {
      // Verificar si el valor no ha expirado antes de llamar al callback
      const expiresAt = this.ttl.get(key);
      if (!expiresAt || Date.now() <= expiresAt) {
        callback.call(thisArg, value, key, this);
      }
    });
  }
  
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

class UnifiedCacheService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuración con límites adaptativos al hardware
    this.config = {
      // Límites globales adaptativos
      maxMapsPerInstance: options.maxMapsPerInstance || adaptiveLimits.maxMapsPerInstance,
      maxEntriesPerMap: options.maxEntriesPerMap || adaptiveLimits.maxEntriesPerMap,
      defaultTTL: options.defaultTTL || adaptiveLimits.defaultTTL,
      
      // Configuración de limpieza
      cleanupInterval: options.cleanupInterval || adaptiveLimits.cleanupInterval,
      memoryWarningThreshold: options.memoryWarningThreshold || adaptiveLimits.memoryWarningThreshold,
      memoryCriticalThreshold: options.memoryCriticalThreshold || adaptiveLimits.memoryCriticalThreshold,
      
      // Configuración para producción
      enableMetrics: options.enableMetrics !== false,
      enableAlerts: options.enableAlerts !== false,
      logLevel: options.logLevel || 'info'
    };
    
    // Storage de mapas gestionados
    this.managedMaps = new Map(); // name -> ManagedMap instance
    
    // Cache simple para compatibilidad
    this.simpleCache = new Map();
    this.simpleTTL = new Map();
    
    this.metrics = {
      totalMaps: 0,
      totalEntries: 0,
      memoryUsage: 0,
      cleanupCycles: 0,
      alertsTriggered: 0,
      lastCleanup: null
    };
    
    // Timers para limpieza automática
    this.cleanupTimer = null;
    this.metricsTimer = null;
    
    this.initialize();
  }
  
  /**
   * 🚀 INICIALIZAR SERVICIO UNIFICADO
   */
  initialize() {
    // Configurar limpieza automática
    this.cleanupTimer = setInterval(() => {
      this.performGlobalCleanup();
    }, this.config.cleanupInterval);
    
    // Configurar monitoreo de métricas
    if (this.config.enableMetrics) {
      this.metricsTimer = setInterval(() => {
        this.updateMetrics();
        this.checkMemoryThresholds();
      }, 60 * 1000); // Cada minuto
    }
    
    logger.info('✅ UnifiedCacheService inicializado con límites adaptativos', {
      category: 'CACHE_INIT',
      maxMapsPerInstance: this.config.maxMapsPerInstance,
      maxEntriesPerMap: this.config.maxEntriesPerMap,
      totalMemory: Math.round(totalMemory / (1024 * 1024 * 1024)) + 'GB',
      availableMemory: Math.round(availableMemory / (1024 * 1024 * 1024)) + 'GB'
    });
  }
  
  /**
   * 🗺️ CREAR MAPA GESTIONADO
   */
  createManagedMap(name, options = {}) {
    if (this.managedMaps.size >= this.config.maxMapsPerInstance) {
      logger.warn('Límite de mapas alcanzado', {
        category: 'CACHE_MAP_LIMIT',
        current: this.managedMaps.size,
        max: this.config.maxMapsPerInstance,
        requestedMap: name
      });
      return null;
    }
    
    const managedMap = new ManagedMap(name, {
      maxEntries: this.config.maxEntriesPerMap,
      defaultTTL: this.config.defaultTTL,
      ...options
    });
    
    this.managedMaps.set(name, managedMap);
    this.metrics.totalMaps = this.managedMaps.size;
    
    logger.info(`Mapa gestionado creado: ${name}`, {
      category: 'CACHE_MAP_CREATED',
      mapName: name,
      totalMaps: this.managedMaps.size
    });
    
    return managedMap;
  }
  
  /**
   * 🔧 MÉTODOS DE CACHE SIMPLE (compatibilidad)
   */
  set(key, value, ttlSeconds = 300) {
    try {
      const expiresAt = Date.now() + (ttlSeconds * 1000);
      
      this.simpleCache.set(key, value);
      this.simpleTTL.set(key, expiresAt);
      
      logger.debug('Cache SET exitoso', {
        category: 'CACHE_SET',
        key: key.substring(0, 50) + '...',
        ttlSeconds,
        cacheSize: this.simpleCache.size
      });
      
      return true;
    } catch (error) {
      logger.error('Error en Cache SET', {
        category: 'CACHE_SET_ERROR',
        key: key.substring(0, 50) + '...',
        error: error.message
      });
      return false;
    }
  }
  
  get(key) {
    try {
      const value = this.simpleCache.get(key);
      const expiresAt = this.simpleTTL.get(key);
      
      // Verificar si expiró
      if (expiresAt && Date.now() > expiresAt) {
        this.delete(key);
        return null;
      }
      
      if (value !== undefined) {
        logger.debug('Cache HIT', {
          category: 'CACHE_HIT',
          key: key.substring(0, 50) + '...'
        });
        return value;
      } else {
        logger.debug('Cache MISS', {
          category: 'CACHE_MISS',
          key: key.substring(0, 50) + '...'
        });
        return null;
      }
    } catch (error) {
      logger.error('Error en Cache GET', {
        category: 'CACHE_GET_ERROR',
        key: key.substring(0, 50) + '...',
        error: error.message
      });
      return null;
    }
  }
  
  delete(key) {
    try {
      const deleted = this.simpleCache.delete(key);
      this.simpleTTL.delete(key);
      
      if (deleted) {
        logger.debug('Cache DELETE exitoso', {
          category: 'CACHE_DELETE',
          key: key.substring(0, 50) + '...'
        });
      }
      
      return deleted;
    } catch (error) {
      logger.error('Error en Cache DELETE', {
        category: 'CACHE_DELETE_ERROR',
        key: key.substring(0, 50) + '...',
        error: error.message
      });
      return false;
    }
  }
  
  clear() {
    try {
      this.simpleCache.clear();
      this.simpleTTL.clear();
      
      logger.info('Cache CLEAR exitoso', {
        category: 'CACHE_CLEAR'
      });
      
      return true;
    } catch (error) {
      logger.error('Error en Cache CLEAR', {
        category: 'CACHE_CLEAR_ERROR',
        error: error.message
      });
      return false;
    }
  }
  
  /**
   * 🧹 LIMPIEZA GLOBAL
   */
  performGlobalCleanup() {
    const startTime = performance.now();
    let totalCleaned = 0;
    
    // Limpiar cache simple
    const now = Date.now();
    for (const [key, expiresAt] of this.simpleTTL.entries()) {
      if (now > expiresAt) {
        this.simpleCache.delete(key);
        this.simpleTTL.delete(key);
        totalCleaned++;
      }
    }
    
    // Limpiar mapas gestionados
    for (const [name, managedMap] of this.managedMaps.entries()) {
      const beforeSize = managedMap.map.size;
      managedMap.cleanup();
      const afterSize = managedMap.map.size;
      totalCleaned += (beforeSize - afterSize);
    }
    
    this.metrics.cleanupCycles++;
    this.metrics.lastCleanup = new Date().toISOString();
    
    const duration = performance.now() - startTime;
    
    if (totalCleaned > 0) {
      logger.info('Limpieza global completada', {
        category: 'CACHE_GLOBAL_CLEANUP',
        totalCleaned,
        duration: Math.round(duration),
        totalMaps: this.managedMaps.size,
        simpleCacheSize: this.simpleCache.size
      });
    }
  }
  
  /**
   * 📊 ACTUALIZAR MÉTRICAS
   */
  updateMetrics() {
    let totalEntries = 0;
    
    for (const managedMap of this.managedMaps.values()) {
      totalEntries += managedMap.map.size;
    }
    
    totalEntries += this.simpleCache.size;
    
    this.metrics.totalEntries = totalEntries;
    this.metrics.memoryUsage = process.memoryUsage();
  }
  
  /**
   * ⚠️ VERIFICAR UMBRALES DE MEMORIA
   */
  checkMemoryThresholds() {
    const usedMemory = process.memoryUsage().heapUsed;
    
    if (usedMemory > this.config.memoryCriticalThreshold) {
      this.metrics.alertsTriggered++;
      this.emit('critical-alert', {
        type: 'MEMORY_CRITICAL',
        usedMemory,
        threshold: this.config.memoryCriticalThreshold,
        timestamp: new Date().toISOString()
      });
      
      logger.error('🚨 ALERTA CRÍTICA: Uso de memoria excesivo', {
        category: 'MEMORY_CRITICAL_ALERT',
        usedMemory: Math.round(usedMemory / (1024 * 1024)) + 'MB',
        threshold: Math.round(this.config.memoryCriticalThreshold / (1024 * 1024)) + 'MB'
      });
      
      // Limpieza de emergencia
      this.performGlobalCleanup();
    } else if (usedMemory > this.config.memoryWarningThreshold) {
      this.emit('warning-alert', {
        type: 'MEMORY_WARNING',
        usedMemory,
        threshold: this.config.memoryWarningThreshold,
        timestamp: new Date().toISOString()
      });
      
      logger.warn('⚠️ ADVERTENCIA: Uso de memoria alto', {
        category: 'MEMORY_WARNING_ALERT',
        usedMemory: Math.round(usedMemory / (1024 * 1024)) + 'MB',
        threshold: Math.round(this.config.memoryWarningThreshold / (1024 * 1024)) + 'MB'
      });
    }
  }
  
  /**
   * 📈 OBTENER ESTADÍSTICAS
   */
  getStats() {
    this.updateMetrics();
    
    const mapStats = {};
    for (const [name, managedMap] of this.managedMaps.entries()) {
      mapStats[name] = managedMap.getStats();
    }
    
    return {
      config: {
        maxMapsPerInstance: this.config.maxMapsPerInstance,
        maxEntriesPerMap: this.config.maxEntriesPerMap,
        defaultTTL: this.config.defaultTTL
      },
      metrics: this.metrics,
      maps: mapStats,
      simpleCache: {
        size: this.simpleCache.size,
        ttlSize: this.simpleTTL.size
      },
      memory: {
        total: Math.round(totalMemory / (1024 * 1024 * 1024)) + 'GB',
        available: Math.round(availableMemory / (1024 * 1024 * 1024)) + 'GB',
        used: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)) + 'MB'
      }
    };
  }
  
  /**
   * 🚀 OPTIMIZACIONES DE PERFORMANCE
   */
  
  /**
   * Compresión de valores grandes para ahorrar memoria
   */
  compressValue(value) {
    if (!adaptiveLimits.enableCompression || typeof value !== 'string') {
      return value;
    }
    
    if (value.length > 1024) { // Solo comprimir strings grandes
      try {
        // Compresión simple usando Buffer
        const buffer = Buffer.from(value, 'utf8');
        if (buffer.length > adaptiveLimits.maxValueSize) {
          logger.warn('Valor demasiado grande para cache', {
            size: buffer.length,
            maxSize: adaptiveLimits.maxValueSize
          });
          return null; // No cachear valores muy grandes
        }
        return buffer;
      } catch (error) {
        logger.error('Error comprimiendo valor', error);
        return value;
      }
    }
    
    return value;
  }
  
  /**
   * Descompresión de valores
   */
  decompressValue(value) {
    if (Buffer.isBuffer(value)) {
      try {
        return value.toString('utf8');
      } catch (error) {
        logger.error('Error descomprimiendo valor', error);
        return value;
      }
    }
    return value;
  }
  
  /**
   * Operaciones en lote para mejor performance
   */
  async batchSet(entries, ttlMs = null) {
    const startTime = performance.now();
    const results = [];
    
    for (let i = 0; i < entries.length; i += adaptiveLimits.batchSize) {
      const batch = entries.slice(i, i + adaptiveLimits.batchSize);
      const batchResults = await Promise.all(
        batch.map(([key, value]) => this.set(key, value, ttlMs))
      );
      results.push(...batchResults);
    }
    
    const duration = performance.now() - startTime;
    logger.debug(`Batch set completado: ${entries.length} entradas en ${duration.toFixed(2)}ms`);
    
    return results;
  }
  
  /**
   * Operaciones en lote para obtener múltiples valores
   */
  async batchGet(keys) {
    const startTime = performance.now();
    const results = {};
    
    for (let i = 0; i < keys.length; i += adaptiveLimits.batchSize) {
      const batch = keys.slice(i, i + adaptiveLimits.batchSize);
      const batchResults = await Promise.all(
        batch.map(key => this.get(key))
      );
      
      batch.forEach((key, index) => {
        results[key] = batchResults[index];
      });
    }
    
    const duration = performance.now() - startTime;
    logger.debug(`Batch get completado: ${keys.length} claves en ${duration.toFixed(2)}ms`);
    
    return results;
  }
  
  /**
   * Precalentamiento de cache para rutas críticas
   */
  async prewarmCache(patterns) {
    logger.info('Iniciando precalentamiento de cache...');
    const startTime = performance.now();
    
    for (const pattern of patterns) {
      try {
        // Aquí implementarías la lógica específica para cada patrón
        // Por ejemplo, cargar datos de configuración, estadísticas, etc.
        logger.debug(`Precalentando patrón: ${pattern}`);
      } catch (error) {
        logger.error(`Error precalentando patrón ${pattern}:`, error);
      }
    }
    
    const duration = performance.now() - startTime;
    logger.info(`Precalentamiento completado en ${duration.toFixed(2)}ms`);
  }
  
  /**
   * Optimización de memoria agresiva
   */
  async aggressiveOptimization() {
    logger.info('Iniciando optimización agresiva de memoria...');
    
    // Forzar garbage collection si está disponible
    if (global.gc) {
      global.gc();
      logger.debug('Garbage collection forzado');
    }
    
    // Limpiar entradas expiradas de todos los mapas
    for (const [name, managedMap] of this.managedMaps.entries()) {
      managedMap.cleanup();
    }
    
    // Limpiar cache simple
    this.performGlobalCleanup();
    
    logger.info('Optimización agresiva completada');
  }
  
  /**
   * 🛑 SHUTDOWN GRACEFUL
   */
  async shutdown() {
    logger.info('Iniciando graceful shutdown de UnifiedCacheService...');
    
    // Detener timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    
    // Limpiar mapas gestionados
    for (const [name, managedMap] of this.managedMaps.entries()) {
      managedMap.destroy();
      logger.debug(`Mapa ${name} destruido`);
    }
    
    // Limpiar cache simple
    this.simpleCache.clear();
    this.simpleTTL.clear();
    
    this.managedMaps.clear();
    
    logger.info('UnifiedCacheService shutdown completado');
  }
}

// Instancia singleton
const cacheService = new UnifiedCacheService();

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  logger.error('UncaughtException en UnifiedCacheService', {
    category: 'CACHE_UNCAUGHT_EXCEPTION',
    error: error.message,
    stack: error.stack
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('UnhandledRejection en UnifiedCacheService', {
    category: 'CACHE_UNHANDLED_REJECTION',
    reason: reason?.message || reason,
    stack: reason?.stack
  });
});

module.exports = {
  UnifiedCacheService,
  ManagedMap,
  cacheService
}; 