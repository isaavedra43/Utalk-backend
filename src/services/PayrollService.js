const Payroll = require('../models/Payroll');
const PayrollConfig = require('../models/PayrollConfig');
const PayrollDetail = require('../models/PayrollDetail');
const PayrollMovement = require('../models/PayrollMovement');
const Employee = require('../models/Employee');
const logger = require('../utils/logger');

/**
 * Servicio de Nómina - Lógica de negocio para gestión de nóminas
 * Maneja toda la lógica de cálculo, generación y gestión de períodos de nómina
 */
class PayrollService {
  /**
   * Configurar nómina para un empleado
   */
  static async configurePayroll(employeeId, configData, userId) {
    try {
      logger.info('🔧 Configurando nómina para empleado', { employeeId, configData });

      // Verificar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Empleado no encontrado');
      }

      // Desactivar configuración anterior si existe
      const activeConfig = await PayrollConfig.findActiveByEmployee(employeeId);
      if (activeConfig) {
        await activeConfig.deactivate(userId);
      }

      // Crear nueva configuración
      const newConfig = new PayrollConfig({
        ...configData,
        employeeId,
        startDate: configData.startDate || new Date().toISOString(),
        isActive: true,
        createdBy: userId,
        updatedBy: userId
      });

      // Validar configuración
      const errors = newConfig.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      await newConfig.save();

      logger.info('✅ Configuración de nómina creada', {
        configId: newConfig.id,
        employeeId,
        frequency: newConfig.frequency
      });

      return newConfig;
    } catch (error) {
      logger.error('❌ Error configurando nómina', error);
      throw error;
    }
  }

  /**
   * Generar nómina para un empleado en un período específico
   */
  static async generatePayroll(employeeId, periodDate = new Date(), forceRegenerate = false) {
    try {
      logger.info('📊 Generando nómina', { employeeId, periodDate, forceRegenerate });

      // Obtener configuración activa del empleado
      const config = await PayrollConfig.findActiveByEmployee(employeeId);
      if (!config) {
        throw new Error('No hay configuración de nómina activa para este empleado');
      }

      // Calcular fechas del período
      const { periodStart, periodEnd, weekNumber, month, year } = 
        PayrollService.calculatePeriodDates(config.frequency, periodDate);

      // Verificar si ya existe el período
      const existingPayroll = await Payroll.findByEmployeeAndPeriod(
        employeeId, 
        periodStart, 
        periodEnd
      );

      if (existingPayroll && !forceRegenerate) {
        logger.info('ℹ️ Período de nómina ya existe', { payrollId: existingPayroll.id });
        return existingPayroll;
      }

      // Si existe y se fuerza regeneración, eliminar el anterior
      if (existingPayroll && forceRegenerate) {
        await PayrollService.deletePayroll(existingPayroll.id);
      }

      // Calcular salario base del período
      const calculatedSalary = config.calculateSalaryForPeriod();

      // Obtener extras del período
      const extras = await PayrollService.getExtrasForPeriod(
        employeeId, 
        periodStart, 
        periodEnd
      );

      // Separar percepciones y deducciones
      const perceptions = extras.filter(extra => extra.getImpactType() === 'positive');
      const deductions = extras.filter(extra => extra.getImpactType() === 'negative');

      // Calcular totales de extras
      const totalPerceptions = perceptions.reduce((sum, extra) => 
        sum + (extra.calculatedAmount || extra.amount), 0);
      const totalDeductionsFromExtras = deductions.reduce((sum, extra) => 
        sum + Math.abs(extra.calculatedAmount || extra.amount), 0);

      // Crear período de nómina
      const payroll = new Payroll({
        employeeId,
        periodStart,
        periodEnd,
        frequency: config.frequency,
        baseSalary: config.baseSalary,
        calculatedSalary,
        totalPerceptions,
        weekNumber,
        month,
        year
      });

      // Calcular salario bruto
      payroll.grossSalary = calculatedSalary + totalPerceptions;

      // Crear detalles de percepciones
      const perceptionDetails = [];
      
      // Agregar salario base como percepción
      const baseSalaryDetail = new PayrollDetail({
        payrollId: payroll.id,
        employeeId,
        type: 'perception',
        concept: 'Sueldo Base',
        amount: calculatedSalary,
        description: `Salario mensual base calculado para frecuencia ${config.frequency}`,
        category: 'salary',
        isFixed: true,
        isTaxable: true,
        order: 0
      });
      perceptionDetails.push(baseSalaryDetail);

      // Agregar percepciones de extras
      for (const extra of perceptions) {
        const detail = await PayrollDetail.createFromExtra(payroll.id, employeeId, extra);
        perceptionDetails.push(detail);
      }

      // Crear detalles de deducciones
      const deductionDetails = [];

      // Agregar deducciones de extras
      for (const extra of deductions) {
        const detail = await PayrollDetail.createFromExtra(payroll.id, employeeId, extra);
        deductionDetails.push(detail);
      }

      // NO CREAR DEDUCCIONES FIJAS AUTOMÁTICAS (ISR, IMSS, etc.)
      // Solo usar deducciones de extras registrados manualmente
      
      // Calcular total de deducciones (solo de extras)
      payroll.totalDeductions = totalDeductionsFromExtras;

      // Calcular totales finales
      payroll.calculateTotals();

      // Guardar período de nómina
      await payroll.save();

      // Guardar todos los detalles
      for (const detail of [...perceptionDetails, ...deductionDetails]) {
        await detail.save();
      }

      // Marcar extras como aplicados a nómina (CRÍTICO para evitar duplicación)
      for (const extra of extras) {
        try {
          // Usar el método específico del modelo para marcar como aplicado
          await extra.markAsAppliedToPayroll(payroll.id);
          
          logger.info('✅ Extra marcado como aplicado a nómina', {
            extraId: extra.id,
            extraType: extra.type,
            payrollId: payroll.id,
            amount: extra.calculatedAmount || extra.amount
          });
        } catch (error) {
          logger.error('❌ Error marcando extra como aplicado', {
            extraId: extra.id,
            error: error.message
          });
          // No lanzar error para no interrumpir la generación de nómina
        }
      }

      logger.info('✅ Nómina generada exitosamente', {
        payrollId: payroll.id,
        employeeId,
        period: `${periodStart} - ${periodEnd}`,
        netSalary: payroll.netSalary,
        perceptionsCount: perceptionDetails.length,
        deductionsCount: deductionDetails.length
      });

      return payroll;
    } catch (error) {
      logger.error('❌ Error generando nómina', error);
      throw error;
    }
  }

  /**
   * Eliminar nómina y sus detalles
   */
  static async deletePayroll(payrollId) {
    try {
      logger.info('🗑️ Eliminando nómina y detalles', { payrollId });

      // Eliminar detalles de la nómina
      const details = await PayrollDetail.findByPayroll(payrollId);
      for (const detail of details) {
        await detail.delete();
      }

      // Eliminar la nómina
      const payroll = await Payroll.findById(payrollId);
      if (payroll) {
        await payroll.delete();
      }

      logger.info('✅ Nómina eliminada correctamente', { payrollId });
    } catch (error) {
      logger.error('❌ Error eliminando nómina', error);
      throw error;
    }
  }

  /**
   * Resetear extras aplicados a una nómina específica
   */
  static async resetExtrasForPayroll(payrollId) {
    try {
      logger.info('🔄 Reseteando extras para nómina', { payrollId });

      // Buscar todos los extras aplicados a esta nómina
      const appliedExtras = await PayrollMovement.findByPayrollId(payrollId);
      
      for (const extra of appliedExtras) {
        // Resetear campos de aplicación
        extra.appliedToPayroll = false;
        extra.payrollId = null;
        extra.payrollDetailId = null;
        extra.updatedAt = new Date().toISOString();
        
        await extra.save();
        
        logger.info('✅ Extra reseteado', {
          extraId: extra.id,
          type: extra.type,
          payrollId: payrollId
        });
      }

      logger.info('✅ Extras reseteados correctamente', { 
        payrollId, 
        extrasCount: appliedExtras.length 
      });
    } catch (error) {
      logger.error('❌ Error reseteando extras', error);
      throw error;
    }
  }

  /**
   * Obtener extras aplicables a un período
   */
  static async getExtrasForPeriod(employeeId, periodStart, periodEnd) {
    try {
      // Buscar todos los extras del empleado que se superponen con el período
      const allExtras = await PayrollMovement.findByEmployee(employeeId);
      
      const periodStartDate = new Date(periodStart);
      const periodEndDate = new Date(periodEnd);

      const applicableExtras = allExtras.filter(extra => {
        // CRÍTICO: Solo incluir extras aprobados y NO aplicados a nómina
        // NO importa el período - incluir TODOS los extras no aplicados
        if (extra.status !== 'approved' || extra.appliedToPayroll === true) {
          logger.debug('❌ Extra excluido', {
            extraId: extra.id,
            status: extra.status,
            appliedToPayroll: extra.appliedToPayroll,
            reason: extra.status !== 'approved' ? 'no_approved' : 'already_applied'
          });
          return false;
        }

        logger.info('✅ Extra incluido', {
          extraId: extra.id,
          type: extra.type,
          amount: extra.calculatedAmount || extra.amount,
          date: extra.date,
          status: extra.status,
          appliedToPayroll: extra.appliedToPayroll
        });

        // INCLUIR TODOS los extras aprobados y no aplicados
        // Sin restricción de período como lo solicita el usuario
        return true;
      });

      logger.info('🔍 Filtrado de extras detallado', {
        employeeId,
        totalExtras: allExtras.length,
        applicableExtras: applicableExtras.length,
        extrasByStatus: allExtras.reduce((acc, extra) => {
          acc[extra.status] = (acc[extra.status] || 0) + 1;
          return acc;
        }, {}),
        extrasApplied: allExtras.filter(e => e.appliedToPayroll).length,
        period: `${periodStart} - ${periodEnd}`
      });

      logger.info('📋 Extras encontrados para período', {
        employeeId,
        period: `${periodStart} - ${periodEnd}`,
        count: applicableExtras.length,
        types: applicableExtras.map(e => e.type)
      });

      return applicableExtras;
    } catch (error) {
      logger.error('❌ Error obteniendo extras para período', error);
      throw error;
    }
  }

  /**
   * Verificar si un préstamo debe incluirse en el período
   */
  static shouldIncludeLoanInPeriod(loan, periodStart, periodEnd) {
    // Lógica simplificada: incluir si el préstamo está activo
    // En una implementación más compleja, se calcularían las cuotas específicas
    const loanDate = new Date(loan.date);
    return loanDate <= periodEnd && loan.status === 'active';
  }

  /**
   * Calcular fechas de período según frecuencia
   */
  static calculatePeriodDates(frequency, baseDate = new Date()) {
    const date = new Date(baseDate);
    let periodStart, periodEnd, weekNumber, month, year;

    year = date.getFullYear();
    month = date.getMonth() + 1;

    switch (frequency) {
      case 'daily':
        periodStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split('T')[0];
        periodEnd = periodStart;
        break;

      case 'weekly':
        const dayOfWeek = date.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Lunes como inicio
        
        const monday = new Date(date);
        monday.setDate(date.getDate() + mondayOffset);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        periodStart = monday.toISOString().split('T')[0];
        periodEnd = sunday.toISOString().split('T')[0];
        
        // Calcular número de semana
        const startOfYear = new Date(year, 0, 1);
        weekNumber = Math.ceil(((monday - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
        break;

      case 'biweekly':
        const dayOfMonth = date.getDate();
        if (dayOfMonth <= 15) {
          // Primera quincena
          periodStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
          periodEnd = new Date(year, month - 1, 15).toISOString().split('T')[0];
        } else {
          // Segunda quincena
          periodStart = new Date(year, month - 1, 16).toISOString().split('T')[0];
          periodEnd = new Date(year, month, 0).toISOString().split('T')[0]; // Último día del mes
        }
        break;

      case 'monthly':
        periodStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
        periodEnd = new Date(year, month, 0).toISOString().split('T')[0]; // Último día del mes
        break;

      default:
        throw new Error(`Frecuencia no soportada: ${frequency}`);
    }

    return { periodStart, periodEnd, weekNumber, month, year };
  }

  /**
   * Obtener períodos de nómina de un empleado
   */
  static async getPayrollPeriods(employeeId, options = {}) {
    try {
      const { limit = 50, year, month, status } = options;

      logger.info('📋 Obteniendo períodos de nómina', { employeeId, options });

      let periods = await Payroll.findByEmployee(employeeId, limit);

      // Filtrar por año si se especifica
      if (year) {
        periods = periods.filter(period => period.year === parseInt(year));
      }

      // Filtrar por mes si se especifica
      if (month) {
        periods = periods.filter(period => period.month === parseInt(month));
      }

      // Filtrar por estado si se especifica
      if (status) {
        periods = periods.filter(period => period.status === status);
      }

      // Calcular resumen
      const summary = {
        totalPeriods: periods.length,
        totalGross: periods.reduce((sum, p) => sum + p.grossSalary, 0),
        totalDeductions: periods.reduce((sum, p) => sum + p.totalDeductions, 0),
        totalNet: periods.reduce((sum, p) => sum + p.netSalary, 0),
        averageNet: periods.length > 0 ? 
          periods.reduce((sum, p) => sum + p.netSalary, 0) / periods.length : 0,
        byStatus: {}
      };

      // Contar por estado
      periods.forEach(period => {
        summary.byStatus[period.status] = (summary.byStatus[period.status] || 0) + 1;
      });

      return { periods, summary };
    } catch (error) {
      logger.error('❌ Error obteniendo períodos de nómina', error);
      throw error;
    }
  }

  /**
   * Obtener detalles de un período de nómina
   */
  static async getPayrollDetails(payrollId) {
    try {
      logger.info('📋 Obteniendo detalles de nómina', { payrollId });

      const payroll = await Payroll.findById(payrollId);
      if (!payroll) {
        throw new Error('Período de nómina no encontrado');
      }

      const details = await PayrollDetail.findByPayroll(payrollId);
      const perceptions = details.filter(d => d.type === 'perception');
      const deductions = details.filter(d => d.type === 'deduction');

      return {
        payroll,
        details: {
          perceptions,
          deductions,
          all: details
        },
        summary: {
          totalPerceptions: perceptions.reduce((sum, d) => sum + d.amount, 0),
          totalDeductions: deductions.reduce((sum, d) => sum + d.amount, 0),
          perceptionsCount: perceptions.length,
          deductionsCount: deductions.length
        }
      };
    } catch (error) {
      logger.error('❌ Error obteniendo detalles de nómina', error);
      throw error;
    }
  }

  /**
   * Aprobar período de nómina
   */
  static async approvePayroll(payrollId, userId) {
    try {
      logger.info('✅ Aprobando nómina', { payrollId, userId });

      const payroll = await Payroll.findById(payrollId);
      if (!payroll) {
        throw new Error('Período de nómina no encontrado');
      }

      if (payroll.status !== 'calculated') {
        throw new Error('Solo se pueden aprobar nóminas en estado "calculado"');
      }

      await payroll.updateStatus('approved', userId);

      logger.info('✅ Nómina aprobada', { payrollId, approvedBy: userId });

      return payroll;
    } catch (error) {
      logger.error('❌ Error aprobando nómina', error);
      throw error;
    }
  }

  /**
   * Marcar nómina como pagada
   */
  static async markAsPaid(payrollId, userId, paymentDate = null) {
    try {
      logger.info('💰 Marcando nómina como pagada', { payrollId, userId });

      const payroll = await Payroll.findById(payrollId);
      if (!payroll) {
        throw new Error('Período de nómina no encontrado');
      }

      if (!['calculated', 'approved'].includes(payroll.status)) {
        throw new Error('Solo se pueden marcar como pagadas nóminas calculadas o aprobadas');
      }

      if (paymentDate) {
        payroll.paymentDate = paymentDate;
      }

      await payroll.updateStatus('paid', userId);

      logger.info('✅ Nómina marcada como pagada', { payrollId, paidBy: userId });

      return payroll;
    } catch (error) {
      logger.error('❌ Error marcando nómina como pagada', error);
      throw error;
    }
  }

  /**
   * Cancelar período de nómina
   */
  static async cancelPayroll(payrollId, userId, reason = '') {
    try {
      logger.info('❌ Cancelando nómina', { payrollId, userId, reason });

      const payroll = await Payroll.findById(payrollId);
      if (!payroll) {
        throw new Error('Período de nómina no encontrado');
      }

      if (payroll.status === 'paid') {
        throw new Error('No se puede cancelar una nómina ya pagada');
      }

      payroll.notes = `Cancelada: ${reason}`;
      await payroll.updateStatus('cancelled', userId);

      // Desmarcar extras como aplicados
      const extras = await PayrollMovement.findByEmployee(payroll.employeeId);
      for (const extra of extras) {
        if (extra.payrollId === payrollId) {
          extra.appliedToPayroll = false;
          extra.payrollId = null;
          await extra.save();
        }
      }

      logger.info('✅ Nómina cancelada', { payrollId, cancelledBy: userId });

      return payroll;
    } catch (error) {
      logger.error('❌ Error cancelando nómina', error);
      throw error;
    }
  }

  /**
   * Eliminar período de nómina completamente
   */
  static async deletePayroll(payrollId) {
    try {
      logger.info('🗑️ Eliminando nómina', { payrollId });

      const payroll = await Payroll.findById(payrollId);
      if (!payroll) {
        throw new Error('Período de nómina no encontrado');
      }

      // Eliminar detalles
      await PayrollDetail.deleteByPayroll(payrollId);

      // Desmarcar extras como aplicados
      const extras = await PayrollMovement.findByEmployee(payroll.employeeId);
      for (const extra of extras) {
        if (extra.payrollId === payrollId) {
          extra.appliedToPayroll = false;
          extra.payrollId = null;
          await extra.save();
        }
      }

      // Eliminar período
      await payroll.delete();

      logger.info('✅ Nómina eliminada completamente', { payrollId });

      return true;
    } catch (error) {
      logger.error('❌ Error eliminando nómina', error);
      throw error;
    }
  }

  /**
   * Generar nóminas automáticamente por frecuencia
   */
  static async generatePayrollsByFrequency(frequency) {
    try {
      logger.info(`🤖 Generando nóminas automáticas - ${frequency}`);

      const configs = await PayrollConfig.findByFrequency(frequency);
      const results = [];

      for (const config of configs) {
        try {
          const payroll = await PayrollService.generatePayroll(config.employeeId);
          results.push({
            employeeId: config.employeeId,
            success: true,
            payrollId: payroll.id
          });
        } catch (error) {
          logger.error(`❌ Error generando nómina automática para empleado ${config.employeeId}`, error);
          results.push({
            employeeId: config.employeeId,
            success: false,
            error: error.message
          });
        }
      }

      logger.info(`✅ Generación automática completada - ${frequency}`, {
        total: configs.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

      return results;
    } catch (error) {
      logger.error('❌ Error en generación automática de nóminas', error);
      throw error;
    }
  }

  /**
   * Métodos específicos para cada frecuencia (para cron jobs)
   */
  static async generateDailyPayrolls() {
    return await PayrollService.generatePayrollsByFrequency('daily');
  }

  static async generateWeeklyPayrolls() {
    return await PayrollService.generatePayrollsByFrequency('weekly');
  }

  static async generateBiweeklyPayrolls() {
    return await PayrollService.generatePayrollsByFrequency('biweekly');
  }

  static async generateMonthlyPayrolls() {
    return await PayrollService.generatePayrollsByFrequency('monthly');
  }
}

module.exports = PayrollService;
