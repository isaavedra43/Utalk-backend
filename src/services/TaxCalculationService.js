const logger = require('../utils/logger');

/**
 * Servicio para cálculo de impuestos y seguridad social
 * Implementa las fórmulas oficiales de México 2025
 */
class TaxCalculationService {
  constructor() {
    // Tablas de ISR 2025 (valores anuales)
    this.isrTable = [
      { desde: 0, hasta: 416220.00, cuotaFija: 0, porcentaje: 0 },
      { desde: 416220.01, hasta: 624329.00, cuotaFija: 0, porcentaje: 0.15 },
      { desde: 624329.01, hasta: 867123.00, cuotaFija: 31216.00, porcentaje: 0.20 },
      { desde: 867123.01, hasta: 1000000.00, cuotaFija: 79776.00, porcentaje: 0.25 },
      { desde: 1000000.01, hasta: 1200000.00, cuotaFija: 133095.00, porcentaje: 0.30 },
      { desde: 1200000.01, hasta: 1500000.00, cuotaFija: 193095.00, porcentaje: 0.32 },
      { desde: 1500000.01, hasta: 2000000.00, cuotaFija: 289095.00, porcentaje: 0.34 },
      { desde: 2000000.01, hasta: 3000000.00, cuotaFija: 459095.00, porcentaje: 0.35 },
      { desde: 3000000.01, hasta: Infinity, cuotaFija: 809095.00, porcentaje: 0.36 }
    ];

    // UMA (Unidad de Medida y Actualización) 2025
    this.uma = {
      diaria: 108.57,
      mensual: 3296.76,
      anual: 39561.12
    };

    // Límites y porcentajes de seguridad social
    this.socialSecurity = {
      // IMSS Empleado
      imssEmpleado: {
        enfermedadMaternidad: 0.025, // 2.5%
        invalidezVida: 0.00625, // 0.625%
        cesantiaVejez: 0.01125 // 1.125%
      },
      // IMSS Patrón
      imssPatron: {
        enfermedadMaternidad: 0.204, // 20.4%
        riesgoTrabajo: 0.005, // Variable, promedio 0.5%
        invalidezVida: 0.0175, // 1.75%
        cesantiaVejez: 0.0315, // 3.15%
        guarderia: 0.01, // 1%
        infonavit: 0.05 // 5%
      },
      // AFORE
      afore: 0.01125, // 1.125%
      
      // Límites
      topeImss: this.uma.mensual * 25, // 25 UMAs
      topeInfonavit: this.uma.mensual * 25 // 25 UMAs
    };
  }

  /**
   * Calcular ISR mensual
   */
  calcularISR(salarioMensual, deducciones = 0) {
    try {
      // Salario gravable
      const salarioGravable = Math.max(0, salarioMensual - deducciones);
      const salarioAnual = salarioGravable * 12;

      logger.debug('💰 Calculando ISR', {
        salarioMensual,
        deducciones,
        salarioGravable,
        salarioAnual
      });

      // Buscar en tabla de ISR
      const tabla = this.isrTable.find(t => 
        salarioAnual >= t.desde && salarioAnual <= t.hasta
      );

      if (!tabla) {
        logger.warn('⚠️ No se encontró tabla ISR para salario', { salarioAnual });
        return 0;
      }

      // Calcular ISR anual
      const excedenteAnual = salarioAnual - tabla.desde;
      const impuestoExcedente = excedenteAnual * tabla.porcentaje;
      const isrAnual = tabla.cuotaFija + impuestoExcedente;

      // ISR mensual
      const isrMensual = Math.max(0, isrAnual / 12);

      logger.debug('✅ ISR calculado', {
        tabla: tabla.porcentaje,
        cuotaFija: tabla.cuotaFija,
        excedenteAnual,
        impuestoExcedente,
        isrAnual,
        isrMensual
      });

      return Math.round(isrMensual * 100) / 100;
    } catch (error) {
      logger.error('❌ Error calculando ISR', error);
      return 0;
    }
  }

  /**
   * Calcular deducciones de seguridad social para empleado
   */
  calcularSeguridadSocialEmpleado(sbc) {
    try {
      // Aplicar tope de cotización
      const sbcLimitado = Math.min(sbc, this.socialSecurity.topeImss);

      const deducciones = {
        // IMSS
        imssEnfermedadMaternidad: sbcLimitado * this.socialSecurity.imssEmpleado.enfermedadMaternidad,
        imssInvalidezVida: sbcLimitado * this.socialSecurity.imssEmpleado.invalidezVida,
        imssCesantiaVejez: sbcLimitado * this.socialSecurity.imssEmpleado.cesantiaVejez,
        
        // AFORE
        afore: sbcLimitado * this.socialSecurity.afore,
        
        // INFONAVIT (solo si aplica)
        infonavit: 0 // Se calcula por separado según política de la empresa
      };

      // Totales
      deducciones.totalImss = deducciones.imssEnfermedadMaternidad + 
                             deducciones.imssInvalidezVida + 
                             deducciones.imssCesantiaVejez;
      
      deducciones.total = deducciones.totalImss + deducciones.afore + deducciones.infonavit;

      logger.debug('🏥 Seguridad social empleado calculada', {
        sbc,
        sbcLimitado,
        deducciones
      });

      // Redondear a centavos
      Object.keys(deducciones).forEach(key => {
        deducciones[key] = Math.round(deducciones[key] * 100) / 100;
      });

      return deducciones;
    } catch (error) {
      logger.error('❌ Error calculando seguridad social empleado', error);
      return { total: 0 };
    }
  }

