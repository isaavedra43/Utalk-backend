/**
 * 🔧 CONFIGURACIÓN DEL MÓDULO DE EQUIPOS
 * 
 * Configuración centralizada para el módulo de equipos y herramientas
 * Alineado 100% con especificaciones del Frontend
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const EQUIPMENT_CONFIG = {
  // Categorías de equipos
  EQUIPMENT_CATEGORIES: {
    UNIFORM: 'uniform',
    TOOLS: 'tools',
    COMPUTER: 'computer',
    VEHICLE: 'vehicle',
    PHONE: 'phone',
    FURNITURE: 'furniture',
    SAFETY: 'safety',
    OTHER: 'other'
  },

  // Estados del equipo
  EQUIPMENT_STATUS: {
    ASSIGNED: 'assigned',
    IN_USE: 'in_use',
    MAINTENANCE: 'maintenance',
    RETURNED: 'returned',
    LOST: 'lost',
    DAMAGED: 'damaged'
  },

  // Condiciones del equipo
  EQUIPMENT_CONDITIONS: {
    EXCELLENT: 'excellent',
    GOOD: 'good',
    FAIR: 'fair',
    POOR: 'poor',
    DAMAGED: 'damaged'
  },

  // Tipos de revisión
  REVIEW_TYPES: {
    DAILY: 'daily',
    THIRD_DAY: 'third_day',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    QUARTERLY: 'quarterly',
    ANNUAL: 'annual'
  },

  // Niveles de limpieza
  CLEANLINESS_LEVELS: {
    EXCELLENT: 'excellent',
    GOOD: 'good',
    FAIR: 'fair',
    POOR: 'poor'
  },

  // Niveles de funcionalidad
  FUNCTIONALITY_LEVELS: {
    EXCELLENT: 'excellent',
    GOOD: 'good',
    FAIR: 'fair',
    POOR: 'poor',
    NOT_WORKING: 'not_working'
  },

  // Severidad de daños
  DAMAGE_SEVERITY: {
    MINOR: 'minor',
    MODERATE: 'moderate',
    SEVERE: 'severe'
  },

  // Tipos de reportes
  REPORT_TYPES: {
    INVENTORY: 'inventory',
    MAINTENANCE: 'maintenance',
    DEPRECIATION: 'depreciation',
    RESPONSIBILITY: 'responsibility',
    REVIEWS: 'reviews',
    SUMMARY: 'summary'
  },

  // Límites y validaciones
  LIMITS: {
    MAX_NAME_LENGTH: 100,
    MAX_DESCRIPTION_LENGTH: 500,
    MAX_BRAND_LENGTH: 50,
    MAX_MODEL_LENGTH: 50,
    MAX_SERIAL_LENGTH: 100,
    MAX_LOCATION_LENGTH: 100,
    MAX_NOTES_LENGTH: 1000,
    MAX_TAGS: 10,
    MAX_PHOTOS: 20,
    MAX_DAMAGES: 10,
    MIN_PURCHASE_PRICE: 0.01,
    MAX_PURCHASE_PRICE: 999999.99,
    MIN_CURRENT_VALUE: 0,
    MAX_CURRENT_VALUE: 999999.99
  },

  // Configuración de archivos
  FILE_CONFIG: {
    ALLOWED_PHOTO_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    MAX_PHOTO_SIZE: 5 * 1024 * 1024, // 5MB
    MAX_DOCUMENT_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_FILES_PER_UPLOAD: 10
  },

  // Configuración de depreciación
  DEPRECIATION: {
    DEFAULT_RATE: 0.20, // 20% anual
    MAX_YEARS: 5,
    MIN_VALUE_PERCENTAGE: 0.10 // 10% del valor original
  },

  // Configuración de alertas
  ALERTS: {
    WARRANTY_EXPIRY_DAYS: 30,
    INSURANCE_EXPIRY_DAYS: 30,
    MAINTENANCE_DUE_DAYS: 7,
    REVIEW_OVERDUE_DAYS: 3
  },

  // Mensajes de error
  ERROR_MESSAGES: {
    EQUIPMENT_NOT_FOUND: 'Equipo no encontrado',
    EMPLOYEE_NOT_FOUND: 'Empleado no encontrado',
    INVALID_CATEGORY: 'Categoría de equipo inválida',
    INVALID_STATUS: 'Estado de equipo inválido',
    INVALID_CONDITION: 'Condición de equipo inválida',
    INVALID_REVIEW_TYPE: 'Tipo de revisión inválido',
    NAME_REQUIRED: 'El nombre del equipo es requerido',
    DESCRIPTION_REQUIRED: 'La descripción es requerida',
    PURCHASE_DATE_REQUIRED: 'La fecha de compra es requerida',
    PURCHASE_PRICE_INVALID: 'El precio de compra debe ser mayor a 0',
    CURRENT_VALUE_INVALID: 'El valor actual debe ser mayor o igual a 0',
    ASSIGNED_DATE_REQUIRED: 'La fecha de asignación es requerida',
    INVOICE_NUMBER_REQUIRED: 'El número de factura es requerido',
    SUPPLIER_REQUIRED: 'El proveedor es requerido',
    CURRENT_VALUE_TOO_HIGH: 'El valor actual no puede ser mayor al precio de compra',
    ASSIGNED_DATE_BEFORE_PURCHASE: 'La fecha de asignación no puede ser anterior a la fecha de compra',
    WARRANTY_EXPIRATION_REQUIRED: 'La fecha de vencimiento de garantía es requerida',
    INSURANCE_EXPIRATION_REQUIRED: 'La fecha de vencimiento del seguro es requerida',
    INVALID_DATE_FORMAT: 'Formato de fecha inválido',
    REVIEW_DATE_FUTURE: 'La fecha de revisión no puede ser en el futuro',
    MAINTENANCE_DESCRIPTION_REQUIRED: 'La descripción del mantenimiento es requerida',
    DAMAGE_TYPE_REQUIRED: 'El tipo de daño es requerido',
    DAMAGE_DESCRIPTION_REQUIRED: 'La descripción del daño es requerida',
    REVIEWER_REQUIRED: 'El revisor es requerido',
    REVIEWER_NAME_REQUIRED: 'El nombre del revisor es requerido',
    FILE_TOO_LARGE: 'El archivo es demasiado grande',
    INVALID_FILE_TYPE: 'Tipo de archivo no permitido',
    TOO_MANY_FILES: 'Demasiados archivos en una sola subida',
    UNAUTHORIZED_ACCESS: 'No tienes permisos para realizar esta acción',
    EQUIPMENT_ALREADY_ASSIGNED: 'El equipo ya está asignado a otro empleado',
    CANNOT_DELETE_ASSIGNED: 'No se puede eliminar un equipo asignado',
    CANNOT_RETURN_NOT_ASSIGNED: 'No se puede devolver un equipo no asignado'
  },

  // Mensajes de éxito
  SUCCESS_MESSAGES: {
    EQUIPMENT_CREATED: 'Equipo creado exitosamente',
    EQUIPMENT_UPDATED: 'Equipo actualizado exitosamente',
    EQUIPMENT_DELETED: 'Equipo eliminado exitosamente',
    EQUIPMENT_RETURNED: 'Equipo devuelto exitosamente',
    EQUIPMENT_LOST_REPORTED: 'Equipo reportado como perdido',
    EQUIPMENT_DAMAGE_REPORTED: 'Daño reportado exitosamente',
    REVIEW_CREATED: 'Revisión creada exitosamente',
    REVIEW_DELETED: 'Revisión eliminada exitosamente',
    FILES_UPLOADED: 'Archivos subidos exitosamente',
    REPORT_GENERATED: 'Reporte generado exitosamente',
    EXPORT_COMPLETED: 'Exportación completada exitosamente'
  },

  // Configuración de permisos
  PERMISSIONS: {
    CREATE_EQUIPMENT: ['admin', 'hr_admin', 'hr_manager'],
    UPDATE_EQUIPMENT: ['admin', 'hr_admin', 'hr_manager'],
    DELETE_EQUIPMENT: ['admin', 'hr_admin'],
    ASSIGN_EQUIPMENT: ['admin', 'hr_admin', 'hr_manager'],
    RETURN_EQUIPMENT: ['admin', 'hr_admin', 'hr_manager', 'supervisor'],
    REPORT_LOST: ['admin', 'hr_admin', 'hr_manager', 'supervisor', 'employee'],
    REPORT_DAMAGE: ['admin', 'hr_admin', 'hr_manager', 'supervisor', 'employee'],
    CREATE_REVIEW: ['admin', 'hr_admin', 'hr_manager', 'supervisor'],
    VIEW_EQUIPMENT: ['admin', 'hr_admin', 'hr_manager', 'supervisor', 'employee'],
    EXPORT_EQUIPMENT: ['admin', 'hr_admin', 'hr_manager'],
    GENERATE_REPORTS: ['admin', 'hr_admin', 'hr_manager']
  },

  // Configuración de notificaciones
  NOTIFICATIONS: {
    WARRANTY_EXPIRING: {
      title: 'Garantía por vencer',
      message: 'La garantía del equipo {equipmentName} vence en {days} días',
      type: 'warning'
    },
    INSURANCE_EXPIRING: {
      title: 'Seguro por vencer',
      message: 'El seguro del equipo {equipmentName} vence en {days} días',
      type: 'warning'
    },
    MAINTENANCE_DUE: {
      title: 'Mantenimiento requerido',
      message: 'El equipo {equipmentName} requiere mantenimiento',
      type: 'info'
    },
    REVIEW_OVERDUE: {
      title: 'Revisión vencida',
      message: 'La revisión del equipo {equipmentName} está vencida',
      type: 'error'
    },
    EQUIPMENT_LOST: {
      title: 'Equipo reportado como perdido',
      message: 'El equipo {equipmentName} ha sido reportado como perdido',
      type: 'error'
    },
    EQUIPMENT_DAMAGED: {
      title: 'Equipo dañado',
      message: 'Se ha reportado daño en el equipo {equipmentName}',
      type: 'warning'
    }
  }
};

/**
 * Valida si una categoría de equipo es válida
 */
