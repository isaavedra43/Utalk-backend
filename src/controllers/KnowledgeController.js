const Knowledge = require('../models/Knowledge');
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = process.env.UPLOAD_PATH || './uploads';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { 
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Permitir documentos, imágenes y videos
    const allowedTypes = /pdf|doc|docx|txt|jpg|jpeg|png|gif|mp4|avi|mov/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
});

class KnowledgeController {
  /**
   * Listar documentos de conocimiento
   */
  static async list(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        category, 
        type,
        isPublic,
        isPinned,
        tags,
        search,
        sortBy = 'createdAt', 
        sortOrder = 'desc' 
      } = req.query;

      const createdBy = req.user.role === 'admin' ? null : req.user.uid;

      let documents;
      if (search) {
        documents = await Knowledge.search(search, { 
          isPublic: req.user.role !== 'admin' ? true : isPublic,
          category 
        });
      } else {
        documents = await Knowledge.list({
          limit: parseInt(limit),
          category,
          type,
          isPublic: req.user.role !== 'admin' ? true : isPublic,
          isPinned: isPinned === 'true' ? true : isPinned === 'false' ? false : null,
          tags: tags ? (Array.isArray(tags) ? tags : [tags]) : null,
          createdBy,
        });
      }

      logger.info('Documentos de conocimiento listados', { 
        userId: req.user.uid,
        count: documents.length,
        filters: { category, type, isPublic, search }
      });

