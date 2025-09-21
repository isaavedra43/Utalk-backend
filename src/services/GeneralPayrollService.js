const GeneralPayroll = require('../models/GeneralPayroll');
const GeneralPayrollEmployee = require('../models/GeneralPayrollEmployee');
const GeneralPayrollAdjustment = require('../models/GeneralPayrollAdjustment');
const Payroll = require('../models/Payroll');
const PayrollConfig = require('../models/PayrollConfig');
const PayrollDetail = require('../models/PayrollDetail');
const PayrollMovement = require('../models/PayrollMovement');
const Employee = require('../models/Employee');
const PayrollService = require('./PayrollService');
const logger = require('../utils/logger');

/**
 * Servicio de Nómina General - Lógica de negocio para gestión masiva de nóminas
 * Maneja toda la lógica de cálculo, simulación, aprobación y cierre de nóminas generales
 * Se integra automáticamente con nóminas individuales
 */
class GeneralPayrollService {
  
  /**
   * FASE 1: CREAR NÓMINA GENERAL
   * Crear una nueva nómina general con validaciones
   */
  static async createGeneralPayroll(data, userId) {
    try {
      const { startDate, endDate, frequency, includeEmployees } = data;
      
      logger.info('🏢 Creando nómina general', {
        startDate, endDate, frequency,
        employeesCount: includeEmployees?.length || 0,
        userId
      });

      // 1. Validar que no exista nómina general para el período
      const existingPayroll = await GeneralPayroll.findByPeriod(startDate, endDate);
      if (existingPayroll) {
        throw new Error('Ya existe una nómina general para este período');
      }

      // 2. Obtener y validar empleados activos
      const activeEmployees = await this.getAndValidateEmployees(includeEmployees);
      
      // 3. Validar configuraciones de nómina individual
      await this.validateEmployeeConfigurations(activeEmployees);
      
      // 4. Validar que no hay conflictos con nóminas individuales
      await this.validateNoConflictingIndividualPayrolls(activeEmployees, startDate, endDate);

      // 5. Crear registro inicial de nómina general
      const generalPayroll = new GeneralPayroll({
        period: { startDate, endDate, frequency },
        status: 'draft',
        employees: activeEmployees.map(emp => ({
          employeeId: emp.id,
          employee: {
            id: emp.id,
            name: `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`,
            position: emp.position.title || 'Sin posición',
            department: emp.position.department || 'Sin departamento',
            code: emp.employeeNumber || emp.id,
            email: emp.personalInfo.email || ''
          },
          status: 'pending',
          baseSalary: 0,
          overtime: 0,
          bonuses: 0,
          deductions: 0,
          taxes: 0,
          grossSalary: 0,
          netSalary: 0,
          adjustments: [],
          includedExtras: [],
          faults: 0,
          attendance: 100
        })),
        createdBy: userId
      });

      generalPayroll.calculateTotals();
      await generalPayroll.save();

      // 6. Crear registros de empleados en colección separada
      const employeePromises = generalPayroll.employees.map(empData => {
        const generalPayrollEmployee = new GeneralPayrollEmployee({
          generalPayrollId: generalPayroll.id,
          employeeId: empData.employeeId,
          employee: empData.employee,
          status: 'pending'
        });
        return generalPayrollEmployee.save();
      });

      await Promise.all(employeePromises);

      logger.info('✅ Nómina general creada exitosamente', {
        id: generalPayroll.id,
        totalEmployees: generalPayroll.totals.totalEmployees,
        period: `${startDate} - ${endDate}`,
        frequency
      });

      return generalPayroll;
    } catch (error) {
      logger.error('❌ Error creando nómina general', error);
      throw error;
    }
  }

