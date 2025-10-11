const PayrollMovement = require('../models/PayrollMovement');
const Employee = require('../models/Employee');
const AttendanceRecord = require('../models/AttendanceRecord');
const VacationBalance = require('../models/VacationBalance');

/**
 * Servicio de Extras y Movimientos de Nómina
 * Contiene toda la lógica de negocio para gestión de movimientos
 */
class ExtrasService {
  /**
   * Registra un movimiento de nómina
   */
  static async registerMovement(employeeId, movementData, registeredBy) {
    try {
      // Obtener información del empleado
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Empleado no encontrado');
      }

      // Crear el movimiento
      const movement = new PayrollMovement({
        ...movementData,
        employeeId,
        registeredBy
      });

      // Calcular monto automáticamente
      await movement.calculateAmount(employee);

      // Validaciones específicas por tipo
      await this.validateMovement(movement, employee);

      // Guardar el movimiento
      await movement.save();

      return movement;
    } catch (error) {
      console.error('Error registering movement:', error);
      throw error;
    }
  }

  /**
   * Validaciones específicas por tipo de movimiento
   */
  static async validateMovement(movement, employee) {
    switch (movement.type) {
      case 'overtime':
        await this.validateOvertimeMovement(movement, employee);
        break;
      case 'absence':
        await this.validateAbsenceMovement(movement, employee);
        break;
      case 'loan':
        await this.validateLoanMovement(movement, employee);
        break;
      case 'damage':
        await this.validateDamageMovement(movement, employee);
        break;
      case 'bonus':
      case 'deduction':
        await this.validateBasicMovement(movement, employee);
        break;
    }
  }

  /**
   * Valida movimiento de horas extra
   */
  static async validateOvertimeMovement(movement, employee) {
    // Validar máximo de horas extra por día
    if (movement.hours > 3) {
      throw new Error('Máximo 3 horas extra permitidas por día');
    }

    // Validar que no sea día festivo sin autorización especial
    const movementDate = new Date(movement.date);
    const dayOfWeek = movementDate.getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Domingo o Sábado
      movement.overtimeType = 'weekend';
    }

    // Verificar si ya existe asistencia para ese día
    const existingAttendance = await AttendanceRecord.findByEmployeeAndDate(
      employee.id, 
      movement.date
    );

    if (existingAttendance && existingAttendance.totalHours < 8) {
      throw new Error('No se pueden registrar horas extra sin completar jornada regular');
    }

    return true;
  }

  /**
   * Valida movimiento de ausencia
   */
  static async validateAbsenceMovement(movement, employee) {
    // Validar días de vacaciones disponibles
    if (movement.absenceType === 'vacation') {
      const currentYear = new Date().getFullYear();
      const vacationBalance = await VacationBalance.getOrCreateCurrent(
        employee.id, 
        employee.position?.startDate
      );

      if (vacationBalance.availableDays < movement.duration) {
        throw new Error(`Días de vacaciones insuficientes. Disponibles: ${vacationBalance.availableDays}`);
      }
    }

    // Validar ausencias de más de 3 días
    if (movement.duration > 3 && movement.status === 'pending') {
      throw new Error('Ausencias de más de 3 días requieren autorización previa');
    }

    return true;
  }

  /**
   * Valida movimiento de préstamo
   */
  static async validateLoanMovement(movement, employee) {
    // Verificar préstamos activos
    const activeLoans = await PayrollMovement.findByEmployee(employee.id, {
      type: 'loan',
      status: 'active'
    });

    if (activeLoans.length >= 3) {
      throw new Error('Máximo 3 préstamos activos permitidos por empleado');
    }

    // Validar que el pago mensual no exceda 30% del salario
    const baseSalary = employee.contract?.salary || employee.salary?.baseSalary || 0;
    const maxMonthlyPayment = baseSalary * 0.3;

    if (movement.monthlyPayment > maxMonthlyPayment) {
      throw new Error(`Pago mensual no puede exceder 30% del salario (${maxMonthlyPayment.toFixed(2)})`);
    }

    // Calcular total de pagos mensuales activos
    const totalMonthlyPayments = activeLoans.reduce((sum, loan) => sum + loan.monthlyPayment, 0);
    
    if (totalMonthlyPayments + movement.monthlyPayment > maxMonthlyPayment) {
      throw new Error('Total de pagos mensuales excede 30% del salario');
    }

    return true;
  }

  /**
   * Valida movimiento de daño
   */
  static async validateDamageMovement(movement, employee) {
    // Validar que tenga evidencia
    if (!movement.attachments || movement.attachments.length === 0) {
      throw new Error('Evidencia fotográfica requerida para daños');
    }

    // Validar justificación detallada
    if (!movement.justification || movement.justification.length < 20) {
      throw new Error('Justificación detallada requerida (mínimo 20 caracteres)');
    }

    return true;
  }

  /**
   * Valida movimientos básicos (bonos, deducciones)
   */
  static async validateBasicMovement(movement, employee) {
    // Validar montos razonables
    const baseSalary = employee.contract?.salary || employee.salary?.baseSalary || 0;
    
    if (movement.amount > baseSalary) {
      throw new Error('El monto no puede exceder el salario base del empleado');
    }

    return true;
  }

  /**
   * Obtiene resumen de movimientos por empleado
   */
  static async getMovementsSummary(employeeId, startDate, endDate) {
    try {
      let movements = [];
      try {
        movements = await PayrollMovement.findByEmployee(employeeId, {
          startDate,
          endDate,
          status: 'approved'
        });
      } catch (dbError) {
        console.error('Error fetching movements from database:', dbError);
        // Si hay error en la base de datos, retornar array vacío
        movements = [];
      }

      const summary = {
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
        movements: movements
      };

      movements.forEach(movement => {
        const amount = movement.calculatedAmount || movement.amount;
        
        if (movement.impactType === 'add') {
          summary.totalToAdd += amount;
        } else {
          summary.totalToSubtract += amount;
        }

        // Estadísticas por tipo
        if (summary.byType[movement.type]) {
          summary.byType[movement.type].count++;
          summary.byType[movement.type].total += amount;
          
          if (movement.type === 'overtime') {
            summary.byType[movement.type].hours += movement.hours;
          } else if (movement.type === 'absence') {
            summary.byType[movement.type].days += movement.duration;
          }
        }
      });

      summary.netImpact = summary.totalToAdd - summary.totalToSubtract;

      return summary;
    } catch (error) {
      console.error('Error getting movements summary:', error);
      throw error;
    }
  }

  /**
   * Calcula métricas de asistencia y extras
   */
  static async calculateAttendanceMetrics(employeeId, days = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Obtener registros de asistencia
      const attendanceRecords = await AttendanceRecord.findByEmployeeAndDateRange(
        employeeId,
        startDateStr,
        endDateStr
      );

      // Obtener movimientos de extras
      const movements = await PayrollMovement.findByEmployee(employeeId, {
        startDate: startDateStr,
        endDate: endDateStr
      });

      // Calcular métricas
      const metrics = {
        // Asistencia
        totalDays: days,
        presentDays: attendanceRecords.filter(r => r.status === 'present').length,
        absentDays: attendanceRecords.filter(r => r.status === 'absent').length,
        lateDays: attendanceRecords.filter(r => r.status === 'late').length,
        totalHours: attendanceRecords.reduce((sum, r) => sum + r.totalHours, 0),
        
        // Horas extra
        overtimeHours: attendanceRecords.reduce((sum, r) => sum + r.overtimeHours, 0),
        overtimeMovements: movements.filter(m => m.type === 'overtime' && m.status === 'approved').length,
        
        // Ausencias
        absenceMovements: movements.filter(m => m.type === 'absence').length,
        sickDays: movements.filter(m => m.type === 'absence' && m.absenceType === 'sick_leave').length,
        vacationDays: movements.filter(m => m.type === 'absence' && m.absenceType === 'vacation').length,
        
        // Préstamos
        activeLoans: movements.filter(m => m.type === 'loan' && m.status === 'active').length,
        
        // Scores
        attendanceScore: 0,
        punctualityScore: 0
      };

      // Calcular scores
      if (metrics.totalDays > 0) {
        metrics.attendanceScore = Math.round((metrics.presentDays / metrics.totalDays) * 100);
        metrics.punctualityScore = Math.round(((metrics.totalDays - metrics.lateDays) / metrics.totalDays) * 100);
      }

      // Promedio de horas por día
      metrics.averageHoursPerDay = metrics.presentDays > 0 ? 
        Math.round((metrics.totalHours / metrics.presentDays) * 100) / 100 : 0;

      return metrics;
    } catch (error) {
      console.error('Error calculating attendance metrics:', error);
      throw error;
    }
  }

  /**
   * Genera datos para gráficas de tendencia
   */
  static async generateChartData(employeeId, days = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const chartData = [];
      
      for (let i = 0; i < days; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];

        // Obtener asistencia del día
        const attendance = await AttendanceRecord.findByEmployeeAndDate(employeeId, dateStr);
        
        // Obtener movimientos del día
        const movements = await PayrollMovement.findByEmployee(employeeId, {
          startDate: dateStr,
          endDate: dateStr
        });

        const dayData = {
          date: dateStr,
          // Asistencia
          present: attendance && attendance.status === 'present' ? 1 : 0,
          late: attendance && attendance.status === 'late' ? 1 : 0,
          absent: !attendance || attendance.status === 'absent' ? 1 : 0,
          hours: attendance ? attendance.totalHours : 0,
          // Horas extra
          regularHours: attendance ? Math.min(attendance.totalHours, 8) : 0,
          overtimeHours: attendance ? Math.max(0, attendance.totalHours - 8) : 0,
          // Movimientos
          movements: movements.length,
          overtimeMovements: movements.filter(m => m.type === 'overtime').length,
          absenceMovements: movements.filter(m => m.type === 'absence').length
        };

        chartData.push(dayData);
      }

      return chartData;
    } catch (error) {
      console.error('Error generating chart data:', error);
      throw error;
    }
  }

  /**
   * Aprueba un movimiento
   */
  static async approveMovement(movementId, employeeId, approvedBy, comments = '') {
    try {
      const movement = await PayrollMovement.findById(employeeId, movementId);
      if (!movement) {
        throw new Error('Movimiento no encontrado');
      }

      if (movement.status !== 'pending') {
        throw new Error('Solo se pueden aprobar movimientos pendientes');
      }

      await movement.approve(approvedBy, comments);

      // Si es un préstamo, cambiar estado a activo
      if (movement.type === 'loan') {
        movement.status = 'active';
        await movement.save();
      }

      return movement;
    } catch (error) {
      console.error('Error approving movement:', error);
      throw error;
    }
  }

  /**
   * Rechaza un movimiento
   */
  static async rejectMovement(movementId, employeeId, rejectedBy, reason) {
    try {
      const movement = await PayrollMovement.findById(employeeId, movementId);
      if (!movement) {
        throw new Error('Movimiento no encontrado');
      }

      if (movement.status !== 'pending') {
        throw new Error('Solo se pueden rechazar movimientos pendientes');
      }

      await movement.reject(rejectedBy, reason);

      return movement;
    } catch (error) {
      console.error('Error rejecting movement:', error);
      throw error;
    }
  }

  /**
   * Obtiene movimientos pendientes de aprobación
   */
  static async getPendingApprovals(approverId, department = null) {
    try {
      // Obtener empleados del departamento si se especifica
      let employeeIds = [];
      
      if (department) {
        const employees = await Employee.findByDepartment(department);
        employeeIds = employees.map(emp => emp.id);
      }

      const pendingMovements = [];

      // Si no hay departamento específico, buscar en todos los empleados
      if (employeeIds.length === 0) {
        // Esto sería más eficiente con una consulta global, pero Firebase no lo permite fácilmente
        // Por ahora, se debe implementar según la estructura de datos específica
        throw new Error('Debe especificar un departamento para obtener aprobaciones pendientes');
      }

      for (const employeeId of employeeIds) {
        const movements = await PayrollMovement.findByEmployee(employeeId, {
          status: 'pending'
        });
        pendingMovements.push(...movements);
      }

      // Ordenar por fecha de creación
      pendingMovements.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      return pendingMovements;
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      throw error;
    }
  }

  /**
   * Calcula impacto total en nómina para un período
   */
  static async calculatePayrollImpact(employeeId, periodStart, periodEnd) {
    try {
      const movements = await PayrollMovement.findByEmployee(employeeId, {
        startDate: periodStart,
        endDate: periodEnd,
        status: 'approved'
      });

      const impact = {
        totalToAdd: 0,
        totalToSubtract: 0,
        netImpact: 0,
        movements: movements,
        breakdown: {
          overtime: 0,
          bonuses: 0,
          absences: 0,
          deductions: 0,
          loanPayments: 0,
          damages: 0
        }
      };

      movements.forEach(movement => {
        const amount = movement.calculatedAmount || movement.amount;
        
        if (movement.impactType === 'add') {
          impact.totalToAdd += amount;
          if (movement.type === 'overtime') {
            impact.breakdown.overtime += amount;
          } else if (movement.type === 'bonus') {
            impact.breakdown.bonuses += amount;
          }
        } else {
          impact.totalToSubtract += amount;
          if (movement.type === 'absence') {
            impact.breakdown.absences += amount;
          } else if (movement.type === 'deduction') {
            impact.breakdown.deductions += amount;
          } else if (movement.type === 'loan') {
            impact.breakdown.loanPayments += amount;
          } else if (movement.type === 'damage') {
            impact.breakdown.damages += amount;
          }
        }
      });

      impact.netImpact = impact.totalToAdd - impact.totalToSubtract;

      return impact;
    } catch (error) {
      console.error('Error calculating payroll impact:', error);
      throw error;
    }
  }
}

module.exports = ExtrasService;
