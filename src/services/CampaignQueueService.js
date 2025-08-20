/**
 * 🚀 CAMPAIGN QUEUE SERVICE - ENVÍO MASIVO ESCALABLE
 * 
 * Sistema de colas para campañas masivas con:
 * ✅ Procesamiento asíncrono con Bull/Redis
 * ✅ Rate limiting inteligente para Twilio
 * ✅ Retry logic con exponential backoff
 * ✅ Progress tracking en tiempo real
 * ✅ Pausa/Reanudación de campañas
 * ✅ Monitoreo de recursos
 * ✅ Circuit breaker para Twilio
 * 
 * @version 1.0.0 ENTERPRISE
 * @author Campaign Team
 */

const Queue = require('bull');
const Redis = require('ioredis');
const logger = require('../utils/logger');
const { getMessageService } = require('./MessageService');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');

class CampaignQueueService {
  constructor() {
    this.redis = null;
    this.campaignQueue = null;
    this.processingQueue = null;
    this.isInitialized = false;
    
    // Configuración de rate limiting para Twilio
    this.twilioLimits = {
      messagesPerSecond: 10,
      messagesPerMinute: 600,
      messagesPerHour: 36000,
      maxConcurrent: 50
    };
    
    // Métricas de procesamiento
    this.metrics = {
      campaignsProcessed: 0,
      messagesSent: 0,
      messagesFailed: 0,
      averageProcessingTime: 0,
      activeWorkers: 0
    };
    
    // Circuit breaker para Twilio
    this.circuitBreaker = {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
      threshold: 10,
      timeout: 60000 // 1 minuto
    };
  }

  /**
   * 🚀 INICIALIZAR SERVICIO DE COLAS
   */
  async initialize() {
    try {
      // 🔧 SOLUCIÓN: Configurar Redis con family=0 para Railway IPv6
      const redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL;
      const redisUrlWithFamily = redisUrl.includes('?family=0') ? redisUrl : `${redisUrl}?family=0`;
      
      this.redis = new Redis(redisUrlWithFamily, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        lazyConnect: true
      });

      // Crear cola principal de campañas
      this.campaignQueue = new Queue('campaign-processing', {
        redis: this.redis,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      });

      // Crear cola de procesamiento de mensajes
      this.processingQueue = new Queue('message-processing', {
        redis: this.redis,
        defaultJobOptions: {
          removeOnComplete: 1000,
          removeOnFail: 100,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000
          }
        }
      });

      // Configurar workers
      await this.setupWorkers();
      
      // Configurar monitoreo
      await this.setupMonitoring();
      
      this.isInitialized = true;
      
