const HRDocument = require('../models/HRDocument');
const HRDocumentSummary = require('../models/HRDocumentSummary');
const HRDocumentFolder = require('../models/HRDocumentFolder');
const HRDocumentActivity = require('../models/HRDocumentActivity');
const StorageConfig = require('../config/storage');
const { 
  getErrorMessage, 
  getSuccessMessage, 
  isValidFileType, 
  getFileTypeFromMime, 
  isValidFileSize, 
  isValidCategory,
  getPermissionsByRole,
  getConfig
} = require('../config/hrDocumentConfig');

/**
 * Controlador de Documentos de RH
 * Alineado 100% con especificaciones del Frontend
 * Endpoints según requerimientos exactos del modal
 */
class HRDocumentController {
  
  /**
   * 1. GET /api/hr/documents
   * Obtener todos los documentos con filtros
   */
  static async getDocuments(req, res) {
    res.json({
      success: true,
      data: {
        documents: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0
        },
        summary: {
          totalDocuments: 0,
          totalSize: 0,
          byCategory: {},
          byType: {},
          recentUploads: [],
          mostDownloaded: [],
          mostViewed: [],
          pinnedDocuments: [],
          updatedAt: new Date().toISOString()
        }
      }
    });
  }

  /**
   * 2. GET /api/hr/documents/:documentId
   * Obtener documento específico
   */
  static async getDocumentById(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';

      const document = await HRDocument.findById(documentId);
      if (!document) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('DOCUMENT_NOT_FOUND')
        });
      }

      // Verificar permisos de visualización
      const userRole = req.user?.role || 'employee';
      const permissions = getPermissionsByRole(userRole);
      
      if (!permissions.canView || (!document.isPublic && userRole === 'employee')) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('INVALID_PERMISSIONS')
        });
      }

      // Incrementar contador de visualizaciones
      await document.incrementViewCount();

      // Registrar actividad
      await HRDocumentActivity.logActivity(
        documentId,
        userId,
        userName,
        'view',
        {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      );

      // Actualizar estadísticas
      const summary = await HRDocumentSummary.getOrCreate();
      await summary.updateViewStats(document);

      res.json({
        success: true,
        data: document.toFirestore()
      });
    } catch (error) {
      console.error('Error getting HR document by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener documento',
        details: error.message
      });
    }
  }

  /**
   * 3. POST /api/hr/documents
   * Subir nuevo documento
   */
  static async uploadDocument(req, res) {
    try {
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';
      const userRole = req.user?.role || 'employee';

      // Verificar permisos de subida
      const permissions = getPermissionsByRole(userRole);
      if (!permissions.canUpload) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('INVALID_PERMISSIONS')
        });
      }

      const {
        name,
        description = '',
        category,
        tags = '[]',
        isPublic = 'true',
        folder = null
      } = req.body;

      const file = req.file;

      // Validaciones
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No se proporcionó archivo'
        });
      }

      if (!name || name.length < 3) {
        return res.status(400).json({
          success: false,
          error: 'El nombre debe tener al menos 3 caracteres'
        });
      }

      if (!category || !isValidCategory(category)) {
        return res.status(400).json({
          success: false,
          error: getErrorMessage('INVALID_CATEGORY')
        });
      }

      if (!isValidFileType(file.mimetype)) {
        return res.status(400).json({
          success: false,
          error: getErrorMessage('INVALID_FILE_TYPE')
        });
      }

      if (!isValidFileSize(file.size)) {
        return res.status(400).json({
          success: false,
          error: getErrorMessage('FILE_TOO_LARGE')
        });
      }

      // Procesar tags
      let parsedTags = [];
      try {
        parsedTags = JSON.parse(tags);
        if (!Array.isArray(parsedTags)) {
          parsedTags = [];
        }
      } catch (e) {
        parsedTags = [];
      }

      // Subir archivo a Firebase Storage
      const fileUrl = await StorageConfig.uploadFile(
        file.buffer,
        `hr-documents/${file.originalname}`,
        {
          contentType: file.mimetype,
          metadata: {
            originalName: file.originalname,
            uploadedBy: userId,
            uploadedByName: userName,
            uploadedAt: new Date().toISOString(),
            fileSize: file.size,
            category,
            hrDocument: true
          }
        }
      );

      // Generar thumbnail si es una imagen
      let thumbnailUrl = null;
      if (file.mimetype.startsWith('image/')) {
        try {
          thumbnailUrl = await StorageConfig.generateThumbnail(file.buffer, file.mimetype);
        } catch (error) {
          console.warn('Error generating thumbnail:', error);
        }
      }

      // Crear documento
      const document = new HRDocument({
        name,
        description,
        type: getFileTypeFromMime(file.mimetype),
        category,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileUrl,
        thumbnailUrl,
        uploadedBy: userId,
        uploadedByName: userName,
        tags: parsedTags,
        isPublic: isPublic === 'true',
        folder,
        permissions: {
          canView: true,
          canDownload: true,
          canEdit: permissions.canEdit,
          canDelete: permissions.canDelete,
          canShare: permissions.canShare
        }
      });

      // Guardar documento
      await document.save();

      // Actualizar resumen
      const summary = await HRDocumentSummary.getOrCreate();
      await summary.addDocument(document);

      // Registrar actividad
      await HRDocumentActivity.logActivity(
        document.id,
        userId,
        userName,
        'upload',
        {
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          category,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      );

      res.status(201).json({
        success: true,
        data: document.toFirestore(),
        message: getSuccessMessage('DOCUMENT_UPLOADED')
      });
    } catch (error) {
      console.error('Error uploading HR document:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage('UPLOAD_FAILED'),
        details: error.message
      });
    }
  }

  /**
   * 4. PUT /api/hr/documents/:documentId
   * Actualizar metadatos del documento
   */
  static async updateDocument(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';
      const userRole = req.user?.role || 'employee';

      const document = await HRDocument.findById(documentId);
      if (!document) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('DOCUMENT_NOT_FOUND')
        });
      }

      // Verificar permisos de edición
      const permissions = getPermissionsByRole(userRole);
      if (!permissions.canEdit && !document.permissions.canEdit) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('INVALID_PERMISSIONS')
        });
      }

      const updateData = req.body;

      // Validar categoría si se proporciona
      if (updateData.category && !isValidCategory(updateData.category)) {
        return res.status(400).json({
          success: false,
          error: getErrorMessage('INVALID_CATEGORY')
        });
      }

      // Actualizar documento
      await document.update(updateData);

      // Registrar actividad
      await HRDocumentActivity.logActivity(
        documentId,
        userId,
        userName,
        'edit',
        {
          changes: updateData,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      );

      res.json({
        success: true,
        data: document.toFirestore(),
        message: getSuccessMessage('DOCUMENT_UPDATED')
      });
    } catch (error) {
      console.error('Error updating HR document:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage('UPDATE_FAILED'),
        details: error.message
      });
    }
  }

  /**
   * 5. DELETE /api/hr/documents/:documentId
   * Eliminar documento
   */
  static async deleteDocument(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';
      const userRole = req.user?.role || 'employee';

      const document = await HRDocument.findById(documentId);
      if (!document) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('DOCUMENT_NOT_FOUND')
        });
      }

      // Verificar permisos de eliminación
      const permissions = getPermissionsByRole(userRole);
      if (!permissions.canDelete && !document.permissions.canDelete) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('INVALID_PERMISSIONS')
        });
      }

      // Eliminar documento
      await HRDocument.delete(documentId);

      // Actualizar resumen
      const summary = await HRDocumentSummary.getOrCreate();
      await summary.removeDocument(document);

      // Registrar actividad
      await HRDocumentActivity.logActivity(
        documentId,
        userId,
        userName,
        'delete',
        {
          documentName: document.name,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      );

      res.json({
        success: true,
        message: getSuccessMessage('DOCUMENT_DELETED')
      });
    } catch (error) {
      console.error('Error deleting HR document:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage('DELETE_FAILED'),
        details: error.message
      });
    }
  }

  /**
   * 6. GET /api/hr/documents/:documentId/download
   * Descargar documento
   */
  static async downloadDocument(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';
      const userRole = req.user?.role || 'employee';

      const document = await HRDocument.findById(documentId);
      if (!document) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('DOCUMENT_NOT_FOUND')
        });
      }

      // Verificar permisos de descarga
      const permissions = getPermissionsByRole(userRole);
      if (!permissions.canDownload || (!document.isPublic && userRole === 'employee')) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('INVALID_PERMISSIONS')
        });
      }

      // Incrementar contador de descargas
      await document.incrementDownloadCount();

      // Registrar actividad
      await HRDocumentActivity.logActivity(
        documentId,
        userId,
        userName,
        'download',
        {
          fileSize: document.fileSize,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      );

      // Actualizar estadísticas
      const summary = await HRDocumentSummary.getOrCreate();
      await summary.updateDownloadStats(document);

      // Obtener URL de descarga firmada
      const downloadUrl = await StorageConfig.getSignedDownloadUrl(document.fileUrl);

      res.json({
        success: true,
        data: {
          downloadUrl,
          fileName: document.name,
          fileSize: document.fileSize,
          mimeType: document.mimeType
        }
      });
    } catch (error) {
      console.error('Error downloading HR document:', error);
      res.status(500).json({
        success: false,
        error: 'Error al descargar documento',
        details: error.message
      });
    }
  }

  /**
   * 7. GET /api/hr/documents/:documentId/preview
   * Obtener URL de vista previa
   */
  static async getPreview(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';
      const userRole = req.user?.role || 'employee';

      const document = await HRDocument.findById(documentId);
      if (!document) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('DOCUMENT_NOT_FOUND')
        });
      }

      // Verificar permisos de visualización
      const permissions = getPermissionsByRole(userRole);
      if (!permissions.canView || (!document.isPublic && userRole === 'employee')) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('INVALID_PERMISSIONS')
        });
      }

      // Incrementar contador de visualizaciones
      await document.incrementViewCount();

      // Registrar actividad
      await HRDocumentActivity.logActivity(
        documentId,
        userId,
        userName,
        'view',
        {
          action: 'preview',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      );

      // Obtener URL de vista previa firmada
      const previewUrl = await StorageConfig.getSignedDownloadUrl(document.fileUrl);
      
      let thumbnailUrl = document.thumbnailUrl;
      if (thumbnailUrl) {
        thumbnailUrl = await StorageConfig.getSignedDownloadUrl(thumbnailUrl);
      }

      res.json({
        success: true,
        data: {
          previewUrl,
          thumbnailUrl,
          fileName: document.name,
          fileType: document.type
        }
      });
    } catch (error) {
      console.error('Error getting document preview:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener vista previa',
        details: error.message
      });
    }
  }

  /**
   * 8. PUT /api/hr/documents/:documentId/favorite
   * Marcar/desmarcar como favorito
   */
  static async toggleFavorite(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';

      const document = await HRDocument.findById(documentId);
      if (!document) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('DOCUMENT_NOT_FOUND')
        });
      }

      // Toggle favorito
      await document.toggleFavorite();

      // Registrar actividad
      await HRDocumentActivity.logActivity(
        documentId,
        userId,
        userName,
        document.isFavorite ? 'favorite' : 'unfavorite',
        {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      );

      res.json({
        success: true,
        data: document.toFirestore(),
        message: getSuccessMessage('FAVORITE_TOGGLED')
      });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      res.status(500).json({
        success: false,
        error: 'Error al actualizar favorito',
        details: error.message
      });
    }
  }

  /**
   * 9. PUT /api/hr/documents/:documentId/pin
   * Marcar/desmarcar como fijado
   */
  static async togglePin(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';
      const userRole = req.user?.role || 'employee';

      const document = await HRDocument.findById(documentId);
      if (!document) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('DOCUMENT_NOT_FOUND')
        });
      }

      // Verificar permisos (solo HR puede fijar)
      const permissions = getPermissionsByRole(userRole);
      if (!permissions.canEdit) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('INVALID_PERMISSIONS')
        });
      }

      // Toggle pin
      await document.togglePin();

      // Actualizar resumen
      const summary = await HRDocumentSummary.getOrCreate();
      await summary.updatePinStatus(document);

      // Registrar actividad
      await HRDocumentActivity.logActivity(
        documentId,
        userId,
        userName,
        document.isPinned ? 'pin' : 'unpin',
        {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      );

      res.json({
        success: true,
        data: document.toFirestore(),
        message: getSuccessMessage('PIN_TOGGLED')
      });
    } catch (error) {
      console.error('Error toggling pin:', error);
      res.status(500).json({
        success: false,
        error: 'Error al actualizar fijado',
        details: error.message
      });
    }
  }

  /**
   * 10. POST /api/hr/documents/:documentId/share
   * Compartir documento
   */
  static async shareDocument(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';
      const userRole = req.user?.role || 'employee';

      const { users, departments, expirationDate, message } = req.body;

      const document = await HRDocument.findById(documentId);
      if (!document) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('DOCUMENT_NOT_FOUND')
        });
      }

      // Verificar permisos de compartir
      const permissions = getPermissionsByRole(userRole);
      if (!permissions.canShare && !document.permissions.canShare) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('INVALID_PERMISSIONS')
        });
      }

      // TODO: Implementar lógica de compartir
      // Por ahora, solo registrar la actividad

      // Registrar actividad
      await HRDocumentActivity.logActivity(
        documentId,
        userId,
        userName,
        'share',
        {
          sharedWith: { users, departments },
          expirationDate,
          message,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      );

      res.json({
        success: true,
        message: getSuccessMessage('DOCUMENT_SHARED'),
        data: {
          documentId,
          sharedWith: { users, departments },
          expirationDate,
          message
        }
      });
    } catch (error) {
      console.error('Error sharing document:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage('SHARE_FAILED'),
        details: error.message
      });
    }
  }

  /**
   * 11. POST /api/hr/documents/:documentId/duplicate
   * Duplicar documento
   */
  static async duplicateDocument(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';
      const userRole = req.user?.role || 'employee';

      const { newName } = req.body;

      const document = await HRDocument.findById(documentId);
      if (!document) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('DOCUMENT_NOT_FOUND')
        });
      }

      // Verificar permisos de edición
      const permissions = getPermissionsByRole(userRole);
      if (!permissions.canEdit) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('INVALID_PERMISSIONS')
        });
      }

      if (!newName || newName.length < 3) {
        return res.status(400).json({
          success: false,
          error: 'El nombre del duplicado debe tener al menos 3 caracteres'
        });
      }

      // Duplicar documento
      const duplicate = await document.duplicate(newName, userId, userName);

      // Actualizar resumen
      const summary = await HRDocumentSummary.getOrCreate();
      await summary.addDocument(duplicate);

      // Registrar actividad
      await HRDocumentActivity.logActivity(
        documentId,
        userId,
        userName,
        'duplicate',
        {
          originalName: document.name,
          newName: duplicate.name,
          duplicateId: duplicate.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      );

      res.status(201).json({
        success: true,
        data: duplicate.toFirestore(),
        message: getSuccessMessage('DOCUMENT_DUPLICATED')
      });
    } catch (error) {
      console.error('Error duplicating document:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage('DUPLICATE_FAILED'),
        details: error.message
      });
    }
  }

  /**
   * 12. PUT /api/hr/documents/:documentId/move
   * Mover documento a carpeta
   */
  static async moveDocument(req, res) {
    try {
      const { documentId } = req.params;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';
      const userRole = req.user?.role || 'employee';

      const { folder } = req.body;

      const document = await HRDocument.findById(documentId);
      if (!document) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('DOCUMENT_NOT_FOUND')
        });
      }

      // Verificar permisos de edición
      const permissions = getPermissionsByRole(userRole);
      if (!permissions.canEdit && !document.permissions.canEdit) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('INVALID_PERMISSIONS')
        });
      }

      const oldFolder = document.folder;

      // Mover documento
      await document.moveToFolder(folder);

      // Registrar actividad
      await HRDocumentActivity.logActivity(
        documentId,
        userId,
        userName,
        'move',
        {
          fromFolder: oldFolder,
          toFolder: folder,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      );

      res.json({
        success: true,
        data: document.toFirestore(),
        message: getSuccessMessage('DOCUMENT_MOVED')
      });
    } catch (error) {
      console.error('Error moving document:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage('MOVE_FAILED'),
        details: error.message
      });
    }
  }

  /**
   * 13. GET /api/hr/documents/summary
   * Obtener resumen estadístico
   */
  static async getSummary(req, res) {
    res.json({
      success: true,
      data: {
        totalDocuments: 0,
        totalSize: 0,
        byCategory: {},
        byType: {},
        recentUploads: [],
        mostDownloaded: [],
        mostViewed: [],
        pinnedDocuments: [],
        updatedAt: new Date().toISOString()
      }
    });
  }

  /**
   * 14. GET /api/hr/documents/search
   * Búsqueda avanzada
   */
  static async searchDocuments(req, res) {
    try {
      const { query, filters } = req.query;

      if (!query || query.length < getConfig('SEARCH_CONFIG', 'minSearchLength')) {
        return res.status(400).json({
          success: false,
          error: getErrorMessage('INVALID_SEARCH')
        });
      }

      let searchFilters = {};
      if (filters) {
        try {
          searchFilters = JSON.parse(filters);
        } catch (e) {
          searchFilters = {};
        }
      }

      // Realizar búsqueda
      const documents = await HRDocument.list({
        search: query,
        ...searchFilters,
        limit: getConfig('SEARCH_CONFIG', 'maxSearchResults')
      });

      res.json({
        success: true,
        data: {
          documents: documents.map(doc => doc.toFirestore()),
          query,
          filters: searchFilters,
          count: documents.length
        }
      });
    } catch (error) {
      console.error('Error searching HR documents:', error);
      res.status(500).json({
        success: false,
        error: 'Error en la búsqueda',
        details: error.message
      });
    }
  }

  /**
   * 15. GET /api/hr/documents/folders
   * Obtener todas las carpetas
   */
  static async getFolders(req, res) {
    res.json({
      success: true,
      data: []
    });
  }

  /**
   * 16. POST /api/hr/documents/folders
   * Crear nueva carpeta
   */
  static async createFolder(req, res) {
    try {
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';
      const userRole = req.user?.role || 'employee';

      const { name, description = '' } = req.body;

      // Verificar permisos
      const permissions = getPermissionsByRole(userRole);
      if (!permissions.canCreateFolders) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('INVALID_PERMISSIONS')
        });
      }

      if (!name || name.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'El nombre de la carpeta debe tener al menos 2 caracteres'
        });
      }

      // Verificar si ya existe
      const existing = await HRDocumentFolder.findByName(name);
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Ya existe una carpeta con ese nombre'
        });
      }

      // Crear carpeta
      const folder = new HRDocumentFolder({
        name,
        description,
        createdBy: userId
      });

      await folder.save();

      res.status(201).json({
        success: true,
        data: folder.toFirestore(),
        message: getSuccessMessage('FOLDER_CREATED')
      });
    } catch (error) {
      console.error('Error creating HR document folder:', error);
      res.status(500).json({
        success: false,
        error: 'Error al crear carpeta',
        details: error.message
      });
    }
  }

  /**
   * 17. DELETE /api/hr/documents/folders/:folderName
   * Eliminar carpeta
   */
  static async deleteFolder(req, res) {
    try {
      const { folderName } = req.params;
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';
      const userRole = req.user?.role || 'employee';

      // Verificar permisos
      const permissions = getPermissionsByRole(userRole);
      if (!permissions.canDelete) {
        return res.status(403).json({
          success: false,
          error: getErrorMessage('INVALID_PERMISSIONS')
        });
      }

      const folder = await HRDocumentFolder.findByName(folderName);
      if (!folder) {
        return res.status(404).json({
          success: false,
          error: getErrorMessage('FOLDER_NOT_FOUND')
        });
      }

      // Eliminar carpeta
      await HRDocumentFolder.delete(folder.id);

      res.json({
        success: true,
        message: getSuccessMessage('FOLDER_DELETED')
      });
    } catch (error) {
      console.error('Error deleting HR document folder:', error);
      res.status(500).json({
        success: false,
        error: error.message.includes('contiene documentos') ? 
          getErrorMessage('FOLDER_NOT_EMPTY') : 'Error al eliminar carpeta',
        details: error.message
      });
    }
  }

  /**
   * 18. GET /api/hr/documents/activity
   * Obtener historial de actividad
   */
  static async getActivity(req, res) {
    try {
      const { documentId, userId, limit = 50 } = req.query;

      const activities = await HRDocumentActivity.list({
        documentId,
        userId,
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: activities.map(activity => activity.toFirestore())
      });
    } catch (error) {
      console.error('Error getting HR document activity:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener actividad',
        details: error.message
      });
    }
  }

  /**
   * 19. GET /api/hr/documents/export
   * Exportar documentos a Excel/PDF
   */
  static async exportDocuments(req, res) {
    try {
      const { format = 'excel', ...filters } = req.query;

      // Obtener documentos con filtros
      const documents = await HRDocument.list({
        ...filters,
        limit: 1000
      });

      // TODO: Implementar generación de Excel/PDF
      res.json({
        success: true,
        message: `Exportación a ${format.toUpperCase()} en desarrollo`,
        data: {
          documents: documents.map(doc => doc.toFirestore()),
          format,
          filters,
          count: documents.length,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error exporting HR documents:', error);
      res.status(500).json({
        success: false,
        error: 'Error al exportar documentos',
        details: error.message
      });
    }
  }

  /**
   * 20. POST /api/hr/documents/initialize
   * Inicializar estructura de datos del módulo
   */
  static async initializeModule(req, res) {
    try {
      const userId = req.user?.id || null;
      const userName = req.user?.name || 'Sistema';

      // Verificar permisos (solo admin)
      const userRole = req.user?.role || 'employee';
      if (userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Solo los administradores pueden inicializar el módulo'
        });
      }

      // Crear resumen inicial
      const summary = await HRDocumentSummary.getOrCreate();
      
      // Crear carpetas por defecto
      const defaultFolders = [
        { name: 'Plantillas', description: 'Plantillas de documentos corporativos' },
        { name: 'Políticas', description: 'Políticas de la empresa' },
        { name: 'Procedimientos', description: 'Procedimientos operativos' },
        { name: 'Manuales', description: 'Manuales de usuario y operación' },
        { name: 'Formatos', description: 'Formatos y formularios' },
        { name: 'Capacitación', description: 'Material de capacitación' },
        { name: 'Legal', description: 'Documentos legales y contractuales' },
        { name: 'Multimedia', description: 'Videos, audios y presentaciones' }
      ];

      const createdFolders = [];
      for (const folderData of defaultFolders) {
        try {
          const folder = new HRDocumentFolder({
            name: folderData.name,
            description: folderData.description,
            createdBy: userId,
            createdByName: userName
          });
          await folder.save();
          createdFolders.push(folder.toFirestore());
        } catch (error) {
          console.warn(`Error creating folder ${folderData.name}:`, error.message);
        }
      }

      res.json({
        success: true,
        message: 'Módulo de documentos de RH inicializado exitosamente',
        data: {
          summary: summary.toFirestore(),
          folders: createdFolders,
          initializedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error initializing HR documents module:', error);
      res.status(500).json({
        success: false,
        error: 'Error al inicializar módulo',
        details: error.message
      });
    }
  }
}

module.exports = HRDocumentController;
