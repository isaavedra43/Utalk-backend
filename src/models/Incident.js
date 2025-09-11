const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo de Incidencia
 * Gestiona incidencias y eventos relacionados con empleados
 */
class Incident {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.employeeId = data.employeeId || '';
    this.type = data.type || 'other'; // 'administrative' | 'theft' | 'accident' | 'injury' | 'disciplinary' | 'other'
    this.severity = data.severity || 'low'; // 'low' | 'medium' | 'high' | 'critical'
    this.title = data.title || '';
    this.description = data.description || '';
    this.date = data.date || new Date().toISOString().split('T')[0];
    this.location = data.location || '';
    this.witnesses = data.witnesses || [];
    this.reportedBy = data.reportedBy || null;
    this.reportedAt = data.reportedAt || new Date().toISOString();
    
    // Seguimiento
    this.status = data.status || 'reported'; // 'reported' | 'investigating' | 'resolved' | 'closed'
    this.assignedTo = data.assignedTo || null;
    this.investigationNotes = data.investigationNotes || null;
    this.resolution = data.resolution || null;
    this.resolvedBy = data.resolvedBy || null;
    this.resolvedAt = data.resolvedAt || null;
    
    // Archivos adjuntos
    this.attachments = data.attachments || [];
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Obtiene los tipos de incidencias disponibles
   */
  static getIncidentTypes() {
    return {
      administrative: {
        name: 'Administrativa',
        description: 'Problemas administrativos o de procedimientos',
        icon: 'admin',
        color: 'blue'
      },
      theft: {
        name: 'Robo',
        description: 'Robo o pérdida de bienes',
        icon: 'security',
        color: 'red'
      },
      accident: {
        name: 'Accidente',
        description: 'Accidentes en el lugar de trabajo',
        icon: 'warning',
        color: 'orange'
      },
      injury: {
        name: 'Lesión',
        description: 'Lesiones o problemas de salud',
        icon: 'medical',
        color: 'red'
      },
      disciplinary: {
        name: 'Disciplinaria',
        description: 'Problemas de conducta o disciplina',
        icon: 'gavel',
        color: 'purple'
      },
      other: {
        name: 'Otros',
        description: 'Otros tipos de incidencias',
        icon: 'info',
        color: 'gray'
      }
    };
  }

  /**
   * Obtiene los niveles de severidad
   */
  static getSeverityLevels() {
    return {
      low: {
        name: 'Baja',
        description: 'Incidencia menor sin impacto significativo',
        color: 'green',
        priority: 1
      },
      medium: {
        name: 'Media',
        description: 'Incidencia moderada con impacto limitado',
        color: 'yellow',
        priority: 2
      },
      high: {
        name: 'Alta',
        description: 'Incidencia importante con impacto significativo',
        color: 'orange',
        priority: 3
      },
      critical: {
        name: 'Crítica',
        description: 'Incidencia crítica que requiere atención inmediata',
        color: 'red',
        priority: 4
      }
    };
  }

  /**
   * Calcula la prioridad automáticamente
   */
  calculatePriority() {
    const severityLevels = Incident.getSeverityLevels();
    const incidentTypes = Incident.getIncidentTypes();
    
    let priority = severityLevels[this.severity]?.priority || 1;
    
    // Aumentar prioridad para ciertos tipos
    if (['injury', 'accident', 'theft'].includes(this.type)) {
      priority += 1;
    }
    
    return Math.min(priority, 4); // Máximo 4
  }

