/**
 * 📊 REPOSITORIO DE REPORTES IA
 * 
 * Maneja operaciones CRUD para reportes de IA en Firestore
 * con índices optimizados y validaciones.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { firestore } = require('../config/firebase');
const { Report } = require('../models/Report');
const logger = require('../utils/logger');

class ReportsRepository {
  constructor() {
    this.collection = 'ai_reports';
  }

  /**
   * Guardar reporte en Firestore
   */
  async saveReport(report) {
    try {
      const reportData = report.toFirestore();
      
      await firestore
        .collection(this.collection)
        .doc(report.id)
        .set(reportData);

      logger.info('✅ Reporte guardado exitosamente', {
        reportId: report.id,
        workspaceId: report.workspaceId,
        tipo: report.tipo
      });

      return report;
    } catch (error) {
      logger.error('❌ Error guardando reporte', {
        reportId: report.id,
        workspaceId: report.workspaceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtener reporte por ID
   */
  async getReportById(reportId) {
    try {
      const doc = await firestore
        .collection(this.collection)
        .doc(reportId)
        .get();

      if (!doc.exists) {
        return null;
      }

      const reportData = doc.data();
      return Report.fromFirestore(reportData);
    } catch (error) {
      logger.error('❌ Error obteniendo reporte por ID', {
        reportId,
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
      const {
        limit = 20,
        offset = 0,
        tipo = null,
        fromDate = null,
        toDate = null
      } = options;

      let query = firestore
        .collection(this.collection)
        .where('workspaceId', '==', workspaceId);

      // Filtrar por tipo si se especifica
      if (tipo) {
        query = query.where('tipo', '==', tipo);
      }

      // Filtrar por fecha si se especifica
      if (fromDate) {
        query = query.where('periodo.to', '>=', fromDate);
      }

      if (toDate) {
        query = query.where('periodo.to', '<=', toDate);
      }

      // Ordenar por fecha de creación descendente
      query = query.orderBy('createdAt', 'desc');

      // Aplicar límites
      if (offset > 0) {
        query = query.offset(offset);
      }

      query = query.limit(limit);

      const snapshot = await query.get();

      const reports = [];
      snapshot.forEach(doc => {
        const reportData = doc.data();
        reports.push(Report.fromFirestore(reportData));
      });

      logger.info('✅ Reportes obtenidos por workspace', {
        workspaceId,
        count: reports.length,
        limit,
        offset
      });

      return reports;
    } catch (error) {
      logger.error('❌ Error obteniendo reportes por workspace', {
        workspaceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtener reporte más reciente por workspace
   */
  async getLatestReportByWorkspace(workspaceId, tipo = null) {
    try {
      let query = firestore
        .collection(this.collection)
        .where('workspaceId', '==', workspaceId);

      if (tipo) {
        query = query.where('tipo', '==', tipo);
      }

      query = query.orderBy('createdAt', 'desc').limit(1);

      const snapshot = await query.get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const reportData = doc.data();
      return Report.fromFirestore(reportData);
    } catch (error) {
      logger.error('❌ Error obteniendo reporte más reciente', {
        workspaceId,
        tipo,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Buscar reportes con filtros avanzados
   */
  async searchReports(filters = {}) {
    try {
      const {
        workspaceId,
        tipo,
        fromDate,
        toDate,
        hasAlerts = null,
        limit = 50,
        offset = 0
      } = filters;

      let query = firestore.collection(this.collection);

      // Aplicar filtros
      if (workspaceId) {
        query = query.where('workspaceId', '==', workspaceId);
      }

      if (tipo) {
        query = query.where('tipo', '==', tipo);
      }

      if (fromDate) {
        query = query.where('periodo.to', '>=', fromDate);
      }

      if (toDate) {
        query = query.where('periodo.to', '<=', toDate);
      }

      // Ordenar por fecha
      query = query.orderBy('createdAt', 'desc');

      // Aplicar límites
      if (offset > 0) {
        query = query.offset(offset);
      }

      query = query.limit(limit);

      const snapshot = await query.get();

      let reports = [];
      snapshot.forEach(doc => {
        const reportData = doc.data();
        const report = Report.fromFirestore(reportData);
        
        // Filtrar por alertas si se especifica
        if (hasAlerts !== null) {
          const hasAnyAlerts = report.alertas.length > 0;
          if (hasAnyAlerts === hasAlerts) {
            reports.push(report);
          }
        } else {
          reports.push(report);
        }
      });

      logger.info('✅ Búsqueda de reportes completada', {
        filters,
        count: reports.length,
        limit,
        offset
      });

      return reports;
    } catch (error) {
      logger.error('❌ Error buscando reportes', {
        filters,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtener estadísticas de reportes por workspace
   */
  async getReportStats(workspaceId, days = 30) {
    try {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const reports = await this.getReportsByWorkspace(workspaceId, {
        fromDate: fromDate.toISOString().split('T')[0],
        limit: 100
      });

      const stats = {
        totalReports: reports.length,
        byType: {},
        averageKPIs: {
          fcr: 0,
          tma_seg: 0,
          sla_ok_rate: 0
        },
        alertsCount: 0,
        reportsWithAlerts: 0
      };

      let totalFCR = 0;
      let totalTMA = 0;
      let totalSLAOK = 0;
      let validReports = 0;

      reports.forEach(report => {
        // Contar por tipo
        stats.byType[report.tipo] = (stats.byType[report.tipo] || 0) + 1;

        // Contar alertas
        stats.alertsCount += report.alertas.length;
        if (report.alertas.length > 0) {
          stats.reportsWithAlerts++;
        }

        // Calcular promedios de KPIs
        if (report.kpis.fcr !== undefined) {
          totalFCR += report.kpis.fcr;
          validReports++;
        }

        if (report.kpis.tma_seg !== undefined) {
          totalTMA += report.kpis.tma_seg;
        }

        if (report.kpis.sla_ok !== undefined) {
          totalSLAOK += report.kpis.sla_ok ? 1 : 0;
        }
      });

      // Calcular promedios
      if (validReports > 0) {
        stats.averageKPIs.fcr = totalFCR / validReports;
        stats.averageKPIs.tma_seg = totalTMA / validReports;
        stats.averageKPIs.sla_ok_rate = totalSLAOK / validReports;
      }

      logger.info('✅ Estadísticas de reportes calculadas', {
        workspaceId,
        days,
        stats
      });

      return stats;
    } catch (error) {
      logger.error('❌ Error calculando estadísticas de reportes', {
        workspaceId,
        days,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Eliminar reporte por ID
   */
  async deleteReport(reportId) {
    try {
      await firestore
        .collection(this.collection)
        .doc(reportId)
        .delete();

      logger.info('✅ Reporte eliminado exitosamente', {
        reportId
      });

      return true;
    } catch (error) {
      logger.error('❌ Error eliminando reporte', {
        reportId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Verificar si existe un reporte para un periodo específico
   */
  async reportExists(workspaceId, periodo, tipo) {
    try {
      const query = firestore
        .collection(this.collection)
        .where('workspaceId', '==', workspaceId)
        .where('tipo', '==', tipo)
        .where('periodo.from', '==', periodo.from)
        .where('periodo.to', '==', periodo.to);

      const snapshot = await query.get();
      return !snapshot.empty;
    } catch (error) {
      logger.error('❌ Error verificando existencia de reporte', {
        workspaceId,
        periodo,
        tipo,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = ReportsRepository; 