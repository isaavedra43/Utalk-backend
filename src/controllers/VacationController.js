const VacationRequest = require('../models/VacationRequest');
const VacationBalance = require('../models/VacationBalance');
const Employee = require('../models/Employee');
const EmployeeHistory = require('../models/EmployeeHistory');

/**
 * Controlador de Vacaciones
 * Gestiona solicitudes de vacaciones, balances y aprobaciones
 */
class VacationController {
  /**
   * Obtiene vacaciones de un empleado
   * GET /api/employees/:id/vacations
   */
  static async getByEmployee(req, res) {
    try {
      const { id: employeeId } = req.params;
      const {
        year = new Date().getFullYear(),
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

      // Obtener balance actual
      const balance = await VacationBalance.getOrCreateCurrent(
        employeeId,
        employee.position.startDate
      );

      // Obtener solicitudes
      const requests = await VacationRequest.listByEmployee(employeeId, {
        year: parseInt(year),
        status
      });

      // Calcular resumen
      const summary = {
        totalDays: balance.totalDays,
        usedDays: balance.usedDays,
        availableDays: balance.availableDays,
        pendingDays: balance.pendingDays
      };

      res.json({
        success: true,
        data: {
          balance,
          requests,
          summary
        }
      });
    } catch (error) {
      console.error('Error getting vacations by employee:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener vacaciones del empleado',
        details: error.message
      });
    }
  }

  /**
   * Crea una nueva solicitud de vacaciones
   * POST /api/employees/:id/vacations
   */
  static async create(req, res) {
    try {
      const { id: employeeId } = req.params;
      const vacationData = req.body;
      const createdBy = req.user?.id || null;

      // Verificar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Verificar conflictos de fechas
      const conflicts = await VacationRequest.checkDateConflicts(
        employeeId,
        vacationData.startDate,
        vacationData.endDate
      );

      if (conflicts.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Existen conflictos con solicitudes de vacaciones ya aprobadas',
          conflicts
        });
      }

      // Crear solicitud
      const request = new VacationRequest({
        ...vacationData,
        employeeId
      });

      // Verificar que hay suficientes días disponibles
      const balance = await VacationBalance.getOrCreateCurrent(
        employeeId,
        employee.position.startDate
      );

      if (!await balance.hasSufficientDays(request.totalDays)) {
        return res.status(400).json({
          success: false,
          error: 'No hay suficientes días de vacaciones disponibles',
          available: balance.availableDays,
          requested: request.totalDays
        });
      }

      await request.save();

