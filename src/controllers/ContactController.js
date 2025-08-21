const Contact = require('../models/Contact');
const ContactService = require('../services/ContactService');
const logger = require('../utils/logger');
const { Parser } = require('json2csv');
const csvParser = require('csv-parser');
const multer = require('multer');
const { ResponseHandler, ApiError, CommonErrors } = require('../utils/responseHandler');
const { Readable } = require('stream');
const ContactConversationSyncService = require('../services/ContactConversationSyncService');

/**
 * Controlador de contactos con procesamiento CSV en memoria
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

/**
 * 📇 CONTROLADOR DE CONTACTOS
 * 
 * Maneja endpoints relacionados con contactos y estadísticas
 * usando ContactService centralizado.
 * 
 * @version 1.0.0
 * @author Backend Team
 */
class ContactController {

  /**
   * 📊 GET /api/contacts/stats
   * Estadísticas de contactos para el usuario actual
   */
  static async getContactStats(req, res, next) {
    try {
      const { period = '30d', userId = null } = req.query;

      // 🔒 CONTROL DE PERMISOS
      let targetUserId = req.user.email;
      if (userId && req.user.role === 'admin') {
        targetUserId = userId;
      } else if (userId && req.user.role !== 'admin') {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver estadísticas de otros usuarios', 'contact_stats');
      }

      const filters = {
        userId: targetUserId,
        period
      };

      const stats = await ContactService.getContactStats(filters);

      logger.info('Estadísticas de contactos obtenidas', {
        userEmail: req.user.email,
        targetUserId,
        period,
        totalContacts: stats.total,
        activeContacts: stats.active
      });

      return ResponseHandler.success(res, stats, 'Estadísticas de contactos generadas exitosamente');

    } catch (error) {
      logger.error('Error obteniendo estadísticas de contactos', {
        error: error.message,
        stack: error.stack,
        userEmail: req.user?.email,
        query: req.query
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🔍 GET /api/contacts/search
   * Búsqueda de contactos por teléfono
   */
  static async searchContactByPhone(req, res, next) {
    try {
      // Manejar tanto 'phone' como 'q' para compatibilidad
      const phone = req.query.phone || req.query.q;

      if (!phone) {
        throw CommonErrors.BAD_REQUEST('Teléfono es requerido', 'contact_search');
      }

      logger.info('🔍 Iniciando búsqueda de contacto por teléfono', {
        userEmail: req.user.email,
        phone,
        query: req.query
      });

      const contact = await ContactService.findContactByPhone(phone);

      if (!contact) {
        logger.info('📭 Contacto no encontrado', {
          userEmail: req.user.email,
          phone
        });
        return ResponseHandler.success(res, null, 'Contacto no encontrado', 404);
      }

      logger.info('✅ Búsqueda de contacto completada exitosamente', {
        userEmail: req.user.email,
        phone,
        contactId: contact.id,
        contactName: contact.name,
        isActive: contact.isActive
      });

      return ResponseHandler.success(res, contact.toJSON(), 'Contacto encontrado exitosamente');

    } catch (error) {
      logger.error('❌ Error crítico buscando contacto por teléfono', {
        error: error.message,
        stack: error.stack,
        userEmail: req.user?.email,
        query: req.query,
        phone: req.query.phone || req.query.q
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 📱 BUSCAR CONTACTO POR TELÉFONO
   * Método estático para buscar contacto por número de teléfono
   */
  static async findByPhone(phone) {
    try {
      const contact = await ContactService.findContactByPhone(phone);
      return contact;
    } catch (error) {
      logger.error('Error buscando contacto por teléfono', {
        error: error.message,
        phone
      });
      return null;
    }
  }

  /**
   * 📊 OBTENER ESTADÍSTICAS DE CONTACTO
   * Método estático para obtener estadísticas de un contacto específico
   */
  static async getContactStats(contactId) {
    try {
      const stats = await ContactService.getContactStats({ contactId });
      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de contacto', {
        error: error.message,
        contactId
      });
      return {
        totalMessages: 0,
        totalConversations: 0,
        lastMessageDate: null,
        averageResponseTime: null
      };
    }
  }

  /**
   * 💬 OBTENER CONVERSACIONES RECIENTES
   * Método estático para obtener conversaciones recientes de un contacto
   */
  static async getRecentConversations(contactId, limit = 5) {
    try {
      const conversations = await ContactService.getRecentConversations(contactId, limit);
      return conversations;
    } catch (error) {
      logger.error('Error obteniendo conversaciones recientes', {
        error: error.message,
        contactId,
        limit
      });
      return [];
    }
  }

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

  /**
   * Middleware de upload para archivos CSV
   */
  static uploadMiddleware() {
    return upload.single('csvFile');
  }

  /**
   * �� POST /api/contacts/sync-conversations
   * Sincronizar todas las conversaciones con sus contactos
   * @access Private (Admin only)
   */
  static async syncConversationsWithContacts(req, res, next) {
    try {
      // 🔒 VALIDAR PERMISOS - Solo admin puede ejecutar sincronización
      if (req.user.role !== 'admin') {
        return ResponseHandler.error(res, new ApiError(
          'USER_NOT_AUTHORIZED',
          'No tienes permisos para ejecutar sincronización',
          'Solo los administradores pueden ejecutar este endpoint',
          403
        ));
      }

      logger.info('🔄 Iniciando sincronización masiva conversaciones-contactos', {
        userEmail: req.user.email,
        timestamp: new Date().toISOString()
      });

      // Ejecutar sincronización masiva
      const result = await ContactConversationSyncService.syncAllConversationsWithContacts();

      logger.info('✅ Sincronización masiva completada', {
        userEmail: req.user.email,
        successCount: result.success,
        failedCount: result.failed,
        totalProcessed: result.success + result.failed
      });

      return ResponseHandler.success(res, {
        success: result.success,
        failed: result.failed,
        totalProcessed: result.success + result.failed,
        successRate: ((result.success / (result.success + result.failed)) * 100).toFixed(2) + '%',
        timestamp: new Date().toISOString()
      }, 'Sincronización completada exitosamente');

    } catch (error) {
      logger.error('❌ Error en sincronización masiva', {
        userEmail: req.user.email,
        error: error.message,
        stack: error.stack
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * 🔄 POST /api/contacts/:phone/sync-conversations
   * Sincronizar conversaciones de un contacto específico
   * @access Private (Admin, Agent)
   */
  static async syncContactConversations(req, res, next) {
    try {
      const { phone } = req.params;

      logger.info('🔄 Iniciando sincronización conversaciones para contacto específico', {
        phone,
        userEmail: req.user.email
      });

      // Ejecutar sincronización para contacto específico
      const success = await ContactConversationSyncService.syncContactWithConversations(phone);

      if (success) {
        logger.info('✅ Sincronización completada para contacto', {
          phone,
          userEmail: req.user.email
        });

        return ResponseHandler.success(res, {
          phone,
          success: true,
          timestamp: new Date().toISOString()
        }, 'Contacto sincronizado exitosamente');
      } else {
        logger.warn('⚠️ Sincronización fallida para contacto', {
          phone,
          userEmail: req.user.email
        });

        return ResponseHandler.error(res, new ApiError(
          'SYNC_FAILED',
          'No se pudo sincronizar el contacto',
          'Verifica que el contacto exista y tenga conversaciones',
          404
        ));
      }

    } catch (error) {
      logger.error('❌ Error sincronizando contacto específico', {
        phone: req.params.phone,
        userEmail: req.user.email,
        error: error.message,
        stack: error.stack
      });
      return ResponseHandler.error(res, error);
    }
  }
}

module.exports = ContactController;
