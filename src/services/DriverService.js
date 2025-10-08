/**
 * 🚛 SERVICIO DE CHOFERES
 * 
 * Maneja la lógica de negocio para choferes y sus vehículos.
 * 
 * @version 1.0.0
 */

const Driver = require('../models/Driver');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/responseHandler');

class DriverService {
  /**
   * Lista choferes con filtros
   */
  async listDrivers(workspaceId, tenantId, options = {}) {
    try {
      logger.info('Listando choferes', { workspaceId, tenantId, options });

      // ✅ VALIDACIÓN ADICIONAL
      if (!workspaceId || !tenantId) {
        logger.warn('WorkspaceId o tenantId faltantes, devolviendo array vacío', { workspaceId, tenantId });
        return {
          drivers: [],
          pagination: {
            total: 0,
            limit: options.limit || 1000,
            offset: options.offset || 0,
            hasMore: false
          }
        };
      }

      const result = await Driver.listByWorkspace(workspaceId, tenantId, options);

      logger.info('Choferes listados exitosamente', {
        workspaceId,
        tenantId,
        count: result.drivers.length
      });

      return result;
    } catch (error) {
      logger.error('Error listando choferes', { workspaceId, tenantId, error: error.message, stack: error.stack });
      
      // ✅ MANEJO DE ERRORES ESPECÍFICOS
      if (error.message.includes('undefined')) {
        logger.error('Error de parámetros undefined detectado');
        throw new Error('Parámetros de workspace no válidos');
      }
      
      throw error;
    }
  }

  /**
   * Lista choferes activos
   */
  async listActiveDrivers(workspaceId, tenantId) {
    try {
      logger.info('Listando choferes activos', { workspaceId, tenantId });

      const drivers = await Driver.listActiveByWorkspace(workspaceId, tenantId);

      logger.info('Choferes activos listados exitosamente', {
        workspaceId,
        tenantId,
        count: drivers.length
      });

      return drivers;
    } catch (error) {
      logger.error('Error listando choferes activos', { workspaceId, tenantId, error: error.message });
      throw error;
    }
  }

  /**
   * Lista choferes por tipo de vehículo
   */
  async listDriversByVehicleType(workspaceId, tenantId, vehicleType) {
    try {
      logger.info('Listando choferes por tipo de vehículo', { workspaceId, tenantId, vehicleType });

      const drivers = await Driver.listByVehicleType(workspaceId, tenantId, vehicleType);

      logger.info('Choferes por tipo listados exitosamente', {
        workspaceId,
        tenantId,
        vehicleType,
        count: drivers.length
      });

      return drivers;
    } catch (error) {
      logger.error('Error listando choferes por tipo', { workspaceId, tenantId, vehicleType, error: error.message });
      throw error;
    }
  }

