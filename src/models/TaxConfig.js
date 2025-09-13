const { db } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Modelo TaxConfig - Configuración de impuestos y deducciones
 * Maneja impuestos opcionales tanto globales como por empleado
 */
class TaxConfig {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.name = data.name || ''; // 'ISR', 'IMSS', 'IVA', etc.
    this.displayName = data.displayName || ''; // Nombre para mostrar
    this.description = data.description || '';
    this.type = data.type || 'percentage'; // 'percentage' | 'fixed' | 'progressive'
    this.value = data.value || 0; // Porcentaje o monto fijo
    this.category = data.category || 'federal'; // 'federal' | 'state' | 'municipal' | 'custom' | 'company'
    this.isEnabled = data.isEnabled !== undefined ? data.isEnabled : true;
    this.isCustom = data.isCustom !== undefined ? data.isCustom : false;
    this.isOptional = data.isOptional !== undefined ? data.isOptional : true;
    
    // Configuración avanzada
    this.minAmount = data.minAmount || 0; // Monto mínimo para aplicar
    this.maxAmount = data.maxAmount || null; // Monto máximo (null = sin límite)
    this.baseOn = data.baseOn || 'gross'; // 'gross' | 'net' | 'sbc' - sobre qué se calcula
    this.priority = data.priority || 0; // Orden de aplicación (menor = primero)
    
    // Configuración progresiva (para ISR)
    this.brackets = data.brackets || []; // Array de tramos para cálculo progresivo
    
    // Configuración condicional
    this.conditions = data.conditions || {}; // Condiciones para aplicar el impuesto
    
    // Metadatos
    this.scope = data.scope || 'global'; // 'global' | 'employee' - si es configuración global o por empleado
    this.employeeId = data.employeeId || null; // Solo si scope = 'employee'
    this.companyId = data.companyId || 'default';
    this.country = data.country || 'MX';
    this.region = data.region || '';
    
