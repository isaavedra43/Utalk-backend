const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { requireAdmin } = require('../middleware/auth');
const KnowledgeController = require('../controllers/KnowledgeController');

const router = express.Router();

/**
 * @route GET /api/knowledge
 * @desc Listar documentos de la base de conocimiento
 * @access Private
 */
router.get('/', KnowledgeController.list);

/**
 * @route POST /api/knowledge
 * @desc Crear nuevo documento
 * @access Private (Admin)
 */
router.post('/', 
  requireAdmin,
  validate(schemas.knowledge.create),
  KnowledgeController.create
);

/**
 * @route GET /api/knowledge/search
 * @desc Buscar en la base de conocimiento
 * @access Private
 */
router.get('/search', KnowledgeController.search);

/**
 * @route GET /api/knowledge/categories
 * @desc Obtener categorías disponibles
 * @access Private
 */
router.get('/categories', KnowledgeController.getCategories);

/**
 * @route GET /api/knowledge/:id
 * @desc Obtener documento por ID
 * @access Private
 */
router.get('/:id', KnowledgeController.getById);

/**
 * @route PUT /api/knowledge/:id
 * @desc Actualizar documento
 * @access Private (Admin)
 */
router.put('/:id', 
  requireAdmin,
  validate(schemas.knowledge.update),
  KnowledgeController.update
);

/**
 * @route DELETE /api/knowledge/:id
 * @desc Eliminar documento
 * @access Private (Admin)
 */
router.delete('/:id', 
  requireAdmin,
  KnowledgeController.delete
);

/**
 * @route POST /api/knowledge/:id/publish
 * @desc Publicar documento
 * @access Private (Admin)
 */
router.post('/:id/publish', 
  requireAdmin,
  KnowledgeController.publish
);

/**
 * @route POST /api/knowledge/:id/unpublish
 * @desc Despublicar documento
 * @access Private (Admin)
 */
router.post('/:id/unpublish', 
  requireAdmin,
  KnowledgeController.unpublish
);

module.exports = router; 