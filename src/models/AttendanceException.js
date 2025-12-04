const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');
const logger = require('../utils/logger');

/**
 * Modelo para excepciones de asistencia (incidencias especiales)
 * Maneja situaciones excepcionales como llegadas tarde, salidas tempranas, etc.
 */
class AttendanceException {
  constructor(data = {}) {
    this.id = data.id;
    this.reportId = data.reportId;
    this.employeeId = data.employeeId;
    this.type = data.type; // late, early_leave, break_violation, missing_clock_in, missing_clock_out, no_show
    this.description = data.description;
    this.time = data.time; // HH:mm cuando ocurrió la excepción
    this.duration = data.duration || 0; // minutos de duración de la excepción
    this.severity = data.severity || 'low'; // low, medium, high
    this.status = data.status || 'pending'; // pending, reviewed, resolved, dismissed
    this.createdBy = data.createdBy;
    this.reviewedBy = data.reviewedBy;
    this.reviewedAt = data.reviewedAt;
    this.resolution = data.resolution;
    this.resolvedAt = data.resolvedAt;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.metadata = data.metadata || {};
  }

  /**
   * Guardar excepción en Firestore
   */
  async save() {
    try {
      const docRef = db.collection('attendance_exceptions').doc();
      this.id = docRef.id;
      this.createdAt = new Date().toISOString();
      this.updatedAt = new Date().toISOString();

      await docRef.set({
        ...this,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
      });

      logger.info('AttendanceException guardada', {
        id: this.id,
        reportId: this.reportId,
        employeeId: this.employeeId,
        type: this.type,
        severity: this.severity
      });

      return this;
    } catch (error) {
      logger.error('Error guardando AttendanceException:', error);
      throw error;
    }
  }

  /**
   * Actualizar excepción
   */
  async update(updateData) {
    try {
      this.updatedAt = new Date().toISOString();

      await db.collection('attendance_exceptions').doc(this.id).update({
        ...updateData,
        updatedAt: this.updatedAt
      });

      // Actualizar propiedades locales
      Object.assign(this, updateData);

      logger.info('AttendanceException actualizada', {
        id: this.id,
        type: this.type,
        status: this.status
      });

      return this;
    } catch (error) {
      logger.error('Error actualizando AttendanceException:', error);
      throw error;
    }
  }

  /**
   * Eliminar excepción
   */
  async delete() {
    try {
      await db.collection('attendance_exceptions').doc(this.id).delete();

      logger.info('AttendanceException eliminada', {
        id: this.id,
        employeeId: this.employeeId
      });

      return true;
    } catch (error) {
      logger.error('Error eliminando AttendanceException:', error);
      throw error;
    }
  }

  /**
   * Buscar excepción por ID
   */
  static async findById(exceptionId) {
    try {
      const doc = await db.collection('attendance_exceptions').doc(exceptionId).get();

      if (!doc.exists) {
        return null;
      }

      return new AttendanceException({
        id: doc.id,
        ...doc.data()
      });
    } catch (error) {
      logger.error('Error buscando excepción por ID:', error);
      throw error;
    }
  }

  /**
   * Buscar excepciones por reporte
   */
  static async findByReport(reportId) {
    try {
      const snapshot = await db.collection('attendance_exceptions')
        .where('reportId', '==', reportId)
        .orderBy('createdAt', 'asc')
        .get();

      const exceptions = [];
      snapshot.forEach(doc => {
        exceptions.push(new AttendanceException({
          id: doc.id,
          ...doc.data()
        }));
      });

      return exceptions;
    } catch (error) {
      logger.error('Error buscando excepciones por reporte:', error);
      throw error;
    }
  }

  /**
   * Buscar excepciones por empleado
   */
  static async findByEmployee(employeeId, filters = {}) {
    try {
      let query = db.collection('attendance_exceptions')
        .where('employeeId', '==', employeeId);

      if (filters.type) {
        query = query.where('type', '==', filters.type);
      }

      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }

      if (filters.severity) {
        query = query.where('severity', '==', filters.severity);
      }

      if (filters.dateFrom) {
        query = query.where('createdAt', '>=', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.where('createdAt', '<=', filters.dateTo);
      }

      const snapshot = await query.orderBy('createdAt', 'desc').get();
      const exceptions = [];

      snapshot.forEach(doc => {
        exceptions.push(new AttendanceException({
          id: doc.id,
          ...doc.data()
        }));
      });

      return exceptions;
    } catch (error) {
      logger.error('Error buscando excepciones por empleado:', error);
      throw error;
    }
  }

