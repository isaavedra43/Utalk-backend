/**
 * 🤖 MODELO DE SUGERENCIA IA
 * 
 * Esquema de datos para sugerencias generadas por IA
 * con validaciones, sanitización y detección de contenido sensible.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Estados válidos de una sugerencia
 */
const SUGGESTION_STATES = {
  DRAFT: 'draft',
  SENT: 'sent',
  DISCARDED: 'discarded'
};

/**
 * Tipos de sugerencia
 */
const SUGGESTION_TYPES = {
  SALUDO: 'saludo',
  CONSULTA_PRECIOS: 'consulta_precios',
  HORARIOS_ATENCION: 'horarios_atencion',
  SOPORTE_TECNICO: 'soporte_tecnico',
  PREGUNTA: 'pregunta',
  RESPUESTA_GENERAL: 'respuesta_general'
};

/**
 * Configuración de límites
 */
const SUGGESTION_LIMITS = {
  MAX_TEXT_LENGTH: 1000,
  MAX_PREVIEW_LENGTH: 200,
  MAX_SOURCES_COUNT: 10,
  MAX_METADATA_SIZE: 1024 // 1KB
};

/**
 * Palabras clave para detección de contenido sensible
 */
const SENSITIVE_PATTERNS = {
  // PII (Información Personal Identificable)
  pii: [
    /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g, // Tarjetas de crédito
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // Números de teléfono
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Emails
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, // IPs
    /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, // IBAN
    /\b\d{2}[-.\s]?\d{2}[-.\s]?\d{2}[-.\s]?\d{2}[-.\s]?\d{2}[-.\s]?\d{2}\b/g // DNI español
  ],
  
  // Lenguaje ofensivo (español)
  offensive: [
    /\b(puta|mierda|cabrón|gilipollas|hijo de puta|joder|coño)\b/gi,
    /\b(estúpido|idiota|imbécil|tonto|burro)\b/gi,
    /\b(odio|matar|muerte|suicidio|violencia)\b/gi
  ],
  
  // Contenido inapropiado
  inappropriate: [
    /\b(droga|marihuana|cocaína|heroína|éxtasis)\b/gi,
    /\b(sexo|pornograf|prostitut|escort)\b/gi,
    /\b(terrorismo|bomba|explosivo|armas)\b/gi
  ]
};

/**
 * Clase Suggestion para manejo de sugerencias IA
 */
class Suggestion {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.conversationId = data.conversationId;
    this.messageIdOrigen = data.messageIdOrigen;
    this.texto = data.texto || '';
    this.confianza = data.confianza || 0.5;
    this.fuentes = data.fuentes || [];
    this.modelo = data.modelo || 'gpt-4o-mini';
    this.tokensEstimados = data.tokensEstimados || { in: 0, out: 0 };
    this.estado = data.estado || SUGGESTION_STATES.DRAFT;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.flagged = data.flagged || false;
    this.metadata = data.metadata || {};
    
