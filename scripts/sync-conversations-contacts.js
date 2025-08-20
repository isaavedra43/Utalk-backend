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
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🔄 Iniciando sincronización masiva de conversaciones con contactos...' });
  console.log('⏰ Fecha y hora:', new Date().toISOString());
  logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '' });

  try {
    // Ejecutar sincronización masiva
    const result = await ContactConversationSyncService.syncAllConversationsWithContacts();

    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '✅ SINCRONIZACIÓN COMPLETADA' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '📊 Resultados:' });
    logger.info('- Conversaciones procesadas: ${result.success + result.failed}', { category: 'AUTO_MIGRATED' });
    logger.info('- Sincronizaciones exitosas: ${result.success}', { category: 'AUTO_MIGRATED' });
    logger.info('- Sincronizaciones fallidas: ${result.failed}', { category: 'AUTO_MIGRATED' });
    logger.info('- Tasa de éxito: ${((result.success / (result.success + result.failed)) * 100).toFixed(2)}%', { category: 'AUTO_MIGRATED' });

    if (result.failed > 0) {
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '⚠️  Algunas conversaciones no se pudieron sincronizar.' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   Esto puede deberse a:' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   - Contactos no encontrados' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   - Conversaciones sin customerPhone' });
      logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   - Errores de permisos en Firestore' });
    }

    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🎯 Próximos pasos:' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   1. Verificar en Firebase que los contactos tengan conversationIds' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   2. Probar búsquedas bidireccionales en el frontend' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '   3. Monitorear logs para nuevas conversaciones' });

  } catch (error) {
    console.error('❌ ERROR EN SINCRONIZACIÓN:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Ejecutar sincronización
syncAllConversationsWithContacts()
  .then(() => {
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '' });
    logger.info('Console log migrated', { category: 'AUTO_MIGRATED', content: '🏁 Script completado exitosamente' });
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  }); 