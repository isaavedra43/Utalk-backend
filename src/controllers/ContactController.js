const Contact = require('../models/Contact');
const logger = require('../utils/logger');
const { Parser } = require('json2csv');
const csvParser = require('csv-parser');
const multer = require('multer');
const fs = require('fs');

// Configuración de multer para subida de archivos
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const userId = req.user.role === 'admin' ? null : req.user.uid;

      const contacts = await Contact.list({
        limit: parseInt(limit),
        search,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : null,
        userId,
      });

      logger.info('Contactos listados', {
        userId: req.user.uid,
        count: contacts.length,
        filters: { search, tags },
      });

      res.json({
        contacts: contacts.map(contact => contact.toJSON()),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: contacts.length,
        },
      });
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
        userId: req.user.uid,
      };

      // Verificar que no exista un contacto con el mismo teléfono
      const existingContact = await Contact.getByPhone(contactData.phone);
      if (existingContact && existingContact.isActive) {
        return res.status(400).json({
          error: 'Contacto ya existe',
          message: `Ya existe un contacto activo con el teléfono ${contactData.phone}`,
        });
      }

      const contact = await Contact.create(contactData);

      logger.info('Contacto creado', {
        contactId: contact.id,
        phone: contact.phone,
        createdBy: req.user.uid,
      });

      res.status(201).json({
        message: 'Contacto creado exitosamente',
        contact: contact.toJSON(),
      });
    } catch (error) {
      logger.error('Error al crear contacto:', error);
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
        return res.status(404).json({
          error: 'Contacto no encontrado',
          message: `No se encontró un contacto con ID ${id}`,
        });
      }

      // Verificar permisos (solo admin o propietario)
      if (req.user.role !== 'admin' && contact.userId !== req.user.uid) {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'No tienes permisos para ver este contacto',
        });
      }

      res.json({
        contact: contact.toJSON(),
      });
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
      const updates = req.body;

      const contact = await Contact.getById(id);
      if (!contact) {
        return res.status(404).json({
          error: 'Contacto no encontrado',
          message: `No se encontró un contacto con ID ${id}`,
        });
      }

      // Verificar permisos
      if (req.user.role !== 'admin' && contact.userId !== req.user.uid) {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'No tienes permisos para modificar este contacto',
        });
      }

      // Si se actualiza el teléfono, verificar que no exista otro contacto
      if (updates.phone && updates.phone !== contact.phone) {
        const existingContact = await Contact.getByPhone(updates.phone);
        if (existingContact && existingContact.id !== contact.id) {
          return res.status(400).json({
            error: 'Teléfono ya existe',
            message: `Ya existe otro contacto con el teléfono ${updates.phone}`,
          });
        }
      }

      await contact.update(updates);

      logger.info('Contacto actualizado', {
        contactId: contact.id,
        updatedBy: req.user.uid,
        fields: Object.keys(updates),
      });

      res.json({
        message: 'Contacto actualizado exitosamente',
        contact: contact.toJSON(),
      });
    } catch (error) {
      logger.error('Error al actualizar contacto:', error);
      next(error);
    }
  }

  /**
   * Eliminar contacto (soft delete)
   */
  static async delete (req, res, next) {
    try {
      const { id } = req.params;

      const contact = await Contact.getById(id);
      if (!contact) {
        return res.status(404).json({
          error: 'Contacto no encontrado',
          message: `No se encontró un contacto con ID ${id}`,
        });
      }

      // Verificar permisos
      if (req.user.role !== 'admin' && contact.userId !== req.user.uid) {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'No tienes permisos para eliminar este contacto',
        });
      }

      await contact.delete();

      logger.info('Contacto eliminado', {
        contactId: contact.id,
        deletedBy: req.user.uid,
      });

      res.json({
        message: 'Contacto eliminado exitosamente',
      });
    } catch (error) {
      logger.error('Error al eliminar contacto:', error);
      next(error);
    }
  }

  /**
   * Buscar contactos por texto
   */
  static async search (req, res, next) {
    try {
      const { q: searchTerm, limit = 20 } = req.query;

      if (!searchTerm) {
        return res.status(400).json({
          error: 'Parámetro requerido',
          message: 'El parámetro de búsqueda "q" es requerido',
        });
      }

      const userId = req.user.role === 'admin' ? null : req.user.uid;
      const contacts = await Contact.search(searchTerm, userId);

      res.json({
        contacts: contacts.slice(0, parseInt(limit)).map(contact => contact.toJSON()),
        total: contacts.length,
      });
    } catch (error) {
      logger.error('Error al buscar contactos:', error);
      next(error);
    }
  }

  /**
   * Obtener todos los tags disponibles
   */
  static async getTags (req, res, next) {
    try {
      const userId = req.user.role === 'admin' ? null : req.user.uid;
      const contacts = await Contact.list({ userId });

      const allTags = contacts.reduce((tags, contact) => {
        return [...tags, ...contact.tags];
      }, []);

      const uniqueTags = [...new Set(allTags)].sort();

      res.json({
        tags: uniqueTags,
        total: uniqueTags.length,
      });
    } catch (error) {
      logger.error('Error al obtener tags:', error);
      next(error);
    }
  }

  /**
   * Agregar tags a un contacto
   */
  static async addTags (req, res, next) {
    try {
      const { id } = req.params;
      const { tags } = req.body;

      if (!Array.isArray(tags) || tags.length === 0) {
        return res.status(400).json({
          error: 'Tags inválidos',
          message: 'Debes proporcionar un array de tags',
        });
      }

      const contact = await Contact.getById(id);
      if (!contact) {
        return res.status(404).json({
          error: 'Contacto no encontrado',
        });
      }

      await contact.addTags(tags);

      res.json({
        message: 'Tags agregados exitosamente',
        contact: contact.toJSON(),
      });
    } catch (error) {
      logger.error('Error al agregar tags:', error);
      next(error);
    }
  }

  /**
   * Remover tags de un contacto
   */
  static async removeTags (req, res, next) {
    try {
      const { id } = req.params;
      const { tags } = req.body;

      const contact = await Contact.getById(id);
      if (!contact) {
        return res.status(404).json({
          error: 'Contacto no encontrado',
        });
      }

      await contact.removeTags(tags);

      res.json({
        message: 'Tags removidos exitosamente',
        contact: contact.toJSON(),
      });
    } catch (error) {
      logger.error('Error al remover tags:', error);
      next(error);
    }
  }

  /**
   * Exportar contactos a CSV
   */
  static async exportCSV (req, res, next) {
    try {
      const userId = req.user.role === 'admin' ? null : req.user.uid;
      const contacts = await Contact.exportToCSV(userId);

      const fields = ['id', 'name', 'phone', 'email', 'tags', 'totalMessages', 'createdAt', 'lastContactAt'];
      const opts = { fields };
      const parser = new Parser(opts);
      const csv = parser.parse(contacts);

      res.header('Content-Type', 'text/csv');
      res.attachment('contactos.csv');
      res.send(csv);

      logger.info('Contactos exportados', {
        userId: req.user.uid,
        count: contacts.length,
      });
    } catch (error) {
      logger.error('Error al exportar contactos:', error);
      next(error);
    }
  }

  /**
   * Importar contactos desde CSV
   */
  static async importCSV (req, res, next) {
    const uploadHandler = upload.single('file');

    uploadHandler(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          error: 'Error de archivo',
          message: err.message,
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'Archivo requerido',
          message: 'Debes subir un archivo CSV',
        });
      }

      try {
        const results = {
          imported: 0,
          errors: [],
          duplicates: 0,
        };

        const contacts = [];

        // Leer y procesar CSV
        await new Promise((resolve, reject) => {
          fs.createReadStream(req.file.path)
            .pipe(csvParser())
            .on('data', (data) => contacts.push(data))
            .on('end', resolve)
            .on('error', reject);
        });

        // Procesar cada contacto
        for (const [index, row] of contacts.entries()) {
          try {
            const { name, phone, email, tags } = row;

            if (!name || !phone) {
              results.errors.push({
                row: index + 1,
                error: 'Nombre y teléfono son requeridos',
              });
              continue;
            }

            // Verificar duplicado
            const existing = await Contact.getByPhone(phone);
            if (existing) {
              results.duplicates++;
              continue;
            }

            // Crear contacto
            await Contact.create({
              name,
              phone,
              email: email || null,
              tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
              userId: req.user.uid,
            });

            results.imported++;
          } catch (error) {
            results.errors.push({
              row: index + 1,
              error: error.message,
            });
          }
        }

        // Limpiar archivo temporal
        fs.unlinkSync(req.file.path);

        logger.info('Contactos importados', {
          userId: req.user.uid,
          imported: results.imported,
          errors: results.errors.length,
          duplicates: results.duplicates,
        });

        res.json({
          message: 'Importación completada',
          results,
        });
      } catch (error) {
        // Limpiar archivo en caso de error
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        logger.error('Error al importar contactos:', error);
        next(error);
      }
    });
  }
}

module.exports = ContactController;
