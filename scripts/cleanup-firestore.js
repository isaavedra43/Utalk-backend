#!/usr/bin/env node

/**
 * Script de limpieza de Firestore
 * Ejecutar con: node scripts/cleanup-firestore.js [opciones]
 */

require('dotenv').config();
const { firestore, FieldValue, Timestamp } = require('../src/config/firebase');
const logger = require('../src/utils/logger');

// Configuración por argumentos de línea de comandos
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  orphansOnly: args.includes('--orphans-only'),
  oldDataOnly: args.includes('--old-data-only'),
  optimize: args.includes('--optimize'),
  verbose: args.includes('--verbose'),
  force: args.includes('--force'),
};

/**
 * Clase principal para limpieza de Firestore
 */
class FirestoreCleanup {
  constructor () {
    this.stats = {
      documentsScanned: 0,
      documentsDeleted: 0,
      collectionsProcessed: 0,
      orphansFound: 0,
      dataCorrupted: 0,
      errorsEncountered: 0,
    };
  }

  /**
   * Ejecutar limpieza principal
   */
  async run () {
    try {
      console.log('🧹 INICIANDO LIMPIEZA DE FIRESTORE');
      console.log('=====================================');

      if (options.dryRun) {
        console.log('🔍 MODO DRY RUN - No se eliminarán datos realmente');
      }

      // 1. Limpiar documentos huérfanos
      if (!options.oldDataOnly) {
        console.log('\n📂 Limpiando documentos huérfanos...');
        await this.cleanOrphanedDocuments();
      }

      // 2. Limpiar datos antiguos
      if (!options.orphansOnly) {
        console.log('\n🗓️ Limpiando datos antiguos...');
        await this.cleanOldData();
      }

      // 3. Limpiar datos corruptos
      console.log('\n🔧 Validando y limpiando datos corruptos...');
      await this.cleanCorruptedData();

      // 4. Optimización opcional
      if (options.optimize) {
        console.log('\n⚡ Optimizando estructura de datos...');
        await this.optimizeCollections();
      }

      // 5. Mostrar estadísticas finales
      console.log('\n📊 ESTADÍSTICAS DE LIMPIEZA');
      console.log('=============================');
      console.log(`📄 Documentos escaneados: ${this.stats.documentsScanned}`);
      console.log(`🗑️ Documentos eliminados: ${this.stats.documentsDeleted}`);
      console.log(`📁 Colecciones procesadas: ${this.stats.collectionsProcessed}`);
      console.log(`🔗 Huérfanos encontrados: ${this.stats.orphansFound}`);
      console.log(`💔 Datos corruptos: ${this.stats.dataCorrupted}`);
      console.log(`❌ Errores encontrados: ${this.stats.errorsEncountered}`);

      console.log('\n✅ LIMPIEZA COMPLETADA');

      if (options.dryRun) {
        console.log('\n🔍 Ejecutar sin --dry-run para aplicar cambios reales');
      }
    } catch (error) {
      console.error('❌ Error fatal en limpieza de Firestore:', error);
      process.exit(1);
    }
  }

  /**
   * Limpiar documentos huérfanos
   */
  async cleanOrphanedDocuments () {
    try {
      // Buscar mensajes huérfanos (sin conversationId válido)
      await this.cleanOrphanedMessages();

      // Buscar conversaciones huérfanas (sin mensajes)
      await this.cleanOrphanedConversations();

      // Buscar contactos huérfanos (sin mensajes ni conversaciones)
      await this.cleanOrphanedContacts();
    } catch (error) {
      console.error('❌ Error limpiando documentos huérfanos:', error);
      this.stats.errorsEncountered++;
    }
  }

  /**
   * Limpiar mensajes huérfanos
   */
  async cleanOrphanedMessages () {
    try {
      console.log('   🔍 Escaneando mensajes huérfanos...');

      // Obtener todos los mensajes sin conversationId o con conversationId inválido
      const messagesSnapshot = await firestore.collection('messages').get();
      let orphanedCount = 0;

      for (const doc of messagesSnapshot.docs) {
        this.stats.documentsScanned++;
        const data = doc.data();

        // Verificar si es huérfano
        if (!data.conversationId || !this.isValidConversationId(data.conversationId)) {
          this.stats.orphansFound++;
          orphanedCount++;

          if (options.verbose) {
            console.log(`     - Mensaje huérfano: ${doc.id} (conversationId: ${data.conversationId || 'null'})`);
          }

          // Eliminar si no es dry run
          if (!options.dryRun) {
            await doc.ref.delete();
            this.stats.documentsDeleted++;
          }
        }
      }

      console.log(`   ✅ Mensajes huérfanos: ${orphanedCount} encontrados`);
    } catch (error) {
      console.error('   ❌ Error limpiando mensajes huérfanos:', error);
      this.stats.errorsEncountered++;
    }
  }

