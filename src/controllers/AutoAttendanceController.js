const AutoAttendanceService = require('../services/AutoAttendanceService');
const Employee = require('../models/Employee');

/**
 * Controlador para gestión de asistencia automática
 */
class AutoAttendanceController {
  
  /**
   * Procesa asistencia automática para el día actual
   * POST /api/auto-attendance/process-today
   */
  static async processToday(req, res) {
    try {
      const result = await AutoAttendanceService.processDailyAttendance();
      
      res.json({
        success: true,
        message: 'Asistencia automática procesada exitosamente',
        data: result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error procesando asistencia de hoy:', error);
      res.status(500).json({
        success: false,
        error: 'Error procesando asistencia automática',
        details: error.message
      });
    }
  }
  
  /**
   * Procesa asistencia automática para una fecha específica
   * POST /api/auto-attendance/process-date
   */
  static async processDate(req, res) {
    try {
      const { date } = req.body;
      
      if (!date) {
        return res.status(400).json({
          success: false,
          error: 'Fecha es requerida'
        });
      }
      
      const result = await AutoAttendanceService.processDailyAttendance(date);
      
      res.json({
        success: true,
        message: `Asistencia automática procesada para ${date}`,
        data: result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error procesando asistencia para fecha:', error);
      res.status(500).json({
        success: false,
        error: 'Error procesando asistencia automática',
        details: error.message
      });
    }
  }
  
  /**
   * Procesa asistencia automática para un rango de fechas
   * POST /api/auto-attendance/process-range
   */
  static async processDateRange(req, res) {
    try {
      const { startDate, endDate } = req.body;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Fecha de inicio y fecha de fin son requeridas'
        });
      }
      
      const result = await AutoAttendanceService.processDateRange(startDate, endDate);
      
      res.json({
        success: true,
        message: `Asistencia automática procesada del ${startDate} al ${endDate}`,
        data: result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error procesando rango de fechas:', error);
      res.status(500).json({
        success: false,
        error: 'Error procesando asistencia automática',
        details: error.message
      });
    }
  }
  
  /**
   * Procesa asistencia automática para un empleado específico
   * POST /api/auto-attendance/process-employee/:id
   */
  static async processEmployee(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { date } = req.body;
      
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      // Verificar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }
      
      const result = await AutoAttendanceService.processEmployeeAttendance(employee, targetDate);
      
      res.json({
        success: true,
        message: `Asistencia procesada para ${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
        data: {
          employee: {
            id: employee.id,
            name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            employeeNumber: employee.employeeNumber
          },
          date: targetDate,
          result
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error procesando empleado:', error);
      res.status(500).json({
        success: false,
        error: 'Error procesando asistencia del empleado',
        details: error.message
      });
    }
  }
  
  /**
   * Obtiene estadísticas de asistencia automática
   * GET /api/auto-attendance/stats
   */
  static async getStats(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      // Usar últimos 30 días por defecto si no se especifican fechas
      const end = endDate || new Date().toISOString().split('T')[0];
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const stats = await AutoAttendanceService.getAutoAttendanceStats(start, end);
      
      res.json({
        success: true,
        data: {
          period: { startDate: start, endDate: end },
          stats
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        error: 'Error obteniendo estadísticas de asistencia automática',
        details: error.message
      });
    }
  }
  
  /**
   * Obtiene empleados activos con su configuración de horario
   * GET /api/auto-attendance/employees-config
   */
  static async getEmployeesConfig(req, res) {
    try {
      const employees = await Employee.findActive();
      
      const employeesConfig = employees.map(employee => ({
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
        department: employee.position?.department,
        status: employee.status,
        contract: {
          type: employee.contract?.type,
          salary: employee.contract?.salary,
          workingDays: employee.contract?.workingDays,
          workingHoursRange: employee.contract?.workingHoursRange,
          customSchedule: employee.contract?.customSchedule
        },
        location: {
          office: employee.location?.office,
          isRemote: employee.location?.isRemote
        }
      }));
      
      res.json({
        success: true,
        data: {
          totalEmployees: employeesConfig.length,
          employees: employeesConfig
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error obteniendo configuración de empleados:', error);
      res.status(500).json({
        success: false,
        error: 'Error obteniendo configuración de empleados',
        details: error.message
      });
    }
  }
  
  /**
   * Simula el procesamiento de asistencia (para testing)
   * POST /api/auto-attendance/simulate
   */
  static async simulate(req, res) {
    try {
      const { date, employeeId } = req.body;
      
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      if (employeeId) {
        // Simular para un empleado específico
        const employee = await Employee.findById(employeeId);
        if (!employee) {
          return res.status(404).json({
            success: false,
            error: 'Empleado no encontrado'
          });
        }
        
        const result = await AutoAttendanceService.processEmployeeAttendance(employee, targetDate);
        
        res.json({
          success: true,
          message: 'Simulación completada',
          data: {
            employee: {
              id: employee.id,
              name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`
            },
            date: targetDate,
            result
          }
        });
      } else {
        // Simular para todos los empleados
        const result = await AutoAttendanceService.processDailyAttendance(targetDate);
        
        res.json({
          success: true,
          message: 'Simulación completada para todos los empleados',
          data: result
        });
      }
      
    } catch (error) {
      console.error('Error en simulación:', error);
      res.status(500).json({
        success: false,
        error: 'Error en simulación de asistencia automática',
        details: error.message
      });
    }
  }
}

module.exports = AutoAttendanceController;
