/**
 * 🎯 RUTAS DE AGENTES
 * 
 * Endpoints específicos para gestión de agentes con permisos de módulos.
 * Compatibilidad completa con el frontend.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const express = require('express');
const router = express.Router();
const TeamController = require('../controllers/TeamController');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

/**
 * @route GET /api/agents
 * @desc Obtener lista de agentes
 * @access Private (Admin, Supervisor)
 */
router.get('/', authMiddleware, TeamController.listAgents);

/**
 * @route POST /api/agents
 * @desc Crear nuevo agente
 * @access Private (Solo admin)
 */
router.post('/', 
  authMiddleware,
  requireAdmin,
  TeamController.createAgent
);

/**
 * @route GET /api/agents/:id
 * @desc Obtener agente específico
 * @access Private (Admin, Supervisor, propio agente)
 */
router.get('/:id',
  authMiddleware,
  TeamController.getById
);

/**
 * @route PUT /api/agents/:id
 * @desc Actualizar agente
 * @access Private (Solo admin)
 */
router.put('/:id',
  authMiddleware,
  requireAdmin,
  TeamController.update
);

/**
 * @route DELETE /api/agents/:id
 * @desc Eliminar/desactivar agente
 * @access Private (Solo admin)
 */
router.delete('/:id',
  authMiddleware,
  requireAdmin,
  TeamController.delete
);

module.exports = router;