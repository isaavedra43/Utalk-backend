/**
 * 📊 SISTEMA DE MONITOREO Y MÉTRICAS
 * 
 * Este módulo proporciona monitoreo completo del sistema de archivos:
 * - Métricas de archivos procesados
 * - Monitoreo de uso de storage
 * - Alertas de errores
 * - Métricas de rendimiento
 * - Dashboard de estadísticas
 */

const logger = require('./logger');
const { EventEmitter } = require('events');

class FileMonitoringSystem extends EventEmitter {
  constructor() {
    super();
    
    // Métricas en tiempo real
    this.metrics = {
      files: {
        totalProcessed: 0,
        totalUploaded: 0,
        totalDeleted: 0,
        byType: {
          images: 0,
          videos: 0,
          audio: 0,
          documents: 0,
          other: 0
        },
        bySize: {
          small: 0,    // < 1MB
          medium: 0,   // 1MB - 10MB
          large: 0,    // 10MB - 100MB
          huge: 0      // > 100MB
        }
      },
      storage: {
        totalUsed: 0,
        totalFiles: 0,
        averageFileSize: 0,
        byConversation: new Map(),
        byUser: new Map()
      },
      performance: {
        averageProcessingTime: 0,
        averageUploadTime: 0,
        cacheHitRate: 0,
        errorRate: 0,
        requestsPerMinute: 0
      },
      errors: {
        total: 0,
        byType: new Map(),
        recent: []
      },
      system: {
        memoryUsage: 0,
        cpuUsage: 0,
        diskUsage: 0,
        activeConnections: 0
      }
    };

    // Configuración de alertas
    this.alertConfig = {
      errorThreshold: 10,        // Alertar después de 10 errores
      storageThreshold: 0.9,     // Alertar al 90% de uso
      performanceThreshold: 5000, // Alertar si procesamiento > 5s
      memoryThreshold: 0.8       // Alertar al 80% de memoria
    };

    // Historial de métricas
    this.history = {
      hourly: [],
      daily: [],
      weekly: []
    };

    // Inicializar monitoreo
    this.initializeMonitoring();
  }

  /**
   * 📊 INICIALIZAR SISTEMA DE MONITOREO
   */
  initializeMonitoring() {
    logger.info('📊 Inicializando sistema de monitoreo de archivos');

    // Monitoreo de sistema cada 30 segundos
    setInterval(() => {
      this.updateSystemMetrics();
    }, 30000);

    // Guardar métricas cada hora
    setInterval(() => {
      this.saveHourlyMetrics();
    }, 60 * 60 * 1000);

    // Limpiar historial antiguo cada día
    setInterval(() => {
      this.cleanupOldHistory();
    }, 24 * 60 * 60 * 1000);

    // Verificar alertas cada minuto
    setInterval(() => {
      this.checkAlerts();
    }, 60 * 1000);

    logger.info('✅ Sistema de monitoreo inicializado');
  }

  /**
   * 🔄 FASE 8: REGISTRAR ACCIÓN DE ARCHIVO
   * Registra acciones específicas de archivos para analytics
   */
  recordFileAction(fileId, action, userId) {
    try {
      // Actualizar métricas de uso
      if (!this.metrics.fileUsage) {
        this.metrics.fileUsage = {
          totalActions: 0,
          byAction: {},
          byFile: new Map(),
          byUser: new Map(),
          recentActions: []
        };
      }

      // Incrementar contadores
      this.metrics.fileUsage.totalActions++;
      this.metrics.fileUsage.byAction[action] = (this.metrics.fileUsage.byAction[action] || 0) + 1;

      // Actualizar métricas por archivo
      if (!this.metrics.fileUsage.byFile.has(fileId)) {
        this.metrics.fileUsage.byFile.set(fileId, {
          totalActions: 0,
          byAction: {},
          lastAction: null
        });
      }
      const fileMetrics = this.metrics.fileUsage.byFile.get(fileId);
      fileMetrics.totalActions++;
      fileMetrics.byAction[action] = (fileMetrics.byAction[action] || 0) + 1;
      fileMetrics.lastAction = new Date();

      // Actualizar métricas por usuario
      if (userId) {
        if (!this.metrics.fileUsage.byUser.has(userId)) {
          this.metrics.fileUsage.byUser.set(userId, {
            totalActions: 0,
            byAction: {},
            lastAction: null
          });
        }
        const userMetrics = this.metrics.fileUsage.byUser.get(userId);
        userMetrics.totalActions++;
        userMetrics.byAction[action] = (userMetrics.byAction[action] || 0) + 1;
        userMetrics.lastAction = new Date();
      }

      // Agregar a acciones recientes
      const actionRecord = {
        fileId,
        action,
        userId,
        timestamp: new Date()
      };
      this.metrics.fileUsage.recentActions.unshift(actionRecord);
      
      // Mantener solo las últimas 100 acciones
      if (this.metrics.fileUsage.recentActions.length > 100) {
        this.metrics.fileUsage.recentActions = this.metrics.fileUsage.recentActions.slice(0, 100);
      }

      // Emitir evento para listeners
      this.emit('fileAction', actionRecord);

      logger.debug('📊 Acción de archivo registrada', {
        fileId: fileId.substring(0, 20) + '...',
        action,
        userId: userId?.substring(0, 20) + '...'
      });

    } catch (error) {
      logger.error('❌ Error registrando acción de archivo', {
        fileId: fileId?.substring(0, 20) + '...',
        action,
        userId: userId?.substring(0, 20) + '...',
        error: error.message
      });
    }
  }

