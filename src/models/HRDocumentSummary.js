const { db } = require('../config/firebase');

/**
 * Modelo de Resumen de Documentos de RH
 * Gestiona las estadísticas generales de la biblioteca de documentos
 * Alineado 100% con especificaciones del Frontend
 */
class HRDocumentSummary {
  constructor(data = {}) {
    this.totalDocuments = data.totalDocuments || 0;
    this.totalSize = data.totalSize || 0;
    this.byCategory = data.byCategory || {};
    this.byType = data.byType || {};
    this.recentUploads = data.recentUploads || [];
    this.mostDownloaded = data.mostDownloaded || [];
    this.mostViewed = data.mostViewed || [];
    this.pinnedDocuments = data.pinnedDocuments || [];
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Convierte el modelo a objeto plano para Firebase
   */
  toFirestore() {
    return {
      totalDocuments: this.totalDocuments,
      totalSize: this.totalSize,
      byCategory: this.byCategory,
      byType: this.byType,
      recentUploads: this.recentUploads,
      mostDownloaded: this.mostDownloaded,
      mostViewed: this.mostViewed,
      pinnedDocuments: this.pinnedDocuments,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Crea un resumen desde datos de Firestore
   */
  static fromFirestore(doc) {
    return new HRDocumentSummary(doc.data());
  }

  /**
   * Obtiene o crea el resumen de documentos
   */
  static async getOrCreate() {
    try {
      const docRef = db.collection('hr_documents').doc('documentSummary');
      const doc = await docRef.get();

      if (doc.exists) {
        return HRDocumentSummary.fromFirestore(doc);
      } else {
        // Crear resumen inicial
        const initialSummary = new HRDocumentSummary();
        await initialSummary.save();
        return initialSummary;
      }
    } catch (error) {
      console.error('Error getting or creating HR document summary:', error);
      throw error;
    }
  }

  /**
   * Guarda el resumen en Firebase
   */
  async save() {
    try {
      this.updatedAt = new Date().toISOString();
      
      const docRef = db.collection('hr_documents').doc('documentSummary');
      await docRef.set(this.toFirestore());

      return this;
    } catch (error) {
      console.error('Error saving HR document summary:', error);
      throw error;
    }
  }

  /**
   * Actualiza el resumen cuando se sube un documento
   */
  async addDocument(document) {
    try {
      this.totalDocuments += 1;
      this.totalSize += document.fileSize;

      // Actualizar por categoría
      this.byCategory[document.category] = (this.byCategory[document.category] || 0) + 1;

      // Actualizar por tipo
      this.byType[document.type] = (this.byType[document.type] || 0) + 1;

      // Agregar a subidas recientes
      this.recentUploads.unshift({
        id: document.id,
        name: document.name,
        uploadedAt: document.uploadedAt
      });

      // Mantener solo los 10 más recientes
      if (this.recentUploads.length > 10) {
        this.recentUploads = this.recentUploads.slice(0, 10);
      }

      // Si está fijado, agregar a documentos fijados
      if (document.isPinned) {
        this.pinnedDocuments.push({
          id: document.id,
          name: document.name
        });
      }

      await this.save();
      return this;
    } catch (error) {
      console.error('Error adding document to summary:', error);
      throw error;
    }
  }

  /**
   * Actualiza el resumen cuando se elimina un documento
   */
  async removeDocument(document) {
    try {
      this.totalDocuments = Math.max(0, this.totalDocuments - 1);
      this.totalSize = Math.max(0, this.totalSize - document.fileSize);

      // Actualizar por categoría
      if (this.byCategory[document.category]) {
        this.byCategory[document.category] = Math.max(0, this.byCategory[document.category] - 1);
        if (this.byCategory[document.category] === 0) {
          delete this.byCategory[document.category];
        }
      }

      // Actualizar por tipo
      if (this.byType[document.type]) {
        this.byType[document.type] = Math.max(0, this.byType[document.type] - 1);
        if (this.byType[document.type] === 0) {
          delete this.byType[document.type];
        }
      }

      // Remover de subidas recientes
      this.recentUploads = this.recentUploads.filter(item => item.id !== document.id);

      // Remover de documentos fijados
      this.pinnedDocuments = this.pinnedDocuments.filter(item => item.id !== document.id);

      // Remover de más descargados
      this.mostDownloaded = this.mostDownloaded.filter(item => item.id !== document.id);

      // Remover de más vistos
      this.mostViewed = this.mostViewed.filter(item => item.id !== document.id);

      await this.save();
      return this;
    } catch (error) {
      console.error('Error removing document from summary:', error);
      throw error;
    }
  }

  /**
   * Actualiza las estadísticas de descargas
   */
  async updateDownloadStats(document) {
    try {
      // Actualizar más descargados
      const existingIndex = this.mostDownloaded.findIndex(item => item.id === document.id);
      
      if (existingIndex >= 0) {
        this.mostDownloaded[existingIndex].downloadCount = document.downloadCount;
      } else {
        this.mostDownloaded.push({
          id: document.id,
          name: document.name,
          downloadCount: document.downloadCount
        });
      }

      // Ordenar por descargas
      this.mostDownloaded.sort((a, b) => b.downloadCount - a.downloadCount);
      
      // Mantener solo los 10 más descargados
      if (this.mostDownloaded.length > 10) {
        this.mostDownloaded = this.mostDownloaded.slice(0, 10);
      }

      await this.save();
      return this;
    } catch (error) {
      console.error('Error updating download stats:', error);
      throw error;
    }
  }

  /**
   * Actualiza las estadísticas de visualizaciones
   */
  async updateViewStats(document) {
    try {
      // Actualizar más vistos
      const existingIndex = this.mostViewed.findIndex(item => item.id === document.id);
      
      if (existingIndex >= 0) {
        this.mostViewed[existingIndex].viewCount = document.viewCount;
      } else {
        this.mostViewed.push({
          id: document.id,
          name: document.name,
          viewCount: document.viewCount
        });
      }

      // Ordenar por visualizaciones
      this.mostViewed.sort((a, b) => b.viewCount - a.viewCount);
      
      // Mantener solo los 10 más vistos
      if (this.mostViewed.length > 10) {
        this.mostViewed = this.mostViewed.slice(0, 10);
      }

      await this.save();
      return this;
    } catch (error) {
      console.error('Error updating view stats:', error);
      throw error;
    }
  }

  /**
   * Actualiza el estado de fijado
   */
  async updatePinStatus(document) {
    try {
      if (document.isPinned) {
        // Agregar a fijados si no existe
        const existingIndex = this.pinnedDocuments.findIndex(item => item.id === document.id);
        if (existingIndex === -1) {
          this.pinnedDocuments.push({
            id: document.id,
            name: document.name
          });
        }
      } else {
        // Remover de fijados
        this.pinnedDocuments = this.pinnedDocuments.filter(item => item.id !== document.id);
      }

      await this.save();
      return this;
    } catch (error) {
      console.error('Error updating pin status:', error);
      throw error;
    }
  }

  /**
   * Recalcula todas las estadísticas desde los documentos
   */
  async recalculateStats() {
    try {
      const HRDocument = require('./HRDocument');
      const documents = await HRDocument.list({ limit: 1000 }); // Obtener todos

      // Resetear estadísticas
      this.totalDocuments = documents.length;
      this.totalSize = 0;
      this.byCategory = {};
      this.byType = {};
      this.recentUploads = [];
      this.mostDownloaded = [];
      this.mostViewed = [];
      this.pinnedDocuments = [];

      // Recalcular
      documents.forEach(doc => {
        this.totalSize += doc.fileSize;

        // Por categoría
        this.byCategory[doc.category] = (this.byCategory[doc.category] || 0) + 1;

        // Por tipo
        this.byType[doc.type] = (this.byType[doc.type] || 0) + 1;

        // Documentos fijados
        if (doc.isPinned) {
          this.pinnedDocuments.push({
            id: doc.id,
            name: doc.name
          });
        }
      });

      // Más descargados
      this.mostDownloaded = documents
        .sort((a, b) => b.downloadCount - a.downloadCount)
        .slice(0, 10)
        .map(doc => ({
          id: doc.id,
          name: doc.name,
          downloadCount: doc.downloadCount
        }));

      // Más vistos
      this.mostViewed = documents
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, 10)
        .map(doc => ({
          id: doc.id,
          name: doc.name,
          viewCount: doc.viewCount
        }));

      // Subidas recientes
      this.recentUploads = documents
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
        .slice(0, 10)
        .map(doc => ({
          id: doc.id,
          name: doc.name,
          uploadedAt: doc.uploadedAt
        }));

      await this.save();
      return this;
    } catch (error) {
      console.error('Error recalculating stats:', error);
      throw error;
    }
  }
}

module.exports = HRDocumentSummary;
