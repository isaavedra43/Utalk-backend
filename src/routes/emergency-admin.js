/**
 * 🚨 ENDPOINT DE EMERGENCIA PARA ADMIN
 * 
 * Este endpoint es extremadamente simple para arreglar
 * los permisos del admin de forma inmediata.
 */

const express = require('express');
const router = express.Router();

// Importar dependencias
let firestore, getDefaultPermissionsForRole, logger;

try {
  firestore = require('../config/firebase').firestore;
  getDefaultPermissionsForRole = require('../config/modulePermissions').getDefaultPermissionsForRole;
  logger = require('../utils/logger');
} catch (error) {
  console.error('Error importing dependencies:', error);
}

/**
 * POST /emergency-admin
 * Endpoint de emergencia para arreglar permisos del admin
 */
router.post('/', async (req, res) => {
  console.log('🚨 EMERGENCY ADMIN ENDPOINT CALLED');
  
  try {
    // Verificar que las dependencias estén disponibles
    if (!firestore) {
      throw new Error('Firestore not available');
    }
    
    if (!getDefaultPermissionsForRole) {
      throw new Error('Module permissions not available');
    }
    
    console.log('✅ Dependencies loaded successfully');
    
    // Buscar el usuario admin
    const adminEmail = 'admin@company.com';
    console.log('🔍 Searching for admin:', adminEmail);
    
    const usersQuery = await firestore
      .collection('users')
      .where('email', '==', adminEmail)
      .limit(1)
      .get();

    if (usersQuery.empty) {
      console.error('❌ Admin user not found');
      return res.status(404).json({
        success: false,
        message: 'Admin user not found',
        error: 'ADMIN_NOT_FOUND'
      });
    }

    const adminDoc = usersQuery.docs[0];
    const adminData = adminDoc.data();
    
    console.log('📋 Admin found:', {
      email: adminData.email,
      role: adminData.role,
      currentPermissions: adminData.permissions,
      permissionsType: Array.isArray(adminData.permissions) ? 'array' : 'object'
    });

    // Generar nuevos permisos
    const newModulePermissions = getDefaultPermissionsForRole('admin');
    
    console.log('🔄 Generated permissions:', {
      modulesCount: Object.keys(newModulePermissions.modules).length
    });

    // Crear estructura de permisos híbrida
    const hybridPermissions = {
      // Permisos del sistema (legacy)
      read: true,
      write: true,
      approve: true,
      configure: true,
      
      // Permisos de módulos (nuevo sistema)
      modules: newModulePermissions.modules,
      
      // Permisos legacy como array
      legacy: Array.isArray(adminData.permissions) ? adminData.permissions : [
        'users.read', 'users.write', 'users.delete',
        'conversations.read', 'conversations.write', 'conversations.delete',
        'messages.read', 'messages.write',
        'campaigns.read', 'campaigns.write', 'campaigns.delete',
        'dashboard.read', 'settings.read', 'settings.write',
        'crm.read', 'crm.write'
      ]
    };

    console.log('💾 Updating admin permissions...');

    // Actualizar el documento del admin
    await adminDoc.ref.update({
      permissions: hybridPermissions,
      updatedAt: new Date(),
      migrationInfo: {
        migratedAt: new Date(),
        fromFormat: Array.isArray(adminData.permissions) ? 'array' : 'object',
        toFormat: 'hybrid',
        version: '1.0.0',
        migratedBy: 'emergency_endpoint'
      }
    });

    console.log('✅ Admin permissions updated successfully');

    // Respuesta exitosa
    return res.status(200).json({
      success: true,
      message: 'Admin permissions fixed successfully',
      data: {
        admin: {
          email: adminData.email,
          name: adminData.name,
          role: adminData.role
        },
        migration: {
          success: true,
          modulesCount: Object.keys(hybridPermissions.modules).length,
          legacyPermissionsCount: hybridPermissions.legacy.length,
          migratedAt: new Date().toISOString()
        },
        permissions: {
          hasModules: true,
          hasLegacy: true,
          accessibleModules: Object.keys(hybridPermissions.modules)
        }
      }
    });

  } catch (error) {
    console.error('💥 ERROR in emergency admin endpoint:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      details: 'Error updating admin permissions'
    });
  }
});

module.exports = router;