const isValidEquipmentCategory = (category) => {
  return Object.values(EQUIPMENT_CONFIG.EQUIPMENT_CATEGORIES).includes(category);
};

/**
 * Valida si un estado de equipo es válido
 */
const isValidEquipmentStatus = (status) => {
  return Object.values(EQUIPMENT_CONFIG.EQUIPMENT_STATUS).includes(status);
};

/**
 * Valida si una condición de equipo es válida
 */
const isValidEquipmentCondition = (condition) => {
  return Object.values(EQUIPMENT_CONFIG.EQUIPMENT_CONDITIONS).includes(condition);
};

/**
 * Valida si un tipo de revisión es válido
 */
const isValidReviewType = (reviewType) => {
  return Object.values(EQUIPMENT_CONFIG.REVIEW_TYPES).includes(reviewType);
};

/**
 * Valida si un nivel de limpieza es válido
 */
const isValidCleanlinessLevel = (cleanliness) => {
  return Object.values(EQUIPMENT_CONFIG.CLEANLINESS_LEVELS).includes(cleanliness);
};

/**
 * Valida si un nivel de funcionalidad es válido
 */
const isValidFunctionalityLevel = (functionality) => {
  return Object.values(EQUIPMENT_CONFIG.FUNCTIONALITY_LEVELS).includes(functionality);
};

