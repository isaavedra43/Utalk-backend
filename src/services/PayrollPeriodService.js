const PayrollPeriod = require('../models/PayrollPeriod');
const PayrollService = require('./PayrollService');
const TaxCalculationService = require('./TaxCalculationService');
const Employee = require('../models/Employee');
const PayrollConfig = require('../models/PayrollConfig');
const PayrollMovement = require('../models/PayrollMovement');
const Payroll = require('../models/Payroll');
const logger = require('../utils/logger');

/**
 * Servicio para gestión de períodos de nómina masiva
 * Maneja el procesamiento de nóminas para múltiples empleados
 */
class PayrollPeriodService {
  /**
   * Crear nuevo período de nómina
   */
  static async createPeriod(periodData, createdBy) {
    try {
      logger.info('📅 Creando nuevo período de nómina', {
        name: periodData.name,
        startDate: periodData.startDate,
        endDate: periodData.endDate,
        frequency: periodData.frequency
      });

      // Validar fechas
      const validation = await PayrollPeriod.validatePeriodDates(
        periodData.startDate, 
        periodData.endDate
      );

      if (!validation.isValid) {
        throw new Error(`Conflicto con períodos existentes: ${validation.conflicts.map(c => c.name).join(', ')}`);
      }

      // Contar empleados activos para el período
      const activeEmployees = await this.getActiveEmployeesForPeriod(
        periodData.startDate, 
        periodData.endDate
      );

      // Crear período
      const period = new PayrollPeriod({
        ...periodData,
        createdBy,
        summary: {
          totalEmployees: activeEmployees.length,
          totalPayroll: 0,
          totalPerceptions: 0,
          totalDeductions: 0,
          averageSalary: 0,
          employeesProcessed: 0,
          employeesPending: activeEmployees.length,
          employeesApproved: 0,
          employeesPaid: 0
        }
      });

      await period.save();

      logger.info('✅ Período de nómina creado exitosamente', {
        periodId: period.id,
        totalEmployees: activeEmployees.length
      });

      return period;
    } catch (error) {
      logger.error('❌ Error creando período de nómina', error);
      throw error;
    }
  }

  /**
   * Obtener empleados activos para un período
   */
  static async getActiveEmployeesForPeriod(startDate, endDate) {
    try {
      const { db } = require('../config/firebase');
      
      // Obtener empleados que estuvieron activos durante el período
      const snapshot = await db.collection('employees')
        .where('status', '==', 'active')
        .get();

      const activeEmployees = [];
      const periodStart = new Date(startDate);
      const periodEnd = new Date(endDate);

      snapshot.forEach(doc => {
        const employee = doc.data();
        const employeeStartDate = new Date(employee.startDate);
        const employeeEndDate = employee.endDate ? new Date(employee.endDate) : null;

        // Verificar si el empleado estuvo activo durante el período
        const wasActiveDuringPeriod = employeeStartDate <= periodEnd && 
                                     (!employeeEndDate || employeeEndDate >= periodStart);

        if (wasActiveDuringPeriod) {
          activeEmployees.push(new Employee(employee));
        }
      });

      logger.info('👥 Empleados activos encontrados', {
        startDate,
        endDate,
        count: activeEmployees.length
      });

      return activeEmployees;
    } catch (error) {
      logger.error('❌ Error obteniendo empleados activos', error);
      throw error;
    }
  }

