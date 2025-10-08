/**
 * 🚛 CONTROLADOR DE PLATAFORMAS
 * 
 * Maneja todos los endpoints relacionados con plataformas.
 * 
 * @version 1.0.0
 */

const PlatformService = require('../services/PlatformService');
const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
const logger = require('../utils/logger');

class InventoryPlatformController {
  /**
   * GET /api/inventory/platforms
   * Lista todas las plataformas del usuario
   */
  static async list(req, res, next) {
    try {
      // ✅ CORRECCIÓN: Usar email como userId (estructura del sistema)
      const userId = req.user.email || req.user.id;
      const workspaceId = req.user.workspaceId;
      const tenantId = req.user.tenantId;
      const {
        status,
        providerId,
        provider,
        materialType,
        platformType, // ⭐ NUEVO: filtrar por tipo de plataforma
        ticketNumber,  // ⭐ NUEVO: filtrar por número de ticket
        startDate,
        endDate,
        search,
        sortBy,
        sortOrder,
        limit,
        offset
      } = req.query;

      const options = {
        status: status || '',
        providerId: providerId || '',
        provider: provider || '',
        materialType: materialType || '',
        platformType: platformType || '', // ⭐ NUEVO
        ticketNumber: ticketNumber || '',  // ⭐ NUEVO
        startDate: startDate || null,
        endDate: endDate || null,
        search: search || '',
        sortBy: sortBy || 'receptionDate',
        sortOrder: sortOrder || 'desc',
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
      };

      const service = new PlatformService();
      const result = await service.listPlatforms(userId, workspaceId, tenantId, options);

      return ResponseHandler.success(res, result, 'Plataformas obtenidas exitosamente');
    } catch (error) {
      logger.error('Error en listPlatforms', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error listando plataformas'));
    }
  }

  /**
   * GET /api/inventory/platforms/:platformId
   * Obtiene una plataforma específica
   */
  static async getById(req, res, next) {
    try {
      // ✅ CORRECCIÓN: Usar email como userId (estructura del sistema)
      const userId = req.user.email || req.user.id;
      const { platformId } = req.params;
      const { providerId } = req.query;

      if (!providerId) {
        return ResponseHandler.validationError(res, 'providerId es requerido');
      }

      const service = new PlatformService();
      const platform = await service.getPlatform(userId, providerId, platformId);

      return ResponseHandler.success(res, platform, 'Plataforma obtenida exitosamente');
    } catch (error) {
      logger.error('Error en getPlatform', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo plataforma'));
    }
  }

  /**
   * POST /api/inventory/platforms
   * Crea una nueva plataforma (proveedor o cliente)
   */
  static async create(req, res, next) {
    try {
      // ✅ CORRECCIÓN: Usar email como userId (estructura del sistema)
      const userId = req.user.email || req.user.id;
      const workspaceId = req.user.workspaceId;
      const tenantId = req.user.tenantId;
      const createdBy = req.user.email || req.user.id;
      const platformData = req.body;

      // ✅ VALIDACIÓN CONDICIONAL POR TIPO
      const Platform = require('../models/Platform');
      const tempPlatform = new Platform({
        ...platformData,
        userId,
        workspaceId,
        tenantId,
        createdBy
      });

      const validation = tempPlatform.validate();
      if (!validation.isValid) {
        return ResponseHandler.validationError(res, validation.errors.join(', '));
      }

      const service = new PlatformService();
      const platform = await service.createPlatform(userId, workspaceId, tenantId, platformData, createdBy);

      return ResponseHandler.created(res, platform, 'Plataforma creada exitosamente');
    } catch (error) {
      logger.error('Error en createPlatform', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error creando plataforma'));
    }
  }

  /**
   * PUT /api/inventory/platforms/:platformId
   * Actualiza una plataforma
   */
  static async update(req, res, next) {
    try {
      // ✅ CORRECCIÓN: Usar email como userId (estructura del sistema)
      const userId = req.user.email || req.user.id;
      const { platformId } = req.params;
      const { providerId } = req.query;
      const updates = req.body;

      if (!providerId) {
        return ResponseHandler.validationError(res, 'providerId es requerido');
      }

      const service = new PlatformService();
      const platform = await service.updatePlatform(userId, providerId, platformId, updates);

      return ResponseHandler.success(res, platform, 'Plataforma actualizada exitosamente');
    } catch (error) {
      logger.error('Error en updatePlatform', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error actualizando plataforma'));
    }
  }

  /**
   * DELETE /api/inventory/platforms/:platformId
   * Elimina una plataforma
   */
  static async delete(req, res, next) {
    try {
      // ✅ CORRECCIÓN: Usar email como userId (estructura del sistema)
      const userId = req.user.email || req.user.id;
      const { platformId } = req.params;
      const { providerId } = req.query;

      if (!providerId) {
        return ResponseHandler.validationError(res, 'providerId es requerido');
      }

      const service = new PlatformService();
      await service.deletePlatform(userId, providerId, platformId);

      return ResponseHandler.success(res, null, 'Plataforma eliminada exitosamente');
    } catch (error) {
      logger.error('Error en deletePlatform', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error eliminando plataforma'));
    }
  }

  /**
   * GET /api/inventory/platforms/stats
   * Obtiene estadísticas globales
   */
  static async getStats(req, res, next) {
    try {
      // ✅ CORRECCIÓN: Usar email como userId (estructura del sistema)
      const userId = req.user.email || req.user.id;
      const workspaceId = req.user.workspaceId;
      const tenantId = req.user.tenantId;
      const { period, providerId, materialType } = req.query;

      const options = {
        period: period || 'month',
        providerId: providerId || '',
        materialType: materialType || ''
      };

      const service = new PlatformService();
      const stats = await service.getGlobalStats(userId, workspaceId, tenantId, options);

      return ResponseHandler.success(res, stats, 'Estadísticas de plataformas obtenidas exitosamente');
    } catch (error) {
      logger.error('Error en getPlatformStats', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo estadísticas'));
    }
  }
}

module.exports = InventoryPlatformController;

