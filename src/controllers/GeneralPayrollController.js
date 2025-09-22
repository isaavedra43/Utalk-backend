const GeneralPayrollService = require('../services/GeneralPayrollService');
const GeneralPayroll = require('../models/GeneralPayroll');
const GeneralPayrollEmployee = require('../models/GeneralPayrollEmployee');
const GeneralPayrollAdjustment = require('../models/GeneralPayrollAdjustment');
const Employee = require('../models/Employee');
const logger = require('../utils/logger');

/**
 * Controlador de Nómina General - Endpoints para gestión masiva de nóminas
 * Maneja todas las operaciones de nómina general según el flujo del frontend
 */
class GeneralPayrollController {

  // ================================
  // GESTIÓN PRINCIPAL
  // ================================

  /**
   * Crear nueva nómina general
   * POST /api/payroll/general
   */
  static async createGeneralPayroll(req, res) {
    try {
      const { startDate, endDate, frequency, includeEmployees } = req.body;
      const userId = req.user?.id || 'system';

      logger.info('🏢 Solicitud de creación de nómina general', {
        startDate, endDate, frequency,
        employeesCount: includeEmployees?.length || 0,
        userId
      });

      // Validar datos requeridos
      if (!startDate || !endDate || !frequency) {
        return res.status(400).json({
          success: false,
          error: 'startDate, endDate y frequency son requeridos'
        });
      }

      if (!includeEmployees || includeEmployees.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Debe incluir al menos un empleado'
        });
      }

      const generalPayroll = await GeneralPayrollService.createGeneralPayroll({
        startDate, endDate, frequency, includeEmployees
      }, userId);