    // Auditoría
    this.createdBy = data.createdBy;
    this.updatedBy = data.updatedBy;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Convertir a formato Firestore
   */
  toFirestore() {
    return {
      id: this.id,
      name: this.name,
      displayName: this.displayName,
      description: this.description,
      type: this.type,
      value: this.value,
      category: this.category,
      isEnabled: this.isEnabled,
      isCustom: this.isCustom,
      isOptional: this.isOptional,
      minAmount: this.minAmount,
      maxAmount: this.maxAmount,
      baseOn: this.baseOn,
      priority: this.priority,
      brackets: this.brackets,
      conditions: this.conditions,
      scope: this.scope,
      employeeId: this.employeeId,
      companyId: this.companyId,
      country: this.country,
      region: this.region,
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
    return new TaxConfig({
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
      const collection = this.scope === 'employee' ? 
        `employees/${this.employeeId}/taxConfigs` : 
        'globalTaxConfigs';
      
      await db.collection(collection).doc(this.id).set(this.toFirestore());
      
      logger.info('✅ Configuración de impuesto guardada', {
        configId: this.id,
        name: this.name,
        scope: this.scope,
        employeeId: this.employeeId
      });
      
      return this;
    } catch (error) {
      logger.error('❌ Error guardando configuración de impuesto', error);
      throw error;
    }
  }

  /**
   * Buscar configuraciones globales
   */
  static async findGlobal(companyId = 'default') {
    try {
      const snapshot = await db.collection('globalTaxConfigs')
        .where('companyId', '==', companyId)
        .where('isEnabled', '==', true)
        .orderBy('priority', 'asc')
        .get();

      return snapshot.docs.map(doc => TaxConfig.fromFirestore(doc));
    } catch (error) {
      logger.error('❌ Error buscando configuraciones globales', error);
      throw error;
    }
  }

  /**
   * Buscar configuraciones por empleado
   */
  static async findByEmployee(employeeId) {
    try {
      const snapshot = await db.collection(`employees/${employeeId}/taxConfigs`)
        .where('isEnabled', '==', true)
        .orderBy('priority', 'asc')
        .get();

      return snapshot.docs.map(doc => TaxConfig.fromFirestore(doc));
    } catch (error) {
      logger.error('❌ Error buscando configuraciones por empleado', error);
      throw error;
    }
  }

  /**
   * Obtener configuración efectiva para un empleado (combina global + empleado)
   */
  static async getEffectiveConfig(employeeId, companyId = 'default') {
    try {
      // Obtener configuraciones globales
      const globalConfigs = await TaxConfig.findGlobal(companyId);
      
      // Obtener configuraciones específicas del empleado
      const employeeConfigs = await TaxConfig.findByEmployee(employeeId);
      
      // Combinar configuraciones (empleado override global)
      const configMap = new Map();
      
      // Primero agregar configuraciones globales
      globalConfigs.forEach(config => {
        configMap.set(config.name, config);
      });
      
      // Luego override con configuraciones del empleado
      employeeConfigs.forEach(config => {
        configMap.set(config.name, config);
      });
      
      // Convertir a array y ordenar por prioridad
      return Array.from(configMap.values()).sort((a, b) => a.priority - b.priority);
    } catch (error) {
      logger.error('❌ Error obteniendo configuración efectiva', error);
      throw error;
    }
  }

  /**
   * Calcular impuesto basado en la configuración
   */
  calculate(baseAmount, grossSalary = 0, netSalary = 0, sbc = 0) {
    try {
      // Verificar monto mínimo
      if (baseAmount < this.minAmount) {
        return 0;
      }

      // Verificar monto máximo
      if (this.maxAmount && baseAmount > this.maxAmount) {
        baseAmount = this.maxAmount;
      }

      // Determinar base de cálculo
      let calculationBase = baseAmount;
      switch (this.baseOn) {
        case 'gross':
          calculationBase = grossSalary;
          break;
        case 'net':
          calculationBase = netSalary;
          break;
        case 'sbc':
          calculationBase = sbc;
          break;
        default:
          calculationBase = baseAmount;
      }

      // Calcular según tipo
      switch (this.type) {
        case 'percentage':
          return calculationBase * (this.value / 100);
        
        case 'fixed':
          return this.value;
        
        case 'progressive':
          return this.calculateProgressive(calculationBase);
        
        default:
          return 0;
      }
    } catch (error) {
      logger.error('❌ Error calculando impuesto', error);
      return 0;
    }
  }

  /**
   * Calcular impuesto progresivo (como ISR)
   */
  calculateProgressive(amount) {
    let tax = 0;
    let remainingAmount = amount;

    for (const bracket of this.brackets) {
      if (remainingAmount <= 0) break;

      const bracketAmount = Math.min(remainingAmount, bracket.upper - bracket.lower);
      tax += bracketAmount * (bracket.rate / 100);
      remainingAmount -= bracketAmount;
    }

    return tax;
  }

  /**
   * Crear configuraciones por defecto para México
   */
  static async createDefaultMexicoTaxes(companyId = 'default', userId) {
    const defaultTaxes = [
      {
        name: 'ISR',
        displayName: 'Impuesto Sobre la Renta',
        description: 'Impuesto federal sobre ingresos',
        type: 'progressive',
        category: 'federal',
        priority: 1,
        isOptional: true,
        baseOn: 'gross',
        brackets: [
          { lower: 0, upper: 8952.49, rate: 0 },
          { lower: 8952.49, upper: 75984.55, rate: 10.67 },
          { lower: 75984.55, upper: 133536.07, rate: 16 },
          { lower: 133536.07, upper: 155229.80, rate: 21.33 },
          { lower: 155229.80, upper: 185852.57, rate: 25.33 },
          { lower: 185852.57, upper: 374837.88, rate: 30 },
          { lower: 374837.88, upper: Infinity, rate: 35 }
        ]
      },
      {
        name: 'IMSS',
        displayName: 'Instituto Mexicano del Seguro Social',
        description: 'Cuotas del IMSS',
        type: 'percentage',
        value: 12.5,
        category: 'federal',
        priority: 2,
        isOptional: true,
        baseOn: 'sbc'
      },
      {
        name: 'IVA',
        displayName: 'Impuesto al Valor Agregado',
        description: 'IVA sobre servicios profesionales',
        type: 'percentage',
        value: 16,
        category: 'federal',
        priority: 3,
        isOptional: true,
        baseOn: 'gross'
      },
      {
        name: 'INFONAVIT',
        displayName: 'Instituto del Fondo Nacional de la Vivienda',
        description: 'Aportación para vivienda',
        type: 'percentage',
        value: 5,
        category: 'federal',
        priority: 4,
        isOptional: true,
        baseOn: 'sbc'
      }
    ];

    const createdTaxes = [];
    for (const taxData of defaultTaxes) {
      const tax = new TaxConfig({
        ...taxData,
        companyId,
        scope: 'global',
        createdBy: userId,
        updatedBy: userId
      });
      
      await tax.save();
      createdTaxes.push(tax);
    }

    return createdTaxes;
  }

  /**
   * Validar configuración
   */
  validate() {
    const errors = [];

    if (!this.name) errors.push('Nombre del impuesto es requerido');
    if (!this.displayName) errors.push('Nombre para mostrar es requerido');
    if (!['percentage', 'fixed', 'progressive'].includes(this.type)) {
      errors.push('Tipo debe ser: percentage, fixed o progressive');
    }
    if (this.type !== 'progressive' && this.value < 0) {
      errors.push('Valor no puede ser negativo');
    }
    if (this.minAmount < 0) errors.push('Monto mínimo no puede ser negativo');
    if (this.maxAmount && this.maxAmount < this.minAmount) {
      errors.push('Monto máximo debe ser mayor al mínimo');
    }
    if (!['gross', 'net', 'sbc'].includes(this.baseOn)) {
      errors.push('Base de cálculo debe ser: gross, net o sbc');
    }
    if (this.scope === 'employee' && !this.employeeId) {
      errors.push('ID de empleado es requerido para configuración individual');
    }

    return errors;
  }

  /**
   * Eliminar configuración
   */
  async delete() {
    try {
      const collection = this.scope === 'employee' ? 
        `employees/${this.employeeId}/taxConfigs` : 
        'globalTaxConfigs';
      
      await db.collection(collection).doc(this.id).delete();
      
      logger.info('✅ Configuración de impuesto eliminada', {
        configId: this.id,
        name: this.name,
        scope: this.scope
      });
      
      return true;
    } catch (error) {
      logger.error('❌ Error eliminando configuración de impuesto', error);
      throw error;
    }
  }
}

module.exports = TaxConfig;
