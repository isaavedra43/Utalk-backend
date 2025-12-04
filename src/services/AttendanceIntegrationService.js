const Employee = require('../models/Employee');
const logger = require('../utils/logger');

/**
 * Servicio de Integración de Asistencia
 * Maneja la comunicación e integración con otros módulos del sistema
 */
class AttendanceIntegrationService {

  /**
   * Obtener empleados activos con información de horarios
   */
  static async getActiveEmployeesWithSchedule() {
    try {
      // Esta función se conectaría con el módulo de empleados
      // Por ahora, simulamos datos básicos
      const employees = await Employee.findActive();

      return employees.map(emp => ({
        id: emp.id,
        employeeNumber: emp.employeeNumber,
        name: `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`,
        department: emp.position?.department || 'Sin departamento',
        position: emp.position?.title || 'Sin posición',
        schedule: {
          startTime: emp.contract?.customSchedule?.enabled ?
            emp.contract.customSchedule.days[this.getDayName()].startTime || '09:00' : '09:00',
          endTime: emp.contract?.customSchedule?.enabled ?
            emp.contract.customSchedule.days[this.getDayName()].endTime || '18:00' : '18:00',
          breakDuration: 60, // minutos
          workingDays: emp.contract?.workingDays ?
            this.parseWorkingDays(emp.contract.workingDays) : [1,2,3,4,5] // lunes a viernes
        },
        isActive: emp.status === 'active'
      }));
    } catch (error) {
      logger.error('Error obteniendo empleados activos:', error);
      throw error;
    }
  }

  /**
   * Verificar estado de vacaciones de empleado para una fecha específica
   */
  static async checkEmployeeVacationStatus(employeeId, date) {
    try {
      // Esta función se conectaría con el módulo de vacaciones cuando esté disponible
      // Por ahora, simulamos una respuesta basada en probabilidad

      // Simulación: 10% de probabilidad de estar en vacaciones
      if (Math.random() < 0.1) {
        return {
          status: 'vacation',
          type: 'annual',
          reason: 'Vacaciones anuales aprobadas',
          startDate: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date(Date.now() + Math.random() * 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          approved: true,
          approvedBy: 'hr_manager',
          approvedAt: new Date().toISOString()
        };
      }

      // Verificar si es fin de semana
      const dayOfWeek = new Date(date).getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return {
          status: 'weekend',
          reason: 'Día no laborable (fin de semana)',
          approved: true
        };
      }

      return {
        status: 'working',
        reason: 'Día laborable normal',
        approved: true
      };
    } catch (error) {
      logger.error('Error verificando estado de vacaciones:', error);
      return {
        status: 'working',
        reason: 'No se pudo verificar estado de vacaciones',
        approved: true
      };
    }
  }

  /**
   * Obtener movimientos de extras para un empleado en una fecha específica
   */
  static async getEmployeeExtras(employeeId, date) {
    try {
      // Esta función se conectaría con el módulo de extras cuando esté disponible
      // Por ahora, simulamos algunos datos

      return {
        overtimeHours: Math.random() * 3, // 0-3 horas extra
        hasLoans: Math.random() < 0.2, // 20% de probabilidad de tener préstamos
        hasAbsences: Math.random() < 0.05, // 5% de probabilidad de ausencias
        hasBonuses: Math.random() < 0.15, // 15% de probabilidad de bonos
        movements: [
          // Ejemplo de movimientos que se obtendrían del módulo de extras
        ]
      };
    } catch (error) {
      logger.error('Error obteniendo extras del empleado:', error);
      return {
        overtimeHours: 0,
        hasLoans: false,
        hasAbsences: false,
        hasBonuses: false,
        movements: []
      };
    }
  }

