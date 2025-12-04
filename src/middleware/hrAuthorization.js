const Employee = require('../models/Employee');

/**
 * Middleware de Autorización para Recursos Humanos
 * Gestiona permisos específicos del módulo de empleados
 */

/**
 * Roles y permisos del módulo HR
 */
const HR_ROLES = {
  HR_ADMIN: {
    name: 'HR Admin',
    level: 5,
    permissions: {
      employees: ['create', 'read', 'update', 'delete', 'export', 'import'],
      payroll: ['create', 'read', 'update', 'delete', 'approve', 'process'],
      attendance: ['create', 'read', 'update', 'delete', 'adjust'],
      vacations: ['create', 'read', 'update', 'delete', 'approve', 'reject'],
      documents: ['create', 'read', 'update', 'delete', 'confidential'],
      incidents: ['create', 'read', 'update', 'delete', 'investigate'],
      evaluations: ['create', 'read', 'update', 'delete', 'approve'],
      skills: ['create', 'read', 'update', 'delete'],
      reports: ['generate', 'export', 'view_all']
    }
  },
  HR_MANAGER: {
    name: 'HR Manager',
    level: 4,
    permissions: {
      employees: ['read', 'update'],
      payroll: ['read', 'create', 'update'],
      attendance: ['read', 'create', 'update'],
      vacations: ['read', 'approve', 'reject'],
      documents: ['read', 'create'],
      incidents: ['read', 'create', 'update'],
      evaluations: ['create', 'read', 'update'],
      skills: ['read', 'create', 'update'],
      reports: ['generate', 'view_department']
    },
    conditions: {
      department_scope: true, // Solo puede ver empleados de su departamento
      salary_limit: 50000 // No puede aprobar salarios superiores a este monto
    }
  },
  SUPERVISOR: {
    name: 'Supervisor',
    level: 3,
    permissions: {
      employees: ['read'],
      attendance: ['read', 'create'],
      vacations: ['read', 'create'],
      documents: ['read'],
      incidents: ['read', 'create'],
      evaluations: ['create', 'read'],
      skills: ['read'],
      reports: ['view_team']
    },
    conditions: {
      team_scope: true, // Solo puede ver empleados de su equipo
      own_team_only: true
    }
  },
  EMPLOYEE: {
    name: 'Employee',
    level: 1,
    permissions: {
      employees: ['read_own'],
      attendance: ['read_own', 'clock_in', 'clock_out'],
      vacations: ['read_own', 'create_own'],
      documents: ['read_own', 'create_own'],
      incidents: ['read_own', 'create_own'],
      evaluations: ['read_own'],
      skills: ['read_own', 'create_own']
    },
    conditions: {
      own_data_only: true
    }
  }
};

/**
 * Obtiene el rol HR del usuario
 */
function getHRRole(user) {
  // Mapear roles del sistema a roles HR
  if (user.role === 'admin') {
    return HR_ROLES.HR_ADMIN;
  }
  
  if (user.role === 'hr_admin') {
    return HR_ROLES.HR_ADMIN;
  }
  
  if (user.role === 'hr_manager') {
    return HR_ROLES.HR_MANAGER;
  }
  
  if (user.role === 'supervisor') {
    return HR_ROLES.SUPERVISOR;
  }
  
  // Si tiene hrRole específico, usarlo
  if (user.hrRole && HR_ROLES[user.hrRole]) {
    return HR_ROLES[user.hrRole];
  }
  
  // Por defecto, todos los usuarios autenticados son empleados
  return HR_ROLES.EMPLOYEE;
}

/**
 * Middleware para verificar permisos específicos del módulo HR
 */
function checkHRPermission(resource, action, options = {}) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Usuario no autenticado'
        });
      }

      const hrRole = getHRRole(user);
      const permissions = hrRole.permissions[resource];

      if (!permissions) {
        return res.status(403).json({
          success: false,
          error: 'Acceso denegado: recurso no permitido'
        });
      }

      // Verificar si tiene el permiso específico
      if (!permissions.includes(action) && !permissions.includes('*')) {
        return res.status(403).json({
          success: false,
          error: `Acceso denegado: acción '${action}' no permitida en '${resource}'`
        });
      }

      // Aplicar condiciones específicas del rol
      if (hrRole.conditions) {
        const conditionResult = await applyRoleConditions(req, hrRole.conditions, options);
        if (!conditionResult.allowed) {
          return res.status(403).json({
            success: false,
            error: conditionResult.reason || 'Acceso denegado por condiciones del rol'
          });
        }
      }

      // Agregar información del rol al request
      req.hrRole = hrRole;
      req.hrPermissions = permissions;

      next();
    } catch (error) {
      console.error('Error in HR permission check:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno al verificar permisos'
      });
    }
  };
}

/**
 * Aplica condiciones específicas del rol
 */
