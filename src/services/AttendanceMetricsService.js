const AttendanceReport = require('../models/AttendanceReport');
const AttendanceRecord = require('../models/AttendanceRecord');
const AttendanceMovement = require('../models/AttendanceMovement');
const AttendanceException = require('../models/AttendanceException');
const AttendanceIntegrationService = require('./AttendanceIntegrationService');
const logger = require('../utils/logger');

/**
 * Servicio de Métricas y Reportes de Asistencia
 * Proporciona análisis avanzados y métricas detalladas de asistencia
 */
class AttendanceMetricsService {

  /**
   * Obtener métricas generales de asistencia
   */
  static async getGeneralMetrics(filters = {}) {
    try {
      const { dateFrom, dateTo, departmentId, employeeId } = filters;

      // Obtener reportes del período
      const reports = await AttendanceReport.list({
        dateFrom,
        dateTo,
        status: 'approved'
      });

      if (reports.length === 0) {
        return this.getEmptyMetrics();
      }

      // Calcular métricas básicas
      const basicStats = await this.calculateBasicStats(reports);

      // Calcular tendencias
      const trends = await this.calculateTrends(dateFrom, dateTo);

      // Obtener empleados destacados
      const topPerformers = await this.getTopPerformers(dateFrom, dateTo);

      // Obtener empleados que necesitan atención
      const needsAttention = await this.getNeedsAttention(dateFrom, dateTo);

      // Calcular métricas por departamento
      const departmentMetrics = await this.getDepartmentMetrics(dateFrom, dateTo);

      // Calcular alertas
      const alerts = await this.generateAlerts(basicStats);

      return {
        period: {
          dateFrom,
          dateTo,
          totalDays: this.calculateDaysDifference(dateFrom, dateTo)
        },
        summary: basicStats,
        trends,
        topPerformers,
        needsAttention,
        departmentMetrics,
        alerts,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error obteniendo métricas generales:', error);
      throw error;
    }
  }

  /**
   * Calcular estadísticas básicas
   */
  static async calculateBasicStats(reports) {
    const stats = {
      totalReports: reports.length,
      totalEmployees: 0,
      totalWorkingDays: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      vacationCount: 0,
      sickLeaveCount: 0,
      personalLeaveCount: 0,
      overtimeHours: 0,
      totalHours: 0,
      attendanceRate: 0,
      averageHoursPerDay: 0,
      averageOvertimePerDay: 0
    };

    reports.forEach(report => {
      stats.totalEmployees += report.totalEmployees;
      stats.totalWorkingDays += report.totalEmployees; // Aproximación
      stats.presentCount += report.presentCount;
      stats.absentCount += report.absentCount;
      stats.lateCount += report.lateCount;
      stats.vacationCount += report.vacationCount;
      stats.sickLeaveCount += report.sickLeaveCount;
      stats.personalLeaveCount += report.personalLeaveCount;
      stats.overtimeHours += report.overtimeHours;
      stats.totalHours += report.totalHours;
    });

    // Calcular tasas y promedios
    if (stats.totalEmployees > 0) {
      stats.attendanceRate = ((stats.presentCount + stats.lateCount) / stats.totalEmployees) * 100;
    }

    if (reports.length > 0) {
      stats.averageHoursPerDay = stats.totalHours / reports.length;
      stats.averageOvertimePerDay = stats.overtimeHours / reports.length;
    }

    return stats;
  }

  /**
   * Calcular tendencias de asistencia
   */
  static async calculateTrends(dateFrom, dateTo) {
    try {
      const trends = {
        attendanceRate: [],
        overtimeHours: [],
        absentCount: [],
        presentCount: []
      };

      // Obtener datos diarios del período
      const currentDate = new Date(dateFrom);
      const endDate = new Date(dateTo);

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];

        // Obtener reporte del día
        const report = await AttendanceReport.findByDate(dateStr);
        if (report && report.status === 'approved') {
          trends.attendanceRate.push({
            date: dateStr,
            value: ((report.presentCount + report.lateCount) / report.totalEmployees) * 100
          });

          trends.overtimeHours.push({
            date: dateStr,
            value: report.overtimeHours
          });

          trends.absentCount.push({
            date: dateStr,
            value: report.absentCount
          });

          trends.presentCount.push({
            date: dateStr,
            value: report.presentCount
          });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return trends;
    } catch (error) {
      logger.error('Error calculando tendencias:', error);
      return {
        attendanceRate: [],
        overtimeHours: [],
        absentCount: [],
        presentCount: []
      };
    }
  }

  /**
   * Obtener empleados con mejor rendimiento
   */
  static async getTopPerformers(dateFrom, dateTo, limit = 10) {
    try {
      // Esta función analizaría los registros individuales de asistencia
      // Por ahora, simulamos algunos empleados destacados

      return [
        {
          employeeId: 'emp1',
          employeeName: 'María González',
          department: 'Ventas',
          attendanceRate: 98.5,
          totalHours: 176,
          overtimeHours: 12,
          punctualityScore: 95
        },
        {
          employeeId: 'emp2',
          employeeName: 'Carlos Rodríguez',
          department: 'Desarrollo',
          attendanceRate: 97.2,
          totalHours: 168,
          overtimeHours: 8,
          punctualityScore: 92
        }
      ].slice(0, limit);
    } catch (error) {
      logger.error('Error obteniendo empleados destacados:', error);
      return [];
    }
  }

  /**
   * Obtener empleados que necesitan atención
   */
  static async getNeedsAttention(dateFrom, dateTo, limit = 10) {
    try {
      // Esta función identificaría empleados con problemas de asistencia
      // Por ahora, simulamos algunos casos

      return [
        {
          employeeId: 'emp3',
          employeeName: 'Ana López',
          department: 'Marketing',
          issue: 'Múltiples ausencias',
          absentCount: 5,
          attendanceRate: 78.5,
          risk: 'high'
        },
        {
          employeeId: 'emp4',
          employeeName: 'Roberto Sánchez',
          department: 'Soporte',
          issue: 'Horas extra excesivas',
          overtimeHours: 45,
          attendanceRate: 95.2,
          risk: 'medium'
        }
      ].slice(0, limit);
    } catch (error) {
      logger.error('Error obteniendo empleados que necesitan atención:', error);
      return [];
    }
  }

  /**
   * Obtener métricas por departamento
   */
  static async getDepartmentMetrics(dateFrom, dateTo) {
    try {
      // Esta función obtendría métricas por departamento
      // Por ahora, simulamos algunos departamentos

      return [
        {
          departmentId: 'dept1',
          departmentName: 'Ventas',
          totalEmployees: 15,
          attendanceRate: 94.2,
          averageHours: 8.1,
          overtimeHours: 28,
          absentDays: 12
        },
        {
          departmentId: 'dept2',
          departmentName: 'Desarrollo',
          totalEmployees: 12,
          attendanceRate: 96.8,
          averageHours: 8.3,
          overtimeHours: 35,
          absentDays: 8
        }
      ];
    } catch (error) {
      logger.error('Error obteniendo métricas por departamento:', error);
      return [];
    }
  }

  /**
   * Generar alertas del sistema
   */
  static async generateAlerts(stats) {
    const alerts = [];

    // Alerta de ausencia alta
    if (stats.absentCount / stats.totalEmployees > 0.15) {
      alerts.push({
        type: 'high_absence',
        severity: 'high',
        message: `Tasa de ausencia del ${(stats.absentCount / stats.totalEmployees * 100).toFixed(1)}% - superior al 15% recomendado`,
        metric: 'absence_rate',
        value: stats.absentCount / stats.totalEmployees,
        threshold: 0.15
      });
    }

    // Alerta de horas extra excesivas
    if (stats.overtimeHours > 100) {
      alerts.push({
        type: 'excessive_overtime',
        severity: 'medium',
        message: `${stats.overtimeHours} horas extra acumuladas - revisar cumplimiento laboral`,
        metric: 'overtime_hours',
        value: stats.overtimeHours,
        threshold: 100
      });
    }

    // Alerta de baja productividad
    if (stats.attendanceRate < 85) {
      alerts.push({
        type: 'low_attendance',
        severity: 'high',
        message: `Tasa de asistencia del ${stats.attendanceRate.toFixed(1)}% - inferior al 85% recomendado`,
        metric: 'attendance_rate',
        value: stats.attendanceRate,
        threshold: 85
      });
    }

    return alerts;
  }

  /**
   * Obtener métricas detalladas de empleado
   */
  static async getEmployeeDetailedMetrics(employeeId, dateFrom, dateTo) {
    try {
      const records = await AttendanceRecord.findByEmployee(employeeId, {
        dateFrom,
        dateTo
      });

      const stats = AttendanceIntegrationService.calculateAttendanceStats(records);

      // Obtener movimientos del período
      const movements = await AttendanceMovement.findByEmployee(employeeId, {
        dateFrom,
        dateTo
      });

      // Obtener excepciones del período
      const exceptions = await AttendanceException.findByEmployee(employeeId, {
        dateFrom,
        dateTo
      });

      // Calcular métricas adicionales
      const punctualityScore = this.calculatePunctualityScore(records);
      const reliabilityScore = this.calculateReliabilityScore(records, exceptions);

      return {
        employeeId,
        period: {
          dateFrom,
          dateTo,
          totalDays: this.calculateDaysDifference(dateFrom, dateTo)
        },
        stats,
        movements: {
          total: movements.length,
          overtime: movements.filter(m => m.type === 'overtime').length,
          loans: movements.filter(m => m.type === 'loan').length,
          bonuses: movements.filter(m => m.type === 'bonus').length,
          totalOvertimeHours: movements
            .filter(m => m.type === 'overtime')
            .reduce((sum, m) => sum + (m.hours || 0), 0)
        },
        exceptions: {
          total: exceptions.length,
          byType: this.groupExceptionsByType(exceptions),
          bySeverity: this.groupExceptionsBySeverity(exceptions)
        },
        scores: {
          punctuality: punctualityScore,
          reliability: reliabilityScore,
          overall: (punctualityScore + reliabilityScore) / 2
        },
        trends: await this.getEmployeeTrends(employeeId, dateFrom, dateTo)
      };
    } catch (error) {
      logger.error('Error obteniendo métricas detalladas de empleado:', error);
      throw error;
    }
  }

  /**
   * Calcular puntuación de puntualidad
   */
  static calculatePunctualityScore(records) {
    if (records.length === 0) return 100;

    let lateCount = 0;
    records.forEach(record => {
      if (record.status === 'late') {
        lateCount++;
      }
    });

    return Math.max(0, 100 - (lateCount / records.length) * 100);
  }

  /**
   * Calcular puntuación de confiabilidad
   */
  static calculateReliabilityScore(records, exceptions) {
    if (records.length === 0) return 100;

    // Penalizar por excepciones y ausencias
    const absencePenalty = (records.filter(r => r.status === 'absent').length / records.length) * 50;
    const exceptionPenalty = (exceptions.length / records.length) * 20;

    return Math.max(0, 100 - absencePenalty - exceptionPenalty);
  }

  /**
   * Agrupar excepciones por tipo
   */
  static groupExceptionsByType(exceptions) {
    const groups = {};

    exceptions.forEach(exception => {
      if (!groups[exception.type]) {
        groups[exception.type] = 0;
      }
      groups[exception.type]++;
    });

    return groups;
  }

  /**
   * Agrupar excepciones por severidad
   */
  static groupExceptionsBySeverity(exceptions) {
    const groups = {};

    exceptions.forEach(exception => {
      if (!groups[exception.severity]) {
        groups[exception.severity] = 0;
      }
      groups[exception.severity]++;
    });

    return groups;
  }

  /**
   * Obtener tendencias de empleado
   */
  static async getEmployeeTrends(employeeId, dateFrom, dateTo) {
    try {
      const records = await AttendanceRecord.findByEmployee(employeeId, {
        dateFrom,
        dateTo
      });

      // Agrupar por día
      const dailyStats = {};

      records.forEach(record => {
        const date = record.createdAt.split('T')[0];
        if (!dailyStats[date]) {
          dailyStats[date] = {
            status: record.status,
            hours: record.totalHours || 0,
            overtime: record.overtimeHours || 0
          };
        }
      });

      return {
        attendanceRate: Object.entries(dailyStats).map(([date, data]) => ({
          date,
          value: data.status === 'present' || data.status === 'late' ? 100 : 0
        })),
        hoursWorked: Object.entries(dailyStats).map(([date, data]) => ({
          date,
          value: data.hours
        })),
        overtimeHours: Object.entries(dailyStats).map(([date, data]) => ({
          date,
          value: data.overtime
        }))
      };
    } catch (error) {
      logger.error('Error obteniendo tendencias de empleado:', error);
      return {
        attendanceRate: [],
        hoursWorked: [],
        overtimeHours: []
      };
    }
  }

  /**
   * Generar reporte ejecutivo de asistencia
   */
  static async generateExecutiveReport(dateFrom, dateTo) {
    try {
      const metrics = await this.getGeneralMetrics({ dateFrom, dateTo });

      // Resumir información clave para ejecutivos
      const executiveSummary = {
        period: metrics.period,
        keyMetrics: {
          attendanceRate: metrics.summary.attendanceRate,
          totalHours: metrics.summary.totalHours,
          overtimeHours: metrics.summary.overtimeHours,
          employeeCount: metrics.summary.totalEmployees / metrics.period.totalDays
        },
        highlights: {
          bestDepartment: metrics.departmentMetrics.reduce((best, dept) =>
            dept.attendanceRate > best.attendanceRate ? dept : best
          ),
          topPerformer: metrics.topPerformers[0],
          mainConcerns: metrics.alerts.filter(alert => alert.severity === 'high')
        },
        recommendations: this.generateRecommendations(metrics),
        generatedAt: new Date().toISOString()
      };

      return executiveSummary;
    } catch (error) {
      logger.error('Error generando reporte ejecutivo:', error);
      throw error;
    }
  }

  /**
   * Generar recomendaciones basadas en métricas
   */
  static generateRecommendations(metrics) {
    const recommendations = [];

    if (metrics.summary.attendanceRate < 90) {
      recommendations.push({
        type: 'attendance',
        priority: 'high',
        message: 'Implementar programa de incentivos por asistencia perfecta',
        action: 'Revisar políticas de ausentismo y considerar incentivos'
      });
    }

    if (metrics.summary.overtimeHours > 50) {
      recommendations.push({
        type: 'overtime',
        priority: 'medium',
        message: 'Revisar distribución de carga de trabajo',
        action: 'Analizar procesos y considerar contratación adicional'
      });
    }

    if (metrics.alerts.some(alert => alert.type === 'high_absence')) {
      recommendations.push({
        type: 'absenteeism',
        priority: 'high',
        message: 'Programa de intervención para empleados con ausentismo alto',
        action: 'Identificar causas raíz y desarrollar plan de acción'
      });
    }

    return recommendations;
  }

  /**
   * Obtener métricas vacías para cuando no hay datos
   */
  static getEmptyMetrics() {
    return {
      period: {
        dateFrom: null,
        dateTo: null,
        totalDays: 0
      },
      summary: {
        totalReports: 0,
        totalEmployees: 0,
        totalWorkingDays: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        vacationCount: 0,
        sickLeaveCount: 0,
        personalLeaveCount: 0,
        overtimeHours: 0,
        totalHours: 0,
        attendanceRate: 0,
        averageHoursPerDay: 0,
        averageOvertimePerDay: 0
      },
      trends: {
        attendanceRate: [],
        overtimeHours: [],
        absentCount: [],
        presentCount: []
      },
      topPerformers: [],
      needsAttention: [],
      departmentMetrics: [],
      alerts: [],
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Calcular diferencia de días entre fechas
   */
  static calculateDaysDifference(dateFrom, dateTo) {
    if (!dateFrom || !dateTo) return 0;

    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);

    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays + 1; // Incluir ambos días
  }

  /**
   * Exportar métricas a formato específico
   */
  static async exportMetrics(filters, format) {
    try {
      const metrics = await this.getGeneralMetrics(filters);

      switch (format) {
        case 'json':
          return {
            format: 'json',
            filename: `metricas-asistencia-${filters.dateFrom || 'periodo'}.json`,
            data: metrics
          };

        case 'csv':
          return this.convertMetricsToCSV(metrics);

        case 'excel':
          return this.convertMetricsToExcel(metrics);

        default:
          throw new Error('Formato no soportado');
      }
    } catch (error) {
      logger.error('Error exportando métricas:', error);
      throw error;
    }
  }

  /**
   * Convertir métricas a CSV
   */
  static convertMetricsToCSV(metrics) {
    // Esta función convertiría las métricas a formato CSV
    // Por ahora, retornamos estructura básica
    return {
      format: 'csv',
      filename: `metricas-asistencia-${metrics.period.dateFrom || 'periodo'}.csv`,
      data: metrics
    };
  }

  /**
   * Convertir métricas a Excel
   */
  static convertMetricsToExcel(metrics) {
    // Esta función convertiría las métricas a formato Excel
    // Por ahora, retornamos estructura básica
    return {
      format: 'excel',
      filename: `metricas-asistencia-${metrics.period.dateFrom || 'periodo'}.xlsx`,
      data: metrics
    };
  }

  /**
   * Obtener métricas de cumplimiento laboral
   */
  static async getComplianceMetrics(dateFrom, dateTo) {
    try {
      const reports = await AttendanceReport.list({
        dateFrom,
        dateTo,
        status: 'approved'
      });

      const compliance = {
        totalEmployees: 0,
        compliantEmployees: 0,
        nonCompliantEmployees: 0,
        complianceRate: 0,
        violations: {
          excessiveOvertime: 0,
          frequentLateness: 0,
          unauthorizedAbsences: 0,
          breakViolations: 0
        },
        byDepartment: {}
      };

      // Esta función analizaría el cumplimiento de políticas laborales
      // Por ahora, simulamos algunos datos

      return compliance;
    } catch (error) {
      logger.error('Error obteniendo métricas de cumplimiento:', error);
      throw error;
    }
  }

  /**
   * Obtener predicciones de asistencia
   */
  static async getAttendancePredictions(employeeId, futureDays = 30) {
    try {
      // Esta función usaría ML para predecir patrones de asistencia
      // Por ahora, retornamos predicciones simuladas

      const predictions = [];

      for (let i = 1; i <= futureDays; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);

        predictions.push({
          date: date.toISOString().split('T')[0],
          predictedStatus: Math.random() > 0.1 ? 'present' : 'absent', // 90% present
          confidence: 0.75 + Math.random() * 0.2, // 75-95% confianza
          factors: [
            'Historial consistente de asistencia',
            'No hay vacaciones programadas',
            'Patrón de trabajo regular'
          ]
        });
      }

      return predictions;
    } catch (error) {
      logger.error('Error obteniendo predicciones de asistencia:', error);
      throw error;
    }
  }

  /**
   * Obtener análisis de productividad basado en asistencia
   */
  static async getProductivityAnalysis(dateFrom, dateTo) {
    try {
      const metrics = await this.getGeneralMetrics({ dateFrom, dateTo });

      // Esta función analizaría la relación entre asistencia y productividad
      // Por ahora, simulamos análisis básico

      return {
        attendanceProductivityCorrelation: 0.85,
        optimalAttendanceRate: 95,
        productivityByAttendanceRange: {
          '90-100%': { productivity: 95, employeeCount: Math.floor(metrics.summary.totalEmployees * 0.7) },
          '80-89%': { productivity: 78, employeeCount: Math.floor(metrics.summary.totalEmployees * 0.2) },
          '70-79%': { productivity: 62, employeeCount: Math.floor(metrics.summary.totalEmployees * 0.08) },
          '<70%': { productivity: 45, employeeCount: Math.floor(metrics.summary.totalEmployees * 0.02) }
        },
        recommendations: [
          'Empleados con asistencia >90% muestran 95% de productividad',
          'Considerar intervenciones para empleados con asistencia <80%',
          'Programas de reconocimiento para asistencia perfecta'
        ]
      };
    } catch (error) {
      logger.error('Error obteniendo análisis de productividad:', error);
      throw error;
    }
  }
}

module.exports = AttendanceMetricsService;
