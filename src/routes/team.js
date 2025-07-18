const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { requireAdmin, requireReadAccess } = require('../middleware/auth');
const TeamController = require('../controllers/TeamController');

const router = express.Router();

/**
 * @route GET /api/team
 * @desc Listar miembros del equipo
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/',
  requireReadAccess, // ✅ CORREGIDO: Agregado requireReadAccess
  TeamController.list,
);

/**
 * @route POST /api/team/invite
 * @desc Invitar nuevo miembro
 * @access Private (Admin)
 */
router.post('/invite',
  requireAdmin, // ✅ CORRECTO: Solo admin puede invitar
  validate(schemas.team.invite),
  TeamController.invite,
);

/**
 * @route GET /api/team/:id
 * @desc Obtener miembro por ID
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:id',
  requireReadAccess, // ✅ CORREGIDO: Agregado requireReadAccess
  TeamController.getById,
);

/**
 * @route PUT /api/team/:id
 * @desc Actualizar miembro del equipo
 * @access Private (Admin)
 */
router.put('/:id',
  requireAdmin,
  validate(schemas.team.update),
  TeamController.update,
);

/**
 * @route DELETE /api/team/:id
 * @desc Eliminar miembro del equipo
 * @access Private (Admin)
 */
router.delete('/:id',
  requireAdmin,
  TeamController.delete,
);

/**
 * @route POST /api/team/:id/activate
 * @desc Activar miembro
 * @access Private (Admin)
 */
router.post('/:id/activate',
  requireAdmin,
  TeamController.activate,
);

/**
 * @route POST /api/team/:id/deactivate
 * @desc Desactivar miembro
 * @access Private (Admin)
 */
router.post('/:id/deactivate',
  requireAdmin,
  TeamController.deactivate,
);

/**
 * @route GET /api/team/:id/kpis
 * @desc Obtener KPIs de un miembro
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:id/kpis',
  requireReadAccess, // ✅ CORREGIDO: Agregado requireReadAccess
  TeamController.getKPIs,
);

/**
 * @route POST /api/team/:id/reset-password
 * @desc Resetear contraseña de miembro
 * @access Private (Admin)
 */
router.post('/:id/reset-password',
  requireAdmin,
  TeamController.resetPassword,
);

// EXPORT PATTERN: Single router export (STANDARD for all routes)
// USAGE: const teamRoutes = require('./routes/team');
module.exports = router;
