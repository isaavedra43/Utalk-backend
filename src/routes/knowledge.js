const express = require('express');
const router = express.Router();
const KnowledgeController = require('../controllers/KnowledgeController');
const { authMiddleware, requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const Joi = require('joi');

// Validadores específicos para knowledge
const knowledgeValidators = {
  validateCreate: validateRequest({
    body: Joi.object({
      title: Joi.string().min(1).max(200).required(),
      content: Joi.string().min(1).max(50000).required(),
      category: Joi.string().max(50).pattern(/^[a-zA-Z0-9_-]+$/).default('general'),
      tags: Joi.array().items(Joi.string().max(50)).max(20).default([]),
      type: Joi.string().valid('article', 'faq', 'video', 'document').default('article'),
      isPublic: Joi.boolean().default(true),
      isPinned: Joi.boolean().default(false),
      fileUrl: Joi.string().uri().optional(),
      fileName: Joi.string().max(255).optional()
    })
  }),

  validateUpdate: validateRequest({
    body: Joi.object({
      title: Joi.string().min(1).max(200),
      content: Joi.string().min(1).max(50000),
      category: Joi.string().max(50).pattern(/^[a-zA-Z0-9_-]+$/),
      tags: Joi.array().items(Joi.string().max(50)).max(20),
      type: Joi.string().valid('article', 'faq', 'video', 'document'),
      isPublic: Joi.boolean(),
      isPinned: Joi.boolean(),
      fileUrl: Joi.string().uri(),
      fileName: Joi.string().max(255)
    })
  }),

  validateSearch: validateRequest({
    query: Joi.object({
      q: Joi.string().min(1).max(200).required(),
      category: Joi.string().max(50).pattern(/^[a-zA-Z0-9_-]+$/),
      type: Joi.string().valid('article', 'faq', 'video', 'document'),
      limit: Joi.number().min(1).max(100).default(20)
    })
  }),

  validateVote: validateRequest({
    body: Joi.object({
      helpful: Joi.boolean().required()
    })
  }),

  validateRate: validateRequest({
    body: Joi.object({
      rating: Joi.number().min(1).max(5).required()
    })
  })
};

/**
 * @route GET /api/knowledge
 * @desc Listar artículos de conocimiento
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/',
  authMiddleware,
  requireReadAccess,
  KnowledgeController.listKnowledge
);

/**
 * @route GET /api/knowledge/search
 * @desc Buscar en base de conocimiento
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/search',
  authMiddleware,
  requireReadAccess,
  knowledgeValidators.validateSearch,
  KnowledgeController.searchKnowledge
);

/**
 * @route GET /api/knowledge/:knowledgeId
 * @desc Obtener artículo por ID
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:knowledgeId',
  authMiddleware,
  requireReadAccess,
  validateRequest({ params: Joi.object({ knowledgeId: Joi.string().uuid().required() }) }),
  KnowledgeController.getKnowledge
);

/**
 * @route POST /api/knowledge
 * @desc Crear nuevo artículo
 * @access Private (Admin)
 */
router.post('/',
  authMiddleware,
  requireWriteAccess,
  knowledgeValidators.validateCreate,
  KnowledgeController.createKnowledge
);

/**
 * @route PUT /api/knowledge/:knowledgeId
 * @desc Actualizar artículo
 * @access Private (Admin)
 */
router.put('/:knowledgeId',
  authMiddleware,
  requireWriteAccess,
  validateRequest({ params: Joi.object({ knowledgeId: Joi.string().uuid().required() }) }),
  knowledgeValidators.validateUpdate,
  KnowledgeController.updateKnowledge
);

/**
 * @route DELETE /api/knowledge/:knowledgeId
 * @desc Eliminar artículo
 * @access Private (Admin)
 */
router.delete('/:knowledgeId',
  authMiddleware,
  requireWriteAccess,
  validateRequest({ params: Joi.object({ knowledgeId: Joi.string().uuid().required() }) }),
  KnowledgeController.deleteKnowledge
);

/**
 * @route PUT /api/knowledge/:knowledgeId/publish
 * @desc Publicar artículo
 * @access Private (Admin)
 */
router.put('/:knowledgeId/publish',
  authMiddleware,
  requireWriteAccess,
  validateRequest({ params: Joi.object({ knowledgeId: Joi.string().uuid().required() }) }),
  KnowledgeController.publishKnowledge
);

/**
 * @route PUT /api/knowledge/:knowledgeId/unpublish
 * @desc Despublicar artículo
 * @access Private (Admin)
 */
router.put('/:knowledgeId/unpublish',
  authMiddleware,
  requireWriteAccess,
  validateRequest({ params: Joi.object({ knowledgeId: Joi.string().uuid().required() }) }),
  KnowledgeController.unpublishKnowledge
);

/**
 * @route POST /api/knowledge/:knowledgeId/vote
 * @desc Votar artículo
 * @access Private (Admin, Agent, Viewer)
 */
router.post('/:knowledgeId/vote',
  authMiddleware,
  requireWriteAccess,
  validateRequest({ params: Joi.object({ knowledgeId: Joi.string().uuid().required() }) }),
  knowledgeValidators.validateVote,
  KnowledgeController.vote
);

/**
 * @route POST /api/knowledge/:knowledgeId/rate
 * @desc Calificar artículo
 * @access Private (Admin, Agent, Viewer)
 */
router.post('/:knowledgeId/rate',
  authMiddleware,
  requireWriteAccess,
  validateRequest({ params: Joi.object({ knowledgeId: Joi.string().uuid().required() }) }),
  knowledgeValidators.validateRate,
  KnowledgeController.rate
);

module.exports = router;
