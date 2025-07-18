const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const TwilioService = require('../services/TwilioService');
const logger = require('../utils/logger');
const { Parser } = require('json2csv');

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
      const results = await TwilioService.sendBulkMessages(
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
}

module.exports = CampaignController;
