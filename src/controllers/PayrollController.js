const PayrollService = require('../services/PayrollService');
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
      const result = await PayrollService.getPayrollDetails(payrollId);
      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Período de nómina no encontrado'
        });
      }

      // Obtener información del empleado
      const employee = await Employee.findById(result.payroll.employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Empleado no encontrado'
        });
      }

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
      const PDFService = require('../services/PDFService');
      const pdfResult = await PDFService.generatePayrollReceipt(
        payrollData,
        employee,
        companyData
      );

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
      const docRef = db.collection('payrolls').doc(payrollId);
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