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
      const { period, includeEmployees, options = {} } = req.body;
      const userId = req.user?.id || 'system';

      logger.info('🏢 Solicitud de creación de nómina general', {
        period,
        employeesCount: includeEmployees?.length || 0,
        options,
        userId
      });

      // Validar datos requeridos según nuevo formato
      if (!period || !period.startDate || !period.endDate || !period.type) {
        return res.status(400).json({
          success: false,
          error: 'period con startDate, endDate y type son requeridos'
        });
      }

      if (!includeEmployees || includeEmployees.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Debe incluir al menos un empleado'
        });
      }

      const result = await GeneralPayrollService.createGeneralPayroll({
        startDate: period.startDate,
        endDate: period.endDate,
        frequency: period.type,
        includeEmployees,
        autoCalculate: options.autoCalculate || false,
        includeExtras: options.includeExtras || false,
        includeBonuses: options.includeBonuses || false
      }, userId);

      const statusCode = result.isExisting ? 200 : 201;
      const message = result.isExisting 
        ? 'Nómina general existente encontrada' 
        : 'Nómina general creada exitosamente';

      res.status(statusCode).json({
        success: true,
        message: message,
        data: {
          id: result.id,
          period: result.period,
          status: result.status,
          totals: result.totals,
          employees: result.employees.map(emp => ({
            id: emp.employeeId,
            employee: emp.employee,
            status: emp.status
          })),
          warnings: result.configWarnings || [],
          isExisting: result.isExisting || false
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

      // Formatear para el frontend según especificaciones
      const formattedPayrolls = result.payrolls.map(payroll => {
        return {
          id: payroll.id,
          period: payroll.period?.label || `${payroll.period?.startDate} - ${payroll.period?.endDate}`,
          type: payroll.period?.type || 'weekly',
          startDate: payroll.period?.startDate,
          endDate: payroll.period?.endDate,
          status: payroll.status,
          totalEmployees: payroll.totals?.totalEmployees || 0,
          grossTotal: payroll.totals?.grossTotal || payroll.totals?.totalGrossSalary || 0,
          netTotal: payroll.totals?.netTotal || payroll.totals?.totalNetSalary || 0,
          createdAt: payroll.createdAt,
          createdBy: payroll.createdBy || 'system'
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

  // ================================
  // GESTIÓN DE IMPUESTOS
  // ================================

  /**
   * Toggle global de impuestos para toda la nómina
   * PUT /api/payroll/general/:id/taxes/global
   */
  static async toggleGlobalTaxes(req, res) {
    try {
      const { id } = req.params;
      const { taxesEnabled } = req.body;
      const userId = req.user?.id || 'system';

      logger.info('🏛️ Toggle global de impuestos', { 
        payrollId: id, 
        taxesEnabled, 
        userId 
      });

      // Validar entrada
      if (typeof taxesEnabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'El campo taxesEnabled debe ser un booleano'
        });
      }

      const result = await GeneralPayrollService.toggleGlobalTaxes(id, taxesEnabled, userId);

      res.json({
        success: true,
        message: `Impuestos ${taxesEnabled ? 'habilitados' : 'deshabilitados'} globalmente`,
        data: {
          payrollId: id,
          taxesEnabled: result.taxesEnabled,
          affectedEmployees: result.affectedEmployees,
          newTotals: result.totals,
          updatedAt: result.updatedAt
        }
      });

    } catch (error) {
      logger.error('❌ Error en toggle global de impuestos', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor'
      });
    }
  }

  /**
   * Toggle individual de impuestos para un empleado específico
   * PUT /api/payroll/general/:id/employee/:employeeId/taxes
   */
  static async toggleEmployeeTaxes(req, res) {
    try {
      const { id, employeeId } = req.params;
      const { taxesEnabled } = req.body;
      const userId = req.user?.id || 'system';

      logger.info('👤 Toggle individual de impuestos', { 
        payrollId: id, 
        employeeId, 
        taxesEnabled, 
        userId 
      });

      // Validar entrada
      if (typeof taxesEnabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'El campo taxesEnabled debe ser un booleano'
        });
      }

      const result = await GeneralPayrollService.toggleEmployeeTaxes(
        id, employeeId, taxesEnabled, userId
      );

      res.json({
        success: true,
        message: `Impuestos ${taxesEnabled ? 'habilitados' : 'deshabilitados'} para empleado`,
        data: {
          payrollId: id,
          employeeId: employeeId,
          taxesEnabled: result.taxesEnabled,
          employee: result.employee,
          newCalculations: result.calculations,
          updatedAt: result.updatedAt
        }
      });

    } catch (error) {
      logger.error('❌ Error en toggle individual de impuestos', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener configuración actual de impuestos
   * GET /api/payroll/general/:id/taxes/configuration
   */
  static async getTaxesConfiguration(req, res) {
    try {
      const { id } = req.params;

      logger.info('📋 Obteniendo configuración de impuestos', { payrollId: id });

      const configuration = await GeneralPayrollService.getTaxesConfiguration(id);

      res.json({
        success: true,
        message: 'Configuración de impuestos obtenida exitosamente',
        data: configuration
      });

    } catch (error) {
      logger.error('❌ Error obteniendo configuración de impuestos', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor'
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

      // Formatear empleados para el frontend según especificaciones
      // Política: CALCULAR SIEMPRE desde datos reales (simulación determinística) y responder con eso.
      const formattedEmployees = await Promise.all(employees.map(async (emp) => {
        const employeeAdjustments = adjustments.filter(adj => adj.employeeId === emp.employeeId);

        // 1) Recalcular SIEMPRE con datos reales del período
        let originalGross = 0;
        let originalNet = 0;
        try {
          const period = {
            startDate: generalPayroll.period?.startDate,
            endDate: generalPayroll.period?.endDate,
            type: generalPayroll.period?.type || 'biweekly'
          };

          const simulation = await GeneralPayrollService.simulateEmployeePayroll(emp.employeeId, period);
          // Tomar SIEMPRE los montos de la simulación para la respuesta
          originalGross = simulation.gross || 0;
          originalNet = simulation.net || 0;

          logger.info('✅ Aprobación usando datos de simulación', {
            employeeId: emp.employeeId,
            originalGross,
            originalNet
          });
        } catch (recalcError) {
          logger.error('❌ Error recalculando datos para aprobación', recalcError);
          // Fallback mínimo para no romper respuesta
          originalGross = (emp.baseSalary || 0) + (emp.overtime || 0) + (emp.bonuses || 0);
          originalNet = emp.netSalary || 0;
        }

        const adjustmentAmount = employeeAdjustments.reduce((sum, adj) => sum + adj.amount, 0);

        return {
          employeeId: emp.employeeId,
          name: emp.employee?.name || `${emp.employee?.firstName || ''} ${emp.employee?.lastName || ''}`.trim(),
          position: emp.employee?.position || emp.employee?.position?.title || 'CEO',
          originalPayroll: {
            gross: originalGross,
            net: originalNet
          },
          adjustments: employeeAdjustments.map(adj => ({
            id: adj.id,
            type: adj.type,
            concept: adj.concept,
            amount: adj.amount,
            status: adj.status,
            approvedBy: adj.approvedBy,
            approvedAt: adj.approvedAt
          })),
          finalPayroll: {
            gross: originalGross + adjustmentAmount,
            net: originalNet + adjustmentAmount,
            difference: adjustmentAmount
          },
          status: emp.status,
          paymentStatus: emp.paymentStatus || 'pending',
          paymentMethod: emp.paymentMethod || null
        };
      }));

      res.json({
        success: true,
        data: {
          payroll: {
            id: generalPayroll.id,
            period: generalPayroll.period?.label || `Semana del ${generalPayroll.period?.startDate?.split('-')[2]}/${generalPayroll.period?.startDate?.split('-')[1]} (${generalPayroll.period?.startDate} - ${generalPayroll.period?.endDate})`,
            startDate: generalPayroll.period?.startDate,
            endDate: generalPayroll.period?.endDate,
            status: generalPayroll.status
          },
          summary: {
            totalEmployees: stats.totalEmployees,
            pending: stats.pending,
            approved: stats.approved,
            totalAdjustments: stats.totalAdjustments
          },
          employees: formattedEmployees
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

      // Obtener empleados activos para métricas base
      const { db } = require('../config/firebase');
      const employeesSnapshot = await db.collection('employees').where('status', '==', 'active').get();
      const totalEmployees = employeesSnapshot.size;

      // Obtener nóminas generales (puede estar vacío)
      const payrollSnapshot = await db.collection('generalPayroll').get();
      const payrolls = [];
      
      payrollSnapshot.forEach(doc => {
        payrolls.push({ id: doc.id, ...doc.data() });
      });

      // Calcular métricas financieras (funcionan con datos vacíos)
      const grossTotal = payrolls.reduce((sum, p) => sum + (p.totals?.grossTotal || p.totals?.totalGrossSalary || 0), 0);
      const netTotal = payrolls.reduce((sum, p) => sum + (p.totals?.netTotal || p.totals?.totalNetSalary || 0), 0);
      const deductionsTotal = payrolls.reduce((sum, p) => sum + (p.totals?.deductionsTotal || p.totals?.totalDeductions || 0), 0);
      const taxesTotal = payrolls.reduce((sum, p) => sum + (p.totals?.taxesTotal || 0), 0);
      const overtimeTotal = payrolls.reduce((sum, p) => sum + (p.totals?.overtimeTotal || p.totals?.totalOvertime || 0), 0);
      const bonusesTotal = payrolls.reduce((sum, p) => sum + (p.totals?.bonusesTotal || 0), 0);

      // Contar períodos por estado
      const pending = payrolls.filter(p => p.status === 'pending' || p.status === 'draft' || p.status === 'calculated').length;
      const approved = payrolls.filter(p => p.status === 'approved').length;
      const paid = payrolls.filter(p => p.status === 'paid' || p.status === 'closed').length;

      // Calcular promedio salarial
      const avgSalary = totalEmployees > 0 ? grossTotal / totalEmployees : 0;

      // SIEMPRE devolver estructura válida según especificación del frontend
      const stats = {
        summary: {
          totalEmployees,
          grossTotal: Math.round(grossTotal * 100) / 100,
          netTotal: Math.round(netTotal * 100) / 100,
          deductionsTotal: Math.round(deductionsTotal * 100) / 100,
          taxesTotal: Math.round(taxesTotal * 100) / 100,
          avgSalary: Math.round(avgSalary * 100) / 100,
          overtimeTotal: Math.round(overtimeTotal * 100) / 100,
          bonusesTotal: Math.round(bonusesTotal * 100) / 100
        },
        periods: {
          current: new Date().toISOString().split('T')[0],
          pending,
          approved,
          paid,
          total: payrolls.length
        }
      };

      logger.info('✅ Estadísticas calculadas exitosamente', { 
        totalEmployees, 
        totalPayrolls: payrolls.length,
        hasData: payrolls.length > 0,
        grossTotal,
        netTotal
      });

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas del dashboard', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo estadísticas'
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
