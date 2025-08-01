const Knowledge = require('../models/Knowledge');
const logger = require('../utils/logger');
const multer = require('multer');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const { ResponseHandler, ApiError } = require('../utils/responseHandler');

/**
 * Controlador de gestión de conocimiento con Firebase Storage
 */
class KnowledgeController {
  /**
   * Obtener bucket de Firebase Storage de forma segura
   */
  static getBucket() {
    try {
      if (!admin.apps.length) {
        throw new Error('Firebase Admin SDK no inicializado');
      }
      return admin.storage().bucket();
    } catch (error) {
      logger.warn('Firebase Storage no disponible:', error.message);
      return {
        file: () => ({
          save: () => Promise.reject(new Error('Storage no disponible')),
          getSignedUrl: () => Promise.reject(new Error('Storage no disponible')),
          delete: () => Promise.reject(new Error('Storage no disponible')),
          exists: () => Promise.resolve([false])
        })
      };
    }
  }

  /**
   * 📚 LISTAR documentos de conocimiento
   */
  static async listKnowledge(req, res, next) {
    try {
      const { 
        category, 
        status = 'published', 
        search, 
        page = 1, 
        limit = 20 
      } = req.query;

      const filters = { status };
      if (category) filters.category = category;
      if (search) filters.search = search;

      const result = await Knowledge.list(filters, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return ResponseHandler.successPaginated(
        res, 
        result.data, 
        result.pagination,
        'Lista de conocimiento obtenida exitosamente'
      );
    } catch (error) {
      logger.error('Error listando conocimiento:', error);
      return ResponseHandler.error(res, new ApiError(
        'KNOWLEDGE_LIST_ERROR',
        'Error obteniendo lista de conocimiento',
        'Intenta nuevamente',
        500
      ));
    }
  }

  /**
   * 📚 CREAR nuevo elemento de conocimiento
   */
  static async createKnowledge(req, res, next) {
    try {
      const { title, content, category, tags = [], isPublic = false } = req.body;
      const userEmail = req.user.email;

      let attachmentUrl = null;
      
      // Si hay archivo adjunto, subirlo a Firebase Storage
      if (req.file) {
        attachmentUrl = await KnowledgeController.uploadFileToStorage(req.file, 'knowledge');
      }

      const knowledgeData = {
        title,
        content,
        category,
        tags: Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim()),
        isPublic,
        attachmentUrl,
        authorEmail: userEmail,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const knowledge = await Knowledge.create(knowledgeData);

      logger.info('Conocimiento creado exitosamente:', {
        id: knowledge.id,
        title: knowledge.title,
        authorEmail: userEmail
      });

      return ResponseHandler.success(
        res,
        knowledge,
        'Elemento de conocimiento creado exitosamente'
      );
    } catch (error) {
      logger.error('Error creando conocimiento:', error);
      return ResponseHandler.error(res, new ApiError(
        'KNOWLEDGE_CREATE_ERROR',
        'Error creando elemento de conocimiento',
        'Verifica los datos e intenta nuevamente',
        500
      ));
    }
  }

  /**
   * 🔍 BUSCAR en base de conocimiento
   */
  static async searchKnowledge(req, res, next) {
    try {
      const { q: query, category, limit = 10 } = req.query;

      if (!query || query.trim().length < 2) {
        return ResponseHandler.error(res, new ApiError(
          'INVALID_SEARCH_QUERY',
          'La consulta de búsqueda debe tener al menos 2 caracteres',
          'Proporciona una consulta más específica',
          400
        ));
      }

      const results = await Knowledge.search(query.trim(), {
        category,
        limit: parseInt(limit),
        status: 'published'
      });

      return ResponseHandler.success(
        res,
        results,
        `Encontrados ${results.length} resultados para "${query}"`
      );
    } catch (error) {
      logger.error('Error buscando conocimiento:', error);
      return ResponseHandler.error(res, new ApiError(
        'KNOWLEDGE_SEARCH_ERROR',
        'Error realizando búsqueda',
        'Intenta con términos diferentes',
        500
      ));
    }
  }

  /**
   * 📚 OBTENER categorías disponibles
   */
  static async getCategories(req, res, next) {
    try {
      const categories = await Knowledge.getCategories();
      
      return ResponseHandler.success(
        res,
        categories,
        'Categorías obtenidas exitosamente'
      );
    } catch (error) {
      logger.error('Error obteniendo categorías:', error);
      return ResponseHandler.error(res, new ApiError(
        'CATEGORIES_ERROR',
        'Error obteniendo categorías',
        'Intenta nuevamente',
        500
      ));
    }
  }

  /**
   * 📚 OBTENER elemento específico de conocimiento
   */
  static async getKnowledge(req, res, next) {
    try {
      const { id } = req.params;
      
      const knowledge = await Knowledge.getById(id);
      
      if (!knowledge) {
        return ResponseHandler.error(res, new ApiError(
          'KNOWLEDGE_NOT_FOUND',
          'Elemento de conocimiento no encontrado',
          'Verifica el ID e intenta nuevamente',
          404
        ));
      }

      return ResponseHandler.success(
        res,
        knowledge,
        'Elemento de conocimiento obtenido exitosamente'
      );
    } catch (error) {
      logger.error('Error obteniendo conocimiento:', error);
      return ResponseHandler.error(res, new ApiError(
        'KNOWLEDGE_GET_ERROR',
        'Error obteniendo elemento de conocimiento',
        'Intenta nuevamente',
        500
      ));
    }
  }

  /**
   * 📝 ACTUALIZAR elemento de conocimiento
   */
  static async updateKnowledge(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const userEmail = req.user.email;

      const knowledge = await Knowledge.getById(id);
      
      if (!knowledge) {
        return ResponseHandler.error(res, new ApiError(
          'KNOWLEDGE_NOT_FOUND',
          'Elemento de conocimiento no encontrado',
          'Verifica el ID e intenta nuevamente',
          404
        ));
      }

      // Verificar permisos
      if (knowledge.authorEmail !== userEmail && !req.user.permissions.includes('manage_knowledge')) {
        return ResponseHandler.error(res, new ApiError(
          'INSUFFICIENT_PERMISSIONS',
          'No tienes permisos para editar este elemento',
          'Contacta al administrador',
          403
        ));
      }

      // Si hay nuevo archivo, subirlo
      if (req.file) {
        updates.attachmentUrl = await KnowledgeController.uploadFileToStorage(req.file, 'knowledge');
        
        // Eliminar archivo anterior si existe
        if (knowledge.attachmentUrl) {
          await KnowledgeController.deleteFileFromStorage(knowledge.attachmentUrl);
        }
      }

      updates.updatedAt = new Date();
      updates.updatedBy = userEmail;

      const updatedKnowledge = await Knowledge.update(id, updates);

      return ResponseHandler.success(
        res,
        updatedKnowledge,
        'Elemento de conocimiento actualizado exitosamente'
      );
    } catch (error) {
      logger.error('Error actualizando conocimiento:', error);
      return ResponseHandler.error(res, new ApiError(
        'KNOWLEDGE_UPDATE_ERROR',
        'Error actualizando elemento de conocimiento',
        'Intenta nuevamente',
        500
      ));
    }
  }

