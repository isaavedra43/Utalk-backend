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
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Panel principal con métricas y estadísticas',
    icon: 'dashboard',
    path: '/dashboard'
  },
  conversations: {
    id: 'conversations',
    name: 'Chat',
    description: 'Conversaciones y mensajería',
    icon: 'chat',
    path: '/conversations'
  },
  contacts: {
    id: 'contacts',
    name: 'Clientes',
    description: 'Gestión de contactos y clientes',
    icon: 'people',
    path: '/contacts'
  },
  campaigns: {
    id: 'campaigns',
    name: 'Campañas',
    description: 'Campañas de marketing y envíos',
    icon: 'campaign',
    path: '/campaigns'
  },
  team: {
    id: 'team',
    name: 'Equipo',
    description: 'Gestión de agentes y permisos',
    icon: 'team',
    path: '/team'
  },
  analytics: {
    id: 'analytics',
    name: 'Analytics',
    description: 'Reportes y análisis avanzados',
    icon: 'analytics',
    path: '/analytics'
  },
  ai: {
    id: 'ai',
    name: 'IA',
    description: 'Configuración de inteligencia artificial',
    icon: 'ai',
    path: '/ai'
  },
  settings: {
    id: 'settings',
    name: 'Configuración',
    description: 'Configuración del sistema',
    icon: 'settings',
    path: '/settings'
  }
};

/**
 * Permisos por defecto por rol
 */
const DEFAULT_ROLE_PERMISSIONS = {
  admin: {
    // Admin tiene acceso completo a todos los módulos
    modules: Object.keys(AVAILABLE_MODULES).reduce((acc, moduleId) => {
      acc[moduleId] = {
        read: true,
        write: true,
        configure: true
      };
      return acc;
    }, {}),
    description: 'Acceso completo a todos los módulos'
  },
  agent: {
    // Agente solo ve chat y dashboard básico
    modules: {
      dashboard: { read: true, write: false, configure: false },
      conversations: { read: true, write: true, configure: false },
      contacts: { read: false, write: false, configure: false },
      campaigns: { read: false, write: false, configure: false },
      team: { read: false, write: false, configure: false },
      analytics: { read: false, write: false, configure: false },
      ai: { read: false, write: false, configure: false },
      settings: { read: false, write: false, configure: false }
    },
    description: 'Acceso limitado: solo chat y dashboard básico'
  },
  viewer: {
    // Viewer solo puede leer dashboard
    modules: {
      dashboard: { read: true, write: false, configure: false },
      conversations: { read: false, write: false, configure: false },
      contacts: { read: false, write: false, configure: false },
      campaigns: { read: false, write: false, configure: false },
      team: { read: false, write: false, configure: false },
      analytics: { read: false, write: false, configure: false },
      ai: { read: false, write: false, configure: false },
      settings: { read: false, write: false, configure: false }
    },
    description: 'Solo visualización del dashboard'
  },
  supervisor: {
    // Supervisor tiene acceso amplio pero no configuración
    modules: {
      dashboard: { read: true, write: true, configure: false },
      conversations: { read: true, write: true, configure: false },
      contacts: { read: true, write: true, configure: false },
      campaigns: { read: true, write: true, configure: false },
      team: { read: true, write: false, configure: false },
      analytics: { read: true, write: false, configure: false },
      ai: { read: true, write: false, configure: false },
      settings: { read: false, write: false, configure: false }
    },
    description: 'Acceso amplio sin configuración del sistema'
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

module.exports = {
  AVAILABLE_MODULES,
  DEFAULT_ROLE_PERMISSIONS,
  getDefaultPermissionsForRole,
  getAvailableModules,
  hasModuleAccess,
  getAccessibleModules,
  validateModulePermissions
};
