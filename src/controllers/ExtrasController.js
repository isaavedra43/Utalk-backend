const ExtrasService = require('../services/ExtrasService');
const ExtrasMovement = require('../models/ExtrasMovement');
const Employee = require('../models/Employee');
const EmployeeHistory = require('../models/EmployeeHistory');

/**
 * Controlador de Extras y Movimientos de Nómina
 * Maneja todos los endpoints relacionados con extras, asistencia y movimientos
 */
class ExtrasController {
  
  /**
   * Registra un nuevo movimiento de extras
   * POST /api/employees/:id/extras
   */
  static async registerExtra(req, res) {
    try {
      const { id: employeeId } = req.params;
      const movementData = req.body;
      const registeredBy = req.user?.id || null;

      // Validar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Registrar el movimiento
      const movement = await ExtrasService.registerMovement(
        employeeId, 
        movementData, 
        registeredBy
      );

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'extras_update',
        `Registro de ${movement.type}: ${movement.description}`,
        {
          movementId: movement.id,
          type: movement.type,
          amount: movement.calculatedAmount || movement.amount,
          status: movement.status
        },
        registeredBy
      );

      res.json({
        success: true,
        data: movement,
        message: `${movement.type} registrado exitosamente`
      });

    } catch (error) {
      console.error('Error registering extra:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Error al registrar movimiento'
      });
    }
  }

  /**
   * Obtiene movimientos de extras por empleado
   * GET /api/employees/:id/extras
   */
  static async getExtrasByEmployee(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { 
        type, 
        status, 
        startDate, 
        endDate, 
        limit = 50 
      } = req.query;

      // Validar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Obtener movimientos
      const movements = await ExtrasMovement.findByEmployee(employeeId, {
        type,
        status,
        startDate,
        endDate,
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: {
          movements,
          total: movements.length,
          employee: {
            id: employee.id,
            name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            position: employee.position.title,
            department: employee.position.department
          }
        }
      });

    } catch (error) {
      console.error('Error getting extras by employee:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener movimientos'
      });
    }
  }

  /**
   * Obtiene movimientos por tipo específico
   * GET /api/employees/:id/overtime
   * GET /api/employees/:id/absences
   * GET /api/employees/:id/loans
   */
  static async getMovementsByType(req, res) {
    try {
      const { id: employeeId } = req.params;
      const movementType = req.route.path.split('/').pop(); // overtime, absences, loans
      const { 
        status, 
        startDate, 
        endDate, 
        limit = 50 
      } = req.query;

      // Mapear tipos de URL a tipos de movimiento
      const typeMapping = {
        'overtime': 'overtime',
        'absences': 'absence',
        'loans': 'loan'
      };

      const type = typeMapping[movementType];
      if (!type) {
        return res.status(400).json({
          success: false,
          error: 'Tipo de movimiento no válido'
        });
      }

      // Validar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Obtener movimientos del tipo específico
      let movements = [];
      try {
        movements = await ExtrasMovement.findByEmployee(employeeId, {
          type,
          status,
          startDate,
          endDate,
          limit: parseInt(limit)
        });
      } catch (dbError) {
        console.error('Error fetching movements from database:', dbError);
        // Si hay error en la base de datos, retornar array vacío
        movements = [];
      }

      // Calcular estadísticas específicas del tipo
      let statistics = {};
      
      if (type === 'overtime') {
        statistics = {
          totalHours: movements.reduce((sum, m) => sum + (m.hours || 0), 0),
          totalAmount: movements.reduce((sum, m) => sum + (m.calculatedAmount || m.amount), 0),
          averageHours: movements.length > 0 ? 
            movements.reduce((sum, m) => sum + (m.hours || 0), 0) / movements.length : 0
        };
      } else if (type === 'absence') {
        statistics = {
          totalDays: movements.reduce((sum, m) => sum + (m.duration || 0), 0),
          totalDeduction: movements.reduce((sum, m) => sum + (m.calculatedAmount || m.amount), 0),
          byType: movements.reduce((acc, m) => {
            acc[m.absenceType] = (acc[m.absenceType] || 0) + 1;
            return acc;
          }, {})
        };
      } else if (type === 'loan') {
        statistics = {
          totalLoaned: movements.reduce((sum, m) => sum + (m.totalAmount || 0), 0),
          totalPending: movements.reduce((sum, m) => sum + (m.remainingAmount || 0), 0),
          activeLoans: movements.filter(m => m.status === 'active').length
        };
      }

      res.json({
        success: true,
        data: {
          movements,
          statistics,
          total: movements.length,
          type: movementType
        }
      });

    } catch (error) {
      console.error('Error getting movements by type:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener movimientos'
      });
    }
  }

  /**
   * Obtiene resumen de movimientos
   * GET /api/employees/:id/movements-summary
   */
  static async getMovementsSummary(req, res) {
    try {
      const { id: employeeId } = req.params;
      let { startDate, endDate } = req.query;

      // Si no se proporcionan fechas, usar los últimos 30 días por defecto
      if (!startDate || !endDate) {
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        startDate = startDate || thirtyDaysAgo.toISOString().split('T')[0];
        endDate = endDate || today.toISOString().split('T')[0];
      }

      // Validar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Obtener resumen
      let summary;
      try {
        summary = await ExtrasService.getMovementsSummary(
          employeeId, 
          startDate, 
          endDate
        );
      } catch (serviceError) {
        console.error('Error in ExtrasService.getMovementsSummary:', serviceError);
        // Retornar resumen vacío en caso de error
        summary = {
          totalToAdd: 0,
          totalToSubtract: 0,
          netImpact: 0,
          byType: {
            overtime: { count: 0, total: 0, hours: 0 },
            absence: { count: 0, total: 0, days: 0 },
            bonus: { count: 0, total: 0 },
            deduction: { count: 0, total: 0 },
            loan: { count: 0, total: 0 },
            damage: { count: 0, total: 0 }
          },
          movements: []
        };
      }

      res.json({
        success: true,
        data: {
          summary,
          period: { startDate, endDate },
          employee: {
            id: employee.id,
            name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            baseSalary: employee.contract?.salary || employee.salary?.baseSalary || 0
          }
        }
      });

    } catch (error) {
      console.error('Error getting movements summary:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener resumen de movimientos'
      });
    }
  }

  /**
   * Obtiene métricas de asistencia y extras
   * GET /api/employees/:id/attendance-metrics
   */
  static async getAttendanceMetrics(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { days = 30 } = req.query;

      // Validar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Calcular métricas
      const metrics = await ExtrasService.calculateAttendanceMetrics(
        employeeId, 
        parseInt(days)
      );

      res.json({
        success: true,
        data: {
          metrics,
          period: `Últimos ${days} días`,
          employee: {
            id: employee.id,
            name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`
          }
        }
      });

    } catch (error) {
      console.error('Error getting attendance metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener métricas de asistencia'
      });
    }
  }

  /**
   * Obtiene datos para gráficas
   * GET /api/employees/:id/chart-data
   */
  static async getChartData(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { days = 30 } = req.query;

      // Validar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Generar datos para gráficas
      const chartData = await ExtrasService.generateChartData(
        employeeId, 
        parseInt(days)
      );

      res.json({
        success: true,
        data: {
          chartData,
          period: `Últimos ${days} días`
        }
      });

    } catch (error) {
      console.error('Error getting chart data:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener datos de gráficas'
      });
    }
  }

  /**
   * Aprueba un movimiento
   * PUT /api/extras/:movementId/approve
   */
  static async approveMovement(req, res) {
    try {
      const { movementId } = req.params;
      const { employeeId, comments } = req.body;
      const approvedBy = req.user?.id || null;

      if (!employeeId) {
        return res.status(400).json({
          success: false,
          error: 'ID de empleado es requerido'
        });
      }

      // Aprobar el movimiento
      const movement = await ExtrasService.approveMovement(
        movementId, 
        employeeId, 
        approvedBy, 
        comments
      );

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'extras_approval',
        `Movimiento aprobado: ${movement.type} - ${movement.description}`,
        {
          movementId: movement.id,
          type: movement.type,
          amount: movement.calculatedAmount || movement.amount,
          approvedBy,
          comments
        },
        approvedBy
      );

      res.json({
        success: true,
        data: movement,
        message: 'Movimiento aprobado exitosamente'
      });

    } catch (error) {
      console.error('Error approving movement:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Error al aprobar movimiento'
      });
    }
  }

  /**
   * Rechaza un movimiento
   * PUT /api/extras/:movementId/reject
   */
  static async rejectMovement(req, res) {
    try {
      const { movementId } = req.params;
      const { employeeId, reason } = req.body;
      const rejectedBy = req.user?.id || null;

      if (!employeeId || !reason) {
        return res.status(400).json({
          success: false,
          error: 'ID de empleado y razón de rechazo son requeridos'
        });
      }

      // Rechazar el movimiento
      const movement = await ExtrasService.rejectMovement(
        movementId, 
        employeeId, 
        rejectedBy, 
        reason
      );

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'extras_rejection',
        `Movimiento rechazado: ${movement.type} - ${movement.description}`,
        {
          movementId: movement.id,
          type: movement.type,
          amount: movement.calculatedAmount || movement.amount,
          rejectedBy,
          reason
        },
        rejectedBy
      );

      res.json({
        success: true,
        data: movement,
        message: 'Movimiento rechazado'
      });

    } catch (error) {
      console.error('Error rejecting movement:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Error al rechazar movimiento'
      });
    }
  }

  /**
   * Actualiza un movimiento
   * PUT /api/employees/:id/extras/:movementId
   */
  static async updateMovement(req, res) {
    try {
      const { id: employeeId, movementId } = req.params;
      const updateData = req.body;
      const updatedBy = req.user?.id || null;

      // Obtener el movimiento
      const movement = await ExtrasMovement.findById(employeeId, movementId);
      if (!movement) {
        return res.status(404).json({
          success: false,
          error: 'Movimiento no encontrado'
        });
      }

      // Solo permitir actualizar movimientos pendientes
      if (movement.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: 'Solo se pueden editar movimientos pendientes'
        });
      }

      // Actualizar el movimiento
      const updatedMovement = await movement.update({
        ...updateData,
        updatedBy
      });

      // Si se cambió el monto, recalcular
      if (updateData.amount || updateData.hours || updateData.duration) {
        const employee = await Employee.findById(employeeId);
        await updatedMovement.calculateAmount(employee);
        await updatedMovement.save();
      }

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'extras_update',
        `Movimiento actualizado: ${movement.type} - ${movement.description}`,
        {
          movementId: movement.id,
          type: movement.type,
          changes: updateData
        },
        updatedBy
      );

      res.json({
        success: true,
        data: updatedMovement,
        message: 'Movimiento actualizado exitosamente'
      });

    } catch (error) {
      console.error('Error updating movement:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Error al actualizar movimiento'
      });
    }
  }

  /**
   * Elimina un movimiento
   * DELETE /api/employees/:id/extras/:movementId
   */
  static async deleteMovement(req, res) {
    try {
      const { id: employeeId, movementId } = req.params;
      const deletedBy = req.user?.id || null;

      // Obtener el movimiento
      const movement = await ExtrasMovement.findById(employeeId, movementId);
      if (!movement) {
        return res.status(404).json({
          success: false,
          error: 'Movimiento no encontrado'
        });
      }

      // Solo permitir eliminar movimientos pendientes o rechazados
      if (!['pending', 'rejected'].includes(movement.status)) {
        return res.status(400).json({
          success: false,
          error: 'Solo se pueden eliminar movimientos pendientes o rechazados'
        });
      }

      // Eliminar el movimiento
      await movement.delete();

      // Registrar en historial
      await EmployeeHistory.createHistoryRecord(
        employeeId,
        'extras_deletion',
        `Movimiento eliminado: ${movement.type} - ${movement.description}`,
        {
          movementId: movement.id,
          type: movement.type,
          amount: movement.calculatedAmount || movement.amount
        },
        deletedBy
      );

      res.json({
        success: true,
        message: 'Movimiento eliminado exitosamente'
      });

    } catch (error) {
      console.error('Error deleting movement:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Error al eliminar movimiento'
      });
    }
  }

  /**
   * Obtiene movimientos pendientes de aprobación
   * GET /api/extras/pending-approvals
   */
  static async getPendingApprovals(req, res) {
    try {
      const { department } = req.query;
      const approverId = req.user?.id || null;

      if (!department) {
        return res.status(400).json({
          success: false,
          error: 'Departamento es requerido para obtener aprobaciones pendientes'
        });
      }

      // Obtener movimientos pendientes
      const pendingMovements = await ExtrasService.getPendingApprovals(
        approverId, 
        department
      );

      res.json({
        success: true,
        data: {
          movements: pendingMovements,
          total: pendingMovements.length,
          department
        }
      });

    } catch (error) {
      console.error('Error getting pending approvals:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener aprobaciones pendientes'
      });
    }
  }

  /**
   * Calcula impacto en nómina
   * GET /api/employees/:id/payroll-impact
   */
  static async getPayrollImpact(req, res) {
    try {
      const { id: employeeId } = req.params;
      const { periodStart, periodEnd } = req.query;

      if (!periodStart || !periodEnd) {
        return res.status(400).json({
          success: false,
          error: 'Fechas de período son requeridas'
        });
      }

      // Validar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      // Calcular impacto
      const impact = await ExtrasService.calculatePayrollImpact(
        employeeId, 
        periodStart, 
        periodEnd
      );

      res.json({
        success: true,
        data: {
          impact,
          period: { periodStart, periodEnd },
          employee: {
            id: employee.id,
            name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            baseSalary: employee.contract?.salary || employee.salary?.baseSalary || 0
          }
        }
      });

    } catch (error) {
      console.error('Error getting payroll impact:', error);
      res.status(500).json({
        success: false,
        error: 'Error al calcular impacto en nómina'
      });
    }
  }

  /**
   * Obtiene estadísticas generales de extras
   * GET /api/extras/stats
   */
  static async getExtrasStats(req, res) {
    try {
      const { department, startDate, endDate } = req.query;

      // Esta funcionalidad requeriría una implementación más compleja
      // para obtener estadísticas globales de todos los empleados
      // Por ahora, devolvemos una respuesta básica
      
      res.json({
        success: true,
        data: {
          message: 'Estadísticas generales en desarrollo',
          filters: { department, startDate, endDate }
        }
      });

    } catch (error) {
      console.error('Error getting extras stats:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener estadísticas'
      });
    }
  }
}

module.exports = ExtrasController;
