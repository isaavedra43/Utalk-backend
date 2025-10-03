/**
 * Configuración de Documentos de RH
 * Centraliza todas las configuraciones del módulo de documentos
 * Alineado 100% con especificaciones del Frontend
 */

const HR_DOCUMENT_CONFIG = {
  // Categorías de documentos
  CATEGORIES: {
    'plantilla': { 
      label: 'Plantillas', 
      color: 'blue', 
      icon: 'file-template',
      description: 'Plantillas de documentos corporativos'
    },
    'politica': { 
      label: 'Políticas', 
      color: 'purple', 
      icon: 'shield',
      description: 'Políticas de la empresa'
    },
    'procedimiento': { 
      label: 'Procedimientos', 
      color: 'green', 
      icon: 'list-ordered',
      description: 'Procedimientos operativos'
    },
    'manual': { 
      label: 'Manuales', 
      color: 'orange', 
      icon: 'book',
      description: 'Manuales corporativos'
    },
    'formato': { 
      label: 'Formatos', 
      color: 'pink', 
      icon: 'file-text',
      description: 'Formatos oficiales'
    },
    'capacitacion': { 
      label: 'Capacitación', 
      color: 'indigo', 
      icon: 'graduation-cap',
      description: 'Material de capacitación'
    },
    'legal': { 
      label: 'Legal', 
      color: 'red', 
      icon: 'gavel',
      description: 'Documentos legales'
    },
    'multimedia': { 
      label: 'Multimedia', 
      color: 'teal', 
      icon: 'video',
      description: 'Videos, imágenes y archivos multimedia'
    },
    'otro': { 
      label: 'Otro', 
      color: 'gray', 
      icon: 'file',
      description: 'Otros documentos'
    }
  },

  // Tipos de archivo
  FILE_TYPES: {
    'pdf': { 
      label: 'PDF', 
      icon: 'file-pdf', 
      color: 'red',
      mimeTypes: ['application/pdf']
    },
    'image': { 
      label: 'Imagen', 
      icon: 'image', 
      color: 'blue',
      mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    },
    'video': { 
      label: 'Video', 
      icon: 'video', 
      color: 'purple',
      mimeTypes: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv']
    },
    'audio': { 
      label: 'Audio', 
      icon: 'music', 
      color: 'green',
      mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg']
    },
    'document': { 
      label: 'Documento', 
      icon: 'file-text', 
      color: 'blue',
      mimeTypes: [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
    },
    'spreadsheet': { 
      label: 'Hoja de Cálculo', 
      icon: 'table', 
      color: 'green',
      mimeTypes: [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]
    },
    'presentation': { 
      label: 'Presentación', 
      icon: 'presentation', 
      color: 'orange',
      mimeTypes: [
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ]
    },
    'archive': { 
      label: 'Archivo', 
      icon: 'archive', 
      color: 'gray',
      mimeTypes: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed']
    },
    'template': { 
      label: 'Plantilla', 
      icon: 'file-template', 
      color: 'purple',
      mimeTypes: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.template'
      ]
    },
    'other': { 
      label: 'Otro', 
      icon: 'file', 
      color: 'gray',
      mimeTypes: []
    }
  },

  // Permisos por rol
  PERMISSIONS: {
    'hr_admin': {
      canView: true,
      canDownload: true,
      canEdit: true,
      canDelete: true,
      canShare: true,
      canUpload: true,
      canCreateFolders: true,
      canManagePermissions: true
    },
    'hr_manager': {
      canView: true,
      canDownload: true,
      canEdit: true,
      canDelete: false,
      canShare: true,
      canUpload: true,
      canCreateFolders: true,
      canManagePermissions: false
    },
    'hr_user': {
      canView: true,
      canDownload: true,
      canEdit: false,
      canDelete: false,
      canShare: false,
      canUpload: true,
      canCreateFolders: false,
      canManagePermissions: false
    },
    'employee': {
      canView: true, // Solo documentos públicos
      canDownload: true,
      canEdit: false,
      canDelete: false,
      canShare: false,
      canUpload: false,
      canCreateFolders: false,
      canManagePermissions: false
    }
  },

  // Validaciones de archivo
  VALIDATIONS: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxFileNameLength: 255,
    maxDescriptionLength: 1000,
    maxTagsCount: 10,
    maxTagLength: 50,
    thumbnailGeneration: ['image', 'video', 'pdf'],
    allowedTypes: {
      'application/pdf': 'pdf',
      'application/msword': 'document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
      'application/vnd.ms-excel': 'spreadsheet',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
      'application/vnd.ms-powerpoint': 'presentation',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation',
      'image/jpeg': 'image',
      'image/png': 'image',
      'image/gif': 'image',
      'image/webp': 'image',
      'video/mp4': 'video',
      'video/avi': 'video',
      'video/mov': 'video',
      'video/wmv': 'video',
      'audio/mpeg': 'audio',
      'audio/wav': 'audio',
      'audio/mp3': 'audio',
      'audio/ogg': 'audio',
      'application/zip': 'archive',
      'application/x-rar-compressed': 'archive',
      'application/x-7z-compressed': 'archive',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.template': 'template',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.template': 'template'
    }
  },

  // Configuración de thumbnails
  THUMBNAIL_CONFIG: {
    image: {
      width: 300,
      height: 200,
      quality: 80,
      format: 'jpeg'
    },
    video: {
      width: 300,
      height: 200,
      timeOffset: 5, // segundos
      quality: 80,
      format: 'jpeg'
    },
    pdf: {
      width: 300,
      height: 200,
      page: 1,
      quality: 80,
      format: 'jpeg'
    }
  },

  // Configuración de paginación
  PAGINATION: {
    defaultLimit: 20,
    maxLimit: 100,
    defaultPage: 1
  },

  // Configuración de búsqueda
  SEARCH_CONFIG: {
    searchFields: ['name', 'description', 'tags', 'uploadedByName'],
    minSearchLength: 2,
    maxSearchResults: 100
  },

  // Configuración de estadísticas
  STATS_CONFIG: {
    recentUploadsLimit: 10,
    mostDownloadedLimit: 10,
    mostViewedLimit: 10,
    pinnedDocumentsLimit: 20
  },

  // Configuración de actividad
  ACTIVITY_CONFIG: {
    maxActivityLogs: 1000,
    cleanupAfterDays: 365,
    logActions: [
      'upload', 'download', 'view', 'edit', 'delete', 
      'favorite', 'unfavorite', 'pin', 'unpin', 
      'share', 'duplicate', 'move'
    ]
  },

  // Configuración de carpetas por defecto
  DEFAULT_FOLDERS: [
    { name: 'Manuales', description: 'Manuales corporativos y de procedimientos' },
    { name: 'Políticas', description: 'Políticas de la empresa' },
    { name: 'Plantillas', description: 'Plantillas de documentos' },
    { name: 'Formatos', description: 'Formatos oficiales' },
    { name: 'Capacitación', description: 'Material de capacitación' },
    { name: 'Legal', description: 'Documentos legales' },
    { name: 'Multimedia', description: 'Videos, imágenes y archivos multimedia' }
  ],

  // Mensajes de error
  ERROR_MESSAGES: {
    DOCUMENT_NOT_FOUND: 'Documento no encontrado',
    FOLDER_NOT_FOUND: 'Carpeta no encontrada',
    INVALID_FILE_TYPE: 'Tipo de archivo no permitido',
    FILE_TOO_LARGE: 'El archivo excede el tamaño máximo permitido',
    INVALID_CATEGORY: 'Categoría no válida',
    INVALID_PERMISSIONS: 'No tienes permisos para realizar esta acción',
    FOLDER_NOT_EMPTY: 'No se puede eliminar una carpeta que contiene documentos',
    DUPLICATE_NAME: 'Ya existe un documento con ese nombre en la categoría',
    INVALID_SEARCH: 'Término de búsqueda inválido',
    UPLOAD_FAILED: 'Error al subir el archivo',
    DELETE_FAILED: 'Error al eliminar el documento',
    UPDATE_FAILED: 'Error al actualizar el documento',
    SHARE_FAILED: 'Error al compartir el documento',
    DUPLICATE_FAILED: 'Error al duplicar el documento',
    MOVE_FAILED: 'Error al mover el documento',
    THUMBNAIL_FAILED: 'Error al generar thumbnail',
    ACTIVITY_LOG_FAILED: 'Error al registrar actividad'
  },

  // Mensajes de éxito
  SUCCESS_MESSAGES: {
    DOCUMENT_UPLOADED: 'Documento subido exitosamente',
    DOCUMENT_UPDATED: 'Documento actualizado exitosamente',
    DOCUMENT_DELETED: 'Documento eliminado exitosamente',
    DOCUMENT_SHARED: 'Documento compartido exitosamente',
    DOCUMENT_DUPLICATED: 'Documento duplicado exitosamente',
    DOCUMENT_MOVED: 'Documento movido exitosamente',
    FOLDER_CREATED: 'Carpeta creada exitosamente',
    FOLDER_DELETED: 'Carpeta eliminada exitosamente',
    FAVORITE_TOGGLED: 'Estado de favorito actualizado',
    PIN_TOGGLED: 'Estado de fijado actualizado',
    PERMISSIONS_UPDATED: 'Permisos actualizados exitosamente'
  }
};