  /**
   * Crear múltiples excepciones en lote
   */
  static async createBatch(exceptions) {
    try {
      const batch = db.batch();
      const createdExceptions = [];

      for (const exceptionData of exceptions) {
        const docRef = db.collection('attendance_exceptions').doc();
        const exception = new AttendanceException({
          id: docRef.id,
          ...exceptionData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        batch.set(docRef, exception.toFirestore());
        createdExceptions.push(exception);
      }

      await batch.commit();

      logger.info('AttendanceExceptions creadas en lote', {
        count: createdExceptions.length
      });

      return createdExceptions;
    } catch (error) {
      logger.error('Error creando excepciones en lote:', error);
      throw error;
    }
  }

  /**
   * Revisar excepción
   */
  async review(reviewedBy, resolution) {
    try {
      await this.update({
        status: 'reviewed',
        reviewedBy,
        reviewedAt: new Date().toISOString(),
        resolution
      });

      logger.info('AttendanceException revisada', {
        id: this.id,
        employeeId: this.employeeId,
        type: this.type
      });

      return this;
    } catch (error) {
      logger.error('Error revisando excepción:', error);
      throw error;
    }
  }

  /**
   * Resolver excepción
   */
  async resolve(resolution) {
    try {
      await this.update({
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        resolution
      });

      logger.info('AttendanceException resuelta', {
        id: this.id,
        employeeId: this.employeeId,
        type: this.type
      });

      return this;
    } catch (error) {
      logger.error('Error resolviendo excepción:', error);
      throw error;
    }
  }

  /**
   * Desestimar excepción
   */
  async dismiss() {
    try {
      await this.update({
        status: 'dismissed',
        resolvedAt: new Date().toISOString()
      });

      logger.info('AttendanceException desestimada', {
        id: this.id,
        employeeId: this.employeeId,
        type: this.type
      });

      return this;
    } catch (error) {
      logger.error('Error desestimando excepción:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de excepciones
   */
  static async getExceptionStats(employeeId, dateFrom, dateTo) {
    try {
      const exceptions = await this.findByEmployee(employeeId, {
        dateFrom,
        dateTo
      });

      const stats = {
        totalExceptions: exceptions.length,
        byType: {},
        bySeverity: {},
        byStatus: {},
        totalDuration: 0,
        pendingCount: 0,
        reviewedCount: 0,
        resolvedCount: 0,
        dismissedCount: 0
      };

      exceptions.forEach(exception => {
        // Por tipo
        if (!stats.byType[exception.type]) {
          stats.byType[exception.type] = {
            count: 0,
            totalDuration: 0
          };
        }
        stats.byType[exception.type].count++;
        stats.byType[exception.type].totalDuration += exception.duration || 0;

        // Por severidad
        if (!stats.bySeverity[exception.severity]) {
          stats.bySeverity[exception.severity] = 0;
        }
        stats.bySeverity[exception.severity]++;

        // Por estado
        if (!stats.byStatus[exception.status]) {
          stats.byStatus[exception.status] = 0;
        }
        stats.byStatus[exception.status]++;

        // Totales
        stats.totalDuration += exception.duration || 0;

        if (exception.status === 'pending') stats.pendingCount++;
        if (exception.status === 'reviewed') stats.reviewedCount++;
        if (exception.status === 'resolved') stats.resolvedCount++;
        if (exception.status === 'dismissed') stats.dismissedCount++;
      });

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de excepciones:', error);
      throw error;
    }
  }

  /**
   * Validar datos de la excepción
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
      errors.push('El tipo de excepción es requerido');
    }

    const validTypes = [
      'late', 'early_leave', 'break_violation',
      'missing_clock_in', 'missing_clock_out', 'no_show'
    ];

    if (!validTypes.includes(this.type)) {
      errors.push('Tipo de excepción inválido');
    }

    if (!this.description) {
      errors.push('La descripción es requerida');
    }

    const validSeverities = ['low', 'medium', 'high'];
    if (!validSeverities.includes(this.severity)) {
      errors.push('Severidad inválida');
    }

    if (!['pending', 'reviewed', 'resolved', 'dismissed'].includes(this.status)) {
      errors.push('Estado inválido');
    }

    if (this.duration < 0) {
      errors.push('La duración no puede ser negativa');
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
      description: this.description,
      time: this.time,
      duration: this.duration,
      severity: this.severity,
      status: this.status,
      createdBy: this.createdBy,
      reviewedBy: this.reviewedBy,
      reviewedAt: this.reviewedAt,
      resolution: this.resolution,
      resolvedAt: this.resolvedAt,
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

module.exports = AttendanceException;
