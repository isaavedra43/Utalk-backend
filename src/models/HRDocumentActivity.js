const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo de Actividad de Documentos de RH
 * Registra todas las acciones realizadas en documentos
 * Alineado 100% con especificaciones del Frontend
 */
class HRDocumentActivity {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.documentId = data.documentId || '';
    this.userId = data.userId || '';
    this.userName = data.userName || '';
    this.action = data.action || '';
    this.timestamp = data.timestamp || new Date().toISOString();
    this.metadata = data.metadata || {};
  }

  /**
   * Valida los datos de la actividad
   */
  validate() {
    const errors = [];

    if (!this.documentId) {
      errors.push('El ID del documento es requerido');
    }

    if (!this.userId) {
      errors.push('El ID del usuario es requerido');
    }

    if (!this.userName) {
      errors.push('El nombre del usuario es requerido');
    }

    if (!this.action) {
      errors.push('La acción es requerida');
    }

    const validActions = ['upload', 'download', 'view', 'edit', 'delete', 'favorite', 'unfavorite', 'pin', 'unpin', 'share', 'duplicate', 'move'];
    if (!validActions.includes(this.action)) {
      errors.push('La acción no es válida');
    }

    return errors;
  }

  /**
   * Convierte el modelo a objeto plano para Firebase
   */
  toFirestore() {
    return {
      id: this.id,
      documentId: this.documentId,
      userId: this.userId,
      userName: this.userName,
      action: this.action,
      timestamp: this.timestamp,
      metadata: this.metadata
    };
  }

  /**
   * Crea una actividad desde datos de Firestore
   */
  static fromFirestore(doc) {
    return new HRDocumentActivity({ id: doc.id, ...doc.data() });
  }

  /**
   * Guarda la actividad en Firebase
   */
  async save() {
    try {
      const errors = this.validate();
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      const docRef = db.collection('hr_documents').doc('activity_log')
        .collection('list').doc(this.id);
      
      await docRef.set(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error saving HR document activity:', error);
      throw error;
    }
  }

  /**
   * Registra una nueva actividad
   */
  static async logActivity(documentId, userId, userName, action, metadata = {}) {
    try {
      const activity = new HRDocumentActivity({
        documentId,
        userId,
        userName,
        action,
        metadata: {
          ...metadata,
          ipAddress: metadata.ipAddress || 'unknown',
          userAgent: metadata.userAgent || 'unknown',
          timestamp: new Date().toISOString()
        }
      });

      await activity.save();
      return activity;
    } catch (error) {
      console.error('Error logging HR document activity:', error);
      throw error;
    }
  }

  /**
   * Lista actividades con filtros
   */
  static async list(options = {}) {
    try {
      const {
        documentId = null,
        userId = null,
        action = null,
        dateFrom = null,
        dateTo = null,
        limit = 50
      } = options;

      let query = db.collection('hr_documents').doc('activity_log').collection('list');

      // Aplicar filtros
      if (documentId) {
        query = query.where('documentId', '==', documentId);
      }

      if (userId) {
        query = query.where('userId', '==', userId);
      }

      if (action) {
        query = query.where('action', '==', action);
      }

      if (dateFrom) {
        query = query.where('timestamp', '>=', dateFrom);
      }

      if (dateTo) {
        query = query.where('timestamp', '<=', dateTo);
      }

      // Ordenar por timestamp (más recientes primero)
      query = query.orderBy('timestamp', 'desc').limit(limit);

      const snapshot = await query.get();
      const activities = [];

      snapshot.forEach(doc => {
        activities.push(HRDocumentActivity.fromFirestore(doc));
      });

      return activities;
    } catch (error) {
      console.error('Error listing HR document activities:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de actividad
   */
  static async getActivityStats(options = {}) {
    try {
      const {
        documentId = null,
        userId = null,
        dateFrom = null,
        dateTo = null
      } = options;

      let query = db.collection('hr_documents').doc('activity_log').collection('list');

      if (documentId) {
        query = query.where('documentId', '==', documentId);
      }

      if (userId) {
        query = query.where('userId', '==', userId);
      }

      if (dateFrom) {
        query = query.where('timestamp', '>=', dateFrom);
      }

      if (dateTo) {
        query = query.where('timestamp', '<=', dateTo);
      }

      const snapshot = await query.get();
      const stats = {
        totalActivities: 0,
        byAction: {},
        byUser: {},
        byDocument: {},
        recentActivities: []
      };

      const activities = [];
      snapshot.forEach(doc => {
        activities.push(HRDocumentActivity.fromFirestore(doc));
      });

      // Procesar estadísticas
      activities.forEach(activity => {
        stats.totalActivities++;

        // Por acción
        stats.byAction[activity.action] = (stats.byAction[activity.action] || 0) + 1;

        // Por usuario
        if (!stats.byUser[activity.userId]) {
          stats.byUser[activity.userId] = {
            userId: activity.userId,
            userName: activity.userName,
            count: 0,
            actions: {}
          };
        }
        stats.byUser[activity.userId].count++;
        stats.byUser[activity.userId].actions[activity.action] = 
          (stats.byUser[activity.userId].actions[activity.action] || 0) + 1;

        // Por documento
        if (!stats.byDocument[activity.documentId]) {
          stats.byDocument[activity.documentId] = {
            documentId: activity.documentId,
            count: 0,
            actions: {}
          };
        }
        stats.byDocument[activity.documentId].count++;
        stats.byDocument[activity.documentId].actions[activity.action] = 
          (stats.byDocument[activity.documentId].actions[activity.action] || 0) + 1;
      });

      // Actividades recientes
      stats.recentActivities = activities
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 20)
        .map(activity => ({
          id: activity.id,
          documentId: activity.documentId,
          userId: activity.userId,
          userName: activity.userName,
          action: activity.action,
          timestamp: activity.timestamp,
          metadata: activity.metadata
        }));

      return stats;
    } catch (error) {
      console.error('Error getting HR document activity stats:', error);
      throw error;
    }
  }

  /**
   * Obtiene el historial de un documento específico
   */
  static async getDocumentHistory(documentId, limit = 50) {
    try {
      return await HRDocumentActivity.list({
        documentId,
        limit
      });
    } catch (error) {
      console.error('Error getting document history:', error);
      throw error;
    }
  }

  /**
   * Obtiene el historial de un usuario específico
   */
  static async getUserHistory(userId, limit = 50) {
    try {
      return await HRDocumentActivity.list({
        userId,
        limit
      });
    } catch (error) {
      console.error('Error getting user history:', error);
      throw error;
    }
  }

  /**
   * Obtiene las actividades más recientes
   */
  static async getRecentActivities(limit = 20) {
    try {
      return await HRDocumentActivity.list({
        limit
      });
    } catch (error) {
      console.error('Error getting recent activities:', error);
      throw error;
    }
  }

  /**
   * Limpia actividades antiguas (más de 1 año)
   */
  static async cleanupOldActivities() {
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const query = db.collection('hr_documents').doc('activity_log')
        .collection('list')
        .where('timestamp', '<', oneYearAgo.toISOString())
        .limit(500); // Procesar en lotes

      const snapshot = await query.get();
      const batch = db.batch();

      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      return {
        deleted: snapshot.docs.length,
        cutoffDate: oneYearAgo.toISOString()
      };
    } catch (error) {
      console.error('Error cleaning up old activities:', error);
      throw error;
    }
  }
}

module.exports = HRDocumentActivity;
