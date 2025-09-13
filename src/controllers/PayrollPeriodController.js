const PayrollPeriodService = require('../services/PayrollPeriodService');
const PayrollPeriod = require('../models/PayrollPeriod');
const TaxCalculationService = require('../services/TaxCalculationService');
const logger = require('../utils/logger');

/**
 * Controlador para gestión de períodos de nómina masiva
 */
class PayrollPeriodController {
  /**
   * Crear nuevo período de nómina
   * POST /api/payroll-periods
   */
  static async createPeriod(req, res) {
    try {
      const {
        name,
        startDate,
        endDate,
        frequency,
        configurations
      } = req.body;

      const createdBy = req.user.userId;

      logger.info('📅 Creando período de nómina', {
        name,
        startDate,
        endDate,
        frequency,
        createdBy
      });

      // Validaciones básicas
      if (!name || !startDate || !endDate || !frequency) {
        return res.status(400).json({
          success: false,
          error: 'Campos requeridos: name, startDate, endDate, frequency'
        });
      }

      if (new Date(startDate) >= new Date(endDate)) {
        return res.status(400).json({
          success: false,
          error: 'La fecha de inicio debe ser anterior a la fecha de fin'
        });
      }

      const periodData = {
        name,
        startDate,
        endDate,
        frequency,
        configurations: configurations || {}
      };

      const period = await PayrollPeriodService.createPeriod(periodData, createdBy);

      res.status(201).json({
        success: true,
        message: 'Período de nómina creado exitosamente',
        data: period.getFullInfo()
      });

    } catch (error) {
      logger.error('❌ Error creando período de nómina', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor creando período'
      });
    }
  }

  /**
   * Obtener todos los períodos de nómina
   * GET /api/payroll-periods
   */
  static async getPeriods(req, res) {
    try {
      const {
        status = 'all',
        frequency,
        page = 1,
        limit = 10,
        orderBy = 'createdAt',
        orderDirection = 'desc'
      } = req.query;

      logger.info('📋 Obteniendo períodos de nómina', {
        status,
        frequency,
        page,
        limit
      });

      const periods = await PayrollPeriod.findAll({
        status,
        frequency,
        page: parseInt(page),
        limit: parseInt(limit),
        orderBy,
        orderDirection
      });

      const periodsData = periods.map(period => period.getBasicInfo());

      res.json({
        success: true,
        data: {
          periods: periodsData,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: periodsData.length
          }
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
   * Obtener período actual
   * GET /api/payroll-periods/current
   */
  static async getCurrentPeriod(req, res) {
    try {
      logger.info('📅 Obteniendo período actual');

      const currentPeriod = await PayrollPeriod.findCurrent();

      if (!currentPeriod) {
        return res.json({
          success: true,
          data: null,
          message: 'No hay período de nómina activo'
        });
      }

      res.json({
        success: true,
        data: currentPeriod.getFullInfo()
      });

    } catch (error) {
      logger.error('❌ Error obteniendo período actual', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo período actual'
      });
    }
  }

  /**
   * Obtener período específico por ID
   * GET /api/payroll-periods/:periodId
   */
  static async getPeriodById(req, res) {
    try {
      const { periodId } = req.params;

      logger.info('📋 Obteniendo período por ID', { periodId });

      const period = await PayrollPeriod.findById(periodId);

      if (!period) {
        return res.status(404).json({
          success: false,
          error: 'Período de nómina no encontrado'
        });
      }

      res.json({
        success: true,
        data: period.getFullInfo()
      });

    } catch (error) {
      logger.error('❌ Error obteniendo período por ID', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo período'
      });
    }
  }

  /**
   * Procesar nómina masiva para un período
   * POST /api/payroll-periods/:periodId/process
   */
  static async processPeriod(req, res) {
    try {
      const { periodId } = req.params;

      logger.info('🚀 Procesando nómina masiva', { periodId });

      const result = await PayrollPeriodService.processMassPayroll(periodId);

      res.json({
        success: true,
        message: 'Nómina procesada exitosamente',
        data: result
      });

    } catch (error) {
      logger.error('❌ Error procesando nómina masiva', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor procesando nómina'
      });
    }
  }

  /**
   * Obtener empleados de un período
   * GET /api/payroll-periods/:periodId/employees
   */
  static async getPeriodEmployees(req, res) {
    try {
      const { periodId } = req.params;
      const {
        page = 1,
        limit = 50,
        search,
        department,
        status = 'all'
      } = req.query;

      logger.info('👥 Obteniendo empleados del período', {
        periodId,
        filters: { search, department, status }
      });

      const result = await PayrollPeriodService.getPeriodEmployees(periodId, {
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        department,
        status
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('❌ Error obteniendo empleados del período', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo empleados'
      });
    }
  }

  /**
   * Aprobar período completo
   * PUT /api/payroll-periods/:periodId/approve
   */
  static async approvePeriod(req, res) {
    try {
      const { periodId } = req.params;
      const approvedBy = req.user.userId;

      logger.info('✅ Aprobando período', { periodId, approvedBy });

      const period = await PayrollPeriodService.approvePeriod(periodId, approvedBy);

      res.json({
        success: true,
        message: 'Período aprobado exitosamente',
        data: period
      });

    } catch (error) {
      logger.error('❌ Error aprobando período', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor aprobando período'
      });
    }
  }

  /**
   * Marcar período como pagado
   * PUT /api/payroll-periods/:periodId/mark-paid
   */
  static async markPeriodAsPaid(req, res) {
    try {
      const { periodId } = req.params;
      const paidBy = req.user.userId;

      logger.info('💰 Marcando período como pagado', { periodId, paidBy });

      const period = await PayrollPeriodService.markPeriodAsPaid(periodId, paidBy);

      res.json({
        success: true,
        message: 'Período marcado como pagado exitosamente',
        data: period
      });

    } catch (error) {
      logger.error('❌ Error marcando período como pagado', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor marcando período como pagado'
      });
    }
  }

  /**
   * Cerrar período
   * PUT /api/payroll-periods/:periodId/close
   */
  static async closePeriod(req, res) {
    try {
      const { periodId } = req.params;

      logger.info('🔒 Cerrando período', { periodId });

      const period = await PayrollPeriod.findById(periodId);
      if (!period) {
        return res.status(404).json({
          success: false,
          error: 'Período de nómina no encontrado'
        });
      }

      if (!period.canBeClosed()) {
        return res.status(400).json({
          success: false,
          error: `Período no puede ser cerrado. Estado actual: ${period.status}`
        });
      }

      await period.updateStatus('closed');

      res.json({
        success: true,
        message: 'Período cerrado exitosamente',
        data: period.getBasicInfo()
      });

    } catch (error) {
      logger.error('❌ Error cerrando período', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor cerrando período'
      });
    }
  }

  /**
   * Eliminar período (solo si está en borrador)
   * DELETE /api/payroll-periods/:periodId
   */
  static async deletePeriod(req, res) {
    try {
      const { periodId } = req.params;

      logger.info('🗑️ Eliminando período', { periodId });

      const period = await PayrollPeriod.findById(periodId);
      if (!period) {
        return res.status(404).json({
          success: false,
          error: 'Período de nómina no encontrado'
        });
      }

      await period.delete();

      res.json({
        success: true,
        message: 'Período eliminado exitosamente'
      });

    } catch (error) {
      logger.error('❌ Error eliminando período', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor eliminando período'
      });
    }
  }

  /**
   * Obtener estadísticas de períodos
   * GET /api/payroll-periods/stats
   */
  static async getPeriodStats(req, res) {
    try {
      const { year, month } = req.query;

      logger.info('📊 Obteniendo estadísticas de períodos', { year, month });

      // Obtener todos los períodos
      const periods = await PayrollPeriod.findAll({ limit: 1000 });

      // Calcular estadísticas
      const stats = {
        total: periods.length,
        byStatus: {},
        byFrequency: {},
        totalPayroll: 0,
        totalEmployees: 0,
        averagePayroll: 0
      };

      periods.forEach(period => {
        // Por estado
        stats.byStatus[period.status] = (stats.byStatus[period.status] || 0) + 1;
        
        // Por frecuencia
        stats.byFrequency[period.frequency] = (stats.byFrequency[period.frequency] || 0) + 1;
        
        // Totales
        stats.totalPayroll += period.summary.totalPayroll || 0;
        stats.totalEmployees += period.summary.totalEmployees || 0;
      });

      stats.averagePayroll = periods.length > 0 ? 
        Math.round((stats.totalPayroll / periods.length) * 100) / 100 : 0;

      res.json({
        success: true,
        data: {
          stats,
          filters: { year, month }
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

  /**
   * Obtener información de tablas fiscales
   * GET /api/payroll-periods/tax-info
   */
  static async getTaxInfo(req, res) {
    try {
      logger.info('📋 Obteniendo información fiscal');

      const taxInfo = TaxCalculationService.getTaxTablesInfo();

      res.json({
        success: true,
        data: taxInfo
      });

    } catch (error) {
      logger.error('❌ Error obteniendo información fiscal', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo información fiscal'
      });
    }
  }

  /**
   * Validar fechas de período
   * POST /api/payroll-periods/validate-dates
   */
  static async validatePeriodDates(req, res) {
    try {
      const { startDate, endDate, excludeId } = req.body;

      logger.info('📅 Validando fechas de período', { startDate, endDate, excludeId });

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Se requieren startDate y endDate'
        });
      }

      const validation = await PayrollPeriod.validatePeriodDates(startDate, endDate, excludeId);

      res.json({
        success: true,
        data: validation
      });

    } catch (error) {
      logger.error('❌ Error validando fechas', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor validando fechas'
      });
    }
  }
}

module.exports = PayrollPeriodController;