  /**
   * Limpiar conversaciones huérfanas
   */
  async cleanOrphanedConversations () {
    try {
      console.log('   🔍 Escaneando conversaciones huérfanas...');

      const conversationsSnapshot = await firestore.collection('conversations').get();
      let orphanedCount = 0;

      for (const doc of conversationsSnapshot.docs) {
        this.stats.documentsScanned++;
        const data = doc.data();

        // Verificar si tiene mensajes asociados
        const messagesSnapshot = await firestore
          .collection('messages')
          .where('conversationId', '==', doc.id)
          .limit(1)
          .get();

        if (messagesSnapshot.empty) {
          this.stats.orphansFound++;
          orphanedCount++;

          if (options.verbose) {
            console.log(`     - Conversación huérfana: ${doc.id}`);
          }

          // Eliminar si no es dry run
          if (!options.dryRun) {
            await doc.ref.delete();
            this.stats.documentsDeleted++;
          }
        }
      }

      console.log(`   ✅ Conversaciones huérfanas: ${orphanedCount} encontradas`);
    } catch (error) {
      console.error('   ❌ Error limpiando conversaciones huérfanas:', error);
      this.stats.errorsEncountered++;
    }
  }

  /**
   * Limpiar contactos huérfanos
   */
  async cleanOrphanedContacts () {
    try {
      console.log('   🔍 Escaneando contactos huérfanos...');

      const contactsSnapshot = await firestore.collection('contacts').get();
      let orphanedCount = 0;

      for (const doc of contactsSnapshot.docs) {
        this.stats.documentsScanned++;
        const data = doc.data();

        // Verificar si tiene mensajes o conversaciones asociadas
        const [messagesSnapshot, conversationsSnapshot] = await Promise.all([
          firestore.collection('messages')
            .where('from', '==', data.phone)
            .limit(1)
            .get(),
          firestore.collection('messages')
            .where('to', '==', data.phone)
            .limit(1)
            .get(),
        ]);

        if (messagesSnapshot.empty && conversationsSnapshot.empty) {
          // Verificar que el contacto no sea reciente (menor a 7 días)
          const createdAt = data.createdAt?.toDate() || new Date(0);
          const daysSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

          if (daysSinceCreated > 7) {
            this.stats.orphansFound++;
            orphanedCount++;

            if (options.verbose) {
              console.log(`     - Contacto huérfano: ${doc.id} (${data.phone})`);
            }

            // Eliminar si no es dry run
            if (!options.dryRun) {
              await doc.ref.delete();
              this.stats.documentsDeleted++;
            }
          }
        }
      }

      console.log(`   ✅ Contactos huérfanos: ${orphanedCount} encontrados`);
    } catch (error) {
      console.error('   ❌ Error limpiando contactos huérfanos:', error);
      this.stats.errorsEncountered++;
    }
  }

  /**
   * Limpiar datos antiguos
   */
  async cleanOldData () {
    try {
      // Limpiar logs antiguos (más de 30 días)
      await this.cleanOldLogs();

      // Limpiar métricas antiguas (más de 90 días)
      await this.cleanOldMetrics();

      // Limpiar datos de debug antiguos
      await this.cleanOldDebugData();
    } catch (error) {
      console.error('❌ Error limpiando datos antiguos:', error);
      this.stats.errorsEncountered++;
    }
  }

  /**
   * Limpiar logs antiguos
   */
  async cleanOldLogs () {
    try {
      console.log('   🔍 Limpiando logs antiguos...');

      const cutoffDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)); // 30 días
      let deletedCount = 0;

      // Buscar logs antiguos
      const logsSnapshot = await firestore
        .collection('logs')
        .where('timestamp', '<', Timestamp.fromDate(cutoffDate))
        .get();

