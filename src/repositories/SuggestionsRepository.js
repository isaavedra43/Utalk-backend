/**
 * 🤖 REPOSITORIO DE SUGERENCIAS IA
 * 
 * Manejo de persistencia de sugerencias en Firestore
 * con índices optimizados y operaciones CRUD.
 * 
 * @version 1.0.0
 * @author Backend Team
 */

const { firestore } = require('../config/firebase');
const { Suggestion, SUGGESTION_STATES } = require('../models/Suggestion');
const logger = require('../utils/logger');

/**
 * Configuración de índices recomendados
 * 
 * Índices que deben crearse en Firestore:
 * 1. suggestions/{conversationId}/suggestions
 *    - conversationId (ascending)
 *    - createdAt (descending)
 * 
 * 2. suggestions/{conversationId}/suggestions
 *    - messageIdOrigen (ascending)
 *    - createdAt (descending)
 * 
 * 3. suggestions/{conversationId}/suggestions
 *    - estado (ascending)
 *    - createdAt (descending)
 * 
 * 4. suggestions/{conversationId}/suggestions
 *    - flagged (ascending)
 *    - createdAt (descending)
 */

class SuggestionsRepository {
  constructor() {
    this.collection = 'suggestions';
  }

  /**
   * Obtener referencia a la subcolección de sugerencias
   */
  getSuggestionsRef(conversationId) {
    return firestore
      .collection(this.collection)
      .doc(conversationId)
      .collection('suggestions');
  }

  /**
   * Guardar sugerencia en Firestore
   */
  async saveSuggestion(suggestion) {
    try {
      // Validar sugerencia antes de guardar
      if (!(suggestion instanceof Suggestion)) {
        throw new Error('Sugerencia debe ser una instancia de Suggestion');
      }

      const suggestionData = suggestion.toFirestore();
      const docRef = this.getSuggestionsRef(suggestion.conversationId).doc(suggestion.id);

      // Guardar con timestamp de Firestore
      await docRef.set({
        ...suggestionData,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp()
      });

      logger.info('✅ Sugerencia guardada en Firestore', {
        suggestionId: suggestion.id,
        conversationId: suggestion.conversationId,
        messageIdOrigen: suggestion.messageIdOrigen,
        estado: suggestion.estado,
        flagged: suggestion.flagged
      });

      return {
        success: true,
        suggestionId: suggestion.id,
        conversationId: suggestion.conversationId
      };

    } catch (error) {
      logger.error('❌ Error guardando sugerencia en Firestore', {
        suggestionId: suggestion?.id,
        conversationId: suggestion?.conversationId,
        error: error.message
      });

      throw new Error(`Error guardando sugerencia: ${error.message}`);
    }
  }

