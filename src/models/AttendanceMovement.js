const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');
const logger = require('../utils/logger');

/**
 * Modelo para movimientos de asistencia (horas extra, préstamos, bonos, deducciones)
 * Relacionados específicamente con reportes de asistencia
 */
class AttendanceMovement {
  constructor(data = {}) {
    this.id = data.id;
    this.reportId = data.reportId;
    this.employeeId = data.employeeId;
    this.type = data.type; // overtime, loan, bonus, deduction, incident, vacation
    this.subtype = data.subtype; // Para tipos específicos (ej: overtime podría ser 'regular' o 'holiday')
    this.description = data.description;
    this.amount = data.amount || 0;
    this.hours = data.hours || 0;
    this.status = data.status || 'pending'; // pending, approved, rejected
    this.createdBy = data.createdBy;
    this.approvedBy = data.approvedBy;
    this.rejectedBy = data.rejectedBy;
    this.approvedAt = data.approvedAt;
    this.rejectedAt = data.rejectedAt;
    this.rejectionReason = data.rejectionReason;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.metadata = data.metadata || {};
  }

  /**
   * Guardar movimiento en Firestore
   */
  async save() {
    try {
      const docRef = db.collection('attendance_movements').doc();
      this.id = docRef.id;
      this.createdAt = new Date().toISOString();
      this.updatedAt = new Date().toISOString();

      await docRef.set({
        ...this,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
      });

      logger.info('AttendanceMovement guardado', {
        id: this.id,
        reportId: this.reportId,
        employeeId: this.employeeId,
        type: this.type,
        amount: this.amount
      });

      return this;
    } catch (error) {
      logger.error('Error guardando AttendanceMovement:', error);
      throw error;
    }
  }

  /**
   * Actualizar movimiento
   */
  async update(updateData) {
    try {
      this.updatedAt = new Date().toISOString();

      await db.collection('attendance_movements').doc(this.id).update({
        ...updateData,
        updatedAt: this.updatedAt
      });

      // Actualizar propiedades locales
      Object.assign(this, updateData);

      logger.info('AttendanceMovement actualizado', {
        id: this.id,
        type: this.type,
        status: this.status
      });

      return this;
    } catch (error) {
      logger.error('Error actualizando AttendanceMovement:', error);
      throw error;
    }
  }

  /**
   * Eliminar movimiento
   */
  async delete() {
    try {
      await db.collection('attendance_movements').doc(this.id).delete();

      logger.info('AttendanceMovement eliminado', {
        id: this.id,
        employeeId: this.employeeId
      });

      return true;
    } catch (error) {
      logger.error('Error eliminando AttendanceMovement:', error);
      throw error;
    }
  }

  /**
   * Buscar movimiento por ID
   */
  static async findById(movementId) {
    try {
      const doc = await db.collection('attendance_movements').doc(movementId).get();

      if (!doc.exists) {
        return null;
      }

      return new AttendanceMovement({
        id: doc.id,
        ...doc.data()
      });
    } catch (error) {
      logger.error('Error buscando movimiento por ID:', error);
      throw error;
    }
  }

  /**
   * Buscar movimientos por reporte
   */
  static async findByReport(reportId) {
    try {
      const snapshot = await db.collection('attendance_movements')
        .where('reportId', '==', reportId)
        .orderBy('createdAt', 'asc')
        .get();

      const movements = [];
      snapshot.forEach(doc => {
        movements.push(new AttendanceMovement({
          id: doc.id,
          ...doc.data()
        }));
      });

      return movements;
    } catch (error) {
      logger.error('Error buscando movimientos por reporte:', error);
      throw error;
    }
  }

  /**
   * Buscar movimientos por empleado
   */
  static async findByEmployee(employeeId, filters = {}) {
    try {
      let query = db.collection('attendance_movements')
        .where('employeeId', '==', employeeId);

      if (filters.type) {
        query = query.where('type', '==', filters.type);
      }

      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }

      if (filters.dateFrom) {
        query = query.where('createdAt', '>=', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.where('createdAt', '<=', filters.dateTo);
      }

      const snapshot = await query.orderBy('createdAt', 'desc').get();
      const movements = [];

      snapshot.forEach(doc => {
        movements.push(new AttendanceMovement({
          id: doc.id,
          ...doc.data()
        }));
      });

      return movements;
    } catch (error) {
      logger.error('Error buscando movimientos por empleado:', error);
      throw error;
    }
  }

  /**
   * Buscar movimientos pendientes por empleados
   */
  static async findPendingByEmployees(employeeIds) {
    try {
      const movements = [];

      for (const employeeId of employeeIds) {
        const employeeMovements = await this.findByEmployee(employeeId, {
          status: 'pending'
        });
        movements.push(...employeeMovements);
      }

      return movements;
    } catch (error) {
      logger.error('Error buscando movimientos pendientes:', error);
      throw error;
    }
  }

