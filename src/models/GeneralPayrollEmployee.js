const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');
const logger = require('../utils/logger');

/**
 * Modelo de Empleado en Nómina General
 * Representa los datos calculados de un empleado específico dentro de una nómina general
 */
class GeneralPayrollEmployee {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.generalPayrollId = data.generalPayrollId || '';
    this.employeeId = data.employeeId || '';
    
    // Información del empleado (desnormalizada para performance)
    this.employee = {
      id: data.employee?.id || data.employeeId || '',
      name: data.employee?.name || '',
      position: data.employee?.position || '',
      department: data.employee?.department || '',
      code: data.employee?.code || '',
      email: data.employee?.email || ''
    };
    
    // Cálculos de nómina - asegurar que sean números válidos
    this.baseSalary = parseFloat(data.baseSalary) || 0;
    this.overtime = parseFloat(data.overtime) || 0;
    this.bonuses = parseFloat(data.bonuses) || 0;
    this.deductions = parseFloat(data.deductions) || 0;
    this.taxes = parseFloat(data.taxes) || 0;
    this.grossSalary = parseFloat(data.grossSalary) || 0;
    this.netSalary = parseFloat(data.netSalary) || 0;
    
    // Estado del empleado en la nómina
    this.status = data.status || 'pending'; // 'pending' | 'approved' | 'paid'
    this.paymentStatus = data.paymentStatus || 'unpaid'; // 'unpaid' | 'paid'
    this.paymentMethod = data.paymentMethod || 'bank_transfer'; // 'bank_transfer' | 'cash' | 'check'
    
    // Referencia a nómina individual generada
    this.individualPayrollId = data.individualPayrollId || null;
    
    // Ajustes aplicados
    this.adjustments = data.adjustments || [];
    
    // Extras incluidos (para trazabilidad)
    this.includedExtras = data.includedExtras || [];
    
    // Detalles adicionales
    this.notes = data.notes || '';
    this.faults = data.faults || 0; // Faltas del período
    this.attendance = data.attendance || 100; // Porcentaje de asistencia
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Validar datos del empleado
   */
  validate() {
    const errors = [];

    if (!this.generalPayrollId) {
      errors.push('generalPayrollId es requerido');
    }

    if (!this.employeeId) {
      errors.push('employeeId es requerido');
    }

    if (!this.employee.name) {
      errors.push('Nombre del empleado es requerido');
    }

    if (this.baseSalary < 0) {
      errors.push('El salario base no puede ser negativo');
    }

    if (this.netSalary < 0) {
      errors.push('El salario neto no puede ser negativo');
    }

    const validStatuses = ['pending', 'approved', 'paid'];
    if (!validStatuses.includes(this.status)) {
      errors.push('Estado inválido');
    }

    const validPaymentStatuses = ['unpaid', 'paid'];
    if (!validPaymentStatuses.includes(this.paymentStatus)) {
      errors.push('Estado de pago inválido');
    }

    return errors;
  }