      res.json({
        documents: documents.map(doc => doc.toJSON()),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: documents.length,
        },
      });
    } catch (error) {
      logger.error('Error al listar documentos:', error);
      next(error);
    }
  }

  /**
   * Crear nuevo documento
   */
  static async create(req, res, next) {
    try {
      const documentData = {
        ...req.body,
        createdBy: req.user.uid,
        lastModifiedBy: req.user.uid,
      };

      // Manejar tags como array
      if (typeof documentData.tags === 'string') {
        documentData.tags = documentData.tags.split(',').map(tag => tag.trim());
      }

      const document = await Knowledge.create(documentData);

      logger.info('Documento de conocimiento creado', { 
        documentId: document.id,
        title: document.title,
        category: document.category,
        createdBy: req.user.uid 
      });

      res.status(201).json({
        message: 'Documento creado exitosamente',
        document: document.toJSON(),
      });
    } catch (error) {
      logger.error('Error al crear documento:', error);
      next(error);
    }
  }

  /**
   * Obtener documento por ID
   */
  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      const document = await Knowledge.getById(id);

      if (!document) {
        return res.status(404).json({
          error: 'Documento no encontrado',
          message: `No se encontró un documento con ID ${id}`,
        });
      }

      // Verificar permisos de lectura
      if (!document.isPublic && req.user.role !== 'admin' && document.createdBy !== req.user.uid) {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'No tienes permisos para ver este documento',
        });
      }

      // Incrementar contador de vistas
      await document.incrementViews();

      // Obtener artículos relacionados
      const relatedArticles = await document.getRelatedArticles();

      res.json({
        document: {
          ...document.toJSON(),
          relatedArticles: relatedArticles.map(article => article.toJSON()),
        },
      });
    } catch (error) {
      logger.error('Error al obtener documento:', error);
      next(error);
    }
  }

  /**
   * Actualizar documento
   */
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const updates = {
        ...req.body,
        lastModifiedBy: req.user.uid,
      };

      const document = await Knowledge.getById(id);
      if (!document) {
        return res.status(404).json({
          error: 'Documento no encontrado',
          message: `No se encontró un documento con ID ${id}`,
        });
      }

      // Verificar permisos (solo admin o creador)
      if (req.user.role !== 'admin' && document.createdBy !== req.user.uid) {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'No tienes permisos para modificar este documento',
        });
      }

      // Manejar tags como array
      if (updates.tags && typeof updates.tags === 'string') {
        updates.tags = updates.tags.split(',').map(tag => tag.trim());
      }

      await document.update(updates);

      logger.info('Documento actualizado', { 
        documentId: document.id,
        updatedBy: req.user.uid,
        fields: Object.keys(updates)
      });

      res.json({
        message: 'Documento actualizado exitosamente',
        document: document.toJSON(),
      });
    } catch (error) {
      logger.error('Error al actualizar documento:', error);
      next(error);
    }
  }

  /**
   * Eliminar documento
   */
  static async delete(req, res, next) {
    try {
      const { id } = req.params;

      const document = await Knowledge.getById(id);
      if (!document) {
        return res.status(404).json({
          error: 'Documento no encontrado',
          message: `No se encontró un documento con ID ${id}`,
        });
      }

      // Verificar permisos (solo admin o creador)
      if (req.user.role !== 'admin' && document.createdBy !== req.user.uid) {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'No tienes permisos para eliminar este documento',
        });
      }

      await document.delete();

      logger.info('Documento eliminado', { 
        documentId: document.id,
        deletedBy: req.user.uid 
      });

      res.json({
        message: 'Documento eliminado exitosamente',
      });
    } catch (error) {
      logger.error('Error al eliminar documento:', error);
      next(error);
    }
  }

  /**
   * Buscar en la base de conocimiento
   */
  static async search(req, res, next) {
    try {
      const { q: searchTerm, category, limit = 20 } = req.query;

      if (!searchTerm) {
        return res.status(400).json({
          error: 'Parámetro requerido',
          message: 'El parámetro de búsqueda "q" es requerido',
        });
      }

      const documents = await Knowledge.search(searchTerm, {
        isPublic: req.user.role !== 'admin' ? true : null,
        category,
      });

      res.json({
        documents: documents.slice(0, parseInt(limit)).map(doc => doc.toJSON()),
        total: documents.length,
        searchTerm,
      });
    } catch (error) {
      logger.error('Error al buscar documentos:', error);
      next(error);
    }
  }

  /**
   * Obtener categorías disponibles
   */
  static async getCategories(req, res, next) {
    try {
      const categories = await Knowledge.getCategories();

      res.json({
        categories,
        total: categories.length,
      });
    } catch (error) {
      logger.error('Error al obtener categorías:', error);
      next(error);
    }
  }

  /**
   * Publicar documento
   */
  static async publish(req, res, next) {
    try {
      const { id } = req.params;

      const document = await Knowledge.getById(id);
      if (!document) {
        return res.status(404).json({
          error: 'Documento no encontrado',
        });
      }

      // Solo admins pueden publicar
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'Solo los administradores pueden publicar documentos',
        });
      }

      await document.publish();

      logger.info('Documento publicado', { 
        documentId: document.id,
        publishedBy: req.user.uid 
      });

      res.json({
        message: 'Documento publicado exitosamente',
        document: document.toJSON(),
      });
    } catch (error) {
      logger.error('Error al publicar documento:', error);
      next(error);
    }
  }

  /**
   * Despublicar documento
   */
  static async unpublish(req, res, next) {
    try {
      const { id } = req.params;

      const document = await Knowledge.getById(id);
      if (!document) {
        return res.status(404).json({
          error: 'Documento no encontrado',
        });
      }

      // Solo admins pueden despublicar
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Sin permisos',
          message: 'Solo los administradores pueden despublicar documentos',
        });
      }

      await document.unpublish();

      logger.info('Documento despublicado', { 
        documentId: document.id,
        unpublishedBy: req.user.uid 
      });

      res.json({
        message: 'Documento despublicado exitosamente',
        document: document.toJSON(),
      });
    } catch (error) {
      logger.error('Error al despublicar documento:', error);
      next(error);
    }
  }

  /**
   * Votar documento como útil
   */
  static async voteHelpful(req, res, next) {
    try {
      const { id } = req.params;

      const document = await Knowledge.getById(id);
      if (!document) {
        return res.status(404).json({
          error: 'Documento no encontrado',
        });
      }

      await document.voteHelpful();

      res.json({
        message: 'Voto registrado exitosamente',
        stats: document.getStats(),
      });
    } catch (error) {
      logger.error('Error al votar documento:', error);
      next(error);
    }
  }

  /**
   * Votar documento como no útil
   */
  static async voteNotHelpful(req, res, next) {
    try {
      const { id } = req.params;

      const document = await Knowledge.getById(id);
      if (!document) {
        return res.status(404).json({
          error: 'Documento no encontrado',
        });
      }

      await document.voteNotHelpful();

      res.json({
        message: 'Voto registrado exitosamente',
        stats: document.getStats(),
      });
    } catch (error) {
      logger.error('Error al votar documento:', error);
      next(error);
    }
  }

  /**
   * Subir archivo adjunto
   */
  static async uploadFile(req, res, next) {
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
          message: 'Debes subir un archivo',
        });
      }

      try {
        const fileInfo = {
          fileName: req.file.originalname,
          fileUrl: `/uploads/${req.file.filename}`,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          uploadedBy: req.user.uid,
          uploadedAt: new Date(),
        };

        logger.info('Archivo subido para conocimiento', {
          fileName: fileInfo.fileName,
          fileSize: fileInfo.fileSize,
          uploadedBy: req.user.uid,
        });

        res.json({
          message: 'Archivo subido exitosamente',
          file: fileInfo,
        });
      } catch (error) {
        // Limpiar archivo en caso de error
        fs.unlinkSync(req.file.path);
        logger.error('Error al procesar archivo:', error);
        next(error);
      }
    });
  }
}

module.exports = KnowledgeController; 