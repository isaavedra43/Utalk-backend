const { db } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

/**
 * Modelo Payroll - Gestión de períodos de nómina
 * Maneja la información de cada período de pago de los empleados
 */
class Payroll {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.employeeId = data.employeeId;
    this.periodStart = data.periodStart; // Fecha inicio del período
    this.periodEnd = data.periodEnd; // Fecha fin del período
    this.frequency = data.frequency || 'monthly'; // 'daily', 'weekly', 'biweekly', 'monthly'
    this.baseSalary = data.baseSalary || 0; // Salario base configurado
    this.calculatedSalary = data.calculatedSalary || 0; // Salario calculado según frecuencia
    this.grossSalary = data.grossSalary || 0; // Salario bruto (calculado + percepciones)
    this.totalPerceptions = data.totalPerceptions || 0; // Total de percepciones
    this.totalDeductions = data.totalDeductions || 0; // Total de deducciones
    this.netSalary = data.netSalary || 0; // Salario neto final
    this.status = data.status || 'calculated'; // 'calculated', 'approved', 'paid', 'cancelled'
    this.paymentDate = data.paymentDate || null; // Fecha de pago real
    this.approvedBy = data.approvedBy || null; // Usuario que aprobó
    this.approvedAt = data.approvedAt || null; // Fecha de aprobación
    this.paidBy = data.paidBy || null; // Usuario que marcó como pagado
    this.paidAt = data.paidAt || null; // Fecha marcada como pagado
    this.pdfUrl = data.pdfUrl || null; // URL del PDF generado
    this.notes = data.notes || ''; // Notas adicionales
    this.weekNumber = data.weekNumber || null; // Número de semana (para frecuencia semanal)
    this.year = data.year || new Date().getFullYear(); // Año del período
    this.month = data.month || new Date().getMonth() + 1; // Mes del período
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Convertir a formato Firestore
   */
  toFirestore() {
    return {
      id: this.id,
      employeeId: this.employeeId,
      periodStart: this.periodStart,
      periodEnd: this.periodEnd,
      frequency: this.frequency,
      baseSalary: this.baseSalary,
      calculatedSalary: this.calculatedSalary,
      grossSalary: this.grossSalary,
      totalPerceptions: this.totalPerceptions,
      totalDeductions: this.totalDeductions,
      netSalary: this.netSalary,
      status: this.status,
      paymentDate: this.paymentDate,
      approvedBy: this.approvedBy,
      approvedAt: this.approvedAt,
      paidBy: this.paidBy,
      paidAt: this.paidAt,
      pdfUrl: this.pdfUrl,
      notes: this.notes,
      weekNumber: this.weekNumber,
      year: this.year,
      month: this.month,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crear desde documento Firestore
   */
  static fromFirestore(doc) {
    const data = doc.data();
    return new Payroll({
      id: doc.id,
      ...data
    });
  }

  /**
   * Guardar en Firestore
   */
  async save() {
    try {
      this.updatedAt = new Date().toISOString();
      await db.collection('payroll').doc(this.id).set(this.toFirestore());
      logger.info('✅ Período de nómina guardado', {
        payrollId: this.id,
        employeeId: this.employeeId,
        period: `${this.periodStart} - ${this.periodEnd}`,
        netSalary: this.netSalary
      });
      return this;
    } catch (error) {
      logger.error('❌ Error guardando período de nómina', error);
      throw error;
    }
  }

  /**
   * Buscar por ID
   */
  static async findById(id) {
    try {
      const doc = await db.collection('payroll').doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return Payroll.fromFirestore(doc);
    } catch (error) {
      logger.error('❌ Error buscando período de nómina por ID', error);
      throw error;
    }
  }

  /**
   * Buscar períodos por empleado
   */
  static async findByEmployee(employeeId, limit = 50) {
    try {
      const snapshot = await db.collection('payroll')
        .where('employeeId', '==', employeeId)
        .orderBy('periodStart', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => Payroll.fromFirestore(doc));
    } catch (error) {
      logger.error('❌ Error buscando períodos por empleado', error);
      throw error;
    }
  }

  /**
   * Buscar período específico por empleado y fechas
   */
  static async findByEmployeeAndPeriod(employeeId, periodStart, periodEnd) {
    try {
      const snapshot = await db.collection('payroll')
        .where('employeeId', '==', employeeId)
        .where('periodStart', '==', periodStart)
        .where('periodEnd', '==', periodEnd)
        .get();

      if (snapshot.empty) {
        return null;
      }

      return Payroll.fromFirestore(snapshot.docs[0]);
    } catch (error) {
      logger.error('❌ Error buscando período específico', error);
      throw error;
    }
  }

  /**
   * Buscar períodos pendientes de pago
   */
  static async findPendingPayments() {
    try {
      const snapshot = await db.collection('payroll')
        .where('status', 'in', ['calculated', 'approved'])
        .orderBy('periodStart', 'desc')
        .get();

      return snapshot.docs.map(doc => Payroll.fromFirestore(doc));
    } catch (error) {
      logger.error('❌ Error buscando períodos pendientes', error);
      throw error;
    }
  }

  /**
   * Buscar por frecuencia y fecha
   */
  static async findByFrequencyAndDate(frequency, date) {
    try {
      const snapshot = await db.collection('payroll')
        .where('frequency', '==', frequency)
        .where('periodStart', '<=', date)
        .where('periodEnd', '>=', date)
        .get();

      return snapshot.docs.map(doc => Payroll.fromFirestore(doc));
    } catch (error) {
      logger.error('❌ Error buscando por frecuencia y fecha', error);
      throw error;
    }
  }

  /**
   * Actualizar estado
   */
  async updateStatus(status, userId = null) {
    try {
      this.status = status;
      this.updatedAt = new Date().toISOString();

      if (status === 'approved') {
        this.approvedBy = userId;
        this.approvedAt = new Date().toISOString();
      } else if (status === 'paid') {
        this.paidBy = userId;
        this.paidAt = new Date().toISOString();
        this.paymentDate = new Date().toISOString();
      }

      await this.save();
      return this;
    } catch (error) {
      logger.error('❌ Error actualizando estado de nómina', error);
      throw error;
    }
  }

  /**
   * Validar datos del período
   */
  validate() {
    const errors = [];

    if (!this.employeeId) errors.push('ID de empleado es requerido');
    if (!this.periodStart) errors.push('Fecha de inicio del período es requerida');
    if (!this.periodEnd) errors.push('Fecha de fin del período es requerida');
    if (!this.frequency) errors.push('Frecuencia de pago es requerida');
    if (!['daily', 'weekly', 'biweekly', 'monthly'].includes(this.frequency)) {
      errors.push('Frecuencia debe ser: daily, weekly, biweekly o monthly');
    }
    if (this.baseSalary < 0) errors.push('Salario base no puede ser negativo');
    if (this.netSalary < 0) errors.push('Salario neto no puede ser negativo');

    // Validar fechas
    const startDate = new Date(this.periodStart);
    const endDate = new Date(this.periodEnd);
    if (startDate >= endDate) {
      errors.push('Fecha de inicio debe ser anterior a fecha de fin');
    }

    return errors;
  }

  /**
   * Calcular totales
   */
  calculateTotals() {
    this.grossSalary = this.calculatedSalary + this.totalPerceptions;
    this.netSalary = this.grossSalary - this.totalDeductions;
    
    // Asegurar que el salario neto no sea negativo
    if (this.netSalary < 0) {
      this.netSalary = 0;
    }
  }

  /**
   * Eliminar período
   */
  async delete() {
    try {
      await db.collection('payroll').doc(this.id).delete();
      logger.info('✅ Período de nómina eliminado', {
        payrollId: this.id,
        employeeId: this.employeeId
      });
      return true;
    } catch (error) {
      logger.error('❌ Error eliminando período de nómina', error);
      throw error;
    }
  }
}

module.exports = Payroll;