  /**
   * Convertir a formato Firestore
   */
  toFirestore() {
    return {
      generalPayrollId: this.generalPayrollId,
      employeeId: this.employeeId,
      employee: this.employee,
      baseSalary: this.baseSalary,
      overtime: this.overtime,
      bonuses: this.bonuses,
      deductions: this.deductions,
      taxes: this.taxes,
      grossSalary: this.grossSalary,
      netSalary: this.netSalary,
      status: this.status,
      paymentStatus: this.paymentStatus,
      paymentMethod: this.paymentMethod,
      individualPayrollId: this.individualPayrollId,
      adjustments: this.adjustments,
      includedExtras: this.includedExtras,
      notes: this.notes,
      faults: this.faults,
      attendance: this.attendance,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crear desde documento Firestore
   */
  static fromFirestore(doc) {
    const data = doc.data();
    return new GeneralPayrollEmployee({
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
      
      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      await db.collection('generalPayrollEmployees').doc(this.id).set(this.toFirestore());
      
      logger.info('✅ Empleado de nómina general guardado', {
        id: this.id,
        employeeId: this.employeeId,
        employeeName: this.employee.name,
        generalPayrollId: this.generalPayrollId,
        status: this.status,
        netSalary: this.netSalary
      });
      
      return this;
    } catch (error) {
      logger.error('❌ Error guardando empleado de nómina general', error);
      throw error;
    }
  }

  /**
   * Buscar por ID
   */
  static async findById(id) {
    try {
      const doc = await db.collection('generalPayrollEmployees').doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return GeneralPayrollEmployee.fromFirestore(doc);
    } catch (error) {
      logger.error('❌ Error buscando empleado de nómina general por ID', error);
      throw error;
    }
  }

  /**
   * Buscar empleados por nómina general
   */
  static async findByGeneralPayroll(generalPayrollId) {
    try {
      const snapshot = await db.collection('generalPayrollEmployees')
        .where('generalPayrollId', '==', generalPayrollId)
        .orderBy('employee.name', 'asc')
        .get();

      return snapshot.docs.map(doc => GeneralPayrollEmployee.fromFirestore(doc));
    } catch (error) {
      logger.error('❌ Error buscando empleados por nómina general', error);
      throw error;
    }
  }

  /**
   * Buscar por empleado y nómina general
   */
  static async findByEmployeeAndGeneral(employeeId, generalPayrollId) {
    try {
      const snapshot = await db.collection('generalPayrollEmployees')
        .where('employeeId', '==', employeeId)
        .where('generalPayrollId', '==', generalPayrollId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      return GeneralPayrollEmployee.fromFirestore(snapshot.docs[0]);
    } catch (error) {
      logger.error('❌ Error buscando empleado por ID y nómina general', error);
      throw error;
    }
  }

  /**
   * Aplicar ajuste al empleado
   */
  async applyAdjustment(adjustment, appliedBy) {
    try {
      const adjustmentData = {
        id: uuidv4(),
        type: adjustment.type, // 'bonus' | 'deduction' | 'overtime_adjustment'
        concept: adjustment.concept,
        amount: adjustment.amount,
        reason: adjustment.reason || '',
        appliedBy: appliedBy,
        appliedAt: new Date().toISOString()
      };

      this.adjustments.push(adjustmentData);

      // Recalcular totales según el tipo de ajuste
      switch (adjustment.type) {
        case 'bonus':
          this.bonuses += adjustment.amount;
          this.grossSalary += adjustment.amount;
          this.netSalary += adjustment.amount;
          break;
        case 'deduction':
          this.deductions += adjustment.amount;
          this.netSalary -= adjustment.amount;
          break;
        case 'overtime_adjustment':
          this.overtime += adjustment.amount;
          this.grossSalary += adjustment.amount;
          this.netSalary += adjustment.amount;
          break;
      }

      await this.save();

      logger.info('✅ Ajuste aplicado a empleado en nómina general', {
        employeeId: this.employeeId,
        adjustmentType: adjustment.type,
        amount: adjustment.amount,
        newNetSalary: this.netSalary
      });

      return adjustmentData;
    } catch (error) {
      logger.error('❌ Error aplicando ajuste a empleado', error);
      throw error;
    }
  }

  /**
   * Cambiar estado del empleado
   */
  async changeStatus(newStatus, userId) {
    try {
      const validTransitions = {
        'pending': ['approved'],
        'approved': ['paid', 'pending'],
        'paid': [] // Estado final
      };

      if (!validTransitions[this.status].includes(newStatus)) {
        throw new Error(`Transición inválida de ${this.status} a ${newStatus}`);
      }

      const oldStatus = this.status;
      this.status = newStatus;

      if (newStatus === 'paid') {
        this.paymentStatus = 'paid';
      }

      await this.save();

      logger.info('✅ Estado de empleado cambiado en nómina general', {
        employeeId: this.employeeId,
        employeeName: this.employee.name,
        oldStatus,
        newStatus,
        userId
      });

      return this;
    } catch (error) {
      logger.error('❌ Error cambiando estado de empleado', error);
      throw error;
    }
  }

  /**
   * Marcar como pagado
   */
  async markAsPaid(paymentMethod = 'bank_transfer', userId) {
    try {
      this.status = 'paid';
      this.paymentStatus = 'paid';
      this.paymentMethod = paymentMethod;
      
      await this.save();

      logger.info('✅ Empleado marcado como pagado', {
        employeeId: this.employeeId,
        employeeName: this.employee.name,
        paymentMethod,
        netSalary: this.netSalary,
        userId
      });

      return this;
    } catch (error) {
      logger.error('❌ Error marcando empleado como pagado', error);
      throw error;
    }
  }

  /**
   * Obtener resumen del empleado
   */
  getSummary() {
    return {
      id: this.id,
      employee: this.employee,
      baseSalary: this.baseSalary,
      overtime: this.overtime,
      bonuses: this.bonuses,
      deductions: this.deductions,
      grossSalary: this.grossSalary,
      netSalary: this.netSalary,
      status: this.status,
      paymentStatus: this.paymentStatus,
      adjustmentsCount: this.adjustments.length,
      faults: this.faults,
      attendance: this.attendance
    };
  }

  /**
   * Eliminar empleado de nómina general
   */
  async delete() {
    try {
      await db.collection('generalPayrollEmployees').doc(this.id).delete();

      logger.info('✅ Empleado eliminado de nómina general', {
        id: this.id,
        employeeId: this.employeeId,
        employeeName: this.employee.name
      });

      return true;
    } catch (error) {
      logger.error('❌ Error eliminando empleado de nómina general', error);
      throw error;
    }
  }

  /**
   * Eliminar todos los empleados de una nómina general
   */
  static async deleteByGeneralPayroll(generalPayrollId) {
    try {
      const snapshot = await db.collection('generalPayrollEmployees')
        .where('generalPayrollId', '==', generalPayrollId)
        .get();

      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      logger.info('✅ Todos los empleados eliminados de nómina general', {
        generalPayrollId,
        deletedCount: snapshot.docs.length
      });

      return snapshot.docs.length;
    } catch (error) {
      logger.error('❌ Error eliminando empleados de nómina general', error);
      throw error;
    }
  }
}

module.exports = GeneralPayrollEmployee;
