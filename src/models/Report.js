/**
 * 📊 MODELO DE REPORTE IA
 * 
 * Esquema de datos para reportes de IA con métricas agregadas
 * y resúmenes opcionales generados por IA.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Tipos de reporte
 */
const REPORT_TYPES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  CUSTOM: 'custom'
};

/**
 * Estados de alerta
 */
const ALERT_TYPES = {
  TMA_ALTO: 'tma_alto',
  FCR_BAJO: 'fcr_bajo',
  DATOS_INCOMPLETOS: 'datos_incompletos',
  SLA_VIOLADO: 'sla_violado',
  SENTIMIENTO_NEGATIVO: 'sentimiento_negativo',
  VOLUMEN_BAJO: 'volumen_bajo'
};

/**
 * Configuración de límites
 */
const REPORT_LIMITS = {
  MAX_SUMMARY_LENGTH: 200,
  MAX_ALERTS_COUNT: 10,
  MAX_INTENTIONS_COUNT: 20,
  MAX_METADATA_SIZE: 2048 // 2KB
};

/**
 * Clase Report para manejo de reportes de IA
 */
class Report {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.workspaceId = data.workspaceId;
    this.tipo = data.tipo || REPORT_TYPES.WEEKLY;
    this.periodo = data.periodo || {};
    this.datos = data.datos || {};
    this.kpis = data.kpis || {};
    this.alertas = data.alertas || [];
    this.resumen_corto = data.resumen_corto || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.metadata = data.metadata || {};
    