/**
 * Valida si una severidad de daño es válida
 */
const isValidDamageSeverity = (severity) => {
  return Object.values(EQUIPMENT_CONFIG.DAMAGE_SEVERITY).includes(severity);
};

/**
 * Valida si un tipo de reporte es válido
 */
const isValidReportType = (reportType) => {
  return Object.values(EQUIPMENT_CONFIG.REPORT_TYPES).includes(reportType);
};

/**
 * Verifica si el usuario tiene permisos para una acción
 */
const hasPermission = (userRole, action) => {
  const allowedRoles = EQUIPMENT_CONFIG.PERMISSIONS[action];
  return allowedRoles && allowedRoles.includes(userRole);
};

/**
 * Obtiene el mensaje de error por código
 */
const getErrorMessage = (errorCode) => {
  return EQUIPMENT_CONFIG.ERROR_MESSAGES[errorCode] || 'Error desconocido';
};

/**
 * Obtiene el mensaje de éxito por código
 */
const getSuccessMessage = (successCode) => {
  return EQUIPMENT_CONFIG.SUCCESS_MESSAGES[successCode] || 'Operación exitosa';
};

/**
 * Valida el tamaño de un archivo
 */
const validateFileSize = (fileSize, fileType = 'photo') => {
  const maxSize = fileType === 'photo' 
    ? EQUIPMENT_CONFIG.FILE_CONFIG.MAX_PHOTO_SIZE 
    : EQUIPMENT_CONFIG.FILE_CONFIG.MAX_DOCUMENT_SIZE;
  
  return fileSize <= maxSize;
};

/**
 * Valida el tipo de archivo
 */