  /**
   * FASE 2: SIMULAR CÁLCULOS
   * Calcular salarios estimados para todos los empleados
   */
  static async simulateGeneralPayroll(payrollId) {
    try {
      logger.info('🧮 Simulando cálculos de nómina general', { payrollId });

      const generalPayroll = await GeneralPayroll.findById(payrollId);
      if (!generalPayroll) {
        throw new Error('Nómina general no encontrada');
      }

      if (generalPayroll.status !== 'draft') {
        throw new Error('Solo se pueden simular nóminas en estado draft');
      }

      const simulatedEmployees = [];

      // Procesar cada empleado
      for (const empData of generalPayroll.employees) {
        const simulatedEmployee = await this.simulateEmployeePayroll(
          empData.employeeId,
          generalPayroll.period
        );
        simulatedEmployees.push(simulatedEmployee);
      }

      // Actualizar nómina general con simulación
      generalPayroll.employees = simulatedEmployees;
      generalPayroll.status = 'calculated';
      generalPayroll.calculateTotals();
      
      await generalPayroll.save();

      // Actualizar empleados en colección separada
      await this.updateGeneralPayrollEmployees(payrollId, simulatedEmployees);

      logger.info('✅ Simulación de nómina general completada', {
        payrollId,
        totalEmployees: simulatedEmployees.length,
        totalGrossSalary: generalPayroll.totals.totalGrossSalary,
        totalNetSalary: generalPayroll.totals.totalNetSalary
      });

      return generalPayroll;
    } catch (error) {
      logger.error('❌ Error simulando nómina general', error);
      throw error;
    }
  }

  /**
   * FASE 3: APLICAR AJUSTES
   * Aplicar ajustes manuales a empleados específicos
   */
  static async applyAdjustment(payrollId, employeeId, adjustmentData, appliedBy) {
    try {
      logger.info('🔧 Aplicando ajuste a empleado en nómina general', {
        payrollId, employeeId, adjustmentData, appliedBy
      });

      const generalPayroll = await GeneralPayroll.findById(payrollId);
      if (!generalPayroll) {
        throw new Error('Nómina general no encontrada');
      }

      if (!['calculated', 'approved'].includes(generalPayroll.status)) {
        throw new Error('Solo se pueden aplicar ajustes a nóminas calculadas o aprobadas');
      }

      // Crear el ajuste
      const adjustment = new GeneralPayrollAdjustment({
        generalPayrollId: payrollId,
        employeeId: employeeId,
        type: adjustmentData.type,
        concept: adjustmentData.concept,
        amount: adjustmentData.amount,
        reason: adjustmentData.reason || '',
        appliedBy: appliedBy
      });

      await adjustment.save();

      // Actualizar empleado en nómina general
      const employeeIndex = generalPayroll.employees.findIndex(emp => emp.employeeId === employeeId);
      if (employeeIndex === -1) {
        throw new Error('Empleado no encontrado en nómina general');
      }

      const employee = generalPayroll.employees[employeeIndex];
      
      // Aplicar ajuste según el tipo
      switch (adjustmentData.type) {
        case 'bonus':
          employee.bonuses += adjustmentData.amount;
          employee.grossSalary += adjustmentData.amount;
          employee.netSalary += adjustmentData.amount;
          break;
        case 'deduction':
          employee.deductions += Math.abs(adjustmentData.amount);
          employee.netSalary -= Math.abs(adjustmentData.amount);
          break;
        case 'overtime_adjustment':
          employee.overtime += adjustmentData.amount;
          employee.grossSalary += adjustmentData.amount;
          employee.netSalary += adjustmentData.amount;
          break;
        case 'salary_adjustment':
          employee.baseSalary += adjustmentData.amount;
          employee.grossSalary += adjustmentData.amount;
          employee.netSalary += adjustmentData.amount;
          break;
      }

      // Agregar ajuste al historial del empleado
      employee.adjustments.push(adjustment.getSummary());

      // Recalcular totales
      generalPayroll.calculateTotals();
      await generalPayroll.save();

      // Actualizar empleado en colección separada
      const generalPayrollEmployee = await GeneralPayrollEmployee.findByEmployeeAndGeneral(
        employeeId, payrollId
      );
      if (generalPayrollEmployee) {
        await generalPayrollEmployee.applyAdjustment(adjustmentData, appliedBy);
      }

      logger.info('✅ Ajuste aplicado exitosamente', {
        adjustmentId: adjustment.id,
        employeeId,
        type: adjustmentData.type,
        amount: adjustmentData.amount,
        newNetSalary: employee.netSalary
      });

      return { adjustment, generalPayroll };
    } catch (error) {
      logger.error('❌ Error aplicando ajuste', error);
      throw error;
    }
  }