      res.status(201).json({
        success: true,
        message: 'Nómina general creada exitosamente',
        data: {
          id: generalPayroll.id,
          period: generalPayroll.period,
          status: generalPayroll.status,
          totals: generalPayroll.totals,
          employees: generalPayroll.employees.map(emp => ({
            id: emp.employeeId,
            employee: emp.employee,
            status: emp.status
          }))
        }
      });

    } catch (error) {
      logger.error('❌ Error creando nómina general', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor creando nómina general'
      });
    }
  }

  /**
   * Obtener lista de nóminas generales
   * GET /api/payroll/general
   */
  static async getGeneralPayrolls(req, res) {
    try {
      const {
        limit = 10,
        offset = 0,
        status = 'all',
        year = null,
        orderBy = 'createdAt',
        orderDirection = 'desc'
      } = req.query;

      logger.info('📋 Obteniendo lista de nóminas generales', {
        limit: parseInt(limit),
        offset: parseInt(offset),
        status, year
      });

      const result = await GeneralPayroll.list({
        limit: parseInt(limit),
        offset: parseInt(offset),
        status: status === 'all' ? null : status,
        year: year ? parseInt(year) : null,
        orderBy,
        orderDirection
      });

      // Formatear para el frontend
      const formattedPayrolls = result.payrolls.map(payroll => {
        const periodText = this.formatPeriodText(payroll.period);
        const typeText = this.getFrequencyText(payroll.period.frequency);
        const statusText = this.getStatusText(payroll.status);

        return {
          id: payroll.id,
          folio: payroll.folio || `DRAFT-${payroll.id.substring(0, 8)}`,
          period: periodText,
          type: typeText,
          status: statusText,
          employees: payroll.totals.totalEmployees,
          estimatedCost: payroll.totals.totalGrossSalary,
          realCost: payroll.totals.totalNetSalary,
          createdBy: {
            name: payroll.createdBy, // TODO: Obtener nombre real del usuario
            role: 'Coordinador de Nómina'
          },
          createdAt: payroll.createdAt,
          period_raw: payroll.period // Para operaciones internas
        };
      });

      res.json({
        success: true,
        data: {
          payrolls: formattedPayrolls,
          pagination: result.pagination
        }
      });

    } catch (error) {
      logger.error('❌ Error obteniendo nóminas generales', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo nóminas generales'
      });
    }
  }

  /**
   * Obtener nómina general específica
   * GET /api/payroll/general/:id
   */
  static async getGeneralPayrollById(req, res) {
    try {
      const { id } = req.params;

      logger.info('🔍 Obteniendo nómina general específica', { id });

      const generalPayroll = await GeneralPayroll.findById(id);
      if (!generalPayroll) {
        return res.status(404).json({
          success: false,
          error: 'Nómina general no encontrada'
        });
      }

      // Obtener empleados de la colección separada
      const employees = await GeneralPayrollEmployee.findByGeneralPayroll(id);
      
      // Obtener ajustes
      const adjustments = await GeneralPayrollAdjustment.findByGeneralPayroll(id);

      res.json({
        success: true,
        data: {
          ...generalPayroll.toFirestore(),
          employees: employees.map(emp => emp.getSummary()),
          adjustments: adjustments.map(adj => adj.getSummary()),
          period_formatted: this.formatPeriodText(generalPayroll.period),
          status_formatted: this.getStatusText(generalPayroll.status)
        }
      });

    } catch (error) {
      logger.error('❌ Error obteniendo nómina general', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo nómina general'
      });
    }
  }

  /**
   * Simular cálculos de nómina general
   * POST /api/payroll/general/:id/simulate
   */
  static async simulateGeneralPayroll(req, res) {
    try {
      const { id } = req.params;

      logger.info('🧮 Simulando cálculos de nómina general', { id });

      const generalPayroll = await GeneralPayrollService.simulateGeneralPayroll(id);

      // Formatear respuesta para el frontend
      const formattedResponse = {
        period: {
          startDate: generalPayroll.period.startDate,
          endDate: generalPayroll.period.endDate,
          frequency: generalPayroll.period.frequency
        },
        totals: {
          totalEmployees: generalPayroll.totals.totalEmployees,
          grossSalary: generalPayroll.totals.totalGrossSalary,
          netSalary: generalPayroll.totals.totalNetSalary,
          totalDeductions: generalPayroll.totals.totalDeductions,
          averageSalary: generalPayroll.totals.averageSalary,
          totalOvertime: generalPayroll.totals.totalOvertime,
          totalBonuses: generalPayroll.totals.totalBonuses,
          totalTaxes: generalPayroll.totals.totalTaxes
        },
        employees: generalPayroll.employees.map(emp => ({
          id: emp.employeeId,
          employee: {
            name: emp.employee.name,
            position: emp.employee.position,
            code: emp.employee.code
          },
          baseSalary: emp.baseSalary,
          overtime: emp.overtime,
          bonuses: emp.bonuses,
          grossSalary: emp.grossSalary,
          deductions: emp.deductions + emp.taxes,
          netSalary: emp.netSalary,
          status: emp.status,
          attendance: emp.attendance,
          faults: emp.faults
        }))
      };

      res.json({
        success: true,
        message: 'Simulación completada exitosamente',
        data: formattedResponse
      });

    } catch (error) {
      logger.error('❌ Error simulando nómina general', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor simulando nómina general'
      });
    }
  }

  /**
   * Aprobar nómina general
   * POST /api/payroll/general/:id/approve
   */
  static async approveGeneralPayroll(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || 'system';

      logger.info('✅ Aprobando nómina general', { id, userId });

      const generalPayroll = await GeneralPayrollService.approveGeneralPayroll(id, userId);

      res.json({
        success: true,
        message: 'Nómina general aprobada exitosamente',
        data: {
          id: generalPayroll.id,
          status: generalPayroll.status,
          approvedBy: generalPayroll.approvedBy,
          approvedAt: generalPayroll.approvedAt,
          totals: generalPayroll.totals
        }
      });

    } catch (error) {
      logger.error('❌ Error aprobando nómina general', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor aprobando nómina general'
      });
    }
  }

  /**
   * Cerrar nómina general y generar individuales
   * POST /api/payroll/general/:id/close
   */
  static async closeGeneralPayroll(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || 'system';

      logger.info('🔒 Cerrando nómina general', { id, userId });

      const result = await GeneralPayrollService.closeGeneralPayroll(id, userId);

      res.json({
        success: true,
        message: 'Nómina general cerrada exitosamente',
        data: {
          generalPayroll: {
            id: result.generalPayroll.id,
            folio: result.generalPayroll.folio,
            status: result.generalPayroll.status,
            closedBy: result.generalPayroll.closedBy,
            closedAt: result.generalPayroll.closedAt
          },
          summary: result.summary,
          individualPayrolls: result.individualPayrolls.map(ip => ({
            id: ip.id,
            employeeId: ip.employeeId,
            netSalary: ip.netSalary,
            status: ip.status
          }))
        }
      });

    } catch (error) {
      logger.error('❌ Error cerrando nómina general', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor cerrando nómina general'
      });
    }
  }

  // ================================
  // GESTIÓN DE EMPLEADOS
  // ================================

  /**
   * Obtener empleados disponibles para nómina general
   * GET /api/payroll/general/available-employees
   */
  static async getAvailableEmployees(req, res) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate y endDate son requeridos'
        });
      }

      logger.info('👥 Obteniendo empleados disponibles', { startDate, endDate });

      const availableEmployees = await GeneralPayrollService.getAvailableEmployees(startDate, endDate);

      res.json({
        success: true,
        data: {
          employees: availableEmployees,
          total: availableEmployees.length
        }
      });

    } catch (error) {
      logger.error('❌ Error obteniendo empleados disponibles', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo empleados disponibles'
      });
    }
  }

  /**
   * Aplicar ajuste a empleado específico
   * PUT /api/payroll/general/:id/employee/:employeeId/adjust
   */
  static async applyEmployeeAdjustment(req, res) {
    try {
      const { id, employeeId } = req.params;
      const { type, concept, amount, reason } = req.body;
      const appliedBy = req.user?.id || 'system';

      logger.info('🔧 Aplicando ajuste a empleado', {
        generalPayrollId: id,
        employeeId,
        type, concept, amount
      });

      // Validar datos requeridos
      if (!type || !concept || amount === undefined) {
        return res.status(400).json({
          success: false,
          error: 'type, concept y amount son requeridos'
        });
      }

      const result = await GeneralPayrollService.applyAdjustment(
        id, employeeId, { type, concept, amount, reason }, appliedBy
      );

      res.json({
        success: true,
        message: 'Ajuste aplicado exitosamente',
        data: {
          adjustment: result.adjustment.getSummary(),
          generalPayroll: {
            id: result.generalPayroll.id,
            totals: result.generalPayroll.totals
          }
        }
      });

    } catch (error) {
      logger.error('❌ Error aplicando ajuste', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor aplicando ajuste'
      });
    }
  }

  /**
   * Aprobar empleado específico
   * POST /api/payroll/general/:id/employee/:employeeId/approve
   */
  static async approveEmployee(req, res) {
    try {
      const { id, employeeId } = req.params;
      const userId = req.user?.id || 'system';

      logger.info('✅ Aprobando empleado específico', {
        generalPayrollId: id,
        employeeId, userId
      });

      const generalPayrollEmployee = await GeneralPayrollEmployee.findByEmployeeAndGeneral(
        employeeId, id
      );

      if (!generalPayrollEmployee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado en nómina general'
        });
      }

      await generalPayrollEmployee.changeStatus('approved', userId);

      // Actualizar también en nómina general
      const generalPayroll = await GeneralPayroll.findById(id);
      if (generalPayroll) {
        const employeeIndex = generalPayroll.employees.findIndex(emp => emp.employeeId === employeeId);
        if (employeeIndex !== -1) {
          generalPayroll.employees[employeeIndex].status = 'approved';
          await generalPayroll.save();
        }
      }

      res.json({
        success: true,
        message: 'Empleado aprobado exitosamente',
        data: {
          employeeId,
          status: 'approved'
        }
      });

    } catch (error) {
      logger.error('❌ Error aprobando empleado', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor aprobando empleado'
      });
    }
  }

  /**
   * Marcar empleado como pagado
   * POST /api/payroll/general/:id/employee/:employeeId/mark-paid
   */
  static async markEmployeeAsPaid(req, res) {
    try {
      const { id, employeeId } = req.params;
      const { paymentMethod = 'bank_transfer' } = req.body;
      const userId = req.user?.id || 'system';

      logger.info('💰 Marcando empleado como pagado', {
        generalPayrollId: id,
        employeeId, paymentMethod, userId
      });

      const generalPayrollEmployee = await GeneralPayrollEmployee.findByEmployeeAndGeneral(
        employeeId, id
      );

      if (!generalPayrollEmployee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado en nómina general'
        });
      }

      await generalPayrollEmployee.markAsPaid(paymentMethod, userId);

      res.json({
        success: true,
        message: 'Empleado marcado como pagado',
        data: {
          employeeId,
          status: 'paid',
          paymentMethod
        }
      });

    } catch (error) {
      logger.error('❌ Error marcando empleado como pagado', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor marcando empleado como pagado'
      });
    }
  }

  // ================================
  // ENDPOINTS ESPECÍFICOS PARA FRONTEND
  // ================================

  /**
   * Obtener datos para vista de ajustes y aprobación
   * GET /api/payroll/general/:id/approval
   */
  static async getApprovalData(req, res) {
    try {
      const { id } = req.params;

      logger.info('📊 Obteniendo datos para aprobación', { id });

      const generalPayroll = await GeneralPayroll.findById(id);
      if (!generalPayroll) {
        return res.status(404).json({
          success: false,
          error: 'Nómina general no encontrada'
        });
      }

      const employees = await GeneralPayrollEmployee.findByGeneralPayroll(id);
      const adjustments = await GeneralPayrollAdjustment.findByGeneralPayroll(id);

      // Calcular estadísticas
      const stats = {
        totalEmployees: employees.length,
        pending: employees.filter(emp => emp.status === 'pending').length,
        approved: employees.filter(emp => emp.status === 'approved').length,
        paid: employees.filter(emp => emp.status === 'paid').length,
        totalAdjustments: adjustments.length
      };

      // Formatear empleados para el frontend
      const formattedEmployees = employees.map(emp => {
        const employeeAdjustments = adjustments.filter(adj => adj.employeeId === emp.employeeId);
        const originalSalary = emp.baseSalary + emp.overtime + emp.bonuses - emp.deductions - emp.taxes;
        const adjustmentAmount = employeeAdjustments.reduce((sum, adj) => sum + adj.amount, 0);
        
        return {
          id: emp.employeeId,
          employee: emp.employee,
          originalSalary: originalSalary,
          adjustments: employeeAdjustments.map(adj => adj.getSummary()),
          finalSalary: emp.netSalary,
          difference: adjustmentAmount,
          status: emp.status,
          paymentStatus: emp.paymentStatus,
          paymentMethod: emp.paymentMethod,
          faults: emp.faults
        };
      });

      res.json({
        success: true,
        data: {
          totals: stats,
          employees: formattedEmployees,
          generalInfo: {
            id: generalPayroll.id,
            folio: generalPayroll.folio,
            status: generalPayroll.status,
            period: generalPayroll.period
          }
        }
      });

    } catch (error) {
      logger.error('❌ Error obteniendo datos de aprobación', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo datos de aprobación'
      });
    }
  }

  /**
   * Obtener nóminas individuales generadas desde una general
   * GET /api/payroll/general/:id/individual-payrolls
   */
  static async getIndividualPayrolls(req, res) {
    try {
      const { id } = req.params;

      logger.info('📋 Obteniendo nóminas individuales de general', { id });

      const Payroll = require('../models/Payroll');
      const individualPayrolls = await Payroll.findByGeneralPayroll(id);

      res.json({
        success: true,
        data: {
          individualPayrolls: individualPayrolls.map(payroll => ({
            id: payroll.id,
            employeeId: payroll.employeeId,
            period: `${payroll.periodStart} - ${payroll.periodEnd}`,
            netSalary: payroll.netSalary,
            status: payroll.status,
            generalPayrollReference: payroll.getGeneralPayrollReference()
          })),
          total: individualPayrolls.length
        }
      });

    } catch (error) {
      logger.error('❌ Error obteniendo nóminas individuales', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo nóminas individuales'
      });
    }
  }

  /**
   * Obtener estadísticas generales de nómina para dashboard
   * GET /api/payroll/general/stats
   */
  static async getDashboardStats(req, res) {
    try {
      logger.info('📊 Obteniendo estadísticas generales de nómina para dashboard');

      // Obtener todos los períodos de nómina general
      const { db } = require('../config/firebase');
      const payrollSnapshot = await db.collection('generalPayroll').get();
      const payrolls = [];
      
      payrollSnapshot.forEach(doc => {
        payrolls.push({ id: doc.id, ...doc.data() });
      });

      // Obtener todos los empleados activos
      const employeesSnapshot = await db.collection('employees').where('status', '==', 'active').get();
      const employees = [];
      
      employeesSnapshot.forEach(doc => {
        employees.push({ id: doc.id, ...doc.data() });
      });

      // Calcular métricas generales
      const totalEmployees = employees.length;
      const totalPayrolls = payrolls.length;
      
      // Calcular totales financieros
      const totalGrossSalary = payrolls.reduce((sum, p) => sum + (p.totals?.totalGrossSalary || 0), 0);
      const totalDeductions = payrolls.reduce((sum, p) => sum + (p.totals?.totalDeductions || 0), 0);
      const totalNetSalary = payrolls.reduce((sum, p) => sum + (p.totals?.totalNetSalary || 0), 0);

      // Agrupar por estado
      const byStatus = payrolls.reduce((acc, payroll) => {
        const status = payroll.status || 'draft';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      // Calcular períodos pendientes
      const pendingPayrolls = payrolls.filter(p => p.status === 'draft' || p.status === 'calculated');
      const approvedPayrolls = payrolls.filter(p => p.status === 'approved');
      const closedPayrolls = payrolls.filter(p => p.status === 'closed');

      // Calcular horas extra pendientes (simulado)
      const pendingOvertimeHours = payrolls
        .filter(p => p.status === 'draft' || p.status === 'calculated')
        .reduce((sum, p) => sum + (p.totals?.totalOvertime || 0), 0);

      // Calcular incidencias del período (simulado)
      const periodIncidents = payrolls
        .filter(p => p.status === 'draft' || p.status === 'calculated')
        .reduce((sum, p) => sum + (p.totals?.totalEmployees || 0), 0);

      const stats = {
        // Métricas principales
        totalEmployees,
        totalPayrolls,
        pendingPayrolls: pendingPayrolls.length,
        approvedPayrolls: approvedPayrolls.length,
        closedPayrolls: closedPayrolls.length,
        
        // Métricas financieras
        totalGrossSalary,
        totalDeductions,
        totalNetSalary,
        averageGrossSalary: totalPayrolls > 0 ? totalGrossSalary / totalPayrolls : 0,
        averageNetSalary: totalPayrolls > 0 ? totalNetSalary / totalPayrolls : 0,
        
        // Métricas específicas del dashboard
        pendingOvertimeHours: Math.round(pendingOvertimeHours),
        periodIncidents,
        
        // Distribución por estado
        byStatus,
        
        // Métricas adicionales
        completionRate: totalPayrolls > 0 ? Math.round((closedPayrolls.length / totalPayrolls) * 100) : 0,
        averageProcessingTime: totalPayrolls > 0 ? 2.5 : 0, // días promedio (simulado)
        
        // Resumen por período
        currentPeriod: {
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          totalGenerated: payrolls.filter(p => {
            const payrollDate = new Date(p.createdAt);
            return payrollDate.getFullYear() === new Date().getFullYear() && 
                   payrollDate.getMonth() === new Date().getMonth();
          }).length
        }
      };

      res.json({
        success: true,
        data: {
          stats,
          lastUpdated: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas generales de nómina', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo estadísticas generales'
      });
    }
  }

  /**
   * Obtener estadísticas de nómina general específica
   * GET /api/payroll/general/:id/stats
   */
  static async getGeneralPayrollStats(req, res) {
    try {
      const { id } = req.params;

      logger.info('📈 Obteniendo estadísticas de nómina general', { id });

      const stats = await GeneralPayrollService.getGeneralPayrollStats(id);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo estadísticas'
      });
    }
  }

  // ================================
  // MÉTODOS AUXILIARES
  // ================================

  /**
   * Formatear texto del período para el frontend
   */
  static formatPeriodText(period) {
    const startDate = new Date(period.startDate);
    const endDate = new Date(period.endDate);
    
    const startMonth = startDate.toLocaleString('es-ES', { month: 'long' });
    const endMonth = endDate.toLocaleString('es-ES', { month: 'long' });
    const year = startDate.getFullYear();
    
    if (startMonth === endMonth) {
      return `${startMonth.charAt(0).toUpperCase() + startMonth.slice(1)} ${year} (${period.startDate} - ${period.endDate})`;
    } else {
      return `${startMonth.charAt(0).toUpperCase() + startMonth.slice(1)} - ${endMonth.charAt(0).toUpperCase() + endMonth.slice(1)} ${year} (${period.startDate} - ${period.endDate})`;
    }
  }

  /**
   * Obtener texto de frecuencia
   */
  static getFrequencyText(frequency) {
    const frequencies = {
      'daily': 'Diaria',
      'weekly': 'Semanal',
      'biweekly': 'Quincenal',
      'monthly': 'Mensual'
    };
    return frequencies[frequency] || frequency;
  }

  /**
   * Obtener texto de estado
   */
  static getStatusText(status) {
    const statuses = {
      'draft': 'Borrador',
      'calculated': 'Calculado',
      'approved': 'Aprobado',
      'closed': 'Cerrado',
      'cancelled': 'Cancelado'
    };
    return statuses[status] || status;
  }
}

module.exports = GeneralPayrollController;