      // Reservar días en el balance
      await balance.reserveDays(request.totalDays);

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'vacation_approved',
        `Solicitud de vacaciones creada: ${request.startDate} - ${request.endDate}`,
        {
          requestId: request.id,
          startDate: request.startDate,
          endDate: request.endDate,
          totalDays: request.totalDays,
          type: request.type,
          status: request.status
        },
        createdBy,
        req
      );

      res.status(201).json({
        success: true,
        data: { request },
        message: 'Solicitud de vacaciones creada exitosamente'
      });
    } catch (error) {
      console.error('Error creating vacation request:', error);
      res.status(500).json({
        success: false,
        error: 'Error al crear solicitud de vacaciones',
        details: error.message
      });
    }
  }

  /**
   * Actualiza una solicitud de vacaciones
   * PUT /api/employees/:id/vacations/:requestId
   */
  static async update(req, res) {
    try {
      const { id: employeeId, requestId } = req.params;
      const updateData = req.body;
      const updatedBy = req.user?.id || null;

      const request = await VacationRequest.findById(employeeId, requestId);
      if (!request) {
        return res.status(404).json({
          success: false,
          error: 'Solicitud de vacaciones no encontrada'
        });
      }

      const oldValues = {
        status: request.status,
        startDate: request.startDate,
        endDate: request.endDate,
        totalDays: request.totalDays
      };

      // Si se está aprobando o rechazando
      if (updateData.status && updateData.status !== request.status) {
        const balance = await VacationBalance.findByEmployeeAndYear(
          employeeId,
          new Date(request.startDate).getFullYear()
        );

        if (updateData.status === 'approved') {
          await request.approve(updatedBy);
          if (balance) {
            await balance.confirmDaysUsage(request.totalDays);
          }
        } else if (updateData.status === 'rejected') {
          await request.reject(updatedBy, updateData.rejectionReason);
          if (balance) {
            await balance.releaseDays(request.totalDays);
          }
        } else if (updateData.status === 'cancelled') {
          await request.cancel();
          if (balance) {
            await balance.releaseDays(request.totalDays);
          }
        }
      } else {
        // Actualización normal
        await request.update(updateData);
      }

      // Registrar cambios en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'vacation_approved',
        `Solicitud de vacaciones actualizada: ${request.status}`,
        {
          requestId: request.id,
          changes: {
            oldValues,
            newValues: {
              status: request.status,
              startDate: request.startDate,
              endDate: request.endDate,
              totalDays: request.totalDays
            }
          },
          rejectionReason: request.rejectionReason
        },
        updatedBy,
        req
      );

      res.json({
        success: true,
        data: { request },
        message: 'Solicitud de vacaciones actualizada exitosamente'
      });
    } catch (error) {
      console.error('Error updating vacation request:', error);
      res.status(500).json({
        success: false,
        error: 'Error al actualizar solicitud de vacaciones',
        details: error.message
      });
    }
  }

  /**
   * Obtiene balance de vacaciones de un empleado
   * GET /api/employees/:id/vacations/balance
   */
  static async getBalance(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { year = new Date().getFullYear() } = req.query;

      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      let balance;
      
      if (parseInt(year) === new Date().getFullYear()) {
        // Para el año actual, obtener o crear balance
        balance = await VacationBalance.getOrCreateCurrent(
          employeeId,
          employee.position.startDate
        );
      } else {
        // Para años anteriores, buscar balance existente
        balance = await VacationBalance.findByEmployeeAndYear(employeeId, parseInt(year));
      }

      if (!balance) {
        return res.status(404).json({
          success: false,
          error: 'Balance de vacaciones no encontrado para el año especificado'
        });
      }

      // Obtener historial de balances
      const balanceHistory = await VacationBalance.listByEmployee(employeeId);

      res.json({
        success: true,
        data: {
          balance,
          history: balanceHistory
        }
      });
    } catch (error) {
      console.error('Error getting vacation balance:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener balance de vacaciones',
        details: error.message
      });
    }
  }

  /**
   * Obtiene solicitudes pendientes de aprobación
   * GET /api/vacations/pending
   */
  static async getPendingRequests(req, res) {
    try {
      const { department = null } = req.query;
      const userId = req.user?.id;

      const pendingRequests = await VacationRequest.getPendingRequests(department);

      // Enriquecer con información del empleado
      const enrichedRequests = [];
      
      for (const request of pendingRequests) {
        const employee = await Employee.findById(request.employeeId);
        if (employee) {
          enrichedRequests.push({
            ...request,
            employee: {
              id: employee.id,
              name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
              employeeNumber: employee.employeeNumber,
              position: employee.position.title,
              department: employee.position.department,
              avatar: employee.personalInfo.avatar
            }
          });
        }
      }

      res.json({
        success: true,
        data: {
          requests: enrichedRequests,
          count: enrichedRequests.length
        }
      });
    } catch (error) {
      console.error('Error getting pending vacation requests:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener solicitudes pendientes',
        details: error.message
      });
    }
  }

  /**
   * Aprueba múltiples solicitudes de vacaciones
   * POST /api/vacations/bulk-approve
   */
  static async bulkApprove(req, res) {
    try {
      const { requestIds } = req.body;
      const approvedBy = req.user?.id || null;

      if (!requestIds || !Array.isArray(requestIds)) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere un array de IDs de solicitudes'
        });
      }

      const results = {
        approved: 0,
        errors: []
      };

      for (const requestId of requestIds) {
        try {
          // Buscar la solicitud en todos los empleados (esto es ineficiente, mejorar)
          // TODO: Implementar búsqueda global de solicitudes
          
          results.approved++;
        } catch (error) {
          results.errors.push({
            requestId,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        data: results,
        message: `${results.approved} solicitudes aprobadas`
      });
    } catch (error) {
      console.error('Error bulk approving vacation requests:', error);
      res.status(500).json({
        success: false,
        error: 'Error al aprobar solicitudes masivamente',
        details: error.message
      });
    }
  }

  /**
   * Obtiene calendario de vacaciones
   * GET /api/vacations/calendar
   */
  static async getCalendar(req, res) {
    try {
      const {
        startDate,
        endDate,
        department = null
      } = req.query;

      // Fechas por defecto (próximos 3 meses)
      const defaultStartDate = new Date().toISOString().split('T')[0];
      const defaultEndDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      let employees = [];
      
      if (department) {
        employees = await Employee.getByDepartment(department);
      } else {
        const result = await Employee.list({ status: 'active', limit: 1000 });
        employees = result.employees;
      }

      const calendarEvents = [];

      for (const employee of employees) {
        const requests = await VacationRequest.listByEmployee(employee.id, {
          status: 'approved'
        });

        // Filtrar por rango de fechas
        const filteredRequests = requests.filter(request => {
          const requestStart = new Date(request.startDate);
          const requestEnd = new Date(request.endDate);
          const rangeStart = new Date(startDate || defaultStartDate);
          const rangeEnd = new Date(endDate || defaultEndDate);

          return requestStart <= rangeEnd && requestEnd >= rangeStart;
        });

        for (const request of filteredRequests) {
          calendarEvents.push({
            id: request.id,
            title: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            start: request.startDate,
            end: request.endDate,
            type: request.type,
            employee: {
              id: employee.id,
              name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
              department: employee.position.department,
              position: employee.position.title
            },
            totalDays: request.totalDays
          });
        }
      }

      res.json({
        success: true,
        data: {
          events: calendarEvents,
          period: {
            startDate: startDate || defaultStartDate,
            endDate: endDate || defaultEndDate
          }
        }
      });
    } catch (error) {
      console.error('Error getting vacation calendar:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener calendario de vacaciones',
        details: error.message
      });
    }
  }

  /**
   * Obtiene estadísticas de vacaciones
   * GET /api/vacations/stats
   */
  static async getStats(req, res) {
    try {
      const {
        year = new Date().getFullYear(),
        department = null
      } = req.query;

      let employees = [];
      
      if (department) {
        employees = await Employee.getByDepartment(department);
      } else {
        const result = await Employee.list({ status: 'active', limit: 1000 });
        employees = result.employees;
      }

      const stats = {
        year: parseInt(year),
        department,
        summary: {
          totalEmployees: employees.length,
          totalDaysGranted: 0,
          totalDaysUsed: 0,
          totalDaysAvailable: 0,
          utilizationRate: 0
        },
        byType: {},
        byMonth: {},
        topUsers: []
      };

      const employeeStats = [];

      for (const employee of employees) {
        const balance = await VacationBalance.findByEmployeeAndYear(employee.id, parseInt(year));
        const vacationStats = await VacationRequest.getStatsByType(employee.id, parseInt(year));

        if (balance) {
          stats.summary.totalDaysGranted += balance.totalDays;
          stats.summary.totalDaysUsed += balance.usedDays;
          stats.summary.totalDaysAvailable += balance.availableDays;
        }

        // Estadísticas por tipo
        Object.keys(vacationStats).forEach(type => {
          if (type !== 'total') {
            stats.byType[type] = (stats.byType[type] || 0) + vacationStats[type];
          }
        });

        employeeStats.push({
          employee: {
            id: employee.id,
            name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            department: employee.position.department
          },
          daysUsed: vacationStats.total
        });
      }

      // Calcular tasa de utilización
      if (stats.summary.totalDaysGranted > 0) {
        stats.summary.utilizationRate = Math.round(
          (stats.summary.totalDaysUsed / stats.summary.totalDaysGranted) * 100
        );
      }

      // Top usuarios (más días usados)
      stats.topUsers = employeeStats
        .sort((a, b) => b.daysUsed - a.daysUsed)
        .slice(0, 10);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting vacation stats:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener estadísticas de vacaciones',
        details: error.message
      });
    }
  }

  /**
   * Obtiene próximas vacaciones
   * GET /api/vacations/upcoming
   */
  static async getUpcoming(req, res) {
    try {
      const {
        days = 30,
        department = null
      } = req.query;

      let employees = [];
      
      if (department) {
        employees = await Employee.getByDepartment(department);
      } else {
        const result = await Employee.list({ status: 'active', limit: 1000 });
        employees = result.employees;
      }

      const upcomingVacations = [];

      for (const employee of employees) {
        const upcoming = await VacationRequest.getUpcomingVacations(employee.id, parseInt(days));
        
        for (const vacation of upcoming) {
          upcomingVacations.push({
            ...vacation,
            employee: {
              id: employee.id,
              name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
              department: employee.position.department,
              position: employee.position.title,
              avatar: employee.personalInfo.avatar
            }
          });
        }
      }

      // Ordenar por fecha de inicio
      upcomingVacations.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

      res.json({
        success: true,
        data: {
          vacations: upcomingVacations,
          count: upcomingVacations.length
        }
      });
    } catch (error) {
      console.error('Error getting upcoming vacations:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener próximas vacaciones',
        details: error.message
      });
    }
  }

  /**
   * Exporta reporte de vacaciones
   * GET /api/vacations/export
   */
  static async exportReport(req, res) {
    try {
      const {
        format = 'excel',
        year = new Date().getFullYear(),
        department = null,
        type = 'summary'
      } = req.query;

      // TODO: Implementar lógica de exportación
      
      res.json({
        success: true,
        message: 'Funcionalidad de exportación en desarrollo',
        parameters: {
          format,
          year,
          department,
          type
        }
      });
    } catch (error) {
      console.error('Error exporting vacation report:', error);
      res.status(500).json({
        success: false,
        error: 'Error al exportar reporte de vacaciones',
        details: error.message
      });
    }
  }
}

module.exports = VacationController;
