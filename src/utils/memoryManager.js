/**
 * 🧠 GESTOR CENTRALIZADO DE MEMORIA ADAPTATIVO
 * 
 * Memory Manager Adaptativo
 *
 * Todos los límites de memoria se calculan automáticamente en base al hardware
 * donde corre el proceso, permitiendo máxima escalabilidad y evitando cuellos
 * de botella en servidores con poca o mucha RAM.
 *
 * - maxMapsPerInstance: Calculado como 50MB por mapa, mínimo 10
 * - maxEntriesPerMap: 1MB por entrada
 * - memoryWarningThreshold: 70% de la RAM total
 * - memoryCriticalThreshold: 90% de la RAM total
 *
 * Si el servidor tiene poca memoria, los límites serán más bajos, protegiendo la estabilidad.
 * Si el servidor tiene mucha RAM, la app escala sin cuellos de botella artificiales.
 * 
 * Previene fugas de memoria mediante:
 * - Límites máximos adaptativos al hardware
 * - TTL (Time To Live) automático
 * - Limpieza proactiva
 * - Monitoreo y alertas
 * - Compatibilidad con múltiples instancias
 * 
 * @version 2.0.0 ADAPTATIVO
 * @author Memory Management Team
 */

const EventEmitter = require('events');
const { performance } = require('perf_hooks');
const os = require('os');
const logger = require('./logger');

// Cálculo de límites adaptativos basados en el hardware
const totalMemory = os.totalmem();
const availableMemory = os.freemem();

const adaptiveLimits = {
  maxMapsPerInstance: Math.max(10, Math.floor(totalMemory / (50 * 1024 * 1024))), // 50MB por mapa, mínimo 10
  maxEntriesPerMap: Math.max(1000, Math.floor(availableMemory / (1024 * 1024))), // 1MB por entrada, mínimo 1000
  memoryWarningThreshold: totalMemory * 0.7, // 70% de la RAM total
  memoryCriticalThreshold: totalMemory * 0.9, // 90% de la RAM total
  defaultTTL: 30 * 60 * 1000, // 30 minutos
  cleanupInterval: 5 * 60 * 1000 // 5 minutos
};

