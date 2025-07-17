/**
 * SCRIPT DE MIGRACIÓN: FIX TIMESTAMP Y MESSAGE COUNT
 *
 * Este script:
 * 1. Agrega timestamp = createdAt a todos los mensajes que no tengan timestamp
 * 2. Recalcula messageCount para todas las conversaciones
 * 3. Verifica la integridad de los datos después de la migración
 *
 * Ejecutar con: node scripts/fix-timestamp-migration.js
 */

// Configurar Firebase Admin - usar la misma configuración que el backend
const { firestore } = require('../src/config/firebase');

// firestore ya está configurado en el archivo de config
const db = firestore;

class TimestampMigration {
  constructor () {
    this.stats = {
      conversationsProcessed: 0,
      messagesUpdated: 0,
      messageCountFixed: 0,
      errors: [],
      startTime: new Date(),
    };
  }

  /**
   * Ejecutar migración completa
   */
  async run () {
    console.log('🚀 Iniciando migración de timestamp y messageCount...\n');

    try {
      // Paso 1: Obtener todas las conversaciones
      const conversationsSnapshot = await db.collection('conversations').get();
      console.log(`📁 Encontradas ${conversationsSnapshot.size} conversaciones\n`);

      // Paso 2: Procesar cada conversación
      for (const conversationDoc of conversationsSnapshot.docs) {
        await this.processConversation(conversationDoc);
      }

      // Paso 3: Mostrar resumen
      this.showSummary();
    } catch (error) {
      console.error('❌ Error fatal durante la migración:', error);
      process.exit(1);
    }
  }

  /**
   * Procesar una conversación individual
   */
  async processConversation (conversationDoc) {
    const conversationId = conversationDoc.id;
    console.log(`🔄 Procesando conversación: ${conversationId}`);

    try {
      // Obtener todos los mensajes de la conversación
      const messagesSnapshot = await db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .get();

      console.log(`  📨 ${messagesSnapshot.size} mensajes encontrados`);

      let messagesUpdatedInConv = 0;
      const batch = db.batch();
      let batchOperations = 0;

      // Procesar cada mensaje
      for (const messageDoc of messagesSnapshot.docs) {
        const messageData = messageDoc.data();
        const messageRef = messageDoc.ref;

        // Verificar si necesita timestamp
        if (!messageData.timestamp && messageData.createdAt) {
          batch.update(messageRef, {
            timestamp: messageData.createdAt,
          });
          messagesUpdatedInConv++;
          batchOperations++;

          // Ejecutar batch cada 500 operaciones para evitar límites
          if (batchOperations >= 500) {
            await batch.commit();
            console.log('    ✅ Batch de 500 operaciones ejecutado');
            batchOperations = 0;
          }
        }
      }

      // Ejecutar batch restante
      if (batchOperations > 0) {
        await batch.commit();
        console.log(`    ✅ Batch final de ${batchOperations} operaciones ejecutado`);
      }

      // Actualizar messageCount en la conversación
      const currentConvData = conversationDoc.data();
      const actualMessageCount = messagesSnapshot.size;

      if (currentConvData.messageCount !== actualMessageCount) {
        await conversationDoc.ref.update({
          messageCount: actualMessageCount,
        });
        this.stats.messageCountFixed++;
        console.log(`    🔢 MessageCount corregido: ${currentConvData.messageCount} → ${actualMessageCount}`);
      }

      this.stats.conversationsProcessed++;
      this.stats.messagesUpdated += messagesUpdatedInConv;

      console.log(`  ✅ Completado: ${messagesUpdatedInConv} mensajes actualizados\n`);
    } catch (error) {
      console.error(`  ❌ Error procesando conversación ${conversationId}:`, error.message);
      this.stats.errors.push({
        conversationId,
        error: error.message,
      });
    }
  }

  /**
   * Mostrar resumen de la migración
   */
  showSummary () {
    const endTime = new Date();
    const duration = Math.round((endTime - this.stats.startTime) / 1000);

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE MIGRACIÓN');
    console.log('='.repeat(60));
    console.log(`⏱️  Duración: ${duration} segundos`);
    console.log(`📁 Conversaciones procesadas: ${this.stats.conversationsProcessed}`);
    console.log(`📨 Mensajes con timestamp agregado: ${this.stats.messagesUpdated}`);
    console.log(`🔢 Conversaciones con messageCount corregido: ${this.stats.messageCountFixed}`);
    console.log(`❌ Errores: ${this.stats.errors.length}`);

    if (this.stats.errors.length > 0) {
      console.log('\n📋 ERRORES ENCONTRADOS:');
      this.stats.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.conversationId}: ${error.error}`);
      });
    }

    if (this.stats.messagesUpdated > 0) {
      console.log('\n✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
      console.log('💡 Los mensajes ahora tienen timestamp y el historial debería aparecer correctamente');
    } else {
      console.log('\n✅ NO SE NECESITARON CAMBIOS');
      console.log('💡 Todos los mensajes ya tienen timestamp');
    }

    console.log('='.repeat(60) + '\n');
  }

  /**
   * Verificar integridad después de la migración
   */
  async verifyIntegrity () {
    console.log('🔍 Verificando integridad post-migración...\n');

    const conversationsSnapshot = await db.collection('conversations').get();
    let totalMessagesWithoutTimestamp = 0;
    let conversationsWithWrongCount = 0;

    for (const conversationDoc of conversationsSnapshot.docs) {
      const conversationData = conversationDoc.data();
      const messagesSnapshot = await db
        .collection('conversations')
        .doc(conversationDoc.id)
        .collection('messages')
        .get();

      // Verificar mensajes sin timestamp
      const messagesWithoutTimestamp = messagesSnapshot.docs.filter(doc => !doc.data().timestamp);
      totalMessagesWithoutTimestamp += messagesWithoutTimestamp.length;

      // Verificar messageCount
      if (conversationData.messageCount !== messagesSnapshot.size) {
        conversationsWithWrongCount++;
        console.log(`⚠️  Conversación ${conversationDoc.id}: messageCount ${conversationData.messageCount} ≠ real ${messagesSnapshot.size}`);
      }
    }

    console.log('\n📋 RESULTADOS DE VERIFICACIÓN:');
    console.log(`📨 Mensajes sin timestamp: ${totalMessagesWithoutTimestamp}`);
    console.log(`🔢 Conversaciones con messageCount incorrecto: ${conversationsWithWrongCount}`);

    if (totalMessagesWithoutTimestamp === 0 && conversationsWithWrongCount === 0) {
      console.log('✅ INTEGRIDAD VERIFICADA - Todo está correcto\n');
    } else {
      console.log('⚠️  Se encontraron inconsistencias que requieren atención\n');
    }
  }
}

// Ejecutar migración
async function main () {
  const migration = new TimestampMigration();

  try {
    await migration.run();
    await migration.verifyIntegrity();
    process.exit(0);
  } catch (error) {
    console.error('💥 Error crítico:', error);
    process.exit(1);
  }
}

// Verificar si se está ejecutando directamente
if (require.main === module) {
  main();
}

module.exports = TimestampMigration;
