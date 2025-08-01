const express = require('express');
const router = express.Router();
const CampaignController = require('../controllers/CampaignController');
const { authMiddleware, requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const Joi = require('joi');

// Validadores específicos para campañas
const campaignValidators = {
  validateCreate: validateRequest({
    body: Joi.object({
      name: Joi.string().min(1).max(200).required(),
      status: Joi.string().valid('active', 'draft').required(),
      description: Joi.string().max(1000).optional(),
      targetAudience: Joi.array().items(Joi.string().max(100)).max(10).optional(),
      scheduledAt: Joi.date().iso().optional(),
      messageTemplate: Joi.string().min(1).max(4096).required(),
      contactList: Joi.array().items(Joi.string().min(1).max(128).pattern(/^[a-zA-Z0-9_-]+$/)).min(1).optional(),
      tags: Joi.array().items(Joi.string().max(50)).max(20).optional()
    })
  }),

  validateUpdate: validateRequest({
    body: Joi.object({
      name: Joi.string().min(1).max(200).optional(),
      status: Joi.string().valid('active', 'draft', 'paused', 'completed').optional(),
      description: Joi.string().max(1000).optional(),
      targetAudience: Joi.array().items(Joi.string().max(100)).max(10).optional(),
      scheduledAt: Joi.date().iso().optional(),
      messageTemplate: Joi.string().min(1).max(4096).optional(),
      contactList: Joi.array().items(Joi.string().min(1).max(128).pattern(/^[a-zA-Z0-9_-]+$/)).min(1).optional(),
      tags: Joi.array().items(Joi.string().max(50)).max(20).optional()
    })
  }),

  validateSend: validateRequest({
    body: Joi.object({
      confirm: Joi.boolean().valid(true).required()
    })
  }),

  validateStop: validateRequest({
    body: Joi.object({
      reason: Joi.string().max(500).optional(),
      stopType: Joi.string().valid('immediate', 'after_current_batch', 'graceful').default('immediate')
    })
  }),

  validateStats: validateRequest({
    query: Joi.object({
      period: Joi.string().valid('1d', '7d', '30d', '90d', '1y').default('7d'),
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().optional(),
      campaignId: Joi.string().min(1).max(128).pattern(/^[a-zA-Z0-9_-]+$/).optional(),
      status: Joi.string().valid('active', 'draft', 'paused', 'completed').optional(),
      createdBy: Joi.string().email({ minDomainSegments: 2 }).max(254).optional()
    })
  })
};

/**
 * @route GET /api/campaigns
 * @desc Listar campañas con filtros y paginación
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/',
  authMiddleware,
  requireReadAccess,
  CampaignController.list
);

/**
 * @route GET /api/campaigns/stats
 * @desc Obtener estadísticas de campañas
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/stats',
  authMiddleware,
  requireReadAccess,
  campaignValidators.validateStats,
  CampaignController.getStats
);

/**
 * @route GET /api/campaigns/:campaignId
 * @desc Obtener campaña por ID
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:campaignId',
  authMiddleware,
  requireReadAccess,
  validateRequest({ params: Joi.object({ campaignId: Joi.string().min(1).max(128).pattern(/^[a-zA-Z0-9_-]+$/).required() }) }),
  CampaignController.getById
);

/**
 * @route POST /api/campaigns
 * @desc Crear nueva campaña
 * @access Private (Agent, Admin)
 */
router.post('/',
  authMiddleware,
  requireWriteAccess,
  campaignValidators.validateCreate,
  CampaignController.create
);

/**
 * @route PUT /api/campaigns/:campaignId
 * @desc Actualizar campaña
 * @access Private (Agent, Admin)
 */
router.put('/:campaignId',
  authMiddleware,
  requireWriteAccess,
  validateRequest({ params: Joi.object({ campaignId: Joi.string().min(1).max(128).pattern(/^[a-zA-Z0-9_-]+$/).required() }) }),
  campaignValidators.validateUpdate,
  CampaignController.update
);

/**
 * @route DELETE /api/campaigns/:campaignId
 * @desc Eliminar campaña
 * @access Private (Admin)
 */
router.delete('/:campaignId',
  authMiddleware,
  requireWriteAccess,
  validateRequest({ params: Joi.object({ campaignId: Joi.string().min(1).max(128).pattern(/^[a-zA-Z0-9_-]+$/).required() }) }),
  CampaignController.delete
);

/**
 * @route POST /api/campaigns/:campaignId/start
 * @desc Iniciar campaña
 * @access Private (Agent, Admin)
 */
router.post('/:campaignId/start',
  authMiddleware,
  requireWriteAccess,
  validateRequest({ params: Joi.object({ campaignId: Joi.string().min(1).max(128).pattern(/^[a-zA-Z0-9_-]+$/).required() }) }),
  campaignValidators.validateSend,
  CampaignController.sendCampaign
);

/**
 * @route POST /api/campaigns/:campaignId/pause
 * @desc Pausar campaña
 * @access Private (Agent, Admin)
 */
router.post('/:campaignId/pause',
  authMiddleware,
  requireWriteAccess,
  validateRequest({ params: Joi.object({ campaignId: Joi.string().min(1).max(128).pattern(/^[a-zA-Z0-9_-]+$/).required() }) }),
  CampaignController.pauseCampaign
);

/**
 * @route POST /api/campaigns/:campaignId/resume
 * @desc Reanudar campaña
 * @access Private (Agent, Admin)
 */
router.post('/:campaignId/resume',
  authMiddleware,
  requireWriteAccess,
  validateRequest({ params: Joi.object({ campaignId: Joi.string().min(1).max(128).pattern(/^[a-zA-Z0-9_-]+$/).required() }) }),
  CampaignController.resumeCampaign
);

/**
 * @route POST /api/campaigns/:campaignId/stop
 * @desc Detener campaña
 * @access Private (Agent, Admin)
 */
router.post('/:campaignId/stop',
  authMiddleware,
  requireWriteAccess,
  validateRequest({ params: Joi.object({ campaignId: Joi.string().min(1).max(128).pattern(/^[a-zA-Z0-9_-]+$/).required() }) }),
  campaignValidators.validateStop,
  CampaignController.stopCampaign
);

module.exports = router;
