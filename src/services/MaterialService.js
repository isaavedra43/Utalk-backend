/**
 * 🎨 SERVICIO DE MATERIALES
 * 
 * Maneja la lógica de negocio para materiales.
 * 
 * @version 1.0.0
 */

const Material = require('../models/Material');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/responseHandler');

class MaterialService {
  /**
   * Lista todos los materiales del usuario
   */
  async listMaterials(userId, options = {}) {
    try {
      logger.info('Listando materiales', { userId, options });

      const result = await Material.listByUser(userId, options);

      logger.info('Materiales listados exitosamente', {
        userId,
        count: result.materials.length
      });

      // Obtener categorías únicas
      const categories = await Material.getCategories(userId);

      return {
        ...result,
        categories
      };
    } catch (error) {
      logger.error('Error listando materiales', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Obtiene materiales activos
   */
  async getActiveMaterials(userId) {
    try {
      logger.info('Obteniendo materiales activos', { userId });

      const result = await Material.listByUser(userId, { active: true, limit: 1000 });

      logger.info('Materiales activos obtenidos', { userId, count: result.materials.length });

      return result.materials;
    } catch (error) {
      logger.error('Error obteniendo materiales activos', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Obtiene materiales por categoría
   */
  async getMaterialsByCategory(userId, category) {
    try {
      logger.info('Obteniendo materiales por categoría', { userId, category });

      const materials = await Material.listByCategory(userId, category);

      logger.info('Materiales por categoría obtenidos', {
        userId,
        category,
        count: materials.length
      });

      return materials;
    } catch (error) {
      logger.error('Error obteniendo materiales por categoría', {
        userId,
        category,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Crea un nuevo material
   */
  async createMaterial(userId, materialData) {
    try {
      logger.info('Creando material', { userId, name: materialData.name });

      const material = new Material({
        ...materialData,
        userId
      });

      await material.save();

      // ✅ ACTUALIZAR RELACIÓN: Si el material tiene providerIds, actualizar proveedores
      if (material.providerIds && material.providerIds.length > 0) {
        logger.info('Actualizando relación material-proveedores', {
          userId,
          materialId: material.id,
          providersCount: material.providerIds.length
        });

        const Provider = require('../models/Provider');
        
        for (const providerId of material.providerIds) {
          const provider = await Provider.findById(userId, providerId);
          
          if (provider) {
            // Agregar materialId si no existe
            if (!provider.materialIds.includes(material.id)) {
              provider.materialIds.push(material.id);
              await provider.save();
              
              logger.info('Proveedor actualizado con materialId', {
                providerId,
                materialId: material.id
              });
            }
          } else {
            logger.warn('Proveedor no encontrado al crear material', {
              providerId,
              materialId: material.id
            });
          }
        }
      }

      logger.info('Material creado exitosamente', { userId, materialId: material.id });

      return material;
    } catch (error) {
      logger.error('Error creando material', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Actualiza un material
   */
  async updateMaterial(userId, materialId, updates) {
    try {
      logger.info('Actualizando material', { userId, materialId });

      const material = await Material.findById(userId, materialId);
      
      if (!material) {
        throw ApiError.notFoundError('Material no encontrado');
      }

      await material.update(updates);

      logger.info('Material actualizado exitosamente', { userId, materialId });

      return material;
    } catch (error) {
      logger.error('Error actualizando material', { userId, materialId, error: error.message });
      throw error;
    }
  }

  /**
   * Elimina un material
   */
  async deleteMaterial(userId, materialId) {
    try {
      logger.info('Eliminando material', { userId, materialId });

      const material = await Material.findById(userId, materialId);
      
      if (!material) {
        throw ApiError.notFoundError('Material no encontrado');
      }

      await material.delete();

      logger.info('Material eliminado exitosamente', { userId, materialId });

      return true;
    } catch (error) {
      logger.error('Error eliminando material', { userId, materialId, error: error.message });
      throw error;
    }
  }
}

module.exports = MaterialService;

