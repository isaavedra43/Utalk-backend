const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo de Datos de Incidentes del Empleado
 * Documento principal: employees/{employeeId}/incidents/incidentData
 * Alineado 100% con especificaciones del Frontend
 */
class IncidentData {
  constructor(data = {}) {
    this.employeeId = data.employeeId || '';
    this.employeeName = data.employeeName || '';
    this.position = data.position || '';
    this.department = data.department || '';
    
    // Resumen estadístico
    this.summary = {
      totalIncidents: data.summary?.totalIncidents || 0,
      openIncidents: data.summary?.openIncidents || 0,
      closedIncidents: data.summary?.closedIncidents || 0,
      pendingApproval: data.summary?.pendingApproval || 0,
      approvedIncidents: data.summary?.approvedIncidents || 0,
      rejectedIncidents: data.summary?.rejectedIncidents || 0,
      totalCost: data.summary?.totalCost || 0.00,
      paidCost: data.summary?.paidCost || 0.00,
      pendingCost: data.summary?.pendingCost || 0.00,
      byType: data.summary?.byType || {
        safety: 0,
        equipment: 0,
        workplace: 0,
        environmental: 0,
        security: 0,
        quality: 0,
        other: 0
      },
      bySeverity: data.summary?.bySeverity || {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      byStatus: data.summary?.byStatus || {
        open: 0,
        investigating: 0,
        resolved: 0,
        closed: 0
      }
    };
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Actualiza estadísticas desde incidentes
   */
  async updateStatistics() {
    try {
      const incidentsRef = db.collection('employees').doc(this.employeeId)
        .collection('incidents').doc('incidents').collection('list');
      
      const snapshot = await incidentsRef.get();
      
      // Reiniciar contadores
      this.summary.totalIncidents = 0;
      this.summary.openIncidents = 0;
      this.summary.closedIncidents = 0;
      this.summary.pendingApproval = 0;
      this.summary.approvedIncidents = 0;
      this.summary.rejectedIncidents = 0;
      this.summary.totalCost = 0.00;
      this.summary.paidCost = 0.00;
      this.summary.pendingCost = 0.00;
      
      // Reiniciar contadores por categoría
      Object.keys(this.summary.byType).forEach(type => {
        this.summary.byType[type] = 0;
      });
      Object.keys(this.summary.bySeverity).forEach(severity => {
        this.summary.bySeverity[severity] = 0;
      });
      Object.keys(this.summary.byStatus).forEach(status => {
        this.summary.byStatus[status] = 0;
      });
      
      snapshot.forEach(doc => {
        const incident = doc.data();
        this.summary.totalIncidents++;
        
        // Contadores por estado
        if (incident.status === 'closed') {
          this.summary.closedIncidents++;
        } else {
          this.summary.openIncidents++;
        }
        
        // Contadores por aprobación
        if (incident.approval?.status === 'pending') {
          this.summary.pendingApproval++;
        } else if (incident.approval?.status === 'approved') {
          this.summary.approvedIncidents++;
        } else if (incident.approval?.status === 'rejected') {
          this.summary.rejectedIncidents++;
        }
        
        // Contadores por tipo
        if (incident.type && this.summary.byType.hasOwnProperty(incident.type)) {
          this.summary.byType[incident.type]++;
        }
        
        // Contadores por severidad
        if (incident.severity && this.summary.bySeverity.hasOwnProperty(incident.severity)) {
          this.summary.bySeverity[incident.severity]++;
        }
        
        // Contadores por estado
        if (incident.status && this.summary.byStatus.hasOwnProperty(incident.status)) {
          this.summary.byStatus[incident.status]++;
        }
        
        // Costos
        if (incident.cost && incident.cost.amount) {
          this.summary.totalCost += parseFloat(incident.cost.amount) || 0;
          
          if (incident.cost.paid) {
            this.summary.paidCost += parseFloat(incident.cost.amount) || 0;
          } else {
            this.summary.pendingCost += parseFloat(incident.cost.amount) || 0;
          }
        }
      });
      
      // Redondear costos a 2 decimales
      this.summary.totalCost = parseFloat(this.summary.totalCost.toFixed(2));
      this.summary.paidCost = parseFloat(this.summary.paidCost.toFixed(2));
      this.summary.pendingCost = parseFloat(this.summary.pendingCost.toFixed(2));
      
    } catch (error) {
      console.error('Error updating incident statistics:', error);
      throw error;
    }
  }

  /**
   * Convierte a objeto Firestore
   */
  toFirestore() {
    return {
      employeeId: this.employeeId,
      employeeName: this.employeeName,
      position: this.position,
      department: this.department,
      summary: this.summary,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crea desde Firestore
   */
  static fromFirestore(doc) {
    if (!doc.exists) return null;
    return new IncidentData({ ...doc.data() });
  }

  /**
   * Guarda en Firebase
   */
  async save() {
    try {
      this.updatedAt = new Date().toISOString();
      
      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('incidents').doc('incidentData');
      
      await docRef.set(this.toFirestore());
      
      return this;
    } catch (error) {
      console.error('Error saving incident data:', error);
      throw error;
    }
  }

  /**
   * Busca por empleado
   */
  static async findByEmployee(employeeId) {
    try {
      const docRef = db.collection('employees').doc(employeeId)
        .collection('incidents').doc('incidentData');
      
      const doc = await docRef.get();
      
      return IncidentData.fromFirestore(doc);
    } catch (error) {
      console.error('Error finding incident data:', error);
      throw error;
    }
  }

  /**
   * Obtiene o crea datos de incidentes para un empleado
   */
  static async getOrCreate(employeeId, employeeData) {
    try {
      let incidentData = await IncidentData.findByEmployee(employeeId);
      
      if (!incidentData) {
        incidentData = new IncidentData({
          employeeId,
          employeeName: `${employeeData.firstName} ${employeeData.lastName}`,
          position: employeeData.position || '',
          department: employeeData.department || ''
        });
        
        await incidentData.save();
      }
      
      return incidentData;
    } catch (error) {
      console.error('Error getting or creating incident data:', error);
      throw error;
    }
  }
}

module.exports = IncidentData;

