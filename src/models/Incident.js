const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo de Incidente
 * Gestiona los incidentes de los empleados
 * Alineado 100% con especificaciones del Frontend
 */
class Incident {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.employeeId = data.employeeId || '';
    this.title = data.title || '';
    this.description = data.description || '';
    this.type = data.type || 'other';
    this.severity = data.severity || 'low';
    this.priority = data.priority || 'medium';
    this.status = data.status || 'open';
    this.date = data.date || new Date().toISOString().split('T')[0];
    this.time = data.time || new Date().toTimeString().split(' ')[0].substring(0, 5);
    this.location = data.location || '';
    this.supervisor = data.supervisor || null;
    this.supervisorName = data.supervisorName || null;
    
    // Campos del frontend
    this.reportedBy = data.reportedBy || '';
    this.reportedByName = data.reportedByName || null;
    this.reportedDate = data.reportedDate || new Date().toISOString();
    this.isConfidential = data.isConfidential || false;
    
    this.involvedPersons = data.involvedPersons || [];
    this.witnesses = data.witnesses || [];
    this.actionsTaken = data.actionsTaken || [];
    this.consequences = data.consequences || [];
    this.preventiveMeasures = data.preventiveMeasures || [];
    
    this.cost = {
      amount: data.cost?.amount || 0,
      currency: data.cost?.currency || 'MXN',
      description: data.cost?.description || '',
      paid: data.cost?.paid || false,
      paidBy: data.cost?.paidBy || null,
      paidDate: data.cost?.paidDate || null,
      receipts: data.cost?.receipts || []
    };
    
    // Campos de reportes (alineados con frontend)
    this.insuranceClaim = data.insuranceClaim || false;
    this.policeReport = data.policeReport || false;
    this.medicalReport = data.medicalReport || false;
    
    this.claims = {
      insurance: {
        filed: data.claims?.insurance?.filed || data.insuranceClaim || false,
        claimNumber: data.claims?.insurance?.claimNumber || null,
        status: data.claims?.insurance?.status || null,
        amount: data.claims?.insurance?.amount || 0
      },
      police: {
        filed: data.claims?.police?.filed || data.policeReport || false,
        reportNumber: data.claims?.police?.reportNumber || null,
        status: data.claims?.police?.status || null
      },
      medical: {
        filed: data.claims?.medical?.filed || data.medicalReport || false,
        reportNumber: data.claims?.medical?.reportNumber || null,
        status: data.claims?.medical?.status || null
      }
    };
    
    this.tags = data.tags || [];
    this.attachments = data.attachments || [];
    
    this.approval = {
      status: data.approval?.status || 'pending',
      approvedBy: data.approval?.approvedBy || null,
      approvedByName: data.approval?.approvedByName || null,
      approvedDate: data.approval?.approvedDate || null,
      comments: data.approval?.comments || null
    };
    
    this.resolution = {
      status: data.resolution?.status || 'open',
      resolvedBy: data.resolution?.resolvedBy || null,
      resolvedDate: data.resolution?.resolvedDate || null,
      resolution: data.resolution?.resolution || null,
      followUpRequired: data.resolution?.followUpRequired || false,
      followUpDate: data.resolution?.followUpDate || null
    };
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Valida los datos del incidente
   */
  validate() {
    const errors = [];

    if (!this.title || this.title.length < 5) {
      errors.push('El título debe tener al menos 5 caracteres');
    }

    if (!this.description || this.description.length < 20) {
      errors.push('La descripción debe tener al menos 20 caracteres');
    }

    const validTypes = ['safety', 'equipment', 'workplace', 'environmental', 'security', 'quality', 'other'];
    if (!validTypes.includes(this.type)) {
      errors.push('El tipo de incidente no es válido');
    }

    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(this.severity)) {
      errors.push('El nivel de severidad no es válido');
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(this.priority)) {
      errors.push('El nivel de prioridad no es válido');
    }

    const validStatuses = ['open', 'investigating', 'resolved', 'closed'];
    if (!validStatuses.includes(this.status)) {
      errors.push('El estado del incidente no es válido');
    }

    if (!this.date) {
      errors.push('La fecha del incidente es requerida');
    }

    // Validar formato de fecha (acepta fechas futuras y pasadas)
    if (this.date) {
      const incidentDate = new Date(this.date);
      if (isNaN(incidentDate.getTime())) {
        errors.push('La fecha del incidente no tiene un formato válido');
      }
    }

    if (!this.involvedPersons || this.involvedPersons.length === 0) {
      errors.push('Debe haber al menos una persona involucrada');
    }

