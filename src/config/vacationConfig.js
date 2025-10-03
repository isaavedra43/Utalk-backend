/**
 * Configuración del Módulo de Vacaciones
 * Contiene todas las configuraciones, tipos, validaciones y reglas de negocio
 */

const VACATION_CONFIG = {
  // Tipos de vacaciones soportados
  VACATION_TYPES: {
    VACATION: { 
      value: 'vacation', 
      label: 'Vacaciones', 
      icon: 'plane',
      description: 'Vacaciones regulares',
      requiresApproval: true,
      affectsBalance: true
    },
    PERSONAL: { 
      value: 'personal', 
      label: 'Personal', 
      icon: 'user',
      description: 'Asuntos personales',
      requiresApproval: true,
      affectsBalance: true
    },
    SICK_LEAVE: { 
      value: 'sick_leave', 
      label: 'Enfermedad', 
      icon: 'heart',
      description: 'Incapacidad médica',
      requiresApproval: true,
      affectsBalance: true
    },
    MATERNITY: { 
      value: 'maternity', 
      label: 'Maternidad', 
      icon: 'baby',
      description: 'Licencia de maternidad',
      requiresApproval: true,
      affectsBalance: false
    },
    PATERNITY: { 
      value: 'paternity', 
      label: 'Paternidad', 
      icon: 'home',
      description: 'Licencia de paternidad',
      requiresApproval: true,
      affectsBalance: false
    },
    COMPENSATORY: { 
      value: 'compensatory', 
      label: 'Compensatorio', 
      icon: 'coffee',
      description: 'Días compensatorios',
      requiresApproval: true,
      affectsBalance: false
    },
    UNPAID: { 
      value: 'unpaid', 
      label: 'Sin Goce', 
      icon: 'dollar',
      description: 'Licencia sin goce de sueldo',
      requiresApproval: true,
      affectsBalance: false
    }
  },

  // Estados de solicitudes
  REQUEST_STATUSES: {
    PENDING: { 
      value: 'pending', 
      label: 'Pendiente', 
      color: 'yellow',
      canEdit: true,
      canDelete: true
    },
    APPROVED: { 
      value: 'approved', 
      label: 'Aprobada', 
      color: 'green',
      canEdit: false,
      canDelete: false
    },
    REJECTED: { 
      value: 'rejected', 
      label: 'Rechazada', 
      color: 'red',
      canEdit: false,
      canDelete: false
    },
    CANCELLED: { 
      value: 'cancelled', 
      label: 'Cancelada', 
      color: 'gray',
      canEdit: false,
      canDelete: false
    }
  },

  // Configuración de días según Ley Federal del Trabajo (México)
  VACATION_DAYS_BY_SENIORITY: {
    1: 6,   // 1 año = 6 días
    2: 8,   // 2 años = 8 días
    3: 10,  // 3 años = 10 días
    4: 12,  // 4 años = 12 días
    5: 14,  // 5 años = 14 días
    6: 16,  // 6 años = 16 días
    7: 18,  // 7 años = 18 días
    8: 20,  // 8 años = 20 días
    9: 22,  // 9 años = 22 días
    10: 24  // 10 años = 24 días
    // A partir de 10 años: +2 días cada 5 años
  },

  // Límites y validaciones
  LIMITS: {
    MIN_DAYS_PER_REQUEST: 1,
    MAX_DAYS_PER_REQUEST: 30,
    MIN_ADVANCE_NOTICE_DAYS: 7,
    MAX_ADVANCE_REQUEST_DAYS: 365,
    MAX_CARRYOVER_DAYS: 6,
    MAX_ATTACHMENTS_PER_REQUEST: 5,
    MAX_ATTACHMENT_SIZE_MB: 10,
    PROBATION_PERIOD_MONTHS: 6
  },

  // Tipos de archivos permitidos para adjuntos
  ALLOWED_ATTACHMENT_TYPES: [
    'application/pdf',                    // PDF
    'image/jpeg',                         // JPG
    'image/png',                          // PNG
    'image/jpg',                          // JPG
    'application/msword',                 // DOC
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'text/plain'                          // TXT
  ],

  // Extensiones de archivos permitidas
  ALLOWED_ATTACHMENT_EXTENSIONS: [
    '.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.txt'
  ],

  // Configuración de notificaciones
  NOTIFICATIONS: {
    REQUEST_CREATED: 'vacation_request_created',
    REQUEST_APPROVED: 'vacation_request_approved',
    REQUEST_REJECTED: 'vacation_request_rejected',
    REQUEST_CANCELLED: 'vacation_request_cancelled',
    BALANCE_LOW: 'vacation_balance_low',
    EXPIRATION_WARNING: 'vacation_expiration_warning'
  },

  // Roles y permisos
  PERMISSIONS: {
    CREATE_REQUEST: 'create_vacation_request',
    EDIT_OWN_REQUEST: 'edit_own_vacation_request',
    DELETE_OWN_REQUEST: 'delete_own_vacation_request',
    APPROVE_REQUEST: 'approve_vacation_request',
    REJECT_REQUEST: 'reject_vacation_request',
    VIEW_ALL_REQUESTS: 'view_all_vacation_requests',
    MANAGE_POLICY: 'manage_vacation_policy',
    EXPORT_REPORTS: 'export_vacation_reports'
  },

  // Configuración de reportes
  REPORTS: {
    MAX_PERIOD_DAYS: 365, // Máximo 1 año
    DEFAULT_PERIOD_DAYS: 30,
    FORMATS: ['json', 'excel', 'pdf'],
    EXCEL_MAX_ROWS: 10000
  },

  // Mensajes de error comunes
  ERROR_MESSAGES: {
    EMPLOYEE_NOT_FOUND: 'Empleado no encontrado',
    REQUEST_NOT_FOUND: 'Solicitud no encontrada',
    INVALID_DATE_RANGE: 'Rango de fechas inválido',
    INSUFFICIENT_DAYS: 'Días de vacaciones insuficientes',
    DATE_CONFLICT: 'Conflicto con fechas ya aprobadas',
    BLACKOUT_PERIOD: 'Fechas en período restringido',
    INVALID_REQUEST_STATUS: 'Estado de solicitud inválido',
    CANNOT_EDIT_APPROVED: 'No se puede editar una solicitud aprobada',
    CANNOT_DELETE_APPROVED: 'No se puede eliminar una solicitud aprobada',
    INVALID_FILE_TYPE: 'Tipo de archivo no permitido',
    FILE_TOO_LARGE: 'Archivo demasiado grande',
    REJECTION_REASON_REQUIRED: 'Motivo de rechazo requerido'
  },

  // Mensajes de éxito
  SUCCESS_MESSAGES: {
    REQUEST_CREATED: 'Solicitud de vacaciones creada exitosamente',
    REQUEST_UPDATED: 'Solicitud actualizada exitosamente',
    REQUEST_DELETED: 'Solicitud eliminada exitosamente',
    REQUEST_APPROVED: 'Solicitud aprobada exitosamente',
    REQUEST_REJECTED: 'Solicitud rechazada',
    REQUEST_CANCELLED: 'Solicitud cancelada exitosamente',
    ATTACHMENT_UPLOADED: 'Archivo subido exitosamente',
    REPORT_GENERATED: 'Reporte generado exitosamente',
    POLICY_UPDATED: 'Política actualizada exitosamente'
  },

  // Configuración de validaciones específicas
  VALIDATIONS: {
    // Campos requeridos por tipo de solicitud
    REQUIRED_FIELDS: {
      vacation: ['startDate', 'endDate', 'type', 'reason'],
      personal: ['startDate', 'endDate', 'type', 'reason'],
      sick_leave: ['startDate', 'endDate', 'type', 'reason'],
      maternity: ['startDate', 'endDate', 'type', 'reason'],
      paternity: ['startDate', 'endDate', 'type', 'reason'],
      compensatory: ['startDate', 'endDate', 'type', 'reason'],
      unpaid: ['startDate', 'endDate', 'type', 'reason']
    },

    // Archivos requeridos por tipo
    REQUIRED_ATTACHMENTS: {
      sick_leave: true,    // Requiere justificación médica
      maternity: true,     // Requiere certificado médico
      paternity: true      // Requiere certificado de nacimiento
    },

    // Validaciones de fechas
    DATE_VALIDATIONS: {
      startDateMustBeFuture: true,
      endDateAfterStartDate: true,
      excludeWeekends: true,
      excludeHolidays: false, // Configurable por empresa
      maxConsecutiveDays: 30
    }
  },

  // Configuración de períodos restringidos (blackout periods)
  DEFAULT_BLACKOUT_PERIODS: [
    {
      name: 'Temporada Alta Fin de Año',
      startDate: '12-15', // MM-DD
      endDate: '12-30',
      reason: 'Temporada alta de fin de año',
      appliesToTypes: ['vacation', 'personal']
    },
    {
      name: 'Cierre de Mes',
      startDate: 'last-3', // Últimos 3 días del mes
      endDate: 'last-1',
      reason: 'Cierre contable mensual',
      appliesToTypes: ['vacation', 'personal']
    }
  ],

  // Configuración de expiración
  EXPIRATION: {
    CARRYOVER_DAYS: 6,           // Máximo días que se pueden acumular
    EXPIRATION_DATE: '12-31',    // Fecha de expiración anual
    WARNING_DAYS: 30,            // Días de anticipación para avisar expiración
    AUTO_EXPIRE: true            // Expirar automáticamente al final del año
  }
};

