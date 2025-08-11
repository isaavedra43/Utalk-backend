/**
 * 🔍 RUTAS DE RAG
 * 
 * Endpoints para RAG (Retrieval-Augmented Generation)
 * con administración de documentos y búsquedas.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const express = require('express');
const multer = require('multer');
const Joi = require('joi');
const router = express.Router();

// Middlewares
const { authMiddleware, requireAdminOrQA } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { qaRateLimiter } = require('../middleware/aiRateLimit');

// Controlador
const RAGController = require('../controllers/RAGController');

// Configuración de multer para subida de archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/html',
      'text/xml'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'), false);
    }
  }
});

/**
 * Validaciones Joi para endpoints de RAG
 */
const ragValidators = {
  // Validación para subida de documento
  validateUploadDocument: Joi.object({
    workspaceId: Joi.string().required().min(1).max(100)
      .description('ID del workspace'),
    title: Joi.string().required().min(1).max(200)
      .description('Título del documento'),
    type: Joi.string().valid('pdf', 'txt', 'md', 'html', 'url').default('txt')
      .description('Tipo de documento'),
    storagePath: Joi.string().optional()
      .description('Ruta de almacenamiento (para URLs)'),
    tags: Joi.array().items(Joi.string().max(50)).max(20).default([])
      .description('Tags del documento'),
    metadata: Joi.object().optional()
      .description('Metadatos adicionales')
  }),

  // Validación para listar documentos
  validateListDocuments: Joi.object({
    workspaceId: Joi.string().required().min(1).max(100)
      .description('ID del workspace'),
    limit: Joi.number().integer().min(1).max(50).default(20)
      .description('Límite de documentos'),
    offset: Joi.number().integer().min(0).default(0)
      .description('Offset para paginación'),
    status: Joi.string().valid('ready', 'processing', 'error').optional()
      .description('Filtrar por estado'),
    type: Joi.string().valid('pdf', 'txt', 'md', 'html', 'url').optional()
      .description('Filtrar por tipo'),
    tags: Joi.string().optional()
      .description('Tags separados por coma'),
    q: Joi.string().optional()
      .description('Query de búsqueda')
  }),

  // Validación para reindexar documentos
  validateReindexDocuments: Joi.object({
    workspaceId: Joi.string().required().min(1).max(100)
      .description('ID del workspace'),
    docIds: Joi.array().items(Joi.string()).optional()
      .description('IDs de documentos específicos (si no se proporciona, reindexa todos)')
  }),

  // Validación para búsqueda de documentos
  validateSearchDocuments: Joi.object({
    workspaceId: Joi.string().required().min(1).max(100)
      .description('ID del workspace'),
    query: Joi.string().required().min(1).max(500)
      .description('Query de búsqueda'),
    topK: Joi.number().integer().min(1).max(10).default(3)
      .description('Número máximo de resultados'),
    filters: Joi.object({
      tags: Joi.array().items(Joi.string()).optional()
        .description('Filtrar por tags')
    }).optional().default({}),
    minScore: Joi.number().min(0).max(1).default(0.35)
      .description('Score mínimo para resultados')
  }),

  // Validación para workspaceId en params
  validateWorkspaceId: Joi.object({
    workspaceId: Joi.string().required().min(1).max(100)
      .description('ID del workspace')
  }),

  // Validación para docId en params
  validateDocId: Joi.object({
    docId: Joi.string().required().min(1).max(100)
      .description('ID del documento')
  })
};

/**
 * Rutas de documentos RAG
 */

// POST /api/ai/docs/upload - TEMPORALMENTE COMENTADO
/*
router.post('/docs/upload',
  authMiddleware,
  requireAdminOrQA,
  qaRateLimiter,
  upload.single('file'),
  validateRequest(ragValidators.validateUploadDocument, 'body'),
  RAGController.uploadDocument
);
*/

// GET /api/ai/docs/list - TEMPORALMENTE COMENTADO
/*
router.get('/docs/list',
  authMiddleware,
  requireAdminOrQA,
  validateRequest(ragValidators.validateListDocuments, 'query'),
  RAGController.listDocuments
);
*/

// DELETE /api/ai/docs/:docId - TEMPORALMENTE COMENTADO
/*
router.delete('/docs/:docId',
  authMiddleware,
  requireAdminOrQA,
  validateRequest(ragValidators.validateDocId, 'params'),
  validateRequest(Joi.object({
    workspaceId: Joi.string().required()
  }), 'query'),
  RAGController.deleteDocument
);
*/

/**
 * Rutas de RAG - TEMPORALMENTE COMENTADAS
 */

// POST /api/ai/rag/reindex - TEMPORALMENTE COMENTADO
/*
router.post('/rag/reindex',
  authMiddleware,
  requireAdminOrQA,
  qaRateLimiter,
  validateRequest(ragValidators.validateReindexDocuments, 'body'),
  RAGController.reindexDocuments
);
*/

// POST /api/ai/rag/search - TEMPORALMENTE COMENTADO
/*
router.post('/rag/search',
  authMiddleware,
  requireAdminOrQA,
  qaRateLimiter,
  validateRequest(ragValidators.validateSearchDocuments, 'body'),
  RAGController.searchDocuments
);
*/

// GET /api/ai/rag/stats/:workspaceId - TEMPORALMENTE COMENTADO
/*
router.get('/rag/stats/:workspaceId',
  authMiddleware,
  requireAdminOrQA,
  validateRequest(ragValidators.validateWorkspaceId, 'params'),
  RAGController.getRAGStats
);
*/

module.exports = {
  router,
  ragValidators
}; 