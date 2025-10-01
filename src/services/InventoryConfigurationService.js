/**
 * ⚙️ SERVICIO DE CONFIGURACIÓN DE INVENTARIO
 * 
 * Maneja la configuración del módulo de inventario.
 * 
 * @version 1.0.0
 */

const InventoryConfiguration = require('../models/InventoryConfiguration');
const Provider = require('../models/Provider');
const Material = require('../models/Material');
const logger = require('../utils/logger');

class InventoryConfigurationService {
  /**
   * Obtiene la configuración completa del usuario
   */
  async getConfiguration(userId) {
    try {
      logger.info('Obteniendo configuración de inventario', { userId });

      // Obtener configuración
      const config = await InventoryConfiguration.getByUser(userId);

      // Obtener proveedores
      const providersResult = await Provider.listByUser(userId, { limit: 1000 });

      // Obtener materiales
      const materialsResult = await Material.listByUser(userId, { limit: 1000 });

      const fullConfig = {
        providers: providersResult.providers,
        materials: materialsResult.materials,
        settings: config.settings,
        lastUpdated: config.lastUpdated,
        version: config.version
      };

      logger.info('Configuración obtenida exitosamente', { userId });

      return fullConfig;
    } catch (error) {
      logger.error('Error obteniendo configuración', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Actualiza la configuración completa
   */
  async updateConfiguration(userId, configData) {
    try {
      logger.info('Actualizando configuración de inventario', { userId });

      const config = await InventoryConfiguration.getByUser(userId);

      // Actualizar configuración
      await config.update({
        settings: configData.settings,
        preferences: configData.preferences,
        version: configData.version
      });

      // Si se proporcionan proveedores, actualizar
      if (configData.providers && Array.isArray(configData.providers)) {
        // Eliminar proveedores existentes que no están en la nueva lista
        const existingProviders = await Provider.listByUser(userId, { limit: 1000 });
        const newProviderIds = configData.providers.map(p => p.id);
        
        for (const existing of existingProviders.providers) {
          if (!newProviderIds.includes(existing.id)) {
            await existing.delete();
          }
        }

        // Crear o actualizar proveedores
        for (const providerData of configData.providers) {
          const existing = await Provider.findById(userId, providerData.id);
          if (existing) {
            await existing.update(providerData);
          } else {
            const provider = new Provider({ ...providerData, userId });
            await provider.save();
          }
        }
      }

      // Si se proporcionan materiales, actualizar
      if (configData.materials && Array.isArray(configData.materials)) {
        // Eliminar materiales existentes que no están en la nueva lista
        const existingMaterials = await Material.listByUser(userId, { limit: 1000 });
        const newMaterialIds = configData.materials.map(m => m.id);
        
        for (const existing of existingMaterials.materials) {
          if (!newMaterialIds.includes(existing.id)) {
            await existing.delete();
          }
        }

        // Crear o actualizar materiales
        for (const materialData of configData.materials) {
          const existing = await Material.findById(userId, materialData.id);
          if (existing) {
            await existing.update(materialData);
          } else {
            const material = new Material({ ...materialData, userId });
            await material.save();
          }
        }
      }

      logger.info('Configuración actualizada exitosamente', { userId });

      // Retornar configuración actualizada
      return await this.getConfiguration(userId);
    } catch (error) {
      logger.error('Error actualizando configuración', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Sincroniza configuración con el cliente
   */
  async syncConfiguration(userId, clientData) {
    try {
      logger.info('Sincronizando configuración', { userId, clientData });

      const serverConfig = await InventoryConfiguration.getByUser(userId);
      
      const clientLastUpdated = new Date(clientData.lastUpdated);
      const serverLastUpdated = new Date(serverConfig.lastUpdated);

      const needsUpdate = serverLastUpdated > clientLastUpdated;

      let response = {
        needsUpdate,
        serverConfig: null,
        conflicts: [],
        lastServerUpdate: serverConfig.lastUpdated
      };

      if (needsUpdate) {
        response.serverConfig = await this.getConfiguration(userId);
      }

      logger.info('Sincronización completada', { userId, needsUpdate });

      return response;
    } catch (error) {
      logger.error('Error sincronizando configuración', { userId, error: error.message });
      throw error;
    }
  }
}

module.exports = InventoryConfigurationService;

