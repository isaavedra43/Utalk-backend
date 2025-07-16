const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { requireAgentOrAdmin, requireAdmin } = require('../middleware/auth');
const CampaignController = require('../controllers/CampaignController');

const router = express.Router();

/**
 * @route GET /api/campaigns
 * @desc Listar campañas
 * @access Private (Agent+)
 */
router.get('/',
  requireAgentOrAdmin,
  CampaignController.list,
);

/**
 * @route POST /api/campaigns
 * @desc Crear nueva campaña
 * @access Private (Agent+)
 */
router.post('/',
  requireAgentOrAdmin,
  validate(schemas.campaign.create),
  CampaignController.create,
);

/**
 * @route GET /api/campaigns/:id
 * @desc Obtener campaña por ID
 * @access Private (Agent+)
 */
router.get('/:id',
  requireAgentOrAdmin,
  CampaignController.getById,
);

/**
 * @route PUT /api/campaigns/:id
 * @desc Actualizar campaña
 * @access Private (Agent+)
 */
router.put('/:id',
  requireAgentOrAdmin,
  validate(schemas.campaign.update),
  CampaignController.update,
);

/**
 * @route DELETE /api/campaigns/:id
 * @desc Eliminar campaña
 * @access Private (Admin)
 */
router.delete('/:id',
  requireAdmin,
  CampaignController.delete,
);

/**
 * @route POST /api/campaigns/:id/send
 * @desc Enviar campaña
 * @access Private (Agent+)
 */
router.post('/:id/send',
  requireAgentOrAdmin,
  CampaignController.sendCampaign,
);

/**
 * @route POST /api/campaigns/:id/pause
 * @desc Pausar campaña
 * @access Private (Agent+)
 */
router.post('/:id/pause',
  requireAgentOrAdmin,
  CampaignController.pauseCampaign,
);

/**
 * @route POST /api/campaigns/:id/resume
 * @desc Reanudar campaña
 * @access Private (Agent+)
 */
router.post('/:id/resume',
  requireAgentOrAdmin,
  CampaignController.resumeCampaign,
);

/**
 * @route GET /api/campaigns/:id/report
 * @desc Obtener reporte de campaña
 * @access Private (Agent+)
 */
router.get('/:id/report',
  requireAgentOrAdmin,
  CampaignController.getReport,
);

// EXPORT PATTERN: Single router export (STANDARD for all routes)
// USAGE: const campaignRoutes = require('./routes/campaigns');
module.exports = router;
