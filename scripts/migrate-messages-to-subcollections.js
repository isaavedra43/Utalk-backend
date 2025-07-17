#!/usr/bin/env node

/**
 * SCRIPT DE MIGRACIÓN: Mensajes de colección raíz a subcolecciones
 *
 * Este script migra todos los mensajes de la colección raíz /messages
 * a las subcolecciones /conversations/{conversationId}/messages
 *
 * IMPORTANTE:
 * - Hacer backup de la base de datos antes de ejecutar
 * - Ejecutar en horario de bajo tráfico
 * - Monitorear el progreso y posibles errores
 *
 * USO:
 * node scripts/migrate-messages-to-subcollections.js [--dry-run] [--batch-size=100]
 */

const { firestore } = require('../src/config/firebase');

class MessageMigration {
  constructor (options = {}) {
    this.dryRun = options.dryRun || false;
    this.batchSize = options.batchSize || 100;
    this.stats = {
      total: 0,
      migrated: 0,
      errors: 0,
      skipped: 0,
      duplicates: 0,
    };
  }

  /**
   * Ejecutar migración completa
   */
  async migrate () {
    console.log('🚀 INICIANDO MIGRACIÓN DE MENSAJES');
    console.log('📋 Configuración:');
    console.log(`   - Dry Run: ${this.dryRun ? 'SÍ' : 'NO'}`);
    console.log(`   - Batch Size: ${this.batchSize}`);
    console.log('');

    try {
      // Verificar conexión a Firestore
      await this.verifyConnection();

      // Obtener estadísticas iniciales
      await this.getInitialStats();

      // Ejecutar migración en lotes
      await this.migrateInBatches();

      // Reporte final
      this.printFinalReport();
    } catch (error) {
      console.error('❌ ERROR CRÍTICO en migración:', error);
      process.exit(1);
    }
  }

