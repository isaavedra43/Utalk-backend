const { db } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

/**
 * Modelo PayrollConfig - Configuración de nómina por empleado
 * Maneja la configuración de frecuencia de pago y salarios base
 */
class PayrollConfig {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.employeeId = data.employeeId;
    this.frequency = data.frequency || 'monthly'; // 'daily', 'weekly', 'biweekly', 'monthly'
    this.baseSalary = data.baseSalary || 0; // Salario base mensual
    this.sbc = data.sbc || 0; // Salario Base de Cotización
    this.startDate = data.startDate; // Fecha de inicio de la configuración
    this.endDate = data.endDate || null; // Fecha de fin (null si está activa)
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.workingDaysPerWeek = data.workingDaysPerWeek || 5; // Días laborales por semana
    this.workingHoursPerDay = data.workingHoursPerDay || 8; // Horas laborales por día
    this.overtimeRate = data.overtimeRate || 1.5; // Multiplicador para horas extra
    this.currency = data.currency || 'MXN'; // Moneda
    this.paymentMethod = data.paymentMethod || 'transfer'; // 'transfer', 'cash', 'check'
    this.bankAccount = data.bankAccount || null; // Cuenta bancaria
    this.taxRegime = data.taxRegime || 'general'; // Régimen fiscal
    this.notes = data.notes || ''; // Notas adicionales
    this.createdBy = data.createdBy; // Usuario que creó la configuración
    this.updatedBy = data.updatedBy; // Usuario que actualizó por última vez
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
      frequency: this.frequency,
      baseSalary: this.baseSalary,
      sbc: this.sbc,
      startDate: this.startDate,
      endDate: this.endDate,
      isActive: this.isActive,
      workingDaysPerWeek: this.workingDaysPerWeek,
      workingHoursPerDay: this.workingHoursPerDay,
      overtimeRate: this.overtimeRate,
      currency: this.currency,
      paymentMethod: this.paymentMethod,
      bankAccount: this.bankAccount,
      taxRegime: this.taxRegime,
      notes: this.notes,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crear desde documento Firestore
   */
  static fromFirestore(doc) {
    const data = doc.data();
    return new PayrollConfig({
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
      await db.collection('payrollConfigs').doc(this.id).set(this.toFirestore());
      logger.info('✅ Configuración de nómina guardada', {
        configId: this.id,
        employeeId: this.employeeId,
        frequency: this.frequency,
        baseSalary: this.baseSalary
      });
      return this;
    } catch (error) {
      logger.error('❌ Error guardando configuración de nómina', error);
      throw error;
    }
  }

  /**
   * Buscar por ID
   */
  static async findById(id) {
    try {
      const doc = await db.collection('payrollConfigs').doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return PayrollConfig.fromFirestore(doc);
    } catch (error) {
      logger.error('❌ Error buscando configuración por ID', error);
      throw error;
    }
  }

  /**
   * Buscar configuración activa por empleado
   */
  static async findActiveByEmployee(employeeId) {
    try {
      const snapshot = await db.collection('payrollConfigs')
        .where('employeeId', '==', employeeId)
        .where('isActive', '==', true)
        .orderBy('startDate', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      return PayrollConfig.fromFirestore(snapshot.docs[0]);
    } catch (error) {
      logger.error('❌ Error buscando configuración activa', error);
      throw error;
    }
  }

  /**
   * Buscar todas las configuraciones por empleado
   */
  static async findByEmployee(employeeId) {
    try {
      const snapshot = await db.collection('payrollConfigs')
        .where('employeeId', '==', employeeId)
        .orderBy('startDate', 'desc')
        .get();

      return snapshot.docs.map(doc => PayrollConfig.fromFirestore(doc));
    } catch (error) {
      logger.error('❌ Error buscando configuraciones por empleado', error);
      throw error;
    }
  }

  /**
   * Buscar configuraciones por frecuencia
   */
  static async findByFrequency(frequency) {
    try {
      const snapshot = await db.collection('payrollConfigs')
        .where('frequency', '==', frequency)
        .where('isActive', '==', true)
        .get();

      return snapshot.docs.map(doc => PayrollConfig.fromFirestore(doc));
    } catch (error) {
      logger.error('❌ Error buscando configuraciones por frecuencia', error);
      throw error;
    }
  }

  /**
   * Obtener todas las configuraciones activas
   */
  static async findAllActive() {
    try {
      const snapshot = await db.collection('payrollConfigs')
        .where('isActive', '==', true)
        .get();

      return snapshot.docs.map(doc => PayrollConfig.fromFirestore(doc));
    } catch (error) {
      logger.error('❌ Error buscando configuraciones activas', error);
      throw error;
    }
  }

  /**
   * Desactivar configuración actual y activar nueva
   */
  async replaceWith(newConfigData, userId) {
    try {
      // Desactivar configuración actual
      this.isActive = false;
      this.endDate = new Date().toISOString();
      this.updatedBy = userId;
      await this.save();

      // Crear nueva configuración
      const newConfig = new PayrollConfig({
        ...newConfigData,
        employeeId: this.employeeId,
        startDate: new Date().toISOString(),
        isActive: true,
        createdBy: userId,
        updatedBy: userId
      });

      await newConfig.save();

      logger.info('✅ Configuración de nómina reemplazada', {
        oldConfigId: this.id,
        newConfigId: newConfig.id,
        employeeId: this.employeeId
      });

      return newConfig;
    } catch (error) {
      logger.error('❌ Error reemplazando configuración', error);
      throw error;
    }
  }

  /**
   * Calcular salario por período según frecuencia
   */
  calculateSalaryForPeriod() {
    switch (this.frequency) {
      case 'daily':
        return this.baseSalary / 30; // 30 días por mes
      case 'weekly':
        return this.baseSalary / 4; // 4 semanas por mes
      case 'biweekly':
        return this.baseSalary / 2; // 2 quincenas por mes
      case 'monthly':
        return this.baseSalary;
      default:
        return this.baseSalary;
    }
  }

  /**
   * Calcular salario por hora
   */
  calculateHourlySalary() {
    const workingDaysPerMonth = this.workingDaysPerWeek * 4; // Aproximadamente 20 días
    const workingHoursPerMonth = workingDaysPerMonth * this.workingHoursPerDay; // Aproximadamente 160 horas
    return this.baseSalary / workingHoursPerMonth;
  }

  /**
   * Validar configuración
   */
  validate() {
    const errors = [];

    if (!this.employeeId) errors.push('ID de empleado es requerido');
    if (!this.frequency) errors.push('Frecuencia de pago es requerida');
    if (!['daily', 'weekly', 'biweekly', 'monthly'].includes(this.frequency)) {
      errors.push('Frecuencia debe ser: daily, weekly, biweekly o monthly');
    }
    if (!this.startDate) errors.push('Fecha de inicio es requerida');
    if (this.baseSalary <= 0) errors.push('Salario base debe ser mayor a 0');
    if (this.sbc < 0) errors.push('SBC no puede ser negativo');
    if (this.workingDaysPerWeek < 1 || this.workingDaysPerWeek > 7) {
      errors.push('Días laborales por semana debe estar entre 1 y 7');
    }
    if (this.workingHoursPerDay < 1 || this.workingHoursPerDay > 24) {
      errors.push('Horas laborales por día debe estar entre 1 y 24');
    }
    if (this.overtimeRate < 1) {
      errors.push('Multiplicador de horas extra debe ser mayor o igual a 1');
    }

    return errors;
  }

  /**
   * Desactivar configuración
   */
  async deactivate(userId) {
    try {
      this.isActive = false;
      this.endDate = new Date().toISOString();
      this.updatedBy = userId;
      await this.save();

      logger.info('✅ Configuración de nómina desactivada', {
        configId: this.id,
        employeeId: this.employeeId
      });

      return this;
    } catch (error) {
      logger.error('❌ Error desactivando configuración', error);
      throw error;
    }
  }

  /**
   * Activar configuración
   */
  async activate(userId) {
    try {
      // Primero desactivar otras configuraciones del mismo empleado
      const activeConfigs = await PayrollConfig.findByEmployee(this.employeeId);
      for (const config of activeConfigs) {
        if (config.id !== this.id && config.isActive) {
          await config.deactivate(userId);
        }
      }

      // Activar esta configuración
      this.isActive = true;
      this.endDate = null;
      this.updatedBy = userId;
      await this.save();

      logger.info('✅ Configuración de nómina activada', {
        configId: this.id,
        employeeId: this.employeeId
      });

      return this;
    } catch (error) {
      logger.error('❌ Error activando configuración', error);
      throw error;
    }
  }

  /**
   * Eliminar configuración
   */
  async delete() {
    try {
      await db.collection('payrollConfigs').doc(this.id).delete();
      logger.info('✅ Configuración de nómina eliminada', {
        configId: this.id,
        employeeId: this.employeeId
      });
      return true;
    } catch (error) {
      logger.error('❌ Error eliminando configuración', error);
      throw error;
    }
  }
}

module.exports = PayrollConfig;
