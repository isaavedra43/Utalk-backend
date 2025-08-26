/**
 * 🗄️ VECTOR STORE (STUB)
 * 
 * Stub del vector store para RAG.
 * Simula búsquedas cuando RAG está deshabilitado.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const logger = require('../../utils/logger');

/**
 * Configuración del vector store
 */
const VECTOR_STORE_CONFIG = {
  maxResults: 10,
  minScore: 0.35,
  maxScore: 0.95,
  defaultTopK: 3
};

/**
 * Almacenar vectores en el store (STUB)
 */
async function upsert(vectors, workspaceId) {
  try {
    logger.info('🗄️ Upsert de vectores (STUB)', {
      workspaceId,
      vectorsCount: vectors.length,
      operation: 'upsert',
      note: 'RAG deshabilitado - vectores simulados'
    });

    // Simular almacenamiento
    const storedVectors = vectors.map(vector => ({
      id: vector.id,
      docId: vector.docId,
      stored: true,
      timestamp: new Date().toISOString(),
      stub: true
    }));

    return {
      success: true,
      stored: storedVectors.length,
      failed: 0,
      note: 'RAG deshabilitado - vectores simulados'
    };
  } catch (error) {
    logger.error('❌ Error en upsert de vectores (STUB)', {
      workspaceId,
      vectorsCount: vectors.length,
      error: error.message
    });
    throw error;
  }
}

/**
 * Buscar vectores similares (STUB)
 */
async function search(query, options = {}) {
  try {
    const {
      workspaceId,
      topK = VECTOR_STORE_CONFIG.defaultTopK,
      filters = {},
      minScore = VECTOR_STORE_CONFIG.minScore
    } = options;

    logger.info('🗄️ Búsqueda de vectores (STUB)', {
      workspaceId,
      query: query.substring(0, 100),
      topK,
      filters,
      operation: 'search',
      note: 'RAG deshabilitado - búsqueda simulada'
    });

    // Simular búsqueda basada en keywords
    const matches = await simulateKeywordSearch(query, workspaceId, topK, filters, minScore);

    return {
      success: true,
      matches,
      totalMatches: matches.length,
      query: query.substring(0, 100),
      note: 'RAG deshabilitado - búsqueda simulada'
    };
  } catch (error) {
    logger.error('❌ Error en búsqueda de vectores (STUB)', {
      workspaceId: options.workspaceId,
      query: query.substring(0, 100),
      error: error.message
    });
    throw error;
  }
}

/**
 * Simular búsqueda por keywords
 */
async function simulateKeywordSearch(query, workspaceId, topK, filters, minScore) {
  try {
    // Simular documentos basados en la query
    const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
    const matches = [];

    // Generar resultados simulados
    for (let i = 0; i < Math.min(topK, 5); i++) {
      const score = Math.random() * (VECTOR_STORE_CONFIG.maxScore - minScore) + minScore;
      
      if (score >= minScore) {
        const docId = `doc_${workspaceId}_${i + 1}`;
        const chunkId = `${docId}#chunk_${(i + 1).toString().padStart(2, '0')}`;
        
        // Generar snippet basado en la query
        const snippet = generateSimulatedSnippet(query, queryWords);
        
        matches.push({
          id: chunkId,
          docId: docId,
          title: `Documento ${i + 1} - ${queryWords[0] || 'General'}`,
          snippet: snippet,
          score: score,
          tags: filters.tags || ['general'],
          metadata: {
            source: 'stub_search',
            generated: new Date().toISOString(),
            query: query.substring(0, 100)
          }
        });
      }
    }

    // Ordenar por score descendente
    matches.sort((a, b) => b.score - a.score);

    return matches;
  } catch (error) {
    logger.error('❌ Error en búsqueda simulada por keywords', {
      workspaceId,
      query,
      error: error.message
    });
    return [];
  }
}

/**
 * Generar snippet simulado basado en la query
 */
function generateSimulatedSnippet(query, queryWords) {
  const snippets = [
    `Este documento contiene información relevante sobre ${queryWords[0] || 'el tema solicitado'}.`,
    `Aquí encontrarás detalles importantes relacionados con ${queryWords[0] || 'tu consulta'}.`,
    `La información sobre ${queryWords[0] || 'este tema'} está disponible en esta sección.`,
    `Respuesta a tu pregunta sobre ${queryWords[0] || 'el asunto consultado'}.`,
    `Documentación relacionada con ${queryWords[0] || 'la materia de interés'}.`
  ];

  const randomSnippet = snippets[Math.floor(Math.random() * snippets.length)];
  
  // Limitar a 500 caracteres
  return randomSnippet.substring(0, 500);
}

/**
 * Eliminar vectores del store (STUB)
 */
async function deleteVectors(docIds, workspaceId) {
  try {
    logger.info('🗄️ Eliminación de vectores (STUB)', {
      workspaceId,
      docIdsCount: docIds.length,
      operation: 'delete',
      note: 'RAG deshabilitado - eliminación simulada'
    });

    return {
      success: true,
      deleted: docIds.length,
      failed: 0,
      note: 'RAG deshabilitado - eliminación simulada'
    };
  } catch (error) {
    logger.error('❌ Error eliminando vectores (STUB)', {
      workspaceId,
      docIdsCount: docIds.length,
      error: error.message
    });
    throw error;
  }
}

/**
 * Verificar estado del vector store
 */
async function checkVectorStore() {
  try {
    logger.info('🗄️ Verificación de vector store (STUB)', {
      operation: 'health_check',
      note: 'RAG deshabilitado - store simulado'
    });

    return {
      status: 'healthy',
      service: 'vector_store_stub',
      maxResults: VECTOR_STORE_CONFIG.maxResults,
      minScore: VECTOR_STORE_CONFIG.minScore,
      enabled: false,
      note: 'RAG deshabilitado - store simulado'
    };
  } catch (error) {
    logger.error('❌ Error verificando vector store (STUB)', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Obtener estadísticas del vector store
 */
function getVectorStoreStats() {
  return {
    service: 'vector_store_stub',
    status: 'disabled',
    maxResults: VECTOR_STORE_CONFIG.maxResults,
    minScore: VECTOR_STORE_CONFIG.minScore,
    maxScore: VECTOR_STORE_CONFIG.maxScore,
    defaultTopK: VECTOR_STORE_CONFIG.defaultTopK,
    note: 'RAG deshabilitado - estadísticas simuladas'
  };
}

/**
 * Limpiar vectores por workspace
 */
async function clearWorkspace(workspaceId) {
  try {
    logger.info('🗄️ Limpieza de workspace (STUB)', {
      workspaceId,
      operation: 'clear_workspace',
      note: 'RAG deshabilitado - limpieza simulada'
    });

    return {
      success: true,
      cleared: true,
      workspaceId,
      note: 'RAG deshabilitado - limpieza simulada'
    };
  } catch (error) {
    logger.error('❌ Error limpiando workspace (STUB)', {
      workspaceId,
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  VECTOR_STORE_CONFIG,
  upsert,
  search,
  deleteVectors,
  checkVectorStore,
  getVectorStoreStats,
  clearWorkspace,
  simulateKeywordSearch
}; 