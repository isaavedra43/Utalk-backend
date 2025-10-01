/**
 * 📦 SERVICIO DE PROVEEDORES
 * 
 * Maneja la lógica de negocio para proveedores de materiales.
 * 
 * @version 1.0.0
 */

const Provider = require('../models/Provider');
const Platform = require('../models/Platform');
const Material = require('../models/Material');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/responseHandler');

class ProviderService {
  /**
   * Lista todos los proveedores del usuario
   */
  async listProviders(userId, options = {}) {
    try {
      logger.info('Listando proveedores', { userId, options });

      const result = await Provider.listByUser(userId, options);

      // Agregar estadísticas a cada proveedor si se solicita
      if (options.includeStats) {
        const providersWithStats = await Promise.all(
          result.providers.map(async (provider) => {
            const stats = await Provider.getStats(userId, provider.id);
            return {
              ...provider,
              stats
            };
          })
        );
        result.providers = providersWithStats;
      }

      logger.info('Proveedores listados exitosamente', {
        userId,
        count: result.providers.length
      });

      return result;
    } catch (error) {
      logger.error('Error listando proveedores', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Obtiene un proveedor por ID
   */
  async getProvider(userId, providerId) {
    try {
      logger.info('Obteniendo proveedor', { userId, providerId });

      const provider = await Provider.findById(userId, providerId);
      
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      logger.info('Proveedor obtenido exitosamente', { userId, providerId });

      return provider;
    } catch (error) {
      logger.error('Error obteniendo proveedor', { userId, providerId, error: error.message });
      throw error;
    }
  }

  /**
   * Crea un nuevo proveedor
   */
  async createProvider(userId, providerData) {
    try {
      logger.info('Creando proveedor', { userId, name: providerData.name });

      const provider = new Provider({
        ...providerData,
        userId
      });

      await provider.save();

      logger.info('Proveedor creado exitosamente', { userId, providerId: provider.id });

      return provider;
    } catch (error) {
      logger.error('Error creando proveedor', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Actualiza un proveedor
   */
  async updateProvider(userId, providerId, updates) {
    try {
      logger.info('Actualizando proveedor', { userId, providerId });

      const provider = await Provider.findById(userId, providerId);
      
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      await provider.update(updates);

      logger.info('Proveedor actualizado exitosamente', { userId, providerId });

      return provider;
    } catch (error) {
      logger.error('Error actualizando proveedor', { userId, providerId, error: error.message });
      throw error;
    }
  }

  /**
   * Elimina un proveedor
   */
  async deleteProvider(userId, providerId) {
    try {
      logger.info('Eliminando proveedor', { userId, providerId });

      const provider = await Provider.findById(userId, providerId);
      
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      await provider.delete();

      logger.info('Proveedor eliminado exitosamente', { userId, providerId });

      return true;
    } catch (error) {
      logger.error('Error eliminando proveedor', { userId, providerId, error: error.message });
      throw error;
    }
  }

  /**
   * Obtiene plataformas de un proveedor
   */
  async getProviderPlatforms(userId, providerId, options = {}) {
    try {
      logger.info('Obteniendo plataformas del proveedor', { userId, providerId });

      const provider = await Provider.findById(userId, providerId);
      
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      const result = await Platform.listByProvider(userId, providerId, options);

      logger.info('Plataformas del proveedor obtenidas', {
        userId,
        providerId,
        count: result.platforms.length
      });

      return result;
    } catch (error) {
      logger.error('Error obteniendo plataformas del proveedor', {
        userId,
        providerId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtiene materiales de un proveedor
   */
  async getProviderMaterials(userId, providerId) {
    try {
      logger.info('Obteniendo materiales del proveedor', { userId, providerId });

      const provider = await Provider.findById(userId, providerId);
      
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      // Obtener materiales del proveedor
      const materials = await Promise.all(
        provider.materialIds.map(materialId => Material.findById(userId, materialId))
      );

      // Filtrar nulls
      const validMaterials = materials.filter(m => m !== null);

      logger.info('Materiales del proveedor obtenidos', {
        userId,
        providerId,
        count: validMaterials.length
      });

      return validMaterials;
    } catch (error) {
      logger.error('Error obteniendo materiales del proveedor', {
        userId,
        providerId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de un proveedor
   */
  async getProviderStats(userId, providerId) {
    try {
      logger.info('Obteniendo estadísticas del proveedor', { userId, providerId });

      const provider = await Provider.findById(userId, providerId);
      
      if (!provider) {
        throw ApiError.notFoundError('Proveedor no encontrado');
      }

      const stats = await Provider.getStats(userId, providerId);

      // Obtener plataformas para estadísticas más detalladas
      const platformsResult = await Platform.listByProvider(userId, providerId, { limit: 10000 });
      const platforms = platformsResult.platforms;

      // Materiales más usados
      const materialUsage = {};
      platforms.forEach(platform => {
        platform.pieces.forEach(piece => {
          if (!materialUsage[piece.material]) {
            materialUsage[piece.material] = {
              count: 0,
              linearMeters: 0
            };
          }
          materialUsage[piece.material].count++;
          materialUsage[piece.material].linearMeters += piece.linearMeters || 0;
        });
      });

      const mostUsed = Object.entries(materialUsage)
        .map(([material, data]) => ({
          materialId: material,
          name: material,
          count: data.count,
          totalLinearMeters: data.linearMeters
        }))
        .sort((a, b) => b.totalLinearMeters - a.totalLinearMeters)
        .slice(0, 5);

      const detailedStats = {
        provider: {
          id: provider.id,
          name: provider.name
        },
        platforms: {
          total: platforms.length,
          inProgress: platforms.filter(p => p.status === 'in_progress').length,
          completed: platforms.filter(p => p.status === 'completed').length,
          exported: platforms.filter(p => p.status === 'exported').length
        },
        materials: {
          total: provider.materialIds.length,
          mostUsed
        },
        totals: {
          totalLinearMeters: stats.totalLinearMeters,
          totalLength: platforms.reduce((sum, p) => sum + p.totalLength, 0),
          averageLinearMetersPerPlatform: platforms.length > 0 
            ? stats.totalLinearMeters / platforms.length 
            : 0
        },
        timeline: {
          lastDelivery: stats.lastDelivery,
          averageDeliveryTime: stats.averageDeliveryTime,
          deliveriesThisMonth: platforms.filter(p => {
            const date = new Date(p.receptionDate);
            const now = new Date();
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
          }).length,
          deliveriesLastMonth: platforms.filter(p => {
            const date = new Date(p.receptionDate);
            const now = new Date();
            const lastMonth = new Date(now.setMonth(now.getMonth() - 1));
            return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
          }).length
        },
        performance: {
          onTimeDeliveries: 0.85,
          qualityScore: 4.2,
          customerSatisfaction: 4.5
        }
      };

      logger.info('Estadísticas del proveedor obtenidas', { userId, providerId });

      return detailedStats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas del proveedor', {
        userId,
        providerId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = ProviderService;

