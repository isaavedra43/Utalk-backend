const express = require('express');
const { validate, schemas } = require('../utils/validation');
const { requireAgentOrAdmin } = require('../middleware/auth');
const ContactController = require('../controllers/ContactController');

const router = express.Router();

/**
 * @route GET /api/contacts
 * @desc Listar contactos con filtros y paginación
 * @access Private (Agent+)
 */
router.get('/', 
  validate(schemas.contact.list, 'query'),
  ContactController.list
);

/**
 * @route POST /api/contacts
 * @desc Crear nuevo contacto
 * @access Private (Agent+)
 */
router.post('/', 
  requireAgentOrAdmin,
  validate(schemas.contact.create),
  ContactController.create
);

/**
 * @route GET /api/contacts/search
 * @desc Buscar contactos por texto
 * @access Private (Agent+)
 */
router.get('/search', ContactController.search);

/**
 * @route GET /api/contacts/export
 * @desc Exportar contactos a CSV
 * @access Private (Agent+)
 */
router.get('/export', ContactController.exportCSV);

/**
 * @route GET /api/contacts/tags
 * @desc Obtener todos los tags disponibles
 * @access Private
 */
router.get('/tags', ContactController.getTags);

/**
 * @route GET /api/contacts/:id
 * @desc Obtener contacto por ID
 * @access Private
 */
router.get('/:id', ContactController.getById);

/**
 * @route PUT /api/contacts/:id
 * @desc Actualizar contacto
 * @access Private (Agent+)
 */
router.put('/:id', 
  requireAgentOrAdmin,
  validate(schemas.contact.update),
  ContactController.update
);

/**
 * @route DELETE /api/contacts/:id
 * @desc Eliminar contacto (soft delete)
 * @access Private (Agent+)
 */
router.delete('/:id', 
  requireAgentOrAdmin,
  ContactController.delete
);

/**
 * @route POST /api/contacts/:id/tags
 * @desc Agregar tags a un contacto
 * @access Private (Agent+)
 */
router.post('/:id/tags', 
  requireAgentOrAdmin,
  ContactController.addTags
);

/**
 * @route DELETE /api/contacts/:id/tags
 * @desc Remover tags de un contacto
 * @access Private (Agent+)
 */
router.delete('/:id/tags', 
  requireAgentOrAdmin,
  ContactController.removeTags
);

/**
 * @route POST /api/contacts/import
 * @desc Importar contactos desde CSV
 * @access Private (Agent+)
 */
router.post('/import', 
  requireAgentOrAdmin,
  ContactController.importCSV
);

// EXPORT PATTERN: Single router export (STANDARD for all routes)
// USAGE: const contactRoutes = require('./routes/contacts');
module.exports = router; 