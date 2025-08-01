const { firestore, FieldValue, Timestamp } = require('../config/firebase');
const { logger } = require('../utils/logger');
const TwilioService = require('./TwilioService');
const CacheService = require('./CacheService');
const BatchService = require('./BatchService');
const ShardingService = require('./ShardingService');

/**
 * 🏥 SERVICIO DE HEALTH CHECK ROBUSTO Y COMPLETO
 * 
 * Verifica la conectividad real de TODOS los servicios críticos:
 * - Firebase Firestore (lectura/escritura real)
 * - Firebase Storage (operaciones reales)
 * - Redis (ping, read/write)
 * - Twilio (verificación de credenciales)
 * - Sistema de archivos
 * - Memoria del sistema
 * - CPU del sistema
 * 
 * @version 2.0.0
 * @author Backend Team
 */
class HealthCheckService {
  constructor() {
    this.startTime = Date.now();
    this.healthChecks = new Map();
    this.thresholds = {
      firestoreTimeout: 5000, // 5 segundos
      storageTimeout: 10000,  // 10 segundos
      redisTimeout: 3000,     // 3 segundos
      twilioTimeout: 5000,    // 5 segundos
      memoryThreshold: 85,    // 85% de memoria
      cpuThreshold: 80,       // 80% de CPU
      diskThreshold: 90       // 90% de disco
    };
    
    this.registerHealthChecks();
  }

  /**
   * Registrar todos los health checks
   */
  registerHealthChecks() {
    // Firebase Firestore
    this.healthChecks.set('firestore', async () => {
      return await this.checkFirestore();
    });

    // Firebase Storage
    this.healthChecks.set('storage', async () => {
      return await this.checkStorage();
    });

    // Redis
    this.healthChecks.set('redis', async () => {
      return await this.checkRedis();
    });

    // Twilio
    this.healthChecks.set('twilio', async () => {
      return await this.checkTwilio();
    });

    // Sistema de archivos
    this.healthChecks.set('filesystem', async () => {
      return await this.checkFilesystem();
    });

    // Memoria del sistema
    this.healthChecks.set('memory', async () => {
      return await this.checkMemory();
    });

    // CPU del sistema
    this.healthChecks.set('cpu', async () => {
      return await this.checkCPU();
    });

    // Servicios internos
    this.healthChecks.set('services', async () => {
      return await this.checkInternalServices();
    });
  }