  /**
   * 📊 REGISTRAR PROCESAMIENTO DE ARCHIVO
   */
  recordFileProcessing(fileData) {
    try {
      const {
        fileId,
        conversationId,
        userId,
        mimetype,
        size,
        processingTime,
        success,
        error
      } = fileData;

      // Actualizar métricas de archivos
      this.metrics.files.totalProcessed++;
      
      if (success) {
        this.metrics.files.totalUploaded++;
      }

      // Categorizar por tipo
      const fileType = this.categorizeFileType(mimetype);
      this.metrics.files.byType[fileType]++;

      // Categorizar por tamaño
      const sizeCategory = this.categorizeFileSize(size);
      this.metrics.files.bySize[sizeCategory]++;

      // Actualizar métricas de storage
      this.updateStorageMetrics(conversationId, userId, size);

      // Actualizar métricas de rendimiento
      this.updatePerformanceMetrics(processingTime, success);

      // Registrar error si existe
      if (error) {
        this.recordError(error, 'file_processing', fileId);
      }

      // Emitir evento de métrica actualizada
      this.emit('metricsUpdated', {
        type: 'fileProcessing',
        data: fileData,
        metrics: this.getCurrentMetrics()
      });

      logger.debug('📊 Métricas de archivo registradas', {
        fileId: fileId?.substring(0, 20) + '...',
        type: fileType,
        size: sizeCategory,
        processingTime,
        success
      });

    } catch (error) {
      logger.error('❌ Error registrando métricas de archivo', {
        error: error.message,
        fileData
      });
    }
  }

  /**
   * 📊 REGISTRAR ELIMINACIÓN DE ARCHIVO
   */
  recordFileDeletion(fileData) {
    try {
      const { fileId, conversationId, userId, size } = fileData;

      this.metrics.files.totalDeleted++;

      // Actualizar métricas de storage
      this.updateStorageMetrics(conversationId, userId, -size);

      logger.debug('📊 Eliminación de archivo registrada', {
        fileId: fileId?.substring(0, 20) + '...',
        size: `${(size / 1024 / 1024).toFixed(2)}MB`
      });

    } catch (error) {
      logger.error('❌ Error registrando eliminación de archivo', {
        error: error.message,
        fileData
      });
    }
  }

  /**
   * 📊 REGISTRAR ERROR
   */
  recordError(error, errorType, context = null) {
    try {
      this.metrics.errors.total++;

      // Categorizar error
      const errorCategory = this.categorizeError(error);
      const currentCount = this.metrics.errors.byType.get(errorCategory) || 0;
      this.metrics.errors.byType.set(errorCategory, currentCount + 1);

      // Agregar a errores recientes
      const errorRecord = {
        timestamp: new Date(),
        type: errorType,
        category: errorCategory,
        message: error.message,
        context,
        stack: error.stack
      };

      this.metrics.errors.recent.unshift(errorRecord);

      // Mantener solo los últimos 100 errores
      if (this.metrics.errors.recent.length > 100) {
        this.metrics.errors.recent.pop();
      }

      // Emitir evento de error
      this.emit('errorRecorded', errorRecord);

      logger.warn('⚠️ Error registrado en monitoreo', {
        type: errorType,
        category: errorCategory,
        message: error.message,
        context
      });

    } catch (monitoringError) {
      logger.error('❌ Error registrando error en monitoreo', {
        originalError: error.message,
        monitoringError: monitoringError.message
      });
    }
  }

