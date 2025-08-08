#!/usr/bin/env node

/**
 * 🔄 SCRIPT DE MIGRACIÓN DE CONVERSACIONES V1
 * 
 * Migración idempotente para normalizar documentos de conversations
 * al modelo canónico requerido por el listado.
 * 
 * VARIABLES DE ENTORNO:
 * - MIGRATE_DRY_RUN=true (default) - Solo reporta, no escribe
 * - MIGRATION_BATCH_SIZE=200 - Tamaño del lote
 * - MIGRATION_REPORT_DIR=/tmp - Carpeta para reportes
 * - DEFAULT_WORKSPACE_ID=default - Fallback para workspaceId
 * - DEFAULT_TENANT_ID=default - Fallback para tenantId
 * - MIGRATION_MAX_MSGS_TO_COUNT=0 - Contar mensajes (0 = no contar)
 * - MIGRATION_INFER_PARTICIPANTS=true - Inferir participants
 * - MIGRATION_RESUME_CURSOR_FILE=/tmp/migrate_conversations_v1.cursor.json
 * - MIGRATE_ALLOW_PROD=false - Seguridad para producción
 * - MIGRATION_LOG_VERBOSE=true - Logs detallados
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { firestore } = require('../src/config/firebase');
const logger = require('../src/utils/logger');
const fs = require('fs');
const path = require('path');

class ConversationsMigrationV1 {
  constructor() {
    this.config = {
      dryRun: process.env.MIGRATE_DRY_RUN !== 'false',
      batchSize: parseInt(process.env.MIGRATION_BATCH_SIZE) || 200,
      reportDir: process.env.MIGRATION_REPORT_DIR || '/tmp',
      defaultWorkspaceId: process.env.DEFAULT_WORKSPACE_ID || 'default',
      defaultTenantId: process.env.DEFAULT_TENANT_ID || 'default',
      maxMsgsToCount: parseInt(process.env.MIGRATION_MAX_MSGS_TO_COUNT) || 0,
      inferParticipants: process.env.MIGRATION_INFER_PARTICIPANTS !== 'false',
      cursorFile: process.env.MIGRATION_RESUME_CURSOR_FILE || '/tmp/migrate_conversations_v1.cursor.json',
      allowProd: process.env.MIGRATE_ALLOW_PROD === 'true',
      logVerbose: process.env.MIGRATION_LOG_VERBOSE === 'true'
    };

    this.stats = {
      startedAt: new Date().toISOString(),
      finishedAt: null,
      totals: {
        scanned: 0,
        updated: 0,
        skipped: 0,
        errors: 0
      },
      fieldsFilled: {
        workspaceId: 0,
        tenantId: 0,
        status: 0,
        unreadCount: 0,
        messageCount: 0,
        lastMessageAt: 0,
        participants: 0,
        createdAt: 0,
        updatedAt: 0
      },
      truncatedCounts: 0,
      noMessagesUsedCreatedAt: 0,
      emptyParticipantsAfterInference: 0,
      resume: { lastDocId: null },
      errorsList: []
    };

    this.changes = []; // Para CSV
  }

  /**
   * Helper para enmascarar PII
   */
  maskPhone(phone) {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 4) return '****';
    
    const internationalPrefixMatch = phone.match(/^(\+\d{1,4})?(\d+)$/);
    if (internationalPrefixMatch) {
      const prefix = internationalPrefixMatch[1] || '';
      const numberPart = internationalPrefixMatch[2];
      if (numberPart.length <= 4) return `${prefix}****`;
      return `${prefix}${numberPart.substring(0, numberPart.length - 4)}****${numberPart.substring(numberPart.length - 2)}`;
    }
    
    return phone.substring(0, phone.length - 4) + '****' + phone.substring(phone.length - 2);
  }

  maskEmail(email) {
    if (!email) return null;
    const [name, domain] = email.split('@');
    if (!name || !domain) return 'invalid_email';
    return `${name.charAt(0)}***@${domain}`;
  }

  /**
   * Validar configuración de seguridad
   */
  validateConfig() {
    if (process.env.NODE_ENV === 'production' && !this.config.allowProd) {
      throw new Error('MIGRATE_ALLOW_PROD=true es requerido para ejecutar en producción');
    }

    // Crear directorio de reportes si no existe
    if (!fs.existsSync(this.config.reportDir)) {
      fs.mkdirSync(this.config.reportDir, { recursive: true });
    }

    logger.info('🔧 CONFIGURACIÓN DE MIGRACIÓN', {
      dryRun: this.config.dryRun,
      batchSize: this.config.batchSize,
      reportDir: this.config.reportDir,
      defaultWorkspaceId: this.config.defaultWorkspaceId,
      defaultTenantId: this.config.defaultTenantId,
      maxMsgsToCount: this.config.maxMsgsToCount,
      inferParticipants: this.config.inferParticipants,
      allowProd: this.config.allowProd,
      environment: process.env.NODE_ENV
    });
  }

  /**
   * Cargar cursor de reanudación
   */
  loadResumeCursor() {
    try {
      if (fs.existsSync(this.config.cursorFile)) {
        const cursorData = JSON.parse(fs.readFileSync(this.config.cursorFile, 'utf8'));
        this.stats.resume.lastDocId = cursorData.lastDocId;
        logger.info('📂 CURSOR DE REANUDACIÓN CARGADO', {
          lastDocId: this.stats.resume.lastDocId
        });
      }
    } catch (error) {
      logger.warn('⚠️ ERROR CARGANDO CURSOR', {
        error: error.message,
        cursorFile: this.config.cursorFile
      });
    }
  }

  /**
   * Guardar cursor de progreso
   */
  saveResumeCursor(lastDocId) {
    try {
      const cursorData = { lastDocId, timestamp: new Date().toISOString() };
      fs.writeFileSync(this.config.cursorFile, JSON.stringify(cursorData, null, 2));
    } catch (error) {
      logger.error('❌ ERROR GUARDANDO CURSOR', {
        error: error.message,
        lastDocId
      });
    }
  }

  /**
   * Normalizar teléfono a formato E.164
   */
  normalizePhone(phone) {
    if (!phone) return null;
    
    // Si ya tiene +, dejarlo como está
    if (phone.startsWith('+')) {
      return phone;
    }
    
    // Si no tiene +, no inventar país, solo normalizar
    return phone.replace(/\D/g, '');
  }

  /**
   * Inferir participants desde último mensaje
   */
  async inferParticipants(conversationId, existingParticipants = []) {
    if (!this.config.inferParticipants) {
      return existingParticipants;
    }

    try {
      // Buscar último mensaje
      const messagesRef = firestore.collection('conversations').doc(conversationId).collection('messages');
      const lastMessageQuery = await messagesRef.orderBy('timestamp', 'desc').limit(1).get();
      
      if (!lastMessageQuery.empty) {
        const lastMessage = lastMessageQuery.docs[0].data();
        const participants = [...new Set(existingParticipants)];
        
        // Agregar sender y recipient si existen
        if (lastMessage.senderIdentifier && !participants.includes(lastMessage.senderIdentifier)) {
          participants.push(lastMessage.senderIdentifier);
        }
        
        if (lastMessage.recipientIdentifier && !participants.includes(lastMessage.recipientIdentifier)) {
          participants.push(lastMessage.recipientIdentifier);
        }
        
        return participants;
      }
    } catch (error) {
      logger.warn('⚠️ ERROR INFIRIENDO PARTICIPANTS', {
        conversationId,
        error: error.message
      });
    }
    
    return existingParticipants;
  }

  /**
   * Contar mensajes en conversación
   */
  async countMessages(conversationId) {
    if (this.config.maxMsgsToCount === 0) {
      return { count: 0, truncated: false };
    }

    try {
      const messagesRef = firestore.collection('conversations').doc(conversationId).collection('messages');
      const messagesQuery = await messagesRef.limit(this.config.maxMsgsToCount + 1).get();
      
      const count = messagesQuery.docs.length;
      const truncated = count > this.config.maxMsgsToCount;
      
      return {
        count: truncated ? this.config.maxMsgsToCount : count,
        truncated
      };
    } catch (error) {
      logger.warn('⚠️ ERROR CONTANDO MENSAJES', {
        conversationId,
        error: error.message
      });
      return { count: 0, truncated: false };
    }
  }

  /**
   * Obtener último mensaje para lastMessageAt
   */
  async getLastMessageTimestamp(conversationId) {
    try {
      const messagesRef = firestore.collection('conversations').doc(conversationId).collection('messages');
      const lastMessageQuery = await messagesRef.orderBy('timestamp', 'desc').limit(1).get();
      
      if (!lastMessageQuery.empty) {
        const lastMessage = lastMessageQuery.docs[0].data();
        return lastMessage.timestamp;
      }
    } catch (error) {
      logger.warn('⚠️ ERROR OBTENIENDO ÚLTIMO MENSAJE', {
        conversationId,
        error: error.message
      });
    }
    
    return null;
  }

  /**
   * Procesar un documento de conversación
   */
  async processConversation(doc) {
    const docId = doc.id;
    const data = doc.data();
    const changes = [];
    const skippedFields = [];
    let error = null;

    try {
      const updatePayload = {};

      // 1. workspaceId
      if (!data.workspaceId) {
        updatePayload.workspaceId = this.config.defaultWorkspaceId;
        changes.push('workspaceId');
        this.stats.fieldsFilled.workspaceId++;
      }

      // 2. tenantId
      if (!data.tenantId) {
        updatePayload.tenantId = this.config.defaultTenantId;
        changes.push('tenantId');
        this.stats.fieldsFilled.tenantId++;
      }

      // 3. status
      if (!data.status) {
        updatePayload.status = 'open';
        changes.push('status');
        this.stats.fieldsFilled.status++;
      }

      // 4. unreadCount
      if (data.unreadCount === undefined || data.unreadCount === null) {
        updatePayload.unreadCount = 0;
        changes.push('unreadCount');
        this.stats.fieldsFilled.unreadCount++;
      }

      // 5. messageCount
      if (data.messageCount === undefined || data.messageCount === null) {
        const messageCountResult = await this.countMessages(docId);
        updatePayload.messageCount = messageCountResult.count;
        changes.push('messageCount');
        this.stats.fieldsFilled.messageCount++;
        
        if (messageCountResult.truncated) {
          this.stats.truncatedCounts++;
        }
      }

      // 6. lastMessageAt
      if (!data.lastMessageAt) {
        let lastMessageAt = null;
        
        // Intentar usar lastMessage.timestamp
        if (data.lastMessage && data.lastMessage.timestamp) {
          lastMessageAt = data.lastMessage.timestamp;
        } else {
          // Buscar último mensaje
          lastMessageAt = await this.getLastMessageTimestamp(docId);
        }
        
        if (!lastMessageAt) {
          // Usar createdAt, updatedAt o now()
          lastMessageAt = data.createdAt || data.updatedAt || new Date();
          this.stats.noMessagesUsedCreatedAt++;
        }
        
        updatePayload.lastMessageAt = lastMessageAt;
        changes.push('lastMessageAt');
        this.stats.fieldsFilled.lastMessageAt++;
      }

      // 7. participants
      if (!data.participants || data.participants.length === 0) {
        let participants = [];
        
        // Intentar inferir desde último mensaje
        participants = await this.inferParticipants(docId, participants);
        
        // Agregar customerPhone si existe
        if (data.customerPhone) {
          const normalizedPhone = this.normalizePhone(data.customerPhone);
          if (normalizedPhone && !participants.includes(normalizedPhone)) {
            participants.push(normalizedPhone);
          }
        }
        
        // Remover duplicados
        participants = [...new Set(participants)];
        
        if (participants.length === 0) {
          this.stats.emptyParticipantsAfterInference++;
        }
        
        updatePayload.participants = participants;
        changes.push('participants');
        this.stats.fieldsFilled.participants++;
      }

      // 8. createdAt
      if (!data.createdAt) {
        updatePayload.createdAt = new Date();
        changes.push('createdAt');
        this.stats.fieldsFilled.createdAt++;
      }

      // 9. updatedAt
      if (!data.updatedAt) {
        updatePayload.updatedAt = new Date();
        changes.push('updatedAt');
        this.stats.fieldsFilled.updatedAt++;
      }

      // Aplicar cambios si hay algo que actualizar
      if (Object.keys(updatePayload).length > 0) {
        if (!this.config.dryRun) {
          await firestore.collection('conversations').doc(docId).update(updatePayload);
        }
        
        this.stats.totals.updated++;
      } else {
        this.stats.totals.skipped++;
        skippedFields.push('no_changes_needed');
      }

      // Registrar cambio para CSV
      this.changes.push({
        docId,
        action: this.config.dryRun ? 'would_update' : 'updated',
        filledFields: changes.join(','),
        skippedFields: skippedFields.join(','),
        truncatedCounts: changes.includes('messageCount') ? 'yes' : 'no',
        usedLastMsg: changes.includes('lastMessageAt') ? 'yes' : 'no',
        usedCreatedAt: this.stats.noMessagesUsedCreatedAt > 0 ? 'yes' : 'no',
        emptyParticipantsAfterInference: changes.includes('participants') && participants.length === 0 ? 'yes' : 'no',
        error: null
      });

    } catch (err) {
      error = err.message;
      this.stats.totals.errors++;
      this.stats.errorsList.push({
        docId,
        error: err.message,
        timestamp: new Date().toISOString()
      });

      this.changes.push({
        docId,
        action: 'error',
        filledFields: '',
        skippedFields: '',
        truncatedCounts: 'no',
        usedLastMsg: 'no',
        usedCreatedAt: 'no',
        emptyParticipantsAfterInference: 'no',
        error: err.message
      });

      logger.error('❌ ERROR PROCESANDO CONVERSACIÓN', {
        docId,
        error: err.message
      });
    }

    return { changes, error };
  }

  /**
   * Ejecutar migración por lotes
   */
  async run() {
    try {
      this.validateConfig();
      this.loadResumeCursor();

      logger.info('🚀 INICIANDO MIGRACIÓN DE CONVERSACIONES V1', {
        dryRun: this.config.dryRun,
        batchSize: this.config.batchSize,
        resumeFrom: this.stats.resume.lastDocId
      });

      let query = firestore.collection('conversations').orderBy('__name__');
      
      // Aplicar cursor de reanudación
      if (this.stats.resume.lastDocId) {
        const lastDoc = await firestore.collection('conversations').doc(this.stats.resume.lastDocId).get();
        if (lastDoc.exists) {
          query = query.startAfter(lastDoc);
        }
      }

      let batchNumber = 0;
      let hasMore = true;

      while (hasMore) {
        batchNumber++;
        
        try {
          const snapshot = await query.limit(this.config.batchSize).get();
          const docs = snapshot.docs;
          
          if (docs.length === 0) {
            hasMore = false;
            break;
          }

          // Procesar documentos del lote
          for (const doc of docs) {
            await this.processConversation(doc);
            this.stats.totals.scanned++;
          }

          // Guardar cursor de progreso
          const lastDoc = docs[docs.length - 1];
          this.stats.resume.lastDocId = lastDoc.id;
          this.saveResumeCursor(lastDoc.id);

          // Log de progreso
          if (this.config.logVerbose) {
            logger.info('📊 PROGRESO DE MIGRACIÓN', {
              event: 'migration_batch',
              batchNumber,
              scanned: this.stats.totals.scanned,
              updated: this.stats.totals.updated,
              errors: this.stats.totals.errors,
              lastDocId: lastDoc.id
            });
          }

          // Actualizar query para siguiente lote
          query = firestore.collection('conversations').orderBy('__name__').startAfter(lastDoc);

        } catch (error) {
          logger.error('❌ ERROR EN LOTE', {
            batchNumber,
            error: error.message
          });
          
          // Reintento con backoff exponencial
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      this.stats.finishedAt = new Date().toISOString();
      this.generateReports();

      logger.info('✅ MIGRACIÓN COMPLETADA', {
        dryRun: this.config.dryRun,
        totals: this.stats.totals,
        fieldsFilled: this.stats.fieldsFilled
      });

    } catch (error) {
      logger.error('❌ ERROR CRÍTICO EN MIGRACIÓN', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Generar reportes JSON y CSV
   */
  generateReports() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Reporte JSON
    const jsonReport = {
      ...this.stats,
      config: {
        dryRun: this.config.dryRun,
        batchSize: this.config.batchSize,
        maxMsgsToCount: this.config.maxMsgsToCount,
        inferParticipants: this.config.inferParticipants
      }
    };
    
    const jsonPath = path.join(this.config.reportDir, `conversations_migration_report_${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
    
    // Reporte CSV
    const csvHeaders = 'docId,action,filledFields,skippedFields,truncatedCounts,usedLastMsg,usedCreatedAt,emptyParticipantsAfterInference,error\n';
    const csvRows = this.changes.map(change => 
      `${change.docId},${change.action},${change.filledFields},${change.skippedFields},${change.truncatedCounts},${change.usedLastMsg},${change.usedCreatedAt},${change.emptyParticipantsAfterInference},${change.error || ''}`
    ).join('\n');
    
    const csvPath = path.join(this.config.reportDir, `conversations_migration_changes_${timestamp}.csv`);
    fs.writeFileSync(csvPath, csvHeaders + csvRows);
    
    logger.info('📊 REPORTES GENERADOS', {
      jsonReport: jsonPath,
      csvReport: csvPath,
      totalChanges: this.changes.length
    });
  }
}

// Ejecutar migración
if (require.main === module) {
  const migration = new ConversationsMigrationV1();
  migration.run()
    .then(() => {
      logger.info('✅ MIGRACIÓN EXITOSA');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ MIGRACIÓN FALLIDA', {
        error: error.message
      });
      process.exit(1);
    });
}

module.exports = ConversationsMigrationV1; 