    // Validar y sanitizar datos
    this.validateAndSanitize();
  }

  /**
   * Validar y sanitizar datos del reporte
   */
  validateAndSanitize() {
    const errors = [];

    // Validar workspaceId
    if (!this.workspaceId || typeof this.workspaceId !== 'string') {
      errors.push('workspaceId es requerido y debe ser string');
    }

    // Validar periodo
    if (!this.periodo.from || !this.periodo.to) {
      errors.push('periodo.from y periodo.to son requeridos');
    } else {
      const fromDate = new Date(this.periodo.from);
      const toDate = new Date(this.periodo.to);
      
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        errors.push('periodo.from y periodo.to deben ser fechas válidas');
      } else if (fromDate > toDate) {
        errors.push('periodo.from no puede ser posterior a periodo.to');
      }
    }

    // Validar datos
    if (this.datos.mensajes_totales !== undefined && this.datos.mensajes_totales < 0) {
      errors.push('mensajes_totales no puede ser negativo');
    }

    if (this.datos.tiempo_medio_respuesta_s !== undefined && this.datos.tiempo_medio_respuesta_s < 0) {
      errors.push('tiempo_medio_respuesta_s no puede ser negativo');
    }

    if (this.datos.fcr !== undefined && (this.datos.fcr < 0 || this.datos.fcr > 1)) {
      errors.push('fcr debe estar entre 0 y 1');
    }

    // Validar intenciones
    if (this.datos.intenciones) {
      const intentionValues = Object.values(this.datos.intenciones);
      const totalIntentions = intentionValues.reduce((sum, val) => sum + val, 0);
      
      if (Math.abs(totalIntentions - 1) > 0.01) {
        errors.push('La suma de intenciones debe ser aproximadamente 1');
      }
      
      if (Object.keys(this.datos.intenciones).length > REPORT_LIMITS.MAX_INTENTIONS_COUNT) {
        errors.push(`Máximo ${REPORT_LIMITS.MAX_INTENTIONS_COUNT} intenciones permitidas`);
      }
    }

    // Validar sentimiento
    if (this.datos.sentimiento) {
      const sentimentValues = Object.values(this.datos.sentimiento);
      const totalSentiment = sentimentValues.reduce((sum, val) => sum + val, 0);
      
      if (Math.abs(totalSentiment - 1) > 0.01) {
        errors.push('La suma de sentimientos debe ser aproximadamente 1');
      }
    }

    // Validar resumen_corto
    if (this.resumen_corto && this.resumen_corto.length > REPORT_LIMITS.MAX_SUMMARY_LENGTH) {
      this.resumen_corto = this.resumen_corto.substring(0, REPORT_LIMITS.MAX_SUMMARY_LENGTH);
      logger.warn('⚠️ Resumen corto truncado', {
        originalLength: this.resumen_corto.length,
        maxLength: REPORT_LIMITS.MAX_SUMMARY_LENGTH
      });
    }

    // Validar alertas
    if (this.alertas.length > REPORT_LIMITS.MAX_ALERTS_COUNT) {
      this.alertas = this.alertas.slice(0, REPORT_LIMITS.MAX_ALERTS_COUNT);
      logger.warn('⚠️ Alertas truncadas', {
        originalCount: this.alertas.length,
        maxCount: REPORT_LIMITS.MAX_ALERTS_COUNT
      });
    }

    // Validar metadata
    if (JSON.stringify(this.metadata).length > REPORT_LIMITS.MAX_METADATA_SIZE) {
      errors.push('metadata excede el tamaño máximo permitido');
    }

    if (errors.length > 0) {
      throw new Error(`Errores de validación: ${errors.join(', ')}`);
    }
  }

  /**
   * Calcular KPIs básicos
   */
  calculateKPIs() {
    const kpis = {};

    // SLA OK (regla simple: TMA < 60s)
    kpis.sla_ok = this.datos.tiempo_medio_respuesta_s < 60;

    // TMA en segundos
    kpis.tma_seg = this.datos.tiempo_medio_respuesta_s || 0;

    // FCR
    kpis.fcr = this.datos.fcr || 0;

    // Top intención
    if (this.datos.intenciones && Object.keys(this.datos.intenciones).length > 0) {
      const topIntention = Object.entries(this.datos.intenciones)
        .sort(([,a], [,b]) => b - a)[0];
      kpis.top_intencion = topIntention[0];
    }

    this.kpis = kpis;
    return kpis;
  }

  /**
   * Determinar alertas basadas en los datos
   */
  determineAlerts() {
    const alerts = [];

    // TMA alto (> 60s)
    if (this.datos.tiempo_medio_respuesta_s > 60) {
      alerts.push(ALERT_TYPES.TMA_ALTO);
    }

    // FCR bajo (< 0.5)
    if (this.datos.fcr < 0.5) {
      alerts.push(ALERT_TYPES.FCR_BAJO);
    }

    // SLA violado
    if (!this.kpis.sla_ok) {
      alerts.push(ALERT_TYPES.SLA_VIOLADO);
    }

    // Sentimiento negativo alto (> 0.3)
    if (this.datos.sentimiento?.negativo > 0.3) {
      alerts.push(ALERT_TYPES.SENTIMIENTO_NEGATIVO);
    }

    // Volumen bajo (< 100 mensajes)
    if (this.datos.mensajes_totales < 100) {
      alerts.push(ALERT_TYPES.VOLUMEN_BAJO);
    }

    // Datos incompletos
    if (!this.datos.mensajes_totales || !this.datos.tiempo_medio_respuesta_s || !this.datos.fcr) {
      alerts.push(ALERT_TYPES.DATOS_INCOMPLETOS);
    }

    this.alertas = alerts;
    return alerts;
  }

  /**
   * Obtener preview del reporte
   */
  getPreview() {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      tipo: this.tipo,
      periodo: this.periodo,
      kpis: this.kpis,
      alertas: this.alertas,
      resumen_corto: this.resumen_corto,
      createdAt: this.createdAt
    };
  }

  /**
   * Convertir a formato Firestore
   */
  toFirestore() {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      tipo: this.tipo,
      periodo: this.periodo,
      datos: this.datos,
      kpis: this.kpis,
      alertas: this.alertas,
      resumen_corto: this.resumen_corto,
      createdAt: this.createdAt,
      metadata: this.metadata
    };
  }

  /**
   * Crear desde datos de Firestore
   */
  static fromFirestore(data) {
    return new Report(data);
  }

  /**
   * Validar datos de entrada
   */
  static validate(data) {
    try {
      new Report(data);
      return { isValid: true };
    } catch (error) {
      return { isValid: false, errors: [error.message] };
    }
  }
}

module.exports = {
  Report,
  REPORT_TYPES,
  ALERT_TYPES,
  REPORT_LIMITS
}; 