  /**
   * Obtener sugerencia por ID
   */
  async getSuggestionById(conversationId, suggestionId) {
    try {
      const docRef = this.getSuggestionsRef(conversationId).doc(suggestionId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      return Suggestion.fromFirestore(data);

    } catch (error) {
      logger.error('❌ Error obteniendo sugerencia por ID', {
        conversationId,
        suggestionId,
        error: error.message
      });

      throw new Error(`Error obteniendo sugerencia: ${error.message}`);
    }
  }

  /**
   * Obtener sugerencias por conversación
   */
  async getSuggestionsByConversation(conversationId, options = {}) {
    try {
      const {
        limit = 20,
        offset = 0,
        estado = null,
        flagged = null,
        orderBy = 'createdAt',
        orderDirection = 'desc'
      } = options;

      let query = this.getSuggestionsRef(conversationId);

      // Aplicar filtros
      if (estado) {
        query = query.where('estado', '==', estado);
      }

      if (flagged !== null) {
        query = query.where('flagged', '==', flagged);
      }

      // Aplicar ordenamiento
      query = query.orderBy(orderBy, orderDirection);

      // Aplicar paginación
      if (offset > 0) {
        // Para offset necesitaríamos implementar cursor-based pagination
        // Por simplicidad, usamos limit
        query = query.limit(limit + offset);
      } else {
        query = query.limit(limit);
      }

      const snapshot = await query.get();
      const suggestions = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        suggestions.push(Suggestion.fromFirestore(data));
      });

      // Aplicar offset manual si es necesario
      const result = offset > 0 ? suggestions.slice(offset) : suggestions;

      logger.info('✅ Sugerencias obtenidas por conversación', {
        conversationId,
        count: result.length,
        total: suggestions.length,
        filters: { estado, flagged }
      });

      return result;

    } catch (error) {
      logger.error('❌ Error obteniendo sugerencias por conversación', {
        conversationId,
        options,
        error: error.message
      });

      throw new Error(`Error obteniendo sugerencias: ${error.message}`);
    }
  }

  /**
   * Obtener sugerencias por mensaje origen
   */
  async getSuggestionsByMessage(conversationId, messageIdOrigen) {
    try {
      const query = this.getSuggestionsRef(conversationId)
        .where('messageIdOrigen', '==', messageIdOrigen)
        .orderBy('createdAt', 'desc');

      const snapshot = await query.get();
      const suggestions = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        suggestions.push(Suggestion.fromFirestore(data));
      });

      logger.info('✅ Sugerencias obtenidas por mensaje origen', {
        conversationId,
        messageIdOrigen,
        count: suggestions.length
      });

      return suggestions;

    } catch (error) {
      logger.error('❌ Error obteniendo sugerencias por mensaje origen', {
        conversationId,
        messageIdOrigen,
        error: error.message
      });

      throw new Error(`Error obteniendo sugerencias por mensaje: ${error.message}`);
    }
  }

  /**
   * Actualizar estado de sugerencia
   */
  async updateSuggestionStatus(conversationId, suggestionId, newStatus) {
    try {
      // Validar estado
      if (!Object.values(SUGGESTION_STATES).includes(newStatus)) {
        throw new Error(`Estado inválido: ${newStatus}`);
      }

      const docRef = this.getSuggestionsRef(conversationId).doc(suggestionId);
      
      await docRef.update({
        estado: newStatus,
        updatedAt: firestore.FieldValue.serverTimestamp()
      });

      logger.info('✅ Estado de sugerencia actualizado', {
        conversationId,
        suggestionId,
        newStatus
      });

      return {
        success: true,
        suggestionId,
        newStatus
      };

    } catch (error) {
      logger.error('❌ Error actualizando estado de sugerencia', {
        conversationId,
        suggestionId,
        newStatus,
        error: error.message
      });

      throw new Error(`Error actualizando estado: ${error.message}`);
    }
  }

  /**
   * Marcar sugerencia como enviada
   */
  async markAsSent(conversationId, suggestionId) {
    return this.updateSuggestionStatus(conversationId, suggestionId, SUGGESTION_STATES.SENT);
  }

  /**
   * Marcar sugerencia como descartada
   */
  async markAsDiscarded(conversationId, suggestionId) {
    return this.updateSuggestionStatus(conversationId, suggestionId, SUGGESTION_STATES.DISCARDED);
  }

  /**
   * Obtener estadísticas de sugerencias por conversación
   */
  async getSuggestionStats(conversationId) {
    try {
      const query = this.getSuggestionsRef(conversationId);
      const snapshot = await query.get();

      const stats = {
        total: 0,
        draft: 0,
        sent: 0,
        discarded: 0,
        flagged: 0,
        byType: {},
        byModel: {}
      };

      snapshot.forEach(doc => {
        const data = doc.data();
        stats.total++;

        // Contar por estado
        stats[data.estado] = (stats[data.estado] || 0) + 1;

        // Contar flagged
        if (data.flagged) {
          stats.flagged++;
        }

        // Contar por tipo
        const tipo = data.tipo || 'unknown';
        stats.byType[tipo] = (stats.byType[tipo] || 0) + 1;

        // Contar por modelo
        const modelo = data.modelo || 'unknown';
        stats.byModel[modelo] = (stats.byModel[modelo] || 0) + 1;
      });

      logger.info('✅ Estadísticas de sugerencias obtenidas', {
        conversationId,
        stats
      });

      return stats;

    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas de sugerencias', {
        conversationId,
        error: error.message
      });

      throw new Error(`Error obteniendo estadísticas: ${error.message}`);
    }
  }

  /**
   * Eliminar sugerencia (soft delete)
   */
  async deleteSuggestion(conversationId, suggestionId) {
    try {
      const docRef = this.getSuggestionsRef(conversationId).doc(suggestionId);
      
      await docRef.update({
        estado: SUGGESTION_STATES.DISCARDED,
        deletedAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp()
      });

      logger.info('✅ Sugerencia marcada como eliminada', {
        conversationId,
        suggestionId
      });

      return {
        success: true,
        suggestionId
      };

    } catch (error) {
      logger.error('❌ Error eliminando sugerencia', {
        conversationId,
        suggestionId,
        error: error.message
      });

      throw new Error(`Error eliminando sugerencia: ${error.message}`);
    }
  }

  /**
   * Buscar sugerencias con filtros avanzados
   */
  async searchSuggestions(conversationId, filters = {}) {
    try {
      const {
        texto = '',
        tipo = null,
        modelo = null,
        confianzaMin = 0,
        confianzaMax = 1,
        fechaDesde = null,
        fechaHasta = null,
        limit = 20
      } = filters;

      let query = this.getSuggestionsRef(conversationId);

      // Aplicar filtros
      if (tipo) {
        query = query.where('tipo', '==', tipo);
      }

      if (modelo) {
        query = query.where('modelo', '==', modelo);
      }

      if (confianzaMin > 0) {
        query = query.where('confianza', '>=', confianzaMin);
      }

      if (confianzaMax < 1) {
        query = query.where('confianza', '<=', confianzaMax);
      }

      // Ordenar por fecha
      query = query.orderBy('createdAt', 'desc').limit(limit);

      const snapshot = await query.get();
      const suggestions = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Filtro de texto (post-query)
        if (texto && !data.texto.toLowerCase().includes(texto.toLowerCase())) {
          return;
        }

        // Filtro de fecha (post-query)
        if (fechaDesde && new Date(data.createdAt) < new Date(fechaDesde)) {
          return;
        }

        if (fechaHasta && new Date(data.createdAt) > new Date(fechaHasta)) {
          return;
        }

        suggestions.push(Suggestion.fromFirestore(data));
      });

      logger.info('✅ Búsqueda de sugerencias completada', {
        conversationId,
        filters,
        count: suggestions.length
      });

      return suggestions;

    } catch (error) {
      logger.error('❌ Error en búsqueda de sugerencias', {
        conversationId,
        filters,
        error: error.message
      });

      throw new Error(`Error en búsqueda: ${error.message}`);
    }
  }
}

module.exports = SuggestionsRepository;