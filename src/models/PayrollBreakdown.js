const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo de Desglose de Nómina
 * Gestiona el detalle de percepciones y deducciones
 */
class PayrollBreakdown {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.payrollPeriodId = data.payrollPeriodId || '';
    this.employeeId = data.employeeId || '';
    this.type = data.type || 'perception'; // 'perception' | 'deduction'
    this.category = data.category || '';
    this.description = data.description || '';
    this.amount = data.amount || 0;
    this.taxable = data.taxable !== undefined ? data.taxable : true;
    this.exempt = data.exempt !== undefined ? data.exempt : false;
    
    // Metadatos
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Valida los datos del desglose
   */
  validate() {
    const errors = [];

    if (!this.payrollPeriodId) {
      errors.push('El ID del período de nómina es requerido');
    }

    if (!this.employeeId) {
      errors.push('El ID del empleado es requerido');
    }

    const validTypes = ['perception', 'deduction'];
    if (!validTypes.includes(this.type)) {
      errors.push('El tipo debe ser "perception" o "deduction"');
    }

    if (!this.category) {
      errors.push('La categoría es requerida');
    }

    if (!this.description) {
      errors.push('La descripción es requerida');
    }

    if (this.amount < 0) {
      errors.push('El monto no puede ser negativo');
    }

    return errors;
  }

  /**
   * Convierte el modelo a objeto plano para Firebase
   */
  toFirestore() {
    return {
      id: this.id,
      payrollPeriodId: this.payrollPeriodId,
      employeeId: this.employeeId,
      type: this.type,
      category: this.category,
      description: this.description,
      amount: this.amount,
      taxable: this.taxable,
      exempt: this.exempt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crea un desglose desde datos de Firestore
   */
  static fromFirestore(doc) {
    return new PayrollBreakdown({ id: doc.id, ...doc.data() });
  }

  /**
   * Guarda el desglose en Firebase
   */
  async save() {
    try {
      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      this.updatedAt = new Date().toISOString();

      const docRef = db.collection('employees').doc(this.employeeId)
        .collection('payroll').doc(this.payrollPeriodId)
        .collection('breakdown').doc(this.id);
      
      await docRef.set(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error saving payroll breakdown:', error);
      throw error;
    }
  }

  /**
   * Lista desgloses de un período de nómina
   */
  static async listByPeriod(employeeId, payrollPeriodId) {
    try {
      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('payroll').doc(payrollPeriodId)
        .collection('breakdown')
        .orderBy('type')
        .orderBy('category')
        .get();

      const breakdowns = [];
      snapshot.forEach(doc => {
        breakdowns.push(PayrollBreakdown.fromFirestore(doc));
      });

      return breakdowns;
    } catch (error) {
      console.error('Error listing payroll breakdowns:', error);
      throw error;
    }
  }

  /**
   * Obtiene desgloses por tipo
   */
  static async getByType(employeeId, payrollPeriodId, type) {
    try {
      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('payroll').doc(payrollPeriodId)
        .collection('breakdown')
        .where('type', '==', type)
        .orderBy('category')
        .get();

      const breakdowns = [];
      snapshot.forEach(doc => {
        breakdowns.push(PayrollBreakdown.fromFirestore(doc));
      });

      return breakdowns;
    } catch (error) {
      console.error('Error getting breakdowns by type:', error);
      throw error;
    }
  }

  /**
   * Calcula totales de un período
   */
  static async calculateTotals(employeeId, payrollPeriodId) {
    try {
      const snapshot = await db.collection('employees').doc(employeeId)
        .collection('payroll').doc(payrollPeriodId)
        .collection('breakdown')
        .get();

      const totals = {
        perceptions: 0,
        deductions: 0,
        taxablePerceptions: 0,
        exemptPerceptions: 0
      };

      snapshot.forEach(doc => {
        const breakdown = doc.data();
        
        if (breakdown.type === 'perception') {
          totals.perceptions += breakdown.amount;
          
          if (breakdown.taxable) {
            totals.taxablePerceptions += breakdown.amount;
          }
          
          if (breakdown.exempt) {
            totals.exemptPerceptions += breakdown.amount;
          }
        } else if (breakdown.type === 'deduction') {
          totals.deductions += breakdown.amount;
        }
      });

      return totals;
    } catch (error) {
      console.error('Error calculating breakdown totals:', error);
      throw error;
    }
  }

  /**
   * Categorías predefinidas de percepciones
   */
  static getPerceptionCategories() {
    return [
      'Sueldo Base',
      'Horas Extra',
      'Bono de Productividad',
      'Comisiones',
      'Aguinaldo',
      'Prima Vacacional',
      'Prima Dominical',
      'Bono de Puntualidad',
      'Bono de Asistencia',
      'Compensación',
      'Otros Ingresos'
    ];
  }

  /**
   * Categorías predefinidas de deducciones
   */
  static getDeductionCategories() {
    return [
      'ISR',
      'IMSS',
      'INFONAVIT',
      'AFORE',
      'Seguro de Vida',
      'Fondo de Ahorro',
      'Préstamo Personal',
      'Descuento por Faltas',
      'Descuento por Retardos',
      'Otras Deducciones'
    ];
  }
}

module.exports = PayrollBreakdown;
