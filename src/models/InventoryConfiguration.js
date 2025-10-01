/**
 * ⚙️ MODELO DE CONFIGURACIÓN DE INVENTARIO
 * 
 * Gestiona la configuración del módulo de inventario por usuario.
 * 
 * @version 1.0.0
 */

const { db } = require('../config/firebase');

class InventoryConfiguration {
  constructor(data = {}) {
    this.userId = data.userId;
    this.settings = data.settings || {
      defaultStandardWidth: 0.3,
      autoSaveEnabled: true,
      showPieceNumbers: true,
      allowMultipleMaterials: true,
      requireMaterialSelection: true,
      defaultMaterialCategories: ['Mármol', 'Granito', 'Cuarzo', 'Travertino', 'Ónix'],
      syncInterval: 300000,
      autoSync: true,
      notifications: {
        syncSuccess: true,
        syncError: true,
        offlineMode: true
      },
      export: {
        defaultFormat: 'excel',
        includeImages: true,
        includeSummary: true
      },
      ui: {
        theme: 'light',
        compactMode: false,
        showAdvancedOptions: false
      }
    };
    this.lastUpdated = data.lastUpdated || new Date();
    this.version = data.version || '1.0.0';
    this.preferences = data.preferences || {};
  }

  /**
   * Convierte la instancia a formato Firestore
   */
  toFirestore() {
    return {
      userId: this.userId,
      settings: this.settings,
      lastUpdated: this.lastUpdated,
      version: this.version,
      preferences: this.preferences
    };
  }

  /**
   * Crea una instancia desde un documento de Firestore
   */
  static fromFirestore(doc) {
    if (!doc.exists) return null;
    
    const data = doc.data();
    return new InventoryConfiguration({
      userId: doc.id,
      ...data,
      lastUpdated: data.lastUpdated?.toDate?.() || data.lastUpdated
    });
  }

  /**
   * Guarda la configuración en Firestore
   */
  async save() {
    try {
      this.lastUpdated = new Date();
      const docRef = db.collection('inventory_configuration').doc(this.userId);
      
      await docRef.set(this.toFirestore());
      return this;
    } catch (error) {
      console.error('Error guardando configuración:', error);
      throw error;
    }
  }

  /**
   * Obtiene la configuración de un usuario
   */
  static async getByUser(userId) {
    try {
      const doc = await db.collection('inventory_configuration').doc(userId).get();
      
      if (!doc.exists) {
        // Crear configuración por defecto
        const defaultConfig = new InventoryConfiguration({ userId });
        await defaultConfig.save();
        return defaultConfig;
      }

      const data = doc.data();
      return new InventoryConfiguration({
        userId,
        ...data,
        lastUpdated: data.lastUpdated?.toDate?.() || data.lastUpdated
      });
    } catch (error) {
      console.error('Error obteniendo configuración:', error);
      throw error;
    }
  }

  /**
   * Actualiza la configuración
   */
  async update(updates) {
    try {
      if (updates.settings) {
        this.settings = { ...this.settings, ...updates.settings };
      }
      if (updates.preferences) {
        this.preferences = { ...this.preferences, ...updates.preferences };
      }
      if (updates.version) {
        this.version = updates.version;
      }

      this.lastUpdated = new Date();
      
      const docRef = db.collection('inventory_configuration').doc(this.userId);
      
      await docRef.update(this.toFirestore());
      return this;
    } catch (error) {
      console.error('Error actualizando configuración:', error);
      throw error;
    }
  }
}

module.exports = InventoryConfiguration;

