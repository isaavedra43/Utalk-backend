/**
 * Configuración del Módulo de Incidentes
 * Contiene todas las configuraciones, tipos, validaciones y reglas de negocio
 */

const INCIDENT_CONFIG = {
  // Tipos de incidentes
  INCIDENT_TYPES: {
    SAFETY: { 
      value: 'safety', 
      label: 'Seguridad', 
      icon: 'shield',
      description: 'Incidentes relacionados con la seguridad laboral',
      requiresSupervisor: true
    },
    EQUIPMENT: { 
      value: 'equipment', 
      label: 'Equipo', 
      icon: 'wrench',
      description: 'Incidentes relacionados con equipos y herramientas',
      requiresSupervisor: false
    },
    WORKPLACE: { 
      value: 'workplace', 
      label: 'Lugar de Trabajo', 
      icon: 'building',
      description: 'Incidentes relacionados con instalaciones',
      requiresSupervisor: true
    },
    ENVIRONMENTAL: { 
      value: 'environmental', 
      label: 'Ambiental', 
      icon: 'leaf',
      description: 'Incidentes ambientales',
      requiresSupervisor: true
    },
    SECURITY: { 
      value: 'security', 
      label: 'Seguridad Física', 
      icon: 'lock',
      description: 'Incidentes de seguridad física',
      requiresSupervisor: true
    },
    QUALITY: { 
      value: 'quality', 
      label: 'Calidad', 
      icon: 'award',
      description: 'Incidentes de calidad',
      requiresSupervisor: false
    },
    OTHER: { 
      value: 'other', 
      label: 'Otro', 
      icon: 'alert-circle',
      description: 'Otros incidentes',
      requiresSupervisor: false
    }
  },

  // Niveles de severidad
  SEVERITY_LEVELS: {
    LOW: { 
      value: 'low', 
      label: 'Bajo', 
      color: 'green',
      requiresImmediateAction: false
    },
    MEDIUM: { 
      value: 'medium', 
      label: 'Medio', 
      color: 'yellow',
      requiresImmediateAction: false
    },
    HIGH: { 
      value: 'high', 
      label: 'Alto', 
      color: 'orange',
      requiresImmediateAction: true
    },
    CRITICAL: { 
      value: 'critical', 
      label: 'Crítico', 
      color: 'red',
      requiresImmediateAction: true
    }
  },

  // Niveles de prioridad
  PRIORITY_LEVELS: {
    LOW: { value: 'low', label: 'Baja', color: 'gray' },
    MEDIUM: { value: 'medium', label: 'Media', color: 'blue' },
    HIGH: { value: 'high', label: 'Alta', color: 'orange' },
    URGENT: { value: 'urgent', label: 'Urgente', color: 'red' }
  },

  // Estados de incidente
  INCIDENT_STATUSES: {
    OPEN: { 
      value: 'open', 
      label: 'Abierto', 
      color: 'blue',
      canEdit: true,
      canDelete: true
    },
    INVESTIGATING: { 
      value: 'investigating', 
      label: 'Investigando', 
      color: 'yellow',
      canEdit: true,
      canDelete: false
    },
    RESOLVED: { 
      value: 'resolved', 
      label: 'Resuelto', 
      color: 'green',
      canEdit: false,
      canDelete: false
    },
    CLOSED: { 
      value: 'closed', 
      label: 'Cerrado', 
      color: 'gray',
      canEdit: false,
      canDelete: false
    }
  },

  // Estados de aprobación
  APPROVAL_STATUSES: {
    PENDING: { value: 'pending', label: 'Pendiente', color: 'yellow' },
    APPROVED: { value: 'approved', label: 'Aprobado', color: 'green' },
    REJECTED: { value: 'rejected', label: 'Rechazado', color: 'red' }
  },

  // Límites y validaciones
  LIMITS: {
    MIN_TITLE_LENGTH: 5,
    MAX_TITLE_LENGTH: 200,
    MIN_DESCRIPTION_LENGTH: 20,
    MAX_DESCRIPTION_LENGTH: 5000,
    MAX_ATTACHMENTS: 10,
    MAX_ATTACHMENT_SIZE_MB: 10,
    MAX_INVOLVED_PERSONS: 20,
    MAX_WITNESSES: 10,
    MAX_ACTIONS_TAKEN: 50,
    MAX_CONSEQUENCES: 20,
    MAX_PREVENTIVE_MEASURES: 30,
    MAX_TAGS: 10
  },

  // Tipos de consecuencias
  CONSEQUENCE_TYPES: {
    INJURY: { value: 'injury', label: 'Lesión' },
    DAMAGE: { value: 'damage', label: 'Daño Material' },
    LOSS: { value: 'loss', label: 'Pérdida' },
    ENVIRONMENTAL: { value: 'environmental', label: 'Ambiental' },
    OPERATIONAL: { value: 'operational', label: 'Operacional' },
    REPUTATIONAL: { value: 'reputational', label: 'Reputacional' },
    LEGAL: { value: 'legal', label: 'Legal' },
    OTHER: { value: 'other', label: 'Otro' }
  },

  // Tipos de archivos permitidos
  ALLOWED_ATTACHMENT_TYPES: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'video/mp4',
    'video/quicktime'
  ],

  // Extensiones permitidas
  ALLOWED_ATTACHMENT_EXTENSIONS: [
    '.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', 
    '.xls', '.xlsx', '.txt', '.mp4', '.mov'
  ],

  // Tipos de reportes
  REPORT_TYPES: {
    SUMMARY: { value: 'summary', label: 'Resumen Ejecutivo' },
    DETAILED: { value: 'detailed', label: 'Detallado' },
    COST: { value: 'cost', label: 'Análisis de Costos' },
    TIMELINE: { value: 'timeline', label: 'Cronología' },
    PREVENTION: { value: 'prevention', label: 'Medidas Preventivas' },
    COMPLIANCE: { value: 'compliance', label: 'Cumplimiento Normativo' }
  },

  // Estados de reclamaciones
  CLAIM_STATUSES: {
    PENDING: { value: 'pending', label: 'Pendiente' },
    PROCESSING: { value: 'processing', label: 'En Proceso' },
    APPROVED: { value: 'approved', label: 'Aprobado' },
    REJECTED: { value: 'rejected', label: 'Rechazado' },
    COMPLETED: { value: 'completed', label: 'Completado' }
  },

  // Roles de personas involucradas
  PERSON_ROLES: {
    AFFECTED: { value: 'affected', label: 'Afectado' },
    WITNESS: { value: 'witness', label: 'Testigo' },
    REPORTER: { value: 'reporter', label: 'Reportante' },
    INVESTIGATOR: { value: 'investigator', label: 'Investigador' },
    RESPONSIBLE: { value: 'responsible', label: 'Responsable' },
    OTHER: { value: 'other', label: 'Otro' }
  },

  // Configuración de notificaciones
  NOTIFICATIONS: {
    INCIDENT_CREATED: 'incident_created',
    INCIDENT_UPDATED: 'incident_updated',
    INCIDENT_APPROVED: 'incident_approved',
    INCIDENT_REJECTED: 'incident_rejected',
    INCIDENT_CLOSED: 'incident_closed',
    COST_MARKED_PAID: 'incident_cost_paid',
    FOLLOW_UP_REQUIRED: 'incident_follow_up_required',
    HIGH_SEVERITY_ALERT: 'incident_high_severity_alert'
  },

  // Permisos
  PERMISSIONS: {
    CREATE_INCIDENT: 'create_incident',
    EDIT_OWN_INCIDENT: 'edit_own_incident',
    EDIT_ANY_INCIDENT: 'edit_any_incident',
    DELETE_INCIDENT: 'delete_incident',
    APPROVE_INCIDENT: 'approve_incident',
    REJECT_INCIDENT: 'reject_incident',
    CLOSE_INCIDENT: 'close_incident',
    VIEW_ALL_INCIDENTS: 'view_all_incidents',
    MANAGE_COSTS: 'manage_incident_costs',
    EXPORT_REPORTS: 'export_incident_reports'
  },

  // Mensajes de error
  ERROR_MESSAGES: {
    EMPLOYEE_NOT_FOUND: 'Empleado no encontrado',
    INCIDENT_NOT_FOUND: 'Incidente no encontrado',
    TITLE_TOO_SHORT: 'El título debe tener al menos 5 caracteres',
    DESCRIPTION_TOO_SHORT: 'La descripción debe tener al menos 20 caracteres',
    INVALID_TYPE: 'Tipo de incidente inválido',
    INVALID_SEVERITY: 'Nivel de severidad inválido',
    INVALID_STATUS: 'Estado de incidente inválido',
    INVALID_DATE_FORMAT: 'La fecha no tiene un formato válido',
    NO_INVOLVED_PERSONS: 'Debe haber al menos una persona involucrada',
    INVALID_COST: 'El costo debe ser mayor o igual a 0',
    CANNOT_EDIT_CLOSED: 'No se puede editar un incidente cerrado',
    CANNOT_DELETE_CLOSED: 'No se puede eliminar un incidente cerrado',
    COMMENTS_REQUIRED: 'Los comentarios son requeridos para rechazar',
    RESOLUTION_REQUIRED: 'La resolución es requerida para cerrar',
    INVALID_FILE_TYPE: 'Tipo de archivo no permitido',
    FILE_TOO_LARGE: 'Archivo demasiado grande'
  },

  // Mensajes de éxito
  SUCCESS_MESSAGES: {
    INCIDENT_CREATED: 'Incidente creado exitosamente',
    INCIDENT_UPDATED: 'Incidente actualizado exitosamente',
    INCIDENT_DELETED: 'Incidente eliminado exitosamente',
    INCIDENT_APPROVED: 'Incidente aprobado exitosamente',
    INCIDENT_REJECTED: 'Incidente rechazado',
    INCIDENT_CLOSED: 'Incidente cerrado exitosamente',
    COST_MARKED_PAID: 'Costo marcado como pagado',
    ATTACHMENT_UPLOADED: 'Archivo subido exitosamente',
    REPORT_GENERATED: 'Reporte generado exitosamente'
  },

  // Validaciones específicas
  VALIDATIONS: {
    REQUIRED_FIELDS: {
      create: ['title', 'description', 'type', 'severity', 'date', 'involvedPersons'],
      approve: ['comments'],
      reject: ['comments'],
      close: ['resolution']
    },
    REQUIRED_ATTACHMENTS: {
      safety: true,        // Requiere evidencia fotográfica
      environmental: true, // Requiere evidencia
      critical: true       // Para severidad crítica
    }
  }
};

