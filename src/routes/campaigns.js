const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { authMiddleware, requireReadAccess, requireWriteAccess, requireAdmin } = require('../middleware/auth');
const CampaignController = require('../controllers/CampaignController');

const router = express.Router();

/**
 * @route GET /api/campaigns
 * @desc Listar campañas
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/',
  authMiddleware,
  requireReadAccess,
  CampaignController.list,
);

/**
 * @route POST /api/campaigns
 * @desc Crear nueva campaña
 * @access Private (Agent, Admin)
 */
router.post('/',
  authMiddleware,
  requireWriteAccess,
  validate(schemas.campaign.create),
  CampaignController.create,
);

/**
 * @route GET /api/campaigns/stats
 * @desc Obtener estadísticas de campañas
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/stats',
  authMiddleware,
  requireReadAccess,
  CampaignController.getStats,
);

/**
 * @route GET /api/campaigns/:campaignId
 * @desc Obtener campaña específica
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:campaignId',
  authMiddleware,
  requireReadAccess,
  CampaignController.get,
);

/**
 * @route PUT /api/campaigns/:campaignId
 * @desc Actualizar campaña
 * @access Private (Agent, Admin)
 */
router.put('/:campaignId',
  authMiddleware,
  requireWriteAccess,
  validate(schemas.campaign.update),
  CampaignController.update,
);

/**
 * @route DELETE /api/campaigns/:campaignId
 * @desc Eliminar campaña
 * @access Private (Agent, Admin)
 */
router.delete('/:campaignId',
  authMiddleware,
  requireWriteAccess,
  CampaignController.delete,
);

/**
 * @route POST /api/campaigns/:campaignId/start
 * @desc Iniciar campaña
 * @access Private (Agent, Admin)
 */
router.post('/:campaignId/start',
  authMiddleware,
  requireWriteAccess,
  CampaignController.start,
);

/**
 * @route POST /api/campaigns/:campaignId/pause
 * @desc Pausar campaña
 * @access Private (Agent, Admin)
 */
router.post('/:campaignId/pause',
  authMiddleware,
  requireWriteAccess,
  CampaignController.pause,
);

/**
 * @route POST /api/campaigns/:campaignId/resume
 * @desc Reanudar campaña
 * @access Private (Agent, Admin)
 */
router.post('/:campaignId/resume',
  authMiddleware,
  requireWriteAccess,
  CampaignController.resume,
);

/**
 * @route POST /api/campaigns/:campaignId/stop
 * @desc Detener campaña
 * @access Private (Agent, Admin)
 */
router.post('/:campaignId/stop',
  authMiddleware,
  requireWriteAccess,
  CampaignController.stop,
);

module.exports = router;
