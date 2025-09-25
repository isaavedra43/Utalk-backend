/**
 * 🎯 CONFIGURACIÓN DE PERMISOS DE MÓDULOS
 * 
 * Define qué módulos puede ver cada rol y configuración de permisos
 * por módulo. Integra con el sistema de roles existente.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

/**
 * Módulos disponibles en el sistema
 */
const AVAILABLE_MODULES = {
  // MÓDULOS CORE
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Panel principal con métricas y estadísticas del sistema',
    icon: '📊',
    path: '/dashboard',
    level: 'basic',
    category: 'core'
  },
  notifications: {
    id: 'notifications',
    name: 'Notificaciones',
    description: 'Centro de notificaciones del sistema',
    icon: '🔔',
    path: '/notifications',
    level: 'basic',
    category: 'core'
  },

  // MÓDULOS DE COMUNICACIÓN
  chat: {
    id: 'chat',
    name: 'Chat',
    description: 'Mensajería y conversaciones con clientes',
    icon: '💬',
    path: '/conversations',
    level: 'basic',
    category: 'communication'
  },
  phone: {
    id: 'phone',
    name: 'Teléfono',
    description: 'Sistema de llamadas VoIP',
    icon: '📞',
    path: '/phone',
    level: 'basic',
    category: 'communication'
  },
  'internal-chat': {
    id: 'internal-chat',
    name: 'Chat Interno',
    description: 'Comunicación interna entre agentes',
    icon: '💭',
    path: '/internal-chat',
    level: 'basic',
    category: 'communication'
  },

  // MÓDULOS CRM
  clients: {
    id: 'clients',
    name: 'Clientes',
    description: 'Gestión de contactos y clientes',
    icon: '👥',
    path: '/contacts',
    level: 'intermediate',
    category: 'crm'
  },

  // MÓDULOS DE GESTIÓN
  team: {
    id: 'team',
    name: 'Equipo',
    description: 'Gestión de agentes y equipos de trabajo',
    icon: '👨‍💼',
    path: '/team',
    level: 'advanced',
    category: 'management'
  },
  hr: {
    id: 'hr',
    name: 'Recursos Humanos',
    description: 'Empleados, nóminas y gestión de RRHH',
    icon: '🏢',
    path: '/hr',
    level: 'advanced',
    category: 'management'
  },
  supervision: {
    id: 'supervision',
    name: 'Supervisión',
    description: 'Monitoreo y supervisión de agentes',
    icon: '👁️',
    path: '/supervision',
    level: 'advanced',
    category: 'management'
  },

  // MÓDULOS DE MARKETING
  campaigns: {
    id: 'campaigns',
    name: 'Campañas',
    description: 'Campañas de marketing y envíos masivos',
    icon: '📢',
    path: '/campaigns',
    level: 'intermediate',
    category: 'marketing'
  },

  // MÓDULOS DE OPERACIONES
  providers: {
    id: 'providers',
    name: 'Proveedores',
    description: 'Gestión de proveedores y servicios externos',
    icon: '🏭',
    path: '/providers',
    level: 'advanced',
    category: 'operations'
  },
  warehouse: {
    id: 'warehouse',
    name: 'Almacén',
    description: 'Gestión de inventario y almacén',
    icon: '📦',
    path: '/warehouse',
    level: 'intermediate',
    category: 'operations'
  },
  shipping: {
    id: 'shipping',
    name: 'Envíos',
    description: 'Logística y gestión de envíos',
    icon: '🚚',
    path: '/shipping',
    level: 'intermediate',
    category: 'operations'
  },

  // MÓDULOS DE IA
  copilot: {
    id: 'copilot',
    name: 'Copiloto IA',
    description: 'Asistente de inteligencia artificial',
    icon: '🤖',
    path: '/ai',
    level: 'intermediate',
    category: 'ai'
  },

  // MÓDULOS DE SOPORTE
  'knowledge-base': {
    id: 'knowledge-base',
    name: 'Base de Conocimiento',
    description: 'Documentación y recursos de ayuda',
    icon: '📚',
    path: '/knowledge',
    level: 'basic',
    category: 'support'
  },
  analytics: {
    id: 'analytics',
    name: 'Analytics',
    description: 'Reportes y análisis avanzados',
    icon: '📈',
    path: '/analytics',
    level: 'intermediate',
    category: 'support'
  },

  // MÓDULOS DE CONFIGURACIÓN
  services: {
    id: 'services',
    name: 'Servicios',
    description: 'Configuración de servicios del sistema',
    icon: '⚙️',
    path: '/settings',
    level: 'advanced',
    category: 'configuration'
  },

  // COMPATIBILIDAD CON MÓDULOS EXISTENTES
  conversations: {
    id: 'conversations',
    name: 'Chat',
    description: 'Conversaciones y mensajería',
    icon: '💬',
    path: '/conversations',
    level: 'basic',
    category: 'communication'
  },
  contacts: {
    id: 'contacts',
    name: 'Clientes',
    description: 'Gestión de contactos y clientes',
    icon: '👥',
    path: '/contacts',
    level: 'intermediate',
    category: 'crm'
  },
  ai: {
    id: 'ai',
    name: 'IA',
    description: 'Configuración de inteligencia artificial',
    icon: '🤖',
    path: '/ai',
    level: 'intermediate',
    category: 'ai'
  },
  settings: {
    id: 'settings',
    name: 'Configuración',
    description: 'Configuración del sistema',
    icon: '⚙️',
    path: '/settings',
    level: 'advanced',
    category: 'configuration'
  }
};

