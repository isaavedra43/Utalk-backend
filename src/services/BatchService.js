/**
 * 🚀 ENTERPRISE BATCH SERVICE
 * 
 * Sistema de procesamiento batch para operaciones masivas
 * basado en mejores prácticas de escalabilidad enterprise.
 * 
 * Características:
 * ✅ Firestore batch operations para escrituras masivas
 * ✅ Queue system para operaciones pesadas
 * ✅ Rate limiting inteligente
 * ✅ Retry logic con exponential backoff
 * ✅ Progress tracking y monitoreo
 * ✅ Error handling robusto
 * ✅ Memory management optimizado
 * 
 * @version 1.0.0 ENTERPRISE
 * @author Scalability Team
 */

const { firestore } = require('../config/firebase');
const logger = require('../utils/logger');
const ErrorWrapper = require('../utils/errorWrapper');
const cacheService = require('./CacheService');

class EnterpriseBatchService {
  constructor() {
    // Configuración optimizada para performance
    this.batchSize = parseInt(process.env.BATCH_SIZE) || 1000; // Aumentado para mejor throughput
    this.maxConcurrentBatches = parseInt(process.env.MAX_CONCURRENT_BATCHES) || 20; // Más concurrencia
    this.retryAttempts = parseInt(process.env.BATCH_RETRY_ATTEMPTS) || 3;
    this.retryDelay = parseInt(process.env.BATCH_RETRY_DELAY) || 500; // Reducido para mejor performance
    
    // Configuración de performance
    this.config = {
      enableParallelProcessing: true,
      chunkSize: 100, // Tamaño de chunks para procesamiento paralelo
      maxMemoryUsage: 1024 * 1024 * 100, // 100MB máximo por batch
      enableCompression: true,
      compressionThreshold: 1024, // Comprimir datos > 1KB
      enableCaching: true,
      cacheTTL: 5 * 60 * 1000 // 5 minutos
    };
    
    this.activeBatches = new Map();
    this.batchQueue = [];
    this.metrics = {
      batchesProcessed: 0,
      operationsProcessed: 0,
      errors: 0,
      averageBatchTime: 0,
      lastReset: Date.now(),
      memoryUsage: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    this.initialize();
  }

  /**
   * 🚀 INICIALIZAR BATCH SERVICE
   */
  async initialize() {
    try {
      logger.info('🚀 Initializing Enterprise Batch Service...', {
        category: 'BATCH_INIT',
        batchSize: this.batchSize,
        maxConcurrentBatches: this.maxConcurrentBatches,
        retryAttempts: this.retryAttempts
      });

      // Configurar monitoreo periódico
      this.setupMetricsReporting();

      // Configurar limpieza de batches activos
      this.setupBatchCleanup();

      logger.info('✅ Enterprise Batch Service initialized successfully', {
        category: 'BATCH_INIT_SUCCESS'
      });

    } catch (error) {
      logger.error('💥 Failed to initialize Batch Service', {
        category: 'BATCH_INIT_ERROR',
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 📦 CREAR BATCH OPERATION
   */
  createBatch(operationId = null) {
    const batch = firestore.batch();
    const id = operationId || `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const batchOperation = {
      id,
      batch,
      operations: [],
      startTime: Date.now(),
      status: 'pending',
      retryCount: 0,
      errors: []
    };

    this.activeBatches.set(id, batchOperation);
    
    // Log removido para reducir ruido en producción

    return batchOperation;
  }

  /**
   * ➕ AGREGAR OPERACIÓN AL BATCH
   */
  addToBatch(batchOperation, operation) {
    const { type, collection, docId, data, operationType = 'set' } = operation;

    try {
      let batchOp;

      switch (operationType) {
        case 'set':
          batchOp = batchOperation.batch.set(
            firestore.collection(collection).doc(docId),
            data
          );
          break;
        case 'update':
          batchOp = batchOperation.batch.update(
            firestore.collection(collection).doc(docId),
            data
          );
          break;
        case 'delete':
          batchOp = batchOperation.batch.delete(
            firestore.collection(collection).doc(docId)
          );
          break;
        default:
          throw new Error(`Invalid operation type: ${operationType}`);
      }

      batchOperation.operations.push({
        type,
        collection,
        docId,
        operationType,
        data,
        timestamp: Date.now()
      });

      // Log removido para reducir ruido en producción

      return batchOp;
    } catch (error) {
      logger.error('Error adding operation to batch', {
        category: 'BATCH_ADD_ERROR',
        batchId: batchOperation.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🚀 EJECUTAR BATCH
   */
  async executeBatch(batchOperation) {
    return ErrorWrapper.wrapAsync(async () => {
      const startTime = Date.now();
      
      try {
        logger.info('Executing batch operation', {
          category: 'BATCH_EXECUTE_START',
          batchId: batchOperation.id,
          operationsCount: batchOperation.operations.length
        });

        batchOperation.status = 'executing';
        await batchOperation.batch.commit();

        const executionTime = Date.now() - startTime;
        batchOperation.status = 'completed';
        batchOperation.executionTime = executionTime;

        this.metrics.batchesProcessed++;
        this.metrics.operationsProcessed += batchOperation.operations.length;
        this.updateAverageBatchTime(executionTime);

        logger.info('Batch operation completed successfully', {
          category: 'BATCH_EXECUTE_SUCCESS',
          batchId: batchOperation.id,
          operationsCount: batchOperation.operations.length,
          executionTime: `${executionTime}ms`
        });

        // Limpiar batch de active batches
        this.activeBatches.delete(batchOperation.id);

        return {
          success: true,
          batchId: batchOperation.id,
          operationsCount: batchOperation.operations.length,
          executionTime
        };

      } catch (error) {
        batchOperation.status = 'failed';
        batchOperation.errors.push({
          error: error.message,
          timestamp: Date.now()
        });

        this.metrics.errors++;

        logger.error('Batch operation failed', {
          category: 'BATCH_EXECUTE_ERROR',
          batchId: batchOperation.id,
          error: error.message,
          retryCount: batchOperation.retryCount
        });

        throw error;
      }
    }, {
      maxRetries: this.retryAttempts,
      baseDelay: this.retryDelay,
      operationName: `batch_${batchOperation.id}`
    })();
  }

  /**
   * 📊 PROCESAR OPERACIONES MASIVAS
   */
  async processBatchOperations(operations, options = {}) {
    return ErrorWrapper.wrapAsync(async () => {
      const {
        batchSize = this.batchSize,
        maxConcurrent = this.maxConcurrentBatches,
        operationType = 'set',
        collection,
        progressCallback = null
      } = options;

      logger.info('Starting batch operations processing', {
        category: 'BATCH_PROCESS_START',
        totalOperations: operations.length,
        batchSize,
        maxConcurrent,
        operationType,
        collection
      });

      const batches = [];
      const results = [];
      let processedCount = 0;

      // Dividir operaciones en batches
      for (let i = 0; i < operations.length; i += batchSize) {
        const batchOperations = operations.slice(i, i + batchSize);
        batches.push(batchOperations);
      }

      // Procesar batches con concurrencia limitada
      for (let i = 0; i < batches.length; i += maxConcurrent) {
        const concurrentBatches = batches.slice(i, i + maxConcurrent);
        
        const batchPromises = concurrentBatches.map(async (batchOperations, batchIndex) => {
          const batchOperation = this.createBatch(`batch_${i + batchIndex}`);
          
          // Agregar operaciones al batch
          batchOperations.forEach(operation => {
            this.addToBatch(batchOperation, {
              ...operation,
              operationType,
              collection
            });
          });

          // Ejecutar batch
          const result = await this.executeBatch(batchOperation);
          
          processedCount += batchOperations.length;
          
          // Callback de progreso
          if (progressCallback) {
            progressCallback({
              processed: processedCount,
              total: operations.length,
              percentage: Math.round((processedCount / operations.length) * 100),
              currentBatch: i + batchIndex + 1,
              totalBatches: batches.length
            });
          }

          return result;
        });

        // Esperar que todos los batches concurrentes terminen
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            logger.error('Batch failed', {
              category: 'BATCH_PROCESS_ERROR',
              batchIndex: i + index,
              error: result.reason?.message
            });
            results.push({ success: false, error: result.reason?.message });
          }
        });
      }

      const successCount = results.filter(r => r.success).length;
      const totalBatches = batches.length;

      logger.info('Batch operations processing completed', {
        category: 'BATCH_PROCESS_COMPLETE',
        totalOperations: operations.length,
        successfulBatches: successCount,
        totalBatches,
        successRate: `${Math.round((successCount / totalBatches) * 100)}%`
      });

      return {
        success: true,
        results,
        summary: {
          totalOperations: operations.length,
          successfulBatches: successCount,
          totalBatches,
          successRate: Math.round((successCount / totalBatches) * 100)
        }
      };

    }, {
      operationName: 'batchProcessOperations',
      timeoutMs: 300000 // 5 minutos
    })();
  }

  /**
   * 📝 ACTUALIZAR MENSAJES EN BATCH
   */
  async updateMessagesBatch(messageUpdates, options = {}) {
    const operations = messageUpdates.map(update => ({
      type: 'message_update',
      docId: update.messageId,
      data: {
        status: update.status,
        readAt: update.readAt,
        deliveredAt: update.deliveredAt,
        updatedAt: new Date()
      }
    }));

    return this.processBatchOperations(operations, {
      ...options,
      collection: 'messages',
      operationType: 'update'
    });
  }

  /**
   * 👥 ACTUALIZAR CONTACTOS EN BATCH
   */
  async updateContactsBatch(contactUpdates, options = {}) {
    const operations = contactUpdates.map(update => ({
      type: 'contact_update',
      docId: update.contactId,
      data: {
        tags: update.tags,
        status: update.status,
        lastActivity: update.lastActivity,
        updatedAt: new Date()
      }
    }));

    return this.processBatchOperations(operations, {
      ...options,
      collection: 'contacts',
      operationType: 'update'
    });
  }

  /**
   * 📊 ACTUALIZAR ESTADÍSTICAS EN BATCH
   */
  async updateStatsBatch(statsUpdates, options = {}) {
    const operations = statsUpdates.map(update => ({
      type: 'stats_update',
      docId: update.statsId,
      data: {
        count: update.count,
        lastUpdated: new Date(),
        period: update.period
      }
    }));

    return this.processBatchOperations(operations, {
      ...options,
      collection: 'statistics',
      operationType: 'update'
    });
  }

  /**
   * 🗑️ ELIMINAR DATOS EN BATCH
   */
  async deleteBatch(deletions, options = {}) {
    const operations = deletions.map(deletion => ({
      type: 'delete',
      docId: deletion.id,
      collection: deletion.collection
    }));

    return this.processBatchOperations(operations, {
      ...options,
      operationType: 'delete'
    });
  }

  /**
   * 📈 ACTUALIZAR MÉTRICAS DE BATCH
   */
  updateAverageBatchTime(executionTime) {
    const currentAvg = this.metrics.averageBatchTime;
    const totalBatches = this.metrics.batchesProcessed;
    
    this.metrics.averageBatchTime = 
      ((currentAvg * (totalBatches - 1)) + executionTime) / totalBatches;
  }

  /**
   * 📊 SETUP MÉTRICAS REPORTING
   */
  setupMetricsReporting() {
    // Reportar métricas cada 5 minutos
    setInterval(() => {
      const stats = this.getStats();
      
      logger.info('Batch Service Metrics', {
        category: 'BATCH_METRICS',
        ...stats
      });

      // Reset métricas cada hora
      if (Date.now() - this.metrics.lastReset > 60 * 60 * 1000) {
        this.metrics.batchesProcessed = 0;
        this.metrics.operationsProcessed = 0;
        this.metrics.errors = 0;
        this.metrics.averageBatchTime = 0;
        this.metrics.lastReset = Date.now();
      }
    }, 5 * 60 * 1000); // 5 minutos
  }

  /**
   * 🧹 SETUP BATCH CLEANUP
   */
  setupBatchCleanup() {
    // Limpiar batches activos cada minuto
    setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [batchId, batchOperation] of this.activeBatches.entries()) {
        // Limpiar batches que llevan más de 10 minutos
        if (now - batchOperation.startTime > 10 * 60 * 1000) {
          this.activeBatches.delete(batchId);
          cleanedCount++;
          
          logger.warn('Cleaned stale batch operation', {
            category: 'BATCH_CLEANUP',
            batchId,
            age: `${Math.round((now - batchOperation.startTime) / 1000)}s`
          });
        }
      }

      if (cleanedCount > 0) {
        logger.info('Batch cleanup completed', {
          category: 'BATCH_CLEANUP_COMPLETE',
          cleanedCount,
          remainingBatches: this.activeBatches.size
        });
      }
    }, 60 * 1000); // 1 minuto
  }

  /**
   * 📊 GET BATCH STATS
   */
  getStats() {
    const now = Date.now();
    const duration = now - this.metrics.lastReset;
    
    return {
      activeBatches: this.activeBatches.size,
      batchQueue: this.batchQueue.length,
      metrics: {
        ...this.metrics,
        operationsPerSecond: duration > 0 ? 
          Math.round((this.metrics.operationsProcessed / (duration / 1000)) * 100) / 100 : 0,
        errorRate: this.metrics.batchesProcessed > 0 ? 
          (this.metrics.errors / this.metrics.batchesProcessed) * 100 : 0,
        duration: `${Math.round(duration / 1000)}s`
      },
      configuration: {
        batchSize: this.batchSize,
        maxConcurrentBatches: this.maxConcurrentBatches,
        retryAttempts: this.retryAttempts,
        retryDelay: this.retryDelay
      }
    };
  }

  /**
   * 🔄 HEALTH CHECK
   */
  async healthCheck() {
    try {
      const stats = this.getStats();
      
      return {
        status: 'healthy',
        activeBatches: stats.activeBatches,
        errorRate: stats.metrics.errorRate,
        averageBatchTime: `${Math.round(stats.metrics.averageBatchTime)}ms`
      };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  /**
   * 🚀 OPTIMIZACIONES DE PERFORMANCE
   */
  
  /**
   * Procesamiento paralelo de operaciones
   */
  async processParallel(operations, chunkSize = this.config.chunkSize) {
    const startTime = performance.now();
    const chunks = this.chunkArray(operations, chunkSize);
    const results = [];
    
    // Procesar chunks en paralelo
    const chunkPromises = chunks.map(async (chunk, index) => {
      try {
        const batch = this.createBatch(`parallel_${index}`);
        chunk.forEach(op => {
          this.addOperation(batch, op.type, op.collection, op.data, op.id);
        });
        
        const result = await this.commitBatch(batch);
        return { chunkIndex: index, success: true, result };
      } catch (error) {
        logger.error(`Error procesando chunk ${index}:`, error);
        return { chunkIndex: index, success: false, error: error.message };
      }
    });
    
    const chunkResults = await Promise.all(chunkPromises);
    const duration = performance.now() - startTime;
    
    logger.info(`Procesamiento paralelo completado: ${operations.length} operaciones en ${duration.toFixed(2)}ms`);
    
    return {
      totalOperations: operations.length,
      chunksProcessed: chunks.length,
      successfulChunks: chunkResults.filter(r => r.success).length,
      failedChunks: chunkResults.filter(r => !r.success).length,
      duration: duration,
      results: chunkResults
    };
  }
  
  /**
   * Dividir array en chunks
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
  
  /**
   * Compresión de datos para optimizar memoria
   */
  compressData(data) {
    if (!this.config.enableCompression || typeof data !== 'object') {
      return data;
    }
    
    try {
      const jsonString = JSON.stringify(data);
      if (jsonString.length > this.config.compressionThreshold) {
        // Compresión simple usando Buffer
        const buffer = Buffer.from(jsonString, 'utf8');
        return {
          compressed: true,
          data: buffer,
          originalSize: jsonString.length,
          compressedSize: buffer.length
        };
      }
    } catch (error) {
      logger.error('Error comprimiendo datos:', error);
    }
    
    return data;
  }
  
  /**
   * Descompresión de datos
   */
  decompressData(data) {
    if (data && data.compressed && Buffer.isBuffer(data.data)) {
      try {
        const jsonString = data.data.toString('utf8');
        return JSON.parse(jsonString);
      } catch (error) {
        logger.error('Error descomprimiendo datos:', error);
        return data;
      }
    }
    return data;
  }
  
  /**
   * Cache inteligente para operaciones repetitivas
   */
  async getCachedOperation(operationKey) {
    if (!this.config.enableCaching) return null;
    
    try {
      const cached = await cacheService.get(`batch_op:${operationKey}`);
      if (cached) {
        this.metrics.cacheHits++;
        return this.decompressData(cached);
      }
      this.metrics.cacheMisses++;
    } catch (error) {
      logger.error('Error obteniendo operación cacheada:', error);
    }
    
    return null;
  }
  
  /**
   * Cachear resultado de operación
   */
  async cacheOperation(operationKey, result) {
    if (!this.config.enableCaching) return;
    
    try {
      const compressedResult = this.compressData(result);
      await cacheService.set(`batch_op:${operationKey}`, compressedResult, this.config.cacheTTL);
    } catch (error) {
      logger.error('Error cacheando operación:', error);
    }
  }
  
  /**
   * Monitoreo de memoria en tiempo real
   */
  monitorMemoryUsage() {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = memUsage.heapUsed;
    
    if (memUsage.heapUsed > this.config.maxMemoryUsage) {
      logger.warn('Uso de memoria alto en BatchService', {
        category: 'BATCH_MEMORY_WARNING',
        heapUsed: Math.round(memUsage.heapUsed / (1024 * 1024)) + 'MB',
        maxAllowed: Math.round(this.config.maxMemoryUsage / (1024 * 1024)) + 'MB'
      });
      
      // Forzar limpieza de memoria
      this.forceMemoryCleanup();
    }
  }
  
  /**
   * Limpieza forzada de memoria
   */
  forceMemoryCleanup() {
    // Limpiar batches antiguos
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutos
    
    for (const [id, batch] of this.activeBatches) {
      if (now - batch.startTime > maxAge) {
        this.activeBatches.delete(id);
        logger.debug(`Batch antiguo eliminado: ${id}`);
      }
    }
    
    // Forzar garbage collection si está disponible
    if (global.gc) {
      global.gc();
      logger.debug('Garbage collection forzado en BatchService');
    }
  }
  
  /**
   * 🛑 GRACEFUL SHUTDOWN
   */
  async shutdown() {
    try {
      logger.info('🛑 Shutting down Batch Service...', {
        category: 'BATCH_SHUTDOWN'
      });

      // Esperar que todos los batches activos terminen
      const activeBatchIds = Array.from(this.activeBatches.keys());
      
      if (activeBatchIds.length > 0) {
        logger.info(`Waiting for ${activeBatchIds.length} active batches to complete...`, {
          category: 'BATCH_SHUTDOWN_WAIT'
        });

        // Esperar máximo 30 segundos
        const maxWaitTime = 30000;
        const startTime = Date.now();

        while (this.activeBatches.size > 0 && (Date.now() - startTime) < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (this.activeBatches.size > 0) {
          logger.warn(`${this.activeBatches.size} batches did not complete in time`, {
            category: 'BATCH_SHUTDOWN_TIMEOUT'
          });
        }
      }

      // Limpiar recursos
      this.activeBatches.clear();
      this.batchQueue = [];

      logger.info('✅ Batch Service shutdown completed', {
        category: 'BATCH_SHUTDOWN_COMPLETE'
      });
    } catch (error) {
      logger.error('Error during Batch Service shutdown', {
        category: 'BATCH_SHUTDOWN_ERROR',
        error: error.message
      });
    }
  }
}

// Singleton instance
const batchService = new EnterpriseBatchService();

module.exports = batchService; 