const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { requireAdmin, requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const KnowledgeController = require('../controllers/KnowledgeController');

const router = express.Router();

/**
 * @route GET /api/knowledge
 * @desc Listar documentos de la base de conocimiento
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/',
  requireReadAccess, // CORREGIDO: Agregado requireReadAccess
  KnowledgeController.list,
);

/**
 * @route POST /api/knowledge
 * @desc Crear nuevo documento
 * @access Private (Agent, Admin)
 */
router.post('/',
  requireWriteAccess, // CORREGIDO: Cambiado a requireWriteAccess para permitir agents
  validate(schemas.knowledge.create),
  KnowledgeController.create,
);

/**
 * @route GET /api/knowledge/search
 * @desc Buscar en la base de conocimiento
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/search',
  requireReadAccess, // CORREGIDO: Agregado requireReadAccess
  KnowledgeController.search,
);

/**
 * @route GET /api/knowledge/categories
 * @desc Obtener categorías disponibles
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/categories',
  requireReadAccess, // CORREGIDO: Agregado requireReadAccess
  KnowledgeController.getCategories,
);

/**
 * @route GET /api/knowledge/:id
 * @desc Obtener documento por ID
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:id',
  requireReadAccess, // CORREGIDO: Agregado requireReadAccess
  KnowledgeController.getById,
);

/**
 * @route PUT /api/knowledge/:id
 * @desc Actualizar documento
 * @access Private (Admin)
 */
router.put('/:id',
  requireAdmin,
  validate(schemas.knowledge.update),
  KnowledgeController.update,
);

/**
 * @route DELETE /api/knowledge/:id
 * @desc Eliminar documento
 * @access Private (Admin)
 */
router.delete('/:id',
  requireAdmin,
  KnowledgeController.delete,
);

/**
 * @route POST /api/knowledge/:id/publish
 * @desc Publicar documento
 * @access Private (Admin)
 */
router.post('/:id/publish',
  requireAdmin,
  KnowledgeController.publish,
);

/**
 * @route POST /api/knowledge/:id/unpublish
 * @desc Despublicar documento
 * @access Private (Admin)
 */
router.post('/:id/unpublish',
  requireAdmin,
  KnowledgeController.unpublish,
);

// EXPORT PATTERN: Single router export (STANDARD for all routes)
// USAGE: const knowledgeRoutes = require('./routes/knowledge');
module.exports = router;
