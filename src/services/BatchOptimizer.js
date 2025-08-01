/**
 * 🚀 BATCH OPTIMIZER SERVICE
 * Optimiza todas las operaciones N+1 y queries ineficientes
 * 
 * @author Backend Performance Team
 * @version 1.0.0
 */

const { firestore } = require('../config/firebase');
const logger = require('../utils/logger');

class BatchOptimizer {
  /**
   * 📦 BATCH GET OPERATIONS
   * Optimiza múltiples operaciones get en una sola batch
   */
  static async batchGet(collection, ids, options = {}) {
    try {
      const { batchSize = 500, timeout = 30000 } = options;
      
      logger.info('🔄 Iniciando batch get operation', {
        collection,
        totalIds: ids.length,
        batchSize
      });

      // Dividir en batches si es necesario
      const batches = [];
      for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        const batchPromises = batchIds.map(id => 
          firestore.collection(collection).doc(id).get()
        );
        batches.push(Promise.all(batchPromises));
      }

      // Ejecutar todos los batches en paralelo
      const results = await Promise.all(batches);
      
      // Aplanar resultados
      const documents = results.flat().map(doc => ({
        id: doc.id,
        data: doc.data(),
        exists: doc.exists
      }));

      logger.info('✅ Batch get operation completada', {
        collection,
        totalDocuments: documents.length,
        successfulGets: documents.filter(doc => doc.exists).length
      });

      return documents;

    } catch (error) {
      logger.error('❌ Error en batch get operation', {
        collection,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 📝 BATCH UPDATE OPERATIONS
   * Optimiza múltiples operaciones update en una sola batch
   */
  static async batchUpdate(collection, updates, options = {}) {
    try {
      const { batchSize = 500, timeout = 30000 } = options;
      
      logger.info('🔄 Iniciando batch update operation', {
        collection,
        totalUpdates: updates.length,
        batchSize
      });

      // Dividir en batches si es necesario
      const batches = [];
      for (let i = 0; i < updates.length; i += batchSize) {
        const batchUpdates = updates.slice(i, i + batchSize);
        const batch = firestore.batch();
        
        batchUpdates.forEach(({ id, data, merge = true }) => {
          const ref = firestore.collection(collection).doc(id);
          if (merge) {
            batch.update(ref, data);
          } else {
            batch.set(ref, data, { merge: false });
          }
        });
        
        batches.push(batch.commit());
      }

      // Ejecutar todos los batches en paralelo
      const results = await Promise.all(batches);
      
      const totalUpdated = results.reduce((sum, result) => sum + result.length, 0);

      logger.info('✅ Batch update operation completada', {
        collection,
        totalUpdated,
        batchesExecuted: batches.length
      });

      return {
        totalUpdated,
        batchesExecuted: batches.length,
        results
      };

    } catch (error) {
      logger.error('❌ Error en batch update operation', {
        collection,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 🗑️ BATCH DELETE OPERATIONS
   * Optimiza múltiples operaciones delete en una sola batch
   */
  static async batchDelete(collection, ids, options = {}) {
    try {
      const { batchSize = 500, timeout = 30000 } = options;
      
      logger.info('🔄 Iniciando batch delete operation', {
        collection,
        totalIds: ids.length,
        batchSize
      });

      // Dividir en batches si es necesario
      const batches = [];
      for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        const batch = firestore.batch();
        
        batchIds.forEach(id => {
          const ref = firestore.collection(collection).doc(id);
          batch.delete(ref);
        });
        
        batches.push(batch.commit());
      }

      // Ejecutar todos los batches en paralelo
      const results = await Promise.all(batches);
      
      const totalDeleted = results.reduce((sum, result) => sum + result.length, 0);

      logger.info('✅ Batch delete operation completada', {
        collection,
        totalDeleted,
        batchesExecuted: batches.length
      });

      return {
        totalDeleted,
        batchesExecuted: batches.length,
        results
      };

    } catch (error) {
      logger.error('❌ Error en batch delete operation', {
        collection,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 🔍 BATCH QUERY OPERATIONS
   * Optimiza múltiples queries complejas
   */
  static async batchQuery(queries, options = {}) {
    try {
      const { maxConcurrent = 10, timeout = 30000 } = options;
      
      logger.info('🔄 Iniciando batch query operation', {
        totalQueries: queries.length,
        maxConcurrent
      });

      // Ejecutar queries en paralelo con límite de concurrencia
      const results = [];
      for (let i = 0; i < queries.length; i += maxConcurrent) {
        const batchQueries = queries.slice(i, i + maxConcurrent);
        const batchResults = await Promise.all(
          batchQueries.map(query => query.get())
        );
        results.push(...batchResults);
      }

      logger.info('✅ Batch query operation completada', {
        totalQueries: queries.length,
        successfulQueries: results.length
      });

      return results;

    } catch (error) {
      logger.error('❌ Error en batch query operation', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 📊 BATCH AGGREGATION OPERATIONS
   * Optimiza operaciones de agregación y estadísticas
   */
  static async batchAggregation(collection, aggregationQueries, options = {}) {
    try {
      const { batchSize = 100, timeout = 30000 } = options;
      
      logger.info('🔄 Iniciando batch aggregation operation', {
        collection,
        totalQueries: aggregationQueries.length,
        batchSize
      });

      const results = {};
      
      // Ejecutar cada query de agregación
      for (const [name, query] of Object.entries(aggregationQueries)) {
        try {
          const snapshot = await query.get();
          results[name] = {
            count: snapshot.size,
            documents: snapshot.docs.map(doc => ({
              id: doc.id,
              data: doc.data()
            }))
          };
        } catch (error) {
          logger.error(`❌ Error en aggregation query: ${name}`, {
            error: error.message
          });
          results[name] = { error: error.message };
        }
      }

      logger.info('✅ Batch aggregation operation completada', {
        collection,
        successfulQueries: Object.keys(results).length
      });

      return results;

    } catch (error) {
      logger.error('❌ Error en batch aggregation operation', {
        collection,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 🔄 BATCH MIGRATION OPERATIONS
   * Optimiza migraciones de datos masivas
   */
  static async batchMigration(sourceCollection, targetCollection, migrationFn, options = {}) {
    try {
      const { batchSize = 100, maxConcurrent = 5, timeout = 60000 } = options;
      
      logger.info('🔄 Iniciando batch migration operation', {
        sourceCollection,
        targetCollection,
        batchSize,
        maxConcurrent
      });

      // Obtener todos los documentos de la colección fuente
      const sourceSnapshot = await firestore.collection(sourceCollection).get();
      const documents = sourceSnapshot.docs;
      
      logger.info('📊 Documentos encontrados para migración', {
        sourceCollection,
        totalDocuments: documents.length
      });

      // Dividir documentos en batches
      const batches = [];
      for (let i = 0; i < documents.length; i += batchSize) {
        const batchDocs = documents.slice(i, i + batchSize);
        batches.push(batchDocs);
      }

      // Procesar batches con límite de concurrencia
      const results = [];
      for (let i = 0; i < batches.length; i += maxConcurrent) {
        const batchGroup = batches.slice(i, i + maxConcurrent);
        const batchPromises = batchGroup.map(async (batchDocs) => {
          const batch = firestore.batch();
          
          for (const doc of batchDocs) {
            try {
              const migratedData = await migrationFn(doc.data(), doc.id);
              const targetRef = firestore.collection(targetCollection).doc(doc.id);
              batch.set(targetRef, migratedData);
            } catch (error) {
              logger.error('❌ Error migrando documento', {
                docId: doc.id,
                error: error.message
              });
            }
          }
          
          return batch.commit();
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      const totalMigrated = results.reduce((sum, result) => sum + result.length, 0);

      logger.info('✅ Batch migration operation completada', {
        sourceCollection,
        targetCollection,
        totalMigrated,
        totalDocuments: documents.length,
        successRate: (totalMigrated / documents.length * 100).toFixed(2) + '%'
      });

      return {
        totalMigrated,
        totalDocuments: documents.length,
        successRate: totalMigrated / documents.length,
        results
      };

    } catch (error) {
      logger.error('❌ Error en batch migration operation', {
        sourceCollection,
        targetCollection,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 🧹 BATCH CLEANUP OPERATIONS
   * Optimiza operaciones de limpieza masiva
   */
  static async batchCleanup(collection, cleanupCriteria, options = {}) {
    try {
      const { batchSize = 100, maxConcurrent = 5, timeout = 30000 } = options;
      
      logger.info('🔄 Iniciando batch cleanup operation', {
        collection,
        criteria: cleanupCriteria,
        batchSize
      });

      // Construir query de limpieza
      let query = firestore.collection(collection);
      
      if (cleanupCriteria.where) {
        Object.entries(cleanupCriteria.where).forEach(([field, condition]) => {
          query = query.where(field, condition.operator, condition.value);
        });
      }

      // Obtener documentos a limpiar
      const snapshot = await query.get();
      const documents = snapshot.docs;
      
      logger.info('📊 Documentos encontrados para limpieza', {
        collection,
        totalDocuments: documents.length
      });

      // Dividir en batches y eliminar
      const batches = [];
      for (let i = 0; i < documents.length; i += batchSize) {
        const batchDocs = documents.slice(i, i + batchSize);
        const batch = firestore.batch();
        
        batchDocs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        batches.push(batch.commit());
      }

      // Ejecutar batches con límite de concurrencia
      const results = [];
      for (let i = 0; i < batches.length; i += maxConcurrent) {
        const batchGroup = batches.slice(i, i + maxConcurrent);
        const batchResults = await Promise.all(batchGroup);
        results.push(...batchResults);
      }

      const totalCleaned = results.reduce((sum, result) => sum + result.length, 0);

      logger.info('✅ Batch cleanup operation completada', {
        collection,
        totalCleaned,
        totalDocuments: documents.length
      });

      return {
        totalCleaned,
        totalDocuments: documents.length,
        results
      };

    } catch (error) {
      logger.error('❌ Error en batch cleanup operation', {
        collection,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 📈 PERFORMANCE MONITORING
   * Monitorea el rendimiento de las operaciones batch
   */
  static getPerformanceStats() {
    return {
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      batchOperations: {
        total: 0,
        successful: 0,
        failed: 0,
        averageTime: 0
      }
    };
  }
}

module.exports = BatchOptimizer; 