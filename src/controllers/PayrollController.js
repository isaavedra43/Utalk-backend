const PayrollService = require('../services/PayrollService');
const GeneralPayrollService = require('../services/GeneralPayrollService');
const AttachmentService = require('../services/AttachmentService');
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
   * Obtener período actual de nómina
   * GET /api/payroll/current-period
   */
  static async getCurrentPayrollPeriod(req, res) {
    try {
      logger.info('📅 Obteniendo período actual de nómina');

      // Obtener período actual desde PayrollPeriod
      const PayrollPeriod = require('../models/PayrollPeriod');
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
        data: currentPeriod.getBasicInfo()
      });

    } catch (error) {
      logger.error('❌ Error obteniendo período actual de nómina', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo período actual'
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
   * Verificar extras pendientes para un empleado
   * GET /api/payroll/extras-pending/:employeeId
   */
  static async getPendingExtras(req, res) {
    try {
      const { employeeId } = req.params;
      const { periodStart, periodEnd } = req.query;

      logger.info('📋 Obteniendo extras pendientes', { employeeId, periodStart, periodEnd });

      // Si no se especifica período, usar período basado en la configuración del empleado
      let startDate, endDate;
      if (periodStart && periodEnd) {
        startDate = periodStart;
        endDate = periodEnd;
      } else {
        // Obtener la configuración del empleado para usar su frecuencia
        const config = await PayrollConfig.findActiveByEmployee(employeeId);
        if (!config) {
          return res.status(404).json({
            success: false,
            error: 'Configuración de nómina no encontrada para el empleado'
          });
        }

        // Calcular período actual basado en la frecuencia configurada
        const dates = PayrollService.calculatePeriodDates(config.frequency);
        startDate = dates.periodStart;
        endDate = dates.periodEnd;
        
        logger.info('📅 Período calculado basado en frecuencia', { 
          frequency: config.frequency, 
          startDate, 
          endDate 
        });
      }

      // Obtener extras aplicables
      const extras = await PayrollService.getExtrasForPeriod(employeeId, startDate, endDate);

      // Separar por tipo de impacto CORRIGIENDO EL MÉTODO
      const perceptions = extras.filter(extra => {
        const impactType = extra.getImpactType ? extra.getImpactType() : extra.impactType;
        return impactType === 'positive' || impactType === 'add';
      });
      const deductions = extras.filter(extra => {
        const impactType = extra.getImpactType ? extra.getImpactType() : extra.impactType;
        return impactType === 'negative' || impactType === 'subtract';
      });

      logger.info('🔍 Separación de extras', {
        totalExtras: extras.length,
        perceptions: perceptions.length,
        deductions: deductions.length,
        extrasDetails: extras.map(e => ({
          id: e.id,
          type: e.type,
          impactType: e.impactType,
          getImpactType: e.getImpactType ? e.getImpactType() : 'N/A',
          amount: e.calculatedAmount || e.amount
        }))
      });

      // Calcular totales CORRECTAMENTE usando todos los extras
      const totalToAdd = extras
        .filter(extra => extra.impactType === 'add')
        .reduce((sum, extra) => sum + (extra.calculatedAmount || extra.amount), 0);
      
      const totalToSubtract = extras
        .filter(extra => extra.impactType === 'subtract')
        .reduce((sum, extra) => sum + Math.abs(extra.calculatedAmount || extra.amount), 0);
      
      const netImpact = totalToAdd - totalToSubtract;

      const summary = {
        totalExtras: extras.length,
        totalPerceptions: perceptions.length,
        totalDeductions: deductions.length,
        totalToAdd,
        totalToSubtract,
        netImpact
      };

      logger.info('💰 Cálculo de totales de extras', {
        employeeId,
        totalExtras: extras.length,
        totalToAdd,
        totalToSubtract,
        netImpact,
        extrasBreakdown: extras.map(e => ({
          type: e.type,
          impactType: e.impactType,
          amount: e.calculatedAmount || e.amount,
          status: e.status
        }))
      });

      res.json({
        success: true,
        data: {
          period: { startDate, endDate },
          extras: extras.map(extra => extra.toFirestore()),
          perceptions: perceptions.map(extra => extra.toFirestore()),
          deductions: deductions.map(extra => extra.toFirestore()),
          summary
        }
      });

    } catch (error) {
      logger.error('❌ Error obteniendo extras pendientes', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo extras pendientes'
      });
    }
  }

  /**
   * Generar primer período de nómina
   * POST /api/payroll/generate-first/:employeeId
   */
  static async generateFirstPayroll(req, res) {
    try {
      const { employeeId } = req.params;
      const userId = req.user?.id;

      logger.info('🚀 Generando primer período de nómina', { employeeId, userId });

      // Verificar que no existan períodos previos
      const existingPeriods = await PayrollService.getPayrollPeriods(employeeId, { limit: 1 });
      if (existingPeriods.periods.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Ya existen períodos de nómina para este empleado',
          data: { existingPeriods: existingPeriods.periods.length }
        });
      }

      // Generar nómina para el período actual
      const payroll = await PayrollService.generatePayroll(employeeId, new Date(), true);

      // Obtener detalles completos
      const details = await PayrollService.getPayrollDetails(payroll.id);

      res.json({
        success: true,
        message: 'Primer período de nómina generado exitosamente',
        data: {
          payroll: payroll.toFirestore(),
          details: details.details,
          summary: details.summary
        }
      });

    } catch (error) {
      logger.error('❌ Error generando primer período de nómina', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor generando primer período'
      });
    }
  }

  /**
   * Regenerar nómina incluyendo extras pendientes
   * POST /api/payroll/regenerate-with-extras/:payrollId
   */
  static async regeneratePayrollWithExtras(req, res) {
    try {
      const { payrollId } = req.params;
      const userId = req.user?.id;

      logger.info('🔄 Regenerando nómina con extras incluidos', { payrollId, userId });

      // Obtener la nómina existente
      const existingPayroll = await Payroll.findById(payrollId);
      if (!existingPayroll) {
        return res.status(404).json({
          success: false,
          error: 'Período de nómina no encontrado'
        });
      }

      const employeeId = existingPayroll.employeeId;

      // Eliminar la nómina existente y sus detalles
      await PayrollService.deletePayroll(payrollId);
      
      // Resetear extras que estaban aplicados a esta nómina
      await PayrollService.resetExtrasForPayroll(payrollId);
      
      // Regenerar la nómina con extras incluidos
      const newPayroll = await PayrollService.generatePayroll(
        employeeId,
        new Date(existingPayroll.periodStart),
        true // forceRegenerate
      );

      logger.info('✅ Nómina regenerada con extras', {
        oldPayrollId: payrollId,
        newPayrollId: newPayroll.id,
        employeeId
      });

      return res.status(200).json({
        success: true,
        message: 'Nómina regenerada exitosamente con extras incluidos',
        data: {
          payroll: newPayroll,
          regeneratedFrom: payrollId
        }
      });

    } catch (error) {
      logger.error('❌ Error regenerando nómina con extras', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Error interno del servidor'
      });
    }
  }

  /**
   * Regenerar nómina sin impuestos automáticos
   * POST /api/payroll/regenerate/:payrollId
   */
  static async regeneratePayrollWithoutTaxes(req, res) {
    try {
      const { payrollId } = req.params;
      const userId = req.user?.id;

      logger.info('🔄 Regenerando nómina sin impuestos automáticos', { payrollId, userId });

      // Obtener la nómina existente
      const existingPayroll = await Payroll.findById(payrollId);
      if (!existingPayroll) {
        return res.status(404).json({
          success: false,
          error: 'Período de nómina no encontrado'
        });
      }

      // Eliminar la nómina existente y regenerar
      await PayrollService.deletePayroll(payrollId);
      
      // Regenerar la nómina con la nueva lógica (sin impuestos)
      const newPayroll = await PayrollService.generatePayroll(
        existingPayroll.employeeId,
        new Date(existingPayroll.periodStart),
        true // forceRegenerate
      );

      // Obtener detalles completos
      const details = await PayrollService.getPayrollDetails(newPayroll.id);

      res.json({
        success: true,
        message: 'Nómina regenerada exitosamente sin impuestos automáticos',
        data: {
          payroll: newPayroll.toFirestore(),
          details: details.details,
          summary: details.summary,
          previousPayrollId: payrollId
        }
      });

    } catch (error) {
      logger.error('❌ Error regenerando nómina sin impuestos', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor regenerando nómina'
      });
    }
  }

  /**
   * Generar PDF de recibo de nómina
   * GET /api/payroll/pdf/:payrollId
   */
  static async generatePayrollPDF(req, res) {
    try {
      const { payrollId } = req.params;

      logger.info('📄 Generando PDF de recibo de nómina', { payrollId });

      // Obtener detalles completos de la nómina
      logger.info('🔍 Obteniendo detalles de nómina...', { payrollId });
      const result = await PayrollService.getPayrollDetails(payrollId);
      if (!result) {
        logger.warn('⚠️ Nómina no encontrada', { payrollId });
        return res.status(404).json({
          success: false,
          error: 'Período de nómina no encontrado'
        });
      }

      logger.info('✅ Detalles de nómina obtenidos', { 
        payrollId, 
        employeeId: result.payroll.employeeId,
        hasPerceptions: result.details.perceptions?.length > 0,
        hasDeductions: result.details.deductions?.length > 0
      });

      // Obtener información del empleado
      logger.info('🔍 Obteniendo información del empleado...', { employeeId: result.payroll.employeeId });
      const employee = await Employee.findById(result.payroll.employeeId);
      if (!employee) {
        logger.warn('⚠️ Empleado no encontrado', { employeeId: result.payroll.employeeId });
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

      logger.info('✅ Información del empleado obtenida', { 
        employeeId: employee.id,
        employeeName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`
      });

      // Información de la empresa (puedes personalizar esto)
      const companyData = {
        name: 'UTalk',
        address: 'Dirección de la empresa',
        phone: 'Teléfono de contacto',
        email: 'contacto@utalk.com',
        rfc: 'RFC123456789',
        logo: null // URL del logo si tienes uno
      };

      // Preparar datos para el PDF
      const payrollData = {
        ...result.payroll,
        perceptions: result.details.perceptions,
        deductions: result.details.deductions
      };

      // Generar PDF
      logger.info('🎨 Iniciando generación de PDF...', { 
        payrollId,
        employeeId: employee.id,
        hasPerceptions: payrollData.perceptions?.length > 0,
        hasDeductions: payrollData.deductions?.length > 0
      });
      
      const PDFService = require('../services/PDFService');
      const pdfResult = await PDFService.generatePayrollReceipt(
        payrollData,
        employee,
        companyData
      );

      logger.info('✅ PDF generado exitosamente', { 
        fileName: pdfResult.fileName,
        size: pdfResult.size,
        contentType: pdfResult.contentType
      });

      // CONFIGURAR HEADERS PARA DESCARGA DIRECTA DEL PDF
      res.setHeader('Content-Type', pdfResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.fileName}"`);
      res.setHeader('Content-Length', pdfResult.size);
      
      // ENVIAR EL PDF DIRECTAMENTE
      res.send(pdfResult.pdfBuffer);

    } catch (error) {
      logger.error('❌ Error generando PDF de recibo de nómina', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor generando PDF'
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

  /**
   * Simular nómina general para un período
   * POST /api/payroll/simulate
   */
  static async simulateGeneralPayroll(req, res) {
    const startTime = Date.now();
    const traceId = req.headers['x-trace-id'] || `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const userId = req.user?.id || 'system';
      const { period, scope, options = {} } = req.body;

      logger.info('🧮 Iniciando simulación de nómina general', { 
        userId, traceId, period, scope, options 
      });

      // 1. Validaciones de entrada
      const validationResult = PayrollController.validateSimulationRequest(req.body);
      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: validationResult.message,
          details: validationResult.details,
          traceId
        });
      }

      // 2. Obtener empleados según scope
      const employees = await PayrollController.getEmployeesForSimulation(scope);
      if (employees.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'NO_EMPLOYEES_FOUND',
          message: 'No se encontraron empleados activos para la simulación',
          traceId
        });
      }

      // 3. Configurar opciones por defecto
      const simulationOptions = {
        includeExtras: options.includeExtras !== false,
        includeBonuses: options.includeBonuses !== false,
        includeAbsencesAndLates: options.includeAbsencesAndLates !== false,
        includeEmployerContribs: options.includeEmployerContribs || false,
        includeTaxes: options.includeTaxes !== undefined ? options.includeTaxes : false, // POR DEFECTO SIN IMPUESTOS
        taxRulesVersion: options.taxRulesVersion || 'MX_2025_09',
        overtimePolicyId: options.overtimePolicyId || 'default',
        roundingMode: options.roundingMode || 'HALF_UP',
        currency: options.currency || 'MXN',
        timezone: options.timezone || 'America/Mexico_City',
        previewOnly: options.previewOnly !== false
      };

      logger.info('⚙️ Opciones de simulación configuradas', {
        traceId,
        simulationOptions
      });

      // 4. CREAR NÓMINA GENERAL REAL para la simulación
      logger.info('🏗️ Creando nómina general para simulación', {
        period,
        employeesCount: employees.length,
        traceId
      });

      // Crear o encontrar nómina general existente
      let generalPayrollData;
      try {
        generalPayrollData = await GeneralPayrollService.createGeneralPayroll({
          startDate: period.startDate,
          endDate: period.endDate,
          frequency: period.type,
          includeEmployees: employees.map(emp => emp.id),
          autoCalculate: true,
          includeExtras: simulationOptions.includeExtras,
          includeBonuses: simulationOptions.includeBonuses
        }, userId);
      } catch (error) {
        // Si ya existe una nómina para este período, buscarla
        if (error.message.includes('ya existe')) {
          logger.info('📋 Nómina general ya existe, buscando existente', {
            period: `${period.startDate} - ${period.endDate}`,
            traceId
          });
          
          // Buscar nómina existente por período
          const existingPayroll = await GeneralPayrollService.findByPeriod(
            period.startDate, period.endDate
          );
          
          if (existingPayroll) {
            generalPayrollData = existingPayroll;
            logger.info('✅ Usando nómina general existente', {
              generalPayrollId: existingPayroll.id,
              status: existingPayroll.status
            });
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }

      const generalPayrollId = generalPayrollData.id;

      logger.info('✅ Nómina general creada para simulación', {
        generalPayrollId,
        status: generalPayrollData.status,
        employeesCount: generalPayrollData.employees.length,
        traceId
      });

      // 5. Procesar cada empleado (ya están calculados en la creación)
      const employeeResults = [];
      const allWarnings = generalPayrollData.configWarnings || [];
      
      for (const employeeData of generalPayrollData.employees) {
        try {
          // Formatear datos para respuesta del frontend
          const employeeResult = {
            employeeId: employeeData.employeeId,
            name: employeeData.employee.name,
            position: employeeData.employee.position,
            currency: simulationOptions.currency,
            contract: {
              type: 'permanent',
              baseMonthly: employeeData.baseSalary * (period.type === 'monthly' ? 1 : 
                          period.type === 'biweekly' ? 2 : 4),
              sbc: 42222 // TODO: Obtener SBC real
            },
            components: {
              base: employeeData.baseSalary,
              overtime: employeeData.overtime,
              bonuses: employeeData.bonuses,
              gross: employeeData.grossSalary,
              deductions: {
                taxes: employeeData.taxes,
                internal: employeeData.deductions,
                total: employeeData.taxes + employeeData.deductions
              },
              net: employeeData.netSalary
            },
            breakdown: {
              overtime: employeeData.includedExtras?.filter(e => e.type === 'overtime').map(e => ({
                type: '1.5x',
                hours: e.hours || 1,
                amount: e.amount
              })) || [],
              taxes: [
                { name: 'ISR', amount: Math.round(employeeData.taxes * 0.8) },
                { name: 'IMSS', amount: Math.round(employeeData.taxes * 0.2) }
              ],
              bonuses: employeeData.includedExtras?.filter(e => e.type === 'bonus').map(e => ({
                type: e.bonusType || 'performance',
                amount: e.amount
              })) || [],
              deductionsInternal: employeeData.includedExtras?.filter(e => 
                ['deduction', 'absence', 'loan', 'damage'].includes(e.type)
              ).map(e => ({
                type: e.type,
                amount: e.amount
              })) || []
            },
            warnings: employeeData.warnings || []
          };

          employeeResults.push(employeeResult);
          
          if (employeeResult.warnings && employeeResult.warnings.length > 0) {
            allWarnings.push(...employeeResult.warnings);
          }
        } catch (error) {
          logger.warn('⚠️ Error formateando empleado', { 
            employeeId: employeeData.employeeId, error: error.message, traceId 
          });
        }
      }

      // 6. Calcular totales
      const summary = PayrollController.calculateSimulationSummary(employeeResults);

      // 7. Generar respuesta
      const simulationId = `sim_${period.startDate.replace(/-/g, '_')}_${period.endDate.replace(/-/g, '_')}`;
      const computeMs = Date.now() - startTime;

      const response = {
        success: true,
        message: 'Simulación generada',
        simulation: {
          id: simulationId,
          // INCLUIR ID REAL DE NÓMINA GENERAL para que el frontend pueda usarlo
          generalPayrollId: generalPayrollId,
          period: {
            type: period.type,
            startDate: period.startDate,
            endDate: period.endDate,
            label: period.label
          },
          options: {
            includeExtras: simulationOptions.includeExtras,
            includeBonuses: simulationOptions.includeBonuses,
            includeAbsencesAndLates: simulationOptions.includeAbsencesAndLates,
            includeTaxes: simulationOptions.includeTaxes,
            currency: simulationOptions.currency,
            roundingMode: simulationOptions.roundingMode,
            taxRulesVersion: simulationOptions.taxRulesVersion
          },
          summary: {
            ...summary,
            warnings: allWarnings
          },
          employees: employeeResults,
          generatedAt: new Date().toISOString(),
          computeMs,
          // METADATA PARA EL FLUJO COMPLETO
          payrollFlow: {
            currentStep: 'simulation',
            nextStep: 'adjustments',
            canProceedToAdjustments: true,
            generalPayrollId: generalPayrollId,
            generalPayrollStatus: 'draft'
          }
        },
        traceId
      };

      logger.info('✅ Simulación completada', { 
        traceId, 
        employeesProcessed: employeeResults.length,
        computeMs,
        summary: summary.totalEmployees 
      });

      res.json(response);

    } catch (error) {
      const computeMs = Date.now() - startTime;
      logger.error('❌ Error en simulación de nómina general', { 
        error: error.message, traceId, computeMs 
      });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Error interno del servidor durante la simulación',
        traceId,
        debug: {
          error: error.message,
          computeMs
        }
      });
    }
  }

  /**
   * Validar solicitud de simulación
   */
  static validateSimulationRequest(body) {
    const { period, scope, options } = body;
    const details = [];

    // Validar período
    if (!period) {
      details.push({ field: 'period', issue: 'required' });
    } else {
      if (!period.type || !['daily', 'weekly', 'biweekly', 'monthly'].includes(period.type)) {
        details.push({ field: 'period.type', issue: 'invalid_type' });
      }
      if (!period.startDate) {
        details.push({ field: 'period.startDate', issue: 'required' });
      }
      if (!period.endDate) {
        details.push({ field: 'period.endDate', issue: 'required' });
      }
      
      if (period.startDate && period.endDate) {
        const startDate = new Date(period.startDate);
        const endDate = new Date(period.endDate);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          details.push({ field: 'period.dates', issue: 'invalid_format' });
        } else if (startDate > endDate) {
          details.push({ field: 'period.dates', issue: 'start_after_end' });
        } else {
          const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
          if (daysDiff > 31) {
            details.push({ field: 'period.duration', issue: 'exceeds_31_days' });
          }
        }
      }
    }

    // Validar scope
    if (!scope) {
      details.push({ field: 'scope', issue: 'required' });
    } else {
      if (typeof scope.allEmployees !== 'boolean') {
        details.push({ field: 'scope.allEmployees', issue: 'must_be_boolean' });
      }
      if (!scope.allEmployees && (!scope.employeeIds || !Array.isArray(scope.employeeIds))) {
        details.push({ field: 'scope.employeeIds', issue: 'required_when_not_all' });
      }
    }

    // Validar opciones
    if (options) {
      if (options.currency && !['MXN', 'USD'].includes(options.currency)) {
        details.push({ field: 'options.currency', issue: 'unsupported_currency' });
      }
      if (options.roundingMode && !['HALF_UP', 'HALF_DOWN', 'UP', 'DOWN'].includes(options.roundingMode)) {
        details.push({ field: 'options.roundingMode', issue: 'invalid_rounding_mode' });
      }
    }

    return {
      isValid: details.length === 0,
      message: details.length > 0 ? 'Datos de entrada inválidos' : null,
      details
    };
  }

  /**
   * Obtener empleados para simulación
   */
  static async getEmployeesForSimulation(scope) {
    const { db } = require('../config/firebase');
    
    if (scope.allEmployees) {
      // Obtener todos los empleados activos
      const snapshot = await db.collection('employees')
        .where('status', '==', 'active')
        .get();
      
      const employees = [];
      snapshot.forEach(doc => {
        employees.push({ id: doc.id, ...doc.data() });
      });
      return employees;
    } else {
      // Obtener empleados específicos
      const employees = [];
      for (const employeeId of scope.employeeIds) {
        try {
          const doc = await db.collection('employees').doc(employeeId).get();
          if (doc.exists && doc.data().status === 'active') {
            employees.push({ id: doc.id, ...doc.data() });
          }
        } catch (error) {
          logger.warn('⚠️ Error obteniendo empleado específico', { employeeId, error: error.message });
        }
      }
      return employees;
    }
  }

  /**
   * Simular nómina de un empleado específico
   */
  static async simulateEmployeePayroll(employee, period, options, traceId) {
    const { db } = require('../config/firebase');
    
    try {
      // 1. Obtener configuración de nómina del empleado
      const configDoc = await db.collection('payrollConfig')
        .where('employeeId', '==', employee.id)
        .where('isActive', '==', true)
        .limit(1)
        .get();
      
      let payrollConfig = null;
      if (!configDoc.empty) {
        payrollConfig = configDoc.docs[0].data();
      }

      // 2. Obtener extras aprobados usando el servicio correcto
      let extras = [];
      if (options.includeExtras) {
        logger.info('🔍 Buscando extras aprobados para empleado', {
          employeeId: employee.id,
          traceId
        });

        // Usar el servicio correcto que ya funciona
        extras = await PayrollService.getExtrasForPeriod(
          employee.id, period.startDate, period.endDate
        );

        logger.info('📊 Extras encontrados para simulación', {
          employeeId: employee.id,
          extrasCount: extras.length,
          extrasDetails: extras.map(e => ({
            id: e.id,
            type: e.type,
            amount: e.calculatedAmount || e.amount,
            status: e.status
          })),
          traceId
        });
      }

      // 3. Calcular componentes de nómina
      const components = PayrollController.calculateEmployeeComponents(
        employee, payrollConfig, extras, period, options
      );

      // 4. Generar breakdown detallado
      const breakdown = PayrollController.generateEmployeeBreakdown(
        employee, extras, components, options
      );

      // 5. Generar warnings
      const warnings = PayrollController.generateEmployeeWarnings(
        employee, payrollConfig, components
      );

      return {
        employeeId: employee.id,
        name: `${employee.personalInfo?.firstName || ''} ${employee.personalInfo?.lastName || ''}`.trim(),
        position: employee.position?.title || 'Sin posición',
        currency: options.currency,
        contract: {
          type: employee.contract?.type || 'permanent',
          baseMonthly: employee.contract?.salary || 0,
          sbc: employee.sbc || 0
        },
        components,
        breakdown,
        warnings
      };

    } catch (error) {
      logger.error('❌ Error simulando empleado', { 
        employeeId: employee.id, error: error.message, traceId 
      });
      throw error;
    }
  }

  /**
   * Calcular componentes de nómina de un empleado
   */
  static calculateEmployeeComponents(employee, config, extras, period, options) {
    const roundingMode = options.roundingMode || 'HALF_UP';
    
    logger.info('🧮 Iniciando cálculo de componentes', {
      employeeId: employee.id,
      employeeName: `${employee.personalInfo?.firstName} ${employee.personalInfo?.lastName}`,
      extrasCount: extras.length,
      extrasTypes: extras.map(e => e.type),
      extrasAmounts: extras.map(e => ({ type: e.type, amount: e.calculatedAmount || e.amount }))
    });
    
    // 1. Salario base prorrateado
    const baseSalary = employee.contract?.salary || 0;
    const workingDaysInPeriod = PayrollController.calculateWorkingDaysInPeriod(period, employee);
    const workingDaysInMonth = 22; // Promedio días laborales por mes
    const baseAmount = PayrollController.round(
      (baseSalary / workingDaysInMonth) * workingDaysInPeriod, 
      roundingMode
    );

    logger.info('💰 Salario base calculado', {
      employeeId: employee.id,
      baseSalary,
      workingDaysInPeriod,
      workingDaysInMonth,
      baseAmount
    });

    // 2. Horas extra - USAR calculatedAmount que incluye multiplicadores
    const overtimeExtras = extras.filter(extra => extra.type === 'overtime');
    const overtimeAmount = PayrollController.round(
      overtimeExtras.reduce((sum, extra) => sum + (extra.calculatedAmount || extra.amount || 0), 0),
      roundingMode
    );

    logger.info('⏰ Horas extra calculadas', {
      employeeId: employee.id,
      overtimeExtrasCount: overtimeExtras.length,
      overtimeExtras: overtimeExtras.map(e => ({
        id: e.id,
        hours: e.hours,
        amount: e.calculatedAmount || e.amount,
        type: e.overtimeType
      })),
      overtimeAmount
    });

    // 3. Bonos
    const bonusExtras = extras.filter(extra => extra.type === 'bonus');
    const bonusesAmount = PayrollController.round(
      bonusExtras.reduce((sum, extra) => sum + (extra.calculatedAmount || extra.amount || 0), 0),
      roundingMode
    );

    logger.info('🎁 Bonos calculados', {
      employeeId: employee.id,
      bonusExtrasCount: bonusExtras.length,
      bonusExtras: bonusExtras.map(e => ({
        id: e.id,
        amount: e.calculatedAmount || e.amount,
        type: e.bonusType
      })),
      bonusesAmount
    });

    // 4. Total bruto
    const grossAmount = PayrollController.round(
      baseAmount + overtimeAmount + bonusesAmount,
      roundingMode
    );

    // 5. Deducciones fiscales - RESPETAR configuración de impuestos
    let taxDeductions = 0;
    if (options.includeTaxes) {
      taxDeductions = PayrollController.calculateTaxDeductions(
        grossAmount, employee, config, options
      );
      logger.info('💸 Impuestos calculados', {
        employeeId: employee.id,
        grossAmount,
        taxDeductions,
        includeTaxes: options.includeTaxes
      });
    } else {
      logger.info('🚫 Impuestos deshabilitados', {
        employeeId: employee.id,
        includeTaxes: options.includeTaxes
      });
    }

    // 6. Deducciones internas - USAR calculatedAmount
    const internalDeductions = PayrollController.round(
      extras
        .filter(extra => extra.type === 'deduction' || extra.type === 'absence' || extra.type === 'loan' || extra.type === 'damage')
        .reduce((sum, extra) => sum + (extra.calculatedAmount || extra.amount || 0), 0),
      roundingMode
    );

    // 7. Total deducciones
    const totalDeductions = PayrollController.round(
      taxDeductions + internalDeductions,
      roundingMode
    );

    // 8. Neto a pagar
    const netAmount = PayrollController.round(
      grossAmount - totalDeductions,
      roundingMode
    );

    return {
      base: baseAmount,
      overtime: overtimeAmount,
      bonuses: bonusesAmount,
      gross: grossAmount,
      deductions: {
        taxes: taxDeductions,
        internal: internalDeductions,
        total: totalDeductions
      },
      net: netAmount
    };
  }

  /**
   * Calcular días laborales en el período
   */
  static calculateWorkingDaysInPeriod(period, employee) {
    const startDate = new Date(period.startDate);
    const endDate = new Date(period.endDate);
    let workingDays = 0;

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay(); // 0 = domingo, 6 = sábado
      
      // Verificar si el empleado trabaja este día según su horario personalizado
      if (employee.contract?.customSchedule?.enabled) {
        const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        const dayName = dayNames[dayOfWeek];
        const daySchedule = employee.contract.customSchedule.days[dayName];
        
        if (daySchedule && daySchedule.enabled) {
          workingDays++;
        }
      } else {
        // Horario por defecto: lunes a viernes
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          workingDays++;
        }
      }
    }

    return workingDays;
  }

  /**
   * Calcular deducciones fiscales
   */
  static calculateTaxDeductions(grossAmount, employee, config, options) {
    // Implementación simplificada - en producción usar tablas de ISR/IMSS reales
    const sbc = employee.sbc || grossAmount;
    
    // ISR simplificado (tabla progresiva)
    let isr = 0;
    if (grossAmount > 0) {
      if (grossAmount <= 10000) {
        isr = grossAmount * 0.0192;
      } else if (grossAmount <= 20000) {
        isr = 192 + (grossAmount - 10000) * 0.064;
      } else if (grossAmount <= 30000) {
        isr = 832 + (grossAmount - 20000) * 0.1088;
      } else {
        isr = 1920 + (grossAmount - 30000) * 0.16;
      }
    }

    // IMSS simplificado
    const imss = sbc * 0.03625; // Cuota obrera IMSS

    return PayrollController.round(isr + imss, options.roundingMode || 'HALF_UP');
  }

  /**
   * Generar breakdown detallado del empleado
   */
  static generateEmployeeBreakdown(employee, extras, components, options) {
    const overtimeBreakdown = extras
      .filter(extra => extra.type === 'overtime')
      .map(extra => ({
        type: extra.rate || '1.5x',
        hours: extra.hours || 0,
        amount: PayrollController.round(extra.amount || 0, options.roundingMode)
      }));

    const taxesBreakdown = [
      { name: 'ISR', amount: PayrollController.round(components.deductions.taxes * 0.8, options.roundingMode) },
      { name: 'IMSS', amount: PayrollController.round(components.deductions.taxes * 0.2, options.roundingMode) }
    ];

    const bonusesBreakdown = extras
      .filter(extra => extra.type === 'bonus')
      .map(extra => ({
        name: extra.concept || 'Bono',
        amount: PayrollController.round(extra.amount || 0, options.roundingMode)
      }));

    const deductionsInternalBreakdown = extras
      .filter(extra => extra.type === 'deduction')
      .map(extra => ({
        name: extra.concept || 'Deducción',
        amount: PayrollController.round(extra.amount || 0, options.roundingMode)
      }));

    return {
      overtime: overtimeBreakdown,
      taxes: taxesBreakdown,
      bonuses: bonusesBreakdown,
      deductionsInternal: deductionsInternalBreakdown
    };
  }

  /**
   * Generar warnings para un empleado
   */
  static generateEmployeeWarnings(employee, config, components) {
    const warnings = [];

    if (!config) {
      warnings.push('Empleado sin configuración de nómina; usando valores por defecto');
    }

    if (!employee.personalInfo?.rfc) {
      warnings.push('Empleado sin RFC; puede afectar cálculos fiscales');
    }

    if (!employee.personalInfo?.curp) {
      warnings.push('Empleado sin CURP; puede afectar cálculos fiscales');
    }

    if (!employee.sbc || employee.sbc === 0) {
      warnings.push('Empleado sin SBC definido; usando salario base como SBC');
    }

    if (components.net < 0) {
      warnings.push('Nómina neta negativa; revisar deducciones');
    }

    return warnings;
  }

  /**
   * Calcular resumen de la simulación
   */
  static calculateSimulationSummary(employeeResults) {
    const validResults = employeeResults.filter(result => !result.error);
    
    const totals = validResults.reduce((sum, result) => ({
      grossTotal: sum.grossTotal + result.components.gross,
      netTotal: sum.netTotal + result.components.net,
      deductionsTotal: sum.deductionsTotal + result.components.deductions.total,
      taxesTotal: sum.taxesTotal + result.components.deductions.taxes,
      overtimeTotal: sum.overtimeTotal + result.components.overtime,
      bonusesTotal: sum.bonusesTotal + result.components.bonuses
    }), {
      grossTotal: 0,
      netTotal: 0,
      deductionsTotal: 0,
      taxesTotal: 0,
      overtimeTotal: 0,
      bonusesTotal: 0
    });

    return {
      totalEmployees: validResults.length,
      grossTotal: PayrollController.round(totals.grossTotal, 'HALF_UP'),
      netTotal: PayrollController.round(totals.netTotal, 'HALF_UP'),
      deductionsTotal: PayrollController.round(totals.deductionsTotal, 'HALF_UP'),
      taxesTotal: PayrollController.round(totals.taxesTotal, 'HALF_UP'),
      avgSalary: validResults.length > 0 ? 
        PayrollController.round(totals.grossTotal / validResults.length, 'HALF_UP') : 0,
      overtimeTotal: PayrollController.round(totals.overtimeTotal, 'HALF_UP'),
      bonusesTotal: PayrollController.round(totals.bonusesTotal, 'HALF_UP')
    };
  }

  /**
   * Función de redondeo
   */
  static round(value, mode = 'HALF_UP') {
    const factor = Math.pow(10, 2);
    
    switch (mode) {
      case 'HALF_UP':
        return Math.round(value * factor) / factor;
      case 'HALF_DOWN':
        return Math.floor(value * factor + 0.499999) / factor;
      case 'UP':
        return Math.ceil(value * factor) / factor;
      case 'DOWN':
        return Math.floor(value * factor) / factor;
      default:
        return Math.round(value * factor) / factor;
    }
  }


  /**
   * Subir archivo adjunto a nómina
   * POST /api/payroll/:payrollId/attachments
   */
  static async uploadAttachment(req, res) {
    try {
      const { payrollId } = req.params;
      const { employeeId, category, description } = req.body;
      const uploadedBy = req.user.userId;

      logger.info('📎 Subiendo archivo adjunto', { payrollId, employeeId });

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No se proporcionó archivo'
        });
      }

      // Verificar que la nómina existe
      const payroll = await Payroll.findById(payrollId);
      if (!payroll) {
        return res.status(404).json({
          success: false,
          error: 'Nómina no encontrada'
        });
      }

      // Subir archivo
      const attachment = await AttachmentService.uploadAttachment(
        payrollId,
        employeeId,
        req.file,
        uploadedBy,
        { category, description }
      );

      res.json({
        success: true,
        message: 'Archivo subido exitosamente',
        data: attachment
      });

    } catch (error) {
      logger.error('❌ Error subiendo archivo adjunto', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor subiendo archivo'
      });
    }
  }

  /**
   * Obtener archivos adjuntos de nómina
   * GET /api/payroll/:payrollId/attachments
   */
  static async getAttachments(req, res) {
    try {
      const { payrollId } = req.params;

      logger.info('📎 Obteniendo archivos adjuntos', { payrollId });

      const attachments = await AttachmentService.getAttachmentsByPayroll(payrollId);

      res.json({
        success: true,
        data: attachments
      });

    } catch (error) {
      logger.error('❌ Error obteniendo archivos adjuntos', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor obteniendo archivos adjuntos'
      });
    }
  }

  /**
   * Eliminar archivo adjunto
   * DELETE /api/payroll/:payrollId/attachments/:attachmentId
   */
  static async deleteAttachment(req, res) {
    try {
      const { payrollId, attachmentId } = req.params;

      logger.info('🗑️ Eliminando archivo adjunto', { payrollId, attachmentId });

      await AttachmentService.deleteAttachment(attachmentId, payrollId);

      res.json({
        success: true,
        message: 'Archivo eliminado exitosamente'
      });

    } catch (error) {
      logger.error('❌ Error eliminando archivo adjunto', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor eliminando archivo'
      });
    }
  }

  /**
   * Editar configuración de nómina
   * PUT /api/payroll/:payrollId
   */
  static async editPayroll(req, res) {
    try {
      const { payrollId } = req.params;
      const updates = req.body;

      logger.info('✏️ Editando configuración de nómina', { payrollId, updates });

      // Verificar que la nómina existe
      const payroll = await Payroll.findById(payrollId);
      if (!payroll) {
        return res.status(404).json({
          success: false,
          error: 'Nómina no encontrada'
        });
      }

      // Actualizar campos permitidos
      const allowedUpdates = [
        'frequency', 'baseSalary', 'sbc', 'workingDaysPerWeek', 
        'workingHoursPerDay', 'overtimeRate', 'paymentMethod', 'notes'
      ];

      const updateData = {};
      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          updateData[field] = updates[field];
        }
      });

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No hay campos válidos para actualizar'
        });
      }

      // Actualizar en base de datos
      const { db } = require('../config/firebase');
      const docRef = db.collection('payroll').doc(payrollId);
      await docRef.update({
        ...updateData,
        updatedAt: new Date().toISOString()
      });

      // Recalcular si se cambió salario o configuración
      if (updates.baseSalary || updates.frequency) {
        const config = await PayrollConfig.findActiveByEmployee(payroll.employeeId);
        if (config) {
          const calculatedSalary = config.calculateSalaryForPeriod();
          const grossSalary = calculatedSalary + (payroll.totalPerceptions || 0);
          const netSalary = grossSalary - (payroll.totalDeductions || 0);

          await docRef.update({
            calculatedSalary,
            grossSalary,
            netSalary,
            recalculatedAt: new Date().toISOString()
          });
        }
      }

      res.json({
        success: true,
        message: 'Configuración de nómina actualizada',
        data: {
          id: payrollId,
          config: updateData,
          updatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('❌ Error editando configuración de nómina', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor editando configuración'
      });
    }
  }

  /**
   * Regenerar nómina con recálculos
   * POST /api/payroll/:payrollId/regenerate
   */
  static async regeneratePayroll(req, res) {
    try {
      const { payrollId } = req.params;
      const { recalculateExtras = true } = req.body;

      logger.info('🔄 Regenerando nómina', { payrollId, recalculateExtras });

      // Verificar que la nómina existe
      const payroll = await Payroll.findById(payrollId);
      if (!payroll) {
        return res.status(404).json({
          success: false,
          error: 'Nómina no encontrada'
        });
      }

      // Eliminar nómina actual y regenerar
      await PayrollService.deletePayroll(payrollId);
      
      if (recalculateExtras) {
        await PayrollService.resetExtrasForPayroll(payrollId);
      }

      // Regenerar con configuración actual
      const newPayroll = await PayrollService.generatePayroll(
        payroll.employeeId,
        payroll.periodStart,
        payroll.periodEnd
      );

      // Obtener detalles completos
      const result = await PayrollService.getPayrollDetails(newPayroll.id);

      res.json({
        success: true,
        message: 'Nómina regenerada exitosamente',
        data: {
          id: newPayroll.id,
          periodStart: newPayroll.periodStart,
          periodEnd: newPayroll.periodEnd,
          grossSalary: newPayroll.grossSalary,
          totalDeductions: newPayroll.totalDeductions,
          netSalary: newPayroll.netSalary,
          status: newPayroll.status,
          regeneratedAt: new Date().toISOString(),
          details: result ? result.details : null
        }
      });

    } catch (error) {
      logger.error('❌ Error regenerando nómina', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error interno del servidor regenerando nómina'
      });
    }
  }
}

module.exports = PayrollController;