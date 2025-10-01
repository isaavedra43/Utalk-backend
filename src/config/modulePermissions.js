/**
 * 🎯 CONFIGURACIÓN DE PERMISOS DE MÓDULOS
 * 
 * Define qué módulos puede ver cada rol y configuración de permisos
 * por módulo. Integra con el sistema de roles existente.
 * 
 * @version 2.0.0 - COMPATIBLE CON SISTEMA ACTUAL
 * @author Backend Team
 */

/**
 * Módulos disponibles en el sistema
 * Incluye tanto módulos existentes como nuevos módulos del frontend
 */
const AVAILABLE_MODULES = {
  // ===== MÓDULOS PRINCIPALES EXISTENTES =====
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Panel principal con métricas y estadísticas',
    icon: 'dashboard',
    path: '/dashboard',
    level: 'basic'
  },
  contacts: {
    id: 'contacts',
    name: 'Clientes',
    description: 'Gestión de contactos y clientes',
    icon: 'people',
    path: '/contacts',
    level: 'basic'
  },
  campaigns: {
    id: 'campaigns',
    name: 'Campañas',
    description: 'Campañas de marketing y envíos',
    icon: 'campaign',
    path: '/campaigns',
    level: 'intermediate'
  },
  team: {
    id: 'team',
    name: 'Equipo',
    description: 'Gestión de agentes y permisos',
    icon: 'team',
    path: '/team',
    level: 'intermediate'
  },
  analytics: {
    id: 'analytics',
    name: 'Analytics',
    description: 'Reportes y análisis avanzados',
    icon: 'analytics',
    path: '/analytics',
    level: 'advanced'
  },
  ai: {
    id: 'ai',
    name: 'IA',
    description: 'Configuración de inteligencia artificial',
    icon: 'ai',
    path: '/ai',
    level: 'advanced'
  },
  settings: {
    id: 'settings',
    name: 'Configuración',
    description: 'Configuración del sistema',
    icon: 'settings',
    path: '/settings',
    level: 'advanced'
  },
  hr: {
    id: 'hr',
    name: 'Recursos Humanos',
    description: 'Módulo de empleados, nóminas y asistencias',
    icon: 'hr',
    path: '/hr',
    level: 'advanced'
  },

  // ===== NUEVOS MÓDULOS AGREGADOS =====
  clients: {
    id: 'clients',
    name: 'Customer Hub',
    description: 'Hub central de gestión de clientes',
    icon: 'customers',
    path: '/clients',
    level: 'basic'
  },
  notifications: {
    id: 'notifications',
    name: 'Centro de Notificaciones',
    description: 'Gestión de notificaciones del sistema',
    icon: 'notifications',
    path: '/notifications',
    level: 'basic'
  },
  chat: {
    id: 'chat',
    name: 'Mensajes',
    description: 'Sistema de mensajería principal',
    icon: 'message',
    path: '/chat',
    level: 'basic'
  },
  'internal-chat': {
    id: 'internal-chat',
    name: 'Chat Interno',
    description: 'Comunicación interna entre agentes',
    icon: 'internal-chat',
    path: '/internal-chat',
    level: 'basic'
  },
  phone: {
    id: 'phone',
    name: 'Teléfono',
    description: 'Sistema de llamadas telefónicas',
    icon: 'phone',
    path: '/phone',
    level: 'intermediate'
  },
  'knowledge-base': {
    id: 'knowledge-base',
    name: 'Base de Conocimiento',
    description: 'Gestión de base de conocimiento y documentación',
    icon: 'knowledge',
    path: '/knowledge-base',
    level: 'basic'
  },
  supervision: {
    id: 'supervision',
    name: 'Supervisión',
    description: 'Herramientas de supervisión y monitoreo',
    icon: 'supervision',
    path: '/supervision',
    level: 'advanced'
  },
  copilot: {
    id: 'copilot',
    name: 'Copiloto IA',
    description: 'Asistente de inteligencia artificial',
    icon: 'copilot',
    path: '/copilot',
    level: 'intermediate'
  },
  shipping: {
    id: 'shipping',
    name: 'Envíos',
    description: 'Gestión de envíos y logística',
    icon: 'shipping',
    path: '/shipping',
    level: 'intermediate'
  },
  services: {
    id: 'services',
    name: 'Servicios',
    description: 'Gestión de servicios empresariales',
    icon: 'services',
    path: '/services',
    level: 'intermediate'
  },
  inventory: {
    id: 'inventory',
    name: 'Inventario de Materiales',
    description: 'Gestión de inventario de materiales, proveedores y plataformas',
    icon: 'inventory',
    path: '/inventory',
    level: 'intermediate'
  }
};

