/**
 * 📸 CONTROLADOR DE EVIDENCIAS DE INVENTARIO
 * 
 * Maneja todos los endpoints relacionados con evidencias de plataformas.
 * 
 * @version 1.0.0
 */

const InventoryEvidenceService = require('../services/InventoryEvidenceService');
const { ResponseHandler, CommonErrors, ApiError } = require('../utils/responseHandler');
const logger = require('../utils/logger');

class InventoryEvidenceController {
  /**
   * POST /api/inventory/evidence/upload
   * Sube evidencias a una plataforma
   */
  static async upload(req, res, next) {
    try {
      // ✅ CORRECCIÓN: Usar email como userId (estructura del sistema)
      const userId = req.user.email || req.user.id;
      const { platformId, providerId, descriptions } = req.body;
      const files = req.files;

      // Validaciones básicas
      if (!platformId) {
        return ResponseHandler.validationError(res, 'platformId es requerido');
      }

      if (!providerId) {
        return ResponseHandler.validationError(res, 'providerId es requerido');
      }

      if (!files || files.length === 0) {
        return ResponseHandler.validationError(res, 'No se recibieron archivos');
      }

      // Parsear descripciones si vienen como string JSON
      let parsedDescriptions = [];
      if (descriptions) {
        try {
          parsedDescriptions = typeof descriptions === 'string' 
            ? JSON.parse(descriptions) 
            : descriptions;
        } catch (e) {
          parsedDescriptions = [];
        }
      }

      const service = new InventoryEvidenceService();
      const evidences = await service.uploadEvidences(
        userId,
        providerId,
        platformId,
        files,
        parsedDescriptions
      );

      return ResponseHandler.created(res, evidences, 'Evidencias subidas exitosamente');
    } catch (error) {
      logger.error('Error en uploadEvidences', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error subiendo evidencias'));
    }
  }

  /**
   * GET /api/inventory/evidence/:platformId
   * Obtiene todas las evidencias de una plataforma
   */
  static async getByPlatform(req, res, next) {
    try {
      // ✅ CORRECCIÓN: Usar email como userId (estructura del sistema)
      const userId = req.user.email || req.user.id;
      const { platformId } = req.params;
      const { providerId } = req.query;

      if (!providerId) {
        return ResponseHandler.validationError(res, 'providerId es requerido');
      }

      const service = new InventoryEvidenceService();
      const evidences = await service.getEvidencesByPlatform(userId, providerId, platformId);

      return ResponseHandler.success(res, evidences, 'Evidencias obtenidas exitosamente');
    } catch (error) {
      logger.error('Error en getEvidencesByPlatform', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo evidencias'));
    }
  }

  /**
   * DELETE /api/inventory/evidence/:evidenceId
   * Elimina una evidencia específica
   */
  static async delete(req, res, next) {
    try {
      // ✅ CORRECCIÓN: Usar email como userId (estructura del sistema)
      const userId = req.user.email || req.user.id;
      const { evidenceId } = req.params;
      const { platformId, providerId } = req.body;

      if (!platformId) {
        return ResponseHandler.validationError(res, 'platformId es requerido');
      }

      if (!providerId) {
        return ResponseHandler.validationError(res, 'providerId es requerido');
      }

      const service = new InventoryEvidenceService();
      await service.deleteEvidence(userId, providerId, platformId, evidenceId);

      return ResponseHandler.success(res, null, 'Evidencia eliminada exitosamente');
    } catch (error) {
      logger.error('Error en deleteEvidence', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error eliminando evidencia'));
    }
  }

  /**
   * GET /api/inventory/evidence/stats/:platformId
   * Obtiene estadísticas de evidencias de una plataforma
   */
  static async getStats(req, res, next) {
    try {
      // ✅ CORRECCIÓN: Usar email como userId (estructura del sistema)
      const userId = req.user.email || req.user.id;
      const { platformId } = req.params;
      const { providerId } = req.query;

      if (!providerId) {
        return ResponseHandler.validationError(res, 'providerId es requerido');
      }

      const service = new InventoryEvidenceService();
      const stats = await service.getEvidenceStats(userId, providerId, platformId);

      return ResponseHandler.success(res, stats, 'Estadísticas de evidencias obtenidas exitosamente');
    } catch (error) {
      logger.error('Error en getEvidenceStats', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo estadísticas'));
    }
  }
}

module.exports = InventoryEvidenceController;

