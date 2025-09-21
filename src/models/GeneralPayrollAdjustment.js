const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');
const logger = require('../utils/logger');

/**
 * Modelo de Ajustes de Nómina General
 * Gestiona los ajustes manuales aplicados a empleados en nóminas generales
 */
class GeneralPayrollAdjustment {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.generalPayrollId = data.generalPayrollId || '';
    this.employeeId = data.employeeId || '';
    
    // Tipo y concepto del ajuste
    this.type = data.type || 'bonus'; // 'bonus' | 'deduction' | 'overtime_adjustment' | 'salary_adjustment'
    this.concept = data.concept || '';
    this.amount = data.amount || 0;
    this.reason = data.reason || '';
    
    // Metadatos de aplicación
    this.appliedBy = data.appliedBy || '';
    this.appliedAt = data.appliedAt || new Date().toISOString();
    
    // Estado del ajuste
    this.status = data.status || 'active'; // 'active' | 'cancelled'
    this.cancelledBy = data.cancelledBy || null;
    this.cancelledAt = data.cancelledAt || null;
    this.cancellationReason = data.cancellationReason || '';
    
    // Información adicional
    this.notes = data.notes || '';
    this.attachments = data.attachments || []; // URLs de documentos de soporte
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Validar datos del ajuste
   */
  validate() {
    const errors = [];

    if (!this.generalPayrollId) {
      errors.push('generalPayrollId es requerido');
    }

    if (!this.employeeId) {
      errors.push('employeeId es requerido');
    }

    const validTypes = ['bonus', 'deduction', 'overtime_adjustment', 'salary_adjustment'];
    if (!validTypes.includes(this.type)) {
      errors.push('Tipo de ajuste inválido');
    }

    if (!this.concept || this.concept.trim().length === 0) {
      errors.push('El concepto es requerido');
    }

    if (typeof this.amount !== 'number' || this.amount === 0) {
      errors.push('El monto debe ser un número diferente de cero');
    }

    if (this.type === 'deduction' && this.amount > 0) {
      errors.push('Las deducciones deben tener monto negativo');
    }

    if ((this.type === 'bonus' || this.type === 'overtime_adjustment') && this.amount < 0) {
      errors.push('Los bonos y ajustes de horas extra deben tener monto positivo');
    }

    if (!this.appliedBy) {
      errors.push('appliedBy es requerido');
    }

    const validStatuses = ['active', 'cancelled'];
    if (!validStatuses.includes(this.status)) {
      errors.push('Estado inválido');
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
      type: this.type,
      concept: this.concept,
      amount: this.amount,
      reason: this.reason,
      appliedBy: this.appliedBy,
      appliedAt: this.appliedAt,
      status: this.status,
      cancelledBy: this.cancelledBy,
      cancelledAt: this.cancelledAt,
      cancellationReason: this.cancellationReason,
      notes: this.notes,
      attachments: this.attachments,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crear desde documento Firestore
   */
  static fromFirestore(doc) {
    const data = doc.data();
    return new GeneralPayrollAdjustment({
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

      await db.collection('generalPayrollAdjustments').doc(this.id).set(this.toFirestore());
      
      logger.info('✅ Ajuste de nómina general guardado', {
        id: this.id,
        generalPayrollId: this.generalPayrollId,
        employeeId: this.employeeId,
        type: this.type,
        concept: this.concept,
        amount: this.amount,
        appliedBy: this.appliedBy
      });
      
      return this;
    } catch (error) {
      logger.error('❌ Error guardando ajuste de nómina general', error);
      throw error;
    }
  }

  /**
   * Buscar por ID
   */
  static async findById(id) {
    try {
      const doc = await db.collection('generalPayrollAdjustments').doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return GeneralPayrollAdjustment.fromFirestore(doc);
    } catch (error) {
      logger.error('❌ Error buscando ajuste por ID', error);
      throw error;
    }
  }

  /**
   * Buscar ajustes por nómina general
   */
  static async findByGeneralPayroll(generalPayrollId) {
    try {
      const snapshot = await db.collection('generalPayrollAdjustments')
        .where('generalPayrollId', '==', generalPayrollId)
        .where('status', '==', 'active')
        .orderBy('appliedAt', 'desc')
        .get();

      return snapshot.docs.map(doc => GeneralPayrollAdjustment.fromFirestore(doc));
    } catch (error) {
      logger.error('❌ Error buscando ajustes por nómina general', error);
      throw error;
    }
  }

  /**
   * Buscar ajustes por empleado en nómina general
   */
  static async findByEmployeeInGeneral(generalPayrollId, employeeId) {
    try {
      const snapshot = await db.collection('generalPayrollAdjustments')
        .where('generalPayrollId', '==', generalPayrollId)
        .where('employeeId', '==', employeeId)
        .where('status', '==', 'active')
        .orderBy('appliedAt', 'desc')
        .get();

      return snapshot.docs.map(doc => GeneralPayrollAdjustment.fromFirestore(doc));
    } catch (error) {
      logger.error('❌ Error buscando ajustes por empleado', error);
      throw error;
    }
  }

  /**
   * Cancelar ajuste
   */
  async cancel(cancelledBy, reason = '') {
    try {
      if (this.status === 'cancelled') {
        throw new Error('El ajuste ya está cancelado');
      }

      this.status = 'cancelled';
      this.cancelledBy = cancelledBy;
      this.cancelledAt = new Date().toISOString();
      this.cancellationReason = reason;

      await this.save();

      logger.info('✅ Ajuste de nómina general cancelado', {
        id: this.id,
        generalPayrollId: this.generalPayrollId,
        employeeId: this.employeeId,
        cancelledBy,
        reason
      });

      return this;
    } catch (error) {
      logger.error('❌ Error cancelando ajuste', error);
      throw error;
    }
  }

  /**
   * Obtener descripción del ajuste
   */
  getDescription() {
    const typeDescriptions = {
      'bonus': 'Bono',
      'deduction': 'Deducción',
      'overtime_adjustment': 'Ajuste de Horas Extra',
      'salary_adjustment': 'Ajuste de Salario'
    };

    const typeDesc = typeDescriptions[this.type] || this.type;
    const amountStr = this.amount >= 0 ? `+$${this.amount.toFixed(2)}` : `-$${Math.abs(this.amount).toFixed(2)}`;
    
    return `${typeDesc}: ${this.concept} (${amountStr})`;
  }

  /**
   * Obtener resumen del ajuste
   */
  getSummary() {
    return {
      id: this.id,
      type: this.type,
      concept: this.concept,
      amount: this.amount,
      description: this.getDescription(),
      appliedBy: this.appliedBy,
      appliedAt: this.appliedAt,
      status: this.status,
      reason: this.reason
    };
  }

  /**
   * Eliminar ajuste
   */
  async delete() {
    try {
      await db.collection('generalPayrollAdjustments').doc(this.id).delete();

      logger.info('✅ Ajuste de nómina general eliminado', {
        id: this.id,
        generalPayrollId: this.generalPayrollId,
        employeeId: this.employeeId,
        type: this.type,
        concept: this.concept
      });

      return true;
    } catch (error) {
      logger.error('❌ Error eliminando ajuste', error);
      throw error;
    }
  }

  /**
   * Eliminar todos los ajustes de una nómina general
   */
  static async deleteByGeneralPayroll(generalPayrollId) {
    try {
      const snapshot = await db.collection('generalPayrollAdjustments')
        .where('generalPayrollId', '==', generalPayrollId)
        .get();

      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      logger.info('✅ Todos los ajustes eliminados de nómina general', {
        generalPayrollId,
        deletedCount: snapshot.docs.length
      });

      return snapshot.docs.length;
    } catch (error) {
      logger.error('❌ Error eliminando ajustes de nómina general', error);
      throw error;
    }
  }

  /**
   * Calcular total de ajustes por tipo para un empleado
   */
  static async calculateTotalsByEmployee(generalPayrollId, employeeId) {
    try {
      const adjustments = await this.findByEmployeeInGeneral(generalPayrollId, employeeId);
      
      const totals = adjustments.reduce((acc, adj) => {
        switch (adj.type) {
          case 'bonus':
            acc.totalBonuses += adj.amount;
            break;
          case 'deduction':
            acc.totalDeductions += Math.abs(adj.amount);
            break;
          case 'overtime_adjustment':
            acc.totalOvertimeAdjustments += adj.amount;
            break;
          case 'salary_adjustment':
            acc.totalSalaryAdjustments += adj.amount;
            break;
        }
        return acc;
      }, {
        totalBonuses: 0,
        totalDeductions: 0,
        totalOvertimeAdjustments: 0,
        totalSalaryAdjustments: 0
      });

      return totals;
    } catch (error) {
      logger.error('❌ Error calculando totales de ajustes', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de ajustes por nómina general
   */
  static async getStatsByGeneralPayroll(generalPayrollId) {
    try {
      const adjustments = await this.findByGeneralPayroll(generalPayrollId);
      
      const stats = adjustments.reduce((acc, adj) => {
        acc.totalAdjustments++;
        acc.totalAmount += adj.amount;
        
        if (!acc.byType[adj.type]) {
          acc.byType[adj.type] = { count: 0, amount: 0 };
        }
        acc.byType[adj.type].count++;
        acc.byType[adj.type].amount += adj.amount;
        
        const employeeId = adj.employeeId;
        if (!acc.byEmployee[employeeId]) {
          acc.byEmployee[employeeId] = { count: 0, amount: 0 };
        }
        acc.byEmployee[employeeId].count++;
        acc.byEmployee[employeeId].amount += adj.amount;
        
        return acc;
      }, {
        totalAdjustments: 0,
        totalAmount: 0,
        byType: {},
        byEmployee: {}
      });

      return stats;
    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas de ajustes', error);
      throw error;
    }
  }
}

module.exports = GeneralPayrollAdjustment;