class AdvancedMemoryManager extends EventEmitter {
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
   * 🚀 INICIALIZAR GESTOR DE MEMORIA
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
      }, 60000); // Cada minuto
    }
    
    // Configurar graceful shutdown
    this.setupGracefulShutdown();
    
    logger.info('🧠 AdvancedMemoryManager inicializado con límites adaptativos', {
      maxMapsPerInstance: this.config.maxMapsPerInstance,
      maxEntriesPerMap: this.config.maxEntriesPerMap,
      defaultTTL: this.config.defaultTTL,
      cleanupInterval: this.config.cleanupInterval,
      hardware: {
        totalMemory: `${(totalMemory / (1024 * 1024 * 1024)).toFixed(2)} GB`,
        availableMemory: `${(availableMemory / (1024 * 1024 * 1024)).toFixed(2)} GB`,
        memoryWarningThreshold: `${(this.config.memoryWarningThreshold / (1024 * 1024 * 1024)).toFixed(2)} GB`,
        memoryCriticalThreshold: `${(this.config.memoryCriticalThreshold / (1024 * 1024 * 1024)).toFixed(2)} GB`
      },
      adaptiveLimits: {
        maxMapsPerInstance: adaptiveLimits.maxMapsPerInstance,
        maxEntriesPerMap: adaptiveLimits.maxEntriesPerMap,
        memoryWarningThreshold: `${(adaptiveLimits.memoryWarningThreshold / (1024 * 1024 * 1024)).toFixed(2)} GB`,
        memoryCriticalThreshold: `${(adaptiveLimits.memoryCriticalThreshold / (1024 * 1024 * 1024)).toFixed(2)} GB`
      }
    });
  }
  
  /**
   * 🗺️ CREAR MAPA GESTIONADO
   */
  createManagedMap(name, options = {}) {
    if (this.managedMaps.has(name)) {
      logger.warn(`ManagedMap '${name}' ya existe, retornando existente`);
      return this.managedMaps.get(name);
    }
    
    if (this.managedMaps.size >= this.config.maxMapsPerInstance) {
      const error = new Error(`Límite de mapas alcanzado: ${this.config.maxMapsPerInstance}`);
      logger.error('Límite de mapas alcanzado', {
        name,
        currentMaps: this.managedMaps.size,
        maxMaps: this.config.maxMapsPerInstance
      });
      throw error;
    }
    
    const managedMap = new ManagedMap(name, {
      maxEntries: options.maxEntries || this.config.maxEntriesPerMap,
      defaultTTL: options.defaultTTL || this.config.defaultTTL,
      onEviction: options.onEviction || this.defaultEvictionHandler.bind(this),
      onWarning: options.onWarning || this.defaultWarningHandler.bind(this),
      enableStats: options.enableStats !== false
    });
    
    this.managedMaps.set(name, managedMap);
    this.updateMetrics();
    
    logger.info(`ManagedMap '${name}' creado`, {
      maxEntries: managedMap.options.maxEntries,
      defaultTTL: managedMap.options.defaultTTL,
      totalMaps: this.managedMaps.size
    });
    
    return managedMap;
  }
  
  /**
   * 🗑️ ELIMINAR MAPA GESTIONADO
   */
  destroyManagedMap(name) {
    const managedMap = this.managedMaps.get(name);
    if (!managedMap) {
      logger.warn(`ManagedMap '${name}' no existe`);
      return false;
    }
    
    managedMap.destroy();
    this.managedMaps.delete(name);
    this.updateMetrics();
    
    logger.info(`ManagedMap '${name}' destruido`, {
      totalMaps: this.managedMaps.size
    });
    
    return true;
  }
  
  /**
   * 🧹 LIMPIEZA GLOBAL AUTOMÁTICA
   */
  performGlobalCleanup() {
    const startTime = performance.now();
    let totalCleaned = 0;
    
    for (const [name, managedMap] of this.managedMaps.entries()) {
      try {
        const cleaned = managedMap.cleanup();
        totalCleaned += cleaned;
        
        if (cleaned > 0) {
          // Log removido para reducir ruido en producción
        }
      } catch (error) {
        logger.error(`Error en limpieza de '${name}'`, {
          error: error.message,
          stack: error.stack
        });
      }
    }
    
    const duration = performance.now() - startTime;
    this.metrics.cleanupCycles++;
    this.metrics.lastCleanup = new Date().toISOString();
    
    if (totalCleaned > 0 || duration > 100) {
      logger.info('Limpieza global completada', {
        totalCleaned,
        duration: `${duration.toFixed(2)}ms`,
        totalMaps: this.managedMaps.size,
        cycle: this.metrics.cleanupCycles
      });
    }
    
    this.emit('cleanup-completed', {
      totalCleaned,
      duration,
      totalMaps: this.managedMaps.size
    });
  }
  
  /**
   * 📊 ACTUALIZAR MÉTRICAS
   */
  updateMetrics() {
    let totalEntries = 0;
    let estimatedMemory = 0;
    
    for (const managedMap of this.managedMaps.values()) {
      totalEntries += managedMap.size;
      estimatedMemory += managedMap.getEstimatedMemoryUsage();
    }
    
    this.metrics.totalMaps = this.managedMaps.size;
    this.metrics.totalEntries = totalEntries;
    this.metrics.memoryUsage = estimatedMemory;
    
    // Emitir evento de métricas
    this.emit('metrics-updated', { ...this.metrics });
  }
  
  /**
   * ⚠️ VERIFICAR UMBRALES DE MEMORIA
   */
  checkMemoryThresholds() {
    const { memoryUsage } = this.metrics;
    
    if (memoryUsage > this.config.memoryCriticalThreshold) {
      this.triggerCriticalAlert('CRITICAL_MEMORY_USAGE', {
        current: memoryUsage,
        threshold: this.config.memoryCriticalThreshold,
        ratio: (memoryUsage / this.config.memoryCriticalThreshold).toFixed(2)
      });
    } else if (memoryUsage > this.config.memoryWarningThreshold) {
      // Solo loggear si no se ha loggeado recientemente (evitar spam)
      const now = Date.now();
      if (!this.lastMemoryWarning || (now - this.lastMemoryWarning) > 60000) { // 1 minuto
        this.triggerWarningAlert('HIGH_MEMORY_USAGE', {
          current: memoryUsage,
          threshold: this.config.memoryWarningThreshold,
          ratio: (memoryUsage / this.config.memoryWarningThreshold).toFixed(2)
        });
        this.lastMemoryWarning = now;
      }
    }
  }
  
  /**
   * 🚨 MANEJAR ALERTAS CRÍTICAS
   */
  triggerCriticalAlert(type, data) {
    this.metrics.alertsTriggered++;
    
    logger.error(`ALERTA CRÍTICA: ${type}`, {
      type,
      data,
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
      requiresAttention: true
    });
    
    // Forzar limpieza inmediata
    this.performGlobalCleanup();
    
    this.emit('critical-alert', { type, data });
  }
  
  /**
   * ⚠️ MANEJAR ALERTAS DE ADVERTENCIA
   */
  triggerWarningAlert(type, data) {
    // Cambiar de warn a debug para reducir ruido
    logger.debug(`ALERTA: ${type}`, {
      type,
      data,
      timestamp: new Date().toISOString(),
      severity: 'WARNING'
    });
    
    this.emit('warning-alert', { type, data });
  }
  
  /**
   * 🎯 HANDLERS POR DEFECTO
   */
  defaultEvictionHandler(key, value, reason, mapName) {
    // Log removido para reducir ruido en producción
  }
  
  defaultWarningHandler(message, data, mapName) {
    logger.warn(`Advertencia en '${mapName}': ${message}`, data);
  }
  
  /**
   * 🛡️ CONFIGURAR GRACEFUL SHUTDOWN
   */
  setupGracefulShutdown() {
    const shutdown = () => {
      logger.info('Iniciando graceful shutdown de MemoryManager...');
      
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }
      
      if (this.metricsTimer) {
        clearInterval(this.metricsTimer);
        this.metricsTimer = null;
      }
      
      // Limpiar todos los mapas
      for (const [name, managedMap] of this.managedMaps.entries()) {
        try {
          managedMap.destroy();
          // Log removido para reducir ruido en producción
        } catch (error) {
          logger.error(`Error destruyendo '${name}' en shutdown`, error);
        }
      }
      
      this.managedMaps.clear();
      
      logger.info('MemoryManager shutdown completado');
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('uncaughtException', (error) => {
      logger.error('UncaughtException en MemoryManager', {
        error: error.message,
        stack: error.stack
      });
      shutdown();
    });
  }
  
  /**
   * 📊 OBTENER ESTADÍSTICAS COMPLETAS
   */
  getStats() {
    const mapStats = {};
    
    for (const [name, managedMap] of this.managedMaps.entries()) {
      mapStats[name] = managedMap.getStats();
    }
    
    return {
      global: {
        ...this.metrics,
        uptime: process.uptime(),
        nodeMemory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      },
      maps: mapStats,
      config: {
        maxMapsPerInstance: this.config.maxMapsPerInstance,
        maxEntriesPerMap: this.config.maxEntriesPerMap,
        defaultTTL: this.config.defaultTTL,
        cleanupInterval: this.config.cleanupInterval
      },
      hardware: {
        totalMemory: totalMemory,
        availableMemory: availableMemory,
        totalMemoryGB: (totalMemory / (1024 * 1024 * 1024)).toFixed(2),
        availableMemoryGB: (availableMemory / (1024 * 1024 * 1024)).toFixed(2),
        memoryUsagePercent: ((process.memoryUsage().heapUsed / totalMemory) * 100).toFixed(2)
      },
      adaptiveLimits: {
        maxMapsPerInstance: adaptiveLimits.maxMapsPerInstance,
        maxEntriesPerMap: adaptiveLimits.maxEntriesPerMap,
        memoryWarningThreshold: adaptiveLimits.memoryWarningThreshold,
        memoryCriticalThreshold: adaptiveLimits.memoryCriticalThreshold,
        memoryWarningThresholdGB: (adaptiveLimits.memoryWarningThreshold / (1024 * 1024 * 1024)).toFixed(2),
        memoryCriticalThresholdGB: (adaptiveLimits.memoryCriticalThreshold / (1024 * 1024 * 1024)).toFixed(2)
      }
    };
  }
  
  /**
   * 🔍 OBTENER MAPA POR NOMBRE
   */
  getManagedMap(name) {
    return this.managedMaps.get(name);
  }
  
  /**
   * 📋 LISTAR MAPAS GESTIONADOS
   */
  listManagedMaps() {
    return Array.from(this.managedMaps.keys());
  }
  
  /**
   * 🔧 OBTENER INFORMACIÓN DE LÍMITES ADAPTATIVOS
   */
  getAdaptiveLimitsInfo() {
    return {
      hardware: {
        totalMemory: totalMemory,
        availableMemory: availableMemory,
        totalMemoryGB: (totalMemory / (1024 * 1024 * 1024)).toFixed(2),
        availableMemoryGB: (availableMemory / (1024 * 1024 * 1024)).toFixed(2),
        cpuCount: os.cpus().length,
        platform: os.platform(),
        arch: os.arch()
      },
      adaptiveLimits: {
        maxMapsPerInstance: adaptiveLimits.maxMapsPerInstance,
        maxEntriesPerMap: adaptiveLimits.maxEntriesPerMap,
        memoryWarningThreshold: adaptiveLimits.memoryWarningThreshold,
        memoryCriticalThreshold: adaptiveLimits.memoryCriticalThreshold,
        memoryWarningThresholdGB: (adaptiveLimits.memoryWarningThreshold / (1024 * 1024 * 1024)).toFixed(2),
        memoryCriticalThresholdGB: (adaptiveLimits.memoryCriticalThreshold / (1024 * 1024 * 1024)).toFixed(2)
      },
      currentConfig: {
        maxMapsPerInstance: this.config.maxMapsPerInstance,
        maxEntriesPerMap: this.config.maxEntriesPerMap,
        memoryWarningThreshold: this.config.memoryWarningThreshold,
        memoryCriticalThreshold: this.config.memoryCriticalThreshold
      },
      explanation: {
        maxMapsPerInstance: `Calculado como ${Math.floor(totalMemory / (50 * 1024 * 1024))} mapas (50MB por mapa)`,
        maxEntriesPerMap: `Calculado como ${Math.floor(availableMemory / (1024 * 1024))} entradas (1MB por entrada)`,
        memoryWarningThreshold: `70% de la RAM total (${(totalMemory * 0.7 / (1024 * 1024 * 1024)).toFixed(2)} GB)`,
        memoryCriticalThreshold: `90% de la RAM total (${(totalMemory * 0.9 / (1024 * 1024 * 1024)).toFixed(2)} GB)`
      }
    };
  }
}

