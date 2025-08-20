const logger = require('../utils/logger');
const { cacheService } = require('./CacheService');

/**
 * PerformanceMetricsService - Monitoreo de rendimiento
 * 
 * Recopila métricas de rendimiento de repositorios y queries
 * para identificar cuellos de botella y optimizaciones
 */
class PerformanceMetricsService {
  constructor() {
    this.metrics = {
      queries: new Map(),
      repositories: new Map(),
      cache: new Map(),
      errors: new Map()
    };
    
    this.startTime = Date.now();
    this.batchSize = 50; // Procesar métricas en lotes
    this.batchTimer = null;
    this.pendingMetrics = [];
    
    // Configuración de performance
    this.config = {
      slowQueryThreshold: 500, // ms
      batchInterval: 5000, // 5 segundos
      maxMetricsPerBatch: 100,
      enableRealTimeAlerts: true,
      compressionThreshold: 1000 // Comprimir métricas después de 1000 entradas
    };
    
    // Iniciar procesamiento por lotes
    this.startBatchProcessing();
    
    logger.info('PerformanceMetricsService inicializado con optimizaciones', {
      category: 'PERFORMANCE_METRICS_INIT',
      batchSize: this.batchSize,
      batchInterval: this.config.batchInterval
    });
  }

  /**
   * Registrar métrica de query
   */
  recordQuery(operation, collection, queryTime, success = true, error = null) {
    const key = `${operation}:${collection}`;
    const metric = this.metrics.queries.get(key) || {
      operation,
      collection,
      totalQueries: 0,
      totalTime: 0,
      avgTime: 0,
      minTime: Infinity,
      maxTime: 0,
      successCount: 0,
      errorCount: 0,
      lastQuery: null
    };

    metric.totalQueries++;
    metric.totalTime += queryTime;
    metric.avgTime = metric.totalTime / metric.totalQueries;
    metric.minTime = Math.min(metric.minTime, queryTime);
    metric.maxTime = Math.max(metric.maxTime, queryTime);
    metric.lastQuery = new Date();

    if (success) {
      metric.successCount++;
    } else {
      metric.errorCount++;
    }

    this.metrics.queries.set(key, metric);

    // Log métricas si la query es lenta (>500ms)
    if (queryTime > 500) {
      logger.warn('Query lenta detectada', {
        category: 'PERFORMANCE_SLOW_QUERY',
        operation,
        collection,
        queryTime: `${queryTime}ms`,
        avgTime: `${metric.avgTime.toFixed(2)}ms`,
        totalQueries: metric.totalQueries
      });
    }
  }

  /**
   * Registrar métrica de repositorio
   */
  recordRepository(repositoryName, method, queryTime, success = true, cacheHit = false) {
    const key = `${repositoryName}:${method}`;
    const metric = this.metrics.repositories.get(key) || {
      repositoryName,
      method,
      totalCalls: 0,
      totalTime: 0,
      avgTime: 0,
      minTime: Infinity,
      maxTime: 0,
      successCount: 0,
      errorCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastCall: null
    };

    metric.totalCalls++;
    metric.totalTime += queryTime;
    metric.avgTime = metric.totalTime / metric.totalCalls;
    metric.minTime = Math.min(metric.minTime, queryTime);
    metric.maxTime = Math.max(metric.maxTime, queryTime);
    metric.lastCall = new Date();

    if (success) {
      metric.successCount++;
    } else {
      metric.errorCount++;
    }

    if (cacheHit) {
      metric.cacheHits++;
    } else {
      metric.cacheMisses++;
    }

    this.metrics.repositories.set(key, metric);

    // Log métricas si el método es lento (>200ms)
    if (queryTime > 200) {
      logger.warn('Método de repositorio lento', {
        category: 'PERFORMANCE_SLOW_REPOSITORY',
        repositoryName,
        method,
        queryTime: `${queryTime}ms`,
        avgTime: `${metric.avgTime.toFixed(2)}ms`,
        cacheHit,
        totalCalls: metric.totalCalls
      });
    }
  }

  /**
   * Registrar métrica de caché
   */
  recordCache(cacheName, operation, success = true, hit = false) {
    const key = `${cacheName}:${operation}`;
    const metric = this.metrics.cache.get(key) || {
      cacheName,
      operation,
      totalOperations: 0,
      hits: 0,
      misses: 0,
      errors: 0,
      hitRate: 0,
      lastOperation: null
    };

    metric.totalOperations++;
    metric.lastOperation = new Date();

    if (success) {
      if (hit) {
        metric.hits++;
      } else {
        metric.misses++;
      }
    } else {
      metric.errors++;
    }

    metric.hitRate = metric.hits / (metric.hits + metric.misses) * 100;

    this.metrics.cache.set(key, metric);

    // Log métricas de caché si hit rate es bajo (<50%)
    if (metric.totalOperations > 10 && metric.hitRate < 50) {
      logger.warn('Hit rate de caché bajo', {
        category: 'PERFORMANCE_LOW_CACHE_HIT_RATE',
        cacheName,
        operation,
        hitRate: `${metric.hitRate.toFixed(2)}%`,
        hits: metric.hits,
        misses: metric.misses,
        totalOperations: metric.totalOperations
      });
    }
  }

