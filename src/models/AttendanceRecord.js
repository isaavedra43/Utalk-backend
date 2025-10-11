const { Firestore } = require('@google-cloud/firestore');
const db = new Firestore();
const logger = require('../utils/logger');

/**
 * Modelo para registros individuales de asistencia
 * Representa la asistencia de un empleado específico en un reporte
 */
class AttendanceRecord {
  constructor(data = {}) {
    this.id = data.id;
    this.reportId = data.reportId;
    this.employeeId = data.employeeId;
    this.status = data.status; // present, absent, late, vacation, sick_leave, personal_leave, maternity_leave, paternity_leave
    this.clockIn = data.clockIn; // HH:mm
    this.clockOut = data.clockOut; // HH:mm
    this.totalHours = data.totalHours || 0;
    this.overtimeHours = data.overtimeHours || 0;
    this.breakHours = data.breakHours || 0;
    this.notes = data.notes || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.metadata = data.metadata || {};
  }

  /**
   * Guardar registro en Firestore
   */
  async save() {
    try {
      const docRef = db.collection('attendance_records').doc();
      this.id = docRef.id;
      this.createdAt = new Date().toISOString();
      this.updatedAt = new Date().toISOString();

      await docRef.set({
        ...this,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
      });

      logger.info('AttendanceRecord guardado', {
        id: this.id,
        reportId: this.reportId,
        employeeId: this.employeeId,
        status: this.status
      });

      return this;
    } catch (error) {
      logger.error('Error guardando AttendanceRecord:', error);
      throw error;
    }
  }

  /**
   * Actualizar registro
   */
  async update(updateData) {
    try {
      this.updatedAt = new Date().toISOString();

      await db.collection('attendance_records').doc(this.id).update({
        ...updateData,
        updatedAt: this.updatedAt
      });

      // Actualizar propiedades locales
      Object.assign(this, updateData);

      logger.info('AttendanceRecord actualizado', {
        id: this.id,
        employeeId: this.employeeId,
        status: this.status
      });

      return this;
    } catch (error) {
      logger.error('Error actualizando AttendanceRecord:', error);
      throw error;
    }
  }

  /**
   * Eliminar registro
   */
  async delete() {
    try {
      await db.collection('attendance_records').doc(this.id).delete();

      logger.info('AttendanceRecord eliminado', {
        id: this.id,
        employeeId: this.employeeId
      });

      return true;
    } catch (error) {
      logger.error('Error eliminando AttendanceRecord:', error);
      throw error;
    }
  }

  /**
   * Buscar registro por ID
   */
  static async findById(recordId) {
    try {
      const doc = await db.collection('attendance_records').doc(recordId).get();

      if (!doc.exists) {
        return null;
      }

      return new AttendanceRecord({
        id: doc.id,
        ...doc.data()
      });
    } catch (error) {
      logger.error('Error buscando registro por ID:', error);
      throw error;
    }
  }

  /**
   * Buscar registros por reporte
   */
  static async findByReport(reportId) {
    try {
      const snapshot = await db.collection('attendance_records')
        .where('reportId', '==', reportId)
        .orderBy('createdAt', 'asc')
        .get();

      const records = [];
      snapshot.forEach(doc => {
        records.push(new AttendanceRecord({
          id: doc.id,
          ...doc.data()
        }));
      });

      return records;
    } catch (error) {
      logger.error('Error buscando registros por reporte:', error);
      throw error;
    }
  }

  /**
   * Buscar registros por empleado
   */
  static async findByEmployee(employeeId, filters = {}) {
    try {
      let query = db.collection('attendance_records')
        .where('employeeId', '==', employeeId);

      if (filters.dateFrom) {
        query = query.where('createdAt', '>=', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.where('createdAt', '<=', filters.dateTo);
      }

      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }

      const snapshot = await query.orderBy('createdAt', 'desc').get();
      const records = [];

      snapshot.forEach(doc => {
        records.push(new AttendanceRecord({
          id: doc.id,
          ...doc.data()
        }));
      });

      return records;
    } catch (error) {
      logger.error('Error buscando registros por empleado:', error);
      throw error;
    }
  }

