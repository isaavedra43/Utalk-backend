const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { authMiddleware, requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const ContactController = require('../controllers/ContactController');

const router = express.Router();

/**
 * @route GET /api/contacts
 * @desc Listar contactos con filtros y paginación
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/',
  authMiddleware,
  requireReadAccess,
  validate(schemas.contact.list, 'query'),
  ContactController.list,
);

/**
 * @route POST /api/contacts
 * @desc Crear nuevo contacto
 * @access Private (Agent+)
 */
router.post('/',
  authMiddleware,
  requireWriteAccess,
  validate(schemas.contact.create),
  ContactController.create,
);

/**
 * @route GET /api/contacts/export
 * @desc Exportar contactos a CSV
 * @access Private (Agent+)
 */
router.get('/export',
  authMiddleware,
  requireReadAccess,
  ContactController.export,
);

/**
 * @route GET /api/contacts/search
 * @desc Buscar contactos
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/search',
  authMiddleware,
  requireReadAccess,
  validate(schemas.contact.search, 'query'),
  ContactController.search,
);

/**
 * @route GET /api/contacts/tags
 * @desc Obtener todos los tags de contactos
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/tags',
  authMiddleware,
  requireReadAccess,
  ContactController.getTags,
);

/**
 * @route GET /api/contacts/:contactId
 * @desc Obtener contacto específico
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:contactId',
  authMiddleware,
  requireReadAccess,
  ContactController.getById,
);

/**
 * @route PUT /api/contacts/:contactId
 * @desc Actualizar contacto
 * @access Private (Agent+)
 */
router.put('/:contactId',
  authMiddleware,
  requireWriteAccess,
  validate(schemas.contact.update),
  ContactController.update,
);

/**
 * @route DELETE /api/contacts/:contactId
 * @desc Eliminar contacto
 * @access Private (Agent+)
 */
router.delete('/:contactId',
  authMiddleware,
  requireWriteAccess,
  ContactController.delete,
);

/**
 * @route POST /api/contacts/import
 * @desc Importar contactos desde CSV
 * @access Private (Agent+)
 */
router.post('/import',
  authMiddleware,
  requireWriteAccess,
  ContactController.uploadMiddleware(),
  ContactController.import,
);

/**
 * @route POST /api/contacts/:contactId/tags
 * @desc Agregar tags a contacto
 * @access Private (Agent+)
 */
router.post('/:contactId/tags',
  authMiddleware,
  requireWriteAccess,
  validate(schemas.contact.addTags),
  ContactController.addTags,
);

/**
 * @route DELETE /api/contacts/:contactId/tags
 * @desc Remover tags de contacto
 * @access Private (Agent+)
 */
router.delete('/:contactId/tags',
  authMiddleware,
  requireWriteAccess,
  validate(schemas.contact.removeTags),
  ContactController.removeTags,
);

module.exports = router;