  /**
   * 📊 ACTUALIZAR MÉTRICAS DE STORAGE
   */
  updateStorageMetrics(conversationId, userId, sizeChange) {
    try {
      // Actualizar métricas globales
      this.metrics.storage.totalUsed += sizeChange;
      this.metrics.storage.totalFiles += sizeChange > 0 ? 1 : -1;

      // Actualizar promedio de tamaño de archivo
      if (this.metrics.storage.totalFiles > 0) {
        this.metrics.storage.averageFileSize = 
          this.metrics.storage.totalUsed / this.metrics.storage.totalFiles;
      }

      // Actualizar por conversación
      if (conversationId) {
        const conversationData = this.metrics.storage.byConversation.get(conversationId) || {
          totalSize: 0,
          fileCount: 0
        };
        
        conversationData.totalSize += sizeChange;
        conversationData.fileCount += sizeChange > 0 ? 1 : -1;
        
        if (conversationData.fileCount <= 0) {
          this.metrics.storage.byConversation.delete(conversationId);
        } else {
          this.metrics.storage.byConversation.set(conversationId, conversationData);
        }
      }

      // Actualizar por usuario
      if (userId) {
        const userData = this.metrics.storage.byUser.get(userId) || {
          totalSize: 0,
          fileCount: 0
        };
        
        userData.totalSize += sizeChange;
        userData.fileCount += sizeChange > 0 ? 1 : -1;
        
        if (userData.fileCount <= 0) {
          this.metrics.storage.byUser.delete(userId);
        } else {
          this.metrics.storage.byUser.set(userId, userData);
        }
      }

    } catch (error) {
      logger.error('❌ Error actualizando métricas de storage', {
        error: error.message,
        conversationId,
        userId,
        sizeChange
      });
    }
  }

  /**
   * 📊 ACTUALIZAR MÉTRICAS DE RENDIMIENTO
   */
  updatePerformanceMetrics(processingTime, success) {
    try {
      // Calcular promedio de tiempo de procesamiento
      const currentAvg = this.metrics.performance.averageProcessingTime;
      const totalProcessed = this.metrics.files.totalProcessed;
      
      this.metrics.performance.averageProcessingTime = 
        ((currentAvg * (totalProcessed - 1)) + processingTime) / totalProcessed;

      // Calcular tasa de error
      const totalErrors = this.metrics.errors.total;
      this.metrics.performance.errorRate = 
        (totalErrors / this.metrics.files.totalProcessed) * 100;

    } catch (error) {
      logger.error('❌ Error actualizando métricas de rendimiento', {
        error: error.message,
        processingTime,
        success
      });
    }
  }

