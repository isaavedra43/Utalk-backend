const Knowledge = require('../models/Knowledge');
const logger = require('../utils/logger');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const { ResponseHandler, ApiError } = require('../utils/responseHandler');

/**
 * Controlador de gestión de conocimiento con Firebase Storage
 */
class KnowledgeController {
  constructor() {
    this.storage = new Storage();
    this.bucket = admin.storage().bucket();
    
    // Configuración de multer para memoria
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        // Permitir solo documentos
        const allowedMimes = [
          'application/pdf',
          'text/plain',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/markdown',
          'application/json'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Tipo de archivo no permitido'), false);
        }
      }
    });
  }

  /**
   * Listar elementos de conocimiento
   */
  async listKnowledge(req, res) {
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
   * Crear nuevo elemento de conocimiento
   */
  async createKnowledge(req, res) {
    try {
      const { title, content, category, tags = [], isPublic = false } = req.body;
      const userEmail = req.user.email;

      let attachmentUrl = null;
      
      // Si hay archivo adjunto, subirlo a Firebase Storage
      if (req.file) {
        attachmentUrl = await this.uploadFileToStorage(req.file, 'knowledge');
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
   * Buscar en base de conocimiento
   */
  async searchKnowledge(req, res) {
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
   * Obtener categorías disponibles
   */
  async getCategories(req, res) {
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
   * Obtener elemento específico de conocimiento
   */
  async getKnowledge(req, res) {
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
   * Actualizar elemento de conocimiento
   */
  async updateKnowledge(req, res) {
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
        updates.attachmentUrl = await this.uploadFileToStorage(req.file, 'knowledge');
        
        // Eliminar archivo anterior si existe
        if (knowledge.attachmentUrl) {
          await this.deleteFileFromStorage(knowledge.attachmentUrl);
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
   * Eliminar elemento de conocimiento
   */
  async deleteKnowledge(req, res) {
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
        await this.deleteFileFromStorage(knowledge.attachmentUrl);
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
   * Publicar elemento de conocimiento
   */
  async publishKnowledge(req, res) {
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
   * Despublicar elemento de conocimiento
   */
  async unpublishKnowledge(req, res) {
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
   * Subir archivo a Firebase Storage
   */
  async uploadFileToStorage(file, folder = 'knowledge') {
    try {
      const fileId = uuidv4();
      const extension = file.originalname.split('.').pop();
      const filename = `${fileId}.${extension}`;
      const storagePath = `${folder}/${filename}`;

      const fileRef = this.bucket.file(storagePath);
      
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
   * Eliminar archivo de Firebase Storage
   */
  async deleteFileFromStorage(fileUrl) {
    try {
      // Extraer path del storage desde la URL
      const urlParts = fileUrl.split('/');
      const pathIndex = urlParts.findIndex(part => part === 'o') + 1;
      
      if (pathIndex > 0 && pathIndex < urlParts.length) {
        const encodedPath = urlParts[pathIndex].split('?')[0];
        const storagePath = decodeURIComponent(encodedPath);
        
        const fileRef = this.bucket.file(storagePath);
        await fileRef.delete();
        
        logger.info('Archivo eliminado de Firebase Storage:', { storagePath });
      }
    } catch (error) {
      logger.warn('Error eliminando archivo de Firebase Storage:', error);
      // No lanzar error para no bloquear otras operaciones
    }
  }

  /**
   * Middleware para subida de archivos
   */
  uploadMiddleware() {
    return this.upload.single('attachment');
  }
}

module.exports = new KnowledgeController();