  /**
   * Calcular aportaciones patronales (para reportes)
   */
  calcularSeguridadSocialPatron(sbc) {
    try {
      const sbcLimitado = Math.min(sbc, this.socialSecurity.topeImss);

      const aportaciones = {
        // IMSS Patrón
        imssEnfermedadMaternidad: sbcLimitado * this.socialSecurity.imssPatron.enfermedadMaternidad,
        imssRiesgoTrabajo: sbcLimitado * this.socialSecurity.imssPatron.riesgoTrabajo,
        imssInvalidezVida: sbcLimitado * this.socialSecurity.imssPatron.invalidezVida,
        imssCesantiaVejez: sbcLimitado * this.socialSecurity.imssPatron.cesantiaVejez,
        imssGuarderia: sbcLimitado * this.socialSecurity.imssPatron.guarderia,
        
        // INFONAVIT
        infonavit: Math.min(sbc, this.socialSecurity.topeInfonavit) * this.socialSecurity.imssPatron.infonavit
      };

      aportaciones.totalImss = aportaciones.imssEnfermedadMaternidad +
                              aportaciones.imssRiesgoTrabajo +
                              aportaciones.imssInvalidezVida +
                              aportaciones.imssCesantiaVejez +
                              aportaciones.imssGuarderia;

      aportaciones.total = aportaciones.totalImss + aportaciones.infonavit;

      // Redondear a centavos
      Object.keys(aportaciones).forEach(key => {
        aportaciones[key] = Math.round(aportaciones[key] * 100) / 100;
      });

      return aportaciones;
    } catch (error) {
      logger.error('❌ Error calculando seguridad social patrón', error);
      return { total: 0 };
    }
  }

  /**
   * Calcular todas las deducciones fiscales
   */
  calcularDeduccionesFiscales(salarioMensual, sbc, configuraciones = {}) {
    try {
      const {
        calcularISR = true,
        calcularIMSS = true,
        calcularAFORE = true,
        calcularINFONAVIT = false
      } = configuraciones;

      const deducciones = {
        isr: 0,
        seguridadSocial: { total: 0 }
      };

      // Calcular ISR
      if (calcularISR) {
        deducciones.isr = this.calcularISR(salarioMensual);
      }

      // Calcular seguridad social
      if (calcularIMSS || calcularAFORE) {
        const seguridadSocial = this.calcularSeguridadSocialEmpleado(sbc);
        
        if (!calcularIMSS) {
          seguridadSocial.totalImss = 0;
          seguridadSocial.imssEnfermedadMaternidad = 0;
          seguridadSocial.imssInvalidezVida = 0;
          seguridadSocial.imssCesantiaVejez = 0;
        }
        
        if (!calcularAFORE) {
          seguridadSocial.afore = 0;
        }
        
        if (calcularINFONAVIT) {
          // INFONAVIT se calcula según política específica
          seguridadSocial.infonavit = Math.min(sbc, this.socialSecurity.topeInfonavit) * 0.05;
        }

        // Recalcular total
        seguridadSocial.total = seguridadSocial.totalImss + 
                               seguridadSocial.afore + 
                               seguridadSocial.infonavit;

        deducciones.seguridadSocial = seguridadSocial;
      }

      // Total de deducciones fiscales
      deducciones.totalFiscal = deducciones.isr + deducciones.seguridadSocial.total;

      logger.info('📊 Deducciones fiscales calculadas', {
        salarioMensual,
        sbc,
        configuraciones,
        totalFiscal: deducciones.totalFiscal
      });

      return deducciones;
    } catch (error) {
      logger.error('❌ Error calculando deducciones fiscales', error);
      return {
        isr: 0,
        seguridadSocial: { total: 0 },
        totalFiscal: 0
      };
    }
  }

  /**
   * Obtener información de UMA actual
   */
  getUMAInfo() {
    return {
      ...this.uma,
      year: 2025,
      lastUpdate: '2025-01-01'
    };
  }

  /**
   * Obtener información de tablas fiscales
   */
  getTaxTablesInfo() {
    return {
      isr: {
        year: 2025,
        brackets: this.isrTable.length,
        lastUpdate: '2025-01-01'
      },
      socialSecurity: {
        year: 2025,
        topeImss: this.socialSecurity.topeImss,
        topeInfonavit: this.socialSecurity.topeInfonavit,
        lastUpdate: '2025-01-01'
      },
      uma: this.getUMAInfo()
    };
  }

  /**
   * Validar que los cálculos sean coherentes
   */
  validateCalculations(salarioMensual, deducciones) {
    const warnings = [];
    
    // Verificar que las deducciones no excedan el salario
    if (deducciones.totalFiscal > salarioMensual) {
      warnings.push('Las deducciones fiscales exceden el salario mensual');
    }

    // Verificar rangos razonables de ISR
    const porcentajeISR = (deducciones.isr / salarioMensual) * 100;
    if (porcentajeISR > 35) {
      warnings.push(`Porcentaje de ISR muy alto: ${porcentajeISR.toFixed(2)}%`);
    }

    // Verificar seguridad social
    const porcentajeSS = (deducciones.seguridadSocial.total / salarioMensual) * 100;
    if (porcentajeSS > 15) {
      warnings.push(`Porcentaje de seguridad social muy alto: ${porcentajeSS.toFixed(2)}%`);
    }

    return {
      isValid: warnings.length === 0,
      warnings
    };
  }
}

module.exports = new TaxCalculationService();