/**
 * Obtiene una configuración específica
 */
function getConfig(section, key = null) {
  if (key) {
    return HR_DOCUMENT_CONFIG[section]?.[key];
  }
  return HR_DOCUMENT_CONFIG[section];
}

/**
 * Obtiene un mensaje de error
 */
function getErrorMessage(key) {
  return HR_DOCUMENT_CONFIG.ERROR_MESSAGES[key] || 'Error desconocido';
}

/**
 * Obtiene un mensaje de éxito
 */
function getSuccessMessage(key) {
  return HR_DOCUMENT_CONFIG.SUCCESS_MESSAGES[key] || 'Operación exitosa';
}

/**
 * Valida el tipo de archivo
 */
function isValidFileType(mimeType) {
  return HR_DOCUMENT_CONFIG.VALIDATIONS.allowedTypes.hasOwnProperty(mimeType);
}

/**
 * Obtiene el tipo de archivo desde MIME type
 */
function getFileTypeFromMime(mimeType) {
  return HR_DOCUMENT_CONFIG.VALIDATIONS.allowedTypes[mimeType] || 'other';
}

/**
 * Valida el tamaño del archivo
 */
function isValidFileSize(fileSize) {
  return fileSize <= HR_DOCUMENT_CONFIG.VALIDATIONS.maxFileSize;
}

/**
 * Valida la categoría
 */
function isValidCategory(category) {
  return HR_DOCUMENT_CONFIG.CATEGORIES.hasOwnProperty(category);
}

/**
 * Obtiene permisos por rol
 */
function getPermissionsByRole(role) {
  return HR_DOCUMENT_CONFIG.PERMISSIONS[role] || HR_DOCUMENT_CONFIG.PERMISSIONS.employee;
}

/**
 * Verifica si se puede generar thumbnail
 */
function canGenerateThumbnail(fileType) {
  return HR_DOCUMENT_CONFIG.VALIDATIONS.thumbnailGeneration.includes(fileType);
}

/**
 * Obtiene configuración de thumbnail
 */
function getThumbnailConfig(fileType) {
  return HR_DOCUMENT_CONFIG.THUMBNAIL_CONFIG[fileType] || null;
}

module.exports = {
  HR_DOCUMENT_CONFIG,
  getConfig,
  getErrorMessage,
  getSuccessMessage,
  isValidFileType,
  getFileTypeFromMime,
  isValidFileSize,
  isValidCategory,
  getPermissionsByRole,
  canGenerateThumbnail,
  getThumbnailConfig
};