/**
 * Permisos por defecto por rol
 */
/**
 * Generar permisos por defecto basados en rol y categoría de módulo
 */
function generateDefaultPermissions(role) {
  const permissions = {};
  
  Object.keys(AVAILABLE_MODULES).forEach(moduleId => {
    const module = AVAILABLE_MODULES[moduleId];
    
    switch(role) {
      case 'admin':
        // ADMIN: Acceso completo a todos los módulos
        permissions[moduleId] = { 
          read: true, 
          write: true, 
          configure: true 
        };
        break;
        
      case 'supervisor':
        // SUPERVISOR: Lectura y escritura, configuración limitada
        permissions[moduleId] = { 
          read: true, 
          write: true, 
          configure: module.level !== 'advanced' 
        };
        break;
        
      case 'agent':
        // AGENTE: Solo módulos básicos de comunicación y core
        const allowedCategories = ['core', 'communication', 'support'];
        const hasAccess = allowedCategories.includes(module.category);
        permissions[moduleId] = { 
          read: hasAccess, 
          write: hasAccess && module.level === 'basic', 
          configure: false 
        };
        break;
        
      case 'viewer':
        // VISUALIZADOR: Solo lectura en módulos core
        const isCore = module.category === 'core';
        permissions[moduleId] = { 
          read: isCore, 
          write: false, 
          configure: false 
        };
        break;
        
      default:
        // Por defecto, sin acceso
        permissions[moduleId] = { 
          read: false, 
          write: false, 
          configure: false 
        };
    }
  });
  
  return permissions;
}

const DEFAULT_ROLE_PERMISSIONS = {
  admin: {
    modules: generateDefaultPermissions('admin'),
    description: 'Acceso completo a todos los módulos del sistema'
  },
  supervisor: {
    modules: generateDefaultPermissions('supervisor'),
    description: 'Acceso amplio con configuración limitada en módulos avanzados'
  },
  agent: {
    modules: generateDefaultPermissions('agent'),
    description: 'Acceso a módulos de comunicación y soporte básico'
  },
  viewer: {
    modules: generateDefaultPermissions('viewer'),
    description: 'Solo visualización de módulos core del sistema'
  }
};

/**
 * Obtener permisos por defecto para un rol
 */
function getDefaultPermissionsForRole(role) {
  return DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.viewer;
}

/**
 * Obtener módulos disponibles
 */
function getAvailableModules() {
  return AVAILABLE_MODULES;
}

/**
 * Verificar si un usuario tiene acceso a un módulo
 */
function hasModuleAccess(userPermissions, moduleId, action = 'read') {
  if (!userPermissions || !userPermissions.modules) {
    return false;
  }

  const modulePermissions = userPermissions.modules[moduleId];
  if (!modulePermissions) {
    return false;
  }

  return modulePermissions[action] === true;
}

/**
 * Obtener módulos accesibles para un usuario
 */