  /**
   * Verificar conexión a Firestore
   */
  async verifyConnection() {
    try {
      console.log('🔍 Verificando conexión a Firestore...');
      await firestore.collection('users').limit(1).get();
      console.log('✅ Conexión a Firestore verificada\n');
    } catch (error) {
      throw new Error(`No se pudo conectar a Firestore: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas iniciales
   */
  async getInitialStats() {
    console.log('📊 Obteniendo estadísticas iniciales...');

    try {
      // Contar mensajes en colección raíz
      const rootMessagesSnapshot = await firestore.collection('messages').get();
      this.stats.total = rootMessagesSnapshot.size;

      // Contar conversaciones existentes
      const conversationsSnapshot = await firestore.collection('conversations').get();
      const conversationsCount = conversationsSnapshot.size;

      console.log(`📈 Estadísticas iniciales:`);
      console.log(`   - Mensajes en raíz: ${this.stats.total}`);
      console.log(`   - Conversaciones existentes: ${conversationsCount}`);
      console.log('');

      if (this.stats.total === 0) {
        console.log('✅ No hay mensajes para migrar');
        return;
      }

    } catch (error) {
      throw new Error(`Error obteniendo estadísticas: ${error.message}`);
    }
  }

  /**
   * Migrar mensajes en lotes
   */
  async migrateInBatches() {
    if (this.stats.total === 0) return;

    console.log('🔄 Iniciando migración por lotes...');
    let lastDoc = null;
    let batchNumber = 1;

    while (true) {
      console.log(`\n📦 Procesando lote ${batchNumber}...`);

      // Construir consulta para el lote
      let query = firestore
        .collection('messages')
        .orderBy('createdAt')
        .limit(this.batchSize);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        console.log('✅ No hay más mensajes para procesar');
        break;
      }

      // Procesar lote
      await this.processBatch(snapshot.docs, batchNumber);

      // Actualizar referencia para siguiente lote
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      batchNumber++;

      // Pausa entre lotes para no sobrecargar
      await this.sleep(1000);
    }
  }

  /**
   * Procesar un lote de mensajes
   */
  async processBatch(docs, batchNumber) {
    const promises = docs.map((doc, index) =>
      this.migrateMessage(doc, `${batchNumber}.${index + 1}`)
    );

    const results = await Promise.allSettled(promises);

    // Contar resultados
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        const outcome = result.value;
        this.stats[outcome]++;
      } else {
        this.stats.errors++;
        console.error(`❌ Error en migración:`, result.reason?.message || result.reason);
      }
    });

    console.log(`📊 Lote ${batchNumber} completado: ${docs.length} mensajes procesados`);
  }

  /**
   * Migrar un mensaje individual
   */
  async migrateMessage(doc, index) {
    try {
      const messageData = doc.data();
      const messageId = doc.id;

      // Validar que tenga conversationId
      if (!messageData.conversationId) {
        console.warn(`⚠️  [${index}] Mensaje ${messageId} sin conversationId - OMITIDO`);
        return 'skipped';
      }

      const conversationId = messageData.conversationId;

      // Verificar si ya existe en subcolección (evitar duplicados)
      const existingDoc = await firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .doc(messageId)
        .get();

      if (existingDoc.exists) {
        console.log(`🔄 [${index}] Mensaje ${messageId} ya existe en subcolección - OMITIDO`);
        return 'duplicates';
      }

      if (!this.dryRun) {
        // Verificar que la conversación existe
        const conversationDoc = await firestore
          .collection('conversations')
          .doc(conversationId)
          .get();

        if (!conversationDoc.exists) {
          console.warn(`⚠️  [${index}] Conversación ${conversationId} no existe - creando...`);
          // Crear conversación básica si no existe
          await firestore.collection('conversations').doc(conversationId).set({
            id: conversationId,
            customerPhone: messageData.from || '',
            agentPhone: messageData.to || '',
            status: 'open',
            createdAt: messageData.createdAt || messageData.timestamp,
            updatedAt: messageData.updatedAt || messageData.timestamp,
            lastMessage: messageData.content || '',
            lastMessageAt: messageData.timestamp,
            messageCount: 0,
          });
        }

        // Copiar mensaje a subcolección
        await firestore
          .collection('conversations')
          .doc(conversationId)
          .collection('messages')
          .doc(messageId)
          .set(messageData);

        // Eliminar mensaje de colección raíz
        await firestore.collection('messages').doc(messageId).delete();

        console.log(`✅ [${index}] Migrado: ${messageId} → /conversations/${conversationId}/messages/`);
      } else {
        console.log(`🔍 [${index}] DRY RUN: ${messageId} → /conversations/${conversationId}/messages/`);
      }

      return 'migrated';

    } catch (error) {
      console.error(`❌ [${index}] Error migrando mensaje ${doc.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Imprimir reporte final
   */
  printFinalReport() {
    console.log('\n📋 REPORTE FINAL DE MIGRACIÓN');
    console.log('=====================================');
    console.log(`📊 Estadísticas:`);
    console.log(`   - Total procesados: ${this.stats.total}`);
    console.log(`   - Migrados exitosamente: ${this.stats.migrated}`);
    console.log(`   - Duplicados omitidos: ${this.stats.duplicates}`);
    console.log(`   - Sin conversationId: ${this.stats.skipped}`);
    console.log(`   - Errores: ${this.stats.errors}`);
    console.log('');

    if (this.dryRun) {
      console.log('🔍 MODO DRY RUN - No se realizaron cambios reales');
      console.log('💡 Ejecuta sin --dry-run para realizar la migración');
    } else {
      console.log('✅ MIGRACIÓN COMPLETADA');

      if (this.stats.errors > 0) {
        console.log('⚠️  Revisa los errores reportados arriba');
      }

      if (this.stats.migrated > 0) {
        console.log('🎉 Los mensajes se migraron exitosamente a subcolecciones');
        console.log('🔄 Recuerda actualizar tu código para usar la nueva estructura');
      }
    }
  }

  /**
   * Pausa de ejecución
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Ejecutar migración si se llama directamente
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // Parsear argumentos
  args.forEach(arg => {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1]) || 100;
    }
  });

  const migration = new MessageMigration(options);
  migration.migrate().catch(console.error);
}

module.exports = MessageMigration; 