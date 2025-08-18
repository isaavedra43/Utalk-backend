/**
 * 🔄 SCRIPT DE SINCRONIZACIÓN MASIVA CONVERSACIONES-CONTACTOS
 * 
 * Este script sincroniza todas las conversaciones existentes con sus contactos
 * agregando las referencias cruzadas necesarias para búsquedas bidireccionales.
 * 
 * USO: node scripts/sync-conversations-contacts.js
 * 
 * @version 1.0.0
 * @author Backend Team
 */

require('dotenv').config();
const ContactConversationSyncService = require('../src/services/ContactConversationSyncService');
const logger = require('../src/utils/logger');

async function syncAllConversationsWithContacts() {
  console.log('🔄 Iniciando sincronización masiva de conversaciones con contactos...');
  console.log('⏰ Fecha y hora:', new Date().toISOString());
  console.log('');

  try {
    // Ejecutar sincronización masiva
    const result = await ContactConversationSyncService.syncAllConversationsWithContacts();

    console.log('');
    console.log('✅ SINCRONIZACIÓN COMPLETADA');
    console.log('📊 Resultados:');
    console.log(`   - Conversaciones procesadas: ${result.success + result.failed}`);
    console.log(`   - Sincronizaciones exitosas: ${result.success}`);
    console.log(`   - Sincronizaciones fallidas: ${result.failed}`);
    console.log(`   - Tasa de éxito: ${((result.success / (result.success + result.failed)) * 100).toFixed(2)}%`);

    if (result.failed > 0) {
      console.log('');
      console.log('⚠️  Algunas conversaciones no se pudieron sincronizar.');
      console.log('   Esto puede deberse a:');
      console.log('   - Contactos no encontrados');
      console.log('   - Conversaciones sin customerPhone');
      console.log('   - Errores de permisos en Firestore');
    }

    console.log('');
    console.log('🎯 Próximos pasos:');
    console.log('   1. Verificar en Firebase que los contactos tengan conversationIds');
    console.log('   2. Probar búsquedas bidireccionales en el frontend');
    console.log('   3. Monitorear logs para nuevas conversaciones');

  } catch (error) {
    console.error('❌ ERROR EN SINCRONIZACIÓN:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Ejecutar sincronización
syncAllConversationsWithContacts()
  .then(() => {
    console.log('');
    console.log('🏁 Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  }); 