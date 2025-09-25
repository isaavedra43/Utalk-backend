/**
 * 🔧 SCRIPT DE MIGRACIÓN DE PERMISOS DE ADMIN
 * 
 * Migra los permisos del usuario admin del formato antiguo (array) 
 * al nuevo formato de permisos de módulos (objeto).
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { firestore } = require('../src/config/firebase');
const { getDefaultPermissionsForRole } = require('../src/config/modulePermissions');
const logger = require('../src/utils/logger');

async function migrateAdminPermissions() {
  try {
    logger.info('🚀 Iniciando migración de permisos de admin', {
      category: 'ADMIN_PERMISSIONS_MIGRATION',
      timestamp: new Date().toISOString()
    });

    // Buscar el usuario admin
    const adminEmail = 'admin@company.com';
    const usersQuery = await firestore
      .collection('users')
      .where('email', '==', adminEmail)
      .limit(1)
      .get();

    if (usersQuery.empty) {
      logger.error('❌ Usuario admin no encontrado', {
        category: 'ADMIN_PERMISSIONS_MIGRATION_ERROR',
        adminEmail
      });
      return;
    }

    const adminDoc = usersQuery.docs[0];
    const adminData = adminDoc.data();

    logger.info('📋 Datos actuales del admin', {
      category: 'ADMIN_PERMISSIONS_MIGRATION',
      email: adminData.email,
      role: adminData.role,
      currentPermissions: adminData.permissions,
      permissionsType: Array.isArray(adminData.permissions) ? 'array' : 'object'
    });

    // Generar nuevos permisos de módulos para admin
    const newModulePermissions = getDefaultPermissionsForRole('admin');
    
    logger.info('🔄 Generando nuevos permisos de módulos', {
      category: 'ADMIN_PERMISSIONS_MIGRATION',
      modulesCount: Object.keys(newModulePermissions.modules).length,
      sampleModules: Object.keys(newModulePermissions.modules).slice(0, 5)
    });

    // Crear estructura de permisos híbrida (compatible con ambos sistemas)
    const hybridPermissions = {
      // Permisos del sistema (legacy) - mantener compatibilidad
      read: true,
      write: true,
      approve: true,
      configure: true,
      
      // Permisos de módulos (nuevo sistema)
      modules: newModulePermissions.modules,
      
      // Permisos legacy como array (para compatibilidad)
      legacy: Array.isArray(adminData.permissions) ? adminData.permissions : [
        'users.read', 'users.write', 'users.delete',
        'conversations.read', 'conversations.write', 'conversations.delete',
        'messages.read', 'messages.write',
        'campaigns.read', 'campaigns.write', 'campaigns.delete',
        'dashboard.read', 'settings.read', 'settings.write',
        'crm.read', 'crm.write'
      ]
    };

    // Actualizar el documento del admin
    await adminDoc.ref.update({
      permissions: hybridPermissions,
      updatedAt: new Date(),
      migrationInfo: {
        migratedAt: new Date(),
        fromFormat: Array.isArray(adminData.permissions) ? 'array' : 'object',
        toFormat: 'hybrid',
        version: '1.0.0'
      }
    });

    logger.info('✅ Migración de permisos de admin completada', {
      category: 'ADMIN_PERMISSIONS_MIGRATION_SUCCESS',
      adminEmail,
      newPermissionsStructure: {
        hasLegacyPermissions: true,
        hasModulePermissions: true,
        modulesCount: Object.keys(hybridPermissions.modules).length,
        legacyPermissionsCount: hybridPermissions.legacy.length
      }
    });

    // Verificar que la migración fue exitosa
    const updatedQuery = await firestore
      .collection('users')
      .where('email', '==', adminEmail)
      .limit(1)
      .get();

    const updatedAdmin = updatedQuery.docs[0].data();
    
    logger.info('🔍 Verificación post-migración', {
      category: 'ADMIN_PERMISSIONS_MIGRATION_VERIFICATION',
      hasModules: !!updatedAdmin.permissions?.modules,
      modulesCount: Object.keys(updatedAdmin.permissions?.modules || {}).length,
      hasLegacy: !!updatedAdmin.permissions?.legacy,
      legacyCount: updatedAdmin.permissions?.legacy?.length || 0
    });

    console.log('🎉 ¡Migración completada exitosamente!');
    console.log(`📧 Admin: ${adminEmail}`);
    console.log(`📊 Módulos configurados: ${Object.keys(hybridPermissions.modules).length}`);
    console.log(`🔧 Permisos legacy: ${hybridPermissions.legacy.length}`);
    console.log('✅ El admin ahora tiene acceso completo a todos los módulos');

  } catch (error) {
    logger.error('💥 Error en migración de permisos de admin', {
      category: 'ADMIN_PERMISSIONS_MIGRATION_ERROR',
      error: error.message,
      stack: error.stack
    });
    
    console.error('❌ Error en la migración:', error.message);
    throw error;
  }
}

// Ejecutar migración si se llama directamente
if (require.main === module) {
  migrateAdminPermissions()
    .then(() => {
      console.log('✅ Migración finalizada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error en migración:', error);
      process.exit(1);
    });
}

module.exports = { migrateAdminPermissions };
