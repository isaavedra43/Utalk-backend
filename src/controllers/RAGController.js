/**
 * 🔍 CONTROLADOR DE RAG
 * 
 * Maneja endpoints para RAG (Retrieval-Augmented Generation)
 * con administración de documentos y búsquedas.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
const RAGService = require('../services/RAGService');
const { isAIEnabled } = require('../config/aiConfig');
const { Document, ALLOWED_MIME_TYPES } = require('../models/Document');
const logger = require('../utils/logger');

class RAGController {
  constructor() {
    this.ragService = new RAGService();
  }

  /**
   * POST /api/ai/docs/upload
   * Subir documento
   */
  static async uploadDocument(req, res, next) {
    try {
      const {
        workspaceId,
        title,
        type,
        storagePath,
        tags = [],
        metadata = {}
      } = req.body;

      // Verificar permisos (solo admin/QA pueden subir documentos)
      if (!['admin', 'qa'].includes(req.user.role)) {
        throw CommonErrors.USER_NOT_AUTHORIZED('subir documentos RAG');
      }

      // Validar parámetros requeridos
      if (!workspaceId || !title) {
        throw new ApiError(
          'MISSING_PARAMETERS',
          'Parámetros faltantes',
          'workspaceId y title son requeridos',
          400
        );
      }

      // Verificar si IA está habilitada para el workspace
      const aiEnabled = await isAIEnabled(workspaceId);
      if (!aiEnabled) {
        throw new ApiError(
          'AI_DISABLED',
          'IA deshabilitada para este workspace',
          'Habilita IA en la configuración del workspace',
          400
        );
      }

      // Procesar archivo si se subió
      let fileBuffer = null;
      if (req.file) {
        fileBuffer = req.file.buffer;
        
        // Validar MIME type
        if (!ALLOWED_MIME_TYPES[req.file.mimetype]) {
          throw new ApiError(
            'INVALID_MIME_TYPE',
            'Tipo de archivo no permitido',
            `Tipos permitidos: ${Object.keys(ALLOWED_MIME_TYPES).join(', ')}`,
            400
          );
        }

        // Validar tamaño
        if (fileBuffer.length > 10 * 1024 * 1024) { // 10MB
          throw new ApiError(
            'FILE_TOO_LARGE',
            'Archivo demasiado grande',
            'El archivo no puede exceder 10MB',
            400
          );
        }
      }

      // Subir documento
      const result = await new RAGService().uploadDocument(workspaceId, {
        title,
        type,
        storagePath,
        tags,
        metadata: {
          ...metadata,
          userEmail: req.user.email,
          source: req.file ? 'upload' : 'url'
        }
      }, fileBuffer);

      if (!result.success) {
        throw new ApiError(
          'UPLOAD_FAILED',
          'Error subiendo documento',
          result.error,
          500
        );
      }

      logger.info('✅ Documento subido exitosamente', {
        docId: result.docId,
        workspaceId,
        userEmail: req.user.email,
        ragEnabled: result.ragEnabled
      });

      return ResponseHandler.success(res, {
        docId: result.docId,
        status: result.status,
        ragEnabled: result.ragEnabled,
        warnings: result.warnings,
        latencyMs: result.latencyMs
      }, 'Documento subido exitosamente');

    } catch (error) {
      logger.error('❌ Error subiendo documento', {
        workspaceId: req.body?.workspaceId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * GET /api/ai/docs/list
   * Listar documentos
   */
  static async listDocuments(req, res, next) {
    try {
      const { workspaceId } = req.query;
      const { limit = 20, offset = 0, status, type, tags, q } = req.query;

      // Verificar permisos (solo admin/QA pueden listar documentos)
      if (!['admin', 'qa'].includes(req.user.role)) {
        throw CommonErrors.USER_NOT_AUTHORIZED('listar documentos RAG');
      }

      // Validar workspaceId
      if (!workspaceId) {
        throw new ApiError(
          'MISSING_WORKSPACE_ID',
          'workspaceId es requerido',
          'Proporciona el ID del workspace',
          400
        );
      }

      // Obtener documentos
      const result = await new RAGService().getDocuments(workspaceId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        status,
        type,
        tags: tags ? tags.split(',') : null,
        query: q
      });

      if (!result.success) {
        throw new ApiError(
          'DOCUMENTS_FETCH_FAILED',
          'Error obteniendo documentos',
          result.error,
          500
        );
      }

      logger.info('✅ Documentos listados exitosamente', {
        workspaceId,
        userEmail: req.user.email,
        count: result.total
      });

      return ResponseHandler.success(res, {
        documents: result.documents,
        total: result.total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }, 'Documentos obtenidos exitosamente');

    } catch (error) {
      logger.error('❌ Error listando documentos', {
        workspaceId: req.query?.workspaceId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * POST /api/ai/rag/reindex
   * Reindexar documentos
   */
  static async reindexDocuments(req, res, next) {
    try {
      const { workspaceId, docIds } = req.body;

      // Verificar permisos (solo admin/QA pueden reindexar)
      if (!['admin', 'qa'].includes(req.user.role)) {
        throw CommonErrors.USER_NOT_AUTHORIZED('reindexar documentos RAG');
      }

      // Validar workspaceId
      if (!workspaceId) {
        throw new ApiError(
          'MISSING_WORKSPACE_ID',
          'workspaceId es requerido',
          'Proporciona el ID del workspace',
          400
        );
      }

      // Reindexar documentos
      const result = await new RAGService().reindexDocuments(workspaceId, docIds);

      if (!result.success) {
        throw new ApiError(
          'REINDEX_FAILED',
          'Error reindexando documentos',
          result.error,
          500
        );
      }

      logger.info('✅ Documentos reindexados exitosamente', {
        workspaceId,
        userEmail: req.user.email,
        reindexedCount: result.reindexed.length
      });

      return ResponseHandler.success(res, {
        reindexed: result.reindexed,
        totalDocuments: result.totalDocuments,
        note: result.note,
        latencyMs: result.latencyMs
      }, 'Documentos reindexados exitosamente');

    } catch (error) {
      logger.error('❌ Error reindexando documentos', {
        workspaceId: req.body?.workspaceId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * POST /api/ai/rag/search
   * Buscar documentos
   */
  static async searchDocuments(req, res, next) {
    try {
      const {
        workspaceId,
        query,
        topK = 3,
        filters = {},
        minScore = 0.35
      } = req.body;

      // Verificar permisos (solo admin/QA pueden buscar documentos)
      if (!['admin', 'qa'].includes(req.user.role)) {
        throw CommonErrors.USER_NOT_AUTHORIZED('buscar documentos RAG');
      }

      // Validar parámetros
      if (!workspaceId || !query) {
        throw new ApiError(
          'MISSING_PARAMETERS',
          'Parámetros faltantes',
          'workspaceId y query son requeridos',
          400
        );
      }

      // Buscar documentos
      const result = await new RAGService().searchDocuments(workspaceId, query, {
        topK: parseInt(topK),
        filters,
        minScore: parseFloat(minScore)
      });

      if (!result.ok) {
        throw new ApiError(
          'SEARCH_FAILED',
          'Error buscando documentos',
          result.error,
          500
        );
      }

      logger.info('✅ Búsqueda de documentos completada', {
        workspaceId,
        userEmail: req.user.email,
        query: query.substring(0, 100),
        fragmentsCount: result.fragments.length,
        ragEnabled: result.ragEnabled
      });

      return ResponseHandler.success(res, {
        fragments: result.fragments,
        notes: result.notes,
        latencyMs: result.latencyMs,
        ragEnabled: result.ragEnabled
      }, 'Búsqueda completada exitosamente');

    } catch (error) {
      logger.error('❌ Error buscando documentos', {
        workspaceId: req.body?.workspaceId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * DELETE /api/ai/docs/:docId
   * Eliminar documento
   */
  static async deleteDocument(req, res, next) {
    try {
      const { docId } = req.params;
      const { workspaceId } = req.query;

      // Verificar permisos (solo admin puede eliminar documentos)
      if (req.user.role !== 'admin') {
        throw CommonErrors.USER_NOT_AUTHORIZED('eliminar documentos RAG');
      }

      // Validar parámetros
      if (!docId || !workspaceId) {
        throw new ApiError(
          'MISSING_PARAMETERS',
          'Parámetros faltantes',
          'docId y workspaceId son requeridos',
          400
        );
      }

      // Eliminar documento
      const result = await new RAGService().deleteDocument(docId, workspaceId);

      if (!result.success) {
        throw new ApiError(
          'DELETE_FAILED',
          'Error eliminando documento',
          result.error,
          500
        );
      }

      logger.info('✅ Documento eliminado exitosamente', {
        docId,
        workspaceId,
        userEmail: req.user.email
      });

      return ResponseHandler.success(res, {
        docId: result.docId,
        ragEnabled: result.ragEnabled
      }, 'Documento eliminado exitosamente');

    } catch (error) {
      logger.error('❌ Error eliminando documento', {
        docId: req.params?.docId,
        workspaceId: req.query?.workspaceId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }

  /**
   * GET /api/ai/rag/stats/:workspaceId
   * Obtener estadísticas de RAG
   */
  static async getRAGStats(req, res, next) {
    try {
      const { workspaceId } = req.params;

      // Verificar permisos (solo admin/QA pueden ver estadísticas)
      if (!['admin', 'qa'].includes(req.user.role)) {
        throw CommonErrors.USER_NOT_AUTHORIZED('ver estadísticas RAG');
      }

      // Validar workspaceId
      if (!workspaceId) {
        throw new ApiError(
          'MISSING_WORKSPACE_ID',
          'workspaceId es requerido',
          'Proporciona el ID del workspace',
          400
        );
      }

      // Obtener estadísticas
      const result = await new RAGService().getRAGStats(workspaceId);

      if (!result.success) {
        throw new ApiError(
          'STATS_FETCH_FAILED',
          'Error obteniendo estadísticas',
          result.error,
          500
        );
      }

      logger.info('✅ Estadísticas RAG obtenidas', {
        workspaceId,
        userEmail: req.user.email,
        ragEnabled: result.ragEnabled
      });

      return ResponseHandler.success(res, {
        ragEnabled: result.ragEnabled,
        documents: result.documents,
        embeddings: result.embeddings,
        vectorStore: result.vectorStore
      }, 'Estadísticas obtenidas exitosamente');

    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas RAG', {
        workspaceId: req.params?.workspaceId,
        userEmail: req.user?.email,
        error: error.message
      });
      return ResponseHandler.error(res, error);
    }
  }
}

module.exports = RAGController; 