/**
 * 🗺️ MAPA GESTIONADO CON TTL Y LÍMITES
 */
class ManagedMap {
  constructor(name, options = {}) {
    this.name = name;
    this.options = {
      maxEntries: options.maxEntries || 10000,
      defaultTTL: options.defaultTTL || 30 * 60 * 1000,
      onEviction: options.onEviction || (() => {}),
      onWarning: options.onWarning || (() => {}),
      enableStats: options.enableStats !== false
    };
    
    this.map = new Map();
    this.ttlMap = new Map(); // key -> expirationTime
    this.stats = {
      gets: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      hits: 0,
      misses: 0,
      cleanups: 0,
      created: Date.now()
    };
  }
  
  /**
   * 📝 ESTABLECER VALOR CON TTL
   */
  set(key, value, ttl = null) {
    const effectiveTTL = ttl || this.options.defaultTTL;
    const expirationTime = Date.now() + effectiveTTL;
    
    // Verificar límite antes de agregar
    if (!this.map.has(key) && this.map.size >= this.options.maxEntries) {
      this.evictOldest();
    }
    
    this.map.set(key, value);
    this.ttlMap.set(key, expirationTime);
    
    if (this.options.enableStats) {
      this.stats.sets++;
    }
    
    return this;
  }
  
  /**
   * 📖 OBTENER VALOR
   */
  get(key) {
    if (this.options.enableStats) {
      this.stats.gets++;
    }
    
    if (!this.map.has(key)) {
      if (this.options.enableStats) {
        this.stats.misses++;
      }
      return undefined;
    }
    
    // Verificar TTL
    const expirationTime = this.ttlMap.get(key);
    if (expirationTime && Date.now() > expirationTime) {
      this.delete(key, 'expired');
      if (this.options.enableStats) {
        this.stats.misses++;
      }
      return undefined;
    }
    
    if (this.options.enableStats) {
      this.stats.hits++;
    }
    
    return this.map.get(key);
  }
  
