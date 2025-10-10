const Employee = require('../models/Employee');
const VacationBalance = require('../models/VacationBalance');
// PayrollPeriod eliminado - solo funcionalidad individual
const EmployeeHistory = require('../models/EmployeeHistory');

/**
 * Servicio de Empleados
 * Contiene la lógica de negocio compleja para gestión de empleados
 */
class EmployeeService {
  /**
   * Crea un empleado completo con todas las inicializaciones necesarias
   */
  static async createCompleteEmployee(employeeData, createdBy = null) {
    try {
      // 1. Crear el empleado
      const employee = new Employee({
        ...employeeData,
        createdBy
      });
      
      await employee.save();

      // 2. Inicializar datos de vacaciones (nuevo sistema)
      if (employee.position?.startDate) {
        const VacationInitializationService = require('./VacationInitializationService');
        await VacationInitializationService.initializeForNewEmployee(employee.id, {
          personalInfo: employee.personalInfo,
          position: employee.position
        });
      }

      // 3. Inicializar datos de incidentes (nuevo sistema)
      const IncidentInitializationService = require('./IncidentInitializationService');
      await IncidentInitializationService.initializeForNewEmployee(employee.id, {
        personalInfo: employee.personalInfo,
        position: employee.position
      });

      // 4. Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employee.id,
        'personal_info_update',
        'Empleado creado en el sistema',
        {
          action: 'create',
          employeeNumber: employee.employeeNumber,
          department: employee.position.department,
          position: employee.position.title
        },
        createdBy
      );

      return employee;
    } catch (error) {
      console.error('Error creating complete employee:', error);
      throw error;
    }
  }

  /**
   * Obtiene el perfil completo de un empleado con todos los datos relacionados
   */
  static async getCompleteProfile(employeeId) {
    try {
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Empleado no encontrado');
      }

      // Obtener todos los datos relacionados en paralelo
      const [
        vacationSummary,
        payrollSummary,
        recentHistory,
        upcomingVacations
      ] = await Promise.all([
        VacationBalance.getSummary(employeeId).catch(() => null),
        Promise.resolve(null), // PayrollPeriod eliminado
        EmployeeHistory.listByEmployee(employeeId, { limit: 10 }).catch(() => []),
        this.getUpcomingEvents(employeeId).catch(() => [])
      ]);

      return {
        employee,
        summary: {
          vacation: vacationSummary,
          payroll: payrollSummary
        },
        recentActivity: recentHistory,
        upcomingEvents: upcomingVacations
      };
    } catch (error) {
      console.error('Error getting complete profile:', error);
      throw error;
    }
  }

  /**
   * Obtiene resumen de asistencia de un empleado
   * NOTA: Sistema de asistencia eliminado - retorna null
   */
  static async getAttendanceSummary(employeeId, days = 30) {
    return null;
  }

  /**
   * Obtiene próximos eventos de un empleado
   */
  static async getUpcomingEvents(employeeId, days = 30) {
    try {
      // TODO: Implementar lógica para obtener eventos próximos
      // (vacaciones, evaluaciones, vencimiento de documentos, etc.)
      
      return [];
    } catch (error) {
      console.error('Error getting upcoming events:', error);
      return [];
    }
  }

  /**
   * Valida que un empleado puede ser eliminado
   */
  static async validateDeletion(employeeId) {
    try {
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Empleado no encontrado');
      }

      const issues = [];

      // Verificar si tiene solicitudes de vacaciones pendientes
      // TODO: Implementar verificación de solicitudes pendientes

      // Verificar si tiene nóminas pendientes de pago
      // TODO: Implementar verificación de nóminas pendientes

      // Verificar si es supervisor de otros empleados
      const subordinates = await this.getSubordinates(employeeId);
      if (subordinates.length > 0) {
        issues.push({
          type: 'subordinates',
          message: `Tiene ${subordinates.length} empleados a su cargo`,
          count: subordinates.length
        });
      }

      return {
        canDelete: issues.length === 0,
        issues
      };
    } catch (error) {
      console.error('Error validating deletion:', error);
      throw error;
    }
  }

  /**
   * Obtiene empleados subordinados
   */
  static async getSubordinates(supervisorId) {
    try {
      const result = await Employee.list({
        limit: 1000,
        page: 1
      });

      return result.employees.filter(emp => emp.position.reportsTo === supervisorId);
    } catch (error) {
      console.error('Error getting subordinates:', error);
      return [];
    }
  }

  /**
   * Calcula métricas de desempeño de un empleado
   */
  static async calculatePerformanceMetrics(employeeId, period = '30d') {
    try {
      const metrics = {
        attendance: {
          score: 0,
          trend: 'stable'
        },
        productivity: {
          score: 0,
          trend: 'stable'
        },
        punctuality: {
          score: 0,
          trend: 'stable'
        },
        overall: {
          score: 0,
          grade: 'C'
        }
      };

      // Calcular métricas de asistencia
      const attendanceSummary = await this.getAttendanceSummary(employeeId, 30);
      if (attendanceSummary) {
        metrics.attendance.score = attendanceSummary.punctualityScore;
        metrics.punctuality.score = attendanceSummary.punctualityScore;
      }

      // TODO: Implementar cálculo de productividad
      // TODO: Implementar cálculo de tendencias
      
      // Calcular puntaje general
      const scores = [
        metrics.attendance.score,
        metrics.productivity.score,
        metrics.punctuality.score
      ].filter(score => score > 0);

      if (scores.length > 0) {
        metrics.overall.score = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
        
        // Asignar grado
        if (metrics.overall.score >= 90) metrics.overall.grade = 'A+';
        else if (metrics.overall.score >= 80) metrics.overall.grade = 'A';
        else if (metrics.overall.score >= 70) metrics.overall.grade = 'B';
        else if (metrics.overall.score >= 60) metrics.overall.grade = 'C';
        else metrics.overall.grade = 'D';
      }

      return metrics;
    } catch (error) {
      console.error('Error calculating performance metrics:', error);
      throw error;
    }
  }

  /**
   * Genera reporte de empleado
   */
  static async generateEmployeeReport(employeeId, type = 'complete') {
    try {
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Empleado no encontrado');
      }

      const report = {
        employee,
        generatedAt: new Date().toISOString(),
        type
      };

      switch (type) {
        case 'complete':
          report.data = await this.getCompleteProfile(employeeId);
          break;
          
        case 'performance':
          report.data = await this.calculatePerformanceMetrics(employeeId);
          break;
          
        case 'attendance':
          report.data = await this.getAttendanceSummary(employeeId, 90);
          break;
          
        default:
          throw new Error('Tipo de reporte no válido');
      }

      return report;
    } catch (error) {
      console.error('Error generating employee report:', error);
      throw error;
    }
  }

  /**
   * Busca empleados con filtros avanzados
   */
  static async advancedSearch(criteria) {
    try {
      const {
        query = '',
        departments = [],
        positions = [],
        statuses = [],
        dateRange = null,
        skills = [],
        performance = null,
        sortBy = 'name',
        sortOrder = 'asc',
        page = 1,
        limit = 20
      } = criteria;

      // Construir filtros base
      let filters = {};
      
      if (departments.length > 0) {
        filters.department = departments;
      }
      
      if (statuses.length > 0) {
        filters.status = statuses;
      }

      // Buscar empleados base
      const result = await Employee.list({
        search: query,
        department: departments[0], // Firebase no soporta 'in' queries fácilmente
        status: statuses[0],
        sortBy,
        sortOrder,
        page,
        limit
      });

      // TODO: Implementar filtros adicionales post-query
      // (skills, performance, etc.)

      return result;
    } catch (error) {
      console.error('Error in advanced search:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas departamentales
   */
  static async getDepartmentStats(department) {
    try {
      const employees = await Employee.getByDepartment(department);
      
      const stats = {
        department,
        totalEmployees: employees.length,
        byLevel: {},
        byStatus: {},
        averagePerformance: 0,
        totalPayroll: 0
      };

      for (const employee of employees) {
        // Contar por nivel
        const level = employee.position.level;
        stats.byLevel[level] = (stats.byLevel[level] || 0) + 1;
        
        // Contar por estado
        const status = employee.status;
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
        
        // Sumar nómina
        stats.totalPayroll += employee.contract.salary || 0;
      }

      // TODO: Calcular performance promedio
      
      return stats;
    } catch (error) {
      console.error('Error getting department stats:', error);
      throw error;
    }
  }

  /**
   * Procesa empleados en lote
   */
  static async bulkProcess(employeeIds, operation, data = {}, processedBy = null) {
    try {
      const results = {
        processed: 0,
        errors: [],
        details: []
      };

      for (const employeeId of employeeIds) {
        try {
          const employee = await Employee.findById(employeeId);
          if (!employee) {
            results.errors.push({
              employeeId,
              error: 'Empleado no encontrado'
            });
            continue;
          }

          let result = null;

          switch (operation) {
            case 'update_status':
              await employee.update({ status: data.status }, processedBy);
              result = { operation: 'status_updated', newStatus: data.status };
              break;
              
            case 'update_department':
              await employee.update({ 
                position: { ...employee.position, department: data.department } 
              }, processedBy);
              result = { operation: 'department_updated', newDepartment: data.department };
              break;
              
            case 'bulk_delete':
              await employee.delete(processedBy);
              result = { operation: 'deleted' };
              break;
              
            default:
              throw new Error('Operación no válida');
          }

          results.processed++;
          results.details.push({
            employeeId,
            employeeName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            result
          });

        } catch (error) {
          results.errors.push({
            employeeId,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error in bulk process:', error);
      throw error;
    }
  }

  /**
   * Valida datos de empleado
   */
  static validateEmployeeData(data, isUpdate = false) {
    const errors = [];

    // Validaciones básicas
    if (!isUpdate || data.personalInfo) {
      if (!data.personalInfo?.firstName) {
        errors.push('El nombre es requerido');
      }
      if (!data.personalInfo?.lastName) {
        errors.push('Los apellidos son requeridos');
      }
      if (!data.personalInfo?.phone) {
        errors.push('El teléfono es requerido');
      }
    }

    if (!isUpdate || data.position) {
      if (!data.position?.title) {
        errors.push('El puesto es requerido');
      }
      if (!data.position?.department) {
        errors.push('El departamento es requerido');
      }
    }

    if (!isUpdate || data.contract) {
      if (!data.contract?.salary || data.contract.salary < 0) {
        errors.push('El salario debe ser mayor a 0');
      }
    }

    // Validaciones de formato
    if (data.personalInfo?.email && !this.isValidEmail(data.personalInfo.email)) {
      errors.push('El formato del email no es válido');
    }

    if (data.personalInfo?.rfc && !this.isValidRFC(data.personalInfo.rfc)) {
      errors.push('El formato del RFC no es válido');
    }

    return errors;
  }

  /**
   * Valida formato de email
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Valida formato de RFC mexicano
   */
  static isValidRFC(rfc) {
    const rfcRegex = /^[A-Z&Ñ]{3,4}[0-9]{2}(0[1-9]|1[012])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{2}[0-9A]$/;
    return rfcRegex.test(rfc);
  }

  /**
   * Calcula antigüedad de un empleado
   */
  static calculateSeniority(startDate) {
    const start = new Date(startDate);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    const days = diffDays % 30;

    return {
      totalDays: diffDays,
      years,
      months,
      days,
      formatted: `${years} años, ${months} meses, ${days} días`
    };
  }

  /**
   * Obtiene empleados próximos a cumpleaños
   */
  static async getUpcomingBirthdays(days = 30) {
    try {
      // TODO: Implementar lógica para calcular cumpleaños próximos
      // Esto requiere una consulta más compleja en Firebase
      
      return [];
    } catch (error) {
      console.error('Error getting upcoming birthdays:', error);
      return [];
    }
  }

  /**
   * Obtiene empleados próximos a jubilarse
   */
  static async getUpcomingRetirements(years = 2) {
    try {
      // TODO: Implementar lógica para calcular jubilaciones próximas
      // Basado en edad o años de servicio
      
      return [];
    } catch (error) {
      console.error('Error getting upcoming retirements:', error);
      return [];
    }
  }

  /**
   * Sincroniza datos de empleado entre módulos
   */
  static async syncEmployeeData(employeeId) {
    try {
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Empleado no encontrado');
      }

      // Sincronizar balance de vacaciones
      await VacationBalance.getOrCreateCurrent(
        employeeId, 
        employee.position.startDate
      );

      // TODO: Sincronizar otros módulos si es necesario

      return { success: true, message: 'Datos sincronizados correctamente' };
    } catch (error) {
      console.error('Error syncing employee data:', error);
      throw error;
    }
  }
}

module.exports = EmployeeService;
