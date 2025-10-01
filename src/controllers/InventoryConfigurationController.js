/**
 * ⚙️ CONTROLADOR DE CONFIGURACIÓN DE INVENTARIO
 * 
 * Maneja la configuración del módulo de inventario.
 * 
 * @version 1.0.0
 */

const InventoryConfigurationService = require('../services/InventoryConfigurationService');
const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
const logger = require('../utils/logger');

class InventoryConfigurationController {
  /**
   * GET /api/inventory/configuration
   * Obtiene la configuración completa
   */
  static async get(req, res, next) {
    try {
      const userId = req.user.userId;

      const service = new InventoryConfigurationService();
      const config = await service.getConfiguration(userId);

      return ResponseHandler.success(res, config, 'Configuración obtenida exitosamente');
    } catch (error) {
      logger.error('Error en getConfiguration', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo configuración'));
    }
  }

  /**
   * PUT /api/inventory/configuration
   * Actualiza la configuración completa
   */
  static async update(req, res, next) {
    try {
      const userId = req.user.userId;
      const configData = req.body;

      const service = new InventoryConfigurationService();
      const config = await service.updateConfiguration(userId, configData);

      return ResponseHandler.success(res, config, 'Configuración actualizada exitosamente');
    } catch (error) {
      logger.error('Error en updateConfiguration', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error actualizando configuración'));
    }
  }

  /**
   * POST /api/inventory/configuration/sync
   * Sincroniza configuración con el cliente
   */
  static async sync(req, res, next) {
    try {
      const userId = req.user.userId;
      const clientData = req.body;

      const service = new InventoryConfigurationService();
      const syncResult = await service.syncConfiguration(userId, clientData);

      return ResponseHandler.success(res, syncResult, 'Sincronización de configuración completada');
    } catch (error) {
      logger.error('Error en syncConfiguration', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error sincronizando configuración'));
    }
  }
}

module.exports = InventoryConfigurationController;

