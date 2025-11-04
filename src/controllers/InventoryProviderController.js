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
      // ✅ CORRECCIÓN: Usar email como userId (estructura del sistema)
      const userId = req.user.email || req.user.id;
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
      // ✅ CORRECCIÓN: Usar email como userId (estructura del sistema)
      const userId = req.user.email || req.user.id;
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
      // ✅ CORRECCIÓN: Usar email como userId (estructura del sistema)
      const userId = req.user.email || req.user.id;
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
      // ✅ CORRECCIÓN: Usar email como userId (estructura del sistema)
      const userId = req.user.email || req.user.id;
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
      // ✅ CORRECCIÓN: Usar email como userId (estructura del sistema)
      const userId = req.user.email || req.user.id;
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
      // ✅ CORRECCIÓN: Usar email como userId (estructura del sistema)
      const userId = req.user.email || req.user.id;
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
      // ✅ CORRECCIÓN: Usar email como userId (estructura del sistema)
      const userId = req.user.email || req.user.id;
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
      // ✅ CORRECCIÓN: Usar email como userId (estructura del sistema)
      const userId = req.user.email || req.user.id;
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

  // ==========================================
  // MATERIALES DEL PROVEEDOR
  // ==========================================

  /**
   * GET /api/providers/:providerId/materials
   * Lista todos los materiales de un proveedor
   */
  static async listMaterials(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId } = req.params;
      const { isActive, category, limit, offset } = req.query;

      const options = {
        isActive: isActive !== undefined ? isActive === 'true' : null,
        category: category || null,
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0
      };

      const service = new ProviderService();
      const materials = await service.listProviderMaterials(userId, providerId, options);

      return ResponseHandler.success(res, materials, 'Materiales obtenidos exitosamente');
    } catch (error) {
      logger.error('Error en listMaterials', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error listando materiales'));
    }
  }

  /**
   * GET /api/providers/:providerId/materials/:materialId
   * Obtiene un material específico
   */
  static async getMaterial(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId, materialId } = req.params;

      const service = new ProviderService();
      const material = await service.getProviderMaterial(userId, providerId, materialId);

      return ResponseHandler.success(res, material, 'Material obtenido exitosamente');
    } catch (error) {
      logger.error('Error en getMaterial', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo material'));
    }
  }

  /**
   * POST /api/providers/:providerId/materials
   * Crea un nuevo material
   */
  static async createMaterial(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId } = req.params;
      const materialData = {
        ...req.body,
        createdByName: req.user.displayName || req.user.email
      };

      const service = new ProviderService();
      const material = await service.createProviderMaterial(userId, providerId, materialData);

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
   * PUT /api/providers/:providerId/materials/:materialId
   * Actualiza un material
   */
  static async updateMaterial(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId, materialId } = req.params;
      const updates = {
        ...req.body,
        createdByName: req.user.displayName || req.user.email
      };

      const service = new ProviderService();
      const material = await service.updateProviderMaterial(userId, providerId, materialId, updates);

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
   * DELETE /api/providers/:providerId/materials/:materialId
   * Elimina un material
   */
  static async deleteMaterial(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId, materialId } = req.params;

      const service = new ProviderService();
      await service.deleteProviderMaterial(userId, providerId, materialId);

      return ResponseHandler.success(res, null, 'Material eliminado exitosamente');
    } catch (error) {
      logger.error('Error en deleteMaterial', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error eliminando material'));
    }
  }

  // ==========================================
  // ÓRDENES DE COMPRA
  // ==========================================

  /**
   * GET /api/providers/:providerId/purchase-orders
   * Lista todas las órdenes de compra
   */
  static async listPurchaseOrders(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId } = req.params;
      const { status, limit, offset } = req.query;

      const options = {
        status: status || null,
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0
      };

      const service = new ProviderService();
      const orders = await service.listPurchaseOrders(userId, providerId, options);

      return ResponseHandler.success(res, orders, 'Órdenes de compra obtenidas exitosamente');
    } catch (error) {
      logger.error('Error en listPurchaseOrders', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error listando órdenes de compra'));
    }
  }

  /**
   * GET /api/providers/:providerId/purchase-orders/:orderId
   * Obtiene una orden específica
   */
  static async getPurchaseOrder(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId, orderId } = req.params;

      const service = new ProviderService();
      const order = await service.getPurchaseOrder(userId, providerId, orderId);

      return ResponseHandler.success(res, order, 'Orden de compra obtenida exitosamente');
    } catch (error) {
      logger.error('Error en getPurchaseOrder', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo orden de compra'));
    }
  }

  /**
   * POST /api/providers/:providerId/purchase-orders
   * Crea una nueva orden de compra
   */
  static async createPurchaseOrder(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId } = req.params;
      const orderData = {
        ...req.body,
        createdByName: req.user.displayName || req.user.email
      };

      const service = new ProviderService();
      const order = await service.createPurchaseOrder(userId, providerId, orderData);

      return ResponseHandler.created(res, order, 'Orden de compra creada exitosamente');
    } catch (error) {
      logger.error('Error en createPurchaseOrder', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error creando orden de compra'));
    }
  }

  /**
   * PUT /api/providers/:providerId/purchase-orders/:orderId
   * Actualiza una orden de compra
   */
  static async updatePurchaseOrder(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId, orderId } = req.params;
      const updates = {
        ...req.body,
        createdByName: req.user.displayName || req.user.email
      };

      const service = new ProviderService();
      const order = await service.updatePurchaseOrder(userId, providerId, orderId, updates);

      return ResponseHandler.success(res, order, 'Orden de compra actualizada exitosamente');
    } catch (error) {
      logger.error('Error en updatePurchaseOrder', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error actualizando orden de compra'));
    }
  }

  /**
   * DELETE /api/providers/:providerId/purchase-orders/:orderId
   * Elimina una orden de compra
   */
  static async deletePurchaseOrder(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId, orderId } = req.params;

      const service = new ProviderService();
      await service.deletePurchaseOrder(userId, providerId, orderId);

      return ResponseHandler.success(res, null, 'Orden de compra eliminada exitosamente');
    } catch (error) {
      logger.error('Error en deletePurchaseOrder', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error eliminando orden de compra'));
    }
  }

  // ==========================================
  // PAGOS
  // ==========================================

  /**
   * GET /api/providers/:providerId/payments
   * Lista todos los pagos
   */
  static async listPayments(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId } = req.params;
      const { status, limit, offset } = req.query;

      const options = {
        status: status || null,
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0
      };

      const service = new ProviderService();
      const payments = await service.listPayments(userId, providerId, options);

      return ResponseHandler.success(res, payments, 'Pagos obtenidos exitosamente');
    } catch (error) {
      logger.error('Error en listPayments', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error listando pagos'));
    }
  }

  /**
   * GET /api/providers/:providerId/payments/:paymentId
   * Obtiene un pago específico
   */
  static async getPayment(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId, paymentId } = req.params;

      const service = new ProviderService();
      const payment = await service.getPayment(userId, providerId, paymentId);

      return ResponseHandler.success(res, payment, 'Pago obtenido exitosamente');
    } catch (error) {
      logger.error('Error en getPayment', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo pago'));
    }
  }

  /**
   * POST /api/providers/:providerId/payments
   * Crea un nuevo pago
   */
  static async createPayment(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId } = req.params;
      const paymentData = {
        ...req.body,
        createdByName: req.user.displayName || req.user.email
      };

      const service = new ProviderService();
      const payment = await service.createPayment(userId, providerId, paymentData);

      return ResponseHandler.created(res, payment, 'Pago creado exitosamente');
    } catch (error) {
      logger.error('Error en createPayment', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error creando pago'));
    }
  }

  /**
   * PUT /api/providers/:providerId/payments/:paymentId
   * Actualiza un pago
   */
  static async updatePayment(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId, paymentId } = req.params;
      const updates = {
        ...req.body,
        createdByName: req.user.displayName || req.user.email
      };

      const service = new ProviderService();
      const payment = await service.updatePayment(userId, providerId, paymentId, updates);

      return ResponseHandler.success(res, payment, 'Pago actualizado exitosamente');
    } catch (error) {
      logger.error('Error en updatePayment', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error actualizando pago'));
    }
  }

  /**
   * DELETE /api/providers/:providerId/payments/:paymentId
   * Elimina un pago
   */
  static async deletePayment(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId, paymentId } = req.params;

      const service = new ProviderService();
      await service.deletePayment(userId, providerId, paymentId);

      return ResponseHandler.success(res, null, 'Pago eliminado exitosamente');
    } catch (error) {
      logger.error('Error en deletePayment', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error eliminando pago'));
    }
  }

  // ==========================================
  // DOCUMENTOS
  // ==========================================

  /**
   * GET /api/providers/:providerId/documents
   * Lista todos los documentos
   */
  static async listDocuments(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId } = req.params;
      const { type, limit, offset } = req.query;

      const options = {
        type: type || null,
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0
      };

      const service = new ProviderService();
      const documents = await service.listDocuments(userId, providerId, options);

      return ResponseHandler.success(res, documents, 'Documentos obtenidos exitosamente');
    } catch (error) {
      logger.error('Error en listDocuments', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error listando documentos'));
    }
  }

  /**
   * POST /api/providers/:providerId/documents
   * Crea un nuevo documento
   */
  static async createDocument(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId } = req.params;
      const documentData = {
        ...req.body,
        uploadedByName: req.user.displayName || req.user.email
      };

      const service = new ProviderService();
      const document = await service.createDocument(userId, providerId, documentData);

      return ResponseHandler.created(res, document, 'Documento creado exitosamente');
    } catch (error) {
      logger.error('Error en createDocument', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error creando documento'));
    }
  }

  /**
   * DELETE /api/providers/:providerId/documents/:documentId
   * Elimina un documento
   */
  static async deleteDocument(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId, documentId } = req.params;

      const service = new ProviderService();
      await service.deleteDocument(userId, providerId, documentId);

      return ResponseHandler.success(res, null, 'Documento eliminado exitosamente');
    } catch (error) {
      logger.error('Error en deleteDocument', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error eliminando documento'));
    }
  }

  // ==========================================
  // ACTIVIDADES
  // ==========================================

  /**
   * GET /api/providers/:providerId/activities
   * Lista todas las actividades
   */
  static async listActivities(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId } = req.params;
      const { type, entityType, entityId, limit, offset } = req.query;

      const options = {
        type: type || null,
        entityType: entityType || null,
        entityId: entityId || null,
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0
      };

      const service = new ProviderService();
      const activities = await service.listActivities(userId, providerId, options);

      return ResponseHandler.success(res, activities, 'Actividades obtenidas exitosamente');
    } catch (error) {
      logger.error('Error en listActivities', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error listando actividades'));
    }
  }

  /**
   * POST /api/providers/:providerId/activities
   * Crea una nueva actividad manualmente
   */
  static async createActivity(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId } = req.params;
      const activityData = {
        ...req.body,
        createdByName: req.user.displayName || req.user.email
      };

      const service = new ProviderService();
      const activity = await service.createActivity(userId, providerId, activityData);

      return ResponseHandler.created(res, activity, 'Actividad creada exitosamente');
    } catch (error) {
      logger.error('Error en createActivity', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error creando actividad'));
    }
  }

  // ==========================================
  // CALIFICACIONES
  // ==========================================

  /**
   * GET /api/providers/:providerId/rating
   * Obtiene la calificación del proveedor
   */
  static async getRating(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId } = req.params;

      const service = new ProviderService();
      const rating = await service.getRating(userId, providerId);

      return ResponseHandler.success(res, rating, 'Calificación obtenida exitosamente');
    } catch (error) {
      logger.error('Error en getRating', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo calificación'));
    }
  }

  /**
   * POST /api/providers/:providerId/rating
   * Crea o actualiza la calificación del proveedor
   */
  static async updateRating(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId } = req.params;
      const ratingData = {
        ...req.body,
        createdByName: req.user.displayName || req.user.email
      };

      const service = new ProviderService();
      const rating = await service.updateRating(userId, providerId, ratingData);

      return ResponseHandler.success(res, rating, 'Calificación actualizada exitosamente');
    } catch (error) {
      logger.error('Error en updateRating', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error actualizando calificación'));
    }
  }

  // ==========================================
  // ESTADO DE CUENTA
  // ==========================================

  /**
   * GET /api/providers/:providerId/account-statement
   * Obtiene el estado de cuenta del proveedor
   */
  static async getAccountStatement(req, res, next) {
    try {
      const userId = req.user.email || req.user.id;
      const { providerId } = req.params;
      const { from, to } = req.query;

      // Validar parámetros
      if (!from || !to) {
        return ResponseHandler.error(
          res,
          CommonErrors.VALIDATION_ERROR('Los parámetros from y to son requeridos'),
          400
        );
      }

      const service = new ProviderService();
      const statement = await service.getAccountStatement(userId, providerId, from, to);

      return ResponseHandler.success(res, statement, 'Estado de cuenta obtenido exitosamente');
    } catch (error) {
      logger.error('Error en getAccountStatement', { error: error.message });
      
      if (error instanceof ApiError) {
        return ResponseHandler.error(res, error, error.statusCode);
      }
      
      return ResponseHandler.error(res, CommonErrors.INTERNAL_SERVER_ERROR('Error obteniendo estado de cuenta'));
    }
  }
}

module.exports = InventoryProviderController;

