const { Firestore } = require('@google-cloud/firestore');
const db = new Firestore();
const logger = require('../utils/logger');

/**
 * Modelo para reportes de asistencia diaria
 * Centraliza toda la información de asistencia de un día específico
 */
class AttendanceReport {
  constructor(data = {}) {
    this.id = data.id;
    this.date = data.date; // YYYY-MM-DD
    this.createdBy = data.createdBy;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.status = data.status || 'draft'; // draft, completed, approved, rejected
    this.notes = data.notes || '';
    this.totalEmployees = data.totalEmployees || 0;
    this.presentCount = data.presentCount || 0;
    this.absentCount = data.absentCount || 0;
    this.lateCount = data.lateCount || 0;
    this.vacationCount = data.vacationCount || 0;
    this.sickLeaveCount = data.sickLeaveCount || 0;
    this.personalLeaveCount = data.personalLeaveCount || 0;
    this.maternityLeaveCount = data.maternityLeaveCount || 0;
    this.paternityLeaveCount = data.paternityLeaveCount || 0;
    this.overtimeHours = data.overtimeHours || 0;
    this.totalHours = data.totalHours || 0;
    this.approvedBy = data.approvedBy;
    this.approvedAt = data.approvedAt;
    this.rejectedBy = data.rejectedBy;
    this.rejectedAt = data.rejectedAt;
    this.rejectionReason = data.rejectionReason;
    this.metadata = data.metadata || {};
  }

  /**
   * Guardar reporte en Firestore
   */
  async save() {
    try {
      const docRef = db.collection('attendance_reports').doc();
      this.id = docRef.id;
      this.createdAt = new Date().toISOString();
      this.updatedAt = new Date().toISOString();

      await docRef.set({
        ...this,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
      });

      logger.info('AttendanceReport guardado', {
        id: this.id,
        date: this.date,
        status: this.status,
        totalEmployees: this.totalEmployees
      });

      return this;
    } catch (error) {
      logger.error('Error guardando AttendanceReport:', error);
      throw error;
    }
  }

  /**
   * Actualizar reporte
   */
  async update(updateData) {
    try {
      this.updatedAt = new Date().toISOString();

      await db.collection('attendance_reports').doc(this.id).update({
        ...updateData,
        updatedAt: this.updatedAt
      });

      // Actualizar propiedades locales
      Object.assign(this, updateData);

      logger.info('AttendanceReport actualizado', {
        id: this.id,
        date: this.date,
        status: this.status
      });

      return this;
    } catch (error) {
      logger.error('Error actualizando AttendanceReport:', error);
      throw error;
    }
  }

  /**
   * Eliminar reporte
   */
  async delete() {
    try {
      // Eliminar registros de asistencia asociados primero
      await this.deleteAssociatedRecords();

      // Eliminar reporte
      await db.collection('attendance_reports').doc(this.id).delete();

      logger.info('AttendanceReport eliminado', {
        id: this.id,
        date: this.date
      });

      return true;
    } catch (error) {
      logger.error('Error eliminando AttendanceReport:', error);
      throw error;
    }
  }

  /**
   * Eliminar registros de asistencia asociados
   */
  async deleteAssociatedRecords() {
    try {
      const recordsSnapshot = await db.collection('attendance_records')
        .where('reportId', '==', this.id)
        .get();

      const batch = db.batch();
      recordsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
    } catch (error) {
      logger.error('Error eliminando registros asociados:', error);
      throw error;
    }
  }

  /**
   * Buscar reporte por fecha
   */
  static async findByDate(date) {
    try {
      const snapshot = await db.collection('attendance_reports')
        .where('date', '==', date)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return new AttendanceReport({
        id: doc.id,
        ...doc.data()
      });
    } catch (error) {
      logger.error('Error buscando reporte por fecha:', error);
      throw error;
    }
  }

  /**
   * Buscar reporte por ID
   */
  static async findById(reportId) {
    try {
      const doc = await db.collection('attendance_reports').doc(reportId).get();

      if (!doc.exists) {
        return null;
      }

      return new AttendanceReport({
        id: doc.id,
        ...doc.data()
      });
    } catch (error) {
      logger.error('Error buscando reporte por ID:', error);
      throw error;
    }
  }