const validateFileType = (mimeType, fileType = 'photo') => {
  const allowedTypes = fileType === 'photo' 
    ? EQUIPMENT_CONFIG.FILE_CONFIG.ALLOWED_PHOTO_TYPES 
    : EQUIPMENT_CONFIG.FILE_CONFIG.ALLOWED_DOCUMENT_TYPES;
  
  return allowedTypes.includes(mimeType);
};

/**
 * Calcula la depreciación de un equipo
 */
const calculateDepreciation = (purchaseDate, purchasePrice, currentValue = null) => {
  const purchase = new Date(purchaseDate);
  const current = new Date();
  const yearsDiff = (current - purchase) / (1000 * 60 * 60 * 24 * 365);
  
  const depreciationRate = EQUIPMENT_CONFIG.DEPRECIATION.DEFAULT_RATE;
  const totalDepreciation = Math.min(yearsDiff * depreciationRate, 1);
  const depreciatedValue = purchasePrice * (1 - totalDepreciation);
  
  return {
    yearsInUse: Math.round(yearsDiff * 10) / 10,
    depreciationRate: depreciationRate,
    totalDepreciation: Math.round(totalDepreciation * 100),
    depreciatedValue: Math.round(depreciatedValue * 100) / 100,
    currentValue: currentValue || depreciatedValue
  };
};

/**
 * Verifica si una garantía está por vencer
 */
const isWarrantyExpiringSoon = (expirationDate) => {
  if (!expirationDate) return false;
  
  const expiration = new Date(expirationDate);
  const current = new Date();
  const daysUntilExpiration = (expiration - current) / (1000 * 60 * 60 * 24);
  
  return daysUntilExpiration <= EQUIPMENT_CONFIG.ALERTS.WARRANTY_EXPIRY_DAYS && daysUntilExpiration > 0;
};

/**
 * Verifica si un seguro está por vencer
 */
const isInsuranceExpiringSoon = (expirationDate) => {
  if (!expirationDate) return false;
  
  const expiration = new Date(expirationDate);
  const current = new Date();
  const daysUntilExpiration = (expiration - current) / (1000 * 60 * 60 * 24);
  
  return daysUntilExpiration <= EQUIPMENT_CONFIG.ALERTS.INSURANCE_EXPIRY_DAYS && daysUntilExpiration > 0;
};

/**
 * Obtiene el siguiente tipo de revisión
 */
const getNextReviewType = (currentType) => {
  const types = Object.values(EQUIPMENT_CONFIG.REVIEW_TYPES);
  const currentIndex = types.indexOf(currentType);
  
  if (currentIndex === -1 || currentIndex === types.length - 1) {
    return EQUIPMENT_CONFIG.REVIEW_TYPES.MONTHLY;
  }
  
  return types[currentIndex + 1];
};

/**
 * Calcula la próxima fecha de revisión
 */
const calculateNextReviewDate = (lastReviewDate, reviewType) => {
  const lastDate = new Date(lastReviewDate);
  const nextDate = new Date(lastDate);

  switch (reviewType) {
    case EQUIPMENT_CONFIG.REVIEW_TYPES.DAILY:
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case EQUIPMENT_CONFIG.REVIEW_TYPES.THIRD_DAY:
      nextDate.setDate(nextDate.getDate() + 3);
      break;
    case EQUIPMENT_CONFIG.REVIEW_TYPES.WEEKLY:
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case EQUIPMENT_CONFIG.REVIEW_TYPES.MONTHLY:
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case EQUIPMENT_CONFIG.REVIEW_TYPES.QUARTERLY:
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case EQUIPMENT_CONFIG.REVIEW_TYPES.ANNUAL:
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    default:
      nextDate.setMonth(nextDate.getMonth() + 1);
  }

  return nextDate.toISOString().split('T')[0];
};

module.exports = {
  EQUIPMENT_CONFIG,
  isValidEquipmentCategory,
  isValidEquipmentStatus,
  isValidEquipmentCondition,
  isValidReviewType,
  isValidCleanlinessLevel,
  isValidFunctionalityLevel,
  isValidDamageSeverity,
  isValidReportType,
  hasPermission,
  getErrorMessage,
  getSuccessMessage,
  validateFileSize,
  validateFileType,
  calculateDepreciation,
  isWarrantyExpiringSoon,
  isInsuranceExpiringSoon,
  getNextReviewType,
  calculateNextReviewDate
};
