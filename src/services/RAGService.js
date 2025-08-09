/**
 * 🔍 SERVICIO DE RAG (RETRIEVAL-AUGMENTED GENERATION)
 * 
 * Servicio principal para RAG que integra documentos, embeddings
 * y vector store. Funciona en modo stub cuando RAG está deshabilitado.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { Document, DOCUMENT_STATUS } = require('../models/Document');
const DocumentsRepository = require('../repositories/DocumentsRepository');
const { processDocument } = require('../ai/rag/embeddingService');
const { search, upsert, deleteVectors } = require('../ai/rag/vectorStore');
const { getAIConfig, isAIEnabled } = require('../config/aiConfig');
const logger = require('../utils/logger');

class RAGService {
  constructor() {
    this.documentsRepo = new DocumentsRepository();
  }

  /**
   * Verificar si RAG está habilitado
   */
  async isRAGEnabled(workspaceId) {
    try {
      // Verificar flag global
      const globalEnabled = process.env.AI_RAG_ENABLED === 'true';
      
      if (!globalEnabled) {
        return false;
      }

      // Verificar si IA está habilitada para el workspace
      const aiEnabled = await isAIEnabled(workspaceId);
      if (!aiEnabled) {
        return false;
      }

      // Verificar configuración específica de RAG
      const config = await getAIConfig(workspaceId);
      return config.flags.rag === true;
    } catch (error) {
      logger.warn('⚠️ Error verificando estado RAG, asumiendo deshabilitado', {
        workspaceId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Subir documento
   */
  async uploadDocument(workspaceId, documentData, fileBuffer = null) {
    const startTime = Date.now();
    
    try {
      const {
        title,
        type,
        storagePath,
        tags = [],
        metadata = {}
      } = documentData;

      // Verificar si RAG está habilitado
      const ragEnabled = await this.isRAGEnabled(workspaceId);
      
      // Crear documento
      const document = new Document({
        workspaceId,
        title,
        type,
        storagePath,
        bytes: fileBuffer ? fileBuffer.length : 0,
        tags,
        metadata: {
          ...metadata,
          source: fileBuffer ? 'upload' : 'url',
          ragEnabled: ragEnabled
        }
      });

      // Guardar documento
      const savedDocument = await this.documentsRepo.saveDocument(document);

      // Si RAG está habilitado, procesar embeddings
      if (ragEnabled) {
        try {
          document.markAsProcessing();
          await this.documentsRepo.updateDocument(document.id, {
            status: document.status,
            updatedAt: document.updatedAt
          });

          // Procesar documento (stub por ahora)
          await processDocument(document);
          
          document.markAsReady();
          await this.documentsRepo.updateDocument(document.id, {
            status: document.status,
            updatedAt: document.updatedAt
          });

          logger.info('✅ Documento procesado con embeddings (STUB)', {
            docId: document.id,
            workspaceId,
            ragEnabled: true
          });
        } catch (processingError) {
          document.markAsError(processingError.message);
          await this.documentsRepo.updateDocument(document.id, {
            status: document.status,
            updatedAt: document.updatedAt,
            'metadata.error': processingError.message
          });

          logger.warn('⚠️ Error procesando embeddings, documento marcado como error', {
            docId: document.id,
            workspaceId,
            error: processingError.message
          });
        }
      } else {
        logger.info('✅ Documento guardado sin procesamiento (RAG deshabilitado)', {
          docId: document.id,
          workspaceId,
          ragEnabled: false
        });
      }

      const latencyMs = Date.now() - startTime;

      return {
        success: true,
        docId: document.id,
        status: document.status,
        ragEnabled: ragEnabled,
        latencyMs,
        warnings: ragEnabled ? [] : ['RAG deshabilitado - sin embeddings']
      };

    } catch (error) {
      const latencyMs = Date.now() - startTime;
      
      logger.error('❌ Error subiendo documento', {
        workspaceId,
        error: error.message,
        latencyMs
      });

      return {
        success: false,
        error: error.message,
        latencyMs
      };
    }
  }

  /**
   * Buscar documentos relevantes
   */
  async searchDocuments(workspaceId, query, options = {}) {
    const startTime = Date.now();
    
    try {
      const {
        topK = 3,
        filters = {},
        minScore = 0.35
      } = options;

      // Verificar si RAG está habilitado
      const ragEnabled = await this.isRAGEnabled(workspaceId);

      let fragments = [];
      let notes = [];

      if (ragEnabled) {
        // Búsqueda real en vector store (stub por ahora)
        const searchResult = await search(query, {
          workspaceId,
          topK,
          filters,
          minScore
        });

        fragments = searchResult.matches.map(match => ({
          id: match.id,
          docId: match.docId,
          title: match.title,
          snippet: match.snippet,
          score: match.score,
          tags: match.tags
        }));

        notes.push('RAG habilitado - búsqueda vectorial (stub)');
      } else {
        // Búsqueda simulada
        const documents = await this.documentsRepo.getDocumentsByWorkspace(workspaceId, {
          limit: topK * 2,
          status: DOCUMENT_STATUS.READY
        });

        // Simular búsqueda por keywords
        const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
        
        fragments = documents
          .filter(doc => {
            const titleMatch = doc.title.toLowerCase().includes(queryWords[0] || '');
            const tagsMatch = doc.tags.some(tag => 
              queryWords.some(word => tag.toLowerCase().includes(word))
            );
            return titleMatch || tagsMatch;
          })
          .slice(0, topK)
          .map((doc, index) => ({
            id: `${doc.id}#chunk_${index.toString().padStart(2, '0')}`,
            docId: doc.id,
            title: doc.title,
            snippet: `Información relevante sobre ${queryWords[0] || 'el tema'} en ${doc.title}`,
            score: 0.4 + (Math.random() * 0.5), // Score entre 0.4 y 0.9
            tags: doc.tags
          }));

        notes.push('RAG deshabilitado - búsqueda simulada');
      }

      const latencyMs = Date.now() - startTime;

      logger.info('✅ Búsqueda de documentos completada', {
        workspaceId,
        query: query.substring(0, 100),
        fragmentsCount: fragments.length,
        ragEnabled,
        latencyMs
      });

      return {
        ok: true,
        fragments,
        notes,
        latencyMs,
        ragEnabled
      };

    } catch (error) {
      const latencyMs = Date.now() - startTime;
      
      logger.error('❌ Error buscando documentos', {
        workspaceId,
        query: query.substring(0, 100),
        error: error.message,
        latencyMs
      });

      return {
        ok: false,
        fragments: [],
        notes: ['Error en búsqueda'],
        error: error.message,
        latencyMs
      };
    }
  }

  /**
   * Reindexar documentos
   */
  async reindexDocuments(workspaceId, docIds = null) {
    const startTime = Date.now();
    
    try {
      // Verificar si RAG está habilitado
      const ragEnabled = await this.isRAGEnabled(workspaceId);

      if (!ragEnabled) {
        logger.info('🔄 Reindexación simulada (RAG deshabilitado)', {
          workspaceId,
          note: 'RAG deshabilitado - reindexación simulada'
        });

        return {
          success: true,
          reindexed: [],
          note: 'RAG deshabilitado - reindexación simulada',
          latencyMs: Date.now() - startTime
        };
      }

      // Obtener documentos a reindexar
      let documents = [];
      if (docIds) {
        documents = await Promise.all(
          docIds.map(id => this.documentsRepo.getDocumentById(id))
        );
        documents = documents.filter(doc => doc && doc.workspaceId === workspaceId);
      } else {
        documents = await this.documentsRepo.getDocumentsByWorkspace(workspaceId, {
          status: DOCUMENT_STATUS.READY
        });
      }

      const reindexed = [];

      for (const document of documents) {
        try {
          // Marcar como procesando
          document.markAsProcessing();
          document.incrementVersion();
          
          await this.documentsRepo.updateDocument(document.id, {
            status: document.status,
            version: document.version,
            updatedAt: document.updatedAt
          });

          // Procesar documento (stub por ahora)
          await processDocument(document);

          // Marcar como listo
          document.markAsReady();
          await this.documentsRepo.updateDocument(document.id, {
            status: document.status,
            updatedAt: document.updatedAt
          });

          reindexed.push(document.id);

          logger.info('✅ Documento reindexado (STUB)', {
            docId: document.id,
            workspaceId,
            version: document.version
          });
        } catch (error) {
          document.markAsError(error.message);
          await this.documentsRepo.updateDocument(document.id, {
            status: document.status,
            updatedAt: document.updatedAt,
            'metadata.error': error.message
          });

          logger.warn('⚠️ Error reindexando documento', {
            docId: document.id,
            workspaceId,
            error: error.message
          });
        }
      }

      const latencyMs = Date.now() - startTime;

      logger.info('✅ Reindexación completada', {
        workspaceId,
        reindexedCount: reindexed.length,
        totalDocuments: documents.length,
        latencyMs
      });

      return {
        success: true,
        reindexed,
        totalDocuments: documents.length,
        latencyMs
      };

    } catch (error) {
      const latencyMs = Date.now() - startTime;
      
      logger.error('❌ Error en reindexación', {
        workspaceId,
        error: error.message,
        latencyMs
      });

      return {
        success: false,
        error: error.message,
        latencyMs
      };
    }
  }

  /**
   * Obtener documentos por workspace
   */
  async getDocuments(workspaceId, options = {}) {
    try {
      const documents = await this.documentsRepo.getDocumentsByWorkspace(workspaceId, options);
      
      return {
        success: true,
        documents: documents.map(doc => doc.getPreview()),
        total: documents.length
      };
    } catch (error) {
      logger.error('❌ Error obteniendo documentos', {
        workspaceId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Eliminar documento
   */
  async deleteDocument(docId, workspaceId) {
    try {
      // Verificar si RAG está habilitado
      const ragEnabled = await this.isRAGEnabled(workspaceId);

      // Obtener documento
      const document = await this.documentsRepo.getDocumentById(docId);
      if (!document || document.workspaceId !== workspaceId) {
        throw new Error('Documento no encontrado o no pertenece al workspace');
      }

      // Eliminar vectores si RAG está habilitado
      if (ragEnabled) {
        await deleteVectors([docId], workspaceId);
      }

      // Eliminar documento
      await this.documentsRepo.deleteDocument(docId);

      logger.info('✅ Documento eliminado', {
        docId,
        workspaceId,
        ragEnabled
      });

      return {
        success: true,
        docId,
        ragEnabled
      };
    } catch (error) {
      logger.error('❌ Error eliminando documento', {
        docId,
        workspaceId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener estadísticas de RAG
   */
  async getRAGStats(workspaceId) {
    try {
      const ragEnabled = await this.isRAGEnabled(workspaceId);
      const docStats = await this.documentsRepo.getDocumentStats(workspaceId);

      return {
        success: true,
        ragEnabled,
        documents: docStats,
        embeddings: {
          service: 'stub',
          status: ragEnabled ? 'enabled' : 'disabled'
        },
        vectorStore: {
          service: 'stub',
          status: ragEnabled ? 'enabled' : 'disabled'
        }
      };
    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas RAG', {
        workspaceId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = RAGService; 