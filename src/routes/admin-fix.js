/**
 * 🔧 ENDPOINT SIMPLE PARA ARREGLAR PERMISOS DE ADMIN
 * 
 * Este endpoint es específicamente para arreglar los permisos del admin
 * cuando el frontend hace clic en el botón.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const express = require('express');
const router = express.Router();
const { firestore } = require('../config/firebase');
const { getDefaultPermissionsForRole } = require('../config/modulePermissions');
const logger = require('../utils/logger');

/**
 * @route POST /api/admin-fix
 * @desc Arreglar permisos del admin inmediatamente
 * @access Public (solo para emergencias)
 */
router.post('/', async (req, res) => {
  try {
    console.log('🚨 INICIANDO ARREGLO DE PERMISOS DE ADMIN');
    
    // Buscar el usuario admin
    const adminEmail = 'admin@company.com';
    console.log('🔍 Buscando admin:', adminEmail);
    
    const usersQuery = await firestore
      .collection('users')
      .where('email', '==', adminEmail)
      .limit(1)
      .get();

    if (usersQuery.empty) {
      console.error('❌ Usuario admin no encontrado');
      return res.status(404).json({
        success: false,
        message: 'Usuario admin no encontrado',
        error: 'ADMIN_NOT_FOUND'
      });
    }

    const adminDoc = usersQuery.docs[0];
    const adminData = adminDoc.data();
    
    console.log('📋 Admin encontrado:', {
      email: adminData.email,
      role: adminData.role,
      currentPermissions: adminData.permissions,
      permissionsType: Array.isArray(adminData.permissions) ? 'array' : 'object'
    });

    // Generar nuevos permisos de módulos para admin
    const newModulePermissions = getDefaultPermissionsForRole('admin');
    
    console.log('🔄 Generando permisos:', {
      modulesCount: Object.keys(newModulePermissions.modules).length,
      sampleModules: Object.keys(newModulePermissions.modules).slice(0, 5)
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

    console.log('💾 Actualizando permisos en base de datos...');

    // Actualizar el documento del admin
    await adminDoc.ref.update({
      permissions: hybridPermissions,
      updatedAt: new Date(),
      migrationInfo: {
        migratedAt: new Date(),
        fromFormat: Array.isArray(adminData.permissions) ? 'array' : 'object',
        toFormat: 'hybrid',
        version: '1.0.0',
        migratedBy: 'frontend_button'
      }
    });

    console.log('✅ PERMISOS ACTUALIZADOS EXITOSAMENTE');

    // Respuesta exitosa
    return res.status(200).json({
      success: true,
      message: 'Permisos del admin actualizados exitosamente',
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
    console.error('💥 ERROR EN ARREGLO DE PERMISOS:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message,
      details: 'Error al actualizar permisos del admin'
    });
  }
});

module.exports = router;