  /**
   * 🗑️ ELIMINAR elemento de conocimiento
   */
  static async deleteKnowledge(req, res, next) {
    try {
      const { id } = req.params;
      const userEmail = req.user.email;

      const knowledge = await Knowledge.getById(id);
      
      if (!knowledge) {
        return ResponseHandler.error(res, new ApiError(
          'KNOWLEDGE_NOT_FOUND',
          'Elemento de conocimiento no encontrado',
          'Verifica el ID e intenta nuevamente',
          404
        ));
      }

      // Verificar permisos
      if (knowledge.authorEmail !== userEmail && !req.user.permissions.includes('manage_knowledge')) {
        return ResponseHandler.error(res, new ApiError(
          'INSUFFICIENT_PERMISSIONS',
          'No tienes permisos para eliminar este elemento',
          'Contacta al administrador',
          403
        ));
      }

      // Eliminar archivo adjunto si existe
      if (knowledge.attachmentUrl) {
        await KnowledgeController.deleteFileFromStorage(knowledge.attachmentUrl);
      }

      await Knowledge.delete(id);

      return ResponseHandler.success(
        res,
        { id },
        'Elemento de conocimiento eliminado exitosamente'
      );
    } catch (error) {
      logger.error('Error eliminando conocimiento:', error);
      return ResponseHandler.error(res, new ApiError(
        'KNOWLEDGE_DELETE_ERROR',
        'Error eliminando elemento de conocimiento',
        'Intenta nuevamente',
        500
      ));
    }
  }

