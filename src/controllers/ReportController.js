/**
 * 📊 CONTROLADOR DE REPORTES IA
 * 
 * Maneja endpoints para reportes de IA con ingesta de datos agregados
 * y generación opcional de resúmenes con IA.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
const ReportService = require('../services/ReportService');
const { isAIEnabled } = require('../config/aiConfig');
const logger = require('../utils/logger');

class ReportController {
  constructor() {
    this.reportService = new ReportService();
  }

  /**
   * POST /api/ai/reports/ingest
   * Ingestar datos agregados y crear reporte
   */
  static async ingestReport(req, res, next) {
    try {
      const {
        workspaceId,
        periodo,
        datos,
        generate_summary = false,
        tipo = 'weekly',
        metadata = {}
      } = req.body;

      // Verificar permisos (solo admin/QA pueden ingestar reportes)
      if (!['admin', 'qa'].includes(req.user.role)) {
        throw CommonErrors.USER_NOT_AUTHORIZED('ingestar reportes de IA');
      }

      // Validar parámetros requeridos
      if (!workspaceId || !periodo || !datos) {
        throw new ApiError(
          'MISSING_PARAMETERS',
          'Parámetros faltantes',
          'workspaceId, periodo y datos son requeridos',
          400
        );
      }

      // Verificar si IA está habilitada para el workspace
      const aiEnabled = await isAIEnabled(workspaceId);
      if (!aiEnabled) {
        throw new ApiError(
          'AI_DISABLED',
          'IA deshabilitada para este workspace',
          'Habilita IA en la configuración del workspace',
          400
        );
      }

      // Crear reporte
      const result = await new ReportService().createReport(workspaceId, {
        periodo,
        datos
      }, {
        generate_summary,
        tipo,
        metadata: {
          ...metadata,
          userEmail: req.user.email,
          source: 'api_ingest'
        }
      });

      if (!result.success) {
        throw new ApiError(
          'REPORT_CREATION_FAILED',
          'Error creando reporte',
          result.error,
          500
        );
      }

      logger.info('✅ Reporte ingerido exitosamente', {
        reportId: result.report.id,
        workspaceId,
        userEmail: req.user.email,
        generate_summary,
        hasSummary: result.metrics.hasSummary
      });

      return ResponseHandler.success(res, {
        reportId: result.report.id,
        report: result.report.getPreview(),
        metrics: result.metrics
      }, 'Reporte creado exitosamente');

    } catch (error) {
      logger.error('❌ Error ingiriendo reporte', {
        workspaceId: req.body?.workspaceId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * GET /api/ai/reports/:workspaceId
   * Obtener reportes por workspace
   */
  static async getReports(req, res, next) {
    try {
      const { workspaceId } = req.params;
      const { limit = 20, offset = 0, tipo, fromDate, toDate } = req.query;

      // Verificar permisos (solo admin/QA pueden ver reportes)
      if (!['admin', 'qa'].includes(req.user.role)) {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver reportes de IA');
      }

      // Validar workspaceId
      if (!workspaceId) {
        throw new ApiError(
          'MISSING_WORKSPACE_ID',
          'workspaceId es requerido',
          'Proporciona el ID del workspace',
          400
        );
      }

      // Obtener reportes
      const result = await new ReportService().getReportsByWorkspace(workspaceId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        tipo,
        fromDate,
        toDate
      });

      if (!result.success) {
        throw new ApiError(
          'REPORTS_FETCH_FAILED',
          'Error obteniendo reportes',
          result.error,
          500
        );
      }

      logger.info('✅ Reportes obtenidos exitosamente', {
        workspaceId,
        userEmail: req.user.email,
        count: result.total
      });

      return ResponseHandler.success(res, {
        reports: result.reports,
        total: result.total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }, 'Reportes obtenidos exitosamente');

    } catch (error) {
      logger.error('❌ Error obteniendo reportes', {
        workspaceId: req.params?.workspaceId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * GET /api/ai/reports/:workspaceId/:reportId
   * Obtener reporte específico
   */
  static async getReport(req, res, next) {
    try {
      const { workspaceId, reportId } = req.params;

      // Verificar permisos (solo admin/QA pueden ver reportes)
      if (!['admin', 'qa'].includes(req.user.role)) {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver reportes de IA');
      }

      // Validar parámetros
      if (!workspaceId || !reportId) {
        throw new ApiError(
          'MISSING_PARAMETERS',
          'Parámetros faltantes',
          'workspaceId y reportId son requeridos',
          400
        );
      }

      // Obtener reporte
      const result = await new ReportService().getReportById(reportId);

      if (!result.success) {
        throw new ApiError(
          'REPORT_NOT_FOUND',
          'Reporte no encontrado',
          result.error,
          404
        );
      }

      // Verificar que el reporte pertenece al workspace
      if (result.report.workspaceId !== workspaceId) {
        throw new ApiError(
          'REPORT_WORKSPACE_MISMATCH',
          'El reporte no pertenece al workspace especificado',
          'Verifica el workspaceId',
          403
        );
      }

      logger.info('✅ Reporte obtenido exitosamente', {
        reportId,
        workspaceId,
        userEmail: req.user.email
      });

      return ResponseHandler.success(res, result.report, 'Reporte obtenido exitosamente');

    } catch (error) {
      logger.error('❌ Error obteniendo reporte', {
        reportId: req.params?.reportId,
        workspaceId: req.params?.workspaceId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * POST /api/ai/reports/search
   * Buscar reportes con filtros
   */
  static async searchReports(req, res, next) {
    try {
      const {
        workspaceId,
        tipo,
        fromDate,
        toDate,
        hasAlerts,
        limit = 50,
        offset = 0
      } = req.body;

      // Verificar permisos (solo admin/QA pueden buscar reportes)
      if (!['admin', 'qa'].includes(req.user.role)) {
        throw CommonErrors.USER_NOT_AUTHORIZED('buscar reportes de IA');
      }

      // Validar workspaceId
      if (!workspaceId) {
        throw new ApiError(
          'MISSING_WORKSPACE_ID',
          'workspaceId es requerido',
          'Proporciona el ID del workspace',
          400
        );
      }

      // Buscar reportes
      const result = await new ReportService().searchReports({
        workspaceId,
        tipo,
        fromDate,
        toDate,
        hasAlerts: hasAlerts === null ? null : Boolean(hasAlerts),
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      if (!result.success) {
        throw new ApiError(
          'REPORTS_SEARCH_FAILED',
          'Error buscando reportes',
          result.error,
          500
        );
      }

      logger.info('✅ Búsqueda de reportes completada', {
        workspaceId,
        userEmail: req.user.email,
        count: result.total,
        filters: result.filters
      });

      return ResponseHandler.success(res, {
        reports: result.reports,
        total: result.total,
        filters: result.filters
      }, 'Búsqueda completada exitosamente');

    } catch (error) {
      logger.error('❌ Error buscando reportes', {
        workspaceId: req.body?.workspaceId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * GET /api/ai/reports/:workspaceId/stats
   * Obtener estadísticas de reportes
   */
  static async getReportStats(req, res, next) {
    try {
      const { workspaceId } = req.params;
      const { days = 30 } = req.query;

      // Verificar permisos (solo admin/QA pueden ver estadísticas)
      if (!['admin', 'qa'].includes(req.user.role)) {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver estadísticas de reportes');
      }

      // Validar workspaceId
      if (!workspaceId) {
        throw new ApiError(
          'MISSING_WORKSPACE_ID',
          'workspaceId es requerido',
          'Proporciona el ID del workspace',
          400
        );
      }

      // Obtener estadísticas
      const result = await new ReportService().getReportStats(workspaceId, parseInt(days));

      if (!result.success) {
        throw new ApiError(
          'STATS_FETCH_FAILED',
          'Error obteniendo estadísticas',
          result.error,
          500
        );
      }

      logger.info('✅ Estadísticas de reportes obtenidas', {
        workspaceId,
        userEmail: req.user.email,
        days: parseInt(days)
      });

      return ResponseHandler.success(res, {
        stats: result.stats,
        workspaceId,
        days: parseInt(days)
      }, 'Estadísticas obtenidas exitosamente');

    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas de reportes', {
        workspaceId: req.params?.workspaceId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * DELETE /api/ai/reports/:reportId
   * Eliminar reporte
   */
  static async deleteReport(req, res, next) {
    try {
      const { reportId } = req.params;

      // Verificar permisos (solo admin puede eliminar reportes)
      if (req.user.role !== 'admin') {
        throw CommonErrors.USER_NOT_AUTHORIZED('eliminar reportes de IA');
      }

      // Validar reportId
      if (!reportId) {
        throw new ApiError(
          'MISSING_REPORT_ID',
          'reportId es requerido',
          'Proporciona el ID del reporte',
          400
        );
      }

      // Eliminar reporte
      const result = await new ReportService().deleteReport(reportId);

      if (!result.success) {
        throw new ApiError(
          'REPORT_DELETE_FAILED',
          'Error eliminando reporte',
          result.error,
          500
        );
      }

      logger.info('✅ Reporte eliminado exitosamente', {
        reportId,
        userEmail: req.user.email
      });

      return ResponseHandler.success(res, {
        reportId: result.reportId
      }, 'Reporte eliminado exitosamente');

    } catch (error) {
      logger.error('❌ Error eliminando reporte', {
        reportId: req.params?.reportId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * POST /api/ai/reports/check-exists
   * Verificar si existe reporte para un periodo
   */
  static async checkReportExists(req, res, next) {
    try {
      const { workspaceId, periodo, tipo = 'weekly' } = req.body;

      // Verificar permisos (solo admin/QA pueden verificar existencia)
      if (!['admin', 'qa'].includes(req.user.role)) {
        throw CommonErrors.USER_NOT_AUTHORIZED('verificar existencia de reportes');
      }

      // Validar parámetros
      if (!workspaceId || !periodo) {
        throw new ApiError(
          'MISSING_PARAMETERS',
          'Parámetros faltantes',
          'workspaceId y periodo son requeridos',
          400
        );
      }

      // Verificar existencia
      const result = await new ReportService().reportExists(workspaceId, periodo, tipo);

      if (!result.success) {
        throw new ApiError(
          'EXISTS_CHECK_FAILED',
          'Error verificando existencia',
          result.error,
          500
        );
      }

      logger.info('✅ Verificación de existencia completada', {
        workspaceId,
        periodo,
        tipo,
        exists: result.exists,
        userEmail: req.user.email
      });

      return ResponseHandler.success(res, {
        exists: result.exists,
        workspaceId,
        periodo,
        tipo
      }, 'Verificación completada exitosamente');

    } catch (error) {
      logger.error('❌ Error verificando existencia de reporte', {
        workspaceId: req.body?.workspaceId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }
}

module.exports = ReportController; 