  /**
   * FASE 4: APROBAR NÓMINA GENERAL
   * Aprobar la nómina general completa
   */
  static async approveGeneralPayroll(payrollId, userId) {
    try {
      logger.info('✅ Aprobando nómina general', { payrollId, userId });

      const generalPayroll = await GeneralPayroll.findById(payrollId);
      if (!generalPayroll) {
        throw new Error('Nómina general no encontrada');
      }

      if (generalPayroll.status !== 'calculated') {
        throw new Error('Solo se pueden aprobar nóminas calculadas');
      }

      // Validar que todos los empleados estén en estado válido
      const pendingEmployees = generalPayroll.employees.filter(emp => 
        emp.status === 'pending'
      );

      if (pendingEmployees.length > 0) {
        logger.warn('⚠️ Empleados pendientes encontrados, aprobando automáticamente', {
          pendingCount: pendingEmployees.length
        });
        
        // Aprobar empleados pendientes automáticamente
        for (const emp of pendingEmployees) {
          emp.status = 'approved';
        }
      }

      // Cambiar estado a aprobado
      await generalPayroll.changeStatus('approved', userId);

      // Aprobar empleados en colección separada
      const employees = await GeneralPayrollEmployee.findByGeneralPayroll(payrollId);
      const approvalPromises = employees.map(emp => emp.changeStatus('approved', userId));
      await Promise.all(approvalPromises);

      logger.info('✅ Nómina general aprobada exitosamente', {
        payrollId,
        totalEmployees: generalPayroll.totals.totalEmployees,
        totalNetSalary: generalPayroll.totals.totalNetSalary,
        approvedBy: userId
      });

      return generalPayroll;
    } catch (error) {
      logger.error('❌ Error aprobando nómina general', error);
      throw error;
    }
  }

  /**
   * FASE 5: CERRAR NÓMINA GENERAL
   * Cerrar nómina y generar automáticamente nóminas individuales
   */
  static async closeGeneralPayroll(payrollId, userId) {
    try {
      logger.info('🔒 Cerrando nómina general y generando individuales', { payrollId, userId });

      const generalPayroll = await GeneralPayroll.findById(payrollId);
      if (!generalPayroll) {
        throw new Error('Nómina general no encontrada');
      }

      if (generalPayroll.status !== 'approved') {
        throw new Error('Solo se pueden cerrar nóminas aprobadas');
      }

      // Generar folio si no existe
      if (!generalPayroll.folio) {
        generalPayroll.generateFolio();
      }

      const individualPayrolls = [];

      // CREAR NÓMINAS INDIVIDUALES PARA CADA EMPLEADO
      for (const employeeData of generalPayroll.employees) {
        try {
          logger.info('📝 Creando nómina individual para empleado', {
            employeeId: employeeData.employeeId,
            employeeName: employeeData.employee.name
          });

          const individualPayroll = await this.createIndividualPayrollFromGeneral({
            employeeId: employeeData.employeeId,
            generalPayrollId: payrollId,
            generalPayrollFolio: generalPayroll.folio,
            period: generalPayroll.period,
            calculations: {
              baseSalary: employeeData.baseSalary,
              overtime: employeeData.overtime,
              bonuses: employeeData.bonuses,
              deductions: employeeData.deductions,
              taxes: employeeData.taxes,
              grossSalary: employeeData.grossSalary,
              netSalary: employeeData.netSalary
            },
            adjustments: employeeData.adjustments || [],
            includedExtras: employeeData.includedExtras || []
          });

          // Marcar extras como pagados
          await this.markExtrasAsPaid(
            employeeData.employeeId,
            generalPayroll.period,
            individualPayroll.id
          );

          // Actualizar referencia en nómina general
          employeeData.individualPayrollId = individualPayroll.id;
          employeeData.status = 'paid';

          // Actualizar empleado en colección separada
          const generalPayrollEmployee = await GeneralPayrollEmployee.findByEmployeeAndGeneral(
            employeeData.employeeId, payrollId
          );
          if (generalPayrollEmployee) {
            generalPayrollEmployee.individualPayrollId = individualPayroll.id;
            await generalPayrollEmployee.markAsPaid('bank_transfer', userId);
          }

          individualPayrolls.push(individualPayroll);

          logger.info('✅ Nómina individual creada', {
            individualPayrollId: individualPayroll.id,
            employeeId: employeeData.employeeId,
            netSalary: individualPayroll.netSalary
          });

        } catch (employeeError) {
          logger.error('❌ Error creando nómina individual para empleado', {
            employeeId: employeeData.employeeId,
            error: employeeError.message
          });
          // Continuar con otros empleados pero registrar el error
          employeeData.status = 'error';
          employeeData.errorMessage = employeeError.message;
        }
      }

      // Actualizar estado de nómina general
      await generalPayroll.changeStatus('closed', userId);

      logger.info('✅ Nómina general cerrada exitosamente', {
        payrollId,
        folio: generalPayroll.folio,
        totalEmployees: generalPayroll.totals.totalEmployees,
        individualPayrollsCreated: individualPayrolls.length,
        closedBy: userId
      });

      return {
        generalPayroll,
        individualPayrolls,
        summary: {
          totalEmployees: generalPayroll.totals.totalEmployees,
          successfulCreations: individualPayrolls.length,
          errors: generalPayroll.employees.filter(emp => emp.status === 'error').length
        }
      };
    } catch (error) {
      logger.error('❌ Error cerrando nómina general', error);
      throw error;
    }
  }

