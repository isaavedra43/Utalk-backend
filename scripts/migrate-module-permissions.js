/**
 * 🚀 SCRIPT DE MIGRACIÓN DE PERMISOS DE MÓDULOS
 * 
 * Migra usuarios existentes al nuevo sistema de permisos de módulos
 * manteniendo compatibilidad con el sistema actual.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { firestore, FieldValue } = require('../src/config/firebase');
const { getDefaultPermissionsForRole } = require('../src/config/modulePermissions');
const logger = require('../src/utils/logger');

/**
 * Migrar todos los usuarios al nuevo sistema de permisos
 */
async function migrateAllUsers() {
  try {
    logger.info('🚀 Iniciando migración de permisos de módulos...');

    // Obtener todos los usuarios activos
    const usersSnapshot = await firestore
      .collection('users')
      .where('isActive', '==', true)
      .get();

    if (usersSnapshot.empty) {
      logger.warn('⚠️ No se encontraron usuarios para migrar');
      return;
    }

    logger.info(`📊 Encontrados ${usersSnapshot.size} usuarios para migrar`);

    const batch = firestore.batch();
    let migratedCount = 0;

    // Procesar cada usuario
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userEmail = userData.email;
      const userRole = userData.role || 'viewer';

      logger.info(`🔄 Migrando usuario: ${userEmail} (rol: ${userRole})`);

      // Verificar si ya tiene permisos de módulos
      if (userData.permissions && userData.permissions.modules) {
        logger.info(`⏭️ Usuario ${userEmail} ya tiene permisos de módulos, saltando...`);
        continue;
      }

      // Obtener permisos por defecto del rol
      const defaultPermissions = getDefaultPermissionsForRole(userRole);

      // Preparar actualización manteniendo permisos existentes
      const updatedPermissions = {
        ...userData.permissions, // Mantener permisos existentes
        modules: defaultPermissions.modules // Agregar nuevos permisos de módulos
      };

      // Agregar a batch
      batch.update(doc.ref, {
        permissions: updatedPermissions,
        updatedAt: FieldValue.serverTimestamp(),
        migrationDate: FieldValue.serverTimestamp()
      });

      migratedCount++;
    }

    // Ejecutar batch
    if (migratedCount > 0) {
      await batch.commit();
      logger.info(`✅ Migración completada: ${migratedCount} usuarios migrados`);
    } else {
      logger.info('✅ Todos los usuarios ya tienen permisos de módulos');
    }

  } catch (error) {
    logger.error('❌ Error durante la migración:', error);
    throw error;
  }
}

/**
 * Migrar un usuario específico
 */
async function migrateUser(userEmail) {
  try {
    logger.info(`🔄 Migrando usuario específico: ${userEmail}`);

    // Buscar usuario
    const userQuery = await firestore
      .collection('users')
      .where('email', '==', userEmail)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (userQuery.empty) {
      throw new Error(`Usuario ${userEmail} no encontrado`);
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();
    const userRole = userData.role || 'viewer';

    // Verificar si ya tiene permisos de módulos
    if (userData.permissions && userData.permissions.modules) {
      logger.info(`⏭️ Usuario ${userEmail} ya tiene permisos de módulos`);
      return;
    }

    // Obtener permisos por defecto del rol
    const defaultPermissions = getDefaultPermissionsForRole(userRole);

    // Preparar actualización manteniendo permisos existentes
    const updatedPermissions = {
      ...userData.permissions, // Mantener permisos existentes
      modules: defaultPermissions.modules // Agregar nuevos permisos de módulos
    };

    // Actualizar usuario
    await userDoc.ref.update({
      permissions: updatedPermissions,
      updatedAt: FieldValue.serverTimestamp(),
      migrationDate: FieldValue.serverTimestamp()
    });

    logger.info(`✅ Usuario ${userEmail} migrado exitosamente`);

  } catch (error) {
    logger.error(`❌ Error migrando usuario ${userEmail}:`, error);
    throw error;
  }
}

/**
 * Verificar estado de migración
 */
async function checkMigrationStatus() {
  try {
    logger.info('🔍 Verificando estado de migración...');

    // Obtener todos los usuarios activos
    const usersSnapshot = await firestore
      .collection('users')
      .where('isActive', '==', true)
      .get();

    if (usersSnapshot.empty) {
      logger.warn('⚠️ No se encontraron usuarios');
      return;
    }

    let migratedCount = 0;
    let notMigratedCount = 0;
    const notMigratedUsers = [];

    // Verificar cada usuario
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      
      if (userData.permissions && userData.permissions.modules) {
        migratedCount++;
      } else {
        notMigratedCount++;
        notMigratedUsers.push({
          email: userData.email,
          role: userData.role || 'viewer'
        });
      }
    }

    logger.info(`📊 Estado de migración:`);
    logger.info(`   ✅ Usuarios migrados: ${migratedCount}`);
    logger.info(`   ⏳ Usuarios pendientes: ${notMigratedCount}`);

    if (notMigratedUsers.length > 0) {
      logger.info('📋 Usuarios pendientes de migración:');
      notMigratedUsers.forEach(user => {
        logger.info(`   - ${user.email} (${user.role})`);
      });
    }

  } catch (error) {
    logger.error('❌ Error verificando estado de migración:', error);
    throw error;
  }
}

