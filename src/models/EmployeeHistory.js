const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo de Historial de Empleado
 * Registra todos los cambios y eventos relacionados con un empleado
 */
class EmployeeHistory {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.employeeId = data.employeeId || '';
    this.type = data.type || 'other'; // Tipo de evento
    this.description = data.description || '';
    this.changedBy = data.changedBy || null;
    this.changedAt = data.changedAt || new Date().toISOString();
    this.details = data.details || {};
    this.module = data.module || 'employees';
    this.action = data.action || 'update';
    this.oldValue = data.oldValue || null;
    this.newValue = data.newValue || null;
    this.ipAddress = data.ipAddress || null;
    this.userAgent = data.userAgent || null;
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  /**
   * Obtiene los tipos de eventos disponibles
   */
  static getEventTypes() {
    return {
      personal_info_update: {
        name: 'Actualización de Información Personal',
        description: 'Cambios en datos personales del empleado',
        icon: 'user',
        color: 'blue',
        category: 'personal'
      },
      position_change: {
        name: 'Cambio de Puesto',
        description: 'Cambios en posición, departamento o nivel',
        icon: 'briefcase',
        color: 'purple',
        category: 'job'
      },
      salary_change: {
        name: 'Cambio Salarial',
        description: 'Modificaciones en salario o beneficios',
        icon: 'dollar',
        color: 'green',
        category: 'compensation'
      },
      evaluation_completed: {
        name: 'Evaluación Completada',
        description: 'Finalización de evaluación de desempeño',
        icon: 'star',
        color: 'yellow',
        category: 'performance'
      },
      incident_reported: {
        name: 'Incidencia Reportada',
        description: 'Registro de nueva incidencia',
        icon: 'alert',
        color: 'red',
        category: 'incident'
      },
      vacation_approved: {
        name: 'Vacaciones Aprobadas',
        description: 'Aprobación de solicitud de vacaciones',
        icon: 'calendar',
        color: 'blue',
        category: 'time_off'
      },
      skill_added: {
        name: 'Habilidad Agregada',
        description: 'Nueva habilidad registrada',
        icon: 'award',
        color: 'orange',
        category: 'skills'
      },
      certification_obtained: {
        name: 'Certificación Obtenida',
        description: 'Nueva certificación profesional',
        icon: 'certificate',
        color: 'green',
        category: 'skills'
      },
      document_uploaded: {
        name: 'Documento Subido',
        description: 'Nuevo documento agregado al expediente',
        icon: 'file',
        color: 'gray',
        category: 'documents'
      },
      contract_update: {
        name: 'Actualización de Contrato',
        description: 'Cambios en términos contractuales',
        icon: 'contract',
        color: 'purple',
        category: 'legal'
      },
      attendance_adjustment: {
        name: 'Ajuste de Asistencia',
        description: 'Modificación en registros de asistencia',
        icon: 'clock',
        color: 'blue',
        category: 'attendance'
      },
      status_change: {
        name: 'Cambio de Estado',
        description: 'Cambio en el estado del empleado',
        icon: 'toggle',
        color: 'gray',
        category: 'status'
      },
      disciplinary_action: {
        name: 'Acción Disciplinaria',
        description: 'Medida disciplinaria aplicada',
        icon: 'gavel',
        color: 'red',
        category: 'disciplinary'
      },
      promotion: {
        name: 'Promoción',
        description: 'Ascenso o promoción del empleado',
        icon: 'trending-up',
        color: 'green',
        category: 'career'
      },
      training_completed: {
        name: 'Capacitación Completada',
        description: 'Finalización de programa de capacitación',
        icon: 'book',
        color: 'blue',
        category: 'training'
      },
      other: {
        name: 'Otros',
        description: 'Otros eventos no categorizados',
        icon: 'info',
        color: 'gray',
        category: 'general'
      }
    };
  }

  /**
   * Obtiene las acciones disponibles
   */
  static getActions() {
    return {
      create: 'Crear',
      read: 'Consultar',
      update: 'Actualizar',
      delete: 'Eliminar',
      approve: 'Aprobar',
      reject: 'Rechazar',
      upload: 'Subir',
      download: 'Descargar',
      export: 'Exportar',
      import: 'Importar'
    };
  }

  /**
   * Crea un registro de historial automáticamente
   */
  static async createHistoryRecord(employeeId, type, description, details = {}, changedBy = null, request = null) {
    try {
      const historyData = {
        employeeId,
        type,
        description,
        details,
        changedBy,
        changedAt: new Date().toISOString()
      };

      // Extraer información de la request si está disponible
      if (request) {
        historyData.ipAddress = request.ip || request.connection?.remoteAddress;
        historyData.userAgent = request.get('User-Agent');
      }

      const history = new EmployeeHistory(historyData);
      await history.save();

      return history;
    } catch (error) {
      console.error('Error creating history record:', error);
      // No lanzar error para no interrumpir el flujo principal
      return null;
    }
  }

