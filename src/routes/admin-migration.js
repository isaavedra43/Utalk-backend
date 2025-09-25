/**
 * 🔧 RUTAS DE MIGRACIÓN DE ADMIN
 * 
 * Endpoints temporales para migrar permisos del usuario admin
 * al nuevo sistema de permisos de módulos.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const express = require('express');
const router = express.Router();
const { firestore } = require('../config/firebase');
const { getDefaultPermissionsForRole } = require('../config/modulePermissions');
const logger = require('../utils/logger');
const { ResponseHandler } = require('../utils/responseHandler');

/**
 * @route POST /api/admin-migration/migrate-permissions
 * @desc Migrar permisos del admin al nuevo sistema
 * @access Private (solo admin)
 */
router.post('/migrate-permissions', async (req, res) => {
  try {
    logger.info('🚀 Iniciando migración de permisos de admin via API', {
      category: 'ADMIN_PERMISSIONS_MIGRATION_API',
      requestedBy: req.user?.email,
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
      return ResponseHandler.notFoundError(res, 'Usuario admin no encontrado');
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
        version: '1.0.0',
        migratedBy: req.user?.email || 'system'
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

    return ResponseHandler.success(res, {
      admin: {
        email: updatedAdmin.email,
        name: updatedAdmin.name,
        role: updatedAdmin.role
      },
      migration: {
        success: true,
        modulesCount: Object.keys(hybridPermissions.modules).length,
        legacyPermissionsCount: hybridPermissions.legacy.length,
        migratedAt: new Date().toISOString()
      },
      permissions: {
        hasModules: !!updatedAdmin.permissions?.modules,
        hasLegacy: !!updatedAdmin.permissions?.legacy,
        accessibleModules: Object.keys(updatedAdmin.permissions?.modules || {})
      }
    }, 'Migración de permisos de admin completada exitosamente');

  } catch (error) {
    logger.error('💥 Error en migración de permisos de admin via API', {
      category: 'ADMIN_PERMISSIONS_MIGRATION_ERROR',
      requestedBy: req.user?.email,
      error: error.message,
      stack: error.stack
    });
    
    return ResponseHandler.error(res, error);
  }
});

/**
 * @route GET /api/admin-migration/check-permissions
 * @desc Verificar estado actual de permisos del admin
 * @access Private (solo admin)
 */
router.get('/check-permissions', async (req, res) => {
  try {
    const adminEmail = 'admin@company.com';
    const usersQuery = await firestore
      .collection('users')
      .where('email', '==', adminEmail)
      .limit(1)
      .get();

    if (usersQuery.empty) {
      return ResponseHandler.notFoundError(res, 'Usuario admin no encontrado');
    }

    const adminData = usersQuery.docs[0].data();
    const permissions = adminData.permissions || {};

    const status = {
      email: adminData.email,
      role: adminData.role,
      permissionsType: Array.isArray(permissions) ? 'array' : 'object',
      hasModulePermissions: !!permissions.modules,
      hasLegacyPermissions: !!permissions.legacy,
      modulesCount: Object.keys(permissions.modules || {}).length,
      legacyCount: Array.isArray(permissions.legacy) ? permissions.legacy.length : 0,
      needsMigration: !permissions.modules || Object.keys(permissions.modules).length === 0
    };

    return ResponseHandler.success(res, status, 'Estado de permisos del admin obtenido');

  } catch (error) {
    logger.error('💥 Error verificando permisos del admin', {
      category: 'ADMIN_PERMISSIONS_CHECK_ERROR',
      error: error.message
    });
    
    return ResponseHandler.error(res, error);
  }
});

module.exports = router;
