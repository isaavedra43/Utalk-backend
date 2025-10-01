/**
 * 🎨 CONTROLADOR DE MATERIALES
 * 
 * Maneja todos los endpoints relacionados con materiales.
 * 
 * @version 1.0.0
 */

const MaterialService = require('../services/MaterialService');
const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
const logger = require('../utils/logger');

class InventoryMaterialController {
  /**
   * GET /api/inventory/materials
   * Lista todos los materiales
   */
  static async list(req, res, next) {
    try {
      const userId = req.user.userId;
      const { active, category, providerId, search, limit, offset } = req.query;

      const options = {
        active: active !== undefined ? active === 'true' : null,
        category: category || '',
        providerId: providerId || '',
        search: search || '',
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0
      };

      const service = new MaterialService();
      const result = await service.listMaterials(userId, options);

      return ResponseHandler.success(res, result, 'Materiales obtenidos exitosamente');
    } catch (error) {
      logger.error('Error en listMaterials', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error listando materiales'));
    }
  }

  /**
   * GET /api/inventory/materials/active
   * Obtiene solo materiales activos
   */
  static async getActive(req, res, next) {
    try {
      const userId = req.user.userId;

      const service = new MaterialService();
      const materials = await service.getActiveMaterials(userId);

      return ResponseHandler.success(res, materials, 'Materiales activos obtenidos exitosamente');
    } catch (error) {
      logger.error('Error en getActiveMaterials', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo materiales activos'));
    }
  }

  /**
   * GET /api/inventory/materials/category/:category
   * Obtiene materiales por categoría
   */
  static async getByCategory(req, res, next) {
    try {
      const userId = req.user.userId;
      const { category } = req.params;

      const service = new MaterialService();
      const materials = await service.getMaterialsByCategory(userId, category);

      return ResponseHandler.success(res, materials, 'Materiales de la categoría obtenidos exitosamente');
    } catch (error) {
      logger.error('Error en getMaterialsByCategory', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo materiales'));
    }
  }

  /**
   * POST /api/inventory/materials
   * Crea un nuevo material
   */
  static async create(req, res, next) {
    try {
      const userId = req.user.userId;
      const materialData = req.body;

      // Validaciones básicas
      if (!materialData.name) {
        return ResponseHandler.validationError(res, 'name es requerido');
      }

      if (!materialData.category) {
        return ResponseHandler.validationError(res, 'category es requerido');
      }

      const service = new MaterialService();
      const material = await service.createMaterial(userId, materialData);

      return ResponseHandler.created(res, material, 'Material creado exitosamente');
    } catch (error) {
      logger.error('Error en createMaterial', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error creando material'));
    }
  }

  /**
   * PUT /api/inventory/materials/:materialId
   * Actualiza un material
   */
  static async update(req, res, next) {
    try {
      const userId = req.user.userId;
      const { materialId } = req.params;
      const updates = req.body;

      const service = new MaterialService();
      const material = await service.updateMaterial(userId, materialId, updates);

      return ResponseHandler.success(res, material, 'Material actualizado exitosamente');
    } catch (error) {
      logger.error('Error en updateMaterial', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error actualizando material'));
    }
  }

  /**
   * DELETE /api/inventory/materials/:materialId
   * Elimina un material
   */
  static async delete(req, res, next) {
    try {
      const userId = req.user.userId;
      const { materialId } = req.params;

      const service = new MaterialService();
      await service.deleteMaterial(userId, materialId);

      return ResponseHandler.success(res, null, 'Material eliminado exitosamente');
    } catch (error) {
      logger.error('Error en deleteMaterial', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error eliminando material'));
    }
  }
}

module.exports = InventoryMaterialController;