  /**
   * 🗑️ ELIMINAR VALOR
   */
  delete(key, reason = 'manual') {
    const existed = this.map.has(key);
    
    if (existed) {
      const value = this.map.get(key);
      this.map.delete(key);
      this.ttlMap.delete(key);
      
      if (this.options.enableStats) {
        this.stats.deletes++;
        if (reason !== 'manual') {
          this.stats.evictions++;
        }
      }
      
      this.options.onEviction(key, value, reason, this.name);
    }
    
    return existed;
  }
  
  /**
   * 🚮 EXPULSAR MÁS ANTIGUO
   */
  evictOldest() {
    if (this.map.size === 0) return;
    
    // Encontrar la entrada más antigua por TTL
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [key, expirationTime] of this.ttlMap.entries()) {
      if (expirationTime < oldestTime) {
        oldestTime = expirationTime;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.delete(oldestKey, 'evicted-oldest');
      this.options.onWarning('Entrada expulsada por límite de tamaño', {
        key: oldestKey,
        size: this.map.size,
        maxEntries: this.options.maxEntries
      }, this.name);
    }
  }
  
  /**
   * 🧹 LIMPIAR ENTRADAS EXPIRADAS
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, expirationTime] of this.ttlMap.entries()) {
      if (now > expirationTime) {
        this.delete(key, 'expired');
        cleaned++;
      }
    }
    
    if (this.options.enableStats && cleaned > 0) {
      this.stats.cleanups++;
    }
    
    return cleaned;
  }
  
  /**
   * 📏 OBTENER TAMAÑO
   */
  get size() {
    return this.map.size;
  }
  
