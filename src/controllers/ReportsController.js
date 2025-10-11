const ExtrasService = require('../services/ExtrasService');
const PayrollMovement = require('../models/PayrollMovement');
const Employee = require('../models/Employee');
const AttendanceRecord = require('../models/AttendanceRecord');
const ExcelJS = require('exceljs');

/**
 * Controlador de Reportes de Extras y Asistencia
 * Genera reportes, métricas y exportaciones
 */
class ReportsController {

  /**
   * Genera reporte completo de extras por empleado
   * GET /api/reports/employee/:id/extras
   */
  static async generateEmployeeExtrasReport(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { startDate, endDate, format = 'json' } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Fechas de inicio y fin son requeridas'
        });
      }

      // Obtener empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Obtener movimientos del período
      const movements = await PayrollMovement.findByEmployee(employeeId, {
        startDate,
        endDate
      });

      // Calcular métricas
      const metrics = await ExtrasService.calculateAttendanceMetrics(employeeId, 30);
      
      // Obtener resumen de movimientos
      const summary = await ExtrasService.getMovementsSummary(employeeId, startDate, endDate);

      const report = {
        employee: {
          id: employee.id,
          name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
          position: employee.position.title,
          department: employee.position.department,
          baseSalary: employee.contract?.salary || employee.salary?.baseSalary || 0
        },
        period: { startDate, endDate },
        summary,
        metrics,
        movements: movements.map(movement => ({
          id: movement.id,
          type: movement.type,
          date: movement.date,
          description: movement.description,
          amount: movement.calculatedAmount || movement.amount,
          status: movement.status,
          impactType: movement.impactType
        })),
        generatedAt: new Date().toISOString()
      };

      if (format === 'excel') {
        return await ReportsController.exportEmployeeExtrasToExcel(report, res);
      }

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      console.error('Error generating employee extras report:', error);
      res.status(500).json({
        success: false,
        error: 'Error al generar reporte de extras'
      });
    }
  }

  /**
   * Genera reporte de asistencia por empleado
   * GET /api/reports/employee/:id/attendance
   */
  static async generateEmployeeAttendanceReport(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { startDate, endDate, format = 'json' } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Fechas de inicio y fin son requeridas'
        });
      }

      // Obtener empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Obtener registros de asistencia
      const attendanceRecords = await AttendanceRecord.findByEmployeeAndDateRange(
        employeeId,
        startDate,
        endDate
      );

      // Obtener datos para gráficas
      const chartData = await ExtrasService.generateChartData(employeeId, 30);

      // Calcular estadísticas
      const stats = {
        totalDays: attendanceRecords.length,
        presentDays: attendanceRecords.filter(r => r.status === 'present').length,
        lateDays: attendanceRecords.filter(r => r.status === 'late').length,
        absentDays: attendanceRecords.filter(r => r.status === 'absent').length,
        totalHours: attendanceRecords.reduce((sum, r) => sum + r.totalHours, 0),
        overtimeHours: attendanceRecords.reduce((sum, r) => sum + r.overtimeHours, 0),
        averageHours: 0,
        attendanceScore: 0,
        punctualityScore: 0
      };

      if (stats.totalDays > 0) {
        stats.averageHours = Math.round((stats.totalHours / stats.totalDays) * 100) / 100;
        stats.attendanceScore = Math.round((stats.presentDays / stats.totalDays) * 100);
        stats.punctualityScore = Math.round(((stats.totalDays - stats.lateDays) / stats.totalDays) * 100);
      }

      const report = {
        employee: {
          id: employee.id,
          name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
          position: employee.position.title,
          department: employee.position.department
        },
        period: { startDate, endDate },
        statistics: stats,
        attendanceRecords: attendanceRecords.map(record => ({
          id: record.id,
          date: record.date,
          clockIn: record.clockIn,
          clockOut: record.clockOut,
          totalHours: record.totalHours,
          overtimeHours: record.overtimeHours,
          status: record.status,
          location: record.location,
          notes: record.notes
        })),
        chartData,
        generatedAt: new Date().toISOString()
      };

      if (format === 'excel') {
        return await ReportsController.exportAttendanceToExcel(report, res);
      }

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      console.error('Error generating attendance report:', error);
      res.status(500).json({
        success: false,
        error: 'Error al generar reporte de asistencia'
      });
    }
  }

  /**
   * Genera reporte consolidado de nómina con extras
   * GET /api/reports/payroll-consolidated
   */
  static async generatePayrollConsolidatedReport(req, res) {
    try {
      const { startDate, endDate, department, format = 'json' } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Fechas de inicio y fin son requeridas'
        });
      }

      // Obtener empleados (filtrar por departamento si se especifica)
      let employees = [];
      if (department) {
        employees = await Employee.findByDepartment(department);
      } else {
        // En una implementación real, se obtendría una lista de todos los empleados
        // Por ahora devolvemos un mensaje
        return res.status(400).json({
          success: false,
          error: 'Debe especificar un departamento para reporte consolidado'
        });
      }

      const consolidatedData = [];

      for (const employee of employees) {
        try {
          // Calcular impacto de extras para cada empleado
          const extrasImpact = await ExtrasService.calculatePayrollImpact(
            employee.id,
            startDate,
            endDate
          );

          // Calcular métricas de asistencia
          const metrics = await ExtrasService.calculateAttendanceMetrics(employee.id, 30);

          const employeeData = {
            employee: {
              id: employee.id,
              name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
              position: employee.position.title,
              department: employee.position.department,
              baseSalary: employee.contract?.salary || employee.salary?.baseSalary || 0
            },
            payrollImpact: extrasImpact,
            attendanceMetrics: metrics,
            netSalaryWithExtras: (employee.contract?.salary || employee.salary?.baseSalary || 0) + extrasImpact.netImpact
          };

          consolidatedData.push(employeeData);
        } catch (employeeError) {
          console.warn(`Error processing employee ${employee.id}:`, employeeError);
          // Continuar con el siguiente empleado
        }
      }

      // Calcular totales
      const totals = {
        totalEmployees: consolidatedData.length,
        totalBaseSalary: consolidatedData.reduce((sum, emp) => sum + emp.employee.baseSalary, 0),
        totalExtrasImpact: consolidatedData.reduce((sum, emp) => sum + emp.payrollImpact.netImpact, 0),
        totalNetSalary: consolidatedData.reduce((sum, emp) => sum + emp.netSalaryWithExtras, 0),
        totalOvertime: consolidatedData.reduce((sum, emp) => sum + (emp.payrollImpact.breakdown.overtime || 0), 0),
        totalBonuses: consolidatedData.reduce((sum, emp) => sum + (emp.payrollImpact.breakdown.bonuses || 0), 0),
        totalDeductions: consolidatedData.reduce((sum, emp) => sum + 
          (emp.payrollImpact.breakdown.absences || 0) +
          (emp.payrollImpact.breakdown.deductions || 0) +
          (emp.payrollImpact.breakdown.loanPayments || 0) +
          (emp.payrollImpact.breakdown.damages || 0), 0)
      };

      const report = {
        period: { startDate, endDate },
        department,
        totals,
        employees: consolidatedData,
        generatedAt: new Date().toISOString()
      };

      if (format === 'excel') {
        return await ReportsController.exportConsolidatedToExcel(report, res);
      }

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      console.error('Error generating consolidated payroll report:', error);
      res.status(500).json({
        success: false,
        error: 'Error al generar reporte consolidado'
      });
    }
  }

  /**
   * Exporta reporte de extras de empleado a Excel
   */
  static async exportEmployeeExtrasToExcel(reportData, res) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Reporte de Extras');

      // Configurar columnas
      worksheet.columns = [
        { header: 'Fecha', key: 'date', width: 12 },
        { header: 'Tipo', key: 'type', width: 15 },
        { header: 'Descripción', key: 'description', width: 30 },
        { header: 'Monto', key: 'amount', width: 12 },
        { header: 'Estado', key: 'status', width: 12 },
        { header: 'Impacto', key: 'impactType', width: 12 }
      ];

      // Agregar información del empleado
      worksheet.addRow(['REPORTE DE EXTRAS Y MOVIMIENTOS']);
      worksheet.addRow([]);
      worksheet.addRow(['Empleado:', reportData.employee.name]);
      worksheet.addRow(['Posición:', reportData.employee.position]);
      worksheet.addRow(['Departamento:', reportData.employee.department]);
      worksheet.addRow(['Período:', `${reportData.period.startDate} - ${reportData.period.endDate}`]);
      worksheet.addRow([]);

      // Agregar resumen
      worksheet.addRow(['RESUMEN']);
      worksheet.addRow(['Total a Sumar:', reportData.summary.totalToAdd]);
      worksheet.addRow(['Total a Restar:', reportData.summary.totalToSubtract]);
      worksheet.addRow(['Impacto Neto:', reportData.summary.netImpact]);
      worksheet.addRow([]);

      // Agregar encabezados de movimientos
      worksheet.addRow(['MOVIMIENTOS DETALLADOS']);
      worksheet.addRow(['Fecha', 'Tipo', 'Descripción', 'Monto', 'Estado', 'Impacto']);

      // Agregar movimientos
      reportData.movements.forEach(movement => {
        worksheet.addRow([
          movement.date,
          movement.type,
          movement.description,
          movement.amount,
          movement.status,
          movement.impactType
        ]);
      });

      // Configurar respuesta
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="extras_${reportData.employee.name}_${reportData.period.startDate}.xlsx"`);

      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      console.error('Error exporting to Excel:', error);
      res.status(500).json({
        success: false,
        error: 'Error al exportar a Excel'
      });
    }
  }

  /**
   * Exporta reporte de asistencia a Excel
   */
  static async exportAttendanceToExcel(reportData, res) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Reporte de Asistencia');

      // Información del empleado
      worksheet.addRow(['REPORTE DE ASISTENCIA']);
      worksheet.addRow([]);
      worksheet.addRow(['Empleado:', reportData.employee.name]);
      worksheet.addRow(['Posición:', reportData.employee.position]);
      worksheet.addRow(['Departamento:', reportData.employee.department]);
      worksheet.addRow(['Período:', `${reportData.period.startDate} - ${reportData.period.endDate}`]);
      worksheet.addRow([]);

      // Estadísticas
      worksheet.addRow(['ESTADÍSTICAS']);
      worksheet.addRow(['Días Totales:', reportData.statistics.totalDays]);
      worksheet.addRow(['Días Presentes:', reportData.statistics.presentDays]);
      worksheet.addRow(['Días Tarde:', reportData.statistics.lateDays]);
      worksheet.addRow(['Días Ausentes:', reportData.statistics.absentDays]);
      worksheet.addRow(['Horas Totales:', reportData.statistics.totalHours]);
      worksheet.addRow(['Horas Extra:', reportData.statistics.overtimeHours]);
      worksheet.addRow(['Score Asistencia:', `${reportData.statistics.attendanceScore}%`]);
      worksheet.addRow(['Score Puntualidad:', `${reportData.statistics.punctualityScore}%`]);
      worksheet.addRow([]);

      // Registros detallados
      worksheet.addRow(['REGISTROS DETALLADOS']);
      worksheet.addRow(['Fecha', 'Entrada', 'Salida', 'Horas Totales', 'Horas Extra', 'Estado', 'Ubicación', 'Notas']);

      reportData.attendanceRecords.forEach(record => {
        worksheet.addRow([
          record.date,
          record.clockIn || '-',
          record.clockOut || '-',
          record.totalHours,
          record.overtimeHours,
          record.status,
          record.location || '-',
          record.notes || '-'
        ]);
      });

      // Configurar respuesta
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="asistencia_${reportData.employee.name}_${reportData.period.startDate}.xlsx"`);

      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      console.error('Error exporting attendance to Excel:', error);
      res.status(500).json({
        success: false,
        error: 'Error al exportar asistencia a Excel'
      });
    }
  }

  /**
   * Exporta reporte consolidado a Excel
   */
  static async exportConsolidatedToExcel(reportData, res) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Reporte Consolidado');

      // Información general
      worksheet.addRow(['REPORTE CONSOLIDADO DE NÓMINA']);
      worksheet.addRow([]);
      worksheet.addRow(['Departamento:', reportData.department]);
      worksheet.addRow(['Período:', `${reportData.period.startDate} - ${reportData.period.endDate}`]);
      worksheet.addRow(['Total Empleados:', reportData.totals.totalEmployees]);
      worksheet.addRow([]);

      // Totales
      worksheet.addRow(['TOTALES GENERALES']);
      worksheet.addRow(['Total Salario Base:', reportData.totals.totalBaseSalary]);
      worksheet.addRow(['Total Impacto Extras:', reportData.totals.totalExtrasImpact]);
      worksheet.addRow(['Total Salario Neto:', reportData.totals.totalNetSalary]);
      worksheet.addRow(['Total Horas Extra:', reportData.totals.totalOvertime]);
      worksheet.addRow(['Total Bonos:', reportData.totals.totalBonuses]);
      worksheet.addRow(['Total Deducciones:', reportData.totals.totalDeductions]);
      worksheet.addRow([]);

      // Detalle por empleado
      worksheet.addRow(['DETALLE POR EMPLEADO']);
      worksheet.addRow([
        'Nombre', 'Posición', 'Salario Base', 'Horas Extra', 'Bonos', 
        'Deducciones', 'Impacto Neto', 'Salario Final', 'Score Asistencia'
      ]);

      reportData.employees.forEach(emp => {
        worksheet.addRow([
          emp.employee.name,
          emp.employee.position,
          emp.employee.baseSalary,
          emp.payrollImpact.breakdown.overtime || 0,
          emp.payrollImpact.breakdown.bonuses || 0,
          (emp.payrollImpact.breakdown.absences || 0) +
          (emp.payrollImpact.breakdown.deductions || 0) +
          (emp.payrollImpact.breakdown.loanPayments || 0) +
          (emp.payrollImpact.breakdown.damages || 0),
          emp.payrollImpact.netImpact,
          emp.netSalaryWithExtras,
          `${emp.attendanceMetrics.attendanceScore}%`
        ]);
      });

      // Configurar respuesta
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="consolidado_${reportData.department}_${reportData.period.startDate}.xlsx"`);

      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      console.error('Error exporting consolidated to Excel:', error);
      res.status(500).json({
        success: false,
        error: 'Error al exportar reporte consolidado a Excel'
      });
    }
  }
}

module.exports = ReportsController;