  /**
   * Registrar error de rendimiento
   */
  recordError(operation, error, context = {}) {
    const key = `${operation}:${error.name || 'Unknown'}`;
    const metric = this.metrics.errors.get(key) || {
      operation,
      errorType: error.name || 'Unknown',
      count: 0,
      lastError: null,
      contexts: []
    };

    metric.count++;
    metric.lastError = new Date();
    metric.contexts.push({
      timestamp: new Date(),
      message: error.message,
      context
    });

    // Mantener solo los últimos 10 contextos
    if (metric.contexts.length > 10) {
      metric.contexts = metric.contexts.slice(-10);
    }

    this.metrics.errors.set(key, metric);

    logger.error('Error de rendimiento registrado', {
      category: 'PERFORMANCE_ERROR',
      operation,
      errorType: error.name,
      errorMessage: error.message,
      count: metric.count,
      context
    });
  }

  /**
   * Obtener métricas de queries
   */
  getQueryMetrics() {
    const metrics = [];
    for (const [key, metric] of this.metrics.queries) {
      metrics.push({
        ...metric,
        key,
        successRate: (metric.successCount / metric.totalQueries * 100).toFixed(2) + '%'
      });
    }
    return metrics.sort((a, b) => b.totalQueries - a.totalQueries);
  }

  /**
   * Obtener métricas de repositorios
   */
  getRepositoryMetrics() {
    const metrics = [];
    for (const [key, metric] of this.metrics.repositories) {
      metrics.push({
        ...metric,
        key,
        successRate: (metric.successCount / metric.totalCalls * 100).toFixed(2) + '%',
        cacheHitRate: metric.cacheHits + metric.cacheMisses > 0 
          ? (metric.cacheHits / (metric.cacheHits + metric.cacheMisses) * 100).toFixed(2) + '%'
          : '0%'
      });
    }
    return metrics.sort((a, b) => b.totalCalls - a.totalCalls);
  }

  /**
   * Obtener métricas de caché
   */
  getCacheMetrics() {
    const metrics = [];
    for (const [key, metric] of this.metrics.cache) {
      metrics.push({
        ...metric,
        key,
        hitRate: metric.hitRate.toFixed(2) + '%'
      });
    }
    return metrics.sort((a, b) => b.totalOperations - a.totalOperations);
  }

  /**
   * Obtener métricas de errores
   */
  getErrorMetrics() {
    const metrics = [];
    for (const [key, metric] of this.metrics.errors) {
      metrics.push({
        ...metric,
        key
      });
    }
    return metrics.sort((a, b) => b.count - a.count);
  }

  /**
   * Obtener resumen de métricas
   */
  getSummary() {
    const uptime = Date.now() - this.startTime;
    const queryMetrics = this.getQueryMetrics();
    const repositoryMetrics = this.getRepositoryMetrics();
    const cacheMetrics = this.getCacheMetrics();
    const errorMetrics = this.getErrorMetrics();

    const totalQueries = queryMetrics.reduce((sum, m) => sum + m.totalQueries, 0);
    const totalRepositoryCalls = repositoryMetrics.reduce((sum, m) => sum + m.totalCalls, 0);
    const totalCacheOperations = cacheMetrics.reduce((sum, m) => sum + m.totalOperations, 0);
    const totalErrors = errorMetrics.reduce((sum, m) => sum + m.count, 0);

    const avgQueryTime = totalQueries > 0 
      ? queryMetrics.reduce((sum, m) => sum + m.totalTime, 0) / totalQueries 
      : 0;

    const avgRepositoryTime = totalRepositoryCalls > 0
      ? repositoryMetrics.reduce((sum, m) => sum + m.totalTime, 0) / totalRepositoryCalls
      : 0;

    return {
      uptime: `${Math.floor(uptime / 1000)}s`,
      totalQueries,
      totalRepositoryCalls,
      totalCacheOperations,
      totalErrors,
      avgQueryTime: `${avgQueryTime.toFixed(2)}ms`,
      avgRepositoryTime: `${avgRepositoryTime.toFixed(2)}ms`,
      topSlowQueries: queryMetrics
        .filter(m => m.avgTime > 100)
        .slice(0, 5)
        .map(m => ({
          operation: m.operation,
          collection: m.collection,
          avgTime: `${m.avgTime.toFixed(2)}ms`,
          totalQueries: m.totalQueries
        })),
      topSlowRepositories: repositoryMetrics
        .filter(m => m.avgTime > 50)
        .slice(0, 5)
        .map(m => ({
          repository: m.repositoryName,
          method: m.method,
          avgTime: `${m.avgTime.toFixed(2)}ms`,
          totalCalls: m.totalCalls
        })),
      cachePerformance: cacheMetrics
        .filter(m => m.totalOperations > 5)
        .map(m => ({
          cache: m.cacheName,
          operation: m.operation,
          hitRate: m.hitRate.toFixed(2) + '%',
          totalOperations: m.totalOperations
        }))
    };
  }