  /**
   * 🗑️ LIMPIAR TODO
   */
  clear() {
    const size = this.map.size;
    this.map.clear();
    this.ttlMap.clear();
    
    if (this.options.enableStats) {
      this.stats.deletes += size;
    }
    
    return size;
  }
  
  /**
   * 🔍 VERIFICAR EXISTENCIA
   */
  has(key) {
    if (!this.map.has(key)) {
      return false;
    }
    
    // Verificar TTL
    const expirationTime = this.ttlMap.get(key);
    if (expirationTime && Date.now() > expirationTime) {
      this.delete(key, 'expired');
      return false;
    }
    
    return true;
  }
  
  /**
   * 📊 OBTENER ESTADÍSTICAS
   */
  getStats() {
    const hitRate = this.stats.gets > 0 ? 
      (this.stats.hits / this.stats.gets * 100).toFixed(2) : 0;
    
    return {
      ...this.stats,
      size: this.map.size,
      maxEntries: this.options.maxEntries,
      hitRate: `${hitRate}%`,
      memoryEstimate: this.getEstimatedMemoryUsage(),
      uptime: Date.now() - this.stats.created
    };
  }
  
  /**
   * 📈 ESTIMAR USO DE MEMORIA
   */
  getEstimatedMemoryUsage() {
    // Estimación básica: 
    // - Cada entrada en Map: ~50 bytes overhead
    // - TTL Map: ~50 bytes overhead por entrada
    // - Contenido: estimación promedio de 200 bytes por valor
    
    const overhead = this.map.size * 100; // 50 bytes * 2 maps
    const content = this.map.size * 200; // Estimación del contenido
    
    return overhead + content;
  }
  
  /**
   * 🔧 DESTRUIR MAPA
   */
  destroy() {
    this.clear();
    this.options.onEviction = null;
    this.options.onWarning = null;
  }
  
  /**
   * 🗂️ OBTENER TODAS LAS CLAVES
   */
  keys() {
    // Limpiar expirados antes de retornar claves
    this.cleanup();
    return this.map.keys();
  }
  
  /**
   * 📄 OBTENER TODOS LOS VALORES
   */
  values() {
    // Limpiar expirados antes de retornar valores
    this.cleanup();
    return this.map.values();
  }
  
  /**
   * 📑 OBTENER TODAS LAS ENTRADAS
   */
  entries() {
    // Limpiar expirados antes de retornar entradas
    this.cleanup();
    return this.map.entries();
  }
}

// Singleton para uso global
const memoryManager = new AdvancedMemoryManager();

module.exports = {
  AdvancedMemoryManager,
  ManagedMap,
  memoryManager
}; 