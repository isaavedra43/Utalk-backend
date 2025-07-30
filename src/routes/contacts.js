const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { requireReadAccess, requireWriteAccess } = require('../middleware/auth');
const ContactController = require('../controllers/ContactController');

const router = express.Router();

/**
 * @route GET /api/contacts
 * @desc Listar contactos con filtros y paginación
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/',
  requireReadAccess, // CORREGIDO: Agregado requireReadAccess para viewers, agents, admins
  validate(schemas.contact.list, 'query'),
  ContactController.list,
);

/**
 * @route POST /api/contacts
 * @desc Crear nuevo contacto
 * @access Private (Agent+)
 */
router.post('/',
  requireWriteAccess, // CORREGIDO: Cambiado a requireWriteAccess (solo agent, admin)
  validate(schemas.contact.create),
  ContactController.create,
);

/**
 * @route GET /api/contacts/search
 * @desc Buscar contactos por texto
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/search',
  requireReadAccess, // CORREGIDO: Agregado requireReadAccess
  ContactController.search,
);

/**
 * @route GET /api/contacts/export
 * @desc Exportar contactos a CSV
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/export',
  requireReadAccess, // CORREGIDO: Agregado requireReadAccess
  ContactController.export,
);

/**
 * @route GET /api/contacts/tags
 * @desc Obtener todos los tags disponibles
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/tags',
  requireReadAccess, // CORREGIDO: Agregado requireReadAccess
  ContactController.getTags,
);

/**
 * @route GET /api/contacts/:id
 * @desc Obtener contacto por ID
 * @access Private (Admin, Agent, Viewer)
 */
router.get('/:id',
  requireReadAccess, // CORREGIDO: Agregado requireReadAccess
  ContactController.getById,
);

/**
 * @route PUT /api/contacts/:id
 * @desc Actualizar contacto
 * @access Private (Agent, Admin)
 */
router.put('/:id',
  requireWriteAccess, // CORREGIDO: Cambiado a requireWriteAccess
  validate(schemas.contact.update),
  ContactController.update,
);

/**
 * @route DELETE /api/contacts/:id
 * @desc Eliminar contacto (soft delete)
 * @access Private (Agent, Admin)
 */
router.delete('/:id',
  requireWriteAccess, // CORREGIDO: Cambiado a requireWriteAccess
  ContactController.delete,
);

/**
 * @route POST /api/contacts/:id/tags
 * @desc Agregar tags a un contacto
 * @access Private (Agent, Admin)
 */
router.post('/:id/tags',
  requireWriteAccess, // CORREGIDO: Cambiado a requireWriteAccess
  ContactController.addTags,
);

/**
 * @route DELETE /api/contacts/:id/tags
 * @desc Remover tags de un contacto
 * @access Private (Agent, Admin)
 */
router.delete('/:id/tags',
  requireWriteAccess, // CORREGIDO: Cambiado a requireWriteAccess
  ContactController.removeTags,
);

/**
 * @route POST /api/contacts/import
 * @desc Importar contactos desde CSV
 * @access Private (Agent, Admin)
 */
router.post('/import',
  requireWriteAccess, // CORREGIDO: Cambiado a requireWriteAccess
  ContactController.import,
);

// EXPORT PATTERN: Single router export (STANDARD for all routes)
// USAGE: const contactRoutes = require('./routes/contacts');
module.exports = router;
