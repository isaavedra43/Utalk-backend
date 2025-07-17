const Message = require('../models/Message');
const Contact = require('../models/Contact');
const Campaign = require('../models/Campaign');
const User = require('../models/User');
const { firestore, Timestamp } = require('../config/firebase');
const logger = require('../utils/logger');
const { Parser } = require('json2csv');
const moment = require('moment');

class DashboardController {
  /**
   * Obtener métricas generales del dashboard
   */
  static async getMetrics (req, res, next) {
    try {
      const { period = '7d', startDate, endDate } = req.query;
      const userId = req.user.role === 'admin' ? null : req.user.uid;

      // Calcular fechas según el período
      const { start, end } = this.getPeriodDates(period, startDate, endDate);

      // Obtener métricas paralelas
      const [
        messageStats,
        contactStats,
        campaignStats,
        userActivity,
        recentActivity,
      ] = await Promise.all([
        this.getMessageMetrics(userId, start, end),
        this.getContactMetrics(userId, start, end),
        this.getCampaignMetrics(userId, start, end),
        this.getUserActivityMetrics(userId, start, end),
        this.getRecentActivity(userId, 10),
      ]);

      const metrics = {
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
          type: period,
        },
        summary: {
          totalMessages: messageStats.total,
          totalContacts: contactStats.total,
          totalCampaigns: campaignStats.total,
          activeUsers: userActivity.activeUsers,
        },
        messages: messageStats,
        contacts: contactStats,
        campaigns: campaignStats,
        userActivity,
        recentActivity,
        trends: await this.getTrendData(userId, start, end),
      };

      logger.info('Métricas del dashboard obtenidas', {
        userId: req.user.uid,
        period,
        metricsCount: Object.keys(metrics).length,
      });

      res.json(metrics);
    } catch (error) {
      logger.error('Error al obtener métricas del dashboard:', error);
      next(error);
    }
  }

  /**
   * Obtener estadísticas específicas de mensajes
   */
  static async getMessageStats (req, res, next) {
    try {
      const { period = '7d', startDate, endDate } = req.query;
      const userId = req.user.role === 'admin' ? null : req.user.uid;

      const { start, end } = this.getPeriodDates(period, startDate, endDate);
      const stats = await this.getMessageMetrics(userId, start, end);

      res.json({
        period: { start: start.toISOString(), end: end.toISOString() },
        stats,
      });
    } catch (error) {
      logger.error('Error al obtener estadísticas de mensajes:', error);
      next(error);
    }
  }

  /**
   * Obtener estadísticas específicas de contactos
   */
  static async getContactStats (req, res, next) {
    try {
      const { period = '7d', startDate, endDate } = req.query;
      const userId = req.user.role === 'admin' ? null : req.user.uid;

      const { start, end } = this.getPeriodDates(period, startDate, endDate);
      const stats = await this.getContactMetrics(userId, start, end);

      res.json({
        period: { start: start.toISOString(), end: end.toISOString() },
        stats,
      });
    } catch (error) {
      logger.error('Error al obtener estadísticas de contactos:', error);
      next(error);
    }
  }

  /**
   * Obtener estadísticas específicas de campañas
   */
  static async getCampaignStats (req, res, next) {
    try {
      const { period = '7d', startDate, endDate } = req.query;
      const userId = req.user.role === 'admin' ? null : req.user.uid;

      const { start, end } = this.getPeriodDates(period, startDate, endDate);
      const stats = await this.getCampaignMetrics(userId, start, end);

      res.json({
        period: { start: start.toISOString(), end: end.toISOString() },
        stats,
      });
    } catch (error) {
      logger.error('Error al obtener estadísticas de campañas:', error);
      next(error);
    }
  }

  /**
   * Obtener actividad reciente
   */
  static async getRecentActivity (req, res, next) {
    try {
      const { limit = 20 } = req.query;
      const userId = req.user.role === 'admin' ? null : req.user.uid;

      const activities = await this.getRecentActivity(userId, parseInt(limit));

      res.json({
        activities,
        total: activities.length,
      });
    } catch (error) {
      logger.error('Error al obtener actividad reciente:', error);
      next(error);
    }
  }

  /**
   * Exportar reporte completo
   */
  static async exportReport (req, res, next) {
    try {
      const { format = 'json', period = '30d', startDate, endDate } = req.query;
      const userId = req.user.role === 'admin' ? null : req.user.uid;

      const { start, end } = this.getPeriodDates(period, startDate, endDate);

      // Obtener datos completos
      const [messageStats, contactStats, campaignStats] = await Promise.all([
        this.getMessageMetrics(userId, start, end),
        this.getContactMetrics(userId, start, end),
        this.getCampaignMetrics(userId, start, end),
      ]);

      const report = {
        generatedAt: new Date().toISOString(),
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
          type: period,
        },
        summary: {
          totalMessages: messageStats.total,
          totalContacts: contactStats.total,
          totalCampaigns: campaignStats.total,
        },
        details: {
          messages: messageStats,
          contacts: contactStats,
          campaigns: campaignStats,
        },
      };

      // Exportar según formato solicitado
      if (format === 'csv') {
        const csvData = [
          {
            metric: 'Mensajes Totales',
            value: messageStats.total,
            inbound: messageStats.inbound,
            outbound: messageStats.outbound,
          },
          {
            metric: 'Contactos Totales',
            value: contactStats.total,
            new: contactStats.new,
            active: contactStats.active,
          },
          {
            metric: 'Campañas Totales',
            value: campaignStats.total,
            completed: campaignStats.completed,
            active: campaignStats.active,
          },
        ];

        const fields = ['metric', 'value', 'inbound', 'outbound', 'new', 'active', 'completed'];
        const opts = { fields };
        const parser = new Parser(opts);
        const csv = parser.parse(csvData);

        res.header('Content-Type', 'text/csv');
        res.attachment(`reporte-dashboard-${period}.csv`);
        return res.send(csv);
      }

      res.json(report);
    } catch (error) {
      logger.error('Error al exportar reporte:', error);
      next(error);
    }
  }

  /**
   * Obtener métricas de rendimiento del equipo
   */
  static async getPerformanceMetrics (req, res, next) {
    try {
      const { period = '30d', startDate, endDate } = req.query;

      // Solo admins pueden ver métricas del equipo
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'Solo los administradores pueden ver métricas del equipo',
        });
      }

      const { start, end } = this.getPeriodDates(period, startDate, endDate);

      // Obtener métricas por usuario
      const users = await User.list({ role: ['admin', 'agent'], isActive: true });
      const userMetrics = await Promise.all(
        users.map(async (user) => {
          const [messageStats, contactStats, campaignStats] = await Promise.all([
            this.getMessageMetrics(user.uid, start, end),
            this.getContactMetrics(user.uid, start, end),
            this.getCampaignMetrics(user.uid, start, end),
          ]);

          return {
            user: {
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
              role: user.role,
            },
            metrics: {
              messages: messageStats,
              contacts: contactStats,
              campaigns: campaignStats,
              productivity: this.calculateProductivityScore(messageStats, contactStats, campaignStats),
            },
          };
        }),
      );

      // Calcular rankings
      const rankings = {
        byMessages: userMetrics
          .sort((a, b) => b.metrics.messages.total - a.metrics.messages.total)
          .slice(0, 10),
        byContacts: userMetrics
          .sort((a, b) => b.metrics.contacts.new - a.metrics.contacts.new)
          .slice(0, 10),
        byCampaigns: userMetrics
          .sort((a, b) => b.metrics.campaigns.completed - a.metrics.campaigns.completed)
          .slice(0, 10),
        byProductivity: userMetrics
          .sort((a, b) => b.metrics.productivity - a.metrics.productivity)
          .slice(0, 10),
      };

      res.json({
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
          type: period,
        },
        teamMetrics: userMetrics,
        rankings,
        summary: {
          totalUsers: userMetrics.length,
          avgProductivity: userMetrics.reduce((sum, u) => sum + u.metrics.productivity, 0) / userMetrics.length,
        },
      });
    } catch (error) {
      logger.error('Error al obtener métricas de rendimiento:', error);
      next(error);
    }
  }

  // ===== MÉTODOS AUXILIARES =====

  /**
   * Calcular fechas según período
   */
  static getPeriodDates (period, startDate, endDate) {
    if (startDate && endDate) {
      return {
        start: new Date(startDate),
        end: new Date(endDate),
      };
    }

    const end = new Date();
    let start;

    switch (period) {
    case '1d':
      start = moment().subtract(1, 'day').toDate();
      break;
    case '7d':
      start = moment().subtract(7, 'days').toDate();
      break;
    case '30d':
      start = moment().subtract(30, 'days').toDate();
      break;
    case '90d':
      start = moment().subtract(90, 'days').toDate();
      break;
    case '1y':
      start = moment().subtract(1, 'year').toDate();
      break;
    default:
      start = moment().subtract(7, 'days').toDate();
    }

    return { start, end };
  }

  /**
   * Obtener métricas de mensajes
   */
  static async getMessageMetrics (userId, startDate, endDate) {
    const stats = await Message.getStats(userId, startDate, endDate);

    return {
      total: stats.total,
      inbound: stats.inbound,
      outbound: stats.outbound,
      byStatus: stats.byStatus,
      byType: stats.byType,
      responseTime: await this.calculateAverageResponseTime(userId, startDate, endDate),
    };
  }

  /**
   * Obtener métricas de contactos
   */
  static async getContactMetrics (userId, startDate, endDate) {
    let query = firestore.collection('contacts').where('isActive', '==', true);

    if (userId) {
      query = query.where('userId', '==', userId);
    }

    // Contactos en el período
    const periodQuery = query
      .where('createdAt', '>=', Timestamp.fromDate(startDate))
      .where('createdAt', '<=', Timestamp.fromDate(endDate));

    const [totalSnapshot, periodSnapshot] = await Promise.all([
      query.get(),
      periodQuery.get(),
    ]);

    const totalContacts = totalSnapshot.docs.length;
    const newContacts = periodSnapshot.docs.length;

    // Contactos activos (con mensajes en el período)
    const activeContacts = await this.getActiveContacts(userId, startDate, endDate);

    return {
      total: totalContacts,
      new: newContacts,
      active: activeContacts,
      growth: totalContacts > 0 ? (newContacts / totalContacts) * 100 : 0,
    };
  }

  /**
   * Obtener métricas de campañas
   */
  static async getCampaignMetrics (userId, startDate, endDate) {
    let query = firestore.collection('campaigns').where('isActive', '==', true);

    if (userId) {
      query = query.where('createdBy', '==', userId);
    }

    const snapshot = await query.get();
    const campaigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const periodCampaigns = campaigns.filter(campaign => {
      const createdAt = campaign.createdAt?.toDate();
      return createdAt >= startDate && createdAt <= endDate;
    });

    const completed = campaigns.filter(c => c.status === 'completed').length;
    const active = campaigns.filter(c => ['scheduled', 'sending'].includes(c.status)).length;

    return {
      total: campaigns.length,
      new: periodCampaigns.length,
      completed,
      active,
      draft: campaigns.filter(c => c.status === 'draft').length,
      successRate: campaigns.length > 0 ? (completed / campaigns.length) * 100 : 0,
    };
  }

  /**
   * Obtener métricas de actividad de usuarios
   */
  static async getUserActivityMetrics (userId, startDate, endDate) {
    // Usar Message.getStats que ya está refactorizado para subcolecciones
    const stats = await Message.getStats(userId, startDate, endDate);

    // Calcular métricas básicas de actividad
    const activeUsers = userId ? 1 : 0; // Si userId específico, hay 1 usuario activo
    const totalSessions = Math.ceil(stats.sent / 10); // Estimación básica: 1 sesión por cada 10 mensajes

    return {
      activeUsers,
      totalSessions,
      avgSessionLength: totalSessions > 0 ? stats.sent / totalSessions : 0,
      messageStats: stats,
    };
  }

  /**
   * Obtener actividad reciente
   */
  static async getRecentActivity (userId, limit) {
    const activities = [];

    // Mensajes recientes
    const recentMessages = await Message.getRecentMessages(userId, Math.floor(limit / 2));
    activities.push(...recentMessages.map(msg => ({
      type: 'message',
      action: msg.direction === 'inbound' ? 'received' : 'sent',
      data: msg.toJSON(),
      timestamp: msg.timestamp,
      user: msg.userId,
    })));

    // Contactos recientes
    const recentContacts = await Contact.list({
      limit: Math.floor(limit / 4),
      userId,
      isActive: true,
    });
    activities.push(...recentContacts.map(contact => ({
      type: 'contact',
      action: 'created',
      data: contact.toJSON(),
      timestamp: contact.createdAt,
      user: contact.userId,
    })));

    // Campañas recientes
    const recentCampaigns = await Campaign.list({
      limit: Math.floor(limit / 4),
      createdBy: userId,
      isActive: true,
    });
    activities.push(...recentCampaigns.map(campaign => ({
      type: 'campaign',
      action: campaign.status,
      data: campaign.toJSON(),
      timestamp: campaign.updatedAt,
      user: campaign.createdBy,
    })));

    // Ordenar por timestamp y limitar
    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Obtener datos de tendencias
   */
  static async getTrendData (userId, startDate, endDate) {
    const days = moment(endDate).diff(moment(startDate), 'days');
    const trends = [];

    for (let i = 0; i < days; i++) {
      const dayStart = moment(startDate).add(i, 'days').startOf('day').toDate();
      const dayEnd = moment(startDate).add(i, 'days').endOf('day').toDate();

      const [messageStats, contactStats] = await Promise.all([
        this.getMessageMetrics(userId, dayStart, dayEnd),
        this.getContactMetrics(userId, dayStart, dayEnd),
      ]);

      trends.push({
        date: dayStart.toISOString().split('T')[0],
        messages: messageStats.total,
        contacts: contactStats.new,
        inbound: messageStats.inbound,
        outbound: messageStats.outbound,
      });
    }

    return trends;
  }

  /**
   * Calcular tiempo promedio de respuesta
   */
  static async calculateAverageResponseTime (userId, startDate, endDate) {
    // Implementación simplificada
    // En producción sería más complejo, considerando conversaciones y turnos
    return Math.floor(Math.random() * 120) + 30; // 30-150 minutos (mock)
  }

  /**
   * Obtener contactos activos
   */
  static async getActiveContacts (userId, startDate, endDate) {
    let query = firestore.collection('contacts').where('isActive', '==', true);

    if (userId) {
      query = query.where('userId', '==', userId);
    }

    query = query.where('lastContactAt', '>=', Timestamp.fromDate(startDate))
      .where('lastContactAt', '<=', Timestamp.fromDate(endDate));

    const snapshot = await query.get();
    return snapshot.docs.length;
  }

  /**
   * Calcular sesiones
   */
  static calculateSessions (messages) {
    // Implementación simplificada
    // Agrupa mensajes por usuario y fecha para calcular sesiones
    const sessions = new Set();
    messages.forEach(msg => {
      if (msg.userId) {
        const date = msg.timestamp?.toDate?.()?.toDateString() || new Date().toDateString();
        sessions.add(`${msg.userId}-${date}`);
      }
    });
    return sessions.size;
  }

  /**
   * Calcular score de productividad
   */
  static calculateProductivityScore (messageStats, contactStats, campaignStats) {
    // Fórmula simple de productividad basada en actividad
    const messageScore = (messageStats.outbound || 0) * 2;
    const contactScore = (contactStats.new || 0) * 5;
    const campaignScore = (campaignStats.completed || 0) * 10;

    return messageScore + contactScore + campaignScore;
  }
}

module.exports = DashboardController;