function getAccessibleModules(userPermissions) {
  if (!userPermissions || !userPermissions.modules) {
    return [];
  }

  return Object.keys(AVAILABLE_MODULES).filter(moduleId => {
    return hasModuleAccess(userPermissions, moduleId, 'read');
  }).map(moduleId => ({
    ...AVAILABLE_MODULES[moduleId],
    permissions: userPermissions.modules[moduleId]
  }));
}

/**
 * Validar configuración de permisos
 */
function validateModulePermissions(permissions) {
  if (!permissions || typeof permissions !== 'object') {
    return { valid: false, error: 'Permisos inválidos' };
  }

  if (!permissions.modules || typeof permissions.modules !== 'object') {
    return { valid: false, error: 'Sección de módulos requerida' };
  }

  const availableModuleIds = Object.keys(AVAILABLE_MODULES);
  const providedModuleIds = Object.keys(permissions.modules);

  // Verificar que todos los módulos proporcionados sean válidos
  for (const moduleId of providedModuleIds) {
    if (!availableModuleIds.includes(moduleId)) {
      return { valid: false, error: `Módulo inválido: ${moduleId}` };
    }

    const modulePermissions = permissions.modules[moduleId];
    if (typeof modulePermissions !== 'object') {
      return { valid: false, error: `Permisos inválidos para módulo: ${moduleId}` };
    }

    // Verificar acciones válidas
    const validActions = ['read', 'write', 'configure'];
    for (const action of Object.keys(modulePermissions)) {
      if (!validActions.includes(action)) {
        return { valid: false, error: `Acción inválida: ${action} en módulo ${moduleId}` };
      }

      if (typeof modulePermissions[action] !== 'boolean') {
        return { valid: false, error: `Valor inválido para ${action} en módulo ${moduleId}` };
      }
    }
  }

  return { valid: true };
}

/**
 * Obtener estadísticas de permisos
 */
function getModulePermissionsStats(users = []) {
  const stats = {
    totalModules: Object.keys(AVAILABLE_MODULES).length,
    modulesByCategory: {},
    modulesByLevel: {}
  };

  // Agrupar módulos por categoría y nivel
  Object.values(AVAILABLE_MODULES).forEach(module => {
    stats.modulesByCategory[module.category] = (stats.modulesByCategory[module.category] || 0) + 1;
    stats.modulesByLevel[module.level] = (stats.modulesByLevel[module.level] || 0) + 1;
  });

  return stats;
}

/**
 * Validar acceso específico a módulo
 */
function validateSpecificAccess(userEmail, moduleId, action, userPermissions) {
  const logger = require('../utils/logger');
  
  try {
    logger.info('🔍 Validando acceso a módulo', {
      category: 'MODULE_ACCESS_VALIDATION',
      userEmail,
      moduleId,
      action,
      timestamp: new Date().toISOString()
    });

    if (!AVAILABLE_MODULES[moduleId]) {
      logger.warn('⚠️ Módulo no encontrado', {
        category: 'MODULE_ACCESS_VALIDATION_ERROR',
        moduleId,
        userEmail,
        error: 'MODULE_NOT_FOUND'
      });
      return { hasAccess: false, error: 'Módulo no encontrado' };
    }

    const hasAccess = hasModuleAccess(userPermissions, moduleId, action);
    
    logger.info(hasAccess ? '✅ Acceso concedido' : '❌ Acceso denegado', {
      category: 'MODULE_ACCESS_VALIDATION_RESULT',
      userEmail,
      moduleId,
      action,
      hasAccess,
      permissions: userPermissions?.modules?.[moduleId]
    });

    return { hasAccess, error: null };
  } catch (error) {
    logger.error('💥 Error validando acceso a módulo', {
      category: 'MODULE_ACCESS_VALIDATION_ERROR',
      userEmail,
      moduleId,
      action,
      error: error.message,
      stack: error.stack
    });
    return { hasAccess: false, error: error.message };
  }
}

module.exports = {
  AVAILABLE_MODULES,
  DEFAULT_ROLE_PERMISSIONS,
  generateDefaultPermissions,
  getDefaultPermissionsForRole,
  getAvailableModules,
  hasModuleAccess,
  getAccessibleModules,
  validateModulePermissions,
  getModulePermissionsStats,
  validateSpecificAccess
};
