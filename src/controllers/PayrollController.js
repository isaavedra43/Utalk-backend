const PayrollPeriod = require('../models/PayrollPeriod');
const PayrollBreakdown = require('../models/PayrollBreakdown');
const Employee = require('../models/Employee');
const EmployeeHistory = require('../models/EmployeeHistory');

/**
 * Controlador de Nómina
 * Gestiona períodos de pago, cálculos salariales y reportes
 */
class PayrollController {
  /**
   * Obtiene nómina de un empleado
   * GET /api/employees/:id/payroll
   */
  static async getByEmployee(req, res) {
    try {
      const { id: employeeId } = req.params;
      const {
        year = new Date().getFullYear(),
        month = null,
        week = null,
        periodStart = null,
        periodEnd = null
      } = req.query;

      // Verificar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      const options = {
        year: parseInt(year),
        month: month ? parseInt(month) : null,
        week: week ? parseInt(week) : null,
        periodStart,
        periodEnd
      };

      const periods = await PayrollPeriod.listByEmployee(employeeId, options);
      const summary = await PayrollPeriod.getSummaryByEmployee(employeeId, parseInt(year));

      res.json({
        success: true,
        data: {
          periods,
          summary
        }
      });
    } catch (error) {
      console.error('Error getting payroll by employee:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener nómina del empleado',
        details: error.message
      });
    }
  }

  /**
   * Crea un nuevo período de nómina
   * POST /api/employees/:id/payroll
   */
  static async create(req, res) {
    try {
      const { id: employeeId } = req.params;
      const payrollData = req.body;
      const createdBy = req.user?.id || null;

      // Verificar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Crear período de nómina
      const payroll = new PayrollPeriod({
        ...payrollData,
        employeeId
      });

      // Calcular deducciones automáticamente si no se proporcionan
      if (!payrollData.taxes && !payrollData.socialSecurity) {
        payroll.calculateDeductions();
      } else {
        payroll.calculateNetSalary();
      }

      await payroll.save();

      // Crear desgloses si se proporcionan
      if (payrollData.deductions && Array.isArray(payrollData.deductions)) {
        for (const deduction of payrollData.deductions) {
          const breakdown = new PayrollBreakdown({
            ...deduction,
            payrollPeriodId: payroll.id,
            employeeId,
            type: 'deduction'
          });
          await breakdown.save();
        }
      }

      if (payrollData.bonuses && Array.isArray(payrollData.bonuses)) {
        for (const bonus of payrollData.bonuses) {
          const breakdown = new PayrollBreakdown({
            ...bonus,
            payrollPeriodId: payroll.id,
            employeeId,
            type: 'perception'
          });
          await breakdown.save();
        }
      }

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'salary_change',
        `Período de nómina creado: ${payroll.periodStart} - ${payroll.periodEnd}`,
        {
          payrollId: payroll.id,
          grossSalary: payroll.grossSalary,
          netSalary: payroll.netSalary,
          period: `${payroll.periodStart} - ${payroll.periodEnd}`
        },
        createdBy,
        req
      );

      res.status(201).json({
        success: true,
        data: { payroll },
        message: 'Período de nómina creado exitosamente'
      });
    } catch (error) {
      console.error('Error creating payroll period:', error);
      res.status(500).json({
        success: false,
        error: 'Error al crear período de nómina',
        details: error.message
      });
    }
  }

  /**
   * Actualiza un período de nómina
   * PUT /api/employees/:id/payroll/:payrollId
   */
  static async update(req, res) {
    try {
      const { id: employeeId, payrollId } = req.params;
      const updateData = req.body;
      const updatedBy = req.user?.id || null;

      const payroll = await PayrollPeriod.findById(employeeId, payrollId);
      if (!payroll) {
        return res.status(404).json({
          success: false,
          error: 'Período de nómina no encontrado'
        });
      }

      const oldValues = {
        grossSalary: payroll.grossSalary,
        netSalary: payroll.netSalary,
        status: payroll.status
      };

      await payroll.update(updateData);

      // Registrar cambios en historial si hay diferencias significativas
      if (oldValues.grossSalary !== payroll.grossSalary || 
          oldValues.netSalary !== payroll.netSalary ||
          oldValues.status !== payroll.status) {
        
        await EmployeeHistory.createHistoryRecord(
          employeeId,
          'salary_change',
          `Período de nómina actualizado: ${payroll.periodStart} - ${payroll.periodEnd}`,
          {
            payrollId: payroll.id,
            changes: {
              oldValues,
              newValues: {
                grossSalary: payroll.grossSalary,
                netSalary: payroll.netSalary,
                status: payroll.status
              }
            }
          },
          updatedBy,
          req
        );
      }

      res.json({
        success: true,
        data: { payroll },
        message: 'Período de nómina actualizado exitosamente'
      });
    } catch (error) {
      console.error('Error updating payroll period:', error);
      res.status(500).json({
        success: false,
        error: 'Error al actualizar período de nómina',
        details: error.message
      });
    }
  }

  /**
   * Obtiene desglose detallado de un período de nómina
   * GET /api/employees/:id/payroll/:payrollId/breakdown
   */
  static async getBreakdown(req, res) {
    try {
      const { id: employeeId, payrollId } = req.params;

      const payroll = await PayrollPeriod.findById(employeeId, payrollId);
      if (!payroll) {
        return res.status(404).json({
          success: false,
          error: 'Período de nómina no encontrado'
        });
      }

      const breakdown = await PayrollBreakdown.listByPeriod(employeeId, payrollId);
      const perceptions = breakdown.filter(item => item.type === 'perception');
      const deductions = breakdown.filter(item => item.type === 'deduction');
      const totals = await PayrollBreakdown.calculateTotals(employeeId, payrollId);

      res.json({
        success: true,
        data: {
          payroll,
          breakdown: {
            perceptions,
            deductions
          },
          totals
        }
      });
    } catch (error) {
      console.error('Error getting payroll breakdown:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener desglose de nómina',
        details: error.message
      });
    }
  }

  /**
   * Obtiene nómina semanal para todos los empleados
   * GET /api/payroll/weekly
   */
  static async getWeeklyPayroll(req, res) {
    try {
      const {
        week,
        year,
        department = null
      } = req.query;

      if (!week || !year) {
        return res.status(400).json({
          success: false,
          error: 'Semana y año son requeridos'
        });
      }

      const weeklyData = await PayrollPeriod.getWeeklyPayroll(
        parseInt(week),
        parseInt(year),
        department
      );

      res.json({
        success: true,
        data: weeklyData
      });
    } catch (error) {
      console.error('Error getting weekly payroll:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener nómina semanal',
        details: error.message
      });
    }
  }

  /**
   * Calcula nómina automáticamente para un empleado
   * POST /api/employees/:id/payroll/calculate
   */
  static async calculatePayroll(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { periodStart, periodEnd } = req.body;

      if (!periodStart || !periodEnd) {
        return res.status(400).json({
          success: false,
          error: 'Fechas de inicio y fin del período son requeridas'
        });
      }

      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Crear período base con salario del contrato
      const payroll = new PayrollPeriod({
        employeeId,
        periodStart,
        periodEnd,
        grossSalary: employee.contract.salary,
        baseSalary: employee.contract.salary,
        weekNumber: PayrollController.getWeekNumber(new Date(periodStart)),
        year: new Date(periodStart).getFullYear()
      });

      // TODO: Integrar con datos de asistencia para calcular horas extra
      // TODO: Aplicar bonos y comisiones si existen
      
      // Calcular deducciones automáticamente
      payroll.calculateDeductions();

      res.json({
        success: true,
        data: {
          payroll,
          message: 'Nómina calculada. Revise los valores antes de guardar.'
        }
      });
    } catch (error) {
      console.error('Error calculating payroll:', error);
      res.status(500).json({
        success: false,
        error: 'Error al calcular nómina',
        details: error.message
      });
    }
  }

  /**
   * Genera recibo de nómina en PDF
   * GET /api/employees/:id/payroll/:payrollId/receipt
   */
  static async generateReceipt(req, res) {
    try {
      const { id: employeeId, payrollId } = req.params;

      const payroll = await PayrollPeriod.findById(employeeId, payrollId);
      if (!payroll) {
        return res.status(404).json({
          success: false,
          error: 'Período de nómina no encontrado'
        });
      }

      const employee = await Employee.findById(employeeId);
      const breakdown = await PayrollBreakdown.listByPeriod(employeeId, payrollId);

      // TODO: Implementar generación de PDF
      // Por ahora devolver datos estructurados
      
      res.json({
        success: true,
        data: {
          employee: {
            name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            employeeNumber: employee.employeeNumber,
            position: employee.position.title,
            department: employee.position.department
          },
          payroll,
          breakdown,
          generatedAt: new Date().toISOString()
        },
        message: 'Generación de PDF en desarrollo'
      });
    } catch (error) {
      console.error('Error generating receipt:', error);
      res.status(500).json({
        success: false,
        error: 'Error al generar recibo',
        details: error.message
      });
    }
  }

  /**
   * Obtiene reportes de nómina
   * GET /api/payroll/reports
   */
  static async getReports(req, res) {
    try {
      const {
        type = 'summary',
        year = new Date().getFullYear(),
        month = null,
        department = null
      } = req.query;

      let reportData = {};

      switch (type) {
        case 'summary':
          // TODO: Implementar reporte resumen
          reportData = {
            type: 'summary',
            message: 'Reporte resumen en desarrollo'
          };
          break;
          
        case 'detailed':
          // TODO: Implementar reporte detallado
          reportData = {
            type: 'detailed',
            message: 'Reporte detallado en desarrollo'
          };
          break;
          
        case 'taxes':
          // TODO: Implementar reporte de impuestos
          reportData = {
            type: 'taxes',
            message: 'Reporte de impuestos en desarrollo'
          };
          break;
          
        default:
          return res.status(400).json({
            success: false,
            error: 'Tipo de reporte no válido'
          });
      }

      res.json({
        success: true,
        data: reportData
      });
    } catch (error) {
      console.error('Error getting payroll reports:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener reportes de nómina',
        details: error.message
      });
    }
  }

  /**
   * Procesa nómina masiva
   * POST /api/payroll/bulk-process
   */
  static async bulkProcess(req, res) {
    try {
      const {
        employeeIds,
        periodStart,
        periodEnd,
        department = null
      } = req.body;

      if (!periodStart || !periodEnd) {
        return res.status(400).json({
          success: false,
          error: 'Fechas de período son requeridas'
        });
      }

      let targetEmployees = [];

      if (employeeIds && Array.isArray(employeeIds)) {
        // Procesar empleados específicos
        for (const id of employeeIds) {
          const employee = await Employee.findById(id);
          if (employee) {
            targetEmployees.push(employee);
          }
        }
      } else if (department) {
        // Procesar por departamento
        targetEmployees = await Employee.getByDepartment(department);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Debe especificar empleados o departamento'
        });
      }

      const results = {
        processed: 0,
        errors: [],
        payrolls: []
      };

      // Procesar cada empleado
      for (const employee of targetEmployees) {
        try {
          const payroll = new PayrollPeriod({
            employeeId: employee.id,
            periodStart,
            periodEnd,
            grossSalary: employee.contract.salary,
            baseSalary: employee.contract.salary,
            weekNumber: PayrollController.getWeekNumber(new Date(periodStart)),
            year: new Date(periodStart).getFullYear()
          });

          payroll.calculateDeductions();
          await payroll.save();

          results.processed++;
          results.payrolls.push({
            employeeId: employee.id,
            employeeName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            payrollId: payroll.id,
            netSalary: payroll.netSalary
          });
        } catch (error) {
          results.errors.push({
            employeeId: employee.id,
            employeeName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        data: results,
        message: `Procesados ${results.processed} empleados de ${targetEmployees.length}`
      });
    } catch (error) {
      console.error('Error bulk processing payroll:', error);
      res.status(500).json({
        success: false,
        error: 'Error al procesar nómina masiva',
        details: error.message
      });
    }
  }

  /**
   * Utilidad para obtener número de semana
   */
  static getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
}

module.exports = PayrollController;
