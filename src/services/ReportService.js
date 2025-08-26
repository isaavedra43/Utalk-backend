/**
 * 📊 SERVICIO DE REPORTES IA
 * 
 * Maneja la lógica de negocio para reportes de IA incluyendo
 * generación opcional de resúmenes con IA.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { Report, REPORT_TYPES, ALERT_TYPES } = require('../models/Report');
const ReportsRepository = require('../repositories/ReportsRepository');
const { generateWithProvider } = require('../ai/vendors');
const { getAIConfig, isAIEnabled } = require('../config/aiConfig');
const logger = require('../utils/logger');
const { aiLogger } = require('../utils/aiLogger');

class ReportService {
  constructor() {
    this.reportsRepo = new ReportsRepository();
  }

  /**
   * Crear reporte con datos agregados
   */
  async createReport(workspaceId, reportData, options = {}) {
    const startTime = Date.now();
    
    try {
      const {
        generate_summary = false,
        tipo = REPORT_TYPES.WEEKLY,
        metadata = {}
      } = options;

      // Verificar si IA está habilitada para el workspace
      const aiEnabled = await isAIEnabled(workspaceId);
      
      // Crear instancia del reporte
      const report = new Report({
        workspaceId,
        tipo,
        periodo: reportData.periodo,
        datos: reportData.datos,
        metadata: {
          ...metadata,
          generatedBy: 'system',
          aiEnabled: aiEnabled
        }
      });

      // Calcular KPIs y alertas
      report.calculateKPIs();
      report.determineAlerts();

      // Generar resumen con IA si está habilitado y solicitado
      if (generate_summary && aiEnabled) {
        try {
          const summary = await this.generateReportSummary(report);
          report.resumen_corto = summary;
          
          logger.info('✅ Resumen IA generado para reporte', {
            reportId: report.id,
            workspaceId,
            summaryLength: summary.length
          });
        } catch (summaryError) {
          logger.warn('⚠️ Error generando resumen IA, continuando sin resumen', {
            reportId: report.id,
            workspaceId,
            error: summaryError.message
          });
          // Continuar sin resumen
        }
      }

      // Guardar reporte
      const savedReport = await this.reportsRepo.saveReport(report);

      const latencyMs = Date.now() - startTime;
      
      logger.info('✅ Reporte creado exitosamente', {
        reportId: report.id,
        workspaceId,
        tipo,
        generate_summary,
        latencyMs,
        hasSummary: !!report.resumen_corto
      });

      return {
        success: true,
        report: savedReport,
        metrics: {
          latencyMs,
          hasSummary: !!report.resumen_corto,
          alertsCount: report.alertas.length
        }
      };

    } catch (error) {
      const latencyMs = Date.now() - startTime;
      
      logger.error('❌ Error creando reporte', {
        workspaceId,
        error: error.message,
        latencyMs
      });

      return {
        success: false,
        error: error.message,
        metrics: { latencyMs }
      };
    }
  }

  /**
   * Generar resumen corto del reporte con IA
   */
  async generateReportSummary(report) {
    try {
      // Verificar configuración IA
      const config = await getAIConfig(report.workspaceId);
      
      if (!config.flags.reports) {
        throw new Error('Generación de reportes no habilitada');
      }

      // Preparar datos para el prompt
      const summaryData = {
        periodo: report.periodo,
        mensajes_totales: report.datos.mensajes_totales,
        tiempo_medio_respuesta_s: report.datos.tiempo_medio_respuesta_s,
        fcr: report.datos.fcr,
        top_intencion: report.kpis.top_intencion,
        alertas: report.alertas,
        sla_ok: report.kpis.sla_ok
      };

      // Crear prompt dinámico para resumen
      const summaryPrompt = `
Genera un resumen ejecutivo corto (máximo 200 caracteres) del siguiente reporte de atención al cliente.

Datos del periodo ${summaryData.periodo.from} a ${summaryData.periodo.to}:
- Mensajes totales: ${summaryData.mensajes_totales}
- Tiempo medio de respuesta: ${summaryData.tiempo_medio_respuesta_s}s
- FCR (First Contact Resolution): ${(summaryData.fcr * 100).toFixed(1)}%
- Intención principal: ${summaryData.top_intencion}
- SLA cumplido: ${summaryData.sla_ok ? 'Sí' : 'No'}
- Alertas: ${summaryData.alertas.length > 0 ? summaryData.alertas.join(', ') : 'Ninguna'}

Genera un resumen ejecutivo dinámico basado en estos datos reales. Responde SOLO con el resumen, sin formato adicional.
`;

      // Log de inicio
      aiLogger.logAIStart(report.workspaceId, 'generate_report_summary', {
        reportId: report.id,
        config: {
          model: config.defaultModel,
          temperature: 0.3,
          maxTokens: 100
        }
      });

      // Generar resumen con IA
      const response = await generateWithProvider(config.provider, {
        model: config.defaultModel,
        messages: [
          {
            role: 'system',
            content: 'Eres un analista de datos experto en generar resúmenes ejecutivos concisos y profesionales.'
          },
          {
            role: 'user',
            content: summaryPrompt
          }
        ],
        temperature: 0.3,
        maxTokens: 100,
        workspaceId: report.workspaceId
      });

      // Sanitizar y validar respuesta
      let summary = response.text.trim();
      
      // Remover comillas si las hay
      summary = summary.replace(/^["']|["']$/g, '');
      
      // Limitar a 200 caracteres
      if (summary.length > 200) {
        summary = summary.substring(0, 197) + '...';
      }

      // Log de éxito
      const metrics = {
        model: config.defaultModel,
        tokensIn: response.usage?.prompt_tokens || 0,
        tokensOut: response.usage?.completion_tokens || 0,
        latencyMs: response.latencyMs || 0
      };

      await aiLogger.logAISuccess(report.workspaceId, 'generate_report_summary', {
        reportId: report.id,
        summary: summary
      }, metrics);

      return summary;

    } catch (error) {
      // Log de error
      aiLogger.logAIError(report.workspaceId, 'generate_report_summary', error, {
        reportId: report.id
      });

      logger.error('❌ Error generando resumen IA', {
        reportId: report.id,
        workspaceId: report.workspaceId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Obtener reportes por workspace
   */
  async getReportsByWorkspace(workspaceId, options = {}) {
    try {
      const reports = await this.reportsRepo.getReportsByWorkspace(workspaceId, options);
      
      return {
        success: true,
        reports: reports.map(report => report.getPreview()),
        total: reports.length
      };
    } catch (error) {
      logger.error('❌ Error obteniendo reportes por workspace', {
        workspaceId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener reporte por ID
   */
  async getReportById(reportId) {
    try {
      const report = await this.reportsRepo.getReportById(reportId);
      
      if (!report) {
        return {
          success: false,
          error: 'Reporte no encontrado'
        };
      }

      return {
        success: true,
        report: report.toFirestore()
      };
    } catch (error) {
      logger.error('❌ Error obteniendo reporte por ID', {
        reportId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Buscar reportes con filtros
   */
  async searchReports(filters = {}) {
    try {
      const reports = await this.reportsRepo.searchReports(filters);
      
      return {
        success: true,
        reports: reports.map(report => report.getPreview()),
        total: reports.length,
        filters
      };
    } catch (error) {
      logger.error('❌ Error buscando reportes', {
        filters,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener estadísticas de reportes
   */
  async getReportStats(workspaceId, days = 30) {
    try {
      const stats = await this.reportsRepo.getReportStats(workspaceId, days);
      
      return {
        success: true,
        stats,
        workspaceId,
        days
      };
    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas de reportes', {
        workspaceId,
        days,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Eliminar reporte
   */
  async deleteReport(reportId) {
    try {
      await this.reportsRepo.deleteReport(reportId);
      
      return {
        success: true,
        reportId
      };
    } catch (error) {
      logger.error('❌ Error eliminando reporte', {
        reportId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verificar si existe reporte para un periodo
   */
  async reportExists(workspaceId, periodo, tipo) {
    try {
      const exists = await this.reportsRepo.reportExists(workspaceId, periodo, tipo);
      
      return {
        success: true,
        exists,
        workspaceId,
        periodo,
        tipo
      };
    } catch (error) {
      logger.error('❌ Error verificando existencia de reporte', {
        workspaceId,
        periodo,
        tipo,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ReportService; 