      logger.info('✅ Campaign Queue Service inicializado exitosamente', {
        redisConnected: true,
        queuesCreated: ['campaign-processing', 'message-processing'],
        twilioLimits: this.twilioLimits
      });

    } catch (error) {
      logger.error('❌ Error inicializando Campaign Queue Service', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 🔧 CONFIGURAR WORKERS
   */
  async setupWorkers() {
    // Worker para procesar campañas
    this.campaignQueue.process('process-campaign', async (job) => {
      return await this.processCampaignJob(job);
    });

    // Worker para procesar mensajes individuales
    this.processingQueue.process('send-message', async (job) => {
      return await this.processMessageJob(job);
    });

    // Manejar eventos de la cola
    this.campaignQueue.on('completed', (job) => {
      logger.info('✅ Campaña procesada exitosamente', {
        campaignId: job.data.campaignId,
        jobId: job.id,
        duration: job.processedOn - job.timestamp
      });
    });

    this.campaignQueue.on('failed', (job, err) => {
      logger.error('❌ Error procesando campaña', {
        campaignId: job.data.campaignId,
        jobId: job.id,
        error: err.message,
        attempts: job.attemptsMade
      });
    });
  }

  /**
   * 📊 CONFIGURAR MONITOREO
   */
  async setupMonitoring() {
    // Monitorear métricas cada 30 segundos
    setInterval(async () => {
      await this.updateMetrics();
    }, 30000);

    // Limpiar métricas diariamente
    setInterval(async () => {
      this.resetDailyMetrics();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * 🚀 ENCOLAR CAMPAÑA PARA PROCESAMIENTO
   */
  async queueCampaign(campaignId, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Campaign Queue Service no está inicializado');
    }

    try {
      const campaign = await Campaign.getById(campaignId);
      if (!campaign) {
        throw new Error(`Campaña ${campaignId} no encontrada`);
      }

      // Verificar si la campaña puede ser enviada
      if (!campaign.canBeSent()) {
        throw new Error(`Campaña ${campaignId} no puede ser enviada`);
      }

      // Crear job de campaña
      const job = await this.campaignQueue.add('process-campaign', {
        campaignId,
        userId: options.userId,
        priority: options.priority || 'normal',
        estimatedContacts: campaign.contacts.length,
        scheduledAt: campaign.scheduledAt
      }, {
        priority: this.getJobPriority(options.priority),
        delay: this.calculateDelay(campaign.scheduledAt),
        jobId: `campaign_${campaignId}_${Date.now()}`
      });

      // Actualizar estado de la campaña
      await campaign.updateStatus('queued');

      logger.info('📤 Campaña encolada exitosamente', {
        campaignId,
        jobId: job.id,
        estimatedContacts: campaign.contacts.length,
        scheduledAt: campaign.scheduledAt
      });

      return {
        success: true,
        jobId: job.id,
        campaignId,
        estimatedContacts: campaign.contacts.length,
        estimatedTime: this.estimateProcessingTime(campaign.contacts.length)
      };

    } catch (error) {
      logger.error('❌ Error encolando campaña', {
        campaignId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🔄 PROCESAR JOB DE CAMPAÑA
   */
  async processCampaignJob(job) {
    const { campaignId, userId } = job.data;
    const startTime = Date.now();

    try {
      logger.info('🔄 Procesando campaña', {
        campaignId,
        jobId: job.id,
        userId
      });

      // Obtener campaña
      const campaign = await Campaign.getById(campaignId);
      if (!campaign) {
        throw new Error(`Campaña ${campaignId} no encontrada`);
      }

      // Actualizar estado
      await campaign.updateStatus('sending');

      // Obtener contactos
      const contacts = await Promise.all(
        campaign.contacts.map(contactId => Contact.getById(contactId))
      );
      const validContacts = contacts.filter(contact => contact !== null);

      // Dividir contactos en lotes para rate limiting
      const batches = this.createBatches(validContacts, this.twilioLimits.messagesPerSecond);
      
      let processedCount = 0;
      let successCount = 0;
      let failureCount = 0;

      // Procesar lotes
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        // Verificar si la campaña fue pausada o detenida
        const currentCampaign = await Campaign.getById(campaignId);
        if (currentCampaign.status === 'paused' || currentCampaign.status === 'stopped') {
          logger.info('⏸️ Campaña pausada/detenida durante procesamiento', {
            campaignId,
            status: currentCampaign.status,
            processedCount
          });
          break;
        }

        // Encolar mensajes del lote
        const batchJobs = batch.map(contact => ({
          name: 'send-message',
          data: {
            campaignId,
            contactId: contact.id,
            phone: contact.phone,
            message: campaign.message,
            userId
          },
          opts: {
            priority: 'high',
            delay: i * 1000 // Delay de 1 segundo entre lotes
          }
        }));

        await this.processingQueue.addBulk(batchJobs);
        
        processedCount += batch.length;
        
        // Actualizar progreso
        await this.updateCampaignProgress(campaignId, {
          processed: processedCount,
          total: validContacts.length,
          success: successCount,
          failed: failureCount
        });

        // Rate limiting
        await this.delay(1000);
      }

      // Esperar a que se completen todos los mensajes
      await this.waitForCompletion(campaignId, validContacts.length);

      // Obtener resultados finales
      const finalResults = await this.getCampaignResults(campaignId);
      
      // Actualizar métricas de la campaña
      await campaign.updateMetrics({
        sentCount: finalResults.success,
        failedCount: finalResults.failed,
        completedAt: new Date()
      });

      // Cambiar estado a completado
      await campaign.updateStatus('completed');

      const processingTime = Date.now() - startTime;
      
      logger.info('✅ Campaña procesada exitosamente', {
        campaignId,
        jobId: job.id,
        totalContacts: validContacts.length,
        successCount: finalResults.success,
        failureCount: finalResults.failed,
        processingTime: `${processingTime}ms`
      });

      return {
        success: true,
        campaignId,
        totalContacts: validContacts.length,
        successCount: finalResults.success,
        failureCount: finalResults.failed,
        processingTime
      };

    } catch (error) {
      logger.error('❌ Error procesando campaña', {
        campaignId,
        jobId: job.id,
        error: error.message,
        stack: error.stack
      });

      // Actualizar estado de la campaña a error
      try {
        const campaign = await Campaign.getById(campaignId);
        if (campaign) {
          await campaign.updateStatus('failed');
        }
      } catch (updateError) {
        logger.error('Error actualizando estado de campaña', { updateError: updateError.message });
      }

      throw error;
    }
  }

  /**
   * 📨 PROCESAR JOB DE MENSAJE INDIVIDUAL
   */
  async processMessageJob(job) {
    const { campaignId, contactId, phone, message, userId } = job.data;

    try {
      // Verificar circuit breaker
      if (this.circuitBreaker.isOpen) {
        const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;
        if (timeSinceLastFailure < this.circuitBreaker.timeout) {
          throw new Error('Circuit breaker abierto - Twilio temporalmente no disponible');
        } else {
          this.circuitBreaker.isOpen = false;
          this.circuitBreaker.failureCount = 0;
        }
      }

      // Enviar mensaje
      const messageService = getMessageService();
      const result = await messageService.sendWhatsAppMessage({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: phone,
        body: message
      });

      // Registrar éxito
      await this.recordMessageResult(campaignId, contactId, {
        success: true,
        twilioSid: result.sid,
        status: result.status,
        sentAt: new Date()
      });

      this.metrics.messagesSent++;
      
      return {
        success: true,
        contactId,
        phone,
        twilioSid: result.sid,
        status: result.status
      };

    } catch (error) {
      // Registrar fallo
      await this.recordMessageResult(campaignId, contactId, {
        success: false,
        error: error.message,
        failedAt: new Date()
      });

      this.metrics.messagesFailed++;

      // Actualizar circuit breaker
      this.circuitBreaker.failureCount++;
      if (this.circuitBreaker.failureCount >= this.circuitBreaker.threshold) {
        this.circuitBreaker.isOpen = true;
        this.circuitBreaker.lastFailureTime = Date.now();
        
        logger.warn('⚠️ Circuit breaker abierto para Twilio', {
          failureCount: this.circuitBreaker.failureCount,
          threshold: this.circuitBreaker.threshold,
          timeout: this.circuitBreaker.timeout
        });
      }

      throw error;
    }
  }

  /**
   * ⏸️ PAUSAR CAMPAÑA
   */
  async pauseCampaign(campaignId) {
    try {
      const campaign = await Campaign.getById(campaignId);
      if (!campaign) {
        throw new Error(`Campaña ${campaignId} no encontrada`);
      }

      // Pausar jobs activos
      const activeJobs = await this.campaignQueue.getJobs(['active']);
      const campaignJobs = activeJobs.filter(job => job.data.campaignId === campaignId);
      
      for (const job of campaignJobs) {
        await job.moveToDelayed(Date.now() + 24 * 60 * 60 * 1000); // Pausar por 24 horas
      }

      // Actualizar estado
      await campaign.updateStatus('paused');

      logger.info('⏸️ Campaña pausada', {
        campaignId,
        activeJobsPaused: campaignJobs.length
      });

      return { success: true, campaignId, activeJobsPaused: campaignJobs.length };

    } catch (error) {
      logger.error('❌ Error pausando campaña', {
        campaignId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * ▶️ REANUDAR CAMPAÑA
   */
  async resumeCampaign(campaignId) {
    try {
      const campaign = await Campaign.getById(campaignId);
      if (!campaign) {
        throw new Error(`Campaña ${campaignId} no encontrada`);
      }

      // Reanudar jobs pausados
      const delayedJobs = await this.campaignQueue.getJobs(['delayed']);
      const campaignJobs = delayedJobs.filter(job => job.data.campaignId === campaignId);
      
      for (const job of campaignJobs) {
        await job.moveToActive();
      }

      // Actualizar estado
      await campaign.updateStatus('sending');

      logger.info('▶️ Campaña reanudada', {
        campaignId,
        jobsResumed: campaignJobs.length
      });

      return { success: true, campaignId, jobsResumed: campaignJobs.length };

    } catch (error) {
      logger.error('❌ Error reanudando campaña', {
        campaignId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🛑 DETENER CAMPAÑA
   */
  async stopCampaign(campaignId) {
    try {
      const campaign = await Campaign.getById(campaignId);
      if (!campaign) {
        throw new Error(`Campaña ${campaignId} no encontrada`);
      }

      // Remover jobs activos y en cola
      const activeJobs = await this.campaignQueue.getJobs(['active', 'waiting']);
      const campaignJobs = activeJobs.filter(job => job.data.campaignId === campaignId);
      
      for (const job of campaignJobs) {
        await job.remove();
      }

      // Actualizar estado
      await campaign.updateStatus('stopped');

      logger.info('🛑 Campaña detenida', {
        campaignId,
        jobsRemoved: campaignJobs.length
      });

      return { success: true, campaignId, jobsRemoved: campaignJobs.length };

    } catch (error) {
      logger.error('❌ Error deteniendo campaña', {
        campaignId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 📊 OBTENER ESTADO DE CAMPAÑA
   */
  async getCampaignStatus(campaignId) {
    try {
      const campaign = await Campaign.getById(campaignId);
      if (!campaign) {
        throw new Error(`Campaña ${campaignId} no encontrada`);
      }

      // Obtener jobs relacionados
      const allJobs = await this.campaignQueue.getJobs(['active', 'waiting', 'delayed', 'completed', 'failed']);
      const campaignJobs = allJobs.filter(job => job.data.campaignId === campaignId);

      const status = {
        campaignId,
        status: campaign.status,
        totalJobs: campaignJobs.length,
        activeJobs: campaignJobs.filter(j => j.status === 'active').length,
        waitingJobs: campaignJobs.filter(j => j.status === 'waiting').length,
        completedJobs: campaignJobs.filter(j => j.status === 'completed').length,
        failedJobs: campaignJobs.filter(j => j.status === 'failed').length,
        progress: await this.getCampaignProgress(campaignId),
        metrics: campaign.getStats()
      };

      return status;

    } catch (error) {
      logger.error('❌ Error obteniendo estado de campaña', {
        campaignId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 🔧 MÉTODOS AUXILIARES
   */
  
  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  getJobPriority(priority) {
    const priorities = {
      'high': 1,
      'normal': 5,
      'low': 10
    };
    return priorities[priority] || 5;
  }

  calculateDelay(scheduledAt) {
    if (!scheduledAt) return 0;
    const delay = new Date(scheduledAt).getTime() - Date.now();
    return Math.max(0, delay);
  }

  estimateProcessingTime(contactCount) {
    const messagesPerSecond = this.twilioLimits.messagesPerSecond;
    const estimatedSeconds = Math.ceil(contactCount / messagesPerSecond);
    return estimatedSeconds * 1000; // en milisegundos
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async updateMetrics() {
    const queueMetrics = await this.campaignQueue.getJobCounts();
    this.metrics.activeWorkers = queueMetrics.active;
    
    logger.info('📊 Métricas de cola de campañas', {
      ...this.metrics,
      queueMetrics
    });
  }

  resetDailyMetrics() {
    this.metrics.campaignsProcessed = 0;
    this.metrics.messagesSent = 0;
    this.metrics.messagesFailed = 0;
    this.metrics.averageProcessingTime = 0;
  }

  async updateCampaignProgress(campaignId, progress) {
    try {
      // Usar Redis para almacenar progreso en tiempo real
      const progressKey = `campaign_progress:${campaignId}`;
      await this.redis.hset(progressKey, {
        processed: progress.processed,
        total: progress.total,
        success: progress.success,
        failed: progress.failed,
        updatedAt: Date.now()
      });
      
      // Expirar después de 24 horas
      await this.redis.expire(progressKey, 24 * 60 * 60);
      
    } catch (error) {
      logger.error('Error actualizando progreso de campaña', {
        campaignId,
        error: error.message
      });
    }
  }

  async waitForCompletion(campaignId, totalContacts) {
    const maxWaitTime = 30 * 60 * 1000; // 30 minutos máximo
    const checkInterval = 5000; // Verificar cada 5 segundos
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const progress = await this.getCampaignProgress(campaignId);
      
      if (progress.processed >= totalContacts) {
        return true;
      }
      
      await this.delay(checkInterval);
    }
    
    logger.warn('Timeout esperando completar campaña', {
      campaignId,
      totalContacts,
      maxWaitTime
    });
    
    return false;
  }

  async getCampaignResults(campaignId) {
    try {
      const resultsKey = `campaign_results:${campaignId}`;
      const results = await this.redis.hgetall(resultsKey);
      
      return {
        success: parseInt(results.success || 0),
        failed: parseInt(results.failed || 0),
        total: parseInt(results.total || 0)
      };
      
    } catch (error) {
      logger.error('Error obteniendo resultados de campaña', {
        campaignId,
        error: error.message
      });
      
      return { success: 0, failed: 0, total: 0 };
    }
  }

  async recordMessageResult(campaignId, contactId, result) {
    try {
      const resultsKey = `campaign_results:${campaignId}`;
      
      if (result.success) {
        await this.redis.hincrby(resultsKey, 'success', 1);
      } else {
        await this.redis.hincrby(resultsKey, 'failed', 1);
      }
      
      await this.redis.hincrby(resultsKey, 'total', 1);
      
      // Almacenar resultado individual
      const messageKey = `campaign_message:${campaignId}:${contactId}`;
      await this.redis.hset(messageKey, {
        success: result.success ? '1' : '0',
        twilioSid: result.twilioSid || '',
        error: result.error || '',
        sentAt: result.sentAt || result.failedAt || Date.now()
      });
      
      // Expirar después de 7 días
      await this.redis.expire(messageKey, 7 * 24 * 60 * 60);
      
    } catch (error) {
      logger.error('Error registrando resultado de mensaje', {
        campaignId,
        contactId,
        error: error.message
      });
    }
  }

  async getCampaignProgress(campaignId) {
    try {
      const progressKey = `campaign_progress:${campaignId}`;
      const progress = await this.redis.hgetall(progressKey);
      
      return {
        processed: parseInt(progress.processed || 0),
        total: parseInt(progress.total || 0),
        success: parseInt(progress.success || 0),
        failed: parseInt(progress.failed || 0),
        percentage: progress.total > 0 ? 
          Math.round((parseInt(progress.processed || 0) / parseInt(progress.total)) * 100) : 0
      };
      
    } catch (error) {
      logger.error('Error obteniendo progreso de campaña', {
        campaignId,
        error: error.message
      });
      
      return { processed: 0, total: 0, success: 0, failed: 0, percentage: 0 };
    }
  }
}

// Singleton instance
const campaignQueueService = new CampaignQueueService();

module.exports = campaignQueueService; 