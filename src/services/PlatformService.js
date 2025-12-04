/**
 * 🚛 SERVICIO DE PLATAFORMAS
 * 
 * Maneja la lógica de negocio para plataformas de recepción.
 * 
 * @version 1.0.0
 */

const Platform = require('../models/Platform');
const Provider = require('../models/Provider');
const Material = require('../models/Material');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/responseHandler');

class PlatformService {
  /**
   * Lista todas las plataformas del workspace
   */
  async listPlatforms(userId, workspaceId, tenantId, options = {}) {
    try {
      logger.info('Listando plataformas', { userId, workspaceId, tenantId, options });

      const result = await Platform.listByWorkspace(userId, workspaceId, tenantId, options);

      // Obtener filtros disponibles
      const providersSnapshot = await require('../config/firebase').db
        .collection('providers')
        .get();
      
      const availableProviders = providersSnapshot.docs.map(doc => doc.data().name);

      // Obtener tipos de materiales únicos
      const materialTypesSet = new Set();
      result.platforms.forEach(platform => {
        platform.materialTypes.forEach(type => materialTypesSet.add(type));
      });

      logger.info('Plataformas listadas exitosamente', {
        userId,
        count: result.platforms.length
      });

      return {
        ...result,
        filters: {
          applied: {
            status: options.status || null,
            providerId: options.providerId || null,
            startDate: options.startDate || null,
            endDate: options.endDate || null
          },
          available: {
            statuses: ['in_progress', 'completed', 'exported'],
            providers: availableProviders,
            materialTypes: Array.from(materialTypesSet)
          }
        }
      };
    } catch (error) {
      logger.error('Error listando plataformas', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Obtiene una plataforma por ID
   */
  async getPlatform(userId, providerId, platformId) {
    try {
      logger.info('Obteniendo plataforma', { userId, providerId, platformId });

      const platform = await Platform.findById(userId, providerId, platformId);
      
      if (!platform) {
        throw ApiError.notFoundError('Plataforma no encontrada');
      }

      logger.info('Plataforma obtenida exitosamente', { userId, platformId });

      return platform;
    } catch (error) {
      logger.error('Error obteniendo plataforma', {
        userId,
        providerId,
        platformId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Crea una nueva plataforma (proveedor o cliente)
   */
  async createPlatform(userId, workspaceId, tenantId, platformData, createdBy) {
    try {
      logger.info('Creando plataforma', { 
        userId, 
        workspaceId,
        tenantId,
        platformNumber: platformData.platformNumber,
        platformType: platformData.platformType 
      });

      // ✅ VALIDACIÓN CONDICIONAL POR TIPO
      if (platformData.platformType === 'provider') {
        // Para cargas de proveedor: verificar que el proveedor existe
        const provider = await Provider.findById(userId, platformData.providerId);
        
        if (!provider) {
          throw ApiError.notFoundError('Proveedor no encontrado. Debe crear el proveedor antes de crear la plataforma.');
        }

        const platform = new Platform({
          ...platformData,
          userId,
          workspaceId,
          tenantId,
          createdBy,
          provider: provider.name
        });

        await platform.save();

        logger.info('Plataforma de proveedor creada exitosamente', {
          userId,
          workspaceId,
          tenantId,
          platformId: platform.id,
          platformNumber: platform.platformNumber,
          providerId: platform.providerId
        });

        return platform;

      } else if (platformData.platformType === 'client') {
        // Para cargas de cliente: no necesita proveedor
        const platform = new Platform({
          ...platformData,
          userId,
          workspaceId,
          tenantId,
          createdBy,
          platformType: 'client'
        });

        await platform.save();

        logger.info('Plataforma de cliente creada exitosamente', {
          userId,
          platformId: platform.id,
          platformNumber: platform.platformNumber,
          ticketNumber: platform.ticketNumber
        });

        return platform;

      } else {
        throw ApiError.validationError('platformType debe ser "provider" o "client"');
      }

    } catch (error) {
      logger.error('Error creando plataforma', { 
        userId, 
        platformType: platformData.platformType,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Actualiza una plataforma
   */
  async updatePlatform(userId, providerId, platformId, updates) {
    try {
      logger.info('Actualizando plataforma', { userId, providerId, platformId });

      const platform = await Platform.findById(userId, providerId, platformId);
      
      if (!platform) {
        throw ApiError.notFoundError('Plataforma no encontrada');
      }

      await platform.update(updates);

      logger.info('Plataforma actualizada exitosamente', { userId, platformId });

      return platform;
    } catch (error) {
      logger.error('Error actualizando plataforma', {
        userId,
        providerId,
        platformId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Elimina una plataforma
   */
  async deletePlatform(userId, providerId, platformId) {
    try {
      logger.info('Eliminando plataforma', { userId, providerId, platformId });

      const platform = await Platform.findById(userId, providerId, platformId);
      
      if (!platform) {
        throw ApiError.notFoundError('Plataforma no encontrada');
      }

      await platform.delete();

      logger.info('Plataforma eliminada exitosamente', { userId, platformId });

      return true;
    } catch (error) {
      logger.error('Error eliminando plataforma', {
        userId,
        providerId,
        platformId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtiene estadísticas globales
   */
  async getGlobalStats(userId, workspaceId, tenantId, options = {}) {
    try {
      logger.info('Obteniendo estadísticas globales', { userId, workspaceId, tenantId, options });

      const stats = await Platform.getGlobalStats(userId, workspaceId, tenantId, options);

      logger.info('Estadísticas globales obtenidas', { userId, workspaceId, tenantId });

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas globales', {
        userId,
        workspaceId,
        tenantId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = PlatformService;

