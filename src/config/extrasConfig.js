/**
 * Configuración del Módulo de Extras
 * Contiene todas las configuraciones, tipos, multiplicadores y validaciones
 */

const EXTRAS_CONFIG = {
  // Tipos de movimientos disponibles
  MOVEMENT_TYPES: {
    OVERTIME: 'overtime',
    ABSENCE: 'absence', 
    BONUS: 'bonus',
    DEDUCTION: 'deduction',
    LOAN: 'loan',
    DAMAGE: 'damage'
  },

  // Estados de movimientos
  MOVEMENT_STATUSES: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  },

  // Tipos de horas extra
  OVERTIME_TYPES: {
    REGULAR: 'regular',
    WEEKEND: 'weekend', 
    HOLIDAY: 'holiday'
  },

  // Multiplicadores para horas extra
  OVERTIME_MULTIPLIERS: {
    regular: 1.5,
    weekend: 2.0,
    holiday: 3.0
  },

  // Tipos de ausencias
  ABSENCE_TYPES: {
    SICK_LEAVE: 'sick_leave',
    PERSONAL_LEAVE: 'personal_leave',
    VACATION: 'vacation',
    EMERGENCY: 'emergency',
    MEDICAL_APPOINTMENT: 'medical_appointment',
    OTHER: 'other'
  },

  // Tasas de descuento por tipo de ausencia
  ABSENCE_DEDUCTION_RATES: {
    sick_leave: 0.4,      // 40% descuento (60% del salario)
    personal_leave: 1.0,   // 100% descuento
    vacation: 0.0,         // Sin descuento si tiene días disponibles
    emergency: 0.5,        // 50% descuento
    medical_appointment: 0.25, // 25% descuento
    other: 1.0            // 100% descuento
  },

  // Tipos de bonos
  BONUS_TYPES: {
    PERFORMANCE: 'performance',
    SPECIAL: 'special',
    HOLIDAY: 'holiday'
  },

  // Tipos de deducciones
  DEDUCTION_TYPES: {
    VOLUNTARY: 'voluntary',
    DISCIPLINARY: 'disciplinary',
    EQUIPMENT: 'equipment',
    OTHER: 'other'
  },

  // Tipos de daños
  DAMAGE_TYPES: {
    EQUIPMENT: 'equipment',
    PROPERTY: 'property',
    VEHICLE: 'vehicle',
    OTHER: 'other'
  },

  // Ubicaciones de trabajo
  WORK_LOCATIONS: {
    OFFICE: 'office',
    REMOTE: 'remote',
    FIELD: 'field'
  },

    VACATION: 'vacation',
    SICK_LEAVE: 'sick_leave'
  },

  // Límites y validaciones
  LIMITS: {
    MAX_OVERTIME_HOURS_PER_DAY: 3,
    MAX_OVERTIME_HOURS_PER_WEEK: 15,
    MAX_ACTIVE_LOANS_PER_EMPLOYEE: 3,
    MAX_LOAN_PERCENTAGE_OF_SALARY: 0.3, // 30%
    MAX_FILE_SIZE_MB: 10,
    MAX_FILES_PER_UPLOAD: 5,
    MAX_ABSENCE_DAYS_WITHOUT_APPROVAL: 3,
    MIN_JUSTIFICATION_LENGTH: 20
  },

  // Tipos de archivos permitidos
  ALLOWED_FILE_TYPES: [
    'application/pdf',                    // PDF
    'image/jpeg',                         // JPG
    'image/png',                          // PNG
    'application/msword',                 // DOC
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'text/plain'                          // TXT
  ],

  // Extensiones de archivos permitidas
  ALLOWED_FILE_EXTENSIONS: [
    '.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.txt'
  ],

  // Configuración de cálculos
  CALCULATIONS: {
    WORKING_DAYS_PER_MONTH: 30,
    WORKING_HOURS_PER_DAY: 8,
    WORKING_HOURS_PER_WEEK: 40
  },

  // Configuración de notificaciones
  NOTIFICATIONS: {
    MOVEMENT_REGISTERED: 'movement_registered',
    MOVEMENT_APPROVED: 'movement_approved',
    MOVEMENT_REJECTED: 'movement_rejected',
    OVERTIME_LIMIT_EXCEEDED: 'overtime_limit_exceeded',
    LOAN_LIMIT_EXCEEDED: 'loan_limit_exceeded',
    APPROVAL_REQUIRED: 'approval_required'
  },

  // Roles y permisos
  PERMISSIONS: {
    REGISTER_MOVEMENT: 'register_movement',
    APPROVE_MOVEMENT: 'approve_movement',
    REJECT_MOVEMENT: 'reject_movement',
    EDIT_MOVEMENT: 'edit_movement',
    DELETE_MOVEMENT: 'delete_movement',
    VIEW_ALL_MOVEMENTS: 'view_all_movements',
    GENERATE_REPORTS: 'generate_reports',
    EXPORT_DATA: 'export_data'
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
    MOVEMENT_NOT_FOUND: 'Movimiento no encontrado',
    INVALID_DATE: 'Fecha inválida',
    INVALID_AMOUNT: 'Monto inválido',
    OVERTIME_LIMIT_EXCEEDED: 'Límite de horas extra excedido',
    LOAN_LIMIT_EXCEEDED: 'Límite de préstamos excedido',
    INSUFFICIENT_VACATION_DAYS: 'Días de vacaciones insuficientes',
    APPROVAL_REQUIRED: 'Aprobación requerida',
    INVALID_FILE_TYPE: 'Tipo de archivo no permitido',
    FILE_TOO_LARGE: 'Archivo demasiado grande',
    JUSTIFICATION_TOO_SHORT: 'Justificación demasiado corta'
  },

  // Mensajes de éxito
  SUCCESS_MESSAGES: {
    MOVEMENT_REGISTERED: 'Movimiento registrado exitosamente',
    MOVEMENT_APPROVED: 'Movimiento aprobado exitosamente',
    MOVEMENT_REJECTED: 'Movimiento rechazado',
    MOVEMENT_UPDATED: 'Movimiento actualizado exitosamente',
    MOVEMENT_DELETED: 'Movimiento eliminado exitosamente',
    FILE_UPLOADED: 'Archivo subido exitosamente',
    REPORT_GENERATED: 'Reporte generado exitosamente',
    EXTRAS_PROCESSED: 'Extras procesados exitosamente'
  },

  // Configuración de validaciones específicas
  VALIDATIONS: {
    // Campos requeridos por tipo de movimiento
    REQUIRED_FIELDS: {
      overtime: ['date', 'hours', 'reason', 'description'],
      absence: ['date', 'reason', 'description', 'duration'],
      bonus: ['date', 'amount', 'reason', 'description'],
      deduction: ['date', 'amount', 'reason', 'description'],
      loan: ['date', 'totalAmount', 'totalInstallments', 'reason', 'description', 'justification'],
      damage: ['date', 'amount', 'reason', 'description', 'justification']
    },

    // Archivos requeridos por tipo
    REQUIRED_ATTACHMENTS: {
      loan: true,
      damage: true,
      sick_leave: true // Para ausencias por enfermedad
    },

    // Validaciones de montos máximos
    MAX_AMOUNTS: {
      bonus: 50000,      // Máximo bono
      deduction: 10000,  // Máxima deducción
      damage: 100000,    // Máximo daño
      loan: 500000       // Máximo préstamo
    }
  }
};