  // *** MÉTODOS AUXILIARES ***

  /**
   * Obtener y validar empleados activos
   */
  static async getAndValidateEmployees(employeeIds) {
    try {
      if (!employeeIds || employeeIds.length === 0) {
        throw new Error('Debe incluir al menos un empleado');
      }

      const employees = [];
      for (const employeeId of employeeIds) {
        const employee = await Employee.findById(employeeId);
        if (!employee) {
          throw new Error(`Empleado ${employeeId} no encontrado`);
        }
        if (employee.status !== 'active') {
          throw new Error(`Empleado ${employee.personalInfo.firstName} ${employee.personalInfo.lastName} no está activo`);
        }
        employees.push(employee);
      }

      return employees;
    } catch (error) {
      logger.error('❌ Error validando empleados', error);
      throw error;
    }
  }

  /**
   * Validar configuraciones de nómina individual
   */
  static async validateEmployeeConfigurations(employees) {
    try {
      for (const employee of employees) {
        const config = await PayrollConfig.findActiveByEmployee(employee.id);
        if (!config) {
          throw new Error(`Empleado ${employee.personalInfo.firstName} ${employee.personalInfo.lastName} no tiene configuración de nómina activa`);
        }
      }
    } catch (error) {
      logger.error('❌ Error validando configuraciones', error);
      throw error;
    }
  }

  /**
   * Validar que no hay conflictos con nóminas individuales
   */
  static async validateNoConflictingIndividualPayrolls(employees, startDate, endDate) {
    try {
      for (const employee of employees) {
        const availability = await Payroll.validateAvailabilityForIndividual(
          employee.id, startDate, endDate
        );
        
        if (!availability.available) {
          throw new Error(`${employee.personalInfo.firstName} ${employee.personalInfo.lastName}: ${availability.reason}`);
        }
      }
    } catch (error) {
      logger.error('❌ Error validando conflictos con nóminas individuales', error);
      throw error;
    }
  }

