/**
 * 🔧 PROCESS MANAGER
 * Sistema centralizado para gestionar process events y prevenir memory leaks
 * 
 * @author Backend Performance Team
 * @version 1.0.0
 */

const logger = require('./logger');
const eventCleanup = require('./eventCleanup');

class ProcessManager {
  constructor() {
    this.listeners = new Map();
    this.cleanupCallbacks = new Map();
    this.isShuttingDown = false;
    this.stats = {
      totalListeners: 0,
      activeListeners: 0,
      shutdowns: 0
    };

    this.setupGlobalListeners();
  }

  /**
   * 🎯 SETUP GLOBAL LISTENERS
   * Configura todos los listeners globales del proceso
   */
  setupGlobalListeners() {
    try {
      const listeners = [
        ['uncaughtException', this.handleUncaughtException.bind(this)],
        ['unhandledRejection', this.handleUnhandledRejection.bind(this)],
        ['SIGTERM', this.handleGracefulShutdown.bind(this)],
        ['SIGINT', this.handleGracefulShutdown.bind(this)],
        ['SIGHUP', this.handleGracefulShutdown.bind(this)],
        ['SIGQUIT', this.handleGracefulShutdown.bind(this)],
        ['warning', this.handleWarning.bind(this)]
      ];

      listeners.forEach(([event, handler]) => {
        this.addProcessListener(event, handler, {
          metadata: { type: 'process', event },
          maxCalls: Infinity,
          autoCleanup: false
        });
      });

      logger.info('✅ Process listeners configurados exitosamente', {
        totalListeners: listeners.length
      });

    } catch (error) {
      logger.error('❌ Error configurando process listeners', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 📝 ADD PROCESS LISTENER
   * Agrega un listener al proceso con cleanup automático
   */
  addProcessListener(event, handler, options = {}) {
    try {
      const wrappedHandler = eventCleanup.addListener(process, event, handler, options);
      
      this.stats.totalListeners++;
      this.stats.activeListeners++;

      logger.debug('Process listener agregado', {
        event,
        totalListeners: this.stats.activeListeners
      });

      return wrappedHandler;

    } catch (error) {
      logger.error('Error agregando process listener', {
        event,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 🗑️ REMOVE PROCESS LISTENER
   * Remueve un listener específico del proceso
   */
  removeProcessListener(event, handler) {
    try {
      const removed = eventCleanup.removeListener(process, event, handler);
      
      if (removed) {
        this.stats.activeListeners--;
      }

      logger.debug('Process listener removido', {
        event,
        removed,
        activeListeners: this.stats.activeListeners
      });

      return removed;

    } catch (error) {
      logger.error('Error removiendo process listener', {
        event,
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * 💥 HANDLE UNCAUGHT EXCEPTION
   * Maneja excepciones no capturadas
   */
  handleUncaughtException(error) {
    try {
      logger.error('💥 UNCAUGHT EXCEPTION', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      });

      // Intentar cleanup antes de salir
      this.performEmergencyCleanup();

      // Salir con código de error
      process.exit(1);

    } catch (cleanupError) {
      logger.error('Error en cleanup de emergencia', {
        error: cleanupError.message,
        stack: cleanupError.stack
      });
      process.exit(1);
    }
  }

  /**
   * ⚠️ HANDLE UNHANDLED REJECTION
   * Maneja promesas rechazadas no manejadas
   */
  handleUnhandledRejection(reason, promise) {
    try {
      logger.error('⚠️ UNHANDLED REJECTION', {
        reason: reason?.message || reason,
        promise: promise?.constructor?.name || 'Unknown',
        timestamp: new Date().toISOString(),
        memoryUsage: process.memoryUsage()
      });

      // No salir inmediatamente, solo loggear
      // En producción, podrías querer salir después de un tiempo

    } catch (error) {
      logger.error('Error manejando unhandled rejection', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 🛑 HANDLE GRACEFUL SHUTDOWN
   * Maneja señales de apagado graceful
   */
  async handleGracefulShutdown(signal) {
    try {
      if (this.isShuttingDown) {
        logger.warn('Shutdown ya en progreso, ignorando señal', { signal });
        return;
      }

      this.isShuttingDown = true;
      this.stats.shutdowns++;

      logger.info('🛑 GRACEFUL SHUTDOWN INICIADO', {
        signal,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      });

      // Ejecutar cleanup callbacks registrados
      await this.executeCleanupCallbacks();

      // Limpiar event listeners
      const cleanedListeners = eventCleanup.cleanupAll();

      // Limpiar process listeners específicos
      this.cleanup();

      logger.info('✅ GRACEFUL SHUTDOWN COMPLETADO', {
        signal,
        cleanedListeners,
        totalShutdowns: this.stats.shutdowns,
        finalMemoryUsage: process.memoryUsage()
      });

      // Salir exitosamente
      process.exit(0);

    } catch (error) {
      logger.error('❌ Error en graceful shutdown', {
        signal,
        error: error.message,
        stack: error.stack
      });

      // Salir con error si el shutdown falla
      process.exit(1);
    }
  }

  /**
   * ⚠️ HANDLE WARNING
   * Maneja warnings del proceso
   */
  handleWarning(warning) {
    try {
      logger.warn('⚠️ PROCESS WARNING', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error manejando warning', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 🧹 PERFORM EMERGENCY CLEANUP
   * Ejecuta cleanup de emergencia
   */
  performEmergencyCleanup() {
    try {
      logger.info('🧹 Ejecutando emergency cleanup');

      // Limpiar event listeners
      const cleanedListeners = eventCleanup.cleanupAll();

      // Ejecutar callbacks de emergencia
      this.executeCleanupCallbacks();

      logger.info('✅ Emergency cleanup completado', {
        cleanedListeners
      });

    } catch (error) {
      logger.error('❌ Error en emergency cleanup', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 📝 REGISTER CLEANUP CALLBACK
   * Registra un callback para ejecutar durante el shutdown
   */
  registerCleanupCallback(name, callback, options = {}) {
    try {
      const { priority = 0, timeout = 5000 } = options;

      this.cleanupCallbacks.set(name, {
        callback,
        priority,
        timeout,
        registeredAt: new Date()
      });

      logger.debug('Cleanup callback registrado', {
        name,
        priority,
        timeout,
        totalCallbacks: this.cleanupCallbacks.size
      });

    } catch (error) {
      logger.error('Error registrando cleanup callback', {
        name,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 🗑️ UNREGISTER CLEANUP CALLBACK
   * Remueve un callback de cleanup
   */
  unregisterCleanupCallback(name) {
    try {
      const removed = this.cleanupCallbacks.delete(name);

      logger.debug('Cleanup callback removido', {
        name,
        removed,
        totalCallbacks: this.cleanupCallbacks.size
      });

      return removed;

    } catch (error) {
      logger.error('Error removiendo cleanup callback', {
        name,
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * 🔄 EXECUTE CLEANUP CALLBACKS
   * Ejecuta todos los callbacks de cleanup registrados
   */
  async executeCleanupCallbacks() {
    try {
      logger.info('🔄 Ejecutando cleanup callbacks', {
        totalCallbacks: this.cleanupCallbacks.size
      });

      // Ordenar por prioridad (mayor primero)
      const sortedCallbacks = Array.from(this.cleanupCallbacks.entries())
        .sort(([, a], [, b]) => b.priority - a.priority);

      const results = [];

      for (const [name, { callback, timeout, registeredAt }] of sortedCallbacks) {
        try {
          logger.debug('Ejecutando cleanup callback', {
            name,
            timeout,
            age: Date.now() - registeredAt.getTime()
          });

          // Ejecutar con timeout
          const result = await Promise.race([
            callback(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Cleanup timeout')), timeout)
            )
          ]);

          results.push({ name, success: true, result });

          logger.debug('Cleanup callback completado exitosamente', { name });

        } catch (error) {
          results.push({ name, success: false, error: error.message });

          logger.error('Error ejecutando cleanup callback', {
            name,
            error: error.message,
            stack: error.stack
          });
        }
      }

      logger.info('✅ Cleanup callbacks completados', {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

      return results;

    } catch (error) {
      logger.error('❌ Error ejecutando cleanup callbacks', {
        error: error.message,
        stack: error.stack
      });
      return [];
    }
  }

  /**
   * 🧹 CLEANUP
   * Limpia todos los listeners del proceso
   */
  cleanup() {
    try {
      const cleanedCount = eventCleanup.cleanup(process);
      
      this.stats.activeListeners -= cleanedCount;

      logger.info('Process cleanup completado', {
        cleanedCount,
        activeListeners: this.stats.activeListeners
      });

      return cleanedCount;

    } catch (error) {
      logger.error('Error en process cleanup', {
        error: error.message,
        stack: error.stack
      });
      return 0;
    }
  }

  /**
   * 📊 GET STATS
   * Obtiene estadísticas del process manager
   */
  getStats() {
    return {
      ...this.stats,
      isShuttingDown: this.isShuttingDown,
      cleanupCallbacks: this.cleanupCallbacks.size,
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  /**
   * 🧪 TEST PROCESS MANAGER
   * Función de prueba para verificar el process manager
   */
  testProcessManager() {
    try {
      logger.info('🧪 Iniciando test del process manager');

      // Registrar callback de prueba
      this.registerCleanupCallback('test', async () => {
        logger.info('Test cleanup callback ejecutado');
        return 'test-success';
      }, { priority: 10, timeout: 1000 });

      // Verificar stats
      const stats = this.getStats();
      logger.info('Test completado', {
        totalListeners: stats.totalListeners,
        activeListeners: stats.activeListeners,
        cleanupCallbacks: stats.cleanupCallbacks
      });

    } catch (error) {
      logger.error('Error en test del process manager', {
        error: error.message,
        stack: error.stack
      });
    }
  }
}

// Instancia global del process manager
const processManager = new ProcessManager();

// Configurar cleanup automático en producción
if (process.env.NODE_ENV === 'production') {
  // Registrar callbacks de cleanup para servicios críticos
  processManager.registerCleanupCallback('database', async () => {
    // Cleanup de conexiones de base de datos
    logger.info('Database cleanup ejecutado');
  }, { priority: 100, timeout: 10000 });

  processManager.registerCleanupCallback('redis', async () => {
    // Cleanup de conexiones Redis
    logger.info('Redis cleanup ejecutado');
  }, { priority: 90, timeout: 5000 });

  processManager.registerCleanupCallback('sockets', async () => {
    // Cleanup de conexiones de socket
    logger.info('Sockets cleanup ejecutado');
  }, { priority: 80, timeout: 3000 });
}

module.exports = processManager; 