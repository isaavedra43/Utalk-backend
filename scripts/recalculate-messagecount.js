/**
 * Script para recalcular messageCount en todas las conversaciones
 *
 * PROPÓSITO:
 * - Recalcula el campo messageCount basándose en el número real de mensajes
 * - Corrige inconsistencias entre messageCount almacenado vs mensajes reales
 * - Útil después de migraciones, importaciones o eliminaciones manuales
 *
 * USO:
 * node scripts/recalculate-messagecount.js
 *
 * SEGURIDAD:
 * - Solo actualiza el campo messageCount, no modifica mensajes
 * - Operación de solo lectura seguida de actualizaciones precisas
 */

const { firestore } = require('../src/config/firebase');
const logger = require('../src/utils/logger');

class MessageCountRecalculator {
  constructor () {
    this.stats = {
      conversationsProcessed: 0,
      conversationsUpdated: 0,
      conversationsCorrect: 0,
      errors: 0,
      totalMessagesFound: 0,
      largestDiscrepancy: 0,
    };
  }

  /**
   * Ejecutar recálculo completo
   */
  async run () {
    console.log('🧮 INICIANDO RECÁLCULO DE messageCount...\n');
    console.log('📋 Este proceso:');
    console.log('   - Lee todas las conversaciones');
    console.log('   - Cuenta mensajes reales en cada subcolección');
    console.log('   - Actualiza messageCount solo si hay diferencias');
    console.log('   - Reporta estadísticas detalladas\n');

    const startTime = Date.now();

    try {
      // Obtener todas las conversaciones
      console.log('📥 Obteniendo lista de conversaciones...');
      const conversationsSnapshot = await firestore.collection('conversations').get();

      console.log(`📊 Encontradas ${conversationsSnapshot.size} conversaciones para procesar\n`);

      // Procesar cada conversación
      for (const conversationDoc of conversationsSnapshot.docs) {
        await this.processConversation(conversationDoc);
      }

      // Reportar resultados
      const duration = (Date.now() - startTime) / 1000;
      this.printSummary(duration);
    } catch (error) {
      console.error('❌ ERROR CRÍTICO:', error.message);
      logger.error('Error en recálculo de messageCount', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    }
  }

  /**
   * Procesar una conversación individual
   */
  async processConversation (conversationDoc) {
    const conversationId = conversationDoc.id;
    const conversationData = conversationDoc.data();

    try {
      // Contar mensajes reales
      const messagesSnapshot = await firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .get();

      const realMessageCount = messagesSnapshot.size;
      const storedMessageCount = conversationData.messageCount || 0;

      this.stats.conversationsProcessed++;
      this.stats.totalMessagesFound += realMessageCount;

      // Calcular discrepancia
      const discrepancy = Math.abs(realMessageCount - storedMessageCount);
      if (discrepancy > this.stats.largestDiscrepancy) {
        this.stats.largestDiscrepancy = discrepancy;
      }

      // Actualizar solo si hay diferencia
      if (storedMessageCount !== realMessageCount) {
        await conversationDoc.ref.update({
          messageCount: realMessageCount,
        });

        this.stats.conversationsUpdated++;

        console.log(`🔄 ${conversationId}: ${storedMessageCount} → ${realMessageCount} (${discrepancy > 0 ? '+' : ''}${realMessageCount - storedMessageCount})`);

        logger.info('MessageCount actualizado', {
          conversationId,
          oldCount: storedMessageCount,
          newCount: realMessageCount,
          discrepancy,
        });
      } else {
        this.stats.conversationsCorrect++;

        // Solo mostrar cada 10 conversaciones correctas para no spam
        if (this.stats.conversationsCorrect % 10 === 0) {
          console.log(`✅ ${this.stats.conversationsCorrect} conversaciones correctas...`);
        }
      }
    } catch (error) {
      this.stats.errors++;
      console.error(`❌ Error en conversación ${conversationId}:`, error.message);

      logger.error('Error procesando conversación', {
        conversationId,
        error: error.message,
      });
    }
  }

  /**
   * Mostrar resumen final
   */
  printSummary (duration) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RECÁLCULO DE messageCount COMPLETADO');
    console.log('='.repeat(60));

    console.log(`⏱️  Tiempo total: ${duration.toFixed(2)} segundos`);
    console.log(`📋 Conversaciones procesadas: ${this.stats.conversationsProcessed}`);
    console.log(`✅ Conversaciones correctas: ${this.stats.conversationsCorrect}`);
    console.log(`🔄 Conversaciones actualizadas: ${this.stats.conversationsUpdated}`);
    console.log(`❌ Errores: ${this.stats.errors}`);
    console.log(`💬 Total mensajes contados: ${this.stats.totalMessagesFound}`);
    console.log(`📏 Mayor discrepancia: ${this.stats.largestDiscrepancy}`);

    if (this.stats.conversationsUpdated > 0) {
      console.log(`\n✨ Se corrigieron ${this.stats.conversationsUpdated} conversaciones con messageCount incorrecto`);
    } else {
      console.log('\n🎉 Todas las conversaciones tenían messageCount correcto');
    }

    const accuracy = this.stats.conversationsProcessed > 0
      ? ((this.stats.conversationsCorrect / this.stats.conversationsProcessed) * 100).toFixed(1)
      : 0;

    console.log(`📈 Precisión: ${accuracy}% (${this.stats.conversationsCorrect}/${this.stats.conversationsProcessed})`);

    if (this.stats.errors > 0) {
      console.log(`\n⚠️  Se produjeron ${this.stats.errors} errores. Revisa los logs para detalles.`);
    }

    console.log('\n🏁 Proceso completado exitosamente');
  }
}

// Ejecutar script si se llama directamente
if (require.main === module) {
  const recalculator = new MessageCountRecalculator();
  recalculator.run()
    .then(() => {
      console.log('\n👋 Script finalizado. Saliendo...');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script falló:', error.message);
      process.exit(1);
    });
}

module.exports = MessageCountRecalculator;