  /**
   * Simular cálculo de nómina para un empleado específico
   */
  static async simulateEmployeePayroll(employeeId, period) {
    try {
      // 1. Obtener configuración del empleado
      const config = await PayrollConfig.findActiveByEmployee(employeeId);
      if (!config) {
        throw new Error(`Empleado ${employeeId} no tiene configuración de nómina`);
      }

      // 2. Obtener datos del empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error(`Empleado ${employeeId} no encontrado`);
      }

      // 3. Calcular salario base según frecuencia
      const baseSalary = config.calculateSalaryForPeriod();

      // 4. Obtener extras pendientes del período
      const pendingExtras = await PayrollService.getExtrasForPeriod(
        employeeId, period.startDate, period.endDate
      );

      // 5. Separar percepciones y deducciones
      const perceptions = pendingExtras.filter(extra => {
        const impactType = extra.getImpactType ? extra.getImpactType() : extra.impactType;
        return impactType === 'positive' || impactType === 'add';
      });

      const deductions = pendingExtras.filter(extra => {
        const impactType = extra.getImpactType ? extra.getImpactType() : extra.impactType;
        return impactType === 'negative' || impactType === 'subtract';
      });

      // 6. Calcular totales
      const overtime = perceptions
        .filter(e => e.type === 'overtime')
        .reduce((sum, e) => sum + (e.calculatedAmount || e.amount), 0);

      const bonuses = perceptions
        .filter(e => e.type === 'bonus')
        .reduce((sum, e) => sum + (e.calculatedAmount || e.amount), 0);

      const totalDeductions = deductions
        .reduce((sum, e) => sum + Math.abs(e.calculatedAmount || e.amount), 0);

      // 7. Calcular impuestos (simplificado por ahora)
      const grossSalaryForTax = baseSalary + overtime + bonuses;
      const taxes = this.calculateSimplifiedTaxes(grossSalaryForTax);

      const totalDeductionsWithTax = totalDeductions + taxes;
      const grossSalary = baseSalary + overtime + bonuses;
      const netSalary = Math.max(0, grossSalary - totalDeductionsWithTax);

      // 8. Calcular asistencia (simplificado)
      const attendance = 100; // TODO: Integrar con módulo de asistencia
      const faults = 0; // TODO: Integrar con módulo de asistencia

      return {
        employeeId: employeeId,
        employee: {
          id: employee.id,
          name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
          position: employee.position?.title || 'Sin posición',
          department: employee.position?.department || 'Sin departamento',
          code: employee.employeeNumber || employee.id,
          email: employee.personalInfo.email || ''
        },
        baseSalary: baseSalary,
        overtime: overtime,
        bonuses: bonuses,
        deductions: totalDeductions,
        taxes: taxes,
        grossSalary: grossSalary,
        netSalary: netSalary,
        status: 'calculated',
        paymentStatus: 'unpaid',
        adjustments: [],
        includedExtras: pendingExtras.map(extra => ({
          id: extra.id,
          type: extra.type,
          amount: extra.calculatedAmount || extra.amount,
          description: extra.description || extra.reason
        })),
        faults: faults,
        attendance: attendance
      };
    } catch (error) {
      logger.error('❌ Error simulando empleado', { employeeId, error: error.message });
      throw error;
    }
  }

  /**
   * Actualizar empleados en colección separada
   */
  static async updateGeneralPayrollEmployees(payrollId, simulatedEmployees) {
    try {
      const updatePromises = simulatedEmployees.map(async (empData) => {
        let generalPayrollEmployee = await GeneralPayrollEmployee.findByEmployeeAndGeneral(
          empData.employeeId, payrollId
        );

        if (!generalPayrollEmployee) {
          generalPayrollEmployee = new GeneralPayrollEmployee({
            generalPayrollId: payrollId,
            employeeId: empData.employeeId,
            employee: empData.employee
          });
        }

        // Actualizar datos calculados
        Object.assign(generalPayrollEmployee, {
          baseSalary: empData.baseSalary,
          overtime: empData.overtime,
          bonuses: empData.bonuses,
          deductions: empData.deductions,
          taxes: empData.taxes,
          grossSalary: empData.grossSalary,
          netSalary: empData.netSalary,
          status: empData.status,
          includedExtras: empData.includedExtras,
          faults: empData.faults,
          attendance: empData.attendance
        });

        return generalPayrollEmployee.save();
      });

      await Promise.all(updatePromises);
    } catch (error) {
      logger.error('❌ Error actualizando empleados de nómina general', error);
      throw error;
    }
  }

  /**
   * Crear nómina individual desde nómina general
   */
  static async createIndividualPayrollFromGeneral(data) {
    try {
      const { employeeId, generalPayrollId, generalPayrollFolio, period, calculations, adjustments, includedExtras } = data;

      // 1. Obtener o crear configuración
      let config = await PayrollConfig.findActiveByEmployee(employeeId);
      if (!config) {
        // Crear configuración básica si no existe
        const employee = await Employee.findById(employeeId);
        config = new PayrollConfig({
          employeeId: employeeId,
          baseSalary: calculations.baseSalary * (period.frequency === 'monthly' ? 1 : 
                      period.frequency === 'biweekly' ? 2 :
                      period.frequency === 'weekly' ? 4 : 30),
          frequency: period.frequency,
          startDate: period.startDate,
          isActive: true,
          createdBy: 'system_general_payroll'
        });
        await config.save();
      }

      // 2. Crear período de nómina individual
      const individualPayroll = new Payroll({
        employeeId: employeeId,
        periodStart: period.startDate,
        periodEnd: period.endDate,
        frequency: period.frequency,
        baseSalary: config.baseSalary,
        calculatedSalary: calculations.baseSalary,
        totalPerceptions: calculations.overtime + calculations.bonuses,
        totalDeductions: calculations.deductions + calculations.taxes,
        grossSalary: calculations.grossSalary,
        netSalary: calculations.netSalary,
        status: 'approved',
        // REFERENCIAS A NÓMINA GENERAL
        generalPayrollId: generalPayrollId,
        generalPayrollFolio: generalPayrollFolio,
        createdFromGeneral: true,
        approvedBy: 'system_general_payroll',
        approvedAt: new Date().toISOString()
      });

      // Calcular campos adicionales
      const currentDate = new Date(period.startDate);
      individualPayroll.year = currentDate.getFullYear();
      individualPayroll.month = currentDate.getMonth() + 1;
      
      if (period.frequency === 'weekly') {
        individualPayroll.weekNumber = Math.ceil(currentDate.getDate() / 7);
      }

      await individualPayroll.save();

      // 3. Crear detalles de percepciones y deducciones
      const details = [];

      // Salario base
      details.push(new PayrollDetail({
        payrollId: individualPayroll.id,
        employeeId: employeeId,
        type: 'perception',
        concept: 'Salario Base',
        amount: calculations.baseSalary,
        description: `Salario base para período ${period.startDate} - ${period.endDate}`
      }));

      // Horas extra
      if (calculations.overtime > 0) {
        details.push(new PayrollDetail({
          payrollId: individualPayroll.id,
          employeeId: employeeId,
          type: 'perception',
          concept: 'Horas Extra',
          amount: calculations.overtime,
          description: 'Horas extra del período'
        }));
      }

      // Bonos
      if (calculations.bonuses > 0) {
        details.push(new PayrollDetail({
          payrollId: individualPayroll.id,
          employeeId: employeeId,
          type: 'perception',
          concept: 'Bonos',
          amount: calculations.bonuses,
          description: 'Bonos del período'
        }));
      }

      // Deducciones
      if (calculations.deductions > 0) {
        details.push(new PayrollDetail({
          payrollId: individualPayroll.id,
          employeeId: employeeId,
          type: 'deduction',
          concept: 'Deducciones',
          amount: calculations.deductions,
          description: 'Deducciones del período'
        }));
      }

      // Impuestos
      if (calculations.taxes > 0) {
        details.push(new PayrollDetail({
          payrollId: individualPayroll.id,
          employeeId: employeeId,
          type: 'deduction',
          concept: 'Impuestos',
          amount: calculations.taxes,
          description: 'Impuestos calculados'
        }));
      }

      // Ajustes aplicados en nómina general
      for (const adjustment of adjustments) {
        details.push(new PayrollDetail({
          payrollId: individualPayroll.id,
          employeeId: employeeId,
          type: adjustment.type === 'bonus' ? 'perception' : 'deduction',
          concept: adjustment.concept,
          amount: Math.abs(adjustment.amount),
          description: `Ajuste de nómina general: ${adjustment.reason || adjustment.concept}`
        }));
      }

      // Guardar todos los detalles
      const savePromises = details.map(detail => detail.save());
      await Promise.all(savePromises);

      logger.info('✅ Nómina individual creada desde general', {
        individualPayrollId: individualPayroll.id,
        employeeId: employeeId,
        generalPayrollId: generalPayrollId,
        netSalary: individualPayroll.netSalary
      });

      return individualPayroll;
    } catch (error) {
      logger.error('❌ Error creando nómina individual desde general', error);
      throw error;
    }
  }

  /**
   * Marcar extras como pagados
   */
  static async markExtrasAsPaid(employeeId, period, payrollId) {
    try {
      const pendingExtras = await PayrollMovement.findByEmployeeAndPeriod(
        employeeId, period.startDate, period.endDate
      );

      const updatePromises = pendingExtras
        .filter(extra => !extra.appliedToPayroll)
        .map(async (extra) => {
          extra.appliedToPayroll = true;
          extra.payrollId = payrollId;
          extra.payrollPeriod = `${period.startDate} - ${period.endDate}`;
          extra.updatedAt = new Date().toISOString();
          return extra.save();
        });

      await Promise.all(updatePromises);

      logger.info('✅ Extras marcados como pagados', {
        employeeId,
        payrollId,
        extrasCount: updatePromises.length
      });
    } catch (error) {
      logger.error('❌ Error marcando extras como pagados', error);
      throw error;
    }
  }

  /**
   * Calcular impuestos simplificados
   */
  static calculateSimplifiedTaxes(grossSalary) {
    // Cálculo simplificado de ISR
    // En producción debería usar TaxCalculationService
    if (grossSalary <= 8000) return 0;
    if (grossSalary <= 15000) return grossSalary * 0.05;
    if (grossSalary <= 30000) return grossSalary * 0.10;
    return grossSalary * 0.15;
  }

  /**
   * Obtener empleados disponibles para nómina general
   */
  static async getAvailableEmployees(startDate, endDate) {
    try {
      // Obtener todos los empleados activos
      const allEmployees = await Employee.findActive();
      
      const availableEmployees = [];
      
      for (const employee of allEmployees) {
        // Verificar disponibilidad
        const availability = await Payroll.validateAvailabilityForIndividual(
          employee.id, startDate, endDate
        );
        
        if (availability.available) {
          // Verificar configuración de nómina
          const config = await PayrollConfig.findActiveByEmployee(employee.id);
          
          availableEmployees.push({
            id: employee.id,
            name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            position: employee.position?.title || 'Sin posición',
            department: employee.position?.department || 'Sin departamento',
            code: employee.employeeNumber || employee.id,
            email: employee.personalInfo.email || '',
            hasPayrollConfig: !!config,
            baseSalary: config?.baseSalary || 0,
            frequency: config?.frequency || 'monthly'
          });
        }
      }

      return availableEmployees;
    } catch (error) {
      logger.error('❌ Error obteniendo empleados disponibles', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de nómina general
   */
  static async getGeneralPayrollStats(payrollId) {
    try {
      const generalPayroll = await GeneralPayroll.findById(payrollId);
      if (!generalPayroll) {
        throw new Error('Nómina general no encontrada');
      }

      const employees = await GeneralPayrollEmployee.findByGeneralPayroll(payrollId);
      const adjustments = await GeneralPayrollAdjustment.findByGeneralPayroll(payrollId);

      const stats = {
        general: {
          id: generalPayroll.id,
          folio: generalPayroll.folio,
          status: generalPayroll.status,
          period: generalPayroll.period,
          totals: generalPayroll.totals
        },
        employees: {
          total: employees.length,
          byStatus: employees.reduce((acc, emp) => {
            acc[emp.status] = (acc[emp.status] || 0) + 1;
            return acc;
          }, {}),
          byPaymentStatus: employees.reduce((acc, emp) => {
            acc[emp.paymentStatus] = (acc[emp.paymentStatus] || 0) + 1;
            return acc;
          }, {})
        },
        adjustments: {
          total: adjustments.length,
          totalAmount: adjustments.reduce((sum, adj) => sum + adj.amount, 0),
          byType: adjustments.reduce((acc, adj) => {
            acc[adj.type] = (acc[adj.type] || 0) + 1;
            return acc;
          }, {})
        }
      };

      return stats;
    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas', error);
      throw error;
    }
  }
}

module.exports = GeneralPayrollService;
