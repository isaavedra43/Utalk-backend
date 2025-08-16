const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const { getMessageService } = require('../services/MessageService');
const logger = require('../utils/logger');
const { Parser } = require('json2csv');

/**
 * Calcular fechas de inicio y fin basadas en un período
 */
function calculatePeriodDates(period, startDate, endDate) {
  const now = new Date();
  let start, end;

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    switch (period) {
      case '1d':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    end = now;
  }

  return { start, end };
}

class CampaignController {
  /**
   * Listar campañas con filtros y paginación
   */
  static async list (req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        search,
      } = req.query;

      const createdBy = req.user.role === 'admin' ? null : req.user.id;

      let campaigns;
      if (search) {
        campaigns = await Campaign.search(search, createdBy);
      } else {
        campaigns = await Campaign.list({
          limit: parseInt(limit),
          status,
          createdBy,
        });
      }

      logger.info('Campañas listadas', {
        userId: req.user.id,
        count: campaigns.length,
        filters: { status, search },
      });

      res.json({
        campaigns: campaigns.map(campaign => campaign.toJSON()),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: campaigns.length,
        },
      });
    } catch (error) {
      logger.error('Error al listar campañas:', error);
      next(error);
    }
  }

  /**
   * Crear nueva campaña
   */
  static async create (req, res, next) {
    try {
      const campaignData = {
        ...req.body,
        createdBy: req.user.id, // Se mantiene internamente
      };

      const campaign = await Campaign.create(campaignData);

      logger.info('Campaña creada', {
        campaignId: campaign.id,
        name: campaign.name,
        createdBy: req.user.id,
      });

      res.status(201).json({
        message: 'Campaña creada exitosamente',
        campaign: campaign.toJSON(),
      });
    } catch (error) {
      logger.error('Error al crear campaña:', error);
      next(error);
    }
  }

  /**
   * Obtener campaña por ID
   */
  static async getById (req, res, next) {
    try {
      const { id } = req.params;
      const campaign = await Campaign.getById(id);

      if (!campaign) {
        return res.status(404).json({
          error: 'Campaña no encontrada',
          message: `No se encontró una campaña con ID ${id}`,
        });
      }

      // Verificar permisos (solo admin o creador)
      if (req.user.role !== 'admin' && campaign.internalProperties.createdBy !== req.user.id) {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'No tienes permisos para ver esta campaña',
        });
      }

      res.json({
        campaign: campaign.toJSON(),
      });
    } catch (error) {
      logger.error('Error al obtener campaña:', error);
      next(error);
    }
  }

  /**
   * Actualizar campaña
   */
  static async update (req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const campaign = await Campaign.getById(id);
      if (!campaign) {
        return res.status(404).json({
          error: 'Campaña no encontrada',
          message: `No se encontró una campaña con ID ${id}`,
        });
      }

      // Verificar permisos
      if (req.user.role !== 'admin' && campaign.createdBy !== req.user.id) {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'No tienes permisos para modificar esta campaña',
        });
      }

      // Verificar si la campaña puede ser editada
      if (!campaign.canBeEdited()) {
        return res.status(400).json({
          error: 'Campaña no editable',
          message: `No se puede editar una campaña en estado ${campaign.status}`,
        });
      }

      // Validar contactos si se están actualizando
      if (updates.contacts) {
        const contactChecks = await Promise.all(
          updates.contacts.map(contactId => Contact.getById(contactId)),
        );

        const validContacts = contactChecks.filter(contact => contact !== null);

        if (validContacts.length !== updates.contacts.length) {
          return res.status(400).json({
            error: 'Contactos inválidos',
            message: 'Algunos contactos especificados no existen',
          });
        }

        updates.estimatedReach = validContacts.length;
      }

      await campaign.update(updates);

      logger.info('Campaña actualizada', {
        campaignId: campaign.id,
        updatedBy: req.user.id,
        fields: Object.keys(updates),
      });

      res.json({
        message: 'Campaña actualizada exitosamente',
        campaign: campaign.toJSON(),
      });
    } catch (error) {
      logger.error('Error al actualizar campaña:', error);
      next(error);
    }
  }

  /**
   * Eliminar campaña
   */
  static async delete (req, res, next) {
    try {
      const { id } = req.params;

      const campaign = await Campaign.getById(id);
      if (!campaign) {
        return res.status(404).json({
          error: 'Campaña no encontrada',
          message: `No se encontró una campaña con ID ${id}`,
        });
      }

      // Solo admins pueden eliminar campañas
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'Solo los administradores pueden eliminar campañas',
        });
      }

      await campaign.delete();

      logger.info('Campaña eliminada', {
        campaignId: campaign.id,
        deletedBy: req.user.id,
      });

      res.json({
        message: 'Campaña eliminada exitosamente',
      });
    } catch (error) {
      logger.error('Error al eliminar campaña:', error);
      next(error);
    }
  }

  /**
   * Enviar campaña
   */
  static async sendCampaign (req, res, next) {
    try {
      const { id } = req.params;

      const campaign = await Campaign.getById(id);
      if (!campaign) {
        return res.status(404).json({
          error: 'Campaña no encontrada',
        });
      }

      // Verificar permisos
      if (req.user.role !== 'admin' && campaign.createdBy !== req.user.id) {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'No tienes permisos para enviar esta campaña',
        });
      }

      // Verificar si la campaña puede ser enviada
      if (!campaign.canBeSent()) {
        return res.status(400).json({
          error: 'Campaña no puede ser enviada',
          message: 'La campaña debe estar en estado draft, scheduled o paused y tener contactos válidos',
        });
      }

      // Cambiar estado a enviando
      await campaign.updateStatus('sending');

      // Obtener contactos
      const contacts = await Promise.all(
        campaign.contacts.map(contactId => Contact.getById(contactId)),
      );
      const validContacts = contacts.filter(contact => contact !== null);

      // Enviar mensajes en lotes para evitar rate limiting
      const messageService = getMessageService();
      const results = await messageService.sendBulkMessages(
        validContacts,
        campaign.message,
        req.user.id,
      );

      // Actualizar métricas de la campaña
      const sentCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;

      await campaign.updateMetrics({
        sentCount,
        failedCount,
      });

      // Guardar resultados detallados
      await campaign.update({ results });

      // Cambiar estado a completado
      await campaign.updateStatus('completed');

      logger.info('Campaña enviada', {
        campaignId: campaign.id,
        sentCount,
        failedCount,
        sentBy: req.user.id,
      });

      res.json({
        message: 'Campaña enviada exitosamente',
        results: {
          total: validContacts.length,
          sent: sentCount,
          failed: failedCount,
          details: results,
        },
        campaign: campaign.toJSON(),
      });
    } catch (error) {
      logger.error('Error al enviar campaña:', error);
      next(error);
    }
  }

  /**
   * Pausar campaña
   */
  static async pauseCampaign (req, res, next) {
    try {
      const { id } = req.params;

      const campaign = await Campaign.getById(id);
      if (!campaign) {
        return res.status(404).json({
          error: 'Campaña no encontrada',
        });
      }

      // Verificar permisos
      if (req.user.role !== 'admin' && campaign.createdBy !== req.user.id) {
        return res.status(403).json({
          error: 'Sin permisos',
        });
      }

      if (!['scheduled', 'sending'].includes(campaign.status)) {
        return res.status(400).json({
          error: 'No se puede pausar',
          message: 'Solo se pueden pausar campañas programadas o en envío',
        });
      }

      await campaign.pause();

      logger.info('Campaña pausada', {
        campaignId: campaign.id,
        pausedBy: req.user.id,
      });

      res.json({
        message: 'Campaña pausada exitosamente',
        campaign: campaign.toJSON(),
      });
    } catch (error) {
      logger.error('Error al pausar campaña:', error);
      next(error);
    }
  }

  /**
   * Reanudar campaña
   */
  static async resumeCampaign (req, res, next) {
    try {
      const { id } = req.params;

      const campaign = await Campaign.getById(id);
      if (!campaign) {
        return res.status(404).json({
          error: 'Campaña no encontrada',
        });
      }

      // Verificar permisos
      if (req.user.role !== 'admin' && campaign.createdBy !== req.user.id) {
        return res.status(403).json({
          error: 'Sin permisos',
        });
      }

      if (campaign.status !== 'paused') {
        return res.status(400).json({
          error: 'No se puede reanudar',
          message: 'Solo se pueden reanudar campañas pausadas',
        });
      }

      await campaign.resume();

      logger.info('Campaña reanudada', {
        campaignId: campaign.id,
        resumedBy: req.user.id,
      });

      res.json({
        message: 'Campaña reanudada exitosamente',
        campaign: campaign.toJSON(),
      });
    } catch (error) {
      logger.error('Error al reanudar campaña:', error);
      next(error);
    }
  }

  /**
   * Obtener reporte de campaña
   */
  static async getReport (req, res, next) {
    try {
      const { id } = req.params;
      const { format } = req.query;

      const campaign = await Campaign.getById(id);
      if (!campaign) {
        return res.status(404).json({
          error: 'Campaña no encontrada',
        });
      }

      // Verificar permisos
      if (req.user.role !== 'admin' && campaign.createdBy !== req.user.id) {
        return res.status(403).json({
          error: 'Sin permisos',
        });
      }

      const campaignWithDetails = await campaign.getWithContactDetails();
      const stats = campaign.getStats();

      const report = {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          createdAt: campaign.createdAt,
          completedAt: campaign.completedAt,
        },
        summary: {
          totalContacts: campaign.contacts.length,
          messagesSent: stats.total,
          messagesDelivered: stats.delivered,
          messagesFailed: stats.failed,
          deliveryRate: stats.deliveryRate,
          failureRate: stats.failureRate,
        },
        details: campaign.results,
        contacts: campaignWithDetails.contactDetails,
      };

      // Si se solicita formato CSV
      if (format === 'csv') {
        const csvData = campaign.results.map(result => ({
          contactId: result.contactId,
          phone: result.phone,
          status: result.status,
          sentAt: result.sentAt,
          error: result.error || '',
        }));

        const fields = ['contactId', 'phone', 'status', 'sentAt', 'error'];
        const opts = { fields };
        const parser = new Parser(opts);
        const csv = parser.parse(csvData);

        res.header('Content-Type', 'text/csv');
        res.attachment(`reporte-campana-${campaign.id}.csv`);
        return res.send(csv);
      }

      res.json(report);
    } catch (error) {
      logger.error('Error al obtener reporte de campaña:', error);
      next(error);
    }
  }

  /**
   * Obtener estadísticas detalladas de campañas
   */
  static async getStats(req, res, next) {
    try {
      const {
        period = '7d',
        startDate,
        endDate,
        campaignId,
        status,
        createdBy
      } = req.query;

      const userFilter = req.user.role === 'admin' ? createdBy : req.user.id;

      logger.info('Obteniendo estadísticas de campañas', {
        userId: req.user.id,
        period,
        startDate,
        endDate,
        campaignId,
        status,
        userFilter
      });

      // Calcular fechas del período
      const { start, end } = calculatePeriodDates(period, startDate, endDate);

      // Obtener estadísticas básicas
      const basicStats = await this.getBasicCampaignStats(userFilter, start, end);
      
      // Obtener estadísticas por status
      const statusStats = await this.getCampaignStatusStats(userFilter, start, end);
      
      // Obtener estadísticas de rendimiento
      const performanceStats = await this.getCampaignPerformanceStats(userFilter, start, end);
      
      // Obtener top campañas
      const topCampaigns = await this.getTopCampaigns(userFilter, start, end, 5);
      
      // Obtener tendencias por día
      const dailyTrends = await this.getDailyCampaignTrends(userFilter, start, end);

      // Si se solicita una campaña específica
      let campaignDetails = null;
      if (campaignId) {
        campaignDetails = await this.getCampaignDetails(campaignId, userFilter);
      }

      const stats = {
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
          label: period
        },
        basic: basicStats,
        byStatus: statusStats,
        performance: performanceStats,
        topCampaigns,
        dailyTrends,
        campaignDetails
      };

      logger.info('Estadísticas de campañas generadas exitosamente', {
        userId: req.user.id,
        totalCampaigns: basicStats.total,
        activeCampaigns: basicStats.active,
        period
      });

      res.json(stats);

    } catch (error) {
      logger.error('Error al obtener estadísticas de campañas:', error);
      next(error);
    }
  }

  /**
   * Obtener estadísticas básicas de campañas
   */
  static async getBasicCampaignStats(userFilter, startDate, endDate) {
    try {
      const campaigns = await Campaign.list({
        createdBy: userFilter,
        limit: 1000,
        includeInactive: true
      });

      const filteredCampaigns = campaigns.filter(campaign => {
        const campaignDate = campaign.createdAt;
        return campaignDate >= startDate && campaignDate <= endDate;
      });

      const stats = {
        total: filteredCampaigns.length,
        active: filteredCampaigns.filter(c => c.status === 'active').length,
        paused: filteredCampaigns.filter(c => c.status === 'paused').length,
        completed: filteredCampaigns.filter(c => c.status === 'completed').length,
        draft: filteredCampaigns.filter(c => c.status === 'draft').length,
        totalMessages: filteredCampaigns.reduce((sum, c) => sum + (c.messagesSent || 0), 0),
        totalContacts: filteredCampaigns.reduce((sum, c) => sum + (c.contactsTargeted || 0), 0),
        averageSuccessRate: this.calculateAverageSuccessRate(filteredCampaigns)
      };

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas básicas de campañas:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas por status
   */
  static async getCampaignStatusStats(userFilter, startDate, endDate) {
    try {
      const campaigns = await Campaign.list({
        createdBy: userFilter,
        limit: 1000,
        includeInactive: true
      });

      const statusGroups = {
        active: [],
        paused: [],
        completed: [],
        draft: [],
        failed: []
      };

      campaigns.forEach(campaign => {
        const campaignDate = campaign.createdAt;
        if (campaignDate >= startDate && campaignDate <= endDate) {
          const status = campaign.status || 'draft';
          if (statusGroups[status]) {
            statusGroups[status].push(campaign);
          }
        }
      });

      const statusStats = {};
      for (const [status, campaignList] of Object.entries(statusGroups)) {
        statusStats[status] = {
          count: campaignList.length,
          percentage: campaigns.length > 0 ? 
            ((campaignList.length / campaigns.length) * 100).toFixed(1) : '0.0',
          totalMessages: campaignList.reduce((sum, c) => sum + (c.messagesSent || 0), 0),
          totalContacts: campaignList.reduce((sum, c) => sum + (c.contactsTargeted || 0), 0)
        };
      }

      return statusStats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas por status:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de rendimiento
   */
  static async getCampaignPerformanceStats(userFilter, startDate, endDate) {
    try {
      const campaigns = await Campaign.list({
        createdBy: userFilter,
        limit: 1000
      });

      const activeCampaigns = campaigns.filter(campaign => {
        const campaignDate = campaign.createdAt;
        return campaignDate >= startDate && campaignDate <= endDate && campaign.status === 'active';
      });

      if (activeCampaigns.length === 0) {
        return {
          averageDeliveryRate: 0,
          averageOpenRate: 0,
          averageResponseRate: 0,
          totalCost: 0,
          costPerMessage: 0,
          roi: 0
        };
      }

      const totalMessages = activeCampaigns.reduce((sum, c) => sum + (c.messagesSent || 0), 0);
      const totalDelivered = activeCampaigns.reduce((sum, c) => sum + (c.messagesDelivered || 0), 0);
      const totalOpened = activeCampaigns.reduce((sum, c) => sum + (c.messagesOpened || 0), 0);
      const totalResponses = activeCampaigns.reduce((sum, c) => sum + (c.responsesReceived || 0), 0);
      const totalCost = activeCampaigns.reduce((sum, c) => sum + (c.totalCost || 0), 0);

      return {
        averageDeliveryRate: totalMessages > 0 ? 
          ((totalDelivered / totalMessages) * 100).toFixed(1) : '0.0',
        averageOpenRate: totalDelivered > 0 ? 
          ((totalOpened / totalDelivered) * 100).toFixed(1) : '0.0',
        averageResponseRate: totalOpened > 0 ? 
          ((totalResponses / totalOpened) * 100).toFixed(1) : '0.0',
        totalCost: totalCost.toFixed(2),
        costPerMessage: totalMessages > 0 ? 
          (totalCost / totalMessages).toFixed(4) : '0.0000',
        roi: totalCost > 0 ? 
          (((totalResponses * 10) - totalCost) / totalCost * 100).toFixed(1) : '0.0' // ROI estimado
      };
    } catch (error) {
      logger.error('Error obteniendo estadísticas de rendimiento:', error);
      throw error;
    }
  }

  /**
   * Obtener top campañas por rendimiento
   */
  static async getTopCampaigns(userFilter, startDate, endDate, limit = 5) {
    try {
      const campaigns = await Campaign.list({
        createdBy: userFilter,
        limit: 1000
      });

      const filteredCampaigns = campaigns
        .filter(campaign => {
          const campaignDate = campaign.createdAt;
          return campaignDate >= startDate && campaignDate <= endDate;
        })
        .map(campaign => {
          const deliveryRate = campaign.messagesSent > 0 ? 
            (campaign.messagesDelivered || 0) / campaign.messagesSent : 0;
          const responseRate = campaign.messagesDelivered > 0 ? 
            (campaign.responsesReceived || 0) / campaign.messagesDelivered : 0;
          
          return {
            ...campaign.toJSON(),
            deliveryRate: (deliveryRate * 100).toFixed(1),
            responseRate: (responseRate * 100).toFixed(1),
            score: (deliveryRate * 0.6 + responseRate * 0.4) * 100 // Score ponderado
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return filteredCampaigns;
    } catch (error) {
      logger.error('Error obteniendo top campañas:', error);
      throw error;
    }
  }

  /**
   * Obtener tendencias diarias de campañas
   */
  static async getDailyCampaignTrends(userFilter, startDate, endDate) {
    try {
      const campaigns = await Campaign.list({
        createdBy: userFilter,
        limit: 1000
      });

      const dailyData = {};
      const currentDate = new Date(startDate);
      
      // Inicializar datos diarios
      while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        dailyData[dateKey] = {
          date: dateKey,
          campaignsCreated: 0,
          campaignsStarted: 0,
          campaignsCompleted: 0,
          messagesSent: 0,
          messagesDelivered: 0,
          responsesReceived: 0
        };
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Procesar campañas
      campaigns.forEach(campaign => {
        const createdDate = campaign.createdAt.toISOString().split('T')[0];
        if (dailyData[createdDate]) {
          dailyData[createdDate].campaignsCreated++;
          
          if (campaign.status === 'active' || campaign.status === 'completed') {
            dailyData[createdDate].campaignsStarted++;
            dailyData[createdDate].messagesSent += campaign.messagesSent || 0;
            dailyData[createdDate].messagesDelivered += campaign.messagesDelivered || 0;
            dailyData[createdDate].responsesReceived += campaign.responsesReceived || 0;
          }
          
          if (campaign.status === 'completed') {
            dailyData[createdDate].campaignsCompleted++;
          }
        }
      });

      return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      logger.error('Error obteniendo tendencias diarias:', error);
      throw error;
    }
  }

  /**
   * Obtener detalles específicos de una campaña
   */
  static async getCampaignDetails(campaignId, userFilter) {
    try {
      const campaign = await Campaign.getById(campaignId);
      
      if (!campaign) {
        throw new Error('Campaña no encontrada');
      }

      // Verificar permisos
      if (userFilter && campaign.createdBy !== userFilter) {
        throw new Error('No tiene permisos para ver esta campaña');
      }

      // Obtener métricas adicionales
      const details = {
        ...campaign.toJSON(),
        deliveryRate: campaign.messagesSent > 0 ? 
          ((campaign.messagesDelivered || 0) / campaign.messagesSent * 100).toFixed(1) : '0.0',
        openRate: campaign.messagesDelivered > 0 ? 
          ((campaign.messagesOpened || 0) / campaign.messagesDelivered * 100).toFixed(1) : '0.0',
        responseRate: campaign.messagesOpened > 0 ? 
          ((campaign.responsesReceived || 0) / campaign.messagesOpened * 100).toFixed(1) : '0.0',
        costPerMessage: campaign.messagesSent > 0 ? 
          ((campaign.totalCost || 0) / campaign.messagesSent).toFixed(4) : '0.0000',
        estimatedROI: this.calculateROI(campaign)
      };

      return details;
    } catch (error) {
      logger.error('Error obteniendo detalles de campaña:', error);
      throw error;
    }
  }

  /**
   * Calcular tasa de éxito promedio
   */
  static calculateAverageSuccessRate(campaigns) {
    if (campaigns.length === 0) return '0.0';
    
    const successRates = campaigns.map(campaign => {
      if (!campaign.messagesSent || campaign.messagesSent === 0) return 0;
      return (campaign.messagesDelivered || 0) / campaign.messagesSent;
    });
    
    const average = successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length;
    return (average * 100).toFixed(1);
  }

  /**
   * Calcular ROI estimado
   */
  static calculateROI(campaign) {
    const cost = campaign.totalCost || 0;
    if (cost === 0) return '0.0';
    
    // ROI estimado basado en respuestas (asumiendo valor promedio por respuesta)
    const estimatedValuePerResponse = 25; // USD - valor configurable
    const totalValue = (campaign.responsesReceived || 0) * estimatedValuePerResponse;
    const roi = ((totalValue - cost) / cost) * 100;
    
    return roi.toFixed(1);
  }

  /**
   * Detener campaña activa
   */
  static async stopCampaign(req, res, next) {
    try {
      const { campaignId } = req.params;
      const { reason, stopType = 'immediate' } = req.body;

      logger.info('Deteniendo campaña', {
        campaignId,
        userId: req.user.id,
        reason,
        stopType
      });

      // Obtener la campaña
      const campaign = await Campaign.getById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          error: 'CAMPAIGN_NOT_FOUND',
          message: 'Campaña no encontrada'
        });
      }

      // Verificar permisos (solo el creador o admin pueden detener)
      if (req.user.role !== 'admin' && campaign.createdBy !== req.user.id) {
        return res.status(403).json({
          error: 'CAMPAIGN_ACCESS_DENIED',
          message: 'No tienes permisos para detener esta campaña'
        });
      }

      // Verificar que la campaña se puede detener
      if (!['active', 'scheduled', 'paused'].includes(campaign.status)) {
        return res.status(400).json({
          error: 'CAMPAIGN_CANNOT_STOP',
          message: `No se puede detener una campaña con status: ${campaign.status}`
        });
      }

      // Detener según el tipo
      let finalStatus;
      let stopMessage;

      switch (stopType) {
        case 'immediate':
          // Detener inmediatamente
          finalStatus = 'stopped';
          stopMessage = 'Campaña detenida inmediatamente';
          
          // Cancelar mensajes pendientes si aplica
          await this.cancelPendingMessages(campaignId);
          break;
          
        case 'after_current_batch':
          // Permitir que termine el lote actual
          finalStatus = 'stopping';
          stopMessage = 'Campaña se detendrá después del lote actual';
          break;
          
        case 'graceful':
          // Detener de forma gradual
          finalStatus = 'stopping';
          stopMessage = 'Campaña se detendrá de forma gradual';
          break;
          
        default:
          finalStatus = 'stopped';
          stopMessage = 'Campaña detenida';
      }

      // Actualizar la campaña
      const updateData = {
        status: finalStatus,
        stoppedAt: new Date(),
        stoppedBy: req.user.id,
        stopReason: reason || 'Detenida manualmente',
        stopType: stopType,
        updatedAt: new Date()
      };

      await campaign.update(updateData);

      // Log de auditoría
      logger.info('Campaña detenida exitosamente', {
        campaignId,
        previousStatus: campaign.status,
        newStatus: finalStatus,
        stoppedBy: req.user.id,
        reason: reason || 'Sin razón especificada',
        stopType
      });

      // Respuesta
      res.json({
        success: true,
        message: stopMessage,
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: finalStatus,
          stoppedAt: updateData.stoppedAt,
          stoppedBy: req.user.id,
          stopReason: updateData.stopReason,
          messagesSent: campaign.messagesSent || 0,
          messagesRemaining: campaign.contactsTargeted - (campaign.messagesSent || 0)
        }
      });

    } catch (error) {
      logger.error('Error al detener campaña:', error);
      next(error);
    }
  }

  /**
   * Cancelar mensajes pendientes de una campaña
   */
  static async cancelPendingMessages(campaignId) {
    try {
      // Aquí implementarías la lógica para cancelar mensajes en cola
      // Esto dependería de tu sistema de colas (Bull, RabbitMQ, etc.)
      
      logger.info('Cancelando mensajes pendientes de campaña', { campaignId });
      
      // Ejemplo de implementación:
      // - Marcar mensajes como cancelados en base de datos
      // - Remover jobs de la cola de procesamiento
      // - Notificar a workers activos
      
      // Por ahora, solo log
      logger.info('Mensajes pendientes cancelados', { campaignId });
      
      return true;
    } catch (error) {
      logger.error('Error cancelando mensajes pendientes:', error);
      throw error;
    }
  }
}

module.exports = CampaignController;