  /**
   * Listar reportes con filtros
   */
  static async list(filters = {}) {
    try {
      let query = db.collection('attendance_reports');

      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }

      if (filters.createdBy) {
        query = query.where('createdBy', '==', filters.createdBy);
      }

      if (filters.dateFrom) {
        query = query.where('date', '>=', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.where('date', '<=', filters.dateTo);
      }

      // Aplicar ordenamiento
      if (filters.orderBy === 'date') {
        query = query.orderBy('date', filters.orderDirection || 'desc');
      } else {
        query = query.orderBy('createdAt', 'desc');
      }

      // Aplicar paginación
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.offset(filters.offset);
      }

      const snapshot = await query.get();
      const reports = [];

      snapshot.forEach(doc => {
        reports.push(new AttendanceReport({
          id: doc.id,
          ...doc.data()
        }));
      });

      return reports;
    } catch (error) {
      logger.error('Error listando reportes:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas del reporte
   */
  async getStats() {
    try {
      // Obtener registros de asistencia
      const recordsSnapshot = await db.collection('attendance_records')
        .where('reportId', '==', this.id)
        .get();

      const stats = {
        totalEmployees: this.totalEmployees,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        vacationCount: 0,
        sickLeaveCount: 0,
        personalLeaveCount: 0,
        maternityLeaveCount: 0,
        paternityLeaveCount: 0,
        overtimeHours: 0,
        totalHours: 0,
        exceptionsCount: 0
      };

      recordsSnapshot.forEach(doc => {
        const record = doc.data();

        switch (record.status) {
          case 'present':
            stats.presentCount++;
            stats.totalHours += record.totalHours || 0;
            stats.overtimeHours += record.overtimeHours || 0;
            break;
          case 'absent':
            stats.absentCount++;
            break;
          case 'late':
            stats.lateCount++;
            stats.totalHours += record.totalHours || 0;
            stats.overtimeHours += record.overtimeHours || 0;
            break;
          case 'vacation':
            stats.vacationCount++;
            break;
          case 'sick_leave':
            stats.sickLeaveCount++;
            break;
          case 'personal_leave':
            stats.personalLeaveCount++;
            break;
          case 'maternity_leave':
            stats.maternityLeaveCount++;
            break;
          case 'paternity_leave':
            stats.paternityLeaveCount++;
            break;
        }
      });

      // Obtener excepciones
      const exceptionsSnapshot = await db.collection('attendance_exceptions')
        .where('reportId', '==', this.id)
        .get();

      stats.exceptionsCount = exceptionsSnapshot.size;

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas del reporte:', error);
      throw error;
    }
  }

  /**
   * Recalcular estadísticas del reporte
   */
  async recalculateStats() {
    try {
      const stats = await this.getStats();

      await this.update({
        totalEmployees: stats.totalEmployees,
        presentCount: stats.presentCount,
        absentCount: stats.absentCount,
        lateCount: stats.lateCount,
        vacationCount: stats.vacationCount,
        sickLeaveCount: stats.sickLeaveCount,
        personalLeaveCount: stats.personalLeaveCount,
        maternityLeaveCount: stats.maternityLeaveCount,
        paternityLeaveCount: stats.paternityLeaveCount,
        overtimeHours: stats.overtimeHours,
        totalHours: stats.totalHours
      });

      return stats;
    } catch (error) {
      logger.error('Error recalculando estadísticas:', error);
      throw error;
    }
  }

  /**
   * Validar datos del reporte
   */
  validate() {
    const errors = [];

    if (!this.date) {
      errors.push('La fecha es requerida');
    }

    if (!this.createdBy) {
      errors.push('El creador es requerido');
    }

    if (!['draft', 'completed', 'approved', 'rejected'].includes(this.status)) {
      errors.push('Estado inválido');
    }

    if (this.status === 'rejected' && !this.rejectionReason) {
      errors.push('El motivo de rechazo es requerido');
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
      date: this.date,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      status: this.status,
      notes: this.notes,
      totalEmployees: this.totalEmployees,
      presentCount: this.presentCount,
      absentCount: this.absentCount,
      lateCount: this.lateCount,
      vacationCount: this.vacationCount,
      sickLeaveCount: this.sickLeaveCount,
      personalLeaveCount: this.personalLeaveCount,
      maternityLeaveCount: this.maternityLeaveCount,
      paternityLeaveCount: this.paternityLeaveCount,
      overtimeHours: this.overtimeHours,
      totalHours: this.totalHours,
      approvedBy: this.approvedBy,
      approvedAt: this.approvedAt,
      rejectedBy: this.rejectedBy,
      rejectedAt: this.rejectedAt,
      rejectionReason: this.rejectionReason,
      metadata: this.metadata
    };
  }
}

module.exports = AttendanceReport;