  /**
   * Obtener información de empleado específica
   */
  static async getEmployeeInfo(employeeId) {
    try {
      const employee = await Employee.findById(employeeId);

      if (!employee) {
        throw new Error('Empleado no encontrado');
      }

      return {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
        email: employee.personalInfo.email,
        phone: employee.personalInfo.phone,
        department: employee.position?.department || 'Sin departamento',
        position: employee.position?.title || 'Sin posición',
        level: employee.position?.level || 'Sin nivel',
        hireDate: employee.position?.startDate,
        salary: employee.salary?.baseSalary || 0,
        schedule: employee.contract?.customSchedule?.enabled ? employee.contract.customSchedule : null,
        workingDays: employee.contract?.workingDays || 'Lunes a Viernes',
        workingHours: employee.contract?.workingHoursRange || '09:00-18:00',
        isActive: employee.status === 'active',
        manager: employee.position?.reportsTo || null
      };
    } catch (error) {
      logger.error('Error obteniendo información de empleado:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de departamento
   */
  static async getDepartmentStats(departmentId, dateFrom, dateTo) {
    try {
      // Esta función se conectaría con el módulo de empleados para obtener empleados por departamento
      // Por ahora, simulamos datos

      return {
        departmentId,
        departmentName: 'Departamento de Ejemplo',
        totalEmployees: 25,
        activeEmployees: 23,
        attendanceRate: 92.5,
        averageHoursPerDay: 8.2,
        overtimeHours: 45,
        absentDays: 12,
        vacationDays: 8
      };
    } catch (error) {
      logger.error('Error obteniendo estadísticas de departamento:', error);
      throw error;
    }
  }

  /**
   * Sincronizar datos de asistencia con nómina
   */
  static async syncWithPayroll(reportId, attendanceData) {
    try {
      // Esta función se conectaría con el módulo de nómina cuando esté disponible
      logger.info('Sincronizando datos de asistencia con nómina', {
        reportId,
        employeesCount: attendanceData.length
      });

      // Por ahora, solo logueamos la acción
      // Cuando se implemente nómina, aquí se haría la integración real

      return {
        success: true,
        syncedEmployees: attendanceData.length,
        payrollImpact: {
          totalHours: attendanceData.reduce((sum, emp) => sum + (emp.totalHours || 0), 0),
          overtimeHours: attendanceData.reduce((sum, emp) => sum + (emp.overtimeHours || 0), 0),
          regularHours: attendanceData.reduce((sum, emp) => sum + ((emp.totalHours || 0) - (emp.overtimeHours || 0)), 0)
        }
      };
    } catch (error) {
      logger.error('Error sincronizando con nómina:', error);
      throw error;
    }
  }

  /**
   * Notificar cambios de asistencia
   */
  static async notifyAttendanceChanges(reportId, changes) {
    try {
      // Esta función se conectaría con el sistema de notificaciones
      logger.info('Notificando cambios de asistencia', {
        reportId,
        changes
      });

      // Por ahora, solo logueamos la acción
      // Cuando se implemente notificaciones, aquí se enviarían emails/push notifications

      return {
        success: true,
        notificationsSent: 0,
        notificationTypes: ['email', 'push']
      };
    } catch (error) {
      logger.error('Error notificando cambios de asistencia:', error);
      throw error;
    }
  }

  /**
   * Obtener configuración de empresa para asistencia
   */
  static async getCompanyAttendanceConfig() {
    try {
      // Esta función se conectaría con el módulo de configuración de empresa
      // Por ahora, retornamos configuración por defecto

      return {
        workingDays: [1, 2, 3, 4, 5], // lunes a viernes
        standardHours: 8,
        breakDuration: 60, // minutos
        overtimeRate: 1.5,
        maxOvertimeHours: 60, // por mes
        gracePeriod: 15, // minutos de tolerancia para llegada tarde
        maxLateArrivals: 3, // por mes antes de sanción
        holidays: [], // días festivos
        workFromHomeAllowed: true,
        clockInRequired: true,
        clockOutRequired: true,
        breakTracking: false,
        overtimeApprovalRequired: true,
        absenceNotificationThreshold: 2, // días consecutivos
        notifications: {
          dailyReport: true,
          overtimeAlerts: true,
          absenceAlerts: true,
          approvalRequired: true
        }
      };
    } catch (error) {
      logger.error('Error obteniendo configuración de asistencia:', error);
      throw error;
    }
  }

  /**
   * Validar reglas de negocio de asistencia
   */
  static async validateAttendanceRules(employeeId, attendanceData) {
    try {
      const config = await this.getCompanyAttendanceConfig();

      const violations = [];

      // Verificar llegada tarde
      if (attendanceData.clockIn && attendanceData.status === 'late') {
        const clockInTime = new Date(`1970-01-01T${attendanceData.clockIn}:00`);
        const standardStartTime = new Date(`1970-01-01T${config.standardStartTime || '09:00'}:00`);
        const diffMinutes = (clockInTime - standardStartTime) / (1000 * 60);

        if (diffMinutes > config.gracePeriod) {
          violations.push({
            type: 'late_arrival',
            severity: diffMinutes > 60 ? 'high' : 'medium',
            message: `Llegada ${diffMinutes} minutos tarde`,
            minutesLate: diffMinutes
          });
        }
      }

      // Verificar horas extra excesivas
      if (attendanceData.overtimeHours > config.maxOvertimeHours) {
        violations.push({
          type: 'excessive_overtime',
          severity: 'high',
          message: `Horas extra (${attendanceData.overtimeHours}) exceden el máximo mensual (${config.maxOvertimeHours})`,
          overtimeHours: attendanceData.overtimeHours
        });
      }

      return {
        isValid: violations.filter(v => v.severity === 'high').length === 0,
        violations,
        warnings: violations.filter(v => v.severity !== 'high'),
        errors: violations.filter(v => v.severity === 'high')
      };
    } catch (error) {
      logger.error('Error validando reglas de asistencia:', error);
      return {
        isValid: true,
        violations: [],
        warnings: [],
        errors: []
      };
    }
  }

  /**
   * Obtener historial de asistencia de empleado
   */
  static async getEmployeeAttendanceHistory(employeeId, filters = {}) {
    try {
      const AttendanceRecord = require('../models/AttendanceRecord');
      const records = await AttendanceRecord.findByEmployee(employeeId, filters);

      // Obtener información adicional del empleado
      const employee = await this.getEmployeeInfo(employeeId);

      // Calcular estadísticas del período
      const stats = this.calculateAttendanceStats(records);

      return {
        employee,
        records,
        summary: stats,
        period: {
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo
        }
      };
    } catch (error) {
      logger.error('Error obteniendo historial de asistencia:', error);
      throw error;
    }
  }

  /**
   * Calcular estadísticas de asistencia
   */
  static calculateAttendanceStats(records) {
    const stats = {
      totalDays: records.length,
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
      vacationDays: 0,
      sickLeaveDays: 0,
      personalLeaveDays: 0,
      totalHours: 0,
      overtimeHours: 0,
      averageHoursPerDay: 0,
      attendanceRate: 0
    };

    records.forEach(record => {
      switch (record.status) {
        case 'present':
          stats.presentDays++;
          stats.totalHours += record.totalHours || 0;
          stats.overtimeHours += record.overtimeHours || 0;
          break;
        case 'absent':
          stats.absentDays++;
          break;
        case 'late':
          stats.lateDays++;
          stats.totalHours += record.totalHours || 0;
          stats.overtimeHours += record.overtimeHours || 0;
          break;
        case 'vacation':
          stats.vacationDays++;
          break;
        case 'sick_leave':
          stats.sickLeaveDays++;
          break;
        case 'personal_leave':
          stats.personalLeaveDays++;
          break;
      }
    });

    // Calcular métricas
    const workingDays = stats.presentDays + stats.lateDays;
    if (stats.totalDays > 0) {
      stats.attendanceRate = (workingDays / stats.totalDays) * 100;
    }

    if (workingDays > 0) {
      stats.averageHoursPerDay = stats.totalHours / workingDays;
    }

    return stats;
  }

  /**
   * Obtener métricas de asistencia por departamento
   */
  static async getDepartmentAttendanceMetrics(departmentId, dateFrom, dateTo) {
    try {
      // Esta función se conectaría con el módulo de empleados para obtener empleados por departamento
      // Por ahora, simulamos datos

      const employees = await this.getActiveEmployeesWithSchedule();
      const departmentEmployees = employees.filter(emp => emp.department === departmentId);

      const metrics = {
        departmentId,
        departmentName: 'Departamento de Ejemplo',
        totalEmployees: departmentEmployees.length,
        attendanceRate: 94.2,
        averageHoursPerDay: 8.1,
        overtimeHours: 32,
        absentDays: 8,
        topPerformers: [],
        needsAttention: []
      };

      return metrics;
    } catch (error) {
      logger.error('Error obteniendo métricas de departamento:', error);
      throw error;
    }
  }

  /**
   * Obtener nombre del día de la semana
   */
  static getDayName(date = new Date()) {
    const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    return days[date.getDay()];
  }

  /**
   * Parsear días laborables de string a array
   */
  static parseWorkingDays(workingDaysString) {
    // Esta función convertiría "Lunes a Viernes" a [1,2,3,4,5]
    // Por ahora, retornamos días estándar
    return [1, 2, 3, 4, 5]; // lunes a viernes
  }

  /**
   * Obtener feriados y días especiales
   */
  static async getSpecialDays(year) {
    try {
      // Esta función se conectaría con un calendario de feriados
      // Por ahora, retornamos algunos feriados comunes

      return [
        { date: `${year}-01-01`, name: 'Año Nuevo', type: 'holiday' },
        { date: `${year}-05-01`, name: 'Día del Trabajo', type: 'holiday' },
        { date: `${year}-09-16`, name: 'Día de la Independencia', type: 'holiday' },
        { date: `${year}-11-02`, name: 'Día de los Muertos', type: 'holiday' },
        { date: `${year}-12-25`, name: 'Navidad', type: 'holiday' }
      ];
    } catch (error) {
      logger.error('Error obteniendo días especiales:', error);
      return [];
    }
  }

  /**
   * Validar si una fecha es día laborable
   */
  static async isWorkingDay(date) {
    try {
      const dayOfWeek = new Date(date).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (isWeekend) {
        return false;
      }

      // Verificar si es feriado
      const year = new Date(date).getFullYear();
      const specialDays = await this.getSpecialDays(year);
      const isHoliday = specialDays.some(day => day.date === date);

      return !isHoliday;
    } catch (error) {
      logger.error('Error verificando día laborable:', error);
      return true; // Por defecto, asumir que es día laborable
    }
  }

  /**
   * Obtener plantilla de reporte basada en tipo
   */
  static getReportTemplate(template) {
    const templates = {
      normal: {
        name: 'Día Normal',
        description: 'Plantilla estándar para días laborables normales',
        defaultStatus: 'present',
        includeOvertime: true,
        includeBreaks: true
      },
      weekend: {
        name: 'Fin de Semana',
        description: 'Plantilla para sábados y domingos',
        defaultStatus: 'absent',
        includeOvertime: false,
        includeBreaks: false
      },
      holiday: {
        name: 'Día Festivo',
        description: 'Plantilla para días festivos',
        defaultStatus: 'vacation',
        includeOvertime: false,
        includeBreaks: false
      }
    };

    return templates[template] || templates.normal;
  }
}

module.exports = AttendanceIntegrationService;
