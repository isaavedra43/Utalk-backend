const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Controladores
const HRDocumentController = require('../controllers/HRDocumentController');

// Middleware
const { authMiddleware } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { intelligentRateLimit } = require('../middleware/intelligentRateLimit');

// Configuración de multer para archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB máximo
    files: 1 // Un archivo por vez
  },
  fileFilter: (req, file, cb) => {
    // Validar tipos de archivo permitidos
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/wmv',
      'audio/mpeg',
      'audio/wav',
      'audio/mp3',
      'audio/ogg',
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'), false);
    }
  }
});

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Aplicar rate limiting inteligente
router.use(intelligentRateLimit);

/**
 * RUTAS DE DOCUMENTOS DE RH
 * Alineadas 100% con especificaciones del Frontend
 * Endpoints exactos según requerimientos del modal
 */

// 1. GET /api/hr/documents - Obtener todos los documentos con filtros
router.get('/', HRDocumentController.getDocuments);

// 13. GET /api/hr/documents/summary - Obtener resumen estadístico (ANTES de :documentId)
router.get('/summary', HRDocumentController.getSummary);

// 14. GET /api/hr/documents/search - Búsqueda avanzada (ANTES de :documentId)
router.get('/search', HRDocumentController.searchDocuments);

// 15. GET /api/hr/documents/folders - Obtener todas las carpetas (ANTES de :documentId)
router.get('/folders', HRDocumentController.getFolders);

// 18. GET /api/hr/documents/activity - Obtener historial de actividad (ANTES de :documentId)
router.get('/activity', HRDocumentController.getActivity);

// 19. GET /api/hr/documents/export - Exportar documentos (ANTES de :documentId)
router.get('/export', HRDocumentController.exportDocuments);

// 20. POST /api/hr/documents/initialize - Inicializar módulo (ANTES de :documentId)
router.post('/initialize', HRDocumentController.initializeModule);

// 2. GET /api/hr/documents/:documentId - Obtener documento específico (DESPUÉS de rutas específicas)
router.get('/:documentId', HRDocumentController.getDocumentById);

// 3. POST /api/hr/documents - Subir nuevo documento
router.post('/', 
  upload.single('file'),
  validateRequest(['name', 'category']),
  HRDocumentController.uploadDocument
);

// 4. PUT /api/hr/documents/:documentId - Actualizar metadatos del documento
router.put('/:documentId', HRDocumentController.updateDocument);

// 5. DELETE /api/hr/documents/:documentId - Eliminar documento
router.delete('/:documentId', HRDocumentController.deleteDocument);

// 6. GET /api/hr/documents/:documentId/download - Descargar documento
router.get('/:documentId/download', HRDocumentController.downloadDocument);

// 7. GET /api/hr/documents/:documentId/preview - Obtener URL de vista previa
router.get('/:documentId/preview', HRDocumentController.getPreview);

// 8. PUT /api/hr/documents/:documentId/favorite - Marcar/desmarcar como favorito
router.put('/:documentId/favorite', HRDocumentController.toggleFavorite);

// 9. PUT /api/hr/documents/:documentId/pin - Marcar/desmarcar como fijado
router.put('/:documentId/pin', HRDocumentController.togglePin);

// 10. POST /api/hr/documents/:documentId/share - Compartir documento
router.post('/:documentId/share', 
  validateRequest(['users']),
  HRDocumentController.shareDocument
);

// 11. POST /api/hr/documents/:documentId/duplicate - Duplicar documento
router.post('/:documentId/duplicate', 
  validateRequest(['newName']),
  HRDocumentController.duplicateDocument
);

// 12. PUT /api/hr/documents/:documentId/move - Mover documento a carpeta
router.put('/:documentId/move', 
  validateRequest(['folder']),
  HRDocumentController.moveDocument
);

// 16. POST /api/hr/documents/folders - Crear nueva carpeta
router.post('/folders', 
  validateRequest(['name']),
  HRDocumentController.createFolder
);

// 17. DELETE /api/hr/documents/folders/:folderName - Eliminar carpeta
router.delete('/folders/:folderName', HRDocumentController.deleteFolder);

module.exports = router;