  /**
   * Crear múltiples movimientos en lote
   */
  static async createBatch(movements) {
    try {
      const batch = db.batch();
      const createdMovements = [];

      for (const movementData of movements) {
        const docRef = db.collection('attendance_movements').doc();
        const movement = new AttendanceMovement({
          id: docRef.id,
          ...movementData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        batch.set(docRef, movement.toFirestore());
        createdMovements.push(movement);
      }

      await batch.commit();

      logger.info('AttendanceMovements creados en lote', {
        count: createdMovements.length
      });

      return createdMovements;
    } catch (error) {
      logger.error('Error creando movimientos en lote:', error);
      throw error;
    }
  }

  /**
   * Aprobar movimiento
   */
  async approve(approvedBy, comments = '') {
    try {
      await this.update({
        status: 'approved',
        approvedBy,
        approvedAt: new Date().toISOString(),
        approvalComments: comments
      });

      logger.info('AttendanceMovement aprobado', {
        id: this.id,
        employeeId: this.employeeId,
        type: this.type
      });

      return this;
    } catch (error) {
      logger.error('Error aprobando movimiento:', error);
      throw error;
    }
  }

  /**
   * Rechazar movimiento
   */
  async reject(rejectedBy, reason) {
    try {
      await this.update({
        status: 'rejected',
        rejectedBy,
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason
      });

      logger.info('AttendanceMovement rechazado', {
        id: this.id,
        employeeId: this.employeeId,
        type: this.type
      });

      return this;
    } catch (error) {
      logger.error('Error rechazando movimiento:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas por tipo de movimiento
   */
  static async getMovementStats(employeeId, dateFrom, dateTo) {
    try {
      const movements = await this.findByEmployee(employeeId, {
        dateFrom,
        dateTo
      });

      const stats = {
        totalMovements: movements.length,
        byType: {},
        byStatus: {},
        totalAmount: 0,
        totalHours: 0,
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0
      };

      movements.forEach(movement => {
        // Por tipo
        if (!stats.byType[movement.type]) {
          stats.byType[movement.type] = {
            count: 0,
            totalAmount: 0,
            totalHours: 0
          };
        }
        stats.byType[movement.type].count++;
        stats.byType[movement.type].totalAmount += movement.amount || 0;
        stats.byType[movement.type].totalHours += movement.hours || 0;

        // Por estado
        if (!stats.byStatus[movement.status]) {
          stats.byStatus[movement.status] = 0;
        }
        stats.byStatus[movement.status]++;

        // Totales
        stats.totalAmount += movement.amount || 0;
        stats.totalHours += movement.hours || 0;

        if (movement.status === 'pending') stats.pendingCount++;
        if (movement.status === 'approved') stats.approvedCount++;
        if (movement.status === 'rejected') stats.rejectedCount++;
      });

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de movimientos:', error);
      throw error;
    }
  }

  /**
   * Validar datos del movimiento
   */
  validate() {
    const errors = [];

    if (!this.reportId) {
      errors.push('El ID del reporte es requerido');
    }

    if (!this.employeeId) {
      errors.push('El ID del empleado es requerido');
    }

    if (!this.type) {
      errors.push('El tipo de movimiento es requerido');
    }

    const validTypes = ['overtime', 'loan', 'bonus', 'deduction', 'incident', 'vacation'];
    if (!validTypes.includes(this.type)) {
      errors.push('Tipo de movimiento inválido');
    }

    if (!this.description) {
      errors.push('La descripción es requerida');
    }

    if (this.amount < 0) {
      errors.push('El monto no puede ser negativo');
    }

    if (this.hours < 0) {
      errors.push('Las horas no pueden ser negativas');
    }

    if (!['pending', 'approved', 'rejected'].includes(this.status)) {
      errors.push('Estado inválido');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Convertir a formato para Firestore
   */
  toFirestore() {
    return {
      reportId: this.reportId,
      employeeId: this.employeeId,
      type: this.type,
      subtype: this.subtype,
      description: this.description,
      amount: this.amount,
      hours: this.hours,
      status: this.status,
      createdBy: this.createdBy,
      approvedBy: this.approvedBy,
      rejectedBy: this.rejectedBy,
      approvedAt: this.approvedAt,
      rejectedAt: this.rejectedAt,
      rejectionReason: this.rejectionReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata: this.metadata
    };
  }

  /**
   * Obtener información del empleado asociado
   */
  async getEmployee() {
    try {
      const Employee = require('./Employee');
      return await Employee.findById(this.employeeId);
    } catch (error) {
      logger.error('Error obteniendo empleado:', error);
      return null;
    }
  }

  /**
   * Obtener información del reporte asociado
   */
  async getReport() {
    try {
      const AttendanceReport = require('./AttendanceReport');
      return await AttendanceReport.findById(this.reportId);
    } catch (error) {
      logger.error('Error obteniendo reporte:', error);
      return null;
    }
  }
}

module.exports = AttendanceMovement;
