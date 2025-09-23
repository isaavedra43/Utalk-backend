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

      // 1. Verificar si ya existe nómina general para el período
      const existingPayroll = await GeneralPayroll.findByPeriod(startDate, endDate);
      if (existingPayroll) {
        logger.info('ℹ️ Nómina general ya existe para este período', {
          existingPayrollId: existingPayroll.id,
          period: `${startDate} - ${endDate}`,
          hasRealData: existingPayroll.totals?.totalGrossSalary > 0
        });
        
        // Si la nómina existente tiene valores 0, actualizarla con datos reales
        if (!existingPayroll.totals?.totalGrossSalary || existingPayroll.totals.totalGrossSalary === 0) {
          logger.info('🔄 Nómina existente tiene valores 0, actualizando con datos reales');
          
          // Obtener y validar empleados activos
          const activeEmployees = await this.getAndValidateEmployees(includeEmployees);
          
          // Validar y crear configuraciones de nómina individual si no existen
          const configWarnings = await this.validateEmployeeConfigurations(activeEmployees);
          
          // Calcular datos reales para cada empleado usando simulación
          const employeesWithRealData = await Promise.all(activeEmployees.map(async (emp) => {
            try {
              const simulation = await this.simulateEmployeePayroll(emp.id, {
                startDate,
                endDate,
                type: frequency
              });

              return {
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
                baseSalary: simulation.base || 0,
                overtime: simulation.overtime || 0,
                bonuses: simulation.bonuses || 0,
                deductions: simulation.deductions || 0,
                taxes: simulation.taxes || 0,
                grossSalary: simulation.gross || 0,
                netSalary: simulation.net || 0,
                adjustments: [],
                includedExtras: simulation.includedExtras || [],
                faults: simulation.faults || 0,
                attendance: simulation.attendance || 100,
                warnings: simulation.warnings || []
              };
            } catch (simError) {
              logger.error('❌ Error calculando datos reales para empleado existente', {
                employeeId: emp.id,
                error: simError.message
              });
              return null;
            }
          }));

          // Filtrar empleados nulos (errores)
          const validEmployeesData = employeesWithRealData.filter(emp => emp !== null);
          
          if (validEmployeesData.length > 0) {
            // Actualizar la nómina existente con datos reales
            existingPayroll.employees = validEmployeesData;
            existingPayroll.calculateTotals();
            await existingPayroll.save();

            // Actualizar también los registros de empleados en la colección separada
            for (const empData of validEmployeesData) {
              const existingEmployee = await GeneralPayrollEmployee.findByEmployeeAndGeneral(
                empData.employeeId,
                existingPayroll.id
              );
              
              if (existingEmployee) {
                existingEmployee.baseSalary = empData.baseSalary;
                existingEmployee.overtime = empData.overtime;
                existingEmployee.bonuses = empData.bonuses;
                existingEmployee.deductions = empData.deductions;
                existingEmployee.taxes = empData.taxes;
                existingEmployee.grossSalary = empData.grossSalary;
                existingEmployee.netSalary = empData.netSalary;
                await existingEmployee.save();
              }
            }

            logger.info('✅ Nómina existente actualizada con datos reales', {
              payrollId: existingPayroll.id,
              totalGross: existingPayroll.totals.totalGrossSalary,
              totalNet: existingPayroll.totals.totalNetSalary
            });
          }
        }
        
        // Devolver la nómina existente (ahora con datos reales)
        return {
          ...existingPayroll,
          configWarnings: [],
          isExisting: true
        };
      }

      // 2. Obtener y validar empleados activos
      const activeEmployees = await this.getAndValidateEmployees(includeEmployees);
      
      // 3. Validar y crear configuraciones de nómina individual si no existen
      const configWarnings = await this.validateEmployeeConfigurations(activeEmployees);
      
      // 4. Validar que no hay conflictos con nóminas individuales
      await this.validateNoConflictingIndividualPayrolls(activeEmployees, startDate, endDate);

      // 5. Calcular datos reales para cada empleado usando simulación
      logger.info('🔄 Calculando datos reales de nómina para empleados', {
        employeesCount: activeEmployees.length,
        period: `${startDate} - ${endDate}`
      });

      const employeesWithRealData = await Promise.all(activeEmployees.map(async (emp) => {
        try {
          // Calcular nómina real usando simulación
          const simulation = await this.simulateEmployeePayroll(emp.id, {
            startDate,
            endDate,
            type: frequency
          });

          logger.info('✅ Datos reales calculados para empleado', {
            employeeId: emp.id,
            employeeName: `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`,
            gross: simulation.gross || 0,
            net: simulation.net || 0,
            base: simulation.base || 0
          });

          return {
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
            baseSalary: simulation.base || 0,
            overtime: simulation.overtime || 0,
            bonuses: simulation.bonuses || 0,
            deductions: simulation.deductions || 0,
            taxes: simulation.taxes || 0,
            grossSalary: simulation.gross || 0,
            netSalary: simulation.net || 0,
            adjustments: [],
            includedExtras: simulation.includedExtras || [],
            faults: simulation.faults || 0,
            attendance: simulation.attendance || 100,
            warnings: simulation.warnings || []
          };
        } catch (simError) {
          logger.error('❌ Error calculando datos reales, usando valores por defecto', {
            employeeId: emp.id,
            error: simError.message
          });

          // En caso de error, usar valores por defecto pero marcar con warning
          return {
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
            attendance: 100,
            warnings: [`Error calculando datos reales: ${simError.message}`]
          };
        }
      }));

      // 6. Crear registro inicial de nómina general con datos reales
      const generalPayroll = new GeneralPayroll({
        period: { startDate, endDate, frequency },
        status: 'draft',
        employees: employeesWithRealData,
        createdBy: userId
      });

      generalPayroll.calculateTotals();
      await generalPayroll.save();

      // 7. Crear registros de empleados en colección separada con datos reales
      const employeePromises = generalPayroll.employees.map(empData => {
        const generalPayrollEmployee = new GeneralPayrollEmployee({
          generalPayrollId: generalPayroll.id,
          employeeId: empData.employeeId,
          employee: empData.employee,
          status: 'pending',
          baseSalary: empData.baseSalary,
          overtime: empData.overtime,
          bonuses: empData.bonuses,
          deductions: empData.deductions,
          taxes: empData.taxes,
          grossSalary: empData.grossSalary,
          netSalary: empData.netSalary
        });
        return generalPayrollEmployee.save();
      });

      await Promise.all(employeePromises);

      logger.info('✅ Nómina general creada exitosamente con datos reales', {
        id: generalPayroll.id,
        totalEmployees: generalPayroll.totals.totalEmployees,
        period: `${startDate} - ${endDate}`,
        frequency,
        configWarnings: configWarnings.length,
        totalGross: generalPayroll.totals.totalGrossSalary,
        totalNet: generalPayroll.totals.totalNetSalary
      });

      return {
        ...generalPayroll,
        configWarnings: configWarnings
      };
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
   * Validar y crear configuraciones de nómina individual si no existen
   */
  static async validateEmployeeConfigurations(employees) {
    try {
      const warnings = [];
      
      for (const employee of employees) {
        let config = await PayrollConfig.findActiveByEmployee(employee.id);
        if (!config) {
          logger.warn('⚠️ Empleado sin configuración de nómina, creando automáticamente', {
            employeeId: employee.id,
            employeeName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`
          });
          
          // Crear configuración básica automáticamente
          config = new PayrollConfig({
            employeeId: employee.id,
            baseSalary: employee.salary || 12000, // Salario por defecto si no está definido
            frequency: 'monthly',
            startDate: new Date().toISOString().split('T')[0],
            isActive: true,
            createdBy: 'system_auto_creation',
            autoCreated: true // Marcar como creada automáticamente
          });
          
          await config.save();
          
          warnings.push(`Configuración de nómina creada automáticamente para ${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`);
          
          logger.info('✅ Configuración de nómina creada automáticamente', {
            employeeId: employee.id,
            configId: config.id,
            baseSalary: config.baseSalary
          });
        }
      }
      
      if (warnings.length > 0) {
        logger.info('ℹ️ Configuraciones creadas automáticamente', { warnings });
      }
      
      return warnings;
    } catch (error) {
      logger.error('❌ Error validando/creando configuraciones', error);
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
      // 1. Obtener configuración del empleado o usar valores por defecto
      let config = await PayrollConfig.findActiveByEmployee(employeeId);
      let warnings = [];
      
      if (!config) {
        logger.warn('⚠️ Empleado sin configuración de nómina, usando valores por defecto', {
          employeeId
        });
        
        // Obtener salario del contrato del empleado
        const employeeContractSalary = employee.contract?.salary || employee.salary?.baseSalary || 12222;
        
        // Crear configuración temporal para cálculo usando datos reales
        config = {
          baseSalary: employeeContractSalary,
          frequency: 'monthly',
          calculateSalaryForPeriod: function() {
            // Cálculo básico según frecuencia usando salario real del empleado
            const daysInPeriod = this.calculateWorkingDaysInPeriod(period);
            const monthlySalary = this.baseSalary;
            return (monthlySalary / 30) * daysInPeriod;
          },
          calculateWorkingDaysInPeriod: function(period) {
            const start = new Date(period.startDate);
            const end = new Date(period.endDate);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            return Math.min(days, 7); // Máximo 7 días para períodos cortos
          }
        };
        
        logger.info('✅ Configuración temporal creada con salario real', {
          employeeId,
          contractSalary: employeeContractSalary,
          configBaseSalary: config.baseSalary
        });
        
        warnings.push('Empleado sin configuración de nómina; usando valores por defecto');
      }

      // 2. Obtener datos del empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error(`Empleado ${employeeId} no encontrado`);
      }

      // 3. Calcular salario base según frecuencia
      const baseSalary = config.calculateSalaryForPeriod();

      // 4. Obtener extras pendientes del período
      logger.info('🔍 Obteniendo extras para simulación', {
        employeeId,
        period: `${period.startDate} - ${period.endDate}`
      });
      
      const pendingExtras = await PayrollService.getExtrasForPeriod(
        employeeId, period.startDate, period.endDate
      );

      logger.info('📊 Extras obtenidos para simulación', {
        employeeId,
        extrasCount: pendingExtras.length,
        extrasDetails: pendingExtras.map(e => ({
          id: e.id,
          type: e.type,
          amount: e.calculatedAmount || e.amount,
          status: e.status,
          appliedToPayroll: e.appliedToPayroll
        }))
      });

      // 5. Separar percepciones y deducciones
      const perceptions = pendingExtras.filter(extra => {
        const impactType = extra.getImpactType ? extra.getImpactType() : extra.impactType;
        return impactType === 'positive' || impactType === 'add';
      });

      const deductions = pendingExtras.filter(extra => {
        const impactType = extra.getImpactType ? extra.getImpactType() : extra.impactType;
        return impactType === 'negative' || impactType === 'subtract';
      });

      logger.info('📈 Extras separados por tipo', {
        employeeId,
        perceptions: perceptions.length,
        deductions: deductions.length,
        perceptionsDetail: perceptions.map(e => ({
          type: e.type,
          amount: e.calculatedAmount || e.amount
        })),
        deductionsDetail: deductions.map(e => ({
          type: e.type,
          amount: e.calculatedAmount || e.amount
        }))
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

      logger.info('💰 Cálculos finales de simulación', {
        employeeId,
        baseSalary,
        overtime,
        bonuses,
        totalDeductions,
        taxes,
        grossSalary,
        netSalary,
        totalExtrasUsed: pendingExtras.length
      });

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
        attendance: attendance,
        warnings: warnings
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

  // ================================
  // GESTIÓN DE IMPUESTOS
  // ================================

  /**
   * Toggle global de impuestos para toda la nómina
   */
  static async toggleGlobalTaxes(payrollId, taxesEnabled, userId) {
    try {
      logger.info('🏛️ Aplicando toggle global de impuestos', {
        payrollId,
        taxesEnabled,
        userId
      });

      // 1. Obtener nómina general
      const generalPayroll = await GeneralPayroll.findById(payrollId);
      if (!generalPayroll) {
        throw new Error('Nómina general no encontrada');
      }

      // 2. Actualizar configuración global de impuestos
      generalPayroll.taxesConfiguration = generalPayroll.taxesConfiguration || {};
      generalPayroll.taxesConfiguration.globalTaxesEnabled = taxesEnabled;
      generalPayroll.taxesConfiguration.updatedAt = new Date().toISOString();
      generalPayroll.taxesConfiguration.updatedBy = userId;

      // 3. Recalcular todos los empleados con nueva configuración
      const updatedEmployees = [];
      for (const employee of generalPayroll.employees) {
        // Verificar si el empleado tiene override individual
        const hasIndividualOverride = generalPayroll.taxesConfiguration.employeeOverrides && 
                                    generalPayroll.taxesConfiguration.employeeOverrides[employee.employeeId];
        
        // Si no tiene override, usar configuración global
        if (!hasIndividualOverride) {
          const newCalculations = await this.recalculateEmployeeWithTaxes(
            employee, taxesEnabled, generalPayroll.period
          );
          
          // Actualizar datos del empleado
          Object.assign(employee, newCalculations);
          updatedEmployees.push(employee.employeeId);
        }
      }

      // 4. Recalcular totales
      generalPayroll.calculateTotals();
      await generalPayroll.save();

      // 5. Actualizar empleados en colección separada
      const employeePromises = updatedEmployees.map(async (employeeId) => {
        const generalPayrollEmployee = await GeneralPayrollEmployee.findByEmployeeAndGeneral(
          employeeId, payrollId
        );
        if (generalPayrollEmployee) {
          const employeeData = generalPayroll.employees.find(e => e.employeeId === employeeId);
          if (employeeData) {
            Object.assign(generalPayrollEmployee, employeeData);
            await generalPayrollEmployee.save();
          }
        }
      });
      await Promise.all(employeePromises);

      logger.info('✅ Toggle global de impuestos aplicado', {
        payrollId,
        taxesEnabled,
        affectedEmployees: updatedEmployees.length,
        newTotals: generalPayroll.totals
      });

      return {
        taxesEnabled,
        affectedEmployees: updatedEmployees.length,
        totals: generalPayroll.totals,
        updatedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('❌ Error en toggle global de impuestos', error);
      throw error;
    }
  }

  /**
   * Toggle individual de impuestos para un empleado específico
   */
  static async toggleEmployeeTaxes(payrollId, employeeId, taxesEnabled, userId) {
    try {
      logger.info('👤 Aplicando toggle individual de impuestos', {
        payrollId,
        employeeId,
        taxesEnabled,
        userId
      });

      // 1. Obtener nómina general
      const generalPayroll = await GeneralPayroll.findById(payrollId);
      if (!generalPayroll) {
        throw new Error('Nómina general no encontrada');
      }

      // 2. Encontrar empleado
      const employee = generalPayroll.employees.find(emp => emp.employeeId === employeeId);
      if (!employee) {
        throw new Error('Empleado no encontrado en la nómina general');
      }

      // 3. Configurar override individual
      generalPayroll.taxesConfiguration = generalPayroll.taxesConfiguration || {};
      generalPayroll.taxesConfiguration.employeeOverrides = generalPayroll.taxesConfiguration.employeeOverrides || {};
      generalPayroll.taxesConfiguration.employeeOverrides[employeeId] = taxesEnabled;
      generalPayroll.taxesConfiguration.updatedAt = new Date().toISOString();
      generalPayroll.taxesConfiguration.updatedBy = userId;

      // 4. Recalcular empleado específico
      const newCalculations = await this.recalculateEmployeeWithTaxes(
        employee, taxesEnabled, generalPayroll.period
      );

      // 5. Actualizar datos del empleado
      Object.assign(employee, newCalculations);

      // 6. Recalcular totales
      generalPayroll.calculateTotals();
      await generalPayroll.save();

      // 7. Actualizar empleado en colección separada
      const generalPayrollEmployee = await GeneralPayrollEmployee.findByEmployeeAndGeneral(
        employeeId, payrollId
      );
      if (generalPayrollEmployee) {
        Object.assign(generalPayrollEmployee, employee);
        await generalPayrollEmployee.save();
      }

      logger.info('✅ Toggle individual de impuestos aplicado', {
        payrollId,
        employeeId,
        taxesEnabled,
        newCalculations
      });

      return {
        taxesEnabled,
        employee: {
          id: employee.employeeId,
          name: employee.employee.name,
          position: employee.employee.position
        },
        calculations: {
          baseSalary: employee.baseSalary,
          overtime: employee.overtime,
          bonuses: employee.bonuses,
          taxes: employee.taxes,
          deductions: employee.deductions,
          grossSalary: employee.grossSalary,
          netSalary: employee.netSalary
        },
        updatedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('❌ Error en toggle individual de impuestos', error);
      throw error;
    }
  }

  /**
   * Obtener configuración actual de impuestos
   */
  static async getTaxesConfiguration(payrollId) {
    try {
      const generalPayroll = await GeneralPayroll.findById(payrollId);
      if (!generalPayroll) {
        throw new Error('Nómina general no encontrada');
      }

      const taxesConfig = generalPayroll.taxesConfiguration || {};

      return {
        payrollId,
        globalTaxesEnabled: taxesConfig.globalTaxesEnabled || false,
        employeeOverrides: taxesConfig.employeeOverrides || {},
        updatedAt: taxesConfig.updatedAt || null,
        updatedBy: taxesConfig.updatedBy || null,
        employees: generalPayroll.employees.map(emp => ({
          employeeId: emp.employeeId,
          name: emp.employee.name,
          hasOverride: !!(taxesConfig.employeeOverrides && taxesConfig.employeeOverrides[emp.employeeId]),
          taxesEnabled: this.isEmployeeTaxesEnabled(emp.employeeId, taxesConfig),
          currentTaxes: emp.taxes || 0
        }))
      };

    } catch (error) {
      logger.error('❌ Error obteniendo configuración de impuestos', error);
      throw error;
    }
  }

  /**
   * Verificar si los impuestos están habilitados para un empleado específico
   */
  static isEmployeeTaxesEnabled(employeeId, taxesConfig) {
    // Prioridad: Override individual > Configuración global
    if (taxesConfig.employeeOverrides && taxesConfig.employeeOverrides.hasOwnProperty(employeeId)) {
      return taxesConfig.employeeOverrides[employeeId];
    }
    
    return taxesConfig.globalTaxesEnabled || false;
  }

  /**
   * Recalcular empleado con nueva configuración de impuestos
   */
  static async recalculateEmployeeWithTaxes(employee, taxesEnabled, period) {
    try {
      // Mantener valores base (no cambian)
      const baseSalary = employee.baseSalary;
      const overtime = employee.overtime;
      const bonuses = employee.bonuses;
      const deductions = employee.deductions; // Deducciones internas (no impuestos)

      // Calcular salario bruto
      const grossSalary = baseSalary + overtime + bonuses;

      // Calcular impuestos según configuración
      let taxes = 0;
      if (taxesEnabled) {
        taxes = this.calculateSimplifiedTaxes(grossSalary);
      }

      // Calcular salario neto
      const netSalary = Math.max(0, grossSalary - deductions - taxes);

      logger.info('💰 Recálculo con impuestos', {
        employeeId: employee.employeeId,
        taxesEnabled,
        baseSalary,
        overtime,
        bonuses,
        deductions,
        taxes,
        grossSalary,
        netSalary
      });

      return {
        baseSalary,
        overtime,
        bonuses,
        deductions,
        taxes,
        grossSalary,
        netSalary,
        updatedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('❌ Error recalculando empleado con impuestos', error);
      throw error;
    }
  }
}

module.exports = GeneralPayrollService;
