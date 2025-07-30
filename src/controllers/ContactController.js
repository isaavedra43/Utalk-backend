const Contact = require('../models/Contact');
const logger = require('../utils/logger');
const { Parser } = require('json2csv');
const csvParser = require('csv-parser');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const { ResponseHandler, ApiError } = require('../utils/responseHandler');
const { Readable } = require('stream');

/**
 * Controlador de contactos con Firebase Storage para archivos CSV
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos CSV'));
    }
  }
});

class ContactController {
  /**
   * Listar contactos con filtros y paginación
   */
  static async list (req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        tags,
      } = req.query;

      const userEmail = req.user.email;

      const contacts = await Contact.list({
        limit: parseInt(limit),
        page: parseInt(page),
        search,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : null,
        userEmail: req.user.role === 'admin' ? null : userEmail,
      });

      logger.info('Contactos listados', {
        userEmail,
        count: contacts.data.length,
        filters: { search, tags },
      });

      return ResponseHandler.successPaginated(
        res,
        contacts.data,
        contacts.pagination,
        'Lista de contactos obtenida exitosamente'
      );
    } catch (error) {
      logger.error('Error al listar contactos:', error);
      next(error);
    }
  }

  /**
   * Crear nuevo contacto
   */
  static async create (req, res, next) {
    try {
      const contactData = {
        ...req.body,
        createdBy: req.user.email,
        lastModifiedBy: req.user.email,
      };

      // Manejar tags como array
      if (typeof contactData.tags === 'string') {
        contactData.tags = contactData.tags.split(',').map(tag => tag.trim());
      }

      const contact = await Contact.create(contactData);

      logger.info('Contacto creado', {
        contactId: contact.id,
        name: contact.name,
        createdBy: req.user.email,
      });

      return ResponseHandler.success(
        res,
        contact,
        'Contacto creado exitosamente'
      );
    } catch (error) {
      logger.error('Error al crear contacto:', error);
      next(error);
    }
  }

  /**
   * Buscar contactos
   */
  static async search (req, res, next) {
    try {
      const { q: searchTerm, limit = 20 } = req.query;

      if (!searchTerm) {
        return ResponseHandler.error(res, new ApiError(
          'SEARCH_TERM_REQUIRED',
          'El término de búsqueda es requerido',
          'Proporciona un término de búsqueda válido',
          400
        ));
      }

      const contacts = await Contact.search(searchTerm, { limit: parseInt(limit) });

      return ResponseHandler.success(
        res,
        contacts,
        `Encontrados ${contacts.length} contactos para "${searchTerm}"`
      );
    } catch (error) {
      logger.error('Error al buscar contactos:', error);
      next(error);
    }
  }

  /**
   * Exportar contactos a CSV
   */
  static async export (req, res, next) {
    try {
      const { format = 'csv', tags, search } = req.query;

      if (format !== 'csv') {
        return ResponseHandler.error(res, new ApiError(
          'INVALID_FORMAT',
          'Formato de exportación no válido',
          'Solo se admite formato CSV',
          400
        ));
      }

      const contacts = await Contact.list({
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : null,
        search,
        userEmail: req.user.role === 'admin' ? null : req.user.email,
        exportMode: true,
      });

      const fields = ['name', 'email', 'phone', 'company', 'position', 'tags', 'notes'];
      const opts = { fields };
      const parser = new Parser(opts);

      const csv = parser.parse(contacts.data);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="contactos_${Date.now()}.csv"`);
      res.send(csv);

      logger.info('Contactos exportados', {
        userEmail: req.user.email,
        count: contacts.data.length,
        format,
      });
    } catch (error) {
      logger.error('Error al exportar contactos:', error);
      next(error);
    }
  }

  /**
   * Obtener todas las etiquetas disponibles
   */
  static async getTags (req, res, next) {
    try {
      const tags = await Contact.getAllTags();

      return ResponseHandler.success(
        res,
        tags,
        'Etiquetas obtenidas exitosamente'
      );
    } catch (error) {
      logger.error('Error al obtener tags:', error);
      next(error);
    }
  }

  /**
   * Obtener contacto por ID
   */
  static async getById (req, res, next) {
    try {
      const { id } = req.params;
      const contact = await Contact.getById(id);

      if (!contact) {
        return ResponseHandler.error(res, new ApiError(
          'CONTACT_NOT_FOUND',
          'Contacto no encontrado',
          'Verifica el ID e intenta nuevamente',
          404
        ));
      }

      return ResponseHandler.success(
        res,
        contact,
        'Contacto obtenido exitosamente'
      );
    } catch (error) {
      logger.error('Error al obtener contacto:', error);
      next(error);
    }
  }

  /**
   * Actualizar contacto
   */
  static async update (req, res, next) {
    try {
      const { id } = req.params;
      const updates = {
        ...req.body,
        lastModifiedBy: req.user.email,
      };

      if (updates.tags && typeof updates.tags === 'string') {
        updates.tags = updates.tags.split(',').map(tag => tag.trim());
      }

      const contact = await Contact.update(id, updates);

      if (!contact) {
        return ResponseHandler.error(res, new ApiError(
          'CONTACT_NOT_FOUND',
          'Contacto no encontrado',
          'Verifica el ID e intenta nuevamente',
          404
        ));
      }

      logger.info('Contacto actualizado', {
        contactId: contact.id,
        updatedBy: req.user.email,
      });

      return ResponseHandler.success(
        res,
        contact,
        'Contacto actualizado exitosamente'
      );
    } catch (error) {
      logger.error('Error al actualizar contacto:', error);
      next(error);
    }
  }

  /**
   * Eliminar contacto
   */
  static async delete (req, res, next) {
    try {
      const { id } = req.params;

      const deleted = await Contact.delete(id);

      if (!deleted) {
        return ResponseHandler.error(res, new ApiError(
          'CONTACT_NOT_FOUND',
          'Contacto no encontrado',
          'Verifica el ID e intenta nuevamente',
          404
        ));
      }

      logger.info('Contacto eliminado', {
        contactId: id,
        deletedBy: req.user.email,
      });

      return ResponseHandler.success(
        res,
        { id },
        'Contacto eliminado exitosamente'
      );
    } catch (error) {
      logger.error('Error al eliminar contacto:', error);
      next(error);
    }
  }

  /**
   * Agregar etiquetas a contacto
   */
  static async addTags (req, res, next) {
    try {
      const { id } = req.params;
      const { tags } = req.body;

      if (!tags || !Array.isArray(tags)) {
        return ResponseHandler.error(res, new ApiError(
          'INVALID_TAGS',
          'Las etiquetas deben ser un array',
          'Proporciona un array de etiquetas válido',
          400
        ));
      }

      const contact = await Contact.addTags(id, tags);

      if (!contact) {
        return ResponseHandler.error(res, new ApiError(
          'CONTACT_NOT_FOUND',
          'Contacto no encontrado',
          'Verifica el ID e intenta nuevamente',
          404
        ));
      }

      return ResponseHandler.success(
        res,
        contact,
        'Etiquetas agregadas exitosamente'
      );
    } catch (error) {
      logger.error('Error al agregar tags:', error);
      next(error);
    }
  }

  /**
   * Remover etiquetas de contacto
   */
  static async removeTags (req, res, next) {
    try {
      const { id } = req.params;
      const { tags } = req.body;

      if (!tags || !Array.isArray(tags)) {
        return ResponseHandler.error(res, new ApiError(
          'INVALID_TAGS',
          'Las etiquetas deben ser un array',
          'Proporciona un array de etiquetas válido',
          400
        ));
      }

      const contact = await Contact.removeTags(id, tags);

      if (!contact) {
        return ResponseHandler.error(res, new ApiError(
          'CONTACT_NOT_FOUND',
          'Contacto no encontrado',
          'Verifica el ID e intenta nuevamente',
          404
        ));
      }

      return ResponseHandler.success(
        res,
        contact,
        'Etiquetas removidas exitosamente'
      );
    } catch (error) {
      logger.error('Error al remover tags:', error);
      next(error);
    }
  }

  /**
   * Importar contactos desde archivo CSV
   */
  static async import (req, res, next) {
    const uploadHandler = upload.single('csvFile');

    uploadHandler(req, res, async (err) => {
      if (err) {
        return ResponseHandler.error(res, new ApiError(
          'FILE_UPLOAD_ERROR',
          'Error al subir archivo',
          err.message,
          400
        ));
      }

      if (!req.file) {
        return ResponseHandler.error(res, new ApiError(
          'FILE_REQUIRED',
          'Archivo CSV requerido',
          'Sube un archivo CSV válido',
          400
        ));
      }

      try {
        const results = await ContactController.processCsvFromBuffer(req.file.buffer);
        const importResults = await ContactController.importContactsData(results, req.user.email);

        logger.info('Importación de contactos completada', {
          userEmail: req.user.email,
          totalProcessed: importResults.totalProcessed,
          successful: importResults.successful,
          errors: importResults.errors.length,
        });

        return ResponseHandler.success(
          res,
          importResults,
          'Importación de contactos completada'
        );
      } catch (error) {
        logger.error('Error al importar contactos:', error);
        return ResponseHandler.error(res, new ApiError(
          'IMPORT_ERROR',
          'Error procesando archivo CSV',
          error.message,
          500
        ));
      }
    });
  }

  /**
   * Procesar CSV desde buffer en memoria
   */
  static async processCsvFromBuffer(buffer) {
    return new Promise((resolve, reject) => {
      const results = [];
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);

      stream
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error));
    });
  }

  /**
   * Importar datos de contactos procesados
   */
  static async importContactsData(csvData, userEmail) {
    const results = {
      totalProcessed: csvData.length,
      successful: 0,
      errors: [],
    };

    for (let i = 0; i < csvData.length; i++) {
      try {
        const row = csvData[i];
        
        // Validar campos requeridos
        if (!row.name || !row.email) {
          results.errors.push({
            row: i + 1,
            error: 'Nombre y email son requeridos',
            data: row,
          });
          continue;
        }

        // Procesar tags si existen
        let tags = [];
        if (row.tags) {
          tags = row.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        }

        const contactData = {
          name: row.name.trim(),
          email: row.email.trim().toLowerCase(),
          phone: row.phone ? row.phone.trim() : null,
          company: row.company ? row.company.trim() : null,
          position: row.position ? row.position.trim() : null,
          notes: row.notes ? row.notes.trim() : null,
          tags,
          createdBy: userEmail,
          lastModifiedBy: userEmail,
          source: 'import',
        };

        await Contact.create(contactData);
        results.successful++;
      } catch (error) {
        results.errors.push({
          row: i + 1,
          error: error.message,
          data: csvData[i],
        });
      }
    }

    return results;
  }
}

module.exports = ContactController;