  /**
   * 🔄 PUBLICAR elemento de conocimiento
   */
  static async publishKnowledge(req, res, next) {
    try {
      const { id } = req.params;
      const userEmail = req.user.email;

      const knowledge = await Knowledge.getById(id);
      
      if (!knowledge) {
        return ResponseHandler.error(res, new ApiError(
          'KNOWLEDGE_NOT_FOUND',
          'Elemento de conocimiento no encontrado',
          'Verifica el ID e intenta nuevamente',
          404
        ));
      }

      const updatedKnowledge = await Knowledge.update(id, {
        status: 'published',
        publishedAt: new Date(),
        publishedBy: userEmail,
        updatedAt: new Date()
      });

      return ResponseHandler.success(
        res,
        updatedKnowledge,
        'Elemento de conocimiento publicado exitosamente'
      );
    } catch (error) {
      logger.error('Error publicando conocimiento:', error);
      return ResponseHandler.error(res, new ApiError(
        'KNOWLEDGE_PUBLISH_ERROR',
        'Error publicando elemento de conocimiento',
        'Intenta nuevamente',
        500
      ));
    }
  }

  /**
   * 🚫 DESPUBLICAR elemento de conocimiento
   */
  static async unpublishKnowledge(req, res, next) {
    try {
      const { id } = req.params;

      const knowledge = await Knowledge.getById(id);
      
      if (!knowledge) {
        return ResponseHandler.error(res, new ApiError(
          'KNOWLEDGE_NOT_FOUND',
          'Elemento de conocimiento no encontrado',
          'Verifica el ID e intenta nuevamente',
          404
        ));
      }

      const updatedKnowledge = await Knowledge.update(id, {
        status: 'draft',
        unpublishedAt: new Date(),
        updatedAt: new Date()
      });

      return ResponseHandler.success(
        res,
        updatedKnowledge,
        'Elemento de conocimiento despublicado exitosamente'
      );
    } catch (error) {
      logger.error('Error despublicando conocimiento:', error);
      return ResponseHandler.error(res, new ApiError(
        'KNOWLEDGE_UNPUBLISH_ERROR',
        'Error despublicando elemento de conocimiento',
        'Intenta nuevamente',
        500
      ));
    }
  }

  /**
   * 🗑️ Eliminar archivo de Firebase Storage
   */
  static async deleteFileFromStorage(fileUrl) {
    try {
      // Extraer path del storage desde la URL
      const urlParts = fileUrl.split('/');
      const pathIndex = urlParts.findIndex(part => part === 'o') + 1;
      
      if (pathIndex > 0 && pathIndex < urlParts.length) {
        const encodedPath = urlParts[pathIndex].split('?')[0];
        const storagePath = decodeURIComponent(encodedPath);
        
        const bucket = KnowledgeController.getBucket();
        const fileRef = bucket.file(storagePath);
        await fileRef.delete();
        
        logger.info('Archivo eliminado de Firebase Storage:', { storagePath });
      }
    } catch (error) {
      logger.warn('Error eliminando archivo de Firebase Storage:', error);
      // No lanzar error para no bloquear otras operaciones
    }
  }