      if (!logsSnapshot.empty) {
        // Eliminar en lotes para mejor rendimiento
        const batches = this.createBatches(logsSnapshot.docs, 500);

        for (const batch of batches) {
          if (!options.dryRun) {
            const deleteBatch = firestore.batch();
            batch.forEach(doc => {
              deleteBatch.delete(doc.ref);
            });
            await deleteBatch.commit();
          }

          deletedCount += batch.length;
          this.stats.documentsDeleted += batch.length;
          this.stats.documentsScanned += batch.length;
        }
      }

      console.log(`   ✅ Logs antiguos eliminados: ${deletedCount}`);
    } catch (error) {
      console.error('   ❌ Error limpiando logs antiguos:', error);
      this.stats.errorsEncountered++;
    }
  }

  /**
   * Limpiar métricas antiguas
   */
  async cleanOldMetrics () {
    try {
      console.log('   🔍 Limpiando métricas antiguas...');

      const cutoffDate = new Date(Date.now() - (90 * 24 * 60 * 60 * 1000)); // 90 días
      let deletedCount = 0;

      // Buscar métricas antiguas
      const metricsSnapshot = await firestore
        .collection('dashboard_metrics')
        .where('createdAt', '<', Timestamp.fromDate(cutoffDate))
        .get();

      if (!metricsSnapshot.empty) {
        const batches = this.createBatches(metricsSnapshot.docs, 500);

        for (const batch of batches) {
          if (!options.dryRun) {
            const deleteBatch = firestore.batch();
            batch.forEach(doc => {
              deleteBatch.delete(doc.ref);
            });
            await deleteBatch.commit();
          }

          deletedCount += batch.length;
          this.stats.documentsDeleted += batch.length;
          this.stats.documentsScanned += batch.length;
        }
      }

      console.log(`   ✅ Métricas antiguas eliminadas: ${deletedCount}`);
    } catch (error) {
      console.error('   ❌ Error limpiando métricas antiguas:', error);
      this.stats.errorsEncountered++;
    }
  }

  /**
   * Limpiar datos de debug antiguos
   */
  async cleanOldDebugData () {
    try {
      console.log('   🔍 Limpiando datos de debug...');

      const debugCollections = ['_debug', '_test', '_health'];
      let totalDeleted = 0;

      for (const collectionName of debugCollections) {
        try {
          const snapshot = await firestore.collection(collectionName).get();

          if (!snapshot.empty) {
            let deleted = 0;

            for (const doc of snapshot.docs) {
              this.stats.documentsScanned++;

              if (!options.dryRun) {
                await doc.ref.delete();
              }

              deleted++;
              this.stats.documentsDeleted++;
            }

            totalDeleted += deleted;

            if (options.verbose) {
              console.log(`     - ${collectionName}: ${deleted} documentos`);
            }
          }
        } catch (error) {
          // Ignorar errores de colecciones que no existen
          if (!error.message.includes('not found')) {
            console.warn(`     ⚠️ Error limpiando ${collectionName}:`, error.message);
          }
        }
      }

      console.log(`   ✅ Datos de debug eliminados: ${totalDeleted}`);
    } catch (error) {
      console.error('   ❌ Error limpiando datos de debug:', error);
      this.stats.errorsEncountered++;
    }
  }

  /**
   * Limpiar datos corruptos
   */
  async cleanCorruptedData () {
    try {
      // Validar mensajes con campos faltantes
      await this.validateMessages();

      // Validar conversaciones con datos inconsistentes
      await this.validateConversations();

      // Validar contactos con datos inválidos
      await this.validateContacts();
    } catch (error) {
      console.error('❌ Error validando datos:', error);
      this.stats.errorsEncountered++;
    }
  }

  /**
   * Validar mensajes
   */
  async validateMessages () {
    try {
      console.log('   🔍 Validando mensajes...');

      const messagesSnapshot = await firestore.collection('messages').get();
      let corruptedCount = 0;

      for (const doc of messagesSnapshot.docs) {
        this.stats.documentsScanned++;
        const data = doc.data();

        // Verificar campos obligatorios
        const requiredFields = ['from', 'to', 'direction', 'timestamp'];
        const missingFields = requiredFields.filter(field => !data[field]);

        if (missingFields.length > 0) {
          this.stats.dataCorrupted++;
          corruptedCount++;

          if (options.verbose) {
            console.log(`     - Mensaje corrupto: ${doc.id} (faltan: ${missingFields.join(', ')})`);
          }

          // Intentar reparar o eliminar
          if (!options.dryRun) {
            if (this.canRepairMessage(data)) {
              await this.repairMessage(doc.ref, data);
            } else {
              await doc.ref.delete();
              this.stats.documentsDeleted++;
            }
          }
        }
      }

      console.log(`   ✅ Mensajes corruptos: ${corruptedCount} encontrados`);
    } catch (error) {
      console.error('   ❌ Error validando mensajes:', error);
      this.stats.errorsEncountered++;
    }
  }

  /**
   * Validar conversaciones
   */
  async validateConversations () {
    try {
      console.log('   🔍 Validando conversaciones...');

      const conversationsSnapshot = await firestore.collection('conversations').get();
      let corruptedCount = 0;

      for (const doc of conversationsSnapshot.docs) {
        this.stats.documentsScanned++;
        const data = doc.data();

        // Verificar campos obligatorios
        if (!data.contactId || !data.createdAt) {
          this.stats.dataCorrupted++;
          corruptedCount++;

          if (options.verbose) {
            console.log(`     - Conversación corrupta: ${doc.id}`);
          }

          // Intentar reparar o eliminar
          if (!options.dryRun) {
            if (this.canRepairConversation(data)) {
              await this.repairConversation(doc.ref, data);
            } else {
              await doc.ref.delete();
              this.stats.documentsDeleted++;
            }
          }
        }
      }

      console.log(`   ✅ Conversaciones corruptas: ${corruptedCount} encontradas`);
    } catch (error) {
      console.error('   ❌ Error validando conversaciones:', error);
      this.stats.errorsEncountered++;
    }
  }

  /**
   * Validar contactos
   */
  async validateContacts () {
    try {
      console.log('   🔍 Validando contactos...');

      const contactsSnapshot = await firestore.collection('contacts').get();
      let corruptedCount = 0;

      for (const doc of contactsSnapshot.docs) {
        this.stats.documentsScanned++;
        const data = doc.data();

        // Verificar formato de teléfono
        if (!data.phone || !this.isValidPhoneNumber(data.phone)) {
          this.stats.dataCorrupted++;
          corruptedCount++;

          if (options.verbose) {
            console.log(`     - Contacto corrupto: ${doc.id} (teléfono: ${data.phone})`);
          }

          // Intentar reparar o eliminar
          if (!options.dryRun) {
            if (this.canRepairContact(data)) {
              await this.repairContact(doc.ref, data);
            } else {
              await doc.ref.delete();
              this.stats.documentsDeleted++;
            }
          }
        }
      }

      console.log(`   ✅ Contactos corruptos: ${corruptedCount} encontrados`);
    } catch (error) {
      console.error('   ❌ Error validando contactos:', error);
      this.stats.errorsEncountered++;
    }
  }

  /**
   * Optimizar colecciones
   */
  async optimizeCollections () {
    try {
      // Recalcular contadores de mensajes
      await this.recalculateMessageCounts();

      // Optimizar índices (conceptual)
      await this.suggestIndexOptimizations();
    } catch (error) {
      console.error('❌ Error optimizando colecciones:', error);
      this.stats.errorsEncountered++;
    }
  }

  /**
   * Recalcular contadores de mensajes
   */
  async recalculateMessageCounts () {
    try {
      console.log('   🔢 Recalculando contadores de mensajes...');

      const conversationsSnapshot = await firestore.collection('conversations').get();
      let updatedCount = 0;

      for (const doc of conversationsSnapshot.docs) {
        this.stats.documentsScanned++;

        // Contar mensajes reales
        const messagesSnapshot = await firestore
          .collection('messages')
          .where('conversationId', '==', doc.id)
          .get();

        const actualCount = messagesSnapshot.size;
        const storedCount = doc.data().messageCount || 0;

        if (actualCount !== storedCount) {
          if (options.verbose) {
            console.log(`     - Conversación ${doc.id}: ${storedCount} → ${actualCount} mensajes`);
          }

          if (!options.dryRun) {
            await doc.ref.update({ messageCount: actualCount });
          }

          updatedCount++;
        }
      }

      console.log(`   ✅ Contadores actualizados: ${updatedCount}`);
    } catch (error) {
      console.error('   ❌ Error recalculando contadores:', error);
      this.stats.errorsEncountered++;
    }
  }

  /**
   * Sugerir optimizaciones de índices
   */
  async suggestIndexOptimizations () {
    console.log('   💡 Sugerencias de optimización:');
    console.log('     - Crear índice compuesto en messages: (conversationId, timestamp)');
    console.log('     - Crear índice compuesto en contacts: (phone, isActive)');
    console.log('     - Crear índice en conversations: (status, updatedAt)');
    console.log('     - Considerar índice TTL para logs y métricas');
  }

  // Métodos de utilidad

  /**
   * Verificar si es un conversationId válido
   */
  isValidConversationId (id) {
    return typeof id === 'string' && /^conv_\d+_\d+$/.test(id);
  }

  /**
   * Verificar si es un número de teléfono válido
   */
  isValidPhoneNumber (phone) {
    return typeof phone === 'string' && /^\+[1-9]\d{1,14}$/.test(phone);
  }

  /**
   * Crear lotes para operaciones masivas
   */
  createBatches (docs, batchSize) {
    const batches = [];
    for (let i = 0; i < docs.length; i += batchSize) {
      batches.push(docs.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Verificar si un mensaje puede ser reparado
   */
  canRepairMessage (data) {
    // Solo reparar si tiene datos básicos
    return data.from && data.to && (data.content || data.type);
  }

  /**
   * Reparar mensaje
   */
  async repairMessage (docRef, data) {
    const updates = {};

    if (!data.direction) {
      updates.direction = 'unknown';
    }

    if (!data.timestamp) {
      updates.timestamp = Timestamp.now();
    }

    if (!data.status) {
      updates.status = 'delivered';
    }

    if (Object.keys(updates).length > 0) {
      await docRef.update(updates);
    }
  }

  /**
   * Verificar si una conversación puede ser reparada
   */
  canRepairConversation (data) {
    return data.id || (data.from && data.to);
  }

  /**
   * Reparar conversación
   */
  async repairConversation (docRef, data) {
    const updates = {};

    if (!data.createdAt) {
      updates.createdAt = Timestamp.now();
    }

    if (!data.status) {
      updates.status = 'open';
    }

    if (!data.messageCount) {
      updates.messageCount = 0;
    }

    if (Object.keys(updates).length > 0) {
      await docRef.update(updates);
    }
  }

  /**
   * Verificar si un contacto puede ser reparado
   */
  canRepairContact (data) {
    return data.phone && typeof data.phone === 'string';
  }

  /**
   * Reparar contacto
   */
  async repairContact (docRef, data) {
    const updates = {};

    // Intentar normalizar el teléfono
    if (data.phone && !this.isValidPhoneNumber(data.phone)) {
      const normalized = this.normalizePhoneNumber(data.phone);
      if (normalized) {
        updates.phone = normalized;
      }
    }

    if (!data.name) {
      updates.name = data.phone;
    }

    if (!data.createdAt) {
      updates.createdAt = Timestamp.now();
    }

    if (Object.keys(updates).length > 0) {
      await docRef.update(updates);
    }
  }

  /**
   * Normalizar número de teléfono
   */
  normalizePhoneNumber (phone) {
    if (!phone) return null;

    // Remover espacios y caracteres especiales
    let cleaned = phone.replace(/[^\d+]/g, '');

    // Agregar + si no lo tiene
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    // Verificar si ahora es válido
    if (this.isValidPhoneNumber(cleaned)) {
      return cleaned;
    }

    return null;
  }
}

// Mostrar ayuda si se solicita
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🧹 Script de Limpieza de Firestore
===================================

Uso: node scripts/cleanup-firestore.js [opciones]

Opciones:
  --dry-run           Simular limpieza sin eliminar datos
  --orphans-only      Solo limpiar documentos huérfanos
  --old-data-only     Solo limpiar datos antiguos
  --optimize          Optimizar estructura de datos
  --verbose           Mostrar información detallada
  --force             Forzar limpieza sin confirmación
  --help, -h          Mostrar esta ayuda

Ejemplos:
  node scripts/cleanup-firestore.js --dry-run --verbose
  node scripts/cleanup-firestore.js --orphans-only
  node scripts/cleanup-firestore.js --old-data-only --force
  node scripts/cleanup-firestore.js --optimize
`);
  process.exit(0);
}

// Confirmación de seguridad
if (!options.dryRun && !options.force) {
  console.log('⚠️  ADVERTENCIA: Esta operación modificará la base de datos de producción');
  console.log('   Usa --dry-run para simular primero o --force para continuar');
  process.exit(1);
}

// Ejecutar limpieza principal
const cleanup = new FirestoreCleanup();
cleanup.run().catch(error => {
  console.error('❌ Error no manejado:', error);
  process.exit(1);
});
