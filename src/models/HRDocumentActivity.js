const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Modelo de Actividad de Documentos de RH
 * Gestiona el historial de actividades de documentos
 * Alineado 100% con especificaciones del Frontend
 */
class HRDocumentActivity {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.documentId = data.documentId || '';
    this.documentName = data.documentName || '';
    this.userId = data.userId || '';
    this.userName = data.userName || '';
    this.action = data.action || '';
    this.details = data.details || {};
    this.timestamp = data.timestamp || new Date().toISOString();
    this.ipAddress = data.ipAddress || '';
    this.userAgent = data.userAgent || '';
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

    const validActions = [
      'upload', 'download', 'view', 'edit', 'delete', 
      'favorite', 'unfavorite', 'pin', 'unpin', 
      'share', 'duplicate', 'move'
    ];

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
      documentName: this.documentName,
      userId: this.userId,
      userName: this.userName,
      action: this.action,
      details: this.details,
      timestamp: this.timestamp,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent
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
  static async logActivity(documentId, userId, userName, action, details = {}) {
    try {
      // Obtener nombre del documento si no se proporciona
      let documentName = details.documentName || '';
      if (!documentName) {
        try {
          const HRDocument = require('./HRDocument');
          const document = await HRDocument.findById(documentId);
          if (document) {
            documentName = document.name;
          }
        } catch (e) {
          console.warn('No se pudo obtener el nombre del documento:', e.message);
        }
      }

      const activity = new HRDocumentActivity({
        documentId,
        documentName,
        userId,
        userName,
        action,
        details,
        timestamp: new Date().toISOString(),
        ipAddress: details.ipAddress || '',
        userAgent: details.userAgent || ''
      });

      await activity.save();

      // Limpiar actividades antiguas (mantener solo las últimas 1000)
      await HRDocumentActivity.cleanupOldActivities();

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
        limit = 50,
        offset = 0
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

      // Ordenar por timestamp (más recientes primero)
      query = query.orderBy('timestamp', 'desc');

      // Paginación
      query = query.offset(offset).limit(limit);

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
  static async getStats(options = {}) {
    try {
      const {
        days = 30,
        userId = null,
        documentId = null
      } = options;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let query = db.collection('hr_documents').doc('activity_log')
        .collection('list')
        .where('timestamp', '>=', startDate.toISOString());

      if (userId) {
        query = query.where('userId', '==', userId);
      }

      if (documentId) {
        query = query.where('documentId', '==', documentId);
      }

      const snapshot = await query.get();
      const activities = [];

      snapshot.forEach(doc => {
        activities.push(HRDocumentActivity.fromFirestore(doc));
      });

      const stats = {
        totalActivities: activities.length,
        byAction: {},
        byUser: {},
        byDocument: {},
        recentActivities: [],
        dailyActivity: {}
      };

      // Procesar estadísticas
      activities.forEach(activity => {
        // Por acción
        stats.byAction[activity.action] = (stats.byAction[activity.action] || 0) + 1;

        // Por usuario
        stats.byUser[activity.userName] = (stats.byUser[activity.userName] || 0) + 1;

        // Por documento
        stats.byDocument[activity.documentName] = (stats.byDocument[activity.documentName] || 0) + 1;

        // Actividad diaria
        const date = activity.timestamp.split('T')[0];
        stats.dailyActivity[date] = (stats.dailyActivity[date] || 0) + 1;
      });

      // Actividades recientes
      stats.recentActivities = activities
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 20)
        .map(activity => ({
          id: activity.id,
          documentName: activity.documentName,
          userName: activity.userName,
          action: activity.action,
          timestamp: activity.timestamp
        }));

      return stats;
    } catch (error) {
      console.error('Error getting HR document activity stats:', error);
      throw error;
    }
  }

  /**
   * Limpia actividades antiguas
   */
  static async cleanupOldActivities() {
    try {
      const maxActivities = 1000;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 365); // 1 año

      // Obtener todas las actividades ordenadas por timestamp
      let query = db.collection('hr_documents').doc('activity_log')
        .collection('list')
        .orderBy('timestamp', 'desc');

      const snapshot = await query.get();
      
      if (snapshot.size <= maxActivities) {
        return; // No hay que limpiar
      }

      const activitiesToDelete = [];
      let count = 0;

      snapshot.forEach(doc => {
        count++;
        if (count > maxActivities) {
          activitiesToDelete.push(doc.ref);
        }
      });

      // Eliminar actividades excedentes
      const batch = db.batch();
      activitiesToDelete.forEach(ref => {
        batch.delete(ref);
      });

      await batch.commit();

      console.log(`Cleaned up ${activitiesToDelete.length} old HR document activities`);
    } catch (error) {
      console.error('Error cleaning up old HR document activities:', error);
      throw error;
    }
  }

  /**
   * Busca una actividad por ID
   */
  static async findById(id) {
    try {
      const doc = await db.collection('hr_documents').doc('activity_log')
        .collection('list').doc(id).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return HRDocumentActivity.fromFirestore(doc);
    } catch (error) {
      console.error('Error finding HR document activity by ID:', error);
      throw error;
    }
  }

  /**
   * Elimina una actividad
   */
  static async delete(id) {
    try {
      const docRef = db.collection('hr_documents').doc('activity_log')
        .collection('list').doc(id);
      
      await docRef.delete();
      
      return true;
    } catch (error) {
      console.error('Error deleting HR document activity:', error);
      throw error;
    }
  }

  /**
   * Elimina todas las actividades de un documento
   */
  static async deleteByDocument(documentId) {
    try {
      const query = db.collection('hr_documents').doc('activity_log')
        .collection('list').where('documentId', '==', documentId);

      const snapshot = await query.get();
      
      if (snapshot.empty) {
        return 0;
      }

      const batch = db.batch();
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      return snapshot.size;
    } catch (error) {
      console.error('Error deleting HR document activities by document:', error);
      throw error;
    }
  }
}

module.exports = HRDocumentActivity;