  /**
   * Buscar registros por empleado y reporte
   */
  static async findByEmployeeAndReport(employeeId, reportId) {
    try {
      const snapshot = await db.collection('attendance_records')
        .where('employeeId', '==', employeeId)
        .where('reportId', '==', reportId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return new AttendanceRecord({
        id: doc.id,
        ...doc.data()
      });
    } catch (error) {
      logger.error('Error buscando registro por empleado y reporte:', error);
      throw error;
    }
  }

  /**
   * Crear múltiples registros en lote
   */
  static async createBatch(records) {
    try {
      const batch = db.batch();
      const createdRecords = [];

      for (const recordData of records) {
        const docRef = db.collection('attendance_records').doc();
        const record = new AttendanceRecord({
          id: docRef.id,
          ...recordData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        batch.set(docRef, record.toFirestore());
        createdRecords.push(record);
      }

      await batch.commit();

      logger.info('AttendanceRecords creados en lote', {
        count: createdRecords.length
      });

      return createdRecords;
    } catch (error) {
      logger.error('Error creando registros en lote:', error);
      throw error;
    }
  }

  /**
   * Actualizar múltiples registros en lote
   */
  static async updateBatch(records) {
    try {
      const batch = db.batch();

      for (const record of records) {
        batch.update(db.collection('attendance_records').doc(record.id), {
          ...record,
          updatedAt: new Date().toISOString()
        });
      }

      await batch.commit();

      logger.info('AttendanceRecords actualizados en lote', {
        count: records.length
      });

      return records;
    } catch (error) {
      logger.error('Error actualizando registros en lote:', error);
      throw error;
    }
  }

  /**
   * Eliminar múltiples registros en lote
   */
  static async deleteBatch(recordIds) {
    try {
      const batch = db.batch();

      for (const recordId of recordIds) {
        batch.delete(db.collection('attendance_records').doc(recordId));
      }

      await batch.commit();

      logger.info('AttendanceRecords eliminados en lote', {
        count: recordIds.length
      });

      return true;
    } catch (error) {
      logger.error('Error eliminando registros en lote:', error);
      throw error;
    }
  }

  /**
   * Calcular horas totales basado en entrada y salida
   */
  calculateTotalHours() {
    if (!this.clockIn || !this.clockOut) {
      return 0;
    }

    try {
      const [inHour, inMinute] = this.clockIn.split(':').map(Number);
      const [outHour, outMinute] = this.clockOut.split(':').map(Number);

      const inMinutes = inHour * 60 + inMinute;
      const outMinutes = outHour * 60 + outMinute;

      let totalMinutes = outMinutes - inMinutes;

      // Si la salida es antes de la entrada (cruce de medianoche)
      if (totalMinutes < 0) {
        totalMinutes += 24 * 60; // Agregar 24 horas en minutos
      }

      // Restar tiempo de descanso
      totalMinutes -= this.breakHours;

      const hours = totalMinutes / 60;
      return Math.max(0, Math.round(hours * 100) / 100); // Redondear a 2 decimales
    } catch (error) {
      logger.error('Error calculando horas totales:', error);
      return 0;
    }
  }

  /**
   * Determinar si es horario extra basado en horas trabajadas
   */
  isOvertime(standardHours = 8) {
    return this.totalHours > standardHours;
  }

  /**
   * Validar datos del registro
   */
  validate() {
    const errors = [];

    if (!this.reportId) {
      errors.push('El ID del reporte es requerido');
    }

    if (!this.employeeId) {
      errors.push('El ID del empleado es requerido');
    }

    if (!this.status) {
      errors.push('El estado es requerido');
    }

    const validStatuses = [
      'present', 'absent', 'late', 'vacation', 'sick_leave',
      'personal_leave', 'maternity_leave', 'paternity_leave'
    ];

    if (!validStatuses.includes(this.status)) {
      errors.push('Estado inválido');
    }

    // Validar horarios si el empleado está presente
    if (this.status === 'present' || this.status === 'late') {
      if (!this.clockIn) {
        errors.push('La hora de entrada es requerida para empleados presentes');
      }

      if (!this.clockOut) {
        errors.push('La hora de salida es requerida para empleados presentes');
      }

      if (this.clockIn && this.clockOut && this.clockIn >= this.clockOut) {
        errors.push('La hora de salida debe ser posterior a la hora de entrada');
      }

      // Calcular horas totales
      this.totalHours = this.calculateTotalHours();
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
      status: this.status,
      clockIn: this.clockIn,
      clockOut: this.clockOut,
      totalHours: this.totalHours,
      overtimeHours: this.overtimeHours,
      breakHours: this.breakHours,
      notes: this.notes,
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
}

module.exports = AttendanceRecord;