  /**
   * Obtiene un chofer por ID
   */
  async getDriverById(id) {
    try {
      logger.info('Obteniendo chofer por ID', { id });

      const driver = await Driver.findById(id);
      
      if (!driver) {
        throw ApiError.notFoundError('Chofer no encontrado');
      }

      logger.info('Chofer obtenido exitosamente', { id });

      return driver;
    } catch (error) {
      logger.error('Error obteniendo chofer por ID', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Crea un nuevo chofer
   */
  async createDriver(workspaceId, tenantId, driverData) {
    try {
      logger.info('Creando chofer', { workspaceId, tenantId, driverData });

      // Validar datos
      const driver = new Driver({
        ...driverData,
        workspaceId,
        tenantId
      });

      const validation = driver.validate();
      if (!validation.isValid) {
        throw ApiError.validationError(validation.errors.join(', '));
      }

      // Verificar que la placa no exista en el workspace (solo si se proporciona)
      if (driver.vehiclePlate && driver.vehiclePlate.trim()) {
        const plateExists = await Driver.plateExistsInWorkspace(workspaceId, tenantId, driver.vehiclePlate);
        if (plateExists) {
          throw ApiError.validationError('Ya existe un chofer con esta placa de vehículo');
        }
      }

      await driver.save();

      logger.info('Chofer creado exitosamente', {
        workspaceId,
        tenantId,
        driverId: driver.id,
        name: driver.name,
        vehiclePlate: driver.vehiclePlate
      });

      return driver;
    } catch (error) {
      logger.error('Error creando chofer', { workspaceId, tenantId, error: error.message });
      throw error;
    }
  }

  /**
   * Actualiza un chofer existente
   */
  async updateDriver(id, workspaceId, tenantId, updates) {
    try {
      logger.info('Actualizando chofer', { id, workspaceId, tenantId, updates });

      // Obtener chofer existente
      const existingDriver = await Driver.findById(id);
      if (!existingDriver) {
        throw ApiError.notFoundError('Chofer no encontrado');
      }

      // Verificar que pertenezca al workspace correcto
      if (existingDriver.workspaceId !== workspaceId || existingDriver.tenantId !== tenantId) {
        throw ApiError.forbiddenError('No tienes permisos para actualizar este chofer');
      }

      // Si se está actualizando la placa, verificar que no exista otra
      if (updates.vehiclePlate && updates.vehiclePlate !== existingDriver.vehiclePlate) {
        const plateExists = await Driver.plateExistsInWorkspace(workspaceId, tenantId, updates.vehiclePlate, id);
        if (plateExists) {
          throw ApiError.validationError('Ya existe un chofer con esta placa de vehículo');
        }
      }

      // Validar datos actualizados
      const updatedDriver = new Driver({
        ...existingDriver.toFirestore(),
        ...updates,
        id: existingDriver.id,
        workspaceId,
        tenantId
      });

      const validation = updatedDriver.validate();
      if (!validation.isValid) {
        throw ApiError.validationError(validation.errors.join(', '));
      }

      await existingDriver.update(updates);

      logger.info('Chofer actualizado exitosamente', {
        id,
        workspaceId,
        tenantId,
        name: updatedDriver.name
      });

      return updatedDriver;
    } catch (error) {
      logger.error('Error actualizando chofer', { id, workspaceId, tenantId, error: error.message });
      throw error;
    }
  }

  /**
   * Elimina un chofer
   */
  async deleteDriver(id, workspaceId, tenantId) {
    try {
      logger.info('Eliminando chofer', { id, workspaceId, tenantId });

      // Obtener chofer existente
      const driver = await Driver.findById(id);
      if (!driver) {
        throw ApiError.notFoundError('Chofer no encontrado');
      }

      // Verificar que pertenezca al workspace correcto
      if (driver.workspaceId !== workspaceId || driver.tenantId !== tenantId) {
        throw ApiError.forbiddenError('No tienes permisos para eliminar este chofer');
      }

      await driver.delete();

      logger.info('Chofer eliminado exitosamente', {
        id,
        workspaceId,
        tenantId,
        name: driver.name
      });

      return true;
    } catch (error) {
      logger.error('Error eliminando chofer', { id, workspaceId, tenantId, error: error.message });
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de choferes
   */
  async getDriverStats(workspaceId, tenantId) {
    try {
      logger.info('Obteniendo estadísticas de choferes', { workspaceId, tenantId });

      const result = await Driver.listByWorkspace(workspaceId, tenantId, { limit: 10000 });
      const drivers = result.drivers;

      // Calcular estadísticas
      const stats = {
        total: drivers.length,
        active: drivers.filter(d => d.isActive).length,
        inactive: drivers.filter(d => !d.isActive).length,
        byVehicleType: {}
      };

      // Estadísticas por tipo de vehículo
      drivers.forEach(driver => {
        const type = driver.vehicleType;
        if (!stats.byVehicleType[type]) {
          stats.byVehicleType[type] = {
            total: 0,
            active: 0,
            inactive: 0
          };
        }
        stats.byVehicleType[type].total++;
        if (driver.isActive) {
          stats.byVehicleType[type].active++;
        } else {
          stats.byVehicleType[type].inactive++;
        }
      });

      logger.info('Estadísticas de choferes obtenidas', {
        workspaceId,
        tenantId,
        total: stats.total
      });

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de choferes', { workspaceId, tenantId, error: error.message });
      throw error;
    }
  }
}

module.exports = DriverService;