// Función para obtener configuración específica
const getConfig = (section, key = null) => {
  if (key) {
    return VACATION_CONFIG[section]?.[key];
  }
  return VACATION_CONFIG[section];
};

// Función para validar tipo de vacación
const isValidVacationType = (type) => {
  return Object.values(VACATION_CONFIG.VACATION_TYPES).some(vt => vt.value === type);
};

// Función para validar estado de solicitud
const isValidRequestStatus = (status) => {
  return Object.values(VACATION_CONFIG.REQUEST_STATUSES).some(rs => rs.value === status);
};

// Función para obtener información de tipo de vacación
const getVacationTypeInfo = (type) => {
  return Object.values(VACATION_CONFIG.VACATION_TYPES).find(vt => vt.value === type);
};

// Función para obtener información de estado
const getRequestStatusInfo = (status) => {
  return Object.values(VACATION_CONFIG.REQUEST_STATUSES).find(rs => rs.value === status);
};

// Función para validar archivo adjunto
const isValidAttachmentType = (mimeType) => {
  return VACATION_CONFIG.ALLOWED_ATTACHMENT_TYPES.includes(mimeType);
};

// Función para obtener mensaje de error
const getErrorMessage = (key) => {
  return VACATION_CONFIG.ERROR_MESSAGES[key] || 'Error desconocido';
};