    if (this.cost.amount && this.cost.amount < 0) {
      errors.push('El costo no puede ser negativo');
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
      title: this.title,
      description: this.description,
      type: this.type,
      severity: this.severity,
      priority: this.priority,
      status: this.status,
      date: this.date,
      time: this.time,
      location: this.location,
      supervisor: this.supervisor,
      supervisorName: this.supervisorName,
      reportedBy: this.reportedBy,
      reportedByName: this.reportedByName,
      reportedDate: this.reportedDate,
      isConfidential: this.isConfidential,
      involvedPersons: this.involvedPersons,
      witnesses: this.witnesses,
      actionsTaken: this.actionsTaken,
      consequences: this.consequences,
      preventiveMeasures: this.preventiveMeasures,
      cost: this.cost,
      insuranceClaim: this.insuranceClaim,
      policeReport: this.policeReport,
      medicalReport: this.medicalReport,
      claims: this.claims,
      tags: this.tags,
      attachments: this.attachments,
      approval: this.approval,
      resolution: this.resolution,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crea un incidente desde datos de Firestore
   */
  static fromFirestore(doc) {
    return new Incident({ id: doc.id, ...doc.data() });
  }

  /**
   * Guarda el incidente en Firebase
   */
  async save() {
    try {
      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      this.updatedAt = new Date().toISOString();

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('incidents').doc('incidents')
        .collection('list').doc(this.id);
      
      await docRef.set(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error saving incident:', error);
      throw error;
    }
  }

  /**
   * Actualiza el incidente
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
        .collection('incidents').doc('incidents')
        .collection('list').doc(this.id);
      
      await docRef.update(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error updating incident:', error);
      throw error;
    }
  }

  /**
   * Busca un incidente por ID
   */
  static async findById(employeeId, id) {
    try {
      const doc = await db.collection('employees').doc(employeeId)
        .collection('incidents').doc('incidents')
        .collection('list').doc(id).get();
      
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
   * Lista incidentes de un empleado
   */
  static async listByEmployee(employeeId, options = {}) {
    try {
      const {
        status = null,
        type = null,
        severity = null,
        year = null,
        limit = 100
      } = options;

      let query = db.collection('employees').doc(employeeId)
        .collection('incidents').doc('incidents').collection('list');

      // Filtros
      if (status) {
        query = query.where('status', '==', status);
      }

      if (type) {
        query = query.where('type', '==', type);
      }

      if (severity) {
        query = query.where('severity', '==', severity);
      }

      if (year) {
        const startOfYear = `${year}-01-01`;
        const endOfYear = `${year}-12-31`;
        query = query.where('date', '>=', startOfYear)
                     .where('date', '<=', endOfYear);
      }

      query = query.orderBy('date', 'desc').limit(limit);

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
   * Aprueba el incidente
   */
  async approve(approvedBy, approvedByName, comments = null) {
    try {
      this.approval.status = 'approved';
      this.approval.approvedBy = approvedBy;
      this.approval.approvedByName = approvedByName;
      this.approval.approvedDate = new Date().toISOString();
      if (comments) {
        this.approval.comments = comments;
      }
      
      await this.update({});
      
      return this;
    } catch (error) {
      console.error('Error approving incident:', error);
      throw error;
    }
  }

  /**
   * Rechaza el incidente
   */
  async reject(rejectedBy, rejectedByName, comments) {
    try {
      if (!comments) {
        throw new Error('Los comentarios son requeridos para rechazar un incidente');
      }

      this.approval.status = 'rejected';
      this.approval.approvedBy = rejectedBy;
      this.approval.approvedByName = rejectedByName;
      this.approval.approvedDate = new Date().toISOString();
      this.approval.comments = comments;
      
      await this.update({});
      
      return this;
    } catch (error) {
      console.error('Error rejecting incident:', error);
      throw error;
    }
  }

  /**
   * Cierra el incidente
   */
  async close(resolvedBy, resolution, followUpRequired = false, followUpDate = null) {
    try {
      this.status = 'closed';
      this.resolution.status = 'closed';
      this.resolution.resolvedBy = resolvedBy;
      this.resolution.resolvedDate = new Date().toISOString();
      this.resolution.resolution = resolution;
      this.resolution.followUpRequired = followUpRequired;
      this.resolution.followUpDate = followUpDate;
      
      await this.update({});
      
      return this;
    } catch (error) {
      console.error('Error closing incident:', error);
      throw error;
    }
  }

  /**
   * Marca el costo como pagado
   */
  async markAsPaid(paidBy, receipts = []) {
    try {
      this.cost.paid = true;
      this.cost.paidBy = paidBy;
      this.cost.paidDate = new Date().toISOString();
      if (receipts.length > 0) {
        this.cost.receipts = receipts;
      }
      
      await this.update({});
      
      return this;
    } catch (error) {
      console.error('Error marking incident as paid:', error);
      throw error;
    }
  }

  /**
   * Elimina el incidente
   */
  static async delete(employeeId, id) {
    try {
      const docRef = db.collection('employees').doc(employeeId)
        .collection('incidents').doc('incidents')
        .collection('list').doc(id);
      
      await docRef.delete();
      
      return true;
    } catch (error) {
      console.error('Error deleting incident:', error);
      throw error;
    }
  }
}

module.exports = Incident;
