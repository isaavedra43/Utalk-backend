const { db } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../config/logger');

/**
 * Modelo PayrollDetail - Detalles de percepciones y deducciones de nómina
 * Maneja los conceptos individuales que componen cada período de nómina
 */
class PayrollDetail {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.payrollId = data.payrollId; // ID del período de nómina
    this.employeeId = data.employeeId; // ID del empleado (para consultas directas)
    this.type = data.type; // 'perception' | 'deduction'
    this.concept = data.concept; // Concepto del detalle
    this.amount = data.amount || 0; // Monto del concepto
    this.description = data.description || ''; // Descripción adicional
    this.category = data.category || 'other'; // Categoría del concepto
    this.isFixed = data.isFixed || false; // Si es un concepto fijo (ISR, IMSS, etc.)
    this.isTaxable = data.isTaxable !== undefined ? data.isTaxable : true; // Si es gravable
    this.extraId = data.extraId || null; // Referencia al extra si aplica
    this.formula = data.formula || null; // Fórmula de cálculo si aplica
    this.percentage = data.percentage || null; // Porcentaje si aplica
    this.baseAmount = data.baseAmount || null; // Monto base para cálculo
    this.order = data.order || 0; // Orden de visualización
    this.notes = data.notes || ''; // Notas adicionales
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Convertir a formato Firestore
   */
  toFirestore() {
    return {
      id: this.id,
      payrollId: this.payrollId,
      employeeId: this.employeeId,
      type: this.type,
      concept: this.concept,
      amount: this.amount,
      description: this.description,
      category: this.category,
      isFixed: this.isFixed,
      isTaxable: this.isTaxable,
      extraId: this.extraId,
      formula: this.formula,
      percentage: this.percentage,
      baseAmount: this.baseAmount,
      order: this.order,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crear desde documento Firestore
   */
  static fromFirestore(doc) {
    const data = doc.data();
    return new PayrollDetail({
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
      await db.collection('payrollDetails').doc(this.id).set(this.toFirestore());
      logger.info('✅ Detalle de nómina guardado', {
        detailId: this.id,
        payrollId: this.payrollId,
        concept: this.concept,
        amount: this.amount
      });
      return this;
    } catch (error) {
      logger.error('❌ Error guardando detalle de nómina', error);
      throw error;
    }
  }

  /**
   * Buscar por ID
   */
  static async findById(id) {
    try {
      const doc = await db.collection('payrollDetails').doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return PayrollDetail.fromFirestore(doc);
    } catch (error) {
      logger.error('❌ Error buscando detalle por ID', error);
      throw error;
    }
  }

  /**
   * Buscar detalles por período de nómina
   */
  static async findByPayroll(payrollId) {
    try {
      const snapshot = await db.collection('payrollDetails')
        .where('payrollId', '==', payrollId)
        .orderBy('order', 'asc')
        .orderBy('concept', 'asc')
        .get();

      return snapshot.docs.map(doc => PayrollDetail.fromFirestore(doc));
    } catch (error) {
      logger.error('❌ Error buscando detalles por nómina', error);
      throw error;
    }
  }

  /**
   * Buscar detalles por empleado
   */
  static async findByEmployee(employeeId, limit = 100) {
    try {
      const snapshot = await db.collection('payrollDetails')
        .where('employeeId', '==', employeeId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => PayrollDetail.fromFirestore(doc));
    } catch (error) {
      logger.error('❌ Error buscando detalles por empleado', error);
      throw error;
    }
  }

  /**
   * Buscar detalles por tipo
   */
  static async findByPayrollAndType(payrollId, type) {
    try {
      const snapshot = await db.collection('payrollDetails')
        .where('payrollId', '==', payrollId)
        .where('type', '==', type)
        .orderBy('order', 'asc')
        .orderBy('concept', 'asc')
        .get();

      return snapshot.docs.map(doc => PayrollDetail.fromFirestore(doc));
    } catch (error) {
      logger.error('❌ Error buscando detalles por tipo', error);
      throw error;
    }
  }

  /**
   * Buscar percepciones por nómina
   */
  static async findPerceptionsByPayroll(payrollId) {
    return await PayrollDetail.findByPayrollAndType(payrollId, 'perception');
  }

  /**
   * Buscar deducciones por nómina
   */
  static async findDeductionsByPayroll(payrollId) {
    return await PayrollDetail.findByPayrollAndType(payrollId, 'deduction');
  }

  /**
   * Crear detalle desde extra
   */
  static async createFromExtra(payrollId, employeeId, extra) {
    try {
      const type = extra.getImpactType() === 'positive' ? 'perception' : 'deduction';
      const category = PayrollDetail.getCategoryFromExtraType(extra.type);
      
      const detail = new PayrollDetail({
        payrollId,
        employeeId,
        type,
        concept: PayrollDetail.getConceptFromExtraType(extra.type),
        amount: Math.abs(extra.calculatedAmount || extra.amount),
        description: extra.reason || extra.justification || '',
        category,
        isFixed: false,
        isTaxable: PayrollDetail.isTaxableExtraType(extra.type),
        extraId: extra.id,
        notes: `Generado automáticamente desde extra: ${extra.type}`
      });

      await detail.save();
      return detail;
    } catch (error) {
      logger.error('❌ Error creando detalle desde extra', error);
      throw error;
    }
  }

  /**
   * Crear detalles fijos (ISR, IMSS, etc.)
   */
  static async createFixedDeductions(payrollId, employeeId, grossSalary, sbc) {
    try {
      const fixedDeductions = [];

      // ISR (Impuesto Sobre la Renta) - Cálculo simplificado
      const isrAmount = PayrollDetail.calculateISR(grossSalary);
      if (isrAmount > 0) {
        const isrDetail = new PayrollDetail({
          payrollId,
          employeeId,
          type: 'deduction',
          concept: 'ISR',
          amount: isrAmount,
          description: 'Impuesto Sobre la Renta',
          category: 'tax',
          isFixed: true,
          isTaxable: false,
          formula: 'ISR_TABLE',
          baseAmount: grossSalary,
          order: 1
        });
        fixedDeductions.push(isrDetail);
      }

      // IMSS (Instituto Mexicano del Seguro Social)
      const imssAmount = PayrollDetail.calculateIMSS(sbc);
      if (imssAmount > 0) {
        const imssDetail = new PayrollDetail({
          payrollId,
          employeeId,
          type: 'deduction',
          concept: 'IMSS',
          amount: imssAmount,
          description: 'Cuotas del IMSS',
          category: 'social_security',
          isFixed: true,
          isTaxable: false,
          formula: 'IMSS_RATE',
          baseAmount: sbc,
          percentage: 0.0725, // 7.25% aproximado
          order: 2
        });
        fixedDeductions.push(imssDetail);
      }

      // Guardar todos los detalles
      for (const detail of fixedDeductions) {
        await detail.save();
      }

      return fixedDeductions;
    } catch (error) {
      logger.error('❌ Error creando deducciones fijas', error);
      throw error;
    }
  }

  /**
   * Calcular ISR simplificado
   */
  static calculateISR(grossSalary) {
    // Tabla simplificada de ISR mensual 2024
    if (grossSalary <= 8952.49) return 0;
    if (grossSalary <= 75984.55) return (grossSalary - 8952.49) * 0.1067 - 0;
    if (grossSalary <= 133536.07) return (grossSalary - 75984.55) * 0.16 + 7140.73;
    if (grossSalary <= 155229.80) return (grossSalary - 133536.07) * 0.2133 + 16348.99;
    if (grossSalary <= 185852.57) return (grossSalary - 155229.80) * 0.2533 + 20973.75;
    if (grossSalary <= 374837.88) return (grossSalary - 185852.57) * 0.3) + 28728.04;
    return (grossSalary - 374837.88) * 0.35 + 85424.19;
  }

  /**
   * Calcular IMSS simplificado
   */
  static calculateIMSS(sbc) {
    // Cálculo simplificado del IMSS (7.25% aproximado del trabajador)
    return sbc * 0.0725;
  }

  /**
   * Obtener categoría desde tipo de extra
   */
  static getCategoryFromExtraType(extraType) {
    const categoryMap = {
      overtime: 'overtime',
      bonus: 'bonus',
      loan: 'loan',
      absence: 'absence',
      deduction: 'deduction',
      discount: 'discount',
      damage: 'damage'
    };
    return categoryMap[extraType] || 'other';
  }

  /**
   * Obtener concepto desde tipo de extra
   */
  static getConceptFromExtraType(extraType) {
    const conceptMap = {
      overtime: 'Horas Extra',
      bonus: 'Bono',
      loan: 'Préstamo',
      absence: 'Falta',
      deduction: 'Deducción',
      discount: 'Descuento',
      damage: 'Daño/Rotura'
    };
    return conceptMap[extraType] || 'Otro';
  }

  /**
   * Verificar si un tipo de extra es gravable
   */
  static isTaxableExtraType(extraType) {
    const nonTaxableTypes = ['loan']; // Los préstamos no son gravables
    return !nonTaxableTypes.includes(extraType);
  }

  /**
   * Eliminar todos los detalles de una nómina
   */
  static async deleteByPayroll(payrollId) {
    try {
      const details = await PayrollDetail.findByPayroll(payrollId);
      for (const detail of details) {
        await detail.delete();
      }
      
      logger.info('✅ Detalles de nómina eliminados', {
        payrollId,
        count: details.length
      });
      
      return details.length;
    } catch (error) {
      logger.error('❌ Error eliminando detalles de nómina', error);
      throw error;
    }
  }

  /**
   * Validar detalle
   */
  validate() {
    const errors = [];

    if (!this.payrollId) errors.push('ID de nómina es requerido');
    if (!this.employeeId) errors.push('ID de empleado es requerido');
    if (!this.type) errors.push('Tipo es requerido');
    if (!['perception', 'deduction'].includes(this.type)) {
      errors.push('Tipo debe ser perception o deduction');
    }
    if (!this.concept) errors.push('Concepto es requerido');
    if (this.amount < 0) errors.push('Monto no puede ser negativo');

    return errors;
  }

  /**
   * Eliminar detalle
   */
  async delete() {
    try {
      await db.collection('payrollDetails').doc(this.id).delete();
      logger.info('✅ Detalle de nómina eliminado', {
        detailId: this.id,
        concept: this.concept
      });
      return true;
    } catch (error) {
      logger.error('❌ Error eliminando detalle de nómina', error);
      throw error;
    }
  }
}

module.exports = PayrollDetail;
