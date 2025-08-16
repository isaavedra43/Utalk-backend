const express = require('express');
const router = express.Router();
const ContactController = require('../controllers/ContactController');
const { validateRequest } = require('../middleware/validation');
const { validatePhoneInBody, validateOptionalPhoneInBody } = require('../middleware/phoneValidation');
const { authMiddleware, requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const Joi = require('joi');

// Validadores específicos para contactos
const contactValidators = {
  validateCreate: validateRequest({
    body: Joi.object({
      phone: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
      name: Joi.string().min(1).max(100).required(),
      email: Joi.string().email().optional(),
      company: Joi.string().min(1).max(100).optional(),
      tags: Joi.array().items(Joi.string()).max(10).optional(),
      metadata: Joi.object().optional()
    })
  }),

  validateUpdate: validateRequest({
    body: Joi.object({
      name: Joi.string().min(1).max(100).optional(),
      email: Joi.string().email().optional(),
      company: Joi.string().min(1).max(100).optional(),
      tags: Joi.array().items(Joi.string()).max(10).optional(),
      metadata: Joi.object().optional()
    })
  }),

  validateImport: validateRequest({
    body: Joi.object({
      contacts: Joi.array().items(Joi.object({
        name: Joi.string().min(2).max(100).required(),
        phone: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
        email: Joi.string().email().optional(),
        company: Joi.string().max(100).optional(),
        tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
      })).min(1).max(1000).required(),
      tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
      updateExisting: Joi.boolean().default(false)
    })
  }),

  validateAddTags: validateRequest({
    body: Joi.object({
      tags: Joi.array().items(Joi.string().max(50)).min(1).max(10).required()
    })
  }),

  validateSearch: validateRequest({
    query: Joi.object({
      phone: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).optional(),
      q: Joi.string().min(1).max(100).optional(),
      tags: Joi.string().optional(),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20)
    })
  }),

  validateStats: validateRequest({
    query: Joi.object({
      period: Joi.string().valid('7d', '30d', '90d', '1y').default('30d'),
      userId: Joi.string().optional()
    })
  })
};

/**
 * @route GET /api/contacts
 * @desc Listar contactos con filtros y paginación
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/',
  authMiddleware,
  requireReadAccess,
  ContactController.list
);

/**
 * @route GET /api/contacts/:contactId
 * @desc Obtener contacto por ID
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:contactId',
  authMiddleware,
  requireReadAccess,
  validateRequest('contactId'),
  ContactController.getById
);

/**
 * @route POST /api/contacts
 * @desc Crear nuevo contacto
 * @access Private (Agent, Admin)
 */
router.post('/',
  authMiddleware,
  requireWriteAccess,
  contactValidators.validateCreate,
  ContactController.create
);

/**
 * @route PUT /api/contacts/:contactId
 * @desc Actualizar contacto
 * @access Private (Agent, Admin)
 */
router.put('/:contactId',
  authMiddleware,
  requireWriteAccess,
  validateRequest('contactId'),
  contactValidators.validateUpdate,
  ContactController.update
);

/**
 * @route DELETE /api/contacts/:contactId
 * @desc Eliminar contacto
 * @access Private (Admin)
 */
router.delete('/:contactId',
  authMiddleware,
  requireWriteAccess,
  validateRequest('contactId'),
  ContactController.delete
);

/**
 * @route POST /api/contacts/import
 * @desc Importar contactos desde archivo
 * @access Private (Agent, Admin)
 */
router.post('/import',
  authMiddleware,
  requireWriteAccess,
  contactValidators.validateImport,
  ContactController.import
);

/**
 * @route POST /api/contacts/:contactId/tags
 * @desc Agregar tags a contacto
 * @access Private (Agent, Admin)
 */
router.post('/:contactId/tags',
  authMiddleware,
  requireWriteAccess,
  validateRequest('contactId'),
  contactValidators.validateAddTags,
  ContactController.addTags
);

/**
 * @route DELETE /api/contacts/:contactId/tags
 * @desc Remover tags de contacto
 * @access Private (Agent, Admin)
 */
router.delete('/:contactId/tags',
  authMiddleware,
  requireWriteAccess,
  validateRequest('contactId'),
  contactValidators.validateAddTags, // Reutilizar validación
  ContactController.removeTags
);

/**
 * @route GET /api/contacts/tags
 * @desc Obtener todos los tags de contactos
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/tags',
  authMiddleware,
  requireReadAccess,
  ContactController.getTags
);

// 📊 NUEVAS RUTAS PARA ESTADÍSTICAS Y BÚSQUEDA
router.get('/stats',
  authMiddleware,
  requireReadAccess,
  contactValidators.validateStats,
  ContactController.getContactStats
);

router.get('/search',
  authMiddleware,
  requireReadAccess,
  contactValidators.validateSearch,
  ContactController.searchContactByPhone
);

module.exports = router;
