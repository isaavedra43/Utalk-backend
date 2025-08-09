/**
 * 📄 REPOSITORIO DE DOCUMENTOS RAG
 * 
 * Maneja operaciones CRUD para documentos de conocimiento en RAG
 * con índices optimizados y validaciones.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { firestore } = require('../config/firebase');
const { Document } = require('../models/Document');
const logger = require('../utils/logger');

class DocumentsRepository {
  constructor() {
    this.collection = 'ai_docs';
  }

  /**
   * Guardar documento en Firestore
   */
  async saveDocument(document) {
    try {
      const documentData = document.toFirestore();
      
      await firestore
        .collection(this.collection)
        .doc(document.id)
        .set(documentData);

      logger.info('✅ Documento guardado exitosamente', {
        docId: document.id,
        workspaceId: document.workspaceId,
        title: document.title,
        type: document.type
      });

      return document;
    } catch (error) {
      logger.error('❌ Error guardando documento', {
        docId: document.id,
        workspaceId: document.workspaceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtener documento por ID
   */
  async getDocumentById(docId) {
    try {
      const doc = await firestore
        .collection(this.collection)
        .doc(docId)
        .get();

      if (!doc.exists) {
        return null;
      }

      const documentData = doc.data();
      return Document.fromFirestore(documentData);
    } catch (error) {
      logger.error('❌ Error obteniendo documento por ID', {
        docId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtener documentos por workspace
   */
  async getDocumentsByWorkspace(workspaceId, options = {}) {
    try {
      const {
        limit = 20,
        offset = 0,
        status = null,
        type = null,
        tags = null,
        query = null
      } = options;

      let queryRef = firestore
        .collection(this.collection)
        .where('workspaceId', '==', workspaceId);

      // Filtrar por status si se especifica
      if (status) {
        queryRef = queryRef.where('status', '==', status);
      }

      // Filtrar por tipo si se especifica
      if (type) {
        queryRef = queryRef.where('type', '==', type);
      }

      // Ordenar por fecha de actualización descendente
      queryRef = queryRef.orderBy('updatedAt', 'desc');

      // Aplicar límites
      if (offset > 0) {
        queryRef = queryRef.offset(offset);
      }

      queryRef = queryRef.limit(limit);

      const snapshot = await queryRef.get();

      let documents = [];
      snapshot.forEach(doc => {
        const documentData = doc.data();
        const document = Document.fromFirestore(documentData);
        
        // Filtrar por tags si se especifica
        if (tags && tags.length > 0) {
          const hasMatchingTag = tags.some(tag => document.tags.includes(tag));
          if (!hasMatchingTag) {
            return;
          }
        }

        // Filtrar por query si se especifica
        if (query) {
          const searchText = query.toLowerCase();
          const titleMatch = document.title.toLowerCase().includes(searchText);
          const tagsMatch = document.tags.some(tag => tag.toLowerCase().includes(searchText));
          
          if (!titleMatch && !tagsMatch) {
            return;
          }
        }

        documents.push(document);
      });

      logger.info('✅ Documentos obtenidos por workspace', {
        workspaceId,
        count: documents.length,
        limit,
        offset,
        filters: { status, type, tags: tags?.length, query: !!query }
      });

      return documents;
    } catch (error) {
      logger.error('❌ Error obteniendo documentos por workspace', {
        workspaceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Buscar documentos con filtros avanzados
   */
  async searchDocuments(filters = {}) {
    try {
      const {
        workspaceId,
        status,
        type,
        tags,
        query,
        limit = 50,
        offset = 0
      } = filters;

      let queryRef = firestore.collection(this.collection);

      // Aplicar filtros
      if (workspaceId) {
        queryRef = queryRef.where('workspaceId', '==', workspaceId);
      }

      if (status) {
        queryRef = queryRef.where('status', '==', status);
      }

      if (type) {
        queryRef = queryRef.where('type', '==', type);
      }

      // Ordenar por fecha
      queryRef = queryRef.orderBy('updatedAt', 'desc');

      // Aplicar límites
      if (offset > 0) {
        queryRef = queryRef.offset(offset);
      }

      queryRef = queryRef.limit(limit);

      const snapshot = await queryRef.get();

      let documents = [];
      snapshot.forEach(doc => {
        const documentData = doc.data();
        const document = Document.fromFirestore(documentData);
        
        // Filtrar por tags si se especifica
        if (tags && tags.length > 0) {
          const hasMatchingTag = tags.some(tag => document.tags.includes(tag));
          if (!hasMatchingTag) {
            return;
          }
        }

        // Filtrar por query si se especifica
        if (query) {
          const searchText = query.toLowerCase();
          const titleMatch = document.title.toLowerCase().includes(searchText);
          const tagsMatch = document.tags.some(tag => tag.toLowerCase().includes(searchText));
          
          if (!titleMatch && !tagsMatch) {
            return;
          }
        }

        documents.push(document);
      });

      logger.info('✅ Búsqueda de documentos completada', {
        filters,
        count: documents.length,
        limit,
        offset
      });

      return documents;
    } catch (error) {
      logger.error('❌ Error buscando documentos', {
        filters,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtener estadísticas de documentos por workspace
   */
  async getDocumentStats(workspaceId) {
    try {
      const documents = await this.getDocumentsByWorkspace(workspaceId, {
        limit: 1000 // Obtener todos para estadísticas
      });

      const stats = {
        totalDocuments: documents.length,
        byType: {},
        byStatus: {},
        byTag: {},
        totalBytes: 0,
        averageBytes: 0
      };

      let totalBytes = 0;

      documents.forEach(doc => {
        // Contar por tipo
        stats.byType[doc.type] = (stats.byType[doc.type] || 0) + 1;

        // Contar por status
        stats.byStatus[doc.status] = (stats.byStatus[doc.status] || 0) + 1;

        // Contar por tags
        doc.tags.forEach(tag => {
          stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
        });

        // Sumar bytes
        totalBytes += doc.bytes;
      });

      stats.totalBytes = totalBytes;
      stats.averageBytes = documents.length > 0 ? totalBytes / documents.length : 0;

      logger.info('✅ Estadísticas de documentos calculadas', {
        workspaceId,
        stats
      });

      return stats;
    } catch (error) {
      logger.error('❌ Error calculando estadísticas de documentos', {
        workspaceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Eliminar documento por ID
   */
  async deleteDocument(docId) {
    try {
      await firestore
        .collection(this.collection)
        .doc(docId)
        .delete();

      logger.info('✅ Documento eliminado exitosamente', {
        docId
      });

      return true;
    } catch (error) {
      logger.error('❌ Error eliminando documento', {
        docId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Actualizar documento
   */
  async updateDocument(docId, updates) {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await firestore
        .collection(this.collection)
        .doc(docId)
        .update(updateData);

      logger.info('✅ Documento actualizado exitosamente', {
        docId,
        updates: Object.keys(updates)
      });

      return true;
    } catch (error) {
      logger.error('❌ Error actualizando documento', {
        docId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Verificar si existe documento con título similar
   */
  async documentExists(workspaceId, title, excludeId = null) {
    try {
      const documents = await this.getDocumentsByWorkspace(workspaceId, {
        limit: 100
      });

      return documents.some(doc => {
        if (excludeId && doc.id === excludeId) {
          return false;
        }
        return doc.title.toLowerCase() === title.toLowerCase();
      });
    } catch (error) {
      logger.error('❌ Error verificando existencia de documento', {
        workspaceId,
        title,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtener documentos por tags
   */
  async getDocumentsByTags(workspaceId, tags) {
    try {
      const documents = await this.getDocumentsByWorkspace(workspaceId, {
        limit: 100
      });

      return documents.filter(doc => 
        tags.some(tag => doc.tags.includes(tag))
      );
    } catch (error) {
      logger.error('❌ Error obteniendo documentos por tags', {
        workspaceId,
        tags,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = DocumentsRepository; 