// Función para obtener mensaje de éxito
const getSuccessMessage = (key) => {
  return VACATION_CONFIG.SUCCESS_MESSAGES[key] || 'Operación exitosa';
};

// Función para calcular días de vacaciones según antigüedad
const calculateVacationDays = (hireDate, currentYear = new Date().getFullYear()) => {
  const start = new Date(hireDate);
  const yearEnd = new Date(`${currentYear}-12-31`);
  
  // Calcular años de antigüedad al final del año
  const yearsOfService = yearEnd.getFullYear() - start.getFullYear();
  
  // Obtener días base según tabla
  let vacationDays = VACATION_CONFIG.VACATION_DAYS_BY_SENIORITY[Math.min(yearsOfService, 10)] || 6;
  
  // A partir de 10 años, 2 días adicionales cada 5 años
  if (yearsOfService > 10) {
    const additionalPeriods = Math.floor((yearsOfService - 10) / 5);
    vacationDays += additionalPeriods * 2;
  }
  
  return vacationDays;
};

// Función para verificar si una fecha está en período restringido
const isInBlackoutPeriod = (date, blackoutPeriods = []) => {
  const checkDate = new Date(date);
  
  return blackoutPeriods.some(period => {
    const startDate = new Date(`${new Date().getFullYear()}-${period.startDate}`);
    const endDate = new Date(`${new Date().getFullYear()}-${period.endDate}`);
    
    return checkDate >= startDate && checkDate <= endDate;
  });
};

module.exports = {
  VACATION_CONFIG,
  getConfig,
  isValidVacationType,
  isValidRequestStatus,
  getVacationTypeInfo,
  getRequestStatusInfo,
  isValidAttachmentType,
  getErrorMessage,
  getSuccessMessage,
  calculateVacationDays,
  isInBlackoutPeriod
};
