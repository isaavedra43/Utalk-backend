const logger = require('../utils/logger');

/**
 * Servicio de Cálculo de Impuestos México 2025
 * Implementa ISR, IMSS y otras deducciones fiscales
 * 
 * TABLAS ACTUALIZADAS: 2025
 * REGLAS: LEYES FISCALES MEXICANAS VIGENTES
 */
class TaxCalculationService {
  
  /**
   * TABLA ISR 2025 - Impuesto Sobre la Renta
   * Tarifa para el cálculo del impuesto mensual
   */
  static ISR_TABLE_2025 = [
    { limit: 0.01, lowerLimit: 0.01, fixed: 0.00, rate: 0.0192 },
    { limit: 746.04, lowerLimit: 746.05, fixed: 14.32, rate: 0.0640 },
    { limit: 6332.05, lowerLimit: 6332.06, fixed: 371.83, rate: 0.1088 },
    { limit: 11128.01, lowerLimit: 11128.02, fixed: 893.63, rate: 0.1600 },
    { limit: 12935.82, lowerLimit: 12935.83, fixed: 1182.88, rate: 0.1792 },
    { limit: 15487.71, lowerLimit: 15487.72, fixed: 1640.18, rate: 0.2136 },
    { limit: 31236.49, lowerLimit: 31236.50, fixed: 5004.12, rate: 0.2352 },
    { limit: 49233.00, lowerLimit: 49233.01, fixed: 9236.89, rate: 0.3000 },
    { limit: 93993.90, lowerLimit: 93993.91, fixed: 22665.17, rate: 0.3200 },
    { limit: 125325.20, lowerLimit: 125325.21, fixed: 32691.18, rate: 0.3400 },
    { limit: 375975.61, lowerLimit: 375975.62, fixed: 117912.32, rate: 0.3500 }
  ];

  /**
   * SUBSIDIO AL EMPLEO 2025
   * Tabla de subsidio que se resta al ISR
   */
  static SUBSIDIO_EMPLEO_2025 = [
    { limit: 0.01, lowerLimit: 0.01, subsidy: 407.02 },
    { limit: 1768.96, lowerLimit: 1768.97, subsidy: 406.83 },
    { limit: 2653.38, lowerLimit: 2653.39, subsidy: 406.62 },
    { limit: 3472.84, lowerLimit: 3472.85, subsidy: 392.77 },
    { limit: 3537.87, lowerLimit: 3537.88, subsidy: 382.46 },
    { limit: 4446.15, lowerLimit: 4446.16, subsidy: 354.23 },
    { limit: 4717.18, lowerLimit: 4717.19, subsidy: 324.87 },
    { limit: 5335.42, lowerLimit: 5335.43, subsidy: 294.63 },
    { limit: 6224.67, lowerLimit: 6224.68, subsidy: 253.54 },
    { limit: 7113.90, lowerLimit: 7113.91, subsidy: 217.61 },
    { limit: 7382.33, lowerLimit: 7382.34, subsidy: 0.00 }
  ];

  /**
   * TASAS IMSS 2025 - Instituto Mexicano del Seguro Social
   * Porcentajes de aportación obrero-patronal
   */
  static IMSS_RATES_2025 = {
    // Cuotas del trabajador
    worker: {
      healthInsurance: 0.00375,      // 0.375% (Enfermedad y maternidad)
      disability: 0.00625,            // 0.625% (Invalidez y vida)
      retirement: 0.01125,            // 1.125% (Retiro)
      oldAge: 0.01125,                // 1.125% (Cesantía y vejez)
      total: 0.0325                   // 3.25% TOTAL TRABAJADOR
    },
    // Cuotas del patrón
    employer: {
      healthInsurance: 0.0204,        // 2.04% (Enfermedad y maternidad)
      disability: 0.0175,             // 1.75% (Invalidez y vida)
      retirement: 0.02,               // 2.00% (Retiro)
      oldAge: 0.0315,                 // 3.15% (Cesantía y vejez)
      workRisk: 0.005,                // 0.50% (Riesgo de trabajo - promedio)
      childcare: 0.01,                // 1.00% (Guarderías)
      infonavit: 0.05,                // 5.00% (INFONAVIT)
      total: 0.1594                   // 15.94% TOTAL PATRÓN
    },
    // Límites
    limits: {
      minWage: 207.44,                // Salario mínimo diario 2025
      maxSBC: 12406.40,               // 25 UMA (Unidad de Medida y Actualización)
      uma: 103.74                     // UMA 2025
    }
  };