  /**
   * Procesar nómina masiva para todos los empleados
   */
  static async processMassPayroll(periodId) {
    try {
      logger.info('🚀 Iniciando procesamiento masivo de nómina', { periodId });

      // Obtener período
      const period = await PayrollPeriod.findById(periodId);
      if (!period) {
        throw new Error('Período de nómina no encontrado');
      }

      if (!period.canBeProcessed()) {
        throw new Error(`Período no puede ser procesado. Estado actual: ${period.status}`);
      }

      // Obtener empleados activos
      const activeEmployees = await this.getActiveEmployeesForPeriod(
        period.startDate,
        period.endDate
      );

      if (activeEmployees.length === 0) {
        throw new Error('No se encontraron empleados activos para el período');
      }

      const processedPayrolls = [];
      const errors = [];
      let totalPerceptions = 0;
      let totalDeductions = 0;
      let totalPayroll = 0;

      // Procesar cada empleado
      for (const employee of activeEmployees) {
        try {
          logger.info(`👤 Procesando empleado: ${employee.name}`, {
            employeeId: employee.id,
            employeeNumber: employee.employeeNumber
          });

          // Calcular nómina individual
          const payrollResult = await this.calculateEmployeePayroll(
            employee,
            period
          );

          processedPayrolls.push(payrollResult);
          
          // Acumular totales
          totalPerceptions += payrollResult.totalPerceptions || 0;
          totalDeductions += payrollResult.totalDeductions || 0;
          totalPayroll += payrollResult.netSalary || 0;

        } catch (employeeError) {
          logger.error(`❌ Error procesando empleado ${employee.name}`, employeeError);
          errors.push({
            employeeId: employee.id,
            employeeName: employee.name,
            error: employeeError.message
          });
        }
      }

      // Calcular resumen
      const summary = {
        totalEmployees: activeEmployees.length,
        employeesProcessed: processedPayrolls.length,
        employeesPending: 0,
        employeesApproved: 0,
        employeesPaid: 0,
        totalPerceptions: Math.round(totalPerceptions * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        totalPayroll: Math.round(totalPayroll * 100) / 100,
        averageSalary: processedPayrolls.length > 0 ? 
                      Math.round((totalPayroll / processedPayrolls.length) * 100) / 100 : 0
      };

      // Actualizar período
      await period.updateSummary(summary);
      await period.updateStatus('calculated');

      logger.info('✅ Procesamiento masivo completado', {
        periodId,
        processedCount: processedPayrolls.length,
        errorsCount: errors.length,
        summary
      });

      return {
        success: true,
        period: period.getBasicInfo(),
        summary,
        processedCount: processedPayrolls.length,
        errorsCount: errors.length,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      logger.error('❌ Error en procesamiento masivo de nómina', error);
      throw error;
    }
  }

  /**
   * Calcular nómina para un empleado específico
   */
  static async calculateEmployeePayroll(employee, period) {
    try {
      // Obtener configuración de nómina del empleado
      const config = await PayrollConfig.findActiveByEmployee(employee.id);
      if (!config) {
        throw new Error(`Empleado ${employee.name} no tiene configuración de nómina`);
      }

      // Calcular días trabajados en el período
      const workedDays = this.calculateWorkedDays(employee, period);
      
      // Calcular salario base
      const baseSalary = this.calculateBaseSalary(config, period, workedDays);

      // Obtener extras pendientes
      const extras = await PayrollMovement.findPendingByEmployeeAndPeriod(
        employee.id,
        period.startDate,
        period.endDate
      );

      // Separar percepciones y deducciones de extras
      const extraPerceptions = extras.filter(extra => 
        extra.getImpactType() === 'add'
      );
      const extraDeductions = extras.filter(extra => 
        extra.getImpactType() === 'subtract'
      );

      // Calcular totales de extras
      const totalExtraPerceptions = extraPerceptions.reduce(
        (sum, extra) => sum + (extra.calculatedAmount || extra.amount), 0
      );
      const totalExtraDeductions = extraDeductions.reduce(
        (sum, extra) => sum + (extra.calculatedAmount || extra.amount), 0
      );

      // Calcular salario bruto
      const grossSalary = baseSalary + totalExtraPerceptions;

      // Calcular deducciones fiscales si están habilitadas
      let fiscalDeductions = { totalFiscal: 0, isr: 0, seguridadSocial: { total: 0 } };
      if (period.configurations.calculateTaxes) {
        fiscalDeductions = TaxCalculationService.calcularDeduccionesFiscales(
          grossSalary,
          config.sbc || config.baseSalary,
          {
            calcularISR: true,
            calcularIMSS: true,
            calcularAFORE: true,
            calcularINFONAVIT: false
          }
        );
      }

      // Total de deducciones
      const totalDeductions = totalExtraDeductions + fiscalDeductions.totalFiscal;

      // Salario neto
      const netSalary = grossSalary - totalDeductions;

      // Crear registro de nómina
      const payrollData = {
        employeeId: employee.id,
        periodId: period.id,
        periodStart: period.startDate,
        periodEnd: period.endDate,
        frequency: period.frequency,
        baseSalary: config.baseSalary,
        calculatedSalary: baseSalary,
        totalPerceptions: totalExtraPerceptions,
        totalDeductions: totalDeductions,
        grossSalary: grossSalary,
        netSalary: netSalary,
        workedDays: workedDays.worked,
        status: 'calculated',
        fiscalDeductions: fiscalDeductions
      };

      const payroll = new Payroll(payrollData);
      await payroll.save();

      // Marcar extras como aplicados
      for (const extra of extras) {
        await extra.markAsAppliedToPayroll(payroll.id);
      }

      logger.info('✅ Nómina calculada para empleado', {
        employeeId: employee.id,
        payrollId: payroll.id,
        grossSalary,
        totalDeductions,
        netSalary
      });

      return {
        payrollId: payroll.id,
        employeeId: employee.id,
        grossSalary,
        totalPerceptions: totalExtraPerceptions,
        totalDeductions,
        netSalary,
        workedDays: workedDays.worked
      };

    } catch (error) {
      logger.error('❌ Error calculando nómina de empleado', error);
      throw error;
    }
  }

  /**
   * Calcular días trabajados en el período
   */
  static calculateWorkedDays(employee, period) {
    try {
      const startDate = new Date(period.startDate);
      const endDate = new Date(period.endDate);
      const employeeStartDate = new Date(employee.startDate);
      const employeeEndDate = employee.endDate ? new Date(employee.endDate) : null;

      // Ajustar fechas según el período de trabajo del empleado
      const workStartDate = employeeStartDate > startDate ? employeeStartDate : startDate;
      const workEndDate = employeeEndDate && employeeEndDate < endDate ? employeeEndDate : endDate;

      // Calcular días totales del período
      const totalDays = Math.ceil((workEndDate - workStartDate) / (1000 * 60 * 60 * 24)) + 1;
      
      // Por ahora asumimos que trabajó todos los días (se puede integrar con módulo de asistencia)
      const workedDays = totalDays;
      const absences = 0; // Se puede obtener del módulo de asistencia

      return {
        total: totalDays,
        worked: workedDays,
        absences: absences
      };
    } catch (error) {
      logger.error('❌ Error calculando días trabajados', error);
      return { total: 30, worked: 30, absences: 0 };
    }
  }

  /**
   * Calcular salario base según frecuencia
   */
  static calculateBaseSalary(config, period, workedDays) {
    try {
      const baseSalary = config.baseSalary;
      const frequency = period.frequency;
      
      // Si el salario ya está en la frecuencia correcta, usar directamente
      if (config.frequency === frequency) {
        return baseSalary * (workedDays.worked / workedDays.total);
      }

      // Convertir a salario del período
      let periodSalary;
      switch (frequency) {
        case 'weekly':
          periodSalary = baseSalary / 4.33; // Promedio de semanas por mes
          break;
        case 'biweekly':
          periodSalary = baseSalary / 2;
          break;
        case 'monthly':
          periodSalary = baseSalary;
          break;
        default:
          periodSalary = baseSalary;
      }

      // Ajustar por días trabajados
      return periodSalary * (workedDays.worked / workedDays.total);
    } catch (error) {
      logger.error('❌ Error calculando salario base', error);
      return 0;
    }
  }

  /**
   * Obtener empleados de un período con sus nóminas
   */
  static async getPeriodEmployees(periodId, options = {}) {
    try {
      const { page = 1, limit = 50, search, department, status } = options;

      // Obtener período
      const period = await PayrollPeriod.findById(periodId);
      if (!period) {
        throw new Error('Período de nómina no encontrado');
      }

      // Obtener nóminas del período
      const { db } = require('../config/firebase');
      let query = db.collection('payrolls')
        .where('periodId', '==', periodId);

      if (status && status !== 'all') {
        query = query.where('status', '==', status);
      }

      const payrollsSnapshot = await query.get();
      const payrolls = [];
      
      payrollsSnapshot.forEach(doc => {
        payrolls.push(new Payroll(doc.data()));
      });

      // Obtener información de empleados
      const employeesData = [];
      for (const payroll of payrolls) {
        try {
          const employee = await Employee.findById(payroll.employeeId);
          if (employee) {
            // Aplicar filtros
            if (search && !employee.name.toLowerCase().includes(search.toLowerCase()) &&
                !employee.employeeNumber.toLowerCase().includes(search.toLowerCase())) {
              continue;
            }

            if (department && employee.department !== department) {
              continue;
            }

            employeesData.push({
              employee: {
                id: employee.id,
                employeeNumber: employee.employeeNumber,
                name: employee.name,
                position: employee.position,
                department: employee.department
              },
              payroll: {
                id: payroll.id,
                grossSalary: payroll.grossSalary,
                totalPerceptions: payroll.totalPerceptions,
                totalDeductions: payroll.totalDeductions,
                netSalary: payroll.netSalary,
                status: payroll.status,
                workedDays: payroll.workedDays
              }
            });
          }
        } catch (employeeError) {
          logger.warn('⚠️ Error obteniendo empleado', {
            employeeId: payroll.employeeId,
            error: employeeError.message
          });
        }
      }

      // Aplicar paginación
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedEmployees = employeesData.slice(startIndex, endIndex);

      logger.info('📋 Empleados del período obtenidos', {
        periodId,
        totalEmployees: employeesData.length,
        returnedEmployees: paginatedEmployees.length,
        filters: { search, department, status }
      });

      return {
        period: period.getBasicInfo(),
        employees: paginatedEmployees,
        pagination: {
          total: employeesData.length,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(employeesData.length / limit)
        }
      };

    } catch (error) {
      logger.error('❌ Error obteniendo empleados del período', error);
      throw error;
    }
  }

  /**
   * Aprobar período completo
   */
  static async approvePeriod(periodId, approvedBy) {
    try {
      const period = await PayrollPeriod.findById(periodId);
      if (!period) {
        throw new Error('Período de nómina no encontrado');
      }

      if (!period.canBeApproved()) {
        throw new Error(`Período no puede ser aprobado. Estado actual: ${period.status}`);
      }

      // Actualizar estado del período
      await period.updateStatus('approved');

      // Actualizar todas las nóminas del período
      const { db } = require('../config/firebase');
      const batch = db.batch();
      
      const payrollsSnapshot = await db.collection('payrolls')
        .where('periodId', '==', periodId)
        .where('status', '==', 'calculated')
        .get();

      let approvedCount = 0;
      payrollsSnapshot.forEach(doc => {
        batch.update(doc.ref, {
          status: 'approved',
          approvedBy: approvedBy,
          approvedAt: new Date().toISOString()
        });
        approvedCount++;
      });

      await batch.commit();

      // Actualizar resumen
      await period.updateSummary({
        employeesApproved: approvedCount,
        employeesPending: 0
      });

      logger.info('✅ Período aprobado exitosamente', {
        periodId,
        approvedCount,
        approvedBy
      });

      return period.getBasicInfo();
    } catch (error) {
      logger.error('❌ Error aprobando período', error);
      throw error;
    }
  }

  /**
   * Marcar período como pagado
   */
  static async markPeriodAsPaid(periodId, paidBy) {
    try {
      const period = await PayrollPeriod.findById(periodId);
      if (!period) {
        throw new Error('Período de nómina no encontrado');
      }

      if (!period.canBePaid()) {
        throw new Error(`Período no puede ser marcado como pagado. Estado actual: ${period.status}`);
      }

      // Actualizar estado del período
      await period.updateStatus('paid');

      // Actualizar todas las nóminas del período
      const { db } = require('../config/firebase');
      const batch = db.batch();
      
      const payrollsSnapshot = await db.collection('payrolls')
        .where('periodId', '==', periodId)
        .where('status', '==', 'approved')
        .get();

      let paidCount = 0;
      payrollsSnapshot.forEach(doc => {
        batch.update(doc.ref, {
          status: 'paid',
          paidBy: paidBy,
          paidAt: new Date().toISOString()
        });
        paidCount++;
      });

      await batch.commit();

      // Actualizar resumen
      await period.updateSummary({
        employeesPaid: paidCount,
        employeesApproved: 0
      });

      logger.info('✅ Período marcado como pagado', {
        periodId,
        paidCount,
        paidBy
      });

      return period.getBasicInfo();
    } catch (error) {
      logger.error('❌ Error marcando período como pagado', error);
      throw error;
    }
  }
}

module.exports = PayrollPeriodService;