  /**
   * Valida los datos del historial
   */
  validate() {
    const errors = [];

    if (!this.employeeId) {
      errors.push('El ID del empleado es requerido');
    }

    if (!this.description) {
      errors.push('La descripción es requerida');
    }

    const validTypes = Object.keys(EmployeeHistory.getEventTypes());
    if (!validTypes.includes(this.type)) {
      errors.push('El tipo de evento no es válido');
    }

    const validActions = Object.keys(EmployeeHistory.getActions());
    if (this.action && !validActions.includes(this.action)) {
      errors.push('La acción no es válida');
    }

    return errors;
  }

  /**
   * Convierte el modelo a objeto plano para Firebase
   */
  toFirestore() {
    return {
      id: this.id,
      employeeId: this.employeeId,
      type: this.type,
      description: this.description,
      changedBy: this.changedBy,
      changedAt: this.changedAt,
      details: this.details,
      module: this.module,
      action: this.action,
      oldValue: this.oldValue,
      newValue: this.newValue,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      createdAt: this.createdAt
    };
  }

  /**
   * Crea un historial desde datos de Firestore
   */
  static fromFirestore(doc) {
    return new EmployeeHistory({ id: doc.id, ...doc.data() });
  }

  /**
   * Guarda el registro en Firebase
   */
  async save() {
    try {
      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('history').doc(this.id);
      
      await docRef.set(this.toFirestore());

      // También guardar en colección global de auditoría
      const auditRef = db.collection('audit_logs').doc(this.id);
      await auditRef.set({
        ...this.toFirestore(),
        entityType: 'employee',
        entityId: this.employeeId
      });

      return this;
    } catch (error) {
      console.error('Error saving history record:', error);
      throw error;
    }
  }

  /**
   * Busca un registro por ID
   */
  static async findById(employeeId, id) {
    try {
      const doc = await db.collection('employees').doc(employeeId)
        .collection('history').doc(id).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return EmployeeHistory.fromFirestore(doc);
    } catch (error) {
      console.error('Error finding history record by ID:', error);
      throw error;
    }
  }

  /**
   * Lista historial de un empleado
   */
  static async listByEmployee(employeeId, options = {}) {
    try {
      const {
        type = null,
        module = null,
        dateFrom = null,
        dateTo = null,
        changedBy = null,
        page = 1,
        limit = 50
      } = options;

      let query = db.collection('employees').doc(employeeId)
        .collection('history');

      // Filtros
      if (type) {
        query = query.where('type', '==', type);
      }

      if (module) {
        query = query.where('module', '==', module);
      }

      if (changedBy) {
        query = query.where('changedBy', '==', changedBy);
      }

      if (dateFrom) {
        query = query.where('changedAt', '>=', dateFrom);
      }

      if (dateTo) {
        query = query.where('changedAt', '<=', dateTo);
      }

      // Ordenamiento
      query = query.orderBy('changedAt', 'desc');

      // Paginación
      const offset = (page - 1) * limit;
      if (offset > 0) {
        const offsetSnapshot = await query.limit(offset).get();
        if (!offsetSnapshot.empty) {
          const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
          query = query.startAfter(lastDoc);
        }
      }

      query = query.limit(limit);

      const snapshot = await query.get();
      const history = [];

      snapshot.forEach(doc => {
        history.push(EmployeeHistory.fromFirestore(doc));
      });

      return history;
    } catch (error) {
      console.error('Error listing history records:', error);
      throw error;
    }
  }

