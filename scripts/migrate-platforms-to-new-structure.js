/**
 * 🔄 SCRIPT DE MIGRACIÓN - PLATAFORMAS A NUEVA ESTRUCTURA
 * 
 * Migra las plataformas existentes para agregar el campo platformType
 * y asegurar backward compatibility con el nuevo sistema de cargas de cliente.
 * 
 * @version 1.0.0
 * @date 2025-10-07
 */

const { db } = require('../src/config/firebase');
const logger = require('../src/utils/logger');

/**
 * Migra todas las plataformas existentes para agregar platformType = 'provider'
 */
async function migrateExistingPlatforms() {
  try {
    logger.info('🚀 Iniciando migración de plataformas existentes...');

    // Obtener todos los proveedores
    const providersSnapshot = await db.collection('providers').get();
    
    if (providersSnapshot.empty) {
      logger.info('✅ No hay proveedores para migrar');
      return;
    }

    let totalMigrated = 0;
    let totalErrors = 0;

    // Migrar plataformas de cada proveedor
    for (const providerDoc of providersSnapshot.docs) {
      const providerId = providerDoc.id;
      const providerData = providerDoc.data();
      
      logger.info(`📦 Migrando plataformas del proveedor: ${providerData.name} (${providerId})`);

      // Obtener todas las plataformas del proveedor
      const platformsSnapshot = await db.collection('providers')
        .doc(providerId)
        .collection('platforms')
        .get();

      if (platformsSnapshot.empty) {
        logger.info(`   ⚠️  No hay plataformas para el proveedor ${providerData.name}`);
        continue;
      }

      // Migrar cada plataforma
      for (const platformDoc of platformsSnapshot.docs) {
        try {
          const platformData = platformDoc.data();
          const platformId = platformDoc.id;

          // Verificar si ya tiene platformType
          if (platformData.platformType) {
            logger.info(`   ✅ Plataforma ${platformId} ya tiene platformType: ${platformData.platformType}`);
            continue;
          }

          // Agregar platformType = 'provider' a plataformas existentes
          await db.collection('providers')
            .doc(providerId)
            .collection('platforms')
            .doc(platformId)
            .update({
              platformType: 'provider',
              updatedAt: new Date()
            });

          totalMigrated++;
          logger.info(`   ✅ Migrada plataforma ${platformId} (${platformData.platformNumber})`);

        } catch (error) {
          totalErrors++;
          logger.error(`   ❌ Error migrando plataforma ${platformDoc.id}:`, error.message);
        }
      }
    }

    logger.info('🎉 Migración completada:', {
      totalMigrated,
      totalErrors,
      providersProcessed: providersSnapshot.size
    });

    if (totalErrors > 0) {
      logger.warn(`⚠️  Se encontraron ${totalErrors} errores durante la migración`);
    }

  } catch (error) {
    logger.error('💥 Error durante la migración:', error);
    throw error;
  }
}

/**
 * Verifica la integridad de los datos migrados
 */
async function verifyMigration() {
  try {
    logger.info('🔍 Verificando integridad de la migración...');

    const providersSnapshot = await db.collection('providers').get();
    let totalPlatforms = 0;
    let platformsWithType = 0;
    let platformsWithoutType = 0;

    for (const providerDoc of providersSnapshot.docs) {
      const platformsSnapshot = await db.collection('providers')
        .doc(providerDoc.id)
        .collection('platforms')
        .get();

      totalPlatforms += platformsSnapshot.size;

      platformsSnapshot.docs.forEach(platformDoc => {
        const platformData = platformDoc.data();
        if (platformData.platformType) {
          platformsWithType++;
        } else {
          platformsWithoutType++;
        }
      });
    }

    logger.info('📊 Resultados de verificación:', {
      totalPlatforms,
      platformsWithType,
      platformsWithoutType,
      migrationSuccess: platformsWithoutType === 0
    });

    if (platformsWithoutType > 0) {
      logger.warn(`⚠️  ${platformsWithoutType} plataformas no tienen platformType`);
    } else {
      logger.info('✅ Todas las plataformas tienen platformType asignado');
    }

  } catch (error) {
    logger.error('💥 Error verificando migración:', error);
    throw error;
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    logger.info('🔄 INICIANDO MIGRACIÓN DE PLATAFORMAS');
    logger.info('=====================================');

    // Ejecutar migración
    await migrateExistingPlatforms();

    // Verificar migración
    await verifyMigration();

    logger.info('✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
    logger.info('=====================================');

  } catch (error) {
    logger.error('💥 MIGRACIÓN FALLÓ:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = {
  migrateExistingPlatforms,
  verifyMigration
};
