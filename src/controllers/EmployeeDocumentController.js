/**
 * 📄 CONTROLADOR DE DOCUMENTOS DE EMPLEADO - VERSIÓN COMPLETA PRODUCTION-READY
 * 
 * Implementa todos los endpoints RESTful requeridos por el frontend
 * para el módulo de archivos de empleados con compatibilidad total.
 * 
 * ENDPOINTS IMPLEMENTADOS:
 * - GET /api/employees/:employeeId/documents (listar documentos)
 * - POST /api/employees/:employeeId/documents (subir documento)
 * - GET /api/employees/:employeeId/documents/:documentId/download (descargar)
 * - DELETE /api/employees/:employeeId/documents/:documentId (eliminar)
 * - GET /api/employees/:employeeId/documents/summary (resumen)
 * - PUT /api/employees/:employeeId/documents/:documentId (actualizar metadatos)
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const EmployeeDocumentService = require('../services/EmployeeDocumentService');
const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
const logger = require('../utils/logger');
const multer = require('multer');

// Configuración de multer para manejo de archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Validación básica de tipo de archivo
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'video/mp4',
      'video/webm'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
    }
  }
});

class EmployeeDocumentController {
  constructor() {
    this.documentService = new EmployeeDocumentService();
  }

  /**
   * 📋 GET /api/employees/:employeeId/documents
   * Lista documentos de un empleado con filtros y paginación
   * 
   * QUERY PARAMS:
   * - search: búsqueda en nombre, descripción y tags
   * - category: filtro por categoría (contract|id|tax|certification|other)
   * - confidential: filtro por confidencialidad (true|false)
   * - page: número de página (default: 1)
   * - limit: resultados por página (default: 20, max: 100)
   * - sortBy: campo de ordenamiento (uploadedAt|originalName|fileSize|category)
   * - sortOrder: orden (asc|desc, default: desc)
   * 
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {function} next - Express next middleware function
   */
  static async listDocuments(req, res, next) {
    try {
      const { employeeId } = req.params;
      const {
        search = '',
        category = '',
        confidential,
        page = 1,
        limit = 20,
        sortBy = 'uploadedAt',
        sortOrder = 'desc'
      } = req.query;

      // Validar parámetros
      const pageNum = parseInt(page);
      const limitNum = Math.min(parseInt(limit), 100); // Máximo 100 resultados

      if (pageNum < 1) {
        return ResponseHandler.validationError(res, 'La página debe ser mayor a 0');
      }

      if (limitNum < 1) {
        return ResponseHandler.validationError(res, 'El límite debe ser mayor a 0');
      }

      const validSortFields = ['uploadedAt', 'originalName', 'fileSize', 'category'];
      if (!validSortFields.includes(sortBy)) {
        return ResponseHandler.validationError(res, `Campo de ordenamiento inválido. Debe ser uno de: ${validSortFields.join(', ')}`);
      }

      const validSortOrders = ['asc', 'desc'];
      if (!validSortOrders.includes(sortOrder)) {
        return ResponseHandler.validationError(res, 'Orden inválido. Debe ser "asc" o "desc"');
      }

      // Parsear confidential
      let confidentialFilter = null;
      if (confidential !== undefined) {
        if (confidential === 'true') {
          confidentialFilter = true;
        } else if (confidential === 'false') {
          confidentialFilter = false;
        } else {
          return ResponseHandler.validationError(res, 'confidential debe ser "true" o "false"');
        }
      }

      const options = {
        page: pageNum,
        limit: limitNum,
        search,
        category,
        confidential: confidentialFilter,
        sortBy,
        sortOrder
      };

      const service = new EmployeeDocumentService();
      const result = await service.listDocuments(employeeId, options);

      // Formatear respuesta para el frontend
      const formattedDocuments = result.documents.map(doc => ({
        id: doc.id,
        employeeId: doc.employeeId,
        fileName: doc.originalName,
        originalName: doc.originalName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        category: doc.category,
        subcategory: doc.subcategory,
        isConfidential: doc.isConfidential,
        tags: doc.tags,
        description: doc.description,
        uploadedBy: doc.uploader.email,
        uploadedAt: doc.uploadedAt,
        lastModified: doc.uploadedAt,
        version: doc.version,
        status: 'active',
        downloadCount: 0,
        filePath: doc.storage.path,
        metadata: doc.metadata
      }));

      logger.info('Documentos listados exitosamente', {
        employeeId,
        totalDocuments: result.pagination.total,
        returnedDocuments: formattedDocuments.length,
        page: pageNum,
        limit: limitNum
      });

      return ResponseHandler.success(res, {
        documents: formattedDocuments,
        totalCount: result.pagination.total,
        categories: ['contract', 'identification', 'payroll', 'medical', 'training', 'performance', 'other'],
        confidentialCount: formattedDocuments.filter(doc => doc.isConfidential).length,
        publicCount: formattedDocuments.filter(doc => !doc.isConfidential).length
      }, 'Documentos obtenidos exitosamente');

    } catch (error) {
      logger.error('Error listando documentos de empleado', {
        employeeId: req.params.employeeId,
        error: error.message,
        stack: error.stack
      });

      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }

      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error listando documentos'));
    }
  }

  /**
   * 📤 POST /api/employees/:employeeId/documents
   * Sube un documento para un empleado
   * 
   * BODY (multipart/form-data):
   * - file: archivo (requerido)
   * - category: categoría del documento (requerido)
   * - description: descripción opcional
   * - tags: tags separados por comas
   * - isConfidential: true|false (requerido)
   * - expiresAt: fecha de expiración ISO (opcional)
   * 
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {function} next - Express next middleware function
   */
  static async uploadDocument(req, res, next) {
    try {
      const { employeeId } = req.params;
      const { 
        category, 
        subcategory,
        description, 
        tags, 
        isConfidential, 
        expiresAt,
        metadata
      } = req.body;
      const file = req.file;

      // Validar que se proporcionó un archivo
      if (!file) {
        return ResponseHandler.validationError(res, 'No se proporcionó ningún archivo');
      }

      // Validar campos requeridos
      if (!category) {
        return ResponseHandler.validationError(res, 'La categoría es requerida');
      }

      if (isConfidential === undefined || isConfidential === null) {
        return ResponseHandler.validationError(res, 'isConfidential es requerido');
      }

      const documentMetadata = {
        category,
        subcategory,
        description,
        tags,
        isConfidential,
        expiresAt,
        metadata: metadata ? JSON.parse(metadata) : {}
      };

      const service = new EmployeeDocumentService();
      const document = await service.uploadDocument(employeeId, file, documentMetadata, req.user);

      // Formatear respuesta para el frontend
      const formattedDocument = {
        id: document.id,
        employeeId: document.employeeId,
        fileName: document.originalName,
        originalName: document.originalName,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        category: document.category,
        subcategory: document.subcategory,
        isConfidential: document.isConfidential,
        tags: document.tags,
        description: document.description,
        uploadedBy: document.uploader.email,
        uploadedAt: document.uploadedAt,
        lastModified: document.uploadedAt,
        version: document.version,
        status: 'active',
        downloadCount: 0,
        filePath: document.storage.path,
        metadata: document.metadata
      };

      logger.info('Documento subido exitosamente', {
        documentId: document.id,
        employeeId,
        fileName: file.originalname,
        fileSize: file.size,
        uploader: req.user.email
      });

      return ResponseHandler.created(res, {
        document: formattedDocument
      }, 'Documento subido correctamente');

    } catch (error) {
      logger.error('Error subiendo documento', {
        employeeId: req.params.employeeId,
        fileName: req.file?.originalname,
        uploader: req.user?.email,
        error: error.message,
        stack: error.stack
      });

      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }

      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error subiendo documento'));
    }
  }

  /**
   * 📥 GET /api/employees/:employeeId/documents/:documentId/download
   * Descarga un documento
   * 
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {function} next - Express next middleware function
   */
  static async downloadDocument(req, res, next) {
    try {
      const { employeeId, documentId } = req.params;

      const service = new EmployeeDocumentService();
      const result = await service.downloadDocument(employeeId, documentId, req.user);

      logger.info('Documento descargado exitosamente', {
        documentId,
        employeeId,
        fileName: result.document.originalName,
        user: req.user.email
      });

      // Redirigir a la URL firmada
      return res.redirect(result.downloadUrl);

    } catch (error) {
      logger.error('Error descargando documento', {
        employeeId: req.params.employeeId,
        documentId: req.params.documentId,
        user: req.user?.email,
        error: error.message,
        stack: error.stack
      });

      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }

      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error descargando documento'));
    }
  }

  /**
   * 🗑️ DELETE /api/employees/:employeeId/documents/:documentId
   * Elimina un documento
   * 
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {function} next - Express next middleware function
   */
  static async deleteDocument(req, res, next) {
    try {
      const { employeeId, documentId } = req.params;

      const service = new EmployeeDocumentService();
      await service.deleteDocument(employeeId, documentId, req.user);

      logger.info('Documento eliminado exitosamente', {
        documentId,
        employeeId,
        user: req.user.email
      });

      return ResponseHandler.deleted(res, 'Documento eliminado correctamente');

    } catch (error) {
      logger.error('Error eliminando documento', {
        employeeId: req.params.employeeId,
        documentId: req.params.documentId,
        user: req.user?.email,
        error: error.message,
        stack: error.stack
      });

      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }

      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error eliminando documento'));
    }
  }

  /**
   * 📊 GET /api/employees/:employeeId/documents/summary
   * Obtiene resumen de documentos de un empleado
   * 
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {function} next - Express next middleware function
   */
  static async getDocumentsSummary(req, res, next) {
    try {
      const { employeeId } = req.params;

      const service = new EmployeeDocumentService();
      const summary = await service.getDocumentsSummary(employeeId);

      logger.info('Resumen de documentos obtenido exitosamente', {
        employeeId,
        totalCount: summary.totalCount,
        totalSize: summary.totalSizeBytes
      });

      return ResponseHandler.success(res, summary, 'Resumen obtenido exitosamente');

    } catch (error) {
      logger.error('Error obteniendo resumen de documentos', {
        employeeId: req.params.employeeId,
        error: error.message,
        stack: error.stack
      });

      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }

      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo resumen'));
    }
  }

  /**
   * ✏️ PUT /api/employees/:employeeId/documents/:documentId
   * Actualiza metadatos de un documento
   * 
   * BODY:
   * - description: nueva descripción
   * - tags: nuevos tags
   * - isConfidential: nuevo estado de confidencialidad
   * - expiresAt: nueva fecha de expiración
   * 
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {function} next - Express next middleware function
   */
  static async updateDocument(req, res, next) {
    try {
      const { employeeId, documentId } = req.params;
      const { description, tags, isConfidential, expiresAt, metadata } = req.body;

      const updateData = {};
      if (description !== undefined) updateData.description = description;
      if (tags !== undefined) updateData.tags = tags;
      if (isConfidential !== undefined) updateData.isConfidential = isConfidential;
      if (expiresAt !== undefined) updateData.expiresAt = expiresAt;
      if (metadata !== undefined) updateData.metadata = metadata;

      // Validar que al menos un campo se está actualizando
      if (Object.keys(updateData).length === 0) {
        return ResponseHandler.validationError(res, 'Debe proporcionar al menos un campo para actualizar');
      }

      const service = new EmployeeDocumentService();
      const document = await service.updateDocument(employeeId, documentId, updateData, req.user);

      // Formatear respuesta para el frontend
      const formattedDocument = {
        id: document.id,
        employeeId: document.employeeId,
        originalName: document.originalName,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        category: document.category,
        description: document.description,
        tags: document.tags,
        isConfidential: document.isConfidential,
        version: document.version,
        uploadedAt: document.uploadedAt,
        expiresAt: document.expiresAt,
        uploader: document.uploader
      };

      logger.info('Documento actualizado exitosamente', {
        documentId,
        employeeId,
        updateData,
        user: req.user.email
      });

      return ResponseHandler.updated(res, {
        document: formattedDocument
      }, 'Documento actualizado correctamente');

    } catch (error) {
      logger.error('Error actualizando documento', {
        employeeId: req.params.employeeId,
        documentId: req.params.documentId,
        user: req.user?.email,
        error: error.message,
        stack: error.stack
      });

      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }

      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error actualizando documento'));
    }
  }

  /**
   * 📈 GET /api/employees/documents/stats
   * Obtiene estadísticas globales de documentos
   * 
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {function} next - Express next middleware function
   */
  static async getGlobalStats(req, res, next) {
    try {
      const service = new EmployeeDocumentService();
      const stats = await service.getGlobalStats();

      logger.info('Estadísticas globales obtenidas exitosamente', {
        totalDocuments: stats.totalDocuments,
        totalSize: stats.totalSizeBytes
      });

      return ResponseHandler.success(res, stats, 'Estadísticas obtenidas exitosamente');

    } catch (error) {
      logger.error('Error obteniendo estadísticas globales', {
        error: error.message,
        stack: error.stack
      });

      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo estadísticas'));
    }
  }

  /**
   * ⏰ GET /api/employees/documents/expiring
   * Obtiene documentos que expiran pronto
   * 
   * QUERY PARAMS:
   * - days: días hacia adelante para buscar (default: 30)
   * 
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {function} next - Express next middleware function
   */
  static async getExpiringDocuments(req, res, next) {
    try {
      const { days = 30 } = req.query;
      const daysNum = parseInt(days);

      if (isNaN(daysNum) || daysNum < 1) {
        return ResponseHandler.validationError(res, 'Los días deben ser un número mayor a 0');
      }

      const service = new EmployeeDocumentService();
      const documents = await service.getExpiringDocuments(daysNum);

      // Formatear respuesta para el frontend
      const formattedDocuments = documents.map(doc => ({
        id: doc.id,
        employeeId: doc.employeeId,
        originalName: doc.originalName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        category: doc.category,
        description: doc.description,
        tags: doc.tags,
        isConfidential: doc.isConfidential,
        version: doc.version,
        uploadedAt: doc.uploadedAt,
        expiresAt: doc.expiresAt,
        uploader: doc.uploader
      }));

      logger.info('Documentos que expiran obtenidos exitosamente', {
        count: formattedDocuments.length,
        days: daysNum
      });

      return ResponseHandler.success(res, {
        documents: formattedDocuments,
        count: formattedDocuments.length,
        days: daysNum
      }, 'Documentos que expiran obtenidos exitosamente');

    } catch (error) {
      logger.error('Error obteniendo documentos que expiran', {
        days: req.query.days,
        error: error.message,
        stack: error.stack
      });

      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo documentos que expiran'));
    }
  }
}

// Middleware de multer para subida de archivos
EmployeeDocumentController.uploadMiddleware = upload.single('file');

module.exports = EmployeeDocumentController;
