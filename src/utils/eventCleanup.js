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
      interval = 120000, // 2 minutos (más frecuente)
      maxAge = 1800000, // 30 minutos (más agresivo)
      maxCalls = 500,   // Límite más bajo
      memoryPressureThreshold = 0.80 // 80% de memoria
    } = options;

    const cleanupInterval = setInterval(() => {
      try {
        const now = new Date();
        const memoryUsage = process.memoryUsage();
        const memoryPressure = memoryUsage.heapUsed / memoryUsage.heapTotal;
        
        let cleanedCount = 0;
        let totalListeners = 0;

        // Usar límites más agresivos bajo presión de memoria
        const effectiveMaxAge = memoryPressure > memoryPressureThreshold 
          ? maxAge * 0.5  // 15 minutos bajo presión
          : maxAge;
          
        const effectiveMaxCalls = memoryPressure > memoryPressureThreshold 
          ? maxCalls * 0.5  // 250 llamadas bajo presión
          : maxCalls;

        this.listeners.forEach((emitterListeners, emitter) => {
          // Verificar si el emitter sigue existiendo
          const isEmitterValid = this.isEmitterValid(emitter);
          
          emitterListeners.forEach((listenerInfo, event) => {
            totalListeners++;
            const age = now - listenerInfo.addedAt;
            const shouldCleanup = 
              !isEmitterValid ||
              age > effectiveMaxAge || 
              listenerInfo.callCount > effectiveMaxCalls;

            if (shouldCleanup) {
              this.removeListener(emitter, event, listenerInfo.handler);
              cleanedCount++;
            }
          });
        });

        if (cleanedCount > 0 || memoryPressure > memoryPressureThreshold) {
          logger.info('Auto cleanup ejecutado', {
            category: 'EVENT_CLEANUP_AUTO',
            cleanedCount,
            totalListeners,
            activeListeners: this.stats.activeListeners,
            memoryPressure: (memoryPressure * 100).toFixed(2) + '%',
            cleanupMode: memoryPressure > memoryPressureThreshold ? 'aggressive' : 'normal',
            effectiveMaxAge: effectiveMaxAge / 1000 + 's',
            effectiveMaxCalls
          });
        }

        // Forzar garbage collection bajo alta presión de memoria
        if (memoryPressure > 0.90 && global.gc) {
          global.gc();
          logger.warn('Forced garbage collection due to high memory pressure', {
            category: 'EVENT_CLEANUP_FORCE_GC',
            memoryPressure: (memoryPressure * 100).toFixed(2) + '%'
          });
        }

      } catch (error) {
        logger.error('Error en auto cleanup', {
          category: 'EVENT_CLEANUP_AUTO_ERROR',
          error: error.message,
          stack: error.stack
        });
      }
    }, interval);

    // Guardar referencia del intervalo
    this.cleanupCallbacks.set('autoCleanup', () => {
      clearInterval(cleanupInterval);
    });

    logger.info('Auto cleanup iniciado (optimizado)', {
      category: 'EVENT_CLEANUP_AUTO_START',
      interval: interval / 1000 + 's',
      maxAge: maxAge / 1000 + 's',
      maxCalls,
      memoryPressureThreshold: (memoryPressureThreshold * 100) + '%'
    });

    return cleanupInterval;
  }

  /**
   * 🔍 IS EMITTER VALID
   * Verifica si un emitter sigue siendo válido
   */
  isEmitterValid(emitter) {
    try {
      // Para Socket.IO sockets, verificar si están conectados
      if (emitter.constructor.name === 'Socket' && emitter.connected !== undefined) {
        return emitter.connected;
      }
      
      // Para otros emitters, verificar si el objeto no ha sido destruido
      if (emitter.destroyed !== undefined) {
        return !emitter.destroyed;
      }
      
      // Para emitters con readyState
      if (emitter.readyState !== undefined) {
        return emitter.readyState === 'open';
      }
      
      // Por defecto, asumir que es válido
      return true;
      
    } catch (error) {
      // Si hay error accediendo al emitter, probablemente no es válido
      logger.debug('Error verificando validez del emitter', {
        category: 'EVENT_CLEANUP_EMITTER_CHECK',
        emitterType: emitter.constructor.name,
        error: error.message
      });
      return false;
    }
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
    interval: 120000,   // 2 minutos (más frecuente)
    maxAge: 1800000,    // 30 minutos (más agresivo)
    maxCalls: 500,      // Límite más bajo
    memoryPressureThreshold: 0.80 // 80% de memoria
  });
} else {
  // En desarrollo usar parámetros menos agresivos
  eventCleanup.startAutoCleanup({
    interval: 300000,   // 5 minutos
    maxAge: 3600000,    // 1 hora
    maxCalls: 1000,     // Límite más alto
    memoryPressureThreshold: 0.85 // 85% de memoria
  });
}

module.exports = eventCleanup; 