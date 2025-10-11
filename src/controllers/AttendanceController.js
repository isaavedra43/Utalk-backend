const AttendanceService = require('../services/AttendanceService');
const AttendanceReport = require('../models/AttendanceReport');
const logger = require('../utils/logger');

/**
 * Controlador de Asistencia
 * Maneja todos los endpoints relacionados con asistencia diaria
 */
class AttendanceController {

  /**
   * Crear reporte de asistencia
   */
  static async createReport(req, res) {
    try {
      const { date, employees, movements, exceptions, notes } = req.body;
      const userId = req.user.id;

      // Validar permisos
      const permissions = await AttendanceService.validateUserPermissions(userId, 'canCreate');
      if (!permissions.canCreate) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para crear reportes de asistencia'
        });
      }

      const report = await AttendanceService.createReport({
        date,
        employees,
        movements,
        exceptions,
        notes
      }, userId);

      res.status(201).json({
        success: true,
        message: 'Reporte de asistencia creado exitosamente',
        data: report
      });

    } catch (error) {
      logger.error('Error creando reporte de asistencia:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error creando reporte de asistencia'
      });
    }
  }

  /**
   * Obtener reporte por ID
   */
  static async getReport(req, res) {
    try {
      const { reportId } = req.params;

      const reportData = await AttendanceService.getReportById(reportId);

      res.json({
        success: true,
        data: reportData
      });

    } catch (error) {
      logger.error('Error obteniendo reporte:', error);
      res.status(404).json({
        success: false,
        message: error.message || 'Reporte no encontrado'
      });
    }
  }

  /**
   * Listar reportes
   */
  static async listReports(req, res) {
    try {
      const { page = 1, limit = 50, dateFrom, dateTo, status, createdBy } = req.query;

      const filters = {
        offset: (page - 1) * limit,
        limit: parseInt(limit),
        dateFrom,
        dateTo,
        status,
        createdBy
      };

      const result = await AttendanceService.listReports(filters);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error listando reportes:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo lista de reportes'
      });
    }
  }

  /**
   * Actualizar reporte
   */
  static async updateReport(req, res) {
    try {
      const { reportId } = req.params;
      const updateData = req.body;
      const userId = req.user.id;

      // Validar permisos
      const permissions = await AttendanceService.validateUserPermissions(userId, 'canEdit');
      if (!permissions.canEdit) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para editar reportes de asistencia'
        });
      }

      const report = await AttendanceService.updateReport(reportId, updateData, userId);

      res.json({
        success: true,
        message: 'Reporte actualizado exitosamente',
        data: report
      });

    } catch (error) {
      logger.error('Error actualizando reporte:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error actualizando reporte'
      });
    }
  }

  /**
   * Eliminar reporte
   */
  static async deleteReport(req, res) {
    try {
      const { reportId } = req.params;
      const userId = req.user.id;

      // Validar permisos
      const permissions = await AttendanceService.validateUserPermissions(userId, 'canDelete');
      if (!permissions.canDelete) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para eliminar reportes de asistencia'
        });
      }

      await AttendanceService.deleteReport(reportId, userId);

      res.json({
        success: true,
        message: 'Reporte eliminado exitosamente'
      });

    } catch (error) {
      logger.error('Error eliminando reporte:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error eliminando reporte'
      });
    }
  }

  /**
   * Aprobar reporte
   */
  static async approveReport(req, res) {
    try {
      const { reportId } = req.params;
      const { comments } = req.body;
      const userId = req.user.id;

      // Validar permisos
      const permissions = await AttendanceService.validateUserPermissions(userId, 'canApprove');
      if (!permissions.canApprove) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para aprobar reportes de asistencia'
        });
      }

      const report = await AttendanceService.approveReport(reportId, userId, comments);

      res.json({
        success: true,
        message: 'Reporte aprobado exitosamente',
        data: report
      });

    } catch (error) {
      logger.error('Error aprobando reporte:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error aprobando reporte'
      });
    }
  }

  /**
   * Rechazar reporte
   */
  static async rejectReport(req, res) {
    try {
      const { reportId } = req.params;
      const { reason } = req.body;
      const userId = req.user.id;

      // Validar permisos
      const permissions = await AttendanceService.validateUserPermissions(userId, 'canReject');
      if (!permissions.canReject) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para rechazar reportes de asistencia'
        });
      }

      const report = await AttendanceService.rejectReport(reportId, userId, reason);

      res.json({
        success: true,
        message: 'Reporte rechazado exitosamente',
        data: report
      });

    } catch (error) {
      logger.error('Error rechazando reporte:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error rechazando reporte'
      });
    }
  }

  /**
   * Generar reporte rápido
   */
  static async generateQuickReport(req, res) {
    try {
      const { date, template = 'normal' } = req.body;
      const userId = req.user.id;

      // Validar permisos
      const permissions = await AttendanceService.validateUserPermissions(userId, 'canCreate');
      if (!permissions.canCreate) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para generar reportes de asistencia'
        });
      }

      const reportData = await AttendanceService.generateQuickReport(date, template);

      res.json({
        success: true,
        message: 'Reporte generado exitosamente',
        data: reportData
      });

    } catch (error) {
      logger.error('Error generando reporte rápido:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error generando reporte rápido'
      });
    }
  }

  /**
   * Obtener estadísticas de asistencia
   */
  static async getStats(req, res) {
    try {
      const { dateFrom, dateTo, departmentId, employeeId } = req.query;

      const filters = {
        dateFrom,
        dateTo,
        departmentId,
        employeeId
      };

      const stats = await AttendanceService.getAttendanceStats(filters);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo estadísticas de asistencia'
      });
    }
  }

  /**
   * Obtener estado de empleado específico
   */
  static async getEmployeeStatus(req, res) {
    try {
      const { employeeId } = req.params;
      const { date } = req.query;

      if (!date) {
        return res.status(400).json({
          success: false,
          message: 'Fecha requerida'
        });
      }

      // Obtener registro del día
      const AttendanceRecord = require('../models/AttendanceRecord');
      const record = await AttendanceRecord.findByEmployee(employeeId, { dateFrom: date, dateTo: date });

      // Obtener vacaciones del día
      const vacationStatus = await AttendanceService.checkEmployeeVacationStatus(employeeId, date);

      // Obtener extras del día
      const extras = await AttendanceService.getEmployeeExtras(employeeId, date);

      res.json({
        success: true,
        data: {
          employeeId,
          date,
          attendanceStatus: record.length > 0 ? record[0].status : 'not_recorded',
          record: record[0] || null,
          vacationInfo: vacationStatus,
          extrasInfo: extras
        }
      });

    } catch (error) {
      logger.error('Error obteniendo estado de empleado:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo estado del empleado'
      });
    }
  }

  /**
   * Obtener historial de empleado
   */
  static async getEmployeeHistory(req, res) {
    try {
      const { employeeId } = req.params;
      const { dateFrom, dateTo, limit = 30 } = req.query;

      const AttendanceRecord = require('../models/AttendanceRecord');
      const records = await AttendanceRecord.findByEmployee(employeeId, {
        dateFrom,
        dateTo,
        limit: parseInt(limit)
      });

      // Calcular estadísticas del período
      const stats = {
        totalDays: records.length,
        presentDays: records.filter(r => r.status === 'present').length,
        absentDays: records.filter(r => r.status === 'absent').length,
        lateDays: records.filter(r => r.status === 'late').length,
        vacationDays: records.filter(r => r.status === 'vacation').length,
        totalHours: records.reduce((sum, r) => sum + (r.totalHours || 0), 0),
        overtimeHours: records.reduce((sum, r) => sum + (r.overtimeHours || 0), 0)
      };

      res.json({
        success: true,
        data: {
          employeeId,
          period: {
            dateFrom,
            dateTo
          },
          records,
          summary: stats
        }
      });

    } catch (error) {
      logger.error('Error obteniendo historial de empleado:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo historial del empleado'
      });
    }
  }

  /**
   * Exportar reporte
   */
  static async exportReport(req, res) {
    try {
      const { reportId } = req.params;
      const { format = 'pdf' } = req.query;

      const exportData = await AttendanceService.exportReport(reportId, format);

      // Configurar headers para descarga
      res.setHeader('Content-Type', `application/${format}`);
      res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);

      // Enviar datos (en producción se generaría el archivo real)
      res.json({
        success: true,
        message: `Reporte exportado como ${format}`,
        data: exportData
      });

    } catch (error) {
      logger.error('Error exportando reporte:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error exportando reporte'
      });
    }
  }

  /**
   * Obtener dashboard de asistencia
   */
  static async getDashboard(req, res) {
    try {
      const { date } = req.query;

      // Obtener reporte del día si existe
      let report = null;
      let stats = null;

      if (date) {
        report = await AttendanceReport.findByDate(date);
        if (report) {
          stats = await report.getStats();
        }
      }

      // Obtener estadísticas generales
      const generalStats = await AttendanceService.getAttendanceStats({
        dateFrom: date ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined,
        dateTo: date
      });

      // Obtener reportes recientes
      const recentReports = await AttendanceService.listReports({
        limit: 5,
        status: 'completed'
      });

      // Obtener alertas
      const alerts = await this.getAlerts(date);

      res.json({
        success: true,
        data: {
          date,
          currentReport: report,
          currentStats: stats,
          generalStats,
          recentReports: recentReports.reports,
          alerts
        }
      });

    } catch (error) {
      logger.error('Error obteniendo dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo dashboard de asistencia'
      });
    }
  }

  /**
   * Obtener alertas del sistema
   */
  static async getAlerts(date) {
    try {
      const alerts = [];

      // Alerta de alta ausencia (más del 20% de ausencias)
      const stats = await AttendanceService.getAttendanceStats({
        dateFrom: date,
        dateTo: date
      });

      if (stats.totalEmployees > 0) {
        const absenceRate = (stats.absentCount / stats.totalEmployees) * 100;
        if (absenceRate > 20) {
          alerts.push({
            type: 'high_absence',
            message: `${absenceRate.toFixed(1)}% de ausencias hoy - superior al 20% recomendado`,
            severity: 'high'
          });
        }
      }

      // Alerta de horas extra excesivas
      if (stats.overtimeHours > 50) {
        alerts.push({
          type: 'overtime_alert',
          message: `${stats.overtimeHours} horas extra acumuladas - revisar cumplimiento laboral`,
          severity: 'medium'
        });
      }

      return alerts;
    } catch (error) {
      logger.error('Error obteniendo alertas:', error);
      return [];
    }
  }

  /**
   * Crear movimiento de asistencia
   */
  static async createMovement(req, res) {
    try {
      const { reportId, employeeId, type, subtype, description, amount, hours } = req.body;
      const userId = req.user.id;

      const AttendanceMovement = require('../models/AttendanceMovement');
      const movement = new AttendanceMovement({
        reportId,
        employeeId,
        type,
        subtype,
        description,
        amount,
        hours,
        createdBy: userId,
        status: 'pending'
      });

      const validation = movement.validate();
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: `Errores de validación: ${validation.errors.join(', ')}`
        });
      }

      await movement.save();

      res.status(201).json({
        success: true,
        message: 'Movimiento creado exitosamente',
        data: movement
      });

    } catch (error) {
      logger.error('Error creando movimiento:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error creando movimiento'
      });
    }
  }

  /**
   * Crear excepción de asistencia
   */
  static async createException(req, res) {
    try {
      const { reportId, employeeId, type, description, time, duration, severity } = req.body;
      const userId = req.user.id;

      const AttendanceException = require('../models/AttendanceException');
      const exception = new AttendanceException({
        reportId,
        employeeId,
        type,
        description,
        time,
        duration,
        severity,
        createdBy: userId,
        status: 'pending'
      });

      const validation = exception.validate();
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: `Errores de validación: ${validation.errors.join(', ')}`
        });
      }

      await exception.save();

      res.status(201).json({
        success: true,
        message: 'Excepción creada exitosamente',
        data: exception
      });

    } catch (error) {
      logger.error('Error creando excepción:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error creando excepción'
      });
    }
  }

  /**
   * Obtener métricas de asistencia
   */
  static async getMetrics(req, res) {
    try {
      const { period = 'month', date } = req.query;

      let dateFrom, dateTo;

      if (period === 'week') {
        const targetDate = date ? new Date(date) : new Date();
        const startOfWeek = new Date(targetDate);
        startOfWeek.setDate(targetDate.getDate() - targetDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        dateFrom = startOfWeek.toISOString().split('T')[0];
        dateTo = endOfWeek.toISOString().split('T')[0];
      } else if (period === 'month') {
        const targetDate = date ? new Date(date) : new Date();
        const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

        dateFrom = startOfMonth.toISOString().split('T')[0];
        dateTo = endOfMonth.toISOString().split('T')[0];
      }

      const stats = await AttendanceService.getAttendanceStats({
        dateFrom,
        dateTo
      });

      // Obtener tendencias
      const trends = await this.getTrends(dateFrom, dateTo);

      res.json({
        success: true,
        data: {
          period,
          date,
          dateFrom,
          dateTo,
          metrics: stats,
          trends
        }
      });

    } catch (error) {
      logger.error('Error obteniendo métricas:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo métricas de asistencia'
      });
    }
  }

  /**
   * Obtener tendencias de asistencia
   */
  static async getTrends(dateFrom, dateTo) {
    try {
      // Obtener datos de los últimos 30 días
      const endDate = new Date(dateTo);
      const startDate = new Date(dateFrom);

      const trends = {
        attendanceRate: [],
        overtimeHours: [],
        absenceCount: []
      };

      // Generar datos de tendencia (simulados por ahora)
      const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

      for (let i = 0; i < Math.min(daysDiff, 30); i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);

        const dateStr = currentDate.toISOString().split('T')[0];
        const dayStats = await AttendanceService.getAttendanceStats({
          dateFrom: dateStr,
          dateTo: dateStr
        });

        trends.attendanceRate.push({
          date: dateStr,
          value: dayStats.attendanceRate || 0
        });

        trends.overtimeHours.push({
          date: dateStr,
          value: dayStats.overtimeHours || 0
        });

        trends.absenceCount.push({
          date: dateStr,
          value: dayStats.absentCount || 0
        });
      }

      return trends;
    } catch (error) {
      logger.error('Error obteniendo tendencias:', error);
      return {
        attendanceRate: [],
        overtimeHours: [],
        absenceCount: []
      };
    }
  }
}

module.exports = AttendanceController;