/**
 * Permisos por defecto por rol
 * Incluye configuración para todos los módulos (existentes y nuevos)
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
    // Agente solo ve chat, dashboard básico y algunos módulos operativos
    modules: {
      // Módulos principales para agentes
      dashboard: { read: true, write: false, configure: false },
      chat: { read: true, write: true, configure: false },
      chat: { read: true, write: true, configure: false },
      contacts: { read: true, write: true, configure: false },
      clients: { read: true, write: true, configure: false },
      'knowledge-base': { read: true, write: false, configure: false },
      copilot: { read: true, write: false, configure: false },
      notifications: { read: true, write: false, configure: false },
      
      // Módulos restringidos para agentes
      hr: { read: false, write: false, configure: false },
      campaigns: { read: false, write: false, configure: false },
      team: { read: false, write: false, configure: false },
      analytics: { read: false, write: false, configure: false },
      ai: { read: false, write: false, configure: false },
      settings: { read: false, write: false, configure: false },
      'internal-chat': { read: true, write: true, configure: false },
      phone: { read: true, write: true, configure: false },
      supervision: { read: false, write: false, configure: false },
      shipping: { read: false, write: false, configure: false },
      services: { read: false, write: false, configure: false },
      inventory: { read: false, write: false, configure: false }
    },
    description: 'Acceso limitado: chat, clientes y herramientas básicas'
  },
  
  viewer: {
    // Viewer solo puede leer dashboard y algunos módulos básicos
    modules: {
      dashboard: { read: true, write: false, configure: false },
      chat: { read: true, write: false, configure: false },
      contacts: { read: true, write: false, configure: false },
      clients: { read: true, write: false, configure: false },
      notifications: { read: true, write: false, configure: false },
      'knowledge-base': { read: true, write: false, configure: false },
      
      // Módulos restringidos para viewer
      hr: { read: false, write: false, configure: false },
      campaigns: { read: false, write: false, configure: false },
      team: { read: false, write: false, configure: false },
      analytics: { read: false, write: false, configure: false },
      ai: { read: false, write: false, configure: false },
      settings: { read: false, write: false, configure: false },
      'internal-chat': { read: false, write: false, configure: false },
      phone: { read: false, write: false, configure: false },
      supervision: { read: false, write: false, configure: false },
      copilot: { read: false, write: false, configure: false },
      shipping: { read: false, write: false, configure: false },
      services: { read: false, write: false, configure: false },
      inventory: { read: false, write: false, configure: false }
    },
    description: 'Solo visualización de módulos básicos'
  },
  
  supervisor: {
    // Supervisor tiene acceso amplio pero no configuración del sistema
    modules: {
      // Acceso completo a módulos operativos
      dashboard: { read: true, write: true, configure: false },
      chat: { read: true, write: true, configure: false },
      chat: { read: true, write: true, configure: false },
      contacts: { read: true, write: true, configure: false },
      clients: { read: true, write: true, configure: false },
      campaigns: { read: true, write: true, configure: false },
      team: { read: true, write: false, configure: false },
      analytics: { read: true, write: false, configure: false },
      notifications: { read: true, write: true, configure: false },
      'internal-chat': { read: true, write: true, configure: false },
      phone: { read: true, write: true, configure: false },
      'knowledge-base': { read: true, write: true, configure: false },
      supervision: { read: true, write: true, configure: false },
      copilot: { read: true, write: false, configure: false },
      
      // Módulos con acceso limitado
      hr: { read: true, write: true, configure: false },
      ai: { read: true, write: false, configure: false },
      shipping: { read: true, write: true, configure: false },
      services: { read: true, write: true, configure: false },
      inventory: { read: true, write: true, configure: false },
      
      // Solo admin puede configurar sistema
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

/**
 * Obtener lista de módulos por categoría para mejor organización
 */
function getModulesByCategory() {
  return {
    core: ['dashboard', 'notifications'],
    communication: ['chat', 'internal-chat', 'phone'],
    customers: ['contacts', 'clients'],
    marketing: ['campaigns'],
    management: ['team', 'hr', 'supervision'],
    intelligence: ['ai', 'copilot', 'knowledge-base'],
    business: ['inventory', 'shipping', 'services'],
    system: ['analytics', 'settings']
  };
}

module.exports = {
  AVAILABLE_MODULES,
  DEFAULT_ROLE_PERMISSIONS,
  getDefaultPermissionsForRole,
  getAvailableModules,
  hasModuleAccess,
  getAccessibleModules,
  validateModulePermissions,
  getModulesByCategory
};