  /**
   * Obtiene resumen de actividad de un empleado
   */
  static async getActivitySummary(employeeId, days = 30) {
    try {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);
      const dateFromStr = dateFrom.toISOString();

      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('history')
        .where('changedAt', '>=', dateFromStr)
        .get();

      const summary = {
        totalEvents: 0,
        recentEvents: 0,
        byType: {},
        byModule: {},
        byDay: {},
        mostActiveUsers: {},
        lastActivity: null
      };

      let lastActivityDate = null;

      snapshot.forEach(doc => {
        const record = doc.data();
        
        summary.totalEvents++;
        summary.recentEvents++;
        
        // Por tipo
        summary.byType[record.type] = (summary.byType[record.type] || 0) + 1;
        
        // Por módulo
        summary.byModule[record.module] = (summary.byModule[record.module] || 0) + 1;
        
        // Por día
        const day = record.changedAt.split('T')[0];
        summary.byDay[day] = (summary.byDay[day] || 0) + 1;
        
        // Usuarios más activos
        if (record.changedBy) {
          summary.mostActiveUsers[record.changedBy] = (summary.mostActiveUsers[record.changedBy] || 0) + 1;
        }
        
        // Última actividad
        if (!lastActivityDate || record.changedAt > lastActivityDate) {
          lastActivityDate = record.changedAt;
          summary.lastActivity = record;
        }
      });

      return summary;
    } catch (error) {
      console.error('Error getting activity summary:', error);
      throw error;
    }
  }

  /**
   * Obtiene historial global de cambios (para administradores)
   */
  static async getGlobalHistory(options = {}) {
    try {
      const {
        type = null,
        module = null,
        dateFrom = null,
        dateTo = null,
        employeeId = null,
        changedBy = null,
        page = 1,
        limit = 100
      } = options;

      let query = db.collection('audit_logs');

      // Filtros
      if (type) {
        query = query.where('type', '==', type);
      }

      if (module) {
        query = query.where('module', '==', module);
      }

      if (employeeId) {
        query = query.where('employeeId', '==', employeeId);
      }

      if (changedBy) {
        query = query.where('changedBy', '==', changedBy);
      }

      if (dateFrom) {
        query = query.where('changedAt', '>=', dateFrom);
      }

      if (dateTo) {
        query = query.where('changedAt', '<=', dateTo);
      }

      // Ordenamiento
      query = query.orderBy('changedAt', 'desc');

      // Paginación
      const offset = (page - 1) * limit;
      if (offset > 0) {
        const offsetSnapshot = await query.limit(offset).get();
        if (!offsetSnapshot.empty) {
          const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
          query = query.startAfter(lastDoc);
        }
      }

      query = query.limit(limit);

      const snapshot = await query.get();
      const history = [];

      snapshot.forEach(doc => {
        history.push(EmployeeHistory.fromFirestore(doc));
      });

      return history;
    } catch (error) {
      console.error('Error getting global history:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de auditoría
   */
  static async getAuditStats(dateFrom = null, dateTo = null) {
    try {
      let query = db.collection('audit_logs');

      if (dateFrom) {
        query = query.where('changedAt', '>=', dateFrom);
      }

      if (dateTo) {
        query = query.where('changedAt', '<=', dateTo);
      }

      const snapshot = await query.get();

      const stats = {
        totalEvents: 0,
        byType: {},
        byModule: {},
        byUser: {},
        byDay: {},
        mostActiveEmployees: {},
        recentActivity: []
      };

      const events = [];

      snapshot.forEach(doc => {
        const record = doc.data();
        
        stats.totalEvents++;
        
        // Por tipo
        stats.byType[record.type] = (stats.byType[record.type] || 0) + 1;
        
        // Por módulo
        stats.byModule[record.module] = (stats.byModule[record.module] || 0) + 1;
        
        // Por usuario
        if (record.changedBy) {
          stats.byUser[record.changedBy] = (stats.byUser[record.changedBy] || 0) + 1;
        }
        
        // Por día
        const day = record.changedAt.split('T')[0];
        stats.byDay[day] = (stats.byDay[day] || 0) + 1;
        
        // Empleados más activos (con más cambios)
        if (record.employeeId) {
          stats.mostActiveEmployees[record.employeeId] = (stats.mostActiveEmployees[record.employeeId] || 0) + 1;
        }
        
        events.push(record);
      });

      // Actividad reciente (últimos 10 eventos)
      stats.recentActivity = events
        .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))
        .slice(0, 10);

      return stats;
    } catch (error) {
      console.error('Error getting audit stats:', error);
      throw error;
    }
  }

  /**
   * Busca cambios específicos en un campo
   */
  static async findFieldChanges(employeeId, fieldPath) {
    try {
      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('history')
        .where('details.fieldPath', '==', fieldPath)
        .orderBy('changedAt', 'desc')
        .limit(20)
        .get();

      const changes = [];
      snapshot.forEach(doc => {
        changes.push(EmployeeHistory.fromFirestore(doc));
      });

      return changes;
    } catch (error) {
      console.error('Error finding field changes:', error);
      throw error;
    }
  }

  /**
   * Obtiene timeline de eventos de un empleado
   */
  static async getTimeline(employeeId, limit = 50) {
    try {
      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('history')
        .orderBy('changedAt', 'desc')
        .limit(limit)
        .get();

      const timeline = [];
      snapshot.forEach(doc => {
        const record = EmployeeHistory.fromFirestore(doc);
        const eventType = EmployeeHistory.getEventTypes()[record.type];
        
        timeline.push({
          ...record.toFirestore(),
          eventType,
          formattedDate: new Date(record.changedAt).toLocaleDateString(),
          relativeTime: EmployeeHistory.getRelativeTime(record.changedAt)
        });
      });

      return timeline;
    } catch (error) {
      console.error('Error getting employee timeline:', error);
      throw error;
    }
  }

  /**
   * Calcula tiempo relativo (hace X días)
   */
  static getRelativeTime(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));

    if (diffDays > 0) {
      return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    } else if (diffMinutes > 0) {
      return `hace ${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`;
    } else {
      return 'hace un momento';
    }
  }

  /**
   * Formatea los detalles para mostrar en UI
   */
  getFormattedDetails() {
    const eventType = EmployeeHistory.getEventTypes()[this.type];
    
    let formatted = {
      type: eventType?.name || this.type,
      description: this.description,
      category: eventType?.category || 'general',
      icon: eventType?.icon || 'info',
      color: eventType?.color || 'gray'
    };

    // Formatear detalles específicos según el tipo
    if (this.oldValue && this.newValue) {
      formatted.change = {
        from: this.oldValue,
        to: this.newValue
      };
    }

    if (this.details && Object.keys(this.details).length > 0) {
      formatted.details = this.details;
    }

    return formatted;
  }
}

module.exports = EmployeeHistory;