  /**
   * CALCULAR ISR MENSUAL
   * @param {number} grossSalary - Salario bruto mensual
   * @param {number} sbc - Salario Base de Cotización
   * @param {object} config - Configuración adicional
   * @returns {number} ISR calculado
   */
  static calculateISR(grossSalary, sbc = null, config = {}) {
    try {
      // Validaciones
      if (!grossSalary || grossSalary <= 0) {
        logger.warn('⚠️ Salario bruto es 0 o negativo, ISR = 0', { grossSalary });
        return 0;
      }

      // Si está exento de ISR
      if (config?.isrExempt) {
        logger.info('🚫 Empleado exento de ISR', { grossSalary });
        return 0;
      }

      // Encontrar tramo de la tabla ISR
      let bracket = this.ISR_TABLE_2025[0];
      for (const row of this.ISR_TABLE_2025) {
        if (grossSalary >= row.lowerLimit) {
          bracket = row;
        } else {
          break;
        }
      }

      // Calcular ISR = ((Ingreso - Límite Inferior) * Tasa) + Cuota Fija
      const excesoLimiteInferior = grossSalary - bracket.lowerLimit;
      const isrCalculado = (excesoLimiteInferior * bracket.rate) + bracket.fixed;

      // Aplicar subsidio al empleo
      let subsidio = 0;
      for (const row of this.SUBSIDIO_EMPLEO_2025) {
        if (grossSalary >= row.lowerLimit) {
          subsidio = row.subsidy;
        } else {
          break;
        }
      }

      // ISR Final = ISR Calculado - Subsidio (mínimo 0)
      const isrFinal = Math.max(0, isrCalculado - subsidio);

      logger.info('💰 ISR Calculado', {
        grossSalary,
        bracket: {
          lowerLimit: bracket.lowerLimit,
          fixed: bracket.fixed,
          rate: bracket.rate
        },
        isrCalculado,
        subsidio,
        isrFinal
      });

      return Math.round(isrFinal * 100) / 100; // Redondear a 2 decimales

    } catch (error) {
      logger.error('❌ Error calculando ISR', { error: error.message, grossSalary });
      return 0;
    }
  }

  /**
   * CALCULAR IMSS MENSUAL
   * @param {number} grossSalary - Salario bruto mensual
   * @param {number} sbc - Salario Base de Cotización diario
   * @param {object} config - Configuración adicional
   * @returns {number} IMSS calculado (parte trabajador)
   */
  static calculateIMSS(grossSalary, sbc, config = {}) {
    try {
      // Validaciones
      if (!sbc || sbc <= 0) {
        logger.warn('⚠️ SBC es 0 o no definido, IMSS = 0', { sbc });
        return 0;
      }

      // Si está exento de IMSS
      if (config?.imssExempt) {
        logger.info('🚫 Empleado exento de IMSS', { sbc });
        return 0;
      }

      // Validar SBC dentro de límites
      const sbcDiario = sbc;
      const sbcLimitado = Math.min(sbcDiario, this.IMSS_RATES_2025.limits.maxSBC);

      // Calcular IMSS mensual (30 días)
      const sbcMensual = sbcLimitado * 30;
      
      // Solo calculamos la parte del trabajador
      const imssWorker = sbcMensual * this.IMSS_RATES_2025.worker.total;

      logger.info('🏥 IMSS Calculado', {
        sbcDiario: sbcDiario,
        sbcLimitado: sbcLimitado,
        sbcMensual: sbcMensual,
        imssRate: this.IMSS_RATES_2025.worker.total,
        imssWorker: imssWorker
      });

      return Math.round(imssWorker * 100) / 100; // Redondear a 2 decimales

    } catch (error) {
      logger.error('❌ Error calculando IMSS', { error: error.message, sbc });
      return 0;
    }
  }

