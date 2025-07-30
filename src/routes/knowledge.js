const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { authMiddleware, requireAdmin, requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const KnowledgeController = require('../controllers/KnowledgeController');

const router = express.Router();

/**
 * @route GET /api/knowledge
 * @desc Listar documentos de la base de conocimiento
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/',
  authMiddleware,
  requireReadAccess,
  KnowledgeController.listKnowledge,
);

/**
 * @route POST /api/knowledge
 * @desc Crear nuevo documento
 * @access Private (Agent, Admin)
 */
router.post('/',
  authMiddleware,
  requireWriteAccess,
  KnowledgeController.uploadMiddleware(),
  validate(schemas.knowledge.create),
  KnowledgeController.createKnowledge,
);

/**
 * @route GET /api/knowledge/search
 * @desc Buscar en la base de conocimiento
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/search',
  authMiddleware,
  requireReadAccess,
  validate(schemas.knowledge.search, 'query'),
  KnowledgeController.searchKnowledge,
);

/**
 * @route GET /api/knowledge/:knowledgeId
 * @desc Obtener documento específico
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:knowledgeId',
  authMiddleware,
  requireReadAccess,
  KnowledgeController.getKnowledge,
);

/**
 * @route PUT /api/knowledge/:knowledgeId
 * @desc Actualizar documento
 * @access Private (Agent, Admin)
 */
router.put('/:knowledgeId',
  authMiddleware,
  requireWriteAccess,
  KnowledgeController.uploadMiddleware(),
  validate(schemas.knowledge.update),
  KnowledgeController.updateKnowledge,
);

/**
 * @route DELETE /api/knowledge/:knowledgeId
 * @desc Eliminar documento
 * @access Private (Agent, Admin)
 */
router.delete('/:knowledgeId',
  authMiddleware,
  requireWriteAccess,
  KnowledgeController.deleteKnowledge,
);

/**
 * @route PUT /api/knowledge/:knowledgeId/publish
 * @desc Publicar documento
 * @access Private (Admin)
 */
router.put('/:knowledgeId/publish',
  authMiddleware,
  requireAdmin,
  KnowledgeController.publishKnowledge,
);

/**
 * @route PUT /api/knowledge/:knowledgeId/unpublish
 * @desc Despublicar documento
 * @access Private (Admin)
 */
router.put('/:knowledgeId/unpublish',
  authMiddleware,
  requireAdmin,
  KnowledgeController.unpublishKnowledge,
);

// EXPORT PATTERN: Single router export (STANDARD for all routes)
// USAGE: const knowledgeRoutes = require('./routes/knowledge');
module.exports = router;