  /**
   * 🚀 OPTIMIZACIONES DE PERFORMANCE
   */
  
  /**
   * Procesamiento por lotes para reducir overhead
   */
  startBatchProcessing() {
    this.batchTimer = setInterval(() => {
      this.processBatchMetrics();
    }, this.config.batchInterval);
  }
  
  /**
   * Procesar métricas en lotes
   */
  processBatchMetrics() {
    if (this.pendingMetrics.length === 0) return;
    
    const startTime = performance.now();
    const batch = this.pendingMetrics.splice(0, this.config.maxMetricsPerBatch);
    
    // Procesar métricas en paralelo
    const promises = batch.map(metric => {
      switch (metric.type) {
        case 'query':
          return this.processQueryMetric(metric);
        case 'repository':
          return this.processRepositoryMetric(metric);
        case 'cache':
          return this.processCacheMetric(metric);
        case 'error':
          return this.processErrorMetric(metric);
        default:
          return Promise.resolve();
      }
    });
    
    Promise.all(promises).then(() => {
      const duration = performance.now() - startTime;
      logger.debug(`Batch processing completado: ${batch.length} métricas en ${duration.toFixed(2)}ms`);
    });
  }
  
  /**
   * Procesar métrica de query optimizada
   */
  async processQueryMetric(metric) {
    const key = `${metric.operation}:${metric.collection}`;
    const existing = this.metrics.queries.get(key);
    
    if (existing) {
      // Actualizar métrica existente de forma optimizada
      existing.totalQueries++;
      existing.totalTime += metric.queryTime;
      existing.avgTime = existing.totalTime / existing.totalQueries;
      existing.minTime = Math.min(existing.minTime, metric.queryTime);
      existing.maxTime = Math.max(existing.maxTime, metric.queryTime);
      existing.lastQuery = new Date();
      
      if (metric.success) {
        existing.successCount++;
      } else {
        existing.errorCount++;
      }
    } else {
      // Crear nueva métrica
      this.metrics.queries.set(key, {
        operation: metric.operation,
        collection: metric.collection,
        totalQueries: 1,
        totalTime: metric.queryTime,
        avgTime: metric.queryTime,
        minTime: metric.queryTime,
        maxTime: metric.queryTime,
        successCount: metric.success ? 1 : 0,
        errorCount: metric.success ? 0 : 1,
        lastQuery: new Date()
      });
    }
    
    // Alertas en tiempo real para queries lentas
    if (this.config.enableRealTimeAlerts && metric.queryTime > this.config.slowQueryThreshold) {
      logger.warn('Query lenta detectada (tiempo real)', {
        category: 'PERFORMANCE_SLOW_QUERY_REALTIME',
        operation: metric.operation,
        collection: metric.collection,
        queryTime: `${metric.queryTime}ms`,
        threshold: `${this.config.slowQueryThreshold}ms`
      });
    }
  }
  
  /**
   * Procesar métrica de repositorio optimizada
   */
  async processRepositoryMetric(metric) {
    const key = `${metric.repositoryName}:${metric.method}`;
    const existing = this.metrics.repositories.get(key);
    
    if (existing) {
      existing.totalCalls++;
      existing.totalTime += metric.queryTime;
      existing.avgTime = existing.totalTime / existing.totalCalls;
      existing.minTime = Math.min(existing.minTime, metric.queryTime);
      existing.maxTime = Math.max(existing.maxTime, metric.queryTime);
      existing.lastCall = new Date();
      
      if (metric.success) {
        existing.successCount++;
      } else {
        existing.errorCount++;
      }
      
      if (metric.cacheHit) {
        existing.cacheHits++;
      } else {
        existing.cacheMisses++;
      }
    } else {
      this.metrics.repositories.set(key, {
        repositoryName: metric.repositoryName,
        method: metric.method,
        totalCalls: 1,
        totalTime: metric.queryTime,
        avgTime: metric.queryTime,
        minTime: metric.queryTime,
        maxTime: metric.queryTime,
        successCount: metric.success ? 1 : 0,
        errorCount: metric.success ? 0 : 1,
        cacheHits: metric.cacheHit ? 1 : 0,
        cacheMisses: metric.cacheHit ? 0 : 1,
        lastCall: new Date()
      });
    }
  }
  
