const Payroll = require('../models/Payroll');
const PayrollConfig = require('../models/PayrollConfig');
const PayrollDetail = require('../models/PayrollDetail');
const PayrollMovement = require('../models/PayrollMovement');
const TaxConfig = require('../models/TaxConfig');
const Employee = require('../models/Employee');
const logger = require('../utils/logger');

/**
 * 🆕 Servicio Mejorado de Nómina - Con Impuestos Opcionales e Integración con Extras
 * Maneja cálculos avanzados, control de duplicados y configuración flexible de impuestos
 */
class EnhancedPayrollService {
  /**
   * 🆕 Generar nómina con impuestos opcionales e integración de extras
   */
  static async generateAdvancedPayroll(employeeId, periodDate = new Date(), options = {}) {
    try {
      logger.info('🚀 Generando nómina avanzada', { 
        employeeId, 
        periodDate: periodDate.toISOString(),
        options 
      });

      // 1. Verificar empleado y configuración
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Empleado no encontrado');
      }

      const config = await PayrollConfig.findActiveByEmployee(employeeId);
      if (!config) {
        throw new Error('No hay configuración de nómina activa para este empleado');
      }

      // 2. Calcular período de nómina
      const period = this.calculatePayrollPeriod(periodDate, config.frequency);
      
      // 3. Verificar si ya existe nómina para este período
      const existingPayroll = await Payroll.findByEmployeeAndPeriod(
        employeeId, 
        period.startDate, 
        period.endDate
      );

      if (existingPayroll && !options.forceRegenerate) {
        throw new Error(`Ya existe nómina para el período ${period.startDate} - ${period.endDate}`);
      }

      // 4. 🆕 OBTENER MOVIMIENTOS DE EXTRAS PENDIENTES
      const extrasMovements = await PayrollMovement.findPendingForPeriod(
        employeeId, 
        period.startDate, 
        period.endDate
      );

      // 5. 🆕 VERIFICAR DUPLICADOS EN MOVIMIENTOS
      const duplicateCheck = await this.checkForDuplicateMovements(extrasMovements);
      if (duplicateCheck.hasDuplicates && !options.ignoreDuplicates) {
        logger.warn('⚠️ Duplicados detectados en movimientos', duplicateCheck);
      }

      // 6. 🆕 OBTENER CONFIGURACIÓN DE IMPUESTOS EFECTIVA
      const taxConfigs = await TaxConfig.getEffectiveConfig(employeeId);

      // 7. Calcular salario base para el período
      const baseSalary = config.calculateSalaryForPeriod();

      // 8. 🆕 CALCULAR PERCEPCIONES (incluyendo extras)
      const perceptions = await this.calculatePerceptions(
        baseSalary, 
        extrasMovements, 
        config, 
        period
      );

      // 9. 🆕 CALCULAR DEDUCCIONES (impuestos opcionales + extras negativos)
      const deductions = await this.calculateDeductions(
        perceptions.total, 
        extrasMovements, 
        taxConfigs, 
        config
      );

      // 10. Calcular salario neto
      const netSalary = perceptions.total - deductions.total;

      // 11. Crear registro de nómina
      const payroll = new Payroll({
        employeeId,
        configId: config.id,
        frequency: config.frequency,
        periodStart: period.startDate,
        periodEnd: period.endDate,
        month: period.month,
        year: period.year,
        workingDays: period.workingDays,
        grossSalary: perceptions.total,
        totalDeductions: deductions.total,
        netSalary: netSalary,
        status: 'generated',
        generatedAt: new Date().toISOString(),
        generatedBy: options.userId || 'system'
      });

      await payroll.save();

      // 12. 🆕 CREAR DETALLES DE NÓMINA CON TRACKING
      const payrollDetails = await this.createPayrollDetails(
        payroll.id, 
        perceptions, 
        deductions, 
        extrasMovements
      );

      // 13. 🆕 MARCAR MOVIMIENTOS COMO APLICADOS
      await this.markMovementsAsApplied(extrasMovements, payroll.id, period);

      logger.info('✅ Nómina avanzada generada exitosamente', {
        payrollId: payroll.id,
        employeeId,
        period: `${period.startDate} - ${period.endDate}`,
        grossSalary: perceptions.total,
        totalDeductions: deductions.total,
        netSalary,
        extrasApplied: extrasMovements.length,
        taxesApplied: deductions.taxes.length
      });

      return {
        payroll,
        details: payrollDetails,
        summary: {
          period,
          perceptions,
          deductions,
          netSalary,
          extrasApplied: extrasMovements.length,
          taxesApplied: deductions.taxes.length,
          duplicatesFound: duplicateCheck.duplicates.length
        }
      };

    } catch (error) {
      logger.error('❌ Error generando nómina avanzada', error);
      throw error;
    }
  }

  /**
   * 🆕 Calcular percepciones incluyendo movimientos de extras
   */
  static async calculatePerceptions(baseSalary, extrasMovements, config, period) {
    const perceptions = {
      baseSalary,
      extras: 0,
      overtime: 0,
      bonuses: 0,
      other: 0,
      total: baseSalary,
      details: [
        {
          concept: 'Sueldo Base',
          description: `Salario base calculado para frecuencia ${config.frequency}`,
          amount: baseSalary,
          type: 'base'
        }
      ]
    };

    // Procesar movimientos de extras positivos
    const positiveMovements = extrasMovements.filter(m => m.impactType === 'add');
    
    for (const movement of positiveMovements) {
      const amount = movement.calculatedAmount || movement.amount;
      
      switch (movement.type) {
        case 'overtime':
          perceptions.overtime += amount;
          break;
        case 'bonus':
          perceptions.bonuses += amount;
          break;
        default:
          perceptions.other += amount;
      }

      perceptions.extras += amount;
      perceptions.details.push({
        concept: movement.type === 'overtime' ? 'Horas Extra' : 
                movement.type === 'bonus' ? 'Bono' : 'Otros',
        description: movement.description || `${movement.type} - ${movement.reason}`,
        amount,
        type: movement.type,
        movementId: movement.id,
        date: movement.date
      });
    }

    perceptions.total = baseSalary + perceptions.extras;

    return perceptions;
  }

  /**
   * 🆕 Calcular deducciones con impuestos opcionales
   */
  static async calculateDeductions(grossSalary, extrasMovements, taxConfigs, config) {
    const deductions = {
      taxes: [],
      extras: 0,
      loans: 0,
      discounts: 0,
      other: 0,
      total: 0,
      details: []
    };

    // 1. 🆕 CALCULAR IMPUESTOS OPCIONALES
    const enabledTaxes = config.taxSettings?.enabledTaxes || [];
    const taxOverrides = config.taxSettings?.taxOverrides || {};

    for (const taxConfig of taxConfigs) {
      // Verificar si el impuesto está habilitado
      const isEnabled = config.taxSettings?.useGlobalDefaults ? 
        taxConfig.isEnabled : 
        enabledTaxes.includes(taxConfig.name);

      if (!isEnabled) continue;

      // Aplicar overrides si existen
      const effectiveConfig = { ...taxConfig };
      if (taxOverrides[taxConfig.name]) {
        Object.assign(effectiveConfig, taxOverrides[taxConfig.name]);
      }

      // Calcular impuesto
      const taxAmount = effectiveConfig.calculate(
        grossSalary, 
        grossSalary, 
        0, 
        config.sbc || grossSalary
      );

      if (taxAmount > 0) {
        deductions.taxes.push({
          name: effectiveConfig.name,
          displayName: effectiveConfig.displayName,
          amount: taxAmount,
          rate: effectiveConfig.type === 'percentage' ? effectiveConfig.value : null,
          config: effectiveConfig
        });

        deductions.details.push({
          concept: effectiveConfig.displayName,
          description: effectiveConfig.description,
          amount: taxAmount,
          type: 'tax',
          taxName: effectiveConfig.name
        });

        deductions.total += taxAmount;
      }
    }

    // 2. 🆕 PROCESAR MOVIMIENTOS DE EXTRAS NEGATIVOS
    const negativeMovements = extrasMovements.filter(m => m.impactType === 'subtract');
    
    for (const movement of negativeMovements) {
      const amount = movement.calculatedAmount || movement.amount;
      
      switch (movement.type) {
        case 'loan':
          deductions.loans += amount;
          break;
        case 'discount':
          deductions.discounts += amount;
          break;
        default:
          deductions.other += amount;
      }

      deductions.extras += amount;
      deductions.details.push({
        concept: movement.type === 'loan' ? 'Préstamo' : 
                movement.type === 'discount' ? 'Descuento' : 'Otras Deducciones',
        description: movement.description || `${movement.type} - ${movement.reason}`,
        amount,
        type: movement.type,
        movementId: movement.id,
        date: movement.date
      });

      deductions.total += amount;
    }

    return deductions;
  }

  /**
   * 🆕 Verificar duplicados en movimientos
   */
  static async checkForDuplicateMovements(movements) {
    const duplicates = [];
    const processed = new Set();

    for (const movement of movements) {
      const key = `${movement.type}-${movement.amount}-${movement.date}-${movement.employeeId}`;
      
      if (processed.has(key)) {
        duplicates.push({
          movementId: movement.id,
          type: movement.type,
          amount: movement.amount,
          date: movement.date,
          key
        });
        
        // Marcar como duplicado
        await movement.markAsDuplicate(null, 'Detectado durante generación de nómina');
      } else {
        processed.add(key);
      }
    }

    return {
      hasDuplicates: duplicates.length > 0,
      duplicates,
      totalChecked: movements.length
    };
  }

  /**
   * 🆕 Crear detalles de nómina con tracking completo
   */
  static async createPayrollDetails(payrollId, perceptions, deductions, extrasMovements) {
    const details = [];

    // Crear detalles de percepciones
    for (const perception of perceptions.details) {
      const detail = new PayrollDetail({
        payrollId,
        type: 'perception',
        concept: perception.concept,
        description: perception.description,
        amount: perception.amount,
        calculationBase: perception.type === 'base' ? perceptions.baseSalary : null,
        movementId: perception.movementId || null,
        taxName: null,
        isFromExtras: !!perception.movementId,
        metadata: {
          originalType: perception.type,
          sourceDate: perception.date
        }
      });

      await detail.save();
      details.push(detail);
    }

    // Crear detalles de deducciones
    for (const deduction of deductions.details) {
      const detail = new PayrollDetail({
        payrollId,
        type: 'deduction',
        concept: deduction.concept,
        description: deduction.description,
        amount: deduction.amount,
        calculationBase: deduction.type === 'tax' ? perceptions.total : null,
        movementId: deduction.movementId || null,
        taxName: deduction.taxName || null,
        isFromExtras: !!deduction.movementId,
        metadata: {
          originalType: deduction.type,
          sourceDate: deduction.date
        }
      });

      await detail.save();
      details.push(detail);
    }

    return details;
  }

  /**
   * 🆕 Marcar movimientos como aplicados con tracking completo
   */
  static async markMovementsAsApplied(movements, payrollId, period) {
    const results = [];

    for (const movement of movements) {
      try {
        await movement.markAsAppliedToPayroll(
          payrollId, 
          null, // payrollDetailId se puede agregar después
          `${period.startDate} - ${period.endDate}`
        );

        results.push({
          movementId: movement.id,
          type: movement.type,
          amount: movement.amount,
          status: 'applied'
        });

        logger.info('✅ Movimiento marcado como aplicado', {
          movementId: movement.id,
          payrollId,
          period: `${period.startDate} - ${period.endDate}`
        });

      } catch (error) {
        logger.error('❌ Error marcando movimiento como aplicado', {
          movementId: movement.id,
          error: error.message
        });

        results.push({
          movementId: movement.id,
          type: movement.type,
          amount: movement.amount,
          status: 'error',
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Calcular período de nómina según frecuencia
   */
  static calculatePayrollPeriod(periodDate, frequency) {
    const date = new Date(periodDate);
    let startDate, endDate;

    switch (frequency) {
      case 'weekly':
        // Obtener lunes de la semana
        const dayOfWeek = date.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startDate = new Date(date);
        startDate.setDate(date.getDate() + daysToMonday);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        break;

      case 'biweekly':
        // Quincenal: 1-15 o 16-fin de mes
        if (date.getDate() <= 15) {
          startDate = new Date(date.getFullYear(), date.getMonth(), 1);
          endDate = new Date(date.getFullYear(), date.getMonth(), 15);
        } else {
          startDate = new Date(date.getFullYear(), date.getMonth(), 16);
          endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        }
        break;

      case 'monthly':
        startDate = new Date(date.getFullYear(), date.getMonth(), 1);
        endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        break;

      default:
        throw new Error(`Frecuencia no soportada: ${frequency}`);
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      workingDays: this.calculateWorkingDays(startDate, endDate)
    };
  }

  /**
   * Calcular días laborales en un período
   */
  static calculateWorkingDays(startDate, endDate) {
    let workingDays = 0;
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // No domingo ni sábado
        workingDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    return workingDays;
  }

  /**
   * 🆕 Obtener resumen de nómina con análisis de extras
   */
  static async getPayrollSummaryWithExtras(payrollId) {
    try {
      const payroll = await Payroll.findById(payrollId);
      if (!payroll) {
        throw new Error('Nómina no encontrada');
      }

      const details = await PayrollDetail.findByPayrollId(payrollId);
      const employee = await Employee.findById(payroll.employeeId);

      // Separar detalles por origen
      const fromExtras = details.filter(d => d.isFromExtras);
      const fromBase = details.filter(d => !d.isFromExtras);

      // Calcular impacto de extras
      const extrasImpact = {
        perceptions: fromExtras
          .filter(d => d.type === 'perception')
          .reduce((sum, d) => sum + d.amount, 0),
        deductions: fromExtras
          .filter(d => d.type === 'deduction')
          .reduce((sum, d) => sum + d.amount, 0)
      };

      extrasImpact.netImpact = extrasImpact.perceptions - extrasImpact.deductions;

      return {
        payroll: payroll.toFirestore(),
        employee: {
          id: employee.id,
          name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
          department: employee.position.department
        },
        details: {
          all: details.map(d => d.toFirestore()),
          fromExtras: fromExtras.map(d => d.toFirestore()),
          fromBase: fromBase.map(d => d.toFirestore())
        },
        summary: {
          grossSalary: payroll.grossSalary,
          totalDeductions: payroll.totalDeductions,
          netSalary: payroll.netSalary,
          extrasImpact,
          period: `${payroll.periodStart} - ${payroll.periodEnd}`,
          frequency: payroll.frequency,
          status: payroll.status
        }
      };

    } catch (error) {
      logger.error('❌ Error obteniendo resumen de nómina con extras', error);
      throw error;
    }
  }

  /**
   * 🆕 Configurar impuestos opcionales para empleado
   */
  static async configureTaxes(employeeId, taxSettings, userId) {
    try {
      logger.info('⚙️ Configurando impuestos opcionales', { employeeId, taxSettings });

      // Obtener configuración actual
      const config = await PayrollConfig.findActiveByEmployee(employeeId);
      if (!config) {
        throw new Error('No hay configuración de nómina activa para este empleado');
      }

      // Actualizar configuración de impuestos
      config.taxSettings = {
        ...config.taxSettings,
        ...taxSettings,
        updatedAt: new Date().toISOString(),
        updatedBy: userId
      };

      config.updatedBy = userId;
      await config.save();

      logger.info('✅ Configuración de impuestos actualizada', {
        employeeId,
        enabledTaxes: config.taxSettings.enabledTaxes,
        useGlobalDefaults: config.taxSettings.useGlobalDefaults
      });

      return config;

    } catch (error) {
      logger.error('❌ Error configurando impuestos', error);
      throw error;
    }
  }

  /**
   * 🆕 Obtener vista previa de nómina sin generar
   */
  static async previewPayroll(employeeId, periodDate = new Date()) {
    try {
      const employee = await Employee.findById(employeeId);
      const config = await PayrollConfig.findActiveByEmployee(employeeId);
      const period = this.calculatePayrollPeriod(periodDate, config.frequency);
      const extrasMovements = await PayrollMovement.findPendingForPeriod(
        employeeId, 
        period.startDate, 
        period.endDate
      );
      const taxConfigs = await TaxConfig.getEffectiveConfig(employeeId);

      const baseSalary = config.calculateSalaryForPeriod();
      const perceptions = await this.calculatePerceptions(baseSalary, extrasMovements, config, period);
      const deductions = await this.calculateDeductions(perceptions.total, extrasMovements, taxConfigs, config);
      const netSalary = perceptions.total - deductions.total;

      return {
        employee: {
          id: employee.id,
          name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`
        },
        period,
        preview: {
          grossSalary: perceptions.total,
          totalDeductions: deductions.total,
          netSalary,
          perceptions,
          deductions,
          extrasCount: extrasMovements.length,
          taxesCount: deductions.taxes.length
        }
      };

    } catch (error) {
      logger.error('❌ Error generando vista previa', error);
      throw error;
    }
  }
}

module.exports = EnhancedPayrollService;
