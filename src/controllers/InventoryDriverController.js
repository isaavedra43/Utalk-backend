/**
 * 🚛 CONTROLADOR DE CHOFERES
 * 
 * Maneja todos los endpoints relacionados con choferes.
 * 
 * @version 1.0.0
 */

const DriverService = require('../services/DriverService');
const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
const logger = require('../utils/logger');

class InventoryDriverController {
  /**
   * GET /api/inventory/drivers
   * Lista todos los choferes con filtros
   */
  static async list(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const workspaceId = req.user.workspaceId || 'default_workspace';
      const tenantId = req.user.tenantId || 'default_tenant';
      const {
        active,
        vehicleType,
        search,
        limit,
        offset
      } = req.query;

      const options = {
        active: (active !== undefined && active !== '' && active !== null) ? active === 'true' : null,
        vehicleType: (vehicleType && vehicleType.trim()) || '',
        search: (search && search.trim()) || '',
        limit: parseInt(limit) || 1000,
        offset: parseInt(offset) || 0
      };

      // ✅ DEBUG: Log de parámetros para debugging
      logger.info('🔍 Listando choferes con parámetros', {
        userId,
        workspaceId,
        tenantId,
        options,
        hasWorkspaceId: !!workspaceId,
        hasTenantId: !!tenantId,
        workspaceIdType: typeof workspaceId,
        tenantIdType: typeof tenantId
      });

      const service = new DriverService();
      const result = await service.listDrivers(workspaceId, tenantId, options);

      return ResponseHandler.success(res, result, 'Choferes obtenidos exitosamente');
    } catch (error) {
      logger.error('Error en listDrivers', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error listando choferes'));
    }
  }

  /**
   * GET /api/inventory/drivers/active
   * Lista solo choferes activos
   */
  static async listActive(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const workspaceId = req.user.workspaceId || 'default_workspace';
      const tenantId = req.user.tenantId || 'default_tenant';

      logger.info('🔍 Listando choferes activos', {
        userId,
        workspaceId,
        tenantId
      });

      const service = new DriverService();
      const drivers = await service.listActiveDrivers(workspaceId, tenantId);

      return ResponseHandler.success(res, drivers, 'Choferes activos obtenidos exitosamente');
    } catch (error) {
      logger.error('Error en listActiveDrivers', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error listando choferes activos'));
    }
  }

  /**
   * GET /api/inventory/drivers/:id
   * Obtiene un chofer específico por ID
   */
  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.email || req.user.id;

      logger.info('🔍 Obteniendo chofer por ID', {
        userId,
        driverId: id
      });

      const service = new DriverService();
      const driver = await service.getDriverById(id);

      return ResponseHandler.success(res, driver, 'Chofer obtenido exitosamente');
    } catch (error) {
      logger.error('Error en getDriverById', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo chofer'));
    }
  }

  /**
   * POST /api/inventory/drivers
   * Crea un nuevo chofer
   */
  static async create(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const workspaceId = req.user.workspaceId || 'default_workspace';
      const tenantId = req.user.tenantId || 'default_tenant';
      const driverData = req.body;

      logger.info('🔍 Creando nuevo chofer', {
        userId,
        workspaceId,
        tenantId,
        driverData
      });

      // ✅ VALIDACIÓN CONDICIONAL
      const Driver = require('../models/Driver');
      const tempDriver = new Driver({
        ...driverData,
        workspaceId,
        tenantId
      });

      const validation = tempDriver.validate();
      if (!validation.isValid) {
        return ResponseHandler.validationError(res, validation.errors.join(', '));
      }

      const service = new DriverService();
      const driver = await service.createDriver(workspaceId, tenantId, driverData);

      return ResponseHandler.created(res, driver, 'Chofer creado exitosamente');
    } catch (error) {
      logger.error('Error en createDriver', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error creando chofer'));
    }
  }

  /**
   * PUT /api/inventory/drivers/:id
   * Actualiza un chofer existente
   */
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.email || req.user.id;
      const workspaceId = req.user.workspaceId || 'default_workspace';
      const tenantId = req.user.tenantId || 'default_tenant';
      const updates = req.body;

      logger.info('🔍 Actualizando chofer', {
        userId,
        workspaceId,
        tenantId,
        driverId: id,
        updates
      });

      const service = new DriverService();
      const driver = await service.updateDriver(id, workspaceId, tenantId, updates);

      return ResponseHandler.updated(res, driver, 'Chofer actualizado exitosamente');
    } catch (error) {
      logger.error('Error en updateDriver', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error actualizando chofer'));
    }
  }

  /**
   * DELETE /api/inventory/drivers/:id
   * Elimina un chofer
   */
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.email || req.user.id;
      const workspaceId = req.user.workspaceId || 'default_workspace';
      const tenantId = req.user.tenantId || 'default_tenant';

      logger.info('🔍 Eliminando chofer', {
        userId,
        workspaceId,
        tenantId,
        driverId: id
      });

      const service = new DriverService();
      await service.deleteDriver(id, workspaceId, tenantId);

      return ResponseHandler.deleted(res, 'Chofer eliminado exitosamente');
    } catch (error) {
      logger.error('Error en deleteDriver', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error eliminando chofer'));
    }
  }

  /**
   * GET /api/inventory/drivers/vehicle-type/:type
   * Lista choferes por tipo de vehículo
   */
  static async listByVehicleType(req, res, next) {
    try {
      const { type } = req.params;
      const userId = req.user.email || req.user.id;
      const workspaceId = req.user.workspaceId || 'default_workspace';
      const tenantId = req.user.tenantId || 'default_tenant';

      logger.info('🔍 Listando choferes por tipo de vehículo', {
        userId,
        workspaceId,
        tenantId,
        vehicleType: type
      });

      const service = new DriverService();
      const drivers = await service.listDriversByVehicleType(workspaceId, tenantId, type);

      return ResponseHandler.success(res, drivers, `Choferes de tipo ${type} obtenidos exitosamente`);
    } catch (error) {
      logger.error('Error en listDriversByVehicleType', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error listando choferes por tipo'));
    }
  }

  /**
   * GET /api/inventory/drivers/stats
   * Obtiene estadísticas de choferes
   */
  static async getStats(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const workspaceId = req.user.workspaceId || 'default_workspace';
      const tenantId = req.user.tenantId || 'default_tenant';

      logger.info('🔍 Obteniendo estadísticas de choferes', {
        userId,
        workspaceId,
        tenantId
      });

      const service = new DriverService();
      const stats = await service.getDriverStats(workspaceId, tenantId);

      return ResponseHandler.success(res, stats, 'Estadísticas de choferes obtenidas exitosamente');
    } catch (error) {
      logger.error('Error en getDriverStats', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo estadísticas'));
    }
  }
}

module.exports = InventoryDriverController;