  /**
   * 👍 VOTAR artículo de conocimiento
   */
  static async vote(req, res, next) {
    try {
      const { knowledgeId } = req.params;
      const { voteType } = req.body; // 'up' o 'down'
      const userEmail = req.user.email;

      if (!['up', 'down'].includes(voteType)) {
        return ResponseHandler.error(res, new ApiError(
          'INVALID_VOTE_TYPE',
          'Tipo de voto inválido',
          'El voto debe ser "up" o "down"',
          400
        ));
      }

      const knowledge = await Knowledge.findById(knowledgeId);
      if (!knowledge) {
        return ResponseHandler.error(res, new ApiError(
          'KNOWLEDGE_NOT_FOUND',
          'Artículo no encontrado',
          'El artículo de conocimiento no existe',
          404
        ));
      }

      // Verificar si el usuario ya votó
      const existingVote = knowledge.votes?.find(vote => vote.userEmail === userEmail);
      
      if (existingVote) {
        // Actualizar voto existente
        existingVote.voteType = voteType;
        existingVote.updatedAt = new Date();
      } else {
        // Agregar nuevo voto
        if (!knowledge.votes) knowledge.votes = [];
        knowledge.votes.push({
          userEmail,
          voteType,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      await knowledge.save();

      // Calcular votos totales
      const upVotes = knowledge.votes?.filter(v => v.voteType === 'up').length || 0;
      const downVotes = knowledge.votes?.filter(v => v.voteType === 'down').length || 0;

      logger.info('Voto registrado en conocimiento:', {
        knowledgeId,
        userEmail,
        voteType,
        upVotes,
        downVotes
      });

      return ResponseHandler.success(res, {
        knowledgeId,
        voteType,
        upVotes,
        downVotes,
        totalVotes: upVotes + downVotes
      }, 'Voto registrado exitosamente');
    } catch (error) {
      logger.error('Error registrando voto:', error);
      return ResponseHandler.error(res, new ApiError(
        'VOTE_ERROR',
        'Error registrando voto',
        'Intenta nuevamente',
        500
      ));
    }
  }

  /**
   * ⭐ CALIFICAR artículo de conocimiento
   */
  static async rate(req, res, next) {
    try {
      const { knowledgeId } = req.params;
      const { rating, comment } = req.body;
      const userEmail = req.user.email;

      // Validar rating (1-5 estrellas)
      if (!rating || rating < 1 || rating > 5) {
        return ResponseHandler.error(res, new ApiError(
          'INVALID_RATING',
          'Calificación inválida',
          'La calificación debe estar entre 1 y 5',
          400
        ));
      }

      const knowledge = await Knowledge.findById(knowledgeId);
      if (!knowledge) {
        return ResponseHandler.error(res, new ApiError(
          'KNOWLEDGE_NOT_FOUND',
          'Artículo no encontrado',
          'El artículo de conocimiento no existe',
          404
        ));
      }

      // Verificar si el usuario ya calificó
      const existingRating = knowledge.ratings?.find(r => r.userEmail === userEmail);
      
      if (existingRating) {
        // Actualizar calificación existente
        existingRating.rating = rating;
        existingRating.comment = comment;
        existingRating.updatedAt = new Date();
      } else {
        // Agregar nueva calificación
        if (!knowledge.ratings) knowledge.ratings = [];
        knowledge.ratings.push({
          userEmail,
          rating,
          comment,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      await knowledge.save();

      // Calcular rating promedio
      const totalRatings = knowledge.ratings?.length || 0;
      const averageRating = totalRatings > 0 
        ? knowledge.ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings 
        : 0;

      logger.info('Calificación registrada en conocimiento:', {
        knowledgeId,
        userEmail,
        rating,
        averageRating,
        totalRatings
      });

      return ResponseHandler.success(res, {
        knowledgeId,
        rating,
        averageRating: Math.round(averageRating * 100) / 100,
        totalRatings
      }, 'Calificación registrada exitosamente');
    } catch (error) {
      logger.error('Error registrando calificación:', error);
      return ResponseHandler.error(res, new ApiError(
        'RATING_ERROR',
        'Error registrando calificación',
        'Intenta nuevamente',
        500
      ));
    }
  }

  /**
   * 📤 Subir archivo a Firebase Storage
   */
  static async uploadFileToStorage(file, folder = 'knowledge') {
    try {
      const fileId = uuidv4();
      const extension = file.originalname.split('.').pop();
      const filename = `${fileId}.${extension}`;
      const storagePath = `${folder}/${filename}`;

      const bucket = KnowledgeController.getBucket();
      const fileRef = bucket.file(storagePath);
      
      await fileRef.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
          metadata: {
            originalName: file.originalname,
            uploadedAt: new Date().toISOString(),
            fileId: fileId
          }
        }
      });

      // Generar URL firmada
      const [signedUrl] = await fileRef.getSignedUrl({
        action: 'read',
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 año
      });

      logger.info('Archivo subido a Firebase Storage:', {
        originalName: file.originalname,
        storagePath,
        size: file.size
      });

      return signedUrl;
    } catch (error) {
      logger.error('Error subiendo archivo a Firebase Storage:', error);
      throw error;
    }
  }

  /**
   * Middleware para subida de archivos
   */
  static uploadMiddleware() {
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (req, file, cb) => {
        const allowedTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'image/jpeg',
          'image/png',
          'image/gif'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Tipo de archivo no permitido'));
        }
      }
    });
    
    return upload.single('attachment');
  }
}

module.exports = KnowledgeController;