async function applyRoleConditions(req, conditions, options) {
  const user = req.user;
  const employeeId = req.params.id || req.body.employeeId;

  // Condición: Solo datos propios
  if (conditions.own_data_only) {
    if (employeeId && employeeId !== user.employeeId) {
      return {
        allowed: false,
        reason: 'Solo puede acceder a sus propios datos'
      };
    }
  }

  // Condición: Solo empleados del mismo departamento
  if (conditions.department_scope && employeeId) {
    try {
      const targetEmployee = await Employee.findById(employeeId);
      const userEmployee = await Employee.findById(user.employeeId);
      
      if (targetEmployee && userEmployee) {
        if (targetEmployee.position.department !== userEmployee.position.department) {
          return {
            allowed: false,
            reason: 'Solo puede acceder a empleados de su departamento'
          };
        }
      }
    } catch (error) {
      console.error('Error checking department scope:', error);
      return {
        allowed: false,
        reason: 'Error al verificar permisos departamentales'
      };
    }
  }

  // Condición: Solo empleados del equipo
  if (conditions.team_scope && employeeId) {
    try {
      const targetEmployee = await Employee.findById(employeeId);
      
      if (targetEmployee && targetEmployee.position.reportsTo !== user.employeeId) {
        return {
          allowed: false,
          reason: 'Solo puede acceder a empleados de su equipo'
        };
      }
    } catch (error) {
      console.error('Error checking team scope:', error);
      return {
        allowed: false,
        reason: 'Error al verificar permisos de equipo'
      };
    }
  }

  // Condición: Límite salarial
  if (conditions.salary_limit && req.body.contract?.salary) {
    if (req.body.contract.salary > conditions.salary_limit) {
      return {
        allowed: false,
        reason: `No puede aprobar salarios superiores a $${conditions.salary_limit.toLocaleString()}`
      };
    }
  }

  return { allowed: true };
}

/**
 * Middleware para verificar si el usuario es administrador HR
 */
function requireHRAdmin() {
  return checkHRPermission('employees', 'delete');
}

/**
 * Middleware para verificar si puede gestionar nóminas
 */
function requirePayrollAccess() {
  return checkHRPermission('payroll', 'read');
}

/**
 * Middleware para verificar si puede aprobar vacaciones
 */
function requireVacationApproval() {
  return checkHRPermission('vacations', 'approve');
}

/**
 * Middleware para verificar acceso a documentos confidenciales
 */
function requireConfidentialAccess() {
  return checkHRPermission('documents', 'confidential');
}

/**
 * Middleware para verificar si puede generar reportes
 */
function requireReportAccess(scope = 'view_all') {
  return checkHRPermission('reports', scope);
}

/**
 * Middleware para filtrar datos según permisos
 */
function filterDataByPermissions() {
  return (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      const hrRole = req.hrRole;
      
      if (hrRole && data.success && data.data) {
        // Filtrar datos sensibles según el rol
        const filteredData = filterSensitiveData(data.data, hrRole);
        data.data = filteredData;
      }
      
      originalJson.call(this, data);
    };
    
    next();
  };
}

/**
 * Filtra datos sensibles según el rol
 */
function filterSensitiveData(data, hrRole) {
  if (!data || hrRole.level >= 4) {
    // HR Admin y HR Manager pueden ver todos los datos
    return data;
  }

  // Para otros roles, filtrar información sensible
  if (Array.isArray(data)) {
    return data.map(item => filterSingleItem(item, hrRole));
  } else if (typeof data === 'object') {
    return filterSingleItem(data, hrRole);
  }

  return data;
}

/**
 * Filtra un elemento individual
 */
function filterSingleItem(item, hrRole) {
  if (!item || typeof item !== 'object') {
    return item;
  }

  const filtered = { ...item };

  // Filtros por nivel de rol
  if (hrRole.level < 3) {
    // Empleados y supervisores no pueden ver salarios de otros
    if (filtered.contract) {
      delete filtered.contract.salary;
    }
    
    // No pueden ver información personal completa de otros
    if (filtered.personalInfo) {
      const allowedFields = ['firstName', 'lastName', 'avatar'];
      filtered.personalInfo = Object.keys(filtered.personalInfo)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = filtered.personalInfo[key];
          return obj;
        }, {});
    }
  }

  if (hrRole.level < 2) {
    // Solo empleados - filtros más restrictivos
    delete filtered.createdBy;
    delete filtered.updatedBy;
  }

  return filtered;
}

/**
 * Middleware para logging de acciones HR
 */
function logHRAction() {
  return (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      // Log de acción exitosa
      if (data.success && req.hrRole) {
        console.log('HR Action:', {
          user: req.user.id,
          role: req.hrRole.name,
          action: req.method,
          resource: req.route.path,
          employeeId: req.params.id,
          timestamp: new Date().toISOString(),
          ip: req.ip
        });
      }
      
      originalJson.call(this, data);
    };
    
    next();
  };
}

/**
 * Middleware para validar acceso a archivos de empleados
 */
function validateFileAccess() {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const employeeId = req.params.id || req.params.employeeId;
      const hrRole = getHRRole(user);

      // HR Admin puede acceder a todos los archivos
      if (hrRole.level >= 5) {
        return next();
      }

      // Empleados solo pueden acceder a sus propios archivos
      if (hrRole.level <= 1 && employeeId !== user.employeeId) {
        return res.status(403).json({
          success: false,
          error: 'Solo puede acceder a sus propios documentos'
        });
      }

      // Verificar si el documento es confidencial
      if (req.params.documentId) {
        // TODO: Verificar si el documento es confidencial
        // y si el usuario tiene permisos para verlo
      }

      next();
    } catch (error) {
      console.error('Error validating file access:', error);
      res.status(500).json({
        success: false,
        error: 'Error al validar acceso al archivo'
      });
    }
  };
}

/**
 * Middleware combinado para rutas de empleados
 */
function hrMiddleware(resource, action, options = {}) {
  return [
    checkHRPermission(resource, action, options),
    filterDataByPermissions(),
    logHRAction()
  ];
}

module.exports = {
  HR_ROLES,
  getHRRole,
  checkHRPermission,
  requireHRAdmin,
  requirePayrollAccess,
  requireVacationApproval,
  requireConfidentialAccess,
  requireReportAccess,
  filterDataByPermissions,
  validateFileAccess,
  logHRAction,
  hrMiddleware
};