  /**
   * Procesar métrica de cache optimizada
   */
  async processCacheMetric(metric) {
    const key = `${metric.cacheName}:${metric.operation}`;
    const existing = this.metrics.cache.get(key);
    
    if (existing) {
      existing.totalOperations++;
      existing.totalTime += metric.operationTime;
      existing.avgTime = existing.totalTime / existing.totalOperations;
      existing.lastOperation = new Date();
      
      if (metric.success) {
        existing.successCount++;
      } else {
        existing.errorCount++;
      }
    } else {
      this.metrics.cache.set(key, {
        cacheName: metric.cacheName,
        operation: metric.operation,
        totalOperations: 1,
        totalTime: metric.operationTime,
        avgTime: metric.operationTime,
        successCount: metric.success ? 1 : 0,
        errorCount: metric.success ? 0 : 1,
        lastOperation: new Date()
      });
    }
  }
  
  /**
   * Procesar métrica de error optimizada
   */
  async processErrorMetric(metric) {
    const key = `${metric.type}:${metric.operation}`;
    const existing = this.metrics.errors.get(key);
    
    if (existing) {
      existing.count++;
      existing.lastError = new Date();
      existing.recentErrors.push({
        message: metric.error.message,
        timestamp: new Date(),
        stack: metric.error.stack?.split('\n').slice(0, 3)
      });
      
      // Mantener solo los últimos 10 errores
      if (existing.recentErrors.length > 10) {
        existing.recentErrors = existing.recentErrors.slice(-10);
      }
    } else {
      this.metrics.errors.set(key, {
        type: metric.type,
        operation: metric.operation,
        count: 1,
        lastError: new Date(),
        recentErrors: [{
          message: metric.error.message,
          timestamp: new Date(),
          stack: metric.error.stack?.split('\n').slice(0, 3)
        }]
      });
    }
  }
  
  /**
   * Compresión de métricas para ahorrar memoria
   */
  compressMetrics() {
    const compressionThreshold = this.config.compressionThreshold;
    
    for (const [key, metric] of this.metrics.queries) {
      if (metric.totalQueries > compressionThreshold) {
        // Comprimir métricas antiguas
        metric.avgTime = Math.round(metric.avgTime * 100) / 100;
        metric.minTime = Math.round(metric.minTime);
        metric.maxTime = Math.round(metric.maxTime);
      }
    }
    
    logger.debug('Métricas comprimidas para optimizar memoria');
  }
  
  /**
   * Limpiar métricas antiguas
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas

    // Limpiar métricas de queries antiguas
    for (const [key, metric] of this.metrics.queries) {
      if (now - metric.lastQuery.getTime() > maxAge) {
        this.metrics.queries.delete(key);
      }
    }

    // Limpiar métricas de repositorios antiguas
    for (const [key, metric] of this.metrics.repositories) {
      if (now - metric.lastCall.getTime() > maxAge) {
        this.metrics.repositories.delete(key);
      }
    }

    // Limpiar métricas de caché antiguas
    for (const [key, metric] of this.metrics.cache) {
      if (now - metric.lastOperation.getTime() > maxAge) {
        this.metrics.cache.delete(key);
      }
    }

    // Limpiar métricas de errores antiguas
    for (const [key, metric] of this.metrics.errors) {
      if (now - metric.lastError.getTime() > maxAge) {
        this.metrics.errors.delete(key);
      }
    }

    logger.info('Métricas de rendimiento limpiadas', {
      category: 'PERFORMANCE_METRICS_CLEANUP'
    });
  }

  /**
   * Resetear todas las métricas
   */
  reset() {
    this.metrics.queries.clear();
    this.metrics.repositories.clear();
    this.metrics.cache.clear();
    this.metrics.errors.clear();
    this.startTime = Date.now();

    logger.info('Métricas de rendimiento reseteadas', {
      category: 'PERFORMANCE_METRICS_RESET'
    });
  }
}

// Instancia singleton
const performanceMetricsService = new PerformanceMetricsService();

// Limpiar métricas cada hora
setInterval(() => {
  performanceMetricsService.cleanup();
}, 60 * 60 * 1000);

module.exports = performanceMetricsService; 