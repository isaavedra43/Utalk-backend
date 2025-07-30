const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { requireReadAccess, requireWriteAccess, requireAdmin } = require('../middleware/auth');
const CampaignController = require('../controllers/CampaignController');

const router = express.Router();

/**
 * @route GET /api/campaigns
 * @desc Listar campañas
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/',
  requireReadAccess, // CORREGIDO: Cambiado a requireReadAccess para incluir viewers
  CampaignController.list,
);

/**
 * @route POST /api/campaigns
 * @desc Crear nueva campaña
 * @access Private (Agent, Admin)
 */
router.post('/',
  requireWriteAccess, // CORREGIDO: Cambiado a requireWriteAccess
  validate(schemas.campaign.create),
  CampaignController.create,
);

/**
 * @route GET /api/campaigns/:id
 * @desc Obtener campaña por ID
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:id',
  requireReadAccess, // CORREGIDO: Cambiado a requireReadAccess
  CampaignController.getById,
);

/**
 * @route PUT /api/campaigns/:id
 * @desc Actualizar campaña
 * @access Private (Agent, Admin)
 */
router.put('/:id',
  requireWriteAccess, // CORREGIDO: Cambiado a requireWriteAccess
  validate(schemas.campaign.update),
  CampaignController.update,
);

/**
 * @route DELETE /api/campaigns/:id
 * @desc Eliminar campaña
 * @access Private (Admin)
 */
router.delete('/:id',
  requireAdmin, // CORRECTO: Mantener requireAdmin para operación crítica
  CampaignController.delete,
);

/**
 * @route POST /api/campaigns/:id/send
 * @desc Enviar campaña
 * @access Private (Agent, Admin)
 */
router.post('/:id/send',
  requireWriteAccess, // CORREGIDO: Cambiado a requireWriteAccess
  CampaignController.sendCampaign,
);

/**
 * @route POST /api/campaigns/:id/pause
 * @desc Pausar campaña
 * @access Private (Agent, Admin)
 */
router.post('/:id/pause',
  requireWriteAccess, // CORREGIDO: Cambiado a requireWriteAccess
  CampaignController.pauseCampaign,
);

/**
 * @route POST /api/campaigns/:id/resume
 * @desc Reanudar campaña
 * @access Private (Agent, Admin)
 */
router.post('/:id/resume',
  requireWriteAccess, // CORREGIDO: Cambiado a requireWriteAccess
  CampaignController.resumeCampaign,
);

/**
 * @route GET /api/campaigns/:id/report
 * @desc Obtener reporte de campaña
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:id/report',
  requireReadAccess, // CORREGIDO: Cambiado a requireReadAccess
  CampaignController.getReport,
);

// EXPORT PATTERN: Single router export (STANDARD for all routes)
// USAGE: const campaignRoutes = require('./routes/campaigns');
module.exports = router;