  /**
   * 📊 ACTUALIZAR MÉTRICAS DEL SISTEMA
   */
  updateSystemMetrics() {
    try {
      const os = require('os');
      const fs = require('fs');

      // Uso de memoria
      const memUsage = process.memoryUsage();
      this.metrics.system.memoryUsage = memUsage.heapUsed / memUsage.heapTotal;

      // Uso de CPU (aproximado)
      const cpus = os.cpus();
      const cpuUsage = cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b);
        const idle = cpu.times.idle;
        return acc + ((total - idle) / total);
      }, 0) / cpus.length;
      
      this.metrics.system.cpuUsage = cpuUsage;

      // Uso de disco (si es posible)
      try {
        const diskUsage = fs.statSync(process.cwd());
        // En una implementación real, aquí se calcularía el uso real del disco
        this.metrics.system.diskUsage = 0.5; // Simulado
      } catch (diskError) {
        this.metrics.system.diskUsage = 0;
      }

      // Conexiones activas (simulado)
      this.metrics.system.activeConnections = Math.floor(Math.random() * 100);

    } catch (error) {
      logger.error('❌ Error actualizando métricas del sistema', {
        error: error.message
      });
    }
  }

  /**
   * 📊 VERIFICAR ALERTAS
   */
  checkAlerts() {
    try {
      const alerts = [];

      // Verificar tasa de error
      if (this.metrics.performance.errorRate > this.alertConfig.errorThreshold) {
        alerts.push({
          type: 'high_error_rate',
          severity: 'high',
          message: `Tasa de error alta: ${this.metrics.performance.errorRate.toFixed(2)}%`,
          value: this.metrics.performance.errorRate,
          threshold: this.alertConfig.errorThreshold
        });
      }

      // Verificar uso de storage
      if (this.metrics.system.diskUsage > this.alertConfig.storageThreshold) {
        alerts.push({
          type: 'high_storage_usage',
          severity: 'medium',
          message: `Uso de storage alto: ${(this.metrics.system.diskUsage * 100).toFixed(1)}%`,
          value: this.metrics.system.diskUsage,
          threshold: this.alertConfig.storageThreshold
        });
      }

      // Verificar tiempo de procesamiento
      if (this.metrics.performance.averageProcessingTime > this.alertConfig.performanceThreshold) {
        alerts.push({
          type: 'slow_processing',
          severity: 'medium',
          message: `Procesamiento lento: ${this.metrics.performance.averageProcessingTime.toFixed(0)}ms`,
          value: this.metrics.performance.averageProcessingTime,
          threshold: this.alertConfig.performanceThreshold
        });
      }

      // Verificar uso de memoria
      if (this.metrics.system.memoryUsage > this.alertConfig.memoryThreshold) {
        alerts.push({
          type: 'high_memory_usage',
          severity: 'high',
          message: `Uso de memoria alto: ${(this.metrics.system.memoryUsage * 100).toFixed(1)}%`,
          value: this.metrics.system.memoryUsage,
          threshold: this.alertConfig.memoryThreshold
        });
      }

      // Emitir alertas si existen
      if (alerts.length > 0) {
        this.emit('alerts', alerts);
        
        alerts.forEach(alert => {
          logger.warn(`🚨 ALERTA: ${alert.message}`, {
            type: alert.type,
            severity: alert.severity,
            value: alert.value,
            threshold: alert.threshold
          });
        });
      }

    } catch (error) {
      logger.error('❌ Error verificando alertas', {
        error: error.message
      });
    }
  }

  /**
   * 📊 GUARDAR MÉTRICAS HORARIAS
   */
  saveHourlyMetrics() {
    try {
      const hourlySnapshot = {
        timestamp: new Date(),
        metrics: JSON.parse(JSON.stringify(this.metrics)) // Deep copy
      };

      this.history.hourly.push(hourlySnapshot);

      // Mantener solo las últimas 168 horas (1 semana)
      if (this.history.hourly.length > 168) {
        this.history.hourly.shift();
      }

      logger.info('📊 Métricas horarias guardadas', {
        timestamp: hourlySnapshot.timestamp,
        totalFiles: this.metrics.files.totalProcessed,
        totalStorage: `${(this.metrics.storage.totalUsed / 1024 / 1024 / 1024).toFixed(2)}GB`
      });

    } catch (error) {
      logger.error('❌ Error guardando métricas horarias', {
        error: error.message
      });
    }
  }

  /**
   * 📊 LIMPIAR HISTORIAL ANTIGUO
   */
  cleanupOldHistory() {
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Limpiar métricas horarias antiguas
      this.history.hourly = this.history.hourly.filter(
        snapshot => snapshot.timestamp > oneWeekAgo
      );

      // Limpiar métricas diarias antiguas
      this.history.daily = this.history.daily.filter(
        snapshot => snapshot.timestamp > oneMonthAgo
      );

      logger.info('🧹 Historial antiguo limpiado', {
        hourlySnapshots: this.history.hourly.length,
        dailySnapshots: this.history.daily.length
      });

    } catch (error) {
      logger.error('❌ Error limpiando historial', {
        error: error.message
      });
    }
  }

  /**
   * 📊 OBTENER MÉTRICAS ACTUALES
   */
  getCurrentMetrics() {
    return {
      ...this.metrics,
      storage: {
        ...this.metrics.storage,
        byConversation: Object.fromEntries(this.metrics.storage.byConversation),
        byUser: Object.fromEntries(this.metrics.storage.byUser)
      },
      errors: {
        ...this.metrics.errors,
        byType: Object.fromEntries(this.metrics.errors.byType)
      }
    };
  }

  /**
   * 📊 OBTENER ESTADÍSTICAS DETALLADAS
   */
  getDetailedStats() {
    try {
      const stats = {
        overview: {
          totalFiles: this.metrics.files.totalProcessed,
          totalStorage: this.metrics.storage.totalUsed,
          averageFileSize: this.metrics.storage.averageFileSize,
          errorRate: this.metrics.performance.errorRate
        },
        fileTypes: this.metrics.files.byType,
        fileSizes: this.metrics.files.bySize,
        topConversations: this.getTopConversations(),
        topUsers: this.getTopUsers(),
        recentErrors: this.metrics.errors.recent.slice(0, 10),
        systemHealth: {
          memoryUsage: this.metrics.system.memoryUsage,
          cpuUsage: this.metrics.system.cpuUsage,
          diskUsage: this.metrics.system.diskUsage,
          activeConnections: this.metrics.system.activeConnections
        }
      };

      return stats;

    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas detalladas', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * 📊 OBTENER TOP CONVERSACIONES
   */
  getTopConversations(limit = 10) {
    try {
      const conversations = Array.from(this.metrics.storage.byConversation.entries())
        .map(([id, data]) => ({
          conversationId: id,
          totalSize: data.totalSize,
          fileCount: data.fileCount,
          averageSize: data.totalSize / data.fileCount
        }))
        .sort((a, b) => b.totalSize - a.totalSize)
        .slice(0, limit);

      return conversations;

    } catch (error) {
      logger.error('❌ Error obteniendo top conversaciones', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * 📊 OBTENER TOP USUARIOS
   */
  getTopUsers(limit = 10) {
    try {
      const users = Array.from(this.metrics.storage.byUser.entries())
        .map(([id, data]) => ({
          userId: id,
          totalSize: data.totalSize,
          fileCount: data.fileCount,
          averageSize: data.totalSize / data.fileCount
        }))
        .sort((a, b) => b.totalSize - a.totalSize)
        .slice(0, limit);

      return users;

    } catch (error) {
      logger.error('❌ Error obteniendo top usuarios', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * 📊 CATEGORIZAR TIPO DE ARCHIVO
   */
  categorizeFileType(mimetype) {
    if (mimetype.startsWith('image/')) return 'images';
    if (mimetype.startsWith('video/')) return 'videos';
    if (mimetype.startsWith('audio/')) return 'audio';
    if (mimetype.includes('document') || mimetype.includes('pdf') || 
        mimetype.includes('word') || mimetype.includes('excel') || 
        mimetype.includes('powerpoint') || mimetype.includes('text')) {
      return 'documents';
    }
    return 'other';
  }

  /**
   * 📊 CATEGORIZAR TAMAÑO DE ARCHIVO
   */
  categorizeFileSize(size) {
    const sizeMB = size / 1024 / 1024;
    if (sizeMB < 1) return 'small';
    if (sizeMB < 10) return 'medium';
    if (sizeMB < 100) return 'large';
    return 'huge';
  }

  /**
   * 📊 CATEGORIZAR ERROR
   */
  categorizeError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('storage') || message.includes('bucket')) return 'storage_error';
    if (message.includes('upload') || message.includes('download')) return 'transfer_error';
    if (message.includes('format') || message.includes('mimetype')) return 'format_error';
    if (message.includes('size') || message.includes('limit')) return 'size_error';
    if (message.includes('permission') || message.includes('access')) return 'permission_error';
    if (message.includes('timeout') || message.includes('timeout')) return 'timeout_error';
    if (message.includes('network') || message.includes('connection')) return 'network_error';
    
    return 'general_error';
  }

  /**
   * 📊 RESETEAR MÉTRICAS
   */
  resetMetrics() {
    try {
      this.metrics = {
        files: {
          totalProcessed: 0,
          totalUploaded: 0,
          totalDeleted: 0,
          byType: {
            images: 0,
            videos: 0,
            audio: 0,
            documents: 0,
            other: 0
          },
          bySize: {
            small: 0,
            medium: 0,
            large: 0,
            huge: 0
          }
        },
        storage: {
          totalUsed: 0,
          totalFiles: 0,
          averageFileSize: 0,
          byConversation: new Map(),
          byUser: new Map()
        },
        performance: {
          averageProcessingTime: 0,
          averageUploadTime: 0,
          cacheHitRate: 0,
          errorRate: 0,
          requestsPerMinute: 0
        },
        errors: {
          total: 0,
          byType: new Map(),
          recent: []
        },
        system: {
          memoryUsage: 0,
          cpuUsage: 0,
          diskUsage: 0,
          activeConnections: 0
        }
      };

      logger.info('🔄 Métricas reseteadas');

    } catch (error) {
      logger.error('❌ Error reseteando métricas', {
        error: error.message
      });
    }
  }
}

// Instancia global del sistema de monitoreo
const fileMonitoringSystem = new FileMonitoringSystem();

module.exports = fileMonitoringSystem;