  /**
   * Valida los datos de la incidencia
   */
  validate() {
    const errors = [];

    if (!this.employeeId) {
      errors.push('El ID del empleado es requerido');
    }

    if (!this.title || this.title.length < 5) {
      errors.push('El título es requerido y debe tener al menos 5 caracteres');
    }

    if (!this.description || this.description.length < 10) {
      errors.push('La descripción es requerida y debe tener al menos 10 caracteres');
    }

    const validTypes = Object.keys(Incident.getIncidentTypes());
    if (!validTypes.includes(this.type)) {
      errors.push('El tipo de incidencia no es válido');
    }

    const validSeverities = Object.keys(Incident.getSeverityLevels());
    if (!validSeverities.includes(this.severity)) {
      errors.push('El nivel de severidad no es válido');
    }

    const validStatuses = ['reported', 'investigating', 'resolved', 'closed'];
    if (!validStatuses.includes(this.status)) {
      errors.push('El estado de la incidencia no es válido');
    }

    if (!this.date) {
      errors.push('La fecha de la incidencia es requerida');
    }

    if (!this.location) {
      errors.push('La ubicación es requerida');
    }

    if (!this.reportedBy) {
      errors.push('El reportador es requerido');
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
      severity: this.severity,
      title: this.title,
      description: this.description,
      date: this.date,
      location: this.location,
      witnesses: this.witnesses,
      reportedBy: this.reportedBy,
      reportedAt: this.reportedAt,
      status: this.status,
      assignedTo: this.assignedTo,
      investigationNotes: this.investigationNotes,
      resolution: this.resolution,
      resolvedBy: this.resolvedBy,
      resolvedAt: this.resolvedAt,
      attachments: this.attachments,
      priority: this.calculatePriority(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crea una incidencia desde datos de Firestore
   */
  static fromFirestore(doc) {
    return new Incident({ id: doc.id, ...doc.data() });
  }

  /**
   * Guarda la incidencia en Firebase
   */
  async save() {
    try {
      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      this.updatedAt = new Date().toISOString();

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('incidents').doc(this.id);
      
      await docRef.set(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error saving incident:', error);
      throw error;
    }
  }

  /**
   * Actualiza la incidencia
   */
  async update(data) {
    try {
      Object.assign(this, data);
      this.updatedAt = new Date().toISOString();

      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('incidents').doc(this.id);
      
      await docRef.update(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error updating incident:', error);
      throw error;
    }
  }

  /**
   * Asigna la incidencia a un investigador
   */
  async assign(assignedTo) {
    try {
      this.assignedTo = assignedTo;
      this.status = 'investigating';
      
      await this.update({});
      return this;
    } catch (error) {
      console.error('Error assigning incident:', error);
      throw error;
    }
  }

  /**
   * Resuelve la incidencia
   */
  async resolve(resolution, resolvedBy) {
    try {
      this.status = 'resolved';
      this.resolution = resolution;
      this.resolvedBy = resolvedBy;
      this.resolvedAt = new Date().toISOString();
      
      await this.update({});
      return this;
    } catch (error) {
      console.error('Error resolving incident:', error);
      throw error;
    }
  }

  /**
   * Cierra la incidencia
   */
  async close() {
    try {
      if (this.status !== 'resolved') {
        throw new Error('Solo se pueden cerrar incidencias resueltas');
      }
      
      this.status = 'closed';
      await this.update({});
      return this;
    } catch (error) {
      console.error('Error closing incident:', error);
      throw error;
    }
  }

  /**
   * Busca una incidencia por ID
   */
  static async findById(employeeId, id) {
    try {
      const doc = await db.collection('employees').doc(employeeId)
        .collection('incidents').doc(id).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return Incident.fromFirestore(doc);
    } catch (error) {
      console.error('Error finding incident by ID:', error);
      throw error;
    }
  }

  /**
   * Lista incidencias de un empleado
   */
  static async listByEmployee(employeeId, options = {}) {
    try {
      const {
        type = null,
        severity = null,
        status = null,
        dateFrom = null,
        dateTo = null,
        page = 1,
        limit = 20
      } = options;

      let query = db.collection('employees').doc(employeeId)
        .collection('incidents');

      // Filtros
      if (type) {
        query = query.where('type', '==', type);
      }

      if (severity) {
        query = query.where('severity', '==', severity);
      }

      if (status) {
        query = query.where('status', '==', status);
      }

      if (dateFrom) {
        query = query.where('date', '>=', dateFrom);
      }

      if (dateTo) {
        query = query.where('date', '<=', dateTo);
      }

      // Ordenamiento
      query = query.orderBy('date', 'desc').orderBy('priority', 'desc');

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
      const incidents = [];

      snapshot.forEach(doc => {
        incidents.push(Incident.fromFirestore(doc));
      });

      return incidents;
    } catch (error) {
      console.error('Error listing incidents:', error);
      throw error;
    }
  }

  /**
   * Obtiene resumen de incidencias de un empleado
   */
  static async getSummaryByEmployee(employeeId) {
    try {
      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('incidents').get();

      const summary = {
        total: 0,
        open: 0,
        closed: 0,
        critical: 0,
        byType: {},
        bySeverity: {},
        byStatus: {},
        recentIncidents: 0
      };

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      snapshot.forEach(doc => {
        const incident = doc.data();
        
        summary.total++;
        
        // Contar por estado
        if (['reported', 'investigating'].includes(incident.status)) {
          summary.open++;
        } else {
          summary.closed++;
        }
        
        // Contar críticas
        if (incident.severity === 'critical') {
          summary.critical++;
        }
        
        // Contar por tipo
        summary.byType[incident.type] = (summary.byType[incident.type] || 0) + 1;
        
        // Contar por severidad
        summary.bySeverity[incident.severity] = (summary.bySeverity[incident.severity] || 0) + 1;
        
        // Contar por estado
        summary.byStatus[incident.status] = (summary.byStatus[incident.status] || 0) + 1;
        
        // Contar incidencias recientes
        if (incident.date >= thirtyDaysAgoStr) {
          summary.recentIncidents++;
        }
      });

      return summary;
    } catch (error) {
      console.error('Error getting incidents summary:', error);
      throw error;
    }
  }

  /**
   * Obtiene incidencias críticas abiertas
   */
  static async getCriticalOpenIncidents(department = null) {
    try {
      // Primero obtener empleados del departamento si se especifica
      let employeeIds = [];
      
      if (department) {
        const employeesSnapshot = await db.collection('employees')
          .where('position.department', '==', department)
          .where('status', '==', 'active')
          .get();
        
        employeeIds = employeesSnapshot.docs.map(doc => doc.id);
      } else {
        const employeesSnapshot = await db.collection('employees')
          .where('status', '==', 'active')
          .get();
        
        employeeIds = employeesSnapshot.docs.map(doc => doc.id);
      }

      const criticalIncidents = [];

      // Buscar incidencias críticas para cada empleado
      for (const employeeId of employeeIds) {
        const snapshot = await db.collection('employees').doc(employeeId)
          .collection('incidents')
          .where('severity', '==', 'critical')
          .where('status', 'in', ['reported', 'investigating'])
          .orderBy('date', 'desc')
          .get();

        snapshot.forEach(doc => {
          criticalIncidents.push({
            ...Incident.fromFirestore(doc),
            employeeId
          });
        });
      }

      return criticalIncidents.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (error) {
      console.error('Error getting critical incidents:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas generales de incidencias
   */
  static async getGeneralStats(department = null, dateFrom = null, dateTo = null) {
    try {
      // Obtener empleados del departamento
      let employeesQuery = db.collection('employees').where('status', '==', 'active');
      
      if (department) {
        employeesQuery = employeesQuery.where('position.department', '==', department);
      }

      const employeesSnapshot = await employeesQuery.get();
      const employeeIds = employeesSnapshot.docs.map(doc => doc.id);

      const stats = {
        totalIncidents: 0,
        openIncidents: 0,
        resolvedIncidents: 0,
        criticalIncidents: 0,
        byType: {},
        bySeverity: {},
        byMonth: {},
        avgResolutionTime: 0,
        employeesWithIncidents: 0
      };

      let totalResolutionTime = 0;
      let resolvedCount = 0;
      const employeesWithIncidents = new Set();

      // Procesar incidencias de cada empleado
      for (const employeeId of employeeIds) {
        let incidentQuery = db.collection('employees').doc(employeeId)
          .collection('incidents');

        if (dateFrom) {
          incidentQuery = incidentQuery.where('date', '>=', dateFrom);
        }

        if (dateTo) {
          incidentQuery = incidentQuery.where('date', '<=', dateTo);
        }

        const incidentSnapshot = await incidentQuery.get();

        incidentSnapshot.forEach(doc => {
          const incident = doc.data();
          
          stats.totalIncidents++;
          employeesWithIncidents.add(employeeId);
          
          // Por estado
          if (['reported', 'investigating'].includes(incident.status)) {
            stats.openIncidents++;
          } else {
            stats.resolvedIncidents++;
          }
          
          // Críticas
          if (incident.severity === 'critical') {
            stats.criticalIncidents++;
          }
          
          // Por tipo
          stats.byType[incident.type] = (stats.byType[incident.type] || 0) + 1;
          
          // Por severidad
          stats.bySeverity[incident.severity] = (stats.bySeverity[incident.severity] || 0) + 1;
          
          // Por mes
          const month = incident.date.substring(0, 7); // YYYY-MM
          stats.byMonth[month] = (stats.byMonth[month] || 0) + 1;
          
          // Tiempo de resolución
          if (incident.resolvedAt && incident.reportedAt) {
            const resolutionTime = new Date(incident.resolvedAt) - new Date(incident.reportedAt);
            totalResolutionTime += resolutionTime;
            resolvedCount++;
          }
        });
      }

      stats.employeesWithIncidents = employeesWithIncidents.size;
      
      // Tiempo promedio de resolución en días
      if (resolvedCount > 0) {
        stats.avgResolutionTime = Math.round((totalResolutionTime / resolvedCount) / (1000 * 60 * 60 * 24));
      }

      return stats;
    } catch (error) {
      console.error('Error getting general incident stats:', error);
      throw error;
    }
  }

  /**
   * Agrega un archivo adjunto
   */
  async addAttachment(fileUrl) {
    try {
      if (!this.attachments.includes(fileUrl)) {
        this.attachments.push(fileUrl);
        await this.update({});
      }
      return this;
    } catch (error) {
      console.error('Error adding attachment:', error);
      throw error;
    }
  }

  /**
   * Elimina un archivo adjunto
   */
  async removeAttachment(fileUrl) {
    try {
      this.attachments = this.attachments.filter(url => url !== fileUrl);
      await this.update({});
      return this;
    } catch (error) {
      console.error('Error removing attachment:', error);
      throw error;
    }
  }

  /**
   * Verifica si la incidencia está vencida (más de X días sin resolver)
   */
  isOverdue(maxDays = 7) {
    if (this.status === 'resolved' || this.status === 'closed') {
      return false;
    }
    
    const reportedDate = new Date(this.reportedAt);
    const now = new Date();
    const daysDiff = (now - reportedDate) / (1000 * 60 * 60 * 24);
    
    return daysDiff > maxDays;
  }
}

module.exports = Incident;
