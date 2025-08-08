/**
 * 🔄 SCRIPT DE MIGRACIÓN DE CONVERSACIONES V1
 * 
 * Migración idempotente para agregar campos faltantes a conversaciones existentes:
 * - workspaceId y tenantId (para multi-tenancy)
 * - status (si falta)
 * - unreadCount (si falta)
 * - participants (si falta)
 * 
 * FLAGS DE CONFIGURACIÓN:
 * - MIGRATE_DRY_RUN=true (default) - Solo generar reporte, no aplicar cambios
 * - MIGRATION_BATCH_SIZE=200 - Tamaño del lote de procesamiento
 * - CONVERSATIONS_COLLECTION_PATH - Ruta de la colección (default: 'conversations')
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
    this.dryRun = process.env.MIGRATE_DRY_RUN !== 'false';
    this.batchSize = parseInt(process.env.MIGRATION_BATCH_SIZE) || 200;
    this.collectionPath = process.env.CONVERSATIONS_COLLECTION_PATH || 'conversations';
    this.reportPath = `/tmp/conversations_migration_report_${Date.now()}.json`;
    
    this.stats = {
      totalProcessed: 0,
      totalChanged: 0,
      totalSkipped: 0,
      errors: [],
      startTime: Date.now()
    };
  }

  /**
   * Ejecutar migración completa
   */
  async run() {
    try {
      logger.info('🚀 Iniciando migración de conversaciones V1', {
        dryRun: this.dryRun,
        batchSize: this.batchSize,
        collectionPath: this.collectionPath
      });

      // Obtener todas las conversaciones
      const conversations = await this.getAllConversations();
      
      logger.info(`📊 Total de conversaciones encontradas: ${conversations.length}`);

      // Procesar en lotes
      const batches = this.chunkArray(conversations, this.batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        logger.info(`🔄 Procesando lote ${i + 1}/${batches.length} (${batch.length} conversaciones)`);
        
        await this.processBatch(batch);
      }

      // Generar reporte final
      await this.generateReport();

      logger.info('✅ Migración completada', {
        totalProcessed: this.stats.totalProcessed,
        totalChanged: this.stats.totalChanged,
        totalSkipped: this.stats.totalSkipped,
        duration: Date.now() - this.stats.startTime
      });

    } catch (error) {
      logger.error('❌ Error durante migración', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Obtener todas las conversaciones de Firestore
   */
  async getAllConversations() {
    const snapshot = await firestore.collection(this.collectionPath).get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  /**
   * Procesar un lote de conversaciones
   */
  async processBatch(conversations) {
    const batch = firestore.batch();
    const report = [];

    for (const conversation of conversations) {
      try {
        const migrationResult = this.migrateConversation(conversation);
        
        if (migrationResult.needsUpdate) {
          if (!this.dryRun) {
            const docRef = firestore.collection(this.collectionPath).doc(conversation.id);
            batch.update(docRef, migrationResult.updates);
          }
          
          this.stats.totalChanged++;
          report.push({
            id: conversation.id,
            changedFields: migrationResult.changedFields,
            inferredValues: migrationResult.inferredValues,
            skippedReason: null
          });
        } else {
          this.stats.totalSkipped++;
          report.push({
            id: conversation.id,
            changedFields: [],
            inferredValues: {},
            skippedReason: 'No requiere actualización'
          });
        }

        this.stats.totalProcessed++;

      } catch (error) {
        this.stats.errors.push({
          id: conversation.id,
          error: error.message
        });
        
        report.push({
          id: conversation.id,
          changedFields: [],
          inferredValues: {},
          skippedReason: `Error: ${error.message}`
        });
      }
    }

    // Aplicar cambios si no es dry run
    if (!this.dryRun && this.stats.totalChanged > 0) {
      await batch.commit();
      logger.info(`✅ Lote aplicado: ${this.stats.totalChanged} conversaciones actualizadas`);
    }

    return report;
  }

  /**
   * Migrar una conversación individual
   */
  migrateConversation(conversation) {
    const updates = {};
    const changedFields = [];
    const inferredValues = {};

    // 1. workspaceId y tenantId
    if (!conversation.workspaceId) {
      const workspaceId = this.inferWorkspaceId(conversation);
      if (workspaceId) {
        updates.workspaceId = workspaceId;
        changedFields.push('workspaceId');
        inferredValues.workspaceId = workspaceId;
      }
    }

    if (!conversation.tenantId) {
      const tenantId = this.inferTenantId(conversation);
      if (tenantId) {
        updates.tenantId = tenantId;
        changedFields.push('tenantId');
        inferredValues.tenantId = tenantId;
      }
    }

    // 2. status
    if (!conversation.status) {
      updates.status = 'open';
      changedFields.push('status');
      inferredValues.status = 'open';
    }

    // 3. unreadCount
    if (conversation.unreadCount === undefined || conversation.unreadCount === null) {
      updates.unreadCount = 0;
      changedFields.push('unreadCount');
      inferredValues.unreadCount = 0;
    }

    // 4. participants
    if (!conversation.participants || conversation.participants.length === 0) {
      const participants = this.inferParticipants(conversation);
      if (participants.length > 0) {
        updates.participants = participants;
        changedFields.push('participants');
        inferredValues.participants = participants;
      }
    }

    // 5. lastMessageAt (derivado de lastMessage.timestamp si falta)
    if (!conversation.lastMessageAt && conversation.lastMessage?.timestamp) {
      updates.lastMessageAt = conversation.lastMessage.timestamp;
      changedFields.push('lastMessageAt');
      inferredValues.lastMessageAt = conversation.lastMessage.timestamp;
    }

    return {
      needsUpdate: changedFields.length > 0,
      updates,
      changedFields,
      inferredValues
    };
  }

  /**
   * Inferir workspaceId basado en la conversación
   */
  inferWorkspaceId(conversation) {
    // Lógica de inferencia basada en el contexto del proyecto
    // Por ahora, usar un valor por defecto o inferir desde customerPhone
    
    // Opción 1: Usar workspace por defecto del ENV
    const defaultWorkspace = process.env.DEFAULT_WORKSPACE_ID;
    if (defaultWorkspace) {
      return defaultWorkspace;
    }

    // Opción 2: Inferir desde customerPhone (si tiene formato específico)
    if (conversation.customerPhone) {
      // Ejemplo: si el teléfono empieza con +52, podría ser workspace 'mexico'
      if (conversation.customerPhone.startsWith('+52')) {
        return 'mexico';
      }
      if (conversation.customerPhone.startsWith('+1')) {
        return 'usa';
      }
    }

    // Opción 3: Usar workspace genérico
    return 'default';
  }

  /**
   * Inferir tenantId basado en la conversación
   */
  inferTenantId(conversation) {
    // Lógica similar a workspaceId
    const defaultTenant = process.env.DEFAULT_TENANT_ID;
    if (defaultTenant) {
      return defaultTenant;
    }

    // Por ahora, usar el mismo valor que workspaceId
    return this.inferWorkspaceId(conversation);
  }

  /**
   * Inferir participants basado en la conversación
   */
  inferParticipants(conversation) {
    const participants = [];

    // Agregar customerPhone si existe
    if (conversation.customerPhone) {
      participants.push(conversation.customerPhone);
    }

    // Agregar assignedTo si existe
    if (conversation.assignedTo) {
      participants.push(conversation.assignedTo);
    }

    return participants;
  }

  /**
   * Dividir array en lotes
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Generar reporte final
   */
  async generateReport() {
    const report = {
      metadata: {
        dryRun: this.dryRun,
        batchSize: this.batchSize,
        collectionPath: this.collectionPath,
        timestamp: new Date().toISOString(),
        duration: Date.now() - this.stats.startTime
      },
      stats: this.stats,
      summary: {
        totalProcessed: this.stats.totalProcessed,
        totalChanged: this.stats.totalChanged,
        totalSkipped: this.stats.totalSkipped,
        errorCount: this.stats.errors.length
      }
    };

    // Escribir reporte a archivo
    fs.writeFileSync(this.reportPath, JSON.stringify(report, null, 2));
    
    logger.info(`📄 Reporte generado: ${this.reportPath}`);
    
    // También generar CSV si hay datos
    if (this.stats.totalProcessed > 0) {
      await this.generateCSVReport();
    }
  }

  /**
   * Generar reporte CSV
   */
  async generateCSVReport() {
    const csvPath = this.reportPath.replace('.json', '.csv');
    const csvHeader = 'id,changedFields,inferredValues,skippedReason\n';
    
    // Por ahora, crear un CSV básico
    // En una implementación completa, incluirías los datos del reporte
    fs.writeFileSync(csvPath, csvHeader);
    
    logger.info(`📊 Reporte CSV generado: ${csvPath}`);
  }
}

// Ejecutar migración si se llama directamente
if (require.main === module) {
  const migration = new ConversationsMigrationV1();
  migration.run()
    .then(() => {
      logger.info('✅ Migración completada exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Migración falló', { error: error.message });
      process.exit(1);
    });
}

module.exports = { ConversationsMigrationV1 }; 