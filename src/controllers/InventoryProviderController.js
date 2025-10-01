/**
 * 📦 CONTROLADOR DE PROVEEDORES
 * 
 * Maneja todos los endpoints relacionados con proveedores.
 * 
 * @version 1.0.0
 */

const ProviderService = require('../services/ProviderService');
const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
const logger = require('../utils/logger');

class InventoryProviderController {
  /**
   * GET /api/inventory/providers
   * Lista todos los proveedores
   */
  static async list(req, res, next) {
    try {
      const userId = req.user.userId;
      const { active, search, limit, offset, includeStats } = req.query;

      const options = {
        active: active !== undefined ? active === 'true' : null,
        search: search || '',
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0,
        includeStats: includeStats === 'true'
      };

      const service = new ProviderService();
      const result = await service.listProviders(userId, options);

      return ResponseHandler.success(res, result, 'Proveedores obtenidos exitosamente');
    } catch (error) {
      logger.error('Error en listProviders', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error listando proveedores'));
    }
  }

  /**
   * GET /api/inventory/providers/:providerId
   * Obtiene un proveedor específico
   */
  static async getById(req, res, next) {
    try {
      const userId = req.user.userId;
      const { providerId } = req.params;

      const service = new ProviderService();
      const provider = await service.getProvider(userId, providerId);

      return ResponseHandler.success(res, provider, 'Proveedor obtenido exitosamente');
    } catch (error) {
      logger.error('Error en getProvider', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo proveedor'));
    }
  }

  /**
   * POST /api/inventory/providers
   * Crea un nuevo proveedor
   */
  static async create(req, res, next) {
    try {
      const userId = req.user.userId;
      const providerData = req.body;

      const service = new ProviderService();
      const provider = await service.createProvider(userId, providerData);

      return ResponseHandler.created(res, provider, 'Proveedor creado exitosamente');
    } catch (error) {
      logger.error('Error en createProvider', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error creando proveedor'));
    }
  }

  /**
   * PUT /api/inventory/providers/:providerId
   * Actualiza un proveedor
   */
  static async update(req, res, next) {
    try {
      const userId = req.user.userId;
      const { providerId } = req.params;
      const updates = req.body;

      const service = new ProviderService();
      const provider = await service.updateProvider(userId, providerId, updates);

      return ResponseHandler.success(res, provider, 'Proveedor actualizado exitosamente');
    } catch (error) {
      logger.error('Error en updateProvider', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error actualizando proveedor'));
    }
  }

  /**
   * DELETE /api/inventory/providers/:providerId
   * Elimina un proveedor
   */
  static async delete(req, res, next) {
    try {
      const userId = req.user.userId;
      const { providerId } = req.params;

      const service = new ProviderService();
      await service.deleteProvider(userId, providerId);

      return ResponseHandler.success(res, null, 'Proveedor eliminado exitosamente');
    } catch (error) {
      logger.error('Error en deleteProvider', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error eliminando proveedor'));
    }
  }

  /**
   * GET /api/inventory/providers/:providerId/platforms
   * Obtiene plataformas de un proveedor
   */
  static async getPlatforms(req, res, next) {
    try {
      const userId = req.user.userId;
      const { providerId } = req.params;
      const { status, startDate, endDate, limit, offset } = req.query;

      const options = {
        status: status || '',
        startDate: startDate || null,
        endDate: endDate || null,
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
      };

      const service = new ProviderService();
      const result = await service.getProviderPlatforms(userId, providerId, options);

      return ResponseHandler.success(res, result, 'Plataformas del proveedor obtenidas exitosamente');
    } catch (error) {
      logger.error('Error en getProviderPlatforms', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo plataformas'));
    }
  }

  /**
   * GET /api/inventory/providers/:providerId/materials
   * Obtiene materiales de un proveedor
   */
  static async getMaterials(req, res, next) {
    try {
      const userId = req.user.userId;
      const { providerId } = req.params;

      const service = new ProviderService();
      const materials = await service.getProviderMaterials(userId, providerId);

      return ResponseHandler.success(res, materials, 'Materiales del proveedor obtenidos exitosamente');
    } catch (error) {
      logger.error('Error en getProviderMaterials', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo materiales'));
    }
  }

  /**
   * GET /api/inventory/providers/:providerId/stats
   * Obtiene estadísticas de un proveedor
   */
  static async getStats(req, res, next) {
    try {
      const userId = req.user.userId;
      const { providerId } = req.params;

      const service = new ProviderService();
      const stats = await service.getProviderStats(userId, providerId);

      return ResponseHandler.success(res, stats, 'Estadísticas del proveedor obtenidas exitosamente');
    } catch (error) {
      logger.error('Error en getProviderStats', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo estadísticas'));
    }
  }
}

module.exports = InventoryProviderController;

