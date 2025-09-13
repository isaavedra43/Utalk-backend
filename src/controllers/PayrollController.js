const PayrollService = require('../services/PayrollService');
const PayrollConfig = require('../models/PayrollConfig');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const logger = require('../utils/logger');

/**
 * Controlador de Nómina - Endpoints para gestión de nóminas
 * Maneja todas las operaciones relacionadas con períodos de nómina
 */
class PayrollController {
  /**
   * Configurar nómina para un empleado
   * POST /api/payroll/config/:employeeId
   */
  static async configurePayroll(req, res) {
    try {
      const { employeeId } = req.params;
      const configData = req.body;
      const userId = req.user?.id;

      logger.info('🔧 Solicitud de configuración de nómina', { employeeId, configData, userId });

      // Validar datos requeridos
      const requiredFields = ['frequency', 'baseSalary'];
      for (const field of requiredFields) {
        if (!configData[field]) {
          return res.status(400).json({
            success: false,
            error: `Campo requerido: ${field}`,
            field
          });
        }
      }

      // Verificar que el empleado existe
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      const config = await PayrollService.configurePayroll(employeeId, configData, userId);

      res.status(201).json({
        success: true,
        message: 'Configuración de nómina creada exitosamente',
        data: {
          config: config.toFirestore(),
          employee: {
            id: employee.id,
            name: employee.name,
            email: employee.email
          }
        }
      });

    } catch (error) {
      logger.error('❌ Error configurando nómina', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor configurando nómina'
      });
    }
  }

  /**
   * Obtener configuración de nómina de un empleado
   * GET /api/payroll/config/:employeeId
   */
  static async getPayrollConfig(req, res) {
    try {
      const { employeeId } = req.params;

      logger.info('📋 Obteniendo configuración de nómina', { employeeId });

      const config = await PayrollConfig.findActiveByEmployee(employeeId);
      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'No se encontró configuración de nómina activa para este empleado'
        });
      }

      res.json({
        success: true,
        data: {
          config: config.toFirestore()
        }
      });

    } catch (error) {
      logger.error('❌ Error obteniendo configuración de nómina', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo configuración'
      });
    }
  }

  /**
   * Actualizar configuración de nómina
   * PUT /api/payroll/config/:employeeId
   */
  static async updatePayrollConfig(req, res) {
    try {
      const { employeeId } = req.params;
      const configData = req.body;
      const userId = req.user?.id;

      logger.info('🔄 Actualizando configuración de nómina', { employeeId, configData, userId });

      const currentConfig = await PayrollConfig.findActiveByEmployee(employeeId);
      if (!currentConfig) {
        return res.status(404).json({
          success: false,
          error: 'No se encontró configuración activa para actualizar'
        });
      }

      // Crear nueva configuración (desactivando la anterior)
      const newConfig = await currentConfig.replaceWith(configData, userId);

      res.json({
        success: true,
        message: 'Configuración de nómina actualizada exitosamente',
        data: {
          config: newConfig.toFirestore(),
          previousConfig: currentConfig.toFirestore()
        }
      });

    } catch (error) {
      logger.error('❌ Error actualizando configuración de nómina', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor actualizando configuración'
      });
    }
  }

  /**
   * Generar nómina para un empleado
   * POST /api/payroll/generate/:employeeId
   */
  static async generatePayroll(req, res) {
    try {
      const { employeeId } = req.params;
      const { periodDate, forceRegenerate = false } = req.body;

      logger.info('📊 Generando nómina', { employeeId, periodDate, forceRegenerate });

      const payroll = await PayrollService.generatePayroll(
        employeeId, 
        periodDate ? new Date(periodDate) : new Date(), 
        forceRegenerate
      );

      // Obtener detalles completos
      const details = await PayrollService.getPayrollDetails(payroll.id);

      res.status(201).json({
        success: true,
        message: 'Nómina generada exitosamente',
        data: {
          payroll: payroll.toFirestore(),
          details: details.details,
          summary: details.summary
        }
      });

    } catch (error) {
      logger.error('❌ Error generando nómina', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor generando nómina'
      });
    }
  }

  /**
   * Obtener períodos de nómina de un empleado
   * GET /api/payroll/periods/:employeeId
   */
  static async getPayrollPeriods(req, res) {
    try {
      const { employeeId } = req.params;
      const { limit, year, month, status } = req.query;

      logger.info('📋 Obteniendo períodos de nómina', { employeeId, limit, year, month, status });

      const options = {
        limit: limit ? parseInt(limit) : 50,
        year: year ? parseInt(year) : null,
        month: month ? parseInt(month) : null,
        status
      };

      const result = await PayrollService.getPayrollPeriods(employeeId, options);

      res.json({
        success: true,
        data: {
          periods: result.periods.map(p => p.toFirestore()),
          summary: result.summary,
          filters: options
        }
      });

    } catch (error) {
      logger.error('❌ Error obteniendo períodos de nómina', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo períodos'
      });
    }
  }

  /**
   * Obtener detalles de un período específico
   * GET /api/payroll/period/:payrollId/details
   */
  static async getPayrollDetails(req, res) {
    try {
      const { payrollId } = req.params;

      logger.info('📋 Obteniendo detalles de período', { payrollId });

      const result = await PayrollService.getPayrollDetails(payrollId);

      res.json({
        success: true,
        data: {
          payroll: result.payroll.toFirestore(),
          perceptions: result.details.perceptions.map(d => d.toFirestore()),
          deductions: result.details.deductions.map(d => d.toFirestore()),
          summary: result.summary
        }
      });

    } catch (error) {
      logger.error('❌ Error obteniendo detalles de período', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo detalles'
      });
    }
  }

  /**
   * Aprobar período de nómina
   * PUT /api/payroll/approve/:payrollId
   */
  static async approvePayroll(req, res) {
    try {
      const { payrollId } = req.params;
      const userId = req.user?.id;

      logger.info('✅ Aprobando período de nómina', { payrollId, userId });

      const payroll = await PayrollService.approvePayroll(payrollId, userId);

      res.json({
        success: true,
        message: 'Período de nómina aprobado exitosamente',
        data: {
          payroll: payroll.toFirestore()
        }
      });

    } catch (error) {
      logger.error('❌ Error aprobando período de nómina', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor aprobando nómina'
      });
    }
  }

  /**
   * Marcar período como pagado
   * PUT /api/payroll/pay/:payrollId
   */
  static async markAsPaid(req, res) {
    try {
      const { payrollId } = req.params;
      const { paymentDate } = req.body;
      const userId = req.user?.id;

      logger.info('💰 Marcando período como pagado', { payrollId, paymentDate, userId });

      const payroll = await PayrollService.markAsPaid(payrollId, userId, paymentDate);

      res.json({
        success: true,
        message: 'Período marcado como pagado exitosamente',
        data: {
          payroll: payroll.toFirestore()
        }
      });

    } catch (error) {
      logger.error('❌ Error marcando período como pagado', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor marcando como pagado'
      });
    }
  }

  /**
   * Cancelar período de nómina
   * PUT /api/payroll/cancel/:payrollId
   */
  static async cancelPayroll(req, res) {
    try {
      const { payrollId } = req.params;
      const { reason = '' } = req.body;
      const userId = req.user?.id;

      logger.info('❌ Cancelando período de nómina', { payrollId, reason, userId });

      const payroll = await PayrollService.cancelPayroll(payrollId, userId, reason);

      res.json({
        success: true,
        message: 'Período de nómina cancelado exitosamente',
        data: {
          payroll: payroll.toFirestore()
        }
      });

    } catch (error) {
      logger.error('❌ Error cancelando período de nómina', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor cancelando nómina'
      });
    }
  }

  /**
   * Eliminar período de nómina
   * DELETE /api/payroll/period/:payrollId
   */
  static async deletePayroll(req, res) {
    try {
      const { payrollId } = req.params;
      const userId = req.user?.id;

      logger.info('🗑️ Eliminando período de nómina', { payrollId, userId });

      await PayrollService.deletePayroll(payrollId);

      res.json({
        success: true,
        message: 'Período de nómina eliminado exitosamente'
      });

    } catch (error) {
      logger.error('❌ Error eliminando período de nómina', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor eliminando nómina'
      });
    }
  }

  /**
   * Obtener períodos pendientes de pago
   * GET /api/payroll/pending
   */
  static async getPendingPayments(req, res) {
    try {
      const { limit = 50 } = req.query;

      logger.info('📋 Obteniendo períodos pendientes de pago', { limit });

      const periods = await Payroll.findPendingPayments();
      const limitedPeriods = periods.slice(0, parseInt(limit));

      // Obtener información de empleados
      const periodsWithEmployees = await Promise.all(
        limitedPeriods.map(async (period) => {
          const employee = await Employee.findById(period.employeeId);
          return {
            ...period.toFirestore(),
            employee: employee ? {
              id: employee.id,
              name: employee.name,
              email: employee.email,
              department: employee.department
            } : null
          };
        })
      );

      // Calcular resumen
      const summary = {
        totalPending: periods.length,
        totalAmount: periods.reduce((sum, p) => sum + p.netSalary, 0),
        byStatus: {}
      };

      periods.forEach(period => {
        summary.byStatus[period.status] = (summary.byStatus[period.status] || 0) + 1;
      });

      res.json({
        success: true,
        data: {
          periods: periodsWithEmployees,
          summary,
          pagination: {
            total: periods.length,
            shown: limitedPeriods.length,
            limit: parseInt(limit)
          }
        }
      });

    } catch (error) {
      logger.error('❌ Error obteniendo períodos pendientes', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo períodos pendientes'
      });
    }
  }

  /**
   * Generar múltiples nóminas automáticamente
   * POST /api/payroll/auto-generate
   */
  static async autoGeneratePayrolls(req, res) {
    try {
      const { frequency, employeeIds = [] } = req.body;

      logger.info('🤖 Generación automática de nóminas', { frequency, employeeIds });

      let results;

      if (employeeIds.length > 0) {
        // Generar para empleados específicos
        results = [];
        for (const employeeId of employeeIds) {
          try {
            const payroll = await PayrollService.generatePayroll(employeeId);
            results.push({
              employeeId,
              success: true,
              payrollId: payroll.id,
              netSalary: payroll.netSalary
            });
          } catch (error) {
            results.push({
              employeeId,
              success: false,
              error: error.message
            });
          }
        }
      } else if (frequency) {
        // Generar por frecuencia
        results = await PayrollService.generatePayrollsByFrequency(frequency);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Debe especificar frequency o employeeIds'
        });
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      res.json({
        success: true,
        message: `Generación automática completada: ${successful} exitosas, ${failed} fallidas`,
        data: {
          results,
          summary: {
            total: results.length,
            successful,
            failed,
            successRate: results.length > 0 ? (successful / results.length) * 100 : 0
          }
        }
      });

    } catch (error) {
      logger.error('❌ Error en generación automática', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor en generación automática'
      });
    }
  }

  /**
   * Obtener estadísticas de nómina
   * GET /api/payroll/stats
   */
  static async getPayrollStats(req, res) {
    try {
      const { year, month, employeeId } = req.query;

      logger.info('📊 Obteniendo estadísticas de nómina', { year, month, employeeId });

      // Esta es una implementación básica, se puede expandir
      const periods = await Payroll.findPendingPayments(); // Por ahora usar todos los pendientes

      const stats = {
        totalPeriods: periods.length,
        totalGross: periods.reduce((sum, p) => sum + p.grossSalary, 0),
        totalDeductions: periods.reduce((sum, p) => sum + p.totalDeductions, 0),
        totalNet: periods.reduce((sum, p) => sum + p.netSalary, 0),
        averageGross: periods.length > 0 ? periods.reduce((sum, p) => sum + p.grossSalary, 0) / periods.length : 0,
        averageNet: periods.length > 0 ? periods.reduce((sum, p) => sum + p.netSalary, 0) / periods.length : 0,
        byFrequency: {},
        byStatus: {},
        byMonth: {}
      };

      // Agrupar por frecuencia
      periods.forEach(period => {
        stats.byFrequency[period.frequency] = (stats.byFrequency[period.frequency] || 0) + 1;
        stats.byStatus[period.status] = (stats.byStatus[period.status] || 0) + 1;
        stats.byMonth[period.month] = (stats.byMonth[period.month] || 0) + 1;
      });

      res.json({
        success: true,
        data: {
          stats,
          filters: { year, month, employeeId }
        }
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
}

module.exports = PayrollController;