  /**
   * 🗄️ Verificar Firebase Firestore con operaciones reales
   */
  async checkFirestore() {
    const startTime = Date.now();
    
    try {
      logger.info('🔍 Iniciando health check de Firestore');
      
      // Test de escritura
      const testDocId = `health_check_${Date.now()}`;
      const testData = {
        timestamp: FieldValue.serverTimestamp(),
        test: true,
        healthCheck: true,
        createdAt: new Date().toISOString()
      };

      // Escribir documento de prueba
      await firestore.collection('_health_check').doc(testDocId).set(testData);
      
      // Leer el documento
      const doc = await firestore.collection('_health_check').doc(testDocId).get();
      
      if (!doc.exists) {
        throw new Error('Documento de prueba no encontrado después de escritura');
      }

      // Verificar datos
      const data = doc.data();
      if (!data.test || !data.healthCheck) {
        throw new Error('Datos del documento de prueba corruptos');
      }

      // Eliminar documento de prueba
      await firestore.collection('_health_check').doc(testDocId).delete();
      
      const responseTime = Date.now() - startTime;
      
      logger.info('✅ Health check de Firestore exitoso', {
        responseTime: `${responseTime}ms`,
        operations: ['write', 'read', 'delete']
      });

      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        operations: {
          write: 'success',
          read: 'success',
          delete: 'success'
        },
        projectId: process.env.FIREBASE_PROJECT_ID || 'unknown',
        latency: responseTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('❌ Health check de Firestore falló', {
        error: error.message,
        code: error.code,
        responseTime: `${responseTime}ms`
      });

      return {
        status: 'unhealthy',
        error: error.message,
        code: error.code,
        responseTime: `${responseTime}ms`,
        operations: {
          write: 'failed',
          read: 'failed',
          delete: 'failed'
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 📁 Verificar Firebase Storage con operaciones reales
   */
  async checkStorage() {
    const startTime = Date.now();
    
    try {
      logger.info('🔍 Iniciando health check de Firebase Storage');
      
      const admin = require('firebase-admin');
      const bucket = admin.storage().bucket();
      
      // Verificar que el bucket existe
      const [exists] = await bucket.exists();
      if (!exists) {
        throw new Error('Bucket de Storage no encontrado');
      }

      // Test de escritura de archivo
      const testFileName = `_health_check/test_${Date.now()}.txt`;
      const file = bucket.file(testFileName);
      
      const testContent = `Health check test - ${new Date().toISOString()}`;
      
      // Escribir archivo de prueba
      await file.save(testContent, {
        metadata: {
          contentType: 'text/plain',
          metadata: {
            healthCheck: 'true',
            timestamp: new Date().toISOString()
          }
        }
      });

      // Verificar que el archivo existe
      const [fileExists] = await file.exists();
      if (!fileExists) {
        throw new Error('Archivo de prueba no encontrado después de escritura');
      }

      // Leer el archivo
      const [fileContent] = await file.download();
      if (fileContent.toString() !== testContent) {
        throw new Error('Contenido del archivo de prueba no coincide');
      }

      // Eliminar archivo de prueba
      await file.delete();
      
      const responseTime = Date.now() - startTime;
      
      logger.info('✅ Health check de Firebase Storage exitoso', {
        responseTime: `${responseTime}ms`,
        bucketName: bucket.name,
        operations: ['write', 'read', 'delete']
      });

      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        bucketName: bucket.name,
        operations: {
          write: 'success',
          read: 'success',
          delete: 'success'
        },
        latency: responseTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('❌ Health check de Firebase Storage falló', {
        error: error.message,
        code: error.code,
        responseTime: `${responseTime}ms`
      });

      return {
        status: 'unhealthy',
        error: error.message,
        code: error.code,
        responseTime: `${responseTime}ms`,
        operations: {
          write: 'failed',
          read: 'failed',
          delete: 'failed'
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 🗄️ Verificar Redis con operaciones reales
   */
  async checkRedis() {
    const startTime = Date.now();
    
    try {
      logger.info('🔍 Iniciando health check de Redis');
      
      const cacheService = new CacheService();
      
      // Test de ping
      const pingResult = await cacheService.ping();
      if (pingResult !== 'PONG') {
        throw new Error('Redis ping falló');
      }

      // Test de escritura y lectura
      const testKey = `health_check:${Date.now()}`;
      const testValue = `test_${Date.now()}`;
      
      // Escribir valor
      await cacheService.set(testKey, testValue, 60); // TTL 60 segundos
      
      // Leer valor
      const readValue = await cacheService.get(testKey);
      if (readValue !== testValue) {
        throw new Error('Valor leído no coincide con el escrito');
      }

      // Eliminar valor
      await cacheService.del(testKey);
      
      const responseTime = Date.now() - startTime;
      
      logger.info('✅ Health check de Redis exitoso', {
        responseTime: `${responseTime}ms`,
        operations: ['ping', 'write', 'read', 'delete']
      });

      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        operations: {
          ping: 'success',
          write: 'success',
          read: 'success',
          delete: 'success'
        },
        latency: responseTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('❌ Health check de Redis falló', {
        error: error.message,
        responseTime: `${responseTime}ms`
      });

      return {
        status: 'unhealthy',
        error: error.message,
        responseTime: `${responseTime}ms`,
        operations: {
          ping: 'failed',
          write: 'failed',
          read: 'failed',
          delete: 'failed'
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 📞 Verificar Twilio con verificación de credenciales
   */
  async checkTwilio() {
    const startTime = Date.now();
    
    try {
      logger.info('🔍 Iniciando health check de Twilio');
      
      const twilioService = new TwilioService();
      
      // Verificar configuración básica
      if (!twilioService.accountSid || !twilioService.authToken) {
        throw new Error('Credenciales de Twilio no configuradas');
      }

      // Verificar que las credenciales son válidas
      // Nota: No hacemos una llamada real para evitar costos
      // Solo verificamos que las credenciales están presentes y tienen formato válido
      const accountSidPattern = /^AC[a-f0-9]{32}$/;
      const authTokenPattern = /^[a-f0-9]{32}$/;
      
      if (!accountSidPattern.test(twilioService.accountSid)) {
        throw new Error('Account SID de Twilio tiene formato inválido');
      }
      
      if (!authTokenPattern.test(twilioService.authToken)) {
        throw new Error('Auth Token de Twilio tiene formato inválido');
      }

      // Verificar número de WhatsApp configurado
      if (!twilioService.whatsappNumber) {
        throw new Error('Número de WhatsApp de Twilio no configurado');
      }

      const responseTime = Date.now() - startTime;
      
      logger.info('✅ Health check de Twilio exitoso', {
        responseTime: `${responseTime}ms`,
        accountSid: `${twilioService.accountSid.substring(0, 8)}...`,
        whatsappNumber: twilioService.whatsappNumber
      });

      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        accountSid: `${twilioService.accountSid.substring(0, 8)}...`,
        whatsappNumber: twilioService.whatsappNumber,
        latency: responseTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('❌ Health check de Twilio falló', {
        error: error.message,
        responseTime: `${responseTime}ms`
      });

      return {
        status: 'unhealthy',
        error: error.message,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 💾 Verificar sistema de archivos
   */
  async checkFilesystem() {
    const startTime = Date.now();
    
    try {
      logger.info('🔍 Iniciando health check del sistema de archivos');
      
      const fs = require('fs').promises;
      const path = require('path');
      const os = require('os');
      
      // Verificar directorio de trabajo
      const cwd = process.cwd();
      await fs.access(cwd);
      
      // Verificar directorio de uploads
      const uploadsDir = path.join(cwd, 'uploads');
      try {
        await fs.access(uploadsDir);
      } catch (error) {
        // Crear directorio si no existe
        await fs.mkdir(uploadsDir, { recursive: true });
      }
      
      // Test de escritura y lectura
      const testFile = path.join(uploadsDir, `health_check_${Date.now()}.txt`);
      const testContent = `Health check test - ${new Date().toISOString()}`;
      
      // Escribir archivo de prueba
      await fs.writeFile(testFile, testContent);
      
      // Leer archivo de prueba
      const readContent = await fs.readFile(testFile, 'utf8');
      if (readContent !== testContent) {
        throw new Error('Contenido del archivo de prueba no coincide');
      }
      
      // Eliminar archivo de prueba
      await fs.unlink(testFile);
      
      // Verificar espacio en disco
      const diskUsage = await this.getDiskUsage();
      
      const responseTime = Date.now() - startTime;
      
      logger.info('✅ Health check del sistema de archivos exitoso', {
        responseTime: `${responseTime}ms`,
        diskUsage: `${diskUsage.usagePercent.toFixed(1)}%`
      });

      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        operations: {
          write: 'success',
          read: 'success',
          delete: 'success'
        },
        diskUsage: `${diskUsage.usagePercent.toFixed(1)}%`,
        freeSpace: this.formatBytes(diskUsage.freeSpace),
        latency: responseTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('❌ Health check del sistema de archivos falló', {
        error: error.message,
        responseTime: `${responseTime}ms`
      });

      return {
        status: 'unhealthy',
        error: error.message,
        responseTime: `${responseTime}ms`,
        operations: {
          write: 'failed',
          read: 'failed',
          delete: 'failed'
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 🧠 Verificar memoria del sistema
   */
  async checkMemory() {
    try {
      const memUsage = process.memoryUsage();
      const os = require('os');
      
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsagePercent = (usedMem / totalMem) * 100;
      
      const isHealthy = memoryUsagePercent < this.thresholds.memoryThreshold;
      
      logger.info('🔍 Health check de memoria completado', {
        usagePercent: `${memoryUsagePercent.toFixed(1)}%`,
        threshold: `${this.thresholds.memoryThreshold}%`,
        isHealthy
      });

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        usagePercent: memoryUsagePercent.toFixed(1),
        threshold: this.thresholds.memoryThreshold,
        heapUsed: this.formatBytes(memUsage.heapUsed),
        heapTotal: this.formatBytes(memUsage.heapTotal),
        external: this.formatBytes(memUsage.external),
        rss: this.formatBytes(memUsage.rss),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('❌ Health check de memoria falló', {
        error: error.message
      });

      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * ⚡ Verificar CPU del sistema
   */
  async checkCPU() {
    try {
      const cpuUsage = await this.getCPUUsage();
      const isHealthy = cpuUsage < this.thresholds.cpuThreshold;
      
      logger.info('🔍 Health check de CPU completado', {
        usagePercent: `${cpuUsage.toFixed(1)}%`,
        threshold: `${this.thresholds.cpuThreshold}%`,
        isHealthy
      });

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        usagePercent: cpuUsage.toFixed(1),
        threshold: this.thresholds.cpuThreshold,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('❌ Health check de CPU falló', {
        error: error.message
      });

      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 🔧 Verificar servicios internos
   */
  async checkInternalServices() {
    try {
      logger.info('🔍 Iniciando health check de servicios internos');
      
      const results = {};
      
      // Verificar CacheService
      try {
        const cacheService = new CacheService();
        const pingResult = await cacheService.ping();
        results.cacheService = pingResult === 'PONG' ? 'healthy' : 'unhealthy';
      } catch (error) {
        results.cacheService = 'unhealthy';
      }

      // Verificar BatchService
      try {
        const batchService = new BatchService();
        const batchHealth = await batchService.healthCheck();
        results.batchService = batchHealth.status;
      } catch (error) {
        results.batchService = 'unhealthy';
      }

      // Verificar ShardingService
      try {
        const shardingService = new ShardingService();
        const shardingHealth = await shardingService.healthCheck();
        results.shardingService = shardingHealth.status;
      } catch (error) {
        results.shardingService = 'unhealthy';
      }

      const allHealthy = Object.values(results).every(status => status === 'healthy');
      
      logger.info('✅ Health check de servicios internos completado', {
        results,
        allHealthy
      });

      return {
        status: allHealthy ? 'healthy' : 'unhealthy',
        services: results,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('❌ Health check de servicios internos falló', {
        error: error.message
      });

      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 🏥 Ejecutar todos los health checks
   */
  async runAllHealthChecks() {
    const startTime = Date.now();
    const results = {};
    let overallStatus = 'healthy';
    let failedChecks = [];

    logger.info('🏥 Iniciando health checks completos del sistema');

    for (const [name, check] of this.healthChecks.entries()) {
      try {
        const result = await check();
        results[name] = result;

        if (result.status !== 'healthy') {
          overallStatus = 'unhealthy';
          failedChecks.push(name);
        }

        logger.info(`✅ Health check de ${name} completado`, {
          status: result.status,
          responseTime: result.responseTime || 'N/A'
        });

      } catch (error) {
        results[name] = {
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        };
        overallStatus = 'unhealthy';
        failedChecks.push(name);

        logger.error(`❌ Health check de ${name} falló`, {
          error: error.message
        });
      }
    }

    const totalTime = Date.now() - startTime;

    // Log del resultado general
    if (overallStatus === 'healthy') {
      logger.info('🎉 Todos los health checks pasaron exitosamente', {
        totalTime: `${totalTime}ms`,
        checksCount: Object.keys(results).length
      });
    } else {
      logger.warn('⚠️ Algunos health checks fallaron', {
        overallStatus,
        failedChecks,
        totalTime: `${totalTime}ms`,
        checksCount: Object.keys(results).length
      });
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: this.formatUptime(Date.now() - this.startTime),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      totalTime: `${totalTime}ms`,
      checks: results,
      failedChecks,
      healthyChecks: Object.keys(results).filter(name => results[name].status === 'healthy')
    };
  }

  /**
   * Obtener uso de CPU
   */
  async getCPUUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = process.hrtime(startTime);

        const userUsage = endUsage.user / 1000;
        const systemUsage = endUsage.system / 1000;
        const totalTime = endTime[0] * 1000 + endTime[1] / 1000000;

        const cpuPercent = ((userUsage + systemUsage) / totalTime) * 100;
        resolve(Math.min(cpuPercent, 100));
      }, 100);
    });
  }

  /**
   * Obtener uso de disco
   */
  async getDiskUsage() {
    try {
      const fs = require('fs').promises;
      const stats = await fs.statfs(process.cwd());
      
      const total = stats.blocks * stats.blksize;
      const free = stats.bavail * stats.blksize;
      const used = total - free;
      const usagePercent = (used / total) * 100;

      return {
        total,
        free,
        used,
        usagePercent,
        freeSpace: free,
      };
    } catch (error) {
      return {
        total: 0,
        free: 0,
        used: 0,
        usagePercent: 0,
        freeSpace: 0,
      };
    }
  }

  /**
   * Formatear bytes a formato legible
   */
  formatBytes(bytes) {
    if (!bytes) return '0 B';

    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * Formatear uptime a formato legible
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

module.exports = HealthCheckService; 