// Funciones helper
const getConfig = (section, key = null) => {
  if (key) {
    return INCIDENT_CONFIG[section]?.[key];
  }
  return INCIDENT_CONFIG[section];
};

const isValidIncidentType = (type) => {
  return Object.values(INCIDENT_CONFIG.INCIDENT_TYPES).some(it => it.value === type);
};

const isValidSeverity = (severity) => {
  return Object.values(INCIDENT_CONFIG.SEVERITY_LEVELS).some(sl => sl.value === severity);
};

const isValidStatus = (status) => {
  return Object.values(INCIDENT_CONFIG.INCIDENT_STATUSES).some(is => is.value === status);
};

const getIncidentTypeInfo = (type) => {
  return Object.values(INCIDENT_CONFIG.INCIDENT_TYPES).find(it => it.value === type);
};

const getSeverityInfo = (severity) => {
  return Object.values(INCIDENT_CONFIG.SEVERITY_LEVELS).find(sl => sl.value === severity);
};

const getStatusInfo = (status) => {
  return Object.values(INCIDENT_CONFIG.INCIDENT_STATUSES).find(is => is.value === status);
};

const isValidAttachmentType = (mimeType) => {
  return INCIDENT_CONFIG.ALLOWED_ATTACHMENT_TYPES.includes(mimeType);
};

const getErrorMessage = (key) => {
  return INCIDENT_CONFIG.ERROR_MESSAGES[key] || 'Error desconocido';
};

const getSuccessMessage = (key) => {
  return INCIDENT_CONFIG.SUCCESS_MESSAGES[key] || 'Operación exitosa';
};

const canEditIncident = (status) => {
  const statusInfo = getStatusInfo(status);
  return statusInfo?.canEdit || false;
};

const canDeleteIncident = (status) => {
  const statusInfo = getStatusInfo(status);
  return statusInfo?.canDelete || false;
};

module.exports = {
  INCIDENT_CONFIG,
  getConfig,
  isValidIncidentType,
  isValidSeverity,
  isValidStatus,
  getIncidentTypeInfo,
  getSeverityInfo,
  getStatusInfo,
  isValidAttachmentType,
  getErrorMessage,
  getSuccessMessage,
  canEditIncident,
  canDeleteIncident
};