// Función para obtener configuración específica
const getConfig = (section, key = null) => {
  if (key) {
    return EXTRAS_CONFIG[section]?.[key];
  }
  return EXTRAS_CONFIG[section];
};

// Función para validar tipo de movimiento
const isValidMovementType = (type) => {
  return Object.values(EXTRAS_CONFIG.MOVEMENT_TYPES).includes(type);
};

// Función para obtener multiplicador de horas extra
const getOvertimeMultiplier = (type) => {
  return EXTRAS_CONFIG.OVERTIME_MULTIPLIERS[type] || 1.5;
};

// Función para obtener tasa de descuento por ausencia
const getAbsenceDeductionRate = (type) => {
  return EXTRAS_CONFIG.ABSENCE_DEDUCTION_RATES[type] || 1.0;
};

// Función para validar archivo
const isValidFileType = (mimeType) => {
  return EXTRAS_CONFIG.ALLOWED_FILE_TYPES.includes(mimeType);
};

// Función para obtener mensaje de error
const getErrorMessage = (key) => {
  return EXTRAS_CONFIG.ERROR_MESSAGES[key] || 'Error desconocido';
};

// Función para obtener mensaje de éxito
const getSuccessMessage = (key) => {
  return EXTRAS_CONFIG.SUCCESS_MESSAGES[key] || 'Operación exitosa';
};

module.exports = {
  EXTRAS_CONFIG,
  getConfig,
  isValidMovementType,
  getOvertimeMultiplier,
  getAbsenceDeductionRate,
  isValidFileType,
  getErrorMessage,
  getSuccessMessage
};
