/**
 * 📄 MODELO DE DOCUMENTO RAG
 * 
 * Esquema de datos para documentos de conocimiento en RAG
 * con validaciones, sanitización y metadata.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Tipos de documento soportados
 */
const DOCUMENT_TYPES = {
  PDF: 'pdf',
  TXT: 'txt',
  MD: 'md',
  HTML: 'html',
  URL: 'url'
};

/**
 * Estados del documento
 */
const DOCUMENT_STATUS = {
  READY: 'ready',
  PROCESSING: 'processing',
  ERROR: 'error'
};

/**
 * Configuración de límites
 */
const DOCUMENT_LIMITS = {
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  MAX_TITLE_LENGTH: 200,
  MAX_TAGS_COUNT: 20,
  MAX_TAG_LENGTH: 50,
  MAX_METADATA_SIZE: 2048 // 2KB
};

/**
 * MIME types permitidos
 */
const ALLOWED_MIME_TYPES = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/html': 'html',
  'text/xml': 'html'
};

/**
 * Clase Document para manejo de documentos RAG
 */
class Document {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.workspaceId = data.workspaceId;
    this.title = data.title || '';
    this.type = data.type || DOCUMENT_TYPES.TXT;
    this.storagePath = data.storagePath || '';
    this.bytes = data.bytes || 0;
    this.mime = data.mime || '';
    this.version = data.version || 1;
    this.status = data.status || DOCUMENT_STATUS.READY;
    this.tags = data.tags || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.metadata = data.metadata || {};
    
    // Validar y sanitizar datos
    this.validateAndSanitize();
  }

  /**
   * Validar y sanitizar datos del documento
   */
  validateAndSanitize() {
    const errors = [];

    // Validar workspaceId
    if (!this.workspaceId || typeof this.workspaceId !== 'string') {
      errors.push('workspaceId es requerido y debe ser string');
    }

    // Validar title
    if (!this.title || typeof this.title !== 'string') {
      errors.push('title es requerido y debe ser string');
    } else if (this.title.length > DOCUMENT_LIMITS.MAX_TITLE_LENGTH) {
      this.title = this.title.substring(0, DOCUMENT_LIMITS.MAX_TITLE_LENGTH);
      logger.warn('⚠️ Título truncado', {
        originalLength: this.title.length,
        maxLength: DOCUMENT_LIMITS.MAX_TITLE_LENGTH
      });
    }

    // Validar type
    if (!Object.values(DOCUMENT_TYPES).includes(this.type)) {
      errors.push(`Tipo de documento "${this.type}" no soportado`);
      this.type = DOCUMENT_TYPES.TXT;
    }

    // Validar storagePath
    if (!this.storagePath || typeof this.storagePath !== 'string') {
      errors.push('storagePath es requerido y debe ser string');
    }

    // Validar bytes
    if (this.bytes < 0) {
      errors.push('bytes no puede ser negativo');
      this.bytes = 0;
    }

    if (this.bytes > DOCUMENT_LIMITS.MAX_FILE_SIZE_BYTES) {
      errors.push(`Tamaño de archivo excede el límite de ${DOCUMENT_LIMITS.MAX_FILE_SIZE_BYTES} bytes`);
    }

    // Validar mime
    if (this.mime && !ALLOWED_MIME_TYPES[this.mime]) {
      errors.push(`MIME type "${this.mime}" no permitido`);
      this.mime = 'text/plain';
    }

    // Validar version
    if (this.version < 1) {
      errors.push('version debe ser mayor a 0');
      this.version = 1;
    }

    // Validar status
    if (!Object.values(DOCUMENT_STATUS).includes(this.status)) {
      errors.push(`Estado "${this.status}" no válido`);
      this.status = DOCUMENT_STATUS.READY;
    }

    // Validar tags
    if (!Array.isArray(this.tags)) {
      this.tags = [];
    } else {
      // Sanitizar tags
      this.tags = this.tags
        .filter(tag => typeof tag === 'string' && tag.trim().length > 0)
        .map(tag => tag.trim().substring(0, DOCUMENT_LIMITS.MAX_TAG_LENGTH))
        .slice(0, DOCUMENT_LIMITS.MAX_TAGS_COUNT);

      // Remover duplicados
      this.tags = [...new Set(this.tags)];
    }

    // Validar metadata
    if (JSON.stringify(this.metadata).length > DOCUMENT_LIMITS.MAX_METADATA_SIZE) {
      errors.push('metadata excede el tamaño máximo permitido');
      this.metadata = {};
    }

    if (errors.length > 0) {
      throw new Error(`Errores de validación: ${errors.join(', ')}`);
    }
  }

  /**
   * Verificar si el documento está listo para procesamiento
   */
  isReady() {
    return this.status === DOCUMENT_STATUS.READY;
  }

  /**
   * Marcar documento como procesando
   */
  markAsProcessing() {
    this.status = DOCUMENT_STATUS.PROCESSING;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Marcar documento como listo
   */
  markAsReady() {
    this.status = DOCUMENT_STATUS.READY;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Marcar documento como error
   */
  markAsError(error = '') {
    this.status = DOCUMENT_STATUS.ERROR;
    this.updatedAt = new Date().toISOString();
    this.metadata.error = error;
  }

  /**
   * Incrementar versión
   */
  incrementVersion() {
    this.version++;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Obtener preview del documento
   */
  getPreview() {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      title: this.title,
      type: this.type,
      bytes: this.bytes,
      version: this.version,
      status: this.status,
      tags: this.tags,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Convertir a formato Firestore
   */
  toFirestore() {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      title: this.title,
      type: this.type,
      storagePath: this.storagePath,
      bytes: this.bytes,
      mime: this.mime,
      version: this.version,
      status: this.status,
      tags: this.tags,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata: this.metadata
    };
  }

  /**
   * Crear desde datos de Firestore
   */
  static fromFirestore(data) {
    return new Document(data);
  }

  /**
   * Validar datos de entrada
   */
  static validate(data) {
    try {
      new Document(data);
      return { isValid: true };
    } catch (error) {
      return { isValid: false, errors: [error.message] };
    }
  }

  /**
   * Validar MIME type
   */
  static isValidMimeType(mime) {
    return ALLOWED_MIME_TYPES.hasOwnProperty(mime);
  }

  /**
   * Obtener tipo de documento desde MIME
   */
  static getTypeFromMime(mime) {
    return ALLOWED_MIME_TYPES[mime] || DOCUMENT_TYPES.TXT;
  }
}

module.exports = {
  Document,
  DOCUMENT_TYPES,
  DOCUMENT_STATUS,
  DOCUMENT_LIMITS,
  ALLOWED_MIME_TYPES
}; 