/**
 * Rollback de migración (remover permisos de módulos)
 */
async function rollbackMigration() {
  try {
    logger.warn('⚠️ Iniciando rollback de migración...');

    // Obtener todos los usuarios activos
    const usersSnapshot = await firestore
      .collection('users')
      .where('isActive', '==', true)
      .get();

    if (usersSnapshot.empty) {
      logger.warn('⚠️ No se encontraron usuarios para rollback');
      return;
    }

    const batch = firestore.batch();
    let rollbackCount = 0;

    // Procesar cada usuario
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();

      // Solo procesar usuarios que tengan permisos de módulos
      if (userData.permissions && userData.permissions.modules) {
        // Remover permisos de módulos manteniendo el resto
        const { modules, ...otherPermissions } = userData.permissions;

        batch.update(doc.ref, {
          permissions: otherPermissions,
          updatedAt: FieldValue.serverTimestamp(),
          rollbackDate: FieldValue.serverTimestamp()
        });

        rollbackCount++;
      }
    }

    // Ejecutar batch
    if (rollbackCount > 0) {
      await batch.commit();
      logger.info(`✅ Rollback completado: ${rollbackCount} usuarios procesados`);
    } else {
      logger.info('✅ No hay usuarios con permisos de módulos para rollback');
    }

  } catch (error) {
    logger.error('❌ Error durante rollback:', error);
    throw error;
  }
}

// Ejecutar script si se llama directamente
if (require.main === module) {
  const command = process.argv[2];
  const userEmail = process.argv[3];

  async function main() {
    try {
      switch (command) {
        case 'migrate-all':
          await migrateAllUsers();
          break;
        case 'migrate-user':
          if (!userEmail) {
            throw new Error('Email de usuario requerido para migración individual');
          }
          await migrateUser(userEmail);
          break;
        case 'check':
          await checkMigrationStatus();
          break;
        case 'rollback':
          await rollbackMigration();
          break;
        default:
          console.log(`
🎯 Script de Migración de Permisos de Módulos

Uso:
  node scripts/migrate-module-permissions.js <comando> [email]

Comandos disponibles:
  migrate-all     - Migrar todos los usuarios
  migrate-user    - Migrar un usuario específico (requiere email)
  check          - Verificar estado de migración
  rollback       - Revertir migración

Ejemplos:
  node scripts/migrate-module-permissions.js migrate-all
  node scripts/migrate-module-permissions.js migrate-user admin@company.com
  node scripts/migrate-module-permissions.js check
  node scripts/migrate-module-permissions.js rollback
          `);
      }
    } catch (error) {
      logger.error('❌ Error ejecutando script:', error);
      process.exit(1);
    }
  }

  main();
}

module.exports = {
  migrateAllUsers,
  migrateUser,
  checkMigrationStatus,
  rollbackMigration
};