    // Validar y sanitizar datos
    this.validateAndSanitize();
  }

  /**
   * Validar y sanitizar datos de la sugerencia
   */
  validateAndSanitize() {
    const errors = [];
    const warnings = [];

    // Validar campos requeridos
    if (!this.conversationId) {
      errors.push('conversationId es requerido');
    }

    if (!this.messageIdOrigen) {
      errors.push('messageIdOrigen es requerido');
    }

    if (!this.texto || this.texto.trim().length === 0) {
      errors.push('texto es requerido y no puede estar vacío');
    }

    // Sanitizar texto
    this.texto = this.sanitizeText(this.texto);
    
    // Validar longitud de texto
    if (this.texto.length > SUGGESTION_LIMITS.MAX_TEXT_LENGTH) {
      this.texto = this.texto.substring(0, SUGGESTION_LIMITS.MAX_TEXT_LENGTH);
      warnings.push(`Texto recortado a ${SUGGESTION_LIMITS.MAX_TEXT_LENGTH} caracteres`);
    }

    // Validar confianza
    if (this.confianza < 0 || this.confianza > 1) {
      this.confianza = Math.max(0, Math.min(1, this.confianza));
      warnings.push('Confianza ajustada al rango 0-1');
    }

    // Validar fuentes
    if (this.fuentes.length > SUGGESTION_LIMITS.MAX_SOURCES_COUNT) {
      this.fuentes = this.fuentes.slice(0, SUGGESTION_LIMITS.MAX_SOURCES_COUNT);
      warnings.push(`Fuentes limitadas a ${SUGGESTION_LIMITS.MAX_SOURCES_COUNT}`);
    }

    // Validar estado
    if (!Object.values(SUGGESTION_STATES).includes(this.estado)) {
      this.estado = SUGGESTION_STATES.DRAFT;
      warnings.push('Estado inválido, usando draft');
    }

    // Validar tokens
    if (this.tokensEstimados.in < 0) this.tokensEstimados.in = 0;
    if (this.tokensEstimados.out < 0) this.tokensEstimados.out = 0;

    // Detectar contenido sensible
    const sensitiveContent = this.detectSensitiveContent(this.texto);
    if (sensitiveContent.length > 0) {
      this.flagged = true;
      this.metadata.riesgos = sensitiveContent;
      warnings.push(`Contenido sensible detectado: ${sensitiveContent.join(', ')}`);
    }

    // Validar metadata
    if (JSON.stringify(this.metadata).length > SUGGESTION_LIMITS.MAX_METADATA_SIZE) {
      this.metadata = { error: 'Metadata demasiado grande' };
      warnings.push('Metadata recortada por tamaño');
    }

    // Lanzar errores si hay campos requeridos faltantes
    if (errors.length > 0) {
      throw new Error(`Validación fallida: ${errors.join(', ')}`);
    }

    // Log warnings si hay alguno
    if (warnings.length > 0) {
      logger.warn('⚠️ Sugerencia con warnings', {
        suggestionId: this.id,
        conversationId: this.conversationId,
        warnings
      });
    }
  }

  /**
   * Sanitizar texto de la sugerencia
   */
  sanitizeText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    let sanitized = text.trim();

    // Remover HTML peligroso
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<[^>]*>/g, ''); // Remover cualquier HTML restante

    // Normalizar espacios
    sanitized = sanitized.replace(/\s+/g, ' ');

    return sanitized;
  }

  /**
   * Detectar contenido sensible en el texto
   */
  detectSensitiveContent(text) {
    const detected = [];

    // Verificar patrones de PII
    for (const [category, patterns] of Object.entries(SENSITIVE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          detected.push(category);
          break; // Solo reportar una vez por categoría
        }
      }
    }

    return [...new Set(detected)]; // Remover duplicados
  }

  /**
   * Obtener preview de la sugerencia
   */
  getPreview() {
    if (!this.texto) return '';
    
    const preview = this.texto.substring(0, SUGGESTION_LIMITS.MAX_PREVIEW_LENGTH);
    return preview.length < this.texto.length ? preview + '...' : preview;
  }

  /**
   * Determinar tipo de sugerencia basado en el contenido
   */
  getType() {
    const lowerText = this.texto.toLowerCase();
    
    if (lowerText.includes('hola') || lowerText.includes('gracias') || lowerText.includes('buenos días')) {
      return SUGGESTION_TYPES.SALUDO;
    }
    
    if (lowerText.includes('precio') || lowerText.includes('costo') || lowerText.includes('valor') || lowerText.includes('cuánto')) {
      return SUGGESTION_TYPES.CONSULTA_PRECIOS;
    }
    
    if (lowerText.includes('horario') || lowerText.includes('hora') || lowerText.includes('disponible') || lowerText.includes('cuándo')) {
      return SUGGESTION_TYPES.HORARIOS_ATENCION;
    }
    
    if (lowerText.includes('problema') || lowerText.includes('error') || lowerText.includes('ayuda') || lowerText.includes('soporte')) {
      return SUGGESTION_TYPES.SOPORTE_TECNICO;
    }
    
    if (lowerText.includes('?') || lowerText.includes('pregunta') || lowerText.includes('cómo') || lowerText.includes('qué')) {
      return SUGGESTION_TYPES.PREGUNTA;
    }
    
    return SUGGESTION_TYPES.RESPUESTA_GENERAL;
  }

  /**
   * Convertir a objeto plano para Firestore
   */
  toFirestore() {
    return {
      id: this.id,
      conversationId: this.conversationId,
      messageIdOrigen: this.messageIdOrigen,
      texto: this.texto,
      confianza: this.confianza,
      fuentes: this.fuentes,
      modelo: this.modelo,
      tokensEstimados: this.tokensEstimados,
      estado: this.estado,
      createdAt: this.createdAt,
      flagged: this.flagged,
      metadata: this.metadata,
      tipo: this.getType(),
      preview: this.getPreview()
    };
  }

  /**
   * Crear desde objeto de Firestore
   */
  static fromFirestore(data) {
    return new Suggestion(data);
  }

  /**
   * Validar datos antes de crear instancia
   */
  static validate(data) {
    try {
      new Suggestion(data);
      return { valid: true, errors: [] };
    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  }
}

module.exports = {
  Suggestion,
  SUGGESTION_STATES,
  SUGGESTION_TYPES,
  SUGGESTION_LIMITS,
  SENSITIVE_PATTERNS
};