  /**
   * CALCULAR TODAS LAS DEDUCCIONES FISCALES
   * @param {number} grossSalary - Salario bruto mensual
   * @param {number} sbc - Salario Base de Cotización diario
   * @param {object} config - Configuración adicional
   * @returns {object} Desglose completo de deducciones fiscales
   */
  static calculateAllTaxes(grossSalary, sbc, config = {}) {
    try {
      const isr = this.calculateISR(grossSalary, sbc, config);
      const imss = this.calculateIMSS(grossSalary, sbc, config);

      const result = {
        isr: isr,
        imss: imss,
        total: isr + imss,
        breakdown: [
          { name: 'ISR', amount: isr, type: 'tax' },
          { name: 'IMSS', amount: imss, type: 'social_security' }
        ]
      };

      logger.info('💸 Deducciones fiscales totales', result);

      return result;

    } catch (error) {
      logger.error('❌ Error calculando deducciones fiscales', { error: error.message });
      return {
        isr: 0,
        imss: 0,
        total: 0,
        breakdown: []
      };
    }
  }

  /**
   * CALCULAR SBC (Salario Base de Cotización) DIARIO
   * @param {number} monthlySalary - Salario mensual
   * @param {object} employee - Datos del empleado
   * @returns {number} SBC diario
   */
  static calculateSBC(monthlySalary, employee = {}) {
    try {
      // Si ya tiene SBC configurado, usarlo
      if (employee.sbc && employee.sbc > 0) {
        logger.info('✅ Usando SBC configurado', { sbc: employee.sbc });
        return employee.sbc;
      }

      // Si tiene configuración de nómina con SBC
      if (employee.payrollConfig?.sbc && employee.payrollConfig.sbc > 0) {
        logger.info('✅ Usando SBC de configuración', { sbc: employee.payrollConfig.sbc });
        return employee.payrollConfig.sbc;
      }

      // Calcular SBC basado en salario mensual
      // SBC = Salario Mensual / 30 días
      const sbcCalculado = monthlySalary / 30;

      // Validar contra límites
      const sbcLimitado = Math.min(sbcCalculado, this.IMSS_RATES_2025.limits.maxSBC);

      logger.info('📊 SBC calculado automáticamente', {
        monthlySalary,
        sbcCalculado,
        sbcLimitado,
        maxSBC: this.IMSS_RATES_2025.limits.maxSBC
      });

      return Math.round(sbcLimitado * 100) / 100;

    } catch (error) {
      logger.error('❌ Error calculando SBC', { error: error.message });
      return 0;
    }
  }

  /**
   * CONVERTIR SALARIO MENSUAL A PERÍODOS
   * @param {number} monthlySalary - Salario mensual
   * @param {string} periodType - Tipo de período (weekly, biweekly, monthly)
   * @returns {number} Salario prorrateado
   */
  static convertSalaryToPeriod(monthlySalary, periodType) {
    try {
      let salary = 0;

      switch (periodType) {
        case 'weekly':
          // CORRECCIÓN: 4.33 semanas por mes (NO 4.4)
          salary = monthlySalary / 4.33;
          break;

        case 'biweekly':
          // CORRECCIÓN: 2.165 quincenas por mes (NO 2.2)
          salary = monthlySalary / 2.165;
          break;

        case 'monthly':
          salary = monthlySalary;
          break;

        case 'daily':
          salary = monthlySalary / 30;
          break;

        default:
          logger.warn('⚠️ Tipo de período desconocido, usando mensual', { periodType });
          salary = monthlySalary;
      }

      logger.info('💵 Salario convertido', {
        monthlySalary,
        periodType,
        calculatedSalary: salary
      });

      return Math.round(salary * 100) / 100;

    } catch (error) {
      logger.error('❌ Error convirtiendo salario', { error: error.message });
      return monthlySalary;
    }
  }

  /**
   * VALIDAR SBC
   * @param {number} sbc - SBC a validar
   * @returns {object} Resultado de validación
   */
  static validateSBC(sbc) {
    const limits = this.IMSS_RATES_2025.limits;
    
    const result = {
      isValid: true,
      warnings: [],
      sbc: sbc
    };

    if (!sbc || sbc <= 0) {
      result.isValid = false;
      result.warnings.push('SBC debe ser mayor a 0');
      return result;
    }

    if (sbc < limits.minWage) {
      result.warnings.push(`SBC (${sbc}) es menor al salario mínimo (${limits.minWage})`);
    }

    if (sbc > limits.maxSBC) {
      result.warnings.push(`SBC (${sbc}) excede el tope máximo (${limits.maxSBC}), se limitará`);
      result.sbc = limits.maxSBC;
    }

    return result;
  }
}

module.exports = TaxCalculationService;
