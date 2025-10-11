const AttendanceRecord = require('../models/AttendanceRecord');
const Employee = require('../models/Employee');
const EmployeeHistory = require('../models/EmployeeHistory');

/**
 * Controlador de Asistencia
 * Gestiona registros de entrada/salida y reportes de asistencia
 */
class AttendanceController {
  /**
   * Obtiene registros de asistencia de un empleado
   * GET /api/employees/:id/attendance
   */
  static async getByEmployee(req, res) {
    try {
      const { id: employeeId } = req.params;
      const {
        startDate,
        endDate,
        includeWeekends = false,
        includeHolidays = false,
        status = null
      } = req.query;

      // Verificar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Fechas por defecto (último mes)
      const defaultEndDate = new Date().toISOString().split('T')[0];
      const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const options = {
        includeWeekends: includeWeekends === 'true',
        includeHolidays: includeHolidays === 'true',
        status
      };

      const records = await AttendanceRecord.listByDateRange(
        employeeId,
        startDate || defaultStartDate,
        endDate || defaultEndDate,
        options
      );

      const summary = await AttendanceRecord.getSummary(
        employeeId,
        startDate || defaultStartDate,
        endDate || defaultEndDate
      );

      // Generar tendencias por día
      const trends = records.map(record => ({
        date: record.date,
        hours: record.totalHours,
        status: record.status,
        punctual: record.status === 'present'
      }));

      res.json({
        success: true,
        data: {
          records,
          summary,
          trends
        }
      });
    } catch (error) {
      console.error('Error getting attendance by employee:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener asistencia del empleado',
        details: error.message
      });
    }
  }

  /**
   * Crea un registro de asistencia
   * POST /api/employees/:id/attendance
   */
  static async create(req, res) {
    try {
      const { id: employeeId } = req.params;
      const attendanceData = req.body;
      const createdBy = req.user?.id || null;

      // Verificar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Verificar si ya existe un registro para esta fecha
      const existingRecord = await AttendanceRecord.findByDate(employeeId, attendanceData.date);
      if (existingRecord) {
        return res.status(400).json({
          success: false,
          error: 'Ya existe un registro de asistencia para esta fecha'
        });
      }

      const record = new AttendanceRecord({
        ...attendanceData,
        employeeId,
        createdBy
      });

      await record.save();

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'attendance_adjustment',
        `Registro de asistencia creado para ${record.date}`,
        {
          recordId: record.id,
          date: record.date,
          clockIn: record.clockIn,
          clockOut: record.clockOut,
          totalHours: record.totalHours,
          status: record.status
        },
        createdBy,
        req
      );

      res.status(201).json({
        success: true,
        data: { record },
        message: 'Registro de asistencia creado exitosamente'
      });
    } catch (error) {
      console.error('Error creating attendance record:', error);
      res.status(500).json({
        success: false,
        error: 'Error al crear registro de asistencia',
        details: error.message
      });
    }
  }

  /**
   * Actualiza un registro de asistencia
   * PUT /api/employees/:id/attendance/:recordId
   */
  static async update(req, res) {
    try {
      const { id: employeeId, recordId } = req.params;
      const updateData = req.body;
      const updatedBy = req.user?.id || null;

      const record = await AttendanceRecord.findById(employeeId, recordId);
      if (!record) {
        return res.status(404).json({
          success: false,
          error: 'Registro de asistencia no encontrado'
        });
      }

      const oldValues = {
        clockIn: record.clockIn,
        clockOut: record.clockOut,
        totalHours: record.totalHours,
        status: record.status,
        dailySalary: record.dailySalary
      };

      // Si se actualiza el salario diario manualmente, marcar como no calculado automáticamente
      if (updateData.dailySalary !== undefined) {
        updateData.salaryCalculated = false;
        updateData.salaryCalculationDate = null;
      }

      await record.update({
        ...updateData,
        updatedBy
      });

      // Registrar cambios en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'attendance_adjustment',
        `Registro de asistencia actualizado para ${record.date}`,
        {
          recordId: record.id,
          date: record.date,
          changes: {
            oldValues,
            newValues: {
              clockIn: record.clockIn,
              clockOut: record.clockOut,
              totalHours: record.totalHours,
              status: record.status,
              dailySalary: record.dailySalary
            }
          }
        },
        updatedBy,
        req
      );

      res.json({
        success: true,
        data: { record },
        message: 'Registro de asistencia actualizado exitosamente'
      });
    } catch (error) {
      console.error('Error updating attendance record:', error);
      res.status(500).json({
        success: false,
        error: 'Error al actualizar registro de asistencia',
        details: error.message
      });
    }
  }

  /**
   * Registra entrada (clock in)
   * POST /api/employees/:id/attendance/clock-in
   */
  static async clockIn(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { time = null } = req.body;
      const createdBy = req.user?.id || null;

      // Verificar que el empleado exists
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      const record = await AttendanceRecord.clockIn(employeeId, time, createdBy);

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'attendance_adjustment',
        `Entrada registrada a las ${record.clockIn}`,
        {
          recordId: record.id,
          date: record.date,
          clockIn: record.clockIn,
          action: 'clock_in'
        },
        createdBy,
        req
      );

      res.json({
        success: true,
        data: { record },
        message: 'Entrada registrada exitosamente'
      });
    } catch (error) {
      console.error('Error clocking in:', error);
      res.status(500).json({
        success: false,
        error: 'Error al registrar entrada',
        details: error.message
      });
    }
  }

  /**
   * Registra salida (clock out)
   * POST /api/employees/:id/attendance/clock-out
   */
  static async clockOut(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { time = null } = req.body;
      const updatedBy = req.user?.id || null;

      // Verificar que el empleado exists
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      const record = await AttendanceRecord.clockOut(employeeId, time);

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'attendance_adjustment',
        `Salida registrada a las ${record.clockOut}`,
        {
          recordId: record.id,
          date: record.date,
          clockOut: record.clockOut,
          totalHours: record.totalHours,
          action: 'clock_out'
        },
        updatedBy,
        req
      );

      res.json({
        success: true,
        data: { record },
        message: 'Salida registrada exitosamente'
      });
    } catch (error) {
      console.error('Error clocking out:', error);
      res.status(500).json({
        success: false,
        error: 'Error al registrar salida',
        details: error.message
      });
    }
  }

  /**
   * Obtiene estado actual de asistencia de un empleado
   * GET /api/employees/:id/attendance/current
   */
  static async getCurrentStatus(req, res) {
    try {
      const { id: employeeId } = req.params;

      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      const today = new Date().toISOString().split('T')[0];
      const currentRecord = await AttendanceRecord.findByDate(employeeId, today);

      const status = {
        date: today,
        isPresent: !!currentRecord,
        clockedIn: currentRecord?.clockIn || null,
        clockedOut: currentRecord?.clockOut || null,
        totalHours: currentRecord?.totalHours || 0,
        status: currentRecord?.status || 'absent',
        canClockIn: !currentRecord?.clockIn,
        canClockOut: !!(currentRecord?.clockIn && !currentRecord?.clockOut)
      };

      res.json({
        success: true,
        data: { status }
      });
    } catch (error) {
      console.error('Error getting current attendance status:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener estado actual de asistencia',
        details: error.message
      });
    }
  }

  /**
   * Obtiene reporte de asistencia por departamento
   * GET /api/attendance/department/:department
   */
  static async getByDepartment(req, res) {
    try {
      const { department } = req.params;
      const {
        startDate,
        endDate
      } = req.query;

      // Fechas por defecto (último mes)
      const defaultEndDate = new Date().toISOString().split('T')[0];
      const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const employees = await Employee.getByDepartment(department);
      const departmentReport = [];

      for (const employee of employees) {
        const summary = await AttendanceRecord.getSummary(
          employee.id,
          startDate || defaultStartDate,
          endDate || defaultEndDate
        );

        departmentReport.push({
          employee: {
            id: employee.id,
            name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            employeeNumber: employee.employeeNumber,
            position: employee.position.title
          },
          summary
        });
      }

      // Calcular estadísticas del departamento
      const departmentStats = {
        totalEmployees: employees.length,
        averagePunctuality: 0,
        totalHours: 0,
        averageHours: 0
      };

      if (departmentReport.length > 0) {
        departmentStats.averagePunctuality = Math.round(
          departmentReport.reduce((sum, emp) => sum + emp.summary.punctualityScore, 0) / departmentReport.length
        );
        
        departmentStats.totalHours = departmentReport.reduce((sum, emp) => sum + emp.summary.totalHours, 0);
        departmentStats.averageHours = Math.round(departmentStats.totalHours / departmentReport.length * 10) / 10;
      }

      res.json({
        success: true,
        data: {
          department,
          period: {
            startDate: startDate || defaultStartDate,
            endDate: endDate || defaultEndDate
          },
          stats: departmentStats,
          employees: departmentReport
        }
      });
    } catch (error) {
      console.error('Error getting attendance by department:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener asistencia por departamento',
        details: error.message
      });
    }
  }

  /**
   * Obtiene reporte de asistencia diaria
   * GET /api/attendance/daily
   */
  static async getDailyReport(req, res) {
    try {
      const {
        date = new Date().toISOString().split('T')[0],
        department = null
      } = req.query;

      let employees = [];
      
      if (department) {
        employees = await Employee.getByDepartment(department);
      } else {
        const result = await Employee.list({ status: 'active', limit: 1000 });
        employees = result.employees;
      }

      const dailyReport = {
        date,
        department,
        summary: {
          totalEmployees: employees.length,
          present: 0,
          absent: 0,
          late: 0,
          earlyLeave: 0
        },
        employees: []
      };

      for (const employee of employees) {
        const record = await AttendanceRecord.findByDate(employee.id, date);
        
        const employeeData = {
          id: employee.id,
          name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
          employeeNumber: employee.employeeNumber,
          position: employee.position.title,
          department: employee.position.department,
          status: record?.status || 'absent',
          clockIn: record?.clockIn || null,
          clockOut: record?.clockOut || null,
          totalHours: record?.totalHours || 0
        };

        dailyReport.employees.push(employeeData);

        // Actualizar resumen
        switch (employeeData.status) {
          case 'present':
            dailyReport.summary.present++;
            break;
          case 'late':
            dailyReport.summary.late++;
            dailyReport.summary.present++; // También cuenta como presente
            break;
          case 'early_leave':
            dailyReport.summary.earlyLeave++;
            dailyReport.summary.present++; // También cuenta como presente
            break;
          default:
            dailyReport.summary.absent++;
        }
      }

      res.json({
        success: true,
        data: dailyReport
      });
    } catch (error) {
      console.error('Error getting daily attendance report:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener reporte diario de asistencia',
        details: error.message
      });
    }
  }

  /**
   * Obtiene estadísticas de asistencia
   * GET /api/attendance/stats
   */
  static async getStats(req, res) {
    try {
      const {
        startDate,
        endDate,
        department = null
      } = req.query;

      // Fechas por defecto (último mes)
      const defaultEndDate = new Date().toISOString().split('T')[0];
      const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      let employees = [];
      
      if (department) {
        employees = await Employee.getByDepartment(department);
      } else {
        const result = await Employee.list({ status: 'active', limit: 1000 });
        employees = result.employees;
      }

      const stats = {
        period: {
          startDate: startDate || defaultStartDate,
          endDate: endDate || defaultEndDate
        },
        overall: {
          totalEmployees: employees.length,
          averagePunctuality: 0,
          totalHours: 0,
          averageHoursPerEmployee: 0,
          overtimeHours: 0
        },
        byStatus: {
          present: 0,
          absent: 0,
          late: 0,
          earlyLeave: 0
        },
        trends: {
          byDay: {},
          punctualityTrend: []
        }
      };

      let totalPunctuality = 0;
      let totalHours = 0;
      let totalOvertime = 0;

      for (const employee of employees) {
        const summary = await AttendanceRecord.getSummary(
          employee.id,
          startDate || defaultStartDate,
          endDate || defaultEndDate
        );

        totalPunctuality += summary.punctualityScore;
        totalHours += summary.totalHours;
        totalOvertime += summary.overtimeHours;

        // Contar por estado (basado en el último registro)
        // TODO: Mejorar esta lógica para contar estados por período
      }

      if (employees.length > 0) {
        stats.overall.averagePunctuality = Math.round(totalPunctuality / employees.length);
        stats.overall.totalHours = Math.round(totalHours * 10) / 10;
        stats.overall.averageHoursPerEmployee = Math.round((totalHours / employees.length) * 10) / 10;
        stats.overall.overtimeHours = Math.round(totalOvertime * 10) / 10;
      }

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting attendance stats:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener estadísticas de asistencia',
        details: error.message
      });
    }
  }

  /**
   * Exporta reporte de asistencia
   * GET /api/attendance/export
   */
  static async exportReport(req, res) {
    try {
      const {
        format = 'excel',
        startDate,
        endDate,
        department = null,
        employeeIds = null
      } = req.query;

      // TODO: Implementar lógica de exportación
      
      res.json({
        success: true,
        message: 'Funcionalidad de exportación en desarrollo',
        parameters: {
          format,
          startDate,
          endDate,
          department,
          employeeIds
        }
      });
    } catch (error) {
      console.error('Error exporting attendance report:', error);
      res.status(500).json({
        success: false,
        error: 'Error al exportar reporte de asistencia',
        details: error.message
      });
    }
  }

  /**
   * Recalcula el salario diario para todos los registros de un empleado
   * PUT /api/employees/:id/attendance/recalculate-salaries
   */
  static async recalculateSalaries(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { startDate, endDate } = req.body;
      const updatedBy = req.user?.id || null;

      // Verificar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Recalcular salarios
      const results = await AttendanceRecord.recalculateDailySalaries(
        employeeId, 
        startDate, 
        endDate
      );

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'salary_recalculation',
        `Salarios diarios recalculados para ${results.processed} registros`,
        {
          results,
          period: { startDate, endDate }
        },
        updatedBy,
        req
      );

      res.json({
        success: true,
        data: results,
        message: `Salarios recalculados exitosamente. ${results.updated} registros actualizados.`
      });
    } catch (error) {
      console.error('Error recalculating salaries:', error);
      res.status(500).json({
        success: false,
        error: 'Error al recalcular salarios diarios',
        details: error.message
      });
    }
  }

  /**
   * Obtiene el resumen de salarios de un empleado
   * GET /api/employees/:id/attendance/salary-summary
   */
  static async getSalarySummary(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Las fechas de inicio y fin son requeridas'
        });
      }

      // Verificar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      const summary = await AttendanceRecord.getSalarySummary(
        employeeId, 
        startDate, 
        endDate
      );

      res.json({
        success: true,
        data: {
          summary,
          employee: {
            id: employee.id,
            name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            baseSalary: employee.salary?.baseSalary || employee.contract?.salary || 0,
            currency: employee.salary?.currency || 'MXN'
          }
        }
      });
    } catch (error) {
      console.error('Error getting salary summary:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener resumen de salarios',
        details: error.message
      });
    }
  }
}

module.exports = AttendanceController;
