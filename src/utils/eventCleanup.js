/**
 * 🧹 EVENT CLEANUP SYSTEM
 * Sistema centralizado para limpiar event listeners y prevenir memory leaks
 * 
 * @author Backend Performance Team
 * @version 1.0.0
 */

const logger = require('./logger');

class EventCleanup {
  constructor() {
    this.listeners = new Map();
    this.cleanupCallbacks = new Map();
    this.stats = {
      totalListeners: 0,
      cleanedListeners: 0,
      activeListeners: 0
    };
  }

  /**
   * 📝 ADD LISTENER WITH CLEANUP
   * Agrega un listener con cleanup automático
   */
  addListener(emitter, event, handler, options = {}) {
    try {
      const { 
        maxCalls = Infinity, 
        timeout = null, 
        autoCleanup = true,
        metadata = {} 
      } = options;

      // Crear wrapper con límites
      let callCount = 0;
      const wrappedHandler = (...args) => {
        try {
          callCount++;
          
          // Verificar límite de llamadas
          if (callCount >= maxCalls) {
            this.removeListener(emitter, event, wrappedHandler);
            // Log removido para reducir ruido en producción
          }

          // Ejecutar handler original
          return handler(...args);

        } catch (error) {
          logger.error('Error en event handler', {
            event,
            error: error.message,
            stack: error.stack,
            metadata
          });
        }
      };

      // Agregar timeout si se especifica
      if (timeout) {
        const timeoutId = setTimeout(() => {
          this.removeListener(emitter, event, wrappedHandler);
          // Log removido para reducir ruido en producción
        }, timeout);

        // Guardar referencia del timeout
        wrappedHandler.timeoutId = timeoutId;
      }

      // Agregar listener al emitter
      emitter.on(event, wrappedHandler);

      // Registrar en el sistema de cleanup
      if (!this.listeners.has(emitter)) {
        this.listeners.set(emitter, new Map());
      }

      const emitterListeners = this.listeners.get(emitter);
      emitterListeners.set(event, {
        handler: wrappedHandler,
        originalHandler: handler,
        callCount: 0,
        addedAt: new Date(),
        metadata,
        maxCalls,
        timeout
      });

      this.stats.totalListeners++;
      this.stats.activeListeners++;

      // Log removido para reducir ruido en producción

      return wrappedHandler;

    } catch (error) {
      logger.error('Error agregando listener con cleanup', {
        event,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 🗑️ REMOVE LISTENER
   * Remueve un listener específico
   */
  removeListener(emitter, event, handler) {
    try {
      const emitterListeners = this.listeners.get(emitter);
      if (!emitterListeners) {
        logger.warn('No se encontraron listeners para el emitter', {
          event,
          emitter: emitter.constructor.name
        });
        return false;
      }

      const listenerInfo = emitterListeners.get(event);
      if (!listenerInfo) {
        logger.warn('No se encontró listener para el evento', {
          event,
          emitter: emitter.constructor.name
        });
        return false;
      }

      // Limpiar timeout si existe
      if (listenerInfo.handler.timeoutId) {
        clearTimeout(listenerInfo.handler.timeoutId);
      }

      // Remover del emitter
      emitter.removeListener(event, listenerInfo.handler);

      // Remover del registro
      emitterListeners.delete(event);
      if (emitterListeners.size === 0) {
        this.listeners.delete(emitter);
      }

      this.stats.cleanedListeners++;
      this.stats.activeListeners--;

      // Log removido para reducir ruido en producción

      return true;

    } catch (error) {
      logger.error('Error removiendo listener', {
        event,
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * 🧹 CLEANUP EMITTER
   * Limpia todos los listeners de un emitter específico
   */
  cleanup(emitter) {
    try {
      const emitterListeners = this.listeners.get(emitter);
      if (!emitterListeners) {
        // Log removido para reducir ruido en producción
        return 0;
      }

      let cleanedCount = 0;

      emitterListeners.forEach((listenerInfo, event) => {
        try {
          // Limpiar timeout si existe
          if (listenerInfo.handler.timeoutId) {
            clearTimeout(listenerInfo.handler.timeoutId);
          }

          // Remover del emitter
          emitter.removeListener(event, listenerInfo.handler);
          cleanedCount++;

        } catch (error) {
          logger.error('Error limpiando listener específico', {
            event,
            error: error.message
          });
        }
      });

      // Remover del registro
      this.listeners.delete(emitter);

      this.stats.cleanedListeners += cleanedCount;
      this.stats.activeListeners -= cleanedCount;

      logger.info('Cleanup de emitter completado', {
        emitter: emitter.constructor.name,
        cleanedListeners: cleanedCount,
        activeListeners: this.stats.activeListeners
      });

      return cleanedCount;

    } catch (error) {
      logger.error('Error en cleanup de emitter', {
        emitter: emitter.constructor.name,
        error: error.message,
        stack: error.stack
      });
      return 0;
    }
  }

  /**
   * 🧹 CLEANUP ALL
   * Limpia todos los listeners registrados
   */
  cleanupAll() {
    try {
      let totalCleaned = 0;

      this.listeners.forEach((emitterListeners, emitter) => {
        const cleanedCount = this.cleanup(emitter);
        totalCleaned += cleanedCount;
      });

      logger.info('Cleanup completo completado', {
        totalCleaned,
        activeListeners: this.stats.activeListeners
      });

      return totalCleaned;

    } catch (error) {
      logger.error('Error en cleanup completo', {
        error: error.message,
        stack: error.stack
      });
      return 0;
    }
  }

  /**
   * 🔍 GET ACTIVE LISTENERS
   * Obtiene información de listeners activos
   */
  getActiveListeners() {
    const activeListeners = [];

    this.listeners.forEach((emitterListeners, emitter) => {
      emitterListeners.forEach((listenerInfo, event) => {
        activeListeners.push({
          emitter: emitter.constructor.name,
          event,
          callCount: listenerInfo.callCount,
          addedAt: listenerInfo.addedAt,
          metadata: listenerInfo.metadata,
          maxCalls: listenerInfo.maxCalls,
          timeout: listenerInfo.timeout
        });
      });
    });

    return activeListeners;
  }

  /**
   * 📊 GET STATS
   * Obtiene estadísticas del sistema de cleanup
   */
  getStats() {
    return {
      ...this.stats,
      activeListeners: this.stats.activeListeners,
      cleanupRate: this.stats.totalListeners > 0 
        ? (this.stats.cleanedListeners / this.stats.totalListeners * 100).toFixed(2) + '%'
        : '0%',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 🔄 AUTO CLEANUP
   * Sistema de cleanup automático basado en tiempo
   */
  startAutoCleanup(options = {}) {
    const { 
      interval = 300000, // 5 minutos
      maxAge = 3600000, // 1 hora
      maxCalls = 1000 
    } = options;

    const cleanupInterval = setInterval(() => {
      try {
        const now = new Date();
        let cleanedCount = 0;

        this.listeners.forEach((emitterListeners, emitter) => {
          emitterListeners.forEach((listenerInfo, event) => {
            const age = now - listenerInfo.addedAt;
            const shouldCleanup = 
              age > maxAge || 
              listenerInfo.callCount > maxCalls;

            if (shouldCleanup) {
              this.removeListener(emitter, event, listenerInfo.handler);
              cleanedCount++;
            }
          });
        });

        if (cleanedCount > 0) {
          logger.info('Auto cleanup ejecutado', {
            cleanedCount,
            activeListeners: this.stats.activeListeners
          });
        }

      } catch (error) {
        logger.error('Error en auto cleanup', {
          error: error.message,
          stack: error.stack
        });
      }
    }, interval);

    // Guardar referencia del intervalo
    this.cleanupCallbacks.set('autoCleanup', () => {
      clearInterval(cleanupInterval);
    });

    logger.info('Auto cleanup iniciado', {
      interval,
      maxAge,
      maxCalls
    });

    return cleanupInterval;
  }

  /**
   * 🛑 STOP AUTO CLEANUP
   * Detiene el sistema de cleanup automático
   */
  stopAutoCleanup() {
    const cleanupCallback = this.cleanupCallbacks.get('autoCleanup');
    if (cleanupCallback) {
      cleanupCallback();
      this.cleanupCallbacks.delete('autoCleanup');
      logger.info('Auto cleanup detenido');
    }
  }

  /**
   * 🧪 TEST CLEANUP
   * Función de prueba para verificar el sistema de cleanup
   */
  testCleanup() {
    const testEmitter = new (require('events'))();
    let testCallCount = 0;

    const testHandler = () => {
      testCallCount++;
    };

    // Agregar listener de prueba
    this.addListener(testEmitter, 'test', testHandler, {
      maxCalls: 3,
      timeout: 5000,
      metadata: { test: true }
    });

    // Emitir eventos de prueba
    testEmitter.emit('test');
    testEmitter.emit('test');
    testEmitter.emit('test');

    // Verificar que se limpió automáticamente
    setTimeout(() => {
      const activeListeners = this.getActiveListeners();
      const testListeners = activeListeners.filter(l => l.metadata.test);
      
      logger.info('Test de cleanup completado', {
        testCallCount,
        testListenersRemaining: testListeners.length,
        allActiveListeners: activeListeners.length
      });
    }, 1000);
  }
}

// Instancia global del sistema de cleanup
const eventCleanup = new EventCleanup();

// Configurar cleanup automático en producción
if (process.env.NODE_ENV === 'production') {
  eventCleanup.startAutoCleanup({
    interval: 300000, // 5 minutos
    maxAge: 3600000, // 1 hora
    maxCalls: 1000
  });
}

module.exports = eventCleanup; 