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
   * Asegura que existan materiales por defecto
   */
  async ensureDefaultMaterials(userId) {
    try {
      // Verificar si ya existen materiales
      const existingMaterials = await Material.listByUser(userId, { limit: 1 });
      
      if (existingMaterials.materials.length > 0) {
        // Ya hay materiales, no crear más
        logger.info('Materiales ya existen, omitiendo creación', { 
          userId,
          count: existingMaterials.pagination.total 
        });
        return;
      }
      
      logger.info('Creando materiales por defecto', { userId });
      
      // Crear materiales de ejemplo
      const defaultMaterials = [
        {
          name: 'Mármol Blanco Carrara',
          category: 'Mármol',
          description: 'Mármol blanco de alta calidad con vetas grises',
          unit: 'm²',
          standardWidth: 0.3
        },
        {
          name: 'Mármol Travertino',
          category: 'Mármol',
          description: 'Mármol travertino clásico',
          unit: 'm²',
          standardWidth: 0.3
        },
        {
          name: 'Granito Negro Absoluto',
          category: 'Granito',
          description: 'Granito negro intenso sin vetas',
          unit: 'm²',
          standardWidth: 0.3
        },
        {
          name: 'Granito Gris',
          category: 'Granito',
          description: 'Granito gris versátil con pequeñas vetas',
          unit: 'm²',
          standardWidth: 0.3
        },
        {
          name: 'Granito Rojo Imperial',
          category: 'Granito',
          description: 'Granito rojo con tonalidades imperiales',
          unit: 'm²',
          standardWidth: 0.3
        },
        {
          name: 'Cuarzo Blanco',
          category: 'Cuarzo',
          description: 'Cuarzo blanco premium de alta resistencia',
          unit: 'm²',
          standardWidth: 0.3
        },
        {
          name: 'Cuarzo Gris',
          category: 'Cuarzo',
          description: 'Cuarzo gris moderno',
          unit: 'm²',
          standardWidth: 0.3
        },
        {
          name: 'Travertino Beige',
          category: 'Travertino',
          description: 'Travertino color beige natural',
          unit: 'm²',
          standardWidth: 0.3
        },
        {
          name: 'Ónix Amarillo',
          category: 'Ónix',
          description: 'Ónix amarillo translúcido',
          unit: 'm²',
          standardWidth: 0.3
        },
        {
          name: 'Ónix Verde',
          category: 'Ónix',
          description: 'Ónix verde con vetas naturales',
          unit: 'm²',
          standardWidth: 0.3
        }
      ];
      
      const createdMaterials = [];
      for (const materialData of defaultMaterials) {
        const material = new Material({
          ...materialData,
          userId,
          isActive: true,
          providerIds: []
        });
        
        await material.save();
        createdMaterials.push(material);
      }
      
      logger.info('Materiales por defecto creados exitosamente', { 
        userId, 
        count: createdMaterials.length 
      });
      
      return createdMaterials;
    } catch (error) {
      logger.error('Error creando materiales por defecto', { 
        userId, 
        error: error.message 
      });
      // No lanzar error, es una operación secundaria
      return [];
    }
  }
  /**
   * Lista todas las plataformas del usuario
   */
  async listPlatforms(userId, options = {}) {
    try {
      logger.info('Listando plataformas', { userId, options });

      const result = await Platform.listByUser(userId, options);

      // Obtener filtros disponibles
      const providersSnapshot = await require('../config/firebase').db
        .collection('providers')
        .where('userId', '==', userId)
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
   * Crea una nueva plataforma
   */
  async createPlatform(userId, platformData, createdBy) {
    try {
      logger.info('Creando plataforma', { userId, platformNumber: platformData.platformNumber });

      // Verificar que el proveedor existe, si no existe, crearlo automáticamente
      let provider = await Provider.findById(userId, platformData.providerId);
      
      if (!provider) {
        logger.warn('Proveedor no encontrado, creando automáticamente', { 
          userId, 
          providerId: platformData.providerId,
          providerName: platformData.provider 
        });
        
        // PASO 1: Crear materiales de ejemplo si no existen
        const createdMaterials = await this.ensureDefaultMaterials(userId);
        
        // PASO 2: Obtener IDs de materiales (recién creados o existentes)
        const materialsResult = await Material.listByUser(userId, { 
          active: true, 
          limit: 100 
        });
        const materialIds = materialsResult.materials.map(m => m.id);
        
        logger.info('Materiales disponibles para asociar al proveedor', {
          userId,
          materialsCount: materialIds.length,
          recienCreados: createdMaterials.length
        });
        
        // PASO 3: Crear proveedor con materiales asociados
        provider = new Provider({
          id: platformData.providerId,
          userId,
          name: platformData.provider || 'Proveedor sin nombre',
          contact: '',
          phone: '',
          email: '',
          address: '',
          materialIds: materialIds, // Asociar TODOS los materiales
          isActive: true
        });
        
        await provider.save();
        
        logger.info('✅ Proveedor creado automáticamente', { 
          userId, 
          providerId: provider.id,
          providerName: provider.name,
          materialesAsociados: materialIds.length
        });
      }

      const platform = new Platform({
        ...platformData,
        userId,
        createdBy
      });

      await platform.save();

      logger.info('Plataforma creada exitosamente', { userId, platformId: platform.id });

      return platform;
    } catch (error) {
      logger.error('Error creando plataforma', { userId, error: error.message });
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
  async getGlobalStats(userId, options = {}) {
    try {
      logger.info('Obteniendo estadísticas globales', { userId, options });

      const stats = await Platform.getGlobalStats(userId, options);

      logger.info('Estadísticas globales obtenidas', { userId });

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas globales', {
        userId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = PlatformService;

